/** Synthetic fixture only; never attaches to user chats or executes tools. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output='/tmp/workbench-assistant-stream';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const row={id:'task:stream-layout',kind:'task',title:'流式回复验证'}
  window.streamText='开头已生成\n\n'+Array.from({length:35},(_,i)=>'这是生成中的正文 '+i+'，用来验证滚动位置和段落排版。').join('\n\n')
  window.streamDone=false;window.streamCalls=[]
  window.WB.actions.assistantHub=async request=>{
   window.streamCalls.push(request)
   if(request.action==='list')return {status:'ok',conversations:[row]}
   if(request.action!=='detail')throw Error('只读布局验证禁止执行 '+request.action)
   return {status:'ok',conversation:row,sessionId:'stream-native',turnActive:!window.streamDone,nativeBinding:{workspaceState:'unbound',canSend:true},messages:[],events:[],runs:[],items:[],threads:[],confirmations:[],turns:[{id:'stream-turn',text:'请继续说明',at:1000,source:'ai',status:window.streamDone?'completed':'recognizing',reply:window.streamDone?window.streamText:'正在回复',...(window.streamDone?{replySource:'assistant'}:{streamingText:window.streamText,replyStreaming:true}),commands:[]}]}
  }
  window.WB.assistant.openHub(row.id)
 })
 for(const [width,height] of [[1280,800],[800,700],[360,700],[360,480]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>{document.documentElement.className=theme;window.streamDone=false;window.WB.store.set(state=>({assistantOpenSeq:(state.assistantOpenSeq||0)+1}))},theme)
  const card=page.getByLabel('处理回复'),body=page.locator('.wb-hub-body');await card.waitFor()
  await page.waitForFunction(()=>document.querySelector('[aria-label="处理回复"]')?.getAttribute('aria-busy')==='true')
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const initial=await body.evaluate(el=>({gap:el.scrollHeight-el.clientHeight-el.scrollTop}));if(initial.gap>2)throw Error('生成中未跟随末尾 '+JSON.stringify({width,height,theme,initial}))
  await page.evaluate(()=>{window.streamCard=document.querySelector('[aria-label="处理回复"]');const body=document.querySelector('.wb-hub-body');body.scrollTop=80;body.dispatchEvent(new Event('scroll'));window.beforeStreamTop=body.scrollTop;window.streamText+='\n\n继续输出的新增段落 STREAM_GROWTH'})
  await page.getByText('继续输出的新增段落 STREAM_GROWTH',{exact:true}).waitFor()
  const position=await body.evaluate(el=>({before:window.beforeStreamTop,after:el.scrollTop,sameCard:window.streamCard===document.querySelector('[aria-label="处理回复"]')}))
  if(Math.abs(position.before-position.after)>2||!position.sameCard)throw Error('流式更新跳动或重建回复 '+JSON.stringify({width,height,theme,position}))
  await page.getByRole('textbox',{name:'助手消息'}).fill('未发送草稿')
  await page.evaluate(()=>{window.streamDone=true;window.streamText='最终答复\n\n```text\nworkspace/\n├── modules/\n│   └── assistant/\n└── tests/\n```\n\nSTREAM_FINISHED'})
  await page.getByText('STREAM_FINISHED',{exact:true}).waitFor()
  const metrics=await page.locator('.wb-hub').evaluate(el=>{const body=el.querySelector('.wb-hub-body'),composer=el.querySelector('.wb-assistant-composer'),r=el.getBoundingClientRect(),c=composer.getBoundingClientRect();return {overflow:el.scrollWidth-el.clientWidth,bodyOverflow:body.scrollWidth-body.clientWidth,cards:el.querySelectorAll('[aria-label="处理回复"]').length,busy:el.querySelector('[aria-label="处理回复"]').getAttribute('aria-busy'),composerBottom:c.bottom,bottom:r.bottom,draft:el.querySelector('[aria-label="助手消息"]').value}})
  if(metrics.overflow>2||metrics.bodyOverflow>2||metrics.cards!==1||metrics.busy||metrics.composerBottom>metrics.bottom+2||metrics.draft!=='未发送草稿')throw Error('流式布局回归 '+JSON.stringify({width,height,theme,metrics}))
  report.push({width,height,theme,initial,position,metrics});await page.screenshot({path:resolve(output,`stream-${width}-${height}-${theme}.png`)})
  await page.evaluate(()=>{window.streamText='开头已生成\n\n'+Array.from({length:35},(_,i)=>'这是生成中的正文 '+i+'，用来验证滚动位置和段落排版。').join('\n\n')})
 }
 if(errors.length)throw Error(errors.join('\n'));writeFileSync(resolve(output,'report.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output}))
}finally{await browser.close()}
