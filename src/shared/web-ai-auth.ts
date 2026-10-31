import {webAIProvider} from './web-ai.js'

export type WebAIAuthenticationStatus='authenticated'|'needs_login'|'verification'|'unknown'
export interface WebAIAuthentication {status:WebAIAuthenticationStatus;note:string;evidence:string[]}
export interface WebAIAuthenticationRequest {providerId:string;hosts:readonly string[]}

/** Read-only, serialized into the guest. Never inspect credentials or mutate the page. */
export function observeWebAIAuthentication(req:WebAIAuthenticationRequest):WebAIAuthentication {
 const result=(status:WebAIAuthenticationStatus,note:string,...evidence:string[]):WebAIAuthentication=>({status,note,evidence})
 // Keep site rules explicit. An editor, a logo or an avatar alone proves no login state.
 // These semantic rules remain conservative until each site's live UI is verified.
 const sites:Record<string,{routes:RegExp;accounts:RegExp}>={
  kimi:{routes:/^\/(?:login|sign[-_]?in)(?:\/|$)/i,accounts:/^(?:账户菜单|账号菜单|个人菜单|个人中心|用户菜单)$/},
  glm:{routes:/^\/(?:login|auth\/login)(?:\/|$)/i,accounts:/^(?:账户菜单|账号菜单|个人菜单|个人中心|用户菜单)$/},
  doubao:{routes:/^\/(?:login|auth\/login)(?:\/|$)/i,accounts:/^(?:账户菜单|账号菜单|个人菜单|个人中心|用户菜单)$/},
  yuanbao:{routes:/^\/(?:login|auth\/login)(?:\/|$)/i,accounts:/^(?:账户菜单|账号菜单|个人菜单|个人中心|用户菜单)$/},
  qianwen:{routes:/^\/(?:login|auth\/login)(?:\/|$)/i,accounts:/^(?:账户菜单|账号菜单|个人菜单|个人中心|用户菜单)$/},
  chatgpt:{routes:/^\/(?:login|auth\/(?:login|signin|sign-in))(?:\/|$)/i,accounts:/^(?:open (?:profile|account|user) menu|(?:profile|account|user) menu|打开个人资料菜单|账户菜单|个人菜单)$/i},
 }
 const site=Object.prototype.hasOwnProperty.call(sites,req.providerId)?sites[req.providerId]:undefined
 if(!site)return result('unknown','不支持此厂商的登录状态识别。','未知厂商')
 const pageUrl=new URL(location.href)
 if(pageUrl.protocol!=='https:'||pageUrl.port||pageUrl.username||pageUrl.password||!req.hosts.includes(pageUrl.hostname))return result('unknown','当前页面不在所选厂商的聊天官网，暂不能确认登录状态。','官网域名不匹配')
 const visible=(el:Element)=>{
  if(!el.getClientRects().length&&getComputedStyle(el).display!=='contents'||el.closest('[hidden],[aria-hidden="true"],[inert]'))return false
  for(let node:Element|null=el;node;node=node.parentElement){
   const style=getComputedStyle(node)
   if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||style.opacity==='0'||node.matches('.sr-only,.visually-hidden,.screen-reader-only'))return false
   if(style.display!=='contents'){
    const rect=node.getBoundingClientRect()
    if(/hidden|clip/.test(style.overflowY)&&rect.height===0||/hidden|clip/.test(style.overflowX)&&rect.width===0)return false
   }
  }
  return true
 }
 const transcript='article,[data-message-author-role],[data-testid*="conversation-turn"],[data-testid="send_message"],[data-testid="receive_message"],[class*="markdown"],.segment-user,.segment-assistant,[class*="message-content"],.agent-chat__bubble--human,.agent-chat__bubble--ai'
 const find=(selectors:string,root:ParentNode=document)=>[...root.querySelectorAll(selectors)].filter(el=>!el.closest(transcript)&&visible(el))
 const text=(el:Element)=>((el as HTMLElement).innerText||el.textContent||'').replace(/\s+/g,' ').trim()
 const label=(el:Element)=>el.getAttribute('aria-label')?.trim()||el.getAttribute('title')?.trim()||text(el)
 const dialogs=find('[role="dialog"],dialog,[class*="login-modal"],[class*="loginModal"]')
 const securityWidgets=find('#aliyunCaptcha-window-popup,#aliyunCaptcha-popup,.baxia-dialog,iframe[src*="baxia"],iframe[src*="captcha"],iframe[src*="/_____tmd_____"],[class*="geetest_panel"],[class*="captcha-modal"]')
 const securityDialog=dialogs.some(dialog=>find('h1,h2,h3,[role="heading"]',dialog).some(el=>/^(?:安全验证|人机验证|请完成安全验证|验证您是真人|verify (?:you are|you're) human|security verification)$/i.test(text(el))))
 if(securityWidgets.length||securityDialog)return result('verification','官网需要本人完成安全验证，请在原页面处理。','可见安全验证控件')
 const route=location.pathname==='/'&&location.hash.startsWith('#/')?location.hash.slice(1).split(/[?#]/)[0]:location.pathname
 if(site.routes.test(route))return result('needs_login','官网正在登录页面，请在原页面完成登录。','官网登录路由')
 const loginLabel=/^(?:登录|登录\/注册|登录或注册|登录并继续|立即登录|手机号登录|账号登录|扫码登录|微信登录|sign in|log in|login|continue with (?:email|google|apple|microsoft))$/i
 const forms=[...new Set([...dialogs,...find('form,[class*="login-panel"],[class*="loginPanel"],[data-testid="login-form"]')])]
 const loginForm=forms.some(form=>{
  const intent=find('button,[role="button"],h1,h2,h3,[role="heading"],input[type="submit"]',form).some(el=>loginLabel.test(label(el)))
  const fields=find('input[type="tel"],input[type="password"],input[type="email"],input[autocomplete="username"],input[autocomplete="one-time-code"],iframe[src*="login"],[class*="qrcode"],[class*="qr-code"]',form)
  return intent&&fields.length>0
 })
 if(loginForm)return result('needs_login','官网显示登录表单，请在原页面完成登录。','可见登录表单')
 // Live GLM uses an ordinary container and text inputs rather than a form/tel field.
 // Require both explicit fields and a login action; never read field values.
 if(req.providerId==='glm'&&find('input[placeholder="请输入手机号"]').length&&find('input[placeholder="请输入短信验证码"]').length&&find('button,[role="button"]').some(el=>loginLabel.test(label(el))))return result('needs_login','官网显示手机号和短信验证码登录框，请在原页面完成登录。','智谱可见手机号及短信登录框')
 // A logged-in menu has explicit account semantics and menu behavior. Do not
 // expose its nickname, email, avatar address, or any other identity attributes.
 const accountTrigger=find('button,[role="button"]').some(el=>{
  const semantic=site.accounts.test(el.getAttribute('aria-label')?.trim()||el.getAttribute('title')?.trim()||'')
  return semantic&&(el.getAttribute('aria-haspopup')==='menu'||el.getAttribute('aria-haspopup')==='true')
 })
 const accountMenu=find('[role="menu"],[role="dialog"][aria-label="账户菜单"],[role="dialog"][aria-label="Account menu"]').some(menu=>find('button,[role="menuitem"],a',menu).some(el=>/^(?:退出登录|退出账号|退出账户|log out|sign out)$/i.test(label(el))))
 if(accountTrigger||accountMenu)return result('authenticated','官网显示已登录的账户菜单。',accountTrigger?'可见个人账户菜单入口':'可见账户退出菜单')
 if(req.providerId==='glm'){
  // Verified live sidebar: account name + points, together with chat/history navigation.
  // Match only compact visible elements outside messages; return no identity or balance.
  const leaves=find('div,span,button,a')
  const accountPanel=leaves.some(el=>el.querySelectorAll('*').length<80&&find('div,span,button,a',el).some(child=>text(child)==='退出登录')&&find('div,span,button,a',el).some(child=>text(child)==='主题外观')&&/积分\s*[\d,.]+/.test(text(el)))
  if(accountPanel)return result('authenticated','官网显示账户积分、外观设置及退出登录菜单。','智谱账户退出面板')
  const navigation=leaves.some(el=>text(el)==='新对话')&&leaves.some(el=>text(el)==='最近对话')
  const profile=leaves.some(el=>el.querySelectorAll('*').length<15&&/^\S.{0,59}\s+积分\s+[\d,.]+$/.test(text(el)))
  if(profile&&navigation)return result('authenticated','官网显示账户积分区域和历史会话导航。','智谱账户区域及历史导航')
 }
 // Kimi's live account trigger has no account aria-label. Require the matching avatar/name pair,
 // the adjacent upgrade action AND the site's visible history/navigation structure; never an avatar alone.
 if(req.providerId==='kimi'){
  const history=find('a[href]').some(el=>{try{const target=new URL(el.getAttribute('href')||'',pageUrl);return target.protocol==='https:'&&!target.port&&!target.username&&!target.password&&req.hosts.includes(target.hostname)&&/^\/chat\/(?:history|[a-zA-Z0-9_-]{12,64})\/?$/.test(target.pathname)}catch{return false}})
  const navigation=find('[aria-label="Primary Navigation"]').length>0
  let hasAvatar=false,hasUpgrade=false
  const account=find('button,[role="button"]').some(el=>{
   const avatar=find('img[alt],img[aria-label]',el).find(image=>{
    const name=(image.getAttribute('alt')||image.getAttribute('aria-label')||'').trim()
    return !!name&&!/^(?:kimi|logo|登录|log ?in|sign in)$/i.test(name)&&(text(el)===name||find('span,p,div',el).some(leaf=>!leaf.children.length&&text(leaf)===name))
   })
   if(!avatar)return false
   hasAvatar=true
   for(let parent=el.parentElement,depth=0;parent&&depth<3;parent=parent.parentElement,depth++){
    const siblings=find('button,[role="button"]',parent)
    if(siblings.length<=4&&siblings.some(other=>other!==el&&/^(?:升级|upgrade)$/i.test(label(other)))){hasUpgrade=true;return true}
   }
   return false
  })
  if(account&&history&&navigation)return result('authenticated','官网显示匹配的账户头像、账户入口和历史导航。','Kimi账户结构及历史导航')
  return result('unknown','暂未识别到可靠的登录状态，请在官网核对；待实站验证。',...Object.entries({导航:navigation,历史:history,头像:hasAvatar,升级:hasUpgrade}).map(([key,value])=>'Kimi检查:'+key+'='+(value?1:0)))
 }
 return result('unknown','暂未识别到可靠的登录状态，请在官网核对；待实站验证。','缺少可靠登录证据')
}

/** The host supplies no arbitrary origins or selectors. Unknown providers throw. */
export function webAIAuthScript(providerId:string):string {
 const provider=webAIProvider(providerId)
 return '('+observeWebAIAuthentication.toString()+')('+JSON.stringify({providerId:provider.id,hosts:provider.hosts})+')'
}
