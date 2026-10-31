import * as React from 'react'
import { Btn, T, WB } from '../../core/runtime.js'
import { radarFetchOutcome } from '../../../shared/news-fetch.js'

export function NewsFetchStatus({report}: {report: any}) {
    if (!report) return null;
    const outcome = radarFetchOutcome(report), failed = ['error','partial'].includes(outcome.status);
    const color = outcome.tone === 'err' ? T.err : outcome.tone === 'warn' ? T.warn : T.text2;
    return <div role={failed ? 'alert' : 'status'} className="wb-news-fetch-status" style={{marginBottom:12,padding:'10px 14px',border:'1px solid '+T.border1,borderRadius:10,overflowWrap:'anywhere'}}>
        <div className="wb-row wb-row--wrap"><span style={{color,fontSize:12,flex:'1 1 220px'}}>{outcome.text}</span>{outcome.status === 'error' && <Btn size="sm" onClick={()=>WB.go('settings')}>检查资讯配置</Btn>}</div>
        {!!report.perFeed?.length && <details style={{marginTop:6,fontSize:11.5,color:T.text2}}><summary style={{cursor:'pointer'}}>查看抓取详情</summary>
            <ul style={{paddingLeft:18,margin:'8px 0 0'}}>{report.perFeed.map((row:any,index:number)=><li key={index} style={{marginTop:5}}>{row.label || row.id}：{['error','unavailable'].includes(row.status)?'失败':row.added?'新增 '+row.added+' 条':'暂无新增'}{row.note?' · '+row.note:''}</li>)}</ul>
        </details>}
    </div>;
}
