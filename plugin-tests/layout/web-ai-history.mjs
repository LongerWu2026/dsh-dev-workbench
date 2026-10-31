/** Isolated shipped UI with synthetic local history; no real records or provider pages. */
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const base=dirname(fileURLToPath(import.meta.url)),out='/tmp/workbench-history-bulk';mkdirSync(out,{recursive:true})
const built=await build({entryPoints:[resolve(base,'fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#f7f8fa;--dsw-alias-bg-layer-2:#edf0f5;--dsw-alias-bg-overlay:#fff;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#78808d;--dsw-alias-border-l1:#e7e9ee;--dsw-alias-border-l2:#d4d8e1;--dsw-alias-brand-primary:#356fee;--dsw-alias-state-error-primary:#c33}html.dark{--dsw-alias-bg-base:#181b20;--dsw-alias-bg-layer-1:#20242b;--dsw-alias-bg-layer-2:#2b3039;--dsw-alias-bg-overlay:#252a32;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#a0a8b5;--dsw-alias-border-l1:#303640;--dsw-alias-border-l2:#444d5b}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync(resolve(base,'../../client.js'),'utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const original=window.WB.rpc;window.historyVersion=100;window.historyCalls=[]
  window.WB.rpc=async(method,args,signal)=>{
   if(method==='workbench/webAIState')return{state:window.historyFixture,capabilities:{historyProtocol:1,attachmentsProtocol:1,storageScope:'synthetic-history'}}
   if(method==='workbench/webAIManageTopic'){
    const r=args.request;window.historyCalls.push(r)
    const ids=new Set(r.topics?.map(t=>t.topicId)||[r.topicId]);const next=structuredClone(window.historyFixture)
    if(r.action==='trash')for(const topic of next.topics)if(ids.has(topic.id)){topic.deletedAt=new Date().toISOString();topic.version++}
    if(r.action==='purge'){next.topics=next.topics.filter(t=>!ids.has(t.id));next.rounds=next.rounds.filter(t=>!ids.has(t.topicId))}
    next.revision=++window.historyVersion;window.historyFixture=next;return next
   }
   return original(method,args,signal)
  }
 })
 for(const width of [800,360])for(const height of [600,320])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(()=>window.WB.go('dashboard'));await page.getByLabel('本地问答历史').waitFor({state:'hidden'})
  await page.evaluate(theme=>{
   document.documentElement.className=theme;window.historyCalls=[]
   window.historyFixture={revision:++window.historyVersion,topics:Array.from({length:3},(_,i)=>({id:'bulk-'+i,title:'PDF与Word附件验收：'+('Validation code 与分隔说明，'.repeat(8))+i,version:0,createdAt:'2026-10-30T08:00:00Z',conversations:{}})),rounds:[],chatgptEnabled:false}
   window.WB.store.set({data:{...window.WB.store.get().data,revision:window.historyVersion,webAI:window.historyFixture}});window.WB.go('web-ai')
  },theme)
  const manage=page.getByRole('button',{name:'管理历史与回收站',exact:true});if(!await manage.isVisible())await page.getByRole('button',{name:'会话历史',exact:true}).click();await manage.click()
  await page.getByRole('button',{name:'历史（3）',exact:true}).click()
  await page.getByRole('checkbox',{name:'全选本页',exact:true}).check();await page.getByRole('button',{name:'批量删除',exact:true}).click()
  const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'确认',exact:true}).waitFor()
  const metrics=await dialog.evaluate(el=>{
   const r=el.getBoundingClientRect(),foot=el.querySelector('.wb-modal-foot').getBoundingClientRect(),buttons=[...el.querySelectorAll('.wb-modal-foot button')].map(b=>({text:b.textContent,...Object.fromEntries(['left','right','top','bottom'].map(k=>[k,b.getBoundingClientRect()[k]]))}))
   return{left:r.left,right:r.right,bottom:r.bottom,overflow:el.scrollWidth-el.clientWidth,footBottom:foot.bottom,buttons}
  })
  assert.ok(metrics.left>=0&&metrics.right<=width+1&&metrics.bottom<=height+1&&metrics.overflow<=2,JSON.stringify({width,height,theme,metrics}))
  assert.deepEqual(metrics.buttons.map(b=>b.text),['取消','确认']);assert.ok(metrics.buttons[0].left<metrics.buttons[1].left&&metrics.buttons[1].right>metrics.right-22);assert.ok(metrics.buttons.every(b=>b.bottom<=height&&b.top>=0));report.push({width,height,theme,...metrics})
  await page.screenshot({path:resolve(out,`confirm-${width}-${height}-${theme}.png`),animations:'disabled'});await dialog.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.evaluate(()=>window.historyCalls.length),0)
  await page.getByRole('button',{name:'批量删除',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认',exact:true}).click();await page.getByRole('button',{name:'历史（0）',exact:true}).waitFor()
  assert.equal(await page.evaluate(()=>window.historyCalls[0].topics.length),3);await page.getByRole('button',{name:'回收站（3）',exact:true}).click();await page.getByRole('checkbox',{name:'全选本页',exact:true}).check();await page.getByRole('button',{name:'批量永久删除',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认',exact:true}).click();await page.getByText('回收站为空',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.historyCalls.length),2)
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'report.json'),JSON.stringify({cases:report.length,errors,report},null,2));console.log('history confirmation and bulk delete: '+report.length+' browser scenarios passed; '+out)
}finally{await browser.close()}
