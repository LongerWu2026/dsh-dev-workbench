/** Synthetic messages and a real job runner; never reads or writes the live profile. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'recognition-review-'));process.env.DSH_HOME=home
mkdirSync(join(home,'storages/dev-workbench'),{recursive:true});writeFileSync(join(home,'storages/dev-workbench/state.json'),JSON.stringify({version:2,installedAt:'2020-01-01T00:00:00Z'}))
await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';export {normalizeState} from './src/host/domain/model.ts';export {buildAnalysisPacket,validateAnalysis} from './src/host/analysis/message-analysis.ts';export {sourceEvidence} from './src/host/analysis/recognition-review.ts';export {drainWorkflowJobs} from './src/host/automation/jobs.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const h=await import(join(home,'host.mjs')),sessions=new Map(),calls=[],disposers=[]
let api,onPrompt,sessionSerial=0,sourceSerial=0,checks=0
const state=()=>h.loadWorkbenchState(),entry=id=>state().analysisQueue.find(row=>row.sourceId===id)
const check=(name,fn)=>{fn();checks++;console.log('✓ '+name)}
const defaultResult=p=>({batchId:p.batchId,results:p.messages.map(m=>({sourceId:m.sourceId,analysis:{noise:true,items:[]}}))})
const result=(p,fn)=>({batchId:p.batchId,results:p.messages.map(m=>({sourceId:m.sourceId,analysis:fn(m)}))})
const action=(evidence,title='提交方案')=>({noise:false,items:[{title,needsAction:true,needsReply:false,evidence}]})
const controller={
 create:async()=>{const events=[],s={id:'recognition-session-'+(++sessionSerial),events,get seq(){return events.length},snapshotEvents(from=0){return events.filter(e=>e.seq>from)}};sessions.set(s.id,s);return{sessionId:s.id}},rename:async()=>{},cancel:async()=>{},state:async({sessionId})=>({cursor:sessions.get(sessionId)?.seq||0,running:false}),
 prompt:async request=>{const p=JSON.parse(request.content[0].text.split('\n').at(-1));calls.push({packet:p,sessionId:request.sessionId});const value=onPrompt?await onPrompt(p):defaultResult(p);const s=sessions.get(request.sessionId);s.events.push({type:'user/message',seq:s.seq+1,data:{content:request.content}},{type:'turn/start',seq:s.seq+2,data:{}});s.events.push({type:'assistant/message',seq:s.seq+1,data:{message:{content:[{type:'text',text:JSON.stringify(value)}]}}},{type:'turn/end',seq:s.seq+2,data:{}});return{accepted:true}}
}
const ctx={provide:(name,value)=>{if(name==='workbench')api=value},get:name=>({sessionController:controller,sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]}})[name],inject(){},effect:fn=>{const d=fn();if(typeof d==='function')disposers.push(d)},logger:{info(){}}}
h.apply(ctx,{})
async function reset(){await h.mutateWorkbenchState(s=>{s.analysisQueue=[];s.sources=[];s.jobs=[];s.tasks=[];s.replies=[];s.modelHealth={};s.syncCursors={};s.installedAt='2020-01-01T00:00:00Z';s.settings.aiExtract={enabled:true,autoRegister:true,batchSize:50};s.settings.automation={enabled:false};return s});calls.length=0;onPrompt=null}
async function add(text,loc={},projectId=null){const id='review-source-'+(++sourceSerial),at=new Date(Date.now()-60000+sourceSerial*10).toISOString();await h.mutateWorkbenchState(s=>{s.sources.push({id,provider:'test',title:text,excerpt:text,projectId,fetchedAt:at,locator:{accountId:'account',groupId:'group',msgId:id,sentAt:at,intake:true,direction:'inbound',...loc}});s.analysisQueue.push({id:'entry-'+id,sourceId:id,status:'pending',attempts:0,at});return s});return id}
async function run(ids){const out=await api.analysisStart(ids?{onlyIds:ids.map(id=>'entry-'+id),limit:ids.length}:{});for(let n=0;n<1500;n++){const job=state().jobs.find(j=>j.id===out.jobId);if(!['queued','running'].includes(job.status)||job.nextRetryAt)return job;await new Promise(r=>setTimeout(r,10))}throw Error('job did not settle')}
try{
 await api.snapshot();await reset()
 check('仅兼容空白差异，保留原文，不放宽标点、词语或上下文改写',()=>{assert.equal(h.sourceEvidence('@本人  你看下','@本人 你看下'),'@本人  你看下');assert.equal(h.sourceEvidence('请\n\t提交方案','请 提交方案'),'请\n\t提交方案');assert.equal(h.sourceEvidence('方案（旧版）','方案(旧版)'),null);assert.equal(h.sourceEvidence('请确认方案','请提交方案'),null);assert.equal(h.sourceEvidence('请处理',''),null)})
 const whitespace=await add('@本人  你看下');onPrompt=p=>result(p,()=>action('@本人 你看下'));await run([whitespace]);
 check('空白差异一次通过，持久化依据为真正的原消息片段',()=>{assert.equal(calls.length,1);assert.equal(entry(whitespace).status,'done');assert.equal(entry(whitespace).analysis.items[0].evidence,'@本人  你看下');const saved=h.normalizeState(JSON.parse(readFileSync(join(home,'storages/dev-workbench/state.json'),'utf8'))).state;assert.equal(saved.analysisQueue[0].analysis.items[0].evidence,'@本人  你看下')})
 await reset();const good=await add('请提交接口文档'),bad=await add('请提交方案');
 onPrompt=p=>result(p,m=>action(m.sourceId===bad?'请修复不存在的报错':m.text));const reviewedJob=await run([good,bad]);
 check('依据纠正最多一次且只发送问题消息，原会话复用，成功条目不重复',()=>{assert.deepEqual(calls.map(c=>c.packet.messages.map(m=>m.sourceId)),[[good,bad],[bad]]);assert.equal(new Set(calls.map(c=>c.sessionId)).size,1);assert.match(calls[1].packet.corrections[0].reason,/只能逐字引用/);assert.equal(entry(good).status,'done');assert.equal(entry(bad).status,'awaiting_human');assert.equal(state().tasks.length,1);assert.equal(reviewedJob.status,'completed');assert.equal(reviewedJob.result.reviewed,1);assert.equal(reviewedJob.result.failures,0)})
 check('待确认保存具体原因和被拒绝依据，无有效结果禁止建档',()=>{assert.match(entry(bad).reviewReason,/识别依据/);assert.deepEqual(entry(bad).rejectedEvidence,['请修复不存在的报错']);assert.equal(entry(bad).analysis,null);assert.equal(entry(bad).nextRetryAt,null);assert.equal(entry(bad).leaseUntil,null)})
 await assert.rejects(api.analyzeConfirm('entry-'+bad),/找不到已分析条目|尚无可靠/)
 const normalized=h.normalizeState(JSON.parse(readFileSync(join(home,'storages/dev-workbench/state.json'),'utf8'))).state;
 check('重启标准化仍保留待确认及错误依据，不误转历史跳过',()=>{const row=normalized.analysisQueue.find(r=>r.sourceId===bad);assert.equal(row.status,'awaiting_human');assert.equal(row.reviewKind,'recognition');assert.deepEqual(row.rejectedEvidence,['请修复不存在的报错'])})
 const taskBefore=JSON.stringify(state().tasks),goodBefore=JSON.stringify(entry(good)),native=calls[0].sessionId;calls.length=0;onPrompt=p=>result(p,m=>action(m.text));await api.analysisRetry('entry-'+bad);await run([bad]);
 check('单条重试继续原会话，成功项和已保存待办不被重跑或改写',()=>{assert.equal(calls.length,1);assert.equal(calls[0].sessionId,native);assert.deepEqual(calls[0].packet.messages.map(m=>m.sourceId),[bad]);assert.equal(JSON.stringify(entry(good)),goodBefore);assert.equal(JSON.stringify(state().tasks.slice(0,1)),taskBefore);assert.equal(entry(bad).status,'done');assert.equal(entry(bad).reviewKind,null);assert.equal(state().tasks.length,2)})
 await reset();const corrected=await add('请提交最新方案');onPrompt=p=>result(p,m=>action(p.corrections?m.text:'改写的方案描述'));await run([corrected]);
 check('纠正成功后才写入业务结果，只生成一次待办',()=>{assert.equal(calls.length,2);assert.equal(entry(corrected).status,'done');assert.equal(state().tasks.length,1);assert.equal(entry(corrected).analysis.items[0].evidence,'请提交最新方案')})
 await reset();const serviceGood=await add('请提交材料'),serviceBad=await add('请修改方案'),otherAccount=await add('另一个账号的消息',{accountId:'other-account'});
 onPrompt=p=>{if(p.corrections)throw Error('HTTP 401 model provider unavailable');return result(p,m=>action(m.sourceId===serviceBad?'凭空编造的依据':m.text))};const serviceJob=await run([serviceGood,serviceBad,otherAccount]);
 check('纠正时服务故障仍提交已成功邻项，问题项待确认，其余账号保留排队不抢跑服务',()=>{assert.equal(calls.length,2);assert.equal(entry(serviceGood).status,'done');assert.equal(entry(serviceBad).status,'awaiting_human');assert.equal(entry(otherAccount).status,'pending');assert.ok(state().modelHealth.analysis);assert.equal(serviceJob.status,'queued');assert.equal(entry(otherAccount).attempts,0)})
 await reset();const uncertain=await add('这个按之前说的处理');onPrompt=p=>result(p,()=>({...action('这个按之前说的处理'),needsReview:true,reviewReason:'未说明具体处理对象'}));await run([uncertain]);
 check('AI主动表示无法判断时只保存待确认，任何任务和回复建议均不执行',()=>{assert.equal(entry(uncertain).status,'awaiting_human');assert.match(entry(uncertain).reviewReason,/处理对象/);assert.equal(state().tasks.length,0);assert.equal(state().replies.length,0);assert.equal(calls.length,1)})
 const reviewReason=entry(uncertain).reviewReason;
 await api.setAnalysisDismissed('entry-'+uncertain,true);
 await api.setAnalysisDismissed('entry-'+uncertain,true);
 const diskReview=h.normalizeState(JSON.parse(readFileSync(join(home,'storages/dev-workbench/state.json'),'utf8'))).state.analysisQueue.find(row=>row.sourceId===uncertain);
 const dismissedStatus=await api.analysisStatus();
 await assert.rejects(api.analyzeConfirm('entry-'+uncertain),/无需处理/);
 check('人工标为无需处理后退出待确认，状态和原原因可回读，重复点击不重复记账',()=>{assert.equal(dismissedStatus.awaitingHuman,0);assert.equal(diskReview.reviewDismissed,true);assert.equal(diskReview.reviewReason,reviewReason);assert.equal(state().audit.filter(row=>row.event==='analysis.dismiss').length,1);assert.equal(calls.length,1)})
 await api.setAnalysisDismissed('entry-'+uncertain,false);
 check('恢复待确认保留原原因，整个过程不运行模型或生成业务结果',()=>{assert.equal(entry(uncertain).status,'awaiting_human');assert.equal(entry(uncertain).reviewReason,reviewReason);assert.equal(entry(uncertain).reviewDismissed,undefined);assert.equal(state().tasks.length,0);assert.equal(state().replies.length,0);assert.equal(calls.length,1)})
 await reset();const quote=await add('引用中的接口报错详情',{sentAt:new Date(Date.now()-3*86400000).toISOString()});
 for(let i=0;i<20;i++)await add('后续无关消息 '+i);
 const quoted=await add('@本人 你看下',{replyToMsgId:quote});await run([quoted]);await api.analysisRetry('entry-'+quoted);await run([quoted]);
 check('显式引用跨出近期上下文窗口也单独补齐，已见引用仍随当前消息携带',()=>{for(const c of calls){const ref=c.packet.messages[0].replyContext;assert.equal(ref.status,'available');assert.equal(ref.sourceId,quote);assert.equal(ref.text,'引用中的接口报错详情')}})
 const source=state().sources.find(s=>s.id===quoted),stub={workbenchThreadKey:'none'};
 check('引用不越账号、群组、项目，不取被跳过或未来消息',()=>{for(const change of [{locator:{accountId:'other'}},{locator:{groupId:'other'}},{projectId:'other'},{locator:{sentAt:'2999-01-01T00:00:00Z'}},{skip:true}]){const s=structuredClone(state()),ref=s.sources.find(r=>r.id===quote);if(change.locator)Object.assign(ref.locator,change.locator);if(change.projectId)ref.projectId=change.projectId;if(change.skip)s.analysisQueue.find(r=>r.sourceId===quote).status='skipped';const p=h.buildAnalysisPacket(s,[source],stub,'isolation');assert.equal(p.payload.messages[0].replyContext.status,'missing')}})
 await reset();const missing=await add('@本人  你看下',{replyToMsgId:'not-collected'});await run([missing]);
 check('缺少引用且消息含糊，即使模型判为noise也转待确认，不默默忽略',()=>{assert.equal(entry(missing).status,'awaiting_human');assert.match(entry(missing).reviewReason,/未找到被引用/);assert.equal(calls[0].packet.messages[0].replyContext.status,'missing')})
 await reset();const changingQuote=await add('原来的引用'),changing=await add('请处理此问题',{replyToMsgId:changingQuote});onPrompt=async p=>{await h.mutateWorkbenchState(s=>{s.sources.find(r=>r.id===changingQuote).excerpt='引用已被编辑';return s});return result(p,m=>action(m.text))};await run([changing]);
 check('等待期间引用变化拒收旧结果，回到队列且不增加失败次数',()=>{assert.equal(entry(changing).status,'pending');assert.equal(entry(changing).attempts,0);assert.equal(state().tasks.length,0)})
 await reset();for(let i=0;i<103;i++)await add('消息 '+i);onPrompt=p=>result(p,m=>m.sourceId===state().sources[0].id?{noise:false,items:[{title:'不完整结果'}]}:{noise:true,items:[]});const continuous=await run();
 check('一次连续处理103条，问题项待确认，其余50/50/3批次不受阻',()=>{assert.equal(continuous.status,'completed');assert.deepEqual(calls.map(c=>c.packet.messages.length),[50,50,3]);assert.equal(continuous.progress.processed,103);assert.equal(continuous.progress.remaining,0);assert.equal(continuous.progress.failed,0);assert.equal(continuous.progress.awaitingHuman,1);assert.equal(state().analysisQueue.filter(r=>r.status==='done').length,102)})
 const beforeCalls=calls.length;await h.drainWorkflowJobs(ctx);
 check('调度不会自动反复重试待确认消息',()=>assert.equal(calls.length,beforeCalls))
 console.log(`recognition-review: ${checks} scenarios passed`)
}finally{for(const d of disposers.reverse())d();rmSync(home,{recursive:true,force:true})}
