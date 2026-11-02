/** Real browser geometry against the shipped client, synthetic data and blocked network. */
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output=process.env.LAYOUT_OUTPUT||'/tmp/workbench-assistant-latest';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const WB=window.WB,now=Date.now(),rows=[{id:'system:analysis',kind:'system',title:'消息识别'},{id:'chat:latest',kind:'chat',title:'最新定位验收'}]
  window.latestCalls=[];window.latestPhase=0
  const messages=(start,count,prefix)=>Array.from({length:count},(_,i)=>({id:prefix+(start+i),role:'assistant',at:now-60000+(start+i)*1000,text:prefix+'消息 '+(start+i)+'：'+('合成消息用于验证实际滚动位置。'.repeat(20))}))
  WB.actions.assistantHub=async request=>{
   window.latestCalls.push(request)
   if(request.action==='list')return {status:'ok',conversations:rows}
   if(request.action!=='detail')throw Error('打开会话不得执行业务：'+request.action)
   const system=request.conversationId==='system:analysis',older=!!(request.before||request.backgroundBefore),recent=messages(20,20,'当前'),extra=window.latestPhase?[...recent,messages(40,1,'新增')[0]]:recent
   const value={status:'ok',conversation:rows.find(row=>row.id===request.conversationId),messages:system?[]:older?messages(10,10,'之前'):extra,turns:[],events:[],runs:[],items:[],threads:[],confirmations:[],hasMore:!system&&!older,before:!system&&!older?{seq:20}:null,background:{messages:system?(older?messages(10,10,'之前'):extra):[],hasMore:system&&!older,before:system&&!older?{sessionId:'background',seq:20,at:now-40000}:null},extraction:system?{total:1,items:[{id:'synthetic',kind:'task',title:'合成提取事项',body:'此卡片不会改变默认定位到最新消息的行为。',status:'ready'}],counts:{tasks:1}}:undefined}
   if(older&&window.holdLatestHistory)return new Promise(resolve=>{window.releaseLatestHistory=()=>resolve(value)})
   return value
  }
 })
 const bottom=()=>page.waitForFunction(()=>{const body=document.querySelector('.wb-hub-body');return body&&!document.querySelector('.wb-hub-loading')&&body.scrollHeight-body.scrollTop-body.clientHeight<2})
 for(const [width,height] of [[1280,800],[800,700],[360,700],[360,360]])for(const theme of ['light','dark'])for(const id of ['system:analysis','chat:latest']){
  await page.setViewportSize({width,height});await page.evaluate(({theme,id})=>{document.documentElement.className=theme;window.latestPhase=0;window.holdLatestHistory=false;window.WB.assistant.openHub(id)},{theme,id})
  await page.getByText(/^当前消息 39：/).waitFor({state:'attached'});if(width<640){const collapse=page.getByRole('button',{name:'收起会话列表'});if(await collapse.count())await collapse.click()}await bottom()
  const latest=await page.getByText(/^当前消息 39：/).evaluate(el=>{const body=el.closest('.wb-hub-body'),a=el.getBoundingClientRect(),b=body.getBoundingClientRect();return {latestBottom:a.bottom,bodyBottom:b.bottom,gap:body.scrollHeight-body.scrollTop-body.clientHeight,overflow:body.scrollWidth-body.clientWidth}})
  assert.ok(latest.latestBottom<=latest.bodyBottom+2);assert.ok(latest.overflow<=2)
  // Refreshing while reading older content must preserve the reader's position.
  await page.locator('.wb-hub-body').evaluate(el=>{el.scrollTop=180;el.dispatchEvent(new Event('scroll',{bubbles:true}))})
  const reading=await page.locator('.wb-hub-body').evaluate(el=>el.scrollTop)
  await page.evaluate(()=>{window.latestPhase=1});await page.getByRole('button',{name:'刷新进度',exact:true}).click();await page.getByText(/^新增消息 40：/).waitFor({state:'attached'})
  assert.ok(Math.abs(await page.locator('.wb-hub-body').evaluate(el=>el.scrollTop)-reading)<2,'new messages moved a reader away from history')
  // Clicking the selected conversation is also an explicit return to latest.
  if(id==='system:analysis')await page.getByRole('button',{name:'系统能力：消息识别'}).click()
  else {const expand=page.getByRole('button',{name:'展开会话列表'});if(await expand.count())await expand.click();await page.getByRole('button',{name:'会话：最新定位验收',exact:true}).click();if(width<640){const close=page.getByRole('button',{name:'收起会话列表'});if(await close.count())await close.click()}}
  await bottom()
  // Historical loading lives before the results card and every message, at the top.
  await page.locator('.wb-hub-body').evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll',{bubbles:true}))})
  const control=page.getByRole('group',{name:'加载历史消息'})
  assert.equal(await control.evaluate(el=>el.closest('.wb-hub-body').firstElementChild===el),true)
  const anchor=await page.locator('.wb-hub-body > .wb-hub-chat-row').first().evaluate(el=>({offset:el.getBoundingClientRect().top-el.parentElement.getBoundingClientRect().top,text:el.textContent}))
  await page.evaluate(()=>{window.holdLatestHistory=true;window.releaseLatestHistory=null})
  await control.getByRole('button').click();await page.waitForFunction(()=>typeof window.releaseLatestHistory==='function');assert.equal(await control.getByRole('button').isDisabled(),true)
  await page.evaluate(()=>window.releaseLatestHistory());await page.getByText(/^之前消息 10：/).waitFor({state:'attached'})
  const restored=await page.getByText(/^当前消息 20：/).evaluate(el=>{const row=el.closest('.wb-hub-chat-row'),body=row.closest('.wb-hub-body');return row.getBoundingClientRect().top-body.getBoundingClientRect().top})
  assert.ok(Math.abs(restored-anchor.offset)<2,'loading history moved the existing message: '+JSON.stringify({anchor:anchor.offset,restored,width,height,theme,id}))
  const order=await page.locator('.wb-hub-body').textContent();assert.ok(order.indexOf('之前消息 19：')<order.indexOf('当前消息 20：'))
  assert.equal(await page.getByRole('group',{name:'加载历史消息'}).count(),0)
  // Reopening always resets a deliberately scrolled-up view to latest.
  await page.evaluate(id=>window.WB.assistant.openHub(id),id);await bottom()
  report.push({width,height,theme,id,...latest,historyAnchorOffset:anchor.offset,restoredOffset:restored})
  await page.screenshot({path:resolve(output,`${width}-${height}-${theme}-${id.split(':')[0]}.png`),animations:'disabled'})
 }
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>window.latestCalls.every(request=>['list','detail'].includes(request.action))),true)
 writeFileSync(resolve(output,'report.json'),JSON.stringify({cases:report.length,errors,report},null,2));console.log(JSON.stringify({cases:report.length,errors,output}))
}catch(error){await page.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({report,errors,error:String(error.stack||error)},null,2));throw error}finally{await browser.close()}
