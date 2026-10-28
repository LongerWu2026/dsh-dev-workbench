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

/** 回复阶段的展示色。 */
function replyStageTone(stage) {
  if (stage === '已实质答复') return 'ok'
  if (stage === '待答复') return 'warn'
  return 'idle'
}

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
      h(IconBtn, {
        name: 'sparkles',
        label: 'AI 分析这条待办（带上下文进入会话）',
        onClick: function () {
          WB.assistant.add({
            kind: 'task',
            id: task.id,
            title: task.title,
            body: [task.description, '状态：' + task.status + ' · 优先级：' + task.priority].filter(Boolean).join('\n'),
          })
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
          published
            ? h('span', { className: 'wb-muted' }, WB.fmt.date(published))
            : h(
                'span',
                { className: 'wb-muted', title: '原文未注明发布时间；抓取于 ' + (item.fetchedAt ? WB.fmt.datetime(item.fetchedAt) : '') + '，不以抓取时间冒充' },
                '日期未注明（抓取于 ' + (item.fetchedAt ? WB.fmt.relative(item.fetchedAt) : '最近') + '）',
              ),
          topics.map(function (topic, index) {
            return dashTagPill(topic, 'topic:' + topic + ':' + index)
          }),
        ),
      ),
      h(
        'div',
        { className: 'wb-item-actions', style: { opacity: 1 } },
        h(DashRadarMenu, {
        item: item,
        saving: saving,
        makingTask: makingTask,
        onSave: saveToKnowledge,
        onMakeTask: makePracticeTask,
        onEdit: props.onEdit,
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

/** 雷达行的操作收进单个「⋯」向上菜单，窄列里不再把标题挤成竖字。 */
function DashRadarMenu(props) {
  const item = props.item
  const [open, setOpen] = React.useState(false)
  const entries = [
    {
      key: 'save',
      icon: 'book',
      label: props.saving ? '收藏中…' : '收藏到知识空间',
      disabled: props.saving,
      run: props.onSave,
    },
    {
      key: 'task',
      icon: 'play',
      label: props.makingTask ? '生成中…' : '生成实践任务',
      disabled: props.makingTask,
      run: props.onMakeTask,
    },
    {
      key: 'summarize',
      icon: 'book',
      label: '生成四段摘要',
      run: function () {
        WB.actions.radarSummarize([item.id]).then(function (result) {
          WB.toast(result.failed > 0 ? '摘要：成功 ' + result.done + ' / 失败 ' + result.failed : result.done > 0 ? '已生成四段摘要' : (result.note || '无需生成'), result.failed > 0 ? 'warn' : 'ok')
        }).catch(function () {})
      },
    },
    { key: 'edit', icon: 'edit', label: '编辑四段摘要', run: props.onEdit },
    {
      key: 'delete',
      icon: 'trash',
      label: '删除这条资讯',
      run: function () {
        if (!window.confirm('删除这条资讯？')) return
        WB.actions.deleteRadarItem(item.id).catch(function () {})
      },
    },
    {
      key: 'ai',
      icon: 'sparkles',
      label: 'AI 分析（带上下文）',
      run: function () {
        WB.assistant.add({
          kind: 'radar',
          id: item.id,
          title: item.title,
          url: item.url || null,
          body: item.excerpt || '',
        })
      },
    },
  ]
  return h(
    'div',
    { style: { position: 'relative', flex: 'none', zIndex: open ? 30 : undefined } },
    open
      ? h(
          'div',
          {
            style: {
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              minWidth: 152,
              padding: 4,
              border: '1px solid ' + T.border1,
              borderRadius: 9,
              background: T.layer1,
              boxShadow: '0 8px 22px rgba(0,0,0,.32)',
            },
          },
          entries.map(function (entry) {
            return h(
              'button',
              {
                key: entry.key,
                type: 'button',
                disabled: !!entry.disabled,
                onClick: function () {
                  setOpen(false)
                  entry.run()
                },
                style: {
                  appearance: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  width: '100%',
                  textAlign: 'left',
                  border: 0,
                  borderRadius: 6,
                  background: 'transparent',
                  color: T.text,
                  font: 'inherit',
                  fontSize: 11.5,
                  lineHeight: 1.7,
                  padding: '3px 7px',
                  cursor: entry.disabled ? 'default' : 'pointer',
                  opacity: entry.disabled ? 0.55 : 1,
                },
              },
              h(Icon, { name: entry.icon, size: 11 }),
              entry.label,
            )
          }),
        )
      : null,
    h(IconBtn, {
      name: 'more',
      label: '这条资讯的操作',
      active: open,
      onClick: function () {
        setOpen(!open)
      },
    }),
  )
}

function DashRadarModal(props) {
  const editing = props.item || null
  const [title, setTitle] = React.useState('')
  const [source, setSource] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [publishedAt, setPublishedAt] = React.useState('')
  const [topics, setTopics] = React.useState('')
  const [change, setChange] = React.useState('')
  const [usage, setUsage] = React.useState('')
  const [risk, setRisk] = React.useState('')
  const [practice, setPractice] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(null)

  React.useEffect(
    function () {
      if (!props.open) return
      const item = props.item || null
      const summary = (item && item.summary) || {}
      setTitle(item ? item.title || '' : '')
      setSource(item ? item.source || '' : '')
      setUrl(item ? item.url || '' : '')
      setPublishedAt(item && item.publishedAt ? String(item.publishedAt).slice(0, 10) : '')
      setTopics(item && Array.isArray(item.topics) ? item.topics.join(', ') : '')
      setChange(summary.change || '')
      setUsage(summary.usage || '')
      setRisk(summary.risk || '')
      setPractice(summary.practice || '')
      setBusy(false)
      setError(null)
    },
    [props.open, props.item],
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
    const payload = {
      title: trimmedTitle,
      source: source.trim() || (editing ? editing.source : 'manual'),
      url: trimmedUrl || null,
      publishedAt: publishedIso,
      topics: topics
        .split(/[,，\s]+/)
        .map(function (topic) {
          return topic.trim()
        })
        .filter(Boolean),
      summary: {
        change: change.trim(),
        usage: usage.trim(),
        risk: risk.trim(),
        practice: practice.trim(),
      },
    }
    if (editing) payload.id = editing.id
    WB.actions
      .saveRadarItem(payload)
      .then(function () {
        setBusy(false)
        WB.toast(editing ? '资讯已更新' : '资讯已添加到技术雷达', 'ok')
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
      title: editing ? '编辑资讯' : '手动添加资讯',
      sub: editing
        ? '补全四段摘要后，雷达卡片会展示结构化结论；摘要内容仍由你或 Agent 负责事实准确性'
        : '登记的资讯会和采集来源一起进入技术雷达',
      onClose: props.onClose,
      width: 580,
      footer: h(
        React.Fragment,
        null,
        h(Btn, { onClick: props.onClose, disabled: busy, children: '取消' }),
        h('div', { className: 'wb-spacer' }),
        h(Btn, {
          kind: 'primary',
          icon: 'check',
          disabled: busy,
          onClick: submit,
          children: busy ? '保存中…' : editing ? '保存修改' : '添加资讯',
        }),
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
      h(Field, { label: '链接' }, h(Input, {
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
      h(Divider),
      h(
        'div',
        { className: 'wb-label', style: { marginBottom: -2 } },
        '四段摘要（可留空；抓取来的资讯只有原文摘录）',
      ),
      h(
        'div',
        { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
        h(Field, { label: '技术变化' }, h(Textarea, {
          value: change,
          rows: 2,
          placeholder: '这次变化的关键事实是什么？',
          onChange: function (event) {
            setChange(event.target.value)
          },
        })),
        h(Field, { label: '应用场景' }, h(Textarea, {
          value: usage,
          rows: 2,
          placeholder: '适合在什么场景使用？',
          onChange: function (event) {
            setUsage(event.target.value)
          },
        })),
        h(Field, { label: '采用风险' }, h(Textarea, {
          value: risk,
          rows: 2,
          placeholder: '引入后可能踩什么坑？',
          onChange: function (event) {
            setRisk(event.target.value)
          },
        })),
        h(Field, { label: '推荐实践' }, h(Textarea, {
          value: practice,
          rows: 2,
          placeholder: '建议怎么落地？',
          onChange: function (event) {
            setPractice(event.target.value)
          },
        })),
      ),
      error ? h('div', { role: 'alert', style: { color: T.err, fontSize: 12 } }, error) : null,
      h('button', { type: 'submit', style: { display: 'none' } }),
    ),
  )
}

/* ---------------------------------------------------------------- 番茄钟 */
/** 今日待办空态插画：清单 + 勾选 + 时钟，纯 SVG 跟随主题变量。 */
function DashEmptyIllustration() {
  return h(
    'svg',
    {
      width: 132,
      height: 96,
      viewBox: '0 0 132 96',
      fill: 'none',
      'aria-hidden': 'true',
      style: { opacity: 0.9 },
    },
    // 清单卡片
    h('rect', { x: 26, y: 10, width: 62, height: 74, rx: 9, fill: 'var(--dsw-alias-bg-layer-2)' }),
    h('rect', { x: 26, y: 10, width: 62, height: 74, rx: 9, stroke: 'var(--dsw-alias-border-l1)' }),
    // 三条待办行
    [0, 1, 2].map(function (row) {
      const y = 26 + row * 18
      return h(
        'g',
        { key: 'row' + row },
        h('rect', { x: 34, y: y, width: 10, height: 10, rx: 3, stroke: row === 0 ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l2)', strokeWidth: 1.4 }),
        row === 0
          ? h('path', { d: 'M36.5 ' + (y + 5.2) + ' l2.4 2.6 l4.4 -5', stroke: 'var(--dsw-alias-brand-primary)', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' })
          : null,
        h('rect', { x: 50, y: y + 2.5, width: row === 2 ? 24 : 30, height: 5, rx: 2.5, fill: 'var(--dsw-alias-border-l2)' }),
      )
    }),
    // 右下角时钟
    h('circle', { cx: 100, cy: 66, r: 20, fill: 'var(--dsw-alias-bg-layer-1)', stroke: 'var(--dsw-alias-border-l1)' }),
    h('circle', { cx: 100, cy: 66, r: 20, stroke: 'var(--dsw-alias-brand-primary)', strokeOpacity: 0.35 }),
    h('path', { d: 'M100 55 v11 l8 5', stroke: 'var(--dsw-alias-label-secondary)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    // 左上角星点
    h('path', { d: 'M14 22 l2.2 4.6 l4.8 0.7 l-3.5 3.4 l0.8 4.8 l-4.3 -2.3 l-4.3 2.3 l0.8 -4.8 l-3.5 -3.4 l4.8 -0.7 z', fill: 'var(--dsw-alias-brand-primary)', fillOpacity: 0.5 }),
    h('circle', { cx: 112, cy: 18, r: 3, fill: 'var(--dsw-alias-brand-primary)', fillOpacity: 0.35 }),
  )
}

/** 空态里的三步引导行。 */
function DashEmptyStep(props) {
  return h(
    'div',
    { style: { display: 'flex', alignItems: 'flex-start', gap: 9, textAlign: 'left', maxWidth: 300 } },
    h(
      'span',
      {
        style: {
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
          width: 22,
          height: 22,
          borderRadius: 999,
          background: 'var(--dsw-alias-bg-layer-2)',
          color: 'var(--dsw-alias-brand-primary)',
          fontSize: 11,
          fontWeight: 700,
        },
      },
      String(props.index),
    ),
    h(
      'div',
      { style: { fontSize: 11.5, lineHeight: 1.65, color: 'var(--dsw-alias-label-secondary)' } },
      h('div', { style: { color: 'var(--dsw-alias-label-primary)', fontWeight: 600 } }, props.title),
      props.hint,
    ),
  )
}

function DashPomodoro() {
  const FOCUS = 25 * 60
  const [left, setLeft] = React.useState(FOCUS)
  const [running, setRunning] = React.useState(false)

  React.useEffect(
    function () {
      if (!running) return undefined
      const timer = setInterval(function () {
        setLeft(function (previous) {
          if (previous <= 1) {
            setRunning(false)
            WB.toast('番茄钟结束，休息一下', 'ok')
            return FOCUS
          }
          return previous - 1
        })
      }, 1000)
      return function () {
        clearInterval(timer)
      }
    },
    [running],
  )

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

  return h(
    'div',
    { className: 'wb-row', style: { gap: 8, padding: '9px 12px', border: '1px solid ' + T.border1, borderRadius: 10 } },
    h(Icon, { name: 'clock', size: 14 }),
    h('span', { className: 'wb-label', style: { margin: 0 } }, '专注'),
    h('span', { className: 'wb-mono', style: { fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' } }, mm + ':' + ss),
    h('div', { className: 'wb-spacer' }),
    h(Btn, {
      size: 'sm',
      kind: running ? 'ghost' : 'primary',
      icon: running ? 'close' : 'play',
      onClick: function () {
        setRunning(!running)
      },
      children: running ? '暂停' : '开始',
    }),
    h(Btn, {
      size: 'sm',
      kind: 'subtle',
      icon: 'refresh',
      onClick: function () {
        setRunning(false)
        setLeft(FOCUS)
      },
      children: '重置',
    }),
  )
}

/** 今日简报 → Markdown，复制到剪贴板（不落盘、不联网）。 */
function dashBriefMarkdown(data) {
  const counts = WB.taskCounts(data)
  const lines = []
  lines.push('# 今日简报 · ' + WB.fmt.date(new Date().toISOString()))
  lines.push('')
  lines.push('## 概览')
  lines.push('- 待处理 ' + counts.open + ' · 今日到期 ' + counts.today + ' · 已逾期 ' + counts.overdue + ' · 执行中 ' + counts.running)
  const mentions = (data.sources || []).filter(function (row) {
    return String(row.externalId || '').indexOf('yzj:msg:') === 0
  })
  if (mentions.length > 0) {
    lines.push('')
    lines.push('## 云之家 @我（' + mentions.length + '）')
    mentions.slice(-5).forEach(function (row) {
      lines.push('- ' + WB.util.truncate(row.excerpt || row.title, 100) + (row.sender ? ' —— ' + row.sender : ''))
    })
  }
  const tasks = WB.openTasks(data).slice(0, 8)
  if (tasks.length > 0) {
    lines.push('')
    lines.push('## 待办（' + tasks.length + '）')
    tasks.forEach(function (task) {
      const due = task.dueAt ? '（截止 ' + WB.fmt.day(task.dueAt) + '）' : ''
      lines.push('- [' + (WB.TASK_STATUS[task.status] || {}).label + '] ' + task.title + due)
    })
  }
  const radar = (data.radar || []).slice(-5).reverse()
  if (radar.length > 0) {
    lines.push('')
    lines.push('## 技术雷达（最近 ' + radar.length + ' 条）')
    radar.forEach(function (item) {
      lines.push('- ' + item.title + (item.url ? ' — ' + item.url : ''))
    })
  }
  const pending = (data.candidates || []).filter(function (c) {
    return c && c.status === 'pending'
  })
  if (pending.length > 0) {
    lines.push('')
    lines.push('## 待确认候选（' + pending.length + '）')
    pending.slice(0, 5).forEach(function (c) {
      lines.push('- ' + c.title + '（置信度 ' + Math.round((c.confidence || 0) * 100) + '%）')
    })
  }
  return lines.join('\n')
}

function DashboardPage() {
  const state = WB.useStore()
  const data = state.data
  const [radarAll, setRadarAll] = React.useState(false)
  const [radarShowAll, setRadarShowAll] = React.useState(false)
  const [radarExpanded, setRadarExpanded] = React.useState(null)
  const [radarFormOpen, setRadarFormOpen] = React.useState(false)
  const [radarEditItem, setRadarEditItem] = React.useState(null)
  const [radarFetching, setRadarFetching] = React.useState(false)
  const [mentionsBusy, setMentionsBusy] = React.useState(false)
  const [quickMore, setQuickMore] = React.useState(false)
  // TODO 22：AI 识别状态一块看全（待确认/失败/计数），上轮摘要状态也在这里
  const [analysis, setAnalysis] = React.useState(null)

  React.useEffect(
    function () {
      WB.actions
        .analysisStatus()
        .then(function (status) {
          setAnalysis(status)
        })
        .catch(function () {})
    },
    [],
  )

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

  // 指标条：四个数字合并成一行紧凑标签，把纵向空间留给待办列表
  const statStrip = h(
    'div',
    {
      className: 'wb-card wb-col-span-2',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        padding: '7px 12px',
        marginBottom: 12,
      },
    },
    h('span', { className: 'wb-row', style: { gap: 5, color: T.text2 } }, h(Icon, { name: 'tasks', size: 12 }), h('span', { className: 'wb-tiny', style: { fontWeight: 600, color: T.text } }, '今日待办')),
    h(Chip, {
      active: counts.open > 0,
      onClick: function () {
        goTasks({ status: 'open' })
      },
      title: '查看全部未完成',
      children: '待处理 ' + counts.open,
    }),
    h(Chip, {
      active: counts.today > 0,
      onClick: function () {
        goTasks({ dueFilter: 'today' })
      },
      title: '查看今日到期',
      children: '今日到期 ' + counts.today,
    }),
    h(Chip, {
      active: counts.overdue > 0,
      tone: counts.overdue > 0 ? 'err' : undefined,
      onClick: function () {
        goTasks({ dueFilter: 'overdue' })
      },
      title: overdueSince ? '最早一条' + WB.fmt.due(overdueSince).text : '没有逾期任务',
      children: '已逾期 ' + counts.overdue,
    }),
    h(Chip, {
      active: counts.running > 0,
      onClick: function () {
        goTasks({ status: 'running' })
      },
      title: '查看执行中的任务',
      children: '执行中 ' + counts.running,
    }),
    h('div', { className: 'wb-spacer' }),
    h(Btn, {
      size: 'sm',
      kind: 'subtle',
      icon: 'arrowRight',
      onClick: function () {
        WB.go('tasks')
      },
      children: '任务中心',
    }),
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
          style: { border: '1px solid ' + T.border1 },
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
      : h(
          'div',
          {
            style: {
              flex: '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              padding: '22px 18px 20px',
              minHeight: 210,
            },
          },
          h(DashEmptyIllustration, null),
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' } },
            h('strong', { style: { fontSize: 13.5, color: 'var(--dsw-alias-label-primary)' } }, tasks.length === 0 ? '还没有待办' : '今天没有必须处理的待办'),
            h(
              'p',
              { style: { margin: 0, fontSize: 11.5, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)', maxWidth: 320 } },
              tasks.length === 0
                ? '待办可以手动记，也可以从消息、资讯、会话里一键生成。'
                : '逾期、今日到期与高优先级都已清空，其余待办在任务中心。',
            ),
          ),
          tasks.length === 0
            ? h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'center' } },
                h(DashEmptyStep, { index: 1, title: '记一条手动待办', hint: '标题 + 截止时间即可，之后可补项目与标签。' }),
                h(DashEmptyStep, { index: 2, title: '拉取云之家 @我', hint: '被 @ 的消息会自动进入这里，可一键转成待办。' }),
                h(DashEmptyStep, { index: 3, title: '让会话帮你整理', hint: '把消息或资讯加进上下文，AI 分析后直接建待办。' }),
              )
            : null,
          h(
            'div',
            { className: 'wb-row', style: { gap: 8, marginTop: 2 } },
            tasks.length === 0
              ? h(Btn, {
                  size: 'sm',
                  kind: 'primary',
                  icon: 'plus',
                  onClick: function () {
                    WB.openTaskForm(null)
                  },
                  children: '新建第一条待办',
                })
              : h(Btn, {
                  size: 'sm',
                  kind: 'primary',
                  icon: 'arrowRight',
                  onClick: function () {
                    WB.go('tasks')
                  },
                  children: '查看全部待办',
                }),
            h(Btn, {
              size: 'sm',
              kind: 'subtle',
              icon: 'sparkles',
              onClick: runMentionsFetch,
              disabled: mentionsBusy,
              children: mentionsBusy ? '拉取中…' : '拉取 @我 消息',
            }),
          ),
        ),
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
  const radarStatusBase = lastFetch && lastFetch.at
    ? '上次抓取 ' + WB.fmt.relative(lastFetch.at) + ' · 新增 ' + (lastFetch.added || 0)
    : '还没有抓取过'
  // TODO 22：上轮摘要统计与失败原因一并展示（不隐藏失败）
  const lastSum = data && data.lastRadarSummarize ? data.lastRadarSummarize : null
  const summarizeStatus = lastSum && lastSum.at
    ? lastSum.failed > 0
      ? ' · 摘要：成功 ' + lastSum.done + ' / 失败 ' + lastSum.failed + ((lastSum.note ? '（' + lastSum.note + '）' : ''))
      : ' · 摘要：成功 ' + lastSum.done
    : ''
  const radarStatus = radarStatusBase + summarizeStatus
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
            setRadarEditItem(null)
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
              onEdit: function () {
                setRadarEditItem(item)
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
                setRadarEditItem(null)
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

  // ---- 待回复面板（TODO 16 可见性）：常驻，AI 判定的需回复事项在这里跟踪推进
  const replyTasks = tasks
    .filter(function (task) {
      return task.needsReply === true
    })
    .sort(function (left, right) {
      const leftAt = left.dueAt ? new Date(left.dueAt).getTime() : Infinity
      const rightAt = right.dueAt ? new Date(right.dueAt).getTime() : Infinity
      return leftAt - rightAt
    })
  const stageChips = [
    { id: '已确认收到', hint: '已回应对方，事项本身待交付' },
    { id: '已实质答复', hint: '已给出实质交付/答复' },
    { id: '不需答复', hint: '无需回复（例：对方自行解决）' },
  ]
  const replyPanel = h(
    Panel,
    {
      icon: 'link',
      title: '待回复',
      sub:
        replyTasks.length > 0
          ? ' click 点击阶段 chip 推进；或到任务中心筛选与手动标记'
          : null,
      badge: replyTasks.length > 0 ? h(Badge, { tone: 'warn' }, String(replyTasks.length)) : null,
      actions: h(Btn, {
        size: 'sm',
        kind: 'subtle',
        icon: 'tasks',
        onClick: function () {
          dashStoreNavigate({ status: 'open' })
          setTimeout(function () {
            if (WB.go) WB.go('tasks')
          }, 0)
        },
        children: '到任务中心',
      }),
    },
    replyTasks.length === 0
      ? h(Empty, {
          icon: 'tasks',
          title: '没有待回复的事项',
          hint: 'AI 识别判定的需回复事项会在这里跟踪；也可在新建/编辑待办时打开「待回复」手动标记。',
        })
      : h(
          'div',
          { className: 'wb-list' },
          replyTasks.slice(0, 6).map(function (task) {
            return h(
              'div',
              { key: task.id, className: 'wb-item' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'wb-item-main',
                  style: { background: 'transparent', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' },
                  onClick: function () {
                    WB.focusTask(task.id)
                  },
                },
                h('div', { className: 'wb-item-title' }, task.title),
                h(
                  'div',
                  { className: 'wb-item-sub' },
                  task.replyStage || '待标记',
                  task.dueAt ? ' · ' + WB.fmt.due(task.dueAt).text : '',
                ),
              ),
              h(
                'div',
                { className: 'wb-row', style: { gap: 5, flex: 'none' } },
                stageChips.map(function (chip) {
                  return h(Chip, {
                    key: chip.id,
                    active: task.replyStage === chip.id,
                    title: chip.hint,
                    onClick: function () {
                      WB.actions.setReplyStage(task.id, chip.id).catch(function () {})
                    },
                    children: chip.id,
                  })
                }),
              ),
            )
          }),
        ),
  )

  // ---- 快捷操作：把高频入口与本地小工具收在一张卡里（§2.1 首页应有快捷操作）
  const quickActionsPanel = h(
    Panel,
    {
      icon: 'zap',
      title: '快捷操作',
      sub: '高频入口；番茄钟与日报都在本地完成，不联网',
      actions: h(Btn, {
        size: 'sm',
        kind: 'subtle',
        icon: 'copy',
        onClick: function () {
          WB.util
            .copy(dashBriefMarkdown(data))
            .then(function () {
              WB.toast('今日简报已复制为 Markdown', 'ok')
            })
            .catch(function (error) {
              WB.toast(String((error && error.message) || error), 'err')
            })
        },
        children: '复制今日简报',
      }),
    },
    h(
      'div',
      { className: 'wb-stack', style: { gap: 10 } },
      // 一个图标按钮，菜单向上展开（不并排堆按钮）
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 } },
        quickMore
          ? h(
              'div',
              {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  minWidth: 168,
                  padding: 4,
                  border: '1px solid ' + T.border1,
                  borderRadius: 10,
                  background: T.layer1,
                },
              },
              [
                { key: 'new', icon: 'plus', label: '新建待办', run: function () { WB.openTaskForm(null) } },
                { key: 'search', icon: 'search', label: '搜索', run: function () { WB.go('search') } },
                { key: 'toolbox', icon: 'toolbox', label: '开发工具箱', run: function () { WB.go('toolbox') } },
                { key: 'agents', icon: 'agent', label: 'Agent 中心', run: function () { WB.go('agents') } },
                { key: 'mentions', icon: 'sparkles', label: mentionsBusy ? '拉取 @我…' : '拉取 @我', run: runMentionsFetch, disabled: mentionsBusy },
                { key: 'radar', icon: 'refresh', label: radarFetching ? '抓取中…' : '抓取资讯', run: runRadarFetch, disabled: radarFetching },
                { key: 'aiextract', icon: 'sparkles', label: '运行 AI 分析', run: function () { WB.actions.analyzeRun(8) } },
    { key: 'radarsum', icon: 'book', label: '生成资讯摘要', run: function () { WB.actions.radarSummarize([]) } },
              ].map(function (item) {
                return h(
                  'button',
                  {
                    key: item.key,
                    type: 'button',
                    disabled: !!item.disabled,
                    onClick: function () {
                      setQuickMore(false)
                      item.run()
                    },
                    style: {
                      appearance: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      width: '100%',
                      textAlign: 'left',
                      border: 0,
                      borderRadius: 7,
                      background: 'transparent',
                      color: T.text,
                      font: 'inherit',
                      fontSize: 12,
                      lineHeight: 1.7,
                      padding: '4px 8px',
                      cursor: item.disabled ? 'default' : 'pointer',
                      opacity: item.disabled ? 0.55 : 1,
                    },
                  },
                  h(Icon, { name: item.icon, size: 12 }),
                  item.label,
                )
              }),
            )
          : null,
        h(IconBtn, {
          name: 'zap',
          label: '快捷操作',
          active: quickMore,
          onClick: function () {
            setQuickMore(!quickMore)
          },
        }),
      ),
      h(DashPomodoro, null),
    ),
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
    /** TODO 22：AI 识别状态面板（与自动化开关共用配置语义，展示即真实） */
    (analysis && (analysis.pending || analysis.awaitingHuman || analysis.failed || analysis.done))
      ? h(
          Panel,
          {
            icon: 'sparkles',
            title: 'AI 识别',
            sub: '采集与识别解耦；失败可重放（attempts<3 自动重试）',
            badge: analysis
              ? h(Badge, { tone: analysis.awaitingHuman > 0 ? 'warn' : analysis.failed > 0 ? 'err' : 'ok' },
                  '待识别 ' + analysis.pending + ' · 待确认 ' + analysis.awaitingHuman + ' · 失败 ' + analysis.failed + ' · 完成 ' + analysis.done)
              : null,
            actions: h(Btn, {
              size: 'sm',
              kind: 'subtle',
              icon: 'play',
              onClick: function () {
                WB.actions
                  .analyzeRun(8)
                  .then(function (result) {
                    WB.toast('AI 分析：处理 ' + (result.processed || 0) + ' / 失败 ' + (result.failures || 0), 'ok')
                    return WB.actions.analysisStatus()
                  })
                  .then(function (status) {
                    setAnalysis(status)
                  })
                  .catch(function () {})
              },
              children: '运行分析',
            }),
          },
          (analysis.awaitingHuman > 0 || analysis.failed > 0)
            ? h(
                'div',
                { className: 'wb-stack', style: { gap: 8 } },
                (analysis.entries || [])
                  .filter(function (entry) {
                    return entry.status === 'awaiting_human' || entry.status === 'failed'
                  })
                  .slice(0, 6)
                  .map(function (entry) {
                    const sourceRow = (data.sources || []).find(function (row) { return row.id === entry.sourceId })
                    return h(
                      'div',
                      { key: entry.id, className: 'wb-item' },
                      h(Badge, { tone: entry.status === 'failed' ? 'err' : 'warn' }, entry.status === 'failed' ? '失败' : '待确认'),
                      h(
                        'div',
                        { className: 'wb-item-main' },
                        h('div', { className: 'wb-item-title wb-ellipsis' }, WB.util.truncate((sourceRow && sourceRow.excerpt) || entry.msgId || entry.sourceId, 46)),
                        entry.status === 'failed'
                          ? h('div', { className: 'wb-item-sub' }, '重试第 ' + ((entry.attempts || 0) + 1) + ' 次' + (entry.lastError ? ' · ' + entry.lastError : ''))
                          : h('div', { className: 'wb-item-sub' }, (entry.analysis && entry.analysis.summary) || '已识别，待确认建档'),
                      ),
                      entry.status === 'awaiting_human'
                        ? h(Btn, {
                            size: 'sm',
                            kind: 'primary',
                            icon: 'check',
                            onClick: function () {
                              WB.actions
                                .analyzeConfirm(entry.id)
                                .then(function () {
                                  return WB.actions.analysisStatus()
                                })
                                .then(function (status) {
                                  setAnalysis(status)
                                  WB.actions.reload().catch(function () {})
                                })
                                .catch(function () {})
                            },
                            children: '确认建档',
                          })
                        : null,
                    )
                  }),
              )
            : h('p', { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.6 } },
                '没有待确认或失败条目。开启「设置 → 自动化 → AI 识别」后，抓取的消息会进入这里。'),
        )
      : null,
    statStrip,
    h('div', { className: 'wb-split', style: { gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', marginBottom: 16 } }, taskPanel, radarPanel),
    replyPanel,
    h('div', { style: { marginBottom: 16 } }, quickActionsPanel),
    connectorsPanel,
    h(DashRadarModal, {
      open: radarFormOpen,
      item: radarEditItem,
      onClose: function () {
        setRadarFormOpen(false)
        setRadarEditItem(null)
      },
    }),
  )
}

WB.pages.dashboard = DashboardPage
