/** Isolated browser acceptance: actual shipped UI, synthetic data, no business writes. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const out=resolve('.tmp/development-redesign/layout');mkdirSync(out,{recursive:true})
const fixture=await build({entryPoints:['plugin-tests/layout/fixture.jsx'],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.abort())
async function check(width,theme,state,height=800){
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
 const metrics=await page.locator('.wb-scroll').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,outerVerticalOverflow:el.scrollHeight-el.clientHeight,outerTop:el.scrollTop,dialogs:[...document.querySelectorAll('.wb-modal')].map(n=>({width:n.scrollWidth-n.clientWidth,body:n.querySelector('.wb-modal-body').scrollWidth-n.querySelector('.wb-modal-body').clientWidth,bottom:n.getBoundingClientRect().bottom,surface:getComputedStyle(n).backgroundColor,footer:getComputedStyle(n.querySelector('.wb-modal-foot')).backgroundColor,hostSurface:getComputedStyle(document.querySelector('.wb-root')).backgroundColor}))}))
 if(state==='item-details'){
  const list=await page.locator('.wb-workitems-list').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,titles:[...el.querySelectorAll('h3')].map(n=>({height:n.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(n).lineHeight)}))}))
  if(width>=800&&list.width>312)throw Error('Work item column too wide '+list.width)
  if(list.height<=0||list.titles.some(t=>t.height>t.lineHeight*2+1))throw Error('Work item list or title too tall '+JSON.stringify(list))
  metrics.list=list
 }
 const split=await page.locator('.wb-workitems-layout').evaluate(el=>{const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};return {list:rect(el.querySelector('.wb-workitems-list')),detail:rect(el.querySelector('.wb-workitem-detail'))}})
 if(width>=800?(split.detail.left<split.list.right+10||Math.abs(split.detail.top-split.list.top)>2):split.detail.top<split.list.bottom)throw Error('研发列表与过程布局不正确 '+JSON.stringify({width,state,split}))
 if(await page.getByRole('textbox',{name:'搜索工作项',exact:true}).count()!==1||await page.getByText('研发执行记录',{exact:true}).count())throw Error('研发页存在重复搜索或重复执行区域')
 metrics.split=split
 report.push({width,height,theme,state,...metrics});await page.screenshot({path:resolve(out,`${width}-${height}-${theme}-${state}.png`),fullPage:true,animations:'disabled'})
 if(metrics.overflow>1||metrics.outerVerticalOverflow>2||metrics.outerTop>1||metrics.dialogs.some(d=>d.width>1||d.body>1||d.bottom>height+2))throw Error('Layout overflow '+JSON.stringify(report.at(-1)))
 if(metrics.dialogs.some(d=>d.surface!==d.hostSurface||d.footer!==d.surface))throw Error('Dialog theme mismatch '+JSON.stringify(report.at(-1)))
}
try{
 await page.setContent(`<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-bg-overlay:#e8ecf1;--dsw-alias-label-primary:#222;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#111111}html.dark{--dsw-alias-brand-primary:#eeeeee;--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-bg-overlay:#222;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>`)
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>{
  const issue={id:'fixture',code:'BUG-2026-046130',title:'合成 ERP 缺陷：跨模块数据未正确汇总',status:'处理中',workspaceId:'synthetic-workspace'}
  window.fixtureDevelopment={config:{cliPath:'/synthetic/bin/linky',profile:'synthetic',workspaceId:'synthetic-workspace',worktreeRoot:'/synthetic/workspaces',harnessCommand:['dsh','--profile','acp'],model:'deepseek-v4-flash',adapterRoots:[],checks:{}},tasks:[{id:'development-layout',profile:'synthetic',issue,projectId:'developer-project',cwd:'/synthetic/HarnessWorkspaces/development-layout/long-directory-name-for-responsive-verification',branch:'harness/BUG-2026-046130',sessionId:'harness-session-responsive-verification',reviewSessionId:'independent-review-session',status:'waiting_review',stage:'human',pauseReason:'请审查实际代码差异、测试结果与独立审查意见，再批准本次变更。',sessionRecoveries:[{fromSessionId:'original-mixed-model-session',toSessionId:'harness-session-responsive-verification',stage:'implementation',cycleStart:0,status:'completed',at:'2026-11-01T00:00:00Z',model:{provider:'fixture',model:'current-thinking-model'},context:'合成接续摘要',workspaceHash:'fixture-hash'}],steps:[{stage:'analysis',status:'completed',output:'需求分析证据'},{stage:'implementation',status:'completed',output:'实际修复说明'},{stage:'test',status:'completed',exitCode:0,output:'验证通过\n'+('long_test_output_'.repeat(80))},{stage:'review',status:'completed',output:'独立审查意见'}],diff:'diff --git a/long-module-name/file.ts b/long-module-name/file.ts\n'+('actual_code_diff_'.repeat(100))}],nativeRuns:[],adapter:{installed:true,path:'/synthetic/bin/harness-linky',configPath:'/synthetic/config.json'}}
  window.fixtureWorkItems=Array.from({length:7},(_,i)=>({id:'fixture-issue'+(i||''),code:'BUG-2026-'+String(46131+i).padStart(6,'0'),title:i?'合成 ERP 长标题：'+('跨模块报表数据汇总和模型配置验证'.repeat(3)):'合成 ERP 缺陷工作项',type:'bug',workspaceId:'synthetic-workspace',status:'处理中'}))
  window.mountWorkbench();window.WB.go('agents')
 })
 for(const [width,height] of [[360,800],[800,800],[1280,800],[360,360],[800,480],[1280,480]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(t=>document.documentElement.className=t,theme)
  await page.getByRole('button',{name:/BUG-2026-046130.*待人工审查/}).click();await page.getByRole('progressbar',{name:'研发流程进度'}).waitFor()
  const nav=page.getByRole('navigation',{name:'工作台导航'}),entry=nav.getByRole('button',{name:'研发任务',exact:true,includeHidden:true})
  if(await entry.evaluate((el,width)=>window.WB.ORDER.indexOf('agents')>2||(width>=800&&!!el.closest('details')),width))throw Error('研发任务必须保持靠前顺序并在空间足够时直接显示')
  await check(width,theme,'review',height);if(!await page.getByText('已保留原历史会话 · 1 次兼容接续').evaluate(el=>el.parentElement.open))await page.getByText('已保留原历史会话 · 1 次兼容接续').click();await page.getByRole('button',{name:'打开原历史会话 1'}).waitFor();await check(width,theme,'compatibility-history',height)
  await page.getByRole('button',{name:/BUG-2026-046131/}).waitFor();await page.evaluate(()=>document.querySelector('.wb-scroll').scrollTop=0);await check(width,theme,'choose-issue',height)
  await page.getByRole('button',{name:/BUG-2026-046131/}).click();await check(width,theme,'item-details',height);await page.getByRole('button',{name:'下一步：选择工程'}).click();await page.getByRole('textbox',{name:'工程测试命令'}).waitFor();await check(width,theme,'choose-project',height);await page.getByRole('button',{name:'返回工作项',exact:true}).click()
  if(!await page.getByRole('button',{name:'研发设置',exact:true}).isVisible())await page.locator('.wb-page-more > summary').click()
  await page.getByRole('button',{name:'研发设置',exact:true}).click();await check(width,theme,'settings',height);await page.getByText('从 Linky 发起任务（CLI 适配）',{exact:true}).click();await check(width,theme,'advanced',height);await page.getByRole('button',{name:'取消',exact:true}).click()
 }
 // Long execution content scrolls inside the right pane without moving the outer page.
 await page.setViewportSize({width:1280,height:600});await page.evaluate(()=>window.WB.go('agents'));await page.getByRole('button',{name:/BUG-2026-046130.*待人工审查/}).click();await page.getByRole('progressbar',{name:'研发流程进度'}).waitFor()
 const scrolling=await page.locator('.wb-workitem-detail').evaluate(el=>{el.scrollTop=el.scrollHeight;const outer=document.querySelector('.wb-scroll');return {innerTop:el.scrollTop,innerOverflow:el.scrollHeight-el.clientHeight,outerTop:outer.scrollTop,outerOverflow:outer.scrollHeight-outer.clientHeight}})
 if(scrolling.innerTop<=0||scrolling.innerOverflow<=0||scrolling.outerTop!==0||scrolling.outerOverflow>2){console.log(await page.evaluate(()=>['.wb-scroll','.wb-development-page','.wb-dev','.wb-workitems','.wb-workitems-layout','.wb-workitem-detail'].map(selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect();return {selector,top:r.top,height:r.height,client:el.clientHeight,scroll:el.scrollHeight,scrollTop:el.scrollTop,style:getComputedStyle(el).height}})));await page.screenshot({path:'/tmp/development-scroll-failure.png'});throw Error('研发详情未独立滚动 '+JSON.stringify(scrolling))};report.push({state:'independent-detail-scroll',...scrolling})
 await page.setViewportSize({width:1280,height:800});
 for(const status of ['missing_cli','needs_login','unavailable']){
  await page.evaluate(status=>{window.fixtureDevelopmentConnection={status,message:status==='missing_cli'?'未检测到 Linky，请安装客户端后重新检测。':status==='needs_login'?'登录已失效':'网络暂不可用'};window.WB.go('dashboard')},status);await page.locator('.wb-dev').waitFor({state:'hidden'});await page.evaluate(()=>window.WB.go('agents'));await page.getByRole('button',{name:'重新检测',exact:true}).waitFor();await check(1280,'dark',status)
 }
 if(errors.length)throw Error(errors.join('\n'));writeFileSync(resolve(out,'report.json'),JSON.stringify({checks:report.length,report,errors},null,2));console.log(JSON.stringify({checks:report.length,errors,output:out}))
}finally{await browser.close()}
