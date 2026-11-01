/** Shipped-client layout with synthetic chat and knowledge data; never calls a model. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const out='/tmp/workbench-assistant-chat';mkdirSync(out,{recursive:true})
const built=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'}),browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const WB=window.WB,data=WB.store.get().data
  WB.actions.assistantSessions=async()=>({assistantSessionId:'layout-chat',sessions:[{id:'layout-chat',title:'一般业务规则如何处理',isAssistant:true}]})
  WB.actions.assistantTranscript=async()=>({sessionId:'layout-chat',messages:[{role:'user',text:'一般业务规则中的组织异常应该如何排查？'},{role:'assistant',text:'可以先核对当前组织、业务规则适用范围和生效条件。\n\n1. 确认当前组织与规则中配置的组织一致。\n2. 核对触发条件和执行时间。\n3. 根据原始报错逐项验证。'}]})
  WB.actions.knowledgeTraces=async()=>({items:[{id:'layout-empty',status:'empty',mode:'auto',hits:[],note:'当前范围没有匹配的已确认有效知识'}]})
  WB.actions.assistantSend=async()=>{throw Error('布局验收禁止调用模型')}
  WB.store.set({data:{...data,settings:{...data.settings,assistantWidth:600},tasks:[...data.tasks,{id:'context-extra',title:'界面验收上下文',status:'ready',tags:[]}],projects:[{id:'project-layout',name:'合成项目'}],sources:[{id:'source-layout',locator:{accountId:'layout:account'}}]},assistantOpen:true,assistantRefs:[{kind:'task',id:'task',title:'组织异常排查',body:'合成问题上下文'}]})
  WB.go('assistant')
 })
 await page.getByText('本轮未命中知识库资料',{exact:true}).waitFor()
 for(const [width,height] of [[1280,700],[800,700],[360,700],[360,320]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  if(!await page.locator('.wb-workarea').evaluate(el=>el.classList.contains('wb-assistant-page')&&getComputedStyle(el.querySelector('.wb-main')).display==='none'))throw Error('独立AI助手入口没有使用完整聊天页')
  if(await page.getByRole('combobox',{name:'切换原生会话'}).count())throw Error('长会话下拉未移除')
  if(width>=800){
   if(await page.getByRole('button',{name:'展开会话列表'}).count())await page.getByRole('button',{name:'展开会话列表'}).click()
   const boxes=await page.locator('.wb-assistant-chat-layout').evaluate(el=>{const nav=el.querySelector('.wb-assistant-sessions').getBoundingClientRect(),chat=el.querySelector('.wb-assistant-conversation').getBoundingClientRect();return {navRight:nav.right,chatLeft:chat.left,navWidth:nav.width}})
   if(boxes.navRight>boxes.chatLeft+2||boxes.navWidth<180)throw Error('会话列表未显示在对话左侧：'+JSON.stringify(boxes))
   await page.getByRole('button',{name:'收起会话列表'}).click();if(await page.getByRole('navigation',{name:'助手会话列表'}).count())throw Error('会话列表未折叠');await page.getByRole('button',{name:'展开会话列表'}).click()
  }else await page.getByRole('navigation',{name:'助手会话列表'}).waitFor({state:'hidden'})
  async function measure(stage){
   await page.screenshot({path:resolve(out,`${width}-${height}-${theme}-${stage}.png`),animations:'disabled'})
   const metrics=await page.locator('.wb-assistant').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,composerHeight:el.querySelector('.wb-assistant-composer').getBoundingClientRect().height,modalOverflow:[...document.querySelectorAll('.wb-modal')].reduce((max,node)=>Math.max(max,node.scrollWidth-node.clientWidth,node.getBoundingClientRect().right-innerWidth,-node.getBoundingClientRect().left),0)}))
   report.push({width,height,theme,stage,...metrics});if(metrics.overflow>2||metrics.modalOverflow>2)throw Error(JSON.stringify(report.at(-1)))
  }
  if(await page.locator('.wb-assistant-composer select').count())throw Error('知识设置仍占用输入区')
  await measure('chat')
  await page.getByRole('button',{name:'知识设置',exact:true}).click();await page.getByRole('combobox',{name:'知识模式'}).selectOption('only');await page.getByRole('combobox',{name:'聊天知识项目'}).selectOption('project-layout');await measure('settings');await page.keyboard.press('Escape')
  if(!await page.getByRole('button',{name:'知识设置',exact:true}).evaluate(el=>document.activeElement===el))throw Error('关闭设置后焦点丢失')
  await page.getByRole('button',{name:'添加上下文',exact:true}).click();await page.getByRole('textbox',{name:'搜索上下文'}).fill('界面验收');const option=page.getByRole('checkbox',{name:'引用待办：界面验收上下文',exact:true});await option.check();await measure('context');await page.getByRole('dialog').getByRole('button',{name:/^添加 \d+ 项$/}).click()
  const editor=page.getByRole('textbox',{name:'助手消息'});await editor.fill('下一步应该如何验证？');await editor.scrollIntoViewIfNeeded();if(await editor.evaluate(el=>el.getBoundingClientRect().bottom>innerHeight+2))throw Error('输入框不可达');await page.getByRole('button',{name:'发送',exact:true}).scrollIntoViewIfNeeded();if(await page.getByRole('button',{name:'发送',exact:true}).evaluate(el=>el.getBoundingClientRect().bottom>innerHeight+2))throw Error('发送按钮不可达');await editor.fill('')
 }
 writeFileSync(resolve(out,'report.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out}));if(errors.length)process.exitCode=1
}finally{await browser.close()}
