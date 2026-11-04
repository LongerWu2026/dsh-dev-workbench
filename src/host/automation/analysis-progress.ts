import {analysisEntryWait,summarizeAnalysisWait} from './analysis-readiness.js'
import { messageSkipReason } from '../domain/message-policy.js'
import type { AnalysisProgress } from '../../shared/analysis-progress.js'

export function analysisProcessedCount(state: any, job: any): number {
    // Each successful entry is tagged in the same transaction as its business result.
    // A restart between committing results and updating the job cannot lose progress.
    return Math.max(job.progress?.processed || 0, state.analysisQueue.filter((row: any) => row.analysisJobId === job.id && ['done', 'awaiting_human'].includes(row.status)).length);
}

/** Count the same live queue that recognition consumes, including delayed/blocked work. */
export function analysisRemainder(state: any, now = Date.now(), onlyIds?:ReadonlySet<string>) {
    const sources = new Map<string, any>(state.sources.map((source: any) => [source.id, source]));
    const rows = state.analysisQueue.filter((row: any) => (!onlyIds?.size||onlyIds.has(row.id)||onlyIds.has(row.sourceId))&&['pending', 'failed', 'running'].includes(row.status) && !messageSkipReason(state, sources.get(row.sourceId), row));
    const waits=rows.map((row:any)=>analysisEntryWait(state,row,sources.get(row.sourceId),now)).filter(Boolean)
    const ready=rows.filter((row:any)=>sources.has(row.sourceId)&&!(row.status==='failed'&&(row.attempts||0)>=3)&&!analysisEntryWait(state,row,sources.get(row.sourceId),now))
    const wait=ready.length?undefined:summarizeAnalysisWait(waits)
    const failed = rows.filter((row: any) => row.status === 'failed');
    const exhausted = failed.find((row: any) => (row.attempts || 0) >= 3);
    const missing = rows.find((row: any) => !sources.has(row.sourceId));
    const retries = failed.filter((row: any) => (row.attempts || 0) < 3).map((row: any) => Date.parse(row.nextRetryAt)).filter((time: number) => time > now);
    return { remaining: rows.length, failed: failed.length, ready: ready.length, exhausted, missing, retryAt: new Date(retries.length ? Math.min(...retries) : now + 60000).toISOString(), error: failed.find((row: any) => row.lastError)?.lastError,wait };
}

/** Commit cumulative progress and decide whether to continue, wait, or stop. */
export function advanceAnalysisJob(state: any, job: any, result: any): void {
    const rest = analysisRemainder(state);
    if(!result.inputCount&&!rest.exhausted&&!rest.missing&&rest.wait&&!['deferred','disabled','unavailable','interrupted','busy'].includes(result.status))result={...result,status:'deferred',...rest.wait};
    const previous: AnalysisProgress = job.progress || { processed: 0, remaining: 0, failed: 0, batches: 0, pauseReason: null };
    const progress: AnalysisProgress = { processed: analysisProcessedCount(state, job), remaining: rest.remaining, failed: rest.failed, batches: previous.batches + (result.inputCount > 0 ? 1 : 0), pauseReason: null };
    job.progress = progress;
    const awaitingHuman=state.analysisQueue.filter((row:any)=>row.analysisJobId===job.id&&row.status==='awaiting_human').length;
    if(awaitingHuman)progress.awaitingHuman=awaitingHuman;
    job.error = undefined;
    job.nextRetryAt = null;
    if (!rest.remaining) job.status = 'completed';
    else if (['deferred', 'disabled', 'unavailable', 'interrupted', 'busy'].includes(result.status)) {
        const health = state.modelHealth?.analysis;
        progress.pauseReason = [result.note || '识别暂时暂停', result.status === 'deferred'&&!result.waitReason ? health?.detail : null].filter(Boolean).join('：');
        job.status = ['busy', 'interrupted'].includes(result.status) || result.retryAt ? 'queued' : 'failed';
        job.nextRetryAt = job.status === 'queued' ? result.retryAt || new Date(Date.now() + 60000).toISOString() : null;
    } else if (rest.ready && (result.processed > 0 || result.failures > 0)) {
        job.status = 'queued'; // The drain loop immediately admits the next 50 messages.
    } else if (rest.exhausted || rest.missing) {
        job.status = 'failed';
        progress.pauseReason = rest.exhausted ? '消息已达 3 次重试上限，已停止发送请求；请手动重试：' + (rest.exhausted.lastError || '识别结果无效') : '原消息来源缺失，无法继续识别';
    } else {
        job.status = 'queued';
        job.nextRetryAt = rest.retryAt;
        progress.pauseReason = rest.failed ? '失败消息等待自动重试：' + (rest.error || '识别结果无效') : '消息内容已更新，等待下一轮识别';
    }
    job.result = { ...result, processed: progress.processed, failures: progress.failed, reviewed:awaitingHuman, note: progress.pauseReason || (rest.remaining ? '按每批 50 条自动连续识别' : awaitingHuman?'识别已结束，'+awaitingHuman+' 条消息待确认；可单条重试':'本次识别队列已处理完毕') };
}

/** Wake only queued history waits after source/cursor commit. Never release a
 * user's pause, reset retry counters, or reopen completed jobs. */
export function wakeBackfilledAnalysisJobs(state:any,now=Date.now()):number{
 let woken=0
 for(const job of state.jobs||[]){
  if(job.kind!=='analysis'||job.status!=='queued'||job.pausedByUser||!(job.result?.waitReason==='conversation_backfill'||/^消息正在补采、被其他识别占用/.test(job.progress?.pauseReason||job.result?.note||'')))continue
  const ids=new Set<string>(Array.isArray(job.input?.onlyIds)?job.input.onlyIds:[])
  if(!analysisRemainder(state,now,ids).ready)continue
  job.nextRetryAt=null;if(job.progress)job.progress.pauseReason=null
  job.result={...job.result,waitReason:null,waitDetail:null,note:'消息补采已完成，继续处理剩余消息'};woken++
 }
 return woken
}
