import * as React from 'react'
import {WB,Btn,IconBtn,Modal,Spinner} from '../core/runtime.js'
import {AnalysisJobProgress} from './WorkflowJobs.js'

const labels:Record<string,string>={messages:'消息与日历',analysis:'消息识别',news:'AI 资讯',summary:'资讯摘要'}
const statuses:Record<string,string>={pending:'等待',running:'进行中',queued:'已排队',paused:'等待重试',completed:'完成',partial:'需留意',failed:'失败',disabled:'未开启'}

/** Mounted once in the workbench shell: navigation never stops refresh observation. */
export function WorkspaceRefreshMonitor(){
 const state=WB.useStore(),active=state.workspaceRefresh?.status==='running',waiting=Object.values(state.workspaceRefresh?.steps||{}).some((step:any)=>step.status==='paused'),id=state.workspaceRefresh?.id
 const notified=React.useRef(new Set<string>())
 React.useEffect(()=>{
  let alive=true,inFlight=false,timer:ReturnType<typeof setTimeout>
  const poll=async()=>{
   if(!alive||inFlight||WB.store.get().refreshStarting)return
   inFlight=true
   try {
    if(document.visibilityState==='hidden')return
    const report=await WB.actions.refreshStatus()
    if(!alive)return
    if(report){
     await WB.actions.syncCheck()
     if(report.status!=='running'&&!notified.current.has(report.id)){
      notified.current.add(report.id)
      WB.toast(report.status==='completed'?'刷新完成':'刷新已返回，部分步骤需留意',report.status==='completed'?'ok':'info')
     }
    }
   }catch{if(alive)WB.store.set({refreshStatusError:'刷新状态暂时无法同步，稍后重试'})}
   finally{inFlight=false;if(alive){const report=WB.store.get().workspaceRefresh;if(report?.status==='running'||Object.values(report?.steps||{}).some((step:any)=>step.status==='paused'))timer=setTimeout(poll,report?.status==='running'?1500:15000)}}
  }
  const wake=()=>{clearTimeout(timer);void poll()}
  void poll();window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake)
  return()=>{alive=false;clearTimeout(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake)}
 },[active,waiting,id,state.refreshStarting])
 return null
}

export function WorkspaceRefresh({scope='all',iconOnly=false}:{scope?:'all'|'tasks'|'replies';iconOnly?:boolean}){
 const state=WB.useStore(),[open,setOpen]=React.useState(false)
 const lastAutomaticId=React.useRef<string|null>(null)
 const jobs=new Map<string,any>((state.data?.jobs||[]).map((job:any)=>[job.id,job]))
 for(const job of state.analysisLive?.jobs||[]){const previous=jobs.get(job.id);if(!previous||!(Date.parse(previous.updatedAt)>Date.parse(job.updatedAt)))jobs.set(job.id,job)}
 const activeAutomatic=[...jobs.values()].reverse().find((job:any)=>job.kind==='analysis'&&['queued','running'].includes(job.status))
 if(activeAutomatic)lastAutomaticId.current=activeAutomatic.id
 const automatic=activeAutomatic||(open?jobs.get(lastAutomaticId.current||''):null)
 const paused=automatic?.status==='queued'&&automatic.nextRetryAt
 const automaticStatus=automatic?.status==='completed'?(automatic.result?.status==='partial'?'partial':'completed'):paused||['failed','cancelled'].includes(automatic?.status)?'partial':'running'
 const automaticReport=automatic?{id:automatic.id,scope:'tasks',status:automaticStatus,startedAt:automatic.createdAt,steps:{analysis:{status:paused?'paused':automatic.status,note:automatic.error||automatic.progress?.pauseReason||automatic.result?.note||(automaticStatus==='completed'?'识别已完成':'正在识别消息'),jobId:automatic.id,progress:automatic.progress,nextRetryAt:automatic.nextRetryAt}}}:null
 const report=state.workspaceRefresh||automaticReport
 const busy=!!state.refreshStarting||!!report?.collecting
 const name=scope==='all'?'刷新全部内容':scope==='tasks'?'刷新待办':'刷新待回复'
 const title=scope==='all'?'同步消息与日历、识别待处理消息、更新资讯与摘要':'同步最新消息与日历，并识别待处理消息；不更新资讯'
 const start=()=>WB.actions.refreshWorkspace(scope).catch(()=>{})
 return <>
  {iconOnly?<IconBtn name="refresh" label={name} title="" disabled={busy} onClick={start}/>:<Btn size="sm" icon="refresh" title={title} aria-label={name} disabled={busy} onClick={start}>{busy?'刷新中…':'刷新'}</Btn>}
  {scope==='all'&&!iconOnly&&report&&<Btn size="sm" kind="subtle" onClick={()=>setOpen(true)} aria-label="查看刷新进度">{report.status==='running'?<><Spinner size={12}/> 处理中</>:report.status==='completed'?'已更新':'部分未完成'}</Btn>}
  {open&&<Modal title="刷新进度" open={open} onClose={()=>setOpen(false)}>
   <div className="wb-stack" style={{gap:12}}>
    <span className="wb-tiny wb-muted">{report?.scope==='all'?'全部内容':'消息与识别'} · {WB.fmt.datetime(report?.startedAt)}</span>
    {Object.entries(report?.steps||{}).map(([key,value]:[string,any])=><div key={key} className="wb-stack" style={{gap:4}}><strong>{labels[key]||key} · {statuses[value.status]||value.status}</strong><span className="wb-tiny wb-muted" style={{overflowWrap:'anywhere'}}>{value.note}</span>{value.progress&&<AnalysisJobProgress job={{id:value.jobId,kind:key==='analysis'?'analysis':'summary',status:value.status,progress:value.progress,nextRetryAt:value.nextRetryAt}}/>}</div>)}
    {state.refreshStatusError&&<p role="status">{state.refreshStatusError}</p>}
    <div className="wb-row wb-row--wrap"><Btn size="sm" onClick={()=>{setOpen(false);WB.go('replies')}}>查看识别队列</Btn><Btn size="sm" onClick={()=>{setOpen(false);WB.go('radar')}}>查看资讯</Btn></div>
   </div>
  </Modal>}
 </>
}
