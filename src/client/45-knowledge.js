/* ============================================================================
 * dev-workbench page: Knowledge space
 *
 * Bookmarks, notes and snippets that the Host persists. Filtering is fully
 * local (type / tag / free text); create and delete go through the Host so the
 * result survives a restart. Registers `WB.pages.knowledge`.
 * ========================================================================== */

const knowKindMeta = {
  bookmark: { label: '收藏', tone: 'accent', icon: 'link' },
  note: { label: '笔记', tone: 'ok', icon: 'book' },
  snippet: { label: '片段', tone: 'warn', icon: 'command' },
}

function knowKindOf(kind) {
  return knowKindMeta[kind] || { label: kind ? String(kind) : '未知类型', tone: 'idle', icon: 'layers' }
}

function knowSearchBlob(item) {
  if (!item) return ''
  const tags = Array.isArray(item.tags) ? item.tags.join(' ') : ''
  return [item.title, item.body, item.url, tags]
    .filter(function (part) {
      return !!part
    })
    .join('\n')
    .toLowerCase()
}

function knowTagList(items) {
  const counts = {}
  ;(items || []).forEach(function (item) {
    const tags = item && Array.isArray(item.tags) ? item.tags : []
    tags.forEach(function (tag) {
      const key = String(tag).trim()
      if (!key) return
      counts[key] = (counts[key] || 0) + 1
    })
  })
  return Object.keys(counts)
    .map(function (tag) {
      return { tag: tag, count: counts[tag] }
    })
    .sort(function (a, b) {
      if (a.count !== b.count) return b.count - a.count
      return a.tag.localeCompare(b.tag)
    })
}

function knowCopyText(item) {
  const lines = []
  if (item.title) lines.push(item.title)
  if (item.url) lines.push(item.url)
  if (item.body) {
    lines.push('')
    lines.push(String(item.body))
  }
  if (Array.isArray(item.tags) && item.tags.length) {
    lines.push('')
    lines.push(item.tags.map(function (tag) {
      return '#' + tag
    }).join(' '))
  }
  return lines.join('\n')
}

function knowSortItems(items) {
  return (items || []).slice().sort(function (a, b) {
    const av = a && a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bv = b && b.createdAt ? new Date(b.createdAt).getTime() : 0
    const left = Number.isNaN(av) ? 0 : av
    const right = Number.isNaN(bv) ? 0 : bv
    return right - left
  })
}

function knowPage() {
  const wbState = WB.useStore()
  const data = wbState && wbState.data ? wbState.data : null
  const items = data && Array.isArray(data.knowledge) ? data.knowledge : []

  const [kind, setKind] = React.useState('all')
  const [query, setQuery] = React.useState('')
  const [tag, setTag] = React.useState('')
  const [createOpen, setCreateOpen] = React.useState(false)
  const [formError, setFormError] = React.useState('')
  const [form, setForm] = React.useState(function () {
    return { kind: 'note', title: '', url: '', body: '', tags: '' }
  })
  const [confirmItem, setConfirmItem] = React.useState(null)
  const [editItem, setEditItem] = React.useState(null)

  const counts = { all: items.length, bookmark: 0, note: 0, snippet: 0 }
  items.forEach(function (item) {
    if (item && counts[item.kind] !== undefined) counts[item.kind] += 1
  })
  const tabs = [
    { value: 'all', label: '全部', count: counts.all },
    { value: 'bookmark', label: knowKindMeta.bookmark.label, count: counts.bookmark },
    { value: 'note', label: knowKindMeta.note.label, count: counts.note },
    { value: 'snippet', label: knowKindMeta.snippet.label, count: counts.snippet },
  ]

  const needle = query.trim().toLowerCase()
  const filtered = knowSortItems(
    items.filter(function (item) {
      if (!item) return false
      if (kind !== 'all' && item.kind !== kind) return false
      if (tag && !(Array.isArray(item.tags) && item.tags.indexOf(tag) >= 0)) return false
      if (needle && knowSearchBlob(item).indexOf(needle) < 0) return false
      return true
    }),
  )
  const allTags = knowTagList(items)

  function patchForm(patch) {
    setForm(function (previous) {
      return Object.assign({}, previous, patch)
    })
  }

  function openCreate() {
    setEditItem(null)
    setForm({ kind: 'note', title: '', url: '', body: '', tags: '' })
    setFormError('')
    setCreateOpen(true)
  }

  function openEdit(item) {
    if (!item) return
    setEditItem(item)
    setForm({
      kind: item.kind || 'note',
      title: item.title || '',
      url: item.url || '',
      body: item.body || '',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    })
    setFormError('')
    setCreateOpen(true)
  }

  function closeCreate() {
    setCreateOpen(false)
    setEditItem(null)
    setFormError('')
  }

  function copyItem(item) {
    WB.util.copy(knowCopyText(item))
      .then(function () {
        WB.toast('条目内容已复制', 'ok')
      })
      .catch(function (error) {
        WB.toast(String((error && error.message) || error), 'err')
      })
  }

  function submitCreate() {
    const title = String(form.title || '').trim()
    if (!title) {
      setFormError('标题必填：一条知识至少要有可检索的标题')
      return
    }
    const input = {
      kind: form.kind,
      title: title,
      body: String(form.body || '').trim(),
      tags: String(form.tags || '')
        .split(/[,，]/)
        .map(function (part) {
          return part.trim()
        })
        .filter(function (part) {
          return part.length > 0
        }),
    }
    const url = String(form.url || '').trim()
    if (url) input.url = url
    const operation = editItem && editItem.id
      ? WB.actions.updateKnowledge(editItem.id, input)
      : WB.actions.createKnowledge(input)
    operation
      .then(function () {
        setCreateOpen(false)
        setEditItem(null)
        setFormError('')
        setForm({ kind: 'note', title: '', url: '', body: '', tags: '' })
      })
      .catch(function (error) {
        setFormError(String((error && error.message) || error))
      })
  }

  function removeItem() {
    const item = confirmItem
    if (!item || !item.id) return
    WB.actions.deleteKnowledge(item.id)
      .then(function () {
        setConfirmItem(null)
      })
      .catch(function () {
        /* Host error is already toasted by settle() */
      })
  }

  const summary = items.length
    ? '共 ' +
      items.length +
      ' 条 · 收藏 ' +
      counts.bookmark +
      ' · 笔记 ' +
      counts.note +
      ' · 片段 ' +
      counts.snippet
    : '收藏、笔记与排障片段由 Host 持久化，重启不丢失。'

  const typeOptions = Object.keys(knowKindMeta).map(function (key) {
    return { value: key, label: knowKindMeta[key].label }
  })

  const cards = filtered.map(function (item) {
    const meta = knowKindOf(item.kind)
    const tags = Array.isArray(item.tags) ? item.tags : []
    return h(
      'article',
      {
        key: item.id,
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 0,
          padding: '13px 14px',
          border: '1px solid ' + T.border1,
          borderRadius: 16,
          background: T.layer1,
        },
      },
      h(
        'div',
        { className: 'wb-row', style: { gap: 6, minWidth: 0 } },
        h(
          'span',
          { className: 'wb-row', style: { gap: 5, color: T.text2 } },
          h(Icon, { name: meta.icon, size: 13 }),
          h(Badge, { tone: meta.tone }, meta.label),
        ),
        h('span', { className: 'wb-spacer' }),
        h(
          'span',
          {
            className: 'wb-tiny wb-muted',
            title: item.createdAt ? WB.fmt.datetime(item.createdAt) : '创建时间未记录',
          },
          item.createdAt ? WB.fmt.relative(item.createdAt) : '—',
        ),
        h(IconBtn, {
          name: 'edit',
          label: '编辑条目',
          onClick: function () {
            openEdit(item)
          },
        }),
        h(IconBtn, {
          name: 'sparkles',
          label: 'AI 分析这条知识（带上下文进入会话）',
          onClick: function () {
            WB.assistant.add({
              kind: 'knowledge',
              id: item.id,
              title: item.title,
              url: item.url || null,
              body: String(item.body || '').slice(0, 800),
            })
          },
        }),
        h(IconBtn, {
          name: 'copy',
          label: '复制条目',
          onClick: function () {
            copyItem(item)
          },
        }),
        h(IconBtn, {
          name: 'trash',
          label: '删除条目',
          onClick: function () {
            setConfirmItem(item)
          },
        }),
      ),
      h(
        'div',
        {
          style: {
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.45,
            overflowWrap: 'anywhere',
          },
        },
        item.title || '（未命名条目）',
      ),
      item.url
        ? h(
            'a',
            {
              className: 'wb-link wb-tiny wb-ellipsis',
              href: item.url,
              target: '_blank',
              rel: 'noreferrer',
              title: item.url,
            },
            item.url,
          )
        : null,
      item.body
        ? h(
            'div',
            {
              className: 'wb-clamp2 wb-tiny wb-muted',
              style: { lineHeight: 1.65, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
            },
            String(item.body),
          )
        : null,
      tags.length
        ? h(
            'div',
            { className: 'wb-row wb-row--wrap', style: { gap: 4 } },
            tags.map(function (itemTag) {
              return h(
                Chip,
                {
                  key: itemTag,
                  active: tag === itemTag,
                  onClick: function () {
                    setTag(tag === itemTag ? '' : itemTag)
                  },
                },
                itemTag,
              )
            }),
          )
        : null,
    )
  })

  const emptyState = !items.length
    ? h(Empty, {
        icon: 'book',
        title: '知识空间还是空的',
        hint:
          '可以从技术雷达收藏条目，或直接在对话里让 Agent 记录一条笔记 / 片段；本页展示 Host 持久化的全部知识条目。',
        action: h(Btn, {
          kind: 'primary',
          size: 'sm',
          icon: 'plus',
          onClick: openCreate,
          children: '新建第一条',
        }),
      })
    : h(Empty, {
        icon: 'search',
        title: '没有匹配的条目',
        hint: '试试清空搜索、切换类型，或取消标签筛选。',
        action: h(Btn, {
          size: 'sm',
          icon: 'refresh',
          onClick: function () {
            setQuery('')
            setTag('')
            setKind('all')
          },
          children: '清空筛选',
        }),
      })

  const createModal = h(
    Modal,
    {
      open: createOpen,
      title: editItem ? '编辑知识条目' : '新建知识条目',
      sub: editItem ? '修改后立即写回 Host 持久化' : '标题必填；其余字段可选',
      onClose: closeCreate,
      footer: [
        h(Btn, { key: 'cancel', onClick: closeCreate, children: '取消' }),
        h(Btn, {
          key: 'create',
          kind: 'primary',
          icon: 'save',
          disabled: !!wbState.busy,
          onClick: submitCreate,
          children: editItem ? '保存修改' : '保存',
        }),
      ],
    },
    h(
      'div',
      { className: 'wb-stack', style: { gap: 10 } },
      h(
        Field,
        { label: '类型' },
        h(Select, {
          value: form.kind,
          options: typeOptions,
          onChange: function (event) {
            patchForm({ kind: event.target.value })
          },
        }),
      ),
      h(
        Field,
        { label: '标题' },
        h(Input, {
          value: form.title,
          placeholder: '例如：Harness 插件热更新排查记录',
          onChange: function (event) {
            patchForm({ title: event.target.value })
          },
        }),
      ),
      h(
        Field,
        { label: '链接', hint: '可选：收藏的来源地址' },
        h(Input, {
          value: form.url,
          placeholder: 'https://…',
          onChange: function (event) {
            patchForm({ url: event.target.value })
          },
        }),
      ),
      h(
        Field,
        { label: '正文' },
        h(Textarea, {
          value: form.body,
          rows: 6,
          placeholder: '笔记正文、命令片段或排障结论',
          onChange: function (event) {
            patchForm({ body: event.target.value })
          },
        }),
      ),
      h(
        Field,
        { label: '标签', hint: '逗号分隔，例如：harness, plugin, 排障' },
        h(Input, {
          value: form.tags,
          placeholder: 'harness, plugin',
          onChange: function (event) {
            patchForm({ tags: event.target.value })
          },
        }),
      ),
      formError
        ? h(
            'div',
            {
              role: 'alert',
              className: 'wb-tiny',
              style: {
                color: T.err,
                padding: '7px 9px',
                borderRadius: 8,
                border: '1px solid color-mix(in srgb, ' + T.err + ' 45%, transparent)',
                background: 'color-mix(in srgb, ' + T.err + ' 10%, transparent)',
                overflowWrap: 'anywhere',
              },
            },
            formError,
          )
        : null,
    ),
  )

  const deleteModal = h(
    Modal,
    {
      open: !!confirmItem,
      title: '删除知识条目',
      sub: confirmItem ? confirmItem.title || '（未命名条目）' : '',
      onClose: function () {
        setConfirmItem(null)
      },
      footer: [
        h(Btn, {
          key: 'cancel',
          onClick: function () {
            setConfirmItem(null)
          },
          children: '取消',
        }),
        h(Btn, {
          key: 'delete',
          kind: 'danger',
          icon: 'trash',
          disabled: !!wbState.busy,
          onClick: removeItem,
          children: '确认删除',
        }),
      ],
    },
    h(
      'p',
      { className: 'wb-tiny', style: { margin: 0, lineHeight: 1.7 } },
      '删除后不可恢复：Host 会把这条记录从持久化数据中移除。',
    ),
  )

  return h(
    'div',
    { className: 'wb-page' },
    h(PageHead, {
      icon: 'book',
      title: '知识空间',
      sub: summary,
      actions: h(Btn, {
        kind: 'primary',
        icon: 'plus',
        onClick: openCreate,
        children: '新建条目',
      }),
    }),
    h(
      'div',
      {
        className: 'wb-row wb-row--wrap',
        style: { gap: 10, marginBottom: 12, alignItems: 'center' },
      },
      h(Tabs, {
        items: tabs,
        value: kind,
        onChange: function (next) {
          setKind(next)
        },
      }),
      h('div', { className: 'wb-spacer' }),
      h(
        'div',
        { className: 'wb-row', style: { gap: 4 } },
        h(Input, {
          value: query,
          placeholder: '搜索标题、正文、标签或链接',
          style: { width: 260 },
          onChange: function (event) {
            setQuery(event.target.value)
          },
        }),
        query
          ? h(IconBtn, {
              name: 'close',
              label: '清空搜索',
              onClick: function () {
                setQuery('')
              },
            })
          : null,
      ),
    ),
    allTags.length
      ? h(
          'div',
          {
            className: 'wb-row wb-row--wrap',
            style: { gap: 6, marginBottom: 14, alignItems: 'center' },
          },
          h('span', { className: 'wb-tiny wb-muted' }, '标签'),
          allTags.map(function (entry) {
            return h(
              Chip,
              {
                key: entry.tag,
                active: tag === entry.tag,
                onClick: function () {
                  setTag(tag === entry.tag ? '' : entry.tag)
                },
                title: '按标签筛选',
              },
              entry.tag + ' · ' + entry.count,
            )
          }),
          tag
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'wb-chip',
                  onClick: function () {
                    setTag('')
                  },
                },
                h(Icon, { name: 'close', size: 11 }),
                '清除标签',
              )
            : null,
        )
      : null,
    cards.length
      ? h(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 14,
            },
          },
          cards,
        )
      : emptyState,
    h(
      'p',
      { className: 'wb-tiny wb-muted', style: { marginTop: 14, lineHeight: 1.7 } },
      '知识条目由 Host 持久化；搜索、标签与类型筛选都在本地完成，不会上传搜索词。',
    ),
    createModal,
    deleteModal,
  )
}

WB.pages.knowledge = knowPage
