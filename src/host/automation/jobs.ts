import {messageSkipReason} from '../domain/message-policy.js'
import {auditEntry} from '../domain/model.js'
import { loadWorkbenchState, mutateWorkbenchState, workbenchGenerationGuard } from '../storage/state-store.js'
import { runAnalysisBatch } from '../analysis/message-analysis.js'
import { runRadarSummarizeBatch } from '../news/summarizer.js'
import { runOfficeWorkflow } from '../workflows/office-jobs.js'
import { isOfficeWorkflow, type OfficeWorkflowKind } from '../../shared/office-workflow.js'
import { newId, hostNowIso } from '../platform/runtime.js'
import { analysisProcessedCount, analysisRemainder, advanceAnalysisJob } from './analysis-progress.js'
import type { AnalysisProgress } from '../../shared/analysis-progress.js'
interface WorkflowJob {id:string;kind:'analysis'|'summary'|OfficeWorkflowKind;status:'queued'|'running'|'completed'|'failed'|'cancelled';input:Record<string,unknown>;createdAt:string;updatedAt:string;attempts:number;result?:unknown;error?:string;nextRetryAt?:string|null;executionId?:string;progress?:AnalysisProgress}
let draining=false
export async function startWorkflowJob(ctx:unknown,kind:'analysis'|'summary',input:Record<string,unknown>={}):Promise<{jobId:string;status:string;note:string}> {
 let job:WorkflowJob|undefined
 const onlyIds=Array.isArray(input.onlyIds)?input.onlyIds.filter(id=>typeof id==='string'&&id.length>0).slice(0,50):[]
 const safeInput:Record<string,unknown>=kind==='analysis'?{limit:onlyIds.length?Math.max(1,Math.min(50,Number(input.limit)||50)):50,onlyIds,continuous:!onlyIds.length}:{limit:Math.max(1,Math.min(10,Number(input.limit)||3)),onlyIds,retryFailed:input.retryFailed===true}
 await mutateWorkbenchState((state:any)=>{
   state.jobs=state.jobs||[]
   job=state.jobs.find((row:WorkflowJob)=>row.kind===kind&&['queued','running'].includes(row.status)&&JSON.stringify(row.input)===JSON.stringify(safeInput))
   if(kind==='analysis'&&input.retryFailed===true&&!job){
     if(!state.settings.aiExtract?.enabled)throw Error('请先开启AI识别，再重试失败消息');
     if(state.jobs.some((row:WorkflowJob)=>row.kind==='analysis'&&['queued','running'].includes(row.status)))throw Error('已有提取任务正在执行或等待重试，请等待当前任务结束');
     const sources=new Map<string,any>(state.sources.map((source:any)=>[source.id,source]));
     let reset=0;
     for(const row of state.analysisQueue){
       const source=sources.get(row.sourceId);
       if(row.status!=='failed'||onlyIds.length&&!onlyIds.includes(row.id)&&!onlyIds.includes(row.sourceId)||!source||messageSkipReason(state,source,row))continue;
       Object.assign(row,{status:'pending',attempts:0,nextRetryAt:null,lastError:null,leaseUntil:null});reset++;
     }
     if(reset)auditEntry(state,'analysis.retryFailed','人工重试失败消息 '+reset+' 条，重新开放本轮重试资格');
   }
   if(!safeInput.continuous || !job) {if(state.modelHealth)delete state.modelHealth[kind]}
   if(job?.status==='queued'&&!safeInput.continuous)Object.assign(job,{nextRetryAt:null,attempts:0,error:undefined,result:undefined,updatedAt:hostNowIso()})
   if(!job){job={id:newId('job'),kind,status:'queued',input:safeInput,createdAt:hostNowIso(),updatedAt:hostNowIso(),attempts:0};if(safeInput.continuous){const rest=analysisRemainder(state);job.progress={processed:0,remaining:rest.remaining,failed:rest.failed,batches:0,pauseReason:null}}state.jobs.push(job)}
   return state
 })
 void drainWorkflowJobs(ctx).catch(()=>{})
 return {jobId:job!.id,status:job!.status,note:safeInput.continuous?'已开始按每批 50 条连续识别，进度由工作台自动同步':'已进入后台队列，处理结果由工作台状态同步显示'}
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
   await mutateWorkbenchState((state:any)=>{const row=state.jobs.find((job:WorkflowJob)=>job.id===pending.id);if(row && row.status==='queued'){Object.assign(row,{status:'running',error:undefined,nextRetryAt:null,executionId:newId('execution'),updatedAt:hostNowIso()});if(row.progress)Object.assign(row.progress,{processed:analysisProcessedCount(state,row),pauseReason:null});admitted={...row,input:{...row.input}}}return state})
   if(!admitted)continue
   try{
    const result=isOfficeWorkflow(admitted.kind)?await runOfficeWorkflow(ctx,admitted):admitted.kind==='analysis'?await runAnalysisBatch(ctx,{...admitted.input,...(admitted.input.continuous?{analysisJobId:admitted.id}:{})}):await runRadarSummarizeBatch(ctx,admitted.input)
    assertCurrent()
    await mutateWorkbenchState((state:any)=>{assertCurrent();const row=state.jobs.find((job:WorkflowJob)=>job.id===pending.id);if(row?.status==='running'&&row.executionId===admitted!.executionId){row.updatedAt=hostNowIso();if(row.kind==='analysis'&&row.input.continuous)advanceAnalysisJob(state,row,result);else{row.result=result;if(['busy','interrupted'].includes(result.status)||result.status==='deferred'&&result.retryAt){row.status='queued';row.nextRetryAt=result.retryAt||new Date(Date.now()+60000).toISOString()}else row.status=['ok','partial'].includes(result.status)?'completed':'failed'}}return state})
    if(['busy','interrupted','deferred'].includes(result.status))break
   }catch(e){
    assertCurrent()
    await mutateWorkbenchState((state:any)=>{assertCurrent();const row=state.jobs.find((job:WorkflowJob)=>job.id===pending.id);if(row?.status==='running'&&row.executionId===admitted!.executionId){const deferred=['WORKBENCH_RUNTIME_RESUMED','WORKBENCH_AI_BUDGET'].includes(e.code);if(deferred&&isOfficeWorkflow(row.kind))for(const step of (row as any).steps||[])if(step.status==='running')step.status='pending';if(!deferred)row.attempts=(row.attempts||0)+1;row.status=deferred||row.attempts<3?'queued':'failed';row.nextRetryAt=row.status==='queued'?e.retryAt||new Date(Date.now()+(deferred?60000:2**row.attempts*60000)).toISOString():null;row.error=e instanceof Error?e.message:String(e);if(row.progress){const rest=analysisRemainder(state);Object.assign(row.progress,{processed:analysisProcessedCount(state,row),remaining:rest.remaining,failed:rest.failed,pauseReason:row.error})}row.updatedAt=hostNowIso()}return state})
   }
  }
 }finally{draining=false}
}
