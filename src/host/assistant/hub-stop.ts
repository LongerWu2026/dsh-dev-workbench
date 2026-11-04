import {hashText,hostNowIso} from '../platform/runtime.js'
import {hostService} from './sessions.js'
import {transcriptDelta} from './transcript.js'
import {hubTurns,getHubTurn,updateHubTurn,activeHubTurns} from './hub-turns.js'
import {pauseWorkflowJobs} from '../automation/job-control.js'
import {developmentService,isDevelopmentTaskActive} from '../application/development-service.js'

export function assertHubTurnActive(id:string){if(getHubTurn(id)?.stopRequestedAt)throw Object.assign(Error('本轮已停止，历史与已生成内容保留'),{code:'ASSISTANT_TURN_STOPPED'})}
function runningSession(ctx:any,id:string){
 const session=hostService(ctx,'sessions')?.get?.(id),agent=hostService(ctx,'agents')?.get?.(id)
 if(!session||session.header?.parentSession||session.header?.origin==='subagent')return null
 const events=session.snapshotEvents?.()||[],lastStart=events.filter((event:any)=>event.type==='turn/start').at(-1),active=agent?agent.status==='running':transcriptDelta(session,0).turnActive
 return active?{sessionId:id,turnSeq:lastStart?.seq??(Number(session.seq)||0)}:null
}
export function hubStopState(ctx:any,conversation:any,sessionIds:string[],runs:any[],query:any={}){
 const sessions=[...new Set(sessionIds.filter(Boolean))].map(id=>runningSession(ctx,id)).filter((row):row is {sessionId:string;turnSeq:number}=>!!row),jobs=runs.filter(row=>['queued','running'].includes(row.status)).map(row=>({id:row.id,executionId:row.executionId||null}))
 const pending=hubTurns(conversation.id,query).filter(row=>!row.stopRequestedAt&&['recognizing','executing'].includes(row.status)&&(!row.sessionId||sessionIds.includes(row.sessionId))).map(row=>({requestId:row.requestId,turnId:row.id,sessionId:row.sessionId||null}))
 const settling=hubTurns(conversation.id,query).filter(row=>row.stopRequestedAt&&['recognizing','executing'].includes(row.status)&&row.sessionId&&sessionIds.includes(row.sessionId)).map(row=>({requestId:row.requestId,turnId:row.id,sessionId:row.sessionId}))
 const development=conversation.kind==='development'&&isDevelopmentTaskActive(conversation.entityId)
 return {sessionIds:[...new Set(sessionIds.filter(Boolean))],available:!!(sessions.length||jobs.length||pending.length||settling.length||development),running:!!(sessions.length||runs.some(row=>row.status==='running')||development),supported:typeof hostService(ctx,'sessionController')?.cancel==='function',sessions,jobs,pending,settling,development,token:hashText(JSON.stringify({conversationId:conversation.id,sessions,jobs,pending,settling,development}))}
}
const receipts=new WeakMap<object,Map<string,Promise<any>>>()
/** Remove only this request from native Queue, or stop its admitted first turn. */
export async function cancelHubTurn(ctx:any,turn:any){
 if(!turn?.sessionId)return 'settled'
 const controller=hostService(ctx,'sessionController'),agent=hostService(ctx,'agents')?.get?.(turn.sessionId),session=hostService(ctx,'sessions')?.get?.(turn.sessionId)
 const queued=[...(agent?.inbox?.nextTurn||[]),...(agent?.inbox?.nextStep||[])].find(row=>row.source?.rpcId===turn.requestId)
 if(queued){if(typeof controller?.updateQueue!=='function')throw Error('宿主不支持移除本条排队消息，请在原会话中取消');const ack=await controller.updateQueue({sessionId:turn.sessionId,itemId:queued.id,action:{kind:'remove'}});if(ack?.accepted!==true)throw Error('宿主尚未确认移除排队消息');updateHubTurn(turn.id,{status:'interrupted',reply:'已停止，本条排队消息未执行，历史保留'});return 'removed'}
 if(!session||!runningSession(ctx,turn.sessionId))return ['recognizing','executing'].includes(turn.status)?'pending':'settled'
 if(activeHubTurns(session).some(row=>row.requestId===turn.requestId)){const ack=await controller.cancel({sessionId:turn.sessionId});if(ack?.accepted!==true)throw Error('宿主尚未确认停止请求');return 'cancelled'}
 return 'pending'
}
export async function stopHubWork(ctx:any,conversation:any,request:any,current:ReturnType<typeof hubStopState>){
 if(!current.supported)throw Error('当前 Harness 没有提供会话停止接口，请更新宿主后重试')
 let pending=request.requestId?current.pending.find(row=>row.requestId===request.requestId):undefined
 if(request.requestId&&!pending){
  const old=hubTurns(conversation.id).find(row=>row.requestId===request.requestId)
  const agent=old?.sessionId?hostService(ctx,'agents')?.get?.(old.sessionId):undefined,queued=[...(agent?.inbox?.nextTurn||[]),...(agent?.inbox?.nextStep||[])].some(row=>row.source?.rpcId===request.requestId)
  if(old?.stopRequestedAt&&current.sessionIds.includes(old.sessionId!)&&(queued||activeHubTurns(hostService(ctx,'sessions')?.get?.(old.sessionId)).some(row=>row.requestId===request.requestId)))pending={requestId:old.requestId,turnId:old.id,sessionId:old.sessionId||null}
  else if(old?.stopRequestedAt)return {status:'ok',note:'本轮已请求停止，未停止之后的新轮次',stopping:current.settling.some(row=>row.turnId===old.id)}
  else if(old)return {status:'ok',note:'本轮已经结束，未停止之后的新轮次',stopping:false}
  if(!old)throw Error('尚未找到本轮提交，请稍后核对；没有停止其他会话')
 }
 if(!pending&&request.token!==current.token)throw Error('会话运行轮次已变化，请刷新后再停止；未中断新的轮次')
 if(!current.available&&!pending)return {status:'ok',note:'当前会话已结束',stopping:false}
 let cache=receipts.get(ctx);if(!cache){cache=new Map();receipts.set(ctx,cache)}
 const receiptId=conversation.id+':'+(pending?.requestId||current.token),prior=cache.get(receiptId);if(prior)return prior
 const work=(async()=>{
  if(pending)updateHubTurn(pending.turnId,{stopRequestedAt:hostNowIso(),...(!pending.sessionId?{status:'interrupted' as const,reply:'已停止，本轮尚未发送，文字与附件保留'}:{})})
  // Persist the dispatch fence before asking the native Agent to cancel.
  if(current.jobs.length)await pauseWorkflowJobs(current.jobs.map(row=>row.id))
  if(current.development)await developmentService.development({action:'pause',id:conversation.entityId})
  const errors:string[]=[];let pendingOutcome:string|undefined
  if(pending)try{pendingOutcome=await cancelHubTurn(ctx,getHubTurn(pending.turnId))}catch(error){errors.push(String(error?.message||error))}
  for(const target of current.sessions){
   if(pending&&(!current.jobs.length||target.sessionId===pending.sessionId))continue
   const now=runningSession(ctx,target.sessionId);if(!now)continue
   if(now.turnSeq!==target.turnSeq){errors.push('原轮次已结束，新轮次未停止，请刷新核对');continue}
   try{const ack=await hostService(ctx,'sessionController').cancel({sessionId:target.sessionId});if(ack?.accepted!==true)throw Error('宿主尚未确认停止请求')}catch(error){errors.push(String(error?.message||error))}
  }
  if(errors.length)return {status:'error',note:'后续调度已暂停；停止在途会话失败：'+errors.join('；')}
  const stopping=(pending?pendingOutcome==='pending'||pendingOutcome==='cancelled'&&!!runningSession(ctx,pending.sessionId!):false)||current.sessions.some(row=>(!pending||current.jobs.length>0&&row.sessionId!==pending.sessionId)&&!!runningSession(ctx,row.sessionId))||current.development&&isDevelopmentTaskActive(conversation.entityId)
  return {status:'ok',stopping,note:stopping?'已请求停止，正在等待原生会话结束':'已停止，历史与已完成进度已保留'}
 })();cache.set(receiptId,work);if(cache.size>128)cache.delete(cache.keys().next().value!)
 try{const result=await work;if(result.status==='error')cache.delete(receiptId);return result}catch(error){cache.delete(receiptId);throw error}
}
