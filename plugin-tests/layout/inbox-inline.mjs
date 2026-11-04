/** Synthetic dashboard only; no Yunzhijia calls or changes to unread state. */
import {chromium,expect} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output='/tmp/workbench-inbox-inline';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 const sizes=[[1280,1280],[900,900],[640,640],[360,360],[1280,640]]
 for(const [width,rootWidth] of sizes)for(const theme of ['light','dark'])for(const long of [false,true])for(const total of [7,30]){
  await page.setViewportSize({width,height:800});await page.evaluate(({rootWidth,theme,long,total})=>{
   document.documentElement.className=theme;document.querySelector('.wb-root').style.width=rootWidth+'px'
   const data=window.WB.store.get().data,names=['快客6.0升级沟通内部群','重庆医药合并报表项目','投控&能源&盛屯合并研发支持群'];window.WB.store.set({data:{...data,revision:data.revision+1,messageInbox:{accountId:'layout-'+rootWidth+'-'+theme+'-'+long+'-'+total,at:new Date().toISOString(),unreadTotal:17,calendar:{status:'ok',found:0},conversations:Array.from({length:total},(_,i)=>({groupId:'inline-'+i,name:long&&i===0?'超长群聊名称含无空格单词'.repeat(40):names[i]||'合成项目会话 '+i,unreadCount:i+1,latestMsgId:'head-'+i}))}}});window.WB.go('dashboard')
  },{rootWidth,theme,long,total})
  const panel=page.getByLabel('云之家重点收件箱'),rows=panel.getByRole('listitem');await panel.waitFor();if(await panel.getByRole('heading',{name:/未读会话/}).count())throw Error('未读会话重复标题仍存在');await panel.scrollIntoViewIfNeeded();await expect(rows.first()).toBeVisible()
  const metrics=await panel.evaluate(el=>{const list=el.querySelector('[role="list"]'),box=list.getBoundingClientRect(),items=[...list.children].map(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,width:r.width,hidden:node.getAttribute('aria-hidden')==='true',tabIndex:node.querySelector('button').tabIndex,overflow:node.scrollWidth-node.clientWidth}}),tokens=[...el.querySelector('.wb-inbox-metrics').children].map(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,mid:(r.top+r.bottom)/2}});return {listWidth:box.width,listLeft:box.left,listRight:box.right,listBottom:box.bottom,listHeight:box.height,items,tokens,overflow:el.scrollWidth-el.clientWidth}})
  if(metrics.overflow>2||metrics.items.some(item=>item.left<metrics.listLeft-1||item.right>metrics.listRight+1||item.overflow>2||item.height>65))throw Error('会话预览溢出或长名称未限制 '+JSON.stringify({width,rootWidth,long,metrics}))
  const tops=[...new Set(metrics.items.map(item=>Math.round(item.top)))],initial=metrics.items.filter(item=>!item.hidden).length,expected=metrics.items.filter(item=>item.top<=(tops[2]??Infinity)+1).length
  if(initial!==expected||initial===0)throw Error('没有按实际三行显示 '+JSON.stringify({width,rootWidth,total,initial,expected}))
  if(metrics.items.filter(item=>!item.hidden).some(item=>item.bottom>metrics.listBottom+1)||metrics.items.filter(item=>item.hidden).some(item=>item.tabIndex!==-1))throw Error('会话被截断或隐藏会话仍可键盘聚焦')
  if((await panel.getByRole('button',{name:'展开更多',exact:true}).count()>0)!==(tops.length>3))throw Error('未超过三行却显示展开更多')
  if(!long&&total===7&&metrics.listWidth>900&&metrics.items.some(item=>Math.abs(item.top-metrics.items[0].top)>1))throw Error('宽屏会话仍逐条独占一行')
  if(metrics.listWidth>1000&&metrics.tokens.some(token=>Math.abs(token.mid-metrics.tokens[0].mid)>2))throw Error('宽屏消息快照没有与统计同行 '+JSON.stringify(metrics.tokens))
  if(rootWidth===360&&Math.max(...metrics.tokens.map(token=>token.mid))-Math.min(...metrics.tokens.map(token=>token.mid))<20)throw Error('窄屏统计没有自动换行')
  let clicks=0
  while(await panel.getByRole('button',{name:'展开更多',exact:true}).count()){
   await panel.getByRole('button',{name:'展开更多',exact:true}).click();clicks++
   const expectedCount=metrics.items.filter(item=>item.top<=(tops[Math.min(tops.length-1,3*(clicks+1)-1)]??Infinity)+1).length
   await expect(rows).toHaveCount(expectedCount);if(clicks>total)throw Error('展开没有终点')
  }
  await expect(rows).toHaveCount(total)
  if(tops.length>3){await panel.getByRole('button',{name:'收起列表',exact:true}).click();await expect(rows).toHaveCount(initial)}
  const state=await page.evaluate(()=>window.WB.store.get().data.messageInbox);if(state.unreadTotal!==17||state.conversations.length!==total)throw Error('布局操作改变真实未读快照')
  report.push({width,rootWidth,theme,long,total,initial,rows:tops.length,...metrics});await page.locator('.wb-inbox-summary').screenshot({path:resolve(output,`${width}-${rootWidth}-${theme}-${long?'long':'normal'}-${total}.png`),animations:'disabled'})
 }
 await page.setViewportSize({width:1280,height:800});await page.evaluate(()=>{document.querySelector('.wb-root').style.width='1280px';const data=window.WB.store.get().data;window.WB.store.set({data:{...data,messageInbox:{...data.messageInbox,accountId:'resize',conversations:Array.from({length:30},(_,i)=>({groupId:'resize-'+i,name:'项目会话 '+i,unreadCount:1}))}}})})
 const panel=page.getByLabel('云之家重点收件箱'),visibleRows=panel.getByRole('listitem')
 await panel.scrollIntoViewIfNeeded();const wide=await visibleRows.count()
 await page.setViewportSize({width:360,height:800});await page.evaluate(()=>document.querySelector('.wb-root').style.width='360px')
 await expect.poll(()=>visibleRows.count()).toBeLessThan(wide)
 const narrow=await visibleRows.count();await panel.getByRole('button',{name:'展开更多',exact:true}).click();await expect.poll(()=>visibleRows.count()).toBeGreaterThan(narrow)
 await page.getByRole('heading',{name:'云之家消息',exact:true}).click();await page.setViewportSize({width:900,height:800});await page.evaluate(()=>document.querySelector('.wb-root').style.width='900px');await page.getByRole('heading',{name:'云之家消息',exact:true}).click();await panel.waitFor()
 await panel.getByRole('button',{name:'收起列表',exact:true}).click()
 await expect.poll(()=>visibleRows.count()).toBeGreaterThan(narrow)
 const reopened=await panel.getByRole('list').evaluate(el=>{const top=el.getBoundingClientRect().top,bottom=el.getBoundingClientRect().bottom,shown=[...el.children].filter(n=>n.getAttribute('aria-hidden')!=='true');return {rows:new Set(shown.map(n=>Math.round(n.getBoundingClientRect().top-top))).size,clipped:shown.some(n=>n.getBoundingClientRect().bottom>bottom+1)}})
 if(reopened.rows>3||reopened.clipped)throw Error('收起卡片后调整宽度未重新计算行数')
 report.push({section:'same-account-resize-and-reopen',wide,narrow,reopened})
 if(errors.length)throw Error(errors.join('; '));writeFileSync(resolve(output,'report.json'),JSON.stringify({cases:report.length,errors,report},null,2));console.log(JSON.stringify({cases:report.length,errors,output}))
}catch(error){await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});throw error}finally{await browser.close()}
