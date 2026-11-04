import {installNativeContextFixture,modelText} from './native-context-fixture.mjs'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-knowledge-isolation-'));process.env.DSH_HOME=home
await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export * from './src/host/knowledge/retrieval.ts';export * from './src/host/knowledge/scope.ts';export * from './src/host/knowledge/context.ts';export * from './src/host/assistant/hub-store.ts';export * from './src/shared/knowledge.ts';export {normalizeState} from './src/host/domain/model.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const h=await import(join(home,'host.mjs')),disposers=[],sessions=new Map();let api,checks=0,lastPrompt='',prompts=0
const controller={create:async()=>{const id='isolation-session-'+(sessions.size+1),events=[],session={id,events,get seq(){return events.length},snapshotEvents(from=0){return events.filter(event=>event.seq>from)}};sessions.set(id,session);return {sessionId:id}},rename:async()=>{},state:async()=>({running:false}),prompt:async request=>{lastPrompt=modelText(request);prompts++;const session=sessions.get(request.sessionId);session.events.push({type:'user/message',seq:session.seq+1,data:{content:request.content}},{type:'assistant/message',seq:session.seq+2,data:{message:{content:[{type:'text',text:'合成项目回答'}]}}},{type:'turn/end',seq:session.seq+3,data:{}});return {accepted:true}}}
const ctx={get:key=>key==='sessionController'?controller:key==='sessions'?{get:id=>sessions.get(id),list:()=>[...sessions.values()]}:undefined,provide:(key,value)=>{if(key==='workbench')api=value},inject(){},effect(fn){const dispose=fn();if(typeof dispose==='function')disposers.push(dispose)},logger:{info(){}}};installNativeContextFixture(ctx);h.apply(ctx,{})
const check=(label,fn)=>{fn();checks++;console.log('✓ '+label)}
try{
 await h.mutateWorkbenchState(state=>({...state,settings:{...state.settings,defaultProjectId:'A'},knowledgeSpaces:[{id:'company',name:'公司资料'},{id:'client',name:'客户资料'}],projects:[{id:'A',name:'公司项目A',knowledgeSpaceId:'company'},{id:'B',name:'公司项目B',knowledgeSpaceId:'company'},{id:'C',name:'客户项目',knowledgeSpaceId:'client'}],tasks:[{id:'task-a',projectId:'A',title:'发布验收'},{id:'task-c',projectId:'C',title:'客户发布'}],replies:[{id:'reply-a',taskIds:['task-a']}],sources:[{id:'fake-account-source',locator:{accountId:'aw-test-account'}}],knowledge:[]}))
 for(const input of [
  {title:'个人资料',spaceId:'personal'},
  {title:'公司公共',spaceId:'company'},
  {title:'公司A方案',projectId:'A'},
  {title:'公司B方案',projectId:'B'},
  {title:'客户方案',projectId:'C'},
  {title:'明确共享',spaceId:'personal',sharedAcrossSpaces:true},
  {title:'不同来源同一项目',projectId:'A',accountId:'another-source'},
 ])await api.createKnowledge({...input,body:'接口发布之前执行灰度验收，失败立即回滚。',reviewState:'confirmed'})
 const state=h.loadWorkbenchState(),scope=h.defaultKnowledgeScope(state,{projectId:'A'}),titles=result=>result.hits.map(hit=>hit.title)
 check('项目自动确定知识空间，不从来源账号推断',()=>assert.deepEqual(scope,{projectId:'A',accountId:null,spaceId:'company'}))
 const found=h.retrieveKnowledge(state,'接口发布灰度验收',{scope,limit:8})
 check('当前项目、空间公共和明确共享资料参与检索',()=>assert.deepEqual(new Set(titles(found)),new Set(['公司公共','公司A方案','明确共享','不同来源同一项目'])))
 check('其他项目、其他空间和未共享个人资料不进入结果',()=>assert.ok(!titles(found).some(title=>['个人资料','公司B方案','客户方案'].includes(title))))
 check('不同来源账号可以属于同一项目知识空间',()=>assert.ok(titles(found).includes('不同来源同一项目')))
 check('来源里存在测试账号，不产生知识空间选项',()=>assert.ok(!h.knowledgeSpaces(state).some(space=>space.id.includes('aw-test'))))
 check('手动选错项目与空间被拒绝',()=>assert.throws(()=>h.defaultKnowledgeScope(state,{spaceId:'client',projectId:'A'}),/不属于/))
 check('不存在的知识空间被拒绝',()=>assert.throws(()=>h.defaultKnowledgeScope(state,{spaceId:'missing',projectId:null}),/不存在/))
 check('已失去工程关联的研发事项不误用默认项目知识',()=>assert.equal(h.assistantKnowledgeScope(state,{conversationId:'development:gone'},{issue:{id:'remote'},projectId:'deleted-project',cwd:home}).projectId,null))
 check('任务会话无需手动refs也继承项目',()=>assert.equal(h.assistantKnowledgeScope(state,{conversationId:'task:task-c'}).projectId,'C'))
 check('任务关联回复继承任务项目',()=>assert.equal(h.assistantKnowledgeScope(state,{conversationId:'reply:reply-a'}).projectId,'A'))
 check('显式把任务指向其他项目被拒绝',()=>assert.throws(()=>h.assistantKnowledgeScope(state,{conversationId:'task:task-a',projectId:'C'}),/不一致/))
 const sent=await api.assistantHub({action:'send',conversationId:'task:task-a',text:'接口灰度验收方案如何处理？'})
 check('真实Host发送链路自动检索项目并将知识原文注入上下文',()=>{assert.equal(sent.status,'ok',sent.note);assert.equal(sent.retrieval.scope.projectId,'A');assert.equal(sent.retrieval.scope.spaceId,'company');assert.ok(lastPrompt.includes('公司A方案'));assert.ok(lastPrompt.includes('接口发布之前执行灰度验收'));assert.ok(!lastPrompt.includes('客户方案'));assert.ok(!lastPrompt.includes('公司B方案'))})
 const sentCount=prompts,rejected=await api.assistantHub({action:'send',conversationId:'task:task-a',sessionId:sent.sessionId,knowledgeScope:{projectId:'C',spaceId:'client'},text:'继续说明'})
 check('跨范围复用原事项会话在调用模型前被拒绝',()=>{assert.equal(rejected.status,'error');assert.equal(prompts,sentCount);assert.ok(sessions.has(sent.sessionId))})
 const client=state.knowledge.find(doc=>doc.title==='客户方案')
 check('手动添加跨项目知识不会绕过上下文检查',()=>assert.throws(()=>h.assistantKnowledgeScope(state,{conversationId:'task:task-a',refs:[{kind:'knowledge',id:client.id}]}),/同一项目/))
 const foreignHit=h.retrieveKnowledge(state,'接口发布',{scope:{projectId:'C'},limit:8}).hits.find(hit=>hit.title==='客户方案')
 check('引用原文读取再次检查空间',()=>assert.throws(()=>h.readKnowledgeChunks(state,[foreignHit.id],scope),/当前范围/))
 const own=found.hits.find(hit=>hit.title==='公司A方案'),version=h.knowledgeVersion(state.knowledge.find(doc=>doc.id===own.documentId))
 await api.updateKnowledge(own.documentId,{body:'接口发布只走新版规范',reviewState:'confirmed'})
 check('更新后旧片段版本失效',()=>assert.throws(()=>h.readKnowledgeChunks(h.loadWorkbenchState(),[own.id],scope),/版本已更新/))
 await h.recordRetrieval(found,'same-session',0)
 await assert.rejects(()=>h.retrieveAssistantKnowledge(h.loadWorkbenchState(),'继续说明',{sessionId:'same-session',projectId:'C'}),/历史不同/);checks++
 await assert.rejects(()=>h.retrieveAssistantKnowledge(h.loadWorkbenchState(),'继续说明',{sessionId:'same-session',projectId:'C',knowledgeMode:'off'}),/历史不同/);checks++
 // Legacy development chats recorded neither project nor space, even with a bound code directory.
 const oldScope={projectId:null,accountId:null},newScope={projectId:'P',accountId:null,spaceId:'personal'}
 await h.mutateWorkbenchState(s=>{s.projects.push({id:'P',name:'个人空间工程',knowledgeSpaceId:'personal'});s.tasks.push({id:'legacy-task',projectId:'P',title:'旧工程事项'});return s})
 const legacySession=(await controller.create()).sessionId
 h.rememberHubSession('task:legacy-task',legacySession,'旧工程事项');h.setHubSessionKnowledgeScope(legacySession,oldScope)
 const emptyTrace={id:'old-empty',scope:oldScope,status:'empty',hits:[],query:'旧讨论',mode:'auto',strategy:'legacy',elapsedMs:0}
 await h.recordRetrieval(emptyTrace,legacySession,0)
 check('有绑定目录的研发事项从自身项目继承知识范围',()=>assert.equal(h.assistantKnowledgeScope(h.loadWorkbenchState(),{conversationId:'development:legacy'},{issue:{id:'issue'},projectId:'P',cwd:home}).projectId,'P'))
 check('旧版空范围、空检索仅允许继承同一空间中的有效项目',()=>assert.equal(h.canInheritLegacyKnowledgeScope(h.loadWorkbenchState(),legacySession,oldScope,newScope),true))
 const incompatible=[
  ['换项目',{projectId:'A',accountId:null},newScope],
  ['换账号',oldScope,{...newScope,accountId:'another'}],
  ['换知识空间',oldScope,{projectId:'A',accountId:null,spaceId:'company'}],
  ['不存在的项目',oldScope,{...newScope,projectId:'missing'}],
  ['新版明确的空范围',{...oldScope,spaceId:'personal'},newScope],
 ]
 for(const [label,from,to] of incompatible)check('旧版兼容不放开'+label,()=>assert.equal(h.canInheritLegacyKnowledgeScope(h.loadWorkbenchState(),legacySession,from,to),false))
 const evidenceState=h.loadWorkbenchState(),otherTrace={...emptyTrace,sessionId:legacySession,status:'ok',hits:[{id:'old-hit'}]}
 check('较早轮次已带入知识时不能仅看最后一次空结果放行',()=>assert.equal(h.canInheritLegacyKnowledgeScope({...evidenceState,retrievalTraces:[otherTrace,...evidenceState.retrievalTraces]},legacySession,oldScope,newScope),false))
 check('没有历史检索证据时不自动修改旧会话范围',()=>assert.equal(h.canInheritLegacyKnowledgeScope({...evidenceState,retrievalTraces:[]},legacySession,oldScope,newScope),false))
 const sessionCount=sessions.size,continued=await api.assistantHub({action:'send',conversationId:'task:legacy-task',sessionId:legacySession,text:'解释接下来的处理方案'})
 check('真实Host发送链路兼容旧范围并继续原会话，不创建替代会话',()=>{assert.equal(continued.status,'ok',continued.note);assert.equal(continued.sessionId,legacySession);assert.equal(sessions.size,sessionCount);assert.equal(continued.retrieval.scope.projectId,'P');assert.equal(h.hubSessionKnowledgeScope(legacySession).projectId,'P')})
 const next=await api.assistantHub({action:'send',conversationId:'task:legacy-task',sessionId:legacySession,text:'继续解释下一步'})
 check('兼容后再次发送仍用原会话，范围记录持久一致',()=>{assert.equal(next.status,'ok',next.note);assert.equal(next.sessionId,legacySession);assert.equal(sessions.size,sessionCount);assert.equal(h.loadWorkbenchState().retrievalTraces.filter(row=>row.sessionId===legacySession).at(-1).scope.projectId,'P')})
 const before=h.loadWorkbenchState().knowledge.length
 await api.createKnowledge({title:'同名知识',body:'同名有效知识',spaceId:'company',reviewState:'confirmed'});await api.createKnowledge({title:'同名知识',body:'同名有效知识',spaceId:'client',reviewState:'confirmed'})
 check('跨空间同名资料不会被错误去重',()=>assert.equal(h.loadWorkbenchState().knowledge.length,before+2))
 await assert.rejects(()=>api.createKnowledge({title:'非法共享',body:'内部资料',projectId:'A',sharedAcrossSpaces:true}),/只有个人通用/);checks++
 await api.knowledgeSpace({action:'assignProject',projectId:'A',spaceId:'client'})
 check('设置项目归属后资料与项目一起移动并保留来源',()=>{const next=h.loadWorkbenchState(),doc=next.knowledge.find(row=>row.title==='不同来源同一项目');assert.equal(next.projects.find(row=>row.id==='A').knowledgeSpaceId,'client');assert.equal(doc.spaceId,'client');assert.equal(doc.accountId,'another-source');assert.notEqual(h.knowledgeVersion(next.knowledge.find(doc=>doc.id===own.documentId)),version)})
 const legacy=h.normalizeState({...h.loadWorkbenchState(),knowledge:[{id:'legacy',title:'旧账号资料',body:'接口发布验收',accountId:'org:owner',reviewState:'confirmed'}]}).state
 check('旧账号专属资料保持独立空间，不提升为个人通用',()=>{assert.equal(legacy.knowledge[0].spaceId,'source:org:owner');assert.equal(h.retrieveKnowledge(legacy,'接口发布验收',{scope:{projectId:null,spaceId:'personal'}}).hits.length,0);assert.equal(h.retrieveKnowledge(legacy,'接口发布验收',{scope:{projectId:null,spaceId:'source:org:owner'}}).hits.length,1)})
 const pack=await api.exportMigration();check('便携导出保留空间及项目归属',()=>{assert.equal(pack.data.knowledgeSpaces.length,2);assert.equal(pack.data.projects.find(row=>row.id==='A').knowledgeSpaceId,'client')})
 const engine=await api.knowledgeEngine({});check('首次安装不下载模型、不启用Worker',()=>{assert.equal(engine.enabled,false);assert.equal(engine.workerActive,false);assert.equal(engine.phase,'idle')})
 console.log('knowledge-isolation: '+checks+' checks passed')
}finally{disposers.forEach(dispose=>dispose());rmSync(home,{recursive:true,force:true})}
