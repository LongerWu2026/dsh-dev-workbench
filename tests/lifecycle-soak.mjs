/** Accelerated lifecycle test: real local commits, synthetic accounts and no network/model calls. */
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {performance} from 'node:perf_hooks'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-soak-'));process.env.DSH_HOME=home
const bundle=join(home,'host.mjs')
await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';export {ensureBackgroundSession} from './src/host/assistant/sessions.ts';export {analysisScope} from './src/host/analysis/message-analysis.ts';export {runtimeCheckpoint} from './src/host/platform/runtime.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:bundle,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const sessions=new Map(),disposers=[];let creates=0,previousApi,previousRevision=0,checks=0
const services={sessions:{get:id=>sessions.get(id)},sessionController:{create:async()=>{const s={id:'synthetic-session-'+(++creates),seq:0,snapshotEvents:()=>[]};sessions.set(s.id,s);return {session:s}},state:async()=>({running:false,cursor:0}),rename:async()=>{}}}
const accountSession=new Map(),started=performance.now()
try{
 for(let generation=0;generation<20;generation++){
  const host=await import(bundle+'?generation='+generation);let api
  const ctx={provide:(name,value)=>{if(name==='workbench')api=value},get:name=>services[name],inject(){},effect:fn=>{const d=fn();if(typeof d==='function')disposers.push(d)},logger:{info(){}}}
  host.apply(ctx,{})
  if(generation%2){
   sessions.clear();delete services.sessionController.state
   services.sessionController.resolveAgent=async id=>{const s={id,seq:0,snapshotEvents:()=>[]};sessions.set(s.id,s);return {agent:{session:s,status:'idle'}}}
   services.agents={resume:async()=>{throw Error('不得绕过宿主模型和预设装配')}}
  }else{services.sessionController.state=async()=>({running:false,cursor:0});delete services.sessionController.resolveAgent;delete services.agents}
  if(generation===1){
   const restore=services.sessionController.resolveAgent;
   services.sessionController.resolveAgent=async()=>({error:new Error('prompt assembly failed')});
   await assert.rejects(host.ensureBackgroundSession(ctx,'analysis','synthetic-A'),/prompt assembly failed/);checks++;
   services.sessionController.resolveAgent=async id=>({agent:{session:{id},status:'running'}});
   await assert.rejects(host.ensureBackgroundSession(ctx,'analysis','synthetic-A'),/上一批/);checks++;
   delete services.sessionController.resolveAgent;
   await assert.rejects(host.ensureBackgroundSession(ctx,'analysis','synthetic-A'),/安全的会话恢复入口/);checks++;
   assert.equal(creates,2);checks++;
   services.sessionController.resolveAgent=restore;
  }

  if(previousApi){await assert.rejects(previousApi.createTask({title:'过时代际不得提交'}),/实例已替换/);checks++}
  for(const account of ['synthetic-A','synthetic-B']){
   const session=await host.ensureBackgroundSession(ctx,'analysis',account)
   if(accountSession.has(account))assert.equal(session.id,accountSession.get(account));else accountSession.set(account,session.id)
   checks++
  }
  assert.notEqual(accountSession.get('synthetic-A'),accountSession.get('synthetic-B'));checks++
  if(generation===0){await host.mutateWorkbenchState(s=>{
   s.sources=['synthetic-A','synthetic-B'].map(account=>({id:'source-'+account,provider:'yunzhijia',selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:null,observedAt:new Date().toISOString()},title:'同名会话',excerpt:'独立的合成消息',projectId:null,fetchedAt:new Date().toISOString(),locator:{accountId:account,groupId:'same-group',msgId:'same-message'}}));return s
  })}
  const before=host.loadWorkbenchState();for(const source of before.sources){const scoped=host.analysisScope(before,source);assert.deepEqual(scoped.context.map(row=>row.id),[source.id]);checks++}
  await Promise.all(Array.from({length:20},(_,i)=>api.createTask({title:`代际 ${generation} 的事务 ${i}`})))
  const state=host.loadWorkbenchState();assert.equal(state.tasks.length,(generation+1)*20);assert.ok(state.revision>previousRevision);assert.equal(new Set(state.tasks.map(row=>row.id)).size,state.tasks.length);checks+=3
  const disk=JSON.parse(readFileSync(join(home,'storages/dev-workbench/state.json'),'utf8'));assert.equal(disk.tasks.length,state.tasks.length);assert.equal(disk.changeHistory.length,state.changeHistory.length);checks+=2
  const now=Date.now(),first=host.runtimeCheckpoint(now);assert.ok(host.runtimeCheckpoint(now+86400000)>first);checks++ // simulated pause, not actual 24-hour observation
  previousApi=api;previousRevision=state.revision
 }
 assert.equal(creates,2);checks++
 console.log(`lifecycle-soak: ${checks} assertions; 20 reload generations, 400 commits, 2 isolated synthetic accounts, 20 simulated day gaps; ${Math.round(performance.now()-started)} ms`)
}finally{disposers.forEach(dispose=>dispose());rmSync(home,{recursive:true,force:true})}
