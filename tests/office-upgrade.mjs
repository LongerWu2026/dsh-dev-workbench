import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {performance} from 'node:perf_hooks'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-office-'));process.env.DSH_HOME=home
const file=join(home,'test.mjs')
await build({stdin:{contents:`export * from './src/shared/assistant-context.ts';export * from './src/shared/quality-evaluation.ts';export * from './src/shared/news.ts';export * from './src/host/analysis/context-selection.ts';export * from './src/host/analysis/queue-policy.ts';export * from './src/host/storage/change-history.ts';export * from './src/host/storage/state-store.ts';export * from './src/host/assistant/usage.ts';export * from './src/host/workflows/reminders.ts';export * from './src/host/news/github-quality.ts';export {normalizeState} from './src/host/domain/model.ts';export {apply} from './src/host/plugin.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:file,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const host=await import(file);let api,checks=0;const cleanups=[]
const ctx={provide:(name,v)=>{if(name==='workbench')api=v},inject(){},effect(fn){const d=fn();if(typeof d==='function')cleanups.push(d)},get(){},logger:{info(){}}}
host.apply(ctx,{})
const check=(name,fn)=>{fn();checks++;console.log('✓ '+name)}
try{
 const sources=Array.from({length:8},(_,i)=>({id:'source-'+i,excerpt:'完整内容'+i+'x'.repeat(900)}))
 const refs=sources.map(s=>({kind:'source',id:s.id,body:'过时内容'}))
 check('8 个上下文均发送最新 Host 原文，包含 ID，900 字不截断',()=>{const body=host.buildAssistantContext({sources},refs).join('\n');for(const s of sources){assert.ok(body.includes(s.id));assert.ok(body.includes(s.excerpt))}assert.ok(!body.includes('过时内容'))})
 check('9 个引用、失效引用、超容量均拒绝，不悄悄截断',()=>{assert.throws(()=>host.buildAssistantContext({sources},[...refs,refs[0]]),/最多/);assert.throws(()=>host.buildAssistantContext({sources},[{kind:'source',id:'gone'}]),/不存在/);assert.throws(()=>host.buildAssistantContext({sources:[{id:'big',excerpt:'x'.repeat(50000)}]},[{kind:'source',id:'big'}]),/没有发送或截断/)})
 const old={id:'old',sourceRefId:'origin',title:'早期交付',status:'ready'};const closed=Array.from({length:25},(_,i)=>({id:'closed-'+i,title:'已完成',status:'completed'}))
 check('早期被引用和未完成任务不被后 20 条已完成记录挤出',()=>{const rows=host.selectRelatedItems([old,...closed],[{id:'m',locator:{replyToMsgId:'original'}}],[{id:'origin',locator:{msgId:'original'}}]);assert.equal(rows[0].id,'old')})
 const now=Date.now(),time=n=>new Date(now+n*60000).toISOString()
 const qs=[{id:'old-source',fetchedAt:time(-3000),locator:{groupId:'old'}},{id:'new-a',fetchedAt:time(-3),locator:{groupId:'new'}},{id:'new-b',fetchedAt:time(-2),locator:{groupId:'new'}},{id:'new-c',fetchedAt:time(-1),locator:{groupId:'new'}}]
 const queue=qs.map(s=>({id:s.id,sourceId:s.id,status:'pending'}))
 check('新会话优先且保留积压额度，同会话不倒序',()=>{const rows=host.selectQueueEntries(queue,qs,3,now);assert.deepEqual(rows.map(r=>r.id),['old-source','new-a','new-b']);assert.equal(host.queueHealth(queue,qs,now).oldestPendingMinutes,3000)})
 check('整批协议失败自动缩小后续批次，避免反复五条一起失败',()=>{assert.equal(host.effectiveBatchSize(5,{status:'partial',inputCount:5,processed:0,failures:5,modelCalls:2}),2);assert.equal(host.effectiveBatchSize(5,{status:'partial',inputCount:2,processed:0,failures:2,modelCalls:2}),1)})
 check('慢批次缩到 5 条，恢复后按配置上限',()=>{assert.equal(host.effectiveBatchSize(20,{durationMs:100000}),5);assert.equal(host.effectiveBatchSize(20,{durationMs:1000}),20)})
 await api.createTask({title:'可追溯任务',description:'初始说明'});let s=await api.snapshot();const task=s.tasks[0]
 const create=s.changeHistory.find(row=>row.entityId===task.id)
 await api.updateTask(task.id,{description:'更新说明'});s=await api.snapshot();const change=s.changeHistory.at(-1)
 check('任务变更与业务同次提交，保存前后及理由',()=>{assert.equal(change.before.description,'初始说明');assert.equal(change.after.description,'更新说明');assert.equal(change.collection,'tasks')})
 await api.undoChange(change.id);s=await api.snapshot()
 check('撤销后保留对象 ID 和人工字段保护',()=>{assert.equal(s.tasks[0].id,task.id);assert.equal(s.tasks[0].description,'初始说明');assert.ok(s.tasks[0].humanGuard.editedFields.includes('description'));assert.ok(s.changeHistory.find(row=>row.id===change.id).revertedAt)})
 await assert.rejects(()=>api.undoChange(change.id),/已经撤销/);checks++
 await api.updateTask(task.id,{title:'修改 A'});const earlier=(await api.snapshot()).changeHistory.at(-1);await api.updateTask(task.id,{title:'修改 B'})
 await assert.rejects(()=>api.undoChange(earlier.id),/后续修改/);checks++
 check('冲突撤销不覆盖后续人工内容',()=>assert.equal(host.loadWorkbenchState().tasks[0].title,'修改 B'))
 await assert.rejects(()=>api.undoChange(create.id),/后续修改|人工编辑/);checks++
 await api.createTask({title:'仅新建'});s=await api.snapshot();const newTask=s.tasks.at(-1),newRecord=s.changeHistory.at(-1);await api.undoChange(newRecord.id)
 check('撤销 AI/工具新建采用取消保留证据，不删除对象',()=>{const row=host.loadWorkbenchState().tasks.find(t=>t.id===newTask.id);assert.equal(row.status,'cancelled');assert.equal(row.humanGuard.ignored,true)})
 await api.archiveRecord('tasks',newTask.id,true);const archived=await api.dataPage({collection:'tasks',archived:true})
 check('归档可分页查询且重启标准化保留标记',()=>{assert.equal(archived.items[0].id,newTask.id);assert.ok(host.normalizeState(host.loadWorkbenchState()).state.tasks.find(t=>t.id===newTask.id).archivedAt)})
 await api.archiveRecord('tasks',newTask.id,false);assert.equal((await api.dataPage({collection:'tasks',archived:true})).total,0);checks++
 await assert.rejects(()=>api.archiveRecord('tasks',task.id,true),/只能归档/);checks++
 const meeting={id:'meeting',title:'中文会议'.repeat(20),description:'讨论\n预算;本期',status:'ready',humanGuard:{},eventType:'meeting',meetingStart:time(10),meetingEnd:null}
 check('会前提醒、完成排除和延期生效',()=>{const state={tasks:[meeting,{...meeting,id:'done',status:'completed'}],replies:[]};const reminders=host.collectReminders(state,now);assert.equal(reminders.length,1);assert.equal(host.collectReminders({...state,reminderSnoozes:{[reminders[0].id]:time(60)}},now).length,0)})
 check('日历导出 UTF-8 每行不超 75 字节，不猜会议结束时间',()=>{const ics=host.calendarExport(meeting,now);assert.ok(!ics.includes('DTEND'));assert.ok(ics.includes('TRIGGER:-PT15M'));assert.ok(ics.includes('\\n预算\\;本期'));for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75)})
 check('Token 用量同 turn/step 后值替换，无字段不假装 0 用量',()=>{const values=host.foldUsage([{type:'assistant/chunk',seq:1,data:{turn:1,step:1,chunk:{type:'usage',usage:{inputTokens:10,outputTokens:3,cacheReadTokens:20}}}},{type:'assistant/message',seq:2,data:{turn:1,step:1,usage:{inputTokens:12,outputTokens:4,cacheReadTokens:25}}},{type:'assistant/message',seq:3,data:{}}]);assert.equal(values.size,1);assert.equal([...values.values()][0].inputTokens,12);assert.equal([...values.values()][0].cacheReadTokens,25)})
 await api.saveSettings({aiPolicy:{dailyCallLimit:1}});await host.reserveModelCall('analysis');await assert.rejects(()=>host.reserveModelCall('summary'),e=>e.code==='WORKBENCH_AI_BUDGET');checks++
 const session={id:'usage-1',snapshotEvents:()=>[{type:'assistant/message',seq:9,data:{turn:2,step:1,usage:{inputTokens:100,outputTokens:10,cacheReadTokens:500}}}]}
 await host.captureModelUsage(session,0);await host.captureModelUsage(session,0)
 check('用量持久去重且缓存与未缓存分开',()=>{const u=host.loadWorkbenchState().aiUsage[host.usageDay()];assert.equal(u.calls,1);assert.equal(u.reportedSteps,1);assert.equal(u.inputTokens,100);assert.equal(u.cacheReadTokens,500)})
 check('GitHub 仅接受仓库根路径，不接受外站和 issue',()=>{assert.equal(host.githubRepoName('https://github.com/test/project'),'test/project');assert.equal(host.githubRepoName('https://github.com/test/project/issues/2'),null);assert.equal(host.githubRepoName('https://evil.test/test/project'),null)})
 check('缺失或格式错误的评测结果不能提高准确率和召回率',()=>{const expected={action:true,reply:true,completed:false};const metrics=host.evaluateQuality([{id:'missing',expected},{id:'invalid',expected}],[{id:'invalid',analysis:{items:[]}}]);assert.equal(metrics.exact,0);assert.equal(metrics.action.fn,2);assert.equal(metrics.reply.recall,0);assert.deepEqual(metrics.invalid,['invalid']);assert.deepEqual(metrics.missing,['missing'])})
 check('归档资讯退出首页推荐，恢复后重新可见',()=>{assert.equal(host.isIgnoredNews({archivedAt:new Date().toISOString()}),true);assert.equal(host.isIgnoredNews({archivedAt:null}),false)})
 const pack=await api.exportMigration();check('导出含持久变更与质量记录，可独立搬迁',()=>{assert.ok(pack.data.changeHistory.length>0);assert.ok(Array.isArray(pack.data.qualityReviews));assert.ok(pack.data.replyDrafts)})
 await host.mutateWorkbenchState(s=>{s.sources=Array.from({length:10000},(_,i)=>({id:'perf-'+i,excerpt:'性能夹具'.repeat(50)}));return s})
 const samples=[];for(let i=0;i<5;i++){const t=performance.now();await api.updateTask(task.id,{description:'性能提交 '+i});samples.push(performance.now()-t)}
 check('万条来源压力下提交和历史记录保持一致',()=>{assert.equal(host.loadWorkbenchState().sources.length,10000);assert.equal(JSON.parse(readFileSync(join(home,'storages/dev-workbench/state.json'))).tasks[0].description,'性能提交 4')})
 console.log('storage benchmark (ms): '+JSON.stringify(samples.map(n=>Math.round(n))))
 console.log('office-upgrade: '+checks+' checks passed')
}finally{cleanups.forEach(fn=>fn());rmSync(home,{recursive:true,force:true})}
