/** Settings geometry on synthetic data; never connects to the native user profile. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
const out='/tmp/workbench-settings-cards';mkdirSync(out,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),report=[],errors=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setViewportSize({width:1440,height:900})
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee;--dsw-alias-state-error-primary:#d22}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')})
 await page.evaluate(()=>{
  window.fixtureKnowledgeEngineRequests=[]
  window.mountWorkbench()
  const data=window.WB.store.get().data
  const connectors=Array.from({length:18},(_,index)=>({id:`fixture-${index+1}`,label:`合成连接器 ${index+1}`,authState:'ok',capabilities:['读取状态'],note:'用于检查连接器列表的限高与滚动'}))
  window.WB.store.set({data:{...data,connectors}})
  window.WB.go('settings')
 })
 for(const name of ['权限分级','运行时诊断','关于','运行与质量'])assert.equal(await page.getByRole('heading',{name,exact:true}).count(),0)
 const connectors=page.getByRole('region',{name:'连接器列表'})
 const linky=connectors.getByRole('region',{name:'Linky 连接'})
 await linky.getByText('未安装',{exact:true}).waitFor()
 const link=linky.getByRole('link',{name:'官网下载'})
 assert.equal(await link.getAttribute('href'),'https://linky.kingdee.com/home/')
 assert.equal(await link.getAttribute('target'),'_blank')
 await page.evaluate(()=>{window.fixtureLinkyInstalled=true;window.dispatchEvent(new Event('focus'))})
 await linky.getByText('已连接',{exact:true}).waitFor()
 assert.equal(await link.count(),0)
 await page.evaluate(()=>{window.fixtureLinkyProbeError=true})
 await linky.getByRole('button',{name:'重新检测'}).click()
 await linky.getByText('检测失败',{exact:true}).waitFor()
 assert.equal(await link.count(),0)
 await page.evaluate(()=>{window.fixtureLinkyProbeError=false})
 await linky.getByRole('button',{name:'重新检测'}).click()
 await linky.getByText('已连接',{exact:true}).waitFor()
 const input=page.getByPlaceholder('在这里粘贴导出的迁移包 JSON');await input.fill('{"draft":"保留的迁移草稿"}')
 await input.evaluate(node=>window.settingsDraftNode=node)
 await page.evaluate(()=>{window.settingsImportCalls=[];window.WB.actions.importMigration=async(...args)=>{window.settingsImportCalls.push(args);return {incomingTotal:1,countsByColumn:{tasks:1},conflictsByColumn:{tasks:0},mappedProjects:[{id:'synthetic',name:'合成迁移项目',from:'/old/project',to:'/new/project'}]}}})
 for(const stage of ['draft','preview']){
  if(stage==='preview'){await page.getByRole('button',{name:'预检迁移包',exact:true}).click();await page.getByRole('textbox',{name:'目标目录 合成迁移项目'}).fill('/edited/local/project')}
  for(const [width,height,rootWidth] of [[1440,900,1440],[1024,768,1024],[800,768,800],[560,720,560],[360,720,360],[360,360,360],[1280,800,600]])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height});await page.evaluate(({theme,rootWidth})=>{document.documentElement.className=theme;document.querySelector('.wb-root').style.width=rootWidth+'px'},{theme,rootWidth});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
   const metric=await page.evaluate(()=>{
    const flow=document.querySelector('.wb-settings-flow'),data=flow.querySelector('.wb-settings-data'),cards=data.querySelectorAll('.wb-settings-data-card'),scroll=document.querySelector('.wb-scroll')
    const exports=data.querySelector('.is-export').getBoundingClientRect(),imports=data.querySelector('.is-import').getBoundingClientRect()
    const flowCards=[...flow.querySelectorAll(':scope > .wb-card')]
    const spanGaps=[]
    let groupBottom=-Infinity
    for(const node of flow.children){
     const {top,bottom}=node.getBoundingClientRect()
     if(node.matches('.wb-settings-wide,.wb-settings-data')){
      spanGaps.push(top-groupBottom)
      groupBottom=bottom
     }else groupBottom=Math.max(groupBottom,bottom)
    }
    return {pageOverflow:scroll.scrollWidth-scroll.clientWidth,flowWidth:flow.clientWidth,dataWidth:data.getBoundingClientRect().width,
     columns:new Set(flowCards.slice(0,flowCards.findIndex(node=>node.matches('.wb-settings-wide'))).map(node=>node.getBoundingClientRect().left)).size,
     fragmented:flowCards.filter(node=>node.getClientRects().length!==1).length,spanGaps,cardCount:cards.length,
     cardOverflow:[...cards].map(node=>node.scrollWidth-node.clientWidth),sideBySide:imports.left>exports.right,stacked:imports.top>exports.bottom,
     draftSameNode:document.querySelector('.wb-migration-import textarea')===window.settingsDraftNode}
   })
   assert.ok(metric.pageOverflow<=2&&metric.cardOverflow.every(value=>value<=2)&&Math.abs(metric.flowWidth-metric.dataWidth)<2&&metric.fragmented===0&&metric.cardCount===4&&metric.draftSameNode,JSON.stringify({stage,width,height,rootWidth,theme,metric}))
   assert.equal(metric.columns,rootWidth===1440?3:rootWidth===1024?2:1)
   assert.ok(metric.spanGaps.every(gap=>gap>=15&&(metric.columns>1||gap<=17)),JSON.stringify(metric.spanGaps))
   if(metric.flowWidth>740)assert.ok(metric.sideBySide)
   if(metric.flowWidth<700)assert.ok(metric.stacked)
   const connectorSize=await connectors.evaluate(node=>{
    const first=node.children[0].getBoundingClientRect(),fourth=node.children[3].getBoundingClientRect()
    return {height:node.getBoundingClientRect().height,previewHeight:fourth.top-first.top,scrollHeight:node.scrollHeight,overflow:node.scrollWidth-node.clientWidth}
   })
   assert.ok(Math.abs(connectorSize.height-connectorSize.previewHeight)<0.1&&connectorSize.scrollHeight>connectorSize.height&&connectorSize.overflow<=2,JSON.stringify(connectorSize))
   if(stage==='draft'&&theme==='light'){
    await connectors.focus()
    await page.keyboard.press('End')
    await page.waitForFunction(()=>{
     const list=document.querySelector('.wb-settings-connector-list')
     return list.scrollTop>0&&list.scrollTop+list.clientHeight>=list.scrollHeight-2
    })
    await connectors.evaluate(node=>{node.scrollTop=0})
   }
   assert.equal(await input.inputValue(),'{"draft":"保留的迁移草稿"}');if(stage==='preview')assert.equal(await page.getByRole('textbox',{name:'目标目录 合成迁移项目'}).inputValue(),'/edited/local/project')
   await page.getByRole('heading',{name:'数据管理',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,`${stage}-${rootWidth}-${height}-${theme}.png`)});report.push({stage,width,height,rootWidth,theme,...metric})
  }
 }
 const add=page.getByRole('button',{name:'添加资讯源'}),dialog=page.getByRole('dialog',{name:'添加资讯源'})
 for(const [width,height] of [[1440,900],[360,360]]){
  await page.setViewportSize({width,height});await page.locator('.wb-root').evaluate(node=>{node.style.width='100%'})
  assert.equal(await page.getByRole('list',{name:'资讯源列表'}).getByRole('listitem').count(),5)
  assert.equal(await page.getByRole('textbox',{name:'RSS / Atom 地址'}).count(),0)
  await add.click();await dialog.waitFor()
  await page.waitForFunction(()=>{
   const rect=document.querySelector('.wb-modal').getBoundingClientRect()
   return rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight
  })
  await page.screenshot({path:resolve(out,`feed-dialog-${width}-${height}.png`),animations:'disabled'})
  await dialog.getByRole('button',{name:'取消',exact:true}).click()
  assert.equal(await dialog.count(),0)
 }
 const model=connectors.getByRole('region',{name:'知识库模型'}),modelDialog=page.getByRole('dialog',{name:'知识库模型配置'})
 assert.ok(await page.evaluate(()=>window.fixtureKnowledgeEngineRequests.every(request=>!request.action)))
 for(const [width,height] of [[1440,900],[360,360]]){
  await page.setViewportSize({width,height})
  await model.getByRole('button',{name:'配置知识库模型'}).click()
  await modelDialog.waitFor()
  await page.waitForFunction(()=>{
   const rect=document.querySelector('.wb-modal').getBoundingClientRect()
   return rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight
  })
  assert.equal(await modelDialog.getByRole('button',{name:'更新当前范围索引'}).count(),1)
  await page.screenshot({path:resolve(out,`model-dialog-${width}-${height}.png`),animations:'disabled'})
  if(width===1440){
   await modelDialog.getByRole('button',{name:'下载并启用（约 47 MB）'}).click()
   await modelDialog.getByRole('progressbar',{name:'模型下载进度'}).waitFor()
   await page.evaluate(()=>{window.fixtureKnowledgeEngine={...window.fixtureKnowledgeEngine,phase:'error',note:'合成下载失败'}})
   await modelDialog.getByRole('alert').filter({hasText:'合成下载失败'}).waitFor()
   await modelDialog.getByRole('button',{name:'重试下载'}).click()
   await modelDialog.getByRole('progressbar',{name:'模型下载进度'}).waitFor()
   await page.evaluate(()=>{window.fixtureKnowledgeEngine={...window.fixtureKnowledgeEngine,phase:'ready',installed:true}})
   await model.getByText('已启用',{exact:true}).waitFor()
   await modelDialog.getByRole('button',{name:'停用语义增强'}).click()
   await model.getByText('已下载',{exact:true}).waitFor()
  }
  await modelDialog.getByRole('button',{name:'关闭',exact:true}).last().click()
 }
 assert.deepEqual(await page.evaluate(()=>window.fixtureKnowledgeEngineRequests.flatMap(request=>request.action?[request.action]:[])),['enable','prepare','disable'])
 await page.setViewportSize({width:1440,height:900})
 await page.evaluate(()=>{
  const data=window.WB.store.get().data
  window.WB.store.set({data:{...data,connectors:[]}})
 })
 await page.waitForFunction(()=>{
  const list=document.querySelector('.wb-settings-connector-list')
  return list.children.length===3&&list.scrollHeight===list.clientHeight&&!list.style.getPropertyValue('--wb-connector-preview-height')
 })
 const calls=await page.evaluate(()=>window.settingsImportCalls);assert.equal(calls.length,1);assert.equal(calls[0][2],true);assert.ok(await page.getByRole('button',{name:'执行导入',exact:true}).isDisabled());assert.deepEqual(errors,[])
 writeFileSync(resolve(out,'report.json'),JSON.stringify({report,errors,onlyDryRun:true},null,2));console.log(JSON.stringify({cases:report.length,errors,onlyDryRun:true,output:out}))
}finally{await browser.close()}
