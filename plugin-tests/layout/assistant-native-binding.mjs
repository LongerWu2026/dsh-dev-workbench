/** Native conversation/workspace layout using synthetic data and blocked network. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output=process.env.LAYOUT_OUTPUT||'/tmp/workbench-assistant-native-binding';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setViewportSize({width:1280,height:800})
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const WB=window.WB,at=new Date().toISOString(),workspace={workspaceState:'bound',workspaceId:'workspace-synthetic',workspaceTitle:'合成研发工作区 · 长工程名称用于检查完整路径提示与标题截断',cwd:'/synthetic/projects/research-workspace'}
  const rows=[{id:'system:analysis',kind:'system',fixed:true,title:'消息识别'},{id:'system:radar',kind:'system',fixed:true,title:'AI资讯'},{id:'system:knowledge',kind:'system',fixed:true,title:'知识助手'},
   {id:'development:synthetic',kind:'development',entityId:'synthetic',title:'US-SYNTHETIC · 已有工作区的研发事项',status:'waiting_review',nativeBinding:{...workspace,sessionId:'native-main',primarySessionId:'native-main',canSend:true}},
   {id:'task:synthetic',kind:'task',entityId:'synthetic',title:'合成待办',status:'doing',nativeBinding:{...workspace,sessionId:'native-task',canSend:true}},
   {id:'reply:synthetic',kind:'reply',entityId:'synthetic',title:'合成待回复',status:'待回复',nativeBinding:{workspaceState:'unbound',sessionId:'native-reply',canSend:true}},
   {id:'chat:native-chat',kind:'chat',title:'已有普通聊天',nativeBinding:{workspaceState:'unbound',sessionId:'native-chat',canSend:true}}]
  window.bindingCalls=[];window.bindingSelected={};window.bindingOpened=[];window.bindingPanels=0
  WB.openSessionById=id=>{window.bindingOpened.push(id);return true};WB.openConversation=()=>{window.bindingPanels++;return true}
  const detail=request=>{
   const conversation=rows.find(row=>row.id===request.conversationId),development=conversation.kind==='development',sessionId=request.sessionId||window.bindingSelected[conversation.id]||conversation.nativeBinding?.sessionId||null,review=sessionId==='native-review'
   const threads=development?[{id:'native-main',title:'已有开发会话',role:'primary'},{id:'native-review',title:'独立审查记录',role:'review',readOnly:true},{id:'native-legacy',title:'旧讨论记录保留',role:'history'}]:sessionId?[{id:sessionId,title:conversation.title,role:'primary'}]:[]
   return {status:'ok',conversation,sessionId,nativeBinding:{...conversation.nativeBinding,sessionId,canSend:!review,reason:review?'当前是独立审查记录，请切回主会话继续处理。':undefined,selectionOrigin:review?'explicit':'primary'},threads,messages:sessionId?[{role:'assistant',text:review?'这是真实审查记录的合成替身，不能从此处改写审查轮次。':'继续原会话，工作过程和上下文保持不变。',at}]:[],entity:development?{id:'synthetic',issue:{title:conversation.title,status:'需求评审完成'},status:'waiting_review'}:null,turns:[],events:[],runs:[],items:[],confirmations:[],busyReply:{config:{enabled:false}}}
  }
  WB.actions.assistantHub=async request=>{window.bindingCalls.push(request);if(request.action==='list')return {status:'ok',conversations:rows};if(request.action==='detail')return detail(request);if(request.action==='select'){window.bindingSelected[request.conversationId]=request.sessionId;return detail(request)};if(request.action==='delta')return {status:'ok',entries:[],nextSeq:0,turnActive:false,turnEnded:false};throw Error('布局检查不允许启动业务：'+request.action)}
  WB.assistant.openHub('development:synthetic')
 })
 const sidebar=page.getByRole('navigation',{name:'助手会话列表'})
 async function selectHistory(value){const more=page.getByLabel('更多助手操作',{exact:true});if(!await page.locator('.wb-hub-more').evaluate(el=>el.open))await more.click();await page.getByRole('combobox',{name:'事项历史会话'}).selectOption(value);await more.click()}
 await page.locator('.wb-hub-threads').waitFor({state:'attached'})
 if(await page.locator('.wb-hub-native-context').count()||await page.getByRole('button',{name:'在 Harness 中打开当前会话'}).count())throw Error('原生会话说明或跳转图标仍常驻显示')
 for(const [title,source] of [['US-SYNTHETIC · 已有工作区的研发事项','研发'],['合成待办','待办'],['合成待回复','待回复'],['已有普通聊天','普通对话']])await sidebar.getByRole('button',{name:'会话：'+title,exact:true}).getByText(source,{exact:true}).waitFor()
 for(const [width,height] of [[1280,800],[800,700],[360,700],[360,360]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  await page.evaluate(()=>window.WB.assistant.openHub('development:synthetic'))
  await page.locator('.wb-hub-threads').waitFor({state:'attached'})
  if(width<640){const collapse=page.getByRole('button',{name:'收起会话列表'});if(await collapse.count())await collapse.click()}
  async function capture(stage){
   await page.getByRole('textbox',{name:'助手消息'}).scrollIntoViewIfNeeded()
   const metrics=await page.evaluate(()=>{const root=document.querySelector('.wb-hub'),composer=document.querySelector('.wb-assistant-composer'),context=document.querySelector('.wb-hub-native-context'),r=composer.getBoundingClientRect(),title=document.querySelector('.wb-assistant-current strong').getBoundingClientRect(),titleBox=document.querySelector('.wb-assistant-current').getBoundingClientRect();return {overflow:root.scrollWidth-root.clientWidth,composerBottom:r.bottom,composerTop:r.top,contextHeight:context?.getBoundingClientRect().height||0,titleOutside:title.left<titleBox.left-2||title.right>titleBox.right+2,viewportHeight:innerHeight}})
   report.push({width,height,theme,stage,...metrics});await page.screenshot({path:resolve(output,`${width}-${height}-${theme}-${stage}.png`),animations:'disabled'});if(metrics.overflow>2||metrics.composerBottom>height+2||metrics.composerTop<0||metrics.titleOutside)throw Error(JSON.stringify(report.at(-1)))
  }
  await selectHistory('native-main')
  if(width>=640)await sidebar.getByLabel('工作区：合成研发工作区 · 长工程名称用于检查完整路径提示与标题截断',{exact:true}).first().waitFor()
  await capture('development-main')
  await selectHistory('native-review');await page.getByRole('button',{name:'切回主会话'}).waitFor()
  await page.getByRole('textbox',{name:'助手消息'}).fill('暂存问题，保留输入')
  if(await page.getByRole('button',{name:'发送',exact:true}).isEnabled())throw Error('审查记录仍允许普通发送')
  await capture('review-history')
  await page.getByRole('button',{name:'切回主会话'}).click();await page.getByRole('button',{name:'发送',exact:true}).waitFor()
  if(await page.getByRole('textbox',{name:'助手消息'}).inputValue()!=='暂存问题，保留输入')throw Error('历史切回主会话丢失输入')
  await page.getByRole('textbox',{name:'助手消息'}).fill('')
  const opened=await page.evaluate(()=>({count:window.bindingOpened.length,panels:window.bindingPanels}));if(opened.count||opened.panels)throw Error('查看聊天仍触发原生跳转')
  await page.evaluate(()=>window.WB.assistant.openHub('chat:native-chat'));await page.getByRole('textbox',{name:'助手消息'}).waitFor();if(await page.locator('.wb-hub-native-context').count())throw Error('普通聊天仍展示原生会话信息栏');await capture('unbound-chat')
 }
 const calls=await page.evaluate(()=>window.bindingCalls);if(calls.some(row=>['send','reset','operate'].includes(row.action)))throw Error('查看或切换会话意外执行或新建')
 writeFileSync(resolve(output,'report.json'),JSON.stringify({cases:report.length,report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output}));if(errors.length)process.exitCode=1
}catch(error){writeFileSync(resolve(output,'failure.json'),JSON.stringify({report,errors,error:String(error.stack||error)},null,2));throw error}finally{await browser.close()}
