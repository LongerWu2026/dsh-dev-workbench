/* ============================================================================
 * dev-workbench host — workbench service
 *
 * The single authority for workbench state. Every mutation returns the whole
 * new snapshot, so the Client never has to merge: it swaps. That is the
 * "Host 维护可重建快照" contract from design report §5.2, kept deliberately
 * boring so a reconnecting Client cannot drift.
 * ========================================================================== */

let workbenchCtx = null

function workbenchContext() {
  return workbenchCtx
}

async function workbenchServiceState() {
  const state = loadWorkbenchState()
  const ctx = workbenchContext()
  if (!ctx) return state
  try {
    return await refreshConnectors(ctx, state)
  } catch (e) {
    return state
  }
}

function requireTask(state, id) {
  const task = ensureArray(state.tasks).find(function (item) {
    return item.id === id
  })
  if (!task) throw new Error('找不到该待办：' + String(id))
  return task
}

/* ---------------------------------------------------------------------------
 * 统一写入原语：返回 { state, entity }，由 workbenchApi 与 Agent 工具共用。
 * 工具此前各自复制一份写入逻辑，容易与 Remote 路径行为分叉（TODO 04）。
 * ------------------------------------------------------------------------- */
function applyCreateTask(state, payload) {
  if (payload.projectId === undefined && state.settings.defaultProjectId) {
    payload.projectId = state.settings.defaultProjectId
  }
  const task = normalizeTask(payload, null)
  state.tasks = ensureArray(state.tasks).concat([task])
  auditEntry(state, 'task.created', task.title)
  return { state: state, entity: task }
}

function applyUpdateTask(state, id, patch) {
  const index = ensureArray(state.tasks).findIndex(function (task) {
    return task.id === id
  })
  if (index < 0) throw new Error('找不到该待办：' + String(id))
  const next = normalizeTask(patch || {}, state.tasks[index])
  next.id = state.tasks[index].id
  next.createdAt = state.tasks[index].createdAt
  state.tasks = state.tasks.slice()
  state.tasks[index] = next
  auditEntry(state, 'task.updated', next.title + ' → ' + next.status)
  return { state: state, entity: next }
}

function applyRecordRun(state, payload) {
  const run = normalizeRun(payload || {}, null)
  if (run.taskId && !ensureArray(state.tasks).some(function (task) {
    return task.id === run.taskId
  })) {
    throw new Error('关联的待办不存在：' + run.taskId)
  }
  state.runs = ensureArray(state.runs).concat([run])
  if (run.taskId) {
    state.tasks = ensureArray(state.tasks).map(function (task) {
      if (task.id !== run.taskId) return task
      const next = Object.assign({}, task)
      next.runIds = ensureArray(task.runIds).concat([run.id])
      next.updatedAt = hostNowIso()
      if (run.status === 'failed') next.status = 'failed'
      else if (run.status === 'running' && (task.status === 'ready' || task.status === 'draft')) next.status = 'running'
      return next
    })
  }
  auditEntry(state, 'agent.run.created', run.summary || run.id)
  return { state: state, entity: run }
}

const workbenchApi = {
  async snapshot() {
    return workbenchServiceState()
  },

  async saveSettings(patch) {
    return mutateWorkbenchState(function (state) {
      state.settings = normalizeSettings(Object.assign({}, state.settings, patch || {}))
      auditEntry(state, 'settings.updated', '更新设置：' + Object.keys(patch || {}).join(', '))
      return state
    })
  },

  async createTask(input) {
    const payload = input && typeof input === 'object' ? Object.assign({}, input) : {}
    if (!asString(payload.title, 200)) throw new Error('待办标题不能为空')
    return mutateWorkbenchState(function (state) {
      return applyCreateTask(state, payload).state
    })
  },

  async updateTask(id, patch) {
    return mutateWorkbenchState(function (state) {
      return applyUpdateTask(state, id, patch).state
    })
  },

  async deleteTask(id) {
    return mutateWorkbenchState(function (state) {
      const task = requireTask(state, id)
      state.tasks = ensureArray(state.tasks).filter(function (item) {
        return item.id !== id
      })
      state.runs = ensureArray(state.runs).filter(function (run) {
        return run.taskId !== id
      })
      auditEntry(state, 'task.deleted', task.title)
      return state
    })
  },

  async addSource(input) {
    const source = normalizeSource(input || {})
    return mutateWorkbenchState(function (state) {
      const duplicate = ensureArray(state.sources).find(function (item) {
        return item.payloadHash === source.payloadHash
      })
      if (!duplicate) {
        state.sources = ensureArray(state.sources).concat([source])
        auditEntry(state, 'source.added', source.title)
      }
      return state
    })
  },

  async createKnowledge(input) {
    const item = normalizeKnowledge(input || {})
    return mutateWorkbenchState(function (state) {
      const duplicate = ensureArray(state.knowledge).find(function (existing) {
        return existing.title === item.title && (existing.url || '') === (item.url || '')
      })
      if (!duplicate) {
        state.knowledge = ensureArray(state.knowledge).concat([item])
        auditEntry(state, 'knowledge.created', item.title)
      }
      return state
    })
  },

  async updateKnowledge(id, patch) {
    return mutateWorkbenchState(function (state) {
      const existing = ensureArray(state.knowledge).find(function (item) {
        return item.id === id
      })
      if (!existing) throw new Error('找不到该知识条目：' + String(id))
      const next = normalizeKnowledge(patch || {}, existing)
      next.id = existing.id
      state.knowledge = ensureArray(state.knowledge).map(function (item) {
        return item.id === id ? next : item
      })
      auditEntry(state, 'knowledge.updated', next.title)
      return state
    })
  },

  async deleteKnowledge(id) {
    return mutateWorkbenchState(function (state) {
      state.knowledge = ensureArray(state.knowledge).filter(function (item) {
        return item.id !== id
      })
      auditEntry(state, 'knowledge.deleted', String(id))
      return state
    })
  },

  async saveRadarItem(input) {
    const payload = input && typeof input === 'object' ? input : {}
    return mutateWorkbenchState(function (state) {
      const list = ensureArray(state.radar)
      const existing = payload.id
        ? list.find(function (item) {
            return item.id === payload.id
          })
        : payload.url
          ? list.find(function (item) {
              return item.url === asUrl(payload.url)
            })
          : null
      const item = normalizeRadarItem(payload, existing || null)
      state.radar = existing
        ? list.map(function (row) {
            return row.id === item.id ? item : row
          })
        : list.concat([item])
      auditEntry(state, existing ? 'radar.updated' : 'radar.added', item.title)
      return state
    })
  },

  async deleteRadarItem(id) {
    return mutateWorkbenchState(function (state) {
      state.radar = ensureArray(state.radar).filter(function (item) {
        return item.id !== id
      })
      auditEntry(state, 'radar.deleted', String(id))
      return state
    })
  },

  async recordRun(input) {
    return mutateWorkbenchState(function (state) {
      return applyRecordRun(state, input).state
    })
  },

  async updateRun(id, patch) {
    return mutateWorkbenchState(function (state) {
      const run = ensureArray(state.runs).find(function (item) {
        return item.id === id
      })
      if (!run) throw new Error('找不到该执行记录：' + String(id))
      const next = normalizeRun(Object.assign({}, patch || {}, { taskId: run.taskId }), run)
      next.id = run.id
      next.startedAt = run.startedAt
      state.runs = ensureArray(state.runs).map(function (item) {
        return item.id === id ? next : item
      })
      if (next.taskId && next.status === 'completed') {
        state.tasks = ensureArray(state.tasks).map(function (task) {
          if (task.id !== next.taskId) return task
          return Object.assign({}, task, { updatedAt: hostNowIso() })
        })
      }
      auditEntry(state, 'agent.run.' + next.status, next.summary || next.id)
      return state
    })
  },

  async reset(scope) {
    const target = scope === 'tasks' || scope === 'runs' ? scope : 'all'
    return mutateWorkbenchState(function (state) {
      if (target === 'tasks') {
        const removed = ensureArray(state.tasks).length
        state.tasks = []
        state.runs = []
        auditEntry(state, 'state.reset', '清空 ' + removed + ' 条待办与全部执行记录')
        return state
      }
      if (target === 'runs') {
        state.runs = []
        auditEntry(state, 'state.reset', '清空执行记录')
        return state
      }
      state.tasks = []
      state.runs = []
      state.knowledge = []
      state.radar = []
      state.sources = []
      state.audit = []
      auditEntry(state, 'state.reset', '清空业务数据，保留设置')
      return state
    })
  },

  async seedDemo() {
    return mutateWorkbenchState(function (state) {
      state.tasks = ensureArray(state.tasks).filter(function (task) {
        return task.demo !== true
      })
      state.radar = ensureArray(state.radar).filter(function (item) {
        return item.demo !== true
      })
      state.sources = ensureArray(state.sources).filter(function (item) {
        return asString(item.externalId, 40) !== 'demo-msg-1'
      })
      state.runs = []
      seedDemoData(state)
      auditEntry(state, 'state.seeded', '载入示例数据')
      return state
    })
  },

  async saveProject(input) {
    const payload = input && typeof input === 'object' ? input : {}
    const repoPath = asString(payload.repoPath, 500)
    if (!repoPath) throw new Error('仓库目录不能为空')
    return mutateWorkbenchState(function (state) {
      const list = ensureArray(state.projects)
      const existing = payload.id
        ? list.find(function (project) {
            return project.id === payload.id
          })
        : list.find(function (project) {
            return project.repoPath === repoPath
          })
      const project = normalizeProject(payload, existing || null)
      project.repoPath = repoPath
      state.projects = existing
        ? list.map(function (item) {
            return item.id === project.id ? project : item
          })
        : list.concat([project])
      invalidateEnvironmentCache()
      auditEntry(state, existing ? 'project.updated' : 'project.created', project.name + ' · ' + project.repoPath)
      return state
    })
  },

  async deleteProject(id) {
    return mutateWorkbenchState(function (state) {
      const target = ensureArray(state.projects).find(function (project) {
        return project.id === id
      })
      state.projects = ensureArray(state.projects).filter(function (project) {
        return project.id !== id
      })
      state.tasks = ensureArray(state.tasks).map(function (task) {
        return task.projectId === id ? Object.assign({}, task, { projectId: null }) : task
      })
      if (state.settings.defaultProjectId === id) state.settings.defaultProjectId = null
      invalidateEnvironmentCache()
      auditEntry(state, 'project.deleted', target ? target.name : String(id))
      return state
    })
  },

  async fetchRadar() {
    // 未配置 RSS 时按关注主题走联网发现（TODO 06 的默认路径）
    return runRadarFetchOrDiscover(workbenchContext())
  },

  /** 写回四段摘要（Agent 读原文后调用）；只改摘要字段，不动来源与时间。 */
  async updateRadar(id, patch) {
    return mutateWorkbenchState(function (state) {
      const item = ensureArray(state.radar).find(function (row) {
        return row.id === id
      })
      if (!item) throw new Error('找不到该资讯：' + String(id))
      const summary = patch && patch.summary && typeof patch.summary === 'object' ? patch.summary : null
      const index = state.radar.indexOf(item)
      const next = normalizeRadarItem(
        {
          title: patch && patch.title !== undefined ? patch.title : item.title,
          topics: patch && patch.topics !== undefined ? patch.topics : item.topics,
          summary: summary
            ? {
                change: asString(summary.change, 800),
                usage: asString(summary.usage, 800),
                risk: asString(summary.risk, 800),
                practice: asString(summary.practice, 800),
              }
            : item.summary,
        },
        item,
      )
      next.id = item.id
      next.createdAt = item.createdAt
      state.radar = state.radar.slice()
      state.radar[index] = next
      auditEntry(state, 'radar.summary', next.title)
      return state
    })
  },

  /**
   * Design report §3.2: pull @-mention messages as source evidence through the
   * real yzj-cli. Deterministic collection only — turning a mention into a task
   * stays an agent decision, so nothing is auto-created here.
   */
  /** 规则候选提取（确定性，无模型）：为尚未提取的 @我 来源生成待确认候选。 */
  async extractCandidates() {
    return mutateWorkbenchState(function (state) {
      return extractCandidatesInto(state)
    })
  },

  /** 采纳候选：原子地建任务（带来源证据）并把候选标记为已采纳。 */
  async acceptCandidate(id, patch) {
    const input = patch && typeof patch === 'object' ? patch : {}
    return mutateWorkbenchState(function (state) {
      const candidate = ensureArray(state.candidates).find(function (row) {
        return row.id === id
      })
      if (!candidate) throw new Error('找不到该候选：' + String(id))
      if (candidate.status === 'accepted' && candidate.taskId) {
        return state
      }
      const task = normalizeTask(
        {
          title: input.title || candidate.title,
          description:
            input.description ||
            [candidate.excerpt, candidate.sourceTitle ? '来源：' + candidate.sourceTitle : '']
              .filter(Boolean)
              .join('\n'),
          status: input.status || 'ready',
          priority: input.priority || 'normal',
          dueAt: input.dueAt === undefined ? candidate.dueAt : input.dueAt,
          tags: input.tags || [],
          sourceRefId: candidate.sourceRefId,
          projectId: state.settings ? state.settings.defaultProjectId : null,
          aiExtracted: true,
          confidence: candidate.confidence,
        },
        null,
      )
      state.tasks = ensureArray(state.tasks).concat([task])
      const index = state.candidates.indexOf(candidate)
      const next = normalizeCandidate(
        Object.assign({}, candidate, { status: 'accepted', taskId: task.id }),
        candidate,
      )
      next.status = 'accepted'
      next.taskId = task.id
      state.candidates = state.candidates.slice()
      state.candidates[index] = next
      auditEntry(state, 'candidate.accepted', task.title)
      return state
    })
  },

  async rejectCandidate(id) {
    return mutateWorkbenchState(function (state) {
      const candidate = ensureArray(state.candidates).find(function (row) {
        return row.id === id
      })
      if (!candidate) throw new Error('找不到该候选：' + String(id))
      const index = state.candidates.indexOf(candidate)
      state.candidates = state.candidates.slice()
      state.candidates[index] = normalizeCandidate(Object.assign({}, candidate, { status: 'rejected' }), candidate)
      state.candidates[index].status = 'rejected'
      auditEntry(state, 'candidate.rejected', candidate.title)
      return state
    })
  },

  async fetchMentions() {
    return mutateWorkbenchState(function (state) {
      return fetchYunzhijiaMentionsInto(workbenchContext(), state)
    })
  },

  /**
   * Design report §3.1 后续行动: turn one radar item into a real task, keeping
   * the source evidence. Atomic on the Host so the task can never exist
   * without its SourceRef.
   */
  async createTaskFromRadar(id) {
    return mutateWorkbenchState(function (state) {
      const item = ensureArray(state.radar).find(function (row) {
        return row.id === id
      })
      if (!item) throw new Error('找不到该资讯：' + String(id))

      const summary = item.summary || {}
      const brief = [
        summary.change ? '技术变化：' + summary.change : '',
        summary.usage ? '应用场景：' + summary.usage : '',
        summary.risk ? '采用风险：' + summary.risk : '',
        summary.practice ? '推荐实践：' + summary.practice : '',
        item.excerpt ? '原文摘录：' + item.excerpt : '',
        item.url ? '原文：' + item.url : '',
      ]
        .filter(Boolean)
        .join('\n')

      const source = normalizeSource({
        provider: asString(item.source, 40) || 'radar',
        url: item.url,
        title: item.title,
        excerpt: brief.slice(0, 2000),
        fetchedAt: item.publishedAt || item.updatedAt || hostNowIso(),
      })
      const duplicate = ensureArray(state.sources).find(function (row) {
        return row.payloadHash === source.payloadHash
      })
      const sourceId = duplicate ? duplicate.id : source.id
      if (!duplicate) {
        state.sources = ensureArray(state.sources).concat([source])
      }

      const duplicateTask = ensureArray(state.tasks).find(function (row) {
        return row.sourceRefId === sourceId && row.title === '实践：' + item.title
      })
      if (duplicateTask) {
        auditEntry(state, 'task.fromRadar', '重复生成已忽略：' + item.title)
        return state
      }
      const task = normalizeTask(
        {
          title: '实践：' + item.title,
          description: brief,
          status: 'ready',
          priority: 'normal',
          tags: asTags(item.topics),
          sourceRefId: sourceId,
          projectId: state.settings ? state.settings.defaultProjectId : null,
        },
        null,
      )
      state.tasks = ensureArray(state.tasks).concat([task])
      auditEntry(state, 'task.fromRadar', task.title)
      return state
    })
  },

  async search(request) {
    return runUnifiedSearch(workbenchContext(), request || {})
  },

  async environment() {
    return buildEnvironment(workbenchContext())
  },

  /** GitHub 只读快照（PR / CI），走 gh CLI 白名单命令。 */
  async github() {
    return buildGithubSnapshot(workbenchContext())
  },

  /** 按消息 id 取助手回复正文（原生聊天内嵌动作使用）。 */
  async assistantMessage(request) {
    return readAssistantMessage(workbenchContext(), request || {})
  },

  /** 删除来源证据：同时清理派生候选，并把引用它的待办解除来源关联。 */
  async deleteSource(id) {
    return mutateWorkbenchState(function (state) {
      const sourceId = String(id)
      const exists = ensureArray(state.sources).some(function (row) {
        return row.id === sourceId
      })
      if (!exists) throw new Error('找不到该来源：' + sourceId)
      state.sources = ensureArray(state.sources).filter(function (row) {
        return row.id !== sourceId
      })
      state.candidates = ensureArray(state.candidates).filter(function (candidate) {
        return candidate.sourceRefId !== sourceId
      })
      state.tasks = ensureArray(state.tasks).map(function (task) {
        if (task.sourceRefId !== sourceId) return task
        return Object.assign({}, task, { sourceRefId: null, updatedAt: hostNowIso() })
      })
      auditEntry(state, 'source.deleted', '删除来源 ' + sourceId)
      return state
    })
  },

  /** 删除执行记录：同步从关联任务的 runIds 中移除。 */
  async deleteRun(id) {
    return mutateWorkbenchState(function (state) {
      const runId = String(id)
      const exists = ensureArray(state.runs).some(function (row) {
        return row.id === runId
      })
      if (!exists) throw new Error('找不到该执行记录：' + runId)
      state.runs = ensureArray(state.runs).filter(function (row) {
        return row.id !== runId
      })
      state.tasks = ensureArray(state.tasks).map(function (task) {
        if (ensureArray(task.runIds).indexOf(runId) < 0) return task
        return Object.assign({}, task, { runIds: ensureArray(task.runIds).filter(function (item) { return item !== runId }), updatedAt: hostNowIso() })
      })
      auditEntry(state, 'run.deleted', '删除执行记录 ' + runId)
      return state
    })
  },

  /** 删除候选（彻底移除，区别于 reject）。 */
  async deleteCandidate(id) {
    return mutateWorkbenchState(function (state) {
      const candidateId = String(id)
      const exists = ensureArray(state.candidates).some(function (row) {
        return row.id === candidateId
      })
      if (!exists) throw new Error('找不到该候选：' + candidateId)
      state.candidates = ensureArray(state.candidates).filter(function (row) {
        return row.id !== candidateId
      })
      auditEntry(state, 'candidate.deleted', '删除候选 ' + candidateId)
      return state
    })
  },

  /** 工作台助手：向原生会话提交提示并等待本轮回复（TODO 04）。 */
  async assistantAsk(request) {
    return runAssistantAsk(workbenchContext(), request || {})
  },

  /** 只提交提示（立即返回 fromSeq），配合 assistantDelta 做渐进渲染。 */
  async assistantSend(request) {
    return sendAssistantPrompt(workbenchContext(), request || {})
  },

  /** 增量读取会话记录（fromSeq 之后的新条目 + turnActive）。 */
  async assistantDelta(request) {
    return readAssistantDelta(workbenchContext(), request || {})
  },

  async assistantHistory() {
    return readAssistantHistory(workbenchContext())
  },

  /** 最近原生会话列表（供侧栏切换）。 */
  async assistantSessions(request) {
    return listAssistantSessions(workbenchContext(), request || {})
  },

  /** 读取指定会话的记录（缺省为助手会话）。 */
  async assistantTranscript(request) {
    return readAssistantTranscript(workbenchContext(), request || {})
  },

  async assistantReset() {
    return resetAssistantSession(workbenchContext())
  },

  /** 立即跑一次后台自动化（TODO 07）；返回本次结果。 */
  async automationRun() {
    return runAutomationTick(workbenchContext())
  },

  /** 自动化状态：是否开启、间隔、上次结果、是否到期。 */
  async automationStatus() {
    const state = loadWorkbenchState()
    const config = (state.settings && state.settings.automation) || {}
    return {
      enabled: config.enabled === true,
      intervalMinutes: Number(config.intervalMinutes) || 60,
      radar: config.radar !== false,
      mentions: config.mentions !== false,
      lastAutomation: state.lastAutomation || null,
      due: automationDue(state, Date.now()),
      note: '插件侧定时器：仅在 DSH 进程运行期间生效，退出/休眠时暂停，恢复后按到期补跑一次。',
    }
  },

  /** 手动备份 + 列出 + 恢复（TODO 11）。 */
  async backup() {
    const path = createBackup('manual')
    return {
      created: path,
      backups: listBackups().slice(0, BACKUP_KEEP),
    }
  },

  async backups() {
    return { backups: listBackups().slice(0, BACKUP_KEEP) }
  },

  async restoreBackup(id) {
    const state = restoreBackup(id)
    return state
  },

  /** 轻量版本探测：Client 轮询这个端点，只有 revision 变新才重取整份快照。 */
  async revision() {
    const state = loadWorkbenchState()
    return { revision: Number(state.revision) || 0, updatedAt: state.updatedAt }
  },

  async diagnostics() {
    const state = loadWorkbenchState()
    const path = workbenchStatePath()
    const toolNames = ensureArray(workbenchCtxToolNames())
    return {
      platform: HOST_META.platform,
      arch: HOST_META.arch,
      nodeVersion: HOST_META.nodeVersion,
      statePath: path,
      dataPath: path,
      dataBytes: fileSizeOf(path),
      counts: workbenchCounts(state),
      hostTime: hostNowIso(),
      loadNote: workbenchLoadNote,
      toolNames: toolNames,
    }
  },
}

/* ---------------------------------------------------------------------------
 * The Typert gateway resolves `workbench/<method>` by reading a `typertRemote`
 * binding off the service instance that `ctx.get('workbench')` returns — see
 * the gateway's validateBinding(): `Reflect.get(original, 'typertRemote')`
 * must yield `{ service: original, serviceKey: 'workbench', namespace: … }`,
 * otherwise it throws
 *   gateway/binding-invalid: Service "workbench" has no visible typertRemote
 *   binding
 * which is exactly the failure the shipped UI reported. `service` must be this
 * same object so readBinding()'s identity check passes; the frozen shape
 * mirrors bindTypertRemote() from @deepseek-ai/dsh-typert-protocol.
 * ------------------------------------------------------------------------- */
Object.defineProperty(workbenchApi, 'typertRemote', {
  value: Object.freeze({
    service: workbenchApi,
    serviceKey: 'workbench',
    namespace: 'workbench',
  }),
  enumerable: false,
  configurable: false,
  writable: false,
})

let workbenchToolNames = []

function workbenchCtxToolNames() {
  return workbenchToolNames
}

function registerWorkbenchToolNames(names) {
  workbenchToolNames = names.slice()
}
