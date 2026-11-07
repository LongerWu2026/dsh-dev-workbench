export const TOOLBOX_CSS = `
.wb-tools-page { container-type:inline-size; container-name:tools; }
.wb-tool-picker { position:relative; }
.wb-tool-trigger { min-height:32px; }
.wb-tool-menu { position:absolute; top:100%; left:0; padding-top:8px; width:min(540px,calc(100vw - 40px)); z-index:45; }
.wb-tool-menu[hidden] { display:none; }
.wb-tool-menu > .wb-card { background:var(--dsw-alias-bg-base); box-shadow:var(--wb-dialog-shadow); max-height:min(65vh,640px); overflow:auto; }
.wb-tool-menu .wb-toolgrid { grid-template-columns:repeat(2,minmax(0,1fr))!important; max-height:none; }
.wb-tool-menu .wb-tool { border-radius:8px; padding:9px 10px; }
.wb-tool-menu .wb-tool span { overflow-wrap:anywhere; }
.wb-toolbox-layout { display:block; min-width:0; }
.wb-tool-surface { min-height:480px; }
.wb-tool-surface > .wb-card-body { min-width:0; }
.wb-tool-pane { min-width:0; }
.wb-tool-pane .wb-code { white-space:pre-wrap; overflow-wrap:anywhere; max-height:540px; overflow:auto; }
.wb-tool-pane .wb-table { color:var(--dsw-alias-label-primary); }
.wb-data-workspace input[type=checkbox] { accent-color:var(--wb-accent); }
.wb-tool-pane textarea { resize:vertical; }
.wb-tool-pane[data-tool=timestamp],.wb-tool-pane[data-tool=cron],.wb-tool-pane[data-tool=jwt] { max-width:1100px; margin-inline:auto; }
.wb-tool-pane[data-tool=status] table th,.wb-tool-pane[data-tool=status] table td { vertical-align:top; }
.wb-tool-surface--data > .wb-card-body { padding:0; }
.wb-tool-surface--data { overflow:visible; }
 .wb-data-surface { position:relative;min-width:0; }
.wb-data-toolbar { display:flex;align-items:center;gap:10px;min-height:48px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1); }
.wb-data-toolbar .wb-tool-trigger { min-height:28px;height:28px;font-size:12px; }
.wb-data-toolbar .wb-tool-picker { flex:none; }
.wb-data-toolbar-connection { flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--dsw-alias-label-secondary); }
.wb-data-layout-actions { display:flex;align-items:center;gap:4px;flex:none; }
.wb-data-layout-actions .wb-iconbtn,.wb-data-sidebar-head .wb-iconbtn { width:28px;height:28px; }
.wb-data-connection-state { display:flex;align-items:center;gap:5px;white-space:nowrap;color:var(--dsw-alias-label-secondary); }
.wb-data-connection-state::before { content:'';width:5px;height:5px;border-radius:50%;background:currentColor; }
.wb-data-connection-state.is-connected { color:var(--dsw-alias-state-success-primary,#198754); }
.wb-data-more { position:relative; }
.wb-data-more>summary { list-style:none; }
.wb-data-more>summary::-webkit-details-marker { display:none; }
.wb-data-menu { position:absolute;top:calc(100% + 6px);right:0;z-index:45;display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:6px;min-width:160px;max-width:calc(100vw - 48px);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);box-shadow:var(--wb-dialog-shadow); }
.wb-data-menu>.wb-btn { justify-content:flex-start; }
.wb-data-workspace { display:grid;grid-template-columns:var(--data-connections-width,0px) minmax(0,1fr);height:var(--data-workspace-height,600px);min-height:0; }
.wb-data-workspace.is-connections-open { --data-connections-width:210px; }
.wb-data-workspace.is-ai-open { grid-template-columns:var(--data-connections-width,0px) minmax(0,1.08fr) minmax(0,1fr); }
.wb-data-workspace.is-ai-open:not(.is-compact)>.wb-data-main { grid-column:3;border-left:1px solid var(--dsw-alias-border-l1); }
.wb-data-workspace.is-compact { grid-template-columns:var(--data-connections-width,0px) minmax(0,1fr); }
.wb-data-main[hidden] { display:none; }
.wb-data-mobile-views { display:flex;align-items:center;gap:8px;min-height:40px;padding:4px 12px;border-bottom:1px solid var(--dsw-alias-border-l1); }
.wb-data-mobile-views>button { border:0;border-radius:6px;padding:6px 12px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer; }
.wb-data-mobile-views>button[aria-selected=true] { background:var(--wb-selected-bg);color:var(--dsw-alias-label-primary);font-weight:600; }
.wb-data-sidebar { grid-column:1;display:flex;flex-direction:column;gap:12px;padding:10px;min-width:0;max-height:800px;overflow:auto;border-right:1px solid var(--dsw-alias-border-l1);background:var(--wb-hover-bg); }
.wb-data-sidebar-head,.wb-data-query-head { display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
.wb-data-sidebar-head { justify-content:space-between; }
.wb-data-sidebar-head strong { font-size:12px; }
.wb-data-sidebar-tabs { display:flex;align-items:center;gap:4px;flex:1; }
.wb-data-sidebar-tabs>button { padding:5px 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer; }
.wb-data-sidebar-tabs>button[aria-selected=true] { color:var(--dsw-alias-label-primary);background:var(--wb-selected-bg);font-weight:600; }
.wb-data-sidebar-tabs>button:focus-visible { outline:2px solid var(--wb-accent); }
.wb-data-connections { display:grid;grid-template-columns:minmax(0,1fr);gap:4px;list-style:none;padding:0;margin:0;max-height:640px;overflow:auto; }
.wb-data-connection { display:flex;align-items:center;gap:8px;width:100%;padding:8px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;text-align:left;cursor:pointer; }
.wb-data-connection>svg { flex:none; }
.wb-data-connection>span { min-width:0;flex:1; }
.wb-data-connection strong,.wb-data-connection small { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.wb-data-connection small { margin-top:3px;font-size:11px; }
.wb-data-connection:hover:not(:disabled) { background:var(--wb-hover-bg); }
.wb-data-connection[aria-pressed=true] { background:var(--wb-selected-bg);border-color:var(--dsw-alias-border-l1); }
.wb-data-connection:focus-visible { outline:2px solid var(--wb-accent);outline-offset:-2px; }
.wb-data-connection:disabled { cursor:default; }
.wb-data-catalog { min-width:0; }
.wb-data-object-list { max-height:360px; }
.wb-data-object-list label>span { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.wb-data-used-objects { display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere; }
.wb-data-draft-info { font-size:11px;color:var(--dsw-alias-label-secondary); }
.wb-data-draft-info>summary { cursor:pointer; }
.wb-data-main { grid-column:2;display:flex;flex-direction:column;gap:10px;min-width:0;min-height:0;overflow:auto;overflow-anchor:none;overscroll-behavior:contain;padding:12px; }
.wb-data-query-head { position:sticky;top:0;z-index:2;min-height:48px;flex:none;margin:-12px -12px 0;padding:8px 12px;background:var(--dsw-alias-bg-base);border-bottom:1px solid var(--dsw-alias-border-l1); }
.wb-data-query-head>strong { min-width:0;font-size:13px; }
.wb-data-query-head>.wb-row { margin-left:auto;gap:6px!important; }
.wb-data-query-head .wb-btn { height:28px;font-size:12px; }
.wb-data-readonly { padding:2px 5px;border-radius:4px;background:var(--wb-hover-bg); }
.wb-data-editor { min-width:0;flex:none; }
.wb-data-main textarea[aria-label="数据查询编辑器"] { display:block;width:100%;min-height:140px!important;max-height:420px;resize:none;font-size:13px;line-height:1.7;tab-size:2; }
.wb-data-editor-splitter { display:flex;align-items:center;justify-content:center;height:12px;margin:-6px 0;cursor:row-resize;touch-action:none;flex:none; }
.wb-data-editor-splitter>span { width:36px;height:3px;border-radius:2px;background:var(--dsw-alias-border-l1); }
.wb-data-editor-splitter:hover>span { background:var(--dsw-alias-border-l2); }
.wb-data-editor-splitter:focus-visible { outline:2px solid var(--wb-accent);outline-offset:1px; }
.wb-data-main .wb-table th { position:sticky;top:0;background:var(--dsw-alias-bg-base);z-index:1; }
.wb-data-table-scroll { overflow:auto;max-width:100%; }
.wb-data-empty { display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;min-height:56px;padding:10px;color:var(--dsw-alias-label-secondary);font-size:12px;border:1px dashed var(--dsw-alias-border-l1);border-radius:8px; }
.wb-data-ai { grid-column:2;display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;background:var(--dsw-alias-bg-base); }
.wb-data-ai-header { display:flex;align-items:center;gap:8px;min-height:48px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:13px; }
.wb-data-ai-header>strong { flex:1; }
.wb-data-ai-context { overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px;padding:3px 6px;border-radius:5px;font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--wb-hover-bg); }
.wb-data-ai-header>.wb-iconbtn { margin-left:auto;width:28px;height:28px; }
.wb-data-ai-icon { display:grid;place-items:center;width:26px;height:26px;border-radius:8px;color:var(--wb-accent);background:color-mix(in srgb,var(--wb-accent) 10%,var(--dsw-alias-bg-base)); }
.wb-data-ai-log { display:flex;flex-direction:column;gap:12px;min-width:0;flex:1;min-height:0;height:auto;padding:12px;overflow:auto;overscroll-behavior:contain;font-size:12px; }
.wb-data-ai-empty { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;flex:1;min-height:min-content;text-align:center;padding:12px; }
.wb-data-ai-empty>strong { font-size:19px;line-height:1.5; }
.wb-data-ai-hero-icon { display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:var(--wb-selected-bg); }
.wb-data-ai-starters { display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:8px;width:100%;margin-top:6px; }
.wb-data-ai-starters>button { display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;text-align:left;cursor:pointer; }
.wb-data-ai-starters>button:hover { color:var(--dsw-alias-label-primary);background:var(--wb-hover-bg); }
.wb-data-ai-starters>button>svg { flex:none; }
.wb-data-ai-empty svg { color:var(--wb-accent); }
.wb-data-ai-log p,.wb-data-ai-composer p { margin:0;white-space:pre-wrap;overflow-wrap:anywhere; }
.wb-data-ai-turn,.wb-data-ai-answer,.wb-data-ai-composer { display:flex;flex-direction:column;gap:8px;min-width:0; }
.wb-data-ai-turn { flex:none; }
.wb-data-ai-question { align-self:flex-end;max-width:90%;padding:7px 9px;border-radius:10px 10px 3px 10px;background:color-mix(in srgb,var(--wb-accent) 10%,var(--dsw-alias-bg-base)); }
.wb-data-ai-answer { border:1px solid var(--dsw-alias-border-l1);border-radius:10px 10px 10px 3px;padding:9px;background:var(--dsw-alias-bg-base); }
.wb-data-ai-answer pre { max-height:180px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere; }
.wb-data-ai-error { color:var(--dsw-alias-state-error-primary); }
.wb-data-ai-composer { flex:none;padding:10px 12px 12px;border-top:1px solid var(--dsw-alias-border-l1); }
.wb-data-ai-input { min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base); }
.wb-data-ai-input:focus-within { border-color:var(--wb-accent); }
.wb-data-ai-composer textarea[aria-label="数据库AI需求"] { min-height:88px!important;max-height:160px;border:0;box-shadow:none;background:transparent;resize:vertical; }
.wb-data-ai-controls { display:flex;align-items:center;justify-content:space-between;gap:6px;padding:4px 6px 6px; }
.wb-data-ai-controls > .wb-select { width:auto;min-width:0;max-width:calc(100% - 60px);font-size:11px; }
.wb-data-ai-controls > .wb-btn { flex:none; }

.wb-data-structure { border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px; }
.wb-data-ai summary,.wb-data-structure summary { cursor:pointer;font-size:12px; }
.wb-data-structure h4 { margin:12px 0 8px;overflow-wrap:anywhere; }
.wb-data-memory { display:flex;align-items:center;gap:8px;padding:5px 12px;min-height:26px;min-width:0;border-top:1px solid var(--dsw-alias-border-l1); }
.wb-data-memory>span { flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px; }
.wb-data-memory>.wb-data-note { flex:0 1 auto;max-width:50%; }
.wb-data-memory.has-error { flex-wrap:wrap; }
.wb-data-memory.has-error>span { white-space:normal;overflow-wrap:anywhere;color:var(--dsw-alias-state-error-primary); }
.wb-data-drawer-mask { position:fixed;inset:0;z-index:55;display:flex;align-items:stretch;padding:12px;background:#0003; }
.wb-data-drawer { display:flex;width:min(360px,100%);max-width:100%;min-height:0;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base);box-shadow:var(--wb-dialog-shadow); }
.wb-data-drawer.is-left { margin-right:auto; }
.wb-data-drawer.is-right { margin-left:auto; }
.wb-data-drawer>.wb-data-sidebar,.wb-data-drawer>.wb-data-ai { flex:1;min-width:0;width:100%;max-height:100%;border:0; }
.wb-data-drawer>.wb-data-ai { height:100%;position:static;align-self:stretch; }
.wb-data-results { flex:none;display:flex;flex-direction:column;gap:8px;min-width:0;max-width:100%; }
.wb-data-results > p { margin:0;overflow-wrap:anywhere; }
.wb-data-result-head { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px; }
.wb-data-result-viewport { box-sizing:border-box;height:360px;min-height:360px;max-height:360px;width:100%;min-width:0;overflow:auto;overscroll-behavior:contain;border:1px solid var(--dsw-alias-border-l1);border-radius:8px; }
.wb-data-result-viewport:focus-visible { outline:2px solid var(--wb-accent);outline-offset:2px; }
.wb-data-main .wb-data-result-table { width:max-content;min-width:100%;table-layout:auto;border-collapse:separate;border-spacing:0; }
.wb-data-result-table th,.wb-data-result-table td { min-width:110px;max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.wb-data-result-placeholder { display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;min-height:100%;margin:0;padding:16px;color:var(--dsw-alias-label-secondary);font-size:12px; }
.wb-tool-pane .wb-data-result-json { min-height:100%;max-height:none;margin:0;white-space:pre;overflow-wrap:normal;overflow:visible; }
.wb-data-pagination { display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;min-width:0; }
.wb-data-pagination label { display:flex;align-items:center;gap:6px; }
.wb-data-pagination .wb-select { width:auto;min-width:0; }
.wb-data-pagination > .wb-row { margin-left:auto;gap:6px;flex-wrap:wrap; }
.wb-network-workspace { display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px; }
.wb-network-request,.wb-network-response { min-width:0; }
.wb-network-response { padding-left:20px;border-left:1px solid var(--dsw-alias-border-l1); }
.wb-network-response > strong { font-size:12px; }
.wb-network-request textarea { font-family:ui-monospace,monospace; }
@container tools (min-width:760px) {
 .wb-tool-pane .wb-split { grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important; }
}
@container tools (max-width:759px) {
 .wb-network-workspace { grid-template-columns:minmax(0,1fr); }
 .wb-network-response { border-left:0;border-top:1px solid var(--dsw-alias-border-l1);padding:16px 0 0; }
}
@container tools (max-width:540px) {
 .wb-data-toolbar { gap:6px;padding-inline:8px; }
 .wb-data-toolbar-connection { font-size:11px; }
 .wb-data-connection-state { font-size:10px; }
 .wb-data-main { padding:10px; }
 .wb-data-query-head { margin:-10px -10px 0;padding:8px 10px; }
 .wb-tool-menu { width:min(440px,calc(100vw - 40px)); }
 .wb-tool-menu .wb-toolgrid { grid-template-columns:minmax(0,1fr)!important; }
 .wb-tool-pane textarea { min-height:180px!important; }
}
`;
