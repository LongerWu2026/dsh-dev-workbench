/** Production renderer, synthetic architecture trees, no account or network. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const base=dirname(fileURLToPath(import.meta.url)),out='/tmp/workbench-web-ai-code-tree';mkdirSync(out,{recursive:true})
const tree='DeepSeek Harness\n│\n├── Developer Workspace Plugin\n│   ├── UI Layer（React + TypeScript）\n│   │   ├── AI 资讯面板\n│   │   └── 每日待办面板\n│   └── Plugin Host\n│       └── '+('very-long-module-name/'.repeat(12))+'\n└── Optional External Services'
const built=await build({entryPoints:[resolve(base,'fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#f7f8fa;--dsw-alias-bg-layer-2:#edf0f5;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#78808d;--dsw-alias-border-l1:#e7e9ee;--dsw-alias-border-l2:#d4d8e1}html.dark{--dsw-alias-bg-base:#181b20;--dsw-alias-bg-layer-1:#20242b;--dsw-alias-bg-layer-2:#2b3039;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#a0a8b5;--dsw-alias-border-l1:#303640;--dsw-alias-border-l2:#444d5b}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync(resolve(base,'../../client.js'),'utf8')});await page.evaluate(()=>{window.mountWorkbench();window.WB.go('web-ai')})
 await page.getByRole('heading',{name:'网页对比合成主题',level:2}).waitFor()
 for(const mode of ['fenced','legacy'])for(const width of [1440,800,560,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.evaluate(({tree,mode,theme})=>{
   document.documentElement.className=theme
   const now=new Date().toISOString(),text='## 整体架构\n\n使用 `ctx.tools` 注册工具。\n\n'+(mode==='fenced'?'```text\n'+tree+'\n```':'`'+tree+'`')+'\n\n这里最重要的是：保留每一行缩进。'
   window.WB.store.set({data:{...window.WB.store.get().data,revision:50,webAI:{chatgptEnabled:true,topics:[{id:'web-topic',title:'架构图显示验证',createdAt:now,conversations:{}}],rounds:[{id:'tree-round',topicId:'web-topic',requestId:'tree-request',question:'展示架构目录树',createdAt:now,answers:[{providerId:'chatgpt',status:'completed',text,url:null,updatedAt:now}]}]}}})
  },{tree,mode,theme})
  await page.getByRole('heading',{name:'整体架构',level:2}).waitFor();const pre=page.locator('.wb-chat-code');await pre.scrollIntoViewIfNeeded()
  const metric=await pre.evaluate(el=>{const main=el.closest('.wb-chat-main'),thread=el.closest('.wb-chat-thread'),code=el.querySelector('code'),css=getComputedStyle(el),node=code.firstChild,body=code.textContent,starts=[0];for(let i=0;i<body.length;i++)if(body[i]==='\n')starts.push(i+1);const positions=starts.map(i=>{const r=document.createRange();r.setStart(node,i);r.setEnd(node,i+1);const b=r.getBoundingClientRect();return {left:b.left,top:b.top}});return {text:body,whiteSpace:css.whiteSpace,font:getComputedStyle(code).fontFamily,mainOverflow:main.scrollWidth-main.clientWidth,threadOverflow:thread.scrollWidth-thread.clientWidth,codeOverflow:el.scrollWidth-el.clientWidth,positions}})
  assert.equal(metric.text,tree);assert.equal(metric.whiteSpace,'pre');assert.match(metric.font,/monospace/);assert.ok(metric.mainOverflow<=2&&metric.threadOverflow<=2&&metric.codeOverflow>0,JSON.stringify(metric));assert.ok(metric.positions.every((p,i)=>i===0||p.top>metric.positions[i-1].top));assert.ok(Math.max(...metric.positions.map(p=>p.left))-Math.min(...metric.positions.map(p=>p.left))<1,'tree line starts must share the same origin')
  report.push({mode,width,theme,...metric});if(width===360||width===1440)await page.screenshot({path:resolve(out,`${mode}-${width}-${theme}.png`)})
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'report.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out}))
}finally{await browser.close()}
