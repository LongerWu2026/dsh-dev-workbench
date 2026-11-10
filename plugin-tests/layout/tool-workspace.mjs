/** Real UI, synthetic connections, no network or database access. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {openTools} from './tool-picker.mjs'
const failures=[];
const out=process.env.TOOL_VIEWPORT_OUTPUT||'/tmp/workbench-tool-workspace';mkdirSync(out,{recursive:true})
const built=await build({entryPoints:['plugin-tests/layout/fixture.jsx'],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{height:100%;margin:0;font-family:system-ui}html{--dsw-alias-brand-primary:#111;--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa}html.dark{--dsw-alias-brand-primary:#eee;--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>{window.mountWorkbench();window.dataCalls=[];window.WB.rpc=async(method,payload)=>{window.dataCalls.push(method);if(method.endsWith('dataConnections'))return {connections:[{id:'fixture',name:'开发数据库',kind:'postgres',host:'db.example',port:5432,database:'workbench',unlocked:true},{id:'inventory',name:'库存数据库',kind:'mysql',database:'warehouse_inventory_'.repeat(5),unlocked:true}]};if(method.endsWith('dataObjects')&&payload.request.id==='inventory')return {objects:[{name:'stock_levels'}]};if(method.endsWith('dataObjects'))return {objects:[{schemaName:'public',name:'orders',comment:'订单'},{schemaName:'public',name:'customers',comment:'客户'}]};if(method.endsWith('dataStructure'))return {tables:[{schemaName:'public',name:'orders',columns:[{name:'id',type:'bigint',notNull:true},{name:'amount',type:'numeric',comment:'金额'}]}],at:'2026-10-31T00:00:00Z'};if(method.endsWith('dataQuery'))return {columns:['id','amount'],rows:[{id:1,amount:'199.00'}],durationMs:2};return {status:'ok'}};window.WB.go('toolbox')})
 // Exercise all tools with long content in host-sized viewports.
 await page.evaluate(()=>{
  window.WB.actions.assistantAsk=async()=>({reply:'合成 AI 分析结果\n'.repeat(180)})
  const previous=window.WB.rpc
  window.WB.rpc=async(method,payload)=>{
   if(method.endsWith('dataConnections')){const result=await previous(method,payload);return {...result,capabilities:{autoTableSelection:true}}}
   if(method.endsWith('dataGenerate'))return {query:'SELECT id FROM public.orders',mode:'query',selected:[],explanation:'合成查询说明。'.repeat(120)}
   if(method.endsWith('dataQuery'))return {columns:['id','details'],rows:Array.from({length:160},(_,id)=>({id,details:'合成结果 '.repeat(100)})),durationMs:1}
   if(method.endsWith('httpWorkspace'))return {revision:0,collections:[{id:'default',name:'默认集合',requests:[],variables:{}}]}
   if(method.endsWith('httpDebug'))return {status:200,durationMs:1,headers:{'content-type':'text/plain'},text:'synthetic response\n'.repeat(300)}
   if(method.endsWith('mcpConnect'))return {connectionId:'mock',durationMs:1,tools:[{name:'echo',description:'合成工具',inputSchema:{type:'object'}}]}
   if(method.endsWith('mcpCall'))return {durationMs:1,result:{content:[{type:'text',text:'合成 MCP 结果\n'.repeat(300)}]}}
   return previous(method,payload)
  }
 })
 const tools=[['data','数据连接'],['json','JSON'],['diff','文本 Diff'],['logs','日志分析'],['types','类型生成'],['http-debug','接口调试'],['mcp-debug','MCP 调试'],['timestamp','时间戳'],['base64','Base64'],['url','URL'],['uuid','UUID'],['jwt','JWT'],['regex','正则'],['cron','Cron'],['sql','SQL'],['yaml','YAML'],['csv','CSV'],['markdown','Markdown'],['status','HTTP 状态码'],['shell','Shell / Docker'],['sqlexplain','SQL 计划解读'],['pomodoro','番茄钟']]
 const json=JSON.stringify(Object.fromEntries(Array.from({length:160},(_,i)=>['field_'+i,'合成字段内容'.repeat(5)])))
 async function choose(name){
  await openTools(page);await page.getByRole('textbox',{name:'搜索工具'}).fill(name)
  if(name==='番茄钟'&&!await page.locator('.wb-tool-focus-group').evaluate(el=>el.open))await page.getByText('专注与休息',{exact:true}).click()
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  await page.locator('.wb-tool-menu .wb-tool').filter({has:page.locator('span.wb-row > span').filter({hasText:new RegExp('^'+escaped+'$')})}).first().click();await page.mouse.move(0,0)
 }
 async function populate(id){
  const pane=page.locator('.wb-tool-pane'),first=pane.locator('textarea').first()
  const click=async name=>page.getByRole('button',{name,exact:true}).last().click()
  if(['json','types'].includes(id)){await first.fill(json);await click(id==='json'?'格式化':'生成 TypeScript')}
  else if(id==='yaml'){await first.fill(Array.from({length:160},(_,i)=>'field_'+i+': 合成内容').join('\n'));await click('YAML → JSON')}
  else if(id==='csv'){await first.fill('id,name\n'+Array.from({length:180},(_,i)=>i+',合成记录').join('\n'));await click('CSV → JSON')}
  else if(id==='markdown')await first.fill('# 合成标题\n'+('\n## 合成小节\n文本内容 **加粗**。\n'.repeat(120)))
  else if(id==='logs')await first.fill(Array.from({length:300},(_,i)=>'2026-11-07 ERROR synthetic exception '+i+'\n    at synthetic:12').join('\n'))
  else if(id==='base64'||id==='url'){await first.fill('合成工具文本\n'.repeat(180));await click('编码')}
  else if(id==='diff'){const tail=Array.from({length:80},(_,i)=>'line '+i+' · '+'long content '.repeat(8)).join('\n');await pane.locator('textarea').nth(0).fill('alpha\nbeta old\nremove me\ngamma\n'+tail);await pane.locator('textarea').nth(1).fill('alpha\nbeta new\ngamma\nadd me\n'+tail);await click('对比')}
  else if(id==='regex'){await first.fill('(\\w+)@(\\w+\\.\\w+)');await pane.locator('textarea').fill('dev@example.com\n'.repeat(150));await click('匹配')}
  else if(id==='uuid'){await pane.locator('input').first().fill('300');await click('生成 UUID v4')}
  else if(id==='jwt'){await first.fill('eyJhbGciOiJub25lIn0.'+Buffer.from(json).toString('base64url')+'.signature');await click('解析')}
  else if(id==='timestamp'){await first.fill('1730000000');await click('转换')}
  else if(id==='cron'){await first.fill('*/15 9-18 * * 1-5');await click('解释')}
  else if(id==='sql'){await first.fill('select '+Array.from({length:160},(_,i)=>'column_'+i).join(',')+' from example where enabled=1');await click('美化')}
  else if(id==='sqlexplain')await first.fill('Seq Scan on synthetic_table (cost=1..123)\nSort Method: external merge\n'.repeat(100))
  else if(id==='http-debug'){await page.getByLabel('接口请求地址').fill('http://synthetic.invalid');await click('发送请求')}
  else if(id==='mcp-debug'){if(!await page.getByLabel('MCP 工具').count()){await page.getByLabel('MCP 服务地址').fill('http://synthetic.invalid/mcp');await click('连接并发现工具')}await click('调用所选工具')}
  else if(id==='data'){
   const orders=page.getByRole('checkbox',{name:/public.orders/})
   if(!await orders.isVisible())await click('展开连接')
   await orders.check()
   if(await page.getByRole('button',{name:'关闭连接面板'}).isVisible())await click('关闭连接面板')
   if(await page.getByRole('tab',{name:'AI 查询',exact:true}).count())await page.getByRole('tab',{name:'AI 查询',exact:true}).click()
   if(!await page.getByRole('textbox',{name:'数据库AI需求'}).isVisible())await click('展开 AI 会话')
   await page.getByRole('textbox',{name:'数据库AI需求'}).fill('查询合成订单');await click('生成 SQL');await page.getByText('SQL 已填入编辑器，可检查后执行',{exact:true}).waitFor()
  }
 }
 async function measure(id,name,width,height,theme,stage){
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
  const metrics=await page.evaluate(()=>{
   const outer=document.querySelector('.wb-scroll'),surface=document.querySelector('.wb-tool-surface'),r=surface.getBoundingClientRect(),o=outer.getBoundingClientRect()
   const inner=[...surface.querySelectorAll('*')].filter(el=>el.checkVisibility()&&el.clientHeight>8&&el.scrollHeight>el.clientHeight+2&&(['auto','scroll'].includes(getComputedStyle(el).overflowY)||el.tagName==='TEXTAREA')).map(el=>{const old=el.scrollTop;el.scrollTop=old+30;const moved=el.scrollTop!==old;el.scrollTop=old;return {tag:el.tagName,label:el.getAttribute('aria-label')||el.className,height:el.clientHeight,overflow:el.scrollHeight-el.clientHeight,moved}})
   const clipped=[...surface.querySelectorAll('button,input,select,textarea')].filter(el=>{if(!el.checkVisibility())return false;const r=el.getBoundingClientRect();for(let parent=el.parentElement;parent&&parent!==surface;parent=parent.parentElement){const p=parent.getBoundingClientRect(),style=getComputedStyle(parent);if(['auto','scroll'].includes(style.overflowY)&&parent.scrollHeight>parent.clientHeight+2)break;if(['hidden','clip'].includes(style.overflowY)&&(r.top<p.top-2||r.bottom>p.bottom+2))return true}return false}).map(el=>el.getAttribute('aria-label')||el.textContent)
   return {outerY:outer.scrollHeight-outer.clientHeight,outerX:outer.scrollWidth-outer.clientWidth,outerTop:outer.scrollTop,documentY:document.documentElement.scrollHeight-innerHeight,bottom:r.bottom,availableBottom:o.bottom,surfaceHeight:r.height,inner,clipped}
  })
  report.push({id,name,width,height,theme,stage,...metrics})
  if(id==='diff'&&stage==='content'){
   const diff=await page.locator('.wb-tool-diff').evaluate(root=>{
    const inputs=[...root.querySelectorAll('.wb-diff-inputs textarea')].map(el=>{const r=el.getBoundingClientRect(),label=el.parentElement.querySelector('.wb-label');return {x:r.x,y:r.y,width:r.width,height:r.height,labelBottom:label.getBoundingClientRect().bottom}})
    const pairs=[...root.querySelectorAll('.wb-diff-pair')].map(row=>[...row.children].map(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width}}))
    const result=root.querySelector('.wb-diff-result'),mark=root.querySelector('mark')
    return {inputs,pairs,actionsBottom:root.querySelector('.wb-diff-actions').getBoundingClientRect().bottom,resultTop:result.getBoundingClientRect().top,scrolls:result.scrollHeight>result.clientHeight+2,highlight:mark&&getComputedStyle(mark).backgroundColor}
   })
   report.at(-1).diff=diff
   assert.equal(diff.inputs.length,2);const [a,b]=diff.inputs
   assert.ok(Math.abs(a.y-b.y)<1&&Math.abs(a.height-b.height)<1&&Math.abs(a.width-b.width)<1&&b.x>a.x+a.width,'Diff 输入应水平等高等宽')
   assert.ok(a.height>=20&&a.labelBottom<=a.y&&b.labelBottom<=b.y,'Diff 输入不得挤压或与标题重叠')
   assert.ok(diff.actionsBottom<=diff.resultTop,'Diff 结果不得覆盖操作栏')
   assert.ok(diff.pairs.length>80&&diff.pairs.every(([l,r])=>Math.abs(l.top-r.top)<1&&Math.abs(l.bottom-r.bottom)<1&&Math.abs(l.width-r.width)<1),'Diff 左右行应对齐，换行后仍等高')
   assert.ok(diff.scrolls,'长 Diff 应在结果区滚动');assert.ok(diff.highlight&&diff.highlight!=='rgba(0, 0, 0, 0)','行内差异应有可见高亮')
  }
  if(metrics.outerY>2||metrics.outerX>2||metrics.outerTop>1||metrics.documentY>2||metrics.bottom>metrics.availableBottom+2||metrics.clipped.length){await page.screenshot({path:resolve(out,`failure-${id}-${width}-${height}-${theme}.png`)});throw Error('工具视口不合格 '+JSON.stringify(report.at(-1)))}
  if(theme==='light'&&['data','json','diff','http-debug','logs','pomodoro'].includes(id)&&([1280,360].includes(width)||id==='diff'))await page.screenshot({path:resolve(out,`${id}-${width}-${height}-${stage}.png`),animations:'disabled'})
 }
 for(const [width,height] of [[1280,800],[980,640],[800,600],[560,480],[360,640],[360,360]])for(const theme of ['light','dark']){
  if(process.env.TOOL_SIZE&&process.env.TOOL_SIZE!==width+'x'+height)continue
  await page.setViewportSize({width,height});await page.evaluate(theme=>{document.documentElement.className=theme;document.documentElement.style.setProperty('--dsh-frame-top-clearance','36px')},theme)
  for(const [id,name] of tools.filter(([id])=>!process.env.TOOL_IDS||process.env.TOOL_IDS.split(',').includes(id))){try{await choose(name);await populate(id);await measure(id,name,width,height,theme,'content');
   if(width===360&&['json','diff','regex','cron','sql','sqlexplain','logs','http-debug'].includes(id)){
    const pane=page.locator('.wb-tool-pane'),ai=page.locator('.wb-tool-ai')
    if(id==='diff'){await pane.locator('textarea').nth(0).fill('before');await pane.locator('textarea').nth(1).fill('after')}
    else if(id!=='http-debug'){await pane.locator('textarea').first().fill(id==='json'?'{"id":1}':id==='cron'?'*/15 9-18 * * 1-5':id==='regex'?'dev@example.com':id==='logs'?'ERROR synthetic failure':'SELECT id FROM example')}
    if(!await ai.evaluate(el=>el.open))await ai.locator('summary').click();await ai.getByRole('button',{name:'交给 AI 处理',exact:true}).click()
    if(id==='http-debug')await ai.getByRole('alert').waitFor();else await ai.locator('pre').waitFor()
    await measure(id,name,width,height,theme,'ai-expanded');await ai.locator('summary').click()
   }}catch(error){const geometry=id==='diff'?await page.locator('.wb-tool-diff').evaluate(root=>[root,...root.querySelectorAll('.wb-diff-inputs,.wb-diff-actions,.wb-diff-actions>*,.wb-diff-result')].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {class:el.className,text:el.textContent.slice(0,30),y:r.y,height:r.height,minHeight:s.minHeight,rows:s.gridTemplateRows,overflow:s.overflow,scrollHeight:el.scrollHeight,scrollTop:el.scrollTop}})).catch(()=>null):undefined;const failure={id,name,width,height,theme,error:String(error),geometry};failures.push(failure);console.log('FAIL '+id+' '+width+'x'+height+' '+theme+' '+String(error).slice(0,180));await page.screenshot({path:resolve(out,`failure-${id}-${width}-${height}-${theme}.png`)}).catch(()=>{})}}
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'report.json'),JSON.stringify({cases:report.length,report,errors,failures},null,2));console.log(JSON.stringify({cases:report.length,errors,failures:failures.length,output:out}))
 if(failures.length)process.exitCode=1;
}catch(error){writeFileSync(resolve(out,'report.json'),JSON.stringify({cases:report.length,report,errors,error:String(error)},null,2));throw error}finally{await browser.close()}
