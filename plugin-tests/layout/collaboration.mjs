/** Synthetic projects and logs; browser network is blocked. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const base=dirname(fileURLToPath(import.meta.url)),out='/tmp/workbench-collaboration-layout';mkdirSync(out,{recursive:true})
const built=await build({entryPoints:[resolve(base,'fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{height:100%;margin:0;font-family:system-ui}html{--dsw-alias-brand-primary:#356fee;--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync(resolve(base,'../../client.js'),'utf8')})
 await page.evaluate(()=>{
  window.mountWorkbench();const WB=window.WB,data=WB.store.get().data
  WB.store.set({data:{...data,projects:[{id:'front',name:'前端项目',repoPath:'/synthetic/front',launchCommands:[{id:'custom',name:'本机开发服务',argv:['node','server with spaces.js'],common:true,serviceUrl:'http://localhost:3000/health'}]},{id:'back',name:'后端项目',repoPath:'/synthetic/back',launchCommands:[]}]}})
  WB.actions.environment=async({projectId})=>({projectId,at:new Date().toISOString(),git:[{dir:'/synthetic/'+projectId,label:projectId,status:'ok',branch:'main',changed:0,staged:0,unstaged:0,untracked:0,files:[]}],docker:{status:'ok',containers:[]}})
  WB.actions.github=async({projectId})=>({status:'partial',at:new Date().toISOString(),prs:{status:'error',note:'GitHub 登录失效，请重新登录后刷新。'},runs:{status:'ok',items:[{id:1,workflow:projectId+' 流水线',conclusion:'success',branch:'main'}]}})
  WB.rpc=async(method,{request})=>method.endsWith('/projectRuntime')?{projectId:request.projectId,at:new Date().toISOString(),commands:[{id:'dev',name:'开发服务',argv:['npm','run','dev']},...Array.from({length:15},(_,i)=>({id:'script-'+i,name:'其他脚本 '+i,argv:['npm','run','build-'+i]}))],runs:[{id:'run',name:'项目服务',argv:['node','server.js'],status:'running',startedAt:new Date().toISOString(),service:{status:'reachable',url:'http://localhost:3000/health',httpStatus:200},stdout:'synthetic long output '.repeat(80)}]}:{status:'ok'}
  WB.go('collab')
 })
 for(const width of [1280,800,560,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:700});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  await page.getByRole('combobox',{name:'当前项目'}).selectOption('front');await page.getByText('front 流水线',{exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'启动 其他脚本 0',exact:true}).isVisible(),false)
  await page.getByRole('link',{name:'打开服务'}).waitFor();await page.getByRole('button',{name:'启动配置',exact:true}).click()
  await page.getByRole('textbox',{name:'启动参数 1'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'启动参数 1'}).inputValue(),'server with spaces.js')
  for(const name of ['启动项名称 1','执行程序 1','启动参数 1','服务地址 1']){await page.getByLabel(name,{exact:true}).scrollIntoViewIfNeeded();assert.equal(await page.getByLabel(name,{exact:true}).isVisible(),true)}
  await page.getByRole('button',{name:'保存启动配置'}).scrollIntoViewIfNeeded()
  const metrics=await page.locator('.wb-scroll').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,rootOverflow:document.querySelector('.wb-root').scrollWidth-document.querySelector('.wb-root').clientWidth}))
  report.push({width,theme,...metrics});assert.ok(metrics.overflow<=2&&metrics.rootOverflow<=2,JSON.stringify(metrics));await page.screenshot({path:resolve(out,`${width}-${theme}-config.png`)})
  await page.getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('combobox',{name:'当前项目'}).selectOption('back');await page.getByText('back 流水线',{exact:true}).waitFor();assert.equal(await page.getByText('front 流水线',{exact:true}).count(),0)
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'report.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out},null,2))
}finally{await browser.close()}
