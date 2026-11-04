/** Real membership guards on synthetic native Sessions; never touches user state. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'hub-admission-'));process.env.DSH_HOME=home
try{
 await build({stdin:{contents:`export {assistantHub} from './src/host/assistant/hub.ts';export * from './src/host/assistant/hub-store.ts';export {rememberTaskThread} from './src/host/assistant/task-threads.ts';export {saveDevelopmentTask} from './src/host/storage/development-store.ts';export {mutateWorkbenchState,loadWorkbenchState,claimWorkbenchOwnership} from './src/host/storage/state-store.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(join(home,'host.mjs')),sessions=new Map(),archived=[],workspaces=[{id:'project-space',title:'已登记工程',path:home,sessionIds:[]}];let created=0,prompts=0,archives=0,renames=0,checks=0,nativeLists=0
 function native(id,title=id){const row={id,header:{cwd:home,title},seq:0,snapshotEvents:()=>[{type:'assistant/message',seq:1,data:{message:{content:[{type:'text',text:'PRIVATE_NATIVE_CONTENT'}]}}}]};sessions.set(id,row);return row}
 const controller={async create(){created++;return {session:native('created-'+created)}},async prompt(){prompts++},async rename(){renames++}},ctx={get:key=>({sessions:{get:id=>sessions.get(id),list:()=>{nativeLists++;return [...sessions.values()]}},sessionController:controller,workspaceRegistry:{list:()=>workspaces,archivedSessionIds:archived,async archiveSession(){archives++}}})[key]},hub=request=>h.assistantHub(ctx,request),check=(name,fn)=>{fn();checks++;console.log('✓ '+name)}
 const external=native('external','外部工程会话'),same=native('same-directory','同目录的其他原生会话'),legacy=native('legacy','旧版已接入的会话'),office=native('office','旧办公会话'),task=native('task','事项原会话'),development=native('development','研发主会话'),background=native('background','识别后台'),child=native('child','子智能体'),phantom=native('phantom','只有空索引的会话')
 child.header.parentSession='task';workspaces[0].sessionIds.push(external.id,same.id,development.id,task.id)
 await h.mutateWorkbenchState(s=>{s.projects=[{id:'P',name:'已登记工程',repoPath:home}];s.tasks=[{id:'t',title:'已接入待办',projectId:'P'}];s.settings.assistantSessionId=office.id;return s})
 h.rememberHubSession('chat:legacy',legacy.id,'旧版已接入的会话');h.rememberTaskThread('t',task.id,'已接入待办');h.rememberHubSession('system:analysis',background.id,'消息识别');h.rememberHubConversation('chat:phantom','空索引')
 h.saveDevelopmentTask({id:'d',issue:{code:'US-SYNTHETIC',title:'绑定研发'},projectId:'P',cwd:home,sessionId:development.id,status:'paused',stage:'analysis',steps:[],createdAt:new Date().toISOString()})
 const beforeIndex=h.hubIndex(),beforeState=h.loadWorkbenchState(),beforeNative=JSON.stringify([...sessions]),beforeWorkspaces=JSON.stringify(workspaces),listed=await hub({action:'list'}),ids=listed.conversations.map(row=>row.id)
 check('仅显示固定系统、已绑定事项、研发以及旧版明确会话',()=>{for(const id of ['system:analysis','system:radar','system:knowledge','task:t','development:d','chat:legacy','chat:office'])assert.ok(ids.includes(id),id)})
 check('外部工程、同一已登记目录中的其它会话都不自动进入列表',()=>{assert.equal(nativeLists,0);for(const id of ['external','same-directory','child','phantom'])assert.ok(!ids.includes('chat:'+id),id)})
 check('列表读取不建立关系，不改目录、标题、会话或项目',()=>{assert.deepEqual(h.hubIndex(),beforeIndex);assert.deepEqual(h.loadWorkbenchState(),beforeState);assert.equal(JSON.stringify([...sessions]),beforeNative);assert.equal(JSON.stringify(workspaces),beforeWorkspaces);assert.equal(created+prompts+archives+renames,0)})
 for(const action of ['detail','history','delta','send','prepareAttachments','select','pin','delete','reset','operate']){
  const result=await hub({action,conversationId:'chat:external',sessionId:external.id,text:'不能绕过归属检查',pinned:true,confirmed:true,operation:'busyReply.status'})
  check('未接入会话不能绕过列表直接使用 '+action,()=>{assert.equal(result.status,'error');assert.match(result.note,/尚未接入/);assert.equal(created+prompts+archives+renames,0)})
 }
 check('拒绝直连不留下轮次、索引或隐式关联',()=>assert.deepEqual(h.hubIndex(),beforeIndex))
 const candidates=await hub({action:'availableSessions'}),available=candidates.sessions.map(row=>row.sessionId)
 check('只有明确打开接入选择器才列出可接入外部会话，过滤业务/后台/子会话',()=>{assert.equal(candidates.status,'ok');for(const id of ['external','same-directory','phantom'])assert.ok(available.includes(id));for(const id of ['legacy','office','task','development','background','child'])assert.ok(!available.includes(id));assert.ok(!JSON.stringify(candidates).includes('PRIVATE_NATIVE_CONTENT'));assert.deepEqual(h.hubIndex(),beforeIndex)})
 const preview=await hub({action:'adopt',sessionId:external.id})
 check('接入预览不修改索引，需用户明确选择确认',()=>{assert.equal(preview.status,'confirmation_required');assert.deepEqual(h.hubIndex(),beforeIndex)})
 const adopted=await hub({action:'adopt',sessionId:external.id,confirmed:true}),row=h.hubIndex().conversations.find(row=>row.id===adopted.conversationId)
 check('确认后关联原生ID并记录明确来源，保留原历史与工作区',()=>{assert.equal(adopted.status,'ok',adopted.note);assert.equal(adopted.conversationId,'chat:external');assert.equal(row.activeId,external.id);assert.equal(row.admission.origin,'adopted');assert.equal(row.admission.sessionId,external.id);assert.equal(JSON.stringify([...sessions]),beforeNative);assert.equal(JSON.stringify(workspaces),beforeWorkspaces);assert.equal(created+prompts+archives+renames,0);assert.equal(h.loadWorkbenchState().projects.length,1)})
 const detail=await hub({action:'detail',conversationId:adopted.conversationId}),afterList=await hub({action:'list'})
 check('接入后才可以读取原历史，使用同一会话，列表仍不收入其它外部会话',()=>{assert.equal(detail.status,'ok',detail.note);assert.equal(detail.sessionId,external.id);assert.equal(detail.messages[0].text,'PRIVATE_NATIVE_CONTENT');assert.ok(afterList.conversations.some(row=>row.id==='chat:external'));assert.ok(!afterList.conversations.some(row=>row.id==='chat:same-directory'))})
 const duplicate=await hub({action:'adopt',sessionId:external.id,confirmed:true})
 check('重复接入不新增原生会话，也不创建重复列表记录',()=>{assert.equal(duplicate.status,'ok');assert.equal(h.hubIndex().conversations.filter(row=>row.id==='chat:external').length,1);assert.equal(created+prompts,0)})
 h.rememberTaskThread('t',same.id,'选择器打开后已关联待办')
 const changed=await hub({action:'adopt',sessionId:same.id,confirmed:true})
 check('选择期间归属已变化时重新检查，不能抢占事项会话',()=>{assert.equal(changed.status,'error');assert.ok(!h.hubIndex().conversations.some(row=>row.id==='chat:'+same.id))})
 for(const id of ['task','development','background','child'])check('专用会话不能接成普通对话 '+id,()=>{})
 for(const id of ['task','development','background','child'])assert.equal((await hub({action:'adopt',sessionId:id,confirmed:true})).status,'error')
 sessions.delete(phantom.id);const stale=await hub({action:'adopt',sessionId:phantom.id,confirmed:true})
 check('原会话已卸载时不创建替代，不错误绑定空索引',()=>{assert.equal(stale.status,'error');assert.match(stale.note,/尚未加载/);assert.equal(created,0)})
 const fresh=await hub({action:'reset'}),freshRow=h.hubIndex().conversations.find(row=>row.id===fresh.conversationId)
 check('助手内显式新建的对话记录created来源并正常进入列表',()=>{assert.equal(fresh.status,'ok',fresh.note);assert.equal(freshRow.admission.origin,'created');assert.equal(freshRow.admission.sessionId,fresh.sessionId);assert.equal(created,1)})
 archived.push(external.id);assert.ok(!(await hub({action:'list'})).conversations.some(row=>row.id==='chat:external'));archived.length=0
 const reopened=await import(join(home,'host.mjs')+'?reopen');reopened.claimWorkbenchOwnership();const again=await reopened.assistantHub(ctx,{action:'list'});assert.equal(again.status,'ok',again.note)
 check('重新加载后明确绑定持久保留，未接入项目仍隐藏',()=>{assert.ok(again.conversations.some(row=>row.id==='chat:external'));assert.ok(again.conversations.some(row=>row.id===fresh.conversationId));assert.ok(!again.conversations.some(row=>row.id==='chat:phantom'));assert.equal(JSON.parse(readFileSync(join(home,'storages/dev-workbench/assistant-hub.json'),'utf8')).conversations.find(row=>row.id==='chat:external').admission.sessionId,'external')})
 console.log('assistant-admission: '+checks+' checks passed; no real conversations changed')
}finally{rmSync(home,{recursive:true,force:true})}
