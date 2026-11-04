/** Isolated shipped-client fixture; no model, user profile or external network. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output='/tmp/workbench-knowledge-on-demand';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const row={id:'chat:on-demand-layout',kind:'chat',title:'按需知识验收'},at=new Date().toISOString()
  window.fixtureKnowledgeUsed=false;window.knowledgeLayoutCalls=[]
  window.WB.actions.assistantHub=async request=>{window.knowledgeLayoutCalls.push(request);if(request.action==='list')return {status:'ok',conversations:[row]};if(request.action!=='detail')throw Error('布局测试禁止业务操作 '+request.action);const used=window.fixtureKnowledgeUsed,retrieval={id:'same-retrieval',turnId:'same-turn',mode:'auto',scope:{},status:used?'ok':'deferred',hits:used?[{id:'synthetic-chunk',title:'验收规范',lineStart:1,lineEnd:2}]:[]};return {status:'ok',conversation:row,sessionId:'synthetic',nativeBinding:{workspaceState:'unbound',canSend:true},messages:[],events:[],runs:[],items:[],threads:[],confirmations:[],retrievals:[retrieval],turns:[{id:'same-turn',text:'说明当前问题',at,source:'ai',status:'completed',reply:'这是正常的回答。',commands:[]}]}}
  window.WB.assistant.openHub(row.id)
 })
 const composer=page.getByRole('textbox',{name:'助手消息'});await page.getByText('这是正常的回答。',{exact:true}).waitFor();await composer.fill('保留未发送草稿');await page.evaluate(()=>{window.originalComposer=document.querySelector('[aria-label="助手消息"]')})
 for(const width of [1280,640,360])for(const theme of ['light','dark'])for(const used of [false,true]){
  await page.setViewportSize({width,height:800});await page.evaluate(({theme,used})=>{document.documentElement.className=theme;window.fixtureKnowledgeUsed=used},{theme,used});await page.getByRole('button',{name:'刷新进度',exact:true}).click()
  await page.waitForFunction(used=>!!document.querySelector('[aria-label="知识检索依据"]')===used,used)
  if(await page.getByText('本轮未命中知识库资料',{exact:true}).count())throw Error('未查询知识不应显示未命中')
  const box=await page.locator('.wb-hub-turn-response').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,overflow:el.scrollWidth-el.clientWidth,sameInput:window.originalComposer===document.querySelector('[aria-label="助手消息"]'),draft:document.querySelector('[aria-label="助手消息"]').value}})
  if(box.left<0||box.right>width+1||box.overflow>2||!box.sameInput||box.draft!=='保留未发送草稿')throw Error('按需结果刷新影响界面或草稿 '+JSON.stringify(box))
  report.push({width,theme,used,...box});await page.screenshot({path:resolve(output,`${width}-${theme}-${used?'retrieved':'not-searched'}.png`)})
 }
 await page.locator('.wb-hub-more>summary').click();await page.getByRole('button',{name:'知识设置',exact:true}).click();const dialog=page.getByRole('dialog',{name:'知识设置'});await dialog.waitFor();await dialog.getByRole('option',{name:'自动（按需检索）',exact:true}).waitFor({state:'attached'})
 await page.screenshot({path:resolve(output,'360-settings.png'),animations:'disabled'})
 const modal=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,opacity:getComputedStyle(el).opacity,overflow:el.scrollWidth-el.clientWidth}});if(modal.left<0||modal.right>361||modal.top<0||modal.bottom>801||modal.height<100||modal.overflow>2)throw Error('窄屏知识设置溢出 '+JSON.stringify(modal))
 await dialog.getByRole('button',{name:'完成',exact:true}).click()
 const calls=await page.evaluate(()=>window.knowledgeLayoutCalls);if(calls.some(row=>!['list','detail'].includes(row.action)))throw Error('布局或设置查看触发了业务操作')
 if(errors.length)throw Error(errors.join('; '));writeFileSync(resolve(output,'report.json'),JSON.stringify({cases:report.length,errors,modal,report},null,2));console.log(JSON.stringify({cases:report.length,errors,output}))
}catch(error){await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});throw error}finally{await browser.close()}
