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
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>{window.mountWorkbench();window.WB.go('settings')})
 const input=page.getByPlaceholder('在这里粘贴导出的迁移包 JSON');await input.fill('{"draft":"保留的迁移草稿"}')
 await input.evaluate(node=>window.settingsDraftNode=node)
 await page.evaluate(()=>{window.settingsImportCalls=[];window.WB.actions.importMigration=async(...args)=>{window.settingsImportCalls.push(args);return {incomingTotal:1,countsByColumn:{tasks:1},conflictsByColumn:{tasks:0},mappedProjects:[{id:'synthetic',name:'合成迁移项目',from:'/old/project',to:'/new/project'}]}}})
 for(const stage of ['draft','preview']){
  if(stage==='preview'){await page.getByRole('button',{name:'预检迁移包',exact:true}).click();await page.getByRole('textbox',{name:'目标目录 合成迁移项目'}).fill('/edited/local/project')}
  for(const [width,height,rootWidth] of [[1440,900,1440],[1024,768,1024],[800,768,800],[560,720,560],[360,720,360],[360,360,360],[1280,800,600]])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height});await page.evaluate(({theme,rootWidth})=>{document.documentElement.className=theme;document.querySelector('.wb-root').style.width=rootWidth+'px'},{theme,rootWidth});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
   const metric=await page.evaluate(()=>{const root=document.querySelector('.wb-settings-page'),grid=root.querySelector('.wb-settings-grid'),data=grid.querySelector('.wb-settings-data'),cards=data.querySelectorAll('.wb-settings-data-card'),scroll=document.querySelector('.wb-scroll'),r=grid.getBoundingClientRect(),d=data.getBoundingClientRect(),exports=data.querySelector('.is-export').getBoundingClientRect(),imports=data.querySelector('.is-import').getBoundingClientRect();return {pageOverflow:scroll.scrollWidth-scroll.clientWidth,gridWidth:r.width,dataWidth:d.width,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,cardCount:cards.length,cardOverflow:[...cards].map(node=>node.scrollWidth-node.clientWidth),sideBySide:imports.left>exports.right,stacked:imports.top>exports.bottom,draftSameNode:document.querySelector('.wb-migration-import textarea')===window.settingsDraftNode}})
   assert.ok(metric.pageOverflow<=2&&metric.cardOverflow.every(value=>value<=2)&&Math.abs(metric.gridWidth-metric.dataWidth)<2&&metric.cardCount===4&&metric.draftSameNode,JSON.stringify({stage,width,height,rootWidth,theme,metric}));if(metric.gridWidth>780)assert.equal(metric.columns,2);if(metric.gridWidth>740)assert.ok(metric.sideBySide);if(metric.gridWidth<700)assert.ok(metric.stacked)
   assert.equal(await input.inputValue(),'{"draft":"保留的迁移草稿"}');if(stage==='preview')assert.equal(await page.getByRole('textbox',{name:'目标目录 合成迁移项目'}).inputValue(),'/edited/local/project')
   await page.getByRole('heading',{name:'数据管理',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,`${stage}-${rootWidth}-${height}-${theme}.png`)});report.push({stage,width,height,rootWidth,theme,...metric})
  }
 }
 const calls=await page.evaluate(()=>window.settingsImportCalls);assert.equal(calls.length,1);assert.equal(calls[0][2],true);assert.ok(await page.getByRole('button',{name:'执行导入',exact:true}).isDisabled());assert.deepEqual(errors,[])
 writeFileSync(resolve(out,'report.json'),JSON.stringify({report,errors,onlyDryRun:true},null,2));console.log(JSON.stringify({cases:report.length,errors,onlyDryRun:true,output:out}))
}finally{await browser.close()}
