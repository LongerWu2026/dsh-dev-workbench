export const BUSY_REPLY_TEXT='我现在正在紧急处理客户问题，稍后答复。紧急问题可以电话联系。'
export const OPEN_REPLY_STAGES=['待回复','已确认收到','已自动回复']
export function normalizeBusyReply(raw:any){
 const input=raw&&typeof raw==='object'?raw:{}
 const at=typeof input.startedAt==='string'&&Number.isFinite(Date.parse(input.startedAt))?new Date(input.startedAt).toISOString():null
 return {enabled:input.enabled===true&&!!at&&typeof input.sessionId==='string'&&!!input.accountId,startedAt:at,sessionId:typeof input.sessionId==='string'?input.sessionId.slice(0,100):null,accountId:typeof input.accountId==='string'?input.accountId.slice(0,120):null,openId:typeof input.openId==='string'?input.openId.slice(0,120):null,text:BUSY_REPLY_TEXT}
}
export function busyReplyDue(state:any,now=Date.now()):boolean {
 const cooldown=state.syncCursors?.['__pending:'+state.settings?.busyReply?.accountId]?.retryAt;if(Date.parse(cooldown)>now)return false
 return !!state.settings?.busyReply?.enabled&&(!state.lastBusyReplyCheckAt||now-Date.parse(state.lastBusyReplyCheckAt)>=60000)
}
/** Automated acknowledgements are never evidence of a substantive human answer. */
export function isBusyReplyMessage(state:any,accountId:string,groupId:string,message:any):boolean {
 return Object.values(state.busyReplyDeliveries||{}).some((entry:any)=>entry.accountId===accountId&&entry.groupId===groupId&&
  (entry.msgId&&entry.msgId===message?.msgId || ['sending','sent','uncertain'].includes(entry.status)&&String(message?.content||'').trim()===entry.text))
}
export function busyReplyLatestMayBeAutomatic(state:any,source:any,latest:any):boolean {
 const loc=source?.locator||{}
 return Object.values(state.busyReplyDeliveries||{}).some((entry:any)=>entry.accountId===loc.accountId&&entry.groupId===loc.groupId&&['sending','sent','uncertain'].includes(entry.status)&&(!entry.msgId||entry.msgId===latest?.latestMsgId))
}
