/** Durable per-message evidence fixtures; no real model, account, or business writes. */
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-hub-turns-'));process.env.DSH_HOME=home
try{
 const modulePath=join(home,'fixture.mjs')
 await build({stdin:{contents:`export * from './src/host/assistant/hub-turns.ts';export {rememberHubSession,setHubSessionKnowledgeScope} from './src/host/assistant/hub-store.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:modulePath,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(modulePath),file=join(home,'storages/dev-workbench/assistant-turns.json');let checks=0,serial=0
 const check=(label,fn)=>{fn();checks++;console.log('✓ '+label)}
 function session(id='native-'+(++serial)){const events=[];return {id,events,get seq(){return events.length},snapshotEvents:()=>events.slice(),append(type,data){const event={type,data,seq:events.length+1,time:Date.now()};events.push(event);return event}}}
 function begin(s,extra={}){return h.beginHubTurn({conversationId:'task:fixture',text:'测试输入 '+(++serial),source:'ai',mode:'execute',sessionId:s.id,requestId:'request-'+serial,fromSeq:s.seq,...extra})}
 function user(s,row,turn=1){s.append('turn/start',{turn});return s.append('user/message',{id:'message-'+row.id,role:'user',source:{kind:'user',rpcId:row.requestId},content:[{type:'text',text:row.text}]})}
 function assistant(s,text,turn=1){return s.append('assistant/message',{turn,step:1,message:{role:'assistant',content:[{type:'reasoning',text:'PRIVATE_REASONING_NEVER_DISPLAY'},{type:'text',text}]}})}
 const end=(s,kind='completed',turn=1)=>s.append('turn/end',{turn,reason:{kind}})
 const tool=(s,id,args={operation:'task.update',patch:{status:'completed'}})=>s.append('tool/call',{turn:1,step:1,callId:id,name:'workbench_assistant_action',arguments:JSON.stringify(args)})
 const result=(s,id,value,error=false)=>s.append('tool/result',{turn:1,step:1,message:{role:'tool',toolCallId:id,isError:error,source:{kind:'tool',callId:id},content:[{type:'text',text:typeof value==='string'?value:JSON.stringify(value)}]}})
 const project=(s,row,options={})=>h.reconcileHubTurns(row.conversationId,s,options).find(item=>item.id===row.id)

 const one=session(),initial=begin(one,{text:'完成待办',requestId:'stable-request'}),same=h.beginHubTurn({...initial,id:undefined,at:undefined})
 check('请求在提交前持久化，相同编号重试复用轮次',()=>{assert.equal(same.id,initial.id);assert.equal(h.hubTurns(initial.conversationId).length,1);assert.equal(JSON.parse(readFileSync(file)).turns[0].requestId,'stable-request')})
 check('同请求编号更换正文、模式或上下文会拒绝',()=>{for(const patch of [{text:'另一个请求'},{mode:'reinterpret'},{refs:[{kind:'task',id:'other'}]},{knowledgeScope:{projectId:'other'}}])assert.throws(()=>h.beginHubTurn({...initial,...patch}),/相同请求/);assert.throws(()=>h.updateHubTurn(initial.id,{sessionId:'other'}),/归属/)})
 check('新进程恢复原轮次及requestId，不自动重发',()=>{const code=`import{getHubTurn}from ${JSON.stringify(modulePath)};process.stdout.write(JSON.stringify(getHubTurn(${JSON.stringify(initial.id)})))`;const recovered=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,DSH_HOME:home},encoding:'utf8'}));assert.equal(recovered.id,initial.id);assert.equal(recovered.status,'recognizing')})
 one.append('turn/start',{turn:1});one.append('user/message',{source:{kind:'user',rpcId:'unrelated'},content:[{type:'text',text:initial.text}]});assistant(one,'别人的回复');end(one)
 check('相同文字与不同rpcId不能归入本轮',()=>{assert.equal(project(one,initial).status,'recognizing');assert.equal(h.identifyActiveHubTurn(one),undefined);assert.equal(h.markHubMessages(one.id,[{seq:3,text:'legacy'}])[0].turnId,undefined)})
 user(one,initial,2);tool(one,'call-complete');result(one,'call-complete',{status:'ok',note:'待办已标记完成。'});assistant(one,'已记录本次处理。',2);end(one,'completed',2)
 const completed=project(one,initial)
 check('按原生rpcId、callId和message.isError关联真实指令及结果',()=>{assert.equal(completed.status,'completed');assert.equal(completed.commands.length,1);assert.equal(completed.commands[0].operation,'task.update');assert.equal(completed.commands[0].parameters['状态'],'已完成');assert.equal(completed.commands[0].resultText,'待办已标记完成。');assert.equal(completed.reply,'已记录本次处理。');assert.ok(!JSON.stringify(completed).includes('PRIVATE_REASONING'))})
 check('反复轮询不重复指令、不重复写盘',()=>{const before=statSync(file).mtimeMs;project(one,initial);project(one,initial);assert.equal(statSync(file).mtimeMs,before);assert.equal(h.getHubTurn(initial.id).commands.length,1)})
 check('仅精确本轮区间打turnId，旧消息继续作为历史展示',()=>{const rows=h.markHubMessages(one.id,[{seq:2},{seq:completed.userSeq},{seq:completed.toSeq},{seq:completed.toSeq+1}]);assert.equal(rows[0].turnId,undefined);assert.equal(rows[1].turnId,initial.id);assert.equal(rows[2].turnId,initial.id);assert.equal(rows[3].turnId,undefined)})

 const empty=session(),emptyTurn=begin(empty);user(empty,emptyTurn);assistant(empty,'');end(empty)
 check('空最终消息不能假报成功且总有可展示反馈',()=>{const row=project(empty,emptyTurn);assert.equal(row.status,'failed');assert.equal(row.reply,'本轮未返回可展示结果，尚未确认执行完成')})
 const toolsOnly=session(),toolsTurn=begin(toolsOnly);user(toolsOnly,toolsTurn);tool(toolsOnly,'tools-only');result(toolsOnly,'tools-only',{status:'ok',note:'截止时间已保存。'});end(toolsOnly)
 check('无最终文字时使用真实工具结果，不生成臆测回复',()=>{const row=project(toolsOnly,toolsTurn);assert.equal(row.status,'completed');assert.match(row.reply,/修改待办：截止时间已保存/);assert.equal(row.commands.length,1)})
 const failure=session(),failedTurn=begin(failure);user(failure,failedTurn);tool(failure,'fails');result(failure,'fails','权限不足',true);assistant(failure,'我尝试了更新。');end(failure)
 check('模型说有进展不能覆盖原生工具失败',()=>{const row=project(failure,failedTurn);assert.equal(row.status,'failed');assert.equal(row.commands[0].status,'failed');assert.equal(row.commands[0].resultText,'权限不足')})
 const blocked=session(),blockedTurn=begin(blocked);user(blocked,blockedTurn);tool(blocked,'blocked',{operation:'development.continue'});result(blocked,'blocked',{status:'error',blocked:true,failurePhase:'execution',note:'正在等待人工审查，尚未继续开发。'});end(blocked)
 check('AI工具回执明确受阻时保留指令与执行阶段标记，普通错误不冒充受阻',()=>{const row=project(blocked,blockedTurn);assert.equal(row.blocked,true);assert.equal(row.failurePhase,'execution');assert.equal(row.commands[0].blocked,true);assert.equal(row.commands[0].failurePhase,'execution');assert.match(row.reply,/等待人工审查/);assert.equal(project(failure,failedTurn).blocked,false)})
 const terminal=session(),terminalTurn=begin(terminal);user(terminal,terminalTurn);terminal.append('turn/end',{turn:1,reason:{kind:'error',error:{cause:{message:'HTTP 400 fixture rejected'}}}})
 check('原生终止错误展示真实失败原因',()=>{const row=project(terminal,terminalTurn);assert.equal(row.status,'failed');assert.match(row.reply,/HTTP 400 fixture rejected/)})
 const preview=session(),previewTurn=begin(preview);user(preview,previewTurn);tool(preview,'preview',{operation:'knowledge.delete',id:'knowledge-fixture'});result(preview,'preview',{status:'confirmation_required',note:'请核对知识后确认。',confirmation:{id:'secret-token',state:'pending'}});end(preview)
 check('确认预览显示待确认，不冒称删除完成',()=>{const row=project(preview,previewTurn);assert.equal(row.status,'needs_confirmation');assert.equal(row.commands[0].status,'needs_confirmation');assert.ok(!JSON.stringify(row).includes('secret-token'))})

 const missing=session(),missingTurn=begin(missing);user(missing,missingTurn);tool(missing,'pending-tool')
 check('执行中按真实事件显示，不凭缺少最终消息提前完成',()=>{assert.equal(project(missing,missingTurn).status,'executing');assert.equal(h.identifyActiveHubTurn(missing).id,missingTurn.id)})
 check('已确认不再运行且缺少工具结果保留中断状态',()=>{const row=project(missing,missingTurn,{running:false});assert.equal(row.status,'interrupted');assert.equal(row.commands[0].status,'interrupted');assert.match(row.reply,/尚未确认完成/)})
 const cold=session(),coldTurn=begin(cold)
 check('冷会话空快照不会误判终止，明确settled才记录未完成',()=>{assert.equal(project(cold,coldTurn,{running:false}).status,'recognizing');assert.equal(project(cold,coldTurn,{settled:true}).status,'interrupted')})
 h.updateHubTurn(coldTurn.id,{status:'failed',reply:'提交被宿主拒绝'})
 check('提交失败且无对应原生消息时保留真实错误',()=>{assert.equal(project(cold,coldTurn).status,'failed');assert.equal(project(cold,coldTurn).reply,'提交被宿主拒绝')})
 user(cold,coldTurn);assistant(cold,'后续确认收到真实结果。');end(cold)
 check('晚到真实终态可以恢复显示，但不会自动重新执行',()=>{assert.equal(project(cold,coldTurn).status,'completed');assert.equal(project(cold,coldTurn).reply,'后续确认收到真实结果。')})

 const next=session(),first=begin(next),second=begin(next);user(next,first,1);assistant(next,'第一轮结果。');end(next,'completed',1);user(next,second,2);assistant(next,'第二轮结果。');end(next,'completed',2)
 check('同会话独立用户轮次不会串回复或命令',()=>{assert.equal(project(next,first).reply,'第一轮结果。');assert.equal(project(next,second).reply,'第二轮结果。');assert.ok(h.getHubTurn(first.id).toSeq<h.getHubTurn(second.id).userSeq)})
 const batched=session(),batchA=begin(batched),batchB=begin(batched);user(batched,batchA);batched.append('user/message',{source:{kind:'user',rpcId:batchB.requestId},content:[{type:'text',text:batchB.text}]});assistant(batched,'合批后的回复。');end(batched)
 check('同原生turn的另一条独立输入形成边界，不猜测归属',()=>{assert.equal(project(batched,batchA).status,'interrupted');assert.ok(!project(batched,batchA).reply.includes('合批后的回复'));assert.equal(project(batched,batchB).reply,'合批后的回复。')})

 const guardCtx={},otherCtx={},guarded=session(),reinterpret=begin(guarded,{mode:'reinterpret'});h.setHubReinterpretGuardAvailable(guardCtx,true)
 check('仅真实注册guard的上下文支持重新理解',()=>{assert.equal(h.hubReinterpretSupported(guardCtx),true);assert.equal(h.hubReinterpretSupported(otherCtx),false);assert.equal(h.identifyActiveHubTurn(guarded),undefined)})
 user(guarded,reinterpret);guarded.append('user/message',{source:{kind:'context'},content:[{type:'text',text:'其他注入内容'}]})
 check('工具guard从当前原生rpcId识别reinterpret，忽略注入与模型声明',()=>{assert.equal(h.identifyActiveHubTurn(guarded).id,reinterpret.id);assert.equal(h.identifyActiveHubTurn(guarded,{conversationId:'task:other'}),undefined);end(guarded);assert.equal(h.identifyActiveHubTurn(guarded),undefined);h.setHubReinterpretGuardAvailable(guardCtx,false);assert.equal(h.hubReinterpretSupported(guardCtx),false)})
 const mixed=session(),mixedRewrite=begin(mixed,{mode:'reinterpret'}),mixedExecute=begin(mixed);user(mixed,mixedRewrite);mixed.append('user/message',{source:{kind:'user',rpcId:mixedExecute.requestId},content:[]})
 check('原生turn合批含重新理解时优先阻止实际执行',()=>{assert.equal(h.activeHubTurns(mixed).length,2);assert.equal(h.identifyActiveHubTurn(mixed).mode,'reinterpret')})
 const clarified=session(),clarification=begin(clarified,{clarificationOnly:true}),mixedClarified=begin(clarified);user(clarified,clarification);clarified.append('user/message',{source:{kind:'user',rpcId:mixedClarified.requestId},content:[]})
 check('原生轮次合批含自动澄清时保留优先级，后续消息不能绕过工具保护',()=>{assert.equal(h.activeHubTurns(clarified).length,2);assert.equal(h.identifyActiveHubTurn(clarified).id,clarification.id);assert.equal(h.identifyActiveHubTurn(clarified).clarificationOnly,true)})

 const scopeSession=session(),scopeA=begin(scopeSession,{conversationId:'system:knowledge',knowledgeScope:{projectId:'A',accountId:'account'}}),scopeB=begin(scopeSession,{conversationId:'system:knowledge',knowledgeScope:{projectId:'B',accountId:'account'}});user(scopeSession,scopeA);assistant(scopeSession,'A范围知识');end(scopeSession)
 h.beginHubTurn({conversationId:'system:knowledge',text:'规则查询',source:'rule',mode:'execute',status:'completed',commands:[],knowledgeScope:{projectId:'A',accountId:'account'}})
 check('当前知识范围和选定线程严格隔离，规则轮次可见',()=>{const rows=h.reconcileHubTurns('system:knowledge',scopeSession,{sessionId:scopeSession.id,knowledgeScope:{projectId:'A',accountId:'account'}});assert.equal(rows.length,2);assert.ok(rows.every(row=>row.knowledgeScope.projectId==='A'));assert.equal(h.getHubTurn(scopeB.id).status,'recognizing');assert.equal(h.hubTurns('system:knowledge').length,0);assert.equal(h.hubTurns('system:knowledge',{sessionId:'other',knowledgeScope:{projectId:'A',accountId:'account'}}).length,1)})
 const jobs=session(),jobsTurn=begin(jobs);user(jobs,jobsTurn);tool(jobs,'start-job',{operation:'analysis.continue'});result(jobs,'start-job',{status:'ok',note:'已进入后台队列',job:{id:'started-job',status:'queued'}});tool(jobs,'list-jobs',{operation:'office.status'});result(jobs,'list-jobs',{status:'ok',jobs:[{id:'unrelated-old-job',status:'completed'}]});assistant(jobs,'模型猜测job-id-fake');end(jobs)
 check('后台job只来自实际启动回执，不采纳列表或模型文字中的ID',()=>{const row=project(jobs,jobsTurn);assert.deepEqual(row.jobIds,['started-job']);assert.deepEqual(row.commands[0].jobIds,['started-job']);assert.equal(row.commands[1].jobIds,undefined)})
 const nestedJob=session(),nestedTurn=begin(nestedJob);user(nestedJob,nestedTurn);tool(nestedJob,'nested-job',{operation:'analysis.retry'});result(nestedJob,'nested-job',{status:'ok',job:{jobId:'nested-real-job',status:'queued'}});end(nestedJob)
 check('启动回执job.jobId也能准确关联后台执行',()=>assert.deepEqual(project(nestedJob,nestedTurn).jobIds,['nested-real-job']))
 const readable=session(),readableTurn=begin(readable);user(readable,readableTurn);tool(readable,'search',{operation:'analysis.results'});result(readable,'search',{status:'ok',items:[{id:'t1',title:'真实待办',status:'ready'}],reasoning_content:'HIDDEN_RESULT_REASONING'});readable.append('tool/call',{turn:1,step:1,callId:'unknown',name:'some_native_tool',arguments:JSON.stringify({path:'/private/secret',token:'secret-token'})});result(readable,'unknown',{count:2});end(readable)
 check('工具结果转为实际条目摘要，隐藏推理字段及未知工具参数',()=>{const row=project(readable,readableTurn);assert.match(row.reply,/真实待办 · 待处理/);assert.match(row.reply,/返回 2 条记录/);assert.ok(!JSON.stringify(row).includes('HIDDEN_RESULT_REASONING'));assert.deepEqual(row.commands[1].parameters,{});assert.ok(!row.reply.includes('"items"'))})
 const long=session(),longTurn=begin(long);user(long,longTurn);assistant(long,'实际结果'.repeat(10000));end(long)
 check('长结果明确标为节选，避免无提示截断',()=>{const row=project(long,longTurn);assert.ok(row.reply.length<24100);assert.match(row.reply,/以上为节选/);assert.ok(!readFileSync(file,'utf8').includes('PRIVATE_REASONING_NEVER_DISPLAY'))})
 const old=session('old-human-session');old.append('turn/start',{turn:1});const oldUser=old.append('user/message',{content:[{type:'text',text:'【工作台上下文】\n内部上下文\n\n请继续查看旧任务'}]});old.append('user/message',{source:{kind:'context'},content:[{type:'text',text:'注入材料'}]});tool(old,'old-call',{operation:'task.update',patch:{status:'completed'}});result(old,'old-call',{status:'ok',note:'旧待办已完成。'});end(old)
 const oldFile=readFileSync(file,'utf8'),legacy=h.projectLegacyHubTurns('task:legacy',old)
 check('旧原生消息只读投影真实指令与结果，去掉上下文前缀',()=>{assert.equal(legacy.length,1);assert.equal(legacy[0].id,'native:old-human-session:'+oldUser.seq);assert.equal(legacy[0].text,'请继续查看旧任务');assert.equal(legacy[0].source,'ai');assert.equal(legacy[0].legacy,true);assert.equal(legacy[0].commands[0].operation,'task.update');assert.match(legacy[0].reply,/旧待办已完成/);assert.equal(readFileSync(file,'utf8'),oldFile);assert.equal(h.getHubTurn(legacy[0].id),undefined)})
 check('旧投影稳定可标原消息turnId，不制造永久历史或重复记录',()=>{assert.equal(h.projectLegacyHubTurns('task:legacy',old)[0].id,legacy[0].id);assert.equal(h.markHubMessages(old.id,[{seq:oldUser.seq},{seq:old.seq}],legacy)[1].turnId,legacy[0].id);assert.equal(h.hubMessageTurnId(old.id,oldUser.seq,legacy),legacy[0].id)})
 check('已有tracked请求不会再作为legacy消息重复展示',()=>{const rows=h.projectLegacyHubTurns(initial.conversationId,one);assert.equal(rows.length,1);assert.equal(rows[0].reply,'别人的回复');assert.ok(!rows.some(row=>row.userSeq===completed.userSeq))})
 const oldKnowledge=session('old-knowledge-session');oldKnowledge.append('turn/start',{turn:1});oldKnowledge.append('user/message',{source:{kind:'user',rpcId:'legacy-knowledge-rpc'},content:[{type:'text',text:'原项目知识'}]});assistant(oldKnowledge,'A项目真实回答');end(oldKnowledge);h.rememberHubSession('system:knowledge',oldKnowledge.id,'知识助手');h.setHubSessionKnowledgeScope(oldKnowledge.id,{projectId:'A',accountId:'account'})
 check('旧知识历史按native已绑定scope隔离，不能切范围穿透',()=>{assert.equal(h.projectLegacyHubTurns('system:knowledge',oldKnowledge,{knowledgeScope:{projectId:'A',accountId:'account'}}).length,1);assert.equal(h.projectLegacyHubTurns('system:knowledge',oldKnowledge,{knowledgeScope:{projectId:'B',accountId:'account'}}).length,0);assert.equal(h.projectLegacyHubTurns('system:knowledge',oldKnowledge).length,0)})
 console.log('assistant-hub-turns: '+checks+' scenarios passed')
}finally{rmSync(home,{recursive:true,force:true})}
