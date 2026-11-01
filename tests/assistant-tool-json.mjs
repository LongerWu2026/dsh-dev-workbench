/** Host lossless-JSON contract against real service outputs; isolated profile, no native model or sends. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-tool-json-'));process.env.DSH_HOME=home
let checks=0
const check=(label,fn)=>{fn();checks++;console.log('✓ '+label)},json=value=>JSON.parse(JSON.stringify(value))
try{
 await build({stdin:{contents:`export {officeToolDefinitions} from './src/host/api/office-tools.ts';export {analysisService} from './src/host/application/analysis-service.ts';export {taskService} from './src/host/application/task-service.ts';export {knowledgeService} from './src/host/application/knowledge-service.ts';export {maybeAssistantCommand} from './src/host/assistant/assistant-actions.ts';export {rememberHubSession} from './src/host/assistant/hub-store.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(join(home,'host.mjs')),definitions=h.officeToolDefinitions(),tool=name=>definitions.find(row=>row.name===name),action=tool('workbench_assistant_action')
 await h.mutateWorkbenchState(s=>{s.jobs.push({id:'analysis-optional-fields',kind:'analysis',status:'completed',input:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),attempts:0,result:{status:'ok',processed:0}},{id:'office-optional-fields',kind:'work_report',status:'completed',input:{},createdAt:new Date().toISOString(),attempts:0,steps:[{id:'step-1',status:'completed'}]});return s})
 const raw=await h.analysisService.analysisStatus()
 check('真实analysisStatus回执复现可选字段undefined，未清理会违反宿主lossless JSON',()=>{assert.ok(Object.hasOwn(raw.jobs[0],'error'));assert.equal(raw.jobs[0].error,undefined);assert.ok(Object.hasOwn(raw.jobs[0].result,'failures'));assert.throws(()=>assert.deepEqual(raw,json(raw)))})
 const session={id:'json-analysis-native',snapshotEvents:()=>[]};h.rememberHubSession('system:analysis',session.id,'消息识别')
 const beforeState=json(h.loadWorkbenchState()),result=await action.execute({operation:'analysis.status'},{agent:{session}}),{text,...payload}=result
 check('标准助手工具返回严格JSON值，text和结构化payload保持同一结果',()=>{assert.deepEqual(result,json(result));assert.deepEqual(JSON.parse(text),payload);assert.deepEqual(result.progress,json(raw));assert.equal(result.status,'ok');assert.equal(result.operation,'analysis.status');assert.ok(!Object.hasOwn(result.progress.jobs[0],'error'));assert.deepEqual(json(h.loadWorkbenchState()),beforeState)})
 const error=await action.execute({operation:'analysis.updateResult',kind:'task',id:'does-not-exist',patch:{title:'不会写入'}},{agent:{session}})
 check('业务失败状态和真实原因不被JSON清理改成成功',()=>{assert.equal(error.status,'error');assert.match(error.note,/不存在|找不到|不是|没有/);assert.deepEqual(error,json(error));const{text,...payload}=error;assert.deepEqual(JSON.parse(text),payload)})
 await h.taskService.createTask({title:'JSON边界待办'});const task=h.loadWorkbenchState().tasks[0],taskConversation='task:'+task.id
 const rule=await h.maybeAssistantCommand({}, {conversationId:taskConversation,text:'标记进行中'})
 check('规则动作保留原before/after和人工修改语义，不受工具出口副本影响',()=>{assert.equal(rule.status,'ok');assert.equal(rule.before.status,'ready');assert.equal(rule.after.status,'running');assert.equal(rule.item.id,task.id);assert.ok(rule.after.humanGuard.editedFields.includes('status'))})
 const taskSession={id:'json-task-native',snapshotEvents:()=>[]};h.rememberHubSession(taskConversation,taskSession.id,'待办')
 const changed=await action.execute({operation:'task.update',patch:{status:'completed'}},{agent:{session:taskSession}})
 check('AI工具修改回执同样保留before/after且满足严格JSON契约',()=>{assert.equal(changed.before.status,'running');assert.equal(changed.after.status,'completed');assert.deepEqual(changed,json(changed));const{text,...payload}=changed;assert.deepEqual(JSON.parse(text),payload)})
 await h.knowledgeService.createKnowledge({title:'JSON边界知识',body:'保持原文'});const knowledge=h.loadWorkbenchState().knowledge[0],knowledgeSession={id:'json-knowledge-native',snapshotEvents:()=>[]};h.rememberHubSession('knowledge:'+knowledge.id,knowledgeSession.id,'知识')
 const preview=await action.execute({operation:'knowledge.delete'},{agent:{session:knowledgeSession}})
 check('无turn的确认卡可选字段清理后仍是待确认，不执行删除',()=>{assert.equal(preview.status,'confirmation_required');assert.equal(preview.confirmation.before.id,knowledge.id);assert.equal(preview.confirmation.state,'pending');assert.ok(!Object.hasOwn(preview.confirmation,'turnId'));assert.deepEqual(preview,json(preview));const{text,...payload}=preview;assert.deepEqual(JSON.parse(text),payload);assert.ok(h.loadWorkbenchState().knowledge.some(k=>k.id===knowledge.id))})
 const officeSession={id:'json-office-native',snapshotEvents:()=>[]};h.rememberHubSession('system:office',officeSession.id,'日常工作');const office=await tool('workbench_office_workflow').execute({action:'status'},{agent:{session:officeSession}})
 check('工厂统一清理办公作业嵌套可选字段，保持原jobs和文本数组契约',()=>{assert.deepEqual(office,json(office));assert.deepEqual(JSON.parse(office.text),office.jobs);assert.equal(office.jobs.find(j=>j.id==='office-optional-fields').steps[0].status,'completed');assert.ok(!Object.hasOwn(office.jobs[0],'error'))})
 const knowledgeResult=await tool('workbench_manage_knowledge').execute({action:'update',id:knowledge.id,body:'修改预览'},{agent:{session:knowledgeSession}})
 check('既有知识工具预览状态、差异和text契约保持不变',()=>{assert.equal(knowledgeResult.status,'confirmation_required');assert.equal(knowledgeResult.confirmation.before.body,'保持原文');assert.equal(knowledgeResult.confirmation.after.body,'修改预览');assert.deepEqual(knowledgeResult,json(knowledgeResult));assert.equal(JSON.parse(knowledgeResult.text).status,knowledgeResult.status);assert.equal(h.loadWorkbenchState().knowledge[0].body,'保持原文')})
 console.log('assistant-tool-json: '+checks+' checks passed')
}finally{rmSync(home,{recursive:true,force:true})}
