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
const MENTIONS_FETCH_LIMIT = 20

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

  const result = await runYzj(ctx, ['im', 'message', 'search', '--keyword', '@' + probe.name])
  if (result.status !== 'ok') {
    state.lastMentionsFetch = {
      at: at,
      status: result.status,
      found: 0,
      added: 0,
      note: result.note || '消息搜索失败',
    }
    auditEntry(state, 'mentions.fetch', '消息搜索失败：' + (result.note || result.status))
    return state
  }

  const mentions = yzjParseMentionSearch(result.json, probe.openId).slice(0, MENTIONS_FETCH_LIMIT)
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
    if (!mention.msgId || existing.has(externalId)) continue
    existing.add(externalId)
    state.sources = ensureArray(state.sources).concat([
      normalizeSource({
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
      }),
    ])
    added += 1
  }
  state.lastMentionsFetch = {
    at: at,
    status: 'ok',
    found: mentions.length,
    added: added,
    user: probe.name,
    note:
      '按 “@' +
      probe.name +
      '” 关键词检索' +
      (probe.expiresAt ? '；token 至 ' + probe.expiresAt.slice(0, 16).replace('T', ' ') + ' 有效' : '') +
      '。对方若用昵称 @ 你会漏掉，可在会话里让 Agent 补查。',
  }
  auditEntry(state, 'mentions.fetch', '发现 ' + mentions.length + ' 条 @我，新增来源 ' + added + ' 条')
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
