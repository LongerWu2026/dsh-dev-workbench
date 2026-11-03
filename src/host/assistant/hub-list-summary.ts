import {knowledgeScopeKey} from '../knowledge/scope.js'
import {hubTurnsFromSnapshot} from './hub-turns.js'
import {officeJobOwners,officeProjectionSnapshot} from './office-results.js'
import {defaultKnowledgeScope} from '../knowledge/retrieval.js'

/** Summaries are read from saved receipts and jobs; listing never starts a model. */
export function conversationSummaries(rows:any[],state:any,request:any={},snapshot=officeProjectionSnapshot()){
 const {index,actions}=snapshot,owners=officeJobOwners(state.jobs||[],snapshot),scope=defaultKnowledgeScope(state,request.knowledgeScope||{}),sessionOwners=new Map(index.conversations.flatMap(row=>row.threads.map(thread=>[thread.id,row.id] as const)))
 return rows.map(row=>{
  const saved=index.conversations.find(record=>record.id===row.id),turns=hubTurnsFromSnapshot(snapshot.turns,row.id,row.id==='system:knowledge'?{knowledgeScope:scope}:{}),events=actions.events.filter(event=>event.conversationId===row.id&&(row.id!=='system:knowledge'||knowledgeScopeKey(event.knowledgeScope)===knowledgeScopeKey(scope)))
  const candidates:any[]=turns.map(turn=>({at:turn.at,text:turn.reply||turn.text,status:turn.status}));candidates.push(...events.map(event=>({at:event.at,text:event.text,status:event.status})))
  const linked=new Set(events.flatMap(event=>event.after?.jobIds||[])),jobs=(state.jobs||[]).filter((job:any)=>owners.has(job.id)?owners.get(job.id)===row.id:linked.has(job.id)||row.id==='system:analysis'&&job.kind==='analysis'||row.id==='system:radar'&&job.kind==='summary')
  const current=new Map<string,any>();for(const job of [...jobs].sort((a:any,b:any)=>String(b.createdAt).localeCompare(String(a.createdAt)))){const key=job.kind+JSON.stringify(job.input||{});if(!current.has(key))current.set(key,job)}const currentJobs=[...current.values()]
  for(const job of jobs){const artifacts=(job.steps||[]).filter((step:any)=>step.status==='completed'&&step.artifact?.text),text=job.error||job.progress?.pauseReason||artifacts.at(-1)?.artifact.text||({queued:'等待处理',running:'正在处理',completed:'处理完成',cancelled:'已停止',failed:'处理失败',paused:'处理已暂停'} as any)[job.status];candidates.push({at:job.updatedAt||job.createdAt,text,status:job.status})}
  for(const run of state.runs||[]){const owner=run.taskId?'task:'+run.taskId:run.sessionId&&sessionOwners.get(run.sessionId)||'system:office';if(owner===row.id)candidates.push({at:run.endedAt||run.startedAt||run.createdAt,text:run.summary,status:run.status})}
  candidates.sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));const latest=candidates.find(candidate=>candidate.text)
  const pending=actions.confirmations.some(card=>card.conversationId===row.id&&card.state==='pending'&&Date.parse(card.expiresAt)>Date.now()&&(row.id!=='system:knowledge'||knowledgeScopeKey(card.payload?.knowledgeScope)===knowledgeScopeKey(scope)))
  const businessAttention=row.kind==='reply'?['待回复','已确认收到','已自动回复'].includes(row.status):row.kind==='task'?['ready','failed','waiting_approval'].includes(row.status):row.kind==='development'?['paused','failed','blocked','waiting_review','waiting_approval','awaiting_review'].includes(row.status):false
  const activityStatus=currentJobs.some(job=>job.status==='running')||['recognizing','executing'].includes(turns.at(-1)?.status||'')?'running':currentJobs.some(job=>job.status==='queued')?'queued':pending?'needs_confirmation':currentJobs.some(job=>job.status==='paused')?'paused':'idle'
  return {...row,pinned:!!saved?.pinned,latestPreview:String(latest?.text||'').replace(/\s+/g,' ').slice(0,120),activityStatus,needsAttention:pending||businessAttention||['error','failed','paused','interrupted','needs_confirmation','waiting_approval'].includes(latest?.status)||currentJobs.some(job=>['failed','paused'].includes(job.status)),updatedAt:latest?.at||row.updatedAt||saved?.createdAt}
 })
}
