/* ============================================================================
 * dev-workbench host — 资讯四段摘要批处理（TODO 20）
 *
 * 流程与 15 的分析批处理一致（复用 19 的执行纪律）：
 *   挑四段为空的资讯 → web.fetch 读原文（每条独立容错）→ 严格 JSON 提示 →
 *   原生会话 → 解析/校验 → writeRadarSummary（不改动来源/发布时间）→
 *   lastRadarSummarize 如实记录 done/failed。
 *
 * 纪律：
 *   - 单条失败不影响其余批次（partial 如实）；
 *   - 原文超过 4000 字截断，提示词明确「不在原文中的不得编造」；
 *   - 每条独立 muted failure 保留原因。
 * ========================================================================== */

const SUMMARY_TURN_TIMEOUT_MS = 120000

function radarNeedsSummary(item) {
  const summary = item.summary || {}
  return !(summary.change || summary.usage || summary.risk || summary.practice)
}

/** 读取原文文本：剥掉标签，压空白；失败/长度不足都如实报告。 */
function stripHtmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function summaryPrompt(item, articleText) {
  const lines = []
  lines.push('请阅读下面这篇资讯原文，输出一个 JSON 对象，不要输出其它文字。')
  lines.push('')
  lines.push('标题：' + (item.title || ''))
  lines.push('发布时间：' + (item.publishedAt ? item.publishedAt : '原文未注明'))
  lines.push('')
  lines.push('原文（节选）：')
  lines.push(String(articleText || '').slice(0, 4000))
  lines.push('')
  lines.push('输出 JSON：')
  lines.push('{')
  lines.push('  "change": "技术变化：这次变化的关键事实",')
  lines.push('  "usage": "应用场景：适合用在哪里",')
  lines.push('  "risk": "采用风险：可能踩的坑",')
  lines.push('  "practice": "推荐实践：怎么落地"')
  lines.push('}')
  lines.push('规则：结论必须来自原文；原文没讲就不写，宁缺毋滥。')
  return lines.join('\n')
}

/**
 * 批量生成四段摘要。单条失败聚合到 partial；最多处理 limit 条。
 */
async function runRadarSummarizeBatch(ctx, request) {
  const controller = hostService(ctx, 'sessionController')
  if (!controller || typeof controller.prompt !== 'function') {
    return { status: 'unavailable', note: '宿主没有 sessionController 服务，无法生成摘要。' }
  }
  const settings = loadWorkbenchState().settings
  if (!settings.aiExtract || settings.aiExtract.enabled !== true) {
    return { status: 'disabled', note: 'AI 识别未开启（设置 → 自动化 → AI 识别）。' }
  }
  const web = ctx && ctx.get ? ctx.get('web') : null
  if (!web || typeof web.fetch !== 'function') {
    return { status: 'unavailable', note: '当前 profile 没有 web 抓取服务，无法读取原文。' }
  }

  const input = request && typeof request === 'object' ? request : {}
  const limit = Math.max(1, Math.min(10, Number(input.limit) || 3))

  const state0 = loadWorkbenchState()
  const onlyIds = ensureArray(input.onlyIds).map(function (id) { return String(id) })
  const all = ensureArray(state0.radar).filter(function (item) {
    return item.url && radarNeedsSummary(item)
  })
  const candidates = (onlyIds.length > 0
    ? all.filter(function (item) { return onlyIds.indexOf(item.id) >= 0 })
    : all
  ).slice(0, limit)

  if (candidates.length === 0) {
    return { status: 'ok', done: 0, failed: 0, note: '没有待摘要的资讯（都有四段摘要或没有 url）。' }
  }

  const resolved = await ensureAssistantSession(ctx)
  if (!resolved) return { status: 'unavailable', note: '当前宿主没有可用的 sessions / sessionController 服务。' }

  let done = 0
  let failed = 0
  const perItem = []

  for (const item of candidates) {
    try {
      const fetched = await web.fetch({ url: item.url, method: 'GET' }, AbortSignal.timeout(15000))
      const bodyText =
        fetched && fetched.body && typeof fetched.body.content === 'string'
          ? stripHtmlToText(fetched.body.content)
          : ''
      if (bodyText.length < 40) {
        throw new Error('原文内容不足（可能被反爬或需要登录）')
      }

      const submitted = await submitPrompt(ctx, controller, resolved, summaryPrompt(item, bodyText), false)
      const deadline = Date.now() + SUMMARY_TURN_TIMEOUT_MS
      let reply = ''
      while (Date.now() < deadline) {
        await sleepMs(ANALYSIS_POLL_MS)
        const delta = transcriptDelta(submitted.session, submitted.fromSeq)
        const assistantTexts = delta.entries
          .filter(function (row) { return row.role === 'assistant' })
          .map(function (row) { return row.text })
        if (assistantTexts.length > 0) reply = assistantTexts.join('\n\n')
        if (!delta.turnActive) break
      }

      const parsed = extractJsonFromReply(reply)
      if (!parsed) throw new Error('模型回复无法解析为 JSON')

      const wrote = await mutateWorkbenchState(function (current) {
        const target = ensureArray(current.radar).find(function (row) {
          return row.id === item.id
        })
        if (!target) throw new Error('资讯已被删除：' + item.id)
        const index = current.radar.indexOf(target)
        const next = normalizeRadarItem(
          { summary: parsed },
          target,
        )
        next.id = target.id
        next.createdAt = target.createdAt
        next.updatedAt = hostNowIso()
        current.radar = current.radar.slice()
        current.radar[index] = next
        auditEntry(current, 'radar.summarized', target.title)
        return current
      })
      done += 1
      perItem.push({ id: item.id, ok: true })
      void wrote
    } catch (error) {
      failed += 1
      perItem.push({ id: item.id, ok: false, note: String((error && error.message) || error).slice(0, 160) })
    }
  }

  await mutateWorkbenchState(function (current) {
    current.lastRadarSummarize = {
      at: hostNowIso(),
      done: done,
      failed: failed,
      note: failed > 0 ? perItem.filter(function (row) { return !row.ok }).map(function (row) { return row.note }).slice(0, 3).join('；') : null,
    }
    auditEntry(current, 'radar.summarize', '摘要生成：成功 ' + done + ' / 失败 ' + failed)
    return current
  })

  return {
    status: failed > 0 ? 'partial' : 'ok',
    done: done,
    failed: failed,
    note: failed > 0 ? '失败条目见 lastRadarSummarize' : null,
  }
}
