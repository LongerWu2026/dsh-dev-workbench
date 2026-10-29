import {messageSyncDue} from '../../shared/message-schedule.js'
import { drainWorkflowJobs } from './jobs.js'
import { radarNeedsSummary } from '../news/summarizer.js'
import { loadWorkbenchState, mutateWorkbenchState, workbenchGenerationGuard } from '../storage/state-store.js'
import { hostNowIso, startRuntimeHeartbeat } from '../platform/runtime.js'
import { refreshGithubQuality, runRadarFetchOrDiscover } from '../news/discovery.js'
import { probeYunzhijia, repairYunzhijiaMetadata, syncYunzhijiaMessages } from '../integrations/yunzhijia.js'
import { runAnalysisBatch } from '../analysis/message-analysis.js'
import { runRadarSummarizeBatch } from '../news/summarizer.js'
import { auditEntry } from '../domain/model.js'
/* ============================================================================
 * dev-workbench host — 后台自动化（TODO 07 的可落地部分）
 *
 * 设计文档 07 要求「无前台聊天时仍能按配置执行」。宿主的 `schedule` 只做
 * 会话提醒投递、`jobs` 是抽象契约（需要具体 Provider），因此这里用**插件自身**
 * 的定时器执行采集、结构化识别和资讯摘要，模型工作位于提交锁之外：
 *
 *   - 每 60s 检查一次是否到期（lastAutomation.at + intervalMinutes），
 *     因此开关、间隔、启用的子任务都能在运行时改变，无需重启；
 *   - 单飞锁：同一时刻只有一个 tick 在跑，避免重复写入；
 *   - 启动时若已过期则补跑一次（catch-up），并记录在 lastAutomation；
 *   - 失败只记状态与原因，不做无限重试；
 *   - 进程退出即停止（不假装自己能常驻），文档里如实说明。
 * ========================================================================== */
let automationInFlight = false;
let automationTimer: any = null;
let automationStop: (() => void) | null = null;
function automationDue(state?: any, now?: any): any {
    const config = (state.settings && state.settings.automation) || {};
    if (!config.enabled)
        return false;
    const intervalMs = Math.max(5, Number(config.intervalMinutes) || 60) * 60 * 1000;
    const last = state.lastAutomation && state.lastAutomation.at ? new Date(state.lastAutomation.collectedAt || state.lastAutomation.at).getTime() : 0;
    return !Number.isFinite(last) || last === 0 || now - last >= intervalMs;
}
/**
 * 跑一次自动化 tick。返回 { ran, radarAdded, mentionsAdded, status, note }。
 * 内部捕获所有异常：后台任务不能把插件带崩。
 */
async function runAutomationTick(ctx?: any, request?: {backlogOnly?:boolean;resumeMentionsOnly?:boolean;automatic?:boolean}): Promise<any> {
    if (automationInFlight) {
        return { ran: false, status: 'busy', note: '上一次自动化仍在执行，本次跳过' };
    }
    const state = loadWorkbenchState();
    const assertCurrent = workbenchGenerationGuard();
    const config = (state.settings && state.settings.automation) || {};
    const extractSettings = (state.settings && state.settings.aiExtract) || {};
    if (!config.enabled) {
        return { ran: false, status: 'disabled', note: '自动化未开启' };
    }
    automationInFlight = true;
    const at = hostNowIso();
    let radarAdded = 0;
    let mentionsAdded = 0;
    let analysisDone = 0;
    let analysisPending = 0;
    let analysisFailed = false;
    const notes: any = [];
    let status = 'ok';
    try {
        if (config.radar !== false && !request?.backlogOnly && !request?.resumeMentionsOnly) {
            try {
                const afterRadar = await runRadarFetchOrDiscover(ctx);
                await refreshGithubQuality(ctx);
                const report = afterRadar.lastRadarFetch || {};
                radarAdded = Number(report.added) || 0;
                notes.push('资讯新增 ' + radarAdded);
                if (report.note)
                    notes.push(report.note);
            }
            catch (e) {
                status = 'partial';
                notes.push('资讯失败：' + String((e && e.message) || e).slice(0, 120));
            }
        }
        if (config.mentions !== false && !request?.backlogOnly && (!request?.automatic||messageSyncDue(loadWorkbenchState()))) {
            await mutateWorkbenchState((current:any)=>{current.lastMessageSyncAttemptAt=hostNowIso();return current});
            try {
                const probe = await probeYunzhijia(ctx);
                if (probe.state === 'ok') {
                    const afterMentions = await syncYunzhijiaMessages(ctx);
                    const report = afterMentions.lastMentionsFetch || {};
                    mentionsAdded = Number(report.added) || 0;
                    notes.push('@我 新增 ' + mentionsAdded + '（' + (report.mode || '关键字') + '）');
                    if (report.status !== 'ok') {
                        status = status === 'ok' ? 'partial' : status;
                        notes.push(report.note || report.status);
                    }
                }
                else {
                    notes.push('云之家不可用：' + (probe.note || probe.state));
                    if (probe.state !== 'unconfigured')
                        status = status === 'ok' ? 'partial' : status;
                }
            }
            catch (e) {
                status = 'partial';
                notes.push('@我 失败：' + String((e && e.message) || e).slice(0, 120));
            }
        }
        if (config.analyze !== false && extractSettings.enabled && loadWorkbenchState().settings.automation.enabled) {
            // TODO 19：采集 → 分析在同一 tick 顺序执行；识别在写入临界区外跑，
            // 提交时走统一的 mutate（短写），失败计入重试（attempts<3 每个 tick 重放一次）
            try {
                const analyzed = await runAnalysisBatch(ctx, {});
                const analyzedCount = Number(analyzed.processed) || 0;
                analysisDone = analyzedCount;
                analysisPending = Number(analyzed.failures) || 0;
                notes.push('AI 识别处理 ' + analyzedCount + ' 条' + (analyzed.failures ? ('，失败 ' + analyzed.failures) : ''));
                if (analyzed.status !== 'ok' && analyzed.status !== 'disabled') {
                    status = status === 'ok' ? 'partial' : status;
                    notes.push(analyzed.note || analyzed.status);
                }
            }
            catch (e) {
                status = 'partial';
                analysisFailed = true;
                notes.push('AI 识别失败：' + String((e && e.message) || e).slice(0, 120));
            }
        }
        if (config.summarize !== false && extractSettings.enabled && loadWorkbenchState().settings.automation.enabled) {
            try {
                const summary = await runRadarSummarizeBatch(ctx, {});
                notes.push('资讯摘要 ' + (summary.done || 0) + ' 条');
                if (summary.status !== 'ok' && summary.status !== 'disabled') {
                    status = 'partial';
                    notes.push(summary.note || summary.status);
                }
            }
            catch (e) {
                status = 'partial';
                notes.push('摘要失败：' + String(e.message || e).slice(0, 120));
            }
        }
    }
    finally {
        automationInFlight = false;
    }
    assertCurrent();
    await mutateWorkbenchState(function (current?: any): any {
        current.lastAutomation = {
            at: at,
            collectedAt: request?.backlogOnly || request?.resumeMentionsOnly ? current.lastAutomation?.collectedAt || current.lastAutomation?.at || null : at,
            radarAdded: radarAdded,
            mentionsAdded: mentionsAdded,
            analysisDone: analysisDone,
            analysisFailedAttempts: analysisPending,
            analysisErrored: analysisFailed,
            status: status,
            note: notes.join('；').slice(0, 300),
        };
        auditEntry(current, 'automation.tick', '自动执行：资讯 +' + radarAdded + '，@我 +' + mentionsAdded + '，AI 识别 ' + analysisDone);
        return current;
    });
    return {
        ran: true,
        status: status,
        radarAdded: radarAdded,
        mentionsAdded: mentionsAdded,
        analysisDone: analysisDone,
        note: notes.join('；'),
    };
}
/** 启动后台检查循环（每 60s 判断是否到期）；返回清理函数。 */
function startAutomation(ctx?: any): any {
    automationStop?.();
    let stopped = false;
    const stopHeartbeat=startRuntimeHeartbeat();
    const timer = setInterval(function (): any {
        if (stopped) return;
        const state = loadWorkbenchState();
        void drainWorkflowJobs(ctx).catch(() => {});
        if (automationDue(state, Date.now())) runAutomationTick(ctx,{automatic:true}).catch(() => {});
        else if (messageSyncDue(state)) runAutomationTick(ctx,{resumeMentionsOnly:true,automatic:true}).catch(() => {});
        else if (state.settings.automation.enabled && state.settings.aiExtract.enabled && (state.analysisQueue.some((row:any)=>row.status==='pending' || row.status==='failed' && row.attempts<3 && (!row.nextRetryAt || Date.parse(row.nextRetryAt)<=Date.now())) || state.radar.some((row:any)=>row.url && radarNeedsSummary(row) && (row.summaryAttempts||0)<3 && (!row.summaryRetryAt || Date.parse(row.summaryRetryAt)<=Date.now())))) runAutomationTick(ctx,{backlogOnly:true,automatic:true}).catch(()=>{});
    }, 60 * 1000);
    automationTimer = timer;
    // 不要因为后台定时器阻止宿主正常退出
    if (automationTimer && typeof automationTimer.unref === 'function')
        automationTimer.unref();
    // 启动补跑：如果已过期，等 8s 让宿主其它服务就绪后跑一次
    const boot = setTimeout(function (): any {
        if (stopped) return;
        const ready=messageSyncDue(loadWorkbenchState())?repairYunzhijiaMetadata(ctx):Promise.resolve();
        void ready.catch(error=>ctx.logger?.warn?.('旧消息信息补全失败：'+String(error?.message || error))).then(()=>{
            if(stopped)return;
            const state=loadWorkbenchState();
            void drainWorkflowJobs(ctx).catch(()=>{});
            if(automationDue(state,Date.now()))runAutomationTick(ctx,{automatic:true}).catch(()=>{});
            else if(messageSyncDue(state))runAutomationTick(ctx,{resumeMentionsOnly:true,automatic:true}).catch(()=>{});
        });
    }, 8000);
    if (boot && typeof boot.unref === 'function')
        boot.unref();
    const stop = function (): any {
        if (stopped) return;
        stopped = true;
        clearInterval(timer);
        if (automationTimer === timer) automationTimer = null;
        if (automationStop === stop) automationStop = null;
        clearTimeout(boot);
        stopHeartbeat();
    };
    automationStop = stop;
    return stop;
}

export { automationInFlight, automationTimer, automationDue, runAutomationTick, startAutomation }
