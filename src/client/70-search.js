/* ============================================================================
 * dev-workbench — 统一搜索 (search)
 *
 * Design report §3.3: multiple providers, source-attributed results, and the
 * hard rule "无命中时不得编造企业事实". So this page renders GROUPS, never a
 * merged list: each group keeps its own status and reason, an unavailable or
 * failing provider stays visible as a row with its explanation, and there is no
 * model summary anywhere on this page — a summary would need citations this
 * plugin cannot verify.
 *
 * Query execution is explicit (Enter / button), not per-keystroke, because one
 * of the providers leaves the machine.
 * ========================================================================== */

function searchKindMeta(kind) {
  if (kind === 'task') return { label: '待办', icon: 'tasks', tone: 'accent' }
  if (kind === 'knowledge') return { label: '知识', icon: 'book', tone: 'ok' }
  if (kind === 'radar') return { label: '雷达', icon: 'radar', tone: 'idle' }
  if (kind === 'source') return { label: '来源', icon: 'link', tone: 'idle' }
  if (kind === 'web') return { label: '外网', icon: 'external', tone: 'warn' }
  return { label: kind, icon: 'layers', tone: 'idle' }
}

function searchStatusMeta(status) {
  if (status === 'ok') return { label: '已返回', tone: 'ok' }
  if (status === 'empty') return { label: '无命中', tone: 'idle' }
  if (status === 'unavailable') return { label: '不可用', tone: 'warn' }
  if (status === 'error') return { label: '失败', tone: 'err' }
  return { label: status, tone: 'idle' }
}

function SearchResultRow(props) {
  const item = props.item
  const meta = searchKindMeta(item.kind)
  const extra = item.extra || {}

  function collect() {
    WB.actions
      .createKnowledge({
        kind: 'bookmark',
        title: item.title,
        url: item.url || null,
        body: item.snippet || '',
        tags: ['搜索', meta.label],
      })
      .catch(function () {})
  }

  return h(
    'div',
    { className: 'wb-item', style: { alignItems: 'flex-start' } },
    h(
      'div',
      { className: 'wb-item-main' },
      h(
        'div',
        { className: 'wb-item-title', style: { display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' } },
        h(Badge, { tone: meta.tone }, meta.label),
        item.url
          ? h(
              'a',
              {
                href: item.url,
                target: '_blank',
                rel: 'noreferrer',
                className: 'wb-link',
                style: { fontWeight: 500 },
              },
              item.title,
            )
          : h('span', null, item.title),
      ),
      item.snippet ? h('div', { className: 'wb-item-sub wb-clamp2' }, item.snippet) : null,
      h(
        'div',
        { className: 'wb-item-sub' },
        item.kind === 'task' && extra.status ? h('span', null, (WB.TASK_STATUS[extra.status] || {}).label || extra.status) : null,
        item.kind === 'task' && extra.dueAt ? h('span', null, '截止 ' + WB.fmt.day(extra.dueAt)) : null,
        item.kind === 'source' && extra.provider ? h('span', null, extra.provider) : null,
        item.kind === 'radar' && extra.source ? h('span', null, extra.source) : null,
        item.kind === 'web' && extra.publishedAt ? h('span', null, WB.fmt.date(extra.publishedAt)) : null,
        item.kind === 'knowledge' && extra.tags && extra.tags.length
          ? extra.tags.map(function (tag) {
              return h(Chip, { key: tag, children: tag })
            })
          : null,
      ),
    ),
    h(
      'div',
      { className: 'wb-item-actions', style: { opacity: 1 } },
      item.kind === 'task'
        ? h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'arrowRight',
            children: '定位',
            onClick: function () {
              WB.focusTask(item.id)
            },
          })
        : null,
      item.kind === 'radar' || item.kind === 'knowledge'
        ? h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'copy',
            children: '复制',
            onClick: function () {
              WB.util
                .copy([item.title, item.snippet, item.url].filter(Boolean).join('\n'))
                .then(function () {
                  WB.toast('已复制', 'ok')
                })
                .catch(function (e) {
                  WB.toast(String((e && e.message) || e), 'err')
                })
            },
          })
        : null,
      h(Btn, {
        size: 'sm',
        kind: 'subtle',
        icon: 'book',
        children: '收藏',
        onClick: collect,
      }),
    ),
  )
}

function SearchPage() {
  const state = useStore()
  const data = state.data

  const [draft, setDraft] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [includeWeb, setIncludeWeb] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [result, setResult] = React.useState(null)
  const [hidden, setHidden] = React.useState([])
  const [history, setHistory] = React.useState([])
  const [dateFilter, setDateFilter] = React.useState('all')
  const [projectFilter, setProjectFilter] = React.useState('')

  const SEARCH_DATE_WINDOWS = { all: 0, day: 24 * 3600 * 1000, week: 7 * 24 * 3600 * 1000, month: 30 * 24 * 3600 * 1000 }

  function itemPasses(item) {
    const extra = item.extra || {}
    if (projectFilter && item.kind === 'task' && (extra.projectId || null) !== projectFilter) return false
    if (dateFilter !== 'all') {
      const at = extra.at
      if (at) {
        const stamp = new Date(at).getTime()
        if (!Number.isNaN(stamp) && Date.now() - stamp > SEARCH_DATE_WINDOWS[dateFilter]) return false
      }
    }
    return true
  }

  function run(nextQuery) {
    const text = String(nextQuery === undefined ? draft : nextQuery).trim()
    if (!text) return
    setDraft(text)
    setQuery(text)
    setBusy(true)
    setError(null)
    WB.actions
      .search(text, { includeWeb: includeWeb })
      .then(function (value) {
        setResult(value)
        setBusy(false)
        setHistory(function (previous) {
          return [text]
            .concat(
              previous.filter(function (item) {
                return item !== text
              }),
            )
            .slice(0, 6)
        })
      })
      .catch(function (e) {
        setBusy(false)
        setError(String((e && e.message) || e))
        setResult(null)
      })
  }

  const groups = (result && result.groups) || []
  const visible = groups
    .filter(function (group) {
      return hidden.indexOf(group.id) < 0
    })
    .map(function (group) {
      if (group.status !== 'ok' && group.items.length === 0) return group
      return Object.assign({}, group, { items: group.items.filter(itemPasses) })
    })
  const totalVisible = visible.reduce(function (sum, group) {
    return sum + group.items.length
  }, 0)

  return h(
    'div',
    null,
    h(PageHead, {
      icon: 'search',
      title: WB.t('nav.search', '统一搜索'),
      sub: '按来源分组检索：待办、知识、雷达与外网各算一路，某一路失败不影响其它来源。',
      actions: h(
        React.Fragment,
        null,
        h(Toggle, {
          checked: includeWeb,
          onChange: setIncludeWeb,
          label: '含互联网',
        }),
        h(Btn, {
          icon: 'search',
          size: 'sm',
          kind: 'primary',
          disabled: busy || !draft.trim(),
          onClick: function () {
            run()
          },
          children: busy ? '检索中…' : '搜索',
        }),
      ),
    }),

    h(
      Panel,
      { title: '关键词', icon: 'filter', sub: '本地三路立即返回；互联网一路可能较慢' },
      h(
        'div',
        { className: 'wb-row' },
        h(Icon, { name: 'search', size: 15 }),
        h(Input, {
          value: draft,
          autoFocus: true,
          placeholder: '搜索待办、知识、技术雷达，或输入一串外部问题…',
          onChange: function (event) {
            setDraft(event.target.value)
          },
          onKeyDown: function (event) {
            if (event.key === 'Enter') {
              event.preventDefault()
              run()
            }
          },
        }),
        h(Btn, {
          icon: 'arrowRight',
          kind: 'primary',
          disabled: busy || !draft.trim(),
          onClick: function () {
            run()
          },
          children: '检索',
        }),
      ),
      history.length === 0
        ? null
        : h(
            'div',
            { className: 'wb-row wb-row--wrap', style: { marginTop: 10, gap: 6 } },
            h('span', { className: 'wb-tiny wb-muted' }, '最近：'),
            history.map(function (item) {
              return h(Chip, {
                key: item,
                children: item,
                onClick: function () {
                  run(item)
                },
              })
            }),
          ),
    ),

    h('div', { style: { height: 14 } }),

    busy
      ? h(
          'div',
          { className: 'wb-row', style: { padding: '26px 0', justifyContent: 'center', gap: 8 } },
          h(Spinner, { size: 17 }),
          h('span', { className: 'wb-tiny wb-muted' }, '正在按来源分组检索「' + query + '」…'),
        )
      : null,

    error
      ? h(
          Panel,
          { title: '检索失败', icon: 'alert', sub: 'Host 没有完成这次检索' },
          h('div', { role: 'alert', className: 'wb-code' }, error),
          h(
            'p',
            { className: 'wb-hint', style: { marginTop: 8 } },
            '如果刚刚更新过插件，说明 Host 还没有加载新的 Remote 端点：重启 DSH 后再试。',
          ),
        )
      : null,

    !busy && !error && !result
      ? h(
          'div',
          { className: 'wb-grid', style: { gridTemplateColumns: 'minmax(0, 1fr) 260px' } },
          h(
            Panel,
            { title: '怎么查', icon: 'info' },
            h(
              'div',
              { className: 'wb-stack', style: { gap: 7 } },
              h('span', { className: 'wb-tiny' }, '· 待办：标题、描述、标签'),
              h('span', { className: 'wb-tiny' }, '· 知识空间：收藏与笔记正文'),
              h('span', { className: 'wb-tiny' }, '· 技术雷达：标题与四段摘要'),
              h('span', { className: 'wb-tiny' }, '· 来源证据：消息与文件摘录'),
              h('span', { className: 'wb-tiny' }, '· 企业（云之家）：经 Host 调 yzj-cli 消息与文档搜索（需已认证）'),
              h('span', { className: 'wb-tiny' }, '· 互联网：经 Host 的 web 服务，结果带 URL 与时间'),
              h(Divider, null),
              h(
                'span',
                { className: 'wb-tiny wb-muted' },
                '本页不会把多路结果合并成一段没有引用的结论。要看归纳，请把任务简报交给会话里的 Agent。',
              ),
            ),
          ),
          h(
            Panel,
            { title: '当前可检索范围', icon: 'database', sub: '来自 Host 快照' },
            h(
              'div',
              { className: 'wb-stack', style: { gap: 6 } },
              h('span', { className: 'wb-tiny' }, '待办 ' + ((data && data.tasks) || []).length + ' 条'),
              h('span', { className: 'wb-tiny' }, '知识 ' + ((data && data.knowledge) || []).length + ' 条'),
              h('span', { className: 'wb-tiny' }, '雷达 ' + ((data && data.radar) || []).length + ' 条'),
              h('span', { className: 'wb-tiny' }, '来源 ' + ((data && data.sources) || []).length + ' 条'),
            ),
          ),
        )
      : null,

    result
      ? h(
          'div',
          null,
          h(
            'div',
            { className: 'wb-row wb-row--wrap', style: { marginBottom: 6, gap: 6 } },
            h('span', { className: 'wb-tiny wb-muted' }, '日期：'),
            [
              { value: 'all', label: '全部' },
              { value: 'day', label: '24 小时' },
              { value: 'week', label: '7 天' },
              { value: 'month', label: '30 天' },
            ].map(function (option) {
              return h(Chip, {
                key: option.value,
                active: dateFilter === option.value,
                onClick: function () {
                  setDateFilter(option.value)
                },
                children: option.label,
              })
            }),
            h('span', { className: 'wb-tiny wb-muted', style: { marginLeft: 12 } }, '项目：'),
            h(Select, {
              value: projectFilter,
              options: [{ value: '', label: '全部项目' }].concat(
                (((data && data.projects) || []).map(function (project) {
                  return { value: project.id, label: project.name }
                })),
              ),
              onChange: function (event) {
                setProjectFilter(event.target.value)
              },
            }),
            h('span', { className: 'wb-tiny wb-muted' }, '仅作用于「我的待办」一路'),
          ),
          h(
            'div',
            { className: 'wb-row wb-row--wrap', style: { marginBottom: 12, gap: 6 } },
            h('span', { className: 'wb-tiny wb-muted' }, '来源筛选：'),
            groups.map(function (group) {
              const meta = searchStatusMeta(group.status)
              const active = hidden.indexOf(group.id) < 0
              return h(Chip, {
                key: group.id,
                active: active,
                onClick: function () {
                  setHidden(function (previous) {
                    return active
                      ? previous.concat([group.id])
                      : previous.filter(function (id) {
                          return id !== group.id
                        })
                  })
                },
                children: group.label + ' ' + group.items.length,
                title: meta.label,
              })
            }),
            h('div', { className: 'wb-spacer' }),
            h(
              'span',
              { className: 'wb-tiny wb-muted' },
              '共 ' + totalVisible + ' 条 · ' + WB.fmt.relative(result.at, Date.now()),
            ),
          ),

          totalVisible === 0
            ? h(Empty, {
                icon: 'search',
                title: '「' + result.query + '」在已启用的来源里没有命中',
                hint: '本页不会为了凑结果而编造企业事实。可以换一个关键词、扩大时间范围，或到知识空间先补充资料。',
                action: h(Btn, {
                  size: 'sm',
                  icon: 'refresh',
                  children: '再查一次',
                  onClick: function () {
                    run()
                  },
                }),
              })
            : null,

          visible.map(function (group) {
            const meta = searchStatusMeta(group.status)
            const bad = group.status === 'error' || group.status === 'unavailable'
            return h(
              'div',
              { key: group.id, style: { marginBottom: 14 } },
              h(
                Panel,
                {
                  title: group.label,
                  icon:
                  group.id === 'web'
                    ? 'external'
                    : group.id === 'enterprise'
                      ? 'lock'
                      : group.id === 'tasks'
                        ? 'tasks'
                        : group.id === 'knowledge'
                          ? 'book'
                          : group.id === 'radar'
                            ? 'radar'
                            : 'link',
                  badge: h(Badge, { tone: meta.tone }, meta.label),
                  sub: group.note || undefined,
                  actions: h('span', { className: 'wb-tiny wb-muted' }, group.items.length + ' 条'),
                },
                bad && group.items.length === 0
                  ? h(Empty, {
                      icon: 'alert',
                      title: group.status === 'unavailable' ? '这一路当前不可用' : '这一路检索失败',
                      hint: group.note || '没有拿到结果。其余来源不受影响。',
                    })
                  : group.items.length === 0
                    ? h(Empty, { icon: 'search', title: '这一路没有命中', hint: '换个关键词可能更好。' })
                    : h(
                        'div',
                        null,
                        group.items.map(function (item) {
                          return h(SearchResultRow, { key: item.id, item: item })
                        }),
                      ),
              ),
            )
          }),
        )
      : null,
  )
}

WB.pages.search = SearchPage
