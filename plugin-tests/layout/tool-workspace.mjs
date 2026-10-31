/** Real UI, synthetic connections, no network or database access. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {openTools} from './tool-picker.mjs'
const out='/tmp/workbench-tool-workspace';mkdirSync(out,{recursive:true})
const built=await build({entryPoints:['plugin-tests/layout/fixture.jsx'],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{height:100%;margin:0;font-family:system-ui}html{--dsw-alias-brand-primary:#111;--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa}html.dark{--dsw-alias-brand-primary:#eee;--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>{window.mountWorkbench();window.dataCalls=[];window.WB.rpc=async(method,payload)=>{window.dataCalls.push(method);if(method.endsWith('dataConnections'))return {connections:[{id:'fixture',name:'开发数据库',kind:'postgres',host:'db.example',port:5432,database:'workbench',unlocked:true}]};if(method.endsWith('dataObjects'))return {objects:[{schemaName:'public',name:'orders',comment:'订单'},{schemaName:'public',name:'customers',comment:'客户'}]};if(method.endsWith('dataStructure'))return {tables:[{schemaName:'public',name:'orders',columns:[{name:'id',type:'bigint',notNull:true},{name:'amount',type:'numeric',comment:'金额'}]}],at:'2026-10-31T00:00:00Z'};if(method.endsWith('dataQuery'))return {columns:['id','amount'],rows:[{id:1,amount:'199.00'}],durationMs:2};return {status:'ok'}};window.WB.go('toolbox')})
 assert.equal(await page.getByRole('textbox',{name:'搜索工具'}).isVisible(),false)
 await openTools(page);await page.getByRole('textbox',{name:'搜索工具'}).focus();await page.keyboard.press('Escape');assert.equal(await page.getByRole('textbox',{name:'搜索工具'}).isVisible(),false)
 await openTools(page);await page.mouse.move(0,0);assert.equal(await page.getByRole('textbox',{name:'搜索工具'}).isVisible(),false)
 const names=['数据连接','JSON','文本 Diff','日志分析','类型生成','接口调试','MCP 调试','时间戳','Base64','URL','UUID','JWT','正则','Cron','SQL','YAML','CSV','Markdown','HTTP 状态码','Shell / Docker','SQL 计划解读','番茄钟']
 for(const width of [1280,800,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:800});await page.evaluate(t=>document.documentElement.className=t,theme)
  for(const name of names){
   await openTools(page);await page.getByRole('textbox',{name:'搜索工具'}).fill(name)
   if(name==='番茄钟'){if(!await page.locator('.wb-tool-focus-group').evaluate(el=>el.open))await page.getByText('专注与休息',{exact:true}).click()}
   // Filter by direct name span, avoiding descriptions and substring collisions.
   const buttons=page.locator('.wb-tool-menu .wb-tool');const button=buttons.filter({has:page.locator('span.wb-row > span').filter({hasText:new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})}).first()
   await button.click();assert.equal(await page.getByRole('textbox',{name:'搜索工具'}).isVisible(),false)
   await page.mouse.move(0,0)
   const metrics=await page.locator('.wb-tool-surface').evaluate(el=>{const root=document.querySelector('.wb-scroll'),r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return {overflow:root.scrollWidth-root.clientWidth,workspaceWidth:r.width,availableWidth:p.width}})
   assert.ok(metrics.overflow<=2&&metrics.workspaceWidth>=metrics.availableWidth-2,JSON.stringify({width,theme,name,...metrics}));report.push({width,theme,name,...metrics})
   if(['数据连接','JSON','接口调试','文本 Diff'].includes(name)&&width!==800)await page.screenshot({path:resolve(out,`${width}-${theme}-${name}.png`),animations:'disabled'})
  }
 }
 await openTools(page);await page.getByRole('textbox',{name:'搜索工具'}).fill('数据连接');await page.getByRole('button',{name:/数据连接 SQL/}).click();await page.getByRole('button',{name:'读取表 / 索引 / Key'}).click();await page.getByRole('textbox',{name:'筛选表、索引或Key'}).fill('orders');assert.equal(await page.getByRole('checkbox',{name:/customers/}).count(),0);await page.getByRole('checkbox',{name:'public.orders 订单'}).check();await page.getByRole('button',{name:'生成所选对象查询'}).click();assert.equal(await page.getByRole('textbox',{name:'数据查询编辑器'}).inputValue(),'SELECT * FROM "public"."orders" LIMIT 100');assert.equal(await page.evaluate(()=>window.dataCalls.filter(m=>m.endsWith('dataQuery')).length),0);await page.getByRole('button',{name:'读取 / 刷新所选结构'}).click();await page.getByRole('cell',{name:'bigint',exact:true}).waitFor();await page.getByRole('textbox',{name:'数据查询编辑器'}).press('Control+Enter');await page.getByRole('cell',{name:'199.00'}).waitFor();await page.setViewportSize({width:1280,height:800});await page.locator('.wb-scroll').evaluate(el=>el.scrollTop=0);await page.screenshot({path:resolve(out,'database-result.png'),animations:'disabled'});
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'report.json'),JSON.stringify({cases:report.length,report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out}))
}finally{await browser.close()}
