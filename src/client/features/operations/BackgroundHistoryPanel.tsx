import * as React from 'react'
import {WB,Panel,Btn} from '../../core/runtime.js'
interface Row {id:string;active:boolean;archived:boolean;protected:boolean}
interface Page {supported:boolean;total:number;eligible:number;items:Row[];note:string}

export function BackgroundHistoryPanel(){
 const [archived,setArchived]=React.useState(false),[offset,setOffset]=React.useState(0)
 const [page,setPage]=React.useState<Page|null>(null),[selected,setSelected]=React.useState<string[]>([])
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[result,setResult]=React.useState('')
 const requestSeq=React.useRef(0)
 async function read(showArchived=archived,from=offset){
  const seq=++requestSeq.current
  setError('')
  try{
   const value=await WB.rpc('workbench/backgroundHistory',{request:{archived:showArchived,offset:from}})
   if(!value||!Array.isArray(value.items)||typeof value.supported!=='boolean')throw new Error('宿主返回的会话列表格式不正确')
   if(seq===requestSeq.current){setPage(value);setSelected([])}
  }catch(e){if(seq===requestSeq.current)setError((e as Error).message)}
 }
 React.useEffect(()=>{void read();return()=>{requestSeq.current++}},[archived,offset])
 async function archive(){
  if(busy||!selected.length)return
  setBusy(true);setError('');setResult('')
  try{
   const value=await WB.rpc('workbench/archiveBackgroundHistory',{ids:selected},AbortSignal.timeout(120000))
   setResult(`已归档 ${value.archived}，跳过 ${value.skipped}，失败 ${value.failed}`)
   const failures=value.results.filter((row:any)=>row.status==='failed')
   if(failures.length)setError(failures.map((row:any)=>row.reason).join('；'))
   const reasons=[...new Set(value.results.filter((row:any)=>row.status==='skipped'&&row.reason).map((row:any)=>row.reason))]
   if(reasons.length)setResult(previous=>previous+'；'+reasons.join('；'))
   await read()
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 const rows=Array.isArray(page?.items)?page.items:[]
 return <details><summary>管理后台会话历史</summary><Panel title="后台会话历史" sub="保留当前复用会话，收起已停用的旧批次记录">
  <p className="wb-tiny wb-muted">{page?.note}</p>
  <div className="wb-row wb-row--wrap">
   <Btn disabled={busy} onClick={()=>{setArchived(!archived);setOffset(0);setSelected([])}}>{archived?'查看未归档会话':'查看已归档会话'}</Btn>
   <Btn disabled={busy} onClick={()=>read()}>刷新会话历史</Btn>
   {!archived&&<Btn disabled={busy||!page?.supported||!rows.some(row=>!row.active&&!row.protected)} onClick={()=>setSelected(rows.filter(row=>!row.active&&!row.protected&&!row.archived).map(row=>row.id))}>选择本页旧会话</Btn>}
   {!archived&&<Btn disabled={busy||!page?.supported||!selected.length} onClick={archive}>{busy?'正在归档…':`归档选中会话（${selected.length}）`}</Btn>}
  </div>
  {error&&<p role="alert">{error}</p>}
  {result&&<p role="status">{result}</p>}
  {rows.map(row=><article className="wb-reply-item" key={row.id}>
   <label className="wb-row">
    {!archived&&<input type="checkbox" aria-label={`选择后台会话 ${row.id.replace(/^session-/, '').slice(0,8)}`} disabled={busy||!page?.supported||row.active||row.protected} checked={selected.includes(row.id)} onChange={e=>setSelected(previous=>e.target.checked?[...previous,row.id]:previous.filter(id=>id!==row.id))}/>}
    <span>后台会话 · {row.id.replace(/^session-/, '').slice(0,8)} · {row.active?'正在复用':row.protected?'人工会话保护':row.archived?'已归档':'旧记录'}</span>
   </label>
   <Btn size="sm" onClick={()=>{if(!WB.openSessionById(row.id))setError('当前宿主无法打开会话，请使用原生历史入口')}}>打开原生日志</Btn>
  </article>)}
  {page&&<div className="wb-row">
   <Btn disabled={busy||offset===0} onClick={()=>setOffset(Math.max(0,offset-20))}>上一页会话</Btn>
   <span>{page.total} 个 · 可归档 {page.eligible} 个</span>
   <Btn disabled={busy||offset+20>=page.total} onClick={()=>setOffset(offset+20)}>下一页会话</Btn>
  </div>}
 </Panel></details>
}
