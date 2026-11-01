/** Actual shipped UI, synthetic data; no network/model/business calls. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output=process.env.LAYOUT_OUTPUT||'/tmp/workbench-assistant-materials';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setViewportSize({width:1280,height:800})
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const WB=window.WB,at=new Date().toISOString(),data=WB.store.get().data;data.settings.assistantName='小鲸';data.tasks.push({id:'completed',title:'已完成的历史事项',status:'completed'});WB.store.set({data:{...data}})
  WB.getAssistantIdentity=()=>({name:'合成用户'});WB.loadAssistantIdentity=async()=>({name:'合成用户'})
  const rows=[{id:'system:analysis',kind:'system',fixed:true,title:'消息识别'},{id:'system:radar',kind:'system',fixed:true,title:'AI 资讯'},{id:'system:knowledge',kind:'system',fixed:true,title:'知识助手'},{id:'chat:identity',kind:'chat',title:'附件与身份验证'}]
  window.materialCalls=[]
  WB.actions.assistantHub=async request=>{window.materialCalls.push(request);if(request.action==='list')return {status:'ok',conversations:rows};if(request.action==='delta')return {status:'ok',entries:[],nextSeq:0,turnEnded:true};if(request.action!=='detail')throw Error('布局检查禁止业务操作：'+request.action);return {status:'ok',conversation:rows.find(row=>row.id===request.conversationId),sessionId:null,nativeBinding:{workspaceState:'unbound',canSend:true},messages:[{role:'system',text:'当前事项已恢复原会话，可以继续处理。',at}],turns:[
   {id:'manual',requestId:'m',text:'帮我核对这份项目资料，列出还缺什么。',at,source:'ai',trigger:'manual',status:'completed',reply:'材料已核对。还需要补充验收结论和项目的说明文档。',attachments:[{id:'attachment',type:'file',name:'项目资料.pdf',size:2048}],commands:[]},
   {id:'operation',requestId:'o',text:'查看未完成待办',at,source:'rule',trigger:'operation',status:'completed',reply:'当前有 2 项待办。可以指定其中一项继续处理。',commands:[{id:'command',operation:'task.list',label:'查看未完成待办',status:'completed'}]}
  ],events:[],runs:[],items:[],threads:[],confirmations:[],reinterpretSupported:true}}
  WB.assistant.openHub('chat:identity')
 })
 await page.getByRole('textbox',{name:'助手消息'}).waitFor()
 await page.locator('[data-chat-author="assistant"]').filter({hasText:'小鲸'}).waitFor()
 for(const [width,height] of [[1280,800],[800,700],[360,700],[360,360]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  const collapse=page.getByRole('button',{name:'收起会话列表'});if(width<640&&await collapse.count())await collapse.click()
  await page.locator('input[type=file][aria-label="选择助手附件"]').setInputFiles([{name:'项目资料.pdf',mimeType:'application/pdf',buffer:Buffer.from('synthetic only')},{name:'非常长的名称用于验证附件在窄窗口中换行且不会挤掉移除按钮.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic only')}])
  await page.getByRole('region',{name:'本轮附件'}).waitFor()
  const measure=async stage=>{
   const metrics=await page.evaluate(()=>{const root=document.querySelector('.wb-hub'),composer=document.querySelector('.wb-assistant-composer'),dialog=document.querySelector('[role="dialog"]'),menu=document.querySelector('[role="menu"][aria-label="添加资料方式"]'),box=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:el.scrollWidth-el.clientWidth}};return {root:box(root),composer:box(composer),dialog:box(dialog),menu:box(menu),cards:[...document.querySelectorAll('.wb-hub-turn-response,.wb-assistant-attachment')].map(box)}})
   report.push({width,height,theme,stage,...metrics});await page.screenshot({path:resolve(output,`${width}-${height}-${theme}-${stage}.png`),animations:'disabled'})
   for(const [kind,box] of Object.entries(metrics).filter(([key])=>key!=='cards'))if(box&&(box.overflow>2||box.left < -2||box.right>width+2||(['composer','dialog','menu'].includes(kind)&&(box.top<0||box.bottom>height+2))))throw Error(JSON.stringify(report.at(-1)))
   if(metrics.cards.some(box=>box.overflow>2))throw Error('消息或附件横向溢出：'+JSON.stringify(report.at(-1)))
  }
  const headers=await page.locator('[data-chat-author]').evaluateAll(rows=>rows.map(row=>{const avatar=row.querySelector('.wb-hub-avatar').getBoundingClientRect(),name=row.querySelector('.wb-hub-author-name').getBoundingClientRect();return {author:row.dataset.chatAuthor,offset:Math.abs(avatar.top+avatar.height/2-name.top-name.height/2)}}))
  if(headers.some(header=>header.offset>1))throw Error('头像与名称没有水平居中对齐 '+JSON.stringify({width,height,theme,headers}))
  await measure('draft')
  await page.getByRole('button',{name:'添加资料',exact:true}).click();await page.getByRole('menu',{name:'添加资料方式'}).waitFor();await measure('add-menu')
  await page.getByRole('menuitem',{name:/引用事项/}).click();await page.getByRole('dialog',{name:'引用事项'}).waitFor();await measure('reference-picker')
  if(await page.getByRole('dialog').getByText('completed',{exact:true}).count())throw Error('状态仍直接显示技术代码')
  if(await page.getByRole('dialog').getByText('已完成的历史事项',{exact:true}).count())throw Error('已完成事项没有默认隐藏')
  await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click()
  while(await page.getByRole('button',{name:/^移除附件：/}).count())await page.getByRole('button',{name:/^移除附件：/}).first().click()
  if(!await page.getByLabel('更多助手操作').evaluate(el=>el.closest('details').open))await page.getByLabel('更多助手操作').click();await page.getByRole('button',{name:'助手设置',exact:true}).click();await page.getByRole('dialog',{name:'助手设置'}).waitFor();await measure('assistant-settings');await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();await page.getByLabel('更多助手操作').click()
 }
 const geometry=await page.evaluate(()=>[...document.querySelectorAll('[data-chat-author]')].map(el=>{const avatar=el.querySelector('.wb-hub-avatar').getBoundingClientRect(),content=el.querySelector('.wb-hub-chat-content').getBoundingClientRect();return {author:el.dataset.chatAuthor,avatar:avatar.left,content:content.left}}))
 if(!geometry.some(row=>row.author==='user'&&row.avatar>row.content)||!geometry.some(row=>row.author==='rule'&&row.avatar<row.content))throw Error('聊天左右身份排列不正确')
 if((await page.evaluate(()=>window.materialCalls)).some(request=>!['list','detail','delta'].includes(request.action)))throw Error('选附件触发了会话创建或业务执行')
 writeFileSync(resolve(output,'report.json'),JSON.stringify({cases:report.length,report,errors,geometry},null,2));console.log(JSON.stringify({cases:report.length,errors,output}));if(errors.length)process.exitCode=1
}catch(error){await page.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({report,errors,error:String(error.stack||error)},null,2));throw error}finally{await browser.close()}
