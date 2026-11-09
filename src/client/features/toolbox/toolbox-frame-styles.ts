export const TOOLBOX_FRAME_CSS=`
/* The host owns the viewport; each tool owns its input and result scrolling. */
.wb-root.is-toolbox{box-sizing:border-box}
.wb-root.is-toolbox .wb-scroll{display:flex;min-height:0;overflow:hidden}
.wb-root.is-toolbox .wb-toolbox-page{display:flex;flex:1;flex-direction:column;height:100%;min-height:0;margin:0 auto;padding:14px var(--wb-page-gutter,24px)}
.wb-tools-page{display:flex;flex-direction:column;flex:1;min-height:0;height:100%;padding:0!important}
.wb-tools-page>.wb-page-head{flex:none;margin-bottom:8px}
.wb-tools-page>.wb-page-head .wb-page-summary{font-size:11px}
.wb-toolbox-layout{display:flex;flex:1;min-width:0;min-height:0}
.wb-tool-surface{display:flex;flex-direction:column;flex:1;min-height:0;height:100%;margin:0}
.wb-tool-surface>.wb-card-body{display:flex;flex-direction:column;flex:1;min-height:0;gap:8px;padding:12px;overflow:hidden}
.wb-tool-pane{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;overflow:auto;overscroll-behavior:contain}
.wb-tool-pane:not([data-tool=data])>div{min-height:0;min-width:0;max-width:100%}
.wb-tools-page>p{flex:none;margin:5px 0 0!important;font-size:11px;line-height:18px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-tool-menu>.wb-card{max-height:min(640px,var(--wb-tool-menu-height,65vh))}
.wb-tool-ai{flex:none;min-height:0;padding-top:6px!important;font-size:12px}
.wb-tool-ai>summary{padding:3px 0;cursor:pointer}
.wb-tool-ai[open]{flex:0 1 44%;max-height:44%;overflow:auto;overscroll-behavior:contain}
.wb-tool-ai textarea{min-height:48px!important;max-height:100px;resize:vertical}
.wb-tool-ai .wb-code{max-height:180px;overflow:auto}
.wb-tool-pane:not([data-tool=data]) textarea{min-height:48px!important;max-height:none;resize:none;overflow:auto}
.wb-tool-pair,.wb-tool-diff,.wb-tool-regex,.wb-tool-form,.wb-tool-catalog,.wb-tool-converter{flex:1;min-height:0;min-width:0}
.wb-tool-pane .wb-split{min-height:0;min-width:0;align-items:stretch}
.wb-tool-pane .wb-field{min-height:0;min-width:0;margin:0}
.wb-tool-pair{display:flex;flex-direction:column;overflow:hidden}
.wb-tool-pair>.wb-split{flex:1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr)}
.wb-tool-pair>.wb-split>.wb-field,.wb-tool-pair>.wb-split>.wb-stack{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.wb-tool-pair>.wb-split>.wb-field{overflow:auto}
.wb-tool-pair .wb-field>.wb-label,.wb-tool-pair .wb-field>.wb-hint{flex:none}
.wb-tool-pair .wb-field>.wb-hint{max-height:28%;overflow:auto}
.wb-tool-pair .wb-field>.wb-stack{flex:1;min-height:0;overflow:auto}
.wb-tool-pair textarea{flex:1;min-height:0!important;height:0!important}
.wb-tool-pair>.wb-row,.wb-tool-pair>p,.wb-tool-pair>.wb-tiny{flex:none;max-height:20%;overflow:auto}
.wb-tool-pair>.wb-tool-table-scroll{flex:0 1 30%;max-height:30%}
.wb-tool-extra{display:flex;flex-direction:column;flex:0 1 30%;min-height:0;max-height:30%;overflow:hidden}
.wb-tool-extra>.wb-tiny{flex:none}
.wb-tool-output,.wb-tool-preview,.wb-tool-tree{flex:1;min-width:0;min-height:0!important;max-height:none!important;margin:0;overflow:auto;overscroll-behavior:contain}
.wb-tool-output:focus-visible,.wb-tool-preview:focus-visible,.wb-tool-tree:focus-visible{outline:2px solid var(--wb-accent);outline-offset:-2px}
.wb-tool-output{white-space:pre-wrap;overflow-wrap:anywhere}
.wb-tool-preview{height:0}
.wb-tool-error{flex:0 1 auto;min-height:0;max-height:30%;overflow:auto}
.wb-tool-pair>.wb-split>.wb-stack>.wb-row{flex:none}
.wb-tool-pair>.wb-split>.wb-stack{overflow:auto}
.wb-tool-table-scroll{flex:1;min-width:0;min-height:0;max-width:100%;overflow:auto;overscroll-behavior:contain;border:1px solid var(--dsw-alias-border-l1);border-radius:8px}
.wb-tool-table-scroll:focus-visible{outline:2px solid var(--wb-accent);outline-offset:-2px}
.wb-tool-table-scroll>.wb-table{margin:0;width:100%}
.wb-tool-table-scroll th{position:sticky;top:0;z-index:1;background:var(--dsw-alias-bg-base)}
.wb-tool-catalog{display:flex;flex-direction:column;overflow:hidden}
.wb-tool-catalog>.wb-row{flex:none;max-height:40%;overflow:auto}
.wb-tool-catalog>p{flex:none;margin:0;max-height:18%;overflow:auto}
.wb-tool-form{display:flex;flex-direction:column;overflow:auto}
.wb-tool-form>.wb-field{flex:0 1 28%;min-height:68px;display:flex;flex-direction:column}
.wb-tool-form>.wb-field textarea{flex:1;min-height:48px!important;height:0!important}
.wb-tool-form>.wb-split{flex:1;min-height:100px}
.wb-tool-form>.wb-split>.wb-stack{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.wb-tool-form>.wb-split .wb-code{flex:1;max-height:none!important;min-height:0;overflow:auto;margin:0}
.wb-tool-form>.wb-tool-table-scroll{flex:1;min-height:80px}
.wb-tool-form>.wb-row{flex:none}
.wb-tool-pane[data-tool=uuid] .wb-tool-output{min-height:60px!important}
.wb-tool-diff{display:grid!important;grid-template-rows:minmax(64px,.7fr) max-content max-content minmax(72px,1.3fr);gap:10px;overflow:auto}
.wb-diff-inputs{grid-row:1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr);gap:12px;min-height:0}
.wb-tool-diff .wb-field{display:flex;flex-direction:column}
.wb-tool-diff textarea{flex:1;min-height:0!important;height:0!important}
.wb-tool-diff>.wb-row{grid-row:2;min-height:max-content;overflow:visible}
.wb-tool-diff>.wb-tool-error{grid-row:3}
.wb-tool-diff>.wb-tool-output{grid-row:4}
.wb-diff-result{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:normal}
.wb-diff-head,.wb-diff-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.wb-diff-head{position:sticky;top:0;z-index:1;background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1);font:500 11px/30px system-ui;color:var(--dsw-alias-label-secondary)}
.wb-diff-head>span{padding:0 12px}
.wb-diff-head>span+span,.wb-diff-cell+.wb-diff-cell{border-left:1px solid var(--dsw-alias-border-l1)}
.wb-diff-cell{display:flex;align-items:stretch;min-width:0;padding:2px 6px 2px 0;color:var(--dsw-alias-label-primary)}
.wb-diff-line{flex:0 0 30px;text-align:right;padding-right:5px;color:var(--dsw-alias-label-secondary);opacity:.7;user-select:none;font-size:10px}
.wb-diff-sign{flex:0 0 14px;text-align:center;user-select:none}
.wb-diff-text{min-width:0;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:4}
.wb-diff-cell--del{background:color-mix(in srgb,var(--wb-err,#b42318) 10%,transparent)}
.wb-diff-cell--add{background:color-mix(in srgb,var(--wb-ok,#15803d) 10%,transparent)}
.wb-diff-cell--del .wb-diff-sign{color:var(--wb-err,#b42318)}
.wb-diff-cell--add .wb-diff-sign{color:var(--wb-ok,#15803d)}
.wb-diff-cell mark{color:inherit;border-radius:2px}
.wb-diff-cell--del mark{background:color-mix(in srgb,var(--wb-err,#b42318) 28%,transparent)}
.wb-diff-cell--add mark{background:color-mix(in srgb,var(--wb-ok,#15803d) 28%,transparent)}
.wb-diff-cell--empty{background:var(--dsw-alias-bg-layer-1)}
.wb-tool-regex{display:flex;flex-direction:column;overflow:auto}
.wb-tool-regex>.wb-split{flex:none}
.wb-tool-regex>.wb-field{display:flex;flex-direction:column;flex:0 1 30%;min-height:72px}
.wb-tool-regex>.wb-field textarea{flex:1;height:0!important}
.wb-tool-regex>.wb-row{flex:none}
.wb-tool-regex>.wb-stack{flex:1;min-height:80px;overflow:auto}
.wb-tool-converter{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;overflow:hidden}
.wb-tool-input-panel,.wb-tool-output-panel{display:flex;flex-direction:column;gap:8px;min-height:0;min-width:0;overflow:auto}
.wb-tool-input-panel>.wb-field{display:flex;flex-direction:column;flex:1;min-height:0}
.wb-tool-input-panel textarea{flex:1;min-height:0!important;height:0!important}
.wb-tool-input-panel>.wb-row,.wb-tool-output-panel>.wb-row{flex:none}
.wb-tool-output-panel>p{flex:none;max-height:24%;overflow:auto;margin:0}
.wb-tool-pane>.wb-network-workspace{flex:1;min-height:0;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr);gap:12px}
.wb-network-request,.wb-network-response{min-height:0;overflow:auto;overscroll-behavior:contain}
.wb-network-request textarea{height:clamp(64px,18vh,150px);min-height:48px!important}
.wb-network-response>.wb-code{flex:1;min-height:64px;max-height:none!important;margin:0}
.wb-network-response>.wb-data-empty{flex:1;min-height:60px}
.wb-tool-timer:not([hidden]){display:grid;place-items:center;flex:1;min-height:0;overflow:auto}
.wb-pomodoro{display:flex;flex-direction:column;align-items:center;gap:20px;max-width:100%;padding:24px}
.wb-pomodoro-time{font-family:ui-monospace,monospace;font-size:clamp(40px,9vh,80px);font-variant-numeric:tabular-nums;line-height:1.2}
/* Data workspaces participate in the same flex height chain. */
.wb-tool-surface--data>.wb-card-body{padding:0;gap:0;overflow:visible}
.wb-tool-pane[data-tool=data]{overflow:visible}
.wb-data-surface{display:flex;flex-direction:column;flex:1;min-height:0;height:100%}
.wb-data-toolbar,.wb-data-mobile-views,.wb-data-memory{flex:none}
.wb-data-workspace{flex:1;min-height:0;height:auto}
.wb-data-sidebar{min-height:0;max-height:100%}
.wb-data-main{min-height:0;gap:8px}
.wb-data-editor{flex:0 1 34%;min-height:48px}
.wb-data-main textarea[aria-label="数据查询编辑器"]{height:100%!important;min-height:0!important;max-height:none;resize:none}
.wb-data-results{flex:1;min-height:90px}
.wb-data-result-head,.wb-data-pagination{flex:none}
.wb-data-result-viewport{flex:1;height:auto;min-height:48px;max-height:none}
.wb-data-pagination{gap:5px 8px}
.wb-data-pagination-help{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);max-height:35%;overflow:auto}
.wb-data-pagination-help>summary{cursor:pointer}
.wb-data-structure{flex:0 1 28%;min-height:24px;overflow:auto}
.wb-data-ai-log .wb-code{max-height:180px;overflow:auto}
.wb-data-memory{min-height:22px;padding-block:3px}
@container tools (max-width:759px){
 .wb-tool-pair>.wb-split,.wb-tool-pane>.wb-network-workspace,.wb-tool-converter{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr) minmax(0,1fr)}
 .wb-network-response{border-left:0;padding:10px 0 0;border-top:1px solid var(--dsw-alias-border-l1)}
 .wb-tool-pair>.wb-split>.wb-stack{padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1)}
 .wb-tools-page>.wb-page-head .wb-page-summary{display:none}
}
@media(max-height:520px){
 .wb-root.is-toolbox .wb-toolbox-page{padding-block:6px}
 .wb-tool-surface>.wb-card-body{padding:8px}
 .wb-tool-surface--data>.wb-card-body{padding:0}
 .wb-data-toolbar{min-height:36px;padding-block:4px}
 .wb-data-mobile-views{min-height:32px;padding-block:2px}
 .wb-data-query-head{min-height:36px;padding-block:4px}
 .wb-data-memory{min-height:18px;font-size:10px}
 .wb-tool-ai[open]{max-height:50%;flex-basis:50%}
}
@media(max-height:420px){
 .wb-tools-page .wb-tool-pair>.wb-split{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr)}
 .wb-tools-page .wb-tool-pair>.wb-split>.wb-stack{padding-top:0;border-top:0}
}
`;
