/** Synthetic search results only; all network requests are blocked. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const base=dirname(fileURLToPath(import.meta.url)),out='/tmp/workbench-work-search';mkdirSync(out,{recursive:true})
const built=await build({entryPoints:[resolve(base,'fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{height:100%;margin:0;font-family:system-ui}html{--dsw-alias-brand-primary:#356fee;--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync(resolve(base,'../../client.js'),'utf8')});await page.evaluate(()=>{window.mountWorkbench();window.WB.go('search');window.WB.actions.search=async(query,options)=>({query,at:new Date().toISOString(),groups:options.scope==='web'?[{id:'web',label:'互联网',status:'ok',items:[{id:'web',kind:'web',title:'网页：接口性能优化实践',url:'https://example.com/source',snippet:'合成网页摘要，查看原文获取更多内容。',extra:{publishedAt:new Date().toISOString()}}]}]:[{id:'tasks',label:'待办',status:'ok',items:Array.from({length:8},(_,i)=>({id:'task'+i,kind:'task',title:'接口优化验收任务 '+i,snippet:'排查耗时，核对压测结果并完成灰度验证。',extra:{status:'ready'}}))},{id:'knowledge',label:'知识',status:'ok',items:[{id:'knowledge',kind:'knowledge',title:'接口验收规范',snippet:'将性能基线、灰度结果和回滚预案一起归档。'}]}]})})
 for(const width of [1280,800,560,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:760});await page.evaluate(t=>document.documentElement.className=t,theme)
  for(const mode of ['工作内容','互联网']){
   await page.getByRole('tab',{name:mode,exact:true}).click();await page.getByRole('textbox',{name:'工作搜索关键词'}).fill('接口验收');await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByText(mode==='工作内容'?'接口优化验收任务 0':'网页：接口性能优化实践',{exact:true}).waitFor()
   const metrics=await page.locator('.wb-scroll').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,expanded:!el.querySelector('[aria-label$="搜索结果"] details')}));assert.ok(metrics.overflow<=2&&metrics.expanded,JSON.stringify({width,theme,mode,...metrics}));report.push({width,theme,mode,...metrics});await page.screenshot({path:resolve(out,`${width}-${theme}-${mode==='工作内容'?'work':'web'}.png`)})
  }
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'result.json'),JSON.stringify({cases:report.length,report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out}))
}finally{await browser.close()}
