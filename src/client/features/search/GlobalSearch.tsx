import * as React from 'react'
import {WB,Modal,Icon,Spinner,Kbd} from '../../core/runtime.js'
import {paletteCommands,paletteMatch} from '../../shell/palette-commands.js'
import {continueSearchResult,fullSearchResults,openSearchResult,searchInternetWithAssistant} from './search-navigation.js'

const types=[['all','全部'],['task','待办'],['knowledge','知识'],['radar','资讯'],['source','消息']]
const icons:Record<string,string>={task:'tasks',knowledge:'book',radar:'radar',source:'messages'}
export function GlobalSearch({open,onClose,initialQuery=''}:{open:boolean;onClose:()=>void;initialQuery?:string}){
 const [query,setQuery]=React.useState(''),[kind,setKind]=React.useState('all'),[active,setActive]=React.useState(0),[result,setResult]=React.useState<any>(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('')
 const input=React.useRef<HTMLInputElement>(null),root=React.useRef<HTMLDivElement>(null),version=React.useRef(0),text=query.trim(),listId=React.useId()
 React.useEffect(()=>{
  if(!open)return
  const previous=document.activeElement as HTMLElement
  setQuery(initialQuery);setKind('all');setActive(0);setResult(null);setError('')
  const timer=setTimeout(()=>input.current?.focus(),10)
  return()=>{clearTimeout(timer);previous?.focus?.({preventScroll:true})}
 },[open,initialQuery])
 React.useEffect(()=>{
  const current=++version.current;setResult(null);setError('');setBusy(open&&!!text)
  if(!open||!text)return
  let alive=true
  const timer=setTimeout(()=>{
   WB.actions.search(text,{scope:'local',includeWeb:false,includeEnterprise:false}).then((value:any)=>{if(alive&&current===version.current)setResult({query:text,value})}).catch((failure:any)=>{if(alive&&current===version.current)setError(failure.message||String(failure))}).finally(()=>{if(alive&&current===version.current)setBusy(false)})
  },260)
  return()=>{alive=false;clearTimeout(timer)}
 },[open,text])
 React.useEffect(()=>setActive(0),[text,kind])
 React.useEffect(()=>{
  if(!open)return
  const trap=(event:KeyboardEvent)=>{
   const modal=root.current?.closest('.wb-modal');if(event.key!=='Tab'||!modal?.contains(document.activeElement))return
   const nodes=Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]),input,a[href],[tabindex="0"]')),first=nodes[0],last=nodes.at(-1)
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  }
  document.addEventListener('keydown',trap);return()=>document.removeEventListener('keydown',trap)
 },[open])
 if(!open)return null
 const groups=result?.query===text?result.value?.groups||[]:[]
 const hits=groups.flatMap((group:any)=>(group.items||[]).filter((item:any)=>kind==='all'||item.kind===kind).map((item:any)=>({item,group})))
 const shown=hits.slice(0,12),commands=paletteCommands({tasks:[]}).filter((command:any)=>!text||paletteMatch(command,text)).slice(0,20)
 const choose=(run:()=>void)=>{onClose();run()}
 const showAll=()=>choose(()=>fullSearchResults(text,kind,'local'))
 function keyboard(event:React.KeyboardEvent){
  const count=text?shown.length:commands.length
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setActive(index=>Math.max(0,Math.min(Math.max(0,count-1),index+(event.key==='ArrowDown'?1:-1))))}
  if(event.key==='Enter'){event.preventDefault();if(text){const hit=shown[active];if(hit)choose(()=>openSearchResult(hit.item,hit.group.label));else showAll()}else if(commands[active])choose(commands[active].run)}
 }
 let previousGroup=''
 return <Modal open title="搜索工作内容" width={660} onClose={onClose} footer={<div className="wb-global-search-footer">
  {text&&<div className="wb-global-search-footer-actions"><button type="button" className="wb-global-search-all" onClick={showAll}>查看全部搜索结果{hits.length?'（'+hits.length+'）':''}<Icon name="arrowRight" size={14}/></button><button type="button" className="wb-global-search-all" onClick={()=>choose(()=>fullSearchResults(text,'contacts','enterprise'))}>查询云之家<Icon name="arrowRight" size={14}/></button><button type="button" className="wb-global-search-all" aria-label="在助手中搜索互联网" onClick={()=>choose(()=>searchInternetWithAssistant(text))}><Icon name="sparkles" size={14}/>助手联网搜索</button></div>}
  <div className="wb-global-search-help"><span>本地检索 · 不联网</span><span><Kbd>↑ ↓</Kbd> 选择 · <Kbd>↵</Kbd> 打开 · <Kbd>esc</Kbd> 关闭</span></div>
 </div>}>
  <style>{CSS}</style><div ref={root} className="wb-global-search">
   <div className="wb-global-search-input"><Icon name="search" size={17}/><input ref={input} maxLength={200} aria-label="搜索工作内容关键词" placeholder="搜索待办、知识、资讯，或输入命令…" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={keyboard} aria-controls={listId}/>{busy&&<Spinner size={14}/>}</div>
   <div className="wb-global-search-types" role="group" aria-label="搜索类型">{types.map(([id,label])=><button key={id} type="button" aria-pressed={kind===id} onClick={()=>setKind(id)}>{label}</button>)}</div>
   {error&&<p role="alert" className="wb-global-search-error">搜索失败：{error}，可重试或查看完整结果。</p>}
   <div id={listId} className="wb-global-search-results" aria-label="搜索结果">
    {text?shown.map(({item,group}:any,index:number)=>{const label=group.id!==previousGroup?(previousGroup=group.id,'搜索 · '+group.label):'';return <React.Fragment key={group.id+':'+item.kind+':'+item.id}>{label&&<p className="wb-global-search-group">{label}</p>}<div className={'wb-global-search-result'+(index===active?' is-active':'')}>
     <button type="button" className="wb-global-search-hit" onMouseEnter={()=>setActive(index)} onClick={()=>choose(()=>openSearchResult(item,group.label))}><Icon name={icons[item.kind]||'search'} size={15}/><span><strong>{item.title}</strong>{item.snippet&&<small>{item.snippet}</small>}</span></button>
     <button type="button" className="wb-global-search-ai" aria-label={'交给 AI 继续处理：'+item.title} title="交给 AI 继续处理" onClick={()=>choose(()=>continueSearchResult(item,group.label))}><Icon name="sparkles" size={14}/><span>AI 处理</span></button>
    </div></React.Fragment>}):commands.map((command:any,index:number)=><button key={command.id} type="button" className={'wb-global-search-command'+(active===index?' is-active':'')} onMouseEnter={()=>setActive(index)} onClick={()=>choose(command.run)}><Icon name={command.icon} size={14}/><span>{command.label}</span>{command.keys&&<Kbd>{command.keys}</Kbd>}</button>)}
    {text&&!busy&&!error&&!shown.length&&<p className="wb-tiny wb-muted">没有匹配的工作内容，可换个关键词或调整类型。</p>}
    {text&&commands.length>0&&<details><summary className="wb-tiny wb-muted">相关导航与操作</summary>{commands.map((command:any)=><button key={command.id} type="button" className="wb-global-search-command" onClick={()=>choose(command.run)}>{command.label}</button>)}</details>}
   </div>
  </div>
 </Modal>
}
const CSS=`.wb-global-search{min-width:0}.wb-global-search-input{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base)}.wb-global-search-input:focus-within{border-color:var(--dsw-alias-label-secondary)}.wb-global-search-input input{min-width:0;flex:1;border:0;outline:0;box-shadow:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit}.wb-global-search-types{display:flex;gap:5px;flex-wrap:wrap;margin:12px 0}.wb-global-search-types button{border:0;background:transparent;color:var(--dsw-alias-label-secondary);padding:5px 10px;border-radius:6px;cursor:pointer}.wb-global-search-types button[aria-pressed=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}.wb-global-search-results{max-height:min(420px,45vh);overflow:auto;overscroll-behavior:contain}.wb-global-search-group{margin:12px 7px 4px;font-size:11px;color:var(--dsw-alias-label-secondary)}.wb-global-search-result{display:flex;align-items:center;gap:6px;border-radius:8px;padding:3px}.wb-global-search-result:hover,.wb-global-search-result.is-active,.wb-global-search-command:hover,.wb-global-search-command.is-active{background:var(--dsw-alias-bg-layer-2)}.wb-global-search-hit{flex:1;min-width:0;display:flex;align-items:center;gap:9px;padding:8px 6px;text-align:left;border:0;background:none;color:inherit;cursor:pointer}.wb-global-search-hit>svg{flex:none}.wb-global-search-hit>span{min-width:0}.wb-global-search-hit strong,.wb-global-search-hit small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wb-global-search-hit strong{font-size:13px;font-weight:500}.wb-global-search-hit small{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:4px}.wb-global-search-ai{flex:none;display:flex;align-items:center;gap:4px;font-size:11px;padding:6px;border:0;border-radius:6px;color:var(--dsw-alias-label-secondary);background:transparent;cursor:pointer}.wb-global-search-ai:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}.wb-global-search-command{display:flex;align-items:center;gap:9px;width:100%;padding:8px;border:0;border-radius:6px;background:none;color:inherit;text-align:left;cursor:pointer}.wb-global-search-command>span{flex:1}.wb-global-search-footer{width:100%;min-width:0}.wb-global-search-footer-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}.wb-global-search-all{display:flex;align-items:center;justify-content:center;gap:6px;flex:1;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;padding:7px;background:none;color:inherit;font:inherit;font-size:11px;white-space:nowrap;cursor:pointer}.wb-global-search-all:hover{background:var(--dsw-alias-bg-layer-2)}.wb-global-search-help{display:flex;justify-content:space-between;gap:5px 12px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-secondary)}.wb-global-search-error{font-size:12px;color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}@media(max-width:420px){.wb-global-search-ai>span{display:none}}`
