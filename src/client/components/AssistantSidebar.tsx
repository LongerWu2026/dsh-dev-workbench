import * as React from 'react'
import {IconBtn} from '../core/runtime.js'

const narrow=()=>typeof window!=='undefined'&&window.innerWidth<=640

/** Layout state never changes the selected conversation, draft, attachments or running turn. */
export function useAssistantSidebar(externalRoot?:React.RefObject<HTMLElement>){
 const ownRoot=React.useRef<HTMLElement|null>(null),rootRef=externalRoot||ownRoot
 const [compact,setCompact]=React.useState(narrow),[collapsed,updateCollapsed]=React.useState(narrow)
 const compactRef=React.useRef(compact),desktopCollapsed=React.useRef(false),restoreFocus=React.useRef(false)
 function setCollapsed(value:boolean){
  if(!compactRef.current)desktopCollapsed.current=value
  restoreFocus.current=true;updateCollapsed(value)
 }
 React.useLayoutEffect(()=>{
  const root=rootRef.current;if(!root)return
  const measure=()=>{
   const width=root.getBoundingClientRect().width||window.innerWidth,next=width<=640
   if(next===compactRef.current)return
   compactRef.current=next;setCompact(next);updateCollapsed(next?true:desktopCollapsed.current)
  }
  measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure)
  observer?.observe(root);window.addEventListener('resize',measure)
  return()=>{observer?.disconnect();window.removeEventListener('resize',measure)}
 },[])
 React.useLayoutEffect(()=>{
  if(!restoreFocus.current)return
  restoreFocus.current=false
  const selector=compact&&!collapsed?'.wb-hub-sidebar-head button:not(:disabled)':'[data-sidebar-trigger]'
  rootRef.current?.querySelector<HTMLButtonElement>(selector)?.focus({preventScroll:true})
 },[compact,collapsed])
 return {rootRef,compact,collapsed,setCollapsed}
}

export function AssistantSidebarToggle({collapsed,onClick,trigger=false,controls='wb-hub-conversations'}:{collapsed:boolean;onClick:()=>void;trigger?:boolean;controls?:string}){
 const label=collapsed?'展开会话列表':'收起会话列表'
 return <button type="button" className="wb-iconbtn wb-hub-sidebar-toggle" data-sidebar-trigger={trigger?'true':undefined} aria-label={label} title={label} aria-expanded={!collapsed} aria-controls={controls} onClick={onClick}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d={collapsed?'m13 9 3 3-3 3':'m16 9-3 3 3 3'}/></svg>
 </button>
}

export function AssistantSidebar({collapsed,compact,onChange,onNew,busy,children,label='助手会话列表',listId='wb-hub-conversations',newLabel='新建对话',className=''}:{collapsed:boolean;compact:boolean;onChange:(value:boolean)=>void;onNew:()=>void;busy:boolean;children:React.ReactNode;label?:string;listId?:string;newLabel?:string;className?:string}){
 if(collapsed)return compact?null:<nav className="wb-hub-sidebar-rail" aria-label="会话列表快捷栏"><AssistantSidebarToggle collapsed onClick={()=>onChange(false)} trigger controls={listId}/><IconBtn name="plus" label={newLabel} disabled={busy} onClick={onNew}/></nav>
 function keyboard(event:React.KeyboardEvent<HTMLElement>){
  if(!compact)return
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onChange(true);return}
  if(event.key!=='Tab')return
  const nodes=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'))
  const first=nodes[0],last=nodes.at(-1)
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
 }
 return <>
  {compact&&<button className="wb-hub-sidebar-backdrop" type="button" tabIndex={-1} aria-label="关闭会话列表" onClick={()=>onChange(true)}/>}
  <nav id={listId} className={'wb-assistant-sessions'+(className?' '+className:'')} aria-label={label} onKeyDown={keyboard}>
   <div className="wb-hub-sidebar-head"><strong>会话</strong><IconBtn name="plus" label={newLabel} disabled={busy} onClick={onNew}/><AssistantSidebarToggle collapsed={false} onClick={()=>onChange(true)} trigger={!compact} controls={listId}/></div>
   {children}
  </nav>
 </>
}

export const ASSISTANT_SIDEBAR_CSS=`
.wb-hub-sidebar-head{display:flex;align-items:center;gap:4px;flex:none;min-width:0;min-height:34px}
.wb-hub-sidebar-head>strong{flex:1;min-width:0;font-size:12px;font-weight:600}
.wb-hub-sidebar-head>.wb-iconbtn,.wb-hub-sidebar-rail>.wb-iconbtn{width:32px;height:32px;flex:none}
.wb-hub-sidebar-rail{display:flex;flex-direction:column;align-items:center;gap:6px;flex:0 0 40px;width:40px;box-sizing:border-box;padding:8px 3px;border-right:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.wb-hub:not(.is-compact) .wb-assistant-sessions{position:static;flex:0 0 200px;width:200px;box-shadow:none}
.wb-hub.is-compact .wb-assistant-sessions{position:absolute;z-index:12;inset:0 auto 0 0;flex:none;width:min(260px,calc(100% - 44px));box-shadow:8px 0 24px #0002;overscroll-behavior:contain}
.wb-hub.is-compact .wb-hub-sidebar-head>.wb-iconbtn{width:36px;height:36px}
.wb-hub-sidebar-backdrop{position:absolute;inset:0;z-index:11;border:0;background:#0005;cursor:pointer}
.wb-hub.is-compact .wb-hub-context-head>.wb-hub-sidebar-toggle{flex:none;width:32px;height:32px}
.wb-hub.is-compact .wb-hub-toolbar{padding-inline:12px}
.wb-hub.is-compact .wb-hub-toolbar-actions{gap:2px}
.wb-hub.is-compact .wb-hub-capabilities>button{padding:5px 4px;font-size:11px;gap:4px}
.wb-hub.is-compact .wb-hub-capability-icon,.wb-hub.is-compact .wb-hub-tool-label{display:none}
.wb-hub.is-compact .wb-hub-toolbar-actions>.wb-btn{padding:5px 6px;min-width:28px}
.wb-hub.is-compact .wb-hub-body,.wb-hub.is-compact .wb-assistant-composer,.wb-hub.is-compact .wb-assistant-head{padding-inline:12px}
.wb-hub .wb-assistant-composer{padding-inline:24px;max-height:55%}
.wb-hub .wb-assistant-attachments{max-height:min(96px,12vh)}
@media(max-height:420px){.wb-hub .wb-assistant-composer{max-height:75%;min-height:0}.wb-hub .wb-assistant-attachments{max-height:32px}.wb-hub-body{min-height:0}}
@media(prefers-reduced-motion:no-preference){.wb-hub-sidebar-toggle{transition:background .12s ease}}
`
