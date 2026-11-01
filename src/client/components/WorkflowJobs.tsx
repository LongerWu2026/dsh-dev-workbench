import * as React from 'react'
import {WB,Btn} from '../core/runtime.js'
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
 const priority=(job:Job)=>['queued','running'].includes(job.status)?job.progress?2:1:0
 const rows=jobs.filter(job=>job.kind===kind).slice().reverse().sort((a,b)=>priority(b)-priority(a))
 if(!rows.length)return null
 const labels:Record<string,string>={queued:'已排队',running:'运行中',completed:'已完成',failed:'失败',cancelled:'已取消'}
 const label=(job:Job)=>job.progress?.pauseReason&&job.status!=='completed'?'已暂停':!job.progress&&job.result?.status==='partial'?'部分完成':labels[job.status]||job.status
 const latest=rows[0]
 return <div className="wb-compact-status" aria-label={kind==='analysis'?'识别进度':'摘要进度'}><div className="wb-row wb-row--wrap"><strong>{kind==='analysis'?'消息识别':'资讯摘要'} · {label(latest)}</strong><div className="wb-spacer"/><Btn size="sm" onClick={()=>WB.assistant.openHub('system',kind==='analysis'?'analysis':'radar')}>在助手中继续</Btn></div>{latest.progress?<AnalysisJobProgress job={latest}/>:<p className="wb-tiny" style={{overflowWrap:'anywhere'}}>{latest.error||latest.result?.note||(latest.status==='completed'?'处理 '+(latest.result?.processed??latest.result?.done??0)+' 条，失败 '+(latest.result?.failures??latest.result?.failed??0)+' 条':'结果会持续更新到助手会话')}</p>}</div>
}
