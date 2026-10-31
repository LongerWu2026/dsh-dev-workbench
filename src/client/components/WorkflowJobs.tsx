import * as React from 'react'
import type { AnalysisProgress } from '../../shared/analysis-progress.js'
interface Job {id:string;kind:string;status:string;error?:string;nextRetryAt?:string|null;progress?:AnalysisProgress;result?:{note?:string;status?:string;done?:number;failed?:number;processed?:number;failures?:number}}
export function AnalysisJobProgress({job}:{job:Job}):React.ReactElement|null {
 const progress=job.progress
 if(!progress)return null
 return <div role="status" className="wb-tiny" style={{overflowWrap:'anywhere'}}>
  <p>累计处理 {progress.processed} 条 · 剩余 {progress.remaining} 条 · 失败 {progress.failed} 条 · 已执行 {progress.batches} 批（每批最多 50 条）</p>
  {progress.pauseReason&&<p>暂停原因：{progress.pauseReason}{job.nextRetryAt&&`；预计 ${new Date(job.nextRetryAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间）自动继续`}</p>}
  {job.status==='completed'&&<p>本次识别队列已处理完毕{progress.processed ? '，需要人工确认的事项请在待确认列表核对' : ''}。</p>}
 </div>
}
export function WorkflowJobs({jobs,kind}:{jobs:Job[];kind:'analysis'|'summary'}):React.ReactElement|null {
 const active=(job:Job)=>!!job.progress&&['queued','running'].includes(job.status)
 const rows=jobs.filter(job=>job.kind===kind).slice().reverse().sort((a,b)=>Number(active(b))-Number(active(a))).slice(0,5)
 if(!rows.length)return null
 const labels:Record<string,string>={queued:'已排队',running:'运行中',completed:'已完成',failed:'失败',cancelled:'已取消'}
 const label=(job:Job)=>job.progress?.pauseReason&&job.status!=='completed'?'已暂停':!job.progress&&job.result?.status==='partial'?'部分完成':labels[job.status]||job.status
 return <div className="wb-compact-status"><details><summary>后台{kind==='analysis'?'识别':'摘要'}任务 · {label(rows[0])}</summary>{rows.map(job=><div key={job.id} className="wb-reply-item"><strong>{label(job)}</strong> <span className="wb-tiny wb-muted">{job.id}</span>{job.progress ? job!==rows[0]&&<AnalysisJobProgress job={job}/> : <p className="wb-tiny">{job.error||job.result?.note||('处理 '+(job.result?.processed??job.result?.done??0)+' 条，失败 '+(job.result?.failures??job.result?.failed??0)+' 条')}</p>}</div>)}</details><AnalysisJobProgress job={rows[0]}/></div>
}
