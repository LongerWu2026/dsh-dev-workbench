/** Production bundle auth status layout with a synthetic desktop bridge; never loads provider websites. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const base=dirname(fileURLToPath(import.meta.url)),out='/tmp/workbench-web-ai-auth';mkdirSync(out,{recursive:true})
const built=await build({entryPoints:[resolve(base,'fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>body{margin:0;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.evaluate(()=>{
  window.authStatus='unknown';window.authByProvider={kimi:'authenticated',glm:'needs_login',doubao:'unknown'};window.operationCalls=[]
  window.dshDesktop={protocolVersion:1,browser:{acquire:async()=>({lease:'layout-auth',partition:'layout-memory'}),release:async()=>{},onOpenRequested:()=>()=>{},persistence:{protocolVersion:1,acquire:async request=>({lease:'layout-auth',partition:'persist:layout-auth',persistence:'persistent',providerId:request.providerId})}}}
  HTMLElement.prototype.loadURL=async function(url){this.fixtureURL=url;queueMicrotask(()=>this.dispatchEvent(new Event('dom-ready')))}
  HTMLElement.prototype.getURL=function(){return this.fixtureURL||'about:blank#layout-auth'}
  HTMLElement.prototype.executeJavaScript=async function(script){if(script.includes('observeWebAIAuthentication')){const id=JSON.parse(script.slice(script.lastIndexOf(')(')+2,-1)).providerId;return {status:window.authByProvider?.[id]||window.authStatus}}window.operationCalls.push(script);return {status:'ready'}}
 })
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync(resolve(base,'../../client.js'),'utf8')});await page.evaluate(()=>{window.mountWorkbench();window.WB.go('web-ai')})
 await page.locator('.wb-chat-provider-picker summary').click()
 await page.locator('webview').first().waitFor({state:'attached'});await page.locator('webview').evaluateAll(nodes=>nodes.forEach(el=>el.dispatchEvent(new Event('dom-ready'))))
 await page.getByLabel('Kimi 登录检查',{exact:true}).getByText('已登录',{exact:true}).waitFor()
 await page.getByLabel('智谱清言 登录检查',{exact:true}).getByText('需要登录',{exact:true}).waitFor()
 await page.getByLabel('豆包 登录检查',{exact:true}).getByText('未确认',{exact:true}).waitFor()
 assert.deepEqual(await page.evaluate(()=>window.operationCalls),[],'login checks must not prepare, submit or observe drafts')
 await page.getByRole('group',{name:'本次发送厂商'}).getByRole('button',{name:'Kimi 查看官网',exact:true}).click()
 await page.evaluate(()=>{window.authByProvider=null})
 await page.locator('webview').first().waitFor({state:'attached'});await page.locator('webview').first().evaluate(el=>el.dispatchEvent(new Event('dom-ready')))
 for(const width of [360,800])for(const theme of ['light','dark'])for(const status of ['authenticated','needs_login','verification','unknown']){
  await page.setViewportSize({width,height:700});await page.evaluate(({theme,status})=>{document.documentElement.className=theme;window.authStatus=status},{theme,status})
  await page.getByRole('button',{name:'重新检查登录'}).click()
  await page.getByLabel('Kimi 登录状态').getByText({authenticated:'已识别登录',needs_login:'需要登录',verification:'需要验证',unknown:'登录待确认'}[status],{exact:true}).waitFor()
  const metrics=await page.locator('.wb-web-auth').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,clipped:[...el.querySelectorAll('button,span')].some(node=>{const r=node.getBoundingClientRect(),p=el.getBoundingClientRect();return r.left<p.left-1||r.right>p.right+1})}))
  assert.ok(metrics.overflow<=2&&!metrics.clipped,JSON.stringify({width,theme,status,...metrics}));report.push({width,theme,status,...metrics})
  if(status==='verification')await page.screenshot({path:resolve(out,`${width}-${theme}.png`)})
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'result.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out}))
}finally{await browser.close()}
