/** Synthetic fixture only; never attaches to user chats or executes tools. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output='/tmp/workbench-assistant-tool-activity';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const row={id:'chat:tools-layout',kind:'chat',title:'目录查询'},at=new Date().toISOString(),tool={id:'read',operation:'execute_command',label:'execute_command',status:'completed',resultText:Array.from({length:60},(_,i)=>i+' synthetic-output '+('VeryLongDirectoryName'.repeat(20))).join('\n')}
  const dedicated={id:'task:task',kind:'task',title:'专用事项工具记录'}
  window.toolCalls=[];window.WB.actions.assistantHub=async request=>{window.toolCalls.push(request);if(request.action==='list')return {status:'ok',conversations:[row,dedicated]};if(request.action==='delta')return {status:'ok',entries:[],turnEnded:true};if(request.action!=='detail')throw Error('禁止测试执行操作 '+request.action);return {status:'ok',conversation:request.conversationId===dedicated.id?dedicated:row,sessionId:'synthetic',nativeBinding:{workspaceState:'unbound',canSend:true},messages:[],events:[],runs:[],items:[],threads:[],confirmations:[],retrievals:[{id:'marker-layout-knowledge',turnId:'query',status:'ok',query:'合成查询',hits:[{id:'synthetic-chunk',title:'合成资料',lineStart:1,lineEnd:2}]}],turns:[{id:'query',text:'当前目录有多少技能',at,source:'ai',status:'completed',reply:'当前目录共有 36 个技能。',replySource:'assistant',commands:[tool]}]}}
  window.WB.assistant.openHub(row.id)
 })
 const details=page.getByLabel('工具执行记录',{exact:true}),composer=page.getByRole('textbox',{name:'助手消息'});await page.getByText('当前目录共有 36 个技能。',{exact:true}).waitFor();await composer.fill('未发送草稿')
 await page.evaluate(()=>{window.originalComposer=document.querySelector('[aria-label="助手消息"]')})
 for(const width of [1280,640,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:800});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  if(await details.count())throw Error('普通聊天不应显示工具执行记录')
  if(await page.getByText(/synthetic-output/).count())throw Error('普通聊天不应显示工具原始输出')
  const measured=await page.locator('.wb-hub-turn-response').evaluate(el=>{const box=el.getBoundingClientRect();return {left:box.left,right:box.right,overflow:el.scrollWidth-el.clientWidth,sameComposer:window.originalComposer===document.querySelector('[aria-label="助手消息"]'),draft:document.querySelector('[aria-label="助手消息"]').value}})
  if(measured.left<0||measured.right>width+1||measured.overflow>2||!measured.sameComposer||measured.draft!=='未发送草稿')throw Error('普通聊天适配影响回答或草稿 '+JSON.stringify(measured))
  const footer=await page.locator('.wb-hub-turn-response').evaluate(el=>{const foot=el.querySelector('footer'),knowledge=el.querySelector('[aria-label="知识检索依据"]'),f=foot.getBoundingClientRect(),k=knowledge.getBoundingClientRect(),card=el.getBoundingClientRect();return {text:foot.textContent.trim(),height:f.height,gap:f.top-k.bottom,bottomPadding:card.bottom-f.bottom,belowKnowledge:card.bottom-k.bottom,hasStatus:!!foot.querySelector('[role="status"]'),emptyArtifacts:!!el.querySelector('.wb-hub-office-artifacts:empty')}})
  if(footer.text!=='AI'||footer.hasStatus||footer.emptyArtifacts||footer.height>16.5||footer.gap>8.5||footer.belowKnowledge>36||footer.bottomPadding>12)throw Error('消息底部标记或间距不紧凑 '+JSON.stringify({width,theme,footer}))
  report.push({width,theme,kind:'chat',...measured,footer});await page.screenshot({path:resolve(output,`plain-${width}-${theme}.png`)})
 }
 await page.evaluate(()=>window.WB.assistant.openHub('task:task'));await details.waitFor();await composer.fill('未发送草稿')
 await page.evaluate(()=>{window.originalComposer=document.querySelector('[aria-label="助手消息"]')})
 for(const width of [1280,640,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:800});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  if(await details.getAttribute('open')!==null)await details.locator('summary').click()
  if(await details.locator('pre').isVisible())throw Error('工具输出默认展开')
  if(await page.getByText('已识别的操作',{exact:true}).count())throw Error('普通聊天仍出现业务识别文案')
  for(const expanded of [false,true]){
   if(expanded)await details.locator('summary').click()
   const measured=await details.evaluate(el=>{const box=el.getBoundingClientRect(),pre=el.querySelector('pre'),reply=el.closest('article'),r=reply.getBoundingClientRect();return {left:box.left,right:box.right,width:box.width,replyLeft:r.left,replyRight:r.right,overflow:el.scrollWidth-el.clientWidth,outputHeight:pre.clientHeight,outputOverflow:pre.scrollWidth-pre.clientWidth,color:getComputedStyle(pre).color,replyColor:getComputedStyle(reply).color,sameComposer:window.originalComposer===document.querySelector('[aria-label="助手消息"]'),draft:document.querySelector('[aria-label="助手消息"]').value}})
   if(measured.left<0||measured.right>width+1||measured.overflow>2||measured.left<measured.replyLeft-1||measured.right>measured.replyRight+1||expanded&&(measured.outputHeight>281||measured.outputOverflow>2))throw Error('工具记录溢出 '+JSON.stringify({width,theme,expanded,measured}))
   if(!measured.sameComposer||measured.draft!=='未发送草稿')throw Error('工具折叠或适配影响草稿')
   report.push({width,theme,expanded,...measured});await page.screenshot({path:resolve(output,`${width}-${theme}-${expanded?'open':'closed'}.png`)})
  }
 }
 const calls=await page.evaluate(()=>window.toolCalls);if(calls.some(row=>!['list','detail','delta'].includes(row.action)))throw Error('折叠触发操作')
 if(errors.length)throw Error(errors.join('; '))
 writeFileSync(resolve(output,'report.json'),JSON.stringify({cases:report.length,errors,report},null,2));console.log(JSON.stringify({cases:report.length,errors,output}))
}catch(error){await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});throw error}finally{await browser.close()}
