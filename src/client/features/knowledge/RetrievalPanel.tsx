import {KnowledgeScopeFields} from '../../components/KnowledgeScopeFields.js'
import * as React from 'react'
import {WB,Panel,Btn,Input,Select,Field,Textarea} from '../../core/runtime.js'
import {KnowledgeSources} from '../../components/KnowledgeSources.js'
export function RetrievalPanel({data,onReview,scope,onScope}:{data:any;onReview:(doc:any)=>void;scope:any;onScope:(value:any)=>void}){
 const [query,setQuery]=React.useState(''),[result,setResult]=React.useState<any>(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[importTitle,setTitle]=React.useState(''),[importBody,setBody]=React.useState(''),[showImport,setImport]=React.useState(false),[traces,setTraces]=React.useState<any[]>([])
 const version=React.useRef(0),scopeKey=JSON.stringify(scope),currentScope=React.useRef(scopeKey);currentScope.current=scopeKey
 React.useEffect(()=>{version.current++;setResult(null);setTraces([]);setError('');setBusy(false)},[scopeKey])
 const pending=(data?.knowledge||[]).filter((k:any)=>!k.archivedAt&&k.reviewState!=='confirmed'&&k.reviewState!=='obsolete')
 async function test(){const key=scopeKey,id=++version.current;setBusy(true);setError('');try{const response=await WB.actions.knowledgeRetrieve({query,scope});if(id!==version.current||currentScope.current!==key)return;setResult(response);const history=await WB.actions.knowledgeTraces({scope});if(id===version.current&&currentScope.current===key)setTraces(history.items||[])}catch(e:any){if(id===version.current)setError(e.message||'检索失败')}finally{if(id===version.current)setBusy(false)}}
 async function save(){setError('');if(!importTitle.trim()||!importBody.trim()){setError('请填写标题及正文');return}if(importBody.length>20000){setError('正文超过20000字符，请按章节拆分后导入');return}try{await WB.actions.createKnowledge({title:importTitle,body:importBody,kind:'note',reviewState:'candidate',...scope,sourceLabel:'手动导入正文'});setBody('');setTitle('');setImport(false)}catch(e:any){setError(e.message)}}
 return <Panel title="知识检索与审核" sub="只有已确认、未归档且有效的正文参与自动检索；模型生成与历史未审核条目先作为候选。" style={{marginBottom:14}}>
  <div className="wb-row wb-row--wrap" style={{gap:8}}><Btn size="sm" onClick={()=>setImport(!showImport)}>导入文本资料</Btn>{pending.length>0&&<Btn size="sm" onClick={()=>onReview(pending[0])}>审核待确认知识（{pending.length}）</Btn>}</div>
  <div className="wb-row wb-row--wrap" style={{gap:8,marginTop:10}}><KnowledgeScopeFields data={data} scope={scope} onChange={onScope} prefix="检索知识"/></div>
  <div className="wb-row wb-row--wrap" style={{gap:8,marginTop:8}}><Input aria-label="知识检索测试问题" placeholder="例如：以前接口超时怎么处理？" value={query} onChange={(e:any)=>setQuery(e.target.value)} onKeyDown={(e:any)=>{if(e.key==='Enter'&&query.trim()&&!busy)test()}} style={{flex:1,minWidth:160}}/><Btn disabled={busy||!query.trim()} onClick={test}>{busy?'检索中…':'测试检索'}</Btn></div>
  <KnowledgeSources result={result}/>
  {!!traces.length&&<details style={{fontSize:12,marginTop:8}}><summary>最近检索记录（{traces.length}）</summary>{traces.slice(0,10).map(t=><div key={t.id} style={{padding:5,overflowWrap:'anywhere'}}>{t.query} · {t.status} · {t.hits?.length||0}个片段 · {t.elapsedMs}ms</div>)}</details>}
  {showImport&&<div className="wb-stack" style={{marginTop:12}}><Field label="资料标题"><Input value={importTitle} onChange={(e:any)=>setTitle(e.target.value)}/></Field><Field label="文本文件（Markdown / TXT）"><input type="file" accept=".md,.txt" aria-label="导入知识文本文件" onChange={async e=>{setError('');const file=e.target.files?.[0];if(!file)return;if(file.size>80000){setError('文件过大，请按章节拆分');return}const text=await file.text();if(text.length>20000){setError('正文超过20000字符，请按章节拆分');return}setBody(text);if(!importTitle)setTitle(file.name)}}/></Field><Field label="资料正文"><Textarea rows={6} value={importBody} onChange={(e:any)=>setBody(e.target.value)}/></Field><Btn onClick={save}>保存为待审核资料</Btn></div>}
  {error&&<p role="alert">{error}</p>}
 </Panel>
}
