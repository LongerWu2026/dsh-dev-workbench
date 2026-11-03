/** Real built shell and search dialogs, synthetic records only. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const base=dirname(fileURLToPath(import.meta.url)),out='/tmp/workbench-global-search';mkdirSync(out,{recursive:true})
const built=await build({entryPoints:[resolve(base,'fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#f0f1f2;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#ccc}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#303030;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444;--dsw-alias-border-l2:#555}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync(resolve(base,'../../client.js'),'utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{window.WB.actions.search=async()=>({groups:[{id:'knowledge',label:'知识空间',status:'ok',items:Array.from({length:20},(_,i)=>({id:'knowledge-'+i,kind:'knowledge',title:'验收知识 '+i+' '+('长标题'.repeat(20)),snippet:'用来验证完整结果和搜索列表的内容，'.repeat(15)}))}]})})
 for(const width of [360,800,1440])for(const height of [480,900])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  assert.equal(await page.locator('.wb-topnav [data-page="search"]').count(),0)
  const trigger=page.getByRole('button',{name:'搜索工作内容（⌘K / Ctrl+K）'});await trigger.click();const dialog=page.getByRole('dialog',{name:'搜索工作内容'});await dialog.waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await dialog.getByRole('textbox').fill('验收');
  try{await dialog.getByText(/^验收知识 0/).waitFor({timeout:5000})}catch(error){await page.screenshot({path:resolve(out,'failed.png')});console.log(JSON.stringify({width,height,theme,text:await dialog.innerText(),errors}));throw error}
  const metrics=await dialog.evaluate(el=>{const r=el.getBoundingClientRect(),list=el.querySelector('.wb-global-search-results');return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:el.scrollWidth-el.clientWidth,listOverflow:list.scrollHeight-list.clientHeight}})
  assert.ok(metrics.left>=-1&&metrics.right<=width+1&&metrics.top>=-1&&metrics.bottom<=height+1&&metrics.overflow<=2&&metrics.listOverflow>0,JSON.stringify({width,height,theme,metrics}))
  assert.ok(await dialog.getByRole('button',{name:/查看全部搜索结果/}).isVisible())
  const action=await dialog.getByRole('button',{name:/查看全部搜索结果/}).evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,inFooter:!!el.closest('.wb-modal-foot')}});assert.ok(action.inFooter&&action.top>=metrics.top&&action.bottom<=metrics.bottom,JSON.stringify(action))
  report.push({width,height,theme,...metrics});await page.screenshot({path:resolve(out,`search-${width}-${height}-${theme}.png`)});await page.keyboard.press('Escape');assert.ok(await trigger.evaluate(el=>el===document.activeElement))
 }
 for(const width of [360,800,1440])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.evaluate(theme=>{document.documentElement.className=theme;window.WB.setSearchPreset({query:'验收',scope:'local'});window.WB.go('search')},theme)
  await page.getByRole('heading',{name:'搜索结果',level:1}).waitFor();await page.getByText(/^验收知识 0/).waitFor()
  const overflow=await page.locator('.wb-scroll').evaluate(el=>el.scrollWidth-el.clientWidth);assert.ok(overflow<=2,JSON.stringify({width,theme,overflow}));report.push({stage:'complete-results',width,theme,overflow});await page.screenshot({path:resolve(out,`results-${width}-${theme}.png`)})
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'report.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out}))
}finally{await browser.close()}
