/* ============================================================================
 * dev-workbench settings & connections
 *
 * The design report keeps configuration (Connector, model, permission, sync
 * policy, theme, layout) in one first-level module. Here it is concrete:
 * connector health as the Host actually observes it, the radar's topic list,
 * persistence guidance, and the L0–L3 permission ladder that explains why a
 * tool either runs locally or needs approval.
 * ========================================================================== */

function SettingsRow(props) {
  return h(
    'div',
    {
      className: 'wb-item',
      style: { alignItems: props.alignTop ? 'flex-start' : 'center' },
    },
    h(
      'div',
      { className: 'wb-item-main' },
      h('div', { className: 'wb-item-title' }, props.title, props.badge || null),
      props.hint ? h('div', { className: 'wb-item-sub' }, props.hint) : null,
    ),
    props.control ? h('div', { style: { flex: 'none' } }, props.control) : null,
  )
}

function SettingsPage() {
  const state = useStore()
  const data = state.data
  const [diag, setDiag] = React.useState(null)
  const [diagError, setDiagError] = React.useState(null)
  const [diagBusy, setDiagBusy] = React.useState(false)
  const [topicDraft, setTopicDraft] = React.useState('')
  const [confirmReset, setConfirmReset] = React.useState(null)
  const [projectName, setProjectName] = React.useState('')
  const [projectPath, setProjectPath] = React.useState('')
  const [picking, setPicking] = React.useState(false)
  const [projectEdit, setProjectEdit] = React.useState(null)
  const [backups, setBackups] = React.useState([])
  const [automation, setAutomation] = React.useState(null)
  const [mentionDraft, setMentionDraft] = React.useState('')
  const [feedLabel, setFeedLabel] = React.useState('')
  const [feedUrl, setFeedUrl] = React.useState('')
  const [feedTopics, setFeedTopics] = React.useState('')

  const settings = (data && data.settings) || { topics: [], staleHours: 24, showCompleted: false, defaultProjectId: null }
  const connectors = (data && data.connectors) || []
  const projects = (data && data.projects) || []
  const feeds = (settings && settings.feeds) || []

  function runDiagnostics() {
    setDiagBusy(true)
    setDiagError(null)
    WB.actions
      .diagnostics()
      .then(function (value) {
        setDiag(value)
        setDiagBusy(false)
      })
      .catch(function (e) {
        setDiagError(String((e && e.message) || e))
        setDiagBusy(false)
      })
  }

  React.useEffect(function () {
    runDiagnostics()
    WB.actions.backups()
      .then(function (result) {
        setBackups(result.backups || [])
      })
      .catch(function () {})
    WB.actions.automationStatus()
      .then(function (status) {
        setAutomation(status)
      })
      .catch(function () {})
  }, [])

  function patchSettings(patch) {
    WB.actions.saveSettings(patch).catch(function () {})
  }

  function addTopic() {
    const value = topicDraft.trim()
    if (!value) return
    if (settings.topics.indexOf(value) >= 0) {
      setTopicDraft('')
      return
    }
    patchSettings({ topics: settings.topics.concat([value]) })
    setTopicDraft('')
  }

  function removeTopic(topic) {
    patchSettings({
      topics: settings.topics.filter(function (item) {
        return item !== topic
      }),
    })
  }

  function pickProjectPath() {
    setPicking(true)
    WB.pickDirectory().then(function (dir) {
      setPicking(false)
      if (!dir) {
        WB.toast('没有选择目录（或当前环境不提供目录选择器）', 'info')
        return
      }
      setProjectPath(dir)
      setProjectName(function (previous) {
        if (previous.trim()) return previous
        const parts = String(dir).split(/[\\/]/).filter(Boolean)
        return parts.length > 0 ? parts[parts.length - 1] : '项目'
      })
    })
  }

  function addProject() {
    const name = projectName.trim()
    const repoPath = projectPath.trim()
    if (!repoPath) {
      WB.toast('请先选择或填写仓库目录', 'err')
      return
    }
    WB.actions
      .saveProject({ name: name || repoPath, repoPath: repoPath })
      .then(function () {
        setProjectName('')
        setProjectPath('')
      })
      .catch(function () {
        /* settle() already toasted */
      })
  }

  function addFeed() {
    WB.actions
      .addFeed({
        label: feedLabel,
        url: feedUrl,
        topics: feedTopics
          .split(/[,，\s]+/)
          .map(function (topic) {
            return topic.trim()
          })
          .filter(Boolean),
      })
      .then(function () {
        setFeedLabel('')
        setFeedUrl('')
        setFeedTopics('')
      })
      .catch(function () {
        /* addFeed already toasted the reason */
      })
  }

  function exportJson() {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'dev-workbench-' + WB.fmt.date(new Date().toISOString()) + '.json'
      anchor.click()
      setTimeout(function () {
        URL.revokeObjectURL(url)
      }, 2000)
      WB.toast('已导出快照 JSON', 'ok')
    } catch (e) {
      WB.toast('导出失败：' + String((e && e.message) || e), 'err')
    }
  }

  return h(
    'div',
    null,
    h(PageHead, {
      icon: 'plug',
      title: WB.t('settings.title', '连接与设置'),
      sub: '连接器状态、关注主题与数据落盘位置；改动的都是 Host 侧持久化配置。',
      actions: h(Btn, {
        icon: 'refresh',
        size: 'sm',
        onClick: function () {
          WB.actions.reload().catch(function () {})
          runDiagnostics()
        },
        children: '重新读取',
      }),
    }),
    h(
      'div',
      { className: 'wb-grid', style: { gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)' } },
      h(
        'div',
        { className: 'wb-stack', style: { gap: 14 } },

        h(
          Panel,
          {
            title: '连接器',
            sub: '一个 Provider 一种能力；未接入的能力保持“未配置”而不是假装可用',
            icon: 'plug',
          },
          connectors.length === 0
            ? h(Empty, {
                icon: 'plug',
                title: '还没有连接器',
                hint: '首版只登记真实存在的能力：本地数据、Host 运行时与命令探测。企业系统（云之家、Git、Docker）需要先完成能力发现再显示为“已连接”。',
              })
            : h(
                'div',
                null,
                connectors.map(function (connector) {
                  const meta = WB.connectorState(connector.authState)
                  return h(
                    'div',
                    { key: connector.id, className: 'wb-item', style: { alignItems: 'flex-start' } },
                    h(
                      'div',
                      { className: 'wb-item-main' },
                      h(
                        'div',
                        { className: 'wb-item-title' },
                        connector.label || connector.type,
                        h(Badge, { tone: meta.tone }, meta.label),
                      ),
                      h(
                        'div',
                        { className: 'wb-item-sub' },
                        (connector.capabilities || []).length > 0
                          ? connector.capabilities.map(function (capability) {
                              return h(Chip, { key: capability, children: capability })
                            })
                          : h('span', null, '无已声明能力'),
                      ),
                      connector.note ? h('div', { className: 'wb-item-sub' }, connector.note) : null,
                    ),
                    h(
                      'div',
                      { className: 'wb-tiny wb-muted', style: { flex: 'none' } },
                      connector.updatedAt ? WB.fmt.relative(connector.updatedAt) : '—',
                    ),
                  )
                }),
              ),
        ),

        h(
          Panel,
          {
            title: '权限分级',
            sub: '插件按 L0–L3 决定一个动作在本地执行、只读、还是要人工审批',
            icon: 'lock',
          },
          h(
            'table',
            { className: 'wb-table' },
            h(
              'thead',
              null,
              h('tr', null, h('th', null, '等级'), h('th', null, '操作'), h('th', null, '策略')),
            ),
            h(
              'tbody',
              null,
              [
                ['L0 本地计算', 'JSON/正则/Cron/编解码', '浏览器内完成，不发模型、不出网'],
                ['L1 授权只读', '读文件、查消息、看仓库', '连接器授权 + 最小作用域'],
                ['L2 受控修改', '建待办、写本地文件、跑测试', '展示具体操作，必要时审批'],
                ['L3 高风险', '推送代码、发消息、写数据库', '逐次审批 + 命令绑定 + 审计'],
              ].map(function (row) {
                return h(
                  'tr',
                  { key: row[0] },
                  h('td', { style: { whiteSpace: 'nowrap', fontWeight: 600 } }, row[0]),
                  h('td', null, row[1]),
                  h('td', { className: 'wb-muted' }, row[2]),
                )
              }),
            ),
          ),
        ),

        h(
          Panel,
          {
            title: '运行时诊断',
            sub: '来自 Host 的真实读数，不是前端估算',
            icon: 'database',
            actions: h(Btn, {
              size: 'sm',
              icon: 'refresh',
              disabled: diagBusy,
              onClick: runDiagnostics,
              children: diagBusy ? '读取中…' : '刷新',
            }),
          },
          diagError
            ? h('div', { role: 'alert', style: { color: T.err, fontSize: 12 } }, diagError)
            : !diag
              ? h('div', { className: 'wb-row', style: { padding: '10px 0' } }, h(Spinner, null), h('span', { className: 'wb-tiny wb-muted' }, '读取中…'))
              : h(
                  'div',
                  { className: 'wb-stack', style: { gap: 6 } },
                  [
                    ['数据文件', diag.dataPath],
                    ['文件大小', WB.fmt.bytes(diag.dataBytes)],
                    ['平台 / Node', diag.platform + ' / ' + diag.nodeVersion],
                    [
                      '记录数',
                      '待办 ' +
                        diag.counts.tasks +
                        ' · 执行 ' +
                        diag.counts.runs +
                        ' · 知识 ' +
                        diag.counts.knowledge +
                        ' · 雷达 ' +
                        diag.counts.radar +
                        ' · 来源 ' +
                        diag.counts.sources,
                    ],
                    ['Host 时间', WB.fmt.datetime(diag.hostTime)],
                  ].map(function (row) {
                    return h(
                      'div',
                      { key: row[0], className: 'wb-row', style: { alignItems: 'flex-start', gap: 10 } },
                      h('span', { className: 'wb-tiny wb-muted', style: { width: 86, flex: 'none' } }, row[0]),
                      h('span', {
                        className: 'wb-mono',
                        style: { overflowWrap: 'anywhere', minWidth: 0 },
                      }, String(row[1])),
                    )
                  }),
                  diag.toolNames && diag.toolNames.length > 0
                    ? h(
                        'div',
                        { style: { marginTop: 6 } },
                        h('div', { className: 'wb-label', style: { marginBottom: 4 } }, '已注册的 Agent 工具'),
                        h(
                          'div',
                          { className: 'wb-row wb-row--wrap' },
                          diag.toolNames.map(function (name) {
                            return h(Chip, { key: name, icon: 'command', children: name })
                          }),
                        ),
                      )
                    : null,
                ),
        ),
      ),

      h(
        'div',
        { className: 'wb-stack', style: { gap: 14 } },

        h(
          Panel,
          {
            title: '项目',
            sub: '仓库目录决定「研发协作」探测哪些 Git 仓库',
            icon: 'folder',
            badge: projects.length ? h(Badge, { tone: 'idle' }, projects.length + ' 个') : null,
          },
          projects.length === 0
            ? h(Empty, {
                icon: 'folder',
                title: '还没有项目',
                hint: '添加一个仓库目录后，研发协作会自动显示它的分支与改动；不添加则只探测 Host 的默认工作目录。',
              })
            : h(
                'div',
                null,
                projects.map(function (project) {
                  const count = ((data && data.tasks) || []).filter(function (task) {
                    return task.projectId === project.id
                  }).length
                  return h(
                    'div',
                    { key: project.id, className: 'wb-item', style: { alignItems: 'flex-start' } },
                    h(Icon, { name: 'folder', size: 14 }),
                    h(
                      'div',
                      { className: 'wb-item-main' },
                      h('div', { className: 'wb-item-title' }, project.name),
                      h(
                        'div',
                        { className: 'wb-item-sub wb-mono wb-ellipsis' },
                        project.repoPath || '未配置仓库目录',
                      ),
                      h('div', { className: 'wb-item-sub' }, count + ' 项待办'),
                    ),
                    h(IconBtn, {
                      name: 'edit',
                      label: '编辑项目名称与目录',
                      onClick: function () {
                        setProjectEdit({ id: project.id, name: project.name, repoPath: project.repoPath || '' })
                      },
                    }),
                    h(IconBtn, {
                      name: 'trash',
                      label: '删除项目',
                      onClick: function () {
                        if (!window.confirm('删除项目「' + project.name + '」？关联任务会解除项目归属，任务本身保留。')) return
                        WB.actions.deleteProject(project.id).catch(function () {})
                      },
                    }),
                  )
                }),
              ),
          h(
            'div',
            { className: 'wb-stack', style: { gap: 8, marginTop: projects.length ? 10 : 0 } },
            h(
              'div',
              { className: 'wb-row' },
              h(Input, {
                value: projectName,
                placeholder: '项目名称',
                onChange: function (event) {
                  setProjectName(event.target.value)
                },
              }),
              h(Btn, {
                size: 'sm',
                icon: 'folder',
                disabled: picking,
                onClick: pickProjectPath,
                children: picking ? '选择中…' : '选择目录',
              }),
            ),
            h(Input, {
              value: projectPath,
              placeholder: '仓库绝对路径，如 /Users/me/code/gateway',
              onChange: function (event) {
                setProjectPath(event.target.value)
              },
            }),
            h(
              'div',
              { className: 'wb-row' },
              h('div', { className: 'wb-spacer' }),
              h(Btn, {
                size: 'sm',
                kind: 'primary',
                icon: 'plus',
                disabled: !projectPath.trim(),
                onClick: addProject,
                children: '添加项目',
              }),
            ),
          ),
        ),

        h(
          Panel,
          {
            title: '资讯源',
            sub: 'RSS / Atom 地址；「抓取资讯」逐源采集，某一路失败不影响其它',
            icon: 'radar',
            badge: feeds.length ? h(Badge, { tone: 'idle' }, feeds.length + ' 个') : null,
          },
          feeds.length === 0
            ? h(Empty, {
                icon: 'radar',
                title: '还没有配置资讯源',
                hint: '添加 RSS/Atom 地址后，回到「今日简报 → 技术雷达」点「抓取资讯」；也可以让 Agent 调 workbench_fetch_radar 工具，或设一个每日提醒让它自动执行。',
              })
            : h(
                'div',
                null,
                feeds.map(function (feed) {
                  return h(
                    'div',
                    { key: feed.id, className: 'wb-item', style: { alignItems: 'flex-start' } },
                    h(Icon, { name: 'radar', size: 14 }),
                    h(
                      'div',
                      { className: 'wb-item-main' },
                      h('div', { className: 'wb-item-title' }, feed.label),
                      h('div', { className: 'wb-item-sub wb-mono wb-ellipsis' }, feed.url),
                      feed.topics && feed.topics.length
                        ? h(
                            'div',
                            { className: 'wb-item-sub' },
                            feed.topics.map(function (topic) {
                              return h(Chip, { key: topic, children: topic })
                            }),
                          )
                        : null,
                    ),
                    h(IconBtn, {
                      name: 'trash',
                      label: '移除资讯源',
                      onClick: function () {
                        WB.actions.deleteFeed(feed.id).catch(function () {})
                      },
                    }),
                  )
                }),
              ),
          h(
            'div',
            { className: 'wb-stack', style: { gap: 8, marginTop: feeds.length ? 10 : 0 } },
            h(Input, {
              value: feedLabel,
              placeholder: '名称，如 Hacker News · LLM（可留空，默认取域名）',
              onChange: function (event) {
                setFeedLabel(event.target.value)
              },
            }),
            h(Input, {
              value: feedUrl,
              placeholder: 'RSS/Atom 地址，如 https://hnrss.org/newest?q=LLM',
              onChange: function (event) {
                setFeedUrl(event.target.value)
              },
            }),
            h(Input, {
              value: feedTopics,
              placeholder: '归入主题，逗号分隔，如 LLM, Agent',
              onChange: function (event) {
                setFeedTopics(event.target.value)
              },
            }),
            h(
              'div',
              { className: 'wb-row' },
              h('div', { className: 'wb-spacer' }),
              h(Btn, {
                size: 'sm',
                kind: 'primary',
                icon: 'plus',
                disabled: !feedUrl.trim(),
                onClick: addFeed,
                children: '添加资讯源',
              }),
            ),
          ),
        ),

        h(
          Panel,
          { title: '关注主题', sub: '技术雷达按这些主题过滤与推荐', icon: 'radar' },
          h(
            'div',
            { className: 'wb-row wb-row--wrap', style: { marginBottom: 10 } },
            settings.topics.length === 0
              ? h('span', { className: 'wb-tiny wb-muted' }, '还没有关注主题')
              : settings.topics.map(function (topic) {
                  return h(Chip, {
                    key: topic,
                    active: true,
                    children: topic,
                    onRemove: function () {
                      removeTopic(topic)
                    },
                  })
                }),
          ),
          h(
            'div',
            { className: 'wb-row' },
            h(Input, {
              value: topicDraft,
              placeholder: '新增主题，如 RAG / 数据库',
              onChange: function (event) {
                setTopicDraft(event.target.value)
              },
              onKeyDown: function (event) {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addTopic()
                }
              },
            }),
            h(Btn, {
              icon: 'plus',
              size: 'sm',
              onClick: addTopic,
              disabled: !topicDraft.trim(),
              children: '添加',
            }),
          ),
        ),

        h(
          Panel,
          {
            title: '自动化',
            sub: '插件侧定时执行确定性采集（不调模型）',
            icon: 'zap',
            badge: automation ? h(Badge, { tone: automation.enabled ? 'ok' : 'idle' }, automation.enabled ? '已开启' : '已关闭') : null,
            actions: h(Btn, {
              size: 'sm',
              kind: 'subtle',
              icon: 'play',
              disabled: !automation || !automation.enabled,
              onClick: function () {
                WB.actions
                  .automationRun()
                  .then(function (result) {
                    WB.toast(result.ran ? '已执行一次：资讯 +' + (result.radarAdded || 0) + '，@我 +' + (result.mentionsAdded || 0) : (result.note || '未执行'), result.ran ? 'ok' : 'info')
                    return WB.actions.automationStatus()
                  })
                  .then(function (status) {
                    setAutomation(status)
                  })
                  .catch(function () {})
              },
              children: '立即执行',
            }),
          },
          h(
            'div',
            null,
            h(SettingsRow, {
              title: '开启后台自动化',
              hint:
                automation && automation.lastAutomation
                  ? '上次运行 ' + WB.fmt.relative(automation.lastAutomation.at) + '（' + automation.lastAutomation.status + '）：' + (automation.lastAutomation.note || '')
                  : '仅在 DSH 进程运行期间生效；退出/休眠后恢复会按到期补跑一次',
              control: h(Toggle, {
                checked: !!(automation && automation.enabled),
                onChange: function (next) {
                  patchSettings({ automation: { enabled: next } })
                  setAutomation(Object.assign({}, automation, { enabled: next }))
                },
              }),
            }),
            h(SettingsRow, {
              title: '运行间隔',
              hint: '到点才执行；开关与间隔改动立即生效',
              control: h(Select, {
                value: String((automation && automation.intervalMinutes) || 60),
                options: [
                  { value: '15', label: '15 分钟' },
                  { value: '30', label: '30 分钟' },
                  { value: '60', label: '1 小时' },
                  { value: '180', label: '3 小时' },
                  { value: '720', label: '12 小时' },
                ],
                onChange: function (event) {
                  patchSettings({ automation: { intervalMinutes: Number(event.target.value) } })
                  setAutomation(Object.assign({}, automation, { intervalMinutes: Number(event.target.value) }))
                },
              }),
            }),
            h(SettingsRow, {
              title: '资讯采集',
              hint: '未配置 RSS 时按关注主题联网发现',
              control: h(Toggle, {
                checked: !(automation && automation.radar === false),
                onChange: function (next) {
                  patchSettings({ automation: { radar: next } })
                  setAutomation(Object.assign({}, automation, { radar: next }))
                },
              }),
            }),
            h(SettingsRow, {
              title: 'AI 识别新消息（结构化提炼）',
              hint: '消息先入库；识别单独运行，失败可重放，不调模型不扣时限外额度',
              control: h(Toggle, {
                checked: !!(settings.aiExtract && settings.aiExtract.enabled),
                onChange: function (next) {
                  patchSettings({ aiExtract: { enabled: next } })
                },
              }),
            }),
            h(SettingsRow, {
              title: '识别后自动登记待办',
              hint: '开启后明确交办直接建档；关闭则进入待确认，由你确认后创建',
              control: h(Toggle, {
                checked: !!(settings.aiExtract && settings.aiExtract.autoRegister),
                onChange: function (next) {
                  patchSettings({ aiExtract: { autoRegister: next } })
                },
              }),
            }),
            h(SettingsRow, {
              title: '拉取 @我 消息',
              hint: '增量游标优先；云之家不可用时自动跳过',
              control: h(Toggle, {
                checked: !(automation && automation.mentions === false),
                onChange: function (next) {
                  patchSettings({ automation: { mentions: next } })
                  setAutomation(Object.assign({}, automation, { mentions: next }))
                },
              }),
            }),
          ),
        ),

        h(
          Panel,
          {
            title: '补充 @ 关键词',
            sub: '增量游标不可用时，用这些关键词兜底检索昵称/别名 @',
            icon: 'search',
          },
          h(
            'div',
            { className: 'wb-row wb-row--wrap', style: { marginBottom: 10 } },
            (settings.mentionKeywords || []).length === 0
              ? h('span', { className: 'wb-tiny wb-muted' }, '还没有补充关键词（默认用当前账号显示名检索）')
              : (settings.mentionKeywords || []).map(function (word) {
                  return h(Chip, {
                    key: word,
                    active: true,
                    children: word,
                    onRemove: function () {
                      patchSettings({
                        mentionKeywords: (settings.mentionKeywords || []).filter(function (item) {
                          return item !== word
                        }),
                      })
                    },
                  })
                }),
          ),
          h(
            'div',
            { className: 'wb-row' },
            h(Input, {
              value: mentionDraft,
              placeholder: '如：小龙 / 珑珑',
              onChange: function (event) {
                setMentionDraft(event.target.value)
              },
              onKeyDown: function (event) {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const word = mentionDraft.trim()
                  if (!word) return
                  patchSettings({ mentionKeywords: (settings.mentionKeywords || []).concat([word]).slice(0, 6) })
                  setMentionDraft('')
                }
              },
            }),
            h(Btn, {
              size: 'sm',
              icon: 'plus',
              disabled: !mentionDraft.trim(),
              onClick: function () {
                const word = mentionDraft.trim()
                if (!word) return
                patchSettings({ mentionKeywords: (settings.mentionKeywords || []).concat([word]).slice(0, 6) })
                setMentionDraft('')
              },
              children: '添加',
            }),
          ),
        ),

        h(
          Panel,
          { title: '偏好', sub: '仅影响本工作台的展示', icon: 'settings' },
          h(
            'div',
            null,
            h(SettingsRow, {
              title: '显示已完成任务',
              hint: '关闭时任务中心默认只看未完成',
              control: h(Toggle, {
                checked: !!settings.showCompleted,
                onChange: function (next) {
                  patchSettings({ showCompleted: next })
                },
              }),
            }),
            h(SettingsRow, {
              title: '数据陈旧阈值',
              hint: '超过这个时长未写入时，首页提示数据可能过期',
              control: h(Select, {
                value: String(settings.staleHours || 24),
                options: [
                  { value: '6', label: '6 小时' },
                  { value: '12', label: '12 小时' },
                  { value: '24', label: '24 小时' },
                  { value: '72', label: '3 天' },
                ],
                onChange: function (event) {
                  patchSettings({ staleHours: Number(event.target.value) })
                },
              }),
            }),
            h(SettingsRow, {
              title: '默认项目',
              hint: '新建待办时预选的项目',
              control: h(Select, {
                value: settings.defaultProjectId || '',
                options: [{ value: '', label: '未设置' }].concat(
                  projects.map(function (project) {
                    return { value: project.id, label: project.name }
                  }),
                ),
                onChange: function (event) {
                  patchSettings({ defaultProjectId: event.target.value || null })
                },
              }),
            }),
          ),
        ),

        h(
          Panel,
          { title: '数据管理', sub: '状态由 Host 持有；前端不作为权威数据源', icon: 'save' },
          h(
            'div',
            { className: 'wb-stack', style: { gap: 9 } },
            h(
              'div',
              { className: 'wb-row wb-row--wrap' },
              h(Btn, { icon: 'download', size: 'sm', onClick: exportJson, children: '导出 JSON' }),
            h(Btn, {
              icon: 'save',
              size: 'sm',
              onClick: function () {
                WB.actions.backup().then(function (result) {
                  setBackups(result.backups || [])
                  WB.toast('已创建备份', 'ok')
                }).catch(function () {})
              },
              children: '立即备份',
            }),
              h(Btn, {
                icon: 'sparkles',
                size: 'sm',
                onClick: function () {
                  WB.actions.seedDemo().catch(function () {})
                },
                children: '载入示例数据',
              }),
            ),
            h(
              'p',
              { className: 'wb-hint', style: { margin: '2px 0 0' } },
              '“载入示例数据”会写入若干标注为示例的待办与资讯，用来快速看清布局；随时可重置清空。',
            ),
            backups.length > 0
              ? h(
                  'div',
                  { className: 'wb-stack', style: { gap: 4 } },
                  h('div', { className: 'wb-label' }, '可用备份（每天首次写入自动留一份，保留 5 份）'),
                  backups.slice(0, 5).map(function (item) {
                    return h(
                      'div',
                      { key: item.id, className: 'wb-row', style: { gap: 8 } },
                      h('span', { className: 'wb-mono wb-tiny wb-ellipsis', style: { flex: '1 1 auto' } }, item.id),
                      h('span', { className: 'wb-tiny wb-muted' }, WB.fmt.bytes(item.bytes)),
                      h(Btn, {
                        size: 'sm',
                        kind: 'subtle',
                        icon: 'refresh',
                        onClick: function () {
                          if (!window.confirm('用这份备份覆盖当前数据？当前文件会先自动备份。')) return
                          WB.actions
                            .restoreBackup(item.id)
                            .then(function () {
                              WB.toast('已从备份恢复', 'ok')
                              WB.actions.reload().catch(function () {})
                            })
                            .catch(function () {})
                        },
                        children: '恢复',
                      }),
                    )
                  }),
                )
              : null,
            h(Divider, null),
            h(
              'div',
              { className: 'wb-row' },
              h(
                'div',
                { className: 'wb-item-main' },
                h('div', { className: 'wb-item-title' }, '重置数据'),
                h('div', { className: 'wb-item-sub' }, '清空任务、执行记录、知识与雷达，保留设置'),
              ),
              h(Btn, {
                kind: 'danger',
                size: 'sm',
                icon: 'trash',
                onClick: function () {
                  setConfirmReset(true)
                },
                children: '重置',
              }),
            ),
          ),
        ),

        h(
          Panel,
          { title: '关于', sub: '智能工作台 0.1.0（dsh-dev-workbench）', icon: 'info' },
          h(
            'div',
            { className: 'wb-stack wb-tiny wb-muted', style: { gap: 5 } },
            h('span', null, 'Cordis Host + Client 双半插件：Host 持有状态并通过 workbench/* Remote 暴露，Client 通过 main 与 sidebar.panellist 插槽渲染页面。'),
            h('span', null, '工具箱中的计算全部在浏览器内完成；插件不保存任何企业凭据，也不缓存跨权限内容。'),
            h(
              'span',
              null,
              '数据文件位于 ',
              h('code', { className: 'wb-mono' }, diag ? diag.dataPath : '~/.dsh/storages/dsh-dev-workbench/state.json'),
            ),
          ),
        ),
      ),
    ),

    h(Modal, {
      open: !!projectEdit,
      title: '编辑项目',
      sub: projectEdit ? projectEdit.name : '',
      onClose: function () {
        setProjectEdit(null)
      },
      footer: h(
        React.Fragment,
        null,
        h(Btn, {
          onClick: function () {
            setProjectEdit(null)
          },
          children: '取消',
        }),
        h('div', { className: 'wb-spacer' }),
        h(Btn, {
          kind: 'primary',
          icon: 'save',
          disabled: !projectEdit || !String(projectEdit.name || '').trim(),
          onClick: function () {
            if (!projectEdit) return
            const name = String(projectEdit.name || '').trim()
            if (!name) return
            WB.actions
              .saveProject({ id: projectEdit.id, name: name, repoPath: String(projectEdit.repoPath || '').trim() })
              .then(function () {
                setProjectEdit(null)
              })
              .catch(function () {})
          },
          children: '保存',
        }),
      ),
    },
    projectEdit
      ? h(
          'div',
          { className: 'wb-stack', style: { gap: 10 } },
          h(Field, { label: '项目名称' }, h(Input, {
            value: projectEdit.name,
            autoFocus: true,
            onChange: function (event) {
              setProjectEdit(Object.assign({}, projectEdit, { name: event.target.value }))
            },
          })),
          h(Field, { label: '仓库目录', hint: '留空表示不关联仓库；改动后研发协作会重新探测' }, h(Input, {
            value: projectEdit.repoPath,
            placeholder: '/Users/me/code/项目',
            onChange: function (event) {
              setProjectEdit(Object.assign({}, projectEdit, { repoPath: event.target.value }))
            },
          })),
        )
      : null),
    h(Modal, {
      open: !!confirmReset,
      title: '重置确认',
      sub: '此操作不可撤销',
      onClose: function () {
        setConfirmReset(null)
      },
      footer: h(
        React.Fragment,
        null,
        h(Btn, {
          onClick: function () {
            setConfirmReset(null)
          },
          children: '取消',
        }),
        h('div', { className: 'wb-spacer' }),
        h(Btn, {
          kind: 'danger',
          icon: 'trash',
          onClick: function () {
            setConfirmReset(null)
            WB.actions.reset('all').catch(function () {})
          },
          children: '确认重置',
        }),
      ),
    }, h('p', { style: { margin: 0, fontSize: 12.5 } }, '将清空所有待办、执行记录、知识与雷达条目，并保留关注主题与偏好设置。')))
}

WB.pages.settings = SettingsPage
