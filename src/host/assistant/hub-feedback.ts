import {officeJobOwners,officeJobAllowed,officeArtifacts,legacyOfficeTurns} from './office-results.js'
import {isOfficeWorkflow} from '../../shared/office-workflow.js'
import {assistantConfirmations} from './action-store.js'
import {hubTurns,type HubTurn} from './hub-turns.js'
import {describeAssistantCommand} from './command-display.js'

const starts=new Set(['analysis.continue','analysis.retry','analysis.fetch','radar.fetch','radar.summary','office.start','office.retry','development.continue'])
export function operationJobs(operation:string,result:any):string[]{
 if(!starts.has(operation))return []
 return [...new Set([result?.jobId,result?.job?.id,result?.job?.jobId,...(Array.isArray(result?.jobs)?result.jobs.map((job:any)=>job.id):[])].filter((id):id is string=>typeof id==='string'))]
}
export function ruleCommand(action:any,result?:any){
 const display=describeAssistantCommand(action.operation,action)
 return {id:'rule',operation:action.operation,...display,status:!result?'executing':result.status==='confirmation_required'?'needs_confirmation':result.status==='ok'?'completed':'failed',...(result?{resultText:result.note||result.reply||'操作未返回可展示结果',jobIds:operationJobs(action.operation,result),...(result.blocked?{blocked:true}:{}),...(result.status==='error'?{failurePhase:'execution' as const}:{})}:{})}
}
/** Render current job facts next to the initiating message without re-running them. */
export function feedbackTurns(conversationId:string,state:any,options:any={},legacyTurns:HubTurn[]=[]){
 const confirmations=assistantConfirmations(conversationId)
 const existing=[...legacyTurns,...hubTurns(conversationId,options)],owners=officeJobOwners(state.jobs||[]),allTurns=[...existing,...legacyOfficeTurns(conversationId,state,existing)],latestOfficeTurn=new Map<string,string>()
 for(const turn of allTurns)for(const id of [...(turn.jobIds||[]),...(turn.commands||[]).flatMap((command:any)=>command.jobIds||[])])if(owners.get(id)===conversationId)latestOfficeTurn.set(id,turn.id)
 return allTurns.map((turn:any)=>{
  const linked=new Set([...(turn.jobIds||[]),...turn.commands.flatMap((command:any)=>command.jobIds||[])])
  const jobs=(state.jobs||[]).filter((job:any)=>linked.has(job.id)&&(!isOfficeWorkflow(job.kind)||officeJobAllowed(conversationId,job,owners)&&latestOfficeTurn.get(job.id)===turn.id)).map((job:any)=>({...job,title:job.kind==='analysis'?'消息识别':job.kind==='summary'?'资讯摘要':job.kind==='reply_batch'?'回复草稿':job.kind==='work_report'?'工作报告':'事项处理'}))
  const cards=confirmations.filter(card=>(card as any).turnId===turn.id)
  let status=turn.status,executionNote:string|undefined=[...linked].some(id=>owners.get(String(id))===conversationId&&latestOfficeTurn.get(String(id))!==turn.id)?'完整成果见后续处理记录。':undefined,confirmationNote:string|undefined
  if(status==='needs_confirmation'&&cards.length&&cards.every(card=>card.state!=='pending'&&card.state!=='executing')){
   status=cards.some(card=>card.state==='failed')?'failed':'completed'
   confirmationNote=cards.map(card=>card.state==='cancelled'?'已取消该操作。':card.result?.note||'确认操作已处理。').join('\n')
  }
  if(jobs.length){
   const active=jobs.filter((job:any)=>['queued','running','pending'].includes(job.status))
   const failed=jobs.filter((job:any)=>['failed','paused'].includes(job.status))
   if(active.length){status='executing';executionNote='后台任务正在处理，以下进度会自动更新。'}
   else if(failed.length){status='failed';executionNote=failed.map((job:any)=>job.progress?.pauseReason||job.error||'后台任务未完成，请查看处理结果。').join('\n')}
   else if(jobs.every((job:any)=>job.status==='completed')){if(!['failed','interrupted'].includes(status))status='completed';executionNote='后台任务已完成，结果如下。'}
   else if(jobs.some((job:any)=>job.status==='cancelled')){status='interrupted';executionNote='后台任务已停止，已完成部分仍保留。'}
  }
  if(cards.some(card=>['pending','executing'].includes(card.state))&&status!=='failed'){status='needs_confirmation';confirmationNote='仍有操作等待你的确认，尚未执行。'}
  executionNote=[confirmationNote,executionNote].filter(Boolean).join('\n')||undefined
  return {...turn,status,jobs,artifacts:officeArtifacts(state,jobs),executionNote}
 })
}
