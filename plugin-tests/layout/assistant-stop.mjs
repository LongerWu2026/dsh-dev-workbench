/** Synthetic native state only; does not connect to the installed Harness or models. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output='/tmp/workbench-assistant-stop-layout';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const conversation={id:'chat:stop-layout',kind:'chat',title:'停止保留历史与进度'},WB=window.WB;window.stopCalls=[];window.nativeRunning=true
  WB.actions.assistantHub=async req=>{window.stopCalls.push(req);if(req.action==='list')return {status:'ok',conversations:[conversation]};if(req.action==='stop'){window.nativeRunning=false;return {status:'ok',stopping:false}};if(req.action!=='detail')throw Error('unexpected action '+req.action);return {status:'ok',conversation,sessionId:'synthetic-native',nativeBinding:{canSend:true},stop:{available:window.nativeRunning,running:window.nativeRunning,supported:true,token:'synthetic-turn'},messages:[{role:'assistant',text:'已生成的内容和已完成的步骤继续保留。'}],events:[],runs:[],items:[],threads:[],confirmations:[]}}
  WB.assistant.openHub(conversation.id)
 })
 await page.getByRole('button',{name:'停止当前会话',exact:true}).waitFor();await page.getByRole('textbox',{name:'助手消息'}).fill('尚未发送的草稿')
 for(const [width,height] of [[1280,800],[800,700],[600,600],[360,700],[360,360]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.className=theme,theme);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
  const boxes=await page.evaluate(()=>{const box=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:el.scrollWidth-el.clientWidth}};return {hub:box(document.querySelector('.wb-hub')),stop:box(document.querySelector('[aria-label="停止当前会话"]')),input:box(document.querySelector('.wb-assistant-input')),send:box([...document.querySelectorAll('button')].find(el=>el.textContent==='发送'))}})
  for(const key of ['stop','send','input']){const b=boxes[key];if(b.left<boxes.hub.left-1||b.right>boxes.hub.right+1||b.bottom>height+1||b.overflow>2)throw Error('停止按钮布局溢出 '+JSON.stringify({width,height,theme,key,boxes}))}
  report.push({width,height,theme,boxes});if(width===1280||width===360&&height===360)await page.screenshot({path:resolve(output,`${width}-${height}-${theme}.png`)})
 }
 await page.getByRole('button',{name:'停止当前会话',exact:true}).click();await page.getByText('已停止，历史与已完成进度保留',{exact:true}).waitFor()
 if(await page.getByRole('button',{name:'停止当前会话',exact:true}).count())throw Error('原生停止后按钮仍存在')
 if(await page.getByRole('textbox',{name:'助手消息'}).inputValue()!=='尚未发送的草稿')throw Error('停止清空草稿')
 const calls=await page.evaluate(()=>window.stopCalls);if(calls.filter(r=>r.action==='stop').length!==1||calls.some(r=>r.action==='send'))throw Error('重复停止或误发送')
 if(errors.length)throw Error(errors.join('\n'))
 writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(`assistant stop layout: ${report.length} viewport/theme cases passed; ${output}`)
}finally{await browser.close()}
