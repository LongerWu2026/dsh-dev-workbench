import * as React from 'react'
import {Btn,Input,Field,Modal} from '../../core/runtime.js'
import type {WebAIState,WebAITopic} from '../../../shared/web-ai.js'
import {searchWebAIHistory} from './history.js'
const SIZE=10
export function HistoryManager({state,selected,disabled,onSelect,onManage,onClose}:{state:WebAIState;selected:string;disabled:boolean;onSelect:(id:string)=>void;onManage:(request:any)=>Promise<void>;onClose:()=>void}){
 const [query,setQuery]=React.useState(''),[trash,setTrash]=React.useState(false),[page,setPage]=React.useState(0),[action,setAction]=React.useState<{topics:WebAITopic[];kind:string}|null>(null),[title,setTitle]=React.useState(''),[pending,setPending]=React.useState(false),[error,setError]=React.useState(''),[checkedIds,setCheckedIds]=React.useState<string[]>([])
 const submitting=React.useRef(false)
 const rows=React.useMemo(()=>searchWebAIHistory(state,query,trash),[state,query,trash]),index=Math.min(page,Math.max(0,Math.ceil(rows.length/SIZE)-1))
 const change=(next:boolean)=>{setTrash(next);setPage(0);setCheckedIds([]);setError('')}
 const perform=async(request:any)=>{if(submitting.current)return;submitting.current=true;setPending(true);setError('');try{await onManage(request);setAction(null);if(['trash','purge'].includes(request.action)){const ids=new Set(request.topics?.map((t:any)=>t.topicId)||[request.topicId]);setCheckedIds(old=>old.filter(id=>!ids.has(id)))}}catch(e){setError(e instanceof Error?e.message:'历史操作失败')}finally{submitting.current=false;setPending(false)}}
 const begin=(topics:WebAITopic[],kind:string)=>{setAction({topics,kind});setTitle(topics[0].title);setError('')}
 const close=()=>{if(!pending){setAction(null);setError('')}}
 const visible=rows.slice(index*SIZE,(index+1)*SIZE),chosen=rows.filter(row=>checkedIds.includes(row.topic.id)).map(row=>row.topic)
 const allChecked=visible.length>0&&visible.every(row=>checkedIds.includes(row.topic.id))
 const actionIds=new Set(action?.topics.map(t=>t.id)),count=state.rounds.filter(r=>actionIds.has(r.topicId)).length
 const confirm=()=>{if(!action)return;const request={action:action.kind,confirm:true};void perform(action.topics.length===1?{...request,topicId:action.topics[0].id,expectedVersion:action.topics[0].version||0,title}:{...request,topics:action.topics.map(topic=>({topicId:topic.id,expectedVersion:topic.version||0}))})}
 return <section className="wb-web-history" aria-label="本地问答历史">
  <div className="wb-row wb-row--wrap" style={{gap:8}}><strong>本地问答历史</strong><Btn kind={!trash?'primary':'ghost'} disabled={pending} onClick={()=>change(false)}>历史（{state.topics.filter(t=>!t.deletedAt).length}）</Btn><Btn kind={trash?'primary':'ghost'} disabled={pending} onClick={()=>change(true)}>回收站（{state.topics.filter(t=>t.deletedAt).length}）</Btn><Btn onClick={onClose}>收起历史</Btn></div>
  <Input aria-label="搜索历史问答" placeholder="搜索标题、问题、回答、附件名或厂商" value={query} disabled={pending} onChange={(e:any)=>{setQuery(e.target.value);setPage(0);setCheckedIds([])}}/>
  <p className="wb-tiny wb-muted">共{rows.length}组 · 本地搜索，不调用模型。{trash?'永久删除后无法恢复。':'删除后可从回收站恢复，不影响官网对话。'}</p>
  <div className="wb-row wb-row--wrap" style={{gap:8}} aria-label="批量历史操作">
   <label className="wb-row" style={{gap:6}}><input type="checkbox" aria-label="全选本页" disabled={disabled||pending||!visible.length} checked={allChecked} onChange={()=>setCheckedIds(old=>allChecked?old.filter(id=>!visible.some(row=>row.topic.id===id)):[...new Set([...old,...visible.map(row=>row.topic.id)])])}/>全选本页</label>
   <span className="wb-tiny wb-muted">已选{chosen.length}组</span>
   <Btn disabled={disabled||pending||!chosen.length} onClick={()=>begin(chosen,trash?'purge':'trash')}>{trash?'批量永久删除':'批量删除'}</Btn>
   {!!chosen.length&&<Btn disabled={pending} onClick={()=>setCheckedIds([])}>清除选择</Btn>}
  </div>
  {error&&!action&&<p role="alert" className="wb-web-error">{error}</p>}
  {!rows.length&&<p className="wb-tiny wb-muted">{query?'没有匹配的问答':trash?'回收站为空':'暂无历史问答'}</p>}
  {visible.map(({topic,count,updatedAt,preview})=><article key={topic.id} aria-label={topic.title} className={'wb-web-history-item'+(selected===topic.id?' is-selected':'')}>
   <div className="wb-web-history-main"><input type="checkbox" aria-label={'选择问答 '+topic.title} disabled={disabled||pending} checked={checkedIds.includes(topic.id)} onChange={()=>setCheckedIds(old=>old.includes(topic.id)?old.filter(id=>id!==topic.id):[...old,topic.id])}/><div className="wb-web-history-content"><strong>{topic.title}</strong><p className="wb-tiny wb-muted">{count}轮 · {new Date(updatedAt).toLocaleString()}</p><p className="wb-tiny">{preview}</p></div></div>
   <div className="wb-row wb-row--wrap wb-web-history-actions">{trash?<><Btn disabled={disabled||pending} onClick={()=>void perform({topicId:topic.id,expectedVersion:topic.version||0,action:'restore'})}>恢复问答</Btn><Btn disabled={disabled||pending} onClick={()=>begin([topic],'purge')}>永久删除</Btn></>:<><Btn aria-label={'打开问答 '+topic.title} disabled={disabled||pending} onClick={()=>onSelect(topic.id)}>打开</Btn><Btn aria-label={'重命名问答 '+topic.title} disabled={disabled||pending} onClick={()=>begin([topic],'rename')}>重命名</Btn><Btn aria-label={'删除问答 '+topic.title} disabled={disabled||pending} onClick={()=>begin([topic],'trash')}>删除</Btn></>}</div>
  </article>)}
  {rows.length>SIZE&&<nav className="wb-row" aria-label="历史分页" style={{gap:8}}><Btn disabled={!index} onClick={()=>setPage(index-1)}>历史上一页</Btn><span className="wb-tiny">{index+1} / {Math.ceil(rows.length/SIZE)}</span><Btn disabled={(index+1)*SIZE>=rows.length} onClick={()=>setPage(index+1)}>历史下一页</Btn></nav>}
  <Modal open={!!action} title={action?.kind==='rename'?'重命名本地问答':action?.kind==='purge'?'永久删除本地问答':'删除本地问答'} width={480} onClose={close} footer={<div className="wb-row wb-row--wrap" style={{gap:8,justifyContent:'flex-end',width:'100%'}}><Btn disabled={pending} onClick={close}>取消</Btn><Btn kind="primary" disabled={pending||disabled||action?.kind==='rename'&&(!title.trim()||title.trim().length>120)} onClick={confirm}>{pending?'处理中…':'确认'}</Btn></div>}>
   {action?.kind==='rename'?<Field label="问答名称"><Input aria-label="问答名称" disabled={pending} value={title} onChange={(e:any)=>setTitle(e.target.value)}/></Field>:<><p>{action?.kind==='purge'?'将永久删除':'将移入回收站：'}{action?.topics.length===1?'「'+action.topics[0].title+'」':'所选'+(action?.topics.length||0)+'组问答'}及其{count}轮本地问答。{action?.kind==='purge'?'此操作无法恢复。':'可在回收站恢复。'}不会删除厂商官网对话、登录信息或已存为知识的内容。</p>{action&&action.topics.length>1&&<ul className="wb-web-history-confirm-list">{action.topics.map(topic=><li key={topic.id}>{topic.title}</li>)}</ul>}</>}
   {error&&action&&<p role="alert" className="wb-web-error">{error}</p>}
  </Modal>
 </section>
}
