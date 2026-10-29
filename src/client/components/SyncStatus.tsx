import * as React from 'react'
interface Props {report:{status:string;note?:string;added?:number;at?:string}|null;busy:boolean;onRetry:()=>void}
export function SyncStatus({report,busy,onRetry}:Props):React.ReactElement|null {
 if(!report)return null
 return <details className="wb-compact-status"><summary><span>{report.status==='ok'?'消息同步完成':'部分消息尚未同步'}</span><span className="wb-tiny wb-muted">新增 {report.added||0} 条</span><button className="wb-chip" type="button" disabled={busy} onClick={e=>{e?.preventDefault();onRetry()}}>{busy?'同步中…':'再拉一次'}</button><span className="wb-tiny wb-muted">详情</span></summary><p style={{overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{report.note||report.status}</p></details>
}
