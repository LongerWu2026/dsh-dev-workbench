import {MAX_ASSISTANT_CONTEXTS} from '../../shared/assistant-context.js'
import * as React from 'react'
import {WB,Btn,Icon,Input,Modal,useStore} from '../core/runtime.js'

export type AssistantContextRef={kind:string;id:string;title:string;body?:string;meta?:string;url?:string}
type Candidate=AssistantContextRef & {label:string;status:string;at:string;completed:boolean;icon:string}
const groups=[['task','待办','tasks','tasks'],['reply','待回复','replies','messages'],['source','消息','sources','messages'],['radar','资讯','radar','radar'],['knowledge','知识','knowledge','book']]
const statuses:Record<string,string>={ready:'待处理',draft:'草稿',running:'进行中',doing:'进行中',completed:'已完成',done:'已完成',cancelled:'已取消',failed:'未完成',waiting_approval:'待确认',pending:'待处理',confirmed:'已确认',candidate:'待审核',archived:'已归档',rejected:'待修改'}
const completedReplies=new Set(['已回复','不需回复','无需回复','已关闭'])
const refKey=(ref:AssistantContextRef)=>ref.kind+':'+ref.id
export function assistantContextCandidates(data:any):Candidate[]{
 return groups.flatMap(([kind,label,key,icon])=>(Array.isArray(data?.[key])?data[key]:[]).filter((row:any)=>typeof row?.id==='string').map((row:any)=>{
  const raw=String(kind==='knowledge'?row.reviewState||row.status||'':row.status||row.stage||''),status=statuses[raw]||(/^[a-z_]+$/i.test(raw)?'':raw)
  return {kind,id:row.id,title:String(row.title||row.snippet||row.excerpt||row.contact||label),body:row.excerpt||row.snippet||row.description||row.content||row.body||JSON.stringify(row.summary||{}),meta:[label,status===label?'':status].filter(Boolean).join(' · '),url:row.url,label,status,at:String(row.updatedAt||row.sourceAt||row.fetchedAt||row.createdAt||''),completed:kind==='task'?['completed','done','cancelled','archived'].includes(raw):kind==='reply'&&completedReplies.has(raw),icon}
 })).sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0))
}
function contextTime(at:string){if(!at)return '';const date=new Date(at);return Number.isNaN(date.getTime())?'':date.toLocaleDateString('zh-CN',{month:'numeric',day:'numeric',timeZone:'Asia/Shanghai'})}
export function AssistantContextPicker({data,refs,compact=false,open:controlledOpen,onOpenChange,hideTrigger=false,disabled=false,onApply}:{data:any;refs:AssistantContextRef[];compact?:boolean;open?:boolean;onOpenChange?:(open:boolean)=>void;hideTrigger?:boolean;disabled?:boolean;onApply?:(refs:AssistantContextRef[])=>void}){
 const state=useStore(),[localOpen,setLocalOpen]=React.useState(false),[query,setQuery]=React.useState(''),[kind,setKind]=React.useState('all'),[includeDone,setIncludeDone]=React.useState(false),[draft,setDraft]=React.useState<AssistantContextRef[]>([]),[limit,setLimit]=React.useState(40)
 const open=controlledOpen??localOpen,trigger=React.useRef<HTMLButtonElement>(null),panel=React.useRef<HTMLDivElement>(null),wasOpen=React.useRef(false),scope=String(state.assistantConversationId||state.assistantTaskId||'')+':'+String(state.assistantHubThreadId||'')+':'+JSON.stringify(state.assistantHubKnowledgeScope||{}),previousScope=React.useRef(scope)
 const changeOpen=(value:boolean)=>{setLocalOpen(value);onOpenChange?.(value)}
 const close=()=>{changeOpen(false);trigger.current?.focus()}
 React.useEffect(()=>{if(open&&!wasOpen.current){setDraft(refs.slice(0,MAX_ASSISTANT_CONTEXTS));setQuery('');setKind('all');setIncludeDone(false);setLimit(40)}wasOpen.current=open},[open])
 React.useEffect(()=>{if(previousScope.current!==scope&&open)close();previousScope.current=scope},[scope])
 React.useEffect(()=>{
  if(!open)return
  const dialog=panel.current?.closest<HTMLElement>('.wb-modal'),previous=document.activeElement as HTMLElement|null
  if(!dialog)return
  dialog.querySelector<HTMLInputElement>('input[aria-label="搜索上下文"]')?.focus()
  const trap=(event:KeyboardEvent)=>{if(event.key!=='Tab'||document.querySelectorAll('.wb-modal').item(document.querySelectorAll('.wb-modal').length-1)!==dialog)return;const nodes=Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]'));const first=nodes[0],last=nodes[nodes.length-1];if(!first)return;if(!dialog.contains(document.activeElement)||event.shiftKey&&document.activeElement===first||!event.shiftKey&&document.activeElement===last){event.preventDefault();(event.shiftKey?last:first).focus()}}
  window.addEventListener('keydown',trap,true)
  return()=>{window.removeEventListener('keydown',trap,true);if(previous?.isConnected&&(dialog.contains(document.activeElement)||document.activeElement===document.body))previous.focus()}
 },[open])
 const candidates=assistantContextCandidates(data),selected=(ref:AssistantContextRef)=>draft.some(item=>refKey(item)===refKey(ref)),matches=candidates.filter(ref=>(kind==='all'||ref.kind===kind)&&(includeDone||!ref.completed||selected(ref))&&[ref.title,ref.meta,ref.body||''].join(' ').toLowerCase().includes(query.toLowerCase())),hiddenDone=candidates.some(ref=>ref.completed&&(kind==='all'||ref.kind===kind)&&[ref.title,ref.meta,ref.body||''].join(' ').toLowerCase().includes(query.toLowerCase()))
 const toggle=(ref:AssistantContextRef)=>setDraft(old=>old.some(item=>refKey(item)===refKey(ref))?old.filter(item=>refKey(item)!==refKey(ref)):old.length<MAX_ASSISTANT_CONTEXTS?[...old,ref]:old)
 const apply=()=>{const next=draft.map(({kind,id,title,body,meta,url})=>({kind,id,title,...(body?{body}:{}),...(meta?{meta}:{}),...(url?{url}:{})}));if(onApply)onApply(next);else WB.store.set({assistantRefs:next});close()}
 return <>
  <style>{CONTEXT_CSS}</style>
  {!hideTrigger&&(compact?<button ref={trigger} type="button" disabled={disabled} className="wb-iconbtn" aria-label="添加上下文" aria-haspopup="dialog" title={'引用事项 · 已选 '+refs.length+'/'+MAX_ASSISTANT_CONTEXTS} onClick={()=>changeOpen(true)}><Icon name="plus" size={16}/></button>:<div className="wb-row wb-row--wrap"><Btn size="sm" icon="plus" disabled={disabled} onClick={()=>changeOpen(true)}>添加上下文</Btn><span className="wb-tiny wb-muted">已选 {refs.length}/{MAX_ASSISTANT_CONTEXTS}</span>{refs.length>0&&<Btn size="sm" disabled={disabled} onClick={()=>onApply?onApply([]):WB.assistant.clear()}>清空上下文</Btn>}</div>)}
  <Modal open={open} title="引用事项" onClose={close} footer={<><span className="wb-tiny wb-muted" style={{marginRight:'auto'}}>已选 {draft.length} / {MAX_ASSISTANT_CONTEXTS}</span>{draft.length>0&&<Btn size="sm" onClick={()=>setDraft([])}>清空选择</Btn>}<Btn onClick={close}>取消</Btn><Btn kind="primary" disabled={disabled} onClick={apply}>添加 {draft.length} 项</Btn></>}>
   <div ref={panel} className="wb-context-picker" role="region" aria-label="选择上下文">
    <div className="wb-context-search"><Icon name="search" size={15}/><Input aria-label="搜索上下文" placeholder="搜索标题或内容" value={query} onChange={(e:any)=>{setQuery(e.target.value);setLimit(40)}}/></div>
    <div className="wb-context-filters" role="group" aria-label="引用事项类型">{[['all','全部'],...groups.map(([key,label])=>[key,label])].map(([key,label])=><button type="button" key={key} aria-pressed={kind===key} onClick={()=>{setKind(key);setLimit(40)}}>{label}</button>)}</div>
    <div className="wb-context-list-head"><span>最近更新</span><label><input type="checkbox" checked={includeDone} onChange={e=>{setIncludeDone(e.target.checked);setLimit(40)}}/>包含已完成</label></div>
    <div className="wb-context-choices">
     {matches.slice(0,limit).map(ref=><label className={'wb-context-choice'+(selected(ref)?' is-selected':'')} key={refKey(ref)}><Icon name={ref.icon} size={16}/><span><strong>{ref.title}</strong><small>{ref.meta}{contextTime(ref.at)?' · '+contextTime(ref.at):''}</small></span><input type="checkbox" aria-label={'引用'+ref.label+'：'+ref.title} checked={selected(ref)} disabled={!selected(ref)&&draft.length>=MAX_ASSISTANT_CONTEXTS} onChange={()=>toggle(ref)}/></label>)}
     {!matches.length&&<div className="wb-context-empty"><p>没有匹配的事项</p>{!includeDone&&hiddenDone&&<button type="button" className="wb-link" onClick={()=>setIncludeDone(true)}>同时搜索已完成事项</button>}</div>}
     {matches.length>limit&&<Btn size="sm" onClick={()=>setLimit(value=>value+40)}>显示更多（还有 {matches.length-limit} 项）</Btn>}
    </div>
    {draft.length>=MAX_ASSISTANT_CONTEXTS&&<p role="status" className="wb-tiny wb-muted">最多引用 {MAX_ASSISTANT_CONTEXTS} 项，可先取消一项再继续选择。</p>}
    <p className="wb-context-note">添加后可在输入区移除，已发送的历史不受影响。</p>
   </div>
  </Modal>
 </>
}
const CONTEXT_CSS=`.wb-context-picker{display:flex;flex-direction:column;gap:12px;min-width:0;padding-top:2px}.wb-context-search{display:flex;align-items:center;gap:8px;padding:1px 10px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:9px;color:var(--dsw-alias-label-secondary)}.wb-context-search .wb-input{background:transparent;border:0;box-shadow:none;min-width:0;padding-left:0;padding-right:0}.wb-context-search:focus-within{border-color:color-mix(in srgb,var(--dsw-alias-label-secondary) 48%,var(--dsw-alias-border-l1));box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent)}.wb-context-search .wb-input:focus{border:0;box-shadow:none}.wb-context-filters{display:flex;gap:4px;flex-wrap:wrap}.wb-context-filters button{border:0;background:transparent;color:var(--dsw-alias-label-secondary);padding:5px 9px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer}.wb-context-filters button[aria-pressed=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}.wb-context-filters button:focus-visible{outline:2px solid var(--dsw-alias-label-secondary);outline-offset:2px}.wb-context-list-head{display:flex;gap:10px;align-items:center;justify-content:space-between;font-size:11px;color:var(--dsw-alias-label-secondary)}.wb-context-list-head label{display:flex;gap:6px;align-items:center}.wb-context-list-head input{margin:0}.wb-context-choices{max-height:min(340px,42vh);overflow:auto;display:flex;flex-direction:column;gap:4px;min-width:0}.wb-context-choice{display:flex;align-items:center;gap:10px;padding:11px 10px;min-width:0;border:1px solid transparent;border-radius:9px;cursor:pointer}.wb-context-choice:hover{background:var(--dsw-alias-bg-layer-1)}.wb-context-choice.is-selected{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l1)}.wb-context-choice>span{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1;overflow-wrap:anywhere}.wb-context-choice strong{font-size:13px;line-height:1.5;font-weight:500}.wb-context-choice small{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.5}.wb-context-choice>input{flex:none;margin:0}.wb-context-empty{padding:28px 8px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px}.wb-context-note{margin:0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.6}@media(max-width:480px){.wb-context-picker{gap:9px}.wb-context-filters button{padding:5px 7px}.wb-context-choice{padding:9px 5px}.wb-context-choices{max-height:36vh}.wb-context-choice strong{font-size:12px}}`
