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

function getAssistantSession(ctx) {
  const sessions = hostService(ctx, 'sessions')
  if (!sessions || typeof sessions.create !== 'function' || typeof sessions.get !== 'function') return null
  const state = loadWorkbenchState()
  const savedId = state.settings && state.settings.assistantSessionId
  if (savedId) {
    const existing = sessions.get(savedId)
    if (existing) return { sessions: sessions, session: existing }
  }
  const session = sessions.create(undefined, {
    meta: { cwd: cwdForHostCommands(ctx) },
  })
  mutateWorkbenchState(function (current) {
    current.settings.assistantSessionId = String(session.id)
    return current
  })
  return { sessions: sessions, session: session }
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
    const resolved = getAssistantSession(ctx)
    if (!resolved) return { status: 'unavailable', note: '没有可用的会话服务', messages: [] }
    session = resolved.session
  }
  return {
    status: 'ok',
    sessionId: String(session.id),
    title: sessionTitleOf(session),
    messages: transcriptOf(session, Math.min(80, Number(request && request.limit) || 40)),
  }
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
    const resolved = getAssistantSession(ctx)
    if (!resolved) {
      return {
        status: 'unavailable',
        note: '当前宿主没有可用的 sessions 服务，无法创建助手会话。',
        reply: '',
      }
    }
    session = resolved.session
  }
  const fromSeq = session.seq

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

  const requestId = 'wb-assistant-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
  try {
    await controller.prompt(
      {
        requestId: requestId,
        sessionId: session.id,
        mode: 'queue',
        content: [{ type: 'text', text: promptText }],
        clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      AbortSignal.timeout(ASSISTANT_TIMEOUT_MS),
    )
  } catch (e) {
    return {
      status: 'error',
      note: '提示提交失败：' + String((e && e.message) || e).slice(0, 200),
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
  const resolved = getAssistantSession(ctx)
  if (!resolved) return { status: 'unavailable', note: '没有可用的会话服务', messages: [] }
  return {
    status: 'ok',
    sessionId: String(resolved.session.id),
    messages: assistantHistoryFrom(resolved.session, 20),
  }
}

/** 清空助手上下文（换一个新会话，旧会话仍保留在原生会话列表里）。 */
async function resetAssistantSession(ctx) {
  const sessions = hostService(ctx, 'sessions')
  if (!sessions || typeof sessions.create !== 'function') {
    return { status: 'unavailable', note: '没有可用的会话服务', sessionId: null }
  }
  const session = sessions.create(undefined, { meta: { cwd: cwdForHostCommands(ctx) } })
  mutateWorkbenchState(function (current) {
    current.settings.assistantSessionId = String(session.id)
    return current
  })
  return { status: 'ok', sessionId: String(session.id) }
}
