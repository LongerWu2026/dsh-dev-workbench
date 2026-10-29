import { MAX_ASSISTANT_CONTEXTS } from '../../shared/assistant-context.js'
import * as React from 'react'
import {WB, Btn, Input, T} from '../core/runtime.js'
type Ref={kind:string;id:string;title:string;body?:string;meta?:string;url?:string}
export function AssistantContextPicker({data,refs}:{data:any;refs:Ref[]}) {
 const [open,setOpen]=React.useState(false),[query,setQuery]=React.useState('')
 const groups=[['task','待办','tasks'],['source','消息','sources'],['radar','资讯','radar'],['knowledge','知识','knowledge']]
 const candidates:Ref[]=groups.flatMap(([kind,label,key])=>(data?.[key]||[]).map((row:any)=>({kind,id:row.id,title:row.title||row.excerpt||label,body:row.excerpt||row.description||row.content||row.body||JSON.stringify(row.summary||{}),meta:label+' · '+(row.status||row.stage||''),url:row.url})))
 const selected=(ref:Ref)=>refs.some(item=>item.kind===ref.kind&&item.id===ref.id)
 const matches=candidates.filter(ref=>(ref.title+' '+ref.meta).toLowerCase().includes(query.toLowerCase()))
 return <div>
  <div className="wb-row" style={{gap:6,flexWrap:'wrap'}}>
   <Btn size="sm" icon="plus" onClick={()=>setOpen(!open)} aria-expanded={open}>{open?'收起上下文':'添加上下文'}</Btn>
   <span className="wb-tiny wb-muted">已选 {refs.length}/{MAX_ASSISTANT_CONTEXTS}</span>
   {refs.length>0&&<Btn size="sm" onClick={()=>WB.assistant.clear()}>清空上下文</Btn>}
  </div>
  {open&&<div role="region" aria-label="选择上下文" style={{marginTop:8,padding:8,border:'1px solid '+T.border1,borderRadius:8,background:T.layer1}}>
   <Input aria-label="搜索上下文" placeholder="搜索待办、消息、资讯或知识" value={query} onChange={(e:any)=>setQuery(e.target.value)}/>
   <div style={{maxHeight:180,overflow:'auto',marginTop:6}}>
    {matches.slice(0,40).map(ref=><button type="button" className="wb-context-option" key={ref.kind+':'+ref.id} aria-pressed={selected(ref)} disabled={!selected(ref)&&refs.length>=MAX_ASSISTANT_CONTEXTS} onClick={()=>selected(ref)?WB.assistant.remove(ref.kind,ref.id):WB.assistant.add(ref)}>
      <span>{selected(ref)?'✓ ': '+ '}{ref.meta} · {WB.util.truncate(ref.title,46)}</span>
    </button>)}
    {!matches.length&&<p className="wb-tiny wb-muted">没有匹配的内容</p>}
    {matches.length>40&&<p className="wb-tiny wb-muted">还有 {matches.length-40} 条，请输入关键词缩小范围</p>}
   </div>
   <p className="wb-tiny wb-muted">移除仅影响后续发送；已发送的会话历史仍保留。</p>
  </div>}
 </div>
}
