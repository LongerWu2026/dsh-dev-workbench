/** Synthetic sessions only: no real conversations, accounts or external writes. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'hub-delete-'));process.env.DSH_HOME=home
try{
 await build({stdin:{contents:`export {assistantHub as hub} from './src/host/assistant/hub.ts';export {mutateWorkbenchState as mutate,claimWorkbenchOwnership} from './src/host/storage/state-store.ts';export {rememberHubSession,rememberOfficeTopic,recordHubRun,hubIndex} from './src/host/assistant/hub-store.ts';export {rememberTaskThread} from './src/host/assistant/task-threads.ts';export {saveDevelopmentTask} from './src/host/storage/development-store.ts';export {beginHubTurn,updateHubTurn} from './src/host/assistant/hub-turns.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(join(home,'host.mjs')),sessions=new Map(),archived=[],workspaces=[],calls=[],active=new Set();let failure='',noReceipt=false,checks=0
 const registry={list:()=>workspaces,get archivedSessionIds(){return archived},async archiveSession(id,options){calls.push({id,options});if(active.has(id))throw Error('会话正在执行');if(failure)throw Error(failure);if(!noReceipt&&!archived.includes(id))archived.push(id)}}
 const ctx={get:key=>({workspaceRegistry:registry,sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]}})[key]},hub=request=>h.hub(ctx,request)
 function session(id,title=id){const row={id,header:{cwd:home,createdAt:Date.now()},snapshotEvents:()=>[]};sessions.set(id,row);h.rememberHubSession('chat:'+id,id,title);return row}
 const check=(title,fn)=>{fn();checks++;console.log('✓ '+title)},row=async id=>(await hub({action:'list'})).conversations.find(row=>row.id===id),remove=id=>hub({action:'delete',conversationId:id,confirmed:true})
 session('temporary','临时讨论');sessions.set('unindexed',{id:'unindexed',header:{createdAt:Date.now()},snapshotEvents:()=>[]})
 check('无事项无工作区的真实普通会话才提供删除权限',()=>{})
 assert.equal((await row('chat:temporary')).canDelete,true);assert.equal(await row('chat:unindexed'),undefined);assert.equal((await remove('chat:unindexed')).status,'error');assert.equal(calls.length,0)
 const preview=await hub({action:'delete',conversationId:'chat:temporary'})
 check('删除先确认，预览不调用原生归档也不移除会话',()=>{assert.equal(preview.status,'confirmation_required');assert.equal(calls.length,0);assert.equal(archived.length,0)})
 const at=new Date().toISOString(),project=join(home,'project');mkdirSync(project)
 await h.mutate(state=>{state.tasks.push({id:'task-one',title:'待办',status:'ready'});state.replies.push({id:'reply-one',snippet:'待回复'});state.radar.push({id:'radar-one',title:'资讯'});state.knowledge.push({id:'knowledge-one',title:'知识',body:'知识内容'});return state})
 h.rememberOfficeTopic('office:report','报告',{kind:'work_report',input:{period:'day'}})
 h.saveDevelopmentTask({id:'dev-one',issue:{id:'issue',code:'US-TEST',title:'研发需求'},cwd:project,profile:'synthetic',sessionId:'dev-native',status:'ready',stage:'analysis',steps:[],createdAt:at,updatedAt:at})
 const beforeProtected=calls.length
 for(const id of ['system:analysis','system:radar','system:knowledge','system:office','task:task-one','reply:reply-one','radar:radar-one','knowledge:knowledge-one','office:report','development:dev-one']){
  const result=await remove(id);assert.equal(result.status,'error',id);assert.match(result.note,/不能删除/,id)
 }
 check('绕过界面也不能删除系统、待办、待回复、资讯、知识、办公及研发会话',()=>assert.equal(calls.length,beforeProtected))
 session('task-native');h.rememberTaskThread('task-one','task-native','待办')
 session('system-native');await h.mutate(state=>{state.settings.analysisSessionId='system-native';return state})
 for(const id of ['task-native','system-native','dev-native'])assert.equal((await remove('chat:'+id)).status,'error')
 check('伪造 chat 身份不能删除正式业务或后台原生会话',()=>assert.equal(calls.length,beforeProtected))
 session('child').header.parentSession='task-native';session('subagent').header.origin='subagent';h.rememberHubSession('chat:cold','cold','冷历史')
 for(const id of ['child','subagent','cold']){assert.equal((await row('chat:'+id)).canDelete,false);assert.equal((await remove('chat:'+id)).status,'error')}
 check('分支、子智能体和无法核实归属的冷会话也不能当作临时会话删除',()=>assert.equal(calls.length,beforeProtected))
 session('grouped');workspaces.push({id:'workspace',title:'工程',path:home,sessionIds:['grouped']})
 assert.equal((await row('chat:grouped')).canDelete,false);assert.equal((await remove('chat:grouped')).status,'error')
 session('linked-run');h.recordHubRun('run-one',[{sessionId:'linked-run',fromSeq:1,toSeq:2,purpose:'office'}],[])
 assert.equal((await row('chat:linked-run')).canDelete,false);assert.equal((await remove('chat:linked-run')).status,'error')
 check('工程绑定和已有工作结果关联均阻止删除',()=>assert.equal(calls.length,beforeProtected))
 session('became-bound');assert.equal((await hub({action:'delete',conversationId:'chat:became-bound'})).status,'confirmation_required');workspaces[0].sessionIds.push('became-bound')
 check('确认框打开后新绑定工程，提交删除时重新检查',()=>{})
 assert.equal((await remove('chat:became-bound')).status,'error');assert.equal(calls.length,beforeProtected)
 session('recognizing');const turn=h.beginHubTurn({conversationId:'chat:recognizing',text:'处理中',source:'ai',mode:'execute',status:'recognizing',commands:[]})
 assert.equal((await row('chat:recognizing')).canDelete,false);assert.equal((await remove('chat:recognizing')).status,'error');h.updateHubTurn(turn.id,{status:'completed'})
 active.add('recognizing');assert.equal((await remove('chat:recognizing')).status,'error')
 check('识别中或原生执行中的会话拒绝删除，不强停模型',()=>assert.equal(calls.at(-1).options,undefined))
 const before=h.hubIndex(),removed=await remove('chat:temporary')
 check('确认后使用原生归档且回读成功，不清空日志或会话索引',()=>{assert.equal(removed.status,'ok');assert.equal(removed.archived,true);assert.deepEqual(h.hubIndex(),before);assert.ok(sessions.has('temporary'))})
 assert.equal(await row('chat:temporary'),undefined);assert.equal((await hub({action:'detail',conversationId:'chat:temporary'})).status,'error')
 check('定时刷新和搜索均不重新带回已删除临时会话',()=>{})
 assert.ok(!(await hub({action:'list',query:'临时讨论'})).conversations.some(row=>row.id==='chat:temporary'))
 archived.splice(archived.indexOf('temporary'),1);assert.equal((await row('chat:temporary')).canDelete,true)
 check('在 Harness 恢复归档后，同一个原会话重新出现',()=>assert.equal((h.hubIndex().conversations.find(row=>row.id==='chat:temporary')).activeId,'temporary'))
 session('failed');failure='模拟写入失败';assert.equal((await remove('chat:failed')).status,'error');assert.ok(await row('chat:failed'));failure=''
 noReceipt=true;const unconfirmed=await remove('chat:failed');noReceipt=false
 check('原生失败或回读未确认时不宣称成功、不移除记录',()=>{assert.equal(unconfirmed.status,'error');assert.match(unconfirmed.note,/尚未确认/);assert.ok(!archived.includes('failed'))})
 assert.equal((await remove('chat:unindexed')).status,'error');assert.equal(await row('chat:unindexed'),undefined)
 await remove('chat:temporary')
 const cold=await import(join(home,'host.mjs')+'?reload');cold.claimWorkbenchOwnership();const reloaded=await cold.hub(ctx,{action:'list'})
 check('新宿主重新加载后，原生归档的索引和未索引会话都不会重新出现',()=>{assert.equal(reloaded.status,'ok',reloaded.note);assert.ok(!reloaded.conversations.some(row=>['chat:temporary','chat:unindexed'].includes(row.id)))})
 console.log(`assistant-hub-deletion: ${checks} scenarios passed; synthetic native archive only`)
}finally{rmSync(home,{recursive:true,force:true})}
