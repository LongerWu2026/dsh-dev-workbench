// Isolated shipped-client checks; only synthetic records, no host connection.
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const base=dirname(fileURLToPath(import.meta.url)),out='/tmp/workbench-brief-overview';mkdirSync(out,{recursive:true})
const built=await build({entryPoints:[resolve(base,'fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const errors=[],report=[]
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee;--dsw-alias-state-error-primary:#d22;--dsw-alias-state-warn-primary:#b60;--dsw-alias-state-success-primary:#080}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync(resolve(base,'../../client.js'),'utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{const data=window.WB.store.get().data,now=Date.now();window.WB.store.set({data:{...data,messageInbox:{accountId:'me',at:new Date(now).toISOString(),unreadTotal:48,conversations:[{groupId:'one',name:'长会话名称'.repeat(30),unreadCount:48}]},lastMentionsFetch:{status:'partial',at:new Date(now).toISOString(),added:0,note:'合成部分同步状态'},tasks:[...data.tasks,...Array.from({length:7},(_,i)=>({id:'extra-'+i,title:'合成待办长标题与独立状态校验 '+i,status:'ready',priority:'high',tags:[]})),{id:'meeting',title:'评审消息提取与工作台改版方案',status:'ready',priority:'normal',eventType:'meeting',meetingStart:new Date(now+600000).toISOString(),meetingEnd:new Date(now+3600000).toISOString(),meetingLocation:'北汽会议室 1',tags:[]}]}})})
 await page.evaluate(()=>{const data=window.WB.store.get().data;window.WB.store.set({data:{...data,tasks:data.tasks.map((task,i)=>i===0?{...task,sourceRefId:'brief-message-source',aiExtracted:true}:task),sources:[...data.sources,{id:'brief-message-source',provider:'yunzhijia',sender:'合成同事',excerpt:'请核对交付内容',selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:0},locator:{accountId:'me',groupId:'synthetic-message-group',groupType:1,sentAt:new Date().toISOString()}}]}})})
 for(const width of [1280,800,360])for(const height of [600,320])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(t=>{document.documentElement.className=t;for(const b of document.querySelectorAll('.wb-brief-task-footer button[aria-expanded="true"]'))b.click();document.querySelector('.wb-scroll').scrollTo({top:0,behavior:'instant'});for(const d of document.querySelectorAll('details'))d.open=false},theme)
  await page.getByRole('heading',{name:/今日待办/}).waitFor();await page.waitForTimeout(120);if(await page.locator('.wb-root').count()!==1)throw Error('duplicate root');await page.screenshot({path:resolve(out,`${width}-${height}-${theme}.png`),animations:'disabled'})
  const metrics=await page.locator('.wb-scroll').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,taskBeforeMessage:!!(el.querySelector('section').compareDocumentPosition(el.querySelector('[aria-label="云之家重点收件箱"]'))&Node.DOCUMENT_POSITION_FOLLOWING)}))
  if(metrics.overflow>2||!metrics.taskBeforeMessage)throw Error(JSON.stringify(metrics))
  const taskActions=await page.locator('.wb-brief-task').evaluateAll(rows=>rows.map(row=>{const title=row.querySelector('.wb-brief-task-title'),edit=[...row.closest('article').querySelectorAll('button[aria-label^="编辑待办："]')].find(b=>b.getAttribute('aria-label')==='编辑待办：'+title.textContent),actions=row.querySelector('.wb-brief-task-actions'),r=actions.getBoundingClientRect(),t=title.getBoundingClientRect();return {hidden:!edit||[edit,...actions.querySelectorAll('button')].some(b=>!b.checkVisibility()||!!b.closest('details')),overlap:r.left<t.right-1,editInActions:edit?.parentElement===actions&&!edit.closest('.wb-brief-task-title')}}));if(taskActions.some(row=>row.hidden||row.overlap||!row.editInActions))throw Error('待办右侧操作隐藏或挤压标题 '+JSON.stringify(taskActions));

  if(await page.getByRole('button',{name:'评审消息提取与工作台改版方案',exact:true}).count()!==1)throw Error('duplicate meeting')
  if(await page.getByLabel('关联回复',{exact:true}).count()!==1)throw Error('linked reply duplicated');if(!await page.getByRole('group',{name:'消息来源',exact:true}).isVisible()||await page.getByRole('group',{name:'消息来源',exact:true}).evaluate(el=>!!el.closest('details')))throw Error('消息来源仍被折叠')
  if(width===1280){const newsBox=await page.getByRole('heading',{name:/AI 动态/}).boundingBox();if(newsBox.y>=height&&height===600)throw Error('news below first screen')}
  const beforeWidth=await page.locator('.wb-main').evaluate(el=>el.clientWidth);await page.locator('.wb-brief-task-actions button[aria-label^="编辑待办："]').first().click();await page.getByRole('dialog').waitFor();
  if(await page.locator('.wb-context-pane').count()||await page.locator('.wb-workarea.is-context-open').count())throw Error('首页编辑仍挤压列表');
  await page.screenshot({path:resolve(out,`edit-${width}-${height}-${theme}.png`),animations:'disabled'});
  const modal=await page.getByRole('dialog').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}));if(modal.overflow>2||modal.left<0||modal.right>width+1||await page.locator('.wb-main').evaluate(el=>el.clientWidth)!==beforeWidth)throw Error('编辑弹窗溢出或改变列表宽度');
  await page.getByRole('dialog').getByRole('button',{name:'保存修改',exact:true}).scrollIntoViewIfNeeded();if(!await page.getByRole('dialog').getByRole('button',{name:'保存修改',exact:true}).isVisible())throw Error('保存按钮不可达');await page.keyboard.press('Escape');if(await page.getByRole('dialog').count())throw Error('Escape未关闭编辑弹窗');
  await page.getByRole('button',{name:/AI 资讯 /}).click();await page.waitForFunction(()=>{const box=document.getElementById('wb-brief-news').getBoundingClientRect();return box.top<innerHeight&&box.bottom>0});await page.waitForTimeout(500)
  await page.getByText('云之家消息 ·',{exact:false}).click();await page.getByText('未读会话（1）',{exact:true}).click();await page.getByText('长会话名称'.repeat(30),{exact:true}).waitFor()
  const expandedOverflow=await page.locator('.wb-scroll').evaluate(el=>el.scrollWidth-el.clientWidth);if(expandedOverflow>2)throw Error('expanded overflow '+expandedOverflow)
  report.push({width,height,theme,...metrics,expandedOverflow})
 }
 if(errors.length)throw Error(errors.join('\n'))
 writeFileSync(resolve(out,'report.json'),JSON.stringify({cases:report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out}))
}finally{await browser.close()}
