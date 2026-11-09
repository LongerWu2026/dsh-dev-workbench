export const HTTP_WORKSPACE_CSS = `
.wb-http-workspace{container:http-workspace / inline-size;display:flex;flex-direction:column;flex:1;gap:12px;padding:0 1px 1px}
.wb-http-workspace :is(p,pre,ul){margin:0}
.wb-http-workspace summary{cursor:pointer;font-size:12px}
.wb-http-workspace :is(section,aside,div,label,select,input,textarea){min-width:0}
.wb-http-toolbar{padding:0 0 10px;border-bottom:1px solid var(--wb-border-soft)}
.wb-http-toolbar{flex:none;gap:8px 10px}
.wb-http-toolbar>.wb-row{font-size:12px;white-space:nowrap;gap:8px;flex:none}
.wb-http-toolbar .wb-select{width:auto;max-width:220px}
.wb-http-workspace .wb-select{appearance:auto;padding-right:8px}
.wb-http-toolbar>.wb-btn{flex:none}
.wb-http-workspace> :not(.wb-http-layout){flex-shrink:0}
.wb-http-layout{display:grid;grid-template-columns:minmax(148px,190px) minmax(0,1fr);gap:16px;align-items:stretch;flex:1;min-height:360px}
.wb-http-main{min-width:0;overflow-wrap:anywhere;gap:12px}
.wb-http-main>*{flex-shrink:0}
.wb-http-collections,.wb-http-ai,.wb-http-environment,.wb-http-variables{
  background:var(--wb-hover-bg);border:1px solid var(--wb-border-soft);border-radius:8px;padding:10px
}
.wb-http-environment{max-width:540px}
.wb-http-variables[open]>.wb-field{padding-top:8px}
.wb-http-variables textarea{font-family:ui-monospace,monospace}
.wb-http-collections{gap:12px}
.wb-http-collections>.wb-btn{width:100%;justify-content:center}
.wb-http-collections>.wb-tiny{padding:16px 4px;text-align:center;line-height:1.7}
.wb-http-ai{align-self:start}
.wb-http-workspace :is(button,summary):focus-visible{outline:2px solid var(--wb-accent);outline-offset:2px}
.wb-http-collections>.wb-select{width:100%}
.wb-http-request-item,.wb-http-result-item,.wb-http-tabs button{
  font:inherit;font-size:12px;color:inherit;border:1px solid transparent;background:transparent;cursor:pointer
}
.wb-http-request-item,.wb-http-result-item{display:flex;align-items:baseline;gap:7px;text-align:left;border-radius:6px;padding:6px 8px;overflow-wrap:anywhere}
.wb-http-request-item code{font-size:10px;color:var(--wb-accent);flex:none}
.wb-http-request-item:is(:hover,[aria-current=true]),.wb-http-result-item:is(:hover,[aria-pressed=true]){
  background:var(--wb-hover-bg);border-color:var(--wb-border-soft)
}
.wb-http-request-item:disabled{cursor:default;opacity:.6}
.wb-http-workspace .wb-http-name{font-weight:600;flex:1;min-width:128px}
.wb-http-request-bar{display:grid;grid-template-columns:100px minmax(0,1fr) auto;align-items:center;gap:8px}
.wb-http-request-bar>.wb-input{width:100%;font-family:ui-monospace,monospace}
.wb-http-request-bar>:is(.wb-input,.wb-select,.wb-btn){height:38px;box-sizing:border-box}
.wb-http-request-bar>.wb-select{font-weight:650}
.wb-http-request-bar>.wb-btn{white-space:nowrap}
.wb-http-tabs{display:flex;flex-wrap:wrap;gap:2px;border-bottom:1px solid var(--wb-border-soft)}
.wb-http-tabs button{padding:9px 12px;border-bottom-width:2px}
.wb-http-tabs [aria-pressed=true]{color:var(--wb-accent);border-bottom-color:var(--wb-accent)}
.wb-http-utilities{align-items:baseline;font-size:12px;gap:10px 16px;padding:2px 0}
.wb-http-utilities details[open]{flex:1 0 100%;padding:5px 0}
.wb-http-utilities details[open]>summary{margin-bottom:5px}
.wb-http-response{border-top:1px solid var(--wb-border-soft);padding-top:14px;flex:1;min-height:220px}
.wb-http-response>.wb-data-empty{flex:1;min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:var(--wb-hover-bg);border:1px solid var(--wb-border-soft);border-radius:10px}
.wb-http-empty-mark{font:500 24px ui-monospace,monospace;opacity:.4}
.wb-http-response>.wb-code{flex:1;min-height:180px;max-height:520px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
.wb-http-response details .wb-code,.wb-http-draft .wb-code{max-height:250px;overflow:auto}
.wb-http-response .wb-tool-ai[open]{max-height:none}
.wb-http-assertion{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.wb-http-assertion .wb-input{flex:1 1 100px;width:auto}
.wb-http-checks,.wb-http-draft-rules{display:grid;gap:5px;list-style:none;padding:0;font-size:12px}
.wb-http-checks>li{display:grid;grid-template-columns:minmax(120px,1fr) repeat(2,minmax(100px,1fr));gap:4px 10px;padding:6px 8px;background:var(--wb-hover-bg);border-radius:6px;overflow-wrap:anywhere}
.wb-http-checks>.is-failed>strong,.wb-http-result-item:is(.is-error,.is-failed)>strong{color:var(--dsw-alias-state-error-primary,var(--wb-text-1))}
.wb-http-checks>.is-passed>strong,.wb-http-result-item.is-passed>strong{color:var(--dsw-alias-state-success-primary,var(--wb-text-1))}
.wb-http-draft,.wb-http-detail{border-top:1px solid var(--wb-border-soft);padding-top:9px;font-size:12px;overflow-wrap:anywhere}
.wb-http-run-plan{display:grid;gap:5px}
.wb-http-run-plan>label{display:flex;gap:7px;align-items:baseline;font-size:12px}
.wb-http-run-plan code,.wb-http-result-item small{color:var(--dsw-alias-label-secondary)}
.wb-http-result-item{justify-content:space-between;flex-wrap:wrap;border-color:var(--wb-border-soft)}
@container http-workspace (min-width:860px){
  .wb-http-layout.has-ai{grid-template-columns:minmax(140px,170px) minmax(0,1fr) minmax(222px,260px)}
}
@container http-workspace (max-width:859px){
  .wb-http-layout.has-ai>.wb-http-ai{grid-row:1;grid-column:1 / -1}
}
@container http-workspace (max-width:530px){
  .wb-http-layout{grid-template-columns:minmax(0,1fr);gap:10px}
  .wb-http-checks>li{grid-template-columns:minmax(0,1fr)}
  .wb-http-request-bar{grid-template-columns:86px minmax(0,1fr)}
  .wb-http-request-bar>.wb-btn{grid-column:1 / -1}
  .wb-http-toolbar>.wb-spacer{display:none}
  .wb-http-toolbar>strong{flex-basis:100%}
  .wb-http-collections>.wb-tiny{padding:4px}
  .wb-http-layout{flex:none}
}
`
