import {webAIProvider} from './web-ai.js'
import {WEB_AI_ADAPTERS} from './web-ai-adapters.js'

/** Explicit compatibility inspection: structural metadata only, never account text or field values. */
export function webAIAuthInspectionScript(providerId:string){
 const provider=webAIProvider(providerId),adapter=WEB_AI_ADAPTERS[provider.id]
 return '('+inspectAccountStructure.toString()+')('+JSON.stringify({hosts:provider.hosts,messages:[...(adapter.roots||[]),...(adapter.users||[])]})+')'
}
function inspectAccountStructure(req:{hosts:readonly string[];messages:string[]}){
 const url=new URL(location.href)
 if(url.protocol!=='https:'||url.port||url.username||url.password||!req.hosts.includes(url.hostname))return {supported:false}
 const excluded=['article','[data-message-author-role]','[class*="markdown"]',...req.messages].join(',')
 const visible=(el:Element)=>!!el.getClientRects().length&&!el.closest('[hidden],[inert],[aria-hidden="true"]')&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none'
 const classes=(el:Element)=>[...el.classList].filter(value=>/^[a-zA-Z_][\w-]{0,70}$/.test(value)&&!/(?:token|secret|session|\d{7})/i.test(value)).sort((a,b)=>Number(/avatar|account|profile|user.?info|user.?menu/i.test(b))-Number(/avatar|account|profile|user.?info|user.?menu/i.test(a))).slice(0,5)
 const known=['登录','登录/注册','退出登录','退出账号','设置','个人中心','主题外观','新对话','最近对话','历史对话','历史记录','新建对话']
 const label=(el:Element)=>{const value=(el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent||'').trim();return known.includes(value)?value:''}
 const candidates=[...document.querySelectorAll('button,[role="button"],[aria-haspopup="menu"],[class*="avatar"],[class*="Avatar"],[class*="user-info"],[class*="userInfo"],[class*="account"],[class*="profile"]')].filter(el=>visible(el)&&!el.closest(excluded)).filter(el=>el.getAttribute('aria-haspopup')==='menu'||/avatar|account|profile|user.?info|user.?menu/i.test(el.className?.toString()||'')||!!label(el)||!!el.querySelector('img')).slice(0,24)
 const nodes=candidates.map(el=>({tag:el.tagName,classes:classes(el),testId:/^[a-zA-Z][a-zA-Z_-]{0,70}$/.test(el.getAttribute('data-testid')||'')&&!/(?:token|secret|session)/i.test(el.getAttribute('data-testid')||'')?el.getAttribute('data-testid'):'',role:el.getAttribute('role')||'',popup:el.getAttribute('aria-haspopup')||'',label:label(el),image:!!el.querySelector('img')||el.tagName==='IMG',children:[...el.querySelectorAll('img,svg,[class*="avatar"],[class*="Avatar"],[role="img"]')].slice(0,8).map(child=>({tag:child.tagName,classes:classes(child),role:child.getAttribute('role')||''})),parents:[el.parentElement,el.parentElement?.parentElement,el.parentElement?.parentElement?.parentElement].filter(Boolean).map(parent=>({tag:parent!.tagName,classes:classes(parent!)}))}))
 const resources=[...new Set(performance.getEntriesByType('resource').flatMap(entry=>{try{const url=new URL(entry.name);return req.hosts.includes(url.hostname)&&/user|account|profile|login|auth|passport/i.test(url.pathname)&&! /\.(?:js|css|png|svg|jpg|jpeg|woff2?)$/i.test(url.pathname)?[url.pathname.split('/').map(part=>!part||/^(?:api|v[0-9]|web|user|users|account|accounts|profile|login|auth|passport|info|me|userinfo|user_info|userInfo|getUserInfo|current|detail|status|check|session|user-api|chatglm)$/i.test(part)?part:':segment').join('/')]:[]}catch{return []}}))].slice(-16)
 return {supported:true,nodes,resources}
}
