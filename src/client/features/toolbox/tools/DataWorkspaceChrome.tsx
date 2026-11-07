import * as React from 'react'
import {Btn,Icon} from '../../../core/runtime.js'

export function DataWorkspaceMenu({busy,disconnecting,hasConnection,canClear,onConfig,onDisconnect,onClear}:any){
 const menu=React.useRef<HTMLDetailsElement>(null)
 React.useEffect(()=>{
  const close=(event:Event)=>{if(menu.current&&!menu.current.contains(event.target as Node))menu.current.open=false}
  document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)
 },[])
 function run(action:()=>void){if(menu.current){menu.current.open=false;menu.current.querySelector('summary')?.focus()}action()}
 return <details className="wb-data-more" ref={menu} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus()}}}>
  <summary className="wb-iconbtn" aria-label="数据连接更多操作" title="更多操作"><Icon name="more" size={16}/></summary>
  <div className="wb-data-menu">
   <Btn size="sm" icon="settings" disabled={busy} onClick={()=>run(onConfig)}>连接配置</Btn>
   {hasConnection&&<Btn size="sm" icon="plug" disabled={disconnecting} onClick={()=>run(onDisconnect)}>{busy?'停止并断开':'断开连接'}</Btn>}
   {canClear&&<Btn size="sm" icon="trash" disabled={busy} onClick={()=>run(onClear)}>清除当前连接记忆</Btn>}
  </div>
 </details>
}

export function DataSideDrawer({label,side,onClose,children}:any){
 const root=React.useRef<HTMLDivElement>(null)
 React.useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null
  root.current?.querySelector<HTMLElement>('button,input,textarea,select')?.focus()
  return()=>previous?.focus()
 },[])
 return <div className="wb-data-drawer-mask" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <div ref={root} className={'wb-data-drawer is-'+side} role="dialog" aria-modal="true" aria-label={label} onKeyDown={event=>{
   if(event.key==='Escape'){if(document.querySelector('.wb-modal-mask'))return;event.stopPropagation();onClose()}
   if(event.key!=='Tab')return
   const elements=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(element=>element.checkVisibility())
   const first=elements[0],last=elements.at(-1)
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  }}>{children}</div>
 </div>
}

export function DataEditorSplitter({share,onChange}:any){
 const origin=React.useRef<{y:number;share:number;total:number}|null>(null)
 const change=(value:number)=>onChange(Math.max(18,Math.min(60,Math.round(value))))
 return <div className="wb-data-editor-splitter" role="separator" tabIndex={0} aria-label="调整查询编辑器高度" aria-orientation="horizontal" aria-valuemin={18} aria-valuemax={60} aria-valuenow={share} aria-valuetext={'编辑器占 '+share+'%'}
  onKeyDown={event=>{if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();change(event.key==='Home'?18:event.key==='End'?60:share+(event.key==='ArrowUp'?-5:5))}}}
  onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();origin.current={y:event.clientY,share,total:event.currentTarget.parentElement?.clientHeight||1};event.currentTarget.setPointerCapture?.(event.pointerId)}}
  onPointerMove={event=>{if(origin.current)change(origin.current.share+100*(event.clientY-origin.current.y)/origin.current.total)}}
  onPointerUp={()=>{origin.current=null}} onLostPointerCapture={()=>{origin.current=null}}><span/></div>
}
