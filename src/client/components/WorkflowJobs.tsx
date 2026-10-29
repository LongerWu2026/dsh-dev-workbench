import * as React from 'react'
interface Job {id:string;kind:string;status:string;error?:string;result?:{note?:string;status?:string;done?:number;failed?:number;processed?:number;failures?:number}}
export function WorkflowJobs({jobs,kind}:{jobs:Job[];kind:'analysis'|'summary'}):React.ReactElement|null {
 const rows=jobs.filter(job=>job.kind===kind).slice(-5).reverse()
 if(!rows.length)return null
 const labels:Record<string,string>={queued:'已排队',running:'运行中',completed:'已完成',failed:'失败'}
 return <details className="wb-compact-status"><summary>后台{kind==='analysis'?'识别':'摘要'}任务 · {rows[0].result?.status==='partial'?'部分完成':labels[rows[0].status]||rows[0].status}</summary>{rows.map(job=><div key={job.id} className="wb-reply-item"><strong>{job.result?.status==='partial'?'部分完成':labels[job.status]||job.status}</strong> <span className="wb-tiny wb-muted">{job.id}</span><p className="wb-tiny">{job.error||job.result?.note||('处理 '+(job.result?.processed??job.result?.done??0)+' 条，失败 '+(job.result?.failures??job.result?.failed??0)+' 条')}</p></div>)}</details>
}
