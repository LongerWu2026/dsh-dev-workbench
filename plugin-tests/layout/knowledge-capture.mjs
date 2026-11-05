/** Isolated layout proof using the production client and action stubs; no live RPC or IM writes. */
import {chromium,expect} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output='/tmp/workbench-knowledge-capture-layout';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const WB=window.WB,at=new Date().toISOString(),conversation={id:'chat:capture-layout',kind:'chat',title:'AI 回复保存验收'}
  window.captureCalls=[]
  WB.actions.knowledgeCapture=async request=>{window.captureCalls.push(request);return request.action==='prepare'?{draftId:'layout-draft',title:'完整原文保存与隔离范围的合成验收笔记',body:'# 完整正文\n\n'+('长消息、表格和代码在保存时保留。\n'.repeat(80)),source:{label:'合成来源',question:'如何整理并保存知识？'},scope:{spaceId:'personal',projectId:null}}:{status:'ok',itemId:'saved',snapshot:WB.store.get().data}}
  WB.actions.radarArticle=async()=>({body:'# 资讯原文标题\n\n| 超长列名称 | 内容 |\n| --- | --- |\n| 字段 | '+('very-long-word'.repeat(50))+' |\n\n```ts\n'+('const content = 1234567890;'.repeat(80))+'\n```\n\n'+('完整正文段落。\n'.repeat(80)),cached:true,fetchedAt:at})
  WB.actions.conversationRead=async()=>({status:'ok'})
  WB.actions.conversationMessages=async()=>({status:'ok',viewId:'layout-view',unreadComplete:true,unreadLoaded:2,unreadTotal:2,contextLoaded:0,hasMoreHistory:false,batchComplete:true,nextCursor:1,messages:[{id:'m1',text:'第一条需要保存的消息。'.repeat(20),sender:'合成同事',at,unread:true},{id:'m2',text:'第二条需要保存的消息。',sender:'本人',own:true,at,unread:true}]})
  WB.actions.assistantHub=async request=>request.action==='list'?{status:'ok',conversations:[conversation]}:{status:'ok',conversation,sessionId:'layout-session',nativeBinding:{canSend:true},messages:[],turns:[{id:'capture-turn',conversationId:conversation.id,sessionId:'layout-session',source:'ai',status:'completed',text:'如何保存完整笔记？',reply:'这是定稿的最终回答。',replySource:'assistant',commands:[],knowledgeScope:{spaceId:'personal',projectId:null}}],events:[],runs:[],threads:[],confirmations:[]}
  const data=WB.store.get().data;WB.store.set({data:{...data,knowledge:[],radar:[{id:'news',title:'AI 完整资讯原文验收',url:'https://example.invalid/news',topics:['AI'],summary:{change:'合成摘要'}}],radarBrief:null,messageInbox:{accountId:'layout-me',at,unreadTotal:2,conversations:[{groupId:'layout-group',name:'消息保存验收',latestMsgId:'m2',unreadCount:2}]}}})
 })
 async function check(dialog,meta){
  await dialog.waitFor();const metrics=await dialog.evaluate(el=>{const r=el.getBoundingClientRect(),body=el.querySelector('.wb-modal-body');return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:el.scrollWidth-el.clientWidth,bodyOverflow:body.scrollWidth-body.clientWidth}})
  const {width,height}=page.viewportSize();if(metrics.left< -1||metrics.right>width+1||metrics.top< -1||metrics.bottom>height+1||metrics.overflow>2||metrics.bodyOverflow>2)throw Error('弹窗溢出 '+JSON.stringify({meta,metrics}))
  report.push({...meta,...metrics});await dialog.screenshot({path:resolve(output,`${meta.mode}-${width}-${height}-${meta.theme}.png`)})
 }
 for(const [width,height] of [[1280,800],[640,700],[360,700],[360,360]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  await page.evaluate(()=>{window.WB.store.set({assistantOpen:false});window.WB.go('dashboard')});await page.getByRole('button',{name:'查看会话：消息保存验收'}).click()
  const reader=page.getByRole('dialog',{name:'消息保存验收',exact:true});await reader.getByText('第二条需要保存的消息。',{exact:true}).waitFor();await reader.getByRole('button',{name:'选择消息',exact:true}).click();await reader.getByRole('checkbox',{name:'选择消息：m2',exact:true}).check();await check(reader,{mode:'message-selection',theme})
  await reader.getByRole('button',{name:'保存笔记',exact:true}).click();const save=page.getByRole('dialog',{name:'保存笔记',exact:true});await save.getByRole('textbox',{name:'笔记内容'}).waitFor();await check(save,{mode:'message-save',theme});await save.getByRole('button',{name:'取消',exact:true}).click();await reader.getByRole('button',{name:'关闭',exact:true}).click()
  await page.evaluate(()=>{window.WB.store.set({assistantOpen:false});window.WB.go('radar')});await page.getByRole('link',{name:/AI 完整资讯原文验收/}).click();const article=page.getByRole('dialog',{name:'AI 完整资讯原文验收',exact:true});await article.locator('table').waitFor();await check(article,{mode:'article-reader',theme});await article.getByRole('button',{name:'收藏原文',exact:true}).click();await save.getByRole('textbox',{name:'笔记标题'}).waitFor();await check(save,{mode:'article-save',theme});await save.getByRole('button',{name:'取消',exact:true}).click();await article.getByRole('button',{name:'关闭',exact:true}).first().click()
  await page.evaluate(()=>window.WB.assistant.openHub('chat:capture-layout'));const actions=page.getByRole('group',{name:'AI 回复操作',exact:true});await actions.getByRole('button',{name:'保存笔记',exact:true}).click();await save.getByRole('textbox',{name:'笔记标题'}).waitFor();await check(save,{mode:'ai-save',theme});await save.getByRole('button',{name:'取消',exact:true}).click()
  await page.evaluate(()=>window.WB.store.set({assistantOpen:false,page:'knowledge',knowledgeCaptureRequest:{kind:'native',sessionId:'layout-native',messageId:'final'}}));await save.getByRole('textbox',{name:'笔记标题'}).waitFor();await check(save,{mode:'native-save',theme});await save.getByRole('button',{name:'取消',exact:true}).click()
 }
 if(errors.length)throw Error(errors.join('; '));const calls=await page.evaluate(()=>window.captureCalls);if(calls.some(request=>request.action==='save'))throw Error('布局检查意外保存数据')
 writeFileSync(resolve(output,'report.json'),JSON.stringify({cases:report.length,errors,report},null,2));console.log(JSON.stringify({cases:report.length,errors,output}))
}catch(error){await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});throw error}finally{await browser.close()}
