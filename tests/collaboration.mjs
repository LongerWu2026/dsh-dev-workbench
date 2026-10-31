/** Isolated projects, fake read-only CLI output and real local service processes. */
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve,basename} from 'node:path'
import {spawn} from 'node:child_process'
import {createServer} from 'node:http'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-collaboration-'));process.env.DSH_HOME=home
await build({stdin:{contents:`export {workbenchApi as api,setShared_workbenchCtx} from './src/host/application/workbench-service.ts';export {disposeDeveloperServices} from './src/host/application/developer-service.ts';export {normalizeState} from './src/host/domain/model.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const host=await import(join(home,'host.mjs')),{api}=host,children=new Set(),requests=[]
let checks=0,ghMode='ok'
function check(label,fn){fn();checks++;console.log('✓',label)}
const probe={resolveExecutable:async()=>'/fixture/gh',spawn(spec){
 requests.push(spec);const binary=basename(spec.argv[0]);let stdout='',stderr='',exitCode=0
 if(binary==='git')stdout=spec.argv[1]==='status'?'## main\n':'abc\x1f初始提交\x1f刚刚'
 if(binary==='gh'){
  if(ghMode==='auth'||ghMode==='partial'&&spec.argv[1]==='pr'){exitCode=1;stderr='HTTP 401: Bad credentials; run gh auth login'}
  else if(ghMode==='repository'){exitCode=1;stderr='none of the git remotes configured for this repository point to a known GitHub host'}
  else if(ghMode==='network'){exitCode=1;stderr='error connecting to api.github.com'}
  else if(ghMode==='dns'){exitCode=1;stderr='Could not resolve host: api.github.com'}
  else stdout='[]'
 }
 return {done:Promise.resolve({exitCode}),collected:{stdout:{readFrom:()=>({text:stdout})},stderr:{readFrom:()=>({text:stderr})}}}
}}
const processHost={spawn(spec){
 const child=spawn(spec.argv[0],spec.argv.slice(1),{cwd:spec.cwd,stdio:['ignore','pipe','pipe'],signal:spec.signal});children.add(child)
 let stdout='',stderr='';child.stdout.on('data',chunk=>{stdout+=chunk});child.stderr.on('data',chunk=>{stderr+=chunk})
 const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>{children.delete(child);resolve({exitCode:code})})})
 return {done,collected:{stdout:{readFrom:()=>({text:stdout})},stderr:{readFrom:()=>({text:stderr})}},terminate(){child.kill('SIGTERM')}}
}}
try{
 const first=join(home,'front project'),second=join(home,'back project');mkdirSync(first);mkdirSync(second)
 let state=await api.saveProject({name:'前端',repoPath:first});const p1=state.projects[0].id
 state=await api.saveProject({name:'后端',repoPath:second});const p2=state.projects[1].id
 host.setShared_workbenchCtx({get:name=>name==='subprocess'?probe:null})
 await api.environment({projectId:p1});const initial=requests.length
 await api.environment({projectId:p1});check('环境快照仅命中同一项目缓存',()=>assert.equal(requests.length,initial))
 const env2=await api.environment({projectId:p2});check('环境探测按已登记项目ID切换目录，不混用旧缓存',()=>{assert.equal(env2.git.length,1);assert.equal(env2.git[0].dir,second)})
 const beforeForce=requests.length;await api.environment({projectId:p2,force:true});check('手动刷新绕过环境缓存',()=>assert.ok(requests.length>beforeForce))
 await assert.rejects(api.environment({projectId:'unknown',dir:first}),/已配置/);await assert.rejects(api.github({projectId:'unknown'}),/已配置/)
 check('未知项目不回退到其他仓库或接受请求中的目录',()=>{})
 await api.github({projectId:p1});const firstGh=requests.filter(s=>basename(s.argv[0])==='gh').length
 await api.github({projectId:p1});assert.equal(requests.filter(s=>basename(s.argv[0])==='gh').length,firstGh)
 const gh2=await api.github({projectId:p2});check('PR与CI按项目读取且缓存不串仓库',()=>{assert.equal(gh2.dir,second);assert.ok(requests.filter(s=>basename(s.argv[0])==='gh').slice(-2).every(s=>s.cwd===second))})
 ghMode='partial';let snapshot=await api.github({projectId:p2,force:true})
 check('PR认证失败与成功的CI分别保留，汇总为部分失败',()=>{assert.equal(snapshot.status,'partial');assert.equal(snapshot.prs.kind,'auth');assert.equal(snapshot.runs.status,'ok')})
 ghMode='auth';snapshot=await api.github({projectId:p2,force:true});check('双路认证失败不伪装成功或空结果',()=>{assert.equal(snapshot.status,'error');assert.equal(snapshot.prs.kind,'auth')})
 ghMode='repository';snapshot=await api.github({projectId:p2,force:true});check('非GitHub仓库与登录失败分开报告',()=>assert.equal(snapshot.prs.kind,'repository'))
 ghMode='network';snapshot=await api.github({projectId:p2,force:true});check('网络失败保留原因，不提示登录失效',()=>{assert.equal(snapshot.prs.kind,'error');assert.match(snapshot.prs.note,/connecting/)})
 ghMode='dns';snapshot=await api.github({projectId:p2,force:true});check('DNS解析失败不误报为非GitHub仓库',()=>{assert.equal(snapshot.prs.kind,'error');assert.match(snapshot.prs.note,/resolve host/)})
 ghMode='ok';snapshot=await api.github({projectId:p2,force:true});check('真实空结果仍为成功读取',()=>{assert.equal(snapshot.status,'ok');assert.equal(snapshot.prs.items.length,0)})
 const reserve=createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
 const serviceUrl='http://127.0.0.1:'+port+'/health'
 writeFileSync(join(first,'service.cjs'),`const http=require('node:http');const server=http.createServer((req,res)=>{console.log(req.method+' '+req.url);res.writeHead(req.url==='/bad'?503:200);res.end()});setTimeout(()=>server.listen(${port},'127.0.0.1',()=>console.log('ready')),200);process.on('SIGTERM',()=>server.close(()=>process.exit(0)))`)
 state=await api.saveProject({id:p1,repoPath:first,launchCommands:[{id:'script-dev:local',name:'本地服务',argv:['node','service.cjs'],common:true,serviceUrl}]})
 check('表单字段及脚本ID可持久恢复，不覆盖项目名称',()=>{const p=host.normalizeState(state).state.projects.find(row=>row.id===p1);assert.equal(p.name,'前端');assert.equal(p.launchCommands[0].serviceUrl,serviceUrl);assert.equal(p.launchCommands[0].id,'script-dev:local');assert.equal(p.launchCommands[0].common,true)})
 for(const value of ['https://example.com/health','http://user:password@localhost/','file:///tmp/test'])await assert.rejects(api.saveProject({id:p1,repoPath:first,launchCommands:[{argv:['node','service.cjs'],serviceUrl:value}]}),/本机 HTTP/)
 check('服务探测只接受显式配置的无凭据本机HTTP地址',()=>{})
 host.setShared_workbenchCtx({get:name=>name==='subprocess'?processHost:null})
 const started=await api.projectStart({projectId:p1,commandId:'script-dev:local'});check('启动子进程不直接宣称服务可访问',()=>assert.equal(started.service.status,'checking'))
 let runtime
 for(let n=0;n<100;n++){runtime=await api.projectRuntime({projectId:p1,force:true});if(runtime.runs[0].service.status==='reachable')break;await new Promise(resolve=>setTimeout(resolve,20))}
 check('真实HTTP服务启动后可检测就绪并记录检查时间',()=>{assert.equal(runtime.runs[0].service.status,'reachable');assert.equal(runtime.runs[0].service.httpStatus,200);assert.ok(runtime.runs[0].service.checkedAt);assert.match(runtime.runs[0].stdout,/HEAD \/health/)})
 await api.projectStop({runId:started.id});for(let n=0;n<100;n++){runtime=await api.projectRuntime({projectId:p1});if(runtime.runs[0].status==='stopped')break;await new Promise(resolve=>setTimeout(resolve,20))}
 check('进程停止后不保留过期就绪状态',()=>{assert.equal(runtime.runs[0].status,'stopped');assert.equal(runtime.runs[0].service.status,'stopped')})
 await api.saveProject({id:p1,repoPath:first,launchCommands:[{id:'bad',argv:['node','service.cjs'],serviceUrl:serviceUrl.replace('/health','/bad')}]})
 const bad=await api.projectStart({projectId:p1,commandId:'bad'});
 for(let n=0;n<100;n++){runtime=await api.projectRuntime({projectId:p1,force:true});if(runtime.runs[0].service.httpStatus===503)break;await new Promise(resolve=>setTimeout(resolve,20))}
 check('HTTP503不显示服务就绪，也不误判子进程已经退出',()=>{assert.equal(runtime.runs[0].status,'running');assert.notEqual(runtime.runs[0].service.status,'reachable');assert.equal(runtime.runs[0].service.httpStatus,503)})
 await api.projectStop({runId:bad.id})
 await api.saveProject({id:p2,repoPath:second,launchCommands:[{id:'fail',argv:['node','-e','process.exit(3)']}]})
 await api.projectStart({projectId:p2,commandId:'fail'});for(let n=0;n<100;n++){runtime=await api.projectRuntime({projectId:p2});if(runtime.runs[0].status==='failed')break;await new Promise(resolve=>setTimeout(resolve,20))}
 check('真实启动失败保留退出码，不显示服务可访问',()=>{assert.equal(runtime.runs[0].status,'failed');assert.equal(runtime.runs[0].exitCode,3);assert.notEqual(runtime.runs[0].service.status,'reachable')})
 console.log('collaboration: '+checks+' checks passed')
}finally{host.disposeDeveloperServices();for(const child of children)child.kill('SIGKILL');await new Promise(resolve=>setTimeout(resolve,50));rmSync(home,{recursive:true,force:true})}
