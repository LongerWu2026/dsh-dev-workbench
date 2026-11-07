import * as React from 'react'
import {WB,Panel,Btn,Input} from '../../core/runtime.js'
import {KnowledgeSources} from '../../components/KnowledgeSources.js'

export function RetrievalPanel({scope,onClose}:{scope:any;onClose:()=>void}){
 const [query,setQuery]=React.useState(''),[result,setResult]=React.useState<any>(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[traces,setTraces]=React.useState<any[]>([])
 const version=React.useRef(0),scopeKey=JSON.stringify(scope),currentScope=React.useRef(scopeKey);currentScope.current=scopeKey
 React.useEffect(()=>{
  const id=++version.current;setResult(null);setTraces([]);setError('');setBusy(false)
  void WB.actions.knowledgeTraces({scope}).then((history:any)=>{if(id===version.current)setTraces(history.items||[])}).catch(()=>{})
  return()=>{version.current++}
 },[scopeKey])
 async function test(){
  if(busy||!query.trim())return
  const key=scopeKey,id=++version.current;setBusy(true);setError('')
  try{const response=await WB.actions.knowledgeRetrieve({query,scope});if(id!==version.current||currentScope.current!==key)return;setResult(response);const history=await WB.actions.knowledgeTraces({scope});if(id===version.current&&currentScope.current===key)setTraces(history.items||[])}
  catch(failure:any){if(id===version.current)setError(failure.message||'检索失败')}
  finally{if(id===version.current)setBusy(false)}
 }
 return <Panel title="检索验证" sub="使用上方选定的知识空间和项目范围，只检索已确认且有效的资料。" style={{marginBottom:12}} actions={<Btn size="sm" aria-label="收起检索验证" onClick={onClose}>收起</Btn>}>
  <div className="wb-row wb-row--wrap" style={{gap:8}}><Input aria-label="知识检索测试问题" placeholder="例如：以前接口超时怎么处理？" value={query} onChange={(event:any)=>setQuery(event.target.value)} onKeyDown={(event:any)=>{if(event.key==='Enter'&&!event.nativeEvent?.isComposing)void test()}} style={{flex:1,minWidth:160}}/><Btn disabled={busy||!query.trim()} onClick={test}>{busy?'检索中…':'测试检索'}</Btn></div>
  <KnowledgeSources result={result}/>
  {!!traces.length&&<details style={{fontSize:12,marginTop:8}}><summary>最近检索记录（{traces.length}）</summary>{traces.slice(0,10).map(trace=><div key={trace.id} style={{padding:5,overflowWrap:'anywhere'}}>{trace.query} · {trace.status} · {trace.hits?.length||0}个片段 · {trace.elapsedMs}ms</div>)}</details>}
  {error&&<p role="alert">{error}</p>}
 </Panel>
}
