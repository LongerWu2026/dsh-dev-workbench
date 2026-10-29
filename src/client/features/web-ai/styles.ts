export const WEB_AI_CSS=`
.wb-web-ai{min-width:0;display:flex;flex-direction:column;gap:14px;position:relative}
.wb-web-ai [hidden]{display:none!important}
.wb-web-toolbar,.wb-web-tabs{gap:8px;min-width:0}
.wb-web-compose>summary{font-size:13px;cursor:pointer;padding:9px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow-wrap:anywhere}
.wb-web-compose[open]>summary{margin-bottom:10px}
.wb-web-topic{display:flex;gap:8px;align-items:center;min-width:0;flex:1 1 240px;max-width:500px}
.wb-web-topic>.wb-btn{max-width:100%;min-width:0;white-space:normal;text-align:left;overflow-wrap:anywhere}
.wb-web-history{padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;display:flex;flex-direction:column;gap:10px;min-width:0}
.wb-web-history-item{display:flex;gap:12px;align-items:center;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;min-width:0}
.wb-web-history-item.is-selected{border-color:var(--dsw-alias-label-secondary)}
.wb-web-history-content{flex:1;min-width:0;overflow-wrap:anywhere}
.wb-web-history-content p{margin:5px 0}
.wb-web-history-actions{gap:6px;flex-shrink:0}
@media(max-width:650px){.wb-web-history-item{flex-direction:column;align-items:stretch}.wb-web-history-actions{justify-content:flex-end}.wb-web-topic{max-width:100%}}
.wb-web-providers{border:0;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:12px}
.wb-web-providers legend{font-size:12px;color:var(--dsw-alias-label-secondary);margin-bottom:8px}
.wb-web-providers label{display:inline-flex;gap:5px;align-items:center;font-size:13px}
.wb-web-status{padding:22px 14px;font-size:13px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.wb-web-native-region{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;min-width:0}
.wb-web-notice{padding:9px 12px;gap:8px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wb-website{display:flex;height:65vh;min-height:340px;flex-direction:column;position:relative;min-width:0;background:var(--dsw-alias-bg-base)}
.wb-web-native-region.is-background{position:absolute;left:0;top:0;width:100%;height:700px;opacity:0;pointer-events:none;z-index:-1}
.wb-website.is-background-guest{position:absolute;left:0;top:0;width:100%;opacity:0;pointer-events:none;z-index:-1}
.wb-web-connection{padding:8px 12px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.wb-web-connection>summary{cursor:pointer}
.wb-web-diagnostics p{overflow-wrap:anywhere;font-family:monospace;font-size:11px}
.wb-web-empty{padding:28px 16px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px}
.wb-website webview{min-width:0;display:flex}
.wb-website .wb-web-status{position:absolute;left:0;right:0;top:0;background:var(--dsw-alias-bg-layer-1);z-index:1;max-height:100%;overflow:auto}
.wb-web-round{border:1px solid var(--dsw-alias-border-l1);padding:12px;border-radius:9px;margin-bottom:12px;min-width:0}
.wb-web-round>summary{cursor:pointer;white-space:pre-wrap;overflow-wrap:anywhere;margin-bottom:12px;font-weight:600}
.wb-comparison-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:12px}
.wb-web-answer{min-width:0;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
.wb-web-answer pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:13px;line-height:1.7;max-height:480px;overflow:auto}
.wb-web-error{color:var(--dsw-alias-state-error-primary);font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}
`
