/** Opt-in real OS process pause; isolated data and fake model, never the desktop process. */
import assert from 'node:assert/strict'
import {fork} from 'node:child_process'
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {build} from 'esbuild'
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
if(process.argv[2]==='child'){
 const host=await import(process.argv[3]),sessions=new Map(),cleanups=[];let calls=0,creates=0,api
 const services={sessions:{get:id=>sessions.get(id)},sessionController:{
  create:async()=>{const events=[],session={id:'isolated-session-'+(++creates),events,get seq(){return events.length},snapshotEvents:(from=0)=>events.filter(e=>e.seq>from)};sessions.set(session.id,session);return{sessionId:session.id}},rename:async()=>{},
  prompt:async request=>{calls++;const s=sessions.get(request.sessionId);s.events.push({type:'turn/start',seq:s.seq+1,data:{}});if(calls===1)setTimeout(()=>process.send({ready:true}),100);else{const packet=JSON.parse(request.content[0].text.split('\n').at(-1));s.events.push({type:'assistant/message',seq:s.seq+1,data:{message:{content:[{type:'text',text:JSON.stringify({batchId:packet.batchId,results:packet.messages.map(m=>({sourceId:m.sourceId,analysis:{noise:true,items:[]}}))})}]}}},{type:'turn/end',seq:s.seq+2,data:{}})}return{accepted:true}},
  cancel:async({sessionId})=>{const s=sessions.get(sessionId);s.events.push({type:'turn/end',seq:s.seq+1,data:{}})}
 }}
 const ctx={provide:(n,v)=>{if(n==='workbench')api=v},get:n=>services[n],inject(){},effect:fn=>{const stop=fn();if(typeof stop==='function')cleanups.push(stop)}}
 try{
  host.apply(ctx,{});await api.saveSettings({aiExtract:{enabled:true,autoRegister:true,batchSize:5},automation:{enabled:false}})
  await host.mutateWorkbenchState(state=>{for(let i=0;i<5;i++){const at=new Date().toISOString(),id='synthetic-'+i;state.sources.push({id,provider:'yunzhijia',selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:null,observedAt:new Date().toISOString()},externalId:id,title:'仅供参考',excerpt:'合成通知仅供参考',fetchedAt:at,locator:{accountId:'synthetic',groupId:'group',msgId:id,sentAt:at,direction:'inbound',intake:true}});state.analysisQueue.push({id:'queue-'+i,sourceId:id,msgId:id,accountId:'synthetic',groupId:'group',status:'pending',attempts:0})}return state})
  const first=await host.startWorkflowJob(ctx,'analysis',{limit:5})
  while(!host.loadWorkbenchState().jobs[0]?.result)await sleep(20)
  const interrupted=host.loadWorkbenchState();assert.equal(interrupted.jobs[0].status,'queued');assert.equal(interrupted.jobs[0].result.status,'interrupted');assert.equal(interrupted.jobs[0].attempts,0)
  for(const row of interrupted.analysisQueue){assert.equal(row.status,'pending');assert.equal(row.attempts,0);assert.ok(!row.leaseUntil)}
  const retry=await host.startWorkflowJob(ctx,'analysis',{limit:5});assert.equal(retry.jobId,first.jobId)
  while(host.loadWorkbenchState().jobs[0].status!=='completed')await sleep(20)
  const final=host.loadWorkbenchState();assert.equal(final.analysisQueue.filter(r=>r.status==='done').length,5);assert.equal(final.analysisQueue.reduce((n,r)=>n+r.attempts,0),0);assert.equal(creates,1);assert.equal(final.jobs.length,1)
  process.send({done:true,processed:5,sessionCreates:creates,modelCalls:calls,jobCount:final.jobs.length,attempts:0,leaseCount:final.analysisQueue.filter(r=>r.leaseUntil).length,interruption:'queued then completed',checks:23})
 }catch(error){process.send({failed:error.stack});process.exitCode=1}finally{cleanups.forEach(fn=>fn());process.disconnect()}
}else{
 const home=mkdtempSync(join(tmpdir(),'workbench-process-pause-')),file=join(home,'host.mjs'),duration=95000
 await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';export {startWorkflowJob} from './src/host/automation/jobs.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:file,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const child=fork(fileURLToPath(import.meta.url),['child',file],{env:{...process.env,DSH_HOME:home},stdio:['ignore','inherit','inherit','ipc']});let resumeTimer,watchdog,pausedAt,result
 try{
  await new Promise((ok,fail)=>{
   watchdog=setTimeout(()=>fail(Error('process pause test timed out')),duration+60000)
   child.on('message',message=>{
    if(message.ready){pausedAt=Date.now();child.kill('SIGSTOP');console.log(JSON.stringify({paused:true,durationMs:duration,scope:'isolated child process; not system sleep'}));resumeTimer=setTimeout(()=>child.kill('SIGCONT'),duration)}
    if(message.done)result={...message,elapsedFromPauseMs:Date.now()-pausedAt,requestedPauseMs:duration,systemSleep:false}
    if(message.failed)fail(Error(message.failed))
   });child.on('error',fail);child.on('exit',code=>code===0&&result?ok():fail(Error('child exited '+code)))
  });if(process.env.SUSPEND_OUTPUT)writeFileSync(process.env.SUSPEND_OUTPUT,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
 }finally{clearTimeout(resumeTimer);clearTimeout(watchdog);if(child.exitCode===null){child.kill('SIGCONT');child.kill('SIGTERM')}rmSync(home,{recursive:true,force:true})}
}
