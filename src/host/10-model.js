/* ============================================================================
 * dev-workbench host — data model
 *
 * The entity set follows design report §6.1 (Task, SourceRef, AgentRun,
 * AgentEvent→steps, Approval→waiting_approval runs, Connector, SyncCursor→
 * updatedAt, Project). Everything is plain JSON so a snapshot round-trips
 * through the Remote channel without a codec.
 * ========================================================================== */

const TASK_STATUSES = ['draft', 'ready', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled']
const TASK_PRIORITIES = ['urgent', 'high', 'normal', 'low']
const RUN_STATUSES = ['queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled']
const KNOWLEDGE_KINDS = ['bookmark', 'note', 'snippet']
const AUDIT_LIMIT = 200
const CANDIDATE_LIMIT = 200

const CANDIDATE_STATUSES = ['pending', 'accepted', 'rejected']
const OPERATION_LIMIT = 200

const DEFAULT_TOPICS = ['Agent', 'LLM', 'RAG', 'Java', 'Python', '数据库']

function emptyWorkbenchState() {
  return {
    version: HOST_STATE_VERSION,
    revision: 0,
    updatedAt: hostNowIso(),
    settings: {
      topics: DEFAULT_TOPICS.slice(),
      defaultProjectId: null,
      staleHours: 24,
      showCompleted: false,
    },
    projects: [],
    tasks: [],
    sources: [],
    runs: [],
    knowledge: [],
    radar: [],
    connectors: [],
    candidates: [],
    syncCursors: {},
    lastAutomation: null,
    audit: [],
  }
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeFeed(raw) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const url = asUrl(input.url)
  return {
    id: asString(input.id, 80) || newId('feed'),
    label: asString(input.label, 80) || (url ? String(url).replace(/^https?:\/\//, '').slice(0, 60) : '未命名资讯源'),
    url: url,
    topics: asTags(input.topics, 6),
  }
}

function normalizeAutomation(raw) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const minutes = Number(input.intervalMinutes)
  return {
    enabled: input.enabled === true,
    intervalMinutes: Number.isFinite(minutes) && minutes >= 5 ? Math.min(24 * 60, Math.round(minutes)) : 60,
    radar: input.radar !== false,
    mentions: input.mentions !== false,
  }
}

function normalizeSyncCursors(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  Object.keys(raw)
    .slice(0, 40)
    .forEach(function (groupId) {
      const item = raw[groupId]
      if (!item || typeof item !== 'object') return
      const lastMsgId = asString(item.lastMsgId, 80)
      if (!lastMsgId) return
      out[groupId] = {
        lastMsgId: lastMsgId,
        lastSendTime: asIso(item.lastSendTime),
        groupName: asString(item.groupName, 120),
        at: asIso(item.at) || hostNowIso(),
      }
    })
  return out
}

function normalizeFetchReport(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    at: asIso(raw.at) || hostNowIso(),
    added: Number.isFinite(Number(raw.added)) ? Math.max(0, Math.round(Number(raw.added))) : 0,
    skipped: Number.isFinite(Number(raw.skipped)) ? Math.max(0, Math.round(Number(raw.skipped))) : 0,
    perFeed: ensureArray(raw.perFeed)
      .slice(0, 12)
      .map(function (row) {
        const item = row && typeof row === 'object' ? row : {}
        return {
          id: asString(item.id, 80),
          label: asString(item.label, 80),
          status: asString(item.status, 20) || 'ok',
          added: Number.isFinite(Number(item.added)) ? Math.max(0, Math.round(Number(item.added))) : 0,
          skipped: Number.isFinite(Number(item.skipped)) ? Math.max(0, Math.round(Number(item.skipped))) : 0,
          note: asString(item.note, 300),
        }
      }),
    note: asString(raw.note, 300),
  }
}

function normalizeMentionsReport(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    at: asIso(raw.at) || hostNowIso(),
    status: asString(raw.status, 20) || 'ok',
    found: Number.isFinite(Number(raw.found)) ? Math.max(0, Math.round(Number(raw.found))) : 0,
    added: Number.isFinite(Number(raw.added)) ? Math.max(0, Math.round(Number(raw.added))) : 0,
    user: asString(raw.user, 80),
    note: asString(raw.note, 400),
  }
}

function normalizeSettings(raw) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const topics = asTags(input.topics, 24)
  const staleHours = Number(input.staleHours)
  const feeds = ensureArray(input.feeds)
    .map(normalizeFeed)
    .filter(function (feed) {
      return !!feed.url
    })
    .slice(0, 12)
  return {
    topics: topics.length > 0 || input.topics !== undefined ? topics : DEFAULT_TOPICS.slice(),
    defaultProjectId: typeof input.defaultProjectId === 'string' && input.defaultProjectId ? input.defaultProjectId : null,
    staleHours: Number.isFinite(staleHours) && staleHours > 0 ? Math.min(24 * 30, Math.round(staleHours)) : 24,
    showCompleted: input.showCompleted === true,
    feeds: feeds,
    /** 昵称/别名 @ 的补充关键词（增量游标覆盖不到时的兜底检索） */
    mentionKeywords: asTags(input.mentionKeywords, 6),
    /** 后台自动化（TODO 07）：插件侧定时执行确定性采集 */
    automation: normalizeAutomation(input.automation),
  }
}

function normalizeProject(raw, existing) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const base = existing || {}
  return {
    id: base.id || newId('proj'),
    name: asString(input.name === undefined ? base.name : input.name, 120) || '未命名项目',
    repoPath: asString(input.repoPath === undefined ? base.repoPath : input.repoPath, 500),
    color: asString(input.color === undefined ? base.color : input.color, 20) || null,
  }
}

function normalizeTask(raw, existing) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const base = existing || {}
  const createdAt = base.createdAt || hostNowIso()
  const status = TASK_STATUSES.indexOf(input.status) >= 0 ? input.status : base.status || 'ready'
  const priority = TASK_PRIORITIES.indexOf(input.priority) >= 0 ? input.priority : base.priority || 'normal'
  const confidenceRaw = input.confidence === undefined ? base.confidence : input.confidence
  const confidence =
    typeof confidenceRaw === 'number' && confidenceRaw >= 0 && confidenceRaw <= 1 ? confidenceRaw : null
  const completedAt =
    status === 'completed'
      ? base.completedAt || (base.status === 'completed' ? createdAt : hostNowIso())
      : null
  return {
    id: base.id || newId('task'),
    title: asString(input.title === undefined ? base.title : input.title, 200) || '未命名待办',
    description: asString(input.description === undefined ? base.description : input.description, 4000),
    status: status,
    priority: priority,
    dueAt: input.dueAt === undefined ? base.dueAt || null : asIso(input.dueAt),
    projectId:
      input.projectId === undefined
        ? base.projectId || null
        : typeof input.projectId === 'string' && input.projectId
          ? input.projectId
          : null,
    tags: input.tags === undefined ? asTags(base.tags) : asTags(input.tags),
    assignee:
      input.assignee === undefined
        ? base.assignee || null
        : asString(input.assignee, 80) || null,
    sourceRefId:
      input.sourceRefId === undefined
        ? base.sourceRefId || null
        : typeof input.sourceRefId === 'string' && input.sourceRefId
          ? input.sourceRefId
          : null,
    confidence: confidence,
    aiExtracted: input.aiExtracted === undefined ? base.aiExtracted === true : input.aiExtracted === true,
    demo: input.demo === undefined ? base.demo === true : input.demo === true,
    runIds: ensureArray(base.runIds).slice(),
    createdAt: createdAt,
    updatedAt: hostNowIso(),
    completedAt: completedAt,
  }
}

function normalizeSource(raw) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const url = asUrl(input.url)
  const title = asString(input.title, 300) || url || '未命名来源'
  const excerpt = asString(input.excerpt, 2000)
  return {
    id: newId('src'),
    provider: asString(input.provider, 40) || 'manual',
    externalId: asString(input.externalId, 200) || null,
    url: url,
    title: title,
    excerpt: excerpt,
    fetchedAt: asIso(input.fetchedAt) || hostNowIso(),
    payloadHash: hashText([url || '', title, excerpt].join('|')),
    // 消息类来源的可回溯信息：发送人与原始定位（IM 无文档化深链，故只存 ID）
    sender: asString(input.sender, 80) || null,
    locator: input.locator && typeof input.locator === 'object'
      ? {
          groupId: asString(input.locator.groupId, 80) || null,
          msgId: asString(input.locator.msgId, 80) || null,
          groupName: asString(input.locator.groupName, 120) || null,
        }
      : null,
  }
}

function normalizeKnowledge(raw, existing) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const base = existing || {}
  const kind = KNOWLEDGE_KINDS.indexOf(input.kind) >= 0 ? input.kind : base.kind || 'note'
  const body = asString(input.body === undefined ? base.body : input.body, 20000)
  const url = input.url === undefined ? base.url || null : asUrl(input.url)
  return {
    id: base.id || newId('kb'),
    kind: kind,
    title:
      asString(input.title === undefined ? base.title : input.title, 200) ||
      (kind === 'bookmark' ? url || '未命名收藏' : '未命名笔记'),
    url: url,
    body: body,
    tags: input.tags === undefined ? asTags(base.tags) : asTags(input.tags),
    createdAt: base.createdAt || hostNowIso(),
    updatedAt: hostNowIso(),
  }
}

function normalizeCandidate(raw, existing) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const base = existing || {}
  const status = CANDIDATE_STATUSES.indexOf(input.status) >= 0 ? input.status : base.status || 'pending'
  const confidenceRaw = input.confidence === undefined ? base.confidence : input.confidence
  return {
    id: base.id || newId('cand'),
    sourceRefId: input.sourceRefId === undefined ? base.sourceRefId || null : input.sourceRefId || null,
    sourceTitle: asString(input.sourceTitle === undefined ? base.sourceTitle : input.sourceTitle, 200),
    title: asString(input.title === undefined ? base.title : input.title, 200) || '待确认事项',
    excerpt: asString(input.excerpt === undefined ? base.excerpt : input.excerpt, 2000),
    dueAt: input.dueAt === undefined ? base.dueAt || null : asIso(input.dueAt),
    assignee: input.assignee === undefined ? base.assignee || null : asString(input.assignee, 80) || null,
    confidence:
      typeof confidenceRaw === 'number' && confidenceRaw >= 0 && confidenceRaw <= 1 ? confidenceRaw : null,
    reasons: input.reasons === undefined ? ensureArray(base.reasons) : asTags(input.reasons, 8),
    /** 提取方式：'rule' = 确定性规则候选（非模型判断），供 UI 与审计区分 */
    extractor: asString(input.extractor === undefined ? base.extractor : input.extractor, 20) || 'rule',
    status: status,
    taskId: input.taskId === undefined ? base.taskId || null : input.taskId || null,
    createdAt: base.createdAt || hostNowIso(),
    updatedAt: hostNowIso(),
  }
}

function normalizeRadarItem(raw, existing) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const base = existing || {}
  const summaryInput = input.summary && typeof input.summary === 'object' ? input.summary : base.summary || {}
  const url = input.url === undefined ? base.url || null : asUrl(input.url)
  return {
    id: base.id || newId('radar'),
    title: asString(input.title === undefined ? base.title : input.title, 300) || '未命名资讯',
    source: asString(input.source === undefined ? base.source : input.source, 80) || 'manual',
    url: url,
    publishedAt: input.publishedAt === undefined ? base.publishedAt || null : asIso(input.publishedAt),
    topics: input.topics === undefined ? asTags(base.topics, 8) : asTags(input.topics, 8),
    summary: {
      change: asString(summaryInput.change, 800),
      usage: asString(summaryInput.usage, 800),
      risk: asString(summaryInput.risk, 800),
      practice: asString(summaryInput.practice, 800),
    },
    /** Raw source excerpt for fetched items; the four-part summary stays empty
     *  until an agent digests it, so nothing pretends to be an AI summary. */
    excerpt: asString(input.excerpt === undefined ? base.excerpt : input.excerpt, 2000),
    saved: input.saved === undefined ? base.saved === true : input.saved === true,
    demo: input.demo === undefined ? base.demo === true : input.demo === true,
    createdAt: base.createdAt || hostNowIso(),
    updatedAt: hostNowIso(),
  }
}

function normalizeRun(raw, existing) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const base = existing || {}
  const status = RUN_STATUSES.indexOf(input.status) >= 0 ? input.status : base.status || 'queued'
  const terminal = status === 'completed' || status === 'failed' || status === 'cancelled'
  return {
    id: base.id || newId('run'),
    taskId: input.taskId === undefined ? base.taskId || null : typeof input.taskId === 'string' && input.taskId ? input.taskId : null,
    sessionId: input.sessionId === undefined ? base.sessionId || null : asString(input.sessionId, 200) || null,
    status: status,
    profile: asString(input.profile === undefined ? base.profile : input.profile, 60) || 'workbench',
    summary: asString(input.summary === undefined ? base.summary : input.summary, 2000),
    steps: input.steps === undefined ? asSteps(base.steps) : asSteps(input.steps),
    evidence: input.evidence === undefined ? asEvidence(base.evidence) : asEvidence(input.evidence),
    startedAt: base.startedAt || asIso(input.startedAt) || hostNowIso(),
    endedAt: terminal ? base.endedAt || hostNowIso() : null,
  }
}

function normalizeState(raw) {
  const base = emptyWorkbenchState()
  if (!raw || typeof raw !== 'object' || raw.__corrupt) {
    return { state: base, migrated: false, corrupt: raw && raw.__corrupt ? raw.__corrupt : null }
  }
  const state = {
    version: HOST_STATE_VERSION,
    revision: Number.isFinite(Number(raw.revision)) ? Number(raw.revision) : 0,
    updatedAt: asIso(raw.updatedAt) || hostNowIso(),
    settings: normalizeSettings(raw.settings),
    // 恢复时必须把「已存的记录自身」当作 base 传入：normalizeX(raw, null) 会把
    // base 当成空对象，从而为每条记录重新生成 ID，导致 projectId / taskId /
    // runIds / sourceRefId 等关联在每次加载后全部失效。
    projects: ensureArray(raw.projects)
      .slice(0, 40)
      .map(function (project) {
        return normalizeProject(project, project)
      }),
    tasks: ensureArray(raw.tasks)
      .slice(0, 2000)
      .map(function (task) {
        return normalizeTask(task, task)
      }),
    sources: ensureArray(raw.sources).slice(0, 2000),
    runs: ensureArray(raw.runs)
      .slice(0, 2000)
      .map(function (run) {
        return normalizeRun(run, run)
      }),
    knowledge: ensureArray(raw.knowledge)
      .slice(0, 2000)
      .map(function (item) {
        return normalizeKnowledge(item, item)
      }),
    radar: ensureArray(raw.radar).slice(0, 500),
    connectors: ensureArray(raw.connectors).slice(0, 40),
    candidates: ensureArray(raw.candidates)
      .slice(-CANDIDATE_LIMIT)
      .map(function (candidate) {
        return normalizeCandidate(candidate, candidate)
      }),
    operations: ensureArray(raw.operations)
      .slice(-OPERATION_LIMIT)
      .map(function (operation) {
        const item = operation && typeof operation === 'object' ? operation : {}
        return {
          key: asString(item.key, 160),
          tool: asString(item.tool, 60),
          at: asIso(item.at) || hostNowIso(),
          entityIds: ensureArray(item.entityIds).slice(0, 10).map(function (id) {
            return asString(id, 80)
          }),
          status: asString(item.status, 20) || 'succeeded',
        }
      })
      .filter(function (operation) {
        return operation.key.length > 0
      }),
    syncCursors: normalizeSyncCursors(raw.syncCursors),
    lastAutomation: raw.lastAutomation && typeof raw.lastAutomation === 'object'
      ? {
          at: asIso(raw.lastAutomation.at) || hostNowIso(),
          radarAdded: Number(raw.lastAutomation.radarAdded) || 0,
          mentionsAdded: Number(raw.lastAutomation.mentionsAdded) || 0,
          status: asString(raw.lastAutomation.status, 20) || 'ok',
          note: asString(raw.lastAutomation.note, 300),
        }
      : null,
    lastRadarFetch: normalizeFetchReport(raw.lastRadarFetch),
    lastMentionsFetch: normalizeMentionsReport(raw.lastMentionsFetch),
    audit: ensureArray(raw.audit).slice(-AUDIT_LIMIT),
  }
  return { state: state, migrated: (raw.version || 0) !== HOST_STATE_VERSION, corrupt: null }
}

function auditEntry(state, event, summary) {
  state.audit = ensureArray(state.audit).concat([
    { id: newId('audit'), at: hostNowIso(), event: event, summary: asString(summary, 300) },
  ])
  if (state.audit.length > AUDIT_LIMIT) state.audit = state.audit.slice(-AUDIT_LIMIT)
}

function seedDemoData(state) {
  const now = Date.now()
  const demoFeeds = [
    normalizeFeed({ label: 'Hacker News · LLM', url: 'https://hnrss.org/newest?q=LLM', topics: ['LLM'] }),
    normalizeFeed({ label: 'Hacker News · Agent', url: 'https://hnrss.org/newest?q=AI+agent', topics: ['Agent'] }),
  ]
  const demoFeedUrls = new Set(demoFeeds.map(function (feed) { return feed.url }))
  state.settings.feeds = ensureArray(state.settings.feeds)
    .filter(function (feed) {
      return !demoFeedUrls.has(feed.url)
    })
    .concat(demoFeeds)
  const projectId = state.projects.length > 0 ? state.projects[0].id : null
  state.projects = state.projects.concat([
    { id: 'proj-demo-gateway', name: '网关限流', repoPath: '', color: null },
  ])
  const demoProject = 'proj-demo-gateway'
  const due = function (hours) {
    return new Date(now + hours * 3600 * 1000).toISOString()
  }

  const demoSource = normalizeSource({
    provider: 'yunzhijia',
    externalId: 'demo-msg-1',
    url: null,
    title: '@我 · 网关压测群',
    excerpt: '张三：限流阈值在 2000 QPS 下仍然打到下游，@我 今天下班前给个结论，附压测报告。',
    fetchedAt: new Date(now - 3 * 3600 * 1000).toISOString(),
  })
  state.sources = state.sources.concat([demoSource])

  state.tasks = state.tasks.concat([
    normalizeTask({
      title: '给出网关限流阈值结论',
      description: '在 2000 QPS 压测下复现下游打满，输出阈值建议与压测报告链接。',
      status: 'ready',
      priority: 'urgent',
      dueAt: due(6),
      projectId: demoProject,
      tags: ['后端', '限流'],
      assignee: '我',
      sourceRefId: demoSource.id,
      confidence: 0.82,
      aiExtracted: true,
      demo: true,
    }, null),
    normalizeTask({
      title: '评审 Tokenizer 选型对比',
      description: '比较三种分词方案在中文技术文档上的召回与成本。',
      status: 'ready',
      priority: 'high',
      dueAt: due(30),
      projectId: demoProject,
      tags: ['RAG', '评测'],
      demo: true,
    }, null),
    normalizeTask({
      title: '补充 Docker 只读诊断的权限说明',
      description: '在设计报告 §7.1 中补充 L1 只读诊断的边界。',
      status: 'completed',
      priority: 'normal',
      dueAt: due(-20),
      projectId: demoProject,
      tags: ['文档'],
      demo: true,
    }, null),
  ])

  state.radar = state.radar.concat([
    normalizeRadarItem({
      title: 'Harness Web Client Slots：扩展点从装饰走向整页',
      source: '官方文档',
      url: 'https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/slots',
      publishedAt: new Date(now - 26 * 3600 * 1000).toISOString(),
      topics: ['Agent', 'RAG'],
      summary: {
        change: '插槽体系把 main 面板开放为按 key 派发，插件可以注册独立页面而不改核心代码。',
        usage: '适合把跨模块的工作入口做成一个常驻面板，而不是塞进会话流。',
        risk: 'Slot 注册与主题、语言、Remote 契约都随版本演进，需要版本固定与回归。',
        practice: '先用最小页面验证 Slots + Remote 全链路，再堆业务模块。',
      },
      demo: true,
    }, null),
    normalizeRadarItem({
      title: 'RAG 评测：把“检索召回”和“答案忠实度”分开度量',
      source: '研发博客',
      url: null,
      publishedAt: new Date(now - 50 * 3600 * 1000).toISOString(),
      topics: ['RAG', 'LLM'],
      summary: {
        change: '单一端到端分数掩盖了两段误差，分层度量后才能定位是检索还是生成的问题。',
        usage: '适合在知识问答上线前建立基线。',
        risk: '评测集泄露会让分数虚高。',
        practice: '为每个失败样本标注是“没检索到”还是“检索到但答错”。',
      },
      demo: true,
    }, null),
  ])

  state.runs = state.runs.concat([
    normalizeRun({
      taskId: state.tasks[state.tasks.length - 1].id,
      sessionId: null,
      status: 'completed',
      profile: 'Coding Agent',
      summary: '补充了 §7.1 的 L1 边界说明并提交到设计报告。',
      steps: [
        { at: new Date(now - 21 * 3600 * 1000).toISOString(), text: '读取设计报告 §7.1' },
        { at: new Date(now - 20.5 * 3600 * 1000).toISOString(), text: '写入只读诊断边界说明' },
      ],
      evidence: [{ label: '设计报告 §7.1', url: null }],
      startedAt: new Date(now - 21 * 3600 * 1000).toISOString(),
    }, null),
  ])

  state.knowledge = state.knowledge.concat([
    normalizeKnowledge({
      kind: 'bookmark',
      title: 'Harness Web Client Slots 参考',
      url: 'https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/slots',
      body: '注册 main / sidebar.panellist 的最小示例。',
      tags: ['Harness', 'Slots'],
    }),
  ])

  return state
}

/** A paste-ready brief for a task, used by the Agent center and the UI. */
function taskBrief(task, source) {
  const lines = []
  lines.push('## 任务：' + task.title)
  lines.push('')
  lines.push('- 状态：' + task.status + ' · 优先级：' + task.priority)
  if (task.dueAt) lines.push('- 截止：' + task.dueAt)
  if (task.assignee) lines.push('- 负责人：' + task.assignee)
  lines.push('')
  if (task.description) {
    lines.push('### 背景')
    lines.push(task.description)
    lines.push('')
  }
  if (source) {
    lines.push('### 来源证据')
    lines.push('- ' + source.provider + ' · ' + source.title)
    if (source.url) lines.push('- ' + source.url)
    if (source.excerpt) lines.push('- 原文摘录：' + source.excerpt)
    lines.push('')
  }
  lines.push('### 期望产出')
  lines.push('1. 结论与依据（引用来源）')
  lines.push('2. 可执行的下一步')
  lines.push('3. 需要人工确认的风险点')
  return lines.join('\n')
}
