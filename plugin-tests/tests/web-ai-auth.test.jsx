import {describe,it,expect} from 'vitest'
import {JSDOM} from 'jsdom'
import {webAIAuthScript} from '../../src/shared/web-ai-auth.ts'
import {WEB_AI_PROVIDERS} from '../../src/shared/web-ai.ts'

function observe(html='',provider='kimi',url){
 const dom=new JSDOM(html,{url:url||WEB_AI_PROVIDERS.find(p=>p.id===provider).url,runScripts:'outside-only'})
 dom.window.Element.prototype.getClientRects=()=>[{}]
 try{return dom.window.eval(webAIAuthScript(provider))}finally{dom.window.close()}
}
const login='<form><h2>登录</h2><input type="tel" value="PRIVATE-PHONE"><button>登录</button></form>'

describe('网页 AI 登录状态只读识别',()=>{
 it.each(['<img src="PRIVATE.png">PRIVATE-NAME PRIVATE-TEAM','<img alt="PRIVATE-NAME" src="PRIVATE.png">'])('豆包工作账户菜单与侧栏设置同级，项目菜单与匿名入口不能冒充：%s',identity=>{
  const account='<button class="min-w-0 flex-1 w-full flex h-48" aria-haspopup="menu">'+identity+'</button>'
  const live='<div class="flex items-stretch gap-2 w-full h-full">'+account+'<button data-testid="sidebar_footer_setting_entry">设置</button></div>'
  expect(observe(live,'doubao').status).toBe('authenticated');expect(JSON.stringify(observe(live,'doubao'))).not.toContain('PRIVATE')
  expect(observe(live.replace('sidebar_footer_setting_entry','project_setting'),'doubao').status).toBe('unknown')
  expect(observe(live.replace(identity,'<img alt="头像">登录'),'doubao').status).toBe('unknown')
  expect(observe(live.replace(identity,'<img alt="头像">'),'doubao').status).toBe('unknown')
  expect(observe(live.replace(account,account+account),'doubao').status).toBe('unknown')
  expect(observe(live.replace(account,'<section>'+account+'</section>'),'doubao').status).toBe('unknown')
  expect(observe('<div hidden>'+live+'</div>','doubao').status).toBe('unknown')
  expect(observe('<div data-testid="send_message">'+live+'</div>','doubao').status).toBe('unknown')
  expect(observe(live+login,'doubao').status).toBe('needs_login')
 })
 it('千问头像替代文字可以提供账户名称，不要求额外展示昵称文本',()=>{
  const live='<div class="tongyiDI-view-container"><button class="min-w-0 flex-1" aria-haspopup="menu"><img alt="PRIVATE-Qwen3390"></button></div>'
  expect(observe(live,'qianwen').status).toBe('authenticated');expect(JSON.stringify(observe(live,'qianwen'))).not.toContain('PRIVATE')
  expect(observe(live.replace('PRIVATE-Qwen3390','Qwen'),'qianwen').status).toBe('unknown')
  expect(observe(live.replace('PRIVATE-Qwen3390','登录'),'qianwen').status).toBe('unknown')
  expect(observe(live.replace('alt="PRIVATE-Qwen3390"',''),'qianwen').status).toBe('unknown')
 })
 it('账户菜单中的退出文字可独立于快捷键标题识别，普通页面文字仍无效',()=>{
  expect(observe('<div role="menu"><div role="menuitem" title="⇧⌘Q"><span>退出登录</span></div></div>','doubao').status).toBe('authenticated')
  expect(observe('<div>退出登录</div>','doubao').status).toBe('unknown')
 })
 it.each([
  ['yuanbao','<div class="yb-new-chat-entry"><div role="button" class="yb-new-chat-entry__item">新建对话</div></div><div class="yb-nav__user"><div class="yb-common-nav__ft"><div class="yb-common-nav__ft__avatar"><div class="image-container"><img src="PRIVATE.png"></div></div></div></div>'],
  ['qianwen','<div class="tongyiDI-view-container"><div><button class="flex min-w-0 flex-1 cursor-pointer items-center" aria-haspopup="menu"><img src="PRIVATE.png"><span>PRIVATE-ACCOUNT</span></button></div></div>'],
 ])('%s 实站账号结构支持无账号标签的入口，并排除匿名、隐藏和消息伪造',(provider,live)=>{
  expect(observe(live,provider).status).toBe('authenticated')
  expect(JSON.stringify(observe(live,provider))).not.toContain('PRIVATE')
  expect(observe(live.replace(/<img[^>]*>/g,''),provider).status).toBe('unknown')
  expect(observe('<div hidden>'+live+'</div>',provider).status).toBe('unknown')
  expect(observe('<article>'+live+'</article>',provider).status).toBe('unknown')
  expect(observe(live+login,provider).status).toBe('needs_login')
  expect(observe(live,provider==='yuanbao'?'qianwen':'yuanbao').status).toBe('unknown')
  if(provider==='yuanbao')expect(observe(live.replace('新建对话','普通文本'),provider).status).toBe('unknown')
  else{expect(observe(live.replace('PRIVATE-ACCOUNT','登录'),provider).status).toBe('unknown');expect(observe(live.replace('aria-haspopup="menu"',''),provider).status).toBe('unknown');expect(observe(live.replace('<img','<img hidden'),provider).status).toBe('authenticated')}
 })
 it('智谱实站折叠侧栏识别专属账户入口，普通头像、登录入口和消息不能冒充',()=>{
  const account='<div class="userInfoBar collapsed sidebar-mode"><div class="sidebar-user-entry el-tooltip__trigger"><div class="sidebar-avatar"><img src="avatar.png"></div></div></div>'
  const live='<aside class="el-aside aside-container collapse-aside">'+account+'</aside>'
  expect(observe(live,'glm').status).toBe('authenticated')
  expect(observe(account,'glm').status).toBe('unknown')
  expect(observe(live.replace('<img src="avatar.png">',''),'glm').status).toBe('unknown')
  expect(observe(live.replace('<img src="avatar.png">','<img src="avatar.png"><span>登录</span>'),'glm').status).toBe('unknown')
  expect(observe('<div hidden>'+live+'</div>','glm').status).toBe('unknown')
  expect(observe('<div class="answer">'+live+'</div>','glm').status).toBe('unknown')
  expect(observe(live+login,'glm').status).toBe('needs_login')
 })
 it.each([['glm','answer'],['glm','message-assistant'],['doubao','unused'],['yuanbao','agent-chat__bubble--human'],['qianwen','message-card-wrap question']])('%s 的消息卡片不能冒充账号或登录表单',(provider,className)=>{
  const attrs=provider==='doubao'?'data-testid="receive_message"':'class="'+className+'"'
  const fake='<div '+attrs+'><button aria-label="账户菜单" aria-haspopup="menu">账号</button>'+login+'</div>'
  expect(observe(fake,provider).status).toBe('unknown')
 })
 it.each(['https://chatgpt.com/auth/login_with?state=DO-NOT-PERSIST','https://auth.openai.com/oauth/authorize?state=DO-NOT-PERSIST','https://accounts.google.com/v3/signin/identifier?state=DO-NOT-PERSIST'])('ChatGPT 登录跳转 %s 不误报未知或登录成功',url=>{
  const result=observe('<h1>继续登录</h1>','chatgpt',url);expect(result.status).toBe('needs_login');expect(JSON.stringify(result)).not.toContain('DO-NOT-PERSIST')
 })
 it('智谱折叠侧栏的账户弹层以积分、设置、退出三项联合识别',()=>{
  const panel='<div><span>PRIVATE</span><div>积分 100</div><div>主题外观</div><div>退出登录</div></div>'
  expect(observe(panel,'glm').status).toBe('authenticated');expect(observe('<article>'+panel+'</article>','glm').status).toBe('unknown');expect(observe(panel.replace('主题外观','普通内容'),'glm').status).toBe('unknown')
 })
 it('智谱实站账户积分区域须同时有新对话和历史导航，结果不泄露身份',()=>{
  const account='<div><span>PRIVATE-USER</span> <span>积分</span> <span>123.45</span></div>',navigation='<aside><div>新对话</div><div>最近对话</div></aside>'
  expect(observe(account+navigation,'glm').status).toBe('authenticated');expect(JSON.stringify(observe(account+navigation,'glm'))).not.toContain('PRIVATE-USER');expect(JSON.stringify(observe(account+navigation,'glm'))).not.toContain('123.45')
  expect(observe(account,'glm').status).toBe('unknown');expect(observe('<article>'+account+'</article>'+navigation,'glm').status).toBe('unknown');expect(observe('<div hidden>'+account+'</div>'+navigation,'glm').status).toBe('unknown')
 })
 it('智谱实站普通容器里的手机号与短信字段可识别，不读取值，消息内表单除外',()=>{
  const fields='<div><input placeholder="请输入手机号" value="PRIVATE"><input placeholder="请输入短信验证码" value="PRIVATE"><button>登录</button></div>'
  expect(observe(fields,'glm').status).toBe('needs_login');expect(JSON.stringify(observe(fields,'glm'))).not.toContain('PRIVATE')
  expect(observe('<article>'+fields+'</article>','glm').status).toBe('unknown');expect(observe(fields.replace('<div>','<div hidden>'),'glm').status).toBe('unknown')
 })
 it.each(WEB_AI_PROVIDERS.map(p=>[p.id]))('%s 匿名编辑器不代表已登录',provider=>{
  const state=observe('<textarea placeholder="开始对话"></textarea><button>登录</button>',provider)
  expect(state.status).toBe('unknown');expect(state.note).toContain('待实站验证')
 })
 it.each(WEB_AI_PROVIDERS.map(p=>[p.id]))('%s 可见登录表单要求本人登录',provider=>{
  expect(observe(login,provider).status).toBe('needs_login')
 })
 it('普通用户消息提登录、个人中心和退出登录不会影响状态',()=>{
  expect(observe('<article data-message-author-role="user">登录失败怎么处理？退出登录后进个人中心。'+login+'<button aria-label="账户菜单" aria-haspopup="menu">菜单</button></article><textarea></textarea>').status).toBe('unknown')
 })
 it.each(['hidden','aria-hidden="true"','inert','style="display:none"','style="visibility:hidden"','style="opacity:0"'])('隐藏登录层 %s 被忽略',attribute=>{
  expect(observe('<section '+attribute+'>'+login+'</section><textarea></textarea>').status).toBe('unknown')
 })
 it('登录层中的隐藏账号字段不能当作可见表单',()=>{
  expect(observe('<div role="dialog"><h2>登录</h2><input type="password" hidden><button>登录</button></div>').status).toBe('unknown')
 })
 it('可见验证码优先于登录路由和账户菜单',()=>{
  const html='<div class="captcha-modal">验证</div><button aria-label="账户菜单" aria-haspopup="menu">菜单</button>'+login
  expect(observe(html,'kimi','https://www.kimi.com/login').status).toBe('verification')
 })
 it('验证码必须可见，消息中提到安全验证也不计入',()=>{
  expect(observe('<div class="captcha-modal" hidden></div><article><div role="dialog"><h2>安全验证</h2></div></article>'+login).status).toBe('needs_login')
 })
 it('有明确标题的可见安全验证弹窗可识别',()=>{
  expect(observe('<div role="dialog"><h2>安全验证</h2></div>').status).toBe('verification')
 })
 it.each(['https://evil.example/login','https://www.kimi.com.evil.example/login','http://www.kimi.com/login','https://www.kimi.com:444/login','https://someone@www.kimi.com/login'])('拒绝不匹配的页面 %s',url=>{
  expect(observe(login,'kimi',url).status).toBe('unknown')
 })
 it('每个厂商仅接受自己在 provider 定义中的 hosts',()=>{
  for(const provider of WEB_AI_PROVIDERS){
   for(const host of provider.hosts)expect(observe(login,provider.id,'https://'+host+'/').status).toBe('needs_login')
   for(const other of WEB_AI_PROVIDERS.filter(p=>p.id!==provider.id))expect(observe(login,provider.id,other.url).status).toBe('unknown')
  }
 })
 it('Logo、头像或普通个人中心链接不能确认已登录',()=>{
  expect(observe('<nav><img alt="Kimi" src="logo.png"><img alt="用户头像" src="avatar.png"><a href="/account">个人中心</a></nav>').status).toBe('unknown')
 })
 it('明确个人账户菜单入口可以确认已登录，但不返回身份信息',()=>{
  const state=observe('<aside><button aria-label="账户菜单" aria-haspopup="menu"><img alt="PRIVATE-NAME" src="https://example.org/PRIVATE-AVATAR">PRIVATE-EMAIL@example.org</button></aside>')
  expect(state.status).toBe('authenticated');expect(JSON.stringify(state)).not.toMatch(/PRIVATE|example\.org/)
  expect(Object.keys(state).sort()).toEqual(['evidence','note','status'])
 })
 it('ChatGPT 的明确个人菜单语义支持英文',()=>{
  expect(observe('<button aria-label="Open profile menu" aria-haspopup="menu">P</button>','chatgpt').status).toBe('authenticated')
 })
 it('可见账户菜单中有退出登录操作可以确认已登录',()=>{
  expect(observe('<div role="menu"><button role="menuitem">退出登录</button></div>').status).toBe('authenticated')
  expect(observe('<button>退出登录</button>').status).toBe('unknown')
 })
 it('隐藏账户菜单和无菜单语义的头像按钮不代表登录',()=>{
  expect(observe('<button aria-label="账户菜单">头像</button><div role="menu" hidden><button>退出登录</button></div>').status).toBe('unknown')
 })
 it('Kimi 无菜单标签时要求头像姓名匹配、相邻升级、历史与主导航同时存在',()=>{
  const navigation='<nav aria-label="Primary Navigation"></nav><a href="/chat/history">查看全部</a>'
  const account='<div><button><img alt="Synthetic Account">Synthetic Account</button><button>升级</button></div>'
  const state=observe(navigation+account)
  expect(state.status).toBe('authenticated');expect(JSON.stringify(state)).not.toContain('Synthetic Account')
  expect(observe(navigation.replace('href="/chat/history"','href="https://kimi.com/chat/history"')+account).status).toBe('authenticated')
  expect(observe(navigation.replace('/chat/history','/chat/11111111-2222-4333-8444-555555555555')+account).status).toBe('authenticated')
  expect(observe(navigation.replace('href="/chat/history"','href="https://outside.example/chat/history"')+account).status).toBe('unknown')
  expect(observe(navigation+'<div><div><button><img alt="Synthetic Account"><span>Synthetic Account</span><span hidden>Hidden label</span></button></div><button>升级</button></div>').status).toBe('authenticated')
  expect(observe(account).status).toBe('unknown')
  expect(observe(navigation+account.replace('alt="Synthetic Account"','alt="Other Account"')).status).toBe('unknown')
  expect(observe(navigation+account.replace('<button>升级</button>','')).status).toBe('unknown')
  expect(observe(navigation+account.replaceAll('Synthetic Account','Kimi')).status).toBe('unknown')
  expect(observe(navigation+'<article>'+account+'</article>').status).toBe('unknown')
  expect(observe('<div hidden>'+navigation+'</div>'+account).status).toBe('unknown')
 })
 it.each([['kimi','/login'],['glm','/auth/login'],['doubao','/login'],['yuanbao','/login'],['qianwen','/#/login'],['chatgpt','/auth/login']])('%s 明确登录路由 %s 要求登录', (provider,path)=>{
  const origin=new URL(WEB_AI_PROVIDERS.find(p=>p.id===provider).url).origin
  expect(observe('',provider,origin+path).status).toBe('needs_login')
 })
 it('聊天路径或查询文本提到 login 不是登录路由',()=>{
  expect(observe('','kimi','https://www.kimi.com/chat/login?topic=login').status).toBe('unknown')
 })
 it('未知厂商不能构造脚本',()=>{
  expect(()=>webAIAuthScript('unknown')).toThrow('不支持')
  expect(()=>webAIAuthScript('__proto__')).toThrow('不支持')
 })
 it('探测不读取 cookie、存储、输入值，也不修改 DOM',()=>{
  const dom=new JSDOM(login,{url:'https://www.kimi.com/',runScripts:'outside-only'})
  dom.window.Element.prototype.getClientRects=()=>[{}]
  const forbidden=()=>{throw new Error('credential access')}
  Object.defineProperty(dom.window.document,'cookie',{get:forbidden})
  Object.defineProperty(dom.window,'localStorage',{get:forbidden})
  Object.defineProperty(dom.window,'sessionStorage',{get:forbidden})
  Object.defineProperty(dom.window.HTMLInputElement.prototype,'value',{get:forbidden})
  const before=dom.window.document.documentElement.outerHTML
  try{
   const state=dom.window.eval(webAIAuthScript('kimi'))
   expect(state.status).toBe('needs_login');expect(JSON.stringify(state)).not.toContain('PRIVATE')
   expect(dom.window.document.documentElement.outerHTML).toBe(before)
  }finally{dom.window.close()}
 })
})
