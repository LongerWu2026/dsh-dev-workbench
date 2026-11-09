import * as React from 'react'
import {Btn,Icon} from '../../../core/runtime.js'

type DataMenuItem={label:string;icon:string;disabled?:boolean;danger?:boolean;title?:string;action:()=>void}

export function DataWorkspaceMenu({label,items}:{label:string;items:DataMenuItem[]}){
 const [open,setOpen]=React.useState(false)
 const root=React.useRef<HTMLDivElement>(null),trigger=React.useRef<HTMLButtonElement>(null),menu=React.useRef<HTMLDivElement>(null)
 const menuId=React.useId()
 React.useLayoutEffect(()=>{
  if(!open||!menu.current||!trigger.current)return
  const popup=menu.current,anchor=trigger.current.getBoundingClientRect()
  // Use the browser's top layer so a menu at the bottom of the scrolling sidebar stays visible.
  if(typeof popup.showPopover==='function'){
   popup.setAttribute('popover','manual')
   popup.showPopover()
  }
  const {width,height}=popup.getBoundingClientRect()
  const left=Math.max(8,Math.min(anchor.right-width,window.innerWidth-width-8))
  const below=anchor.bottom+4,above=anchor.top-height-4
  const top=Math.max(8,Math.min(below+height<=window.innerHeight-8?below:above,window.innerHeight-height-8))
  Object.assign(popup.style,{left:left+'px',top:top+'px'})
  const closeOutside=(event:Event)=>{if(!root.current?.contains(event.target as Node))setOpen(false)}
  const closeOnScroll=(event:Event)=>{if(!popup.contains(event.target as Node))setOpen(false)}
  const closeOnResize=()=>setOpen(false)
  document.addEventListener('pointerdown',closeOutside)
  document.addEventListener('scroll',closeOnScroll,true)
  window.addEventListener('resize',closeOnResize)
  return()=>{
   if(popup.isConnected)popup.hidePopover?.()
   document.removeEventListener('pointerdown',closeOutside)
   document.removeEventListener('scroll',closeOnScroll,true)
   window.removeEventListener('resize',closeOnResize)
  }
 },[open])
 function close(){setOpen(false);trigger.current?.focus({preventScroll:true})}
 return <div className="wb-data-more" ref={root} onKeyDown={event=>{
  if(event.key==='Escape'&&open){event.stopPropagation();close()}
 }}>
  <button ref={trigger} type="button" className="wb-iconbtn" aria-label={label} aria-expanded={open} aria-controls={menuId}
      title="更多操作" onClick={()=>setOpen(value=>!value)}><Icon name="more" size={16}/></button>
  {open&&<div className="wb-data-menu" ref={menu} id={menuId} role="group" aria-label={label}>
   {items.map(item=><Btn key={item.label} size="sm" icon={item.icon} kind={item.danger?'danger':undefined}
       disabled={item.disabled} title={item.title} onClick={()=>{close();item.action()}}>{item.label}</Btn>)}
  </div>}
 </div>
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
