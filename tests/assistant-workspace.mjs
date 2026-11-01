/** Native workspace contracts over disposable directories; no model or external calls. */
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,symlinkSync,realpathSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=realpathSync(mkdtempSync(join(tmpdir(),'workbench-assistant-workspace-')));process.env.DSH_HOME=home
try{
 await build({stdin:{contents:`export * from './src/host/assistant/hub-workspace.ts';export {loadWorkbenchState as state,mutateWorkbenchState as mutate} from './src/host/storage/state-store.ts';export {saveDevelopmentTask} from './src/host/storage/development-store.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'fixture.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(join(home,'fixture.mjs')),project=join(home,'project'),other=join(home,'other'),worktree=join(home,'worktree'),alias=join(home,'project-alias');for(const path of [project,other,worktree])mkdirSync(path);symlinkSync(project,alias)
 let count=0,created=0,registered=0,attached=0,attachFailures=0,partialFailures=0,registryAvailable=true,returnCold=false,resolveFails=false;const sessions=new Map(),cold=new Map(),workspaces=new Map(),requests=[],saved=new Map(),check=(name,fn)=>{fn();count++;console.log('✓ '+name)}
 const registry={list:()=>[...workspaces.values()],async create(path){registered++;path=realpathSync(path);let workspace=[...workspaces.values()].find(row=>row.path===path);if(!workspace){workspace={id:'ws-'+workspaces.size,path,title:'用户自定义分组 '+workspaces.size,sessionIds:[],async attachSession(id){attached++;if(attachFailures-- >0)throw Error('synthetic attach failed');const native=sessions.get(id)||cold.get(id);assert.equal(realpathSync(native.header.cwd),this.path);if(!this.sessionIds.includes(id))this.sessionIds.push(id)}};workspaces.set(workspace.id,workspace)}return workspace}}
 const controller={async create(request){requests.push(request);const workspace=request.workspaceId?workspaces.get(request.workspaceId):null,id='native-'+(++created),session={id,header:{cwd:workspace?.path||request.cwd},snapshotEvents:()=>[],seq:0};sessions.set(id,session);if(partialFailures-- >0)throw Object.assign(Error('synthetic partial creation failure'),{code:'session/workspace-attach-failed',details:{sessionId:id}});if(workspace)try{await workspace.attachSession(id)}catch(error){throw Object.assign(Error(error.message),{code:'session/workspace-attach-failed',details:{sessionId:id,workspaceId:workspace.id}})}if(returnCold){sessions.delete(id);cold.set(id,session);return {sessionId:id}}return {session}},async resolveAgent(id){if(resolveFails)throw Error('synthetic cold failure');const session=cold.get(id);sessions.set(id,session);return {agent:{session}}}}
 const ctx={get:key=>({sessionController:controller,sessions:{get:id=>sessions.get(id)},workspaceRegistry:registryAvailable?registry:undefined,workingDirectory:{defaultDirectory:home}})[key]}
 await h.mutate(s=>{s.projects=[{id:'p',name:'项目',repoPath:project},{id:'alias',name:'别名',repoPath:alias},{id:'other',name:'其他项目',repoPath:other},{id:'no-dir',name:'未选目录',repoPath:''}];s.tasks=[{id:'one',title:'一',projectId:'p'},{id:'two',title:'二',projectId:'p'},{id:'alias-task',title:'别名事项',projectId:'alias'},{id:'free',title:'未绑定事项',projectId:null},{id:'empty-path',title:'无目录项目',projectId:'no-dir'}];s.sources=[{id:'src',projectId:'p'}];s.replies=[{id:'reply',sourceId:'src',taskIds:[]},{id:'linked',taskIds:['one','two']},{id:'ambiguous',taskIds:['one','other-task']}];s.tasks.push({id:'other-task',projectId:'other'});return s})
 const task=id=>({id:'task:'+id,kind:'task',entityId:id}),create=async conversation=>h.createHubWorkspaceSession(ctx,conversation,id=>saved.set(conversation.id,id))
 const pending=h.readHubWorkspace(ctx,task('one'))
 check('首次打开事项只读展示配置目录，尚未绑定工作区不会创建原生记录',()=>{assert.equal(pending.workspaceState,'pending');assert.equal(pending.cwd,realpathSync(project));assert.equal(created,0);assert.equal(registered,0)})
 const first=await create(task('one')),second=await create(task('two')),group=registry.list()[0]
 check('同目录不同事项复用原生工作区，各自拥有独立会话',()=>{assert.notEqual(first.id,second.id);assert.equal(workspaces.size,1);assert.equal(saved.get('task:one'),first.id);assert.deepEqual(group.sessionIds,[first.id,second.id]);assert.ok(requests.every(request=>request.workspaceId&&!request.cwd&&!request.sessionId))})
 const title=group.title,byAlias=await create(task('alias-task'))
 check('目录软链接归同一工作区，不修改已有工作区名称',()=>{assert.equal(workspaces.size,1);assert.ok(group.sessionIds.includes(byAlias.id));assert.equal(group.title,title)})
 const beforeMetadata={created,registered,attached};sessions.delete(first.id);cold.set(first.id,first);const coldView=h.readHubWorkspace(ctx,task('one'),first.id)
 check('冷会话以原生持久成员关系展示绑定信息，列表读取不修复或新建',()=>{assert.equal(coldView.workspaceId,group.id);assert.equal(coldView.workspaceTitle,title);assert.equal(coldView.workspaceState,'bound');assert.deepEqual({created,registered,attached},beforeMetadata)})
 sessions.set(first.id,first);await h.ensureHubWorkspace(ctx,task('one'),first)
 check('原有工作区成员继续会话无需重复注册或附加',()=>assert.deepEqual({created,registered,attached},beforeMetadata))
 const mismatchedLive={...first,header:{cwd:other}};sessions.set(first.id,mismatchedLive);const mismatchView=h.readHubWorkspace(ctx,task('one'),first.id);await assert.rejects(h.ensureHubWorkspace(ctx,task('one'),mismatchedLive),/运行目录.*工作区/)
 check('已加载原生运行目录与登记工作区冲突时阻止发送，保留原归组信息',()=>{assert.equal(mismatchView.workspaceState,'unavailable');assert.equal(mismatchView.workspaceId,group.id);assert.equal(mismatchView.cwd,project);assert.deepEqual({created,registered,attached},beforeMetadata)})
 sessions.delete(first.id);const beforeRestoreView=h.readHubWorkspace(ctx,task('one'),first.id),afterRestoreView=h.readHubWorkspace(ctx,task('one'),first.id,h.state(),mismatchedLive);await assert.rejects(h.ensureHubWorkspace(ctx,{id:'chat:'+first.id,kind:'chat'},mismatchedLive),/运行目录.*工作区/)
 check('冷列表保留登记信息，恢复详情即使未注册到sessions也校验真实运行目录',()=>{assert.equal(beforeRestoreView.workspaceState,'bound');assert.equal(afterRestoreView.workspaceState,'unavailable');assert.equal(afterRestoreView.workspaceId,group.id);assert.deepEqual({created,registered,attached},beforeMetadata)})
 sessions.set(first.id,first)
 group.sessionIds=group.sessionIds.filter(id=>id!==first.id);await h.ensureHubWorkspace(ctx,task('one'),first)
 check('显式发送只修复同目录旧会话归组，保留原生日志ID',()=>{assert.equal(created,beforeMetadata.created);assert.ok(group.sessionIds.includes(first.id));assert.equal(saved.get('task:one'),first.id)})
 const wrong={id:'wrong-native',header:{cwd:other},seq:0,snapshotEvents:()=>[]};sessions.set(wrong.id,wrong);const beforeMismatch={created,registered,attached};await assert.rejects(h.ensureHubWorkspace(ctx,task('one'),wrong),/目录.*不同/)
 check('旧会话目录不匹配时明确暂停，不搬家也不创建替代会话',()=>{assert.deepEqual({created,registered,attached},beforeMismatch);assert.equal(h.readHubWorkspace(ctx,task('one'),wrong.id).workspaceState,'unavailable');assert.equal(wrong.header.cwd,other)})
 const otherGroup=await registry.create(other);await otherGroup.attachSession(wrong.id);await assert.rejects(h.ensureHubWorkspace(ctx,task('one'),wrong),/工作区.*不同/);const conflicting=h.readHubWorkspace(ctx,task('one'),wrong.id)
 check('事项配置与原生工作区冲突明确暂停，仍展示实际归组且不移动原会话',()=>{assert.equal(conflicting.workspaceId,otherGroup.id);assert.equal(conflicting.cwd,other);assert.equal(conflicting.workspaceState,'unavailable');assert.ok(!group.sessionIds.includes(wrong.id));assert.ok(otherGroup.sessionIds.includes(wrong.id))})
 const existing=await h.ensureHubWorkspace(ctx,{id:'chat:'+wrong.id,kind:'chat',cwd:project},wrong)
 check('普通已知聊天保持原生工作区，不被请求路径或全局目录接管',()=>{assert.equal(existing.workspaceId,otherGroup.id);assert.equal(existing.cwd,other);assert.equal(existing.workspaceState,'bound')})
 attachFailures=1;const beforeFailure=created;await assert.rejects(create(task('two')),/synthetic attach failed/);const interrupted=saved.get('task:two'),native=sessions.get(interrupted)
 check('创建后归组失败仍立即记住原生ID',()=>{assert.equal(created,beforeFailure+1);assert.ok(interrupted);assert.equal(native.header.cwd,project)})
 await h.ensureHubWorkspace(ctx,task('two'),native)
 check('归组失败重试只补成员关系，不能再建一个会话',()=>{assert.equal(created,beforeFailure+1);assert.ok(group.sessionIds.includes(interrupted));assert.equal(saved.get('task:two'),interrupted)})
 registryAvailable=false;const beforeUnavailable=created,unavailableView=h.readHubWorkspace(ctx,task('one'),first.id);await assert.rejects(create(task('one')),/没有 Harness 工作区服务/);await assert.rejects(h.ensureHubWorkspace(ctx,task('one'),first),/没有 Harness 工作区服务/);registryAvailable=true
 check('宿主无工作区服务时元数据不可用且禁止发送或创建未分组替代会话',()=>{assert.equal(created,beforeUnavailable);assert.equal(unavailableView.workspaceState,'unavailable');assert.match(unavailableView.workspaceError,/没有 Harness 工作区服务/)})
 const free=await create({...task('free'),cwd:project,workspaceId:group.id}),freeView=h.readHubWorkspace(ctx,task('free'),free.id)
 check('无项目绑定的会话保持无工作区，请求里的任意路径和workspaceId无效',()=>{assert.equal(freeView.workspaceState,'unbound');assert.equal(freeView.cwd,home);assert.equal(requests.at(-1).workspaceId,undefined);assert.ok(registry.list().every(workspace=>!workspace.sessionIds.includes(free.id)))})
 await create(task('empty-path'));check('仅选项目未配置目录不伪称已绑定工作区',()=>assert.equal(h.readHubWorkspace(ctx,task('empty-path'),saved.get('task:empty-path')).workspaceState,'unbound'))
 const reply=await create({id:'reply:reply',kind:'reply',entityId:'reply'}),linked=await create({id:'reply:linked',kind:'reply',entityId:'linked'})
 check('回复使用明确来源项目或关联事项的唯一项目目录',()=>{assert.ok(group.sessionIds.includes(reply.id));assert.ok(group.sessionIds.includes(linked.id));assert.equal(workspaces.size,2)})
 const ambiguous=await create({id:'reply:ambiguous',kind:'reply',entityId:'ambiguous'})
 check('关联多个工程的回复不猜选工作目录',()=>assert.equal(h.readHubWorkspace(ctx,{id:'reply:ambiguous',kind:'reply'},ambiguous.id).workspaceState,'unbound'))
 h.saveDevelopmentTask({id:'dev',projectId:'p',cwd:worktree,sessionId:'existing-dev',issue:{id:'issue',code:'US-TEST',title:'测试'},status:'ready',steps:[]})
 const dev=await create({id:'development:dev',kind:'development',entityId:'dev'}),devView=h.readHubWorkspace(ctx,{id:'development:dev',kind:'development',entityId:'dev'},dev.id)
 check('研发使用实际开发工作区，不误用源工程目录',()=>{assert.equal(devView.cwd,worktree);assert.notEqual(devView.workspaceId,group.id);assert.equal(sessions.get(dev.id).header.cwd,worktree)})
 returnCold=true;const coldCreated=await create(task('one'));check('原生创建只返回sessionId时恢复同一持久会话',()=>{assert.equal(coldCreated.id,saved.get('task:one'));assert.ok(group.sessionIds.includes(coldCreated.id))})
 resolveFails=true;const beforeResolveFailure=created;await assert.rejects(create(task('two')),/synthetic cold failure/);resolveFails=false;const savedColdId=saved.get('task:two'),restored=(await controller.resolveAgent(savedColdId)).agent.session;await h.ensureHubWorkspace(ctx,task('two'),restored)
 check('原生恢复失败仍保留已经创建的ID供重试',()=>{assert.equal(created,beforeResolveFailure+1);assert.equal(restored.id,savedColdId);assert.ok(group.sessionIds.includes(savedColdId))})
 const coldFree=await create(task('free'));check('无项目会话创建仅返回ID时先保存再恢复，沿用宿主默认目录',()=>{assert.equal(coldFree.id,saved.get('task:free'));assert.deepEqual(requests.at(-1),{cwd:home});assert.equal(h.readHubWorkspace(ctx,task('free'),coldFree.id).workspaceState,'unbound')})
 resolveFails=true;const beforeFreeRestore=created;await assert.rejects(create(task('free')),/synthetic cold failure/);resolveFails=false;const savedFreeId=saved.get('task:free'),restoredFree=(await controller.resolveAgent(savedFreeId)).agent.session;await h.ensureHubWorkspace(ctx,task('free'),restoredFree)
 check('无项目会话恢复失败保留ID，重试恢复同一会话不再次创建',()=>{assert.equal(created,beforeFreeRestore+1);assert.equal(restoredFree.id,savedFreeId);assert.equal(restoredFree.header.cwd,home)})
 partialFailures=1;const beforeFreePartial=created;await assert.rejects(create(task('free')),/synthetic partial creation failure/);const partialFreeId=saved.get('task:free');await h.ensureHubWorkspace(ctx,task('free'),sessions.get(partialFreeId))
 check('无项目会话创建部分成功异常同样保留ID，恢复不新建',()=>{assert.equal(created,beforeFreePartial+1);assert.equal(partialFreeId,'native-'+created);assert.equal(sessions.get(partialFreeId).header.cwd,home)})
 await h.mutate(s=>{s.projects.push({id:'missing',repoPath:join(home,'missing')});s.tasks.push({id:'invalid',projectId:'missing'});return s});const beforeInvalid=created;await assert.rejects(create(task('invalid')),/ENOENT/)
 check('失效的可信配置目录显示不可用并阻止创建',()=>{assert.equal(created,beforeInvalid);assert.equal(h.readHubWorkspace(ctx,task('invalid')).workspaceState,'unavailable')})
 console.log('assistant-workspace: '+count+' scenarios passed')
}finally{rmSync(home,{recursive:true,force:true})}
