/** Synthetic fixture only; never attaches to user chats or executes tools. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output='/tmp/workbench-assistant-admission';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#4d8af0}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const owned={id:'chat:owned',kind:'chat',title:'助手内已有会话'}
  window.adoptionCalls=[];window.WB.actions.assistantHub=async request=>{
   window.adoptionCalls.push(request)
   if(request.action==='list')return {status:'ok',conversations:[owned]}
   if(request.action==='detail')return {status:'ok',conversation:owned,sessionId:'owned',messages:[],turns:[],events:[],runs:[],items:[],threads:[],confirmations:[]}
   if(request.action==='availableSessions')return {status:'ok',sessions:Array.from({length:18},(_,i)=>({sessionId:'outside-'+i,title:'外部工程会话 '+i+' '+('长会话标题'.repeat(20)),workspaceTitle:'工程 '+i,cwd:'/Users/synthetic/'+('LongDirectoryName/'.repeat(20))}))}
   throw Error('布局测试禁止写入：'+request.action)
  };window.WB.assistant.openHub(owned.id)
 })
 for(const [width,height] of [[1280,800],[800,700],[360,700],[360,360]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  const input=page.getByRole('textbox',{name:'助手消息'});await input.waitFor();await input.fill('保留的原会话草稿')
  const menu=page.getByLabel('更多助手操作');if(!await menu.evaluate(el=>el.closest('details').open))await menu.click()
  await page.getByRole('button',{name:'接入已有会话',exact:true}).click();const dialog=page.getByRole('dialog',{name:'接入已有会话'});await dialog.getByRole('button',{name:/外部工程会话 0 /}).waitFor()
  const button=dialog.getByRole('button',{name:'接入并打开'});if(!await button.isDisabled())throw Error('未选择却允许接入')
  await dialog.getByRole('button',{name:/外部工程会话 0 /}).click();if(await button.isDisabled())throw Error('选择后仍不可接入')
  const actionBounds=await button.evaluate(el=>{const r=el.getBoundingClientRect(),foot=el.closest('.wb-modal-foot').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,footerTop:foot.top,footerBottom:foot.bottom,background:getComputedStyle(el).backgroundColor}});if(actionBounds.left<0||actionBounds.right>width||actionBounds.top<actionBounds.footerTop||actionBounds.bottom>actionBounds.footerBottom||actionBounds.background==='rgba(0, 0, 0, 0)')throw Error('接入按钮不可见或溢出 '+JSON.stringify(actionBounds))
  const metrics=await dialog.evaluate(el=>{const r=el.getBoundingClientRect(),body=el.querySelector('.wb-modal-body'),foot=el.querySelector('.wb-modal-foot').getBoundingClientRect(),list=el.querySelector('.wb-hub-connect-list');return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:el.scrollWidth-el.clientWidth,bodyOverflow:body.scrollWidth-body.clientWidth,listHeight:list.clientHeight,listScrollable:list.scrollHeight>list.clientHeight,footerBottom:foot.bottom}})
  if(metrics.left< -2||metrics.right>width+2||metrics.top< -2||metrics.bottom>height+2||metrics.overflow>2||metrics.bodyOverflow>2||metrics.footerBottom>height+2)throw Error('接入界面溢出 '+JSON.stringify({width,height,theme,metrics}))
  report.push({width,height,theme,...metrics});await page.screenshot({path:resolve(output,`connect-${width}-${height}-${theme}.png`)})
  await dialog.getByRole('button',{name:'取消',exact:true}).click();if(await input.inputValue()!=='保留的原会话草稿')throw Error('取消丢失草稿')
 }
 const writes=await page.evaluate(()=>window.adoptionCalls.filter(row=>['adopt','send','reset'].includes(row.action)));if(writes.length)throw Error('布局测试意外执行操作')
 if(errors.length)throw Error(errors.join(' | '));writeFileSync(resolve(output,'report.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output}))
}finally{await browser.close()}
