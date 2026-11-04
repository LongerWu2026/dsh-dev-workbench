/** Real hub/job runners, isolated profile and native-service fixtures; no user sessions or external writes. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
import {execFileSync} from 'node:child_process'
import {installNativeContextFixture} from './native-context-fixture.mjs'
const home=mkdtempSync(join(tmpdir(),'workbench-stop-'));process.env.DSH_HOME=home
try{
 const modulePath=join(home,'host.mjs')
 await build({stdin:{contents:`export {assistantHub as hub} from './src/host/assistant/hub.ts';export * from './src/host/assistant/hub-turns.ts';export {rememberHubSession,recordHubRun} from './src/host/assistant/hub-store.ts';export {setShared_workbenchCtx} from './src/host/application/workbench-service.ts';export {loadWorkbenchState as state,mutateWorkbenchState as mutate} from './src/host/storage/state-store.ts';export * from './src/host/automation/jobs.ts';export * from './src/host/automation/job-control.ts';export {summarizeNewsBatch} from './src/host/news/batch-overview.ts';export {runAnalysisBatch} from './src/host/analysis/message-analysis.ts';export {runRadarSummarizeBatch} from './src/host/news/summarizer.ts';export {runOfficeWorkflow,controlOfficeWorkflow} from './src/host/workflows/office-jobs.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:modulePath,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(modulePath),sessions=new Map(),agents=new Map(),cancels=[],prompts=[],removed=[];let serial=0,checks=0,onPrompt,onCreate,cancelError=false,queueError=false
 const check=(name,fn)=>{fn();checks++;console.log('✓ '+name)}
 const until=async fn=>{for(let i=0;i<600;i++){if(fn())return;await new Promise(r=>setTimeout(r,10))}throw Error('fixture timed out')}
 const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
 function session(id='native-'+(++serial)){
  const events=[],row={id,header:{},get seq(){return events.length},snapshotEvents(from=0){return events.filter(e=>e.seq>from)},events,append(type,data={}){events.push({type,data,seq:events.length+1,time:Date.now()})}}
  sessions.set(id,row);agents.set(id,{status:'idle',inbox:{nextTurn:[],nextStep:[]}});return row
 }
 function start(row,rpcId='outside'){agents.get(row.id).status='running';row.append('turn/start',{turn:row.seq+1});row.append('user/message',{role:'user',source:{kind:'user',rpcId},content:[{type:'text',text:rpcId}]})}
 function end(row,kind='aborted'){row.append('turn/end',{reason:{kind}});agents.get(row.id).status='idle'}
 const controller={async create(){if(onCreate)await onCreate();return {session:session()}},async rename(){},async state({sessionId}){return {cursor:sessions.get(sessionId)?.seq||0,running:agents.get(sessionId)?.status==='running'}},async prompt(req){prompts.push(req);if(onPrompt)return onPrompt(req);const row=sessions.get(req.sessionId);start(row,req.requestId);row.append('assistant/message',{message:{content:[{type:'text',text:'已回答'}]}});end(row,'completed');return {accepted:true}},async cancel({sessionId}){cancels.push(sessionId);if(cancelError)throw Error('cancel fixture unavailable');return {accepted:true}},async updateQueue(req){if(queueError)throw Error('queue fixture unavailable');removed.push(req);const inbox=agents.get(req.sessionId).inbox;for(const key of ['nextTurn','nextStep'])inbox[key]=inbox[key].filter(r=>r.id!==req.itemId);return {accepted:true}}}
 const services={sessionController:controller,sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]},agents:{get:id=>agents.get(id)},web:{fetch:async()=>({status:200,statusCode:200,text:async()=>'<html><body>source</body></html>'})}},ctx={get:key=>services[key]};installNativeContextFixture(ctx,controller);h.setShared_workbenchCtx(ctx)
 const hub=req=>h.hub(ctx,req),detail=id=>hub({action:'detail',conversationId:id}),state=h.state
 await h.mutate(s=>{s.tasks=[{id:'a',title:'甲',status:'running'},{id:'b',title:'乙',status:'ready'}];return s})

 await h.mutate(s=>{s.jobs=[{id:'visibility-queued',kind:'analysis',status:'queued',input:{},createdAt:new Date().toISOString()}];return s})
 let visibility=await detail('system:analysis');check('排队记录可保留取消能力，但不能被当成实际运行状态',()=>{assert.equal(visibility.stop.available,true);assert.equal(visibility.stop.running,false)})
 await h.mutate(s=>{s.jobs[0].status='running';return s});visibility=await detail('system:analysis');check('在途作业没有原生模型事件时仍按真实执行状态显示运行',()=>assert.equal(visibility.stop.running,true))
 await h.mutate(s=>{s.jobs[0].status='paused';return s});visibility=await detail('system:analysis');check('暂停作业不再显示运行',()=>assert.equal(visibility.stop.running,false));await h.mutate(s=>{s.jobs=[];return s})
 const a=session('native-a'),b=session('native-b');h.rememberHubSession('task:a',a.id,'甲');h.rememberHubSession('task:b',b.id,'乙');start(a);start(b)
 let d=await detail('task:a');check('外部Harness发起的运行也显示停止能力，读取不发新请求',()=>{assert.equal(d.stop.available,true);assert.equal(d.stop.running,true);assert.deepEqual(d.stop.sessions.map(r=>r.sessionId),[a.id]);assert.equal(prompts.length,0)})
 const before=structuredClone(a.events),n=cancels.length,result=await Promise.all([hub({action:'stop',conversationId:'task:a',token:d.stop.token}),hub({action:'stop',conversationId:'task:a',token:d.stop.token})])
 check('重复停止只取消所选原生会话一次，accepted不冒充已结束',()=>{assert.ok(result.every(r=>r.status==='ok'&&r.stopping));assert.deepEqual(cancels.slice(n),[a.id]);assert.deepEqual(a.events,before);assert.equal(agents.get(b.id).status,'running')})
 check('原生会话仍在运行时继续提供状态，未清空历史',()=>assert.equal(result[0].stopping,true))
 end(a);d=await detail('task:a');check('只有原生结束后停止能力消失，已完成进度不变',()=>{assert.equal(d.stop.available,false);assert.equal(d.stop.running,false);assert.equal(state().tasks[0].status,'running')})
 start(a,'old');const stale=(await detail('task:a')).stop.token;end(a);start(a,'new');const oldCalls=cancels.length
 const changed=await hub({action:'stop',conversationId:'task:a',token:stale});check('过期停止令牌不会误停下一轮',()=>{assert.equal(changed.status,'error');assert.match(changed.note,/轮次已变化/);assert.equal(cancels.length,oldCalls)})
 const cross=await hub({action:'stop',conversationId:'task:a',sessionId:b.id,token:(await detail('task:a')).stop.token});check('拒绝跨事项原生会话停止',()=>{assert.equal(cross.status,'error');assert.equal(cancels.length,oldCalls)})
 end(a)
 // A queued local request must never cancel the earlier unrelated native turn.
 start(a,'other-request');const queued=h.beginHubTurn({conversationId:'task:a',source:'ai',mode:'execute',text:'排队问题',requestId:'queued-one',sessionId:a.id,fromSeq:a.seq})
 agents.get(a.id).inbox.nextTurn=[{id:'ours',source:{rpcId:'queued-one'}},{id:'keep',source:{rpcId:'someone-else'}}]
 const queueStop=await hub({action:'stop',conversationId:'task:a',requestId:queued.requestId});check('排队时仅移除本条rpcId，保留其他排队消息和在途历史',()=>{assert.equal(queueStop.status,'ok');assert.equal(removed.at(-1).itemId,'ours');assert.equal(agents.get(a.id).inbox.nextTurn[0].id,'keep');assert.equal(cancels.length,oldCalls);assert.equal(h.getHubTurn(queued.id).status,'interrupted')});end(a)

 start(a,'earlier-request');const queueRetry=h.beginHubTurn({conversationId:'task:a',source:'ai',mode:'execute',text:'移除失败后重试',requestId:'queue-retry',sessionId:a.id,fromSeq:a.seq});agents.get(a.id).inbox.nextTurn.push({id:'retry-ours',source:{rpcId:queueRetry.requestId}});queueError=true
 assert.equal((await hub({action:'stop',conversationId:'task:a',requestId:queueRetry.requestId})).status,'error');queueError=false
 const removedRetry=await hub({action:'stop',conversationId:'task:a',requestId:queueRetry.requestId})
 check('移除排队消息失败可重试，成功后不等待或中止另一条在途消息',()=>{assert.equal(removedRetry.status,'ok');assert.equal(removedRetry.stopping,false);assert.ok(!agents.get(a.id).inbox.nextTurn.some(r=>r.id==='retry-ours'));assert.equal(agents.get(a.id).status,'running')});end(a)
 // A delayed session preparation is stopped before prompt dispatch.
 const heldCreate=deferred();let enteredCreate=false;onCreate=async()=>{enteredCreate=true;await heldCreate.promise}
 await h.mutate(s=>{s.tasks.push({id:'c',title:'丙',status:'ready'});return s})
 const beforeSend=prompts.length,preparing=hub({action:'send',conversationId:'task:c',text:'解释一下背景',requestId:'prepare-stop'})
 await until(()=>enteredCreate);const preparationStop=await hub({action:'stop',conversationId:'task:c',requestId:'prepare-stop'});heldCreate.resolve();const preparationReply=await preparing;onCreate=null
 check('准备阶段停止阻止迟到请求派发，持久记录保留而不提供自动重发',()=>{assert.equal(preparationStop.status,'ok');assert.equal(preparationReply.status,'stopped');assert.equal(prompts.length,beforeSend);assert.ok(h.hubTurns('task:c')[0].stopRequestedAt)})
 const ack=deferred();onPrompt=async req=>{start(sessions.get(req.sessionId),req.requestId);return ack.promise}
 const pending=hub({action:'send',conversationId:'task:a',text:'解释一下背景和现状',requestId:'during-prompt'});await until(()=>prompts.at(-1)?.requestId==='during-prompt')
 a.append('assistant/message',{message:{content:[{type:'text',text:'已经生成的部分'}]}})
 const mid=await hub({action:'stop',conversationId:'task:a',requestId:'during-prompt'});end(a);ack.resolve({accepted:true});const late=await pending;onPrompt=null
 check('提交回执迟到也不会重复发送，保留已生成部分和原历史',()=>{assert.equal(mid.status,'ok');assert.equal(late.status,'stopped');assert.equal(prompts.filter(r=>r.requestId==='during-prompt').length,1);assert.match(h.getHubTurn(late.turn.id).reply,/已经生成的部分/);assert.equal(h.getHubTurn(late.turn.id).status,'interrupted')})
 start(a);d=await detail('task:a');cancelError=true;const failed=await hub({action:'stop',conversationId:'task:a',token:d.stop.token});cancelError=false
 check('原生取消失败明确报错且可以重试，不能伪造停止',()=>{assert.equal(failed.status,'error');assert.equal((agents.get(a.id)).status,'running')})
 const retry=await hub({action:'stop',conversationId:'task:a',token:d.stop.token});assert.equal(retry.status,'ok');end(a)
 const oldCancel=controller.cancel;delete controller.cancel;start(a);d=await detail('task:a');const unsupported=await hub({action:'stop',conversationId:'task:a',token:d.stop.token});controller.cancel=oldCancel;end(a)
 check('宿主不支持时返回明确原因，不改业务状态',()=>{assert.equal(d.stop.supported,false);assert.equal(unsupported.status,'error');assert.match(unsupported.note,/停止接口/);assert.equal(state().tasks[0].status,'running')})

 // Cancellation failure with an owned request remains retryable after stopRequestedAt is persisted.
 const owned=h.beginHubTurn({conversationId:'task:a',source:'ai',mode:'execute',text:'自己的轮次',requestId:'owned-failure',sessionId:a.id,fromSeq:a.seq});start(a,owned.requestId);cancelError=true
 assert.equal((await hub({action:'stop',conversationId:'task:a',requestId:owned.requestId})).status,'error');cancelError=false
 check('本轮取消失败后重试仍调用原生接口，不被已记录的停止标记短路',()=>assert.ok(h.getHubTurn(owned.id).stopRequestedAt))
 const cancelledBefore=cancels.length;assert.equal((await hub({action:'stop',conversationId:'task:a',requestId:owned.requestId})).status,'ok');assert.equal(cancels.length,cancelledBefore+1);end(a,'cancelled')
 await detail('task:a');assert.equal(h.getHubTurn(owned.id).status,'interrupted')
 const child=session('owned-child');child.header.parentSession={sessionId:a.id};h.rememberHubSession('task:b',child.id,'子会话');start(child)
 const childDetail=await detail('task:b');check('子智能体不通过普通会话取消接口越权停止',()=>assert.ok(childDetail.stop.sessions.every(r=>r.sessionId!==child.id)));end(child)
 // A delayed overall news summary cannot overwrite a paused run.
 await h.mutate(s=>{s.jobs.push({id:'summary-paused',kind:'summary',status:'running',createdAt:new Date().toISOString(),input:{}});s.radar=[{id:'news-one',title:'资讯',url:'https://example.invalid/news'}];s.radarBrief={at:new Date().toISOString(),ids:['news-one'],status:'pending'};return s})
 const summaryGate=deferred();let summaryEntered=false
 const summaryResult=h.summarizeNewsBatch(ctx,controller,{id:'synthetic-summary'},{hubRunId:'summary-paused'},async()=>{summaryEntered=true;await summaryGate.promise;return {overview:'不应提交的迟到总结'}}).catch(e=>e)
 await until(()=>summaryEntered);await h.pauseWorkflowJobs(['summary-paused']);summaryGate.resolve();const stoppedSummary=await summaryResult
 check('资讯总结迟到结果不写入、不标失败、不触发重复摘要',()=>{assert.equal(stoppedSummary.code,'WORKBENCH_WORKFLOW_STOPPED');assert.equal(state().radarBrief.overview,undefined);assert.equal(state().jobs.find(r=>r.id==='summary-paused').status,'paused')})
 // Continuous analysis: first batch completes; second response is held across stop.
 await h.mutate(s=>{s.jobs=[];s.analysisQueue=[];s.sources=[];s.backgroundThreads={};s.modelHealth={};s.syncCursors={};s.settings.aiExtract={enabled:true,autoRegister:true,batchSize:50};s.settings.automation={enabled:false};const at=new Date().toISOString();for(let i=0;i<52;i++){const id='source-'+i;s.sources.push({id,provider:'test',externalId:id,title:'消息',excerpt:'参考消息'+i,fetchedAt:at,locator:{accountId:'account',groupId:'group',msgId:id,sentAt:at,intake:true,direction:'inbound'}});s.analysisQueue.push({id:'entry-'+i,sourceId:id,accountId:'account',groupId:'group',status:'pending',attempts:0,at})}return s})
 const batch2=deferred(),packets=[];let held=false
 onPrompt=async req=>{const packet=JSON.parse(req.content[0].text.split('\n').at(-1));packets.push(packet);const row=sessions.get(req.sessionId);start(row,req.requestId);if(packets.length===2){held=true;await batch2.promise}row.append('assistant/message',{message:{content:[{type:'text',text:JSON.stringify({batchId:packet.batchId,results:packet.messages.map(m=>({sourceId:m.sourceId,analysis:{noise:true,items:[]}}))})}]}});end(row,'completed');return {accepted:true}}
 const jobStart=await h.startWorkflowJob(ctx,'analysis');await until(()=>held);const job=()=>state().jobs.find(r=>r.id===jobStart.jobId),completedIds=state().analysisQueue.filter(r=>r.status==='done').map(r=>r.id)
 assert.equal(completedIds.length,50)
 const runningDetail=await detail('system:analysis');const stopped=await hub({action:'stop',conversationId:'system:analysis',token:runningDetail.stop.token})
 check('连续任务先持久暂停调度再取消，保留前50条已完成记录',()=>{assert.equal(stopped.status,'ok');assert.equal(job().status,'paused');assert.equal(job().pausedByUser,true);assert.equal(state().analysisQueue.filter(r=>r.status==='done').length,50)})
 batch2.resolve();await until(()=>state().lastAnalysisBatch?.status==='paused'&&state().analysisQueue.every(r=>r.status!=='running'))
 check('迟到有效结果不能越过停止栅栏落库，不计失败或重试次数',()=>{assert.equal(job().status,'paused');assert.equal(state().analysisQueue.filter(r=>r.status==='done').length,50);assert.ok(state().analysisQueue.every(r=>r.attempts===0));assert.equal(packets.length,2)})
 await h.drainWorkflowJobs(ctx);const refresh=await h.startWorkflowJob(ctx,'analysis',{preserveModelHealth:true});await h.runAnalysisBatch(ctx,{limit:50})
 check('定时调度、直接识别和统一刷新都不会自动解除用户暂停',()=>{assert.equal(refresh.status,'paused');assert.equal(packets.length,2);assert.equal(job().status,'paused')})
 const restarted=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`import{state}from ${JSON.stringify(modulePath)};console.log(JSON.stringify(state().jobs.find(r=>r.id===${JSON.stringify(jobStart.jobId)})))`],{env:process.env,encoding:'utf8'}))
 check('跨进程恢复仍保持暂停与已完成进度',()=>{assert.equal(restarted.status,'paused');assert.equal(restarted.pausedByUser,true);assert.equal(restarted.progress.processed,50)})
 const resumed=await h.startWorkflowJob(ctx,'analysis');await until(()=>job().status==='completed')
 check('人工继续复用原作业，只重试剩余2条，不再处理已完成50条',()=>{assert.equal(resumed.jobId,jobStart.jobId);assert.equal(packets.length,3);assert.equal(packets[2].messages.length,2);assert.deepEqual(state().analysisQueue.filter(r=>completedIds.includes(r.id)).map(r=>r.id),completedIds);assert.equal(job().progress.processed,52)})
 onPrompt=null

 // Real office runner retains completed artifacts and resumes only the unfinished step.
 const officeGate=deferred();let officeEntered=false;const savedArtifact={text:'第一项已完成草稿',evidenceIds:['office-reply-one']}
 const officeJob={id:'office-runner',kind:'reply_batch',status:'running',input:{replyIds:['office-reply-one','office-reply-two']},executionId:'office-execution-one',createdAt:new Date().toISOString(),steps:[{id:'office-reply-one',status:'completed',input:{reply:{id:'office-reply-one'}},artifact:savedArtifact},{id:'office-reply-two',status:'pending',attempts:0,input:{reply:{id:'office-reply-two',snippet:'请核对'}}}],attempts:0}
 await h.mutate(s=>{s.jobs.push(officeJob);return s})
 const officeCalls=prompts.length;onPrompt=async req=>{const row=sessions.get(req.sessionId);start(row,req.requestId);officeEntered=true;await officeGate.promise;row.append('assistant/message',{message:{content:[{type:'text',text:JSON.stringify({text:'迟到的第二项草稿',evidenceIds:['office-reply-two']})}]}});end(row,'completed');return {accepted:true}}
 const officePending=h.runOfficeWorkflow(ctx,structuredClone(officeJob));await until(()=>officeEntered);await h.pauseWorkflowJobs([officeJob.id]);officeGate.resolve();const officeStopped=await officePending
 check('办公模型返回迟到结果时不覆盖旧产物，也不提交被停止步骤',()=>{const row=state().jobs.find(r=>r.id===officeJob.id);assert.equal(officeStopped.status,'paused');assert.deepEqual(row.steps[0].artifact,savedArtifact);assert.equal(row.steps[1].status,'pending');assert.equal(row.steps[1].artifact,undefined);assert.equal(row.steps[1].attempts,0)})
 await h.controlOfficeWorkflow(officeJob.id,'retry');await h.mutate(s=>{const row=s.jobs.find(r=>r.id===officeJob.id);row.status='running';row.executionId='office-execution-two';return s})
 onPrompt=async req=>{const row=sessions.get(req.sessionId);start(row,req.requestId);row.append('assistant/message',{message:{content:[{type:'text',text:JSON.stringify({text:'已核对的第二项草稿',evidenceIds:['office-reply-two']})}]}});end(row,'completed');return {accepted:true}}
 const officeResumed=await h.runOfficeWorkflow(ctx,structuredClone(state().jobs.find(r=>r.id===officeJob.id)))
 check('办公继续只生成未完成步骤，完成产物和步骤ID完全保留',()=>{const row=state().jobs.find(r=>r.id===officeJob.id);assert.equal(officeResumed.status,'ok');assert.deepEqual(row.steps[0].artifact,savedArtifact);assert.equal(row.steps[1].artifact.text,'已核对的第二项草稿');assert.equal(prompts.length-officeCalls,2)})
 onPrompt=null

 // A command awaiting the state writer must re-check its stop fence at admission.
 const writerGate=deferred();let writerEntered=false,commandStopped=false
 const writer=h.mutate(async s=>{writerEntered=true;await writerGate.promise;return s});await until(()=>writerEntered)
 const jobIdsBefore=state().jobs.map(r=>r.id),lateAdmission=h.startWorkflowJob(ctx,'analysis',{checkActive:()=>{if(commandStopped)throw Object.assign(Error('command stopped'),{code:'ASSISTANT_TURN_STOPPED'})}}).catch(e=>e)
 commandStopped=true;writerGate.resolve();await writer;const admissionResult=await lateAdmission
 check('排队等待写入的启动指令在停止后不能创建或恢复作业',()=>{assert.equal(admissionResult.code,'ASSISTANT_TURN_STOPPED');assert.deepEqual(state().jobs.map(r=>r.id),jobIdsBefore)})
 // Generation fencing survives a fast pause/continue, completed office steps remain immutable.
 await h.mutate(s=>{s.jobs.push({id:'office-stop',kind:'reply_batch',status:'running',input:{replyIds:['reply-one','reply-two']},executionId:'office-old',createdAt:new Date().toISOString(),steps:[{id:'reply-one',status:'completed',artifact:{text:'已完成草稿',evidenceIds:['reply-one']}},{id:'reply-two',status:'running',attempts:0}],attempts:0});return s})
 const guard=h.workflowGuard('office-stop');await h.pauseWorkflowJobs(['office-stop']);await h.controlOfficeWorkflow('office-stop','retry')
 check('办公作业继续保留完成步骤，旧在途回调即使快速继续也被版本栅栏拦住',()=>{assert.throws(guard,/用户已停止/);const office=state().jobs.find(r=>r.id==='office-stop');assert.equal(office.status,'queued');assert.deepEqual(office.steps[0].artifact,{text:'已完成草稿',evidenceIds:['reply-one']});assert.equal(office.steps[0].status,'completed');assert.equal(office.steps[1].status,'pending')})
 console.log(`assistant stop: ${checks} checks passed`)
}finally{rmSync(home,{recursive:true,force:true})}
