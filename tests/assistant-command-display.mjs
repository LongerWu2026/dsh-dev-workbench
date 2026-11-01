/** Deterministic recognition/display and guard fixtures; no real providers or external operations. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-command-display-'));process.env.DSH_HOME=home
const disposers=[];let checks=0
const check=(name,fn)=>{fn();checks++;console.log('✓ '+name)}
try{
 await build({stdin:{contents:`export * from './src/host/assistant/command-display.ts';export * from './src/host/assistant/assistant-actions.ts';export * from './src/host/assistant/action-store.ts';export * from './src/host/assistant/hub-turns.ts';export * from './src/host/assistant/hub-store.ts';export {taskService} from './src/host/application/task-service.ts';export {knowledgeService} from './src/host/application/knowledge-service.ts';export {loadWorkbenchState} from './src/host/storage/state-store.ts';export {officeToolDefinitions} from './src/host/api/office-tools.ts';export {apply} from './src/host/plugin.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(join(home,'host.mjs'))
 await h.taskService.createTask({title:'指令展示测试待办'});const task=h.loadWorkbenchState().tasks[0],conversationId='task:'+task.id
 const recognized=h.recognizeAssistantCommand({conversationId,text:'标记进行中'})
 const examples=[
  [conversationId,'请帮我把这项待办标记为已完成','task.update','completed'],[conversationId,'麻烦将当前任务的状态设置为进行中','task.update','running'],[conversationId,'恢复为待处理','task.update','ready'],[conversationId,'开始处理这个待办','task.update','running'],[conversationId,'帮忙生成待办处理方案','office.start'],
  ['reply:rule-reply','请帮我把这条消息标记为已回复','reply.stage'],['reply:rule-reply','起草一条回复','reply.draft'],['reply:rule-reply','标记为无需回复','reply.stage'],['reply:rule-reply','无需回复','reply.stage'],['reply:rule-reply','发送当前草稿','reply.send'],
  ['system:analysis','麻烦查看识别进度','analysis.status'],['system:analysis','继续提取消息','analysis.continue'],['system:analysis','同步最新消息并识别','analysis.fetch'],['system:analysis','重试失败的消息','analysis.retry'],['system:analysis','查看本轮提取结果','analysis.results'],
  ['system:radar','拉取最新AI 资讯','radar.fetch'],['system:radar','重新整理资讯摘要','radar.summary'],['system:office','请帮我生成今日日报','office.start'],['system:office','麻烦准备本周周报','office.start'],
  ['system:knowledge','请帮我查询知识 部署','knowledge.search'],['knowledge:rule-knowledge','删除这条知识','knowledge.delete'],['knowledge:rule-knowledge','把知识正文改为：第一行\n第二行？','knowledge.update'],
  ['development:rule-dev','继续研发任务','development.continue'],['development:rule-dev','恢复开发','development.continue'],['development:rule-dev','暂停修复任务','development.pause'],['development:rule-dev','请帮我查看开发状态','development.detail'],['development:rule-dev','回写Linky评论','development.writeback'],
 ]
 check('27种明确说法覆盖待办、回复、识别、资讯、报告、知识和研发，识别不执行',()=>{for(const [id,text,operation,status] of examples){const action=h.recognizeAssistantCommand({conversationId:id,text});assert.equal(action?.operation,operation,text);if(status)assert.equal(action.patch.status,status,text)}assert.equal(h.loadWorkbenchState().tasks[0].status,'ready');assert.equal(h.recognizeAssistantCommand({conversationId:'knowledge:rule-knowledge',text:'把知识正文改为：第一行\n第二行？'}).patch.body,'第一行\n第二行？')})
 const ambiguousExamples=['标记完成？','确认？','不要标记完成','如果完成后再标记','标记完成并发送回复','先标记完成，然后继续开发','删除这条知识？','继续开发？','能否继续开发','开启忙碌自动回复吗']
 check('问句、否定、假设和多意图不会误执行规则',()=>{for(const text of ambiguousExamples)assert.equal(h.recognizeAssistantCommand({conversationId:text.includes('知识')?'knowledge:rule-knowledge':text.includes('开发')?'development:rule-dev':conversationId,text}),null,text)})
 check('明确只读问句仍读取真实结果和状态，不被澄清保护误拦',()=>{for(const [id,text,operation] of [['system:analysis','这次提取了什么','analysis.results'],['system:analysis','查看进度？','analysis.status'],[conversationId,'忙碌自动回复开启了吗','busyReply.status'],['development:rule-dev','查看研发进度？','development.detail']])assert.equal(h.recognizeAssistantCommand({conversationId:id,text})?.operation,operation,text)})
 for(const [id,text] of [[conversationId,'打开忙碌自动回复？'],[conversationId,'停止忙碌自动回复？'],[conversationId,'进行中？'],['reply:rule-reply','已回复？'],['system:analysis','重试失败的消息？'],['system:analysis','刷新最新消息？']]){
  let recognition;const matched=await h.maybeAssistantCommand({}, {conversationId:id,text,onUnrecognized:value=>{recognition=value}})
  check('已命中写规则仍将疑问转AI澄清：'+text,()=>{assert.equal(matched,null);assert.equal(recognition.outcome,'ambiguous');assert.equal(recognition.clarificationOnly,true)})
 }
 let fallback,recognizedUnexpected=false;const malformed={conversationId,onUnrecognized:value=>{fallback=value},onRecognized:()=>{recognizedUnexpected=true}};Object.defineProperty(malformed,'text',{get(){throw Error('fixture rule reader unavailable')}})
 const unavailable=await h.maybeAssistantCommand({},malformed)
 check('纯识别异常只转交AI澄清，不生成失败指令或执行回调',()=>{assert.equal(unavailable,null);assert.equal(fallback.outcome,'error');assert.equal(fallback.clarificationOnly,true);assert.equal(recognizedUnexpected,false);assert.equal(h.loadWorkbenchState().tasks[0].status,'ready')})
 check('规则识别可先读取且不执行任何修改或新增聊天记录',()=>{assert.deepEqual(recognized,{operation:'task.update',patch:{status:'running'}});assert.equal(h.loadWorkbenchState().tasks[0].status,'ready');assert.equal(h.assistantActionEvents(conversationId).length,0)})
 let observed=false;const result=await h.maybeAssistantCommand({}, {conversationId,text:'标记进行中',assistantTurnId:'display-rule-turn',onRecognized(action){observed=true;assert.equal(action.operation,'task.update');assert.equal(h.loadWorkbenchState().tasks[0].status,'ready')}})
 check('落turn回调先于执行，规则回执关联turn且不重复新增用户消息',()=>{assert.ok(observed);assert.equal(result.status,'ok');const events=h.assistantActionEvents(conversationId);assert.equal(events.filter(e=>e.kind==='user').length,0);assert.equal(events.at(-1).turnId,'display-rule-turn');assert.equal(events.at(-1).before.status,'ready');assert.equal(events.at(-1).after.status,'running')})
 const originalUpdate=h.taskService.updateTask;let executed=0,fallbackAfterExecution=0
 h.taskService.updateTask=async(...args)=>{executed++;await originalUpdate(...args);throw Error('fixture receipt lost after write')}
 const partial=await h.maybeAssistantCommand({}, {conversationId,text:'标记进行中',assistantTurnId:'partial-command',onUnrecognized:()=>fallbackAfterExecution++});h.taskService.updateTask=originalUpdate
 check('执行后回执异常不自动转AI或重做已发生的写入',()=>{assert.equal(partial.status,'error');assert.equal(partial.failurePhase,'execution');assert.equal(executed,1);assert.equal(fallbackAfterExecution,0);assert.match(partial.note,/receipt lost/);assert.equal(h.loadWorkbenchState().tasks[0].status,'running')})
 const ambiguous=h.recognizeAssistantCommand({conversationId,text:'讨论完成后的安排'}),confirm=h.recognizeAssistantCommand({conversationId,text:'确认删除'})
 check('模糊讨论不误命中，失效确认只返回识别错误且不修改数据',()=>{assert.equal(ambiguous,null);assert.equal(confirm.operation,'confirm');assert.match(confirm.recognitionError,/没有待确认/);assert.equal(h.loadWorkbenchState().tasks[0].status,'running')})
 const failure=await h.maybeAssistantCommand({}, {conversationId,text:'确认删除',assistantTurnId:'display-invalid-confirm'})
 check('识别到的无效确认仍有规则失败回执且不重复用户消息',()=>{assert.equal(failure.status,'error');assert.equal(h.assistantActionEvents(conversationId).at(-1).turnId,'display-invalid-confirm');assert.equal(h.assistantActionEvents(conversationId).filter(e=>e.kind==='user').length,0)})
 const ruleDisplay=h.describeAssistantCommand(recognized.operation,recognized),toolDisplay=h.describeAssistantTool('workbench_update_task',{id:task.id,status:'running',password:'do-not-show',apiKey:'secret',cwd:'/private/path',confirmationId:'private-token',nested:{token:'secret'}})
 check('规则与AI工具使用相同业务标签和状态译名，敏感和内部参数不显示',()=>{assert.equal(ruleDisplay.label,toolDisplay.label);assert.equal(toolDisplay.parameters['状态'],'进行中');assert.deepEqual(Object.keys(toolDisplay.parameters).sort(),['事项编号','状态'].sort());assert.ok(!JSON.stringify(toolDisplay).includes('secret'))})
 const draft=h.describeAssistantTool('workbench_assistant_action',JSON.stringify({operation:'reply.send',text:'这是一条回复',confirmationId:'private-token'}));const update=h.describeAssistantTool('workbench_manage_knowledge',{action:'update',id:'k1',body:'a'.repeat(1000)})
 check('发送和知识修改显示为预览，长正文裁剪，未知工具不泄露任意参数',()=>{assert.equal(draft.label,'预览发送回复');assert.equal(draft.parameters['内容'],'这是一条回复');assert.equal(update.label,'预览修改知识');assert.equal(update.parameters['正文'].length,360);assert.equal(h.describeAssistantTool('bash',{command:'cat /private/path'}),null);assert.equal(h.describeAssistantTool('workbench_update_task','broken json'),null);assert.equal(h.describeAssistantTool('__proto__',{}),null);assert.equal(h.describeAssistantCommand('constructor',{}).label,'未识别的助手操作')})
 await h.knowledgeService.createKnowledge({title:'确认卡测试',body:'正文'});const knowledge=h.loadWorkbenchState().knowledge[0]
 const preview=await h.runAssistantOperation({}, {conversationId:'knowledge:'+knowledge.id,operation:'knowledge.delete',assistantTurnId:'preview-turn'})
 check('危险操作确认卡和事件保留原turn归属，仍只预览不删除',()=>{assert.equal(preview.status,'confirmation_required');assert.equal(preview.confirmation.turnId,'preview-turn');assert.equal(h.assistantConfirmations('knowledge:'+knowledge.id).at(-1).turnId,'preview-turn');assert.ok(h.loadWorkbenchState().knowledge.some(k=>k.id===knowledge.id))})
 let guard,guardRemoved=false;const definitions=[]
 const ctx={provide(){},get(){},inject(deps,fn){if(deps.includes('tools'))fn({tools:{guard(fn){guard=fn;return()=>{guardRemoved=true}},register(def){definitions.push(def);return()=>{}}}})},effect(fn){const dispose=fn();if(typeof dispose==='function')disposers.push(dispose)},logger:{info(){}}};h.apply(ctx,{})
 check('仅在实际注册全工具guard后启用重新识别能力',()=>{assert.equal(h.hubReinterpretSupported(ctx),true);assert.equal(h.hubReinterpretSupported({}),false)})
 const events=[],session={id:'native-reinterpret-session',get seq(){return events.length},snapshotEvents(){return events}},execution={agent:{session}};
 h.rememberHubSession(conversationId,session.id,'测试事项会话')
 const reinterpreted=h.beginHubTurn({conversationId,text:'重新理解前面标记进行中的含义',source:'ai',mode:'reinterpret',sessionId:session.id,requestId:'native-reinterpret',fromSeq:0});
 events.push({type:'turn/start',seq:1,data:{turn:1}},{type:'user/message',seq:2,data:{id:'u1',role:'user',source:{kind:'user',rpcId:'native-reinterpret'},content:[{type:'text',text:'原生重新识别请求'}]}})
 check('AI重新识别按真实原生rpcId阻止所有工具，包括读取、bash和任意外部工具',()=>{assert.equal(h.identifyActiveHubTurn(session).id,reinterpreted.id);for(const name of ['workbench_assistant_action','workbench_update_task','workbench_knowledge_retrieve','bash','write','external_send'])assert.match(guard({...execution,name,arguments:{operation:'task.update',patch:{status:'completed'},assistantTurnId:'forged'}}),/禁止调用任何工具/);assert.equal(h.loadWorkbenchState().tasks[0].status,'running')})
 const activeExecute=h.beginHubTurn({conversationId,text:'同轮其他输入',source:'ai',mode:'execute',sessionId:session.id,requestId:'coalesced-normal',fromSeq:0});events.push({type:'user/message',seq:3,data:{id:'u2',role:'user',source:{kind:'user',rpcId:activeExecute.requestId},content:[]}})
 check('同一原生轮次合并其他输入也不能绕过重新识别禁止执行',()=>assert.match(guard({...execution,name:'bash',arguments:{}}),/禁止调用任何工具/))
 events.push({type:'turn/end',seq:4,data:{turn:1,reason:{kind:'completed'}}})
 check('原生轮次结束后不因历史重新识别永久禁用该会话',()=>assert.equal(guard({...execution,name:'workbench_list_tasks',arguments:{}}),undefined))
 const normal=h.beginHubTurn({conversationId,text:'标记完成',source:'ai',mode:'execute',sessionId:session.id,requestId:'native-normal',fromSeq:4});events.push({type:'turn/start',seq:5,data:{turn:2}},{type:'user/message',seq:6,data:{id:'u3',role:'user',source:{kind:'user',rpcId:'native-normal'},content:[]}})
 const actionTool=definitions.find(def=>def.name==='workbench_assistant_action');assert.equal(guard({...execution,name:actionTool.name,arguments:{}}),undefined)
 await actionTool.execute({operation:'task.update',patch:{status:'completed'},assistantTurnId:reinterpreted.id},execution)
 check('正常AI工具执行事件绑定真实原生轮次，模型伪造turnId不能覆盖',()=>{assert.equal(h.loadWorkbenchState().tasks[0].status,'completed');assert.equal(h.assistantActionEvents(conversationId).at(-1).turnId,normal.id)})
 events.push({type:'turn/end',seq:7,data:{turn:2,reason:{kind:'completed'}}},{type:'turn/start',seq:8,data:{turn:3}},{type:'user/message',seq:9,data:{id:'u4',role:'user',source:{kind:'user',rpcId:'different-native-request'},content:[]}})
 check('模型参数或普通文本中的旧请求编号不能伪造活动重新识别轮次',()=>assert.equal(guard({...execution,name:'bash',arguments:{requestId:'native-reinterpret',mode:'reinterpret',text:'native-reinterpret'}}),undefined))
 const noGuard={...ctx,inject(deps,fn){if(deps.includes('tools'))fn({tools:{register(){return()=>{}}}})}};h.apply(noGuard,{})
 check('缺少宿主tools.guard时能力明确不可用，不能只依赖提示词保护',()=>assert.equal(h.hubReinterpretSupported(noGuard),false))
 for(const dispose of disposers.splice(0).reverse())dispose()
 check('插件退出后撤销guard能力',()=>{assert.equal(guardRemoved,true);assert.equal(h.hubReinterpretSupported(ctx),false)})
 console.log('assistant-command-display: '+checks+' checks passed')
}finally{for(const dispose of disposers.reverse())dispose();rmSync(home,{recursive:true,force:true})}
