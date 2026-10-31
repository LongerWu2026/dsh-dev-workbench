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
.wb-chat-layout{display:grid;grid-template-columns:216px minmax(0,1fr);height:calc(100dvh - 230px);min-height:460px;max-height:1100px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;overflow:hidden;background:var(--dsw-alias-bg-base)}
.wb-chat-sidebar{display:flex;flex-direction:column;gap:14px;min-width:0;min-height:0;padding:16px 12px;border-right:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.wb-chat-sidebar-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px}
.wb-chat-sidebar-search{min-width:0}.wb-chat-sidebar-search .wb-input{width:100%;min-width:0}
.wb-chat-mobile-history{display:none}
.wb-chat-session-list{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:5px}
.wb-chat-session{display:flex;flex-direction:column;gap:5px;width:100%;min-width:0;border:1px solid transparent;border-radius:9px;padding:11px 10px;background:transparent;text-align:left;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;flex-shrink:0}
.wb-chat-session strong{font-size:12px;font-weight:600;line-height:1.5;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.wb-chat-session span{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.wb-chat-session small{font-size:10px;color:var(--dsw-alias-label-secondary)}
.wb-chat-session:hover,.wb-chat-session:focus-visible{background:var(--dsw-alias-bg-layer-2);outline:1px solid var(--dsw-alias-border-l2)}
.wb-chat-session.is-selected{background:var(--dsw-alias-bg-base);border-color:var(--dsw-alias-border-l1)}
.wb-chat-session:disabled{opacity:.6;cursor:default}
.wb-chat-main{position:relative;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.wb-chat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px 10px;min-width:0;flex-shrink:0}
.wb-chat-title{min-width:0;flex:1}.wb-chat-title h2{font-size:15px;margin:3px 0 0;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-chat-title .wb-tiny{font-size:10px}
.wb-chat-main>.wb-web-tabs{padding:0 18px 11px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-shrink:0;gap:5px}
.wb-chat-main>.wb-web-tabs .wb-btn{font-size:11px;padding:5px 8px}
.wb-chat-thread-shell{position:relative;flex:1;min-height:0;min-width:0;overflow:hidden}
.wb-chat-thread-pane{height:100%;min-height:0}.wb-chat-thread{height:100%;overflow:auto;min-height:0;min-width:0;overscroll-behavior:contain;padding:22px 20px}
.wb-chat-messages{display:flex;flex-direction:column;gap:28px;max-width:1100px;margin:0 auto;min-width:0}
.wb-chat-round{min-width:0;display:flex;flex-direction:column;gap:18px}
.wb-chat-user{display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:0}
.wb-chat-role{font-size:10px;color:var(--dsw-alias-label-secondary)}
.wb-chat-question{background:var(--dsw-alias-bg-layer-2);border-radius:14px 14px 4px 14px;padding:11px 14px;max-width:90%;min-width:0}
.wb-chat-question h3{font-size:13px;font-weight:500;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}
.wb-chat-question p{margin:6px 0 0}
.wb-chat-user>.wb-btn{font-size:10px;padding:2px 5px;color:var(--dsw-alias-label-secondary)}
.wb-chat-messages .wb-comparison-grid{grid-template-columns:repeat(auto-fit,minmax(min(290px,100%),1fr));gap:12px}
.wb-chat-messages .wb-comparison-grid.is-single{grid-template-columns:minmax(0,1fr)}
.wb-chat-messages .wb-web-answer{padding:14px;background:var(--dsw-alias-bg-base);border-radius:11px;border-color:var(--dsw-alias-border-l1)}
.wb-chat-answer-head{display:flex;align-items:center;gap:8px;min-width:0;font-size:12px;margin-bottom:10px}
.wb-chat-vendor{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-size:12px;font-weight:700;flex:none}
.wb-chat-vendor--glm{color:#5474d1}.wb-chat-vendor--doubao{color:#bb6a3a}.wb-chat-vendor--yuanbao{color:#268b75}.wb-chat-vendor--qianwen{color:#8b59b8}.wb-chat-vendor--chatgpt{color:#40816d}
.wb-chat-answer-status{margin-left:auto;display:inline-flex;gap:5px;align-items:center;font-size:10px;color:var(--dsw-alias-label-secondary);flex-shrink:0}
.wb-chat-messages .wb-web-answer pre{max-height:none;overflow:visible;margin:0;line-height:1.8;font-size:13px}
.wb-chat-answer-body{overflow-wrap:anywhere;min-height:28px}
.wb-chat-markdown{font-size:13px;line-height:1.8;overflow-wrap:anywhere}.wb-chat-markdown p{white-space:pre-wrap;margin:0 0 8px}.wb-chat-markdown p:last-child{margin-bottom:0}
.wb-chat-markdown h4{font-size:14px;margin:14px 0 7px;font-weight:650}.wb-chat-markdown h4:first-child{margin-top:0}
.wb-chat-markdown ul,.wb-chat-markdown ol{margin:6px 0 10px;padding-left:22px}.wb-chat-markdown blockquote{margin:8px 0;padding-left:12px;border-left:2px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.wb-chat-messages .wb-web-answer .wb-chat-code{padding:10px;background:var(--dsw-alias-bg-layer-1);border-radius:8px;white-space:pre;overflow:auto;margin:8px 0;font:12px/1.7 ui-monospace,monospace}
.wb-chat-answer-actions{gap:5px;margin-top:12px}.wb-chat-answer-actions .wb-btn{font-size:10px;padding:3px 6px}
.wb-chat-stream-dot{width:5px;height:5px;border-radius:50%;background:currentColor;animation:wb-chat-pulse 1s ease-in-out infinite}
.wb-chat-stream-cursor{display:inline-block;width:5px;height:14px;background:var(--dsw-alias-label-secondary);animation:wb-chat-pulse 1s ease-in-out infinite}
@keyframes wb-chat-pulse{50%{opacity:.25}}
@media(prefers-reduced-motion:reduce){.wb-chat-stream-dot,.wb-chat-stream-cursor{animation:none}}
.wb-chat-earlier{text-align:center;margin-bottom:18px}
.wb-chat-composer{flex-shrink:0;min-width:0;margin:0 16px;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;max-height:52%;overflow:auto;background:var(--dsw-alias-bg-base)}
.wb-chat-composer .wb-stack{gap:8px}.wb-chat-composer textarea{min-height:58px;border:0;box-shadow:none;padding:4px 0;background:transparent;font-size:13px}
.wb-chat-composer .wb-web-providers{gap:10px}.wb-chat-composer .wb-web-providers legend{font-size:10px;margin-bottom:5px}
.wb-chat-composer .wb-web-providers label{font-size:11px}.wb-chat-composer p{margin:0;font-size:10px;line-height:1.5}
.wb-chat-options{padding:6px 18px 10px;flex:none;color:var(--dsw-alias-label-secondary)}.wb-chat-options label{font-size:10px}
.wb-chat-alert{margin:6px 18px;flex:none;max-height:65px;overflow:auto}
.wb-chat-history-overlay{position:absolute;inset:64px 12px 12px;overflow:auto;z-index:10;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);box-shadow:0 12px 35px #0002}
.wb-chat-history-overlay .wb-web-history{border:0;border-radius:0}
.wb-chat-thread-shell .wb-chat-web-pane:not(.is-background){height:100%;display:flex;flex-direction:column;overflow:auto;border:0;border-radius:0}
.wb-chat-web-pane .wb-website{flex:1;min-height:180px;height:auto}.wb-chat-web-pane .wb-website webview{min-height:180px!important}
.wb-chat-web-pane .wb-web-notice,.wb-chat-web-pane .wb-web-auth{font-size:11px;padding:7px 12px;flex-shrink:0}
.wb-chat-web-pane .wb-web-connection{flex-shrink:0}
.wb-chat-empty-mark{font-size:32px;margin:16px 0 12px;color:var(--dsw-alias-label-primary)}
.wb-chat-thread .wb-web-empty{padding:30px 16px}.wb-chat-thread .wb-web-empty strong{font-size:17px;color:var(--dsw-alias-label-primary)}
@media(max-width:760px){
 .wb-chat-layout{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);height:calc(100dvh - 210px);min-height:490px}
 .wb-chat-sidebar{padding:9px 12px;gap:8px;border-right:0;border-bottom:1px solid var(--dsw-alias-border-l1);max-height:230px}
 .wb-chat-mobile-history{display:inline-flex;font-size:11px;padding:4px 7px;margin-left:auto}
 .wb-chat-sidebar:not(.is-expanded)>.wb-chat-sidebar-search,.wb-chat-sidebar:not(.is-expanded)>.wb-chat-session-list,.wb-chat-sidebar:not(.is-expanded)>.wb-btn{display:none}
 .wb-chat-head{padding:10px 12px 8px;gap:8px}.wb-chat-head>.wb-row{flex-shrink:0}.wb-chat-head .wb-btn{font-size:10px;padding:4px 6px}
 .wb-chat-title h2{font-size:13px}.wb-chat-main>.wb-web-tabs{padding:0 10px 8px;gap:4px}
 .wb-chat-thread{padding:16px 12px}.wb-chat-messages .wb-comparison-grid{grid-template-columns:minmax(0,1fr)}
 .wb-chat-question{max-width:96%}.wb-chat-composer{margin:0 9px;padding:9px;max-height:52%}.wb-chat-options{padding:5px 12px 8px}
 .wb-chat-composer .wb-web-providers{gap:7px}.wb-chat-composer .wb-row{gap:5px!important}.wb-chat-composer .wb-btn{font-size:11px}
}

.wb-web-ai .wb-chat-layout{height:calc(100dvh - 165px);min-height:540px;border:0;border-radius:0}
.wb-web-ai .wb-chat-head{min-height:48px;padding:10px 24px;border:0}.wb-web-ai .wb-chat-head h2{font-size:13px;font-weight:400;color:var(--dsw-alias-label-secondary)}
.wb-web-ai .wb-chat-round{max-width:720px;margin:0 auto 30px;width:100%}.wb-web-ai .wb-chat-thread{padding:20px 32px}.wb-web-ai .wb-chat-user{margin-bottom:18px}.wb-web-ai .wb-chat-question{max-width:90%}
.wb-web-ai .wb-web-answer{border:0;background:transparent;padding:8px 0;box-shadow:none}.wb-web-ai .wb-chat-round-tabs{display:flex;flex-wrap:wrap;gap:6px}.wb-web-ai .wb-chat-round-tabs button{font:inherit;font-size:12px;border:0;border-radius:6px;padding:6px 12px;background:transparent;color:var(--dsw-alias-label-secondary)}.wb-web-ai .wb-chat-round-tabs button[aria-selected=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.wb-web-ai .wb-chat-file-labels{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;font-size:12px}.wb-web-ai .wb-chat-file-labels span{padding:4px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px}
.wb-web-ai .wb-chat-composer{width:calc(100% - 48px);max-width:760px;align-self:center;margin:8px 24px 20px;padding:14px;max-height:50%;overflow:visible;border-radius:16px}.wb-web-ai .wb-chat-input-bar{display:flex;gap:8px;align-items:center;margin-top:6px}.wb-web-ai .wb-chat-input-bar>[aria-label="问题附件"]{max-width:55%}.wb-web-ai .wb-chat-provider-picker{margin-right:auto;position:relative;font-size:12px;color:var(--dsw-alias-label-secondary)}.wb-web-ai .wb-chat-provider-picker summary{cursor:pointer;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:6px}
.wb-web-ai .wb-chat-provider-menu{position:absolute;bottom:100%;left:0;z-index:12;width:240px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:12px;display:grid;gap:8px;box-shadow:0 5px 20px #0002}.wb-web-ai .wb-chat-provider-menu label{flex:1}.wb-web-ai .wb-chat-message-menu{position:absolute;z-index:5;background:var(--dsw-alias-bg-base);padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;display:grid;gap:6px}.wb-web-ai .wb-chat-answer-actions details{position:relative}.wb-web-ai .wb-chat-answer-actions summary{padding:4px 10px;cursor:pointer}.wb-web-ai .wb-chat-sidebar .wb-chat-session{min-height:40px;padding:10px 12px}.wb-web-ai .wb-chat-sidebar .wb-chat-session strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
@media(max-width:760px){.wb-web-ai .wb-chat-layout{height:calc(100dvh - 185px);min-height:560px}.wb-web-ai .wb-chat-thread{padding:14px}.wb-web-ai .wb-chat-composer{width:calc(100% - 20px);margin:6px 10px 14px}.wb-web-ai .wb-chat-provider-picker summary{max-width:150px}.wb-web-ai .wb-chat-provider-menu{left:-40px}}

.wb-web-ai .wb-login-backdrop{position:fixed;inset:0;background:var(--wb-dialog-scrim);z-index:1100}
.wb-web-ai .wb-login-dialog:not(.is-background){position:fixed;inset:5vh 4vw;width:auto;height:90vh;z-index:1101;display:flex;flex-direction:column;background:var(--wb-dialog-bg);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);box-shadow:var(--wb-dialog-shadow);border-radius:12px}
.wb-web-ai .wb-login-dialog:not(.is-background) .wb-website:not(.is-background-guest){flex:1;min-height:0;height:auto}.wb-web-ai .wb-login-dialog .wb-web-connection{max-height:25%;overflow:auto;flex-shrink:0}.wb-web-ai .wb-login-dialog .wb-web-notice,.wb-web-ai .wb-login-dialog .wb-web-auth{flex-shrink:0}
.wb-web-ai .wb-login-close{margin-left:auto}.wb-web-ai .wb-chat-head h2{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wb-web-ai .wb-chat-head>.wb-btn{flex-shrink:0}
@media(max-width:650px){.wb-web-ai .wb-login-dialog:not(.is-background){inset:8px;height:calc(100dvh - 16px)}}

/* Fit the chat to the host's remaining space, including its native title-bar clearance. */
.wb-root.is-web-ai{box-sizing:border-box}
.wb-web-ai .wb-login-dialog.is-background{height:100%;overflow:hidden}
.wb-root.is-web-ai .wb-scroll{display:flex;min-height:0;overflow:hidden}
.wb-root.is-web-ai .wb-chat-page{display:flex;flex:1;min-height:0;min-width:0;max-width:none;margin:0;padding:0}
.wb-root.is-web-ai .wb-web-ai{flex:1;min-height:0;gap:0}
.wb-root.is-web-ai .wb-chat-layout{flex:1;height:100%;min-height:0;max-height:none;grid-template-columns:224px minmax(0,1fr)}
.wb-root.is-web-ai .wb-toolbar{min-height:42px;padding-top:5px;padding-bottom:5px}
.wb-root.is-web-ai .wb-topnav{padding-bottom:8px}
.wb-web-ai .wb-chat-sidebar{padding:18px 12px 12px;gap:12px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 65%,var(--dsw-alias-bg-base))}
.wb-web-ai .wb-chat-sidebar .wb-chat-session{min-height:38px;padding:9px 10px}
.wb-web-ai .wb-chat-sidebar .wb-chat-session strong{font-weight:400;font-size:12px}
.wb-web-ai .wb-chat-sidebar .wb-chat-session.is-selected strong{font-weight:600}
.wb-web-ai .wb-chat-head{min-height:56px;padding:12px 24px;gap:24px}
.wb-web-ai .wb-chat-head h2{flex:0 1 auto;max-width:44ch;margin:0;font-size:13px;font-weight:500}
.wb-web-ai .wb-chat-thread{padding:16px 28px 24px;scrollbar-width:thin;scrollbar-gutter:stable both-edges}
.wb-web-ai .wb-chat-messages{max-width:760px;gap:32px}
.wb-web-ai .wb-chat-round{max-width:none;width:100%;margin:0;gap:12px}
.wb-web-ai .wb-chat-user{margin:0 0 8px}
.wb-web-ai .wb-chat-question{max-width:85%;padding:12px 16px;border-radius:16px 16px 4px 16px}
.wb-web-ai .wb-chat-question h3,.wb-web-ai .wb-chat-markdown{font-size:14px;line-height:1.75}
.wb-web-ai .wb-chat-messages .wb-web-answer{padding:0;border:0;background:transparent}
.wb-web-ai .wb-chat-round-tabs{gap:4px;align-items:center}
.wb-web-ai .wb-chat-round-tabs button{cursor:pointer;padding:6px 11px;border-radius:8px;transition:background .15s}
.wb-web-ai .wb-chat-round-tabs button:hover{background:var(--dsw-alias-bg-layer-1)}
.wb-web-ai .wb-chat-round-tabs button:focus-visible{outline:2px solid var(--dsw-alias-label-secondary);outline-offset:2px}
.wb-web-ai .wb-chat-answer-actions{margin-top:10px;gap:6px;color:var(--dsw-alias-label-secondary)}
.wb-web-ai .wb-chat-answer-actions>button,.wb-web-ai .wb-chat-answer-actions summary{border:0;background:transparent;font-size:11px;padding:5px 8px;border-radius:6px}
.wb-web-ai .wb-chat-answer-actions>button:hover,.wb-web-ai .wb-chat-answer-actions summary:hover{background:var(--dsw-alias-bg-layer-2)}
.wb-web-ai .wb-chat-answer-actions summary,.wb-web-ai .wb-chat-provider-picker summary{list-style:none}
.wb-web-ai .wb-chat-answer-actions summary::-webkit-details-marker,.wb-web-ai .wb-chat-provider-picker summary::-webkit-details-marker{display:none}
.wb-web-ai .wb-chat-file-labels span{max-width:100%;overflow-wrap:anywhere;line-height:1.5}
.wb-web-ai .wb-chat-composer{width:calc(100% - 56px);max-width:760px;margin:8px 28px 16px;padding:12px 14px;border-radius:18px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 2px 8px #00000006}
.wb-web-ai .wb-chat-composer:focus-within{border-color:var(--dsw-alias-label-secondary)}
.wb-web-ai .wb-chat-composer textarea{min-height:48px;max-height:160px;resize:none;font-size:14px;line-height:1.65}
.wb-web-ai .wb-chat-input-bar>button{min-width:32px;min-height:32px;border-radius:10px}
.wb-web-ai .wb-chat-provider-picker{min-width:0}.wb-web-ai .wb-chat-provider-picker summary{max-width:min(240px,100%)}
.wb-web-ai .wb-chat-session-list{scrollbar-width:thin}
@media(max-width:760px){
 .wb-root.is-web-ai .wb-chat-layout{grid-template-columns:minmax(0,1fr)}
 .wb-web-ai .wb-chat-sidebar{padding:8px 12px;gap:8px}
 .wb-web-ai .wb-chat-head{min-height:46px;padding:8px 14px;gap:12px}
 .wb-web-ai .wb-chat-thread{padding:12px 14px 20px;scrollbar-gutter:auto}
 .wb-web-ai .wb-chat-question{max-width:94%;padding:10px 12px}
 .wb-web-ai .wb-chat-messages{gap:28px}
 .wb-web-ai .wb-chat-composer{width:calc(100% - 24px);margin:6px 12px 12px;padding:10px 12px}
 .wb-web-ai .wb-chat-provider-picker summary{max-width:150px}
}

.wb-web-ai .wb-chat-composer textarea.wb-textarea,.wb-web-ai .wb-chat-composer textarea.wb-textarea:focus,.wb-web-ai .wb-chat-composer textarea.wb-textarea:focus-visible{border:0;outline:0;box-shadow:none;border-radius:0;background:transparent}
.wb-web-ai .wb-chat-provider-menu{width:292px;padding:8px;gap:2px;box-shadow:0 8px 28px #0003}
.wb-web-ai .wb-chat-provider-menu>.wb-row{gap:8px;min-height:36px;padding:4px 6px;border-radius:6px;flex-wrap:nowrap}
.wb-web-ai .wb-chat-provider-menu>.wb-row:hover{background:var(--dsw-alias-bg-layer-1)}
.wb-web-ai .wb-chat-provider-menu label{display:flex;align-items:center;gap:6px;min-width:0}
.wb-web-ai .wb-chat-login-state{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.wb-web-ai .wb-chat-login-state.is-authenticated{color:var(--dsw-alias-state-success-primary,#368568)}
.wb-web-ai .wb-chat-login-state.is-needs_login,.wb-web-ai .wb-chat-login-state.is-verification{color:var(--dsw-alias-state-warn-primary,#b8792b)}
.wb-web-ai .wb-chat-provider-menu>.wb-tiny{padding:8px 6px 4px;border-top:1px solid var(--dsw-alias-border-l1);margin-top:4px}
@media(max-width:400px){.wb-web-ai .wb-chat-provider-menu{width:270px;left:-48px}}
`
