export const TOOLBOX_CSS = `
.wb-tools-page { container-type:inline-size; container-name:tools; }
.wb-tool-picker { position:relative; }
.wb-tool-trigger { min-height:32px; }
.wb-tool-menu { position:absolute; top:100%; right:0; padding-top:8px; width:min(540px,calc(100vw - 40px)); z-index:45; }
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
.wb-tool-pane[data-tool=json] textarea,.wb-tool-pane[data-tool=diff] textarea,.wb-tool-pane[data-tool=markdown] textarea,.wb-tool-pane[data-tool=types] textarea { min-height:320px!important; }
.wb-tool-pane[data-tool=base64] textarea,.wb-tool-pane[data-tool=url] textarea,.wb-tool-pane[data-tool=csv] textarea,.wb-tool-pane[data-tool=yaml] textarea,.wb-tool-pane[data-tool=sql] textarea,.wb-tool-pane[data-tool=sqlexplain] textarea { min-height:260px!important; }
.wb-tool-pane[data-tool=logs] textarea { min-height:300px!important; font-family:ui-monospace,monospace; }
.wb-tool-pane[data-tool=regex] textarea { min-height:200px!important; }
.wb-tool-pane[data-tool=timestamp],.wb-tool-pane[data-tool=cron],.wb-tool-pane[data-tool=jwt] { max-width:1100px; margin-inline:auto; }
.wb-tool-pane[data-tool=uuid] .wb-code { min-height:220px; }
.wb-tool-pane[data-tool=status] table th,.wb-tool-pane[data-tool=status] table td { vertical-align:top; }
.wb-tool-surface--data > .wb-card-body { padding:0; }
.wb-data-workspace { display:grid; grid-template-columns:250px minmax(0,1fr); min-height:620px; }
.wb-data-sidebar { display:flex;flex-direction:column;gap:12px;padding:16px;min-width:0;border-right:1px solid var(--dsw-alias-border-l1);background:var(--wb-hover-bg); }
.wb-data-sidebar-head,.wb-data-query-head { display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap; }
.wb-data-sidebar-head strong { font-size:12px; }
.wb-data-main { display:flex;flex-direction:column;gap:14px;min-width:0;padding:16px; }
.wb-data-main textarea[aria-label="数据查询编辑器"] { min-height:240px; font-size:13px; line-height:1.7; tab-size:2; }
.wb-data-main .wb-table th { position:sticky;top:0;background:var(--dsw-alias-bg-base);z-index:1; }
.wb-data-table-scroll { overflow:auto;max-width:100%; }
.wb-data-empty { display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;min-height:180px;color:var(--dsw-alias-label-secondary);font-size:12px;border:1px dashed var(--dsw-alias-border-l1);border-radius:8px; }
.wb-data-ai,.wb-data-structure { border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px; }
.wb-data-ai summary,.wb-data-structure summary { cursor:pointer;font-size:12px; }
.wb-data-structure h4 { margin:12px 0 8px;overflow-wrap:anywhere; }
.wb-network-workspace { display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px; }
.wb-network-request,.wb-network-response { min-width:0; }
.wb-network-response { padding-left:20px;border-left:1px solid var(--dsw-alias-border-l1); }
.wb-network-response > strong { font-size:12px; }
.wb-network-request textarea { font-family:ui-monospace,monospace; }
@container tools (min-width:760px) {
 .wb-tool-pane .wb-split { grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important; }
}
@container tools (max-width:759px) {
 .wb-data-workspace { grid-template-columns:200px minmax(0,1fr); }
 .wb-network-workspace { grid-template-columns:minmax(0,1fr); }
 .wb-network-response { border-left:0;border-top:1px solid var(--dsw-alias-border-l1);padding:16px 0 0; }
}
@container tools (max-width:540px) {
 .wb-data-workspace { grid-template-columns:minmax(0,1fr); }
 .wb-data-sidebar { border-right:0;border-bottom:1px solid var(--dsw-alias-border-l1); }
 .wb-tool-menu { width:min(440px,calc(100vw - 40px)); }
 .wb-tool-menu .wb-toolgrid { grid-template-columns:minmax(0,1fr)!important; }
 .wb-tool-pane textarea { min-height:180px!important; }
}
`;
