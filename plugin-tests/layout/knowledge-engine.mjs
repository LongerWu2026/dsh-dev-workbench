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
 await page.evaluate(()=>{const WB=window.WB;window.engineCalls=[];window.engine={enabled:false,installed:false,phase:'idle',index:{phase:'idle'}};WB.actions.knowledgeEngine=async request=>{window.engineCalls.push(request);if(request.action==='enable')window.engine={enabled:true,installed:false,phase:'downloading',downloaded:23000000,totalBytes:46979851,index:{phase:'idle'}};if(request.action==='disable')window.engine={enabled:false,installed:false,phase:'idle',index:{phase:'idle'}};if(request.action==='index')window.engine={...window.engine,index:{phase:'indexing',total:3,processed:1,scope:request.scope}};return window.engine};WB.store.set({data:{...WB.store.get().data,knowledgeSpaces:[{id:'company',name:'公司资料与公共业务规范（较长空间名称）'}],projects:[{id:'project',name:'项目的较长中文名称用于窄屏检验',knowledgeSpaceId:'company'}]},page:'knowledge'})})
 await page.getByLabel('知识更多操作').waitFor()
 async function measure(width,height,theme,stage){
  const metrics=await page.evaluate(()=>{const root=document.querySelector('.wb-root'),modal=document.querySelector('[role="dialog"]'),target=modal||document.querySelector('.wb-page'),rect=target.getBoundingClientRect();return {overflow:target.scrollWidth-target.clientWidth,left:rect.left,right:rect.right,viewport:innerWidth,modal:!!modal,controls:[...target.querySelectorAll('button,select,input')].filter(el=>el.getBoundingClientRect().width>0).map(el=>{const r=el.getBoundingClientRect();return {label:el.getAttribute('aria-label')||el.textContent,left:r.left,right:r.right,overflow:el.scrollWidth-el.clientWidth}})}})
  if(metrics.overflow>2||metrics.left<0||metrics.right>width+1)throw Error('知识空间横向溢出 '+JSON.stringify({width,height,theme,stage,metrics}))
  for(const control of metrics.controls)if(control.left<metrics.left-1||control.right>metrics.right+1)throw Error('控件超出知识界面 '+JSON.stringify({width,height,theme,stage,control,metrics}))
  report.push({width,height,theme,stage,...metrics});await page.screenshot({path:resolve(output,`${width}-${height}-${theme}-${stage}.png`),animations:'disabled'})
 }
 for(const [width,height] of [[1280,800],[800,700],[560,700],[360,700],[360,360]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  await page.evaluate(()=>window.WB.go('knowledge'));await page.getByLabel('知识更多操作').waitFor()
  if(await page.getByRole('button',{name:'下载并启用（约 47 MB）',exact:true}).count()||await page.getByRole('textbox',{name:'知识检索测试问题'}).count())throw Error('知识页仍常驻模型配置或检索测试')
  await measure(width,height,theme,'idle')
  await page.getByLabel('知识更多操作').click();await page.getByRole('button',{name:'管理知识空间',exact:true}).click();await page.getByRole('dialog').waitFor();await measure(width,height,theme,'manage');await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).last().click()
  await page.getByRole('button',{name:'导入资料',exact:true}).click();await page.getByRole('dialog',{name:'导入资料',exact:true}).waitFor();await measure(width,height,theme,'import');await page.getByRole('button',{name:'取消',exact:true}).click()
  await page.getByLabel('知识更多操作').click();await page.getByRole('button',{name:'检索验证',exact:true}).click();await page.getByRole('textbox',{name:'知识检索测试问题'}).fill('接口发布验收');await page.getByRole('button',{name:'测试检索',exact:true}).click();await page.getByRole('region',{name:'知识检索依据'}).waitFor();await measure(width,height,theme,'retrieval');await page.getByRole('button',{name:'收起检索验证'}).click()
  await page.evaluate(()=>window.WB.go('settings'));await page.getByRole('button',{name:'配置知识库模型',exact:true}).click();await page.getByRole('dialog',{name:'知识库模型配置'}).waitFor();await measure(width,height,theme,'configuration')
  await page.getByRole('button',{name:'下载并启用（约 47 MB）',exact:true}).click();await page.getByRole('progressbar',{name:'模型下载进度'}).waitFor();await measure(width,height,theme,'download')
  await page.evaluate(()=>{window.engine={...window.engine,installed:true,phase:'ready'}});await page.getByText('本地模型已就绪',{exact:true}).waitFor()
  await page.getByLabel('索引知识空间').selectOption('company');await page.getByLabel('索引知识项目').selectOption('project');await page.getByRole('button',{name:'更新当前范围索引'}).click();await page.getByRole('progressbar',{name:'知识索引进度'}).waitFor();await measure(width,height,theme,'index')
  const request=await page.evaluate(()=>window.engineCalls.findLast(call=>call.action==='index'));if(request.scope.spaceId!=='company'||request.scope.projectId!=='project')throw Error('索引范围丢失')
  await page.getByRole('button',{name:'停用语义增强',exact:true}).click();await page.getByRole('button',{name:'下载并启用（约 47 MB）',exact:true}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).last().click()

 }
 await page.evaluate(()=>{window.engine={enabled:true,installed:false,phase:'error',note:'合成模型异常',index:{phase:'idle'}};window.WB.go('knowledge')});await page.getByRole('button',{name:'前往配置'}).click();await page.getByRole('dialog',{name:'知识库模型配置'}).waitFor();await measure(360,360,'dark','error-configuration')
 if(errors.length)throw Error(errors.join('; '))
 writeFileSync(resolve(output,'report.json'),JSON.stringify({cases:report.length,errors,report},null,2));console.log(JSON.stringify({cases:report.length,errors,output}))
}catch(error){await page.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});throw error}finally{await browser.close()}
