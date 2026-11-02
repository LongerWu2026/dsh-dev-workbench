/** Workbench-only read positions. Never replace provider unread counts or reply stages. */
export type ConversationReadMark={accountId:string;groupId:string;headMsgId:string;headSentAt:string|null;openedAt:string;readAt:string}
const iso=(value:any):string|null=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null
const id=(value:any):boolean=>typeof value==='string'&&!!value.trim()&&value.length<=512
export const conversationReadKey=(accountId:string,groupId:string)=>JSON.stringify([accountId,groupId])
export function normalizeConversationReadMarks(raw:any):Record<string,ConversationReadMark>{
 const entries:ConversationReadMark[]=[]
 if(raw&&typeof raw==='object'&&!Array.isArray(raw))for(const value of Object.values(raw) as any[]){
  if(!value||!id(value.accountId)||!id(value.groupId)||!id(value.headMsgId)||!iso(value.openedAt)||!iso(value.readAt))continue
  entries.push({accountId:value.accountId,groupId:value.groupId,headMsgId:value.headMsgId,headSentAt:iso(value.headSentAt),openedAt:iso(value.openedAt)!,readAt:iso(value.readAt)!})
 }
 return Object.fromEntries(entries.sort((a,b)=>Date.parse(b.readAt)-Date.parse(a.readAt)).slice(0,2000).map(mark=>[conversationReadKey(mark.accountId,mark.groupId),mark]))
}
export function conversationReadMark(data:any,conversation:any):ConversationReadMark|undefined{
 return data?.conversationReadMarks?.[conversationReadKey(data?.messageInbox?.accountId,conversation?.groupId)]
}
export function isConversationRead(data:any,conversation:any):boolean{
 const mark=conversationReadMark(data,conversation)
 if(!mark||!conversation?.latestMsgId)return false
 return mark.headMsgId===conversation.latestMsgId||!!(mark.headSentAt&&iso(conversation.latestSentAt)&&Date.parse(conversation.latestSentAt)<Date.parse(mark.headSentAt))
}
/** A late acknowledgement from an older window must not roll back a newer read position. */
export function mergeConversationReadMark(raw:any,mark:ConversationReadMark):Record<string,ConversationReadMark>{
 const marks=normalizeConversationReadMarks(raw),key=conversationReadKey(mark.accountId,mark.groupId),previous=marks[key]
 if(previous){
  if(previous.headMsgId===mark.headMsgId)return marks
  const delta=previous.headSentAt&&mark.headSentAt?Date.parse(mark.headSentAt)-Date.parse(previous.headSentAt):0
  if(delta<0||delta===0&&Date.parse(mark.openedAt)<Date.parse(previous.openedAt))return marks
 }
 return normalizeConversationReadMarks({...marks,[key]:mark})
}
