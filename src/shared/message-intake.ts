export const MESSAGE_INTAKE_POLICY='focused-v1'
export type IntakeReason='unread'|'mention_me'|'mention_all'|'followup'
export interface MessageSelection {policy:typeof MESSAGE_INTAKE_POLICY;reasons:IntakeReason[];unreadCount:number|null;observedAt:string}
export function normalizeMessageSelection(raw:any):MessageSelection|null {
 if(raw?.policy!==MESSAGE_INTAKE_POLICY)return null
 const reasons=[...new Set((Array.isArray(raw.reasons)?raw.reasons:[]).filter((x:any)=>['unread','mention_me','mention_all','followup'].includes(x)))] as IntakeReason[]
 if(!reasons.length)return null
 return {policy:MESSAGE_INTAKE_POLICY,reasons,unreadCount:typeof raw.unreadCount==='number'&&raw.unreadCount>=0?Math.floor(raw.unreadCount):null,observedAt:typeof raw.observedAt==='string'&&Number.isFinite(Date.parse(raw.observedAt))?new Date(raw.observedAt).toISOString():new Date().toISOString()}
}
export function mentionSignals(message:any,myOpenId:string):IntakeReason[]{
 const p=message?.param||{},targets=Array.isArray(p.desc)?p.desc.filter((x:any)=>x?.type==='at'):[]
 const all=[true,1,'1'].includes(p.notifyToAll)||targets.some((x:any)=>x.data==='all')||/(?:^|\s)@all(?=\s|$)/i.test(String(message?.content||''))
 const me=targets.length?targets.some((x:any)=>x.data===myOpenId):!all&&Number(p.notifyType)===1
 return [...(me?['mention_me' as const]:[]),...(all?['mention_all' as const]:[])]
}
export function normalizeMessageInbox(raw:any):any {
 if(!raw||typeof raw!=='object')return null
 const at=(x:any)=>typeof x==='string'&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null
 return {accountId:typeof raw.accountId==='string'?raw.accountId.slice(0,120):null,at:at(raw.at),unreadTotal:typeof raw.unreadTotal==='number'&&raw.unreadTotal>=0?raw.unreadTotal:null,complete:raw.complete===true,
  conversations:(Array.isArray(raw.conversations)?raw.conversations:[]).slice(-200).filter((x:any)=>typeof x?.groupId==='string').map((x:any)=>({groupId:x.groupId.slice(0,120),name:String(x.name||'原会话').slice(0,120),groupType:Number(x.groupType)||null,latestDirection:['inbound','outbound'].includes(x.latestDirection)?x.latestDirection:null,latestMsgId:typeof x.latestMsgId==='string'?x.latestMsgId.slice(0,80):null,latestSentAt:at(x.latestSentAt),unreadCount:typeof x.unreadCount==='number'&&x.unreadCount>=0?x.unreadCount:null,at:at(x.at)})),
  calendar:raw.calendar&&typeof raw.calendar==='object'?{at:at(raw.calendar.at),status:String(raw.calendar.status||'unknown').slice(0,30),found:Math.max(0,Number(raw.calendar.found)||0),note:String(raw.calendar.note||'').slice(0,200)}:null}
}

/** New work requires a private request or a verified group mention, never unread alone. */
export function canCreateMessageTask(source:any):boolean {
 if(source?.provider!=='yunzhijia')return true
 if(source.locator?.direction==='outbound'||source.locator?.intake===false)return false
 return Number(source.locator?.groupType)===1 || (normalizeMessageSelection(source.selection)?.reasons||[]).some(r=>r==='mention_me'||r==='mention_all')
}

/** The verified newest unread private message is ready independently of history backfill. */
export function isFreshPrivateHead(state:any,source:any):boolean {
 const loc=source?.locator,box=state.messageInbox
 if(source?.provider!=='yunzhijia'||Number(loc?.groupType)!==1||loc.direction==='outbound'||!normalizeMessageSelection(source.selection)?.reasons.includes('unread')||!box?.accountId||box.accountId!==loc.accountId)return false
 const c=box.conversations?.find((c:any)=>c.groupId===loc.groupId)
 return c?.latestDirection==='inbound'&&c.unreadCount>0&&c.latestMsgId===loc.msgId&&!!loc.sentAt&&Date.parse(c.latestSentAt)===Date.parse(loc.sentAt)
}
