/* ============================================================================
 * dev-workbench client — 把工作台嵌进 DSH 原生聊天
 *
 * 方向与「工作台助手侧栏」相反：不改原生会话的渲染，只在两个官方插槽上挂东西。
 *
 *   1. conversation.chat.assistant-actions（list，replaceRisk: none）
 *      每条定稿的助手回复下面加一排动作：生成待办 / 存为知识 / 记执行记录。
 *      ownerProps 只给 { messageId }，消息正文通过 workbench/assistantMessage 取。
 *
 *   2. tool.call.toolview（keyed by 工具名，replaceRisk: shadows-shipped-ui）
 *      只接管我们自己的 workbench_* 工具，把它们渲染成工作台卡片。
 *      未占用的 key 走通用行，所以我们注册自己的名字不会影响其它工具。
 *
 * 两个插槽都在 session scope，standardProps 带 useChat/useConversation/useSession
 * 等原生会话 hook；这里只用 messageId + 我们的 RPC，避免依赖未公开的 hook 形状。
 * ========================================================================== */

const CHAT_EMBED_ACTIONS = [
  {
    id: 'workbench-task',
    label: '生成待办',
    icon: 'plus',
    run: function (text, meta) {
      return WB.actions.createTask({
        title: chatEmbedTitle(text),
        description: text.slice(0, 2000),
        priority: 'normal',
        tags: ['来自会话'],
      }).then(function () {
        WB.toast('已生成待办（可在工作台查看）', 'ok')
      })
    },
  },
  {
    id: 'workbench-knowledge',
    label: '存为知识',
    icon: 'book',
    run: function (text) {
      return WB.actions.createKnowledge({
        title: chatEmbedTitle(text),
        body: text.slice(0, 4000),
        tags: ['来自会话'],
        url: null,
      }).then(function () {
        WB.toast('已存入知识库', 'ok')
      })
    },
  },
  {
    id: 'workbench-run',
    label: '记执行记录',
    icon: 'agent',
    run: function (text) {
      return WB.actions.recordRun({
        status: 'completed',
        summary: text.slice(0, 300),
        steps: [{ text: '来源：原生会话中的助手回复' }],
      }).then(function () {
        WB.toast('已登记执行记录', 'ok')
      })
    },
  },
]

/** 取第一行/第一句当标题，去掉 Markdown 记号，控制长度。 */
function chatEmbedTitle(text) {
  const line = String(text || '')
    .replace(/^#+\s*/gm, '')
    .replace(/[*_`>]/g, '')
    .split('\n')
    .map(function (part) {
      return part.trim()
    })
    .filter(Boolean)[0]
  const title = (line || '会话记录').slice(0, 60)
  return title || '会话记录'
}

/**
 * 原生聊天里每条助手回复下方的动作排。
 * 只在消息正文可用时启用，失败就静默降级（不打断原生聊天）。
 */
function ChatAssistantActions(props) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [open, setOpen] = React.useState(false)
  const messageId = props && props.messageId ? String(props.messageId) : ''
  const sessionId = props && props.sessionId ? String(props.sessionId) : null
  if (!messageId) return null

  function trigger(action) {
    if (busy) return
    setBusy(true)
    setError(null)
    WB.actions
      .assistantMessage(sessionId, messageId)
      .then(function (result) {
        if (!result || result.status !== 'ok' || !result.text) {
          throw new Error((result && result.note) || '没有取到该条回复的内容')
        }
        return action.run(result.text, result)
      })
      .then(function () {
        setBusy(false)
        setOpen(false)
      })
      .catch(function (failure) {
        setError(String((failure && failure.message) || failure))
        setBusy(false)
      })
  }

  const pill = function (label, onClick, active) {
    return h(
      'button',
      {
        key: label,
        type: 'button',
        disabled: busy,
        onClick: onClick,
        style: {
          appearance: 'none',
          border: '1px solid currentColor',
          borderRadius: 999,
          background: active ? 'currentColor' : 'transparent',
          color: active ? 'transparent' : 'inherit',
          fontSize: 11,
          lineHeight: 1.4,
          padding: '0 7px',
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.5 : 0.7,
        },
      },
      label,
    )
  }

  // 默认只留一个「工作台」入口，点开才展开动作，避免每条回复下面挂一排按钮
  return h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        flexWrap: 'wrap',
        marginTop: 2,
        fontSize: 11,
        lineHeight: 1.5,
      },
    },
    pill(busy ? '处理中…' : open ? '工作台 ▴' : '工作台 ▾', function () {
      setOpen(!open)
    }, open),
    open
      ? CHAT_EMBED_ACTIONS.map(function (action) {
          return pill(action.label, function () {
            trigger(action)
          }, false)
        })
      : null,
    error ? h('span', { style: { color: 'var(--dsh-color-danger, #d14343)' } }, error) : null,
  )
}

/** 从工具调用的分阶段 block 里尽力取出参数/结果摘要。 */
function chatEmbedBlockSummary(block) {
  if (!block || typeof block !== 'object') return ''
  const candidates = [block.args, block.arguments, block.input, block.result, block.output, block.content, block.text]
  for (const value of candidates) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string') return value.slice(0, 200)
    try {
      return JSON.stringify(value).slice(0, 200)
    } catch (e) {
      /* 继续找下一个候选 */
    }
  }
  return ''
}

/** workbench_* 工具调用的卡片（原生聊天里替代通用行）。 */
function WorkbenchToolView(props) {
  const toolName = String((props && props.toolName) || 'workbench')
  const phase = props && props.phase ? String(props.phase) : 'start'
  const summary = chatEmbedBlockSummary(props && props.block)
  const failed = !!(props && props.block && (props.block.isError === true || props.block.error))
  return h(
    'div',
    {
      style: {
        border: '1px solid currentColor',
        borderRadius: 8,
        padding: '6px 9px',
        fontSize: 11.5,
        lineHeight: 1.6,
        opacity: 0.92,
        maxWidth: 620,
      },
    },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 6 } },
      h('span', { style: { fontWeight: 600 } }, '工作台'),
      h('span', { style: { opacity: 0.75 } }, toolName.replace(/^workbench_/, '')),
      h(
        'span',
        { style: { marginLeft: 'auto', opacity: 0.6 } },
        failed ? '失败' : phase === 'result' ? '完成' : phase === 'start' ? '执行中' : '准备中',
      ),
    ),
    summary ? h('div', { style: { marginTop: 3, opacity: 0.8, overflowWrap: 'anywhere' } }, summary) : null,
  )
}

/** 注册两个原生聊天插槽；宿主没提供插槽时静默跳过。 */
WB.registerChatEmbed = function (ctx) {
  if (!ctx || !ctx.slots || typeof ctx.slots.inject !== 'function') return function () {}
  const disposers = []

  try {
    disposers.push(
      ctx.slots.inject('conversation.chat.assistant-actions', function () {
        const registrations = CHAT_EMBED_ACTIONS.map(function (action, index) {
          return ctx.slots.register(
            {
              name: 'conversation.chat.assistant-actions',
              id: action.id,
              order: 30 + index,
              label: action.label,
            },
            ChatAssistantActions,
          )
        })
        return registrations
      }),
    )
  } catch (e) {
    /* 插槽不存在或版本不同：不影响工作台本体 */
  }

  try {
    disposers.push(
      ctx.slots.inject('tool.call.toolview', function () {
        return WB.WORKBENCH_TOOL_NAMES.map(function (name) {
          return ctx.slots.register({ name: 'tool.call.toolview', key: name }, WorkbenchToolView)
        })
      }),
    )
  } catch (e) {
    /* 同上 */
  }

  return function () {
    disposers.forEach(function (dispose) {
      try {
        dispose()
      } catch (e) {
        /* already gone */
      }
    })
  }
}
