/* ============================================================================
 * dev-workbench host — AI 结构化识别（TODO 15）
 *
 * 复用 DSH 原生会话链路（sessions + sessionController.prompt）做结构化提取：
 *   队列条目 → 严格 JSON 提示词 → 原生模型 → 回复解析/校验 → 合并语义
 *
 * 合并规则（TODO 15/16）：
 *   - 噪声（问候/感谢/纯知会）→ 标记 noise，不建任务；
 *   - 一条消息可拆多个事项（items 上限 6）；
 *   - 若已存在引用同一来源的待办 → 更新那条（追加 sourceRefs / 字段），不重建；
 *   - settings.aiExtract.autoRegister 开启时自动建待办，否则条目停在
 *     awaiting_human 等人工确认（analyzeConfirm 建任务）；
 *   - humanGuard.editedFields 里的字段绝不被 AI 覆盖（TODO 17 人工保护）。
 * ========================================================================== */

const ANALYSIS_TURN_TIMEOUT_MS = 90000
const ANALYSIS_POLL_MS = 350

function analysisPrompt(source, existingTitles) {
  const lines = []
  lines.push('请把下面这条云之家消息解析成结构化事项，只输出一个 JSON 对象，不要输出其它文字。')
  lines.push('')
  lines.push('消息内容：')
  lines.push(source.excerpt || source.title || '')
  lines.push('')
  lines.push('已有待办标题（判断是否同一事项的参考，需要续接时用其中一个 title）：')
  lines.push(existingTitles.slice(0, 12).map(function (title) { return '- ' + title }).join('\n') || '（暂无）')
  lines.push('')
  lines.push('输出 JSON 格式：')
  lines.push('{')
  lines.push('  "noise": true|false,')
  lines.push('  "summary": "一句话概括",')
  lines.push('  "items": [')
  lines.push('    { "needsReply": true|false, "needsAction": true|false, "eventType": "meeting|feature|logging|other|null", "title": "事项标题", "dueAt": "ISO 日期|null", "deliverable": "交付物|null", "replyStage": "待答复|已确认收到|已实质答复|null" }')
  lines.push('  ]')
  lines.push('}')
  lines.push('规则：问候/感谢/表情/纯知会 → noise=true 且 items=[]；询问不是承诺，不编造负责人或日期；一条消息可拆多个事项（最多 3 个）。')
  return lines.join('\n')
}

function extractJsonFromReply(reply) {
  const text = String(reply || '')
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const candidates = []
  if (fenced) candidates.push(fenced[1])
  const braced = /\{[\s\S]*\}/.exec(text)
  if (braced) candidates.push(braced[0])
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object') return parsed
    } catch (e) {
      /* 尝试下一个候选 */
    }
  }
  return null
}

/** 校验来源存在 → 已存在引用它的待办（同一事项续接）。 */
function findTaskBySourceRef(state, sourceId) {
  return ensureArray(state.tasks).find(function (task) {
    if (task.sourceRefId === sourceId) return true
    return ensureArray(task.sourceRefs).some(function (ref) {
      return ref.sourceId === sourceId
    })
  }) || null
}

/** 把分析结果合并进状态：建待办（受配置与人工保护）或续接既有待办。 */
function mergeAnalysisIntoState(state, entry, analysis, options) {
  const mergeOptions = options || {}
  const source = ensureArray(state.sources).find(function (row) {
    return row.id === entry.sourceId
  })
  const sourceRef = { sourceId: entry.sourceId, msgId: entry.msgId, snippet: (source && source.excerpt ? String(source.excerpt).slice(0, 160) : null) }
  const existingTitles = ensureArray(state.tasks).map(function (task) { return task.title })
  const created = []
  const updated = []
  const createdReplies = []
  const items = ensureArray(analysis.items).slice(0, 3)
  // 拆多事项时，「同一来源消息」不是合并依据（多条事项共享一条证据是正常的）
  const multiItem = items.length > 1

  if (analysis.noise === true || items.length === 0) {
    return { created: created, updated: updated, createdReplies: createdReplies, noise: true }
  }

  for (const item of items) {
    /** TODO 16 重构：needsReply → 回复实体（平行于待办；upsert by msgId，不受 autoRegister 限制） */
    if (item.needsReply === true) {
      const stage = item.replyStage === '已确认收到' || item.replyStage === '已实质答复' ? '已回复' : '待回复'
      const replyResult = upsertReply(state, entry, source, stage)
      if (replyResult.created) createdReplies.push(replyResult.reply)
    }
    // 仅回复义务（needsReply && !needsAction）不产生待办——两个概念平行
    if (item.needsReply === true && item.needsAction !== true) {
      continue
    }

    const related = item.title
      ? ensureArray(state.tasks).find(function (task) {
          return existingTitles.indexOf(task.title) >= 0 && (task.title === item.title || task.title.indexOf(item.title) >= 0 || item.title.indexOf(task.title) >= 0)
        })
      : null
    const target = related || (multiItem ? null : findTaskBySourceRef(state, entry.sourceId))

    if (target && !analysis.noise) {
      // 续接：追加来源引用；不覆盖人工已编辑字段
      const guard = normalizeHumanGuard(target.humanGuard)
      const patch = {
        sourceRefs: ensureArray(target.sourceRefs).concat([sourceRef]),
        needsAction: target.needsAction === true || item.needsAction === true,
      }
      if (item.dueAt && guard.editedFields.indexOf('dueAt') < 0 && !target.dueAt) patch.dueAt = item.dueAt
      const applied = applyUpdateTask(state, target.id, patch)
      updated.push(applied.entity)
      continue
    }

    // 新建：批量分析时受 autoRegister 控制；人工确认路径强制允许
    if (!mergeOptions.forceCreate && (!state.settings.aiExtract || state.settings.aiExtract.autoRegister !== true)) continue
    const payload = {
      title: item.title || (source ? source.title : '未命名事项'),
      description: (source ? String(source.excerpt || '').slice(0, 1000) : '') + (item.deliverable ? '\n交付物：' + item.deliverable : ''),
      priority: item.dueAt ? 'high' : 'normal',
      dueAt: item.dueAt || null,
      tags: ['AI 识别'],
      aiExtracted: true,
      sourceRefId: entry.sourceId,
      sourceRefs: [sourceRef],
      needsAction: item.needsAction !== false,
      eventType: item.eventType || null,
      deliverable: item.deliverable || null,
      confidence: 0.72,
      projectId: state.settings.defaultProjectId || undefined,
    }
    const applied = applyCreateTask(state, payload)
    created.push(applied.entity)
  }

  return { created: created, updated: updated, createdReplies: createdReplies, noise: false }
}

/** upsert 回复义务：同一消息只有一条回复记录；阶段/摘录可更新。 */
function upsertReply(state, entry, source, stage) {
  const existing = ensureArray(state.replies).find(function (row) {
    return row.msgId === entry.msgId
  })
  const contact = source && (source.sender || null)
  if (existing) {
    const next = Object.assign({}, existing, {
      stage: stage || existing.stage,
      snippet: source ? String(source.excerpt || '').slice(0, 300) : existing.snippet,
      updatedAt: hostNowIso(),
    })
    state.replies = ensureArray(state.replies).map(function (row) {
      return row.id === existing.id ? next : row
    })
    return { reply: next, created: false }
  }
  const reply = normalizeReplies([{
    id: newId('rep'),
    sourceId: entry.sourceId,
    msgId: entry.msgId,
    groupId: entry.groupId || (source && source.locator && source.locator.groupId) || null,
    groupName: (source && source.locator && source.locator.groupName) || null,
    contact: contact,
    snippet: source ? String(source.excerpt || '').slice(0, 300) : null,
    stage: stage || '待回复',
    createdAt: hostNowIso(),
  }])[0]
  state.replies = ensureArray(state.replies).concat([reply]).slice(-300)
  return { reply: reply, created: true }
}


/**
 * 手动/后台触发的分析批处理：从队列取 pending（或重放 failed<3），逐条调原生会话。
 * 单条失败计入 attempts/lastError，不阻断批次其余条目。
 */
async function runAnalysisBatch(ctx, request) {
  const controller = hostService(ctx, 'sessionController')
  if (!controller || typeof controller.prompt !== 'function') {
    return { status: 'unavailable', note: '宿主没有 sessionController 服务，无法运行 AI 识别。' }
  }
  const settings = loadWorkbenchState().settings
  if (!settings.aiExtract || settings.aiExtract.enabled !== true) {
    return { status: 'disabled', note: 'AI 识别未开启（设置 → 自动化 → AI 识别）。' }
  }
  const resolved = await ensureAssistantSession(ctx)
  if (!resolved) return { status: 'unavailable', note: '当前宿主没有可用的 sessions / sessionController 服务。' }

  const input = request && typeof request === 'object' ? request : {}
  const limit = Math.max(1, Math.min(20, Number(input.limit) || (settings.aiExtract.batchSize || 5)))
  const at = hostNowIso()

  const state0 = loadWorkbenchState()
  const queue = ensureArray(state0.analysisQueue)
  const sources = ensureArray(state0.sources)
  const entries = queue
    .filter(function (row) {
      return row.status === 'pending' || (row.status === 'failed' && (Number(row.attempts) || 0) < 3)
    })
    .filter(function (row) {
      return sources.some(function (source) { return source.id === row.sourceId })
    })
    .slice(0, limit)

  const processed = []
  const failures = []

  for (const entry of entries) {
    const source = sources.find(function (row) { return row.id === entry.sourceId })
    if (!source) continue

    const titles = ensureArray(loadWorkbenchState().tasks).map(function (task) { return task.title })
    const submitted = await submitPrompt(ctx, controller, resolved, analysisPrompt(source, titles), false)
    const session = submitted.session
    const fromSeq = submitted.fromSeq

    const deadline = Date.now() + ANALYSIS_TURN_TIMEOUT_MS
    let reply = ''
    while (Date.now() < deadline) {
      await sleepMs(ANALYSIS_POLL_MS)
      const delta = transcriptDelta(session, fromSeq)
      const assistantTexts = delta.entries
        .filter(function (row) { return row.role === 'assistant' })
        .map(function (row) { return row.text })
      if (assistantTexts.length > 0) reply = assistantTexts.join('\n\n')
      if (!delta.turnActive) break
    }

    const parsed = extractJsonFromReply(reply)
    if (!parsed) {
      failures.push(entry.sourceId)
      await mutateWorkbenchState(function (current) {
        current.analysisQueue = ensureArray(current.analysisQueue).map(function (row) {
          if (row.id !== entry.id) return row
          return Object.assign({}, row, {
            status: 'failed',
            attempts: (Number(row.attempts) || 0) + 1,
            lastError: '模型回复无法解析为 JSON',
          })
        })
        return current
      })
      continue
    }

    await mutateWorkbenchState(function (current) {
      const analysis = {
        noise: parsed.noise === true,
        items: ensureArray(parsed.items).slice(0, 6),
        summary: asString(parsed.summary, 400) || null,
      }
      const queueRow = ensureArray(current.analysisQueue).find(function (row) {
        return row.id === entry.id
      })
      const merged = mergeAnalysisIntoState(current, queueRow || entry, analysis)
      const hasTaskProgress = merged.created.length > 0 || merged.updated.length > 0
      const replyBuilt = merged.createdReplies.length > 0
      const actionPending = !hasTaskProgress && ensureArray(parsed.items).some(function (item) {
        return item.needsAction === true
      })
      current.analysisQueue = ensureArray(current.analysisQueue).map(function (row) {
        if (row.id !== entry.id) return row
        // 回复建档即完成沟通侧；处理义务未自动登记（autoRegister 关）时停在待人工确认
        const status = actionPending ? 'awaiting_human' : hasTaskProgress || analysis.noise || replyBuilt ? 'done' : 'awaiting_human'
        return Object.assign({}, row, {
          status: status,
          analyzedAt: hostNowIso(),
          analysis: analysis,
          taskIds: merged.created.map(function (task) { return task.id }).concat(merged.updated.map(function (task) { return task.id })).slice(0, 6),
        })
      })
      auditEntry(current, 'analysis.run', entry.sourceId + ' → ' + (merged.noise ? '噪声' : '回复 ' + merged.createdReplies.length + ' / 待办 ' + merged.created.length + ' 新建 / ' + merged.updated.length + ' 续接'))
      return current
    })
    processed.push(entry.sourceId)
  }

  return {
    status: failures.length > 0 ? 'partial' : 'ok',
    processed: processed.length,
    failures: failures.length,
    note: failures.length > 0 ? failures.join('、') : null,
  }
}

/** 人工确认：把 awaiting_human 的条目按已保存的分析建待办（不调模型）。 */
async function confirmAnalysis(ctx, entryId) {
  const entry = ensureArray(loadWorkbenchState().analysisQueue).find(function (row) {
    return row.id === entryId
  })
  if (!entry || !entry.analysis) throw new Error('找不到该分析条目或它还没有分析结果：' + String(entryId))
  if (entry.status === 'done') return loadWorkbenchState()
  return mutateWorkbenchState(function (current) {
    const merged = mergeAnalysisIntoState(current, entry, entry.analysis, { forceCreate: true })
    current.analysisQueue = ensureArray(current.analysisQueue).map(function (row) {
      if (row.id !== entry.id) return row
      return Object.assign({}, row, {
        status: 'done',
        analyzedAt: hostNowIso(),
        taskIds: merged.created.map(function (task) { return task.id }).concat(merged.updated.map(function (task) { return task.id })).slice(0, 6),
      })
    })
    auditEntry(current, 'analysis.confirmed', entry.sourceId)
    return current
  })
}
