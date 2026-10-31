/** Exercise the real persisted job runner and model protocol in an isolated profile. */
import assert from 'node:assert/strict'
import {mkdtempSync, readFileSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {build} from 'esbuild'
import {execFileSync} from 'node:child_process'

const home=mkdtempSync(join(tmpdir(),'workbench-continuous-'));process.env.DSH_HOME=home
await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export * from './src/host/automation/jobs.ts';export {runAutomationTick} from './src/host/automation/scheduler.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';export {normalizeState} from './src/host/domain/model.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const h=await import(join(home,'host.mjs')),sessions=new Map(),disposers=[],packets=[]
let api,serial=0,onPrompt=null,checks=0
const state=()=>h.loadWorkbenchState(),job=id=>state().jobs.find(row=>row.id===id)
const check=(label,fn)=>{fn();checks++;console.log('✓ '+label)}
const controller={
 create:async()=>{const events=[],s={id:'continuous-session-'+(++serial),events,get seq(){return events.length},snapshotEvents(from=0){return events.filter(e=>e.seq>from)}};sessions.set(s.id,s);return{sessionId:s.id}},
 rename:async()=>{},state:async({sessionId})=>({cursor:sessions.get(sessionId)?.seq||0,running:false}),cancel:async()=>{},
 prompt:async request=>{const packet=JSON.parse(request.content[0].text.split('\n').at(-1));packets.push(packet);const result=await onPrompt?.(packet) || {batchId:packet.batchId,results:packet.messages.map(m=>({sourceId:m.sourceId,analysis:{noise:true,items:[]}}))};const s=sessions.get(request.sessionId);s.events.push({type:'user/message',seq:s.seq+1,data:{content:request.content}},{type:'turn/start',seq:s.seq+2,data:{}});s.events.push({type:'assistant/message',seq:s.seq+1,data:{message:{content:[{type:'text',text:JSON.stringify(result)}]}}},{type:'turn/end',seq:s.seq+2,data:{}});return{accepted:true}}
}
const services={sessionController:controller,sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]}}
const ctx={provide:(name,value)=>{if(name==='workbench')api=value},get:name=>services[name],inject(){},effect:fn=>{const dispose=fn();if(typeof dispose==='function')disposers.push(dispose)},logger:{info(){}}};h.apply(ctx,{})
async function seed(count){
 await h.mutateWorkbenchState(s=>{s.analysisQueue=[];s.sources=[];s.jobs=[];s.syncCursors={};s.modelHealth={};s.settings.aiExtract={enabled:true,autoRegister:true,batchSize:5};s.settings.automation={enabled:false};const now=Date.now();for(let i=0;i<count;i++){const id='s-'+i,at=new Date(now-1000*(count-i)).toISOString();s.sources.push({id,provider:'test',externalId:id,title:'工作消息',excerpt:'消息仅供参考 '+i,fetchedAt:at,locator:{accountId:'account',groupId:'group',msgId:id,sentAt:at,intake:true,direction:'inbound'}});s.analysisQueue.push({id:'e-'+i,sourceId:id,accountId:'account',groupId:'group',status:'pending',attempts:0,at})}return s});onPrompt=null;packets.length=0
}
async function idle(id){for(let i=0;i<1000&&job(id)?.status==='running';i++)await new Promise(resolve=>setTimeout(resolve,10));assert.notEqual(job(id)?.status,'running','job did not settle')}
async function finish(id){for(let i=0;i<1000&&['queued','running'].includes(job(id)?.status)&&!job(id)?.nextRetryAt;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(!['queued','running'].includes(job(id)?.status)||job(id)?.nextRetryAt,'job did not finish or pause')}
async function resume(id){await h.mutateWorkbenchState(s=>{s.jobs.find(row=>row.id===id).nextRetryAt=null;for(const row of s.analysisQueue)row.nextRetryAt=null;return s});await h.drainWorkflowJobs(ctx)}
try{
 await seed(123)
 let release,enteredResolve;const entered=new Promise(resolve=>enteredResolve=resolve)
 onPrompt=async()=>{if(packets.length===1){enteredResolve();await new Promise(resolve=>release=resolve)}else if(packets.length===2){const persisted=JSON.parse(readFileSync(join(home,'storages/dev-workbench/state.json'),'utf8'));const p=persisted.jobs[0].progress;check('第二批开始前已持久保存累计50、剩余73及首批进度',()=>{assert.equal(p.processed,50);assert.equal(p.remaining,73);assert.equal(p.batches,1)});const restored=h.normalizeState(persisted).state.jobs[0];check('中途重启标准化恢复排队，保留累计进度',()=>{assert.equal(restored.status,'queued');assert.equal(restored.progress.processed,50)})}}
 const started=await api.analysisStart({limit:5});await entered
 const repeated=await Promise.all(Array.from({length:8},()=>api.analysisStart({limit:10})))
 check('连续点击复用同一作业，不重复领取或重置进度',()=>{assert.ok(repeated.every(row=>row.jobId===started.jobId));assert.equal(state().jobs.length,1);assert.equal(job(started.jobId).progress.remaining,123)})
 const readsBefore=packets.length,revisionBefore=state().revision,live=await api.analysisStatus();
 check('轻量提取状态接口返回进行中作业，不调用模型或改写业务快照',()=>{const observed=live.jobs.find(row=>row.id===started.jobId);assert.equal(observed.status,'running');assert.equal(observed.progress.remaining,123);assert.equal(observed.input,undefined);assert.equal(packets.length,readsBefore);assert.equal(state().revision,revisionBefore)})
 release();await finish(started.jobId)
 check('一次点击处理123条，自动执行50/50/23三批后才完成',()=>{assert.deepEqual(packets.map(p=>p.messages.length),[50,50,23]);assert.equal(job(started.jobId).status,'completed');assert.deepEqual(job(started.jobId).progress,{processed:123,remaining:0,failed:0,batches:3,pauseReason:null});assert.ok(state().analysisQueue.every(row=>row.status==='done'));assert.equal(new Set(packets.flatMap(p=>p.messages.map(m=>m.sourceId))).size,123)})

 const completedStatus=await api.analysisStatus();check('完成状态与累计进度可通过轻量接口立即读取',()=>{const observed=completedStatus.jobs.find(row=>row.id===started.jobId);assert.equal(observed.status,'completed');assert.equal(observed.progress.processed,123);assert.equal(observed.progress.remaining,0)})

 await seed(2);await h.mutateWorkbenchState(s=>{for(const row of s.analysisQueue)Object.assign(row,{status:'failed',attempts:3,lastError:'模型处理超时',nextRetryAt:'2999-01-01T00:00:00Z'});return s});
 const exhaustedOrdinary=await api.analysisStart();await finish(exhaustedOrdinary.jobId);
 check('普通提取不重置耗尽条目，不发送空模型请求',()=>{assert.equal(job(exhaustedOrdinary.jobId).status,'failed');assert.equal(packets.length,0);assert.ok(state().analysisQueue.every(row=>row.attempts===3))});
 const explicitRetry=await api.analysisStart({retryFailed:true});await finish(explicitRetry.jobId);
 check('明确重试恢复耗尽条目并真正发出模型请求，不影响旧作业记录',()=>{assert.equal(job(explicitRetry.jobId).status,'completed');assert.equal(job(exhaustedOrdinary.jobId).status,'failed');assert.equal(packets.length,1);assert.equal(packets[0].messages.length,2);assert.ok(state().analysisQueue.every(row=>row.status==='done'&&row.attempts===0))});
 await seed(3);await h.mutateWorkbenchState(s=>{for(const row of s.analysisQueue)Object.assign(row,{status:'failed',attempts:3,lastError:'超时'});s.analysisQueue[2].status='done';return s});
 const oneRetry=await api.analysisStart({retryFailed:true,onlyIds:['e-0'],limit:1});await finish(oneRetry.jobId);
 check('指定重试只恢复选中失败项，未选和已完成结果保持不变',()=>{assert.equal(state().analysisQueue[0].status,'done');assert.equal(state().analysisQueue[1].attempts,3);assert.equal(state().analysisQueue[1].status,'failed');assert.equal(state().analysisQueue[2].status,'done');assert.equal(packets.length,1);assert.equal(packets[0].messages.length,1)});
 await seed(1);await h.mutateWorkbenchState(s=>{Object.assign(s.analysisQueue[0],{status:'failed',attempts:3,lastError:'旧超时'});return s});onPrompt=p=>({batchId:p.batchId,results:p.messages.map(m=>({sourceId:m.sourceId,analysis:{noise:false,items:[{title:'无效结果'}]}}))});
 const boundedRetry=await api.analysisStart({retryFailed:true});await finish(boundedRetry.jobId);await resume(boundedRetry.jobId);await resume(boundedRetry.jobId);
 check('人工重试后仍最多自动尝试3次，不无限重置或重复发请求',()=>{assert.equal(job(boundedRetry.jobId).status,'failed');assert.equal(state().analysisQueue[0].attempts,3);assert.equal(packets.length,3);assert.match(job(boundedRetry.jobId).progress.pauseReason,/停止发送请求/)});
 const boundedCalls=packets.length;await h.drainWorkflowJobs(ctx);check('再次自动调度不会重新发送已耗尽的作业',()=>assert.equal(packets.length,boundedCalls));
 await seed(4);const targeted=await api.analysisStart({limit:1,onlyIds:['e-2']});await finish(targeted.jobId)
 check('识别本条仍只处理指定消息，不扩展到整个队列',()=>{assert.equal(packets.length,1);assert.equal(packets[0].messages.length,1);assert.equal(packets[0].messages[0].sourceId,'s-2');assert.equal(state().analysisQueue.filter(row=>row.status==='pending').length,3)})

 await seed(12);onPrompt=p=>({batchId:p.batchId,results:p.messages.map((m,i)=>({sourceId:m.sourceId,analysis:i===0?{noise:false,items:[{title:'字段不全'}]}:{noise:true,items:[]}}))})
 const partial=await api.analysisStart();await finish(partial.jobId)
 check('部分失败保留11条成功，只为失败条目等待自动重试并显示原始原因',()=>{const j=job(partial.jobId);assert.equal(j.status,'queued');assert.equal(j.progress.processed,11);assert.equal(j.progress.remaining,1);assert.equal(j.progress.failed,1);assert.match(j.progress.pauseReason,/自动重试/);assert.ok(j.nextRetryAt);assert.equal(packets.length,1)})
 onPrompt=null;await resume(partial.jobId)
 check('等待结束后无需用户再点，自动续跑失败条目，累计不重复',()=>{assert.equal(job(partial.jobId).status,'completed');assert.equal(job(partial.jobId).progress.processed,12);assert.equal(job(partial.jobId).progress.failed,0);assert.equal(packets.at(-1).messages.length,1)})

 await seed(2);await h.mutateWorkbenchState(s=>{Object.assign(s.analysisQueue[0],{status:'failed',attempts:3,lastError:'原消息证据校验失败'});return s});const exhausted=await api.analysisStart();await finish(exhausted.jobId)
 check('其他消息正常排完后，达到重试上限明确暂停，不能假报完成',()=>{const j=job(exhausted.jobId);assert.equal(j.status,'failed');assert.equal(j.progress.processed,1);assert.equal(j.progress.remaining,1);assert.match(j.progress.pauseReason,/3 次重试上限.*原消息证据校验失败/);assert.equal(j.nextRetryAt,null)})

 await seed(2);onPrompt=()=>{throw Error('HTTP 401 model provider unavailable')};const unavailable=await api.analysisStart();await finish(unavailable.jobId)
 check('模型认证故障保留消息与累计进度，显示服务错误及自动恢复时间',()=>{const j=job(unavailable.jobId);assert.equal(j.status,'queued');assert.equal(j.progress.processed,0);assert.equal(j.progress.remaining,2);assert.match(j.progress.pauseReason,/HTTP 401/);assert.ok(j.nextRetryAt);assert.ok(state().analysisQueue.every(row=>row.attempts===0&&row.status==='pending'))})
 const retryAt=job(unavailable.jobId).nextRetryAt;const same=await api.analysisStart()
 check('冷却期间重复点击不清空模型退避或累计进度',()=>{assert.equal(same.jobId,unavailable.jobId);assert.equal(job(same.jobId).nextRetryAt,retryAt);assert.ok(state().modelHealth.analysis)})
 await h.mutateWorkbenchState(s=>{s.settings.automation={enabled:true,analyze:true,radar:false,mentions:false,summarize:false};return s});const callsBeforeTick=packets.length
 await h.runAutomationTick(ctx,{backlogOnly:true})
 check('后台自动化不会抢跑连续作业或绕过失败冷却',()=>{assert.equal(packets.length,callsBeforeTick);assert.equal(job(same.jobId).nextRetryAt,retryAt)})
 onPrompt=null;await h.mutateWorkbenchState(s=>{delete s.modelHealth.analysis;return s});await resume(unavailable.jobId)
 check('模型恢复后原作业继续并完成，无需重新建作业',()=>assert.equal(job(unavailable.jobId).progress.processed,2))

 await seed(1);await h.mutateWorkbenchState(s=>{s.settings.aiExtract.enabled=false;return s});const disabled=await api.analysisStart();await finish(disabled.jobId)
 check('关闭识别时显示暂停原因，保留剩余条目',()=>{assert.equal(job(disabled.jobId).status,'failed');assert.match(job(disabled.jobId).progress.pauseReason,/开启 AI 识别/);assert.equal(job(disabled.jobId).progress.remaining,1)})

 await seed(0);const empty=await api.analysisStart();await finish(empty.jobId)
 check('空队列直接结束，不调用模型',()=>{assert.equal(job(empty.jobId).status,'completed');assert.equal(packets.length,0);assert.equal(job(empty.jobId).progress.remaining,0)})

 await seed(1);await h.mutateWorkbenchState(s=>{s.syncCursors['account:group']={resumeBefore:'history-anchor'};return s});const waiting=await api.analysisStart();await finish(waiting.jobId)
 check('会话补采尚未完成不能把0条误报为全部完成',()=>{assert.equal(job(waiting.jobId).status,'queued');assert.equal(job(waiting.jobId).progress.remaining,1);assert.match(job(waiting.jobId).progress.pauseReason,/补采/);assert.ok(job(waiting.jobId).nextRetryAt);assert.equal(packets.length,0)})
 await h.mutateWorkbenchState(s=>{s.syncCursors={};return s});await resume(waiting.jobId)
 check('补采结束自动续跑原作业',()=>assert.equal(job(waiting.jobId).status,'completed'))

 await seed(75);await h.mutateWorkbenchState(s=>{s.backgroundThreads={};s.settings.analysisSessionId=null;const at=new Date().toISOString();s.jobs=[{id:'crashed-job',kind:'analysis',status:'running',input:{limit:50,onlyIds:[],continuous:true},createdAt:at,updatedAt:at,attempts:0,progress:{processed:0,remaining:75,failed:0,batches:0,pauseReason:null}}];s.analysisQueue.forEach((row,i)=>Object.assign(row,i<50?{status:'done',analysisJobId:'crashed-job'}:{status:'running',leaseUntil:new Date(Date.now()+3600000).toISOString()}));return s})
 const restartCode=`
 import * as h from ${JSON.stringify(join(home,'host.mjs'))};
 const events=[],sizes=[],session={id:'restart-model',events,get seq(){return events.length},snapshotEvents(from=0){return events.filter(e=>e.seq>from)}};
 const controller={create:async()=>({sessionId:session.id}),rename:async()=>{},state:async()=>({cursor:session.seq,running:false}),prompt:async r=>{const p=JSON.parse(r.content[0].text.split('\\n').at(-1));sizes.push(p.messages.length);events.push({type:'assistant/message',seq:session.seq+1,data:{message:{content:[{type:'text',text:JSON.stringify({batchId:p.batchId,results:p.messages.map(m=>({sourceId:m.sourceId,analysis:{noise:true,items:[]}}))})}]}}},{type:'turn/end',seq:session.seq+2,data:{}});return{accepted:true}}};
 const services={sessionController:controller,sessions:{get:id=>id===session.id?session:null,list:()=>[session]}};
 const initial=h.loadWorkbenchState();const status=initial.jobs[0].status;const recovered=initial.analysisQueue.slice(50).every(row=>row.status==='pending'&&!row.leaseUntil);
 await h.drainWorkflowJobs({get:name=>services[name]});const result=h.loadWorkbenchState().jobs[0];console.log(JSON.stringify({status,recovered,result,sizes}));
 `
 const restarted=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',restartCode],{env:process.env,encoding:'utf8'}))
 check('独立进程重启补回已提交但未记进度的50条，仅识别剩余25条',()=>{assert.equal(restarted.status,'queued');assert.ok(restarted.recovered);assert.deepEqual(restarted.sizes,[25]);assert.equal(restarted.result.status,'completed');assert.equal(restarted.result.progress.processed,75);assert.equal(restarted.result.progress.remaining,0)})
 console.log('continuous-analysis: '+checks+' checks passed')
}finally{disposers.forEach(dispose=>dispose());rmSync(home,{recursive:true,force:true})}
