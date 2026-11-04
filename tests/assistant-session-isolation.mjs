import {installNativeContextFixture} from './native-context-fixture.mjs'
/** Synthetic sessions and storage only; no model requests or user history changes. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-office-isolation-'));process.env.DSH_HOME=home
try{
 await build({stdin:{contents:`export {workbenchApi as api,setShared_workbenchCtx} from './src/host/application/workbench-service.ts';export {saveDevelopmentTask,writeDevelopmentFile,developmentDir} from './src/host/storage/development-store.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const host=await import(join(home,'host.mjs')),api=host.api,sessions=new Map(),prompts=[];let created=0,checks=0
 const check=(label,fn)=>{fn();checks++;console.log('✓ '+label)}
 function session(id,text){const events=text?[{seq:1,type:'user/message',time:Date.now(),data:{content:[{type:'text',text}]}}]:[];const row={id,seq:events.length,header:{createdAt:Date.now()},snapshotEvents:(from=0)=>events.filter(e=>e.seq>from)};sessions.set(id,row);return row}
 session('session-development','研发任务 US-1');session('session-review','独立审查');session('session-linky-native','原生CLI任务');session('session-general','研发任务方案讨论（普通原生会话）')
 host.saveDevelopmentTask({id:'task',issue:{id:'issue',code:'US-1'},sessionId:'session-development',reviewSessionId:'session-review',status:'paused',stage:'analysis',steps:[],createdAt:new Date().toISOString()})
 host.writeDevelopmentFile(join(host.developmentDir(),'native-runs','native.json'),{sessionId:'session-linky-native'})
 const controller={create(){return {session:session('session-office-'+(++created))}},async prompt(request){prompts.push(request)}}
 const ctx={get:key=>({sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]},sessionController:controller})[key]};installNativeContextFixture(ctx);host.setShared_workbenchCtx(ctx)
 await api.saveSettings({assistantSessionId:'session-development'})
 const original=[...sessions.values()].slice(0,3).map(s=>JSON.stringify(s.snapshotEvents())),list=await api.assistantSessions()
 check('办公助手列表排除开发、独立审查及Linky原生研发会话，也不返回旧错误默认ID',()=>{assert.deepEqual(list.sessions.map(s=>s.id),['session-general']);assert.equal(list.assistantSessionId,null)})
 const office=await api.assistantTranscript({}),afterRecovery=await api.snapshot()
 check('旧默认误绑研发时恢复独立办公会话，不读取研发记录或触发模型',()=>{assert.equal(office.sessionId,'session-office-1');assert.deepEqual(office.messages,[]);assert.equal(prompts.length,0);assert.equal(afterRecovery.settings.assistantSessionId,office.sessionId)})
 for(const id of ['session-development','session-review','session-linky-native']){
  assert.equal((await api.assistantSend({sessionId:id,text:'普通待办',steer:true})).status,'development_session')
  assert.equal((await api.assistantAsk({sessionId:id,text:'普通待办'})).status,'development_session')
  assert.equal((await api.assistantTranscript({sessionId:id})).status,'development_session')
  assert.equal((await api.assistantDelta({sessionId:id})).status,'development_session')
 }
 const afterBlocked=await api.snapshot();check('旧界面显式读取、发送、打断研发会话均被拦截，保留办公绑定',()=>{assert.equal(prompts.length,0);assert.equal(created,1);assert.equal(afterBlocked.settings.assistantSessionId,office.sessionId)})
 const again=await api.assistantTranscript({});check('再次打开恢复同一办公会话，不重复创建',()=>{assert.equal(again.sessionId,office.sessionId);assert.equal(created,1)})
 const sent=await api.assistantSend({text:'请整理这条待办',refs:[]})
 check('实际发送只提交到办公会话，研发历史保持原样',()=>{assert.equal(sent.status,'ok');assert.equal(prompts.length,1);assert.equal(prompts[0].sessionId,office.sessionId);assert.deepEqual([...sessions.values()].slice(0,3).map(s=>JSON.stringify(s.snapshotEvents())),original)})
 const reset=await api.assistantReset();check('新办公会话不会复用最近的研发会话',()=>{assert.equal(reset.sessionId,'session-office-2');assert.equal(created,2)})
 const ordinary=await api.assistantTranscript({sessionId:'session-general'});check('仍可显式查看普通原生会话，不按标题关键词误判研发归属',()=>assert.equal(ordinary.status,'ok'))
 await api.createTask({title:'独立待办甲'});await api.createTask({title:'独立待办乙'});const tasks=(await api.snapshot()).tasks,taskA=tasks.find(t=>t.title==='独立待办甲').id,taskB=tasks.find(t=>t.title==='独立待办乙').id
 const beforeTasks=created,a=await api.assistantTranscript({taskId:taskA}),b=await api.assistantTranscript({taskId:taskB})
 check('不同待办首次点击分配不同会话，通用办公默认不受影响',()=>{assert.notEqual(a.sessionId,b.sessionId);assert.equal(created,beforeTasks+2);assert.notEqual(a.sessionId,office.sessionId)})
 const restored=await api.assistantTranscript({taskId:taskA});check('同一待办再次打开恢复原会话',()=>{assert.equal(restored.sessionId,a.sessionId);assert.equal(created,beforeTasks+2)})
 const a2=await api.assistantReset({taskId:taskA});await api.assistantTranscript({taskId:taskA,sessionId:a.sessionId});const selected=await api.assistantTranscript({taskId:taskA}),index=JSON.parse(readFileSync(join(home,'storages/dev-workbench/assistant-task-threads.json'),'utf8'))
 check('每条待办可新建多段历史，手动选回旧会话后再次打开仍恢复旧会话',()=>{assert.notEqual(a2.sessionId,a.sessionId);assert.equal(selected.sessionId,a.sessionId);assert.equal(index.tasks.find(row=>row.taskId===taskA).threads.length,2);assert.equal(index.tasks.find(row=>row.taskId===taskA).activeId,a.sessionId)})
 const beforeWrong=prompts.length
 for(const action of ['assistantSend','assistantAsk','assistantTranscript','assistantDelta'])assert.equal((await api[action]({taskId:taskB,sessionId:a.sessionId,text:'不能串到甲'})).status,'wrong_task_session')
 assert.equal((await api.assistantSend({sessionId:a.sessionId,text:'不能从通用入口串入甲'})).status,'wrong_task_session')
 check('服务端拒绝把乙待办或通用消息发送给甲会话，显式历史读取也受归属校验',()=>assert.equal(prompts.length,beforeWrong))
 const cold=sessions.get(a.sessionId);sessions.delete(a.sessionId);let resumes=0;controller.resolveAgent=async id=>{assert.equal(id,a.sessionId);resumes++;sessions.set(id,cold);return {agent:{session:cold}}}
 const coldList=await api.assistantSessions({taskId:taskA}),coldRestored=await api.assistantTranscript({taskId:taskA})
 check('冷会话从持久索引出现在历史列表并由宿主恢复，不创建替代会话',()=>{assert.ok(coldList.sessions.some(row=>row.id===a.sessionId&&row.taskId===taskA));assert.equal(coldRestored.sessionId,a.sessionId);assert.equal(resumes,1);assert.equal(created,beforeTasks+3)})
 sessions.delete(a.sessionId);const originalResolve=controller.resolveAgent;controller.resolveAgent=async()=>{throw Error('model not found')};await assert.rejects(api.assistantTranscript({taskId:taskA}),/model not found/);check('模型配置错误不能冒充日志丢失并替换原待办会话',()=>assert.equal(created,beforeTasks+3));controller.resolveAgent=originalResolve;sessions.set(a.sessionId,cold)
 await api.createTask({title:'并发打开待办'});const taskC=(await api.snapshot()).tasks.find(t=>t.title==='并发打开待办').id,beforeConcurrent=created,parallel=await Promise.all(Array.from({length:3},()=>api.assistantTranscript({taskId:taskC})))
 check('同一待办首次并发打开只分配一个持久会话',()=>{assert.equal(new Set(parallel.map(row=>row.sessionId)).size,1);assert.equal(created,beforeConcurrent+1)})
 await api.assistantSend({taskId:taskB,sessionId:b.sessionId,text:'继续乙待办'});check('继续处理只向所属待办会话提交模型请求',()=>assert.equal(prompts.at(-1).sessionId,b.sessionId))
 console.log('assistant-session-isolation: '+checks+' scenarios passed')
}finally{rmSync(home,{recursive:true,force:true})}
