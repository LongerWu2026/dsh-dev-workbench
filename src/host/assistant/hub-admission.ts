import {hubIndex,rememberHubSession} from './hub-store.js'
import {hostService,isWorkbenchBackgroundSession} from './sessions.js'
import {developmentSessionIds} from '../storage/development-store.js'
import {taskThreads} from './task-threads.js'
import {loadWorkbenchState} from '../storage/state-store.js'
import {isArchivedHubChat} from './hub-deletion.js'
import {readHubWorkspace} from './hub-workspace.js'
import {readHubNativeTitle} from './hub-native.js'

/** A native workspace or a loaded Session alone is not Workbench membership.
 * Old canonical index links and the legacy office setting remain valid. */
export function hubChatAdmitted(id:string,state=loadWorkbenchState(),index=hubIndex()):boolean{
 if(!id.startsWith('chat:'))return false
 const sessionId=id.slice(5),saved=index.conversations.find(row=>row.id===id)
 if(saved?.admission&&saved.admission.sessionId!==sessionId)return false
 return !!saved?.threads.some(thread=>thread.id===sessionId)||state.settings?.assistantSessionId===sessionId
}
const claimedSessions=()=>new Set([...developmentSessionIds(),...taskThreads().flatMap(row=>row.threads.map(thread=>thread.id))])
function externalSession(ctx:any,sessionId:string,state:any,index:ReturnType<typeof hubIndex>,claimed=claimedSessions()){
 const session=hostService(ctx,'sessions')?.get?.(sessionId)
 if(!session||session.id!==sessionId)throw Error('原会话尚未加载，请先在 Harness 打开，再刷新可接入会话')
 if(session.header?.parentSession||session.header?.origin==='subagent')throw Error('分支或子智能体会话请从原事项进入')
 if(claimed.has(sessionId)||index.conversations.some(row=>row.id!=='chat:'+sessionId&&row.threads.some(thread=>thread.id===sessionId))||isWorkbenchBackgroundSession(state,sessionId,session))throw Error('该会话已关联其他事项，请从对应事项进入')
 if(isArchivedHubChat(ctx,'chat:'+sessionId))throw Error('该会话已归档，请先在 Harness 恢复')
 const workspace=readHubWorkspace(ctx,{id:'chat:'+sessionId,kind:'chat'},sessionId,state,session)
 if(workspace.workspaceState==='unavailable')throw Error(workspace.workspaceError||'原会话工作区归属暂不能确认')
 return {sessionId,title:readHubNativeTitle(session)||'会话 '+sessionId.slice(-8),...workspace}
}
/** Called only by the explicit connect picker; no transcript or model execution. */
export function availableHubChats(ctx:any){
 const state=loadWorkbenchState(),index=hubIndex(),claimed=claimedSessions(),rows:any[]=[]
 for(const session of hostService(ctx,'sessions')?.list?.()||[]){
  if(!session?.id||hubChatAdmitted('chat:'+session.id,state,index))continue
  try{rows.push(externalSession(ctx,session.id,state,index,claimed))}catch{/* associated or unverifiable sessions cannot be adopted */}
 }
 return {status:'ok',sessions:rows}
}
export function adoptHubChat(ctx:any,request:any){
 const sessionId=typeof request.sessionId==='string'?request.sessionId:''
 if(!sessionId||sessionId.length>120)throw Error('请选择要接入的原生会话')
 const state=loadWorkbenchState(),index=hubIndex(),target=externalSession(ctx,sessionId,state,index),conversationId='chat:'+sessionId
 if(request.confirmed!==true)return {status:'confirmation_required',conversationId,...target,note:'确认将这条原会话接入 AI 助手？'}
 rememberHubSession(conversationId,sessionId,target.title,{selected:true,admission:'adopted'})
 return {status:'ok',conversationId,...target,note:'已接入原会话，历史、目录与原生会话标识保持不变。'}
}
