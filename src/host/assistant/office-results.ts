import {hubIndex,hubSessionOwner} from './hub-store.js'
import {assistantActionSnapshot} from './action-store.js'
import {hubTurnSnapshot,type HubTurn} from './hub-turns.js'
import {isOfficeWorkflow,OFFICE_WORKFLOW_LABELS} from '../../shared/office-workflow.js'
import {normalizeBusyReply} from '../../shared/busy-reply.js'

/** Build ownership once per projection, then route each job without repeated file reads. */
export function officeProjectionSnapshot(){return {index:hubIndex(),actions:assistantActionSnapshot(),turns:hubTurnSnapshot()}}
export function officeJobOwners(jobs:any[],snapshot=officeProjectionSnapshot()):Map<string,string>{
 const {index,actions,turns}=snapshot,owners=new Map<string,string>(),candidates:any[]=[],eligible=new Set(index.conversations.filter(row=>row.id==='system:office'||row.id.startsWith('chat:')||row.id.startsWith('office:')).map(row=>row.id))
 for(const [id,run] of Object.entries(index.runs))if(run.conversationId)owners.set(id,run.conversationId)
 for(const event of actions.events)if(eligible.has(event.conversationId)&&event.operation==='office.start')candidates.push({id:event.id,at:event.at,owner:event.conversationId,jobIds:event.after?.jobIds||event.result?.jobIds||[]})
 for(const turn of turns)if(eligible.has(turn.conversationId))for(const command of turn.commands||[])if(['office.start','workbench_office_workflow'].includes(command.operation))candidates.push({id:turn.id,at:turn.at,owner:turn.conversationId,jobIds:command.jobIds||[]})
 candidates.sort((a,b)=>String(a.at).localeCompare(String(b.at))||a.id.localeCompare(b.id));for(const row of candidates)for(const id of row.jobIds)if(!owners.has(id))owners.set(id,row.owner)
 for(const job of jobs)if(isOfficeWorkflow(job?.kind)){
  if(job.kind==='task_assist')owners.set(job.id,job.input?.taskId?'task:'+job.input.taskId:'system:office')
  else if(job.kind==='reply_batch'&&job.input?.replyIds?.length===1)owners.set(job.id,'reply:'+job.input.replyIds[0])
  else if(!owners.has(job.id))owners.set(job.id,'system:office')
 }
 return owners
}
export function officeJobAllowed(conversationId:string,job:any,owners?:Map<string,string>):boolean{return isOfficeWorkflow(job?.kind)&&(owners||officeJobOwners([job])).get(job.id)===conversationId}
export function busyReplyView(state:any){
 const normalized=normalizeBusyReply(state.settings?.busyReply),rows=Object.values(state.busyReplyDeliveries||{}) as any[]
 return {config:{enabled:normalized.enabled,startedAt:normalized.startedAt,text:normalized.text},pending:(state.replies||[]).filter((row:any)=>!row.archivedAt&&['待回复','已确认收到','已自动回复'].includes(row.stage)).length,uncertain:rows.filter(row=>['reserved','sending','uncertain'].includes(row.status)).length,sent:rows.filter(row=>row.status==='sent').length,error:state.lastBusyReplyError||null,lastCheckedAt:state.lastBusyReplyCheckAt||null}
}
export function officeArtifacts(state:any,jobs:any[]){return jobs.flatMap(job=>(job.steps||[]).filter((step:any)=>step.status==='completed'&&typeof step.artifact?.text==='string').map((step:any)=>({jobId:job.id,stepId:step.id,title:(job.title||OFFICE_WORKFLOW_LABELS[job.kind as keyof typeof OFFICE_WORKFLOW_LABELS]||'工作成果')+' · '+(step.label||'结果'),text:step.artifact.text,evidenceIds:step.artifact.evidenceIds||[],at:step.artifact.at||job.updatedAt,kind:job.kind,adoptedAt:step.adoptedAt||null,knowledgeId:(state.knowledge||[]).find((item:any)=>item.body===step.artifact.text&&item.sourceLabel==='办公作业 '+job.id+' / '+step.id)?.id||null})))}
function turnStatus(status:string):HubTurn['status']{return ['queued','running','pending'].includes(status)?'executing':status==='completed'||status==='ok'?'completed':status==='cancelled'?'interrupted':'failed'}
export function legacyOfficeTurns(conversationId:string,state:any,existing:any[]):any[]{
 const linked=new Set(existing.flatMap(turn=>[...(turn.jobIds||[]),...(turn.commands||[]).flatMap((command:any)=>command.jobIds||[])]))
 const owners=officeJobOwners(state.jobs||[]),jobs=(state.jobs||[]).filter((job:any)=>officeJobAllowed(conversationId,job,owners)&&!linked.has(job.id))
 const turns:any[]=jobs.map((job:any)=>({id:'office-history:'+job.id,conversationId,text:'',at:job.createdAt,source:'system',origin:'office-history',mode:'execute',status:turnStatus(job.status),reply:'历史工作成果 · '+(job.title||OFFICE_WORKFLOW_LABELS[job.kind as keyof typeof OFFICE_WORKFLOW_LABELS]),commands:[],jobIds:[job.id]}))
 for(const run of state.runs||[]){
  const owner=run.taskId?'task:'+run.taskId:run.sessionId&&hubSessionOwner(run.sessionId)?.startsWith('chat:')?hubSessionOwner(run.sessionId):'system:office'
  if(owner!==conversationId)continue
  turns.push({id:'office-run:'+run.id,conversationId,text:'',at:run.startedAt||run.createdAt,source:'system',origin:'office-history',mode:'execute',status:run.status==='failed'?'failed':['running','queued'].includes(run.status)?'executing':run.status==='cancelled'?'interrupted':'completed',reply:'历史处理记录'+(run.summary?'\n\n'+run.summary:''),commands:[],recordedStatus:run.status,artifacts:[]})
 }
 return turns
}
