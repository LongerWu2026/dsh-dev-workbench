import {loadWorkbenchState,mutateWorkbenchState} from '../storage/state-store.js'
import {hostNowIso} from '../platform/runtime.js'

export class WorkflowStoppedError extends Error {readonly code='WORKBENCH_WORKFLOW_STOPPED';constructor(){super('用户已停止，历史与已完成进度已保留')}}
export const isWorkflowStopped=(error:any)=>error?.code==='WORKBENCH_WORKFLOW_STOPPED'
export function workflowGuard(jobId?:string){
 const version=jobId?Number(loadWorkbenchState().jobs.find((row:any)=>row.id===jobId)?.controlGeneration)||0:0
 return ()=>{if(!jobId)return;const job=loadWorkbenchState().jobs.find((row:any)=>row.id===jobId);if(job&&(job.pausedByUser||Number(job.controlGeneration||0)!==version))throw new WorkflowStoppedError()}
}
export function purposePaused(kind:string,state=loadWorkbenchState()){return state.jobs.some((row:any)=>row.kind===kind&&row.pausedByUser&&row.status==='paused')}
export function dispatchPaused(kind:string,jobId?:string){const state=loadWorkbenchState(),job=state.jobs.find((row:any)=>row.id===jobId);return (!job||job.input?.observed)&&purposePaused(kind,state)}
export async function pauseWorkflowJobs(ids:string[]){
 await mutateWorkbenchState((state:any)=>{
  for(const row of state.jobs)if(ids.includes(row.id)&&['queued','running'].includes(row.status)){
   row.status='paused';row.pausedByUser=true;row.controlGeneration=(Number(row.controlGeneration)||0)+1;row.nextRetryAt=null;row.updatedAt=hostNowIso();row.note='用户已停止，已完成部分保留，可手动继续';delete row.error
   if(row.progress)row.progress={...row.progress,pauseReason:row.note}
   for(const step of row.steps||[])if(step.status==='running'){step.status='pending';delete step.error}
  }
  return state
 })
}
