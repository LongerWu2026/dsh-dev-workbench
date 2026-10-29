import {taskSource} from './message-display.js'

/** The original private conversation is explicit evidence, never inferred from a name. */
export function taskReplyTarget(state:any,taskId:string):any|null {
 const task=state.tasks?.find((row:any)=>row.id===taskId&&!row.archivedAt)
 if(!task)return null
 const source=taskSource(task,state.sources||[]),loc=source?.locator
 if(source?.provider!=='yunzhijia'||!loc?.groupId||!loc.msgId||!loc.accountId||loc.direction==='outbound')return null
 const conversation=state.messageInbox?.accountId===loc?.accountId?state.messageInbox.conversations?.find((row:any)=>row.groupId===loc?.groupId):null
 const type=loc?.groupType||conversation?.groupType||state.syncCursors?.[loc?.accountId+':'+loc?.groupId]?.groupType
 return Number(type)===1?{task,source,loc}:null
}

export function taskReplyMatches(state:any,taskId:string,reply:any):boolean {
 const target=taskReplyTarget(state,taskId)
 return !!target&&!reply?.archivedAt&&reply?.sourceId===target.source.id&&reply.msgId===target.loc.msgId&&reply.accountId===target.loc.accountId&&reply.groupId===target.loc.groupId&&(reply.taskIds||[]).includes(taskId)
}
