import * as React from 'react'
import type { PageId } from '../../shared/contracts.js'
import { Icon, WB } from '../core/runtime.js'
interface Props { page: PageId; data?: unknown }
const primary: PageId[] = ['dashboard', 'tasks', 'replies', 'radar', 'knowledge', 'web-ai']
export function TopNavigation({ page }: Props): React.ReactElement {
  const detailsRef = React.useRef<HTMLDetailsElement>(null)
  React.useEffect(() => {
    const closeOutside = (event: Event) => { const details = detailsRef.current; if (details?.open && !details.contains(event.target as Node)) details.open = false }
    document.addEventListener?.('pointerdown', closeOutside)
    return () => document.removeEventListener?.('pointerdown', closeOutside)
  }, [])
  const more: PageId[] = WB.ORDER.filter((id: PageId) => !primary.includes(id))
  function item(id: PageId): React.ReactElement {
    const meta = WB.PAGE_META[id]
    return <button key={id} type="button" className={'wb-nav-item' + (page === id ? ' is-active' : '')} aria-current={page === id ? 'page' : undefined} onClick={event => {
      const details = event?.currentTarget?.closest('details'); if (details) details.open = false
      WB.go(id); WB.store.set({assistantOpen:false,contextHidden:true})
    }}><Icon name={meta.icon} size={15}/><span>{meta.title}</span></button>
  }
  return <nav className="wb-topnav" aria-label="工作台导航">{primary.map(item)}<details ref={detailsRef} className={'wb-more' + (more.includes(page) ? ' is-active' : '')} onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus()}}}><summary><span>{more.includes(page) ? WB.PAGE_META[page].title : '更多'}</span><Icon name="chevronDown" size={12}/></summary><div className="wb-more-menu">{more.map(item)}</div></details></nav>
}
export const WB_LAYOUT_CSS = `
.wb-root { flex-direction:column; padding-top:var(--dsh-frame-top-clearance,0px); container-type:inline-size; container-name:workbench; }
.wb-head { flex:none; z-index:3; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); }
.wb-toolbar { min-height:48px; padding:8px 20px; border:0; }
.wb-toolbar-brand { display:flex; align-items:center; gap:8px; font-weight:600; }
.wb-workarea { display:flex; flex:1; min-height:0; min-width:0; }
.wb-main { flex:1; min-width:0; }
.wb-context-pane { display:flex; flex-direction:column; width:400px; flex:0 0 400px; max-width:40%; min-width:300px; min-height:0; border-left:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); container-type:inline-size; container-name:contextpane; }
.wb-context-header { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px; border-bottom:1px solid var(--dsw-alias-border-l1); }
.wb-context-body { padding:14px; overflow:auto; min-height:0; flex:1; }
.wb-context-footer { display:flex; align-items:center; gap:8px; padding:12px 14px; border-top:1px solid var(--dsw-alias-border-l1); }
.wb-task-form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
@container contextpane (max-width:460px) { .wb-task-form-grid { grid-template-columns:minmax(0,1fr); } }
.wb-topnav { display:flex; align-items:center; flex-wrap:wrap; gap:4px; padding:4px 20px 10px; min-width:0; }
/* Top-level tabs must not inherit the retired sidebar's active left stripe. */
.wb-topnav .wb-nav-item, .wb-topnav .wb-more > summary { display:flex; align-items:center; gap:8px; min-height:36px; padding:8px 12px; border:0; border-radius:8px; box-shadow:none; font:inherit; font-size:13px; line-height:20px; color:var(--dsw-alias-label-secondary); background:transparent; cursor:pointer; }
.wb-topnav > .wb-nav-item { width:auto; flex:none; white-space:nowrap; }
.wb-topnav .wb-nav-item:hover, .wb-topnav .wb-more > summary:hover, .wb-topnav .wb-more[open] > summary { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
.wb-topnav .wb-nav-item.is-active, .wb-topnav .wb-more.is-active > summary { background:color-mix(in srgb,var(--dsw-alias-label-primary,#20242b) 7%,transparent); color:var(--dsw-alias-label-primary); font-weight:600; box-shadow:none; }
.wb-topnav .wb-nav-item:focus-visible, .wb-topnav .wb-more > summary:focus-visible { outline:2px solid var(--wb-accent); outline-offset:2px; }
.wb-more { position:relative; flex:none; }
.wb-topnav .wb-more > summary { list-style:none; white-space:nowrap; }
.wb-more > summary::-webkit-details-marker { display:none; }
.wb-more > summary svg { transition:transform .14s ease; }
.wb-more[open] > summary svg { transform:rotate(180deg); }
.wb-more-menu { position:absolute; z-index:10; top:calc(100% + 6px); right:0; min-width:188px; padding:6px; border:1px solid var(--dsw-alias-border-l1); border-radius:10px; background:var(--dsw-alias-bg-layer-1); box-shadow:0 6px 24px #0002; }
.wb-scroll { container-type:inline-size; container-name:content; }
.wb-page { max-width:1500px; margin:auto; width:100%; }
.wb-split { align-items:start; }
.wb-page > .wb-page { padding:0; }
.wb-task-table { overflow:auto; }
.wb-task-table:focus-visible { outline:2px solid var(--wb-accent); outline-offset:2px; }
.wb-tabs { flex-wrap:wrap; }
.wb-tab { white-space:nowrap; flex-shrink:0; }
.wb-input, .wb-select-wrap { min-width:0; }
.wb-assistant-composer { min-height:0; max-height:calc(100% - 44px); overflow:auto; }
.wb-assistant-composer > :first-child { min-height:0; overflow:auto; flex:0 1 auto; }
.wb-assistant-composer > .wb-textarea, .wb-assistant-composer > .wb-row { flex:none; }
.wb-assistant-composer > .wb-knowledge-controls { min-height:24px; max-height:120px; overflow:auto; }
.wb-assistant-contexts { max-height:64px; overflow:auto; flex:none; }
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
 .wb-topnav { padding:4px 12px 8px; gap:4px; }
 .wb-topnav .wb-more { margin-left:auto; }
 .wb-topnav > .wb-nav-item, .wb-topnav .wb-more > summary { padding:7px 9px; font-size:12px; min-height:34px; }
 .wb-topnav > .wb-nav-item svg { display:none; }
 .wb-toolbar { padding:8px 12px; flex-wrap:wrap; gap:6px; }
 .wb-page { padding:16px 12px; }
 .wb-toolbar-brand { font-size:12px; }
 .wb-page-head { flex-wrap:wrap; }
 .wb-page-head .wb-ph-actions { flex-wrap:wrap; }
}
`;

