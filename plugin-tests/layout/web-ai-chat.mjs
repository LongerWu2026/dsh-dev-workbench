/** Production chat UI with synthetic history and incremental answers; no website or account is used. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const base=dirname(fileURLToPath(import.meta.url)),out='/tmp/workbench-web-ai-chat';mkdirSync(out,{recursive:true})
const built=await build({entryPoints:[resolve(base,'fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%}body{font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#f7f8fa;--dsw-alias-bg-layer-2:#edf0f5;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#78808d;--dsw-alias-border-l1:#e7e9ee;--dsw-alias-border-l2:#d4d8e1;--dsw-alias-brand-primary:#356fee;--dsw-alias-state-error-primary:#c33}html.dark{--dsw-alias-bg-base:#181b20;--dsw-alias-bg-layer-1:#20242b;--dsw-alias-bg-layer-2:#2b3039;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#a0a8b5;--dsw-alias-border-l1:#303640;--dsw-alias-border-l2:#444d5b}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync(resolve(base,'../../client.js'),'utf8')});await page.evaluate(()=>{window.mountWorkbench();window.WB.go('web-ai')})
 await page.getByRole('heading',{name:'网页对比合成主题',level:2}).waitFor()
 await page.evaluate(()=>{
  const now='2026-10-30T08:00:00Z',answer=(providerId,text,status='completed')=>({providerId,text,status,note:status==='generating'?'正在采集官网本轮回答':'已采集官网完整回答',url:null,updatedAt:now})
  window.chatFixture={topics:[{id:'web-topic',title:'接口性能方案讨论',createdAt:now,conversations:{}},{id:'release',title:'发布排期',createdAt:'2026-10-29T08:00:00Z',conversations:{}},...Array.from({length:6},(_,i)=>({id:'history-'+i,title:['用户反馈整理','产品需求评审','多模型回答对比','周报内容汇总','技术方案评估','会议纪要'][i],createdAt:'2026-10-28T08:00:00Z',conversations:{}}))],rounds:[{id:'r1',topicId:'web-topic',requestId:'fixture-1',question:'我们准备把接口平均响应时间降到 200ms 以内，请给出优化方向。',createdAt:now,answers:[answer('kimi','## 先建立性能基线\n\n建议优先检查这三个环节：\n\n- **数据库查询**：定位慢 SQL，核对执行计划。\n- **缓存策略**：给高频、低变更数据设置合理有效期。\n- **链路耗时**：拆分排队、连接和服务端处理时间。\n\n用 P95 和错误率一起衡量收益，避免只看平均值。'),answer('glm','## 采用分阶段优化\n\n第一阶段记录基线，第二阶段优化主要瓶颈，第三阶段用灰度流量验证。\n\n```text\n监测 → 定位 → 优化 → 压测 → 灰度\n```')]},{id:'r2',topicId:'web-topic',requestId:'fixture-2',question:'请给出一个可执行的三天落地计划。',createdAt:now,answers:[answer('kimi','**第 1 天：采集与定位**\n\n完成关键接口采样，列出耗时最高的三个环节。','generating'),answer('glm','**第 1 天**：采集指标和慢查询。\n\n**第 2 天**：实施缓存和查询优化，补充对照压测。','generating')]},{id:'r3',topicId:'release',requestId:'fixture-3',question:'本周发布有哪些注意事项？',createdAt:now,answers:[answer('kimi','发布前完成灰度验证，并准备回滚方案。')]}],chatgptEnabled:false}
  const oldRpc=window.WB.rpc;window.chatRpcCalls=[];window.WB.rpc=(method,...args)=>{window.chatRpcCalls.push(method);return oldRpc(method,...args)}
  window.WB.store.set({data:{...window.WB.store.get().data,revision:50,webAI:window.chatFixture}})
 })
 await page.getByRole('heading',{name:'接口性能方案讨论',level:2}).waitFor()
 for(const width of [1440,900,560,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.className=theme,theme);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const metrics=await page.evaluate(()=>{
   const layout=document.querySelector('.wb-chat-layout'),main=document.querySelector('.wb-chat-main'),sidebar=document.querySelector('.wb-chat-sidebar'),composer=document.querySelector('.wb-chat-composer'),thread=document.querySelector('.wb-chat-thread'),r=main.getBoundingClientRect(),c=composer.getBoundingClientRect()
   return {roots:document.querySelectorAll('.wb-root').length,heads:document.querySelectorAll('.wb-head').length,outerOverflow:document.querySelector('.wb-scroll').scrollHeight-document.querySelector('.wb-scroll').clientHeight,viewportBottom:c.bottom<=innerHeight,overflow:layout.scrollWidth-layout.clientWidth,composerInsideMain:c.left>=r.left-1&&c.right<=r.right+1&&c.bottom<=r.bottom+1,threadHeight:thread.clientHeight,sidebarLeft:sidebar.getBoundingClientRect().right<=r.left+1}
  })
  assert.equal(metrics.roots,1);assert.equal(metrics.heads,1);assert.ok(metrics.outerOverflow<=2&&metrics.viewportBottom&&metrics.overflow<=2&&metrics.composerInsideMain&&metrics.threadHeight>70,JSON.stringify({width,theme,...metrics}));if(width>=900)assert.ok(metrics.sidebarLeft)
  report.push({width,theme,...metrics});await page.screenshot({path:resolve(out,`chat-${width}-${theme}.png`)})
 }
 for(const width of [1280,560,360]){
  await page.setViewportSize({width,height:600});await page.evaluate(()=>{document.documentElement.style.setProperty('--dsh-frame-top-clearance','48px');window.chatFixture.topics[0].title='包含附件校验与多个厂商回答的长会话标题'.repeat(12);window.WB.store.set({data:{...window.WB.store.get().data,revision:52,webAI:structuredClone(window.chatFixture)}})})
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const metrics=await page.evaluate(()=>{const scroll=document.querySelector('.wb-scroll'),composer=document.querySelector('.wb-chat-composer'),thread=document.querySelector('.wb-chat-thread'),heading=document.querySelector('.wb-chat-head h2');return {boxes:['.wb-root','.wb-workarea','.wb-scroll','.wb-chat-page','.wb-web-ai','.wb-chat-layout','.wb-chat-main'].map(s=>{const n=document.querySelector(s),r=n.getBoundingClientRect();return {s,top:r.top,height:r.height,scroll:n.scrollHeight,padding:getComputedStyle(n).padding}}),outerOverflow:scroll.scrollHeight-scroll.clientHeight,composerBottom:composer.getBoundingClientRect().bottom,threadHeight:thread.clientHeight,titleTruncated:heading.scrollWidth>heading.clientWidth}})
  assert.ok(metrics.outerOverflow<=2&&metrics.composerBottom<=600&&metrics.threadHeight>70&&metrics.titleTruncated,JSON.stringify({width,...metrics}));report.push({width,height:600,nativeClearance:48,...metrics})
 }
 await page.evaluate(()=>{document.documentElement.style.removeProperty('--dsh-frame-top-clearance');window.chatFixture.topics[0].title='接口性能方案讨论';window.WB.store.set({data:{...window.WB.store.get().data,revision:53,webAI:structuredClone(window.chatFixture)}})})
 await page.setViewportSize({width:1440,height:900})
 const firstRound=page.locator('.wb-chat-round').first()
 await firstRound.getByRole('tab',{name:/智谱清言/}).click()
 assert.equal(await page.getByRole('tabpanel',{name:'智谱清言'}).count(),1)
 assert.equal(await page.locator('.wb-chat-round').nth(1).getByRole('tab',{name:/Kimi/}).getAttribute('aria-selected'),'true')
 await firstRound.getByRole('tab',{name:/Kimi/}).click()
 await page.setViewportSize({width:1440,height:600})
 await page.locator('.wb-chat-thread').evaluate(node=>{node.scrollTop=0;node.dispatchEvent(new Event('scroll'))})
 const before=await page.locator('.wb-chat-thread').evaluate(node=>node.scrollTop)
 await page.evaluate(()=>{window.chatFixture.rounds[1].answers[0].text+='\n\n**第 2 天：优化与验证**\n\n'+('追加采集内容，用来验证持续输出。\n'.repeat(20));window.WB.store.set({data:{...window.WB.store.get().data,revision:54,webAI:structuredClone(window.chatFixture)}})})
 await page.getByText('第 2 天：优化与验证',{exact:true}).waitFor()
 assert.ok(Math.abs(await page.locator('.wb-chat-thread').evaluate(node=>node.scrollTop)-before)<3,'streaming changed the reader position')
 await page.getByRole('textbox',{name:'多 AI 对话问题'}).fill('会话 A 的未发送草稿')
 await page.getByRole('button',{name:'选择会话 发布排期',exact:true}).click()
 await page.getByRole('heading',{name:'发布排期',level:2}).waitFor();assert.equal(await page.getByRole('textbox',{name:'多 AI 对话问题'}).inputValue(),'')
 await page.getByRole('button',{name:'选择会话 接口性能方案讨论',exact:true}).click()
 assert.equal(await page.getByRole('textbox',{name:'多 AI 对话问题'}).inputValue(),'会话 A 的未发送草稿')
 assert.equal(await page.evaluate(()=>window.chatRpcCalls.some(method=>/webAIStart|webAIClaim/.test(method))),false)
 await page.setViewportSize({width:360,height:900});await page.getByRole('button',{name:'会话历史',exact:true}).click();await page.getByRole('textbox',{name:'搜索会话'}).fill('发布排期');await page.getByRole('button',{name:'选择会话 发布排期',exact:true}).click();await page.getByRole('heading',{name:'发布排期',level:2}).waitFor()
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'result.json'),JSON.stringify({report,errors,streamReadingPositionPreserved:true,historySelectionDidNotSend:true,mobileHistoryUsable:true},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out}))
}finally{await browser.close()}
