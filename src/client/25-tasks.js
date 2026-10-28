/* ============================================================================
 * dev-workbench — 任务中心 (tasks)
 *
 * 一个页面覆盖任务的完整生命周期：搜索 / 状态 / 优先级 / 项目 / 标签 / 到期
 * 筛选，列表与看板两种视图，新建与编辑复用 shell 挂载的共享任务表单
 * (WB.openTaskForm)，完成 / 重开 / 删除走 Host 动作，来源证据从 data.sources
 * 展开。所有筛选状态只存在于本页 useState 中，不写回 Host。
 *
 * Cross-module note: on mount this page consumes (and clears) the transient
 * store field `taskPreset` set by 20-dashboard.js stat cards, and it honours
 * `state.focusTaskId` (set by WB.focusTask) by revealing that task once.
 * ========================================================================== */

/* ------------------------------------------------------------------ helpers */

function tcToneColor(tone) {
  if (tone === 'err') return T.err
  if (tone === 'warn') return T.warn
  if (tone === 'ok') return T.ok
  if (tone === 'accent') return T.accent
  return T.text2
}

function tcPriorityOf(task) {
  return WB.TASK_PRIORITY[task.priority] || WB.TASK_PRIORITY.normal
}

function tcDueValue(task) {
  if (!task.dueAt) return Infinity
  const value = new Date(task.dueAt).getTime()
  return Number.isNaN(value) ? Infinity : value
}

function tcEndOfToday() {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return end.getTime()
}

function tcProjectName(data, projectId) {
  if (!projectId) return ''
  const projects = (data && data.projects) || []
  for (let index = 0; index < projects.length; index += 1) {
    if (projects[index].id === projectId) return projects[index].name || ''
  }
  return ''
}

function tcProjectColor(data, projectId) {
  if (!projectId) return null
  const projects = (data && data.projects) || []
  for (let index = 0; index < projects.length; index += 1) {
    if (projects[index].id === projectId) return projects[index].color || null
  }
  return null
}

function tcProviderLabel(provider) {
  const key = String(provider || '').toLowerCase()
  if (key === 'yunzhijia' || key === 'yzj') return '云之家'
  if (key === 'git' || key === 'github' || key === 'gitlab') return 'Git'
  if (key === 'web' || key === 'rss' || key === 'http') return '网页'
  if (key === 'manual') return '手动'
  if (key === 'docker') return 'Docker'
  return provider ? String(provider) : '未知来源'
}

function tcFindSource(data, task) {
  if (!data || !task.sourceRefId) return null
  const sources = Array.isArray(data.sources) ? data.sources : []
  for (let index = 0; index < sources.length; index += 1) {
    if (sources[index].id === task.sourceRefId) return sources[index]
  }
  return null
}

function tcBoardStatuses() {
  return ['ready', 'running', 'waiting_approval', 'completed']
}

/** 未完成按到期时间升序（无截止靠后），已结束按最近更新降序。 */
function tcSortTasks(list) {
  return (list || []).slice().sort(function (a, b) {
    const aDone = a.status === 'completed' || a.status === 'cancelled' ? 1 : 0
    const bDone = b.status === 'completed' || b.status === 'cancelled' ? 1 : 0
    if (aDone !== bDone) return aDone - bDone
    if (aDone === 1) {
      return String(b.completedAt || b.updatedAt || '').localeCompare(String(a.completedAt || a.updatedAt || ''))
    }
    const ad = tcDueValue(a)
    const bd = tcDueValue(b)
    if (ad !== bd) return ad - bd
    const ar = tcPriorityOf(a).rank || 0
    const br = tcPriorityOf(b).rank || 0
    if (ar !== br) return br - ar
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  })
}

function tcFilterList(list, filters) {
  const opts = filters || {}
  const query = opts.query ? String(opts.query).trim().toLowerCase() : ''
  const status = opts.status || 'all'
  const dueFilter = opts.dueFilter || 'all'
  const now = Date.now()
  const endOfDay = tcEndOfToday()
  const weekAhead = now + 7 * 86400000
  return (list || []).filter(function (task) {
    if (query) {
      const haystack = [task.title || '', task.description || '', (task.tags || []).join(' ')]
        .join(' ')
        .toLowerCase()
      if (haystack.indexOf(query) < 0) return false
    }
    if (opts.priority && opts.priority !== 'all' && task.priority !== opts.priority) return false
    if (opts.projectId && opts.projectId !== 'all') {
      if (opts.projectId === 'none') {
        if (task.projectId) return false
      } else if (task.projectId !== opts.projectId) {
        return false
      }
    }
    if (opts.tag && (task.tags || []).indexOf(opts.tag) < 0) return false
    if (dueFilter !== 'all') {
      /* 逾期 / 今日 / 7 天都描述“还要做的事”，已结束的任务不参与。 */
      if (task.status === 'completed' || task.status === 'cancelled') return false
      const due = tcDueValue(task)
      if (due === Infinity) return false
      if (dueFilter === 'overdue' && due >= now) return false
      if (dueFilter === 'today' && (due < now || due > endOfDay)) return false
      if (dueFilter === 'week' && (due < now || due > weekAhead)) return false
    }
    if (status !== 'all') {
      if (status === 'open') {
        if (task.status === 'completed' || task.status === 'cancelled') return false
      } else if (task.status !== status) {
        return false
      }
    }
    return true
  })
}

function tcTabCounts(list) {
  const counts = { all: 0, open: 0, ready: 0, running: 0, waiting_approval: 0, completed: 0, overdue: 0 }
  const now = Date.now()
  ;(list || []).forEach(function (task) {
    counts.all += 1
    if (task.status === 'completed') counts.completed += 1
    else if (task.status !== 'cancelled') counts.open += 1
    if (task.status === 'ready') counts.ready += 1
    if (task.status === 'running') counts.running += 1
    if (task.status === 'waiting_approval') counts.waiting_approval += 1
    if (task.status !== 'completed' && task.status !== 'cancelled' && tcDueValue(task) < now) counts.overdue += 1
  })
  return counts
}

function tcTagCounts(tasks) {
  const counts = {}
  ;(tasks || []).forEach(function (task) {
    ;(task.tags || []).forEach(function (tag) {
      if (!tag) return
      counts[tag] = (counts[tag] || 0) + 1
    })
  })
  return Object.keys(counts)
    .map(function (tag) {
      return { tag: tag, count: counts[tag] }
    })
    .sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count
      return a.tag.localeCompare(b.tag)
    })
}

/* --------------------------------------------------------------------- views */

function TaskCenterEvidence(props) {
  const task = props.task
  const data = props.data
  const source = tcFindSource(data, task)
  const confidence =
    typeof task.confidence === 'number' ? Math.round(task.confidence * 100) + '%' : '未评估'

  return h(
    'div',
    {
      style: {
        border: '1px solid ' + T.border1,
        borderRadius: 10,
        background: T.bg,
        padding: '9px 11px',
      },
    },
    h(
      'div',
      { className: 'wb-row', style: { gap: 6, marginBottom: 6, flexWrap: 'wrap' } },
      h('span', { style: { display: 'inline-flex', color: T.text2 } }, h(Icon, { name: 'layers', size: 12 })),
      h('span', { className: 'wb-tiny', style: { fontWeight: 600, color: T.text } }, '来源证据'),
      task.aiExtracted
        ? h(Badge, { tone: 'accent' }, 'AI 提取 · 置信度 ' + confidence)
        : h(Badge, { tone: 'idle' }, '手动创建'),
      h('div', { className: 'wb-spacer' }),
      h('span', { className: 'wb-tiny wb-muted' }, '更新于 ' + WB.fmt.relative(task.updatedAt)),
    ),
    source
      ? h(
          'div',
          { className: 'wb-stack', style: { gap: 5 } },
          h(
            'div',
            { className: 'wb-row wb-row--wrap', style: { gap: 7 } },
            h(Badge, { tone: 'idle' }, tcProviderLabel(source.provider)),
            source.title ? h('span', { style: { fontSize: 12, fontWeight: 500, color: T.text } }, source.title) : null,
            source.url
              ? h(
                  'a',
                  {
                    className: 'wb-link wb-tiny',
                    href: source.url,
                    target: '_blank',
                    rel: 'noreferrer noopener',
                    style: { display: 'inline-flex', alignItems: 'center', gap: 3 },
                  },
                  '打开原文',
                  h(Icon, { name: 'external', size: 10 }),
                )
              : null,
            h('div', { className: 'wb-spacer' }),
            h('span', { className: 'wb-tiny wb-muted' }, '同步于 ' + WB.fmt.datetime(source.fetchedAt)),
            h(IconBtn, {
              name: 'trash',
              label: '删除这条来源证据',
              onClick: function () {
                if (!window.confirm('删除这条来源证据？引用它的候选会一并移除，待办只解除来源关联。')) return
                WB.actions.deleteSource(source.id).catch(function () {})
              },
            }),
          ),
          source.excerpt ? h('div', { className: 'wb-code' }, source.excerpt) : null,
          h(
            'div',
            { className: 'wb-row wb-tiny wb-muted wb-row--wrap', style: { gap: 10 } },
            h('span', { className: 'wb-mono' }, 'source ' + source.id),
            source.externalId ? h('span', null, '外部 ID ' + source.externalId) : null,
            source.payloadHash ? h('span', { className: 'wb-mono' }, '指纹 ' + String(source.payloadHash).slice(0, 12)) : null,
          ),
        )
      : h(
          'div',
          { className: 'wb-stack', style: { gap: 3 } },
          h('span', { className: 'wb-tiny', style: { color: T.text } }, '无来源证据'),
          h(
            'span',
            { className: 'wb-tiny wb-muted', style: { lineHeight: 1.6 } },
            task.sourceRefId
              ? '这条待办引用了来源 ' + task.sourceRefId + '，但当前快照中没有对应记录。'
              : '手动创建的待办不会关联外部来源；接入云之家或网页来源后，原始消息会记录在这里。',
          ),
        ),
  )
}

function TaskCenterRow(props) {
  const task = props.task
  const data = props.data
  const expanded = props.expanded
  const highlighted = props.highlighted
  const [busy, setBusy] = React.useState(false)
  const done = task.status === 'completed' || task.status === 'cancelled'
  const priority = tcPriorityOf(task)
  const statusMeta = WB.TASK_STATUS[task.status] || { label: task.status || '未知状态', tone: 'idle' }
  const due = WB.fmt.due(task.dueAt)
  const projectName = tcProjectName(data, task.projectId)
  const projectColor = tcProjectColor(data, task.projectId)
  const source = tcFindSource(data, task)
  const tags = Array.isArray(task.tags) ? task.tags : []

  function toggleDone() {
    if (busy) return
    setBusy(true)
    WB.actions
      .updateTask(task.id, { status: done ? 'ready' : 'completed' })
      .then(function () {
        setBusy(false)
      })
      .catch(function () {
        setBusy(false)
      })
  }

  function remove() {
    if (busy) return
    const confirmed = window.confirm('删除待办“' + task.title + '”？该操作不可撤销。')
    if (!confirmed) return
    setBusy(true)
    WB.actions.deleteTask(task.id).catch(function () {
      setBusy(false)
    })
  }

  return h(
    React.Fragment,
    null,
    h(
      'tr',
      {
        ref: props.rowRef || undefined,
        style: highlighted
          ? {
              background: 'color-mix(in srgb, ' + T.accent + ' 7%, transparent)',
              boxShadow: 'inset 2px 0 0 ' + T.accent,
            }
          : undefined,
      },
      h(
        'td',
        { style: { width: 44, verticalAlign: 'top', paddingTop: 12 } },
        h(
          'button',
          {
            type: 'button',
            className: 'wb-check' + (done ? ' is-on' : ''),
            title: done ? '重开（标记为待处理）' : '标记完成',
            'aria-label': (done ? '重开 ' : '完成 ') + task.title,
            disabled: busy,
            onClick: toggleDone,
          },
          h(Icon, { name: 'check', size: 11 }),
        ),
      ),
      h(
        'td',
        { style: { minWidth: 220 } },
        h(
          'div',
          { className: 'wb-row wb-row--wrap', style: { gap: 6, alignItems: 'center' } },
                  task.needsReply === true
          ? h(Chip, {
              active: true,
              title: '回复阶段：' + (task.replyStage || '未标记') + '；点击推进到下一阶段',
              onClick: function () {
                const stages = ['待答复', '已确认收到', '已实质答复', '不需答复']
                const current = stages.indexOf(task.replyStage || '待答复')
                const next = stages[(current + 1) % stages.length]
                WB.actions.setReplyStage(task.id, next).catch(function () {})
              },
              children: task.replyStage || '待答复',
            })
          : null,

          h(
            'button',
            {
              type: 'button',
              className: 'wb-item-title' + (done ? ' is-done' : ''),
              style: {
                padding: 0,
                border: 0,
                background: 'transparent',
                color: T.text,
                font: 'inherit',
                fontSize: 12.5,
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                overflowWrap: 'anywhere',
              },
              title: '编辑这条待办',
              onClick: function () {
                WB.openTaskForm(task)
              },
            },
            task.title,
          ),
          task.aiExtracted ? h(Badge, { tone: 'accent' }, 'AI 提取') : null,
          source ? h(Badge, { tone: 'idle' }, '来源 · ' + tcProviderLabel(source.provider)) : null,
          task.assignee ? h(Badge, { tone: 'idle' }, task.assignee) : null,
        ),
        tags.length > 0
          ? h(
              'div',
              { className: 'wb-row wb-row--wrap', style: { gap: 4, marginTop: 3 } },
              tags.map(function (tag, index) {
                return h(
                  'span',
                  {
                    key: tag + ':' + index,
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: 17,
                      padding: '0 6px',
                      borderRadius: 999,
                      border: '1px solid ' + T.border1,
                      background: T.layer2,
                      color: T.text2,
                      fontSize: 10.5,
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                    },
                  },
                  '#' + tag,
                )
              }),
            )
          : null,
        task.description
          ? h(
              'div',
              { className: 'wb-tiny wb-muted wb-clamp2', style: { marginTop: 2, lineHeight: 1.5 } },
              task.description,
            )
          : null,
      ),
      h('td', null, h(Badge, { tone: priority.tone }, priority.label)),
      h('td', null, h(Badge, { tone: statusMeta.tone }, statusMeta.label)),
      h(
        'td',
        null,
        task.dueAt
          ? h('span', { style: { color: tcToneColor(due.tone), fontSize: 11.5, fontWeight: 600 } }, due.text)
          : h('span', { className: 'wb-tiny wb-muted' }, '—'),
      ),
      h(
        'td',
        null,
        projectName
          ? h(
              'div',
              { className: 'wb-row', style: { gap: 5, minWidth: 0 } },
              h('span', {
                style: {
                  flex: 'none',
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: projectColor || T.text2,
                  opacity: projectColor ? 1 : 0.55,
                },
              }),
              h('span', { className: 'wb-ellipsis', style: { fontSize: 11.5 } }, projectName),
            )
          : h('span', { className: 'wb-tiny wb-muted' }, '—'),
      ),
      h(
        'td',
        null,
        h(
          'div',
          { className: 'wb-row', style: { gap: 2, justifyContent: 'flex-end' } },
          h(IconBtn, {
            name: expanded ? 'chevronDown' : 'chevronRight',
            label: expanded ? '收起来源证据' : '展开来源证据',
            onClick: props.onToggleEvidence,
          }),
          h(IconBtn, {
            name: 'edit',
            label: '编辑',
            onClick: function () {
              WB.openTaskForm(task)
            },
          }),
          h(IconBtn, { name: 'trash', label: '删除', onClick: remove, disabled: busy }),
        ),
      ),
    ),
    expanded
      ? h(
          'tr',
          null,
          h(
            'td',
            {
              colSpan: 7,
              style: {
                padding: '0 12px 12px 54px',
                background: 'color-mix(in srgb, ' + T.accent + ' 3%, transparent)',
              },
            },
            h(TaskCenterEvidence, { task: task, data: data }),
          ),
        )
      : null,
  )
}

function TaskCenterBoardCard(props) {
  const task = props.task
  const data = props.data
  const [busy, setBusy] = React.useState(false)
  const done = task.status === 'completed' || task.status === 'cancelled'
  const priority = tcPriorityOf(task)
  const due = WB.fmt.due(task.dueAt)
  const projectName = tcProjectName(data, task.projectId)
  const tags = Array.isArray(task.tags) ? task.tags : []

  function open() {
    WB.openTaskForm(task)
  }

  function toggleDone(event) {
    event.stopPropagation()
    if (busy) return
    setBusy(true)
    WB.actions
      .updateTask(task.id, { status: done ? 'ready' : 'completed' })
      .then(function () {
        setBusy(false)
      })
      .catch(function () {
        setBusy(false)
      })
  }

  return h(
    'div',
    {
      role: 'button',
      tabIndex: 0,
      onClick: open,
      onKeyDown: function (event) {
        /* 卡片内的勾选按钮自己处理键盘，不要把 Space 当成“打开表单”。 */
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open()
        }
      },
      title: '编辑“' + task.title + '”',
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        minWidth: 0,
        padding: '8px 9px',
        border: '1px solid ' + T.border1,
        borderRadius: 11,
        background: T.layer2,
        cursor: 'pointer',
      },
    },
    h(
      'div',
      { className: 'wb-row', style: { alignItems: 'flex-start', gap: 6 } },
      h(
        'button',
        {
          type: 'button',
          className: 'wb-check' + (done ? ' is-on' : ''),
          style: { width: 14, height: 14, marginTop: 2 },
          title: done ? '重开' : '标记完成',
          'aria-label': (done ? '重开 ' : '完成 ') + task.title,
          disabled: busy,
          onClick: toggleDone,
        },
        h(Icon, { name: 'check', size: 10 }),
      ),
      h(
        'span',
        { className: 'wb-item-title' + (done ? ' is-done' : ''), style: { fontSize: 12, lineHeight: 1.45 } },
        task.title,
      ),
    ),
    h(
      'div',
      { className: 'wb-item-sub', style: { marginTop: 0, gap: 5 } },
      h(Badge, { tone: priority.tone }, priority.label),
      task.dueAt ? h('span', { style: { color: tcToneColor(due.tone), fontWeight: 600 } }, due.text) : null,
      projectName ? h('span', { className: 'wb-ellipsis', style: { maxWidth: 110 } }, projectName) : null,
    ),
    tags.length > 0
      ? h(
          'div',
          { className: 'wb-row wb-row--wrap', style: { gap: 3 } },
          tags.slice(0, 3).map(function (tag, index) {
            return h('span', { key: tag + ':' + index, className: 'wb-tiny wb-muted' }, '#' + tag)
          }),
        )
      : null,
  )
}

function TaskCenterPage() {
  const state = WB.useStore()
  const data = state.data
  const [view, setView] = React.useState('list')
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [dueFilter, setDueFilter] = React.useState('all')
  const [priority, setPriority] = React.useState('all')
  const [projectId, setProjectId] = React.useState('all')
  const [tag, setTag] = React.useState(null)
  const [expandedId, setExpandedId] = React.useState(null)
  const [showAllTags, setShowAllTags] = React.useState(false)
  const [pendingFocusId, setPendingFocusId] = React.useState(null)
  const [candidateBusy, setCandidateBusy] = React.useState(false)
  const [dragStatus, setDragStatus] = React.useState(null)
  // TODO 17：事项义务与类型筛选（对齐新任务字段契约）
  const [dutyFilter, setDutyFilter] = React.useState('all')
  const [typeFilter, setTypeFilter] = React.useState('all')
  const focusRowRef = React.useRef(null)

  const preset = state.taskPreset
  const focusId = state.focusTaskId

  React.useEffect(
    function () {
      if (!preset) return
      WB.store.set({ taskPreset: null })
      if (preset.status) setStatus(preset.status)
      if (preset.dueFilter) setDueFilter(preset.dueFilter)
      if (preset.priority) setPriority(preset.priority)
      if (preset.projectId) setProjectId(preset.projectId)
      if (preset.view) setView(preset.view)
    },
    [preset],
  )

  React.useEffect(
    function () {
      if (!focusId) return
      /* Filters would hide the requested task, so reveal it in a clean view. */
      setView('list')
      setStatus('all')
      setDueFilter('all')
      setPriority('all')
      setProjectId('all')
      setTag(null)
      setSearch('')
      setExpandedId(focusId)
      setPendingFocusId(focusId)
      WB.store.set({ focusTaskId: null })
    },
    [focusId],
  )

  React.useEffect(
    function () {
      if (!pendingFocusId) return undefined
      const timer = setTimeout(function () {
        const node = focusRowRef.current
        if (node && typeof node.scrollIntoView === 'function') {
          try {
            node.scrollIntoView({ block: 'center', behavior: 'smooth' })
          } catch (e) {
            node.scrollIntoView()
          }
        }
        setPendingFocusId(null)
      }, 60)
      return function () {
        clearTimeout(timer)
      }
    },
    [pendingFocusId, view],
  )

  if (!data) {
    return h(
      'div',
      { className: 'wb-page' },
      h(
        'div',
        { className: 'wb-row', style: { gap: 9, color: T.text2, padding: '10px 0' } },
        h(Spinner, { size: 16 }),
        h('span', null, '正在读取任务…'),
      ),
    )
  }

  const tasks = Array.isArray(data.tasks) ? data.tasks : []
  const projects = Array.isArray(data.projects) ? data.projects : []
  const counts = WB.taskCounts(data)
  const filterBase = tcFilterList(tasks, {
    query: search,
    priority: priority,
    projectId: projectId,
    tag: tag,
    dueFilter: dueFilter,
    status: 'all',
  })
  const dutyTypeFilter = function (task) {
    if (dutyFilter === 'reply' && task.needsReply !== true) return false
    if (dutyFilter === 'action' && task.needsAction !== true) return false
    if (typeFilter !== 'all' && task.eventType !== typeFilter) return false
    return true
  }
  const replyCount = filterBase.filter(function (task) { return task.needsReply === true }).length
  const replyStages = { '待答复': 'warn', '已确认收到': 'idle', '已实质答复': 'ok', '不需答复': 'idle' }
  const visible = tcSortTasks(tcFilterList(filterBase, { status: status })).filter(dutyTypeFilter)
  const tabCounts = tcTabCounts(filterBase)
  const tagCounts = tcTagCounts(tasks)
  const activeTagCount =
    tag && !tagCounts.some(function (item) {
      return item.tag === tag
    })
      ? [{ tag: tag, count: 0 }]
      : []
  const tagList = activeTagCount.concat(tagCounts)
  const tagsShown = showAllTags ? tagList : tagList.slice(0, 8)
  const hasDutyTasks = tasks.some(function (task) {
    return task.needsReply === true || task.needsAction === true || task.eventType
  })
  const filtersActive =
    search.trim().length > 0 ||
    status !== 'all' ||
    dueFilter !== 'all' ||
    priority !== 'all' ||
    projectId !== 'all' ||
    !!tag

  const projectOptions = [{ value: 'all', label: '全部项目' }, { value: 'none', label: '未归属项目' }].concat(
    projects.map(function (project) {
      return { value: project.id, label: project.name }
    }),
  )

  const tabItems = [
    { value: 'all', label: '全部', count: tabCounts.all },
    { value: 'open', label: '未完成', count: tabCounts.open },
    { value: 'ready', label: '待处理', count: tabCounts.ready },
    { value: 'running', label: '执行中', count: tabCounts.running },
    { value: 'waiting_approval', label: '待审批', count: tabCounts.waiting_approval },
    { value: 'completed', label: '已完成', count: tabCounts.completed },
  ]

  const dueOptions = [
    { value: 'all', label: '全部时间' },
    { value: 'overdue', label: '已逾期' },
    { value: 'today', label: '今日到期' },
    { value: 'week', label: '7 天内' },
  ]

  const priorityOptions = [
    { value: 'all', label: '全部' },
    { value: 'urgent', label: '紧急' },
    { value: 'high', label: '高' },
    { value: 'normal', label: '普通' },
    { value: 'low', label: '低' },
  ]

  function resetFilters() {
    setSearch('')
    setStatus('all')
    setDueFilter('all')
    setPriority('all')
    setProjectId('all')
    setTag(null)
  }

  function newTask() {
    WB.openTaskForm(null)
  }

  const filterBar = h(
    Panel,
    { style: { marginBottom: 14 }, bodyStyle: { padding: '12px 14px 13px' } },
    h(
      'div',
      { className: 'wb-stack', style: { gap: 9 } },
      h(
        'div',
        { className: 'wb-row wb-row--wrap', style: { gap: 10 } },
        h(
          'div',
          { style: { position: 'relative', flex: '1 1 240px', maxWidth: 340, minWidth: 170 } },
          h(Input, {
            value: search,
            placeholder: '搜索标题、描述或标签',
            'aria-label': '搜索待办',
            style: { paddingLeft: 28 },
            onChange: function (event) {
              setSearch(event.target.value)
            },
          }),
          h(
            'span',
            { style: { position: 'absolute', left: 9, top: 8, display: 'inline-flex', color: T.text2, pointerEvents: 'none' } },
            h(Icon, { name: 'search', size: 13 }),
          ),
        ),
        h(Tabs, {
          items: tabItems,
          value: status,
          onChange: function (value) {
            setStatus(value)
          },
        }),
        h('div', { className: 'wb-spacer' }),
        h(Btn, {
          size: 'sm',
          kind: 'subtle',
          icon: 'xCircle',
          disabled: !filtersActive,
          onClick: resetFilters,
          children: '重置筛选',
        }),
      ),
      h(
        'div',
        { className: 'wb-row wb-row--wrap', style: { gap: 6 } },
        h('span', { className: 'wb-tiny wb-muted' }, '到期'),
        dueOptions.map(function (option) {
          return h(Chip, {
            key: 'due:' + option.value,
            active: dueFilter === option.value,
            onClick: function () {
              setDueFilter(option.value)
            },
            children: option.label,
          })
        }),
        h('span', {
          style: { width: 1, height: 15, margin: '0 3px', background: T.border1, flex: 'none' },
        }),
        h('span', { className: 'wb-tiny wb-muted' }, '优先级'),
        priorityOptions.map(function (option) {
          return h(Chip, {
            key: 'priority:' + option.value,
            active: priority === option.value,
            onClick: function () {
              setPriority(option.value)
            },
            children: option.label,
          })
        }),
        h('span', {
          style: { width: 1, height: 15, margin: '0 3px', background: T.border1, flex: 'none' },
        }),
        h('span', { className: 'wb-tiny wb-muted' }, '项目'),
        h(
          'div',
          { style: { width: 160 } },
          h(Select, {
            options: projectOptions,
            value: projectId,
            onChange: function (event) {
              setProjectId(event.target.value)
            },
          }),
        ),
      ),
      hasDutyTasks
        ? h(
            'div',
            { className: 'wb-row wb-row--wrap', style: { gap: 6, marginBottom: 6 } },
            h('span', { className: 'wb-tiny wb-muted' }, '义务：'),
            [
              { id: 'all', label: '全部' },
              { id: 'reply', label: '待回复 ' + replyCount },
              { id: 'action', label: '待处理' },
            ].map(function (option) {
              return h(Chip, {
                key: 'duty-' + option.id,
                active: dutyFilter === option.id,
                onClick: function () {
                  setDutyFilter(option.id)
                },
                children: option.label,
              })
            }),
            h('span', { className: 'wb-tiny wb-muted', style: { marginLeft: 10 } }, '事项类型：'),
            [
              { id: 'all', label: '全部' },
              { id: 'meeting', label: '会议' },
              { id: 'feature', label: '功能开发' },
              { id: 'logging', label: '登记填报' },
              { id: 'other', label: '其他' },
            ].map(function (option) {
              return h(Chip, {
                key: 'type-' + option.id,
                active: typeFilter === option.id,
                onClick: function () {
                  setTypeFilter(option.id)
                },
                children: option.label,
              })
            }),
          )
        : null,
      tagList.length > 0
        ? h(
            'div',
            { className: 'wb-row wb-row--wrap', style: { gap: 5 } },
            h('span', { className: 'wb-tiny wb-muted' }, '标签'),
            tagsShown.map(function (item) {
              return h(Chip, {
                key: 'tag:' + item.tag,
                active: tag === item.tag,
                onClick: function () {
                  setTag(tag === item.tag ? null : item.tag)
                },
                title: item.count + ' 条待办',
                children: '#' + item.tag + (item.count > 0 ? ' · ' + item.count : ''),
              })
            }),
            tagList.length > 8
              ? h(Chip, {
                  onClick: function () {
                    setShowAllTags(!showAllTags)
                  },
                  children: showAllTags ? '收起标签' : '更多标签 · ' + (tagList.length - 8),
                })
              : null,
          )
        : null,
      h(
        'div',
        { className: 'wb-row wb-tiny wb-muted', style: { gap: 8, flexWrap: 'wrap' } },
        h('span', null, '共 ' + visible.length + ' 条结果'),
        h('span', null, '未完成 ' + tabCounts.open),
        h('span', null, '逾期 ' + tabCounts.overdue),
        h('div', { className: 'wb-spacer' }),
        h('span', { className: 'wb-tiny wb-muted' }, '筛选只影响当前视图，不写入 Host'),
      ),
    ),
  )

  let content
  if (tasks.length === 0) {
    content = h(
      Panel,
      { flush: true },
      h(Empty, {
        icon: 'tasks',
        title: '还没有待办',
        hint: '从一条手动待办开始；接入云之家后，@ 你的消息经确认也会进入这里，并保留原始来源。',
        action: h(Btn, {
          size: 'sm',
          kind: 'primary',
          icon: 'plus',
          onClick: newTask,
          children: '新建第一条待办',
        }),
      }),
    )
  } else if (visible.length === 0) {
    content = h(
      Panel,
      { flush: true },
      h(Empty, {
        icon: 'search',
        title: '没有匹配的待办',
        hint: '当前搜索与筛选没有命中任何任务；可以清空条件后重试。',
        action: h(Btn, {
          size: 'sm',
          icon: 'xCircle',
          onClick: resetFilters,
          children: '重置筛选',
        }),
      }),
    )
  } else if (view === 'board') {
    const boardStatuses = tcBoardStatuses()
    const outside = visible.filter(function (task) {
      return boardStatuses.indexOf(task.status) < 0
    })
    content = h(
      'div',
      null,
      h(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 10,
            alignItems: 'start',
          },
        },
        boardStatuses.map(function (key) {
          const meta = WB.TASK_STATUS[key]
          const columnTasks = visible.filter(function (task) {
            return task.status === key
          })
          const dropActive = dragStatus === key
          return h(
            'div',
            {
              key: key,
              className: 'wb-card',
              style: dropActive
                ? { borderColor: T.accent, boxShadow: 'inset 0 0 0 1px ' + T.accent }
                : undefined,
              onDragOver: function (event) {
                event.preventDefault()
                if (dragStatus !== key) setDragStatus(key)
              },
              onDragLeave: function (event) {
                if (event.currentTarget.contains(event.relatedTarget)) return
                setDragStatus(function (previous) {
                  return previous === key ? null : previous
                })
              },
              onDrop: function (event) {
                event.preventDefault()
                setDragStatus(null)
                const taskId = event.dataTransfer ? event.dataTransfer.getData('text/plain') : ''
                if (!taskId) return
                const target = visible.find(function (item) {
                  return item.id === taskId
                })
                if (!target || target.status === key) return
                WB.actions
                  .updateTask(taskId, { status: key })
                  .then(function () {
                    WB.toast('已移动到「' + meta.label + '」', 'ok')
                  })
                  .catch(function () {
                    /* settle() 已提示 */
                  })
              },
            },
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 11px',
                  borderBottom: '1px solid ' + T.border1,
                },
              },
              h('span', {
                style: {
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: tcToneColor(meta.tone),
                  flex: 'none',
                },
              }),
              h('span', { style: { fontSize: 12, fontWeight: 600, color: T.text } }, meta.label),
              h('span', { className: 'wb-spacer' }),
              h('span', { className: 'wb-tiny wb-muted' }, String(columnTasks.length)),
            ),
            h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 7, padding: 8, minHeight: 64 } },
              columnTasks.length > 0
                ? columnTasks.map(function (task) {
                    return h(
                      'div',
                      {
                        key: task.id,
                        draggable: true,
                        style: { cursor: 'grab' },
                        title: '拖动到其它列可改状态',
                        onDragStart: function (event) {
                          if (event.dataTransfer) {
                            event.dataTransfer.setData('text/plain', task.id)
                            event.dataTransfer.effectAllowed = 'move'
                          }
                          setDragStatus(task.status)
                        },
                        onDragEnd: function () {
                          setDragStatus(null)
                        },
                      },
                      h(TaskCenterBoardCard, { task: task, data: data }),
                    )
                  })
                : h(
                    'div',
                    { className: 'wb-tiny wb-muted', style: { textAlign: 'center', padding: '12px 0' } },
                    '暂无任务',
                  ),
            ),
          )
        }),
      ),
      outside.length > 0
        ? h(
            'div',
            {
              className: 'wb-row wb-tiny wb-muted wb-row--wrap',
              style: {
                gap: 8,
                marginTop: 10,
                padding: '8px 10px',
                border: '1px dashed ' + T.border1,
                borderRadius: 10,
              },
            },
            h(Icon, { name: 'info', size: 12 }),
            h('span', null, '另有 ' + outside.length + ' 条（草稿 / 失败 / 已取消）不在四个看板列中。'),
            h('div', { className: 'wb-spacer' }),
            h(Btn, {
              size: 'sm',
              kind: 'subtle',
              icon: 'tasks',
              onClick: function () {
                setView('list')
              },
              children: '用列表查看',
            }),
          )
        : null,
    )
  } else {
    content = h(
      'div',
      { className: 'wb-card' },
      h(
        'table',
        { className: 'wb-table' },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            h('th', { style: { width: 44 } }, '完成'),
            h('th', null, '任务'),
            h('th', { style: { width: 84 } }, '优先级'),
            h('th', { style: { width: 92 } }, '状态'),
            h('th', { style: { width: 104 } }, '截止'),
            h('th', { style: { width: 130 } }, '项目'),
            h('th', { style: { width: 112, textAlign: 'right' } }, '操作'),
          ),
        ),
        h(
          'tbody',
          null,
          visible.map(function (task) {
            const isPending = pendingFocusId === task.id
            return h(TaskCenterRow, {
              key: task.id,
              task: task,
              data: data,
              expanded: expandedId === task.id,
              highlighted: isPending || expandedId === task.id,
              rowRef: isPending ? focusRowRef : null,
              onToggleEvidence: function () {
                setExpandedId(expandedId === task.id ? null : task.id)
              },
            })
          }),
        ),
      ),
    )
  }

  // ---- AI 任务提取的「待确认」区（设计报告 §3.2：低置信度只做候选，人工确认后才建任务）
  const allCandidates = Array.isArray(data && data.candidates) ? data.candidates : []
  const pendingCandidates = allCandidates.filter(function (candidate) {
    return candidate && candidate.status === 'pending'
  })
  const lastExtract = data && data.lastExtract ? data.lastExtract : null

  function runExtract() {
    if (candidateBusy) return
    setCandidateBusy(true)
    WB.actions
      .extractCandidates()
      .then(function () {
        setCandidateBusy(false)
      })
      .catch(function () {
        setCandidateBusy(false)
      })
  }

  function acceptCandidateItem(candidate) {
    if (candidateBusy) return
    setCandidateBusy(true)
    WB.actions
      .acceptCandidate(candidate.id, {})
      .then(function () {
        setCandidateBusy(false)
      })
      .catch(function () {
        setCandidateBusy(false)
      })
  }

  function rejectCandidateItem(candidate) {
    if (candidateBusy) return
    setCandidateBusy(true)
    WB.actions
      .rejectCandidate(candidate.id)
      .then(function () {
        setCandidateBusy(false)
      })
      .catch(function () {
        setCandidateBusy(false)
      })
  }

  const candidatesPanel = h(
    Panel,
    {
      icon: 'sparkles',
      title: '待确认',
      sub:
        pendingCandidates.length > 0
          ? '规则从 @我 消息里提取的候选，共 ' + pendingCandidates.length + ' 条；采纳后才变成待办'
          : lastExtract && lastExtract.at
            ? '上次提取 ' + WB.fmt.relative(lastExtract.at) + ' · 新增 ' + (lastExtract.added || 0) + ' 条'
            : '从云之家 @我 消息里提取候选，人工确认后才建待办',
      badge: pendingCandidates.length > 0 ? h(Badge, { tone: 'warn' }, String(pendingCandidates.length)) : null,
      actions: h(Btn, {
        size: 'sm',
        kind: 'subtle',
        icon: 'sparkles',
        disabled: candidateBusy,
        onClick: runExtract,
        children: candidateBusy ? '处理中…' : '提取候选',
      }),
    },
    pendingCandidates.length === 0
      ? h(Empty, {
          style: { padding: '16px 12px 14px' },
          icon: 'checkCircle',
          title: '没有待确认的候选',
          hint:
            '先在首页「云之家 @我」拉取消息，再点右上角「提取候选」。规则只做确定性判断（行动词 / 时间线索 / 长度 / 指向性），置信度可解释；采纳前请人工核对。',
        })
      : h(
          'div',
          { className: 'wb-list' },
          pendingCandidates.slice(0, 8).map(function (candidate) {
            const due = candidate.dueAt ? WB.fmt.due(candidate.dueAt) : null
            return h(
              'div',
              { key: candidate.id, className: 'wb-item', style: { alignItems: 'flex-start' } },
              h(
                'div',
                { className: 'wb-item-main' },
                h(
                  'div',
                  { className: 'wb-item-title', style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' } },
                  candidate.title,
                  candidate.confidence !== null && candidate.confidence !== undefined
                    ? h(
                        Badge,
                        { tone: candidate.confidence >= 0.7 ? 'ok' : candidate.confidence >= 0.5 ? 'warn' : 'idle' },
                        '置信度 ' + Math.round(candidate.confidence * 100) + '%',
                      )
                    : null,
                  due ? h(Badge, { tone: due.tone }, due.text) : null,
                ),
                h('div', { className: 'wb-item-sub wb-clamp2' }, candidate.excerpt || ''),
                h(
                  'div',
                  { className: 'wb-item-sub' },
                  candidate.sourceTitle ? h('span', null, candidate.sourceTitle) : null,
                  (candidate.reasons || []).slice(0, 2).map(function (reason, index) {
                    return h(Chip, { key: 'r' + index, children: reason })
                  }),
                ),
              ),
              h(
                'div',
                { className: 'wb-item-actions', style: { opacity: 1 } },
                h(Btn, {
                  size: 'sm',
                  kind: 'primary',
                  icon: 'check',
                  disabled: candidateBusy,
                  onClick: function () {
                    acceptCandidateItem(candidate)
                  },
                  children: '采纳',
                }),
                h(Btn, {
                  size: 'sm',
                  kind: 'subtle',
                  icon: 'close',
                  disabled: candidateBusy,
                  onClick: function () {
                    rejectCandidateItem(candidate)
                  },
                  children: '忽略',
                }),
                h(IconBtn, {
                  name: 'trash',
                  label: '彻底删除这条候选',
                  onClick: function () {
                    if (!window.confirm('彻底删除这条候选记录？')) return
                    WB.actions.deleteCandidate(candidate.id).catch(function () {})
                  },
                }),
              ),
            )
          }),
        ),
  )

  return h(
    'div',
    null,
    h(PageHead, {
      icon: 'tasks',
      title: '任务中心',
      sub:
        '共 ' +
        counts.total +
        ' 条 · 未完成 ' +
        counts.open +
        ' · 逾期 ' +
        counts.overdue +
        ' · 执行中 ' +
        counts.running,
      actions: h(
        'div',
        { className: 'wb-row', style: { gap: 8 } },
        h(Segmented, {
          items: [
            { value: 'list', label: '列表' },
            { value: 'board', label: '看板' },
          ],
          value: view,
          onChange: function (value) {
            setView(value)
          },
        }),
        h(Btn, {
          size: 'sm',
          kind: 'primary',
          icon: 'plus',
          onClick: newTask,
          children: '新建待办',
        }),
      ),
    }),
    candidatesPanel,
    tasks.length > 0 ? filterBar : null,
    content,
  )
}

WB.pages.tasks = TaskCenterPage
