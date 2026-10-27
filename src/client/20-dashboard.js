/* ============================================================================
 * dev-workbench — 今日简报 (dashboard)
 *
 * 首屏只回答一个问题：今天有哪些必须处理的事。顺序固定为
 * 待办统计 → 今日待办（可勾选完成）→ 技术雷达（关注主题过滤 + 收藏）
 * → 连接状态。所有数字来自 Host 快照，空集合一律渲染 <Empty>。
 *
 * Cross-module note: a stat card navigates to the task center with a
 * transient `taskPreset` store field ({status?, dueFilter?, view?}).
 * 25-tasks.js consumes it on mount and clears it. It is deliberately not
 * part of the public contract — nothing outside these two files reads it.
 * ========================================================================== */

/* ------------------------------------------------------------------ helpers */

function dashStoreNavigate(preset) {
  WB.store.set({ page: 'tasks', taskPreset: preset || null })
}

function dashToneColor(tone) {
  if (tone === 'err') return T.err
  if (tone === 'warn') return T.warn
  if (tone === 'ok') return T.ok
  if (tone === 'accent') return T.accent
  return T.text2
}

function dashPriorityOf(task) {
  return WB.TASK_PRIORITY[task.priority] || WB.TASK_PRIORITY.normal
}

function dashDueValue(task) {
  if (!task.dueAt) return Infinity
  const value = new Date(task.dueAt).getTime()
  return Number.isNaN(value) ? Infinity : value
}

function dashEndOfToday() {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return end.getTime()
}

/** 逾期 + 今日到期 + 高优先级的未完成待办，最紧急的排前面。 */
function dashActionable(data) {
  const endOfDay = dashEndOfToday()
  return WB.openTasks(data)
    .filter(function (task) {
      if (task.priority === 'urgent' || task.priority === 'high') return true
      return dashDueValue(task) <= endOfDay
    })
    .sort(function (a, b) {
      const ad = dashDueValue(a)
      const bd = dashDueValue(b)
      if (ad !== bd) return ad - bd
      const ar = dashPriorityOf(a).rank || 0
      const br = dashPriorityOf(b).rank || 0
      if (ar !== br) return br - ar
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    })
}

function dashEarliestOverdue(data) {
  let earliest = null
  WB.openTasks(data).forEach(function (task) {
    const value = dashDueValue(task)
    if (value === Infinity || value >= Date.now()) return
    if (earliest === null || value < earliest) earliest = value
  })
  return earliest === null ? null : new Date(earliest).toISOString()
}

function dashStaleInfo(data) {
  if (!data || !data.updatedAt) return null
  const settings = data.settings || {}
  const raw = Number(settings.staleHours)
  const staleHours = Number.isFinite(raw) && raw > 0 ? raw : 24
  const updated = new Date(data.updatedAt).getTime()
  if (Number.isNaN(updated)) return null
  if (Date.now() - updated <= staleHours * 3600 * 1000) return null
  return { staleHours: staleHours, updatedAt: data.updatedAt }
}

function dashProjectName(data, projectId) {
  if (!projectId) return ''
  const projects = (data && data.projects) || []
  for (let index = 0; index < projects.length; index += 1) {
    if (projects[index].id === projectId) return projects[index].name || ''
  }
  return ''
}

function dashRadarTimeValue(item) {
  const value = item.publishedAt || item.updatedAt || item.createdAt
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function dashSummaryParts(summary) {
  const defs = [
    { key: 'change', label: '技术变化' },
    { key: 'usage', label: '应用场景' },
    { key: 'risk', label: '采用风险' },
    { key: 'practice', label: '推荐实践' },
  ]
  if (!summary || typeof summary !== 'object') return []
  return defs
    .map(function (def) {
      const text = typeof summary[def.key] === 'string' ? summary[def.key].trim() : ''
      return { key: def.key, label: def.label, text: text }
    })
    .filter(function (part) {
      return part.text.length > 0
    })
}

function dashConnectorIcon(type) {
  const key = String(type || '').toLowerCase()
  if (key.indexOf('git') >= 0) return 'git'
  if (key.indexOf('docker') >= 0) return 'docker'
  if (key.indexOf('db') >= 0 || key.indexOf('sql') >= 0) return 'database'
  if (key.indexOf('web') >= 0 || key.indexOf('rss') >= 0 || key.indexOf('http') >= 0) return 'link'
  return 'plug'
}

function dashTagPill(topic, key) {
  return h(
    'span',
    {
      key: key,
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
    topic,
  )
}

/* ------------------------------------------------------------- dashboard UI */

function DashTaskRow(props) {
  const task = props.task
  const data = props.data
  const due = WB.fmt.due(task.dueAt)
  const priority = dashPriorityOf(task)
  const project = dashProjectName(data, task.projectId)

  function complete() {
    WB.actions.updateTask(task.id, { status: 'completed' }).catch(function () {})
  }

  return h(
    'div',
    { className: 'wb-item', style: { alignItems: 'flex-start' } },
    h(
      'button',
      {
        type: 'button',
        className: 'wb-check',
        title: '标记完成',
        'aria-label': '标记“' + task.title + '”为完成',
        onClick: complete,
      },
      h(Icon, { name: 'check', size: 11 }),
    ),
    h(
      'div',
      { className: 'wb-item-main' },
      h(
        'button',
        {
          type: 'button',
          className: 'wb-item-title',
          style: {
            display: 'block',
            width: '100%',
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
      h(
        'div',
        { className: 'wb-item-sub' },
        h(Badge, { tone: priority.tone }, priority.label),
        task.dueAt
          ? h('span', { style: { color: dashToneColor(due.tone), fontWeight: 600 } }, due.text)
          : h('span', { className: 'wb-muted' }, '无截止'),
        project ? h('span', { className: 'wb-muted' }, project) : null,
        task.aiExtracted ? h(Badge, { tone: 'accent' }, 'AI 提取') : null,
      ),
    ),
    h(
      'div',
      { className: 'wb-item-actions' },
      h(IconBtn, {
        name: 'edit',
        label: '编辑',
        onClick: function () {
          WB.openTaskForm(task)
        },
      }),
      h(IconBtn, {
        name: 'arrowRight',
        label: '在任务中心定位',
        onClick: function () {
          WB.focusTask(task.id)
        },
      }),
    ),
  )
}

function DashRadarRow(props) {
  const item = props.item
  const rawParts = dashSummaryParts(item.summary)
  // Fetched items keep the raw excerpt; the four-part summary stays empty until
  // an agent digests it, so the row never shows an invented summary.
  const summaryParts =
    rawParts.length > 0
      ? rawParts
      : item.excerpt
        ? [{ key: 'excerpt', label: '原文摘录', text: item.excerpt }]
        : []
  const needsDigest = rawParts.length === 0 && !!item.excerpt
  const published = item.publishedAt || item.updatedAt || item.createdAt
  const topics = Array.isArray(item.topics) ? item.topics : []
  const [saving, setSaving] = React.useState(false)
  const [makingTask, setMakingTask] = React.useState(false)

  function makePracticeTask() {
    if (makingTask) return
    setMakingTask(true)
    WB.actions
      .createTaskFromRadar(item.id)
      .then(function () {
        setMakingTask(false)
      })
      .catch(function () {
        setMakingTask(false)
      })
  }

  function saveToKnowledge() {
    if (saving) return
    setSaving(true)
    const body = summaryParts
      .map(function (part) {
        return part.label + '：' + part.text
      })
      .join('\n')
    WB.actions
      .createKnowledge({
        kind: 'bookmark',
        title: item.title,
        url: item.url || null,
        body: body || item.title,
        tags: topics.slice(0, 8),
      })
      .then(function () {
        setSaving(false)
      })
      .catch(function () {
        setSaving(false)
      })
  }

  return h(
    'div',
    {
      className: 'wb-item',
      style: { flexDirection: 'column', alignItems: 'stretch', gap: 2, padding: '10px 4px' },
    },
    h(
      'div',
      { className: 'wb-row', style: { alignItems: 'flex-start', gap: 8 } },
      h(
        'div',
        { className: 'wb-item-main' },
        h(
          'div',
          { className: 'wb-item-title', style: { display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' } },
          item.url
            ? h(
                'a',
                {
                  className: 'wb-link',
                  href: item.url,
                  target: '_blank',
                  rel: 'noreferrer noopener',
                  style: { fontSize: 12.5, fontWeight: 500 },
                  title: '打开原文',
                },
                item.title,
                h(Icon, { name: 'external', size: 10 }),
              )
            : h('span', null, item.title),
          item.saved ? h(Badge, { tone: 'ok' }, '已收藏') : null,
        ),
        h(
          'div',
          { className: 'wb-item-sub', style: { gap: 5 } },
          h('span', { className: 'wb-muted' }, item.source || '未知来源'),
          h('span', { className: 'wb-muted' }, '·'),
          h('span', { className: 'wb-muted' }, published ? WB.fmt.date(published) : '未注明日期'),
          topics.map(function (topic, index) {
            return dashTagPill(topic, 'topic:' + topic + ':' + index)
          }),
        ),
      ),
      h(
        'div',
        { className: 'wb-item-actions', style: { opacity: 1 } },
        h(IconBtn, {
          name: 'book',
          label: '收藏到知识空间',
          onClick: saveToKnowledge,
          disabled: saving,
        }),
        h(IconBtn, {
          name: 'play',
          label: '生成实践任务（保留来源证据）',
          onClick: makePracticeTask,
          disabled: makingTask,
        }),
        summaryParts.length > 0
          ? h(IconBtn, {
              name: props.expanded ? 'chevronDown' : 'chevronRight',
              label: props.expanded ? '收起摘要' : '展开摘要',
              onClick: props.onToggle,
            })
          : null,
      ),
    ),
    props.expanded && summaryParts.length > 0
      ? h(
          'div',
          {
            style: {
              display: 'grid',
              gap: 5,
              marginTop: 4,
              padding: '9px 10px',
              border: '1px solid ' + T.border1,
              borderRadius: 10,
              background: T.layer2,
            },
          },
          summaryParts.map(function (part) {
            return h(
              'div',
              { key: part.key, style: { display: 'flex', alignItems: 'flex-start', gap: 8 } },
              h('span', { style: { flex: 'none', width: 56, fontSize: 11, color: T.text2 } }, part.label),
              h('span', { style: { fontSize: 11.5, lineHeight: 1.6, color: T.text } }, part.text),
            )
          }),
          needsDigest
            ? h(
                'div',
                { style: { marginTop: 4, fontSize: 11, color: T.text2 } },
                '四段智能摘要需要模型归纳：点右侧「生成实践任务」交给 Agent，或在对话里让它归纳后写回。',
              )
            : null,
        )
      : null,
  )
}

function DashConnectorCard(props) {
  const connector = props.connector
  const stateMeta = WB.CONNECTOR_STATE[connector.authState] || {
    label: connector.authState || '状态未知',
    tone: 'idle',
  }
  const capabilities = Array.isArray(connector.capabilities) ? connector.capabilities : []
  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
        padding: '11px 12px',
        border: '1px solid ' + T.border1,
        borderRadius: 12,
        background: T.layer2,
      },
    },
    h(
      'div',
      { className: 'wb-row', style: { gap: 7, minWidth: 0 } },
      h('span', { style: { display: 'inline-flex', color: T.text2 } }, h(Icon, { name: dashConnectorIcon(connector.type), size: 14 })),
      h('span', { className: 'wb-ellipsis', style: { fontSize: 12.5, fontWeight: 600, color: T.text } }, connector.label || connector.type || '未命名连接'),
      h('span', { className: 'wb-spacer' }),
      h(Badge, { tone: stateMeta.tone }, stateMeta.label),
    ),
    capabilities.length > 0
      ? h(
          'div',
          { className: 'wb-row wb-row--wrap', style: { gap: 4 } },
          capabilities.map(function (capability, index) {
            return dashTagPill(capability, 'cap:' + capability + ':' + index)
          }),
        )
      : h('span', { className: 'wb-tiny wb-muted' }, '未声明能力'),
    connector.note ? h('div', { className: 'wb-tiny wb-muted', style: { lineHeight: 1.55 } }, connector.note) : null,
    h(
      'div',
      { className: 'wb-row wb-tiny wb-muted', style: { gap: 6 } },
      connector.updatedAt ? h('span', null, '更新于 ' + WB.fmt.relative(connector.updatedAt)) : h('span', null, '尚无同步记录'),
      h('span', { className: 'wb-spacer' }),
      h('span', { className: 'wb-mono' }, String(connector.type || 'connector')),
    ),
  )
}

function DashRadarModal(props) {
  const [title, setTitle] = React.useState('')
  const [source, setSource] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [publishedAt, setPublishedAt] = React.useState('')
  const [topics, setTopics] = React.useState('')
  const [summary, setSummary] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(null)

  React.useEffect(
    function () {
      if (!props.open) return
      setTitle('')
      setSource('')
      setUrl('')
      setPublishedAt('')
      setTopics('')
      setSummary('')
      setBusy(false)
      setError(null)
    },
    [props.open],
  )

  if (!props.open) return null

  function submit(event) {
    if (event) event.preventDefault()
    if (busy) return
    const trimmedTitle = title.trim()
    const trimmedUrl = url.trim()
    if (!trimmedTitle) {
      setError('标题不能为空')
      return
    }
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      setError('链接需以 http:// 或 https:// 开头')
      return
    }
    let publishedIso = null
    if (publishedAt) {
      const parsed = new Date(publishedAt + 'T00:00:00')
      publishedIso = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
    }
    setBusy(true)
    setError(null)
    WB.actions
      .saveRadarItem({
        title: trimmedTitle,
        source: source.trim() || 'manual',
        url: trimmedUrl || null,
        publishedAt: publishedIso,
        topics: topics
          .split(/[,，\s]+/)
          .map(function (topic) {
            return topic.trim()
          })
          .filter(Boolean),
        summary: { change: summary.trim(), usage: '', risk: '', practice: '' },
      })
      .then(function () {
        setBusy(false)
        WB.toast('资讯已添加到技术雷达', 'ok')
        props.onClose()
      })
      .catch(function (e) {
        setBusy(false)
        setError(String((e && e.message) || e))
      })
  }

  return h(
    Modal,
    {
      open: true,
      title: '手动添加资讯',
      sub: '登记的资讯会和采集来源一起进入技术雷达',
      onClose: props.onClose,
      width: 560,
      footer: h(
        React.Fragment,
        null,
        h(Btn, { onClick: props.onClose, disabled: busy, children: '取消' }),
        h('div', { className: 'wb-spacer' }),
        h(Btn, { kind: 'primary', icon: 'check', disabled: busy, onClick: submit, children: busy ? '保存中…' : '添加资讯' }),
      ),
    },
    h(
      'form',
      { onSubmit: submit, className: 'wb-stack', style: { gap: 11 } },
      h(Field, { label: '标题' }, h(Input, {
        value: title,
        autoFocus: true,
        placeholder: '例如：Harness 新增 Slots 整页扩展点',
        onChange: function (event) {
          setTitle(event.target.value)
        },
      })),
      h(
        'div',
        { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
        h(Field, { label: '来源' }, h(Input, {
          value: source,
          placeholder: '官方博客 / GitHub Trending',
          onChange: function (event) {
            setSource(event.target.value)
          },
        })),
        h(Field, { label: '发布日期' }, h(Input, {
          type: 'date',
          value: publishedAt,
          onChange: function (event) {
            setPublishedAt(event.target.value)
          },
        })),
      ),
      h(Field, { label: '链接', hint: '可选；保存后标题可直接打开原文' }, h(Input, {
        type: 'url',
        value: url,
        placeholder: 'https://',
        onChange: function (event) {
          setUrl(event.target.value)
        },
      })),
      h(Field, { label: '主题', hint: '逗号或空格分隔，会参与关注主题过滤' }, h(Input, {
        value: topics,
        placeholder: 'Agent, RAG',
        onChange: function (event) {
          setTopics(event.target.value)
        },
      })),
      h(Field, { label: '摘要（技术变化）', hint: '其余三段（应用场景 / 风险 / 实践）可在雷达卡片里补充' }, h(Textarea, {
        value: summary,
        placeholder: '这次变化的关键事实是什么？',
        onChange: function (event) {
          setSummary(event.target.value)
        },
      })),
      error ? h('div', { role: 'alert', style: { color: T.err, fontSize: 12 } }, error) : null,
      h('button', { type: 'submit', style: { display: 'none' } }),
    ),
  )
}

function DashboardPage() {
  const state = WB.useStore()
  const data = state.data
  const [radarAll, setRadarAll] = React.useState(false)
  const [radarShowAll, setRadarShowAll] = React.useState(false)
  const [radarExpanded, setRadarExpanded] = React.useState(null)
  const [radarFormOpen, setRadarFormOpen] = React.useState(false)
  const [radarFetching, setRadarFetching] = React.useState(false)
  const [mentionsBusy, setMentionsBusy] = React.useState(false)

  if (!data) {
    return h(
      'div',
      { className: 'wb-page' },
      h(
        'div',
        { className: 'wb-row', style: { gap: 9, color: T.text2, padding: '10px 0' } },
        h(Spinner, { size: 16 }),
        h('span', null, '正在读取今日简报…'),
      ),
    )
  }

  const counts = WB.taskCounts(data)
  const tasks = Array.isArray(data.tasks) ? data.tasks : []
  const actionableAll = dashActionable(data)
  const shownTasks = actionableAll.slice(0, 8)
  const settings = data.settings || {}
  const topics = Array.isArray(settings.topics) ? settings.topics : []
  const radarItems = Array.isArray(data.radar) ? data.radar : []
  const connectors = Array.isArray(data.connectors) ? data.connectors : []
  const stale = dashStaleInfo(data)
  const overdueSince = dashEarliestOverdue(data)

  const topicKeys = topics.map(function (topic) {
    return String(topic).toLowerCase()
  })
  const radarRestricted = !radarAll && topicKeys.length > 0
  const radarSorted = radarItems
    .filter(function (item) {
      if (!radarRestricted) return true
      const itemTopics = Array.isArray(item.topics) ? item.topics : []
      return itemTopics.some(function (topic) {
        return topicKeys.indexOf(String(topic).toLowerCase()) >= 0
      })
    })
    .slice()
    .sort(function (a, b) {
      const diff = dashRadarTimeValue(b) - dashRadarTimeValue(a)
      if (diff !== 0) return diff
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    })
  const radarVisible = radarShowAll ? radarSorted : radarSorted.slice(0, 6)

  function reload() {
    WB.actions.reload().catch(function () {})
  }

  function goTasks(preset) {
    dashStoreNavigate(preset)
  }

  const statCards = [
    h(Stat, {
      key: 'open',
      label: '待处理',
      value: counts.open,
      sub: '共 ' + counts.total + ' 条待办',
      icon: 'tasks',
      tone: 'accent',
      onClick: function () {
        goTasks({ status: 'open' })
      },
    }),
    h(Stat, {
      key: 'today',
      label: '今日到期',
      value: counts.today,
      sub: '截止到今天 23:59',
      icon: 'calendar',
      tone: counts.today > 0 ? 'warn' : undefined,
      onClick: function () {
        goTasks({ dueFilter: 'today' })
      },
    }),
    h(Stat, {
      key: 'overdue',
      label: '已逾期',
      value: counts.overdue,
      sub: overdueSince ? '最早一条' + WB.fmt.due(overdueSince).text : '没有逾期任务',
      icon: 'alert',
      tone: counts.overdue > 0 ? 'err' : undefined,
      onClick: function () {
        goTasks({ dueFilter: 'overdue' })
      },
    }),
    h(Stat, {
      key: 'running',
      label: '执行中',
      value: counts.running,
      sub: counts.running > 0 ? '含等待审批的 Agent 执行' : '当前没有执行中的任务',
      icon: 'zap',
      tone: counts.running > 0 ? 'ok' : undefined,
      onClick: function () {
        goTasks({ status: 'running' })
      },
    }),
  ]

  // 云之家 @我 来源：上次拉取新增了来源证据时给一条可点的横条（§3.2 的确定性采集）
  const lastMentions = data && data.lastMentionsFetch ? data.lastMentionsFetch : null
  const newMentions = lastMentions && lastMentions.added > 0
    ? (data.sources || []).filter(function (row) {
        return row.provider === 'yunzhijia'
      }).slice(-lastMentions.added)
    : []

  function runMentionsFetch() {
    if (mentionsBusy) return
    setMentionsBusy(true)
    WB.actions
      .fetchMentions()
      .then(function () {
        setMentionsBusy(false)
      })
      .catch(function () {
        setMentionsBusy(false)
      })
  }

  const mentionsStrip = !lastMentions
    ? null
    : h(
        'div',
        {
          className:
            'wb-banner' +
            (lastMentions.status === 'ok' ? (newMentions.length > 0 ? '' : ' wb-banner--ok') : lastMentions.status === 'unauthorized' ? ' wb-banner--warn' : ' wb-banner--err'),
          style: { marginBottom: 16 },
        },
        h('span', { className: 'wb-banner-icon' }, h(Icon, { name: newMentions.length > 0 ? 'link' : 'checkCircle', size: 15 })),
        h(
          'div',
          { className: 'wb-banner-main' },
          h(
            'div',
            { className: 'wb-banner-title' },
            newMentions.length > 0
              ? '云之家：' + newMentions.length + ' 条 @我 待处理'
              : lastMentions.status === 'ok'
                ? '云之家 @我 已是最新'
                : '云之家 @我 拉取未完成',
          ),
          h(
            'div',
            { className: 'wb-banner-sub' },
            newMentions.length > 0
              ? newMentions
                  .slice(0, 2)
                  .map(function (row) {
                    return '「' + WB.util.truncate(row.excerpt || row.title, 42) + '」'
                  })
                  .join('　')
              : lastMentions.status === 'ok'
                ? '发现 ' + (lastMentions.found || 0) + ' 条，本次没有新增' + (lastMentions.user ? ' · 以 ' + lastMentions.user + ' 身份检索' : '')
                : lastMentions.note || lastMentions.status,
          ),
        ),
        h(
          'div',
          { className: 'wb-banner-actions' },
          newMentions.length > 0
            ? h(Btn, {
                size: 'sm',
                kind: 'primary',
                icon: 'tasks',
                onClick: function () {
                  WB.openTaskForm(null, {
                    title: '处理：' + WB.util.truncate(newMentions[0].excerpt || newMentions[0].title, 60),
                    description: [newMentions[0].title, newMentions[0].excerpt].filter(Boolean).join('\n'),
                  })
                },
                children: '转成待办',
              })
            : null,
          h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'refresh',
            disabled: mentionsBusy,
            onClick: runMentionsFetch,
            children: mentionsBusy ? '拉取中…' : '再拉一次',
          }),
        ),
      )

  const taskPanel = h(
    Panel,
    {
      icon: 'checkCircle',
      title: '今日待办',
      // 完全没有任务时隐藏副标题，空态保持干净（与右侧一致）
      sub: tasks.length === 0 ? null : actionableAll.length > 0
          ? '逾期、今日到期与高优先级，共 ' + actionableAll.length + ' 条'
          : '按逾期、今日到期与高优先级筛选后没有待办',
      badge: actionableAll.length > 0 ? h(Badge, { tone: 'accent' }, String(actionableAll.length)) : null,
      actions: h(
        React.Fragment,
        null,
        h(Btn, {
          size: 'sm',
          kind: 'subtle',
          icon: 'tasks',
          onClick: function () {
            WB.go('tasks')
          },
          children: '任务中心',
        }),
        h(Btn, {
          size: 'sm',
          icon: 'plus',
          onClick: function () {
            WB.openTaskForm(null)
          },
          children: '新建待办',
        }),
      ),
      flush: true,
    },
    shownTasks.length > 0
      ? h(
          'div',
          { className: 'wb-list', style: { padding: '0 16px' } },
          shownTasks.map(function (task) {
            return h(DashTaskRow, { key: task.id, task: task, data: data })
          }),
        )
      : h(Empty, {
          style: { flex: '1 1 auto', justifyContent: 'center' },
          icon: tasks.length === 0 ? 'tasks' : 'checkCircle',
          title: tasks.length === 0 ? '还没有待办' : '今天没有必须处理的待办',
          hint:
            tasks.length === 0
              ? '先记下一条手动待办；接入云之家后，@ 你的消息会自动进入这里。'
              : '逾期、今日到期与高优先级任务都已清空，其余待办在任务中心。',
          action:
            tasks.length === 0
              ? h(Btn, {
                  size: 'sm',
                  icon: 'plus',
                  onClick: function () {
                    WB.openTaskForm(null)
                  },
                  children: '新建第一条待办',
                })
              : h(Btn, {
                  size: 'sm',
                  icon: 'arrowRight',
                  onClick: function () {
                    WB.go('tasks')
                  },
                  children: '查看全部待办',
                }),
        }),
    actionableAll.length > shownTasks.length
      ? h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 16px',
              borderTop: '1px solid ' + T.border1,
            },
          },
          h('span', { className: 'wb-tiny wb-muted' }, '还有 ' + (actionableAll.length - shownTasks.length) + ' 条紧急待办未展示'),
          h('div', { className: 'wb-spacer' }),
          h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'arrowRight',
            onClick: function () {
              goTasks({ status: 'open' })
            },
            children: '去任务中心',
          }),
        )
      : null,
  )

  const lastFetch = data && data.lastRadarFetch ? data.lastRadarFetch : null
  const feeds = (data && data.settings && data.settings.feeds) || []
  const staleLimitMs = ((data && data.settings && data.settings.staleHours) || 24) * 3600 * 1000
  const fetchStale =
    !lastFetch || (lastFetch.at && Date.now() - new Date(lastFetch.at).getTime() > staleLimitMs)

  function runRadarFetch() {
    if (radarFetching) return
    setRadarFetching(true)
    WB.actions
      .fetchRadar()
      .then(function () {
        setRadarFetching(false)
      })
      .catch(function () {
        setRadarFetching(false)
      })
  }

  const radarEmpty = radarItems.length === 0
  const radarStatus = lastFetch && lastFetch.at
    ? '上次抓取 ' + WB.fmt.relative(lastFetch.at) + ' · 新增 ' + (lastFetch.added || 0)
    : '还没有抓取过'
  const radarPanel = h(
    Panel,
    {
      icon: 'radar',
      title: '技术雷达',
      // 副标题承担全部状态信息（关注主题 + 抓取时间），不再塞进标题旁的徽章
      sub: radarEmpty
        ? null
        : (topics.length > 0 ? '关注主题：' + topics.join(' · ') : '全部资讯，按发布时间从新到旧') + '　·　' + radarStatus,
      badge:
        radarEmpty
          ? h(Badge, { tone: 'idle' }, '尚未抓取')
          : lastFetch && lastFetch.at && fetchStale
            ? h(Badge, { tone: 'warn' }, '数据可能过期')
            : null,
      actions: h(
        React.Fragment,
        null,
        h(Btn, {
          size: 'sm',
          kind: 'subtle',
          icon: 'refresh',
          disabled: radarFetching,
          onClick: runRadarFetch,
          title: feeds.length
            ? '抓取 ' + feeds.length + ' 个已配置的 RSS/Atom 资讯源'
            : '还没有配置资讯源，去「连接与设置 → 资讯源」添加',
          children: radarFetching ? '抓取中…' : '抓取资讯',
        }),
        h(Btn, {
          size: 'sm',
          kind: 'subtle',
          icon: 'plus',
          onClick: function () {
            setRadarFormOpen(true)
          },
          children: '添加资讯',
        }),
      ),
      flush: true,
    },
    // 「仅看关注主题」筛选从头部移到内容区：过滤属于内容操作，不再占用标题行
    !radarEmpty && topics.length > 0
      ? h(
          'div',
          { className: 'wb-row', style: { padding: '0 16px 8px' } },
          h(Chip, {
            active: !radarAll,
            onClick: function () {
              setRadarAll(!radarAll)
            },
            title: radarAll ? '只显示关注主题的资讯' : '暂时显示全部资讯',
            children: '仅看关注主题',
          }),
          h('div', { className: 'wb-spacer' }),
          h('span', { className: 'wb-tiny wb-muted' }, radarSorted.length + ' 条'),
        )
      : null,
    radarVisible.length > 0
      ? h(
          'div',
          { className: 'wb-list', style: { padding: '0 16px' } },
          radarVisible.map(function (item) {
            return h(DashRadarRow, {
              key: item.id,
              item: item,
              expanded: radarExpanded === item.id,
              onToggle: function () {
                setRadarExpanded(radarExpanded === item.id ? null : item.id)
              },
            })
          }),
        )
      : h(Empty, {
          style: { flex: '1 1 auto', justifyContent: 'center' },
          icon: 'radar',
          title: radarEmpty ? '技术雷达还没有内容' : '关注主题下暂无资讯',
          hint: radarEmpty
            ? '到「连接与设置 → 资讯源」添加 RSS/Atom 地址后抓取，或手动登记一条。'
            : topics.join('、') + ' 下暂无资讯。可以查看全部资讯，或在“连接与设置”里调整关注主题。',
          action: h(
            'div',
            { className: 'wb-row', style: { gap: 8, marginTop: 2 } },
            radarEmpty
              ? h(Btn, {
                  size: 'sm',
                  kind: 'primary',
                  icon: 'refresh',
                  disabled: radarFetching,
                  onClick: runRadarFetch,
                  children: radarFetching ? '抓取中…' : '抓取资讯',
                })
              : h(Btn, {
                  size: 'sm',
                  icon: 'eye',
                  onClick: function () {
                    setRadarAll(true)
                  },
                  children: '查看全部资讯',
                }),
            h(Btn, {
              size: 'sm',
              icon: 'plus',
              onClick: function () {
                setRadarFormOpen(true)
              },
              children: '手动添加资讯',
            }),
          ),
        }),
    radarSorted.length > 6
      ? h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 16px',
              borderTop: '1px solid ' + T.border1,
            },
          },
          h(
            'span',
            { className: 'wb-tiny wb-muted' },
            radarShowAll ? '已展示全部 ' + radarSorted.length + ' 条' : '还有 ' + (radarSorted.length - 6) + ' 条资讯',
          ),
          h('div', { className: 'wb-spacer' }),
          h(Btn, {
            size: 'sm',
            kind: 'subtle',
            onClick: function () {
              setRadarShowAll(!radarShowAll)
            },
            children: radarShowAll ? '收起' : '展开全部',
          }),
        )
      : null,
  )

  const connectorsPanel = h(
    Panel,
    {
      icon: 'plug',
      title: '连接状态',
      sub: '来自 Host 的连接器快照；未配置不会影响本地待办与工具',
      actions: h(Btn, {
        size: 'sm',
        kind: 'subtle',
        icon: 'settings',
        onClick: function () {
          WB.go('settings')
        },
        children: '连接与设置',
      }),
    },
    connectors.length > 0
      ? h(
          'div',
          { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 } },
          connectors.map(function (connector) {
            return h(DashConnectorCard, { key: connector.id, connector: connector })
          }),
        )
      : h(Empty, {
          icon: 'plug',
          title: '还没有连接器',
          hint: '在“连接与设置”里记录云之家 CLI、Git / GitHub、Docker 等接入方式，这里会显示授权状态与能力。',
          action: h(Btn, {
            size: 'sm',
            onClick: function () {
              WB.go('settings')
            },
            children: '去配置',
          }),
        }),
  )

  return h(
    'div',
    null,
    h(PageHead, {
      icon: 'dashboard',
      title: '今日简报',
      sub:
        '需要处理 ' +
        counts.open +
        ' 项 · 逾期 ' +
        counts.overdue +
        ' 项 · 今日到期 ' +
        counts.today +
        ' 项 · 数据更新于 ' +
        (data.updatedAt ? WB.fmt.relative(data.updatedAt) : '尚未写入'),
      actions: [
        h(Btn, {
          key: 'refresh',
          size: 'sm',
          icon: 'refresh',
          disabled: state.busy,
          onClick: reload,
          children: state.busy ? '刷新中…' : '刷新',
        }),
        // 「新建待办」主按钮只保留全局工具栏一处（用户反馈 #4：同屏三个主按钮互相打架）
      ],
    }),
    stale
      ? h(
          'div',
          { className: 'wb-banner wb-banner--warn', style: { marginBottom: 16 } },
          h('span', { className: 'wb-banner-icon' }, h(Icon, { name: 'clock', size: 15 })),
          h(
            'div',
            { className: 'wb-banner-main' },
            h('div', { className: 'wb-banner-title' }, '数据可能过期'),
            h(
              'div',
              { className: 'wb-banner-sub' },
              'Host 快照已 ' + WB.fmt.relative(stale.updatedAt) + ' 未刷新（陈旧阈值 ' + stale.staleHours + ' 小时），任务与资讯可能不是最新。',
            ),
          ),
          h(
            'div',
            { className: 'wb-banner-actions' },
            h(Btn, {
              size: 'sm',
              kind: 'subtle',
              icon: 'refresh',
              disabled: state.busy,
              onClick: reload,
              children: '立即刷新',
            }),
          ),
        )
      : null,
    mentionsStrip,
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 } }, statCards),
    h('div', { className: 'wb-split', style: { marginBottom: 16 } }, taskPanel, radarPanel),
    connectorsPanel,
    h(DashRadarModal, {
      open: radarFormOpen,
      onClose: function () {
        setRadarFormOpen(false)
      },
    }),
  )
}

WB.pages.dashboard = DashboardPage
