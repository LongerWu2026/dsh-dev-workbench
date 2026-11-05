/** Production bundle, offline SVG decoding, shared chat/settings avatar and narrow themes. */
import {chromium,expect} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output='/tmp/workbench-lulu-avatar';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const WB=window.WB,conversation={id:'chat:lulu-preview',kind:'chat',title:'lulu 头像验收'}
  WB.actions.assistantHub=async request=>request.action==='list'?{status:'ok',conversations:[conversation]}:{status:'ok',conversation,sessionId:'synthetic-lulu',nativeBinding:{canSend:true},messages:[{id:'u',role:'user',text:'你好，lulu。'},{id:'a',role:'assistant',text:'我会帮你整理消息、待办和知识。'}],turns:[],events:[],runs:[],threads:[],confirmations:[]}
  window.luluWebAI={chatgptEnabled:false,topics:[{id:'web-topic',title:'多 AI 头像验收',createdAt:new Date().toISOString(),conversations:{}}],rounds:[{id:'lulu-round',topicId:'web-topic',requestId:'lulu-round',question:'多模型回答也使用统一头像',createdAt:new Date().toISOString(),answers:[{providerId:'kimi',status:'completed',text:'Kimi 回答',updatedAt:new Date().toISOString()},{providerId:'glm',status:'completed',text:'智谱回答',updatedAt:new Date().toISOString()}]}]}
  WB.assistant.openHub(conversation.id)
 })
 let svgSource=''
 async function checkAvatar(locator,meta){
  await expect(locator).toHaveCount(1);await locator.evaluate(async image=>{await image.decode()})
  const actual=await locator.evaluate(image=>{const box=image.getBoundingClientRect(),frame=image.parentElement.getBoundingClientRect();return {src:image.src,complete:image.complete,naturalWidth:image.naturalWidth,width:box.width,height:box.height,frameWidth:frame.width,frameHeight:frame.height,overflow:image.scrollWidth-image.clientWidth}})
  if(!actual.src.startsWith('data:image/svg+xml')||!actual.complete||actual.naturalWidth!==1024||actual.width>actual.frameWidth||actual.height>actual.frameHeight||actual.overflow>1)throw Error('SVG 头像加载或尺寸异常 '+JSON.stringify({meta,actual}))
  if(svgSource&&svgSource!==actual.src)throw Error('头像入口没有复用同一资源');svgSource=actual.src
  report.push({...meta,...actual,src:actual.src.slice(0,28)});await locator.locator('..').screenshot({path:resolve(output,`${meta.surface}-${meta.width}-${meta.theme}.png`)})
 }
 for(const width of [1280,640,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:760});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  await checkAvatar(page.locator('[data-chat-author="assistant"] img[data-avatar="lulu"]'),{surface:'assistant',width,theme})
  if(await page.locator('[data-chat-author="user"] img[data-avatar="lulu"]').count())throw Error('本人头像被替换')
  const more=page.getByLabel('更多助手操作');if(!await more.evaluate(el=>el.closest('details').open))await more.click();await page.getByRole('button',{name:'助手设置',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'助手设置',exact:true});await checkAvatar(dialog.locator('img[data-avatar="lulu"]'),{surface:'settings',width,theme});await dialog.getByRole('button',{name:'取消',exact:true}).click()
 }
 await page.evaluate(()=>{const data=window.WB.store.get().data;window.WB.store.set({assistantOpen:false,data:{...data,revision:data.revision+1,webAI:window.luluWebAI}});window.WB.go('web-ai')})
 for(const width of [1280,640,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:760});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  await checkAvatar(page.locator('.wb-chat-assistant img[data-avatar="lulu"]'),{surface:'multi-ai',width,theme})
  await page.getByRole('tab',{name:'智谱清言',exact:true}).click();await checkAvatar(page.locator('.wb-chat-assistant img[data-avatar="lulu"]'),{surface:'glm',width,theme});await page.getByRole('tab',{name:'Kimi',exact:true}).click()
 }
 if(errors.length)throw Error(errors.join('; '));writeFileSync(resolve(output,'report.json'),JSON.stringify({cases:report.length,errors,report},null,2));console.log(JSON.stringify({cases:report.length,errors,output}))
}catch(error){await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});throw error}finally{await browser.close()}
