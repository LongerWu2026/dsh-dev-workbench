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
          throw new Error((result && (result.detail || result.note)) || '没有取到该条回复的内容')
        }
        return action.run(result.text, result)
      })
      .then(function () {
        setBusy(false)
        setOpen(false)
      })
      .catch(function (failure) {
        // 面向用户的短提示；技术细节放进 title 供排查
        setError({ text: '操作没成功，请重试', detail: String((failure && failure.message) || failure) })
        setBusy(false)
      })
  }

  const ICON_BUTTON = {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    border: '1px solid currentColor',
    borderRadius: 8,
    background: 'transparent',
    color: 'inherit',
    fontSize: 11,
    lineHeight: 1.4,
    padding: '1px 5px',
    cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.45 : 0.62,
  }

  const MENU = {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minWidth: 132,
    padding: 4,
    border: '1px solid currentColor',
    borderRadius: 9,
    background: 'var(--dsw-alias-bg-layer-1, #1c1c20)',
    boxShadow: '0 8px 22px rgba(0,0,0,.32)',
    opacity: 0.98,
  }

  // 单个图标按钮；菜单在按钮**上方**展开（聊天流底部不会被裁切），
  // 用文档流而不是绝对定位，避免被外层滚动容器裁掉。
  return h(
    'div',
    {
      style: {
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        marginTop: 2,
      },
    },
    open
      ? h(
          'div',
          { style: MENU },
          CHAT_EMBED_ACTIONS.map(function (action) {
            return h(
              'button',
              {
                key: action.id,
                type: 'button',
                disabled: busy,
                onClick: function () {
                  trigger(action)
                },
                style: {
                  appearance: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  textAlign: 'left',
                  border: 0,
                  borderRadius: 6,
                  background: 'transparent',
                  color: 'inherit',
                  fontSize: 11.5,
                  lineHeight: 1.6,
                  padding: '4px 7px',
                  cursor: busy ? 'default' : 'pointer',
                },
              },
              h(Icon, { name: action.icon || 'plus', size: 11 }),
              action.label,
            )
          }),
        )
      : null,
    h(
      'div',
      { style: { display: 'inline-flex', alignItems: 'center', gap: 5 } },
      h(
        'button',
        {
          type: 'button',
          disabled: busy,
          title: '工作台操作（生成待办 / 存为知识 / 记执行记录）',
          'aria-label': '工作台操作',
          'aria-expanded': open ? 'true' : 'false',
          onClick: function () {
            setOpen(!open)
          },
          style: ICON_BUTTON,
        },
        h(Icon, { name: 'sparkles', size: 12 }),
        h(Icon, { name: open ? 'chevronDown' : 'chevronUp', size: 10 }),
      ),
      busy ? h('span', { style: { fontSize: 11, opacity: 0.6 } }, '处理中…') : null,
      error
        ? h(
            'span',
            { title: error.detail, style: { fontSize: 11, color: 'var(--dsw-alias-label-error, #d14343)' } },
            error.text,
          )
        : null,
    ),
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
      // 只注册**一个**单元格：三个动作收在同一个图标下拉里。
      // 之前按动作注册了三个单元格，于是同一排出现三个图标按钮。
      ctx.slots.inject('conversation.chat.assistant-actions', function () {
        return ctx.slots.register(
          {
            name: 'conversation.chat.assistant-actions',
            id: 'workbench-actions',
            order: 30,
            label: '工作台',
          },
          ChatAssistantActions,
        )
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
