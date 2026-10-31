/** Real batch prompts, source isolation and durable session reuse. Never touches the live profile. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-batch-'));process.env.DSH_HOME=home
const bundle=join(home,'host.mjs')
await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';export {runAnalysisBatch,waitStructuredReply,buildAnalysisPacket,decodeAnalysisBatch,ANALYSIS_BATCH_PROTOCOL} from './src/host/analysis/message-analysis.ts';export {ensureBackgroundSession,backgroundSessionKey,listAssistantSessions,isWorkbenchBackgroundSession} from './src/host/assistant/sessions.ts';export {normalizeState} from './src/host/domain/model.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:bundle,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const host=await import(bundle),sessions=new Map(),disposers=[],prompts=[],renames=[]
let api,guard,creates=0,onPrompt=null,checks=0
function session(id){const events=[];return {id,events,get seq(){return events.length},snapshotEvents(from=0){return events.filter(e=>e.seq>from)}}}
function emit(target,text){target.events.push({type:'assistant/message',seq:target.seq+1,data:{message:{content:[{type:'text',text}]}}},{type:'turn/end',seq:target.seq+2,data:{}})}
const controller={
 create:async()=>{const row=session('durable-batch-'+(++creates));sessions.set(row.id,row);return {sessionId:row.id}},
 rename:async request=>renames.push(request),state:async({sessionId})=>({cursor:sessions.get(sessionId)?.seq||0,running:false}),
 prompt:async request=>{const text=request.content[0].text,packet=JSON.parse(text.split('\n').at(-1));prompts.push({sessionId:request.sessionId,text,packet});const row=sessions.get(request.sessionId);row.events.push({type:'user/message',seq:row.seq+1,data:{content:request.content}},{type:'turn/start',seq:row.seq+2,data:{}});const out=onPrompt?await onPrompt(packet,request):{batchId:packet.batchId,results:packet.messages.map(m=>({sourceId:m.sourceId,analysis:{noise:true,items:[]}}))};emit(row,typeof out==='string'?out:JSON.stringify(out));return{accepted:true}},cancel:async()=>{}
}
const services={sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]},sessionController:controller}
const ctx={provide:(name,value)=>{if(name==='workbench')api=value},get:name=>services[name],inject:(deps,fn)=>{if(deps.includes('tools'))fn({tools:{register:()=>()=>{},guard:fn=>{guard=fn;return()=>{}}}})},effect:fn=>{const cleanup=fn();if(typeof cleanup==='function')disposers.push(cleanup)},logger:{info(){}}}
host.apply(ctx,{})
const state=()=>host.loadWorkbenchState()
function check(label,fn){fn();checks++;console.log('✓',label)}
let sourceSeq=0
async function add(text='消息仅供参考',options={}){
 const n=++sourceSeq,id='source-batch-'+n,msgId='msg-batch-'+n,at=new Date(Date.now()-600000+n*1000).toISOString()
 const source={id,provider:'yunzhijia',selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:null,observedAt:new Date().toISOString()},externalId:msgId,title:text,excerpt:text,fetchedAt:at,projectId:null,locator:{accountId:'account-A',groupId:'group-A',msgId,sentAt:at,direction:'inbound',intake:true,...options}}
 const entry={id:'entry-batch-'+n,sourceId:id,msgId,accountId:source.locator.accountId,groupId:source.locator.groupId,status:'pending',attempts:0}
 await host.mutateWorkbenchState(s=>{s.sources.push(source);s.analysisQueue.push(entry);return s});return {source,entry}
}
const run=rows=>host.runAnalysisBatch(ctx,{onlyIds:rows.map(row=>row.entry.id),limit:20})
const envelope=(packet,analyses)=>({batchId:packet.batchId,results:packet.messages.map((m,i)=>({sourceId:m.sourceId,analysis:analyses[i]}))})
try{
 await api.snapshot();await api.saveSettings({aiExtract:{enabled:true,autoRegister:true,batchSize:5},assistantSessionId:'human-chat-preserved'})
 const first=[];for(let i=0;i<5;i++)first.push(await add())
 const initial=await run(first),initialSession=prompts[0].sessionId
 check('5条消息仅1次模型调用，创建1个持久化会话',()=>{assert.equal(initial.processed,5);assert.equal(prompts.length,1);assert.equal(creates,1);assert.equal(initial.modelCalls,1);assert.ok(prompts[0].text.startsWith('工作台消息批处理协议'))})
 const next=await add(),second=await run([next]),p2=prompts.at(-1)
 check('后续批次复用会话，只发增量且不重复规则和已见上下文',()=>{assert.equal(p2.sessionId,initialSession);assert.equal(creates,1);assert.ok(p2.text.startsWith('{'));assert.equal(p2.packet.conversations[0].contextDelta.length,0);assert.equal(second.ruleInitializations,0);assert.equal(second.reusedBatches,1);assert.ok(p2.text.length<prompts[0].text.length/2)})
 for(let i=0;i<7;i++)await run([await add()])
 check('超过6轮仍使用原会话，没有固定轮数重建',()=>{assert.equal(creates,1);assert.equal(new Set(prompts.map(p=>p.sessionId)).size,1);assert.equal(state().settings.assistantSessionId,'human-chat-preserved')})
 const assignment=await add('请完成接口开发，完成后回复'),ack=await add('收到，我来处理',{direction:'outbound',intake:false,replyToMsgId:assignment.source.locator.msgId}),answer=await add('接口已完成并已提交测试',{direction:'outbound',intake:false,replyToMsgId:assignment.source.locator.msgId})
 onPrompt=packet=>envelope(packet,[{noise:false,items:[{title:'接口开发',needsAction:true,needsReply:true,evidence:assignment.source.excerpt}]},{noise:false,items:[{title:'收到',needsAction:false,needsReply:false,relatedTaskId:'@task:'+assignment.source.id+':0',relatedReplyId:'@reply:'+assignment.source.id+':0',replyStage:'已确认收到'}]},{noise:false,items:[{title:'开发完成',needsAction:false,needsReply:false,relatedTaskId:'@task:'+assignment.source.id+':0',relatedReplyId:'@reply:'+assignment.source.id+':0',replyStage:'已实质答复',completed:true,evidence:answer.source.excerpt}]}])
 const linked=await run([answer,assignment,ack]);const task=state().tasks.find(t=>t.sourceRefId===assignment.source.id),reply=state().replies.find(r=>r.sourceId===assignment.source.id)
 check('同批交办和答复按原时间关联，仅1任务1回复且任务不随聊天完成',()=>{assert.equal(linked.processed,3);assert.equal(linked.modelCalls,1);assert.equal(state().tasks.length,1);assert.equal(state().replies.length,1);assert.equal(task.status,'ready');assert.equal(reply.stage,'已回复');assert.ok(reply.taskIds.includes(task.id))})
 onPrompt=null;await api.updateTask(task.id,{title:'人工保留标题'});await run([await add('请同步进展')]);
 check('每批携带最新Host事项快照，包含人工改动',()=>assert.equal(prompts.at(-1).packet.conversations[0].tasks.find(t=>t.id===task.id).title,'人工保留标题'))
 const a=await add(),b=await add();onPrompt=packet=>({batchId:packet.batchId,results:[{sourceId:b.source.id,analysis:{noise:false,items:[{title:'仅需答复',needsReply:true,needsAction:false}]}},{sourceId:a.source.id,analysis:{noise:true,items:[]}}]});await run([a,b]);
 check('模型结果乱序仍按sourceId准确写回',()=>{assert.equal(state().analysisQueue.find(e=>e.id===a.entry.id).analysis.noise,true);assert.equal(state().replies.find(r=>r.sourceId===b.source.id).snippet,b.source.excerpt)})
 const missing1=await add(),missing2=await add();onPrompt=packet=>({batchId:packet.batchId,results:[{sourceId:missing1.source.id,analysis:{noise:true,items:[]}}]});const omitted=await run([missing1,missing2]);
 check('漏掉一条结果仅该条失败，不吞消息也不重跑成功条目',()=>{assert.equal(omitted.processed,1);assert.equal(omitted.failures,1);assert.equal(state().analysisQueue.find(e=>e.id===missing2.entry.id).status,'failed')})
 const invalid1=await add(),invalid2=await add();onPrompt=packet=>envelope(packet,[{noise:true,items:[]},{noise:false,items:[{title:'x',needsReply:'yes',needsAction:false}]}]);const invalid=await run([invalid1,invalid2]);
 check('单条结构无效隔离失败，其他条目正常提交',()=>{assert.equal(invalid.processed,1);assert.equal(invalid.failures,1)})
 for(const kind of ['duplicate','unknown','batchId']){
  const rows=[await add(),await add()];let calls=0;onPrompt=packet=>{calls++;const out=envelope(packet,packet.messages.map(()=>({noise:true,items:[]})));if(calls===1){if(kind==='duplicate')out.results.push(out.results[0]);if(kind==='unknown')out.results[0].sourceId='foreign-source';if(kind==='batchId')out.batchId='wrong-batch'}return out};const repaired=await run(rows)
  check('协议异常'+kind+'只在同会话修复1次',()=>{assert.equal(calls,2);assert.equal(repaired.processed,2);assert.equal(new Set(prompts.slice(-2).map(p=>p.sessionId)).size,1);assert.ok(prompts.at(-1).text.includes('工作台消息批处理协议'));assert.ok(prompts.at(-1).text.startsWith('上一轮输出未通过'))})
 }
 const rulesChanged=await add();await host.mutateWorkbenchState(s=>{s.backgroundThreads[host.backgroundSessionKey('analysis','account-A')].rulesHash='old-rules';return s});onPrompt=null;const rulesSession=prompts.at(-1).sessionId;const rulesRefreshed=await run([rulesChanged]);check('规则版本变化仅在原会话重发规则，不新建会话',()=>{assert.equal(rulesRefreshed.ruleInitializations,1);assert.equal(prompts.at(-1).sessionId,rulesSession);assert.deepEqual(prompts.at(-1).packet.messages[0].selectionReasons,['mention_me'])})
 const malformed=[await add(),await add()];let malformedCalls=0;onPrompt=packet=>{malformedCalls++;const out=envelope(packet,packet.messages.map(()=>({noise:true,items:[]})));return malformedCalls===1?JSON.stringify(out).slice(0,-2):out};const fixed=await run(malformed)
 check('JSON缺少闭合符时同会话提供明确修复指令，最多一次后完整提交',()=>{assert.equal(malformedCalls,2);assert.equal(fixed.processed,2);assert.ok(prompts.at(-1).text.includes('逐项闭合analysis对象'));assert.equal(prompts.at(-1).sessionId,prompts.at(-2).sessionId)})
 const badFrame=[await add(),await add()];let badCalls=0;onPrompt=()=>{badCalls++;return{batchId:'foreign',results:[]}};const rejected=await run(badFrame)
 check('持续错批次最多2次请求，全部保留失败并释放租约',()=>{assert.equal(badCalls,2);assert.equal(rejected.failures,2);assert.ok(badFrame.every(r=>{const e=state().analysisQueue.find(e=>e.id===r.entry.id);return e.status==='failed'&&!e.leaseUntil}))})
 onPrompt=null;const differentAccount=await add('另一账号消息',{accountId:'account-B'}),sameAccount=await add();const isolated=await run([differentAccount,sameAccount]);
 check('不同账号分批且使用不同持久会话，相同群ID也隔离',()=>{assert.equal(isolated.modelCalls,2);assert.equal(creates,2);assert.notEqual(prompts.at(-2).sessionId,prompts.at(-1).sessionId);assert.notEqual(prompts.at(-2).packet.messages[0].conversation,prompts.at(-1).packet.messages[0].conversation)})
 const otherGroup=await add('第二群交办',{groupId:'group-B'}),cross=await add('跨群错误关联',{groupId:'group-A'});onPrompt=packet=>envelope(packet,[{noise:false,items:[{title:'第二群业务',needsAction:true,needsReply:false}]},{noise:false,items:[{title:'错误关联',needsAction:true,needsReply:false,relatedTaskId:'@task:'+otherGroup.source.id+':0'}]}]);const crossResult=await run([otherGroup,cross])
 check('同账号合批仍拒绝跨聊天的本批事项引用',()=>{assert.equal(crossResult.processed,1);assert.equal(crossResult.failures,1);assert.ok(!state().tasks.some(t=>t.sourceRefId===cross.source.id))})
 const stale1=await add(),stale2=await add();onPrompt=async packet=>{await host.mutateWorkbenchState(s=>{s.sources.find(row=>row.id===stale2.source.id).excerpt='消息内容已编辑';return s});return envelope(packet,packet.messages.map(()=>({noise:true,items:[]})))};await run([stale1,stale2]);
 check('模型等待期间消息被编辑，旧结果不得提交且不增加失败次数',()=>{const e=state().analysisQueue.find(e=>e.id===stale2.entry.id);assert.equal(e.status,'pending');assert.equal(e.attempts,0);assert.equal(e.leaseUntil,null)})
 onPrompt=null;const model=sessions.get(initialSession);model.events.push({type:'compaction/end',seq:model.seq+1,data:{}});const compacted=await run([await add()]);
 check('宿主压缩会话后在同会话补齐规则和上下文',()=>{assert.equal(prompts.at(-1).sessionId,initialSession);assert.ok(prompts.at(-1).text.includes('工作台消息批处理协议'));assert.equal(compacted.ruleInitializations,1);assert.ok(prompts.at(-1).packet.conversations[0].contextDelta.length>0)})
 const busy=await add();model.events.push({type:'turn/start',seq:model.seq+1,data:{}});const promptBefore=prompts.length,createBefore=creates;const busyResult=await run([busy]);
 check('活动会话保持排队，无新会话或请求，释放租约且不烧重试',()=>{assert.equal(busyResult.status,'busy');assert.equal(prompts.length,promptBefore);assert.equal(creates,createBefore);const e=state().analysisQueue.find(e=>e.id===busy.entry.id);assert.equal(e.status,'pending');assert.equal(e.attempts,0);assert.equal(e.leaseUntil,null)})
 model.events.push({type:'turn/end',seq:model.seq+1,data:{}})
 // Cold registry: public state gives durable cursor; prompt lazily resumes that same ID.
 sessions.delete(initialSession);const originalState=controller.state,originalPrompt=controller.prompt;controller.state=async({sessionId})=>({cursor:sessionId===initialSession?model.seq:0,running:false});controller.prompt=async request=>{if(request.sessionId===initialSession)sessions.set(initialSession,model);return originalPrompt(request)};
 await run([busy]);
 check('冷启动通过持久化cursor续用原会话，首轮无需新建',()=>{assert.equal(prompts.at(-1).sessionId,initialSession);assert.equal(creates,createBefore);assert.equal(state().analysisQueue.find(e=>e.id===busy.entry.id).status,'done')})
 controller.state=originalState;controller.prompt=originalPrompt
 let lost=true;controller.prompt=async request=>{if(lost){lost=false;throw Error('SessionPersistenceNotFound resume failed')}return originalPrompt(request)};const lostRow=await add();await run([lostRow]);const recoveredSession=prompts.at(-1).sessionId
 check('真实会话丢失才重建，并补发完整规则和上下文',()=>{assert.notEqual(recoveredSession,initialSession);assert.ok(prompts.at(-1).text.includes('工作台消息批处理协议'));assert.equal(state().settings.assistantSessionId,'human-chat-preserved');assert.ok(state().backgroundSessionIds.includes(initialSession));assert.ok(state().backgroundSessionIds.includes(recoveredSession))})
 controller.prompt=originalPrompt
 const list=await host.listAssistantSessions(ctx,{});
 check('助手选择器隐藏所有后台会话，旧历史也受工具禁用保护',()=>{assert.equal(list.sessions.length,0);assert.match(guard({agent:{session:model}}),/禁止执行工具/);assert.match(guard({agent:{session:sessions.get(recoveredSession)}}),/禁止执行工具/)})
 onPrompt=null
 const historyError="400 Missing required parameter: 'messages[66].reasoning_content'. This model needs the reasoning of every earlier assistant message"
 let historyCalls=0;const normalPrompt=controller.prompt
 const beforeHistory=state().backgroundThreads[host.backgroundSessionKey('analysis','account-A')].sessionId
 controller.prompt=async request=>{historyCalls++;if(historyCalls===1)throw Error(historyError);return normalPrompt(request)}
 const historyRow=await add();const historyRun=await run([historyRow]);const afterHistory=state().backgroundThreads[host.backgroundSessionKey('analysis','account-A')].sessionId
 check('提交阶段推理历史不兼容仅恢复一次，补全规则与快照且不改变人工会话',()=>{assert.equal(historyCalls,2);assert.equal(historyRun.processed,1);assert.notEqual(afterHistory,beforeHistory);assert.equal(state().settings.assistantSessionId,'human-chat-preserved');assert.ok(prompts.at(-1).text.includes('工作台消息批处理协议'));assert.ok(state().backgroundSessionIds.includes(beforeHistory));assert.equal(state().analysisQueue.find(e=>e.id===historyRow.entry.id).attempts,0)})
 controller.prompt=normalPrompt;const reuseBefore=creates;await run([await add()]);check('兼容恢复成功后继续复用新会话，不逐批重建',()=>assert.equal(creates,reuseBefore))
 let eventCalls=0;controller.prompt=async request=>{eventCalls++;if(eventCalls===1){const target=sessions.get(request.sessionId);target.events.push({type:'turn/start',seq:target.seq+1,data:{}},{type:'turn/end',seq:target.seq+2,data:{reason:{kind:'error',error:{message:'provider metadata '.repeat(30)+historyError}}}});return{accepted:true}}return normalPrompt(request)}
 const eventRecovered=await run([await add()]);check('异步轮次错误保留200字符后的reasoning字段并恢复',()=>{assert.equal(eventCalls,2);assert.equal(eventRecovered.processed,1)})
 for(const shape of ['nested-turn-error','string-turn-end']){
  let calls=0;
  const payload=JSON.stringify({message:JSON.stringify({error:{message:"Missing required parameter: 'messages[5].reasoning_content'. This model needs the reasoning of every earlier assistant message",type:'AI_APICallError'}}),type:'invalid_request_error'});
  controller.prompt=async request=>{calls++;if(calls===1){const target=sessions.get(request.sessionId);target.events.push({type:'turn/start',seq:target.seq+1,data:{}},shape==='nested-turn-error'?{type:'turn/error',seq:target.seq+2,data:{message:'request failed',error:{cause:{message:payload}}}}:{type:'turn/end',seq:target.seq+2,data:{reason:{kind:'error',error:payload}}});return{accepted:true}}return normalPrompt(request)};
  const row=await add(),result=await run([row]);
  check('推理历史错误形态 '+shape+' 保留原因并只恢复一次',()=>{assert.equal(calls,2);assert.equal(result.processed,1);assert.equal(state().analysisQueue.find(e=>e.id===row.entry.id).attempts,0);assert.equal(state().settings.assistantSessionId,'human-chat-preserved')});
 }
 let persistentCalls=0;controller.prompt=async()=>{persistentCalls++;throw Error(historyError)};const persistent=await add();const persistentResult=await run([persistent]);
 check('恢复后仍缺推理内容停止本批并退避，不无限建会话或消耗业务次数',()=>{assert.equal(persistentCalls,2);assert.equal(persistentResult.status,'deferred');assert.equal(persistentResult.failures,0);const row=state().analysisQueue.find(e=>e.id===persistent.entry.id);assert.equal(row.status,'pending');assert.equal(row.attempts,0);assert.equal(row.leaseUntil,null)})
 controller.prompt=normalPrompt;await host.mutateWorkbenchState(s=>{delete s.modelHealth.analysis;return s})
 let ordinaryCalls=0;controller.prompt=async()=>{ordinaryCalls++;throw Error('400 invalid temperature')};const ordinaryCreates=creates;await run([await add()]);check('普通400错误不触发历史重建',()=>{assert.equal(ordinaryCalls,1);assert.equal(creates,ordinaryCreates)})
 controller.prompt=normalPrompt
 const staleSummary=await host.ensureBackgroundSession(ctx,'summary');let summaryCalls=0
 const summaryPrompt=JSON.stringify({protocol:'awb-message-batch-v2',batchId:'summary-fixture',messages:[],conversations:[]})
 controller.prompt=async request=>{summaryCalls++;if(summaryCalls===1)throw Error(historyError);return normalPrompt(request)}
 await host.waitStructuredReply(ctx,controller,staleSummary,summaryPrompt,10000,'summary')
 const newSummaryId=state().settings.summarySessionId,summaryCreates=creates
 await host.waitStructuredReply(ctx,controller,staleSummary,summaryPrompt,10000,'summary')
 check('摘要恢复后同批下一篇会切换到新会话，不继续提交旧历史',()=>{assert.notEqual(newSummaryId,staleSummary.id);assert.equal(creates,summaryCreates);assert.equal(prompts.at(-1).sessionId,newSummaryId);assert.equal(summaryCalls,3)})
 controller.prompt=normalPrompt
 const twenty=[];for(let i=0;i<20;i++)twenty.push(await add('批量20条消息',{accountId:'account-twenty'}));const twentyBefore=prompts.length;const twentyResult=await run(twenty)
 check('20条配置上限同账号可合成1次模型请求',()=>{assert.equal(twentyResult.processed,20);assert.equal(prompts.length-twentyBefore,1);assert.equal(prompts.at(-1).packet.messages.length,20)})
 const longRows=[];for(let i=0;i<10;i++)longRows.push(await add('长消息'+i+'正文'.repeat(3000),{accountId:'account-long'}));const longBefore=prompts.length;const longResult=await run(longRows);const longPrompts=prompts.slice(longBefore)
 check('长内容按请求大小拆批，原消息不截断且仍复用1个会话',()=>{assert.equal(longResult.processed,10);assert.ok(longPrompts.length>1);assert.equal(new Set(longPrompts.map(p=>p.sessionId)).size,1);assert.ok(longPrompts.every(p=>p.text.length<=40000));assert.equal(longPrompts.flatMap(p=>p.packet.messages).length,10);assert.ok(longPrompts.flatMap(p=>p.packet.messages).every(m=>m.text.length>6000))})
 const contextTarget=await add('需要重新识别上下文',{accountId:'account-A'});await host.mutateWorkbenchState(s=>{s.sources.find(row=>row.id===busy.source.id).excerpt='编辑后的上下文';return s});await run([contextTarget]);
 check('已缓存上下文发生编辑时按指纹重新发送',()=>assert.ok(prompts.at(-1).packet.conversations[0].contextDelta.some(row=>row.sourceId===busy.source.id&&row.text==='编辑后的上下文')))
 const noNewBefore=creates,promptCount=prompts.length;await host.mutateWorkbenchState(s=>{for(const row of s.analysisQueue)row.status='done';return s});await host.runAnalysisBatch(ctx,{})
 check('空队列不建会话、不发模型请求',()=>{assert.equal(creates,noNewBefore);assert.equal(prompts.length,promptCount)})
 check('会话状态、增量缓存和批次指标可持久恢复，迁移不导出宿主会话',()=>{const normalized=host.normalizeState(state()).state;assert.ok(normalized.backgroundThreads[host.backgroundSessionKey('analysis','account-A')]);assert.ok(normalized.lastAnalysisBatch);assert.ok(normalized.backgroundSessionIds.includes(initialSession))})
 const migration=await api.exportMigration({includeSettings:true});check('迁移包不携带宿主会话或增量缓存',()=>{assert.ok(!('backgroundThreads' in migration.data));assert.ok(!('backgroundSessionIds' in migration.data));assert.ok(!migration.data.settings?.analysisSessionId)})
 const broadcast=await add('@all 15:30，A303，月度质量星期四，请大家安排参加。');await host.mutateWorkbenchState(s=>{s.backgroundThreads[host.backgroundSessionKey('analysis','account-A')].protocol='awb-message-batch-v2';return s})
 onPrompt=packet=>envelope(packet,[{noise:false,items:[{title:'参加月度质量星期四',needsReply:false,needsAction:true,eventType:'meeting',meetingStart:'2026-10-29T07:30:00Z',meetingLocation:'A303',evidence:broadcast.source.excerpt}]}]);await run([broadcast]);
 check('@all参会通知可创建会议待办而无需回复，旧持久会话自动补发新规则',()=>{const meeting=state().tasks.find(row=>row.sourceRefId===broadcast.source.id);assert.ok(meeting);assert.equal(meeting.eventType,'meeting');assert.equal(meeting.meetingLocation,'A303');assert.equal(meeting.meetingStart,'2026-10-29T07:30:00.000Z');assert.ok(!state().replies.some(row=>row.sourceId===broadcast.source.id));assert.match(prompts.at(-1).text,/群内 @all/);assert.equal(prompts.at(-1).packet.protocol,host.ANALYSIS_BATCH_PROTOCOL)})
 const privateHead=await add('代码记得提交',{groupId:'private-priority',groupType:1});await host.mutateWorkbenchState(s=>{const source=s.sources.find(x=>x.id===privateHead.source.id);source.selection.reasons=['unread'];s.syncCursors['account-A:private-priority']={accountId:'account-A',intakePolicy:'focused-v1',resumeBefore:'older-history'};s.syncCursors['__pending:account-A']={pendingGroups:[{groupId:'private-priority'}]};s.messageInbox={accountId:'account-A',conversations:[{groupId:'private-priority',groupType:1,unreadCount:2,latestDirection:'inbound',latestMsgId:source.locator.msgId,latestSentAt:source.locator.sentAt}]};return s});onPrompt=packet=>envelope(packet,[{noise:false,items:[{title:'提交代码',needsAction:true,needsReply:false,eventType:'feature'}]}]);const promptBeforeHead=prompts.length;const headResult=await run([privateHead]);check('可信最新未读私聊无需等待同会话历史补齐即可识别并建待办',()=>{assert.equal(headResult.processed,1);assert.equal(prompts.length,promptBeforeHead+1);assert.ok(state().tasks.some(t=>t.sourceRefId===privateHead.source.id&&t.title==='提交代码'));assert.ok(!state().replies.some(r=>r.sourceId===privateHead.source.id&&r.stage==='待回复'))})
 console.log(`batch-analysis: ${checks} scenarios passed`)
}finally{for(const dispose of disposers.reverse())dispose();rmSync(home,{recursive:true,force:true})}
