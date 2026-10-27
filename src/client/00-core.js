/* ============================================================================
 * dev-workbench client core
 *
 * PUBLIC CONTRACT for every other src/client/*.js file in this plugin
 * (they are concatenated into one factory scope by scripts/build.mjs):
 *
 *   React, h                    – React and createElement
 *   Icon({name,size})           – inline SVG icon; see WB.ICONS for names
 *   Panel({title,sub,icon,actions,children,style,bodyStyle,className})
 *   PageHead({icon,title,sub,actions})
 *   Btn({kind,size,icon,onClick,disabled,title,children})
 *                               – kind: primary | ghost | subtle | danger
 *   IconBtn({name,label,onClick,active})
 *   Badge({tone,children})      – tone: accent|ok|warn|err|idle
 *   Stat({label,value,sub,tone,icon,onClick})
 *   Field({label,hint,children})
 *   Input / Textarea / Select   – styled native controls (props pass through)
 *   Toggle({checked,onChange,label})
 *   Segmented({items,value,onChange})
 *                               – items: [{value,label}]
 *   Tabs({items,value,onChange})– items: [{value,label,count}]
 *   Empty({icon,title,hint,action})
 *   Spinner({size})
 *   Progress({value,max})
 *   Chip({children,active,onClick,onRemove})
 *   Kbd({children})
 *   Modal({open,title,sub,onClose,children,footer,width})
 *   Divider()
 *
 *   WB.store.get() / WB.store.set(patch) / WB.useStore()
 *   WB.actions.*                – see below; every action resolves the new snapshot
 *   WB.t(key, fallback)         – locale lookup with a fallback literal
 *   WB.fmt.*                    – date / relative / due / num / bytes
 *   WB.util.*                   – uid / debounce / truncate / groupBy / sortTasks
 *   WB.pages.<id> = Component   – a page registers itself here
 *   WB.PAGE_META                – nav metadata (id → {title, icon, hint})
 *
 * Store snapshot (`WB.useStore()`):
 *   {
 *     status: 'loading' | 'ready' | 'error',
 *     error: string | null,
 *     data: {tasks, sources, runs, knowledge, radar, connectors, settings,
 *            projects, audit, version, updatedAt} | null,
 *     busy: boolean,
 *     toasts: [{id, kind, text}],
 *     page: string,           // active page id
 *   }
 *
 * Rules for page modules:
 *   - no imports, no JSX, no DOM writes, no document.body access;
 *   - React hooks only at the top of a component;
 *   - every list needs a stable `key`;
 *   - all user-visible numbers come from `data`, never invented;
 *   - an empty collection renders <Empty>, never fabricated rows.
 * ========================================================================== */
const h = React.createElement

/* ------------------------------------------------------------------ tokens */
const T = {
  bg: 'var(--dsw-alias-bg-base)',
  layer1: 'var(--dsw-alias-bg-layer-1)',
  layer2: 'var(--dsw-alias-bg-layer-2)',
  overlay: 'var(--dsw-alias-bg-overlay)',
  border1: 'var(--dsw-alias-border-l1)',
  border2: 'var(--dsw-alias-border-l2)',
  text: 'var(--dsw-alias-label-primary)',
  text2: 'var(--dsw-alias-label-secondary)',
  accent: 'var(--dsw-alias-brand-primary)',
  ok: 'var(--dsw-alias-state-success-primary)',
  warn: 'var(--dsw-alias-state-warn-primary)',
  err: 'var(--dsw-alias-state-error-primary)',
  idle: 'var(--dsw-alias-state-idle-primary)',
  sidebar: 'var(--dsw-specific-sidebar-fill)',
  radius: { card: 16, ctl: 10, pill: 999 },
  gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  font: {
    title: 19,
    h3: 14,
    body: 13,
    small: 12,
    tiny: 11,
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
}

/* ------------------------------------------------------------------- WB bag */
const WB = {
  NS: 'dev-workbench',
  PANEL_KEY: 'dev-workbench',
  inject: ['slots', 'locale', 'connection'],
  pages: {},
  T: T,
  ICONS: {},
  PAGE_META: {},
  ORDER: [],
}

/* ---------------------------------------------------------------- stylesheet */
const WB_CSS = `
.wb-root {
  --wb-accent: var(--dsw-alias-brand-primary);
  --wb-ok: var(--dsw-alias-state-success-primary);
  --wb-warn: var(--dsw-alias-state-warn-primary);
  --wb-err: var(--dsw-alias-state-error-primary);
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.5;
  overflow: hidden;
}
.wb-root *, .wb-root *::before, .wb-root *::after { box-sizing: border-box; }
.wb-nav {
  width: 208px;
  flex: 0 0 208px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 10px;
  border-right: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-specific-sidebar-fill);
  overflow: auto;
}
.wb-nav-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 8px 14px;
  color: var(--dsw-alias-label-primary);
}
.wb-nav-brand strong { font-size: 13.5px; font-weight: 600; letter-spacing: .01em; }
.wb-nav-label {
  padding: 10px 9px 5px;
  font-size: 10.5px;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-secondary);
  opacity: .85;
}
.wb-nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 9px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background .14s ease, color .14s ease;
}
.wb-nav-item:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.wb-nav-item.is-active {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  box-shadow: inset 2px 0 0 var(--wb-accent);
}
.wb-nav-item .wb-nav-count {
  margin-left: auto;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
  font-size: 10.5px;
  line-height: 16px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
}
.wb-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.wb-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
}
.wb-toolbar-search {
  flex: 1 1 auto;
  max-width: 460px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}
.wb-toolbar-search:hover { border-color: var(--dsw-alias-border-l2); }
.wb-toolbar-search kbd { margin-left: auto; }
.wb-scroll { flex: 1 1 auto; overflow: auto; scrollbar-width: thin; }
.wb-page { padding: 24px 24px 44px; max-width: 1340px; }
.wb-page-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
.wb-page-head .wb-ph-icon {
  display: grid; place-items: center;
  width: 34px; height: 34px; flex: none;
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  color: var(--wb-accent);
}
.wb-page-head h1 { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -.01em; }
.wb-page-head p { margin: 3px 0 0; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.wb-page-head .wb-ph-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }

.wb-grid { display: grid; gap: 16px; }
.wb-row { display: flex; align-items: center; gap: 8px; }
.wb-row--wrap { flex-wrap: wrap; }
.wb-spacer { flex: 1 1 auto; }
.wb-stack { display: flex; flex-direction: column; gap: 8px; }

.wb-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}
.wb-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px 10px;
  padding: 14px 16px 11px;
}
.wb-card-titles { min-width: 0; flex: 1 1 auto; }
.wb-card-icon { display: inline-flex; margin-top: 2px; color: var(--wb-accent); }
.wb-card-title {
  display: flex; align-items: center; gap: 7px;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--dsw-alias-label-primary);
}
.wb-card-sub { margin: 2px 0 0; font-size: 12px; color: var(--dsw-alias-label-secondary); line-height: 1.45; }
.wb-card-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; flex: none; }
.wb-card-body { padding: 0 16px 15px; min-width: 0; }
.wb-card-body--flush { padding: 0; display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
.wb-divider { height: 1px; background: var(--dsw-alias-border-l1); margin: 0; border: 0; }

.wb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 11px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background .14s ease, border-color .14s ease, opacity .14s ease;
}
.wb-btn:hover { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l2); }
.wb-btn:focus-visible { outline: 2px solid var(--wb-accent); outline-offset: 1px; }
.wb-btn:disabled { opacity: .45; cursor: not-allowed; }
.wb-btn--primary {
  border-color: transparent;
  background: var(--wb-accent);
  color: var(--dsw-alias-bg-base);
  font-weight: 600;
}
.wb-btn--primary:hover { filter: brightness(1.06); background: var(--wb-accent); }
.wb-btn--subtle { background: transparent; border-color: transparent; color: var(--dsw-alias-label-secondary); }
.wb-btn--subtle:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.wb-btn--danger { color: var(--wb-err); border-color: var(--dsw-alias-border-l1); }
.wb-btn--danger:hover { border-color: var(--wb-err); background: var(--dsw-alias-bg-layer-2); }
.wb-btn--sm { height: 25px; padding: 0 8px; font-size: 11.5px; border-radius: 8px; }
.wb-iconbtn {
  display: inline-grid;
  place-items: center;
  width: 28px; height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background .14s ease, color .14s ease;
}
.wb-iconbtn:hover, .wb-iconbtn.is-active { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.wb-iconbtn:focus-visible { outline: 2px solid var(--wb-accent); outline-offset: 1px; }

.wb-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 19px;
  padding: 0 7px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .01em;
  white-space: nowrap;
}
.wb-badge--accent { color: var(--wb-accent); border-color: color-mix(in srgb, var(--wb-accent) 45%, transparent); background: color-mix(in srgb, var(--wb-accent) 12%, transparent); }
.wb-badge--ok { color: var(--wb-ok); border-color: color-mix(in srgb, var(--wb-ok) 45%, transparent); background: color-mix(in srgb, var(--wb-ok) 12%, transparent); }
.wb-badge--warn { color: var(--wb-warn); border-color: color-mix(in srgb, var(--wb-warn) 45%, transparent); background: color-mix(in srgb, var(--wb-warn) 12%, transparent); }
.wb-badge--err { color: var(--wb-err); border-color: color-mix(in srgb, var(--wb-err) 45%, transparent); background: color-mix(in srgb, var(--wb-err) 12%, transparent); }
.wb-badge--idle { color: var(--dsw-alias-label-secondary); }

.wb-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11.5px;
  white-space: nowrap;
  cursor: pointer;
}
.wb-chip:hover { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
.wb-chip.is-active {
  color: var(--wb-accent);
  border-color: color-mix(in srgb, var(--wb-accent) 50%, transparent);
  background: color-mix(in srgb, var(--wb-accent) 12%, transparent);
}
.wb-chip--static { cursor: default; }
.wb-chip-x { display: inline-flex; opacity: .6; }
.wb-chip-x:hover { opacity: 1; }

.wb-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.wb-label { font-size: 11.5px; font-weight: 600; color: var(--dsw-alias-label-secondary); letter-spacing: .01em; }
.wb-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); opacity: .85; }
.wb-input, .wb-select, .wb-textarea {
  width: 100%;
  padding: 6px 9px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  outline: none;
  transition: border-color .14s ease, box-shadow .14s ease;
}
.wb-textarea { min-height: 68px; resize: vertical; line-height: 1.55; }
.wb-input:focus, .wb-select:focus, .wb-textarea:focus {
  border-color: var(--wb-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--wb-accent) 18%, transparent);
}
.wb-input::placeholder, .wb-textarea::placeholder { color: var(--dsw-alias-label-secondary); opacity: .7; }
.wb-select { appearance: none; padding-right: 26px; cursor: pointer; }
.wb-select-wrap { position: relative; display: block; }
.wb-select-wrap::after {
  content: '';
  position: absolute; right: 9px; top: 50%;
  width: 6px; height: 6px;
  margin-top: -4px;
  border-right: 1.5px solid var(--dsw-alias-label-secondary);
  border-bottom: 1.5px solid var(--dsw-alias-label-secondary);
  transform: rotate(45deg);
  pointer-events: none;
}

.wb-tabs { display: flex; gap: 3px; padding: 3px; border-radius: 11px; background: var(--dsw-alias-bg-layer-2); }
.wb-tab {
  display: inline-flex; align-items: center; gap: 6px;
  height: 26px; padding: 0 11px;
  border: 0; border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 12px; font-weight: 500;
  cursor: pointer;
}
.wb-tab:hover { color: var(--dsw-alias-label-primary); }
.wb-tab.is-active { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 2px rgba(0,0,0,.18); }
.wb-tab .wb-tab-count { font-size: 10.5px; opacity: .75; }

.wb-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px 11px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-left: 3px solid var(--wb-accent);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
}
.wb-banner--ok { border-left-color: var(--wb-ok); }
.wb-banner--warn { border-left-color: var(--wb-warn); }
.wb-banner--err { border-left-color: var(--wb-err); }
.wb-banner-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
}
.wb-banner-main { flex: 1 1 auto; min-width: 0; }
.wb-banner-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb-banner-sub {
  margin-top: 1px;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb-banner-actions { display: flex; align-items: center; gap: 6px; flex: none; }

.wb-stat {
  display: flex; flex-direction: column; gap: 2px;
  padding: 13px 15px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-1);
  min-width: 0;
  text-align: left;
}
button.wb-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px 11px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-left: 3px solid var(--wb-accent);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
}
.wb-banner--ok { border-left-color: var(--wb-ok); }
.wb-banner--warn { border-left-color: var(--wb-warn); }
.wb-banner--err { border-left-color: var(--wb-err); }
.wb-banner-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
}
.wb-banner-main { flex: 1 1 auto; min-width: 0; }
.wb-banner-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb-banner-sub {
  margin-top: 1px;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb-banner-actions { display: flex; align-items: center; gap: 6px; flex: none; }

.wb-stat { font: inherit; cursor: pointer; }
button.wb-stat:hover { border-color: var(--dsw-alias-border-l2); }
.wb-stat-top { display: flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary); font-size: 11.5px; }
.wb-stat-value { font-size: 23px; font-weight: 600; letter-spacing: -.02em; line-height: 1.15; font-variant-numeric: tabular-nums; }
.wb-stat-sub {
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.wb-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px;
  margin: auto; width: 100%;
  padding: 26px 16px 24px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
}
.wb-empty-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 11px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); }
.wb-empty strong { color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 600; }
.wb-empty p { margin: 0; font-size: 11.5px; max-width: 380px; line-height: 1.6; }

.wb-list { display: flex; flex-direction: column; }
.wb-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  min-width: 0;
}
.wb-item:last-child { border-bottom: 0; }
.wb-item:hover { background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 55%, transparent); }
.wb-item-main { flex: 1 1 auto; min-width: 0; }
.wb-item-title { font-size: 12.5px; font-weight: 500; color: var(--dsw-alias-label-primary); overflow-wrap: anywhere; }
.wb-item-title.is-done { text-decoration: line-through; opacity: .55; }
.wb-item-sub { margin-top: 2px; font-size: 11px; color: var(--dsw-alias-label-secondary); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.wb-item-actions { display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .12s ease; }
.wb-item:hover .wb-item-actions, .wb-item-actions:focus-within { opacity: 1; }

.wb-check {
  flex: none;
  display: grid; place-items: center;
  width: 16px; height: 16px;
  margin-top: 2px;
  padding: 0;
  border: 1.5px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: transparent;
  color: transparent;
  cursor: pointer;
}
.wb-check:hover { border-color: var(--wb-accent); }
.wb-check.is-on { background: var(--wb-ok); border-color: var(--wb-ok); color: var(--dsw-alias-bg-base); }

.wb-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.wb-table th {
  text-align: left; font-weight: 600; font-size: 10.5px; letter-spacing: .05em; text-transform: uppercase;
  color: var(--dsw-alias-label-secondary);
  padding: 7px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  white-space: nowrap;
}
.wb-table td { padding: 9px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); vertical-align: middle; }
.wb-table tr:last-child td { border-bottom: 0; }
.wb-table tbody tr:hover { background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 45%, transparent); }

.wb-kbd {
  display: inline-block;
  min-width: 17px;
  padding: 0 5px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.wb-modal-mask {
  position: fixed; inset: 0; z-index: 60;
  display: flex; align-items: flex-start; justify-content: center;
  padding: 12vh 16px 16px;
  background: rgba(5, 9, 18, .55);
  backdrop-filter: blur(2px);
  animation: wb-fade .12s ease;
}
.wb-modal {
  width: min(560px, 100%);
  max-height: 76vh;
  display: flex; flex-direction: column;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 16px;
  background: var(--dsw-alias-bg-overlay);
  box-shadow: 0 24px 64px rgba(0,0,0,.42);
  overflow: hidden;
  animation: wb-pop .14s ease;
}
.wb-modal-head { display: flex; align-items: flex-start; gap: 10px; padding: 15px 16px 10px; }
.wb-modal-head h2 { margin: 0; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); font-weight: 600; }
.wb-modal-head strong { display: block; font-size: 14px; font-weight: 600; margin-top: 2px; }
.wb-modal-body { padding: 4px 16px 14px; overflow: auto; }
.wb-modal-foot { display: flex; align-items: center; gap: 8px; padding: 11px 16px; border-top: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); }
@keyframes wb-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes wb-pop { from { opacity: 0; transform: translateY(-6px) scale(.99) } to { opacity: 1; transform: none } }

.wb-toasts {
  position: absolute; right: 16px; bottom: 16px; z-index: 70;
  display: flex; flex-direction: column; gap: 8px; align-items: flex-end;
  pointer-events: none;
}
.wb-toast {
  display: flex; align-items: center; gap: 8px;
  max-width: 380px;
  padding: 9px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-left-width: 3px;
  border-radius: 10px;
  background: var(--dsw-alias-bg-overlay);
  box-shadow: 0 12px 32px rgba(0,0,0,.34);
  font-size: 12px;
  animation: wb-pop .16s ease;
}
.wb-toast--ok { border-left-color: var(--wb-ok); }
.wb-toast--err { border-left-color: var(--wb-err); }
.wb-toast--info { border-left-color: var(--wb-accent); }

.wb-progress { height: 4px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.wb-progress > i { display: block; height: 100%; background: var(--wb-accent); border-radius: 999px; transition: width .2s ease; }

.wb-spin {
  display: inline-block;
  width: 15px; height: 15px;
  border: 2px solid var(--dsw-alias-border-l2);
  border-top-color: var(--wb-accent);
  border-radius: 50%;
  animation: wb-rotate .7s linear infinite;
}
@keyframes wb-rotate { to { transform: rotate(360deg) } }

.wb-mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 11.5px; }
.wb-code {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 340px;
  overflow: auto;
}
.wb-muted { color: color-mix(in srgb, var(--dsw-alias-label-secondary) 74%, var(--dsw-alias-label-primary)); }
.wb-tiny { font-size: 11px; }
.wb-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb-clamp2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.wb-link { color: var(--wb-accent); text-decoration: none; }
.wb-link:hover { text-decoration: underline; }
.wb-switch {
  position: relative; flex: none;
  width: 34px; height: 19px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  cursor: pointer;
  transition: background .16s ease, border-color .16s ease;
}
.wb-switch > i {
  position: absolute; top: 2px; left: 2px;
  width: 13px; height: 13px;
  border-radius: 50%;
  background: var(--dsw-alias-label-secondary);
  transition: transform .16s ease, background .16s ease;
}
.wb-switch.is-on { background: var(--wb-accent); border-color: var(--wb-accent); }
.wb-switch.is-on > i { transform: translateX(15px); background: var(--dsw-alias-bg-base); }
.wb-toolgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 9px; }
.wb-tool {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 11px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color .14s ease, background .14s ease;
}
.wb-tool:hover { border-color: var(--wb-accent); background: var(--dsw-alias-bg-layer-2); }
.wb-tool strong { font-size: 12.5px; font-weight: 600; }
.wb-tool span { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.wb-tool.is-active { border-color: var(--wb-accent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--wb-accent) 40%, transparent); }
.wb-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
@media (max-width: 1080px) {
  .wb-nav { width: 176px; flex-basis: 176px; }
  .wb-split { grid-template-columns: minmax(0, 1fr); }
  .wb-page { padding: 16px 14px 32px; }
}
@media (max-width: 860px) {
  .wb-nav { display: none; }
}
`

/* ------------------------------------------------------------------- store */
const wbStore = (function () {
  let state = {
    status: 'loading',
    error: null,
    data: null,
    busy: false,
    toasts: [],
    page: 'dashboard',
    focusTaskId: null,
    taskForm: null,
    /** Transient hand-off from the dashboard to the task center
     *  ({status?|dueFilter?}); the task page consumes it and clears it. */
    taskPreset: null,
    /** 工作台助手：可移除的上下文引用（task / source / radar / knowledge / search） */
    assistantOpen: false,
    assistantRefs: [],
  }
  const listeners = new Set()
  return {
    get() {
      return state
    },
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch
      state = Object.assign({}, state, next)
      listeners.forEach(function (fn) {
        try {
          fn()
        } catch (e) {
          /* a page that throws must not blank the others */
        }
      })
    },
    subscribe(fn) {
      listeners.add(fn)
      return function () {
        listeners.delete(fn)
      }
    },
  }
})()

function useStore() {
  return React.useSyncExternalStore(wbStore.subscribe, wbStore.get)
}

/* --------------------------------------------------------------------- i18n */
// 产品语言固定为中文：无论 DSH 界面是中文还是英文环境，插件自身一律显示中文。
// 因此 zh / en 两个字典内容相同，避免英文环境下导航出现 Briefing / Task center 之类。
const WB_DICT = {
  zh: {
    'app.title': '智能工作台',
    'app.subtitle': '每天的入口',
    'nav.overview': '概览',
    'nav.work': '工作',
    'nav.tools': '工具',
    'nav.dashboard': '今日简报',
    'nav.tasks': '任务中心',
    'nav.search': '统一搜索',
    'nav.agents': 'Agent 中心',
    'nav.collab': '研发协作',
    'nav.radar': '技术雷达',
    'nav.toolbox': '开发工具箱',
    'nav.knowledge': '知识空间',
    'nav.settings': '连接与设置',
    'common.refresh': '刷新',
    'common.new': '新建',
    'common.save': '保存',
    'common.cancel': '取消',
    'common.delete': '删除',
    'common.close': '关闭',
    'common.search': '搜索或执行命令',
    'common.loading': '加载中…',
    'common.empty': '暂无内容',
    'common.retry': '重试',
    'common.all': '全部',
    'dash.title': '今日简报',
    'tasks.title': '任务中心',
    'agents.title': 'Agent 中心',
    'radar.title': '技术雷达',
    'toolbox.title': '开发工具箱',
    'knowledge.title': '知识空间',
    'settings.title': '连接与设置',
  },
}
// 英文环境复用同一份中文文案（产品语言固定为中文，不做英文版）
WB_DICT.en = WB_DICT.zh

let wbTranslate = function (key) {
  return key
}

WB.t = function (key, fallback) {
  let value = key
  try {
    value = wbTranslate(key)
  } catch (e) {
    value = key
  }
  if (typeof value === 'string' && value.length > 0 && value !== key) return value
  return fallback === undefined ? key : fallback
}

/* --------------------------------------------------------------------- RPC */
let wbConnection = null
let wbUiWorkspace = null
let wbLayout = null

/**
 * Open the harness directory picker. Resolves null when the profile has no
 * picker or the user cancels — callers must treat null as "nothing happened",
 * never as an empty path.
 */
function pickDirectory() {
  if (!wbUiWorkspace || typeof wbUiWorkspace.pickDirectory !== 'function') {
    return Promise.resolve(null)
  }
  return Promise.resolve()
    .then(function () {
      return wbUiWorkspace.pickDirectory()
    })
    .then(function (value) {
      return typeof value === 'string' && value.length > 0 ? value : null
    })
    .catch(function () {
      return null
    })
}

function wbRpc(endpoint, args, signal) {
  if (!wbConnection || !wbConnection.rpc || typeof wbConnection.rpc.call !== 'function') {
    return Promise.reject(new Error('与 Host 的连接尚未就绪'))
  }
  return wbConnection.rpc.call('/api', endpoint, { args: args || {} }, signal).then(function (envelope) {
    if (!envelope || envelope.ok !== true) {
      const error = envelope && envelope.error
      const message =
        error === undefined
          ? '远端调用失败'
          : String(error && error.message !== undefined ? error.message : error)
      throw new Error(message)
    }
    return envelope.value
  })
}

/* ------------------------------------------------------------------ toasts */
let wbToastSeq = 0
function toast(text, kind) {
  const id = ++wbToastSeq
  wbStore.set(function (state) {
    return { toasts: state.toasts.concat([{ id: id, kind: kind || 'info', text: String(text) }]) }
  })
  setTimeout(function () {
    wbStore.set(function (state) {
      return { toasts: state.toasts.filter(function (item) {
        return item.id !== id
      }) }
    })
  }, kind === 'err' ? 6000 : 3200)
  return id
}

/** 我们注册的 Agent 工具名：原生聊天的工具卡片按这些 key 注册。 */
WB.WORKBENCH_TOOL_NAMES = [
  'workbench_create_task',
  'workbench_update_task',
  'workbench_list_tasks',
  'workbench_task_brief',
  'workbench_record_run',
  'workbench_fetch_radar',
  'workbench_fetch_mentions',
  'workbench_update_radar',
  'workbench_search',
]

/* --------------------------------------------------------------- 助手上下文 */
/**
 * 工作台助手：把「当前在看的东西」作为**可见、可移除**的上下文引用收集起来，
 * 交给原生会话里的 Agent（它有 workbench_* 工具，结果会写回同一份数据）。
 * 插件内不嵌模型；这里只负责组装上下文与跳转（TODO 04 的备选路径）。
 */
const assistant = {
  open() {
    wbStore.set({ assistantOpen: true })
  },
  close() {
    wbStore.set({ assistantOpen: false })
  },
  toggle() {
    wbStore.set(function (state) {
      return { assistantOpen: !state.assistantOpen }
    })
  },
  add(ref) {
    if (!ref || !ref.kind) return
    wbStore.set(function (state) {
      const exists = state.assistantRefs.some(function (item) {
        return item.kind === ref.kind && item.id === ref.id
      })
      return {
        assistantOpen: true,
        assistantRefs: exists ? state.assistantRefs : state.assistantRefs.concat([ref]).slice(-8),
      }
    })
  },
  remove(kind, id) {
    wbStore.set(function (state) {
      return {
        assistantRefs: state.assistantRefs.filter(function (item) {
          return !(item.kind === kind && item.id === id)
        }),
      }
    })
  },
  clear() {
    wbStore.set({ assistantRefs: [] })
  },
}

/** 把上下文引用渲染成可直接粘贴给会话的 Markdown 简报。 */
function assistantBrief(refs, instruction) {
  const lines = []
  lines.push('请基于下面的工作台上下文协助我，并在有结论时用 workbench_* 工具写回（创建/更新待办、登记执行记录、写回资讯摘要）。')
  lines.push('')
  refs.forEach(function (ref, index) {
    lines.push('### 上下文 ' + (index + 1) + '：' + (ref.label || ref.kind) + ' · ' + (ref.title || ref.id))
    if (ref.url) lines.push('- 链接：' + ref.url)
    if (ref.meta) lines.push('- 信息：' + ref.meta)
    if (ref.body) {
      lines.push('- 内容：')
      lines.push(String(ref.body).slice(0, 1200))
    }
    lines.push('')
  })
  lines.push('### 我的要求')
  lines.push(String(instruction || '').trim() || '（在这里补充要求）')
  return lines.join('\n')
}

/* ----------------------------------------------------------------- actions */
function settle(promise, okText) {
  wbStore.set({ busy: true })
  return promise
    .then(function (snapshot) {
      wbStore.set({ status: 'ready', error: null, busy: false, data: snapshot })
      if (okText) toast(okText, 'ok')
      return snapshot
    })
    .catch(function (e) {
      const message = String((e && e.message) || e)
      wbStore.set({ busy: false, error: message })
      toast(message, 'err')
      throw e
    })
}

const wbActions = {
  reload() {
    return settle(wbRpc('workbench/snapshot', {}))
  },
  saveSettings(patch) {
    return settle(wbRpc('workbench/saveSettings', { patch: patch }), '设置已保存')
  },
  createTask(input) {
    return settle(wbRpc('workbench/createTask', { input: input }), '待办已创建')
  },
  updateTask(id, patch) {
    return settle(wbRpc('workbench/updateTask', { id: id, patch: patch }))
  },
  deleteTask(id) {
    return settle(wbRpc('workbench/deleteTask', { id: id }), '待办已删除')
  },
  addSource(input) {
    return settle(wbRpc('workbench/addSource', { input: input }))
  },
  createKnowledge(input) {
    const before = (wbStore.get().data && wbStore.get().data.knowledge) || []
    return settle(wbRpc('workbench/createKnowledge', { input: input })).then(function (snapshot) {
      const after = (snapshot && snapshot.knowledge) || []
      if (after.length === before.length) WB.toast('这条已经收藏过了，未重复添加', 'info')
      else WB.toast('已收藏', 'ok')
      return snapshot
    })
  },
  updateKnowledge(id, patch) {
    return settle(wbRpc('workbench/updateKnowledge', { id: id, patch: patch }), '知识条目已更新')
  },
  deleteKnowledge(id) {
    return settle(wbRpc('workbench/deleteKnowledge', { id: id }), '已删除')
  },
  saveRadarItem(input) {
    return settle(wbRpc('workbench/saveRadarItem', { input: input }))
  },
  deleteRadarItem(id) {
    return settle(wbRpc('workbench/deleteRadarItem', { id: id }), '已移除')
  },
  recordRun(input) {
    return settle(wbRpc('workbench/recordRun', { input: input }), '已登记执行记录')
  },
  updateRun(id, patch) {
    return settle(wbRpc('workbench/updateRun', { id: id, patch: patch }))
  },
  reset(scope) {
    return settle(wbRpc('workbench/reset', { scope: scope || 'all' }), '数据已重置')
  },
  seedDemo() {
    return settle(wbRpc('workbench/seedDemo', {}), '已载入示例数据')
  },
  saveProject(input) {
    return settle(wbRpc('workbench/saveProject', { input: input }), '项目已保存')
  },
  deleteProject(id) {
    return settle(wbRpc('workbench/deleteProject', { id: id }), '项目已删除')
  },

  /** Pull @-mention messages through yzj-cli; report lands in data.lastMentionsFetch.
   *  Zero-parameter endpoint: the gateway strictly validates arg fields against
   *  the descriptor, so the payload must be exactly {}. */
  fetchMentions() {
    return settle(wbRpc('workbench/fetchMentions', {}), '@我 消息已拉取')
  },

  /** Fetch the configured RSS/Atom feeds; the report lands in data.lastRadarFetch.
   *  Zero-parameter endpoint — payload must be exactly {} (see fetchMentions). */
  fetchRadar() {
    return settle(wbRpc('workbench/fetchRadar', {}), '抓取完成')
  },

  /** Turn one radar item into a real task with its source evidence attached. */
  createTaskFromRadar(id) {
    return settle(wbRpc('workbench/createTaskFromRadar', { id: id }), '已生成实践任务')
  },

  addFeed(input) {
    const snapshot = wbStore.get().data
    const current = (snapshot && snapshot.settings && snapshot.settings.feeds) || []
    const url = String((input && input.url) || '').trim()
    if (!/^https?:\/\//i.test(url)) {
      WB.toast('资讯源地址必须是 http(s) URL', 'err')
      return Promise.reject(new Error('invalid feed url'))
    }
    const next = current
      .filter(function (feed) {
        return feed.url !== url
      })
      .concat([
        {
          id: WB.util.uid('feed'),
          label: String((input && input.label) || '').trim() || url.replace(/^https?:\/\//, '').slice(0, 60),
          url: url,
          topics: (input && input.topics) || [],
        },
      ])
      .slice(0, 12)
    return settle(wbRpc('workbench/saveSettings', { patch: { feeds: next } }), '资讯源已添加')
  },

  deleteFeed(id) {
    const snapshot = wbStore.get().data
    const current = (snapshot && snapshot.settings && snapshot.settings.feeds) || []
    const next = current.filter(function (feed) {
      return feed.id !== id
    })
    return settle(wbRpc('workbench/saveSettings', { patch: { feeds: next } }), '资讯源已移除')
  },

  /** 规则候选：为尚未提取的 @我 来源生成待确认候选（确定性，无模型）。 */
  extractCandidates() {
    return settle(wbRpc('workbench/extractCandidates', {}), '已生成待确认候选')
  },
  acceptCandidate(id, patch) {
    return settle(wbRpc('workbench/acceptCandidate', { id: id, patch: patch || {} }), '已采纳为待办')
  },
  rejectCandidate(id) {
    return settle(wbRpc('workbench/rejectCandidate', { id: id }), '已忽略该候选')
  },

  /** Unified search. Returns {query, at, total, groups[]} — NOT a snapshot. */
  search(query, options) {
    return wbRpc('workbench/search', {
      request: { query: query, includeWeb: !options || options.includeWeb !== false },
    })
  },

  /** Read-only engineering environment: git status per project + docker ps. */
  environment() {
    return wbRpc('workbench/environment', {})
  },

  /** GitHub 只读快照（PR / CI）。 */
  github() {
    return wbRpc('workbench/github', {})
  },

  /**
   * 自动同步：只比对业务修订号，变新才重取快照；正在编辑表单时跳过，
   * 避免后台刷新打断输入（TODO 08）。
   */
  syncCheck() {
    const store = wbStore.get()
    const current = store.data
    if (!current) return Promise.resolve(false)
    if (store.taskForm) return Promise.resolve(false)
    return wbRpc('workbench/revision', {})
      .then(function (info) {
        if (!info || Number(info.revision) <= Number(current.revision || 0)) return false
        return wbRpc('workbench/snapshot', {}).then(function (snapshot) {
          wbStore.set({ status: 'ready', data: snapshot, error: null })
          return true
        })
      })
      .catch(function () {
        return false
      })
  },

  /** 侧栏助手：向原生会话提交一次问答，返回 {status, reply, toolCalls, note}。 */
  assistantAsk(text, refs, sessionId) {
    return wbRpc('workbench/assistantAsk', {
      request: { text: text, refs: refs || [], sessionId: sessionId || null },
    })
  },
  /** 只提交提示，立即返回 {sessionId, fromSeq}；配合 assistantDelta 渐进渲染。 */
  assistantSend(text, refs, sessionId, steer) {
    return wbRpc('workbench/assistantSend', {
      request: { text: text, refs: refs || [], sessionId: sessionId || null, steer: steer === true },
    })
  },
  /** 增量读取：{entries, nextSeq, turnActive}。 */
  assistantDelta(sessionId, fromSeq) {
    return wbRpc('workbench/assistantDelta', {
      request: { sessionId: sessionId || null, fromSeq: fromSeq || 0 },
    })
  },
  /** 按消息 id 取助手回复正文（原生聊天内嵌动作）。 */
  assistantMessage(sessionId, messageId) {
    return wbRpc('workbench/assistantMessage', {
      request: { sessionId: sessionId || null, messageId: messageId || null },
    })
  },
  deleteSource(id) {
    return settle(wbRpc('workbench/deleteSource', { id: id }), '来源已删除')
  },
  deleteRun(id) {
    return settle(wbRpc('workbench/deleteRun', { id: id }), '执行记录已删除')
  },
  deleteCandidate(id) {
    return settle(wbRpc('workbench/deleteCandidate', { id: id }), '候选已删除')
  },
  assistantSessions(limit) {
    return wbRpc('workbench/assistantSessions', { request: { limit: limit || 12 } })
  },
  assistantTranscript(sessionId, limit) {
    return wbRpc('workbench/assistantTranscript', {
      request: { sessionId: sessionId || null, limit: limit || 40 },
    })
  },
  assistantHistory() {
    return wbRpc('workbench/assistantHistory', {})
  },
  assistantReset() {
    return wbRpc('workbench/assistantReset', {})
  },

  automationRun() {
    return wbRpc('workbench/automationRun', {})
  },
  automationStatus() {
    return wbRpc('workbench/automationStatus', {})
  },
  backup() {
    return wbRpc('workbench/backup', {})
  },
  backups() {
    return wbRpc('workbench/backups', {})
  },
  restoreBackup(id) {
    return settle(wbRpc('workbench/restoreBackup', { id: id }), '已从备份恢复')
  },
  diagnostics() {
    return wbRpc('workbench/diagnostics', {})
  },
}

/* ------------------------------------------------------------------- icons */
const WB_ICON_PATHS = {
  dashboard: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  tasks: ['M9 11l3 3 8-8', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  agent: ['M12 8V5H9', 'M5 8h14v12H5z', 'M9.5 13h.01', 'M14.5 13h.01', 'M9 17h6'],
  radar: ['M12 12l5-5', 'M12 3a9 9 0 1 1-9 9', 'M12 7a5 5 0 1 0 5 5', 'M12 12h.01'],
  toolbox: ['M3 8h18v11H3z', 'M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M3 13h18'],
  book: ['M12 6c-2-1.4-4.2-2-8-2v14c3.8 0 6 .6 8 2', 'M12 6c2-1.4 4.2-2 8-2v14c-3.8 0-6 .6-8 2', 'M12 6v14'],
  settings: ['M4 6h9', 'M17 6h3', 'M4 12h3', 'M11 12h9', 'M4 18h9', 'M17 18h3', 'M15 6h.01', 'M9 12h.01', 'M15 18h.01'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-4.2-4.2'],
  plus: ['M12 5v14', 'M5 12h14'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M20 6L9 17l-5-5'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronRight: ['M9 6l6 6-6 6'],
  refresh: ['M20.5 12a8.5 8.5 0 1 1-2.8-6.3', 'M21 3.5V9h-5.5'],
  external: ['M14 4h6v6', 'M20 4l-8.5 8.5', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  play: ['M8 5l11 7-11 7z'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  edit: ['M4 20h4L20 8l-4-4L4 16z'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7.5V12l3 2'],
  flag: ['M5 21V4h9l-1 3h6l-2 5 2 5h-6l1 3'],
  save: ['M5 3h11l3 3v15H5z', 'M8 3v6h8', 'M8 14h8v7H8z'],
  copy: ['M9 9h11v11H9z', 'M15 5H5v10'],
  sparkles: ['M12 3.5l1.7 4 4 1.7-4 1.7L12 15l-1.7-4.1-4-1.7 4-1.7z', 'M18.5 15l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z'],
  alert: ['M12 4l9 16H3z', 'M12 10v4', 'M12 17h.01'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5', 'M12 8h.01'],
  folder: ['M3 6h6l2 2h10v11H3z'],
  git: ['M7 4v10', 'M7 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M7 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M17 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M7 10a4 4 0 0 0 4 4h4'],
  docker: ['M4 11h13a4 4 0 0 1-4 4H9a5 5 0 0 1-5-4z', 'M7 8h2v2H7z', 'M10 8h2v2h-2z', 'M13 8h2v2h-2z'],
  link: ['M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7L11.4 6', 'M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.2-1.2'],
  filter: ['M3 5h18l-7 8.5V20l-4 1.5v-8z'],
  download: ['M12 3v12', 'M7 10.5l5 5 5-5', 'M4 20h16'],
  upload: ['M12 16V4', 'M7 8.5l5-5 5 5', 'M4 20h16'],
  command: ['M9 9h6v6H9z', 'M9 9V6.5A2.5 2.5 0 1 0 6.5 9H9', 'M15 9V6.5A2.5 2.5 0 1 1 17.5 9H15', 'M9 15v2.5A2.5 2.5 0 1 1 6.5 15H9', 'M15 15v2.5a2.5 2.5 0 1 0 2.5-2.5H15'],
  layers: ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5'],
  database: ['M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  eye: ['M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  more: ['M6 12h.01', 'M12 12h.01', 'M18 12h.01'],
  arrowRight: ['M4 12h15', 'M13 6l6 6-6 6'],
  xCircle: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M9 9l6 6', 'M15 9l-6 6'],
  checkCircle: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M8 12.5l2.5 2.5L16 9.5'],
  zap: ['M13 2L5 13h6l-1 9 8-11h-6z'],
  lock: ['M6 11h12v9H6z', 'M9 11V8a3 3 0 0 1 6 0v3'],
  plug: ['M9 3v6', 'M15 3v6', 'M7 9h10v3a5 5 0 0 1-10 0z', 'M12 17v4'],
}

WB.ICONS = Object.keys(WB_ICON_PATHS)

function Icon(props) {
  const name = props && props.name
  const paths = WB_ICON_PATHS[name] || WB_ICON_PATHS.info
  const size = (props && props.size) || 16
  const children = paths.map(function (d, index) {
    return h('path', { key: index, d: d })
  })
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: props && props.strokeWidth ? props.strokeWidth : 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
      style: { display: 'block', flex: 'none' },
    },
    children,
  )
}

/* --------------------------------------------------------------- primitives */
function Divider() {
  return h('hr', { className: 'wb-divider' })
}

function Spinner(props) {
  const size = (props && props.size) || 15
  return h('span', { className: 'wb-spin', style: { width: size, height: size } })
}

function Btn(props) {
  const kind = props.kind || 'ghost'
  const classes = ['wb-btn', 'wb-btn--' + kind]
  if (props.size === 'sm') classes.push('wb-btn--sm')
  if (props.className) classes.push(props.className)
  return h(
    'button',
    {
      type: 'button',
      className: classes.join(' '),
      onClick: props.onClick,
      disabled: props.disabled,
      title: props.title || (typeof props.children === 'string' ? props.children : undefined),
    },
    props.icon ? h(Icon, { name: props.icon, size: props.size === 'sm' ? 13 : 14 }) : null,
    typeof props.children === 'string' ? h('span', null, props.children) : props.children || null,
  )
}

function IconBtn(props) {
  return h(
    'button',
    {
      type: 'button',
      className: 'wb-iconbtn' + (props.active ? ' is-active' : ''),
      onClick: props.onClick,
      title: props.label,
      'aria-label': props.label,
      disabled: props.disabled,
    },
    h(Icon, { name: props.name, size: props.size || 15 }),
  )
}

function Badge(props) {
  return h('span', { className: 'wb-badge wb-badge--' + (props.tone || 'idle') }, props.children)
}

function Chip(props) {
  if (props.onClick) {
    return h(
      'button',
      {
        type: 'button',
        className: 'wb-chip' + (props.active ? ' is-active' : ''),
        onClick: props.onClick,
        title: props.title,
      },
      props.icon ? h(Icon, { name: props.icon, size: 12 }) : null,
      props.children,
      props.onRemove
        ? h(
            'span',
            {
              className: 'wb-chip-x',
              role: 'button',
              tabIndex: 0,
              onClick: function (event) {
                event.stopPropagation()
                props.onRemove()
              },
            },
            h(Icon, { name: 'close', size: 10 }),
          )
        : null,
    )
  }
  return h(
    'span',
    { className: 'wb-chip wb-chip--static' + (props.active ? ' is-active' : ''), title: props.title },
    props.icon ? h(Icon, { name: props.icon, size: 12 }) : null,
    props.children,
  )
}

function Panel(props) {
  const bodyClass = 'wb-card-body' + (props.flush ? ' wb-card-body--flush' : '')
  const head =
    props.title || props.sub || props.actions
      ? h(
          'div',
          { className: 'wb-card-head' },
          props.icon ? h('span', { className: 'wb-card-icon' }, h(Icon, { name: props.icon, size: 15 })) : null,
          h(
            'div',
            { className: 'wb-card-titles' },
            props.title
              ? h(
                  'h3',
                  { className: 'wb-card-title' },
                  props.title,
                  props.badge || null,
                )
              : null,
            props.sub ? h('p', { className: 'wb-card-sub' }, props.sub) : null,
          ),
          props.actions ? h('div', { className: 'wb-card-actions' }, props.actions) : null,
        )
      : null
  return h(
    'section',
    {
      className: 'wb-card' + (props.className ? ' ' + props.className : ''),
      style: props.style,
    },
    head,
    h('div', { className: bodyClass, style: props.bodyStyle }, props.children),
  )
}

function PageHead(props) {
  return h(
    'header',
    { className: 'wb-page-head' },
    props.icon ? h('div', { className: 'wb-ph-icon' }, h(Icon, { name: props.icon, size: 18 })) : null,
    h(
      'div',
      { style: { minWidth: 0 } },
      h('h1', null, props.title),
      props.sub ? h('p', null, props.sub) : null,
    ),
    props.actions ? h('div', { className: 'wb-ph-actions' }, props.actions) : null,
  )
}

function Stat(props) {
  const tag = props.onClick ? 'button' : 'div'
  return h(
    tag,
    {
      className: 'wb-stat',
      onClick: props.onClick,
      type: props.onClick ? 'button' : undefined,
      style: props.style,
    },
    h(
      'div',
      { className: 'wb-stat-top' },
      props.icon ? h(Icon, { name: props.icon, size: 13 }) : null,
      h('span', null, props.label),
    ),
    h(
      'div',
      {
        className: 'wb-stat-value',
        style: props.tone ? { color: props.tone === 'ok' ? T.ok : props.tone === 'warn' ? T.warn : props.tone === 'err' ? T.err : props.tone === 'accent' ? T.accent : undefined } : undefined,
      },
      props.value,
    ),
    props.sub ? h('div', { className: 'wb-stat-sub' }, props.sub) : null,
  )
}

function Field(props) {
  return h(
    'label',
    { className: 'wb-field', style: props.style },
    props.label ? h('span', { className: 'wb-label' }, props.label) : null,
    props.children,
    props.hint ? h('span', { className: 'wb-hint' }, props.hint) : null,
  )
}

function Input(props) {
  const clean = Object.assign({}, props)
  delete clean.invalid
  return h('input', Object.assign({ className: 'wb-input' + (props.className ? ' ' + props.className : '') }, clean))
}

function Textarea(props) {
  return h('textarea', Object.assign({ className: 'wb-textarea' }, props))
}

function Select(props) {
  const children = (props.options || []).map(function (option) {
    return h('option', { key: option.value, value: option.value }, option.label)
  })
  return h(
    'span',
    { className: 'wb-select-wrap' },
    h(
      'select',
      {
        className: 'wb-select',
        value: props.value,
        onChange: props.onChange,
        disabled: props.disabled,
        title: props.title,
      },
      children,
    ),
  )
}

function Toggle(props) {
  return h(
    'div',
    { className: 'wb-row', style: { gap: 8, cursor: props.disabled ? 'not-allowed' : 'pointer' } },
    h(
      'span',
      {
        className: 'wb-switch' + (props.checked ? ' is-on' : ''),
        role: 'switch',
        tabIndex: props.disabled ? -1 : 0,
        'aria-checked': props.checked ? 'true' : 'false',
        onClick: function () {
          if (!props.disabled) props.onChange(!props.checked)
        },
        onKeyDown: function (event) {
          if (props.disabled) return
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault()
            props.onChange(!props.checked)
          }
        },
      },
      h('i', null),
    ),
    props.label ? h('span', { className: 'wb-tiny' }, props.label) : null,
  )
}

function Segmented(props) {
  return h(
    'div',
    { className: 'wb-tabs' },
    (props.items || []).map(function (item) {
      return h(
        'button',
        {
          key: item.value,
          type: 'button',
          className: 'wb-tab' + (props.value === item.value ? ' is-active' : ''),
          onClick: function () {
            props.onChange(item.value)
          },
        },
        item.label,
      )
    }),
  )
}

function Tabs(props) {
  return h(
    'div',
    { className: 'wb-tabs', style: props.style },
    (props.items || []).map(function (item) {
      return h(
        'button',
        {
          key: item.value,
          type: 'button',
          className: 'wb-tab' + (props.value === item.value ? ' is-active' : ''),
          onClick: function () {
            props.onChange(item.value)
          },
        },
        item.label,
        item.count === undefined || item.count === null
          ? null
          : h('span', { className: 'wb-tab-count' }, String(item.count)),
      )
    }),
  )
}

function Empty(props) {
  return h(
    'div',
    { className: 'wb-empty' + (props.className ? ' ' + props.className : ''), style: props.style },
    h('div', { className: 'wb-empty-icon' }, h(Icon, { name: props.icon || 'layers', size: 18 })),
    h('strong', null, props.title || '暂无内容'),
    props.hint ? h('p', null, props.hint) : null,
    props.action || null,
  )
}

function Progress(props) {
  const max = props.max || 100
  const value = Math.max(0, Math.min(max, props.value || 0))
  return h(
    'div',
    { className: 'wb-progress' },
    h('i', { style: { width: (value / max) * 100 + '%' } }),
  )
}

function Kbd(props) {
  return h('kbd', { className: 'wb-kbd' }, props.children)
}

function Modal(props) {
  React.useEffect(
    function () {
      if (!props.open) return undefined
      function onKey(event) {
        if (event.key === 'Escape') {
          event.stopPropagation()
          props.onClose()
        }
      }
      window.addEventListener('keydown', onKey, true)
      return function () {
        window.removeEventListener('keydown', onKey, true)
      }
    },
    [props.open, props.onClose],
  )
  if (!props.open) return null
  return h(
    'div',
    {
      className: 'wb-modal-mask',
      onMouseDown: function (event) {
        if (event.target === event.currentTarget) props.onClose()
      },
    },
    h(
      'div',
      {
        className: 'wb-modal',
        role: 'dialog',
        'aria-modal': 'true',
        style: props.width ? { width: 'min(' + props.width + 'px, 100%)' } : undefined,
      },
      h(
        'div',
        { className: 'wb-modal-head' },
        h(
          'div',
          { style: { flex: '1 1 auto', minWidth: 0 } },
          props.title ? h('h2', null, props.title) : null,
          props.sub ? h('strong', null, props.sub) : null,
        ),
        h(IconBtn, { name: 'close', label: '关闭', onClick: props.onClose }),
      ),
      h('div', { className: 'wb-modal-body' }, props.children),
      props.footer ? h('div', { className: 'wb-modal-foot' }, props.footer) : null,
    ),
  )
}

/* ------------------------------------------------------------------- format */
function parseDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function pad2(value) {
  return value < 10 ? '0' + value : String(value)
}

const fmt = {
  date(value) {
    const date = parseDate(value)
    if (!date) return '—'
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
  },
  day(value) {
    const date = parseDate(value)
    if (!date) return '—'
    return pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
  },
  time(value) {
    const date = parseDate(value)
    if (!date) return '—'
    return pad2(date.getHours()) + ':' + pad2(date.getMinutes())
  },
  datetime(value) {
    const date = parseDate(value)
    if (!date) return '—'
    return fmt.date(value) + ' ' + fmt.time(value)
  },
  relative(value, now) {
    const date = parseDate(value)
    if (!date) return '—'
    const base = now || Date.now()
    const diff = Math.round((base - date.getTime()) / 1000)
    if (diff < 45) return '刚刚'
    if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + ' 分钟前'
    if (diff < 86400) return Math.round(diff / 3600) + ' 小时前'
    if (diff < 86400 * 30) return Math.round(diff / 86400) + ' 天前'
    return fmt.date(value)
  },
  due(value, now) {
    if (!value) return { text: '无截止', tone: 'idle', overdue: false }
    const date = parseDate(value)
    if (!date) return { text: '无截止', tone: 'idle', overdue: false }
    const base = now || Date.now()
    const diff = date.getTime() - base
    const abs = Math.abs(diff)
    const overdue = diff < 0
    let text
    if (abs < 3600 * 1000) text = overdue ? '刚刚到期' : Math.round(diff / 60000) + ' 分钟后'
    else if (abs < 86400 * 1000) text = (overdue ? '逾期 ' : '') + Math.round(abs / 3600000) + ' 小时' + (overdue ? '' : '后')
    else text = (overdue ? '逾期 ' : '') + Math.round(abs / 86400000) + ' 天' + (overdue ? '' : '后')
    return { text: text, tone: overdue ? 'err' : abs < 86400000 ? 'warn' : 'idle', overdue: overdue }
  },
  num(value) {
    const number = Number(value || 0)
    if (Math.abs(number) >= 10000) return (number / 1000).toFixed(1) + 'k'
    return String(number)
  },
  /** ISO → value for <input type="datetime-local"> in local time. */
  toLocalInput(value) {
    const date = parseDate(value)
    if (!date) return ''
    return (
      date.getFullYear() +
      '-' +
      pad2(date.getMonth() + 1) +
      '-' +
      pad2(date.getDate()) +
      'T' +
      pad2(date.getHours()) +
      ':' +
      pad2(date.getMinutes())
    )
  },
  /** <input type="datetime-local"> value → ISO, or null. */
  fromLocalInput(value) {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  },
  bytes(value) {
    const size = Number(value || 0)
    if (size < 1024) return size + ' B'
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
    return (size / 1024 / 1024).toFixed(1) + ' MB'
  },
}

/* -------------------------------------------------------------------- utils */
const util = {
  uid(prefix) {
    const random = Math.random().toString(36).slice(2, 8)
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + random
  },
  truncate(text, max) {
    const value = String(text === undefined || text === null ? '' : text)
    return value.length > max ? value.slice(0, max - 1) + '…' : value
  },
  debounce(fn, wait) {
    let timer = null
    return function () {
      const args = arguments
      const self = this
      if (timer) clearTimeout(timer)
      timer = setTimeout(function () {
        timer = null
        fn.apply(self, args)
      }, wait || 200)
    }
  },
  groupBy(list, keyFn) {
    const out = {}
    ;(list || []).forEach(function (item) {
      const key = keyFn(item)
      if (!out[key]) out[key] = []
      out[key].push(item)
    })
    return out
  },
  sortBy(list, keyFn, desc) {
    return (list || []).slice().sort(function (a, b) {
      const av = keyFn(a)
      const bv = keyFn(b)
      if (av === bv) return 0
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      return (av < bv ? -1 : 1) * (desc ? -1 : 1)
    })
  },
  copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        return Promise.reject(new Error('复制失败'))
      })
    }
    return Promise.reject(new Error('当前环境不支持剪贴板'))
  },
  nowIso() {
    return new Date().toISOString()
  },
}

/* --------------------------------------------------------- task presentation */
/** Open the shared task form for an existing task (or null to create one). */
WB.openTaskForm = function (task, defaults) {
  wbStore.set({ taskForm: { open: true, task: task || null, defaults: defaults || null } })
}

/** Jump to the task center with one task selected. */
WB.focusTask = function (id) {
  wbStore.set({ page: 'tasks', focusTaskId: id })
}

WB.TASK_STATUS = {
  draft: { label: '草稿', tone: 'idle', order: 0 },
  ready: { label: '待处理', tone: 'accent', order: 1 },
  running: { label: '执行中', tone: 'warn', order: 2 },
  waiting_approval: { label: '待审批', tone: 'warn', order: 3 },
  completed: { label: '已完成', tone: 'ok', order: 4 },
  failed: { label: '失败', tone: 'err', order: 5 },
  cancelled: { label: '已取消', tone: 'idle', order: 6 },
}
WB.TASK_PRIORITY = {
  urgent: { label: '紧急', tone: 'err', rank: 4 },
  high: { label: '高', tone: 'warn', rank: 3 },
  normal: { label: '普通', tone: 'idle', rank: 2 },
  low: { label: '低', tone: 'idle', rank: 1 },
}
WB.RUN_STATUS = {
  queued: { label: '排队中', tone: 'idle' },
  running: { label: '运行中', tone: 'warn' },
  waiting_approval: { label: '待审批', tone: 'warn' },
  completed: { label: '已完成', tone: 'ok' },
  failed: { label: '失败', tone: 'err' },
  cancelled: { label: '已取消', tone: 'idle' },
}
/** Unknown auth states must never render as "connected". */
WB.connectorState = function (authState) {
  if (WB.CONNECTOR_STATE[authState]) return WB.CONNECTOR_STATE[authState]
  return { label: String(authState || '未知'), tone: 'idle', unknown: true }
}

WB.CONNECTOR_STATE = {
  ok: { label: '已连接', tone: 'ok' },
  unconfigured: { label: '未配置', tone: 'idle' },
  error: { label: '异常', tone: 'err' },
  unauthorized: { label: '待授权', tone: 'warn' },
}

WB.openTasks = function (data) {
  if (!data || !Array.isArray(data.tasks)) return []
  return data.tasks.filter(function (task) {
    return task.status !== 'completed' && task.status !== 'cancelled'
  })
}

WB.dueSoon = function (data, hours) {
  const horizon = Date.now() + (hours || 48) * 3600 * 1000
  return WB.openTasks(data).filter(function (task) {
    const due = task.dueAt ? new Date(task.dueAt).getTime() : null
    return due !== null && !Number.isNaN(due) && due <= horizon
  })
}

WB.taskCounts = function (data) {
  const counts = { total: 0, open: 0, overdue: 0, today: 0, completed: 0, running: 0 }
  const tasks = (data && data.tasks) || []
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)
  tasks.forEach(function (task) {
    counts.total += 1
    if (task.status === 'completed') counts.completed += 1
    else if (task.status === 'cancelled') {
      /* not counted as open */
    } else counts.open += 1
    if (task.status === 'running' || task.status === 'waiting_approval') counts.running += 1
    if (task.dueAt && task.status !== 'completed' && task.status !== 'cancelled') {
      const due = new Date(task.dueAt).getTime()
      if (!Number.isNaN(due)) {
        if (due < Date.now()) counts.overdue += 1
        else if (due <= endOfDay.getTime()) counts.today += 1
      }
    }
  })
  return counts
}

/* ------------------------------------------------------------------- export */
WB.actions = wbActions
WB.store = wbStore
WB.useStore = useStore
WB.useWorkbench = function () {
  return useStore()
}
WB.toast = toast
WB.assistant = assistant
WB.assistantBrief = assistantBrief
WB.pickDirectory = pickDirectory
WB.setUiWorkspace = function (value) {
  wbUiWorkspace = value || null
}
WB.setLayout = function (value) {
  wbLayout = value || null
}
/** 在主面板打开指定原生会话（助手侧栏「打开完整会话」）。 */
WB.openSessionById = function (sessionId) {
  if (!sessionId) return false
  const workspace = wbUiWorkspace
  if (workspace && typeof workspace.openSession === 'function') {
    try {
      workspace.openSession(sessionId)
      return true
    } catch (e) {
      /* 落到下面的会话面板切换 */
    }
  }
  if (wbLayout && typeof wbLayout.selectPanel === 'function') {
    try {
      // 会话面板的 main key 是 'conversation'
      wbLayout.selectPanel('conversation')
      return true
    } catch (e) {
      return false
    }
  }
  return false
}

/** 回到原生会话面板（助手把上下文复制到剪贴板后调用）。 */
WB.openConversation = function () {
  if (!wbLayout || typeof wbLayout.selectPanel !== 'function') return false
  try {
    wbLayout.selectPanel(null)
    return true
  } catch (e) {
    return false
  }
}
WB.rpc = wbRpc
WB.fmt = fmt
WB.util = util
WB.Icon = Icon
WB.ui = {
  Panel: Panel,
  PageHead: PageHead,
  Stat: Stat,
  Btn: Btn,
  IconBtn: IconBtn,
  Badge: Badge,
  Chip: Chip,
  Field: Field,
  Input: Input,
  Textarea: Textarea,
  Select: Select,
  Toggle: Toggle,
  Segmented: Segmented,
  Tabs: Tabs,
  Empty: Empty,
  Spinner: Spinner,
  Progress: Progress,
  Kbd: Kbd,
  Modal: Modal,
  Divider: Divider,
}
WB.cn = function () {
  return Array.prototype.slice.call(arguments).filter(Boolean).join(' ')
}
