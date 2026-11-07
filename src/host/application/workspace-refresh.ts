/** Explicit refresh coordinates collection; durable AI jobs retain their own retry policy. */
export type RefreshScope = 'all' | 'tasks' | 'replies'
type Step = {status:string;note:string;jobId?:string;progress?:any;nextRetryAt?:string}
type Refresh = {id:string;scope:RefreshScope;status:string;startedAt:string;steps:Record<string,Step>}
interface Dependencies {
 snapshot:()=>any
 messages:()=>Promise<any>
 news:()=>Promise<any>
 analysis:()=>Promise<any>
}

export function createWorkspaceRefresh(deps:Dependencies) {
 let current:Refresh|null=null,collecting=false,newsRequested=false,newsWork:Promise<void>|null=null
 let sequence=0
 const step=(name:string,status:string,note:string,jobId?:string)=>{current!.steps[name]={status,note,...(jobId?{jobId}:{})}}
 const reportStep=(name:string,report:any,label:string)=>step(name,report?.status==='ok'?'completed':report?.status==='disabled'?'disabled':'partial',report?.status==='ok'?label+'已更新':String(report?.note||label+'未同步完整').slice(0,600))
 const collectNews=async()=>{
  step('news','running','正在更新资讯')
  try {
   const before=new Set((deps.snapshot().jobs||[]).map((job:any)=>job.id))
   const snapshot=await deps.news()
   reportStep('news',snapshot.lastRadarFetch,'资讯')
   const summary=(snapshot.jobs||[]).slice().reverse().find((job:any)=>job.kind==='summary'&&(!before.has(job.id)||['queued','running'].includes(job.status)))
   if(summary)step('summary','queued','资讯摘要已排队',summary.id)
   else if(snapshot.modelHealth?.summary)step('summary','paused',snapshot.modelHealth.summary.note||'资讯摘要已暂停，请在后台任务模型设置中恢复')
  }catch(error){step('news','failed',String((error as Error).message||error).slice(0,200))}
 }
 const collectMessages=async()=>{
  step('messages','running','正在同步消息与日历')
  try {reportStep('messages',(await deps.messages()).lastMentionsFetch,'消息与日历')}
  catch(error){step('messages','failed',String((error as Error).message||error).slice(0,200))}
  // Never reset completed/exhausted entries or human decisions. The existing
  // continuous job selects eligible messages and deduplicates active work.
  if(!deps.snapshot().settings?.aiExtract?.enabled){step('analysis','disabled','AI 识别未开启');return}
  step('analysis','running','正在启动消息识别')
  try {const result=await deps.analysis();step('analysis',result.jobId?'queued':'partial',result.note||'消息识别已排队',result.jobId)}
  catch(error){step('analysis','failed',String((error as Error).message||error).slice(0,200))}
 }
 const status=()=>{
  if(!current)return null
  const jobs=deps.snapshot().jobs||[]
  for(const row of Object.values(current.steps))if(row.jobId){
   const job=jobs.find((job:any)=>job.id===row.jobId)
   if(!job){row.status='partial';row.note='后台任务记录不可用';continue}
   row.status=job.status==='completed'?(job.result?.status==='partial'||job.result?.failures>0?'partial':'completed'):job.status==='queued'&&job.nextRetryAt?'paused':job.status==='cancelled'?'partial':job.status
   row.note=String(job.error||job.progress?.pauseReason||job.result?.note||(row.status==='completed'?'已完成':row.status==='running'?'正在处理':'已排队')).replace(/失败条目见 lastRadarSummarize/g,'部分资讯摘要未生成，可在资讯页查看详情').slice(0,600)
   row.progress=job.progress;row.nextRetryAt=job.nextRetryAt
  }
  const steps=Object.values(current.steps)
  current.status=collecting||steps.some(row=>['running','queued'].includes(row.status))?'running':steps.some(row=>['failed','partial','paused','disabled'].includes(row.status))?'partial':'completed'
  return {...structuredClone(current),collecting}
 }
 const start=(scope:RefreshScope='all')=>{
  if(!['all','tasks','replies'].includes(scope))throw Error('不支持的刷新范围')
  if(collecting){
   // Upgrade a local refresh to global without collecting messages twice.
   if(scope==='all'&&!newsRequested){current!.scope='all';newsRequested=true;newsWork=collectNews()}
   return status()
  }
  current={id:'refresh-'+Date.now()+'-'+(++sequence),scope,status:'running',startedAt:new Date().toISOString(),steps:{}}
  collecting=true;newsRequested=scope==='all';newsWork=newsRequested?collectNews():null
  void (async()=>{
   try {await collectMessages();if(newsWork)await newsWork}
   finally {collecting=false;status()}
  })()
  return status()
 }
 return {start,status}
}
