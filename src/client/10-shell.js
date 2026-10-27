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

function AssistantDrawer() {
  const state = useStore()
  const [instruction, setInstruction] = React.useState('')
  if (!state.assistantOpen) return null
  const refs = Array.isArray(state.assistantRefs) ? state.assistantRefs : []

  function copyAndOpen() {
    const brief = assistantBrief(refs, instruction)
    WB.util
      .copy(brief)
      .then(function () {
        WB.toast('上下文简报已复制，正在打开会话…', 'ok')
        if (WB.openConversation) WB.openConversation()
        wbStore.set({ assistantOpen: false })
      })
      .catch(function (error) {
        WB.toast(String((error && error.message) || error), 'err')
      })
  }

  return h(
    'aside',
    {
      style: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 332,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        borderLeft: '1px solid ' + T.border1,
        background: T.layer1,
        boxShadow: '-12px 0 32px rgba(0,0,0,.28)',
      },
    },
    h(
      'div',
      { className: 'wb-card-head', style: { borderBottom: '1px solid ' + T.border1 } },
      h('span', { className: 'wb-card-icon' }, h(Icon, { name: 'sparkles', size: 15 })),
      h(
        'div',
        { className: 'wb-card-titles' },
        h('h3', { className: 'wb-card-title' }, '工作台助手'),
        h('p', { className: 'wb-card-sub' }, '把下方上下文带进原生会话，Agent 会写回同一份数据'),
      ),
      h(
        'div',
        { className: 'wb-card-actions' },
        h(IconBtn, {
          name: 'close',
          label: '关闭助手',
          onClick: function () {
            WB.assistant.close()
          },
        }),
      ),
    ),
    h(
      'div',
      { style: { flex: '1 1 auto', overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 } },
      refs.length === 0
        ? h('p', { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.7 } },
            '还没有上下文。在待办、资讯、知识或搜索结果上点「AI 分析」，就会把那条记录加到这里（可随时移除）。')
        : refs.map(function (ref) {
            return h(
              'div',
              {
                key: ref.kind + ':' + ref.id,
                style: { display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 10px', border: '1px solid ' + T.border1, borderRadius: 10 },
              },
              h(Badge, { tone: 'idle' }, ASSISTANT_KIND_LABEL[ref.kind] || ref.kind),
              h(
                'div',
                { style: { flex: '1 1 auto', minWidth: 0, fontSize: 11.5, lineHeight: 1.5 } },
                h('div', { style: { fontWeight: 500, overflowWrap: 'anywhere' } }, ref.title || ref.id),
                ref.body ? h('div', { className: 'wb-tiny wb-muted wb-clamp2' }, String(ref.body).slice(0, 120)) : null,
              ),
              h(IconBtn, {
                name: 'close',
                label: '移除该上下文',
                onClick: function () {
                  WB.assistant.remove(ref.kind, ref.id)
                },
              }),
            )
          }),
      h(Field, { label: '我的要求' }, h(Textarea, {
        value: instruction,
        placeholder: '例如：帮我判断这条消息要不要建待办，并补全截止时间',
        onChange: function (event) {
          setInstruction(event.target.value)
        },
      })),
    ),
    h(
      'div',
      { className: 'wb-card-foot', style: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderTop: '1px solid ' + T.border1 } },
      h(Btn, {
        size: 'sm',
        kind: 'subtle',
        icon: 'refresh',
        disabled: refs.length === 0,
        onClick: function () {
          WB.assistant.clear()
        },
        children: '清空',
      }),
      h('div', { className: 'wb-spacer' }),
      h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'copy',
        disabled: refs.length === 0,
        onClick: copyAndOpen,
        children: '复制上下文并打开会话',
      }),
    ),
  )
}

/* --------------------------------------------------------------- error gate */
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
      h(WorkbenchIcon, { size: 22, active: true }),
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
      { className: 'wb-nav-label', style: { paddingBottom: 0 } },
      '数据由 Host 持久化',
    ),
    h(
      'div',
      { className: 'wb-tiny wb-muted', style: { padding: '2px 9px 0', lineHeight: 1.5 } },
      data && data.updatedAt ? '最近写入 ' + WB.fmt.relative(data.updatedAt) : '尚未写入',
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
