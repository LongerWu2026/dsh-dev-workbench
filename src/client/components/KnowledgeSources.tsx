import * as React from 'react'
import { WB, Btn, Modal } from '../core/runtime.js'
export function KnowledgeSources({result,audit,provided=false}: {result:any;audit?:any;provided?:boolean}){
 const [selected,setSelected]=React.useState<any>(null),[error,setError]=React.useState('')
 React.useEffect(()=>{setError('');setSelected(null)},[result?.id]);
 if(!result||result.status==='off')return null
 async function read(hit:any){setError('');try{const rows=await WB.actions.knowledgeRead({ids:[hit.id],scope:result.scope});setSelected(rows.hits[0])}catch(e:any){setError(e.message||'原文读取失败，可能已更新或失效')}}
 return <section aria-label="知识检索依据" style={{margin:'8px 0',padding:8,border:'1px solid '+WB.T.border1,borderRadius:8,fontSize:12,minWidth:0}}>
  <details><summary style={{cursor:'pointer',overflowWrap:'anywhere'}}>知识依据 · {result.hits?.length||0} 个片段 · {result.status==='ok'?(provided?'已提供给模型':'检索命中'):result.note||'未命中'}</summary>
   <p className="wb-muted" style={{overflowWrap:'anywhere'}}>查询：{result.query} · {result.strategy} · {result.elapsedMs}ms</p>
   {(result.hits||[]).map((h:any)=><div key={h.id} style={{marginTop:6,overflowWrap:'anywhere'}}><Btn size="sm" onClick={()=>read(h)}>{h.title} · 行{h.lineStart}–{h.lineEnd}</Btn><div className="wb-tiny wb-muted">{h.id}</div></div>)}
   {!!audit?.stale?.length&&<p role="alert">回答期间知识已更新或失效，请重新检索后核对。</p>}
   {!!audit?.invalid?.length&&<p role="alert">回答包含无效知识引用，请勿将其作为原文依据。</p>}
   {audit?.missing&&<p role="status">已提供知识，但模型未标注知识引用，请核对回答与原文。</p>}
  </details>
  {error&&<p role="alert">{error}</p>}
  <Modal open={!!selected} title={selected?.title||'知识原文'} onClose={()=>setSelected(null)}>
   {selected&&<><p className="wb-muted wb-tiny">知识版本 {selected.version} · 行{selected.lineStart}–{selected.lineEnd}</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:'inherit'}}>{selected.text}</pre>{selected.url&&<a href={selected.url} target="_blank" rel="noreferrer">打开来源</a>}</>}
  </Modal>
 </section>
}
