import * as React from 'react'
import type { PageId } from '../../shared/contracts.js'
import { Icon, WB } from '../core/runtime.js'
interface Props { page: PageId; data?: unknown }
const primary: PageId[] = ['dashboard', 'assistant', 'agents', 'tasks', 'replies', 'radar', 'knowledge', 'web-ai']
export function TopNavigation({ page }: Props): React.ReactElement {
  const navRef = React.useRef<HTMLElement>(null), measureRef = React.useRef<HTMLDivElement>(null)
  const detailsRef = React.useRef<HTMLDetailsElement>(null)
  // Keep navigation order stable as entries move between the bar and overflow menu.
  const order: PageId[] = [...primary.filter(id=>WB.ORDER.includes(id)), ...WB.ORDER.filter((id:PageId)=>id!=='search'&&!primary.includes(id))]
  const orderKey=order.join('|')
  const [visibleCount,setVisibleCount]=React.useState(primary.length)
  const countRef=React.useRef(visibleCount);countRef.current=visibleCount
  const restoreFocus=React.useRef<string|null>(null)
  React.useLayoutEffect(()=>{
    const nav=navRef.current,track=measureRef.current;if(!nav||!track)return
    let alive=true
    const measure=()=>{
      if(!alive)return
      const style=getComputedStyle(nav)
      const available=nav.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0)
      const scale=nav.offsetWidth?nav.getBoundingClientRect().width/nav.offsetWidth:1
      const widths=Array.from(track.children).map(el=>el.getBoundingClientRect().width/(scale||1))
      // A detached/hidden panel (and jsdom) cannot provide usable measurements.
      if(available<=0||widths.length!==order.length+1||widths.some(w=>w<=0))return
      const gap=parseFloat(style.columnGap)||0
      const total=widths.slice(0,-1).reduce((a,b)=>a+b,0)+gap*Math.max(0,order.length-1)
      let next=order.length
      if(total>available){
        next=0;let used=widths.at(-1)!
        for(const width of widths.slice(0,-1)){if(used+gap+width>available)break;used+=gap+width;next++}
      }
      if(next===countRef.current)return
      const focused=document.activeElement as HTMLElement|null
      const id=focused?.closest('[data-page]')?.getAttribute('data-page')
      if(nav.contains(focused)){
        if(id)restoreFocus.current=order.indexOf(id as PageId)<next?id:'more'
        else if(detailsRef.current?.contains(focused)&&next===order.length)restoreFocus.current=page
      }
      if(detailsRef.current)detailsRef.current.open=false
      countRef.current=next;setVisibleCount(next)
    }
    measure()
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure)
    observer?.observe(nav);observer?.observe(track)
    window.addEventListener?.('resize',measure)
    void document.fonts?.ready?.then(measure)
    return()=>{alive=false;observer?.disconnect();window.removeEventListener?.('resize',measure)}
  },[orderKey,page])
  React.useLayoutEffect(()=>{
    const target=restoreFocus.current;if(!target)return;restoreFocus.current=null
    if(target==='more')detailsRef.current?.querySelector('summary')?.focus()
    else navRef.current?.querySelector<HTMLButtonElement>(`button[data-page="${target}"]`)?.focus()
  },[visibleCount])
  React.useEffect(() => {
    const closeOutside = (event: Event) => { const details = detailsRef.current; if (details?.open && !details.contains(event.target as Node)) details.open = false }
    document.addEventListener?.('pointerdown', closeOutside)
    return () => document.removeEventListener?.('pointerdown', closeOutside)
  }, [])
  const more=order.slice(visibleCount)
  function item(id: PageId): React.ReactElement {
    const meta = WB.PAGE_META[id]
    return <button key={id} type="button" data-page={id} className={'wb-nav-item' + (page === id ? ' is-active' : '')} aria-current={page === id ? 'page' : undefined} onClick={event => {
      const details = event?.currentTarget?.closest('details'); if (details) { details.open = false; details.querySelector('summary')?.focus() }
      WB.go(id); WB.store.set({assistantOpen:id==='assistant',contextHidden:true})
    }}><Icon name={meta.icon} size={15}/><span>{meta.title}</span></button>
  }
  return <nav ref={navRef} className="wb-topnav" aria-label="工作台导航">
    {order.slice(0,visibleCount).map(item)}
    {more.length>0&&<details ref={detailsRef} className="wb-more" onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus()}}}><summary><span>更多</span><Icon name="chevronDown" size={12}/></summary><div className="wb-more-menu">{more.map(item)}</div></details>}
    <div className="wb-nav-measure-clip" aria-hidden="true"><div ref={measureRef} className="wb-nav-measure">{order.map(id=><span key={id} className={'wb-nav-item'+(page===id?' is-active':'')}><Icon name={WB.PAGE_META[id].icon} size={15}/><span>{WB.PAGE_META[id].title}</span></span>)}<span className="wb-nav-more-measure"><span>更多</span><Icon name="chevronDown" size={12}/></span></div></div>
  </nav>
}
export const WB_LAYOUT_CSS = `
.wb-root { flex-direction:column; padding-top:var(--dsh-frame-top-clearance,0px); container-type:inline-size; container-name:workbench; }
/* Navigation overlays page/tool popups (45), while modal masks (60) remain above it. */
.wb-head { position:relative; flex:none; z-index:50; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); }
.wb-toolbar { min-height:48px; padding:8px 20px; border:0; }
.wb-toolbar-brand { display:flex; align-items:center; gap:8px; font-weight:600; }
.wb-workarea { display:flex; flex:1; min-height:0; min-width:0; }
.wb-main { flex:1; min-width:0; }
.wb-context-pane { display:flex; flex-direction:column; width:400px; flex:0 0 400px; max-width:40%; min-width:300px; min-height:0; border-left:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); container-type:inline-size; container-name:contextpane; }
.wb-context-header { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px; border-bottom:1px solid var(--dsw-alias-border-l1); }
.wb-context-title { min-width:0; flex:1; }
.wb-context-title > strong { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; overflow-wrap:anywhere; line-height:1.6; }
.wb-context-header > .wb-iconbtn { flex:none; }
.wb-context-body { padding:14px; overflow:auto; min-height:0; flex:1; }
.wb-context-footer > .wb-row { width:100%; justify-content:flex-end; flex-wrap:wrap; gap:8px; }
.wb-context-footer { display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:8px; padding:12px 14px; border-top:1px solid var(--dsw-alias-border-l1); }
.wb-task-form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
@container contextpane (max-width:460px) { .wb-task-form-grid { grid-template-columns:minmax(0,1fr); } }
.wb-topnav { position:relative; display:flex; align-items:center; flex-wrap:nowrap; gap:4px; padding:4px 20px 10px; min-width:0; }
/* Top-level tabs must not inherit the retired sidebar's active left stripe. */
.wb-topnav .wb-nav-item, .wb-topnav .wb-more > summary, .wb-topnav .wb-nav-more-measure { display:flex; align-items:center; gap:8px; min-height:36px; padding:8px 12px; border:0; border-radius:8px; box-shadow:none; font:inherit; font-size:13px; line-height:20px; color:var(--dsw-alias-label-secondary); background:transparent; cursor:pointer; }
.wb-topnav > .wb-nav-item, .wb-nav-measure > .wb-nav-item { width:auto; flex:none; white-space:nowrap; }
.wb-topnav .wb-nav-item:hover, .wb-topnav .wb-more > summary:hover, .wb-topnav .wb-more[open] > summary { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
.wb-topnav .wb-nav-item.is-active { background:var(--wb-selected-bg); color:var(--dsw-alias-label-primary); font-weight:600; box-shadow:none; }
.wb-topnav .wb-nav-item:focus-visible, .wb-topnav .wb-more > summary:focus-visible { outline:2px solid var(--wb-accent); outline-offset:2px; }
.wb-nav-measure-clip { position:absolute; inset:0; overflow:hidden; visibility:hidden; pointer-events:none; }
.wb-nav-measure { display:flex; flex-wrap:nowrap; gap:4px; width:max-content; }
.wb-nav-measure > * { flex:none; white-space:nowrap; }
.wb-more { position:relative; flex:none; }
.wb-topnav .wb-more > summary { list-style:none; white-space:nowrap; }
.wb-more > summary::-webkit-details-marker { display:none; }
.wb-more > summary svg { transition:transform .14s ease; }
.wb-more[open] > summary svg { transform:rotate(180deg); }
.wb-more-menu { position:absolute; z-index:10; top:calc(100% + 6px); right:0; min-width:min(188px,calc(100vw - 24px)); max-width:calc(100vw - 24px); max-height:min(480px,60vh); overflow:auto; padding:6px; border:1px solid var(--dsw-alias-border-l1); border-radius:10px; background:var(--dsw-alias-bg-layer-1); box-shadow:0 6px 24px #0002; }
.wb-scroll { container-type:inline-size; container-name:content; }
.wb-workarea { --wb-page-gutter:24px; --wb-content-max:1500px; }
.wb-page { max-width:var(--wb-content-max,1500px); margin:auto; width:100%; padding-inline:var(--wb-page-gutter,24px); }
.wb-split { align-items:start; }
.wb-page > .wb-page { padding:0; }
.wb-task-table { overflow:auto; }
.wb-task-table:focus-visible { outline:2px solid var(--wb-accent); outline-offset:2px; }
.wb-tabs { flex-wrap:wrap; }
.wb-tab { white-space:nowrap; flex-shrink:0; }
.wb-input, .wb-select-wrap { min-width:0; }
.wb-assistant { min-height:0; overflow:auto; }
.wb-assistant-chat-layout { display:flex; flex:1; min-height:0; min-width:0; position:relative; overflow:hidden; }
.wb-workarea.wb-assistant-page > .wb-main { display:none; }
.wb-workarea.wb-assistant-page > .wb-assistant { flex:1!important; width:100%!important; max-width:100%!important; min-width:0!important; border-left:0!important; }
.wb-workarea.wb-assistant-page { padding:24px var(--wb-page-gutter) 24px; box-sizing:border-box; }
.wb-workarea.wb-assistant-page > .wb-assistant.wb-hub { max-width:calc(var(--wb-content-max) - 2 * var(--wb-page-gutter))!important; margin:0 auto; border:1px solid var(--dsw-alias-border-l1); border-left:1px solid var(--dsw-alias-border-l1)!important; border-radius:12px; }
.wb-assistant-sessions-heading { display:flex; justify-content:space-between; align-items:center; padding:2px 2px 0; font-size:12px; }
.wb-assistant-conversation { display:flex; flex-direction:column; flex:1; min-height:0; min-width:0; overflow:hidden; }
.wb-assistant-current { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.wb-assistant-current strong, .wb-assistant-current small { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.wb-assistant-current strong { font-size:13px; font-weight:600; }
.wb-assistant-current small { color:var(--dsw-alias-label-secondary); font-size:11px; }
.wb-assistant-sessions { display:flex; flex-direction:column; gap:10px; flex:0 0 208px; width:208px; min-width:0; padding:12px 10px; border-right:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); box-sizing:border-box; }
.wb-assistant-session-items { flex:1; min-height:0; overflow:auto; display:flex; flex-direction:column; gap:4px; }
.wb-assistant-session { display:flex; align-items:flex-start; gap:8px; width:100%; padding:10px 8px; border:0; border-radius:8px; background:transparent; color:var(--dsw-alias-label-secondary); text-align:left; cursor:pointer; flex:none; }
.wb-assistant-session:hover, .wb-assistant-session[aria-current=true] { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
.wb-assistant-session > span { min-width:0; display:flex; flex-direction:column; gap:5px; }
.wb-assistant-session strong { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; font-size:12px; line-height:1.5; font-weight:500; overflow-wrap:anywhere; }
.wb-assistant-session small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:10px; opacity:.8; }
@media (max-width:640px) { .wb-assistant-sessions { position:absolute; z-index:6; top:0; bottom:0; width:min(250px,85vw); box-shadow:8px 0 24px #0002; } }
.wb-assistant-head .wb-select-wrap { width:100%; }
.wb-assistant-head .wb-select { width:100%; text-overflow:ellipsis; }
.wb-assistant-head .wb-iconbtn { width:26px; height:28px; }
.wb-assistant-message { width:100%; max-width:720px; margin:0 auto; }
.wb-assistant-knowledge-note { margin:0; padding:0 2px; }
.wb-assistant-composer { flex:none; min-height:120px; max-height:calc(100% - 72px); overflow:auto; padding:10px; }
.wb-assistant-input { min-width:0; padding:10px; border:1px solid var(--dsw-alias-border-l1); border-radius:12px; background:var(--dsw-alias-bg-base); }
.wb-assistant-input:focus-within { border-color:var(--dsw-alias-brand-primary); }
.wb-assistant-input > .wb-textarea { min-height:72px; max-height:160px; padding:4px 0; border:0; border-radius:0; background:transparent; box-shadow:none; resize:vertical; }
.wb-assistant-input > .wb-textarea:focus { box-shadow:none; }
.wb-assistant-input-actions { margin-top:6px; }
.wb-assistant-contexts { max-height:48px; overflow:auto; flex:none; }
.wb-stats-strip { display:flex; flex-direction:row; align-items:center; flex-wrap:wrap; gap:8px; padding:10px 12px; border:1px solid var(--dsw-alias-border-l1); border-radius:9px; margin-bottom:14px; }
.wb-reply-list { display:flex; flex-direction:column; }
.wb-reply-item { padding:14px 0; border-bottom:1px solid var(--dsw-alias-border-l1); }
.wb-reply-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
.wb-news-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr)); gap:16px; align-items:start; }
.wb-news-grid > .wb-card, .wb-radar-panel { overflow:visible; }
.wb-compact-status { padding:10px 12px; margin-bottom:14px; border-radius:8px; background:var(--dsw-alias-bg-layer-1); }
.wb-compact-status summary { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.wb-draft-field { margin:8px 0; }
@container workbench (max-width:1024px) {
 .wb-workarea.is-context-open > .wb-main { display:none; }
 .wb-workarea.is-context-open > .wb-context-pane, .wb-workarea.is-context-open > .wb-assistant { flex:1!important; width:100%!important; max-width:100%!important; min-width:0!important; border-left:0!important; }
}
@container content (max-width:780px) {
 .wb-split, .wb-settings-grid, .wb-toolbox-layout { grid-template-columns:minmax(0,1fr)!important; }
 .wb-toolbox-layout .wb-toolgrid { max-height:220px; overflow:auto; grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important; }
}
@container workbench (max-width:560px) {
 .wb-workarea { --wb-page-gutter:12px; }
 .wb-workarea.wb-assistant-page { padding-block:16px; }
 .wb-topnav { padding:4px 12px 8px; gap:4px; }
 .wb-topnav .wb-more { margin-left:auto; }
 .wb-topnav > .wb-nav-item, .wb-nav-measure > .wb-nav-item, .wb-topnav .wb-more > summary, .wb-topnav .wb-nav-more-measure { padding:7px 9px; font-size:12px; min-height:34px; }
 .wb-topnav > .wb-nav-item svg, .wb-nav-measure > .wb-nav-item svg { display:none; }
 .wb-toolbar { padding:8px 12px; flex-wrap:wrap; gap:6px; }
 .wb-page { padding:16px 12px; }
 .wb-toolbar-brand { font-size:12px; }
 .wb-page-head { flex-wrap:wrap; }
 .wb-page-head .wb-ph-actions { flex-wrap:wrap; }
}
@media(max-height:420px) { .wb-workarea.wb-assistant-page { padding-block:6px; } }
`;
