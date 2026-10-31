import * as React from 'react'
import {WB,Spinner,Btn} from '../core/runtime.js'

function activityOf(job:any):any {
 const reason=job.error||job.progress?.pauseReason||job.result?.note||'';
 const partial=job.status==='completed'&&(job.result?.status==='partial'||job.result?.failures>0);
 const phase=job.status==='failed'||partial?'failed':job.status==='queued'&&(job.progress?.pauseReason||job.error||job.nextRetryAt)?'paused':job.status;
 return {jobId:job.id,phase,message:reason,progress:job.progress,nextRetryAt:job.nextRetryAt};
}

function analysisJobs(state:any):any[] {
 const jobs=new Map<string,any>((state.data?.jobs||[]).filter((j:any)=>j.kind==='analysis').map((j:any)=>[j.id,j]));
 for(const job of state.analysisLive?.jobs||[]){
  const snapshot=jobs.get(job.id);
  if(!snapshot||!(Date.parse(snapshot.updatedAt)>Date.parse(job.updatedAt)))jobs.set(job.id,job);
 }
 return [...jobs.values()];
}

/** One observer for all pages; no model requests, only lightweight status reads. */
export function AnalysisMonitor() {
 const state=WB.useStore();
 const jobs=analysisJobs(state);
 const activeJob=jobs.slice().reverse().find((j:any)=>['queued','running'].includes(j.status));
 const watching=['starting','queued','running','paused'].includes(state.analysisActivity?.phase);
 const enabled=!!activeJob||watching,jobId=watching?state.analysisActivity?.jobId||activeJob?.id:activeJob?.id;
 const notified=React.useRef(new Set<string>());
 React.useEffect(()=>{
  if(!enabled)return;
  let alive=true,inFlight=false,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{
   if(inFlight||!alive)return;
   inFlight=true;
   try {
    const before=WB.store.get().analysisActivity;
    if(document.visibilityState!=='hidden'&&before?.phase!=='starting'){
     const status=await WB.actions.analysisStatus();
     if(!alive||WB.store.get().analysisActivity?.requestId!==before?.requestId)return;
     const jobs=status.jobs||WB.store.get().data?.jobs||[];
     const targetId=jobId;
     const job=targetId?jobs.find((j:any)=>j.id===targetId):jobs.slice().reverse().find((j:any)=>j.kind==='analysis'&&['queued','running'].includes(j.status));
     WB.store.set({analysisLive:status,analysisStatusError:null});
     if(job){
      const next={...activityOf(job),requestId:before?.requestId};
      WB.store.set({analysisActivity:next});
      const failure=next.phase==='failed'||next.phase==='paused'&&(job.error||job.progress?.failed>0||status.modelHealth||['deferred','disabled','unavailable'].includes(job.result?.status));
      const key=(before?.requestId||'automatic')+':'+job.id+':'+(failure?'failure':next.phase);
      if((failure||next.phase==='completed')&&!notified.current.has(key)){
       notified.current.add(key);
       WB.toast(failure?'提取失败：'+(next.message||'请查看提取状态').slice(0,180):'提取完成',failure?'err':'ok');
       void WB.actions.syncCheck();
      }
     }
    }
   }catch(error){
    if(alive)WB.store.set({analysisStatusError:'提取状态暂时无法同步，正在重试'});
   }finally{inFlight=false;if(alive)timer=setTimeout(poll,1000)}
  };
  const refresh=()=>{clearTimeout(timer);void poll()};
  void poll();window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{alive=false;clearTimeout(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
 },[enabled,jobId]);
 return null;
}

export function AnalysisActivity() {
 const state=WB.useStore();
 const jobs=analysisJobs(state);
 const current=jobs.slice().reverse().find((j:any)=>j.kind==='analysis'&&['queued','running'].includes(j.status));
 const latest=jobs.at(-1);
 const activity=current&&state.analysisActivity?.phase!=='starting'&&current.id!==state.analysisActivity?.jobId?activityOf(current):state.analysisActivity||(latest?activityOf(latest):null);
 const phase=activity?.phase;
 const busy=['starting','queued','running'].includes(phase);
 const labels:Record<string,string>={starting:'正在启动提取',queued:'提取已排队',running:'正在提取',paused:'提取已暂停',failed:'提取失败',completed:'提取完成',cancelled:'提取已取消'};
 return <div className="wb-compact-status" aria-label="首页提取状态" style={{border:'1px solid var(--dsw-alias-border-l1)'}}>
  <div className="wb-row wb-row--wrap" style={{gap:8}}>
   {busy&&<span aria-label="提取进行中"><Spinner size={14}/></span>}
   <strong role="status" style={{color:phase==='failed'?'var(--wb-err,#d22)':undefined}}>{labels[phase]||'消息提取'}</strong>
   {activity?.progress&&<span className="wb-tiny wb-muted">已提取 {activity.progress.processed} 条 · 剩余 {activity.progress.remaining} 条</span>}
   <div className="wb-spacer"/><Btn size="sm" disabled={busy} onClick={()=>WB.actions.analyzeRun(undefined,undefined,phase==='failed').catch(()=>{})}>{busy?'提取中…':phase==='failed'?'重试提取':'提取消息'}</Btn>
  </div>
  {activity?.message&&['failed','paused'].includes(phase)&&<p role="alert" className="wb-tiny" style={{overflowWrap:'anywhere',marginBottom:0}}>{activity.message}{activity.nextRetryAt?'；自动重试时间：'+WB.fmt.datetime(activity.nextRetryAt):''}</p>}
  {state.analysisStatusError&&busy&&<p className="wb-tiny wb-muted">{state.analysisStatusError}</p>}
 </div>
}
