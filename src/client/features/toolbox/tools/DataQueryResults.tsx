import * as React from 'react'
import {Btn,Icon} from '../../../core/runtime.js'
import {toolCopyButton as Copy} from '../shared-controls.js'

const cellText=(value:any)=>value===null?'NULL':typeof value==='object'?JSON.stringify(value):String(value??'');
export function DataQueryResults({result,isSql,pagination,pageSize,pageIndex,busy,historical,queriedAt,onPage,onPageSize}:any){
    const rows=result?.rows,offset=result?.offset||0;
    const canNext=!!rows&&result.hasMore===true&&Number.isSafeInteger(result.nextOffset)&&result.nextOffset>offset;
    const truncation=result?.truncation;
    const facts=truncation?[truncation.byteLimit&&'本页达到字节上限',truncation.cellLimit&&'部分单元格已安全截断',truncation.rowLimit&&'达到行数上限'].filter(Boolean).join(' · '):result?.truncated?'内容已安全截断':'';
    return <section className="wb-data-results" aria-label="查询结果">
        <div className="wb-data-result-head">
            <strong className="wb-tiny">{result?'结果 · '+result.durationMs+' ms'+(rows?' · '+rows.length+' 行':''):'查询结果'}</strong>
            {result&&<Copy text={JSON.stringify(rows||result.result,null,2)} label={rows?'复制当前页结果':'复制结果'}/>}
        </div>
        {historical&&result&&<p className="wb-tiny wb-muted">上次查询结果 · <time dateTime={queriedAt||result.queriedAt}>{queriedAt||result.queriedAt||'时间未知'}</time> · 未自动执行</p>}
        {facts&&<p className="wb-tiny wb-muted">{facts}</p>}
        <div className="wb-data-result-viewport" role="region" aria-label="数据库查询结果，可横向滚动" aria-busy={busy||undefined} tabIndex={0}>
            {rows?<><table className="wb-table wb-data-result-table"><thead><tr>{result.columns.map((column:string)=><th key={column} title={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row:any,index:number)=><tr key={index}>{result.columns.map((column:string)=><td key={column} title={cellText(row[column])}>{cellText(row[column])}</td>)}</tr>)}</tbody></table>{!rows.length&&<p className="wb-data-result-placeholder">查询成功，无返回记录</p>}</>:result?<pre className="wb-code wb-data-result-json">{JSON.stringify(result.result,null,2)}</pre>:<div className="wb-data-result-placeholder"><Icon name="database" size={22}/><strong>{busy?'正在读取…':'执行只读查询后在此查看结果'}</strong></div>}
        </div>
        {isSql&&pagination&&<>
            <div className="wb-data-pagination" role="group" aria-label="SQL 结果分页">
                <label className="wb-tiny">每页 <select className="wb-select" aria-label="每页行数" value={pageSize} disabled={busy} onChange={event=>onPageSize(Number(event.target.value))}>{[50,100,200].map(size=><option key={size} value={size}>{size} 行</option>)}</select></label>
                <span className="wb-tiny">第 {pageIndex+1} 页</span>
                {rows&&<span className="wb-tiny">{rows.length?'当前第 '+(offset+1)+'–'+(offset+rows.length)+' 行':'当前 0 行'}</span>}
                <div className="wb-row"><Btn size="sm" disabled={busy||!rows||pageIndex===0} onClick={()=>onPage(pageIndex-1)}>上一页</Btn><Btn size="sm" disabled={busy||!canNext} onClick={()=>onPage(pageIndex+1)}>下一页</Btn></div>
            </div>
            <details className="wb-data-pagination-help"><summary>分页说明</summary><p>每页独立读取，不计算总数。请使用稳定的唯一排序；数据变化可能导致跨页结果移动，深分页可能较慢。</p></details>
        </>}
        {isSql&&!pagination&&<p className="wb-tiny wb-muted">当前宿主不支持查询分页，仅显示本次受限结果；升级并重启宿主后可翻页。</p>}
    </section>;
}
