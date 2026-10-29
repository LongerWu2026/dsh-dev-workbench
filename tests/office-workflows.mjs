import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-workflows-'));process.env.DSH_HOME=home
await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export * from './src/host/workflows/office-jobs.ts';export * from './src/host/automation/jobs.ts';export {normalizeState} from './src/host/domain/model.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const h=await import(join(home,'host.mjs')),sessions=new Map(),disposers=[];let api,creates=0,calls=0,onPrompt=null,checks=0
const emit=(s,text)=>s.events.push({type:'assistant/message',seq:s.seq+1,data:{message:{content:[{type:'text',text}]}}},{type:'turn/end',seq:s.seq+2,data:{}})
const controller={create:async()=>{const events=[],s={id:'office-session-'+(++creates),events,get seq(){return events.length},snapshotEvents(from=0){return events.filter(e=>e.seq>from)}};sessions.set(s.id,s);return{sessionId:s.id}},rename:async()=>{},state:async({sessionId})=>({cursor:sessions.get(sessionId)?.seq||0,running:false}),prompt:async req=>{calls++;const packet=JSON.parse(req.content[0].text.split('\n').at(-1)),s=sessions.get(req.sessionId);s.events.push({type:'user/message',seq:s.seq+1,data:{content:req.content}},{type:'turn/start',seq:s.seq+2,data:{}});const result=onPrompt?await onPrompt(packet):{text:'依据现有资料整理的草稿或方案',evidenceIds:[packet.reply?.id||packet.task?.id||packet.tasks?.[0]?.id]};emit(s,JSON.stringify(result));return{accepted:true}},cancel:async()=>{}}
const services={sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]},sessionController:controller}
const ctx={provide:(n,v)=>{if(n==='workbench')api=v},get:n=>services[n],inject(){},effect:fn=>{const d=fn();if(typeof d==='function')disposers.push(d)},logger:{info(){}}};h.apply(ctx,{})
const state=()=>h.loadWorkbenchState(),last=()=>state().jobs.at(-1),check=(label,fn)=>{fn();checks++;console.log('✓',label)}
try{
 await h.mutateWorkbenchState(s=>{s.sources=[1,2,3].map(n=>({id:'s'+n,excerpt:'请核实工作进展'+n,locator:{accountId:'a',msgId:'m'+n},fetchedAt:new Date().toISOString()}));s.replies=[1,2,3].map(n=>({id:'r'+n,sourceId:'s'+n,stage:'待回复',snippet:'请求'+n,taskIds:[]}));return s})
 await api.createTask({title:'待办处理验收',sourceRefId:'s1'});const task=state().tasks[0];await h.mutateWorkbenchState(s=>{s.replies[0].taskIds=[task.id];return s})
 await assert.rejects(()=>h.enqueueOfficeWorkflow('reply_batch',{replyIds:[]}),/1–20/);checks++
 await assert.rejects(()=>h.enqueueOfficeWorkflow('unknown',{}),/未知/);checks++
 check('已知消息ID映射回真实来源，未知ID仍拒绝',()=>{const input={source:{id:'s',locator:{msgId:'m'}}};assert.deepEqual(h.validateOfficeArtifact({text:'有效草稿',evidenceIds:['m']},input).evidenceIds,['s']);assert.throws(()=>h.validateOfficeArtifact({text:'草稿',evidenceIds:['fake']},input),/不存在/)});
 await h.enqueueOfficeWorkflow('reply_batch',{replyIds:['r2','r1','r1']});const id=last().id
 await Promise.all(Array.from({length:10},()=>h.enqueueOfficeWorkflow('reply_batch',{replyIds:['r1','r2']})))
 check('并发和乱序重复提交只有同一作业、2个独立步骤',()=>{assert.equal(state().jobs.length,1);assert.equal(last().steps.length,2)})
 onPrompt=p=>({text:'回复草稿 '+p.reply.id,evidenceIds:[p.reply.id==='r2'?'fake':p.reply.id]})
 await h.drainWorkflowJobs(ctx)
 check('批量一条失败不丢成功产物；未知依据被拒绝',()=>{assert.equal(last().status,'failed');assert.equal(last().steps[0].status,'completed');assert.equal(last().steps[1].status,'failed');assert.equal(state().replyDrafts?.r1,undefined)})
 const before=calls;onPrompt=null;await h.controlOfficeWorkflow(id,'retry');await h.drainWorkflowJobs(ctx)
 check('仅重试失败步骤且复用原事项会话',()=>{assert.equal(calls,before+1);assert.equal(creates,2);assert.equal(last().status,'completed')})
 await h.mutateWorkbenchState(s=>{s.tasks[0].updatedAt=new Date(Date.now()+1000).toISOString();return s});await h.adoptReplyArtifact(id,'r1');await h.adoptReplyArtifact(id,'r1')
 check('元数据时间刷新不误报冲突，采纳只保存本地草稿，不改变业务状态',()=>{assert.ok(state().replyDrafts.r1.text);assert.equal(state().replies[0].stage,'待回复');assert.equal(state().tasks[0].status,'ready')})
 await h.mutateWorkbenchState(s=>{s.replyDrafts||={};s.replyDrafts.r2={text:'人工最新修改'};return s})
 await assert.rejects(()=>h.adoptReplyArtifact(id,'r2'),/已变化/);checks++
 await h.enqueueOfficeWorkflow('task_assist',{taskId:task.id});await h.drainWorkflowJobs(ctx)
 check('待办方案关联原始来源且不自动完成业务任务',()=>{assert.equal(last().status,'completed');assert.equal(last().steps[0].input.sources[0].id,'s1');assert.equal(state().tasks[0].status,'ready')})
 await h.enqueueOfficeWorkflow('work_report',{period:'week'});await h.drainWorkflowJobs(ctx)
 check('周报冻结输入范围和上海时区、产物保留依据',()=>{assert.equal(last().status,'completed');assert.equal(last().steps[0].input.timezone,'Asia/Shanghai');assert.equal(last().steps[0].artifact.evidenceIds[0],task.id)})
 await h.enqueueOfficeWorkflow('reply_batch',{replyIds:['r3']});const cancelId=last().id;let release,enteredResolve;const entered=new Promise(r=>enteredResolve=r);onPrompt=async p=>{enteredResolve();await new Promise(r=>release=r);return{text:'不应被采纳',evidenceIds:[p.reply.id]}}
 const draining=h.drainWorkflowJobs(ctx);await entered;await h.controlOfficeWorkflow(cancelId,'cancel');release();await draining
 check('在途取消后迟到模型结果不写产物、不覆盖取消状态',()=>{assert.equal(last().status,'cancelled');assert.equal(last().steps[0].artifact,undefined)})
 onPrompt=null;await h.controlOfficeWorkflow(cancelId,'retry');await h.drainWorkflowJobs(ctx)
 check('取消后可以继续未完成步骤',()=>assert.equal(last().status,'completed'))
 const normalized=h.normalizeState({...state(),jobs:state().jobs.map(j=>({...j,status:'running'}))}).state
 check('启动标准化将作业恢复排队并保留已交付产物',()=>{assert.equal(normalized.jobs.at(-1).status,'queued');assert.ok(normalized.jobs.at(-1).steps[0].artifact)})
 const pack=await api.exportMigration();check('作业及产物进入迁移包',()=>assert.ok(pack.data.jobs.find(j=>j.id===id).steps[0].artifact))
 await h.enqueueOfficeWorkflow('reply_batch',{replyIds:['r3']});const budgetJob=last().id
 await api.saveSettings({aiPolicy:{dailyCallLimit:1}});await h.mutateWorkbenchState(s=>{const row=s.jobs.find(j=>j.id===budgetJob);row.status='queued';row.steps[0].status='pending';delete row.steps[0].artifact;return s});await h.drainWorkflowJobs(ctx)
 check('预算阻断恢复为排队，不消耗业务重试',()=>{assert.equal(last().status,'queued');assert.equal(last().attempts,0);assert.equal(last().steps[0].status,'pending');assert.ok(last().nextRetryAt)})
 console.log('office-workflows: '+checks+' checks passed')
}finally{disposers.forEach(d=>d());rmSync(home,{recursive:true,force:true})}
