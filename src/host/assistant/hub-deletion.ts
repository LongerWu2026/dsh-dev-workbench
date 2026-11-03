import {loadWorkbenchState} from '../storage/state-store.js'
import {hubIndex} from './hub-store.js'
import {hostService} from './sessions.js'
import {readHubWorkspace} from './hub-workspace.js'

/** A recoverable removal uses the native archive, so both chat surfaces agree. */
export function isArchivedHubChat(ctx:any,id:string){
 return typeof id==='string'&&id.startsWith('chat:')&&(hostService(ctx,'workspaceRegistry')?.archivedSessionIds||[]).includes(id.slice(5))
}
export function hubDeletionPolicy(ctx:any,conversation:any,state=loadWorkbenchState(),index=hubIndex(),binding?:any){
 const blocked=(reason:string)=>({canDelete:false,deleteBlockedReason:reason})
 if(conversation.kind!=='chat'||!conversation.id.startsWith('chat:'))return blocked('固定系统和关联事项会话不能删除')
 const sessionId=conversation.id.slice(5),registry=hostService(ctx,'workspaceRegistry')
 if(isArchivedHubChat(ctx,conversation.id))return blocked('该会话已删除，可在 Harness 已归档会话中恢复')
 if(typeof registry?.archiveSession!=='function'||typeof registry?.list!=='function'||!Array.isArray(registry.archivedSessionIds))return blocked('当前宿主不支持可恢复的会话删除')
 const session=hostService(ctx,'sessions')?.get?.(sessionId)
 if(!session)return blocked('暂时无法核实历史会话归属，请先打开原会话再删除')
 if(session.header?.parentSession||session.header?.origin==='subagent')return blocked('分支或子智能体关联会话不能删除')
 if(index.conversations.some(row=>row.id!==conversation.id&&row.threads.some(thread=>thread.id===sessionId))||Object.values(index.runs).some(run=>run.conversationId===conversation.id||run.links.some(link=>link.sessionId===sessionId))||(state.runs||[]).some((run:any)=>run.sessionId===sessionId))return blocked('该会话已关联事项或工作记录，不能删除')
 const workspace=binding||readHubWorkspace(ctx,conversation,sessionId,state)
 if(workspace.workspaceState!=='unbound')return blocked('绑定工作区或归属无法确认的会话不能删除')
 if(['running','queued','needs_confirmation'].includes(conversation.activityStatus))return blocked('会话正在处理或等待确认，请先处理完再删除')
 return {canDelete:true,deleteBlockedReason:null}
}

export async function deleteHubConversation(ctx:any,conversation:any,confirmed:unknown){
 const policy=hubDeletionPolicy(ctx,conversation)
 if(!policy.canDelete)throw Error(policy.deleteBlockedReason||'该会话不能删除')
 if(confirmed!==true)return {status:'confirmation_required',conversationId:conversation.id,title:conversation.title,note:'确认删除这条临时会话？记录将保留在 Harness 已归档会话中，可恢复。'}
 const registry=hostService(ctx,'workspaceRegistry'),sessionId=conversation.id.slice(5)
 // Do not request stopActivity: the native admission gate must reject active work.
 await registry.archiveSession(sessionId)
 if(!registry.archivedSessionIds.includes(sessionId))throw Error('宿主尚未确认会话已删除，请刷新核对；没有移除助手记录')
 return {status:'ok',conversationId:conversation.id,sessionId,archived:true,note:'临时会话已删除，可从 Harness 已归档会话恢复'}
}
