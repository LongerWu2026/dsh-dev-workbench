/** Layout-only regression: synthetic data and blocked network; never attaches to a user browser. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output=process.env.LAYOUT_OUTPUT||'/tmp/workbench-assistant-sidebar';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
const sizes=[[1280,800,1280],[1800,900,1800],[800,700,800],[640,700,640],[560,700,560],[360,700,360],[360,360,360],[1280,700,600]]
async function resize([width,height,rootWidth]){
 await page.setViewportSize({width,height});await page.evaluate(rootWidth=>{document.querySelector('.wb-root').style.width=rootWidth+'px'},rootWidth)
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
}
try{
 await page.setViewportSize({width:1280,height:800})
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 const margins={}
 for(const size of sizes){
  await resize(size);await page.evaluate(()=>window.WB.go('dashboard'));await page.getByRole('heading',{name:'今日简报',exact:true}).waitFor()
  margins[size.join('-')]=await page.locator('.wb-page').first().evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {left:r.left+parseFloat(s.paddingLeft),right:r.right-parseFloat(s.paddingRight)}})
 }
 await page.evaluate(()=>{
  const WB=window.WB,now=new Date().toISOString(),conversation={id:'chat:sidebar-layout',kind:'chat',title:'保留会话、草稿和附件'},rows=[{id:'system:analysis',kind:'system',title:'消息识别'},{id:'system:radar',kind:'system',title:'AI资讯'},{id:'system:knowledge',kind:'system',title:'知识助手'},conversation]
  window.sidebarCalls=[]
  WB.actions.assistantHub=async request=>{window.sidebarCalls.push(request);if(request.action==='list')return {status:'ok',conversations:rows};if(request.action==='delta')return {status:'ok',entries:[],turnEnded:true};if(request.action!=='detail')throw Error('布局测试禁止业务操作：'+request.action);return {status:'ok',conversation:rows.find(row=>row.id===request.conversationId),sessionId:'synthetic-original-session',nativeBinding:{workspaceState:'unbound',canSend:true},messages:[{id:'answer',role:'assistant',at:now,text:'继续使用同一个会话。折叠列表不影响消息、输入和本轮附件。'}],events:[],runs:[],items:[],threads:[],confirmations:[]}}
  WB.assistant.openHub(conversation.id)
 })
 const composer=page.getByRole('textbox',{name:'助手消息'});await composer.waitFor();await page.waitForFunction(()=>!document.querySelector('[aria-label="助手消息"]').disabled)
 await composer.fill('尚未发送的草稿，在任何折叠与尺寸下都应保留。')
 await page.getByLabel('选择助手附件',{exact:true}).setInputFiles([{name:'截图.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Zy8AAAAASUVORK5CYII=','base64')},{name:'说明.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic attachment')}])
 await page.getByRole('region',{name:'本轮附件'}).waitFor();await page.evaluate(()=>{window.sidebarComposer=document.querySelector('[aria-label="助手消息"]')})
 async function measure(size,theme,stage){
  const metrics=await page.evaluate(()=>{
   const hub=document.querySelector('.wb-hub'),conversation=document.querySelector('.wb-assistant-conversation'),input=document.querySelector('.wb-assistant-input'),row=document.querySelector('[data-chat-author]'),rail=document.querySelector('.wb-hub-sidebar-rail'),nav=document.querySelector('#wb-hub-conversations'),box=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,overflow:el.scrollWidth-el.clientWidth}}
   return {hub:box(hub),conversation:box(conversation),input:box(input),row:box(row),rail:box(rail),nav:box(nav),compact:hub.classList.contains('is-compact'),id:window.WB.store.get().assistantConversationId,sameComposer:window.sidebarComposer===document.querySelector('[aria-label="助手消息"]'),draft:document.querySelector('[aria-label="助手消息"]').value,attachmentNames:[...document.querySelectorAll('.wb-assistant-attachment')].map(el=>el.getAttribute('aria-label'))}
  })
  const filters=page.getByRole('group',{name:'会话类型'})
  if(await filters.isVisible()){
   const labels=await filters.getByRole('button').allTextContents();if(labels.join('|')!=='全部|普通对话|关联事项')throw Error('会话类型选项不正确 '+labels)
   const clipped=await filters.getByRole('button').evaluateAll(buttons=>buttons.some(el=>el.scrollWidth>el.clientWidth+1));if(clipped)throw Error('会话筛选文字被裁切 '+JSON.stringify({size,theme,stage}))
   await filters.getByRole('button',{name:'关联事项',exact:true}).click();if(await page.getByRole('button',{name:'会话：保留会话、草稿和附件',exact:true}).count())throw Error('关联事项中混入普通对话')
   await filters.getByRole('button',{name:'普通对话',exact:true}).click();await page.getByRole('button',{name:'会话：保留会话、草稿和附件',exact:true}).waitFor();await filters.getByRole('button',{name:'全部',exact:true}).click()
  }
  const expected=margins[size.join('-')]
  if(Math.abs(metrics.hub.left-expected.left)>1||Math.abs(metrics.hub.right-expected.right)>1)throw Error('助手与简报左右边界不一致 '+JSON.stringify({size,expected,metrics}))
  if(metrics.id!=='chat:sidebar-layout'||!metrics.sameComposer||metrics.draft!=='尚未发送的草稿，在任何折叠与尺寸下都应保留。'||metrics.attachmentNames.length!==2)throw Error('折叠/调整宽度丢失会话、草稿或附件 '+JSON.stringify(metrics))
  for(const key of ['hub','conversation','input','row','rail','nav']){const box=metrics[key];if(box&&(box.overflow>2||box.left<metrics.hub.left-1||box.right>metrics.hub.right+1))throw Error('助手横向溢出 '+JSON.stringify({key,size,stage,metrics}))}
  if(stage!=='drawer-open'&&metrics.input.bottom>size[1]+1)throw Error('输入区被挤出窗口 '+JSON.stringify({size,metrics}))
  if(stage!=='drawer-open'&&Math.abs(metrics.input.left-metrics.row.left)>1)throw Error('聊天正文与输入区左边距不一致 '+JSON.stringify({size,metrics}))
  report.push({size,theme,stage,expected,...metrics});await page.screenshot({path:resolve(output,`${size.join('-')}-${theme}-${stage}.png`),animations:'disabled'})
 }
 for(const size of sizes)for(const theme of ['light','dark']){
  await resize(size);await page.evaluate(theme=>document.documentElement.className=theme,theme)
  const hub=page.locator('.wb-hub'),compact=await hub.evaluate(el=>el.classList.contains('is-compact'))
  if(compact){
   const close=page.getByRole('button',{name:'收起会话列表',exact:true});if(await close.count())await close.click()
   if(await page.getByRole('navigation',{name:'会话列表快捷栏'}).count())throw Error('窄屏不应保留占宽的窄栏')
   const trigger=page.getByRole('button',{name:'展开会话列表',exact:true});if(!await trigger.evaluate(el=>!!el.closest('.wb-hub-context-head')))throw Error('抽屉入口没有位于聊天标题左侧')
   await measure(size,theme,'drawer-closed');await trigger.click();await page.getByRole('navigation',{name:'助手会话列表'}).waitFor()
   if(!await hub.locator('.wb-assistant-conversation').evaluate(el=>el.inert))throw Error('抽屉打开后底层内容仍可操作')
   await measure(size,theme,'drawer-open');await page.keyboard.press('Escape');await trigger.waitFor();if(!await trigger.evaluate(el=>el===document.activeElement))throw Error('关闭抽屉后焦点未返回入口')
   await trigger.click();await page.getByRole('button',{name:'关闭会话列表'}).click({position:{x:(await hub.boundingBox()).width-8,y:50}});await measure(size,theme,'drawer-dismissed')
  }else{
   const expand=page.getByRole('button',{name:'展开会话列表',exact:true});if(await expand.count())await expand.click()
   const nav=page.getByRole('navigation',{name:'助手会话列表'}),toggle=nav.getByRole('button',{name:'收起会话列表',exact:true});if(!await toggle.evaluate(el=>!!el.closest('.wb-hub-sidebar-head')))throw Error('展开状态的折叠按钮未归属列表标题栏')
   if(await page.getByRole('group',{name:'助手工具栏'}).getByRole('button',{name:/会话列表/}).count())throw Error('列表按钮仍混入系统工具栏')
   await measure(size,theme,'expanded');await toggle.click();const rail=page.getByRole('navigation',{name:'会话列表快捷栏'});await rail.waitFor();if(Math.abs((await rail.boundingBox()).width-40)>1)throw Error('折叠窄栏宽度错误');await measure(size,theme,'collapsed')
  }
 }
 const unexpected=(await page.evaluate(()=>window.sidebarCalls)).filter(request=>!['list','detail','delta'].includes(request.action));if(unexpected.length)throw Error('折叠或选附件触发了业务操作 '+JSON.stringify(unexpected))
 if(errors.length)throw Error('页面异常 '+errors.join('; '))
 writeFileSync(resolve(output,'report.json'),JSON.stringify({cases:report.length,errors,report},null,2));console.log(JSON.stringify({cases:report.length,errors,output}))
}catch(error){await page.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({report,errors,error:String(error.stack||error)},null,2));throw error}finally{await browser.close()}
