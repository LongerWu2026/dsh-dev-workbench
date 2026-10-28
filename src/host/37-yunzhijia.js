/* ============================================================================
 * dev-workbench host — 云之家 yzj-cli integration (design report §3.2, §6.3)
 *
 * The enterprise connector, at last, against the real CLI. Design report §6.3
 * demanded measured facts, not claims, so every capability listed here is
 * something this module actually exercised:
 *
 *   - `yzj-cli whoami`        → authenticated user (name, openId, token expiry)
 *   - `im message search`     → cross-group keyword search; @mentions carry
 *                               param.notifyType === 1 and param.desc[]
 *                               entries {type:'at', data:<openId>}
 *   - `doc search`            → knowledge-base title search (openWebUrl may be
 *                               null; never fabricate a link)
 *
 * Permission ladder (§7.1): everything here is L1 authorized read-only. The
 * allowlist below is checked BEFORE spawn and admits only read commands;
 * send / recall / write / delete / approve / grant are structurally absent —
 * those stay in agent sessions behind per-action approval, never in a plugin
 * background call. The CLI's own exit-10 confirmation gate backs this up.
 *
 * The binary is resolved through ctx.subprocess.resolveExecutable when the
 * provider can see it, with an nvm-path fallback because GUI-launched hosts
 * often lack shell-profile PATH entries.
 * ========================================================================== */

const YZJ_TIMEOUT_MS = 15000
const YZJ_MAX_BYTES = 512 * 1024
const MENTIONS_FETCH_LIMIT = 80

/** Read-only command prefixes; anything else is refused before spawn. */
const YZJ_READ_ONLY = [
  'whoami',
  'im group recent',
  'im group search',
  'im group.members list',
  'im message list',
  'im message search',
  'contact user search',
  'contact user get',
  'contact dept get',
  'approval flow list',
  'approval flow get',
  'calendar event list',
  'calendar event get',
  'calendar event participants',
  'calendar room find',
  'doc workspace list',
  'doc workspace get',
  'doc list',
  'doc get',
  'doc recent',
  'doc search',
  'doc block list',
  'doc download',
  'sheet get',
  'sheet table get',
  'sheet record list',
  'attendance record list',
]

let yzjPathCache = undefined

function yzjCommandAllowed(argv) {
  if (!Array.isArray(argv) || argv.length < 1) return false
  const parts = argv.map(String)
  // Drop a leading binary name if present: callers pass either the bare
  // subcommand argv ('whoami') or the full argv including the resolved path.
  if (parts.length > 1 && /yzj-cli$/i.test(parts[0])) parts.shift()
  const candidate = parts.join(' ')
  if (candidate.length === 0) return false
  return YZJ_READ_ONLY.some(function (prefix) {
    return candidate === prefix || candidate.startsWith(prefix + ' ')
  })
}

async function resolveYzjPath(ctx) {
  if (yzjPathCache !== undefined) return yzjPathCache
  const subprocess = ctx && ctx.get ? ctx.get('subprocess') : null
  if (subprocess && typeof subprocess.resolveExecutable === 'function') {
    let signal
    try {
      signal = AbortSignal.timeout(2500)
    } catch (e) {
      signal = undefined
    }
    try {
      const resolved = await subprocess.resolveExecutable('yzj-cli', undefined, signal)
      if (typeof resolved === 'string' && resolved.length > 0) {
        yzjPathCache = resolved
        return resolved
      }
    } catch (e) {
      /* fall through to the filesystem scan */
    }
  }
  // Filesystem scan ONLY when no subprocess provider exists AND the host
  // process itself shows an nvm-style environment; a scan that silently
  // executes a discovered binary is a real capability gain, so it must be
  // observable (the connector row reports the resolved path). The scan is
  // skipped entirely when a provider is present but resolution failed — that
  // provider owns the truth about its execution world.
  const home = homedir()
  const nvmDir = process.env.NVM_DIR || join(home, '.nvm')
  const candidates = [
    join(nvmDir, 'versions', 'node'),
    '/usr/local/bin',
    join(home, '.local', 'bin'),
    join(home, '.cargo', 'bin'),
    join(home, 'bin'),
  ]
  const sawProvider = !!subprocess
  for (const dir of candidates) {
    const direct = join(dir, 'yzj-cli')
    if (existsSync(direct)) {
      // A provider that failed to resolve while the file exists is suspicious;
      // trust the provider only when it did resolve. Otherwise fall back.
      if (sawProvider) continue
      yzjPathCache = direct
      return direct
    }
    try {
      const versions = readdirSync(dir)
      for (const version of versions) {
        const nested = join(dir, version, 'bin', 'yzj-cli')
        if (existsSync(nested)) {
          if (sawProvider) continue
          yzjPathCache = nested
          return nested
        }
      }
    } catch (e) {
      /* not an nvm directory */
    }
  }
  // Misses are NOT cached: a yzj-cli installed later (or a subprocess provider
  // appearing in a later test pass) must be picked up without a restart, and a
  // failed probe is cheap compared to a stale "unconfigured" verdict.
  return null
}

/** Invalidate the resolved-binary cache (used by tests and manual reprobe). */
function invalidateYzjPathCache() {
  yzjPathCache = undefined
}

/**
 * Run one read-only yzj-cli command and parse its JSON envelope.
 * Never throws: every failure is data, so callers degrade instead of break.
 */
async function runYzj(ctx, args) {
  if (!yzjCommandAllowed(['yzj-cli'].concat(args))) {
    return { status: 'refused', note: '命令不在云之家只读 allowlist 内：yzj-cli ' + args.join(' ') }
  }
  const path = await resolveYzjPath(ctx)
  if (!path) {
    return { status: 'unavailable', note: '未找到 yzj-cli（PATH 与常见安装位置都没有）' }
  }
  const subprocess = ctx && ctx.get ? ctx.get('subprocess') : null
  if (!subprocess || typeof subprocess.spawn !== 'function') {
    return { status: 'unavailable', note: '当前 profile 未组合 subprocess 服务' }
  }
  let signal
  try {
    signal = AbortSignal.timeout(YZJ_TIMEOUT_MS)
  } catch (e) {
    signal = undefined
  }
  let handle
  try {
    handle = subprocess.spawn({
      argv: [path].concat(args.map(String)),
      cwd: homedir(),
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: YZJ_MAX_BYTES },
        stderr: { maxBytes: 16 * 1024 },
      },
      graceMs: 2500,
      signal: signal,
    })
  } catch (e) {
    return { status: 'error', note: '无法启动 yzj-cli：' + String((e && e.message) || e) }
  }
  try {
    const outcome = await handle.done
    const read = function (reader) {
      if (!reader || typeof reader.readFrom !== 'function') return ''
      try {
        return String(reader.readFrom(0).text || '')
      } catch (e) {
        return ''
      }
    }
    const stdout = read(handle.collected && handle.collected.stdout)
    const stderr = read(handle.collected && handle.collected.stderr)
    if (outcome && outcome.exitCode !== 0) {
      return {
        status: 'error',
        exitCode: outcome.exitCode,
        note: (stderr.trim() || stdout.trim() || '退出码 ' + outcome.exitCode).slice(0, 300),
      }
    }
    let json = null
    try {
      json = JSON.parse(stdout)
    } catch (e) {
      json = null
    }
    if (!json || typeof json !== 'object') {
      return { status: 'error', exitCode: 0, note: 'yzj-cli 输出不是 JSON（可能要求重新登录）' }
    }
    if (json.success !== true) {
      const errorCode = json.errorCode || (json.error && json.error.errorCode)
      return {
        status: 'unauthorized',
        note: '云之家返回失败' + (errorCode ? '（errorCode ' + errorCode + '，可能需要重新 auth login）' : ''),
        json: json,
      }
    }
    return { status: 'ok', json: json }
  } catch (e) {
    return { status: 'error', note: String((e && e.message) || e).slice(0, 300) }
  }
}

/** Who is logged in, and is the token usable. Cached briefly per call site. */
async function probeYunzhijia(ctx) {
  const result = await runYzj(ctx, ['whoami'])
  if (result.status === 'unavailable') {
    return { state: 'unconfigured', note: result.note, name: null, openId: null, expiresAt: null }
  }
  if (result.status === 'refused' || result.status === 'error') {
    return { state: 'error', note: result.note || 'whoami 执行失败', name: null, openId: null, expiresAt: null }
  }
  if (result.status === 'unauthorized') {
    return { state: 'unauthorized', note: result.note, name: null, openId: null, expiresAt: null }
  }
  const data = result.json && result.json.data
  if (!data || typeof data.openId !== 'string') {
    return { state: 'error', note: 'whoami 返回缺少 openId', name: null, openId: null, expiresAt: null }
  }
  return {
    state: 'ok',
    note: null,
    name: asString(data.name, 80) || null,
    openId: data.openId,
    expiresAt: asIso(data.expiresAt) || null,
  }
}

/* ------------------------------------------------------------- @mentions */

function yzjMentionTargetsMe(message, myOpenId) {
  if (!message || typeof message !== 'object') return false
  const param = message.param
  if (param && typeof param === 'object') {
    if (param.notifyType === 1) return true
    if (Array.isArray(param.desc)) {
      for (const entry of param.desc) {
        if (entry && typeof entry === 'object' && entry.type === 'at' && entry.data === myOpenId) return true
      }
    }
  }
  return false
}

/** 批量解析 openId → 姓名（一次 CLI 调用，最多 6 个）。 */
async function resolveSenderNames(ctx, openIds) {
  const unique = Array.from(
    new Set(
      (openIds || []).filter(function (id) {
        return typeof id === 'string' && id.length > 0
      }),
    ),
  ).slice(0, 6)
  if (unique.length === 0) return new Map()
  const args = ['contact', 'user', 'get']
  unique.forEach(function (id) {
    args.push('--open-id', id)
  })
  const result = await runYzj(ctx, args)
  const map = new Map()
  if (result.status !== 'ok' || !result.json || !result.json.data) return map
  const list = Array.isArray(result.json.data.list) ? result.json.data.list : [result.json.data]
  list.forEach(function (user) {
    if (user && typeof user.openId === 'string') {
      map.set(user.openId, asString(user.name || user.userName, 80) || null)
    }
  })
  return map
}

function yzjParseMentionSearch(json, myOpenId) {
  const out = []
  const groups = json && json.data && Array.isArray(json.data.list) ? json.data.list : []
  for (const group of groups) {
    const groupName = asString(group && group.group && group.group.groupName, 120) || '未知会话'
    const groupId = asString(group && group.group && group.group.groupId, 60) || null
    const messages = group && Array.isArray(group.messages) ? group.messages : []
    for (const wrapper of messages) {
      const message = wrapper && wrapper.message ? wrapper.message : wrapper
      if (!message || typeof message !== 'object') continue
      if (!yzjMentionTargetsMe(message, myOpenId)) continue
      if (message.fromOpenId === myOpenId) continue
      out.push({
        msgId: asString(message.msgId, 60),
        groupId: groupId,
        groupName: groupName,
        content: asString(message.content, 2000),
        fromOpenId: asString(message.fromOpenId, 60) || null,
        sendTime: asIso(message.sendTime) || null,
      })
    }
  }
  return out
}

/**
 * 增量游标同步（TODO 05）：
 *   1. im group recent 取最近会话；
 *   2. 每个群用 cursor.lastMsgId 拉「新消息」（--type new），没有游标时取最新一页；
 *   3. 用 param.notifyType / desc[].type==='at' 判定「有人在群里 @我」——
 *      这条判据不依赖显示名，因此**昵称 @ 也能覆盖**（关键词检索会漏）；
 *   4. 把每群最新 msgId 存回游标，下次只取增量。
 * 返回 null 表示这条路不可用，调用方回退到关键词检索。
 */
async function fetchMentionsIncremental(ctx, probe, cursors) {
  // 会话发现翻页：直到取回不足一页（支持 >12 个最近会话，TODO 13）
  const groups = []
  for (let pageIndex = 1; pageIndex <= 6; pageIndex += 1) {
    const listed = await runYzj(ctx, ['im', 'group', 'recent', '--limit', '12', '--page', String(pageIndex)])
    if (listed.status !== 'ok') {
      // 会话页失败：已拿到的会话继续处理，失败如实记录（单群仍可各自补采）
      groups.push({ __error: { status: listed.status, note: listed.note } })
      break
    }
    const batch = listed.json && listed.json.data && Array.isArray(listed.json.data.list) ? listed.json.data.list : []
    for (const group of batch) {
      if (group && group.groupId && !groups.some(function (row) { return row.groupId === group.groupId })) groups.push(group)
    }
    if (batch.length < 12) break
  }
  const pageErrors = groups.filter(function (row) { return row && row.__error }).map(function (row) { return row.__error })
  const usableGroups = groups.filter(function (row) { return row && row.groupId })
  if (groups.length === 0) return null

  const mentions = []
  const nextCursors = Object.assign({}, cursors || {})
  const pageFailures = []
  let scannedGroups = 0
  let scannedMessages = 0

  // TODO 13：不再有「前 10 个会话」的旧硬上限——翻页拿到的会话全部处理，上限放宽到 40
  // （每群的排空翻页与单群失败保护独立生效，尽量在单次同步内覆盖真实活跃群）
  for (const group of groups.slice(0, 40)) {
    const groupId = asString(group && group.groupId, 80)
    const groupName = asString(group && group.groupName, 120) || '未知会话'
    if (!groupId) continue
    // 排空翻页（TODO 13，真实 CLI 语义验证）：
    //   第一页 --type newest（最新 20 条，时间升序 list[0] 最旧、list[last] 最新）
    //   翻页 --type old --msg-id <本页最旧 list[0]>（往前翻历史）
    //   游标只推进「该群已见过的最新一条」 = list[last]，且仅当该群所有页都成功
    const cursor = nextCursors[groupId]
    const fetched = []
    let drainPage = 0
    let drainAnchor = null
    let failedPage = null
    while (drainPage < 6) {
      const args = ['im', 'message', 'list', '--group-id', groupId, '--limit', '20']
      if (drainPage === 0) {
        args.push('--type', 'newest')
      } else {
        args.push('--type', 'old', '--msg-id', drainAnchor)
      }
      const listed = await runYzj(ctx, args)
      if (listed.status !== 'ok') {
        failedPage = { group: groupId, at: drainAnchor || null, status: listed.status, note: listed.note }
        break
      }
      const rows = listed.json && listed.json.data && Array.isArray(listed.json.data.list) ? listed.json.data.list : []
      // 遇到上次已见的游标（该消息已采集过）→ 停止向更旧展开
      if (cursor && cursor.lastMsgId && rows.some(function (row) {
        const inner = row && row.message ? row.message : row
        return String((inner && inner.msgId) || '') === String(cursor.lastMsgId)
      })) break
      scannedMessages += rows.length
      fetched.push.apply(fetched, rows)
      if (rows.length > 0) {
        const oldestRow = rows[0]
        const inner = oldestRow && oldestRow.message ? oldestRow.message : oldestRow
        drainAnchor = asString((inner && inner.msgId) || '', 60) || null
      }
      if (rows.length < 20) break
      drainPage += 1
    }
    scannedGroups += 1
    for (const wrapper of fetched) {
      const message = wrapper && wrapper.message ? wrapper.message : wrapper
      if (!message || typeof message !== 'object') continue
      if (!yzjMentionTargetsMe(message, probe.openId)) continue
      if (message.fromOpenId === probe.openId) continue
      mentions.push({
        msgId: asString(message.msgId, 60),
        groupId: groupId,
        groupName: groupName,
        content: asString(message.content, 2000),
        fromOpenId: asString(message.fromOpenId, 60) || null,
        sendTime: asIso(message.sendTime) || null,
      })
    }
    const drained = fetched.length > 0
    if (drained) {
      // 升序列表：list[last] 才是本群最新一条
      const newestInner = fetched[fetched.length - 1]
      const inner = newestInner && newestInner.message ? newestInner.message : newestInner
      if (inner && inner.msgId) {
        nextCursors[groupId] = {
          lastMsgId: asString(inner.msgId, 60),
          lastSendTime: asIso(inner.sendTime) || null,
          groupName: groupName,
          at: hostNowIso(),
        }
      }
    }
    if (failedPage) {
      // 单群失败：不推进游标（保留补采位），错误只进报告
      pageFailures.push(failedPage)
    }
  }
  return {
    mentions: mentions,
    cursors: nextCursors,
    scannedGroups: scannedGroups,
    scannedMessages: scannedMessages,
    pageFailures: pageFailures,
    sessionPageErrors: pageErrors,
  }
}

/**
 * Design report §3.2: pull @-mention messages as source evidence. Deterministic
 * part only — creating tasks with AI-extracted fields stays an agent job.
 * Keyword search matches "@<display name>"; a custom remark name would be
 * missed, and the persisted report says so honestly.
 */
async function fetchYunzhijiaMentionsInto(ctx, state) {
  const probe = await probeYunzhijia(ctx)
  const at = hostNowIso()
  if (probe.state !== 'ok') {
    state.lastMentionsFetch = {
      at: at,
      status: probe.state,
      found: 0,
      added: 0,
      note: probe.note || '云之家不可用',
    }
    auditEntry(state, 'mentions.fetch', '云之家不可用：' + (probe.note || probe.state))
    return state
  }

  // 优先走增量游标（可覆盖昵称 @）；不可用时回退关键词检索
  const incrementalResult = await fetchMentionsIncremental(ctx, probe, state.syncCursors)
  const incremental = incrementalResult && incrementalResult.error ? null : incrementalResult
  const incrementalError = incrementalResult && incrementalResult.error ? incrementalResult.error : null
  let keywords = ['@' + probe.name].concat(
    ensureArray(state.settings && state.settings.mentionKeywords).map(function (word) {
      return String(word).indexOf('@') === 0 ? String(word) : '@' + String(word)
    }),
  )
  const keywordMentions = []
  let searchFailure = incrementalError
  if (!incremental) {
    for (const keyword of keywords.slice(0, 3)) {
      const searched = await runYzj(ctx, ['im', 'message', 'search', '--keyword', keyword])
      if (searched.status !== 'ok') {
        // 如实记录失败：不要把「接口不可用」当成「没有 @我」
        if (!searchFailure) searchFailure = { status: searched.status, note: searched.note }
        continue
      }
      for (const mention of yzjParseMentionSearch(searched.json, probe.openId)) keywordMentions.push(mention)
    }
  }
  if (!incremental && keywordMentions.length === 0 && searchFailure) {
    state.lastMentionsFetch = {
      at: at,
      status: searchFailure.status === 'refused' ? 'error' : searchFailure.status,
      found: 0,
      added: 0,
      note: '消息接口不可用：' + (searchFailure.note || searchFailure.status),
    }
    auditEntry(state, 'mentions.fetch', '消息接口不可用：' + (searchFailure.note || searchFailure.status))
    return state
  }
  const rawMentions = incremental
    ? incremental.mentions
    : keywordMentions
  if (incremental && incremental.cursors) {
    state.syncCursors = incremental.cursors
  }

  const mentions = rawMentions
    .filter(function (mention) {
      return !!mention.msgId
    })
    .slice(0, MENTIONS_FETCH_LIMIT)

  // 发送人姓名：一次批量查询，失败不影响主流程（回退为 openId 短标识）
  const senderNames = await resolveSenderNames(
    ctx,
    mentions.map(function (mention) {
      return mention.fromOpenId
    }),
  )
  const existing = new Set(
    ensureArray(state.sources)
      .filter(function (row) {
        return row.provider === 'yunzhijia'
      })
      .map(function (row) {
        return row.externalId
      }),
  )
  let added = 0
  for (const mention of mentions) {
    const externalId = 'yzj:msg:' + mention.msgId
    if (existing.has(externalId)) continue
    existing.add(externalId)
    const createdSource = normalizeSource({
      provider: 'yunzhijia',
      externalId: externalId,
      url: null,
      title: '@我 · ' + mention.groupName,
      excerpt: mention.content,
      fetchedAt: mention.sendTime || at,
      sender:
        (mention.fromOpenId && senderNames.get(mention.fromOpenId)) ||
        (mention.fromOpenId ? mention.fromOpenId.slice(0, 8) + '…' : null),
      locator: {
        groupId: mention.groupId,
        msgId: mention.msgId,
        groupName: mention.groupName,
      },
    })
    state.sources = ensureArray(state.sources).concat([createdSource])
    added += 1
    // TODO 14：新来源进入分析队列（AI 识别）；采集游标照常推进，互不阻塞
    if (!ensureArray(state.analysisQueue).some(function (row) { return row.sourceId === createdSource.id })) {
      state.analysisQueue = ensureArray(state.analysisQueue).concat([
        {
          id: newId('aq'),
          sourceId: createdSource.id,
          msgId: mention.msgId,
          groupId: mention.groupId,
          status: 'pending',
          attempts: 0,
          at: hostNowIso(),
        },
      ]).slice(-300)
    }
  }

  const mode = incremental
    ? '增量排空（最近 ' +
      incremental.scannedGroups +
      ' 个群 / ' +
      incremental.scannedMessages +
      ' 条新消息，notifyType 判据可覆盖昵称 @' +
      (incremental.pageFailures && incremental.pageFailures.length
        ? '；' + incremental.pageFailures.length + ' 个群待补采'
        : '') +
      (incremental.sessionPageErrors && incremental.sessionPageErrors.length
        ? '；会话翻页失败 ' + incremental.sessionPageErrors.length
        : '') +
      '）'
    : '关键词检索（' + keywords.slice(0, 3).join(' / ') + '）'
  const failureNote = incremental
    ? [
        incremental.pageFailures && incremental.pageFailures.length
          ? '失败保留补采位：' + incremental.pageFailures.map(function (row) { return String(row.group).slice(0, 6) + '…(' + (row.note || row.status) + ')' }).slice(0, 4).join('、')
          : null,
        incremental.sessionPageErrors && incremental.sessionPageErrors.length
          ? '会话翻页失败：' + incremental.sessionPageErrors[0].note
          : null,
      ]
        .filter(Boolean)
        .join('；')
    : null
  state.lastMentionsFetch = {
    at: at,
    status: 'ok',
    found: mentions.length,
    added: added,
    user: probe.name,
    mode: incremental ? 'incremental' : 'keyword',
    status: incremental && failureNote ? 'partial' : 'ok',
    note:
      mode +
      (probe.expiresAt ? '；token 至 ' + probe.expiresAt.slice(0, 16).replace('T', ' ') + ' 有效' : '') +
      (failureNote ? '。' + failureNote : '') +
      (incremental ? '。' : '。昵称 @ 可能漏采，可在「连接与设置」补充关键词。'),
  }
  auditEntry(state, 'mentions.fetch', '发现 ' + mentions.length + ' 条 @我，新增来源 ' + added + ' 条（' + (incremental ? '增量' : '关键词') + '）')
  return state
}

/* ------------------------------------------------------- enterprise search */

/** The 企业（云之家） search group — real results when yzj-cli is usable. */
async function searchEnterpriseGroup(ctx, query) {
  const probe = await probeYunzhijia(ctx)
  if (probe.state !== 'ok') {
    return {
      id: 'enterprise',
      label: '企业（云之家）',
      status: 'unavailable',
      items: [],
      note: probe.note || '云之家 CLI 不可用：' + probe.state,
    }
  }

  const items = []

  const messageResult = await runYzj(ctx, ['im', 'message', 'search', '--keyword', query])
  if (messageResult.status === 'ok') {
    const groups = messageResult.json && messageResult.json.data && messageResult.json.data.list
    if (Array.isArray(groups)) {
      for (const group of groups) {
        const groupName = asString(group && group.group && group.group.groupName, 120) || '未知会话'
        const messages = group && Array.isArray(group.messages) ? group.messages : []
        for (const wrapper of messages.slice(0, 3)) {
          const message = wrapper && wrapper.message ? wrapper.message : wrapper
          if (!message || typeof message !== 'object') continue
          items.push({
            id: 'yzj-msg-' + asString(message.msgId, 60),
            title: asString(message.content, 120) || '(空消息)',
            snippet: asString(message.content, 400),
            url: null,
            kind: 'source',
            extra: { provider: 'yunzhijia', at: asIso(message.sendTime), group: groupName },
          })
        }
      }
    }
  }

  const docResult = await runYzj(ctx, ['doc', 'search', '--keyword', query])
  if (docResult.status === 'ok') {
    const docs = docResult.json && docResult.json.data && docResult.json.data.list
    if (Array.isArray(docs)) {
      for (const doc of docs.slice(0, 5)) {
        if (!doc || typeof doc !== 'object') continue
        items.push({
          id: 'yzj-doc-' + asString(doc.id, 60),
          title: asString(doc.fileName || doc.title, 200) || '未命名文档',
          snippet: [asString(doc.kbName, 80), asString(doc.creatorName, 40) + ' 创建']
            .filter(Boolean)
            .join(' · '),
          url: asUrl(doc.openWebUrl),
          kind: 'knowledge',
          extra: { provider: 'yunzhijia', at: asIso(doc.updateTime || doc.createTime), group: asString(doc.kbName, 80) },
        })
      }
    }
  }

  const imFailed = messageResult.status !== 'ok'
  const docFailed = docResult.status !== 'ok'
  const status = items.length > 0 ? 'ok' : imFailed && docFailed ? 'error' : 'empty'
  const notes = []
  if (imFailed) notes.push('消息一路失败：' + (messageResult.note || messageResult.status))
  if (docFailed) notes.push('文档一路失败：' + (docResult.note || docResult.status))
  return {
    id: 'enterprise',
    label: '企业（云之家）',
    status: status,
    items: items.slice(0, SEARCH_GROUP_LIMIT),
    note: notes.length > 0 ? notes.join('；') : '来自云之家消息与知识库；文档链接以 openWebUrl 为准，为空时不构造地址。',
  }
}


/* --------------------------------------------------- §3.3 其余企业 Provider */

/**
 * 联系人：只在「像人名的查询」或明确的找人意图下触发，避免每次搜索都多打
 * 一次企业通讯录（也对隐私更克制）。
 */
async function searchContactsGroup(ctx, query) {
  const looksLikeName = /^[\u4e00-\u9fa5]{2,4}$/.test(query)
  const explicitIntent = /找人|联系|同事|部门|谁是|联系人|通讯录/.test(query)
  if (!looksLikeName && !explicitIntent) return null

  const result = await runYzj(ctx, ['contact', 'user', 'search', '--keyword', query])
  if (result.status !== 'ok') {
    return {
      id: 'contacts',
      label: '企业联系人',
      status: 'error',
      items: [],
      note: '通讯录查询失败：' + (result.note || result.status),
    }
  }
  const list = (result.json && result.json.data && Array.isArray(result.json.data.list) ? result.json.data.list : []).slice(0, 6)
  const items = list.map(function (user) {
    if (!user || typeof user !== 'object') return null
    const name = asString(user.name || user.userName, 80)
    if (!name) return null
    return {
      id: 'yzj-user-' + (asString(user.openId, 80) || name),
      title: name,
      snippet: [asString(user.department || user.orgName, 80), asString(user.jobTitle, 60)]
        .filter(Boolean)
        .join(' · '),
      url: null,
      kind: 'contact',
      extra: { openId: asString(user.openId, 80), department: asString(user.department || user.orgName, 80) },
    }
  }).filter(Boolean)
  if (items.length === 0) return null
  return {
    id: 'contacts',
    label: '企业联系人',
    status: 'ok',
    items: items,
    note: '按姓名/关键词匹配企业通讯录，仅返回展示所需字段（姓名、部门、职位）。',
  }
}

/** 会议室：只在会议/场地类查询下触发，按当天可用会议室过滤名称。 */
async function searchRoomsGroup(ctx, query) {
  if (!/会议室|会议|场地|room|预定|有空/.test(query)) return null

  const today = new Date()
  const pad = function (value) {
    return value < 10 ? '0' + value : String(value)
  }
  const day = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate())
  const result = await runYzj(ctx, ['calendar', 'room', 'find', '--start', day, '--end', day])
  if (result.status !== 'ok') {
    return {
      id: 'rooms',
      label: '会议室',
      status: 'error',
      items: [],
      note: '会议室查询失败：' + (result.note || result.status),
    }
  }
  const rooms = result.json && result.json.data && Array.isArray(result.json.data.list) ? result.json.data.list : []
  const needle = String(query)
    .replace(/会议室|会议|场地|room|预定|有空/g, '')
    .trim()
  const matched = rooms.filter(function (room) {
    if (!room || typeof room.roomName !== 'string') return false
    return needle.length === 0 ? true : room.roomName.indexOf(needle) >= 0
  }).slice(0, 8)
  const items = matched.map(function (room) {
    return {
      id: 'yzj-room-' + (asString(room.roomId, 80) || room.roomName),
      title: asString(room.roomName, 120),
      snippet: [asString(room.roomDetail, 80), room.limitCount ? '可容纳 ' + room.limitCount + ' 人' : '']
        .filter(Boolean)
        .join(' · '),
      url: null,
      kind: 'room',
      extra: { roomId: asString(room.roomId, 80), at: null },
    }
  })
  if (items.length === 0) return null
  return {
    id: 'rooms',
    label: '会议室',
    status: 'ok',
    items: items,
    note: '查的是今天可预约的会议室（calendar room find）；会议室预订属于写操作，不在插件内。',
  }
}

/** 考勤：只在考勤意图下触发，只返回本人打卡流水。 */
async function searchAttendanceGroup(ctx, query) {
  if (!/打卡|考勤|出勤|clock|迟到|早退/.test(query)) return null

  const result = await runYzj(ctx, ['attendance', 'record', 'list'])
  if (result.status !== 'ok') {
    return {
      id: 'attendance',
      label: '考勤',
      status: 'error',
      items: [],
      note: '考勤查询失败：' + (result.note || result.status),
    }
  }
  const list = (result.json && result.json.data && Array.isArray(result.json.data.list) ? result.json.data.list : []).slice(0, 6)
  const items = list.map(function (record, index) {
    if (!record || typeof record !== 'object') return null
    const stamp = Number(record.clockInTime || record.clockTime)
    const at = Number.isFinite(stamp) && stamp > 0 ? new Date(stamp).toISOString() : null
    return {
      id: 'yzj-att-' + index,
      title: (record.clockInType ? record.clockInType + '·' : '') + (record.clockInStatus || '打卡记录'),
      snippet: [asString(record.clockInPosition, 80), at ? new Date(stamp).toLocaleString('zh-CN') : '']
        .filter(Boolean)
        .join(' · '),
      url: null,
      kind: 'attendance',
      extra: { at: at },
    }
  }).filter(Boolean)
  if (items.length === 0) return null
  return {
    id: 'attendance',
    label: '考勤',
    status: 'ok',
    items: items,
    note: '只查询本人当日打卡流水（attendance record list 的能力边界）。',
  }
}


/** 日程与会议（§3.5）：只在日程类意图下触发，查今天到未来 3 天。 */
async function searchEventsGroup(ctx, query) {
  if (!/日程|会议|开会|calendar|安排|纪要/.test(query)) return null
  const pad = function (value) {
    return value < 10 ? '0' + value : String(value)
  }
  const day = function (offset) {
    const date = new Date()
    date.setDate(date.getDate() + offset)
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
  }
  const result = await runYzj(ctx, ['calendar', 'event', 'list', '--start', day(0), '--end', day(3)])
  if (result.status !== 'ok') {
    return { id: 'events', label: '日程与会议', status: 'error', items: [], note: '日程查询失败：' + (result.note || result.status) }
  }
  const list = result.json && result.json.data && Array.isArray(result.json.data.list) ? result.json.data.list : []
  const needle = String(query).replace(/日程|会议|开会|calendar|安排|纪要/g, '').trim()
  const matched = list.filter(function (event) {
    if (!event || typeof event !== 'object') return false
    const title = asString(event.title || event.subject, 160)
    if (needle.length === 0) return true
    return title.indexOf(needle) >= 0
  }).slice(0, 8)
  const items = matched.map(function (event) {
    const start = event.startTime || event.start || event.beginTime
    const at = typeof start === 'number' ? new Date(start).toISOString() : asIso(start)
    return {
      id: 'yzj-event-' + (asString(event.id || event.eventId, 80) || String(Math.random()).slice(2, 8)),
      title: asString(event.title || event.subject, 160) || '未命名日程',
      snippet: [
        at ? new Date(at).toLocaleString('zh-CN') : '',
        asString(event.location || event.roomName, 80),
        asString(event.organizer || event.creatorName, 40),
      ]
        .filter(Boolean)
        .join(' · '),
      url: null,
      kind: 'event',
      extra: { at: at },
    }
  })
  if (items.length === 0) return null
  return {
    id: 'events',
    label: '日程与会议',
    status: 'ok',
    items: items,
    note: '查的是今天起 3 天内的日程（calendar event list）；创建/取消日程属于写操作，不在插件内。',
  }
}
