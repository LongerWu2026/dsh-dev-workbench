/** Isolated geometry acceptance; no account, real model download, or external I/O. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output=process.env.LAYOUT_OUTPUT||'/tmp/workbench-knowledge-engine';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench())
 await page.evaluate(()=>{const WB=window.WB;window.engineCalls=[];window.engine={enabled:false,installed:false,phase:'idle',index:{phase:'idle'}};WB.actions.knowledgeEngine=async request=>{window.engineCalls.push(request);if(request.action==='enable')window.engine={enabled:true,installed:false,phase:'downloading',downloaded:23000000,totalBytes:46979851,index:{phase:'idle'}};if(request.action==='disable')window.engine={enabled:false,installed:false,phase:'idle',index:{phase:'idle'}};return window.engine};WB.store.set({data:{...WB.store.get().data,knowledgeSpaces:[{id:'company',name:'公司资料与公共业务规范（较长空间名称）'}],projects:[{id:'project',name:'项目的较长中文名称用于窄屏检验',knowledgeSpaceId:'company'}]},page:'knowledge'})})
 await page.getByRole('button',{name:'下载并启用（约 47 MB）',exact:true}).waitFor()
 async function measure(width,height,theme,stage){
  const metrics=await page.evaluate(()=>{const root=document.querySelector('.wb-root'),modal=document.querySelector('[role="dialog"]'),target=modal||document.querySelector('.wb-page'),rect=target.getBoundingClientRect();return {overflow:target.scrollWidth-target.clientWidth,left:rect.left,right:rect.right,viewport:innerWidth,modal:!!modal,controls:[...target.querySelectorAll('button,select,input')].filter(el=>el.getBoundingClientRect().width>0).map(el=>{const r=el.getBoundingClientRect();return {label:el.getAttribute('aria-label')||el.textContent,left:r.left,right:r.right,overflow:el.scrollWidth-el.clientWidth}})}})
  if(metrics.overflow>2||metrics.left<0||metrics.right>width+1)throw Error('知识空间横向溢出 '+JSON.stringify({width,height,theme,stage,metrics}))
  for(const control of metrics.controls)if(control.left<metrics.left-1||control.right>metrics.right+1)throw Error('控件超出知识界面 '+JSON.stringify({width,height,theme,stage,control,metrics}))
  report.push({width,height,theme,stage,...metrics});await page.screenshot({path:resolve(output,`${width}-${height}-${theme}-${stage}.png`),animations:'disabled'})
 }
 for(const [width,height] of [[1280,800],[800,700],[560,700],[360,700],[360,360]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  await measure(width,height,theme,'idle')
  await page.getByRole('button',{name:'下载并启用（约 47 MB）',exact:true}).click();await page.getByRole('progressbar',{name:'模型下载进度'}).waitFor();await measure(width,height,theme,'download')
  await page.getByRole('button',{name:'停用语义增强',exact:true}).click();await page.getByRole('button',{name:'下载并启用（约 47 MB）',exact:true}).waitFor()
  await page.getByRole('button',{name:'管理知识空间',exact:true}).click();await page.getByRole('dialog').waitFor();await measure(width,height,theme,'manage');await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).last().click()
 }
 if(errors.length)throw Error(errors.join('; '))
 writeFileSync(resolve(output,'report.json'),JSON.stringify({cases:report.length,errors,report},null,2));console.log(JSON.stringify({cases:report.length,errors,output}))
}catch(error){await page.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});throw error}finally{await browser.close()}
