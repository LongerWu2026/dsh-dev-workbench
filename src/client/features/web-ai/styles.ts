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
.wb-web-history-main{display:flex;align-items:flex-start;gap:10px;flex:1;min-width:0}
.wb-web-history-main>input{flex:none;margin:3px 0 0}
.wb-web-history-confirm-list{max-height:160px;overflow:auto;padding-left:20px;overflow-wrap:anywhere}
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
.wb-web-auth{padding:8px 12px;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary);border-bottom:1px solid var(--dsw-alias-border-l1)}
.wb-web-auth>span{flex:1;min-width:180px;overflow-wrap:anywhere}
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
.wb-root.is-web-ai{box-sizing:border-box}
/* Chat surfaces share the assistant's frame, sidebar, identity rows and gutters. */
.wb-root.is-web-ai .wb-workarea,.wb-root.is-web-ai .wb-main{min-height:0;overflow:hidden}
.wb-root.is-web-ai .wb-scroll{display:flex;min-height:0;overflow:hidden;padding:24px var(--wb-page-gutter);box-sizing:border-box}
.wb-root.is-web-ai .wb-chat-page{display:flex;flex:1;min-height:0;min-width:0;max-width:calc(var(--wb-content-max) - 2 * var(--wb-page-gutter));margin:0 auto;padding:0}
.wb-web-ai{flex:1;min-height:0;gap:0;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.wb-chat-layout{display:flex;position:relative;flex:1;min-height:0;min-width:0;overflow:hidden}
.wb-web-ai:not(.is-compact) .wb-chat-sidebar{position:static;flex:0 0 200px;width:200px;box-shadow:none}
.wb-web-ai.is-compact .wb-chat-sidebar{position:absolute;z-index:12;inset:0 auto 0 0;flex:none;width:min(260px,calc(100% - 44px));box-shadow:8px 0 24px #0002;overscroll-behavior:contain}
.wb-chat-sidebar{display:flex;flex-direction:column;min-height:0;gap:10px;padding:12px 10px;border-right:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.wb-chat-sidebar-search{min-width:0;flex:none}.wb-chat-sidebar-search .wb-input{width:100%;min-width:0}
.wb-chat-session-list{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:4px;scrollbar-width:thin;overscroll-behavior:contain;scrollbar-gutter:stable}
.wb-chat-section-title{flex:none;margin:0;padding:8px;font-size:11px;font-weight:500;color:var(--dsw-alias-label-secondary)}
.wb-web-ai .wb-chat-session{display:flex;flex:0 0 auto;align-items:flex-start;gap:8px;min-width:0;width:100%;min-height:44px;margin:0;padding:10px 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer}
.wb-chat-session>span{display:flex;flex-direction:column;gap:5px;width:100%;min-width:0}
.wb-chat-session strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere;white-space:normal;font-size:12px;font-weight:500;line-height:1.6}
.wb-chat-session small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:1.5;opacity:.8}
.wb-chat-session.is-selected,.wb-chat-session:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.wb-chat-session:focus-visible{outline:2px solid var(--dsw-alias-label-secondary);outline-offset:-2px}
.wb-chat-session:disabled{opacity:.6;cursor:default}.wb-chat-session.is-new{cursor:default}
.wb-chat-manage{flex:none;align-self:stretch;gap:6px;justify-content:flex-start}
.wb-chat-main{display:flex;flex-direction:column;flex:1;position:relative;min-width:0;min-height:0;overflow:hidden}
.wb-chat-head{display:flex;align-items:center;gap:8px;min-width:0;min-height:54px;flex:none;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wb-chat-head h2{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0;font-size:13px;font-weight:600;line-height:1.6;color:var(--dsw-alias-label-primary)}
.wb-chat-head>.wb-btn,.wb-chat-head>.wb-iconbtn{flex:none}.wb-chat-head>.wb-hub-sidebar-toggle{width:32px;height:32px}
.wb-chat-thread-shell{position:relative;flex:1;min-height:0;min-width:0;overflow:hidden}
.wb-chat-thread-pane{height:100%;min-height:0;min-width:0}
.wb-chat-thread{height:100%;overflow:auto;min-height:0;min-width:0;padding:20px 24px;overscroll-behavior:contain;overflow-anchor:none;scrollbar-width:thin;box-sizing:border-box}
.wb-chat-messages{display:flex;flex-direction:column;gap:28px;max-width:780px;width:100%;min-width:0;margin:0 auto}
.wb-chat-round{display:flex;flex-direction:column;gap:18px;min-width:0;width:100%}
.wb-chat-user,.wb-chat-assistant{margin:0 auto;flex:none}
.wb-chat-question{min-width:0}.wb-chat-question h3{font-size:13px;font-weight:400;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}
.wb-chat-file-labels{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;font-size:11px}
.wb-chat-file-labels span{padding:4px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;max-width:100%;overflow-wrap:anywhere;line-height:1.5}
.wb-chat-round-tabs{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:8px;min-width:0}
.wb-chat-round-tabs button{font:inherit;font-size:12px;border:0;border-radius:6px;padding:5px 9px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;line-height:1.6}
.wb-chat-round-tabs button:hover,.wb-chat-round-tabs button[aria-selected=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.wb-chat-round-tabs button:focus-visible{outline:2px solid var(--dsw-alias-label-secondary);outline-offset:2px}
.wb-chat-round-tabs small{font-size:10px}
.wb-chat-answer-body{overflow-wrap:anywhere;min-height:28px;min-width:0}
.wb-chat-markdown{font-size:13px;line-height:1.7;overflow-wrap:anywhere}.wb-chat-markdown p{white-space:pre-wrap;margin:0 0 8px}.wb-chat-markdown p:last-child{margin-bottom:0}
.wb-chat-markdown :is(h1,h2,h3,h4,h5,h6){margin:16px 0 8px;font-weight:600;line-height:1.5}.wb-chat-markdown :is(h1,h2,h3,h4,h5,h6):first-child{margin-top:0}.wb-chat-markdown h1{font-size:20px}.wb-chat-markdown h2{font-size:18px}.wb-chat-markdown h3{font-size:16px}.wb-chat-markdown :is(h4,h5,h6){font-size:14px}
.wb-chat-markdown :not(pre)>code{padding:2px 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);font:12px/1.6 ui-monospace,monospace;overflow-wrap:anywhere}
.wb-chat-table{max-width:100%;overflow:auto;margin:10px 0;overscroll-behavior:contain}.wb-chat-table table{border-collapse:collapse;width:100%;font-size:12px}.wb-chat-table :is(th,td){border:1px solid var(--dsw-alias-border-l1);padding:7px 10px;text-align:left;min-width:80px}.wb-chat-table th{background:var(--dsw-alias-bg-layer-2);font-weight:600}
.wb-chat-code-block{min-width:0;max-width:100%;margin:8px 0;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden}.wb-chat-code-language{padding:5px 10px;background:var(--dsw-alias-bg-layer-2);font:11px/1.6 ui-monospace,monospace;color:var(--dsw-alias-label-secondary)}
.wb-chat-markdown ul,.wb-chat-markdown ol{margin:6px 0 10px;padding-left:22px}.wb-chat-markdown blockquote{margin:8px 0;padding-left:12px;border-left:2px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.wb-chat-messages .wb-web-answer pre{max-height:none;overflow:visible;margin:0;font-size:13px;line-height:1.7}
.wb-chat-messages .wb-web-answer .wb-chat-code{padding:10px;background:var(--dsw-alias-bg-layer-1);border-radius:8px;white-space:pre;overflow:auto;margin:8px 0;font:12px/1.7 ui-monospace,monospace}
.wb-chat-messages .wb-web-answer .wb-chat-code-block .wb-chat-code{margin:0;border-radius:0}
@media(prefers-reduced-motion:reduce){.wb-chat-stream-cursor{animation:none!important}}
.wb-chat-answer-actions{margin-top:10px;gap:6px;color:var(--dsw-alias-label-secondary)}
.wb-chat-answer-actions>button,.wb-chat-answer-actions summary{border:0;background:transparent;font-size:11px;padding:5px 8px;border-radius:6px}
.wb-chat-answer-actions>button:hover,.wb-chat-answer-actions summary:hover{background:var(--dsw-alias-bg-layer-2)}
.wb-chat-answer-actions details{position:relative}.wb-chat-answer-actions summary,.wb-chat-provider-picker summary{list-style:none;cursor:pointer}
.wb-chat-answer-actions summary::-webkit-details-marker,.wb-chat-provider-picker summary::-webkit-details-marker{display:none}
.wb-chat-message-menu{position:absolute;bottom:calc(100% + 4px);left:0;z-index:5;background:var(--dsw-alias-bg-base);padding:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;display:grid;gap:6px;min-width:140px;max-height:220px;overflow:auto;box-shadow:0 6px 20px #0002}
.wb-chat-stream-cursor{display:inline-block;width:5px;height:14px;background:var(--dsw-alias-label-secondary);animation:wb-chat-pulse 1s ease-in-out infinite}
@keyframes wb-chat-pulse{50%{opacity:.25}}
@media(prefers-reduced-motion:reduce){.wb-chat-stream-cursor{animation:none}}
.wb-chat-earlier{text-align:center;margin-bottom:18px}
.wb-chat-thread .wb-web-empty{display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:180px;height:55%;padding:24px 12px;color:var(--dsw-alias-label-secondary)}
.wb-chat-thread .wb-web-empty strong{font-size:16px;color:var(--dsw-alias-label-primary);font-weight:600}
.wb-chat-composer{flex:none;min-width:0;align-self:center;width:calc(100% - 48px);max-width:780px;margin:10px 24px 14px;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-base);box-shadow:0 2px 8px #00000004;box-sizing:border-box;max-height:55%}
.wb-chat-composer:focus-within{border-color:var(--dsw-alias-label-secondary)}
.wb-chat-composer textarea.wb-textarea,.wb-chat-composer textarea.wb-textarea:focus,.wb-chat-composer textarea.wb-textarea:focus-visible{width:100%;min-height:48px;max-height:120px;border:0;outline:0;box-shadow:none;border-radius:0;padding:4px 0;background:transparent;font-size:13px;line-height:1.7;resize:vertical}
.wb-chat-input-bar{display:flex;gap:8px;align-items:flex-end;min-width:0;margin-top:4px}
.wb-chat-input-bar>[aria-label="问题附件"]{flex:0 1 auto;min-width:0;max-width:50%;max-height:90px;overflow:auto;overscroll-behavior:contain}
.wb-chat-input-bar>[aria-label="问题附件"]>.wb-row{gap:6px!important}
.wb-chat-input-bar>[aria-label="问题附件"] .wb-btn{min-height:28px}
.wb-chat-input-bar>button{flex:none;min-height:28px}
.wb-chat-provider-picker{position:relative;margin-right:auto;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary)}
.wb-chat-provider-picker summary{max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:6px;line-height:1.6}
.wb-chat-provider-menu{max-height:min(340px,max(64px,calc(100dvh - 220px - var(--dsh-frame-top-clearance,0px))));overflow:auto;position:absolute;bottom:calc(100% + 8px);left:0;z-index:12;width:292px;padding:8px;display:grid;gap:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);box-shadow:0 8px 28px #0003}
.wb-chat-provider-menu>.wb-row{gap:8px;min-height:36px;padding:4px 6px;border-radius:6px;flex-wrap:nowrap}.wb-chat-provider-menu>.wb-row:hover{background:var(--dsw-alias-bg-layer-1)}
.wb-chat-provider-menu label{display:flex;align-items:center;gap:6px;min-width:0;flex:1}
.wb-chat-login-state{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}.wb-chat-login-state.is-authenticated{color:var(--dsw-alias-state-success-primary,#368568)}
.wb-chat-login-state.is-needs_login,.wb-chat-login-state.is-verification{color:var(--dsw-alias-state-warn-primary,#b8792b)}
.wb-chat-provider-menu>.wb-tiny{padding:8px 6px 4px;border-top:1px solid var(--dsw-alias-border-l1);margin-top:4px}
.wb-chat-alert{margin:8px 14px;flex:none;max-height:65px;overflow:auto}
.wb-chat-history-overlay{position:absolute;inset:54px 12px 12px;overflow:auto;z-index:10;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base);box-shadow:0 12px 35px #0002}
.wb-chat-history-overlay .wb-web-history{border:0;border-radius:0}
.wb-web-ai.is-compact .wb-chat-head{padding-inline:12px}
.wb-web-ai.is-compact .wb-chat-thread{padding:12px}
.wb-web-ai.is-compact .wb-chat-composer{width:calc(100% - 24px);margin:8px 12px 12px}
.wb-web-ai.is-compact .wb-chat-provider-picker summary{max-width:140px}
.wb-web-ai.is-compact .wb-chat-provider-menu{left:-40px}
@container workbench (max-width:560px){.wb-root.is-web-ai .wb-scroll{padding-block:16px}}
@media(max-height:420px){
 .wb-root.is-web-ai .wb-scroll{padding-block:6px}
 .wb-chat-head{min-height:38px;padding-block:4px}
 .wb-chat-thread{padding-block:8px}.wb-chat-thread .wb-web-empty{min-height:60px;height:auto;padding:12px}
 .wb-chat-composer{max-height:65%;margin-block:4px 6px;padding:6px 8px}
 .wb-chat-composer textarea.wb-textarea{min-height:30px;max-height:60px;height:30px}
 .wb-chat-input-bar>[aria-label="问题附件"]{max-height:34px}
}

.wb-web-ai .wb-login-backdrop{position:fixed;inset:0;background:var(--wb-dialog-scrim);z-index:1100}
.wb-web-ai .wb-login-dialog:not(.is-background){position:fixed;inset:5vh 4vw;width:auto;height:90vh;z-index:1101;display:flex;flex-direction:column;background:var(--wb-dialog-bg);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);box-shadow:var(--wb-dialog-shadow);border-radius:12px}
.wb-web-ai .wb-login-dialog:not(.is-background) .wb-website:not(.is-background-guest){flex:1;min-height:0;height:auto}.wb-web-ai .wb-login-dialog .wb-web-connection{max-height:25%;overflow:auto;flex-shrink:0}.wb-web-ai .wb-login-dialog .wb-web-notice,.wb-web-ai .wb-login-dialog .wb-web-auth{flex-shrink:0}
.wb-web-ai .wb-login-close{margin-left:auto}.wb-web-ai .wb-chat-head h2{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wb-web-ai .wb-chat-head>.wb-btn{flex-shrink:0}
@media(max-width:650px){.wb-web-ai .wb-login-dialog:not(.is-background){inset:8px;height:calc(100dvh - 16px)}}


`
