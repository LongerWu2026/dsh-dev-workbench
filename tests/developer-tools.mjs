/** Real local processes and HTTP/MCP servers; never starts a user project or contacts an external service. */
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawn} from 'node:child_process'
import {createServer} from 'node:http'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-developer-'));process.env.DSH_HOME=home
const bundle=join(home,'host.mjs')
await build({stdin:{contents:`export {workbenchApi as api,setShared_workbenchCtx} from './src/host/application/workbench-service.ts';export {disposeDeveloperServices,activateDeveloperServices} from './src/host/application/developer-service.ts';export {normalizeState} from './src/host/domain/model.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:bundle,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const host=await import(bundle),{api}=host,children=new Set(),launches=[]
const subprocess={spawn(spec){
 launches.push(spec)
 if(spec.argv[0]==='/usr/bin/open'||['code','idea'].includes(spec.argv[0]))return {done:Promise.resolve({exitCode:0}),collected:{stderr:{readFrom:()=>({text:''})}}}
 const child=spawn(spec.argv[0],spec.argv.slice(1),{cwd:spec.cwd,stdio:['ignore','pipe','pipe'],signal:spec.signal});children.add(child)
 let out='',err='',outLoss=false,errLoss=false
 child.stdout.on('data',chunk=>{out+=chunk;outLoss ||=Buffer.byteLength(out)>spec.stdio.stdout.maxBytes;out=out.slice(-spec.stdio.stdout.maxBytes)})
 child.stderr.on('data',chunk=>{err+=chunk;errLoss ||=Buffer.byteLength(err)>spec.stdio.stderr.maxBytes;err=err.slice(-spec.stdio.stderr.maxBytes)})
 const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>{children.delete(child);resolve({exitCode:code})})})
 return {done,collected:{stdout:{readFrom:()=>({text:out,lossy:outLoss})},stderr:{readFrom:()=>({text:err,lossy:errLoss})}},terminate(){child.kill('SIGTERM')}}
}}
host.setShared_workbenchCtx({get:name=>name==='subprocess'?subprocess:null})
let checks=0,calls=[],disconnects=0,notify=0,cancelled=0
function check(label,fn){fn();checks++;console.log('✓',label)}
const server=createServer(async(req,res)=>{
 try{
 let raw='';for await(const chunk of req)raw+=chunk
 calls.push({url:req.url,method:req.method,headers:req.headers,body:raw})
 if(req.url==='/slow'){setTimeout(()=>{if(!res.destroyed)res.end('late')},1500).unref();return}
 if(req.url==='/unauthorized'){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'missing auth'}));return}
 if(req.url==='/large'){res.end('x'.repeat(1024*1024+100));return}
 if(req.url==='/redirect'){res.writeHead(302,{Location:'/echo'});res.end();return}
 if(req.url==='/echo'||req.url==='/missing'){res.writeHead(req.url==='/missing'?404:200,{'Content-Type':'application/json'});res.end(JSON.stringify({method:req.method,body:raw}));return}
 if(req.method==='DELETE'){disconnects++;res.writeHead(204);res.end();return}
 const packet=JSON.parse(raw),modern=req.url==='/modern'
 if(modern){assert.equal(req.headers['mcp-protocol-version'],'2026-07-28');assert.equal(packet.params._meta['io.modelcontextprotocol/protocolVersion'],'2026-07-28');assert.equal(req.headers['mcp-method'],packet.method)}
 else if(packet.method!=='initialize'){assert.equal(req.headers['mcp-session-id'],'fixture-session');assert.equal(req.headers['mcp-protocol-version'],'2025-11-25')}
 const send=result=>{res.writeHead(200,{'Content-Type':'application/json',...(packet.method==='initialize'?{'Mcp-Session-Id':'fixture-session'}:{})});res.end(JSON.stringify({jsonrpc:'2.0',id:packet.id,result}))}
 if(packet.method==='initialize')return send({protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}})
 if(packet.method==='server/discover')return send({serverInfo:{name:'modern',version:'1'},capabilities:{tools:{}}})
 if(packet.method==='notifications/cancelled'){cancelled++;res.writeHead(202);res.end();return}
 if(packet.method==='notifications/initialized'){notify++;res.writeHead(202);res.end();return}
 if(packet.method==='tools/list'&&req.url==='/bad-tools')return send({tools:null})
 if(packet.method==='tools/list')return send({tools:[{name:modern?'回声':packet.params?.cursor?'other':'echo',description:'fixture',inputSchema:{type:'object',properties:{text:{type:'string'},region:{type:'object',properties:{name:{type:'string','x-mcp-header':'Region'}}}}}}],...(!modern&&!packet.params?.cursor?{nextCursor:'page2'}:{})})
 if(packet.method==='tools/call'){
  if(packet.params.arguments.wait){res.writeHead(200,{'Content-Type':'text/event-stream'});res.write(': waiting\n\n');return}
  if(modern){assert.equal(req.headers['mcp-name'],'=?base64?'+Buffer.from('回声').toString('base64')+'?=');assert.equal(req.headers['mcp-param-region'],'=?base64?'+Buffer.from('华东').toString('base64')+'?=');return send({content:[{type:'text',text:packet.params.arguments.text}]})}
  res.writeHead(200,{'Content-Type':'text/event-stream'});res.write(': ping\r\n\r\ndata: '+JSON.stringify({jsonrpc:'2.0',method:'notifications/progress',params:{progress:1}})+'\r\n\r\n');const event='data: '+JSON.stringify({jsonrpc:'2.0',id:packet.id,result:{content:[{type:'text',text:packet.params.arguments.text}],isError:packet.params.arguments.fail===true}})+'\r\n\r\n';res.write(event.slice(0,13));setTimeout(()=>res.write(event.slice(13)),10);return
 }
 res.writeHead(400);res.end('unknown')
 }catch(error){res.writeHead(500);res.end(String(error))}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port
let seq=0;const request=extra=>({requestId:'test-'+(++seq),...extra})
try{
 const repoPath=join(home,'project with spaces');mkdirSync(repoPath);const repo=realpathSync(repoPath);writeFileSync(join(repo,'package.json'),JSON.stringify({scripts:{dev:'node server.cjs'}}));writeFileSync(join(repo,'pnpm-lock.yaml'),'');writeFileSync(join(repo,'server.cjs'),"console.log('service ready');console.error('fixture diagnostic');setInterval(()=>{},1000);process.on('SIGTERM',()=>process.exit(0))")
 let state=await api.saveProject({name:'fixture project',repoPath:repo,launchCommands:[{id:'server',name:'测试服务',argv:['node','server.cjs']}]});const projectId=state.projects[0].id
 let runtime=await api.projectRuntime({projectId})
 check('读取项目只发现脚本，不启动进程，启动配置可持久恢复',()=>{assert.equal(launches.length,0);assert.ok(runtime.commands.some(c=>c.id==='script-dev'&&c.argv[0]==='pnpm'));assert.equal(host.normalizeState(state).state.projects[0].launchCommands[0].id,'server')})
 await assert.rejects(api.projectStart({projectId,commandId:'fake'}),/不存在/)
 await assert.rejects(api.projectRuntime({projectId:'unknown'}),/已配置/)
 await assert.rejects(api.saveProject({id:projectId,name:'fixture',repoPath:repo,launchCommands:[{argv:['bash','-c','false']}]}),/仅支持/)
 const run=await api.projectStart({projectId,commandId:'server'})
 await assert.rejects(api.projectStart({projectId,commandId:'server'}),/已在运行/)
 await assert.rejects(api.deleteProject(projectId),/请先停止/)
 for(let n=0;n<100;n++){runtime=await api.projectRuntime({projectId});if(runtime.runs[0].stdout.includes('ready')&&runtime.runs[0].stderr.includes('fixture diagnostic'))break;await new Promise(r=>setTimeout(r,20))}
 check('真实进程在配置目录启动，采集stdout/stderr并拦截重复启动',()=>{assert.equal(runtime.runs[0].cwd,repo);assert.match(runtime.runs[0].stdout,/service ready/);assert.match(runtime.runs[0].stderr,/fixture diagnostic/)})
 await api.projectOpen({projectId,target:'vscode'});await api.projectOpen({projectId,target:'idea'});if(process.platform==='darwin')await api.projectOpen({projectId,target:'terminal'})
 check('IDE和终端使用分离argv传递带空格的项目目录',()=>{assert.ok(launches.slice(1).every(s=>s.argv.at(-1)===repo));assert.ok(launches.every(s=>s.cwd===repo))})
 await api.projectStop({runId:run.id});for(let n=0;n<100;n++){runtime=await api.projectRuntime({projectId});if(runtime.runs[0].status==='stopped')break;await new Promise(r=>setTimeout(r,20))}
 check('停止本插件运行后保留日志和真实退出结果',()=>{assert.equal(runtime.runs[0].status,'stopped');assert.equal(runtime.runs[0].exitCode,0);assert.match(runtime.runs[0].stdout,/ready/)})
 let response=await api.httpDebug(request({url:url+'/echo',method:'POST',headers:'{"Content-Type":"application/json","Authorization":"Bearer fixture-secret"}',body:'{"test":true}'}))
 check('真实HTTP请求返回状态、头、正文和耗时',()=>{assert.equal(response.status,200);assert.equal(JSON.parse(response.text).body,'{"test":true}');assert.ok(response.durationMs>=0)})
 response=await api.httpDebug(request({url:url+'/missing'}));check('HTTP错误保留响应内容，不冒充网络异常',()=>assert.equal(response.status,404))
 response=await api.httpDebug(request({url:url+'/redirect'}));check('重定向不自动转发鉴权和请求',()=>assert.equal(response.status,302))
 response=await api.httpDebug(request({url:url+'/large'}));check('响应有1MB上限并显式标注截断',()=>{assert.equal(response.truncated,true);assert.ok(response.text.length<=1024*1024)})
 await assert.rejects(api.httpDebug(request({url:'file:///tmp/test'})),/HTTP/)
 await assert.rejects(api.httpDebug(request({url:url+'/echo',headers:'{"X-Test":"bad\\r\\nInjected: true"}'})),/无效/)
 await assert.rejects(api.httpDebug(request({url:url+'/echo',method:'GET',body:'body'})),/不能带正文/)
 const slow=request({url:url+'/slow'}),slowPromise=api.httpDebug(slow);setTimeout(()=>api.debugCancel({requestId:slow.requestId}),30);await assert.rejects(slowPromise,/停止或超时/)
 check('无效协议、头注入、GET正文被拒绝，取消会终止真实等待',()=>{})
 const connected=await api.mcpConnect(request({url:url+'/mcp',headers:'{"Authorization":"Bearer fixture-secret"}'}))
 check('MCP完成初始化、通知、session header和工具分页',()=>{assert.equal(connected.tools.length,2);assert.equal(notify,1);assert.equal(connected.version,'2025-11-25')})
 const result=await api.mcpCall(request({connectionId:connected.connectionId,name:'echo',arguments:'{"text":"中文响应"}'}))
 check('SSE忽略心跳、收集通知，匹配ID后结束未关闭的流',()=>{assert.equal(result.result.content[0].text,'中文响应');assert.equal(result.events.length,2)})
 const toolError=await api.mcpCall(request({connectionId:connected.connectionId,name:'echo',arguments:{fail:true}}));check('工具isError与传输错误分别保留',()=>assert.equal(toolError.result.isError,true))
 await assert.rejects(api.mcpCall(request({connectionId:connected.connectionId,name:'unknown',arguments:{}})),/请选择/)
 await assert.rejects(api.mcpCall(request({connectionId:connected.connectionId,name:'echo',arguments:'[]'})),/JSON对象/)
 const waitCall=request({connectionId:connected.connectionId,name:'echo',arguments:{wait:true}}),waiting=api.mcpCall(waitCall);const stopped=assert.rejects(waiting,/停止或超时/);await new Promise(r=>setTimeout(r,30));await api.debugCancel({requestId:waitCall.requestId});await stopped;check('停止legacy工具调用同时发出关联取消通知',()=>assert.equal(cancelled,1))
 await api.mcpDisconnect({connectionId:connected.connectionId});await assert.rejects(api.mcpCall(request({connectionId:connected.connectionId,name:'echo',arguments:{}})),/失效/)
 check('断开释放会话，过期连接不能继续调用',()=>assert.equal(disconnects,1))
 const modern=await api.mcpConnect(request({url:url+'/modern',version:'2026-07-28'}));const modernCall=await api.mcpCall(request({connectionId:modern.connectionId,name:'回声',arguments:{text:'modern',region:{name:'华东'}}}))
 check('2026版使用metadata、中文工具名及嵌套参数头，不发legacy初始化',()=>{assert.equal(modernCall.result.content[0].text,'modern');assert.ok(!calls.some(c=>c.url==='/modern'&&c.body.includes('"method":"initialize"')))})
 await api.mcpDisconnect({connectionId:modern.connectionId})
 await assert.rejects(api.mcpConnect(request({url:url+'/unauthorized'})),/HTTP 401/);check('MCP鉴权失败明确标注HTTP状态，不误报协议ID错误',()=>{})
 const beforeFailed=disconnects;await assert.rejects(api.mcpConnect(request({url:url+'/bad-tools'})),/tools\/list/);check('发现工具失败也释放已创建的远端会话',()=>assert.equal(disconnects,beforeFailed+1))
 await assert.rejects(api.httpDebug(request({url:url+'/slow',timeoutMs:1000})),/停止或超时/);check('超时会终止真实HTTP等待',()=>{})
 check('调试凭据和响应不会写入业务状态',()=>assert.ok(!readFileSync(join(home,'storages/dev-workbench/state.json'),'utf8').includes('fixture-secret')))
 const oldDispose=host.activateDeveloperServices(),newDispose=host.activateDeveloperServices();await api.projectStart({projectId,commandId:'server'});oldDispose();check('旧挂载的清理不能停止新挂载的运行',()=>assert.equal((launches.filter(s=>s.argv[0]==='node')).length,2));assert.equal((await api.projectRuntime({projectId})).runs[0].status,'running');newDispose();await new Promise(r=>setTimeout(r,100));check('插件停用只清理由本模块持有的进程',()=>assert.equal(children.size,0))
 console.log('developer-tools: '+checks+' real integration scenarios passed')
}finally{host.disposeDeveloperServices();for(const child of children)child.kill('SIGKILL');server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(home,{recursive:true,force:true})}
