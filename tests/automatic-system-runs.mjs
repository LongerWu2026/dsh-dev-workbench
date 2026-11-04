import {installNativeContextFixture} from './native-context-fixture.mjs'
/** Actual scheduler/batch/Hub integration with isolated storage and fake model/web services. */
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'

const home=mkdtempSync(join(tmpdir(),'workbench-system-runs-'));process.env.DSH_HOME=home
try{
 await build({stdin:{contents:`export {runAutomationTick} from './src/host/automation/scheduler.ts';export {drainWorkflowJobs} from './src/host/automation/jobs.ts';export {workbenchApi as api,setShared_workbenchCtx} from './src/host/application/workbench-service.ts';export {assistantHub as hub} from './src/host/assistant/hub.ts';export {hubIndex} from './src/host/assistant/hub-store.ts';export {mutateWorkbenchState as mutate,loadWorkbenchState as state} from './src/host/storage/state-store.ts';export {normalizeState} from './src/host/domain/model.ts';export {migrationNormalizeRow} from './src/host/storage/migration.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(join(home,'host.mjs')),sessions=new Map(),prompts=[],fetches=[];let serial=0,sourceSerial=0,checks=0,onPrompt
 const check=(title,fn)=>{fn();checks++;console.log('✓ '+title)}
 const controller={
  create(){const events=[],id='system-run-'+(++serial),session={id,get seq(){return events.length},snapshotEvents:(from=0)=>events.filter(row=>row.seq>from),append(type,data){events.push({seq:events.length+1,time:Date.now(),type,data})}};sessions.set(id,session);return {session}},
  async prompt(request){
   const text=request.content[0].text,kind=text.startsWith('请阅读下面这篇资讯原文')?'summary':'analysis';prompts.push({kind,sessionId:request.sessionId,text})
   await onPrompt?.(kind)
   const packet=kind==='analysis'?JSON.parse(text.split('\n').at(-1)):null
   const answer=kind==='analysis'?{batchId:packet.batchId,results:packet.messages.map(row=>({sourceId:row.sourceId,analysis:{noise:false,items:[{title:'核对自动化测试结果',needsAction:true,needsReply:false,evidence:row.text}]}}))}:{change:'夹具更新',usage:'夹具场景',risk:'夹具限制',practice:'夹具实践'}
   const session=sessions.get(request.sessionId);session.append('turn/start',{});session.append('user/message',{content:request.content});session.append('assistant/message',{message:{content:[{type:'text',text:JSON.stringify(answer)}]}});session.append('turn/end',{reason:{kind:'completed'}})
  },
  async resolveAgent(id){return {agent:{session:sessions.get(id)}}}
 }
 const services={sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]},sessionController:controller,web:{fetch:async({url})=>{
  fetches.push(url);return {statusCode:200,body:{content:'<article>'+('离线测试原文。'.repeat(30))+'</article>'}}
 }}}
 const ctx={get:key=>key==='rssReader'?{fetch:(...args)=>services.web?.fetch?services.web.fetch(...args):Promise.reject(Error('RSS fixture unavailable'))}:services[key]};installNativeContextFixture(ctx);h.setShared_workbenchCtx(ctx)
 const hub=conversationId=>h.hub(ctx,{action:'detail',conversationId})
 async function source(){const n=++sourceSerial,id='source-'+n,at=new Date().toISOString();await h.mutate(s=>{s.sources.push({id,provider:'test',externalId:id,title:'请核对自动化测试结果 '+n,excerpt:'请核对自动化测试结果 '+n,fetchedAt:at,locator:{accountId:'fixture-account',groupId:'fixture-group',msgId:id,sentAt:at,intake:true,direction:'inbound'}});s.analysisQueue.push({id:'entry-'+n,sourceId:id,accountId:'fixture-account',groupId:'fixture-group',status:'pending',attempts:0,at});return s});return id}
 async function news(id){await h.mutate(s=>{s.radar.push({id,title:'离线资讯 '+id,url:'https://fixture.invalid/'+id,summaryAttempts:0,availability:'active',summary:{},createdAt:new Date().toISOString()});return s})}
 await h.mutate(s=>{s.settings.aiExtract={enabled:true,autoRegister:true,batchSize:50};s.settings.automation={enabled:true,analyze:true,summarize:true,radar:false,mentions:false};return s})
 await source();await news('news-1')
 const tick=await h.runAutomationTick(ctx,{backlogOnly:true}),initial=h.state().jobs
 check('自动调度仍同步完成消息识别再做资讯摘要，保持返回统计',()=>{assert.equal(tick.status,'ok');assert.equal(h.state().lastAutomation.analysisDone,1);assert.deepEqual(prompts.map(row=>row.kind),['analysis','summary']);assert.equal(fetches.length,1)})
 check('两种自动执行都有真实运行记录、原生消息边界与业务结果',()=>{assert.equal(initial.length,2);for(const row of initial){assert.equal(row.status,'completed');assert.equal(row.input.observed,true);assert.equal(h.hubIndex().runs[row.id].links.length,1);assert.equal(h.hubIndex().runs[row.id].items.length,1)}assert.equal(h.state().analysisQueue[0].analysisJobId,initial.find(row=>row.kind==='analysis').id)})
 const analysis=await hub('system:analysis'),radar=await hub('system:radar')
 check('自动任务无需额外读取history，直接打开固定会话显示真实输入和输出',()=>{for(const detail of [analysis,radar]){assert.equal(detail.status,'ok');assert.ok(detail.background.messages.some(row=>row.role==='user'));assert.ok(detail.background.messages.some(row=>row.role==='assistant'));assert.equal(detail.runs.length,1)}})
 const beforeRead={calls:prompts.length,created:serial,jobs:h.state().jobs.length};await hub('system:analysis');await hub('system:radar');await h.runAutomationTick(ctx,{backlogOnly:true})
 check('打开刷新不发模型请求，空自动轮询不累积空运行记录',()=>{assert.equal(prompts.length,beforeRead.calls);assert.equal(serial,beforeRead.created);assert.equal(h.state().jobs.length,beforeRead.jobs)})
 await source();const oldAnalysis=await h.api.analyzeRun();await news('news-legacy');const oldSummary=await h.api.radarSummarize()
 check('旧同步接口保持原返回契约并接入真实运行结果',()=>{assert.equal(oldAnalysis.processed,1);assert.equal(oldSummary.done,1);assert.equal(oldAnalysis.jobId,undefined);assert.equal(oldSummary.jobId,undefined);assert.equal(h.state().jobs.length,4);assert.ok(h.state().jobs.every(row=>row.status==='completed'))})
 await source();const beforeQueued=h.state().jobs.length,start=await h.api.analysisStart()
 for(let i=0;i<500&&['queued','running'].includes(h.state().jobs.find(row=>row.id===start.jobId)?.status);i++)await new Promise(resolve=>setTimeout(resolve,10))
 check('已有连续作业复用原ID，不产生第二个观测作业',()=>{assert.equal(h.state().jobs.length,beforeQueued+1);assert.equal(h.state().jobs.find(row=>row.id===start.jobId).status,'completed');assert.ok(!h.state().jobs.find(row=>row.id===start.jobId).input.observed);assert.equal(h.hubIndex().runs[start.jobId].links.length,1)})
 await source();onPrompt=()=>{throw Error('HTTP 401 fixture model unavailable')};await h.runAutomationTick(ctx,{backlogOnly:true});const paused=h.state().jobs.at(-1),pausedCalls=prompts.length,pausedCount=h.state().jobs.length
 check('自动模型失败保留暂停原因，不另启后台重试队列',()=>{assert.equal(paused.kind,'analysis');assert.equal(paused.status,'failed');assert.equal(paused.result.status,'deferred');assert.ok(paused.error);assert.equal(paused.nextRetryAt,null);assert.equal(h.state().analysisQueue.at(-1).status,'pending');assert.equal(h.state().analysisQueue.at(-1).attempts,0)})
 await h.runAutomationTick(ctx,{backlogOnly:true});await h.drainWorkflowJobs(ctx)
 check('冷却中的自动调用和队列不会重复运行或产生空记录',()=>{assert.equal(prompts.length,pausedCalls);assert.equal(h.state().jobs.length,pausedCount)})
 onPrompt=null;assert.equal((await h.api.analyzeRun()).processed,1)
 const indexPath=join(home,'storages/dev-workbench/assistant-hub.json'),indexText=readFileSync(indexPath,'utf8');writeFileSync(indexPath,'{invalid fixture')
 await source();const beforeFault=prompts.length,faultResult=await h.api.analyzeRun(),faultJob=h.state().jobs.at(-1);writeFileSync(indexPath,indexText)
 await h.drainWorkflowJobs(ctx);await h.runAutomationTick(ctx,{backlogOnly:true})
 check('会话索引故障不回滚已提交业务，不改写成功返回也不重跑模型',()=>{assert.equal(faultResult.processed,1);assert.equal(faultJob.status,'completed');assert.ok(faultJob.historyError);assert.equal(h.state().analysisQueue.at(-1).status,'done');assert.equal(prompts.length,beforeFault+1)})
 await news('news-overlap');let release,entered;const waiting=new Promise(resolve=>entered=resolve)
 onPrompt=async kind=>{assert.equal(kind,'summary');entered();await new Promise(resolve=>release=resolve)}
 const beforeOverlap={jobs:h.state().jobs.length,calls:prompts.length},firstSummary=h.api.radarSummarize();await waiting
 const during=await hub('system:radar'),secondSummary=h.api.radarSummarize()
 check('模型执行期间固定会话已能看到进行中的自动运行',()=>assert.ok(during.runs.some(row=>row.status==='running'&&row.input.observed)))
 release();const overlapping=await Promise.all([firstSummary,secondSummary]);onPrompt=null
 check('重复同步摘要请求复用单飞执行，不生成重复运行或模型请求',()=>{assert.equal(h.state().jobs.length,beforeOverlap.jobs+1);assert.equal(prompts.length,beforeOverlap.calls+1);assert.ok(overlapping.every(row=>row.done===1));assert.equal(h.hubIndex().runs[h.state().jobs.at(-1).id].links.length,1)})
 const interrupted={id:'observed-interrupted',kind:'analysis',status:'running',input:{observed:true},createdAt:new Date().toISOString(),nextRetryAt:'2999-01-01T00:00:00Z'}
 const normalized=h.normalizeState({...h.state(),jobs:[interrupted]}).state.jobs[0],migrated=h.migrationNormalizeRow('jobs',interrupted)
 check('重启和迁移保留观测属性，准确标记中断而非再次入队',()=>{for(const row of [normalized,migrated]){assert.equal(row.input.observed,true);assert.equal(row.status,'failed');assert.match(row.error,/中断/);assert.equal(row.nextRetryAt,null)}})
 await h.mutate(s=>{s.jobs.push({...interrupted,status:'queued'});return s});const staleCalls=prompts.length;await h.drainWorkflowJobs(ctx)
 check('兼容旧或异常queued观测记录，队列不会执行它',()=>assert.equal(prompts.length,staleCalls))
 console.log('automatic-system-runs: '+checks+' checks passed')
}finally{rmSync(home,{recursive:true,force:true})}
