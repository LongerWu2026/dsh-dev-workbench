import {isFreshPrivateHead} from '../../shared/message-intake.js'

export type AnalysisWaitReason='conversation_backfill'|'lease_wait'|'retry_wait'
export interface AnalysisEntryWait {waitReason:AnalysisWaitReason;retryAt:string;rateLimited?:boolean}
/** Same admission boundary for targeted and continuous recognition. Native model
 * completion cannot retire messages whose conversation history is incomplete. */
export function analysisEntryWait(state:any,row:any,source:any,now=Date.now()):AnalysisEntryWait|undefined{
 const lease=Date.parse(row.leaseUntil),retry=Date.parse(row.nextRetryAt)
 if(row.status==='running'&&lease>now)return {waitReason:'lease_wait',retryAt:new Date(lease).toISOString()}
 if(row.status==='failed'&&retry>now)return {waitReason:'retry_wait',retryAt:new Date(retry).toISOString()}
 const account=row.accountId||source?.locator?.accountId||'',group=row.groupId||source?.locator?.groupId,pending=state.syncCursors?.['__pending:'+account]
 if(!isFreshPrivateHead(state,source)&&(state.syncCursors?.[account+':'+group]?.resumeBefore||pending?.pendingGroups?.some((item:any)=>item.groupId===group))){
  const resumeAt=Date.parse(pending?.retryAt),rateLimited=pending?.reason==='rate_limit'&&resumeAt>now
  return {waitReason:'conversation_backfill',retryAt:new Date(resumeAt>now?resumeAt:now+60000).toISOString(),rateLimited}
 }
}
export function summarizeAnalysisWait(waits:AnalysisEntryWait[]){
 if(!waits.length)return undefined
 const counts={backfill:waits.filter(row=>row.waitReason==='conversation_backfill').length,leased:waits.filter(row=>row.waitReason==='lease_wait').length,retry:waits.filter(row=>row.waitReason==='retry_wait').length},rateLimited=waits.some(row=>row.rateLimited)
 const notes=[counts.backfill?(rateLimited?'云之家补采限流，':'')+counts.backfill+' 条消息等待历史补齐，补采完成后自动继续':null,counts.leased?counts.leased+' 条消息正由其他识别处理，等待占用释放后自动继续':null,counts.retry?counts.retry+' 条消息等待已安排的重试时间，到时自动继续':null].filter(Boolean)
 return {waitReason:counts.backfill?'conversation_backfill':counts.leased?'lease_wait':'retry_wait',waitDetail:rateLimited?'rate_limit':undefined,waitCounts:counts,retryAt:waits.map(row=>row.retryAt).sort()[0],note:notes.join('；')}
}
