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
.wb-root .wb-panel--separated > .wb-card-head {
  padding: 14px 16px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #20242b) 7%, var(--dsw-alias-bg-layer-1, #fff));
  border-bottom: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary, #20242b) 18%, var(--dsw-alias-bg-layer-1, #fff));
}
.wb-panel--separated > .wb-card-head .wb-card-title { font-size: 14px; }
.wb-panel--separated > .wb-card-head .wb-card-sub { margin-top: 4px; }
.wb-panel--separated > .wb-card-body { padding-top: 12px; }
.wb-inbox-filters {
  display: flex; align-items: center; flex-wrap: wrap; gap: 12px;
  padding: 14px 16px; margin-bottom: 18px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #20242b) 3%, var(--dsw-alias-bg-base, #fff));
}
.wb-inbox-search { position: relative; flex: 1 1 260px; min-width: 0; max-width: 520px; }
.wb-inbox-search > svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--dsw-alias-label-secondary); pointer-events: none; }
.wb-inbox-search > .wb-input { padding-left: 34px; }
.wb-inbox-filter { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.wb-inbox-filter > .wb-select-wrap { width: 130px; }
.wb-inbox-count { margin-left: auto; font-size: 12px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.wb-inbox > .wb-reply-list { gap: 14px; }
.wb-inbox .wb-inbox-card {
  min-width: 0; padding: 0; overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary, #20242b) 14%, var(--dsw-alias-bg-base, #fff));
  border-radius: 12px; background: var(--dsw-alias-bg-base);
}
.wb-inbox-card-head { padding: 14px 18px 12px; background: color-mix(in srgb, var(--dsw-alias-label-primary, #20242b) 5%, var(--dsw-alias-bg-base, #fff)); border-bottom: 1px solid var(--dsw-alias-border-l1); }
.wb-inbox-card-head strong { min-width: 0; font-size: 14px; overflow-wrap: anywhere; }
.wb-inbox-meta { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 7px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.wb-inbox-meta > span { min-width: 0; overflow-wrap: anywhere; }
.wb-inbox-message { margin: 0; padding: 16px 18px; font-size: 13px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.wb-inbox-footer { padding: 12px 18px; border-top: 1px solid var(--dsw-alias-border-l1); }
.wb-reply-draft-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; }
.wb-inbox-stage-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.wb-inbox-stage-actions > span { margin-right: 2px; }
.wb-reply-editor { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1); }
.wb-reply-editor > p { margin: 0; }
.wb-reply-editor > textarea { min-height: 100px; resize: vertical; }
.wb-inbox-evidence { margin-top: 12px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.wb-inbox-evidence > summary { width: fit-content; cursor: pointer; }
.wb-inbox-evidence > summary:hover { color: var(--dsw-alias-label-primary); }
.wb-inbox-evidence > p { white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px 12px; border-radius: 8px; background: color-mix(in srgb, var(--dsw-alias-label-primary, #20242b) 4%, var(--dsw-alias-bg-base, #fff)); }
.wb-inbox-card .wb-btn { max-width: 100%; height: auto; min-height: 26px; white-space: normal; overflow-wrap: anywhere; text-align: left; }
.wb-inbox-card .wb-btn > span { min-width: 0; }
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

.wb-context-option { display:block; width:100%; padding:8px; border:0; border-radius:6px; background:transparent; color:var(--dsw-alias-label-primary); font:inherit; text-align:left; cursor:pointer; }
.wb-context-option:hover, .wb-context-option[aria-pressed=true] { background:var(--dsw-alias-bg-layer-2); }
.wb-context-option:disabled { opacity:.5; cursor:default; }
.wb-assistant-suggest {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11.5px;
  line-height: 1.5;
  text-align: left;
  cursor: pointer;
  transition: border-color .12s ease, color .12s ease;
}
.wb-assistant-suggest:hover { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary); }
.wb-assistant-suggest span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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
.wb-split > .wb-col-span-2 { grid-column: 1 / -1; }
@media (max-width: 1080px) {
  .wb-nav { width: 176px; flex-basis: 176px; }
  .wb-split { grid-template-columns: minmax(0, 1fr) !important; }
  .wb-page { padding: 16px 14px 32px; }
}
@media (max-width: 860px) {
  .wb-nav { display: none; }
}
`;

export {WB_CSS}
