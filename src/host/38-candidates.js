/* ============================================================================
 * dev-workbench host — 任务候选规则提取（设计报告 §3.2 AI 任务提取 / §8）
 *
 * 报告要的是「规则候选 → LLM 提取 → 结构校验 → 人工确认」。插件内没有模型，
 * 所以这一层只做**确定性规则候选**：行动词、时间线索、长度与指向性给出一个
 * 可解释的置信度，并把命中的规则逐条写进 reasons。低置信度同样进待确认区，
 * 由用户决定采纳或忽略——不自动建任务，也不假装这是 LLM 的结论。
 *
 * 每条候选都绑定 sourceRefId，采纳后任务仍可回溯到原消息（来源证据）。
 * ========================================================================== */

const CANDIDATE_ACTION_WORDS = [
  '请',
  '麻烦',
  '帮忙',
  '帮看',
  '看下',
  '看一下',
  '确认',
  '跟进',
  '处理',
  '提供',
  '安排',
  '给出',
  '回复',
  '支持',
  '排查',
  '修复',
  '评审',
  '同步',
  '整理',
  '输出',
  '评估',
  '补充',
  '对齐',
  '落地',
]

function candidateStartOfDay(offsetDays) {
  const date = new Date()
  date.setDate(date.getDate() + (offsetDays || 0))
  date.setHours(18, 0, 0, 0)
  return date
}

function candidateEndOfMonth() {
  const date = new Date()
  date.setMonth(date.getMonth() + 1, 0)
  date.setHours(18, 0, 0, 0)
  return date
}

/** 下一个周 X（周一=1），18:00。 */
function candidateNextWeekday(target) {
  const date = new Date()
  const current = date.getDay() === 0 ? 7 : date.getDay()
  let delta = target - current
  if (delta <= 0) delta += 7
  date.setDate(date.getDate() + delta)
  date.setHours(18, 0, 0, 0)
  return date
}

/**
 * 时间线索 → ISO。只映射**明确表达**的日期；「尽快」「尽早」不算日期，
 * 只记一条 reason（不编造截止时间）。
 */
function candidateDueFromText(text) {
  const source = String(text || '')
  const hits = []
  const put = function (label, date) {
    hits.push(label + ' → ' + date.toISOString().slice(0, 16).replace('T', ' '))
    return date.toISOString()
  }
  if (/今天|今日|下班前/.test(source)) return { dueAt: put('今天/下班前', candidateStartOfDay(0)), hits: hits }
  if (/明天|明日/.test(source)) return { dueAt: put('明天', candidateStartOfDay(1)), hits: hits }
  if (/后天/.test(source)) return { dueAt: put('后天', candidateStartOfDay(2)), hits: hits }
  const weekday = /(?:下)?周([一二三四五六日天])/.exec(source)
  if (weekday) {
    const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 }
    const target = map[weekday[1]]
    if (target) return { dueAt: put('周' + weekday[1], candidateNextWeekday(target)), hits: hits }
  }
  if (/本周|这周|周内/.test(source)) return { dueAt: put('本周内', candidateNextWeekday(5)), hits: hits }
  if (/下周/.test(source)) return { dueAt: put('下周', candidateNextWeekday(5)), hits: hits }
  if (/月底|本月末/.test(source)) return { dueAt: put('月底', candidateEndOfMonth()), hits: hits }
  if (/尽快|尽早|越快越好/.test(source)) {
    return { dueAt: null, hits: ['提到「尽快」但没有明确日期，未编造截止时间'] }
  }
  return { dueAt: null, hits: [] }
}

/** 从消息正文里切出一句可读的任务标题。 */
function candidateTitleFromText(text) {
  const source = String(text || '')
    .replace(/@\S+\s*/g, '')
    .replace(/\[图片\]|\[文件\]|\[链接\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!source) return ''
  const sentence = source.split(/[。!?！？\n]/).map(function (part) {
    return part.trim()
  }).filter(Boolean)[0]
  const picked = sentence || source
  return picked.length > 60 ? picked.slice(0, 58) + '…' : picked
}

/**
 * 对一条来源做规则提取。返回候选草稿或 null（无法提取）。
 * confidence 是**规则置信度**，不是模型概率，reasons 里逐条可查。
 */
function candidateFromSource(source) {
  const text = String((source && source.excerpt) || '').trim()
  if (!text) return null
  const title = candidateTitleFromText(text)
  if (!title) return null

  const reasons = []
  let confidence = 0.35

  const actionHit = CANDIDATE_ACTION_WORDS.filter(function (word) {
    return text.indexOf(word) >= 0
  })
  if (actionHit.length > 0) {
    confidence += 0.25
    reasons.push('命中行动词：' + actionHit.slice(0, 3).join(' / '))
  }

  const due = candidateDueFromText(text)
  if (due.dueAt) {
    confidence += 0.2
    reasons.push('时间线索：' + due.hits[0])
  } else if (due.hits.length > 0) {
    reasons.push(due.hits[0])
  }

  if (text.length <= 80) {
    confidence += 0.1
    reasons.push('正文较短，指向明确')
  } else {
    reasons.push('正文较长（' + text.length + ' 字），可能需要拆分')
  }

  if (/我|您|你/.test(text)) {
    confidence += 0.1
    reasons.push('正文直接指向收件人')
  }

  confidence = Math.min(0.9, Math.round(confidence * 100) / 100)
  if (reasons.length === 0) reasons.push('仅按正文长度给出基础置信度')

  return {
    sourceRefId: source.id,
    sourceTitle: source.title,
    title: title,
    excerpt: text.slice(0, 500),
    dueAt: due.dueAt,
    assignee: null,
    confidence: confidence,
    reasons: reasons,
    status: 'pending',
  }
}

/** 为所有「还没有候选」的云之家来源生成候选。返回新快照。 */
function extractCandidatesInto(state) {
  const sources = ensureArray(state.sources).filter(function (source) {
    return source.provider === 'yunzhijia'
  })
  const seen = new Set(
    ensureArray(state.candidates)
      .map(function (candidate) {
        return candidate.sourceRefId
      })
      .filter(Boolean),
  )
  let added = 0
  let skipped = 0
  for (const source of sources) {
    if (seen.has(source.id)) {
      skipped += 1
      continue
    }
    const draft = candidateFromSource(source)
    if (!draft) {
      skipped += 1
      continue
    }
    seen.add(source.id)
    state.candidates = ensureArray(state.candidates).concat([normalizeCandidate(draft, null)]).slice(-CANDIDATE_LIMIT)
    added += 1
  }
  state.lastExtract = {
    at: hostNowIso(),
    scanned: sources.length,
    added: added,
    skipped: skipped,
    note:
      sources.length === 0
        ? '还没有云之家 @我 来源：先在首页拉取 @我 消息，或在会话里让 Agent 调 workbench_fetch_mentions。'
        : '规则候选 = 行动词 + 时间线索 + 长度/指向性计算的置信度，不是模型结论；采纳前请人工核对。',
  }
  auditEntry(state, 'candidates.extract', '扫描 ' + sources.length + ' 条来源，新增候选 ' + added + ' 条')
  return state
}
