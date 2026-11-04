/** Shipped settings UI with a synthetic catalog. All network access blocked. */
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const out='/tmp/workbench-background-models';mkdirSync(out,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')})
 await page.evaluate(()=>{
  window.mountWorkbench();const WB=window.WB,data=WB.store.get().data
  WB.store.set({data:{...data,settings:{...data.settings,backgroundModels:{analysis:{provider:'offline-service-with-a-long-name',model:'previous-model-with-a-long-version-name'},summary:null}}}})
  WB.actions.backgroundModelCatalog=async()=>({available:true,groups:[{id:'alpha',name:'服务商长名称'.repeat(8),models:[{id:'one',name:'模型长名称及版本信息'.repeat(12)}]}],failedProviders:[{id:'offline'}]})
  window.modelSaveCalls=[];WB.actions.backgroundModelConfigure=async(purpose,model)=>{window.modelSaveCalls.push({purpose,model});const data=WB.store.get().data;WB.store.set({data:{...data,settings:{...data.settings,backgroundModels:{...data.settings.backgroundModels,[purpose]:model}}}})}
  WB.go('settings')
 })
 for(const [width,height] of [[1440,900],[1024,768],[800,700],[560,720],[360,720],[360,360]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  const panel=page.locator('.wb-card').filter({has:page.getByRole('heading',{name:'后台任务模型',exact:true})});await panel.scrollIntoViewIfNeeded()
  const select=page.getByRole('combobox',{name:'消息识别模型'});await select.waitFor();assert.equal(await select.isDisabled(),false)
  const metrics=await panel.evaluate(el=>{const scroll=el.closest('.wb-scroll'),r=el.getBoundingClientRect();return {pageOverflow:scroll.scrollWidth-scroll.clientWidth,panelOverflow:el.scrollWidth-el.clientWidth,panelLeft:r.left,panelRight:r.right,selects:[...el.querySelectorAll('select')].map(node=>{const b=node.getBoundingClientRect();return {left:b.left,right:b.right}})}})
  assert.ok(metrics.pageOverflow<=2&&metrics.panelOverflow<=2&&metrics.selects.every(row=>row.left>=metrics.panelLeft&&row.right<=metrics.panelRight+1),JSON.stringify({width,height,theme,metrics}));report.push({width,height,theme,...metrics});await page.screenshot({path:resolve(out,`${width}-${height}-${theme}.png`),animations:'disabled'})
 }
 await page.getByRole('combobox',{name:'消息识别模型'}).selectOption(JSON.stringify(['alpha','one']))
 assert.deepEqual(await page.evaluate(()=>window.modelSaveCalls),[{purpose:'analysis',model:{provider:'alpha',model:'one'}}]);assert.deepEqual(errors,[])
 writeFileSync(resolve(out,'report.json'),JSON.stringify({cases:report.length,report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out}))
}finally{await browser.close()}
