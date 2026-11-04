export const ANALYSIS_WAIT_REASONS=['conversation_backfill','retry_wait','lease_wait'] as const
/** Recognize saved queue waits too; never turn provider/validation errors into a wait. */
export function analysisJobWaiting(job:any):boolean {
 if(job?.status!=='queued'||job.error||job.progress?.failed>0)return false
 if(job.result?.status==='busy')return true
 if(job.result?.status==='deferred'&&ANALYSIS_WAIT_REASONS.includes(job.result.waitReason))return true
 const note=job.progress?.pauseReason||job.result?.note||''
 return job.result?.status==='deferred'&&/^指定消息仍在会话补采或重试等待中/.test(note)||/^消息正在补采、被其他识别占用或内容已变化/.test(note)
}
