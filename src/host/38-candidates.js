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

/** 以基准时间（原消息时间）算偏移天数的 18:00。 */
function candidateStartOfDay(base, offsetDays) {
  const date = new Date(base.getTime())
  date.setDate(date.getDate() + (offsetDays || 0))
  date.setHours(18, 0, 0, 0)
  return date
}

function candidateEndOfMonth(base) {
  const date = new Date(base.getTime())
  date.setMonth(date.getMonth() + 1, 0)
  date.setHours(18, 0, 0, 0)
  return date
}

/** 基准时间之后的第 N 个周 X（周一=1），18:00。 */
function candidateNextWeekday(base, target) {
  const date = new Date(base.getTime())
  const current = date.getDay() === 0 ? 7 : date.getDay()
  let delta = target - current
  if (delta <= 0) delta += 7
  date.setDate(date.getDate() + delta)
  date.setHours(18, 0, 0, 0)
  return date
}

/** 下周同一工作日（下周一 + target-1 天），18:00。 */
function candidateNextWeek(base, target) {
  const date = new Date(base.getTime())
  const current = date.getDay() === 0 ? 7 : date.getDay()
  let delta = 8 - current
  if (delta <= 0) delta += 7
  date.setDate(date.getDate() + delta + ((target || 5) - 1))
  date.setHours(18, 0, 0, 0)
  return date
}

/**
 * 时间线索 → ISO。只映射**明确表达**的日期；「尽快」「尽早」不算日期，
 * 只记一条 reason（不编造截止时间）。
 */
function candidateDueFromText(text, baseTime) {
  const source = String(text || '')
  const base = baseTime instanceof Date && !Number.isNaN(baseTime.getTime()) ? baseTime : new Date()
  const hits = []
  const put = function (label, date) {
    hits.push(label + ' → ' + date.toISOString().slice(0, 16).replace('T', ' '))
    return date.toISOString()
  }
  // 顺序很重要：「明天下班前」应先命中「明天」，不能被「下班前」抢走
  if (/后天/.test(source)) return { dueAt: put('后天', candidateStartOfDay(base, 2)), hits: hits }
  if (/明天|明日/.test(source)) return { dueAt: put('明天', candidateStartOfDay(base, 1)), hits: hits }
  const nextWeek = /下周([一二三四五六日天])?/.exec(source)
  if (nextWeek) {
    const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 }
    const target = nextWeek[1] ? map[nextWeek[1]] : 5
    return { dueAt: put('下周' + (nextWeek[1] || '五'), candidateNextWeek(base, target)), hits: hits }
  }
  const weekday = /周([一二三四五六日天])/.exec(source)
  if (weekday) {
    const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 }
    const target = map[weekday[1]]
    if (target) return { dueAt: put('周' + weekday[1], candidateNextWeekday(base, target)), hits: hits }
  }
  if (/本周|这周|周内/.test(source)) return { dueAt: put('本周内', candidateNextWeekday(base, 5)), hits: hits }
  if (/月底|本月末/.test(source)) return { dueAt: put('月底', candidateEndOfMonth(base)), hits: hits }
  if (/今天|今日|下班前/.test(source)) return { dueAt: put('今天/下班前', candidateStartOfDay(base, 0)), hits: hits }
  if (/尽快|尽早|越快越好/.test(source)) {
    return { dueAt: null, hits: ['提到「尽快」但没有明确日期，未编造截止时间'] }
  }
  return { dueAt: null, hits: [] }
}

/** 从消息正文里切出一句可读的任务标题。 */
/**
 * 取消、已完成与否定表达：这类消息不该生成待办候选。
 * 只匹配明确的收尾语义，避免把「请确认是否取消」误判为取消。
 */
const CANDIDATE_CLOSED_PATTERNS = [
  /已(?:经)?(?:解决|修复|完成|处理完|上线|发布|关闭|搞定)/,
  /不用(?:再)?(?:处理|管|跟进|看了?)/,
  /无需(?:处理|跟进)/,
  /不必(?:处理|跟进)/,
  /(?:问题|这个|此事)(?:已)?(?:解决|关闭|完结)/,
  /取消(?:该|这个|此)?(?:任务|事项|需求)/,
  /作废/,
  /(?:搞定了|已搞定|OK ?了|ok ?了)/,
]

function candidateIsClosed(text) {
  const source = String(text || '')
  // 「请确认是否取消」这类是询问，不是取消本身
  if (/是否|需不需要|要不要|吗\?|吗？/.test(source) && /取消|关闭|作废/.test(source)) return false
  return CANDIDATE_CLOSED_PATTERNS.some(function (pattern) {
    return pattern.test(source)
  })
}

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
/**
 * 把一条消息切成若干「可提事项」句子。一条消息里常有多个交办，
 * 逐句判断能避免只取第一句而漏掉后面的要求。
 */
function candidateSentences(text) {
  return String(text || '')
    .replace(/@\S+\s*/g, '')
    .replace(/\[图片\]|\[文件\]|\[链接\]/g, '')
    .split(/[。!?！？\n]+/)
    .map(function (part) {
      return part.trim()
    })
    .filter(function (part) {
      return part.length >= 6
    })
    .slice(0, 4)
}

function candidateFromSentence(source, sentence, wholeText, baseTime) {
  if (candidateIsClosed(sentence) || candidateIsClosed(wholeText)) return null
  const title = candidateTitleFromText(sentence)
  if (!title) return null

  const reasons = []
  let confidence = 0.35

  const actionHit = CANDIDATE_ACTION_WORDS.filter(function (word) {
    return sentence.indexOf(word) >= 0
  })
  if (actionHit.length > 0) {
    confidence += 0.25
    reasons.push('命中行动词：' + actionHit.slice(0, 3).join(' / '))
  }

  // 相对日期以**原消息时间**为基准（历史消息里的「明天」指消息发出后的明天）
  const due = candidateDueFromText(sentence, baseTime)
  if (due.dueAt) {
    confidence += 0.2
    reasons.push('时间线索：' + due.hits[0])
  } else if (due.hits.length > 0) {
    reasons.push(due.hits[0])
  }

  if (sentence.length <= 80) {
    confidence += 0.1
    reasons.push('正文较短，指向明确')
  } else {
    reasons.push('正文较长（' + sentence.length + ' 字），可能需要拆分')
  }

  if (/我|您|你/.test(sentence)) {
    confidence += 0.1
    reasons.push('正文直接指向收件人')
  }

  confidence = Math.min(0.9, Math.round(confidence * 100) / 100)
  if (reasons.length === 0) reasons.push('仅按正文长度给出基础置信度')

  return {
    sourceRefId: source.id,
    sourceTitle: source.title,
    title: title,
    excerpt: sentence.slice(0, 500),
    dueAt: due.dueAt,
    assignee: null,
    confidence: confidence,
    reasons: reasons,
    status: 'pending',
    /** 明确标记来源：规则提取，不是模型判断 */
    extractor: 'rule',
  }
}

/** 一条来源 → 若干候选（一消息多事项）。取消/已完成语义整体跳过。 */
function candidatesFromSource(source) {
  const text = String((source && source.excerpt) || '').trim()
  if (!text) return []
  if (candidateIsClosed(text)) return []
  const baseTime = new Date(source.fetchedAt || source.createdAt || Date.now())
  const sentences = candidateSentences(text)
  const pool = sentences.length > 0 ? sentences : [text]
  const out = []
  for (const sentence of pool) {
    const candidate = candidateFromSentence(source, sentence, text, baseTime)
    if (candidate) out.push(candidate)
  }
  return out.slice(0, 3)
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
  let closed = 0
  for (const source of sources) {
    if (seen.has(source.id)) {
      skipped += 1
      continue
    }
    if (candidateIsClosed(source.excerpt)) {
      // 已解决 / 不用处理 / 取消：不生成候选，但记一次跳过，便于核对
      closed += 1
      seen.add(source.id)
      continue
    }
    const drafts = candidatesFromSource(source)
    if (drafts.length === 0) {
      skipped += 1
      continue
    }
    seen.add(source.id)
    for (const draft of drafts) {
      state.candidates = ensureArray(state.candidates).concat([normalizeCandidate(draft, null)]).slice(-CANDIDATE_LIMIT)
      added += 1
    }
  }
  state.lastExtract = {
    at: hostNowIso(),
    scanned: sources.length,
    added: added,
    skipped: skipped,
    closed: closed,
    note:
      sources.length === 0
        ? '还没有云之家 @我 来源：先在首页拉取 @我 消息，或在会话里让 Agent 调 workbench_fetch_mentions。'
        : '规则候选 = 行动词 + 时间线索（以原消息时间为基准）+ 长度/指向性，不是模型结论；' +
          '已解决/不用处理类消息会自动跳过（本次 ' +
          closed +
          ' 条）；采纳前请人工核对。',
  }
  auditEntry(state, 'candidates.extract', '扫描 ' + sources.length + ' 条来源，新增候选 ' + added + ' 条')
  return state
}
