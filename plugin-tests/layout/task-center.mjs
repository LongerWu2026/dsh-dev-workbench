/** Shipped client with synthetic long messages; no network or business writes. */
import {chromium,expect} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const out='/tmp/workbench-task-center';mkdirSync(out,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee;--dsw-alias-state-error-primary:#d22;--dsw-alias-state-warn-primary:#b60;--dsw-alias-state-success-primary:#080}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const WB=window.WB,data=WB.store.get().data,at=new Date().toISOString()
  const description='https://example.invalid/preview?fileId='+('long-link-and-query'.repeat(70))+' 请核对文档中的项目研发验收说明。'.repeat(20)
  WB.store.set({data:{...data,sources:[{id:'long-source',provider:'yunzhijia',sender:'合成同事',excerpt:description,selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:2},locator:{accountId:'fixture:me',groupId:'synthetic-group',groupName:'研发验收讨论群',sentAt:at}}],tasks:[
   {id:'long-task',title:'填写研发交付验收说明并核对超长链接中的文档内容',description,sourceRefId:'long-source',status:'ready',priority:'high',tags:['AI 识别','文档验收'],aiExtracted:true,dueAt:at,projectId:'developer-project',createdAt:at},
   {id:'calendar-task',title:'模型上下文与记忆机制评审',description:'讨论上下文管理与记忆机制，确认后续验证范围。',status:'ready',priority:'normal',meetingStart:at,tags:['会议'],createdAt:at},
   {id:'done-task',title:'已交付的研发事项',description:'保留已完成内容与真实状态。',status:'completed',priority:'low',tags:['历史交付'],createdAt:at},
  ]},page:'tasks'})
 })
 for(const [width,height] of [[1440,900],[1100,800],[800,700],[560,700],[360,700],[360,360]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>{document.documentElement.className=theme;document.querySelector('.wb-scroll').scrollTop=0},theme)
  await page.locator('.wb-task-row').first().waitFor();await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))))
  const metrics=await page.evaluate(()=>{
   const container=document.querySelector('.wb-task-table'),scroll=document.querySelector('.wb-scroll'),rows=[...document.querySelectorAll('.wb-task-row')],preview=document.querySelector('.wb-task-preview'),box=container.getBoundingClientRect()
   const controls=rows.flatMap(row=>[...row.querySelectorAll('button,select')]).filter(el=>{const rect=el.getBoundingClientRect();return rect.left<box.left-1||rect.right>box.right+1}).map(el=>el.getAttribute('aria-label')||el.textContent)
   return {pageOverflow:scroll.scrollWidth-scroll.clientWidth,tableOverflow:container.scrollWidth-container.clientWidth,controls,columns:rows.map(row=>row.children.length),previewHeight:preview.clientHeight,previewScrollHeight:preview.scrollHeight,rowDisplay:getComputedStyle(rows[0]).display,filterSummaryRows:document.querySelectorAll('.wb-task-filter-summary').length}
  })
  if(metrics.pageOverflow>2||metrics.tableOverflow>2||metrics.controls.length||metrics.columns.some(count=>count!==8)||metrics.previewHeight>=metrics.previewScrollHeight||metrics.filterSummaryRows!==1)throw Error(JSON.stringify({width,height,theme,...metrics}))
  if((await page.locator('.wb-task-meta').first().innerText()).includes('#AI 识别'))throw Error('重复 AI 标签仍展示')
  report.push({width,height,theme,...metrics});await page.screenshot({path:resolve(out,`${width}-${height}-${theme}.png`),animations:'disabled'})
 }
 await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'展开来源证据'}).first().click();await page.locator('.wb-task-full-description').waitFor()
 if(!(await page.locator('.wb-task-full-description').innerText()).includes('long-link-and-query'.repeat(70)))throw Error('展开后未保留完整描述')
 await page.getByRole('button',{name:'筛选',exact:true}).click();await page.getByLabel('筛选项目').waitFor();if(await page.locator('.wb-scroll').evaluate(el=>el.scrollWidth-el.clientWidth)>2)throw Error('展开筛选溢出')
 await page.getByRole('textbox',{name:'搜索待办'}).fill('已交付');await page.waitForFunction(()=>document.querySelectorAll('.wb-task-row').length===1);if(!(await page.locator('.wb-task-row').innerText()).includes('已交付的研发事项'))throw Error('搜索失效')
 await page.getByRole('button',{name:'重置筛选',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.wb-task-row').length===3)
 await page.locator('.wb-task-preview').first().click();await page.getByRole('complementary',{name:'编辑待办'}).waitFor();await expect(page.getByRole('textbox',{name:'标题',exact:true})).toHaveValue('填写研发交付验收说明并核对超长链接中的文档内容');if(await page.locator('.wb-task-row.is-editing').count()!==1)throw Error('编辑事项未唯一选中');if(await page.locator('.wb-context-header strong').innerText()!=='填写研发交付验收说明并核对超长链接中的文档内容'||await page.locator('.wb-context-header p').count())throw Error('编辑标题未精简');if(!(await page.getByRole('button',{name:'关闭编辑'}).locator('svg').count()))throw Error('关闭不是图标');for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.className=theme,theme);await page.screenshot({path:resolve(out,'edit-selection-'+theme+'.png')});if(await page.locator('.wb-workarea').evaluate(el=>el.scrollWidth-el.clientWidth)>2)throw Error('编辑态溢出')}await page.getByRole('button',{name:'关闭编辑',exact:true}).click();await page.waitForFunction(()=>!window.WB.store.get().taskForm?.open);if(await page.locator('.wb-task-row.is-editing').count())throw Error('关闭后选中未清除')
 writeFileSync(resolve(out,'report.json'),JSON.stringify({cases:report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out}));if(errors.length)process.exitCode=1
}catch(error){await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw error}finally{await browser.close()}
