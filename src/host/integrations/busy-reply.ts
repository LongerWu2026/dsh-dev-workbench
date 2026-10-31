import {createHash,hostNowIso,newId} from '../platform/runtime.js'
import {loadWorkbenchState,mutateWorkbenchState,workbenchGenerationGuard} from '../storage/state-store.js'
import {normalizeReplies,auditEntry} from '../domain/model.js'
import {BUSY_REPLY_TEXT,normalizeBusyReply} from '../../shared/busy-reply.js'

let flight:Promise<any>|null=null
export async function configureBusyReply(request:any,probe:()=>Promise<any>){
 if(typeof request?.enabled!=='boolean')throw Error('请明确开启或关闭忙碌自动回复')
 const before=loadWorkbenchState().settings.busyReply;if(request.enabled&&before?.enabled)return loadWorkbenchState()
 const assertCurrent=workbenchGenerationGuard(),account=request.enabled?await probe():null;assertCurrent()
 if(request.enabled&&(account?.state!=='ok'||!account.openId||!account.accountId))throw Error(account?.note||'请先登录云之家账号')
 return mutateWorkbenchState((s:any)=>{assertCurrent();if(request.enabled&&!s.settings.busyReply?.enabled){s.settings.busyReply=normalizeBusyReply({enabled:true,startedAt:hostNowIso(),sessionId:newId('busy'),accountId:account.accountId,openId:account.openId});s.lastBusyReplyCheckAt=null}else if(!request.enabled)s.settings.busyReply={...normalizeBusyReply(s.settings.busyReply),enabled:false};auditEntry(s,'busyReply.configure',request.enabled?'开启私聊忙碌自动回复':'关闭私聊忙碌自动回复');return s})
}
function eligible(s:any,source:any){
 const config=s.settings.busyReply,loc=source?.locator||{},at=Date.parse(loc.sentAt||'')
 if(!config?.enabled||source.provider!=='yunzhijia'||Number(loc.groupType)!==1||loc.direction!=='inbound'||loc.sentAtVerified!==true||loc.intake===false||!loc.msgId||!loc.groupId||!loc.senderId||loc.senderId===config.openId||String(loc.senderId).startsWith('BOT-')||![config.accountId,config.openId].includes(loc.accountId)||!Number.isFinite(at)||at<Date.parse(config.startedAt)||at>Date.now()+60000||source.selection?.policy!=='focused-v1'||!source.selection.reasons?.includes('unread'))return false
 const reply=(s.replies||[]).find((r:any)=>r.sourceId===source.id&&r.msgId===loc.msgId)
 if(reply&&(reply.archivedAt||reply.humanGuard||['已回复','已自动回复'].includes(reply.stage)||reply.stage==='不需回复'&&reply.triage!=='task'||['sending','sent','uncertain'].includes(s.replyDrafts?.[reply.id]?.delivery?.status)))return false
 // A newer human answer/read can remove this obligation before the send reservation.
 const view=s.messageInbox?.accountId===loc.accountId?s.messageInbox.conversations?.find((c:any)=>c.groupId===loc.groupId):null
 if(!view||Number(view.groupType)!==1||!(view.unreadCount>0))return false
 if(view?.latestDirection==='outbound'&&Date.parse(view.latestSentAt)>=at&&!Object.values(s.busyReplyDeliveries||{}).some((d:any)=>d.accountId===loc.accountId&&d.groupId===loc.groupId&&['sending','sent','uncertain'].includes(d.status)&&(!d.msgId||d.msgId===view.latestMsgId)))return false
 return true
}
function pending(s:any,source:any){
 let reply=(s.replies||[]).find((r:any)=>r.sourceId===source.id&&r.msgId===source.locator.msgId)
 if(!reply){const loc=source.locator;reply=normalizeReplies([{sourceId:source.id,msgId:loc.msgId,groupId:loc.groupId,groupName:loc.groupName,accountId:loc.accountId,contact:source.sender,snippet:source.excerpt,stage:'待回复',triage:'reply'}])[0];s.replies.push(reply)}else if(reply.stage==='不需回复'&&reply.triage==='task'&&!reply.humanGuard){reply.stage='待回复';reply.updatedAt=hostNowIso()}return reply
}
function acknowledge(s:any,source:any,delivery:any){
 const reply=pending(s,source);if(!['待回复','已确认收到'].includes(reply.stage)||reply.humanGuard)return
 Object.assign(reply,{stage:'已自动回复',triage:'reply',autoReplyId:delivery.id,autoRepliedAt:delivery.at,repliedAt:null,updatedAt:hostNowIso()})
}
/** Run only after sources have been committed. Transport is the existing private-text sender. */
export function runBusyReplies(probe:()=>Promise<any>,send:(groupId:string,text:string)=>Promise<any>):Promise<any>{
 if(flight)return flight
 flight=(async()=>{
  const initial=loadWorkbenchState(),config=initial.settings.busyReply;if(!config?.enabled||!initial.sources.some((source:any)=>eligible(initial,source)))return initial
  const assertCurrent=workbenchGenerationGuard(),account=await probe();assertCurrent()
  if(account?.state!=='ok'||account.accountId!==config.accountId||account.openId!==config.openId)return mutateWorkbenchState((s:any)=>{assertCurrent();s.lastBusyReplyError=account?.state!=='ok'?'云之家账号不可用，忙碌自动回复已暂停':'当前账号已切换，忙碌自动回复已暂停；请关闭后重新开启';return s})
  const grouped=new Map<string,string[]>()
  for(const source of loadWorkbenchState().sources){if(!eligible(loadWorkbenchState(),source))continue;const group=source.locator.groupId;if(!grouped.has(group))grouped.set(group,[]);grouped.get(group)!.push(source.id)}
  for(const [groupId,ids] of [...grouped].slice(0,10)){
   const key=createHash('sha256').update(JSON.stringify([config.sessionId,config.accountId,groupId])).digest('hex');let attempt:any=null
   await mutateWorkbenchState((s:any)=>{assertCurrent();if(!s.settings.busyReply?.enabled||s.settings.busyReply.sessionId!==config.sessionId)return s
    const sources=s.sources.filter((source:any)=>ids.includes(source.id)&&eligible(s,source));if(!sources.length)return s
    s.busyReplyDeliveries ||= {};const old=s.busyReplyDeliveries[key]
    if(old){if(old.status==='sent')for(const source of sources)acknowledge(s,source,old);return s}
    if(Object.keys(s.busyReplyDeliveries).length>=5000){s.lastBusyReplyError='自动回复记录已达上限，请关闭忙碌模式并检查记录';return s}
    for(const source of sources)pending(s,source)
    attempt={id:newId('busy-send'),sessionId:config.sessionId,accountId:config.accountId,groupId,sourceIds:sources.map((source:any)=>source.id),status:'reserved',text:BUSY_REPLY_TEXT,at:hostNowIso(),msgId:null};s.busyReplyDeliveries[key]=attempt;return s
   })
   if(!attempt)continue
   const verified=await probe();assertCurrent()
   if(verified?.state!=='ok'||verified.accountId!==config.accountId||verified.openId!==config.openId){await mutateWorkbenchState((s:any)=>{assertCurrent();if(s.busyReplyDeliveries[key]?.id===attempt.id)s.busyReplyDeliveries[key].status='cancelled';s.lastBusyReplyError='发送前账号校验失败，自动回复已暂停';return s});break}
   let allowed=false
   await mutateWorkbenchState((s:any)=>{assertCurrent();const record=s.busyReplyDeliveries[key];if(record?.id!==attempt.id)return s
    allowed=s.settings.busyReply?.enabled&&s.settings.busyReply.sessionId===config.sessionId&&attempt.sourceIds.some((id:string)=>{const source=s.sources.find((x:any)=>x.id===id);return source&&eligible(s,source)})
    record.status=allowed?'sending':'cancelled';return s
   })
   if(!allowed)continue
   assertCurrent();const current=loadWorkbenchState();if(!current.settings.busyReply.enabled||current.settings.busyReply.sessionId!==config.sessionId)continue
   let result:any;try{result=await send(groupId,BUSY_REPLY_TEXT)}catch(error){result={status:'error',uncertain:true,note:String((error as Error).message)}}assertCurrent()
   await mutateWorkbenchState((s:any)=>{assertCurrent();const record=s.busyReplyDeliveries[key];if(record?.id!==attempt.id)return s
    record.status=result.status==='ok'?'sent':result.uncertain?'uncertain':'failed';record.at=hostNowIso();record.note=result.note||null;record.msgId=String(result.json?.data?.msgId||result.json?.data?.messageId||'')||null
    if(record.status==='sent'){
     for(const source of s.sources.filter((x:any)=>attempt.sourceIds.includes(x.id))){const reply=s.replies.find((r:any)=>r.sourceId===source.id&&r.msgId===source.locator?.msgId);if(reply&&!reply.archivedAt&&!reply.humanGuard&&['待回复','已确认收到'].includes(reply.stage))acknowledge(s,source,record)}
     s.lastBusyReplyError=null;auditEntry(s,'reply.auto_sent','私聊忙碌告知，保留待回复 '+attempt.sourceIds.length+' 条')
    }else{s.lastBusyReplyError=record.status==='uncertain'?'自动回复结果待核实，未自动重试':record.note||'自动回复发送失败';if(result.status==='rate_limited'){s.syncCursors ||= {};s.syncCursors['__pending:'+config.accountId]={...s.syncCursors['__pending:'+config.accountId],accountId:config.accountId,reason:'rate_limit',retryAt:new Date(Date.now()+120000).toISOString()}}auditEntry(s,'reply.auto_failed',record.status)}return s
   })
   if(result.status==='rate_limited')break
  }
  return loadWorkbenchState()
 })().finally(()=>{flight=null})
 return flight
}
