/* ============================================================================
 * dev-workbench host — 工作台助手（TODO 04：侧栏内可对话）
 *
 * 复用宿主原生的会话与模型链路，不在插件里自建模型调用：
 *
 *   插件侧栏输入 → workbench/assistantAsk
 *      → sessions.create()（首次，之后复用同一个会话）
 *      → sessionController.prompt({requestId, sessionId, mode:'queue', content})
 *      → 轮询 session.snapshotEvents() 等本轮 turn/end
 *      → 抽取 assistant/message 文本 + 本轮工具调用 → 回给侧栏
 *
 * 因为走的是原生会话，Agent 在回答时可以直接调用 workbench_* 工具，
 * 结果写回同一份工作台数据（页面靠 revision 轮询自动刷新）。
 *
 * 任一依赖缺失（sessions / sessionController）都如实返回 unavailable，
 * 侧栏会显示原因而不是假装能对话。
 * ========================================================================== */

const ASSISTANT_TIMEOUT_MS = 120000
const ASSISTANT_POLL_MS = 400

function sleepMs(ms) {
  // 请求内的等待必须持有活跃定时器：unref 会让事件循环在没有其它句柄时提前退出，
  // 导致 await 永远悬空（测试里表现为 unsettled top-level await）。
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

function hostService(ctx, key) {
  if (!ctx) return null
  if (typeof ctx.get === 'function') {
    const value = ctx.get(key)
    if (value) return value
  }
  return ctx[key] || null
}

/** 从 assistant/message 事件里抽出纯文本（content 是 ContentBlock[]）。 */
function assistantTextOf(message) {
  if (!message || !Array.isArray(message.content)) return ''
  return message.content
    .map(function (block) {
      if (!block || typeof block !== 'object') return ''
      if (block.type === 'text' && typeof block.text === 'string') return block.text
      if (block.type === 'reasoning') return ''
      return ''
    })
    .filter(Boolean)
    .join('\n')
    .trim()
}

/** 本会话里最近 N 轮问答，供侧栏恢复历史。 */
function assistantHistoryFrom(session, limit) {
  if (!session || typeof session.snapshotEvents !== 'function') return []
  const events = session.snapshotEvents()
  const out = []
  for (const event of events) {
    if (event.type === 'user/message') {
      const content = Array.isArray(event.data.content) ? event.data.content : []
      const text = content
        .map(function (block) {
          return block && block.type === 'text' ? block.text : ''
        })
        .filter(Boolean)
        .join('\n')
        .trim()
      if (text) out.push({ role: 'user', text: text, at: event.time })
    } else if (event.type === 'assistant/message') {
      const text = assistantTextOf(event.data.message)
      if (text) out.push({ role: 'assistant', text: text, at: event.time })
    }
  }
  return out.slice(-(limit || 20))
}

/** 会话的展示标题：优先取首条用户消息，其次给短 id。 */
function sessionTitleOf(session) {
  try {
    const events = session.snapshotEvents()
    for (const event of events) {
      if (event.type !== 'user/message') continue
      const content = Array.isArray(event.data.content) ? event.data.content : []
      const text = content
        .map(function (block) {
          return block && block.type === 'text' ? block.text : ''
        })
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (text) return text.slice(0, 40)
    }
  } catch (e) {
    /* 读不到就给短 id */
  }
  return '会话 ' + String(session.id).slice(-6)
}

function sessionLastAt(session) {
  try {
    const events = session.snapshotEvents()
    const last = events[events.length - 1]
    return last && last.time ? last.time : session.header && session.header.createdAt ? session.header.createdAt : null
  } catch (e) {
    return null
  }
}

/** 把会话事件转成侧栏可渲染的记录条目。 */
function transcriptOf(session, limit) {
  if (!session || typeof session.snapshotEvents !== 'function') return []
  const events = session.snapshotEvents()
  const entries = []
  let pendingCalls = []
  for (const event of events) {
    if (event.type === 'user/message') {
      const content = Array.isArray(event.data.content) ? event.data.content : []
      const text = content
        .map(function (block) {
          return block && block.type === 'text' ? block.text : ''
        })
        .filter(Boolean)
        .join('\n')
        .trim()
      if (text) entries.push({ role: 'user', text: text, at: event.time })
    } else if (event.type === 'tool/call') {
      const name = event.data && event.data.name ? String(event.data.name) : 'tool'
      const args = event.data && event.data.arguments ? event.data.arguments : null
      let summary = ''
      try {
        summary = args ? JSON.stringify(args).slice(0, 160) : ''
      } catch (e) {
        summary = ''
      }
      pendingCalls.push({ name: name, summary: summary })
    } else if (event.type === 'assistant/message') {
      const text = assistantTextOf(event.data.message)
      if (text || pendingCalls.length > 0) {
        entries.push({ role: 'assistant', text: text, at: event.time, toolCalls: pendingCalls.slice(0, 8) })
      }
      pendingCalls = []
    }
  }
  return entries.slice(-(limit || 40))
}

/** 旧版本存下来的默认计数字 id（session-1 / session-2…）：没有持久化日志，必须丢弃。 */
function isLegacySessionId(id) {
  return /^session-\d+$/.test(String(id || ''))
}

/**
 * 建一个**持久化**的会话。
 *
 * 关键：不能用 `sessions.create()`——它只造内存对象、不写会话日志，随后
 * `sessionController.prompt` 内部 resume 会抛 `SessionPersistenceNotFoundError`
 * （表现为 remote 端 `resume failed for session "session-1"`）。
 * 正确入口是 `sessionController.create`：它走 `createAgent → ctx.agents.create`，
 * 会建立可恢复的会话记录。
 */
async function createPersistedSession(ctx) {
  const controller = hostService(ctx, 'sessionController')
  if (!controller) return null
  const request = { cwd: cwdForHostCommands(ctx) }
  const creator =
    typeof controller.createSession === 'function'
      ? controller.createSession.bind(controller)
      : typeof controller.create === 'function'
        ? controller.create.bind(controller)
        : null
  if (!creator) return null
  const created = await creator(request)
  // create 返回 { agent, agentPreset }；agent 上挂着 session
  const agent = created && created.agent ? created.agent : created
  const session = agent && agent.session ? agent.session : agent
  if (!session || !session.id) throw new Error('会话创建失败：返回值里没有 session')
  return session
}

function rememberAssistantSession(sessionId) {
  mutateWorkbenchState(function (current) {
    current.settings.assistantSessionId = sessionId ? String(sessionId) : null
    return current
  })
}

/** 取（或建）助手会话；陈旧 id 自动丢弃重建。 */
async function ensureAssistantSession(ctx) {
  const sessions = hostService(ctx, 'sessions')
  const controller = hostService(ctx, 'sessionController')
  if (!sessions || typeof sessions.get !== 'function' || !controller) return null

  const state = loadWorkbenchState()
  const savedId = state.settings && state.settings.assistantSessionId
  if (savedId && !isLegacySessionId(savedId)) {
    const existing = sessions.get(savedId)
    if (existing) return existing
  }
  const session = await createPersistedSession(ctx)
  if (!session) return null
  rememberAssistantSession(session.id)
  return session
}

/**
 * 一次助手问答：提交提示 → 等待本轮结束 → 返回回复与工具调用。
 * 所有失败都以 {status, note} 返回，不抛给 Remote 层（侧栏要显示原因）。
 */
/** 最近会话列表（含助手会话标记），供侧栏切换。 */
async function listAssistantSessions(ctx, request) {
  const sessions = hostService(ctx, 'sessions')
  if (!sessions || typeof sessions.list !== 'function') {
    return { status: 'unavailable', note: '没有可用的会话服务', sessions: [], assistantSessionId: null }
  }
  const limit = Math.max(1, Math.min(20, Number(request && request.limit) || 12))
  const state = loadWorkbenchState()
  const currentId = state.settings && state.settings.assistantSessionId ? String(state.settings.assistantSessionId) : null
  const rows = sessions
    .list()
    .map(function (session) {
      return {
        id: String(session.id),
        title: sessionTitleOf(session),
        lastAt: sessionLastAt(session),
        createdAt: session.header && session.header.createdAt ? new Date(session.header.createdAt).toISOString() : null,
        isAssistant: currentId === String(session.id),
      }
    })
    .sort(function (a, b) {
      const left = a.lastAt ? new Date(a.lastAt).getTime() : 0
      const right = b.lastAt ? new Date(b.lastAt).getTime() : 0
      return right - left
    })
    .slice(0, limit)
  return { status: 'ok', sessions: rows, assistantSessionId: currentId }
}

/** 读取指定会话（缺省为助手会话）的记录。 */
async function readAssistantTranscript(ctx, request) {
  const sessions = hostService(ctx, 'sessions')
  if (!sessions || typeof sessions.get !== 'function') {
    return { status: 'unavailable', note: '没有可用的会话服务', messages: [] }
  }
  const wanted = asString(request && request.sessionId, 120)
  let session = null
  if (wanted) {
    session = sessions.get(wanted)
    if (!session) return { status: 'not_found', note: '找不到该会话', messages: [] }
  } else {
    session = await ensureAssistantSession(ctx)
    if (!session) return { status: 'unavailable', note: '没有可用的会话服务', messages: [] }
  }
  return {
    status: 'ok',
    sessionId: String(session.id),
    title: sessionTitleOf(session),
    messages: transcriptOf(session, Math.min(80, Number(request && request.limit) || 40)),
  }
}

/**
 * 增量读取（方案 A1）：只返回 fromSeq 之后的新条目，并告知本轮是否仍在进行。
 * 侧栏在 turnActive 期间轮询这个端点，实现「工具调用 → 结果 → 回复分段」的渐进渲染，
 * 不依赖未验证的 stream 描述符。
 */
function transcriptDelta(session, fromSeq) {
  const start = Number(fromSeq)
  const events = session.snapshotEvents(Number.isFinite(start) && start >= 0 ? start : 0)
  const entries = []
  let turnActive = false
  for (const event of events) {
    if (event.type === 'turn/start') {
      turnActive = true
      continue
    }
    if (event.type === 'turn/end') {
      turnActive = false
      continue
    }
    if (event.type === 'user/message') {
      const content = Array.isArray(event.data.content) ? event.data.content : []
      const text = content
        .map(function (block) {
          return block && block.type === 'text' ? block.text : ''
        })
        .filter(Boolean)
        .join('\n')
        .trim()
      if (text) entries.push({ role: 'user', text: text, at: event.time, seq: event.seq })
    } else if (event.type === 'assistant/message') {
      const text = assistantTextOf(event.data.message)
      if (text) entries.push({ role: 'assistant', text: text, at: event.time, seq: event.seq })
    } else if (event.type === 'tool/call') {
      const name = event.data && event.data.name ? String(event.data.name) : 'tool'
      let summary = ''
      try {
        summary = event.data && event.data.arguments ? JSON.stringify(event.data.arguments).slice(0, 200) : ''
      } catch (e) {
        summary = ''
      }
      entries.push({ role: 'tool', text: name, summary: summary, at: event.time, seq: event.seq })
    } else if (event.type === 'tool/result') {
      const name = event.data && event.data.name ? String(event.data.name) : 'tool'
      const ok = !(event.data && (event.data.isError === true || event.data.error))
      entries.push({ role: 'toolResult', text: name, ok: ok, at: event.time, seq: event.seq })
    } else if (event.type === 'turn/error') {
      const note = event.data && event.data.message ? String(event.data.message) : '本轮执行出错'
      entries.push({ role: 'error', text: note, at: event.time, seq: event.seq })
    }
  }
  return { entries: entries, nextSeq: session.seq, turnActive: turnActive }
}

/**
 * 提交提示，并在会话日志丢失时自愈。
 *
 * `prompt` 内部会对目标会话做 resume；如果该会话没有持久化日志（旧版本用
 * `sessions.create()` 建的空会话、或会话被清理过），就会抛
 * `resume failed for session "…": SessionPersistenceNotFoundError`。
 * 这里捕获这一类错误，重建一个持久化会话并重试一次，同时更新记录的会话 id。
 */
async function submitPrompt(ctx, controller, session, text, steer) {
  const build = function (sessionId) {
    return {
      requestId: 'wb-assistant-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      sessionId: sessionId,
      mode: steer === true ? 'steer' : 'queue',
      content: [{ type: 'text', text: text }],
      clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  }
  const attempt = async function (target) {
    const fromSeq = target.seq
    await controller.prompt(build(target.id), AbortSignal.timeout(30000))
    return { session: target, fromSeq: fromSeq, recovered: false }
  }
  try {
    return await attempt(session)
  } catch (error) {
    const message = String((error && error.message) || error)
    if (!/resume failed|SessionPersistenceNotFound/i.test(message)) throw error
    const fresh = await createPersistedSession(ctx)
    if (!fresh) throw error
    rememberAssistantSession(fresh.id)
    const retried = await attempt(fresh)
    return Object.assign({}, retried, { recovered: true })
  }
}

/** 只提交提示并立即返回（不等待本轮结束），供侧栏渐进渲染。 */
async function sendAssistantPrompt(ctx, request) {
  const input = request && typeof request === 'object' ? request : {}
  const text = asString(input.text, 4000)
  if (!text) return { status: 'invalid', note: '请输入内容' }

  const controller = hostService(ctx, 'sessionController')
  if (!controller || typeof controller.prompt !== 'function') {
    return {
      status: 'unavailable',
      note: '当前宿主没有 sessionController 服务，无法把提示提交给模型；可改用「复制上下文并打开会话」。',
    }
  }

  const wantedSession = asString(input.sessionId, 120)
  let session = null
  if (wantedSession) {
    const sessions = hostService(ctx, 'sessions')
    session = sessions && typeof sessions.get === 'function' ? sessions.get(wantedSession) : null
    if (!session) return { status: 'not_found', note: '找不到该会话：' + wantedSession }
    mutateWorkbenchState(function (current) {
      current.settings.assistantSessionId = String(session.id)
      return current
    })
  } else {
    session = await ensureAssistantSession(ctx)
    if (!session) return { status: 'unavailable', note: '当前宿主没有可用的 sessions / sessionController 服务。' }
  }

  const refs = Array.isArray(input.refs) ? input.refs.slice(0, 6) : []
  const lines = []
  if (refs.length > 0) {
    lines.push('【工作台上下文】')
    refs.forEach(function (ref, index) {
      lines.push(
        (index + 1) + '. [' + asString(ref.kind, 20) + '] ' + asString(ref.title, 200) +
          (ref.url ? ' — ' + asString(ref.url, 500) : '') +
          (ref.body ? '\n   ' + asString(ref.body, 600).replace(/\n/g, ' ') : ''),
      )
    })
    lines.push('')
  }
  lines.push(text)
  lines.push('')
  lines.push('（需要落库时请直接调用 workbench_* 工具：建/改待办、登记执行记录、写回资讯摘要。）')

  try {
    const submitted = await submitPrompt(ctx, controller, session, lines.join('\n'), input.steer === true)
    return {
      status: 'ok',
      sessionId: String(submitted.session.id),
      fromSeq: submitted.fromSeq,
      recovered: submitted.recovered === true,
    }
  } catch (e) {
    return { status: 'error', note: '提示提交失败：' + String((e && e.message) || e).slice(0, 240), sessionId: String(session.id) }
  }
}

/** 增量读取端点：供侧栏渐进渲染。 */
async function readAssistantDelta(ctx, request) {
  const input = request && typeof request === 'object' ? request : {}
  const sessions = hostService(ctx, 'sessions')
  if (!sessions || typeof sessions.get !== 'function') {
    return { status: 'unavailable', note: '没有可用的会话服务', entries: [], nextSeq: 0, turnActive: false }
  }
  const wanted = asString(input.sessionId, 120)
  let session = null
  if (wanted) {
    session = sessions.get(wanted)
    if (!session) return { status: 'not_found', note: '找不到该会话', entries: [], nextSeq: 0, turnActive: false }
  } else {
    session = await ensureAssistantSession(ctx)
    if (!session) return { status: 'unavailable', note: '没有可用的会话服务', entries: [], nextSeq: 0, turnActive: false }
  }
  const delta = transcriptDelta(session, Number(input.fromSeq) || 0)
  return Object.assign({ status: 'ok', sessionId: String(session.id) }, delta)
}

async function runAssistantAsk(ctx, request) {
  const input = request && typeof request === 'object' ? request : {}
  const text = asString(input.text, 4000)
  if (!text) return { status: 'invalid', note: '请输入内容', reply: '' }

  const controller = hostService(ctx, 'sessionController')
  if (!controller || typeof controller.prompt !== 'function') {
    return {
      status: 'unavailable',
      note: '当前宿主没有 sessionController 服务，无法把提示提交给模型；可改用「复制上下文并打开会话」。',
      reply: '',
    }
  }
  const wantedSession = asString(input.sessionId, 120)
  let session = null
  if (wantedSession) {
    const sessions = hostService(ctx, 'sessions')
    session = sessions && typeof sessions.get === 'function' ? sessions.get(wantedSession) : null
    if (!session) {
      return { status: 'not_found', note: '找不到该会话：' + wantedSession, reply: '' }
    }
    mutateWorkbenchState(function (current) {
      current.settings.assistantSessionId = String(session.id)
      return current
    })
  } else {
    session = await ensureAssistantSession(ctx)
    if (!session) {
      return {
        status: 'unavailable',
        note: '当前宿主没有可用的 sessions / sessionController 服务，无法创建助手会话。',
        reply: '',
      }
    }
  }
  let fromSeq = session.seq

  // 上下文引用拼进提示（保持可见、可回溯），Agent 可直接调用 workbench_* 工具回写
  const refs = Array.isArray(input.refs) ? input.refs.slice(0, 6) : []
  const lines = []
  if (refs.length > 0) {
    lines.push('【工作台上下文】')
    refs.forEach(function (ref, index) {
      lines.push(
        (index + 1) + '. [' + asString(ref.kind, 20) + '] ' + asString(ref.title, 200) +
          (ref.url ? ' — ' + asString(ref.url, 500) : '') +
          (ref.body ? '\n   ' + asString(ref.body, 600).replace(/\n/g, ' ') : ''),
      )
    })
    lines.push('')
  }
  lines.push(text)
  lines.push('')
  lines.push('（需要落库时请直接调用 workbench_* 工具：建/改待办、登记执行记录、写回资讯摘要。）')
  const promptText = lines.join('\n')

  try {
    const submitted = await submitPrompt(ctx, controller, session, promptText, false)
    session = submitted.session
    fromSeq = submitted.fromSeq
  } catch (e) {
    return {
      status: 'error',
      note: '提示提交失败：' + String((e && e.message) || e).slice(0, 240),
      reply: '',
      sessionId: String(session.id),
    }
  }

  // 等待本轮结束（turn/end）或超时；期间持续读取已产生的 assistant 消息
  const deadline = Date.now() + ASSISTANT_TIMEOUT_MS
  let reply = ''
  let toolCalls = []
  let finished = false
  while (Date.now() < deadline) {
    await sleepMs(ASSISTANT_POLL_MS)
    let events
    try {
      events = session.snapshotEvents(fromSeq, session.seq)
    } catch (e) {
      break
    }
    const assistantEvents = events.filter(function (event) {
      return event.type === 'assistant/message'
    })
    if (assistantEvents.length > 0) {
      reply = assistantEvents
        .map(function (event) {
          return assistantTextOf(event.data.message)
        })
        .filter(Boolean)
        .join('\n\n')
    }
    toolCalls = events
      .filter(function (event) {
        return event.type === 'tool/call'
      })
      .map(function (event) {
        return String(event.data && event.data.name ? event.data.name : '')
      })
      .filter(Boolean)
    if (events.some(function (event) {
      return event.type === 'turn/end'
    })) {
      finished = true
      break
    }
  }

  return {
    status: finished ? 'ok' : reply ? 'partial' : 'timeout',
    note: finished
      ? null
      : reply
        ? '本轮仍未结束，先返回已生成的内容。'
        : '等待超时：模型可能仍在执行，可稍后用「打开完整会话」查看。',
    reply: reply,
    toolCalls: toolCalls.slice(0, 12),
    sessionId: String(session.id),
  }
}

/** 侧栏历史：读助手会话最近若干条问答。 */
async function readAssistantHistory(ctx) {
  const session = await ensureAssistantSession(ctx)
  if (!session) return { status: 'unavailable', note: '没有可用的会话服务', messages: [] }
  return {
    status: 'ok',
    sessionId: String(session.id),
    messages: assistantHistoryFrom(session, 20),
  }
}

/** 清空助手上下文（换一个新会话，旧会话仍保留在原生会话列表里）。 */
async function resetAssistantSession(ctx) {
  const session = await createPersistedSession(ctx)
  if (!session) {
    return { status: 'unavailable', note: '没有可用的 sessionController.create', sessionId: null }
  }
  rememberAssistantSession(session.id)
  return { status: 'ok', sessionId: String(session.id) }
}


/**
 * 按「持久化消息 id」取一条助手回复的正文，供原生聊天的内嵌动作使用
 * （conversation.chat.assistant-actions 只下发 messageId）。
 * 事件形状不完全一致，按 id → data.messageId → seq 三种顺序兜底匹配。
 */
async function readAssistantMessage(ctx, request) {
  const input = request && typeof request === 'object' ? request : {}
  const sessions = hostService(ctx, 'sessions')
  if (!sessions || typeof sessions.get !== 'function') {
    return { status: 'unavailable', note: '没有可用的会话服务', text: '' }
  }
  const wantedSession = asString(input.sessionId, 120)
  let session = wantedSession ? sessions.get(wantedSession) : await ensureAssistantSession(ctx)
  if (!session) return { status: 'not_found', note: '找不到该会话', text: '' }

  const wanted = asString(input.messageId, 120)
  let events = []
  try {
    events = session.snapshotEvents()
  } catch (e) {
    return { status: 'error', note: '读取会话事件失败：' + String((e && e.message) || e).slice(0, 160), text: '' }
  }

  const assistantEvents = events.filter(function (event) {
    return event.type === 'assistant/message'
  })
  let hit = null
  if (wanted) {
    hit =
      assistantEvents.find(function (event) {
        const message = event.data && event.data.message ? event.data.message : null
        return String((message && message.id) || (event.data && event.data.messageId) || '') === wanted
      }) || null
    if (!hit && /^\d+$/.test(wanted)) {
      hit =
        events.find(function (event) {
          return Number(event.seq) === Number(wanted)
        }) || null
    }
  }
  if (!hit) {
    // 兜底：取最后一条助手消息（动作按钮总是挂在已定稿消息上）
    hit = assistantEvents.length > 0 ? assistantEvents[assistantEvents.length - 1] : null
  }
  if (!hit) return { status: 'not_found', note: '该会话还没有助手回复', text: '', sessionId: String(session.id) }

  const message = hit.data && hit.data.message ? hit.data.message : null
  return {
    status: 'ok',
    sessionId: String(session.id),
    messageId: String((message && message.id) || wanted || hit.seq),
    text: assistantTextOf(message),
    at: hit.time || null,
    seq: hit.seq,
  }
}
