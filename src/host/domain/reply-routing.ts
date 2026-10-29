import {hostNowIso,newId} from '../platform/runtime.js'
import {canCreateMessageTask} from '../../shared/message-intake.js'
const open=(r:any)=>!r.archivedAt&&['待回复','已确认收到'].includes(r.stage)
export const privateSource=(s:any)=>s?.provider==='yunzhijia'&&Number(s.locator?.groupType)===1
const eligible=(s:any)=>privateSource(s)&&s.locator?.direction!=='outbound'&&s.locator?.intake!==false
const conversation=(state:any,s:any)=>state.messageInbox&&state.messageInbox.accountId===s.locator?.accountId?state.messageInbox.conversations?.find((c:any)=>c.groupId===s.locator?.groupId):null
const sourceReply=(state:any,s:any)=>(state.replies||[]).find((r:any)=>r.sourceId===s.id&&r.msgId===s.locator?.msgId&&(!r.accountId||r.accountId===s.locator?.accountId)&&(!r.groupId||r.groupId===s.locator?.groupId))
/** Immutable latest-message facts can close a reply even when its model result arrives later. */
export function applyLatestPrivateReply(state:any,reply:any,source:any):boolean {
 if(!eligible(source)||!open(reply)||state.replyDrafts?.[reply.id]?.delivery?.status==='sending')return false
 const c=conversation(state,source),sent=Date.parse(source.locator?.sentAt||'')
 if(c?.latestDirection!=='outbound'||!c.latestMsgId||c.latestMsgId===reply.msgId||!Number.isFinite(sent)||!Number.isFinite(Date.parse(c.latestSentAt))||Date.parse(c.latestSentAt)<sent)return false
 Object.assign(reply,{stage:'已回复',evidenceMsgId:c.latestMsgId,repliedAt:c.latestSentAt,updatedAt:hostNowIso()})
 return true
}
function createPending(state:any,source:any,triage='pending'):any {
 const at=hostNowIso(),loc=source.locator
 const reply={id:newId('rep'),sourceId:source.id,msgId:loc.msgId,accountId:loc.accountId,groupId:loc.groupId,groupName:loc.groupName||null,contact:source.sender||null,snippet:String(source.excerpt||'').slice(0,300),stage:'待回复',humanGuard:false,triage,evidenceMsgId:null,repliedAt:null,taskIds:[],createdAt:at,updatedAt:at}
 state.replies ||= [];state.replies.push(reply);applyLatestPrivateReply(state,reply,source)
 return reply
}
/** Private messages have one route. Preserve manually reviewed stages and real reply evidence. */
export function routePrivateAnalysis(state:any,source:any,analysis:any,taskIds:string[]=[]):any {
 if(!eligible(source))return null
 const action=!analysis.noise&&canCreateMessageTask(source)&&(analysis.items||[]).some((i:any)=>i.needsAction)
 const replyNeeded=!analysis.noise&&!action&&(analysis.items||[]).some((i:any)=>i.needsReply)
 const triage=action?'task':replyNeeded?'reply':'noise'
 let reply=sourceReply(state,source)
 if(!reply&&replyNeeded)reply=createPending(state,source,'reply')
 if(!reply||reply.archivedAt||reply.humanGuard||state.replyDrafts?.[reply.id]?.delivery?.status==='sending')return reply
 const fields:any={triage,taskIds:[...new Set([...(reply.taskIds||[]),...taskIds])]}
 if(!replyNeeded&&open(reply))Object.assign(fields,{stage:'不需回复',repliedAt:null,evidenceMsgId:null})
 if(Object.entries(fields).some(([k,v])=>JSON.stringify(reply[k])!==JSON.stringify(v)))Object.assign(reply,fields,{updatedAt:hostNowIso()})
 if(replyNeeded)applyLatestPrivateReply(state,reply,source)
 return reply
}
/** Run under the local commit lock: collecting private unread does not wait for AI. */
export function seedUnreadPrivateReplies(state:any,accountId:string):number {
 const queue=new Map((state.analysisQueue||[]).map((q:any)=>[q.sourceId,q]));let count=0
 const conversations=new Map((state.messageInbox?.accountId===accountId?state.messageInbox.conversations||[]:[]).map((c:any)=>[c.groupId,c]))
 for(const source of state.sources||[]){
  const c:any=conversations.get(source.locator?.groupId)
  if(source.provider==='yunzhijia'&&source.locator?.accountId===accountId&&!source.locator.groupType&&[1,2,3,8].includes(c?.groupType))source.locator.groupType=c.groupType
  if(!eligible(source)||source.locator.accountId!==accountId||source.selection?.policy!=='focused-v1'||!source.selection.reasons.includes('unread'))continue
  const q:any=queue.get(source.id)
  if(['skipped','historical','cancelled'].includes(q?.status))continue
  if(q?.analysis&&['done','awaiting_human'].includes(q.status)) {routePrivateAnalysis(state,source,q.analysis,q.taskIds||[]);continue}
  let reply=sourceReply(state,source)
  if(!reply){reply=createPending(state,source);count++}
  else applyLatestPrivateReply(state,reply,source)
 }
 return count
}
