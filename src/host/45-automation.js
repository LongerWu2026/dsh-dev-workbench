/* ============================================================================
 * dev-workbench host — 后台自动化（TODO 07 的可落地部分）
 *
 * 设计文档 07 要求「无前台聊天时仍能按配置执行」。宿主的 `schedule` 只做
 * 会话提醒投递、`jobs` 是抽象契约（需要具体 Provider），因此这里用**插件自身**
 * 的定时器执行**确定性采集**（资讯抓取/联网发现、@我 拉取），不涉及模型调用：
 *
 *   - 每 60s 检查一次是否到期（lastAutomation.at + intervalMinutes），
 *     因此开关、间隔、启用的子任务都能在运行时改变，无需重启；
 *   - 单飞锁：同一时刻只有一个 tick 在跑，避免重复写入；
 *   - 启动时若已过期则补跑一次（catch-up），并记录在 lastAutomation；
 *   - 失败只记状态与原因，不做无限重试；
 *   - 进程退出即停止（不假装自己能常驻），文档里如实说明。
 * ========================================================================== */

let automationInFlight = false
let automationTimer = null

function automationDue(state, now) {
  const config = (state.settings && state.settings.automation) || {}
  if (!config.enabled) return false
  const intervalMs = Math.max(5, Number(config.intervalMinutes) || 60) * 60 * 1000
  const last = state.lastAutomation && state.lastAutomation.at ? new Date(state.lastAutomation.at).getTime() : 0
  return !Number.isFinite(last) || last === 0 || now - last >= intervalMs
}

/**
 * 跑一次自动化 tick。返回 { ran, radarAdded, mentionsAdded, status, note }。
 * 内部捕获所有异常：后台任务不能把插件带崩。
 */
async function runAutomationTick(ctx) {
  if (automationInFlight) {
    return { ran: false, status: 'busy', note: '上一次自动化仍在执行，本次跳过' }
  }
  const state = loadWorkbenchState()
  const config = (state.settings && state.settings.automation) || {}
  const extractSettings = (state.settings && state.settings.aiExtract) || {}
  if (!config.enabled) {
    return { ran: false, status: 'disabled', note: '自动化未开启' }
  }

  automationInFlight = true
  const at = hostNowIso()
  let radarAdded = 0
  let mentionsAdded = 0
  let analysisDone = 0
  let analysisPending = 0
  let analysisFailed = false
  const notes = []
  let status = 'ok'

  try {
    if (config.radar !== false) {
      try {
        const afterRadar = await runRadarFetchOrDiscover(ctx)
        const report = afterRadar.lastRadarFetch || {}
        radarAdded = Number(report.added) || 0
        notes.push('资讯新增 ' + radarAdded)
        if (report.note) notes.push(report.note)
      } catch (e) {
        status = 'partial'
        notes.push('资讯失败：' + String((e && e.message) || e).slice(0, 120))
      }
    }

    if (config.analyze !== false && extractSettings.enabled) {
      // TODO 19：采集 → 分析在同一 tick 顺序执行；识别在写入临界区外跑，
      // 提交时走统一的 mutate（短写），失败计入重试（attempts<3 每个 tick 重放一次）
      try {
        const analyzed = await runAnalysisBatch(ctx, {})
        notes.push('AI 识别 ' + (analyzed.status === 'ok' ? processed_ + '' : analyzed.status) + (analyzed.processed !== undefined ? '/' + analyzed.processed + ' 条' : ''))
        if (analyzed.status !== 'ok' && analyzed.status !== 'disabled') {
          status = status === 'ok' ? 'partial' : status
          notes.push(analyzed.note || analyzed.status)
        }
      } catch (e) {
        status = 'partial'
        notes.push('AI 识别失败：' + String((e && e.message) || e).slice(0, 120))
      }
    }

    if (config.mentions !== false) {
      try {
        const probe = await probeYunzhijia(ctx)
        if (probe.state === 'ok') {
          const afterMentions = await mutateWorkbenchState(function (current) {
            return fetchYunzhijiaMentionsInto(ctx, current)
          })
          const report = afterMentions.lastMentionsFetch || {}
          mentionsAdded = Number(report.added) || 0
          notes.push('@我 新增 ' + mentionsAdded + '（' + (report.mode || '关键字') + '）')
          if (report.status !== 'ok') {
            status = status === 'ok' ? 'partial' : status
            notes.push(report.note || report.status)
          }
        } else {
          notes.push('云之家不可用：' + (probe.note || probe.state))
          if (probe.state !== 'unconfigured') status = status === 'ok' ? 'partial' : status
        }
      } catch (e) {
        status = 'partial'
        notes.push('@我 失败：' + String((e && e.message) || e).slice(0, 120))
      }
    }

    if (config.analyze !== false && extractSettings.enabled) {
      // TODO 19：采集 → 分析在同一 tick 顺序执行；识别在写入临界区外跑，
      // 提交时走统一的 mutate（短写），失败计入重试（attempts<3 每个 tick 重放一次）
      try {
        const analyzed = await runAnalysisBatch(ctx, {})
        const analyzedCount = Number(analyzed.processed) || 0
        analysisDone = analyzedCount
        analysisPending = Number(analyzed.failures) || 0
        notes.push('AI 识别处理 ' + analyzedCount + ' 条' + (analyzed.failures ? ('，失败 ' + analyzed.failures) : ''))
        if (analyzed.status !== 'ok' && analyzed.status !== 'disabled') {
          status = status === 'ok' ? 'partial' : status
          notes.push(analyzed.note || analyzed.status)
        }
      } catch (e) {
        status = 'partial'
        analysisFailed = true
        notes.push('AI 识别失败：' + String((e && e.message) || e).slice(0, 120))
      }
    }
  } finally {
    automationInFlight = false
  }

  await mutateWorkbenchState(function (current) {
    current.lastAutomation = {
      at: at,
      radarAdded: radarAdded,
      mentionsAdded: mentionsAdded,
      analysisDone: analysisDone,
      analysisFailedAttempts: analysisPending,
      analysisErrored: analysisFailed,
      status: status,
      note: notes.join('；').slice(0, 300),
    }
    auditEntry(current, 'automation.tick', '自动执行：资讯 +' + radarAdded + '，@我 +' + mentionsAdded + '，AI 识别 ' + analysisDone)
    return current
  })

  return {
    ran: true,
    status: status,
    radarAdded: radarAdded,
    mentionsAdded: mentionsAdded,
    analysisDone: analysisDone,
    note: notes.join('；'),
  }
}

/** 启动后台检查循环（每 60s 判断是否到期）；返回清理函数。 */
function startAutomation(ctx) {
  if (automationTimer) return function () {}
  automationTimer = setInterval(function () {
    const state = loadWorkbenchState()
    if (!automationDue(state, Date.now())) return
    runAutomationTick(ctx).catch(function () {})
  }, 60 * 1000)
  // 不要因为后台定时器阻止宿主正常退出
  if (automationTimer && typeof automationTimer.unref === 'function') automationTimer.unref()
  // 启动补跑：如果已过期，等 8s 让宿主其它服务就绪后跑一次
  const boot = setTimeout(function () {
    const state = loadWorkbenchState()
    if (automationDue(state, Date.now())) runAutomationTick(ctx).catch(function () {})
  }, 8000)
  if (boot && typeof boot.unref === 'function') boot.unref()
  return function () {
    if (automationTimer) clearInterval(automationTimer)
    automationTimer = null
    clearTimeout(boot)
  }
}
