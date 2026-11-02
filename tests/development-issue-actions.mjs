/** Disposable profile and synthetic CLI only; no network or real work-item writes. */
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'development-issue-actions-'));process.env.DSH_HOME=home
let checks=0
try{
 await build({stdin:{contents:`export * from './src/host/assistant/assistant-actions.ts';export {assistantHub} from './src/host/assistant/hub.ts';export {officeToolDefinitions} from './src/host/api/office-tools.ts';export {setShared_workbenchCtx} from './src/host/application/workbench-service.ts';export * from './src/host/storage/development-store.ts';export {updateDevelopmentIssue} from './src/host/application/development-issues.ts';export {mutateWorkbenchState} from './src/host/storage/state-store.ts';export {rememberHubSession} from './src/host/assistant/hub-store.ts';export {assistantActionEvents} from './src/host/assistant/action-store.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(join(home,'host.mjs')),cli=join(home,'linky-fixture');writeFileSync(cli,'#!/bin/sh\nexit 99\n',{mode:0o700})
 let issue={id:'issue-fixture',code:'US-FIXTURE-1',title:'原需求',description:'原需求说明',status:{key:'todo',name:'待处理'},workspace_id:'bound-workspace',type:'user_story'}
 const calls=[],writes=[];let failReadback=false,failNextShow=false,mismatch=false,gate=null,wrongPlan=false
 const targets=[{key:'doing',name:'开发中',category:'in_progress',allowed:true,form:{comment_mode:'optional',fields:[]}},{key:'reviewed',name:'需求评审完成',category:'in_progress',allowed:true,form:{comment_mode:'required',fields:[{column_key:'reviewer',name:'评审人员',required:true,default:null,supported:true}]}},{key:'done',name:'发布完成',category:'done',allowed:false,reason:'no_transition',form:null}]
 const ctx={get(name){if(name!=='subprocess')return;return {spawn(spec){
  calls.push(spec.argv.slice());const args=spec.argv.slice(spec.argv.indexOf('issue')+1),kind=args[0],isWrite=kind==='update'||kind==='move'&&args[2]!=='--output'
  assert.equal(spec.argv[spec.argv.indexOf('--profile')+1],'bound-profile');assert.equal(spec.argv[spec.argv.indexOf('--workspace-id')+1],'bound-workspace');assert.equal(args[1],'issue-fixture')
  let result,exitCode=0
  if(kind==='show'){if(failNextShow){failNextShow=false;exitCode=1;result={error:'synthetic unreadable'}}else result={...issue}}
  else if(kind==='move'&&!isWrite)result={issue:{id:wrongPlan?'wrong-issue':issue.id,workspace_id:issue.workspace_id},current:issue.status,targets}
  else if(isWrite){
   writes.push(spec.argv.slice());if(!mismatch){if(kind==='update'){for(const [flag,key] of [['--title','title'],['--description','description']])if(args.includes(flag))issue={...issue,[key]:args[args.indexOf(flag)+1]}}else{const target=targets.find(t=>t.key===args[2]);assert.ok(target?.allowed);if(args.includes('--fields-file')){const fields=JSON.parse(readFileSync(args[args.indexOf('--fields-file')+1],'utf8'));assert.deepEqual(fields,{reviewer:'明确指定的评审人'})}issue={...issue,status:{key:target.key,name:target.name}}}}
   if(failReadback){failReadback=false;failNextShow=true}result={success:true}
  }else throw Error('unexpected synthetic CLI command '+JSON.stringify(args))
  const text=JSON.stringify(result),done=gate&&isWrite?gate.then(()=>({exitCode})) :Promise.resolve({exitCode})
  return {done,collected:{stdout:{readFrom:()=>({text})},stderr:{readFrom:()=>({text:''})}}}
 }}}}
 h.setShared_workbenchCtx(ctx);await h.mutateWorkbenchState(s=>s);h.saveDevelopmentConfig({cliPath:cli,profile:'unrelated-default',workspaceId:'unrelated-workspace'})
 const initial={id:'dev-fixture',issue:{id:issue.id,code:issue.code,title:issue.title,description:issue.description,status:'待处理',workspaceId:issue.workspace_id,type:'user_story'},profile:'bound-profile',projectId:'project-fixture',cwd:home,branch:'',workspaceMode:'directory',sessionId:'main-session',reviewSessionId:'review-session',status:'paused',stage:'test',pauseReason:'测试失败，退出码 1',steps:[{stage:'test',status:'failed',at:'2026-11-01T00:00:00Z',exitCode:1}],createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z'}
 h.saveDevelopmentTask(initial);h.rememberHubSession('development:dev-fixture','main-session','合成研发');h.rememberHubSession('development:dev-fixture','review-session','只读审查')
 const tool=h.officeToolDefinitions().find(t=>t.name==='workbench_assistant_action'),execution={agent:{session:{id:'main-session'}}}
 const invoke=(operation,extra={})=>tool.execute({operation,...extra},execution),verify=(name,fn)=>{fn();checks++;console.log('✓ '+name)}
 let result=await invoke('development.issue.get')
 verify('按绑定 profile/工作空间读取真实工作项、可用流转和本地执行状态',()=>{assert.equal(result.issue.title,'原需求');assert.equal(result.execution.status,'paused');assert.equal(result.execution.stage,'test');assert.equal(result.targets.length,3);assert.equal(writes.length,0)})
 for(const text of ['状态标记为完成','标记完成','把当前需求标记为已完成','请帮我把当前需求的业务状态设置为完成','状态改为已完成']){
  const action=h.recognizeAssistantCommand({conversationId:'development:dev-fixture',text})
  assert.equal(action?.operation,'development.issue.get');assert.match(action.requestedStatus,/完成/)
  result=await h.assistantHub(ctx,{action:'send',conversationId:'development:dev-fixture',sessionId:'main-session',text})
  verify('完成意图先查询真实状态，不调用 AI、不猜节点、不写入：'+text,()=>{assert.equal(result.status,'ok');assert.match(result.note,/尚未修改/);assert.equal(result.statusChoices.targets.length,2);assert.equal(result.turn.source,'rule');assert.equal(result.turn.commands[0].operation,'development.issue.get');assert.equal(writes.length,0);assert.equal(h.readDevelopmentTask(initial.id).stage,'test')})
 }
 verify('状态选择保存在原事项的事件中，重新打开仍可查看',()=>{assert.ok(h.assistantActionEvents('development:dev-fixture').some(event=>event.result?.statusChoices?.targets?.length===2))})
 result=await h.runAssistantOperation(ctx,{conversationId:'development:dev-fixture',sessionId:'review-session',operation:'development.issue.update',patch:{status:'doing'}})
 verify('历史或审查界面的状态卡片不能修改主会话工作项',()=>{assert.equal(result.status,'error');assert.equal(writes.length,0)})
 result=await invoke('development.issue.update',{patch:{title:'更新需求标题',description:'中文内容；包含 $() 和 `literal`，只是数据。'}})
 verify('模型工具直接更新标题和描述，回读一致后更新本地副本，执行证据不改变',()=>{assert.equal(result.status,'ok');assert.equal(result.after.title,'更新需求标题');assert.equal(writes.length,1);assert.equal(h.readDevelopmentTask(initial.id).issue.description,issue.description);for(const key of ['status','stage','pauseReason','steps','sessionId'])assert.deepEqual(h.readDevelopmentTask(initial.id)[key],initial[key]);assert.match(result.note,/回读/);assert.equal(result.confirmation,undefined)})
 const count=writes.length;result=await invoke('development.issue.update',{patch:{title:'更新需求标题'}})
 verify('重复目标内容只回读，不重复写入',()=>{assert.equal(result.changed,false);assert.equal(writes.length,count)})
 result=await h.maybeAssistantCommand(ctx,{conversationId:'development:dev-fixture',text:'把当前需求状态改为开发中'})
 verify('明确中文状态指令使用平台流转而非通用状态覆盖',()=>{assert.equal(result.status,'ok');assert.equal(issue.status.key,'doing');assert.equal(writes.at(-1)[writes.at(-1).indexOf('issue')+1],'move');assert.ok(!writes.at(-1).includes('--status'));assert.equal(result.task.status,'paused')})
 for(const text of ['把标题改为验收范围？','把这条需求的描述改成第一行。\n第二行！']){
  const action=h.recognizeAssistantCommand({conversationId:'development:dev-fixture',text});assert.ok(action);assert.equal(action.patch[action.patch.title?'title':'description'],text.split(/改为|改成/)[1]);checks++
 }
 result=await invoke('development.issue.update',{patch:{status:'已完成'}});assert.equal(result.status,'error');assert.match(result.note,/唯一确定/);checks++
 result=await invoke('development.issue.update',{patch:{status:'发布完成'}});assert.equal(result.status,'error');assert.match(result.note,/不允许/);checks++
 result=await invoke('development.issue.update',{patch:{status:'需求评审完成'}});assert.equal(result.status,'error');assert.match(result.note,/必填字段/);checks++
 result=await invoke('development.issue.update',{patch:{status:'需求评审完成'},fields:{reviewer:''},comment:'说明'});assert.equal(result.status,'error');assert.match(result.note,/必填字段/);checks++
 result=await invoke('development.issue.update',{patch:{status:'需求评审完成'},fields:{reviewer:'明确指定的评审人'}});assert.equal(result.status,'error');assert.match(result.note,/评论/);checks++
 result=await invoke('development.issue.update',{patch:{status:'需求评审完成'},fields:{reviewer:'明确指定的评审人'},comment:'用户明确提供的评审说明'})
 verify('必填字段和评论明确后可流转，中文 JSON 文件传参且保留失败测试',()=>{assert.equal(result.status,'ok');assert.equal(issue.status.key,'reviewed');assert.equal(h.readDevelopmentTask(initial.id).steps[0].exitCode,1);assert.equal(h.readDevelopmentTask(initial.id).issue.status,'需求评审完成')})
 for(const patch of [{status:'doing',title:'不得部分修改'},{stage:'delivery'},{approvedHash:'forged'},{steps:[]},{title:''}]){result=await invoke('development.issue.update',{patch});assert.equal(result.status,'error');checks++}
 const beforeDenied=writes.length
 result=await tool.execute({operation:'development.issue.update',patch:{title:'错会话'}},{agent:{session:{id:'review-session'}}});assert.equal(result.status,'error');assert.match(result.note,/主会话/)
 result=await invoke('development.issue.update',{id:'another-dev',patch:{title:'错对象'}});assert.equal(result.status,'error')
 await assert.rejects(tool.execute({operation:'development.approve',note:'不能借此通过'},execution),/明确确认/)
 verify('主会话身份固定对象，审查会话、其他对象与批准越权均不能写入',()=>assert.equal(writes.length,beforeDenied))
 wrongPlan=true;result=await invoke('development.issue.update',{patch:{status:'doing'}});wrongPlan=false;assert.equal(result.status,'error');assert.equal(writes.length,beforeDenied);checks++
 failReadback=true;result=await invoke('development.issue.update',{patch:{description:'提交后首次回读故障'}})
 verify('提交后回读失败不报成功，也不冒写本地副本',()=>{assert.equal(result.status,'error');assert.match(result.note,/待核实/);assert.notEqual(h.readDevelopmentTask(initial.id).issue.description,'提交后首次回读故障')})
 const uncertainCount=writes.length;result=await invoke('development.issue.update',{patch:{description:'提交后首次回读故障'}})
 verify('重试先回读恢复，原写入已生效时不再次提交',()=>{assert.equal(result.status,'ok');assert.equal(result.recovered,true);assert.equal(writes.length,uncertainCount);assert.equal(h.readDevelopmentTask(initial.id).issue.description,'提交后首次回读故障')})
 let release;gate=new Promise(done=>release=done);const first=invoke('development.issue.update',{patch:{title:'并发保护'}});while(writes.length===uncertainCount)await new Promise(done=>setTimeout(done,0));result=await invoke('development.issue.update',{patch:{title:'第二个修改'}});assert.equal(result.status,'error');release();await first;gate=null;checks++
 h.saveDevelopmentTask({...h.readDevelopmentTask(initial.id),status:'running'});await assert.rejects(h.updateDevelopmentIssue(initial.id,{title:'运行中禁止'}),/暂停/);h.saveDevelopmentTask({...h.readDevelopmentTask(initial.id),status:'paused'});checks++
 assert.ok(h.assistantActionEvents('development:dev-fixture').some(event=>event.operation==='development.issue.update'&&event.before?.title==='原需求'&&event.after?.title==='更新需求标题'));checks++
 mismatch=true;result=await invoke('development.issue.update',{patch:{title:'模拟返回成功但没有修改'}});assert.equal(result.status,'error');assert.match(result.note,/回读与目标不一致/);const failedWrites=writes.length;result=await invoke('development.issue.update',{patch:{title:'模拟返回成功但没有修改'}});assert.equal(result.status,'error');assert.equal(writes.length,failedWrites);checks++
 console.log(`development-issue-actions: ${checks} checks passed; all CLI calls synthetic, no external writes`)
}finally{rmSync(home,{recursive:true,force:true})}
