/* ============================================================================
 * dev-workbench shell
 *
 * Owns the page frame: the secondary navigation rail, the toolbar, page
 * routing, the toast outlet and the two slot registrations that place the
 * workbench in the Harness frame:
 *
 *   main              keyed slot, key = 'dev-workbench'
 *                     -> the panel the sidebar entry dispatches to
 *   sidebar.panellist id  = 'dev-workbench'
 *                     -> the global panel icon; its id is the main panel key
 *
 * `WB.apply` is the plugin entry point the built client artifact returns.
 * ========================================================================== */

WB.PAGE_META = {
  dashboard: { title: '今日简报', icon: 'dashboard', hint: '今天要处理的事、资讯与连接状态' },
  tasks: { title: '任务中心', icon: 'tasks', hint: '统一任务模型：来源、优先级、截止与执行记录' },
  search: { title: '统一搜索', icon: 'search', hint: '按来源分组检索，结果带引用，缺一路不影响其它来源' },
  agents: { title: 'Agent 中心', icon: 'agent', hint: '执行队列、审批与结果回写' },
  toolbox: { title: '开发工具箱', icon: 'toolbox', hint: '本地执行、数据不出浏览器的高频工具' },
  collab: { title: '研发协作', icon: 'git', hint: '仓库分支与改动、Docker 容器，全部只读探测' },
  knowledge: { title: '知识空间', icon: 'book', hint: '收藏、笔记与排障记录' },
  settings: { title: '连接与设置', icon: 'settings', hint: '连接器状态、关注主题与数据管理' },
}

WB.ORDER = ['dashboard', 'tasks', 'search', 'agents', 'toolbox', 'collab', 'knowledge', 'settings']

WB.NAV_GROUPS = [
  { label: '工作', items: ['dashboard', 'tasks', 'search'] },
  { label: '执行', items: ['agents'] },
  { label: '工具', items: ['toolbox', 'collab'] },
  { label: '沉淀', items: ['knowledge'] },
  { label: '系统', items: ['settings'] },
]

WB.go = function (page) {
  if (WB.ORDER.indexOf(page) < 0) return
  WB.store.set({ page: page })
}

function WorkbenchIcon(props) {
  const size = (props && typeof props.size === 'number' && props.size) || 18
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      'aria-hidden': 'true',
      style: { display: 'block' },
    },
    h('rect', {
      x: 3.2, y: 3.2, width: 7.4, height: 7.4, rx: 2.1,
      fill: 'currentColor', opacity: props && props.active ? 1 : 0.72,
    }),
    h('rect', {
      x: 13.4, y: 3.2, width: 7.4, height: 7.4, rx: 2.1,
      fill: 'currentColor', opacity: props && props.active ? 0.66 : 0.34,
    }),
    h('rect', {
      x: 3.2, y: 13.4, width: 7.4, height: 7.4, rx: 2.1,
      fill: 'currentColor', opacity: props && props.active ? 0.66 : 0.34,
    }),
    h('path', {
      d: 'M13.6 17.1h7.2M17.2 13.5v7.2',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      opacity: props && props.active ? 1 : 0.72,
    }),
  )
}

/* ------------------------------------------------------------------ Toaster */
function Toaster() {
  const state = useStore()
  if (!state.toasts.length) return null
  return h(
    'div',
    { className: 'wb-toasts', 'aria-live': 'polite' },
    state.toasts.map(function (item) {
      return h(
        'div',
        { key: item.id, className: 'wb-toast wb-toast--' + (item.kind || 'info') },
        h(Icon, { name: item.kind === 'err' ? 'alert' : item.kind === 'ok' ? 'checkCircle' : 'info', size: 14 }),
        h('span', { style: { minWidth: 0, overflowWrap: 'anywhere' } }, item.text),
      )
    }),
  )
}

/* -------------------------------------------------------------- 工作台助手 */
const ASSISTANT_KIND_LABEL = {
  task: '待办',
  source: '来源消息',
  radar: '资讯',
  knowledge: '知识',
  search: '检索结果',
}

/**
 * 侧栏助手：真正可对话的聊天窗口。
 * 走 Host 的原生会话与模型（workbench/assistantAsk），因此 Agent 能直接调用
 * workbench_* 工具写回同一份数据；插件内不自建模型调用。
 */
function AssistantDrawer() {
  const state = useStore()
  const [messages, setMessages] = React.useState([])
  const [draft, setDraft] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [sessions, setSessions] = React.useState([])
  const [activeId, setActiveId] = React.useState(null)
  const [loaded, setLoaded] = React.useState(false)
  const [steerMode, setSteerMode] = React.useState(false)
  const bodyRef = React.useRef(null)

  const open = !!state.assistantOpen
  const refs = Array.isArray(state.assistantRefs) ? state.assistantRefs : []
  const settings = (state.data && state.data.settings) || {}
  const savedWidth = Number(settings.assistantWidth)
  const [width, setWidth] = React.useState(Number.isFinite(savedWidth) ? savedWidth : 384)
  const widthRef = React.useRef(width)

  React.useEffect(
    function () {
      widthRef.current = width
    },
    [width],
  )

  // 拖动左边缘调整宽度：工作台主区是 flex 兄弟节点，宽了会自动让位
  function startResize(event) {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = widthRef.current
    function onMove(moveEvent) {
      const next = Math.max(240, Math.min(760, Math.round(startWidth + (startX - moveEvent.clientX))))
      widthRef.current = next
      setWidth(next)
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('mouseleave', onUp)
      if (widthRef.current) WB.actions.saveSettings({ assistantWidth: widthRef.current }).catch(function () {})
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('mouseleave', onUp)
  }

  function loadTranscript(sessionId) {
    return WB.actions
      .assistantTranscript(sessionId, 40)
      .then(function (result) {
        setMessages((result && result.messages) || [])
        if (result && result.sessionId) setActiveId(result.sessionId)
      })
      .catch(function () {
        /* 读不到历史不影响继续对话 */
      })
  }

  // 打开时载入会话列表与当前会话记录
  React.useEffect(
    function () {
      if (!open || loaded) return
      setLoaded(true)
      WB.actions
        .assistantSessions(12)
        .then(function (result) {
          const list = (result && result.sessions) || []
          setSessions(list)
          const preferred = (result && result.assistantSessionId) || (list[0] && list[0].id) || null
          if (preferred) {
            setActiveId(preferred)
            return loadTranscript(preferred)
          }
          return null
        })
        .catch(function () {})
    },
    [open, loaded],
  )

  React.useEffect(
    function () {
      const node = bodyRef.current
      if (node) node.scrollTop = node.scrollHeight
    },
    [messages, sending],
  )

  if (!open) return null

  function switchSession(nextId) {
    setActiveId(nextId)
    setError(null)
    loadTranscript(nextId)
  }

  function send() {
    const text = draft.trim()
    if (!text || sending) return
    setError(null)
    setDraft('')
    setSending(true)
    setMessages(function (previous) {
      return previous.concat([{ role: 'user', text: text }])
    })

    WB.actions
      .assistantSend(text, refs, activeId, steerMode)
      .then(function (result) {
        if (!result || result.status !== 'ok') {
          setSending(false)
          const note = (result && result.note) || ('状态：' + (result && result.status))
          setError(
            /resume failed|SessionPersistenceNotFound/i.test(note)
              ? '助手会话已失效且自动重建失败。点标题栏「新会话」重开一个即可继续。'
              : note,
          )
          return
        }
        let cursor = Number(result.fromSeq) || 0
        const sid = result.sessionId
        // Host 可能在会话日志丢失后重建了会话：同步到新 id，避免后续继续用旧 id
        if (sid && activeId && String(sid) !== String(activeId)) {
          setActiveId(String(sid))
          WB.toast('原助手会话已失效，已自动切换到新会话', 'info')
        }
        const startedAt = Date.now()
        // 方案 A1：每 400ms 取增量，工具调用/回复分段边跑边显示
        function tick() {
          WB.actions
            .assistantDelta(sid, cursor)
            .then(function (delta) {
              if (delta && delta.status === 'ok') {
                cursor = Number(delta.nextSeq) || cursor
                const fresh = (delta.entries || []).filter(function (entry) {
                  return entry.role !== 'user'
                })
                if (fresh.length > 0) {
                  setMessages(function (previous) {
                    return previous.concat(fresh)
                  })
                }
                const timeout = Date.now() - startedAt > 180000
                if (!delta.turnActive || timeout) {
                  setSending(false)
                  if (timeout) setError('本轮超过 3 分钟仍未结束，可稍后在主面板查看。')
                  // 助手可能已用工具改过数据，对齐一次
                  WB.actions.reload().catch(function () {})
                  WB.actions
                    .assistantSessions(12)
                    .then(function (next) {
                      setSessions((next && next.sessions) || [])
                    })
                    .catch(function () {})
                  return
                }
                setTimeout(tick, 400)
                return
              }
              setSending(false)
              setError((delta && delta.note) || '读取会话增量失败')
            })
            .catch(function (failure) {
              setSending(false)
              setError(String((failure && failure.message) || failure))
            })
        }
        setTimeout(tick, 400)
      })
      .catch(function (failure) {
        setSending(false)
        setError(String((failure && failure.message) || failure))
      })
  }

  function newSession() {
    WB.actions
      .assistantReset()
      .then(function (result) {
        setMessages([])
        setError(null)
        const nextId = result && result.sessionId
        if (nextId) setActiveId(nextId)
        WB.actions
          .assistantSessions(12)
          .then(function (next) {
            setSessions((next && next.sessions) || [])
          })
          .catch(function () {})
        WB.toast('已开始新的助手会话', 'ok')
      })
      .catch(function () {})
  }

  const sessionOptions = (sessions.length > 0 ? sessions : [{ id: activeId || '', title: '助手会话' }]).map(function (item) {
    return { value: item.id, label: (item.isAssistant ? '★ ' : '') + (item.title || item.id) }
  })

  return h(
    'aside',
    {
      style: {
        // 作为 .wb-root 的 flex 子项：主区 flex:1，助手固定宽度，工作台会随之变窄
        flex: '0 0 ' + width + 'px',
        width: width,
        minWidth: 240,
        maxWidth: '62%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        borderLeft: '1px solid ' + T.border1,
        background: T.layer1,
      },
    },
    h('div', {
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-label': '拖动调整助手宽度',
      title: '拖动调整宽度',
      onMouseDown: startResize,
      style: {
        position: 'absolute',
        left: -3,
        top: 0,
        bottom: 0,
        width: 6,
        cursor: 'col-resize',
        zIndex: 5,
      },
    }),
    h(
      'div',
      { className: 'wb-card-head', style: { borderBottom: '1px solid ' + T.border1 } },
      h('span', { className: 'wb-card-icon' }, h(Icon, { name: 'sparkles', size: 15 })),
      h(
        'div',
        { className: 'wb-card-titles' },
        h('h3', { className: 'wb-card-title' }, '工作台助手'),
        h('p', { className: 'wb-card-sub' }, 'DSH 原生会话与模型；可直接读写工作台数据'),
      ),
      h(
        'div',
        { className: 'wb-card-actions' },
        h(IconBtn, { name: 'plus', label: '新会话', onClick: newSession }),
        h(IconBtn, {
          name: 'external',
          label: '在主面板打开该会话',
          onClick: function () {
            if (activeId && WB.openSessionById) WB.openSessionById(activeId)
            else if (WB.openConversation) WB.openConversation()
          },
        }),
        h(IconBtn, { name: 'close', label: '关闭助手', onClick: function () { WB.assistant.close() } }),
      ),
    ),
    h(
      'div',
      { style: { padding: '8px 12px', borderBottom: '1px solid ' + T.border1, display: 'flex', alignItems: 'center', gap: 6 } },
      h('span', { className: 'wb-tiny wb-muted' }, '会话'),
      h(
        'div',
        { style: { flex: '1 1 auto', minWidth: 0 } },
        h(Select, {
          value: activeId || '',
          options: sessionOptions,
          onChange: function (event) {
            switchSession(event.target.value)
          },
        }),
      ),
    ),
    h(
      'div',
      {
        ref: bodyRef,
        style: { flex: '1 1 auto', overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 },
      },
      messages.length === 0 && !sending
        ? h(
            'div',
            { className: 'wb-tiny wb-muted', style: { lineHeight: 1.8 } },
            h('p', { style: { margin: '0 0 6px' } }, '可以直接问我工作台里的事，例如：'),
            h('p', { style: { margin: '0 0 4px' } }, '· 今天还有哪些没做完？帮我把逾期的排一下'),
            h('p', { style: { margin: '0 0 4px' } }, '· 把这个消息整理成待办，截止放到明天'),
            h('p', { style: { margin: '0 0 4px' } }, '· 这些资讯里哪条和限流有关？'),
            h('p', { style: { margin: 0 } }, '带上下文提问时，先在卡片上点「AI 分析」把相关记录加进来。'),
          )
        : messages.map(function (message, index) {
            // 工具调用 / 工具结果 / 错误：紧凑行，不占气泡
            if (message.role === 'tool' || message.role === 'toolResult' || message.role === 'error') {
              const isTool = message.role === 'tool'
              const isError = message.role === 'error'
              return h(
                'div',
                {
                  key: 'm' + index,
                  style: {
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    fontSize: 11,
                    color: isError ? T.err : T.text2,
                    padding: '2px 2px',
                  },
                },
                h(Icon, { name: isError ? 'alert' : isTool ? 'play' : 'check', size: 11 }),
                h(
                  'div',
                  { style: { minWidth: 0, overflowWrap: 'anywhere' } },
                  h('span', { className: 'wb-mono' }, message.text),
                  message.summary ? h('span', { className: 'wb-muted' }, '  ' + WB.util.truncate(String(message.summary), 120)) : null,
                ),
              )
            }
            const mine = message.role === 'user'
            const markdown = !mine
            return h(
              'div',
              { key: 'm' + index, style: { display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' } },
              h(
                'div',
                {
                  style: {
                    maxWidth: '94%',
                    padding: '8px 10px',
                    borderRadius: 10,
                    fontSize: 12,
                    lineHeight: 1.7,
                    overflowWrap: 'anywhere',
                    background: mine ? T.accent : T.layer2,
                    color: mine ? T.bg : T.text,
                  },
                },
                markdown && typeof mdParse === 'function'
                  ? h(
                      'div',
                      { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                      mdParse(message.text || '').slice(0, 40).map(function (block, blockIndex) {
                        const key = 'b' + index + '-' + blockIndex
                        if (block.type === 'heading') {
                          return h('div', { key: key, style: { fontWeight: 600, margin: '6px 0 2px' } }, mdInline(block.text, key))
                        }
                        if (block.type === 'code') {
                          return h('pre', { key: key, className: 'wb-code', style: { margin: '4px 0' } }, block.text)
                        }
                        if (block.type === 'list') {
                          return h(
                            block.ordered ? 'ol' : 'ul',
                            { key: key, style: { margin: '2px 0', paddingLeft: 18 } },
                            block.items.map(function (item, itemIndex) {
                              return h('li', { key: key + '-' + itemIndex }, mdInline(item, key + '-' + itemIndex))
                            }),
                          )
                        }
                        if (block.type === 'hr') return h('hr', { key: key, className: 'wb-divider', style: { margin: '6px 0' } })
                        if (block.type === 'quote') {
                          return h('div', { key: key, style: { borderLeft: '2px solid ' + T.border2, paddingLeft: 8, color: T.text2 } }, mdInline(block.text, key))
                        }
                        return h('div', { key: key, style: { whiteSpace: 'pre-wrap' } }, mdInline(block.text || '', key))
                      }),
                    )
                  : h('div', { style: { whiteSpace: 'pre-wrap' } }, message.text),
                message.toolCalls && message.toolCalls.length > 0
                  ? h(
                      'div',
                      { style: { marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 } },
                      message.toolCalls.map(function (tool, toolIndex) {
                        const name = typeof tool === 'string' ? tool : tool.name
                        return h(Chip, {
                          key: 't' + toolIndex,
                          icon: 'command',
                          title: (tool && tool.summary) || name,
                          children: name,
                        })
                      }),
                    )
                  : null,
              ),
            )
          }),
      sending ? h('div', { className: 'wb-row wb-tiny wb-muted', style: { gap: 6 } }, h(Spinner, { size: 12 }), h('span', null, '助手正在思考…')) : null,
      error ? h('div', { role: 'alert', className: 'wb-tiny', style: { color: T.err, lineHeight: 1.6 } }, error) : null,
    ),
    h(
      'div',
      { style: { borderTop: '1px solid ' + T.border1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 } },
      refs.length > 0
        ? h(
            'div',
            { style: { display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' } },
            h('span', { className: 'wb-tiny wb-muted' }, '上下文 ' + refs.length + ' 条：'),
            refs.map(function (ref) {
              return h(Chip, {
                key: ref.kind + ':' + ref.id,
                active: true,
                title: ref.title,
                children: WB.util.truncate(ref.title || ref.id, 14),
                onRemove: function () {
                  WB.assistant.remove(ref.kind, ref.id)
                },
              })
            }),
          )
        : null,
      h(Textarea, {
        value: draft,
        rows: 2,
        placeholder: '输入指令，或让我帮你整理待办…',
        onChange: function (event) {
          setDraft(event.target.value)
        },
        onKeyDown: function (event) {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            send()
          }
        },
      }),
      h(
        'div',
        { className: 'wb-row', style: { gap: 6 } },
        h(Chip, {
          active: steerMode,
          onClick: function () {
            setSteerMode(!steerMode)
          },
          title: steerMode ? '打断当前轮并立即处理' : '排队等当前轮结束再处理',
          children: steerMode ? '打断' : '排队',
        }),
        h('span', { className: 'wb-tiny wb-muted', title: 'Enter 发送 / Shift+Enter 换行' }, '⏎ 发送'),
        h('div', { className: 'wb-spacer' }),
        h(IconBtn, {
          name: 'arrowRight',
          label: sending ? '正在执行' : '发送',
          active: !sending && !!draft.trim(),
          onClick: send,
        }),
      ),
    ),
  )
}

/* --------------------------------------------------------------- error gate *//* --------------------------------------------------------------- error gate */
function LoadingScreen() {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: T.text2,
        fontSize: 12,
      },
    },
    h(Spinner, { size: 18 }),
    h('span', null, '正在读取工作台数据…'),
  )
}

function ErrorScreen(props) {
  return h(
    'div',
    { style: { padding: 28, maxWidth: 620 } },
    h(
      Panel,
      {
        title: '无法读取工作台数据',
        icon: 'alert',
        sub: 'Host 端的 workbench 服务没有返回数据。',
        actions: h(Btn, { icon: 'refresh', onClick: props.onRetry, kind: 'primary', size: 'sm', children: '重试' }),
      },
      h(
        'div',
        { className: 'wb-stack' },
        h('pre', { className: 'wb-code' }, String(props.error || '未知错误')),
        h(
          'p',
          { className: 'wb-hint', style: { margin: 0 } },
          '排查顺序：确认插件已在“设置 → 插件”中启用 → 查看 Host 日志中的 workbench 行 → 重新安装 bundle。',
        ),
      ),
    ),
  )
}

/* ---------------------------------------------------------------- nav rail */
function NavRail(props) {
  const data = props.data
  const counts = WB.taskCounts(data)
  return h(
    'nav',
    { className: 'wb-nav', 'aria-label': '工作台导航' },
    h(
      'div',
      { className: 'wb-nav-brand' },
      h(WorkbenchIcon, { size: 22, active: false }),
      h(
        'div',
        { style: { minWidth: 0 } },
        h('strong', null, WB.t('app.title', '智能工作台')),
      ),
    ),
    WB.NAV_GROUPS.map(function (group) {
      return h(
        'div',
        { key: group.label },
        h('div', { className: 'wb-nav-label' }, group.label),
        group.items.map(function (id) {
          const meta = WB.PAGE_META[id]
          if (!meta) return null
          const active = props.page === id
          const count = id === 'tasks' && counts.open > 0 ? counts.open : null
          return h(
            'button',
            {
              key: id,
              type: 'button',
              className: 'wb-nav-item' + (active ? ' is-active' : ''),
              'aria-current': active ? 'page' : undefined,
              onClick: function () {
                WB.go(id)
              },
              title: meta.hint,
            },
            h(Icon, { name: meta.icon, size: 15 }),
            h('span', { className: 'wb-ellipsis' }, WB.t('nav.' + id, meta.title)),
            count ? h('span', { className: 'wb-nav-count' }, String(count)) : null,
          )
        }),
      )
    }),
    h('div', { className: 'wb-spacer' }),
    h(
      'div',
      {
        className: 'wb-nav-label',
        style: { paddingBottom: 0, display: 'flex', alignItems: 'center', gap: 4 },
      },
      h(Icon, { name: 'database', size: 10 }),
      '工作台状态',
    ),
    h(
      'div',
      { className: 'wb-tiny wb-muted', style: { padding: '2px 9px 0', lineHeight: 1.5 } },
      '本地持久化 · ' + (data && data.updatedAt ? '最近写入 ' + WB.fmt.relative(data.updatedAt) : '尚未写入'),
    ),
  )
}

/* ----------------------------------------------------------------- toolbar */
function Toolbar(props) {
  const counts = WB.taskCounts(props.data)
  return h(
    'div',
    { className: 'wb-toolbar' },
    h(
      'button',
      {
        type: 'button',
        className: 'wb-toolbar-search',
        onClick: props.onOpenPalette,
        title: '打开命令面板',
      },
      h(Icon, { name: 'search', size: 14 }),
      h('span', { className: 'wb-ellipsis' }, WB.t('common.search', '搜索或执行命令')),
      h(Kbd, null, navigator.platform && navigator.platform.indexOf('Mac') >= 0 ? '⌘K' : 'Ctrl K'),
    ),
    h('div', { className: 'wb-spacer' }),
    counts.overdue > 0
      ? h(
          'button',
          {
            type: 'button',
            className: 'wb-chip',
            onClick: function () {
              WB.go('tasks')
            },
            title: '查看逾期任务',
            style: { color: T.err, borderColor: 'color-mix(in srgb, ' + T.err + ' 45%, transparent)' },
          },
          h(Icon, { name: 'alert', size: 12 }),
          counts.overdue + ' 项逾期',
        )
      : null,
    h(Btn, {
      icon: 'plus',
      size: 'sm',
      kind: 'primary',
      onClick: props.onQuickAdd,
      children: '新建待办',
    }),
    h(IconBtn, {
      name: 'refresh',
      label: '重新读取 Host 数据',
      onClick: function () {
        WB.actions.reload().catch(function () {})
      },
    }),
    h(IconBtn, {
      name: 'sparkles',
      label: '工作台助手（携带上下文进入会话）',
      active: !!props.assistantOpen,
      onClick: function () {
        WB.assistant.toggle()
      },
    }),
    h(IconBtn, {
      name: 'settings',
      label: '连接与设置',
      active: props.page === 'settings',
      onClick: function () {
        WB.go('settings')
      },
    }),
  )
}

/* --------------------------------------------------------------- page frame */
function MissingPage(props) {
  return h(
    'div',
    { className: 'wb-page' },
    h(Empty, {
      icon: 'layers',
      title: '页面 “' + props.page + '” 还没有注册',
      hint: '对应模块未随本次构建一起生成；其余页面不受影响。',
    }),
  )
}

function WorkbenchApp() {
  const state = useStore()
  const [paletteOpen, setPaletteOpen] = React.useState(false)

  React.useEffect(function () {
    if (!WB.store.get().data) WB.actions.reload().catch(function () {})
  }, [])

  // TODO 08：修订号轮询，后台/聊天改动几秒内自动体现；正在填表单时跳过
  React.useEffect(
    function () {
      const timer = setInterval(function () {
        WB.actions.syncCheck().catch(function () {})
      }, 12000)
      return function () {
        clearInterval(timer)
      }
    },
    [],
  )

  React.useEffect(
    function () {
      function onKey(event) {
        const meta = event.metaKey || event.ctrlKey
        if (!meta) return
        const key = event.key.toLowerCase()
        if (key === 'k') {
          event.preventDefault()
          setPaletteOpen(function (open) {
            return !open
          })
          return
        }
        if (key >= '1' && key <= String(WB.ORDER.length)) {
          const index = Number(key) - 1
          const page = WB.ORDER[index]
          if (page) {
            event.preventDefault()
            WB.go(page)
          }
        }
      }
      window.addEventListener('keydown', onKey)
      return function () {
        window.removeEventListener('keydown', onKey)
      }
    },
    [],
  )

  const page = state.page
  const Page = WB.pages[page]
  const loading = state.status === 'loading' && !state.data
  const failed = state.status === 'error' && !state.data

  return h(
    'div',
    { className: 'wb-root' },
    h('style', null, WB_CSS),
    h(NavRail, { page: page, data: state.data }),
    h(
      'div',
      { className: 'wb-main' },
      h(Toolbar, {
        data: state.data,
        page: page,
        assistantOpen: state.assistantOpen,
        onOpenPalette: function () {
          setPaletteOpen(true)
        },
        onQuickAdd: function () {
          WB.openTaskForm(null)
        },
        quickAddAvailable: true,
      }),
      h(
        'div',
        { className: 'wb-scroll' },
        loading
          ? h(LoadingScreen, null)
          : failed
            ? h(ErrorScreen, {
                error: state.error,
                onRetry: function () {
                  WB.actions.reload().catch(function () {})
                },
              })
            : h('div', { className: 'wb-page' }, Page ? h(Page, null) : h(MissingPage, { page: page })),
      ),
    ),
    h(AssistantDrawer, null),
    WB.Palette ? h(WB.Palette, { open: paletteOpen, onClose: function () { setPaletteOpen(false) } }) : null,
    h(TaskFormHost, null),
    h(Toaster, null),
  )
}

/* -------------------------------------------------------------------- apply */
WB.apply = function apply(ctx) {
  if (ctx.connection) wbConnection = ctx.connection
  if (typeof WB.setLayout === 'function') {
    WB.setLayout(ctx.get ? ctx.get('layout') : ctx.layout)
  }
  if (typeof WB.setUiWorkspace === 'function') {
    WB.setUiWorkspace(ctx.get ? ctx.get('uiWorkspace') : ctx.uiWorkspace)
  }

  const locale = ctx.get ? ctx.get('locale') : ctx.locale
  if (locale && typeof locale.register === 'function') {
    ctx.effect(function () {
      const disposers = []
      // 产品语言固定中文：中英文环境都注册同一份中文文案，英文 DSH 里
      // 也不会出现 Briefing / Task center 之类的英文导航。
      ;['zh', 'en'].forEach(function (language) {
        try {
          disposers.push(locale.register('dev-workbench', language, WB_DICT.zh))
        } catch (e) {
          /* a duplicate namespace owner is not fatal: literals still render */
        }
      })
      try {
        wbTranslate = locale.bind('dev-workbench')
      } catch (e) {
        /* keep the identity translator */
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
    })
  }

  ctx.effect(function () {
    const disposers = []
    disposers.push(
      ctx.slots.inject('main', function () {
        return ctx.slots.register({ name: 'main', key: WB.PANEL_KEY }, WorkbenchApp)
      }),
    )
    if (typeof WB.registerChatEmbed === 'function') {
      try {
        disposers.push(WB.registerChatEmbed(ctx))
      } catch (e) {
        /* 原生聊天内嵌是增强项，失败不影响工作台 */
      }
    }
    disposers.push(
      ctx.slots.inject('sidebar.panellist', function () {
        return ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: WB.PANEL_KEY,
            order: 30,
            label: function () {
              return WB.t('app.title', '智能工作台')
            },
          },
          WorkbenchIcon,
        )
      }),
    )
    return function () {
      disposers.forEach(function (dispose) {
        try {
          dispose()
        } catch (e) {
          /* already disposed by the slot owner */
        }
      })
    }
  })
}
