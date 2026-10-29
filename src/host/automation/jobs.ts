import { loadWorkbenchState, mutateWorkbenchState, workbenchGenerationGuard } from '../storage/state-store.js'
import { runAnalysisBatch } from '../analysis/message-analysis.js'
import { runRadarSummarizeBatch } from '../news/summarizer.js'
import { runOfficeWorkflow } from '../workflows/office-jobs.js'
import { isOfficeWorkflow, type OfficeWorkflowKind } from '../../shared/office-workflow.js'
import { newId, hostNowIso } from '../platform/runtime.js'
interface WorkflowJob {id:string;kind:'analysis'|'summary'|OfficeWorkflowKind;status:'queued'|'running'|'completed'|'failed'|'cancelled';input:Record<string,unknown>;createdAt:string;updatedAt:string;attempts:number;result?:unknown;error?:string;nextRetryAt?:string|null;executionId?:string}
let draining=false
export async function startWorkflowJob(ctx:unknown,kind:'analysis'|'summary',input:Record<string,unknown>={}):Promise<{jobId:string;status:string;note:string}> {
 let job:WorkflowJob|undefined
 const onlyIds=Array.isArray(input.onlyIds)?input.onlyIds.filter(id=>typeof id==='string'&&id.length>0).slice(0,50):[]
 const safeInput:Record<string,unknown>=kind==='analysis'?{limit:Math.max(1,Math.min(20,Number(input.limit)||loadWorkbenchState().settings.aiExtract?.batchSize||5)),onlyIds}:{limit:Math.max(1,Math.min(10,Number(input.limit)||3)),onlyIds,retryFailed:input.retryFailed===true}
 await mutateWorkbenchState((state:any)=>{
   if(state.modelHealth)delete state.modelHealth[kind];
   state.jobs=state.jobs||[]
   job=state.jobs.find((row:WorkflowJob)=>row.kind===kind&&['queued','running'].includes(row.status)&&JSON.stringify(row.input)===JSON.stringify(safeInput))
   if(job?.status==='queued')Object.assign(job,{nextRetryAt:null,attempts:0,error:undefined,result:undefined,updatedAt:hostNowIso()})
   if(!job){job={id:newId('job'),kind,status:'queued',input:safeInput,createdAt:hostNowIso(),updatedAt:hostNowIso(),attempts:0};state.jobs.push(job)}
   return state
 })
 void drainWorkflowJobs(ctx).catch(()=>{})
 return {jobId:job!.id,status:job!.status,note:'已进入后台队列，处理结果由工作台状态同步显示'}
}
export async function drainWorkflowJobs(ctx:unknown):Promise<void>{
 if(draining)return
 draining=true
 const assertCurrent=workbenchGenerationGuard()
 try{
  while(true){
   assertCurrent()
   const pending:WorkflowJob|undefined=(loadWorkbenchState().jobs||[]).slice().sort((a:WorkflowJob,b:WorkflowJob)=>Number(isOfficeWorkflow(b.kind))-Number(isOfficeWorkflow(a.kind))).find((row:WorkflowJob)=>row.status==='queued'&&(!row.nextRetryAt||Date.parse(row.nextRetryAt)<=Date.now()))
   if(!pending)break
   let admitted: WorkflowJob | undefined
   await mutateWorkbenchState((state:any)=>{const row=state.jobs.find((job:WorkflowJob)=>job.id===pending.id);if(row && row.status==='queued'){Object.assign(row,{status:'running',error:undefined,nextRetryAt:null,executionId:newId('execution'),updatedAt:hostNowIso()});admitted={...row,input:{...row.input}}}return state})
   if(!admitted)continue
   try{
    const result=isOfficeWorkflow(admitted.kind)?await runOfficeWorkflow(ctx,admitted):admitted.kind==='analysis'?await runAnalysisBatch(ctx,admitted.input):await runRadarSummarizeBatch(ctx,admitted.input)
    assertCurrent()
    await mutateWorkbenchState((state:any)=>{assertCurrent();const row=state.jobs.find((job:WorkflowJob)=>job.id===pending.id);if(row?.status==='running'&&row.executionId===admitted!.executionId){row.result=result;row.updatedAt=hostNowIso();if(['busy','interrupted'].includes(result.status)||result.status==='deferred'&&result.retryAt){row.status='queued';row.nextRetryAt=result.retryAt||new Date(Date.now()+60000).toISOString()}else row.status=['ok','partial'].includes(result.status)?'completed':'failed'}return state})
    if(['busy','interrupted','deferred'].includes(result.status))break
   }catch(e){
    assertCurrent()
    await mutateWorkbenchState((state:any)=>{assertCurrent();const row=state.jobs.find((job:WorkflowJob)=>job.id===pending.id);if(row?.status==='running'&&row.executionId===admitted!.executionId){const deferred=['WORKBENCH_RUNTIME_RESUMED','WORKBENCH_AI_BUDGET'].includes(e.code);if(deferred&&isOfficeWorkflow(row.kind))for(const step of (row as any).steps||[])if(step.status==='running')step.status='pending';if(!deferred)row.attempts=(row.attempts||0)+1;row.status=deferred||row.attempts<3?'queued':'failed';row.nextRetryAt=e.retryAt||new Date(Date.now()+(deferred?60000:2**row.attempts*60000)).toISOString();row.error=e instanceof Error?e.message:String(e);row.updatedAt=hostNowIso()}return state})
   }
  }
 }finally{draining=false}
}
