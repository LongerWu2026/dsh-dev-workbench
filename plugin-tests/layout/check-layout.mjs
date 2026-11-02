import {openTools} from './tool-picker.mjs'
/** Real browser geometry on synthetic data. Does not attach to or drive the desktop app. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const base=dirname(fileURLToPath(import.meta.url)),out=process.env.LAYOUT_OUTPUT||'/tmp/workbench-layout'
mkdirSync(out,{recursive:true})
const built=await build({entryPoints:[resolve(base,'fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true})
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.abort())
const report=[]
try{
 await page.setContent(`<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee;--dsw-alias-state-error-primary:#d22;--dsw-alias-state-warn-primary:#b60;--dsw-alias-state-success-primary:#080}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>`)
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync(resolve(base,'../../client.js'),'utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 for(const width of [1280,800,560,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:600});await page.evaluate(t=>document.documentElement.className=t,theme)
  for(const section of ['dashboard','tasks','replies','radar','knowledge','web-ai','search','agents','toolbox','collab','settings']){
   await page.evaluate(p=>window.WB.go(p),section);await page.locator('.wb-page').first().waitFor();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
   const metrics=await page.evaluate(()=>{const root=document.querySelector('.wb-root'),scroll=document.querySelector('.wb-scroll'),nav=document.querySelector('.wb-topnav');const clippedControls=[...root.querySelectorAll('button,input,select,textarea')].filter(el=>{if(!el.checkVisibility())return false;const header=el.closest('.wb-task-table thead');if(header&&header.getBoundingClientRect().width<=1&&getComputedStyle(header).clipPath!=='none')return false;const r=el.getBoundingClientRect();for(let parent=el.parentElement;parent&&parent!==root;parent=parent.parentElement){const p=parent.getBoundingClientRect();if(['auto','scroll'].includes(getComputedStyle(parent).overflowX)&&parent.scrollWidth>parent.clientWidth+2)break;if(['hidden','clip'].includes(getComputedStyle(parent).overflowX)&&(r.left<p.left-2||r.right>p.right+2))return true}return false}).map(el=>(el.getAttribute('aria-label')||el.textContent||el.tagName).slice(0,60));return{pageOverflow:scroll.scrollWidth-scroll.clientWidth,rootOverflow:root.scrollWidth-root.clientWidth,navOverflow:nav.scrollWidth-nav.clientWidth,visibleHeight:scroll.clientHeight,clippedControls}})
   report.push({width,theme,section,...metrics});if(metrics.pageOverflow>2||metrics.rootOverflow>2||metrics.navOverflow>2||metrics.clippedControls.length)await page.screenshot({path:resolve(out,`${width}-${theme}-${section}.png`)})
  }
 }
 // Legacy office routes must remain navigable without restoring a duplicate run-list page.
 for(const width of [1280,800,560,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:700});await page.evaluate(t=>{document.documentElement.className=t;window.officeHistoryOriginal=window.WB.store.get().data;window.WB.store.set({page:'office',officeView:'history',data:{...window.officeHistoryOriginal,runs:[{id:'office-done',status:'completed',summary:'客户问题处理记录',startedAt:'2026-10-31T01:00:00Z',steps:[],evidence:[]}]}})},theme);
  await page.locator('.wb-assistant').waitFor();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const metrics=await page.evaluate(()=>{const state=window.WB.store.get(),assistant=document.querySelector('.wb-assistant');if(state.page!=='assistant'||state.assistantConversationId!=='system:office')throw Error('旧办公链接未迁入日常工作会话');if(!state.data.runs.some(run=>run.id==='office-done'))throw Error('迁移丢失旧执行数据');if(document.querySelector('.wb-office-history'))throw Error('仍展示孤立执行记录');return{overflow:assistant.scrollWidth-assistant.clientWidth,visibleHeight:assistant.getBoundingClientRect().height}});
  report.push({section:'legacy-office-assistant',width,theme,...metrics});await page.screenshot({path:resolve(out,`legacy-office-${width}-${theme}.png`)});
  await page.evaluate(()=>window.WB.store.set({data:window.officeHistoryOriginal,page:'dashboard',officeView:null,assistantOpen:false,assistantConversationId:null}));
 }
 for(const width of [800,360]){
  await page.setViewportSize({width,height:480});await page.evaluate(()=>{const data=window.WB.store.get().data;window.briefLayoutOriginal=data;const tasks=[...Array.from({length:12},(_,i)=>({id:'brief-old-'+i,title:'旧紧急待办'+i,status:'ready',priority:'high',dueAt:'2026-10-01T00:00:00Z',createdAt:'2026-10-01T00:00:00Z',tags:[]})),{id:'brief-new',title:'今日新识别普通待办',status:'ready',priority:'normal',createdAt:new Date().toISOString(),tags:[]},{id:'brief-normal',title:'历史普通待办',status:'ready',priority:'normal',createdAt:'2026-10-01T00:00:00Z',tags:[]}];window.WB.store.set({data:{...data,tasks}});window.WB.go('dashboard')})
  const taskPanel=page.locator('section').filter({has:page.getByRole('heading',{name:/^待办(?:\s|$)/})});await taskPanel.getByRole('button',{name:'今日新识别普通待办',exact:true}).waitFor();await taskPanel.getByRole('button',{name:'全部未完成 14',exact:true}).click();await taskPanel.getByRole('button',{name:'展开其余 6 条',exact:true}).click();await taskPanel.getByRole('button',{name:'历史普通待办',exact:true}).waitFor();await taskPanel.getByRole('button',{name:'收起列表',exact:true}).click()
  await taskPanel.getByRole('button',{name:'全部未完成 14',exact:true}).scrollIntoViewIfNeeded();const metrics=await page.locator('.wb-scroll').evaluate(el=>({pageOverflow:el.scrollWidth-el.clientWidth,visibleHeight:el.clientHeight}));report.push({section:'brief-new-task-and-expand',width,...metrics});await page.screenshot({path:resolve(out,`brief-new-tasks-${width}.png`)});await page.evaluate(()=>{window.WB.store.set({data:window.briefLayoutOriginal});window.WB.go('replies')})
 }
 for(const width of [800,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:600});await page.evaluate(t=>{document.documentElement.className=t;window.WB.go('web-ai')},theme)
  const name='附件长名称_'.repeat(12)+'.txt';await page.getByLabel('选择问题附件').setInputFiles({name,mimeType:'text/plain',buffer:Buffer.from('synthetic attachment')})
  await page.getByRole('button',{name:'移除附件 '+name,exact:true}).waitFor()
  const metrics=await page.locator('.wb-web-ai').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,visibleHeight:el.getBoundingClientRect().height}));report.push({section:'web-ai-attachment-preview',width,theme,...metrics});await page.screenshot({path:resolve(out,`attachments-${width}-${theme}.png`)});await page.getByRole('button',{name:'移除附件 '+name,exact:true}).click()
 }
 for(const width of [800,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:600});await page.evaluate(t=>{document.documentElement.className=t;window.WB.go('web-ai');const now=new Date().toISOString();window.WB.store.set({data:{...window.WB.store.get().data,revision:5,webAI:{topics:Array.from({length:40},(_,i)=>({id:'history-'+i,title:'长历史名称'.repeat(20)+i,createdAt:now,conversations:{}})),rounds:[],chatgptEnabled:false}}})},theme)
  if(!await page.getByRole('button',{name:'管理历史与回收站',exact:true}).isVisible())await page.getByRole('button',{name:'会话历史',exact:true}).click();
  await page.getByRole('button',{name:'管理历史与回收站',exact:true}).click();await page.getByRole('textbox',{name:'搜索历史问答'}).waitFor();await page.getByRole('button',{name:'历史下一页'}).click();await page.getByRole('button',{name:/重命名问答/}).first().click();await page.getByRole('textbox',{name:'问答名称'}).waitFor()
  const metrics=await page.evaluate(()=>({pageOverflow:document.querySelector('.wb-scroll').scrollWidth-document.querySelector('.wb-scroll').clientWidth,dialogOverflow:Math.max(0,document.querySelector('.wb-modal').getBoundingClientRect().right-innerWidth)}));report.push({section:'web-ai-history-pagination-edit',width,theme,...metrics});await page.screenshot({path:resolve(out,`history-${width}-${theme}.png`)});await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('button',{name:'收起历史',exact:true}).click()
 }
 for(const width of [800,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:600});await page.evaluate(t=>{document.documentElement.className=t;window.WB.go('toolbox')},theme);
  await openTools(page);await page.getByRole('button',{name:'全部',exact:true}).click();
  for(const name of [/JSON 格式化/,/文本 Diff/,/日志分析 日志筛选/,/类型生成 JSON/,/接口调试 HTTP/,/正则 匹配/,/SQL 关键字/]){
   await openTools(page);await page.getByRole('button',{name}).click();
   const metrics=await page.locator('.wb-scroll').evaluate(el=>({pageOverflow:el.scrollWidth-el.clientWidth,visibleHeight:el.clientHeight}));report.push({section:'developer-tool-'+String(name),width,theme,...metrics});
  }
  await openTools(page);await page.getByRole('textbox',{name:'搜索工具'}).fill('TypeScript');await page.getByRole('button',{name:/类型生成 JSON/}).waitFor();await page.getByRole('textbox',{name:'搜索工具'}).fill('');
  await page.screenshot({path:resolve(out,`toolbox-upgrade-${theme}-${width}.png`)});
 }
 for(const width of [800,360]){
  await page.setViewportSize({width,height:600});await page.evaluate(()=>window.WB.go('toolbox'))
  const focusGroup=page.locator('.wb-tool-focus-group'),focusTool=page.getByRole('button',{name:/番茄钟 25 分钟/});if(await focusGroup.evaluate(el=>el.open)||await focusTool.isVisible())throw Error('专注分组应默认折叠')
  await openTools(page);await focusGroup.locator('summary').click();await focusTool.click();await page.getByRole('button',{name:'开始',exact:true}).waitFor();await openTools(page);await focusGroup.locator('summary').click();if(await focusTool.isVisible())throw Error('收起分组后入口仍可见');report.push({section:'toolbox-focus-group',width,collapsedByDefault:true,canOpenAndCollapse:true});
  await page.getByRole('button',{name:'网络',exact:true}).click();
  for(const [section,name] of [['http-debug',/接口调试 HTTP/],['mcp-debug',/MCP 调试 连接/]]){
   await openTools(page);await page.getByRole('button',{name}).click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)))
   const metrics=await page.locator('.wb-scroll').evaluate(el=>({pageOverflow:el.scrollWidth-el.clientWidth,visibleHeight:el.clientHeight}));report.push({section,width,...metrics});await page.screenshot({path:resolve(out,`${section}-${width}.png`)})
  }
  await page.evaluate(()=>window.WB.go('collab'));await page.getByRole('button',{name:'启动 pnpm run dev'}).waitFor();await page.getByRole('button',{name:'启动配置',exact:true}).click()
  const metrics=await page.locator('.wb-scroll').evaluate(el=>({pageOverflow:el.scrollWidth-el.clientWidth,visibleHeight:el.clientHeight}));report.push({section:'project-launcher',width,...metrics});await page.screenshot({path:resolve(out,`project-launcher-${width}.png`)})
 }
 await page.setViewportSize({width:360,height:480});await page.evaluate(()=>window.WB.go('tasks'))
 await page.getByRole('region',{name:'任务列表，可横向滚动查看操作'}).waitFor()
 await page.getByRole('button',{name:'编辑',exact:true}).click()
 await page.locator('input[value="窄窗口验收：交付包含详细说明的开发功能"]').waitFor()
 report.push({section:'task-edit-after-horizontal-scroll',width:360,passed:true})
 await page.evaluate(()=>window.WB.openTaskForm(null))
 await page.getByPlaceholder('例如：评审 @张三 提到的网关限流方案').waitFor();await page.screenshot({path:resolve(out,'task-form-360.png')})
 const form=await page.locator('.wb-context-pane').evaluate(el=>({width:el.getBoundingClientRect().width,overflow:el.scrollWidth-el.clientWidth}));report.push({section:'task-form',width:360,...form})
 await page.evaluate(()=>{window.WB.store.set({taskForm:null,assistantOpen:true,contextHidden:true})});await page.getByPlaceholder('输入指令，或让我帮你整理待办…').waitFor();await page.screenshot({path:resolve(out,'assistant-360.png')})
 const assistant=await page.locator('.wb-assistant').evaluate(el=>({width:el.getBoundingClientRect().width,overflow:el.scrollWidth-el.clientWidth}));report.push({section:'assistant',width:360,...assistant})
 await page.evaluate(()=>window.WB.store.set({assistantRefs:Array.from({length:8},(_,i)=>({kind:'task',id:'context-'+i,title:'带有长标题的合成上下文 '+i}))}))
 await page.getByRole('region',{name:'已选择的上下文'}).waitFor();await page.screenshot({path:resolve(out,'assistant-contexts-360.png')})
 const composer=await page.getByPlaceholder('输入指令，或让我帮你整理待办…').evaluate(el=>({bottom:el.getBoundingClientRect().bottom,viewport:innerHeight,boxes:['.wb-workarea','.wb-assistant','.wb-assistant-composer'].map(s=>{const n=document.querySelector(s),r=n.getBoundingClientRect();return{selector:s,height:r.height,top:r.top,minHeight:getComputedStyle(n).minHeight,maxHeight:getComputedStyle(n).maxHeight}})}));report.push({section:'assistant-contexts',width:360,composerOutside:composer.bottom>composer.viewport+2,composer})
 await page.setViewportSize({width:360,height:320});await page.getByPlaceholder('输入指令，或让我帮你整理待办…').scrollIntoViewIfNeeded()
 const shortInput=await page.getByPlaceholder('输入指令，或让我帮你整理待办…').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+2)
 await page.getByRole('button',{name:'发送',exact:true}).scrollIntoViewIfNeeded();const shortSend=await page.getByRole('button',{name:'发送',exact:true}).evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+2)
 report.push({section:'short-assistant-scroll',width:360,height:320,composerOutside:!shortInput||!shortSend})
 await page.evaluate(()=>window.WB.store.set({assistantOpen:false,assistantRefs:[]}))
 for(const zoom of [1.5,2]){
  await page.setViewportSize({width:960,height:640});await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom)
  for(const section of ['dashboard','tasks','settings']){
   await page.evaluate(p=>window.WB.go(p),section);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
   const metrics=await page.locator('.wb-scroll').evaluate(el=>({pageOverflow:el.scrollWidth-el.clientWidth,visibleHeight:el.clientHeight}));report.push({section,zoom,...metrics});await page.screenshot({path:resolve(out,`zoom-${zoom}-${section}.png`)})
  }
 }
 await page.evaluate(()=>{document.documentElement.style.zoom='1';window.WB.store.set({assistantOpen:false,assistantRefs:[],taskForm:null})})

 for(const width of [800,360]){
  await page.setViewportSize({width,height:480});await page.evaluate(()=>{window.WB.store.set({assistantOpen:false,assistantRefs:[]});window.WB.go('knowledge')});await page.getByRole('textbox',{name:'知识检索测试问题'}).fill('接口发布验收');await page.getByRole('button',{name:'测试检索'}).click();if(!await page.locator('section[aria-label="知识检索依据"] details').evaluate(el=>el.open))await page.getByText(/知识依据 · 1 个片段/).click();await page.getByRole('button',{name:/合成知识验收规范.*行1/}).click();await page.getByRole('dialog').waitFor();const metrics=await page.getByRole('dialog').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,visibleHeight:el.getBoundingClientRect().height}));report.push({section:'knowledge-source-modal',width,...metrics});await page.screenshot({path:resolve(out,`knowledge-source-${width}.png`)});await page.getByRole('button',{name:'关闭',exact:true}).click()
 }
 await page.evaluate(()=>{const data=window.WB.store.get().data;window.WB.store.set({data:{...data,revision:100,tasks:[{id:'layout-message-task',title:'消息时间布局验收',status:'ready',priority:'high',sourceRefId:'layout-source',sourceRefs:[],tags:[]}],replies:[{id:'layout-reply',sourceId:'layout-source',msgId:'original-message',stage:'待回复',contact:'BOT-6a50…',taskIds:[]}],sources:[{id:'layout-source',provider:'yunzhijia',sender:'BOT-6a50…',excerpt:'原消息'+('original-text-'.repeat(30)),locator:{groupId:'session-'.repeat(10),groupName:'研发协作讨论群'.repeat(8),senderId:'BOT-6a501234abcd',msgId:'original-message',accountId:'fixture:me',sentAt:'2026-08-24T01:32:03.405Z'}}]}});window.WB.go('replies')})
 for(const width of [800,360])for(const section of ['dashboard','replies']){
  await page.setViewportSize({width,height:480});await page.evaluate(section=>window.WB.go(section),section);await page.locator('.wb-item-title, .wb-reply-item strong').filter({hasText:'机器人'}).first().waitFor();if(section==='dashboard'&&await page.getByRole('group',{name:'消息来源'}).first().evaluate(el=>!!el.closest('details')))throw Error('首页消息来源不应折叠');await page.getByText('来自：'+'研发协作讨论群'.repeat(8),{exact:false}).first().waitFor()
  const metrics=await page.locator('.wb-scroll').evaluate(el=>({pageOverflow:el.scrollWidth-el.clientWidth,visibleHeight:el.clientHeight}));report.push({section:'reply-group-origin-'+section,width,...metrics});await page.screenshot({path:resolve(out,`reply-group-${section}-${width}.png`)})
 }
 for(const width of [800,360])for(const section of ['dashboard','tasks-list','tasks-board']){
  await page.setViewportSize({width,height:480});await page.evaluate(section=>window.WB.go(section==='dashboard'?'dashboard':'tasks'),section);if(section!=='dashboard')await page.getByRole('button',{name:section==='tasks-list'?'列表':'看板',exact:true}).click()
  if(section==='dashboard'&&await page.getByRole('group',{name:'消息来源'}).first().evaluate(el=>!!el.closest('details')))throw Error('首页消息来源不应折叠');
  const metadata=page.getByRole('group',{name:'消息来源'}).first();await metadata.waitFor();const content=await metadata.innerText();if(section==='tasks-list'){await page.getByRole('columnheader',{name:'消息发出时间'}).waitFor();await page.getByText('2026-08-24 09:32:03',{exact:true}).waitFor();}else if(!content.includes('消息发出时间：2026-08-24 09:32:03（北京时间）'))throw Error('任务消息时间缺失: '+section);await metadata.scrollIntoViewIfNeeded()
  const metrics=await page.locator('.wb-scroll').evaluate(el=>({pageOverflow:el.scrollWidth-el.clientWidth,visibleHeight:el.clientHeight}));report.push({section:'task-message-time-'+section,width,...metrics});await page.screenshot({path:resolve(out,`task-message-time-${section}-${width}.png`)})
 }
 for(const width of [1280,800,360]){
  await page.setViewportSize({width,height:480});await page.evaluate(()=>window.WB.go('tasks'));await page.getByRole('button',{name:'列表',exact:true}).click()
  const sortHeader=page.getByRole('button',{name:'按消息发出时间排序'}),sortBox=await sortHeader.evaluate(el=>{const rect=el.closest('thead').getBoundingClientRect();return{width:rect.width,height:rect.height}});if(sortBox&&sortBox.width>8&&sortBox.height>8)await sortHeader.click();else await page.getByLabel('待办排序').selectOption('message-newest');if(await page.getByLabel('待办排序').inputValue()!=='message-newest')throw Error('消息排序控件未生效')
  if(await page.getByRole('button',{name:/^筛选/}).getAttribute('aria-expanded')==='false')await page.getByRole('button',{name:/^筛选/}).click();
  await page.getByLabel('消息发出日期起始').fill('2026-08-24');await page.getByLabel('消息发出日期截止').fill('2026-08-24');await page.getByRole('button',{name:'消息时间布局验收',exact:true}).waitFor()
  await page.getByLabel('消息发出日期起始').fill('2026-08-25');await page.getByLabel('消息发出日期截止').fill('2026-08-25');await page.getByText('没有匹配的待办',{exact:true}).waitFor()
  await page.getByRole('button',{name:'重置筛选'}).first().click();await page.getByRole('button',{name:'消息时间布局验收',exact:true}).waitFor()
  const metrics=await page.locator('.wb-scroll').evaluate(el=>({pageOverflow:el.scrollWidth-el.clientWidth,visibleHeight:el.clientHeight}));report.push({section:'task-message-date-controls',width,...metrics});await page.screenshot({path:resolve(out,`task-message-date-controls-${width}.png`)})
 }
 await page.evaluate(()=>window.WB.go('replies'))
 for(const width of [800,360])for(const height of [480,320]){
  await page.setViewportSize({width,height});const replyButton=page.getByRole('button',{name:'回复',exact:true});if(await replyButton.isVisible())await replyButton.click()
  await page.getByRole('textbox',{name:'回复草稿'}).fill('这是最终回复正文。\n'+('long-reply-text-'.repeat(30)));await page.getByRole('button',{name:'发送回复',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByText('查看发送定位',{exact:true}).click();await page.getByRole('button',{name:'确认发送',exact:true}).scrollIntoViewIfNeeded()
  const metrics=await page.getByRole('dialog').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,visibleHeight:el.getBoundingClientRect().height}));report.push({section:'reply-send-confirmation',width,height,...metrics});await page.screenshot({path:resolve(out,`reply-confirm-${width}-${height}.png`)});await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click()
 }
 for(const width of [800,360])for(const entry of ['list','board','form']){
  await page.setViewportSize({width,height:480});await page.evaluate(()=>{const data=window.WB.store.get().data;window.WB.store.set({taskForm:null,data:{...data,revision:980,tasks:[{id:'task-reply-layout',title:'私聊任务回复布局验收',status:'ready',priority:'normal',sourceRefId:'task-reply-source',tags:[]}],sources:[{id:'task-reply-source',provider:'yunzhijia',sender:'合成同事',excerpt:'代码记得提交。'+('原消息长文本'.repeat(100)),locator:{groupType:1,groupId:'synthetic-private',groupName:'合成私聊',msgId:'synthetic-private-message',accountId:'fixture:me',direction:'inbound',sentAt:'2026-10-29T09:18:41Z'}}],replies:[{id:'task-reply-layout-record',sourceId:'task-reply-source',groupId:'synthetic-private',msgId:'synthetic-private-message',accountId:'fixture:me',stage:'不需回复',triage:'task',taskIds:['task-reply-layout']}],replyDrafts:{}}});window.WB.go('tasks')})
  await page.getByRole('button',{name:entry==='board'?'看板':'列表',exact:true}).click()
  if(entry==='form')await page.getByRole('button',{name:'私聊任务回复布局验收',exact:true}).click()
  await page.getByRole('button',{name:entry==='list'?'回复原会话 私聊任务回复布局验收':'回复原会话',exact:true}).click()
  const editor=page.getByRole('textbox',{name:'回复草稿'});await editor.fill('这是核对进度的合成草稿。\n'+('保留待办独立状态'.repeat(60)));await page.getByRole('button',{name:'发送回复',exact:true}).click()
  const dialog=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'确认发送回复',exact:true})});await dialog.waitFor();await dialog.getByRole('button',{name:'确认发送',exact:true}).scrollIntoViewIfNeeded()
  const metrics=await dialog.evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,visibleHeight:el.getBoundingClientRect().height}));report.push({section:'task-private-reply-'+entry,width,...metrics});await page.screenshot({path:resolve(out,`task-private-reply-${entry}-${width}.png`)});await dialog.getByRole('button',{name:'取消',exact:true}).click()
  await page.evaluate(()=>window.WB.store.set({taskForm:null}));await page.evaluate(()=>window.WB.go('replies'))
 }
 for(const width of [800,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:480});await page.evaluate(theme=>{document.documentElement.className=theme;const data=window.WB.store.get().data,now=Date.now();window.WB.store.set({data:{...data,revision:999,messageInbox:{accountId:'fixture:me',at:new Date(now).toISOString(),unreadTotal:123,conversations:[{groupId:'long-inbox',name:'超长未读会话名称'.repeat(40),unreadCount:123}],calendar:{status:'ok',found:1}},sources:[{id:'calendar-fixture',provider:'yunzhijia-calendar',locator:{accountId:'fixture:me'}}],tasks:[{id:'calendar-task',eventType:'meeting',title:'超长会议主题'.repeat(30),meetingStart:new Date(now+600000).toISOString(),meetingEnd:new Date(now+3600000).toISOString(),meetingLocation:'超长会议地点'.repeat(30),status:'ready',priority:'normal',sourceRefId:'calendar-fixture',tags:[]}]}});window.WB.go('dashboard')},theme)
  const inbox=page.getByLabel('云之家重点收件箱');await inbox.waitFor({state:'attached'});if(!await inbox.evaluate(el=>el.closest('details').open))await page.getByText('云之家消息 ·',{exact:false}).click();await inbox.waitFor();await inbox.getByRole('button',{name:/^查看会话：/}).waitFor();const metrics=await page.locator('.wb-scroll').evaluate(el=>({pageOverflow:el.scrollWidth-el.clientWidth,visibleHeight:el.clientHeight}));report.push({section:'focused-inbox-expanded',width,theme,...metrics});await page.screenshot({path:resolve(out,`focused-inbox-${width}-${theme}.png`)})
 }
 for(const width of [800,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:600});await page.evaluate(theme=>{
   document.documentElement.className=theme;const WB=window.WB,data=WB.store.get().data;
   WB.store.set({data:{...data,revision:1150,messageInbox:{accountId:'preview-account',at:new Date().toISOString(),unreadTotal:28,conversations:Array.from({length:7},(_,i)=>({groupId:'preview-'+i,name:i===0?'默认可见的超长会话名称'.repeat(30):'合成未读会话 '+(i+1),latestMsgId:'preview-head-'+i,unreadCount:i+1})),calendar:{status:'ok',found:1}}}});WB.go('dashboard')
  },theme)
  const inbox=page.getByLabel('云之家重点收件箱');await inbox.waitFor();const rows=inbox.getByRole('listitem');if(await rows.count()!==3)throw Error('未读会话默认不是3条');await inbox.getByRole('button',{name:/^查看会话：/}).first().waitFor();if(/查阅后从工作台|AI 判定无关|云之家仍为未读/.test(await inbox.innerText()))throw Error('消息概览仍包含规则说明')
  await inbox.getByRole('button',{name:'展开更多（3条）',exact:true}).click();if(await rows.count()!==6)throw Error('首次展开未增加到6条');await inbox.getByRole('button',{name:'展开更多（1条）',exact:true}).click();if(await rows.count()!==7)throw Error('末批未读没有完整展示');await inbox.getByRole('button',{name:'收起列表',exact:true}).click();if(await rows.count()!==3)throw Error('收起后没有恢复3条')
  await inbox.getByRole('heading',{name:'未读会话（7）',exact:true}).scrollIntoViewIfNeeded();const metrics=await page.locator('.wb-scroll').evaluate(el=>({pageOverflow:el.scrollWidth-el.clientWidth,visibleHeight:el.clientHeight}));report.push({section:'unread-conversation-preview',width,theme,...metrics});await page.screenshot({path:resolve(out,`unread-preview-${width}-${theme}.png`)})
 }
 for(const width of [800,360])for(const theme of ['light','dark'])for(const triage of ['pending','task']){
  await page.setViewportSize({width,height:480});await page.evaluate(({theme,triage})=>{document.documentElement.className=theme;const data=window.WB.store.get().data;window.WB.store.set({data:{...data,revision:1100,sources:[{id:'routing-source',provider:'yunzhijia',sender:'合成同事',excerpt:'合成私聊具体事项'.repeat(20),selection:{policy:'focused-v1',reasons:['unread'],unreadCount:1},locator:{accountId:'fixture:me',groupId:'private-group',groupType:1,msgId:'routing-message',groupName:'合成私聊',sentAt:new Date().toISOString()}}],replies:[{id:'routing-reply',sourceId:'routing-source',msgId:'routing-message',stage:triage==='pending'?'待回复':'不需回复',triage,taskIds:triage==='task'?['synthetic-task']:[],snippet:'合成私聊具体事项'.repeat(20)}]}});window.WB.go('replies')},{theme,triage})
  if(triage==='task')await page.getByTitle('回复阶段').selectOption('all');await page.getByText(triage==='pending'?'待AI识别':'已转待办',{exact:true}).first().waitFor();const metrics=await page.locator('.wb-scroll').evaluate(el=>({pageOverflow:el.scrollWidth-el.clientWidth,visibleHeight:el.clientHeight}));report.push({section:'private-reply-route-'+triage,width,theme,...metrics});await page.screenshot({path:resolve(out,`private-reply-${triage}-${width}-${theme}.png`)})
 }
 for(const [width,height] of [[1280,800],[800,700],[360,700],[360,360]])for(const theme of ['light','dark'])for(const unreadCount of [2,35]){
  await page.setViewportSize({width,height});await page.evaluate(({theme,unreadCount})=>{
   document.documentElement.className=theme;const WB=window.WB,data=WB.store.get().data,at=new Date().toISOString()
   window.readerScrollCalls=[]
   WB.actions.conversationRead=async()=>({status:"ok"})
   WB.actions.conversationMessages=async request=>{window.readerScrollCalls.push(request);const history=request.mode==='history',count=history?request.cursor*10:0,start=history?40-count:40;return {status:'ok',viewId:'layout-reader',accountId:request.accountId,groupId:request.groupId,unreadComplete:true,hasMoreHistory:count<40,batchComplete:true,nextCursor:history?request.cursor+1:1,unreadTotal:unreadCount,unreadLoaded:unreadCount,contextLoaded:count,messages:Array.from({length:history?10:unreadCount},(_,i)=>{const index=start+i;return {id:'reader-'+index,sender:index%5?'合成同事':'我',own:index%5===0,unread:!history,at,text:index===40&&unreadCount>2?'未读的第一条消息：'+('超长消息含链接https://example.invalid/long-path-and-query'.repeat(30)):'上下文与未读聊天内容 · '+index}})}}
   WB.store.set({taskForm:null,data:{...data,revision:1200,messageInbox:{accountId:'reader-account',at,unreadTotal:unreadCount,conversations:[{groupId:'reader-group',name:'项目讨论与故障排查会话名称'.repeat(8),latestMsgId:'reader-44',unreadCount}],calendar:{status:'ok',found:0}}}});WB.go('dashboard')
  },{theme,unreadCount})
  const inbox=page.getByLabel('云之家重点收件箱');await inbox.waitFor({state:'attached'});if(!await inbox.evaluate(el=>el.closest('details').open))await page.getByText('云之家消息 ·',{exact:false}).click()
  await inbox.getByRole('button',{name:/^查看会话：/}).waitFor();await inbox.getByRole('button',{name:/^查看会话：/}).click()
  const reader=page.getByRole('dialog');await reader.locator('.wb-conversation-message').last().waitFor();await reader.getByText('以下为打开时的未读消息',{exact:true}).waitFor()
  await reader.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))))
  if(await reader.locator('.wb-conversation-message').count()!==unreadCount||await reader.getByText('历史消息 · 10 条',{exact:true}).count())throw Error('首次打开提前展示了历史')
  const beforeAnchor=await reader.locator('[data-message-id="reader-40"]').evaluate(el=>{const body=el.closest('.wb-modal-body');body.scrollTop=0;return {offset:el.getBoundingClientRect().top-body.getBoundingClientRect().top}})
  await reader.locator('.wb-modal-body').hover();await page.mouse.wheel(0,-100)
  await reader.getByText('历史消息 · 10 条',{exact:true}).waitFor();await reader.locator('.wb-conversation-history-control button').waitFor()
  const afterAnchor=await reader.locator('[data-message-id="reader-40"]').evaluate(el=>el.getBoundingClientRect().top-el.closest('.wb-modal-body').getBoundingClientRect().top)
  if(Math.abs(beforeAnchor.offset-afterAnchor)>2)throw Error('插入历史后阅读位置跳动 '+JSON.stringify({width,height,theme,beforeAnchor,afterAnchor}))
  if(await reader.locator('.wb-conversation-message').count()!==unreadCount+10||(await page.evaluate(()=>window.readerScrollCalls)).filter(r=>r.mode==='history').length!==1)throw Error('一次上滚没有恰好加载10条')
  const currentAnchor=await reader.locator('[data-message-id="reader-30"]').evaluate(el=>{const body=el.closest('.wb-modal-body');body.scrollTop=0;return {offset:el.getBoundingClientRect().top-body.getBoundingClientRect().top}})
  await page.mouse.wheel(0,1);await page.mouse.wheel(0,-100);await reader.getByText('历史消息 · 20 条',{exact:true}).waitFor()
  const secondAnchor=await reader.locator('[data-message-id="reader-30"]').evaluate(el=>el.getBoundingClientRect().top-el.closest('.wb-modal-body').getBoundingClientRect().top)
  if(Math.abs(currentAnchor.offset-secondAnchor)>2||await reader.locator('.wb-conversation-message').count()!==unreadCount+20)throw Error('第二批历史数量或阅读位置不正确 '+JSON.stringify({width,height,theme,currentAnchor,secondAnchor}))
    const metrics=await reader.evaluate(el=>{const rect=el.getBoundingClientRect(),body=el.querySelector('.wb-modal-body'),foot=el.querySelector('.wb-modal-foot').getBoundingClientRect();return {overflow:el.scrollWidth-el.clientWidth,bodyOverflow:body.scrollWidth-body.clientWidth,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,bodyHeight:body.clientHeight,footerBottom:foot.bottom}})
  report.push({section:'conversation-reader',width,height,theme,unreadCount,...metrics});if(metrics.overflow>2||metrics.bodyOverflow>2||metrics.left< -2||metrics.right>width+2||metrics.top< -2||metrics.bottom>height+2||metrics.bodyHeight<25||metrics.footerBottom>height+2)throw Error('会话查阅弹窗溢出 '+JSON.stringify(report.at(-1)))
  await page.screenshot({path:resolve(out,`conversation-reader-${width}-${height}-${theme}-${unreadCount}.png`),animations:'disabled'});await reader.getByRole('button',{name:'关闭',exact:true}).click();await reader.waitFor({state:'hidden'})
 }
 // Unified refresh stays compact; progress and long errors remain usable in small windows.
 for(const width of [1280,800,560,360])for(const height of [700,320])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(({theme})=>{document.documentElement.className=theme;window.fixtureWorkspaceRefresh={id:'layout-refresh',scope:'all',status:'partial',collecting:false,startedAt:new Date().toISOString(),steps:{messages:{status:'completed',note:'消息与日历已更新'},analysis:{status:'paused',note:'模型限流，保留原消息，稍后重试',jobId:'layout-analysis',nextRetryAt:'2026-11-02T06:10:00Z',progress:{processed:500,remaining:700,failed:3,batches:10,pauseReason:'模型限流，稍后自动继续'}},news:{status:'failed',note:'搜索连接失败：'+('长错误说明'.repeat(60))}}};window.WB.store.set({page:'dashboard',workspaceRefresh:window.fixtureWorkspaceRefresh,toasts:[]});document.querySelector('.wb-scroll').scrollTo({top:0,behavior:'instant'})},{theme});
  await page.getByRole('button',{name:'查看刷新进度',exact:true}).click();const dialog=page.getByRole('dialog',{name:'刷新进度',exact:true});await dialog.waitFor();
  if(await page.getByLabel('首页提取状态').count())throw Error('首页旧提取操作栏仍显示');
  const metrics=await dialog.evaluate(el=>{const rect=el.getBoundingClientRect(),body=el.querySelector('.wb-modal-body');return{overflow:el.scrollWidth-el.clientWidth,bodyOverflow:body.scrollWidth-body.clientWidth,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom}});
  if(metrics.overflow>2||metrics.bodyOverflow>2||metrics.left< -2||metrics.right>width+2||metrics.top< -2||metrics.bottom>height+2)throw Error('刷新进度弹窗溢出 '+JSON.stringify({width,height,theme,...metrics}));
  await dialog.getByRole('button',{name:'查看识别队列',exact:true}).scrollIntoViewIfNeeded();if(!await dialog.getByRole('button',{name:'查看识别队列',exact:true}).isVisible())throw Error('刷新后续入口不可达');
  report.push({section:'workspace-refresh',width,height,theme,...metrics});await page.screenshot({path:resolve(out,`refresh-${width}-${height}-${theme}.png`),animations:'disabled'});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 }
 writeFileSync(resolve(out,'report.json'),JSON.stringify({report,errors},null,2));const failures=report.filter(r=>r.dialogOverflow>2||r.pageOverflow>2||r.rootOverflow>2||r.navOverflow>2||r.overflow>2||r.visibleHeight===0||r.clippedControls?.length||r.composerOutside)
 console.log(JSON.stringify({cases:report.length,errors,failures,output:out},null,2));if(failures.length||errors.length)process.exitCode=1
}finally{await browser.close()}
