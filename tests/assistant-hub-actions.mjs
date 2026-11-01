/** Isolated business state and synthetic tool executions; never sends real messages. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const dir=mkdtempSync(join(tmpdir(),'workbench-hub-actions-'));process.env.DSH_HOME=dir
try{
 await build({stdin:{contents:`export * from './src/host/assistant/assistant-actions.ts';export * from './src/host/assistant/action-store.ts';export * from './src/host/assistant/hub-store.ts';export {taskService} from './src/host/application/task-service.ts';export {knowledgeService} from './src/host/application/knowledge-service.ts';export {sourceService} from './src/host/application/source-service.ts';export {analysisService} from './src/host/application/analysis-service.ts';export {newsService} from './src/host/application/news-service.ts';export {developmentService} from './src/host/application/development-service.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';export {officeToolDefinitions} from './src/host/api/office-tools.ts';export {saveDevelopmentTask} from './src/host/storage/development-store.ts';export {enqueueOfficeWorkflow} from './src/host/workflows/office-jobs.ts';export {mergeAnalysisIntoState} from './src/host/analysis/message-analysis.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:join(dir,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(join(dir,'host.mjs'));let checks=0
 const check=(label,fn)=>{fn();checks++;console.log('✓ '+label)}
 const op=(conversationId,operation,rest={})=>h.runAssistantOperation({}, {conversationId,operation,...rest})
 await h.taskService.createTask({title:'合成待办甲'});await h.taskService.createTask({title:'合成待办乙'});const [a,b]=h.loadWorkbenchState().tasks
 let result=await h.maybeAssistantCommand({}, {conversationId:'task:'+a.id,text:'标记进行中'})
 check('自然指令更新当前待办并保留人工字段保护',()=>{assert.equal(result.status,'ok');const task=h.loadWorkbenchState().tasks[0];assert.equal(task.status,'running');assert.ok(task.humanGuard.editedFields.includes('status'));assert.equal(h.assistantActionEvents('task:'+a.id).filter(e=>e.kind==='user').length,1)})
 result=await op('task:'+a.id,'task.update',{id:b.id,patch:{status:'completed'}})
 check('指定另一待办ID不能穿透事项范围',()=>{assert.equal(result.status,'error');assert.equal(h.loadWorkbenchState().tasks[1].status,'ready')})
 await h.taskService.updateTask(a.id,{description:'通过原任务页补充的进展'})
 check('页面修改写入真实业务历史，供会话回放',()=>assert.ok(h.loadWorkbenchState().changeHistory.some(c=>c.entityId===a.id&&c.after.description==='通过原任务页补充的进展')))
 result=await h.maybeAssistantCommand({}, {conversationId:'task:'+a.id,text:'已经办完了，标记完成'})
 check('明确完成指令直接更新，无需人工再点表单',()=>{assert.equal(result.status,'ok');assert.equal(h.loadWorkbenchState().tasks[0].status,'completed')})
 const discussion=await h.maybeAssistantCommand({}, {conversationId:'task:'+a.id,text:'如果完成后应该怎么处理？'})
 check('讨论含完成字样不误当状态操作',()=>assert.equal(discussion,null))
 await h.knowledgeService.createKnowledge({title:'合成部署说明',body:'旧版本正文',reviewState:'confirmed'});const doc=h.loadWorkbenchState().knowledge[0]
 result=await op('knowledge:'+doc.id,'knowledge.update',{patch:{body:'新版本正文'}});const preview=result
 check('知识修改仅生成差异确认，原文不变',()=>{assert.equal(result.status,'confirmation_required');assert.equal(result.confirmation.before.body,'旧版本正文');assert.equal(result.confirmation.after.body,'新版本正文');assert.equal(h.loadWorkbenchState().knowledge[0].body,'旧版本正文')})
 result=await op('system:knowledge','confirm',{confirmationId:preview.confirmation.id})
 check('另一会话不能消费确认',()=>assert.equal(result.status,'error'))
 result=await op('knowledge:'+doc.id,'confirm',{confirmationId:preview.confirmation.id})
 check('确认后修改真实知识且重新进入待审核',()=>{assert.equal(result.status,'ok');assert.equal(h.loadWorkbenchState().knowledge[0].body,'新版本正文');assert.equal(h.loadWorkbenchState().knowledge[0].reviewState,'candidate')})
 const changes=h.loadWorkbenchState().changeHistory.length;result=await op('knowledge:'+doc.id,'confirm',{confirmationId:preview.confirmation.id})
 check('已消费确认幂等返回，不重复更新',()=>{assert.equal(result.replayed,true);assert.equal(h.loadWorkbenchState().changeHistory.length,changes)})
 result=await op('knowledge:'+doc.id,'knowledge.delete');const stale=result.confirmation
 await h.knowledgeService.updateKnowledge(doc.id,{body:'页面刚刚修改'})
 result=await op('knowledge:'+doc.id,'confirm',{confirmationId:stale.id})
 check('页面修改使旧删除确认失效，不丢人工改动',()=>{assert.equal(result.status,'error');assert.match(result.note,/更新|失效/);assert.equal(h.loadWorkbenchState().knowledge.length,1)})
 const pending=await op('knowledge:'+doc.id,'knowledge.delete');let release,entered;const enteredPromise=new Promise(r=>entered=r),block=h.mutateWorkbenchState(async state=>{entered();await new Promise(r=>release=r);state.knowledge[0].body='排队中的新修改';return state});await enteredPromise
 const racing=op('knowledge:'+doc.id,'confirm',{confirmationId:pending.confirmation.id});release();await block;result=await racing
 check('确认与实际mutation间发生变更也被原子版本校验挡住',()=>{assert.equal(result.status,'error');assert.equal(h.loadWorkbenchState().knowledge[0].body,'排队中的新修改')})
 h.rememberHubSession('system:knowledge','synthetic-knowledge-session','知识库')
 const tool=h.officeToolDefinitions().find(t=>t.name==='workbench_manage_knowledge'),execution={agent:{session:{id:'synthetic-knowledge-session'}}}
 result=await tool.execute({action:'delete',id:doc.id},execution)
 check('模型知识删除工具只能提出预览，确认留在当前固定会话',()=>{assert.equal(result.status,'confirmation_required');assert.equal(result.confirmation.conversationId,'system:knowledge');assert.equal(h.loadWorkbenchState().knowledge.length,1)})
 const actionTool=h.officeToolDefinitions().find(t=>t.name==='workbench_assistant_action')
 await assert.rejects(actionTool.execute({operation:'confirm',confirmationId:result.confirmation.id},execution),/明确确认/);checks++;console.log('✓ 模型不能直接调用确认操作')
 const deleteId=result.confirmation.id;const both=await Promise.all([op('system:knowledge','confirm',{confirmationId:deleteId}),op('system:knowledge','confirm',{confirmationId:deleteId})])
 check('并发双击删除最多一次实际提交',()=>{assert.equal(both.filter(r=>r.status==='ok').length,1);assert.equal(h.loadWorkbenchState().knowledge.length,0)})
 await h.mutateWorkbenchState(s=>{s.sources.push({id:'synthetic-source',provider:'yunzhijia',title:'合成原消息',excerpt:'需要确认的合成消息',sender:'合成发送者',locator:{accountId:'synthetic-account',groupId:'synthetic-group',msgId:'synthetic-msg',groupType:1,direction:'inbound'}});s.replies.push({id:'synthetic-reply',sourceId:'synthetic-source',stage:'待回复',contact:'合成发送者',msgId:'synthetic-msg',accountId:'synthetic-account',groupId:'synthetic-group'});s.replyDrafts={'synthetic-reply':{text:'合成回复正文'}};return s})
 result=await op('reply:synthetic-reply','reply.send');const sendPreview=result.confirmation;let sends=0
 const originalSend=h.sourceService.sendReply;h.sourceService.sendReply=async req=>{sends++;assert.equal(req.text,'合成回复正文');assert.equal(req.confirmed,true);return h.mutateWorkbenchState(s=>{s.replies[0].stage='已回复';return s})}
 check('发送前展示准确目标和正文，尚未发消息',()=>{assert.equal(result.status,'confirmation_required');assert.match(result.confirmation.title,/合成发送者/);assert.equal(result.confirmation.after.text,'合成回复正文');assert.equal(sends,0)})
 const wrongIntent=await h.maybeAssistantCommand({}, {conversationId:'reply:synthetic-reply',text:'确认删除'})
 check('确认动作必须匹配预览，不能把确认删除当成确认发送',()=>{assert.equal(wrongIntent.status,'error');assert.equal(sends,0)})
 const sendResults=await Promise.all([op('reply:synthetic-reply','confirm',{confirmationId:sendPreview.id}),op('reply:synthetic-reply','confirm',{confirmationId:sendPreview.id})])
 check('发送确认防并发重复，状态来自发送服务成功结果',()=>{assert.equal(sends,1);assert.equal(sendResults.filter(r=>r.status==='ok').length,1);assert.equal(h.loadWorkbenchState().replies[0].stage,'已回复')});h.sourceService.sendReply=originalSend
 let starts=0;const originalStart=h.analysisService.analysisStart;h.analysisService.analysisStart=async req=>{starts++;return {jobId:'synthetic-job',note:'按每批 50 条继续',request:req}}
 result=await h.maybeAssistantCommand({}, {conversationId:'system:analysis',text:'刷新进度'})
 check('刷新只读取真实状态，不启动识别',()=>{assert.equal(result.status,'ok');assert.equal(starts,0)})
 result=await h.maybeAssistantCommand({}, {conversationId:'system:analysis',text:'继续识别'});check('继续识别委托已有后台作业',()=>{assert.equal(result.status,'ok');assert.equal(starts,1)})
 result=await op('task:'+a.id,'analysis.continue');check('普通事项不能冒充系统识别会话',()=>{assert.equal(result.status,'error');assert.equal(starts,1)});h.analysisService.analysisStart=originalStart
 h.saveDevelopmentTask({id:'synthetic-dev',issue:{id:'issue',code:'US-SYNTHETIC',title:'合成需求'},status:'paused',stage:'analysis',steps:[],sessionId:'synthetic-dev-session',createdAt:new Date().toISOString()})
 result=await h.maybeAssistantCommand({}, {conversationId:'development:synthetic-dev',text:'标记完成'})
 check('研发不能用普通待办完成指令跳过测试审查',()=>assert.equal(result,null))
 await h.mutateWorkbenchState(s=>{s.projects.push({id:'project-A',name:'合成项目甲'},{id:'project-B',name:'合成项目乙'});s.settings.defaultProjectId='project-B';s.jobs.push({id:'job-B',kind:'task_assist',status:'failed',input:{taskId:b.id},steps:[]});return s})
 await h.knowledgeService.createKnowledge({title:'甲项目知识',body:'甲项目正文',projectId:'project-A',reviewState:'confirmed'});await h.knowledgeService.createKnowledge({title:'乙项目知识',body:'乙项目正文',projectId:'project-B',reviewState:'confirmed'});const docA=h.loadWorkbenchState().knowledge.find(k=>k.title==='甲项目知识'),docB=h.loadWorkbenchState().knowledge.find(k=>k.title==='乙项目知识')
 result=await op('knowledge:'+docA.id,'knowledge.update',{patch:{body:'在条目会话中明确修改甲'}})
 check('知识页明确选定非默认项目条目，可以为该条目准备修改',()=>{assert.equal(result.status,'confirmation_required');assert.equal(result.confirmation.before.id,docA.id)})
 result=await op('knowledge:'+docA.id,'knowledge.update',{id:docB.id,patch:{body:'不可修改乙'}})
 check('明确条目范围不扩大为其它项目知识',()=>assert.equal(result.status,'error'))
 result=await op('system:knowledge','knowledge.update',{id:docA.id,patch:{body:'默认范围不允许修改甲'}})
 check('固定知识会话未选择甲范围时不能修改甲',()=>assert.equal(result.status,'error'))
 result=await op('system:knowledge','knowledge.search',{knowledgeScope:{projectId:'project-A'},query:'项目'})
 check('固定知识会话按显式选择范围搜索',()=>{assert.ok(result.items.some(k=>k.id===docA.id));assert.ok(!result.items.some(k=>k.id===docB.id))})
 h.setHubSessionKnowledgeScope('synthetic-knowledge-session',{projectId:'project-A',accountId:null})
 result=await actionTool.execute({operation:'knowledge.search',query:'项目',knowledgeScope:{projectId:'project-B'}},execution)
 check('工具范围来自真实会话绑定，模型伪造scope不生效',()=>{assert.ok(result.items.some(k=>k.id===docA.id));assert.ok(!result.items.some(k=>k.id===docB.id))})
 result=await op('system:knowledge','knowledge.update',{id:docA.id,knowledgeScope:{projectId:'project-A'},patch:{body:'等待范围确认'}});const scopeConfirm=result.confirmation
 result=await op('system:knowledge','confirm',{confirmationId:scopeConfirm.id,knowledgeScope:{projectId:'project-B'}})
 check('预览后切换知识范围不能确认原范围修改',()=>{assert.equal(result.status,'error');assert.equal(h.loadWorkbenchState().knowledge.find(k=>k.id===docA.id).body,'甲项目正文')})
 result=await op('task:'+a.id,'office.retry',{id:'job-B'})
 check('当前待办不能重试另一待办的办公作业',()=>{assert.equal(result.status,'error');assert.equal(h.loadWorkbenchState().jobs.find(j=>j.id==='job-B').status,'failed')})
 const beforeRead=h.loadWorkbenchState().revision;result=await h.maybeAssistantCommand({}, {conversationId:'development:synthetic-dev',text:'查看进度'})
 check('研发自然查询只读取记录，不绑定工作区或启动流程',()=>{assert.equal(result.status,'ok');assert.equal(h.loadWorkbenchState().revision,beforeRead);assert.equal(result.task.status,'paused')})
 const originalNow=Date.now,fixedNow=Date.now();Date.now=()=>fixedNow
 try{
  let dayId='',weekId='';await h.enqueueOfficeWorkflow('work_report',{period:'day'},id=>{dayId=id});await h.mutateWorkbenchState(s=>{s.jobs.find(j=>j.id===dayId).status='completed';return s})
  await h.enqueueOfficeWorkflow('work_report',{period:'week'},id=>{weekId=id});await h.mutateWorkbenchState(s=>{s.jobs.find(j=>j.id===weekId).status='completed';return s})
  h.rememberOfficeJobOwner(dayId,'chat:synthetic-report-session')
  result=await op('chat:synthetic-report-session','office.start',{kind:'work_report',input:{period:'day'}})
  check('报告会话只关联本次实际复用的作业，不混入其它历史报告',()=>{assert.equal(result.status,'ok');assert.equal(result.jobs.length,1);assert.equal(result.jobs[0].id,dayId);assert.notEqual(dayId,weekId);assert.deepEqual(result.after.jobIds,[dayId]);assert.match(result.note,/完成结果/)})
 }finally{Date.now=originalNow}
 const resultNow=new Date().toISOString()
 await h.mutateWorkbenchState(s=>{
  s.sources.push({id:'result-source',provider:'manual',title:'合成提取消息',excerpt:'原始消息内容保持不变',fetchedAt:resultNow,locator:{accountId:'result-account',groupId:'result-group',msgId:'result-msg',direction:'inbound',sentAt:resultNow}})
  const task=s.tasks.find(t=>t.id===a.id);task.sourceRefId='result-source';task.sourceRefs=[{sourceId:'result-source',msgId:'result-msg'}];task.aiExtracted=true
  s.replies.push({id:'result-reply',sourceId:'result-source',msgId:'result-msg',accountId:'result-account',groupId:'result-group',contact:'原始联系人',snippet:'旧提取摘要',stage:'待回复',taskIds:[a.id],createdAt:resultNow,updatedAt:resultNow,humanGuard:false})
  s.analysisQueue.push({id:'result-entry',sourceId:'result-source',msgId:'result-msg',accountId:'result-account',groupId:'result-group',status:'done',at:resultNow,analyzedAt:resultNow,analysisJobId:'result-job',taskIds:[a.id],analysis:{noise:false,items:[{title:task.title,needsAction:true,relatedTaskId:a.id}]}})
  return s
 })
 const extractionRevision=h.loadWorkbenchState().revision;result=await op('system:analysis','analysis.results',{kind:'all',limit:1})
 check('固定识别会话可分页查看真实已保存结果，查询不改业务数据',()=>{assert.equal(result.status,'ok');assert.equal(result.items.length,1);assert.equal(result.hasMore,true);assert.equal(result.counts.tasks,1);assert.equal(result.counts.replies,1);assert.equal(h.loadWorkbenchState().revision,extractionRevision)})
 result=await op('system:analysis','analysis.results',{kind:'reply',query:'旧提取'})
 check('结果查询可按种类及摘要搜索，并保留原消息来源',()=>{assert.equal(result.items.length,1);assert.equal(result.items[0].id,'result-reply');assert.equal(result.items[0].sourceText,'原始消息内容保持不变')})
 result=await h.maybeAssistantCommand({}, {conversationId:'system:analysis',text:'查看提取结果'})
 check('自然指令查看结果直接返回真实提取记录，不发起新识别',()=>{assert.equal(result.status,'ok');assert.equal(result.total,2);assert.equal(h.loadWorkbenchState().revision,extractionRevision)})
 result=await h.maybeAssistantCommand({}, {conversationId:'system:analysis',text:'这次提取了什么'})
 check('没有逐轮关联时明确提示，不能把全部历史冒充本轮',()=>{assert.equal(result.status,'error');assert.match(result.note,/尚无可关联的识别轮次/)})
 await h.mutateWorkbenchState(s=>{s.jobs.push({id:'result-job',kind:'analysis',status:'completed',createdAt:'2030-01-01T00:00:00Z',input:{}});return s})
 result=await h.maybeAssistantCommand({}, {conversationId:'system:analysis',text:'查看本轮提取结果'})
 check('本轮提取结果按最新真实识别作业筛选',()=>{assert.equal(result.status,'ok');assert.equal(result.runId,'result-job');assert.equal(result.total,2)})
 await h.mutateWorkbenchState(s=>{s.jobs.push({id:'new-empty-result-job',kind:'analysis',status:'completed',createdAt:'2030-01-02T00:00:00Z',input:{}});return s})
 result=await h.maybeAssistantCommand({}, {conversationId:'system:analysis',text:'这次提取了什么'})
 check('最新轮没有落库结果时返回零，不回填之前轮次的事项',()=>{assert.equal(result.status,'ok');assert.equal(result.runId,'new-empty-result-job');assert.equal(result.total,0)})
 h.rememberHubSession('system:analysis','synthetic-analysis-session','消息识别')
 result=await actionTool.execute({operation:'analysis.results',kind:'task',conversationId:'task:'+b.id},{agent:{session:{id:'synthetic-analysis-session'}}})
 check('模型通过固定识别会话工具读取结果，不能伪造conversationId',()=>{assert.equal(result.status,'ok');assert.equal(result.items[0].id,a.id);assert.equal(result.items[0].kind,'task')})
 result=await op('task:'+a.id,'analysis.updateResult',{kind:'task',id:a.id,patch:{title:'不可越界修正'}})
 check('修改提取结果仅允许固定消息识别会话',()=>assert.equal(result.status,'error'))
 result=await op('system:analysis','analysis.updateResult',{kind:'task',id:b.id,patch:{status:'completed'}})
 check('非提取来源关联待办不能通过系统会话修改',()=>{assert.equal(result.status,'error');assert.equal(h.loadWorkbenchState().tasks.find(t=>t.id===b.id).status,'ready')})
 result=await op('system:analysis','analysis.updateResult',{kind:'task',id:a.id,patch:{title:'人工修正提取标题',description:'人工修正描述',status:'running',dueAt:'2030-01-02T10:00:00+08:00'}})
 check('固定识别会话直接修改原待办并保护字段，不创建副本',()=>{assert.equal(result.status,'ok');assert.equal(result.item.id,a.id);assert.equal(result.item.title,'人工修正提取标题');assert.ok(result.item.humanGuard.editedFields.includes('title'));assert.ok(result.item.humanGuard.editedFields.includes('dueAt'));assert.equal(h.loadWorkbenchState().tasks.length,2);assert.equal(result.before.title,'合成待办甲')})
 result=await op('system:analysis','analysis.updateResult',{kind:'reply',id:'result-reply',patch:{snippet:'人工修正待回复摘要',stage:'不需回复'}})
 check('固定识别会话修正待回复摘要/阶段并留人工保护，原消息与收件人不变',()=>{assert.equal(result.status,'ok');assert.equal(result.item.snippet,'人工修正待回复摘要');assert.equal(result.item.stage,'不需回复');assert.equal(result.item.humanGuard,true);assert.equal(result.item.contact,'原始联系人');assert.equal(h.loadWorkbenchState().sources.find(s=>s.id==='result-source').excerpt,'原始消息内容保持不变')})
 result=await op('system:analysis','analysis.updateResult',{kind:'reply',id:'result-reply',patch:{contact:'另一个人'}})
 check('识别修正不得更改收件人或发送定位',()=>assert.equal(result.status,'error'))
 await h.mutateWorkbenchState(s=>{const entry=s.analysisQueue.find(e=>e.id==='result-entry');h.mergeAnalysisIntoState(s,entry,{noise:false,items:[{title:'模型试图重写的标题',needsAction:true,needsReply:true,relatedTaskId:a.id,relatedReplyId:'result-reply',replyStage:'已确认收到',dueAt:'2035-01-01T00:00:00Z'}]},{forceCreate:true});return s})
 check('同一来源重识别保留人工修正的待办和待回复',()=>{const task=h.loadWorkbenchState().tasks.find(t=>t.id===a.id),reply=h.loadWorkbenchState().replies.find(r=>r.id==='result-reply');assert.equal(task.title,'人工修正提取标题');assert.equal(task.description,'人工修正描述');assert.equal(task.status,'running');assert.equal(task.dueAt,'2030-01-02T02:00:00.000Z');assert.equal(reply.snippet,'人工修正待回复摘要');assert.equal(reply.stage,'不需回复')})
 let releaseAssociation,associationEntered;const associationReady=new Promise(r=>associationEntered=r),associationChange=h.mutateWorkbenchState(async s=>{associationEntered();await new Promise(r=>releaseAssociation=r);s.analysisQueue=s.analysisQueue.filter(e=>e.id!=='result-entry');return s});await associationReady
 const staleEdit=op('system:analysis','analysis.updateResult',{kind:'task',id:a.id,patch:{title:'失效来源不能修改'}});releaseAssociation();await associationChange;result=await staleEdit
 check('实际提交时来源关联已变化则拒绝修正，保留现有内容',()=>{assert.equal(result.status,'error');assert.equal(h.loadWorkbenchState().tasks.find(t=>t.id===a.id).title,'人工修正提取标题')})
 check('操作与失败记录已持久化，可在页面恢复后追溯',()=>{const stored=JSON.parse(readFileSync(join(dir,'storages/dev-workbench/assistant-actions.json'),'utf8'));assert.ok(stored.events.some(e=>e.status==='error'));assert.ok(stored.events.some(e=>e.kind==='user'&&e.text==='继续识别'));assert.ok(stored.confirmations.some(c=>c.state==='completed'))})
 console.log('assistant-hub-actions: '+checks+' scenarios passed')
}finally{rmSync(dir,{recursive:true,force:true})}
