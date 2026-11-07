/** Real browser, synthetic projects and diffs; browser network is blocked. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const base=dirname(fileURLToPath(import.meta.url)),out='/tmp/workbench-collaboration-layout';mkdirSync(out,{recursive:true})
const built=await build({entryPoints:[resolve(base,'fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{height:100%;margin:0;font-family:system-ui}html{--dsw-alias-brand-primary:#356fee;--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync(resolve(base,'../../client.js'),'utf8')})
 await page.evaluate(()=>{
  window.mountWorkbench();const WB=window.WB,data=WB.store.get().data
  WB.store.set({data:{...data,projects:[{id:'front',name:'前端项目',repoPath:'/synthetic/front'},{id:'back',name:'后端项目',repoPath:'/synthetic/back'}]}})
  window.fixtureCopies=[];WB.util.copy=async text=>{window.fixtureCopies.push(text)};window.fixtureReviews={}
  window.fixtureRemovedCollabCalls=0;window.fixtureNativeFileOpens=0
  WB.actions.github=async()=>{window.fixtureRemovedCollabCalls++;throw Error('不应查询PR/CI')}
  WB.openHarnessFile=async()=>{window.fixtureNativeFileOpens++;return true}
  WB.actions.environment=async({projectId,scope})=>{
   if(scope!=='repository'){window.fixtureRemovedCollabCalls++;throw Error('不应执行本机环境探测')}
   return {projectId,at:new Date().toISOString(),git:[{dir:'/synthetic/'+projectId,label:projectId,status:'ok',branch:'main',changed:2,staged:1,unstaged:1,untracked:0,files:[]}]}
  }
  const longFile='src/'+('研发协作特殊字符 # 文件'.repeat(8))+'.ts'
  WB.rpc=async(method,{request})=>{
   if(!method.endsWith('/projectFiles')){if(/project(Runtime|Start|Open)|github/.test(method))window.fixtureRemovedCollabCalls++;return {status:'ok'}}
   const entries=[{name:'review.ts',path:'src/review.ts',kind:'file',status:'MM'},{name:'gone.ts',path:'gone.ts',kind:'file',status:' D',deleted:true}]
   const key=request.projectId+':'+request.path+':'+(request.view||'file'),review=window.fixtureReviews[key]||{status:'pending'}
   if(request.action==='workspace')return {search:{query:'',history:[]}}
   if(request.action==='search')return {query:request.query,hits:Array.from({length:200},(_,i)=>({path:'src/'+('项目搜索结果长路径'.repeat(5))+'-'+i+'.ts',line:i+1,snippet:'包含全文搜索关键词的长文本，'.repeat(12)})),scanned:200,limited:true}
   if(request.action==='reviews'){const rows=window.fixtureStress?Array.from({length:20},(_,i)=>({path:'src/'+('待审阅改动的长路径'.repeat(5))+'-'+i+'.ts',view:'diff',changeStatus:'MM',status:i%2?'pending':'stale',reason:'内容已变化，请重新审阅当前版本'})):[];return {entries:rows,total:40,hasMore:true,summary:{reviewed:0,pending:20,stale:20}}}
   if(request.action==='reviewMark'||request.action==='reviewUnmark'){window.fixtureReviews[key]={status:request.action==='reviewMark'?'reviewed':'pending'};return window.fixtureReviews[key]}
   if(request.action==='resolve')return {path:request.path,absolutePath:'/synthetic/'+request.path,kind:'file'}
   if(request.action==='read')return {path:request.path,fingerprint:'a'.repeat(64),review,text:'export const description = "'+('很长的中文内容和代码路径'.repeat(100))+'"\n'}
   if(request.action==='diff')return {path:request.path,fingerprint:'b'.repeat(64),review:window.fixtureReviews[request.projectId+':'+request.path+':diff']||{status:'pending'},projectName:request.projectId==='front'?'前端项目':'后端项目',status:'MM',sections:[{id:'staged',label:'已暂存',text:'diff --git a/src/review.ts b/src/review.ts\n--- a/src/review.ts\n+++ b/src/review.ts\n@@ -1 +1 @@\n-export const value = 1;\n+export const value = 2;\n'},{id:'unstaged',label:'未暂存',text:'@@ -1 +1 @@\n'+Array.from({length:80},(_,i)=>'-const old'+i+' = 1;\n+const next'+i+' = 2;').join('\n')}]}
   if(request.action==='handoff')return {projectName:request.projectId==='front'?'前端项目':'后端项目',root:'/synthetic/'+request.projectId,at:new Date().toISOString(),entries,total:entries.length}
   if(request.action==='changes')return {entries,total:entries.length}
   const files=window.fixtureStress?Array.from({length:100},(_,i)=>({name:'file-'+i+'.ts',path:'file-'+i+'.ts',kind:'file'})):[{name:'src',path:'src',kind:'directory'},{name:longFile,path:longFile,kind:'file'}]
   return {entries:files,total:files.length}
  }
  WB.go('collab')
 })
 for(const width of [1280,800,560,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:700});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  await page.getByRole('combobox',{name:'当前项目'}).selectOption('front');await page.getByRole('button',{name:'全部文件',exact:true}).click()
  await page.getByRole('button',{name:/^打开文件 · src\//}).click();await page.getByLabel('文件内容',{exact:true}).waitFor()
  const preview=await page.getByLabel('项目文件预览',{exact:true}).evaluate(el=>{const pane=el.parentElement,workarea=pane.parentElement,main=workarea.querySelector('.wb-main'),rect=pane.getBoundingClientRect(),area=workarea.getBoundingClientRect();return {width:el.clientWidth,height:el.clientHeight,overflow:el.scrollWidth-el.clientWidth,bodyHeight:el.querySelector('.wb-context-body').clientHeight,workbenchSide:workarea.classList.contains('wb-workarea'),alignedRight:Math.abs(rect.right-area.right)<2,fullHeight:Math.abs(rect.height-area.height)<2,mainVisible:getComputedStyle(main).display!=='none',adjacent:main.getBoundingClientRect().right<=rect.left+2}})
  assert.ok(preview.width>100&&preview.height>100&&preview.bodyHeight>60&&preview.overflow<=2,JSON.stringify(preview));assert.ok(preview.workbenchSide&&preview.alignedRight&&preview.fullHeight&&preview.mainVisible,JSON.stringify(preview));if(width>760)assert.ok(preview.adjacent)
  await page.getByRole('button',{name:'关闭文件预览'}).click();await page.getByRole('button',{name:'未提交改动',exact:true}).click();await page.getByRole('button',{name:'审阅改动 · src/review.ts',exact:true}).click();await page.getByLabel('文件差异',{exact:true}).waitFor()
  assert.equal(await page.getByLabel('已暂存差异',{exact:true}).count(),1);assert.equal(await page.getByLabel('未暂存差异',{exact:true}).count(),1)
  await page.getByRole('button',{name:'复制差异',exact:true}).click();assert.ok(await page.evaluate(()=>window.fixtureCopies.at(-1).includes('状态：修改')))
  const diff=await page.getByLabel('项目文件预览',{exact:true}).evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,bodyHeight:el.querySelector('.wb-context-body').clientHeight,bodyContent:el.querySelector('.wb-context-body').scrollHeight}))
  assert.ok(diff.overflow<=2&&diff.bodyContent>diff.bodyHeight,JSON.stringify(diff));await page.evaluate(()=>WB.store.set({toasts:[]}));await page.screenshot({path:resolve(out,`${width}-${theme}-review.png`)})
  await page.getByRole('button',{name:'关闭文件预览'}).click();await page.getByRole('button',{name:'复制交接摘要',exact:true}).click();assert.ok(await page.evaluate(()=>window.fixtureCopies.at(-1).includes('本页未执行测试')))
  assert.equal(await page.getByRole('heading',{name:/PR 与 CI|项目启动与运行|探测范围|端口占用|Docker 容器|进程 CPU/}).count(),0)
  const metrics=await page.locator('.wb-scroll').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,rootOverflow:document.querySelector('.wb-root').scrollWidth-document.querySelector('.wb-root').clientWidth}));assert.ok(metrics.overflow<=2&&metrics.rootOverflow<=2,JSON.stringify(metrics));report.push({width,theme,...metrics,preview,diff})
  await page.getByRole('combobox',{name:'当前项目'}).selectOption('back');await page.locator('.wb-collab-summary').getByText('/synthetic/back',{exact:true}).waitFor()
 }
 await page.evaluate(()=>{window.fixtureStress=true});await page.getByRole('combobox',{name:'当前项目'}).selectOption('front');await page.getByRole('button',{name:'全部文件',exact:true}).click();await page.getByRole('button',{name:'打开文件 · file-99.ts',exact:true}).waitFor()
 await page.getByRole('textbox',{name:'项目全文搜索词'}).fill('研发协作');await page.getByRole('button',{name:'搜索项目',exact:true}).click();await page.getByLabel('项目全文搜索结果',{exact:true}).waitFor();await page.getByLabel('本项目审阅记录',{exact:true}).locator('li').last().waitFor()
 for(const width of [1280,800,360])for(const height of [700,420]){
  await page.setViewportSize({width,height});const panels=[]
  for(const title of ['项目文件','项目全文搜索','审阅进度']){
   const card=page.locator('.wb-collab .wb-card').filter({has:page.getByRole('heading',{name:new RegExp('^'+title)})});await card.scrollIntoViewIfNeeded()
   const metrics=await card.evaluate(el=>{const body=el.querySelector(':scope>.wb-card-body'),head=el.querySelector(':scope>.wb-card-head'),outer=el.closest('.wb-scroll'),before=outer.scrollTop,headBefore=head.getBoundingClientRect().top;body.scrollTop=body.scrollHeight;return {title:head.textContent,height:el.getBoundingClientRect().height,maxHeight:parseFloat(getComputedStyle(el).maxHeight),bodyHeight:body.clientHeight,contentHeight:body.scrollHeight,scrollTop:body.scrollTop,overscroll:getComputedStyle(body).overscrollBehaviorY,outerMoved:outer.scrollTop!==before,headerMoved:Math.abs(head.getBoundingClientRect().top-headBefore)>1,cardOverflow:el.scrollWidth-el.clientWidth,pageOverflow:outer.scrollWidth-outer.clientWidth}})
   assert.ok(metrics.height<=metrics.maxHeight+2&&metrics.bodyHeight>40&&metrics.contentHeight>metrics.bodyHeight&&metrics.scrollTop>0,JSON.stringify(metrics));assert.ok(metrics.overscroll==='contain'&&!metrics.outerMoved&&!metrics.headerMoved&&metrics.cardOverflow<=2&&metrics.pageOverflow<=2,JSON.stringify(metrics));panels.push(metrics)
  }
  report.push({section:'bounded-panels',width,height,panels});await page.locator('.wb-scroll').evaluate(el=>{el.scrollTop=0});await page.screenshot({path:resolve(out,`${width}-${height}-bounded-panels.png`)})
  await page.locator('.wb-collab-tools').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,`${width}-${height}-search-progress.png`)})
 }
 await page.setViewportSize({width:1280,height:700});await page.getByRole('button',{name:/^打开搜索结果 · .*:1$/}).click();await page.getByText('定位到第 1 行',{exact:true}).waitFor();await page.getByRole('button',{name:'标记已审阅',exact:true}).click();await page.getByRole('button',{name:'取消已审阅',exact:true}).waitFor();assert.equal(await page.locator('[data-project-target-line]').count(),1);await page.getByRole('button',{name:'关闭文件预览',exact:true}).click()
 assert.deepEqual(await page.evaluate(()=>({page:WB.store.get().page,native:window.fixtureNativeFileOpens,removed:window.fixtureRemovedCollabCalls})),{page:'collab',native:0,removed:0});assert.deepEqual(errors,[])
 writeFileSync(resolve(out,'report.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out},null,2))
}finally{await browser.close()}
