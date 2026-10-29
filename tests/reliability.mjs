/** Regression tests for state consistency and the office workflow. Isolated files only. */
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,renameSync,rmSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
import {execFileSync} from 'node:child_process'
const home=mkdtempSync(join(tmpdir(),'workbench-reliability-'))
process.env.DSH_HOME=home
mkdirSync(join(home,'storages/dev-workbench'),{recursive:true})
writeFileSync(join(home,'storages/dev-workbench/state.json'),JSON.stringify({version:2,installedAt:'2026-10-26T16:00:00.000Z'}))
const bundle=join(home,'test-host.mjs')
await build({stdin:{contents:`export {apply} from './src/host/plugin.ts'; export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts'; export {migrationPrecheck,migrationChecksum} from './src/host/storage/migration.ts'; export {mergeAnalysisIntoState,validateAnalysis,analysisScope,runAnalysisBatch} from './src/host/analysis/message-analysis.ts'; export {normalizeState} from './src/host/domain/model.ts'; export {ensureBackgroundSession} from './src/host/assistant/sessions.ts'; export {summaryPrompt,stripHtmlToText} from './src/host/news/summarizer.ts'; export {workbenchToolDefinitions} from './src/host/api/tools.ts'; export {runtimeCheckpoint,RuntimeInterruptedError} from './src/host/platform/runtime.ts'; export {runAutomationTick} from './src/host/automation/scheduler.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:bundle,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const host=await import(bundle)
let api;let spawner=null;const sessionServices={}
const disposers=[]
host.apply({provide:(name,value)=>{if(name==='workbench')api=value},inject:()=>{},effect:fn=>{const cleanup=fn();if(typeof cleanup==='function')disposers.push(cleanup);return cleanup},get:name=>name==='subprocess'?spawner:sessionServices[name],logger:{info(){}}},{})
let checks=0
function check(label,fn){fn();checks++;console.log('✓',label)}
const file=join(home,'storages/dev-workbench/state.json')
try {
 await api.snapshot()
 await Promise.all(Array.from({length:24},(_,i)=>api.createTask({title:'并发事项 '+i})))
 check('并发创建24条不丢数据且修订号递增',()=>{const s=host.loadWorkbenchState();assert.equal(s.tasks.length,24);assert.ok(s.revision>=24);assert.equal(new Set(s.tasks.map(t=>t.id)).size,24)})
 const before=readFileSync(file,'utf8');const rev=(await api.revision()).revision
 mkdirSync(file+'.'+process.pid+'.tmp')
 await assert.rejects(api.createTask({title:'不应出现的失败任务'}))
 rmSync(file+'.'+process.pid+'.tmp',{recursive:true})
 check('落盘失败后文件与缓存均保持原状',()=>{assert.equal(readFileSync(file,'utf8'),before);assert.equal(host.loadWorkbenchState().revision,rev);assert.ok(!host.loadWorkbenchState().tasks.some(t=>t.title==='不应出现的失败任务'))})
 await assert.rejects(host.mutateWorkbenchState(s=>{s.tasks=[];throw Error('中途失败')}))
 check('抛错的事务不污染缓存且下一次提交可继续',()=>assert.equal(host.loadWorkbenchState().tasks.length,24))
 await api.createTask({title:'失败后的恢复写入'})
 const pack=await api.exportMigration();const bytes=readFileSync(file,'utf8');const memory=JSON.stringify(host.loadWorkbenchState())
 const preview=await api.importMigration({payload:pack,mode:'replace',dryRun:true})
 check('dryRun文件/内存/revision完全不变',()=>{assert.equal(preview.dryRun,true);assert.equal(readFileSync(file,'utf8'),bytes);assert.equal(JSON.stringify(host.loadWorkbenchState()),memory)})
 check('迁移包含Reply/队列/账本/游标',()=>{for(const key of ['replies','analysisQueue','operations','syncCursors'])assert.ok(key in pack.data)})
 const bad=structuredClone(pack);bad.data.tasks[0].sourceRefId='missing-source';bad.checksum=host.migrationChecksum(bad.data)
 await assert.rejects(api.importMigration({payload:bad,dryRun:true}),/引用不存在/)
 check('悬空引用预检拒绝且原状态不变',()=>assert.equal(JSON.stringify(host.loadWorkbenchState()),memory))
 const duplicate=structuredClone(pack);duplicate.data.tasks.push(duplicate.data.tasks[0]);duplicate.counts.tasks++;duplicate.checksum=host.migrationChecksum(duplicate.data)
 await assert.rejects(api.importMigration({payload:duplicate,dryRun:true}),/重复 ID/)
 const backup=join(home,'storages/dev-workbench/backups');const backupSaved=backup+'-saved';if(existsSync(backup))renameSync(backup,backupSaved);writeFileSync(backup,'blocked')
 await assert.rejects(api.backup(),/备份失败/)
 await assert.rejects(api.importMigration({payload:pack,mode:'replace'}),/备份失败/)
 rmSync(backup);if(existsSync(backupSaved))renameSync(backupSaved,backup)
 check('备份失败阻断导入，缓存和文件不变',()=>{assert.equal(readFileSync(file,'utf8'),bytes);assert.equal(JSON.stringify(host.loadWorkbenchState()),memory)})
 // CLI fixtures: 145 messages force a saved continuation beyond six pages.
 let messages=Array.from({length:145},(_,i)=>({msgId:'msg-'+i,fromOpenId:'colleague',content:'请处理事项 '+i,sendTime:new Date(Date.UTC(2026,9,27,1,0,i)).toISOString(),param:{notifyType:1}}))
 let failOld=false
 spawner={resolveExecutable:async()=>'/fixture/yzj-cli',spawn(spec){const args=spec.argv;let data={};let success=true
  if(args.includes('whoami'))data={openId:'me',name:'本人'}
  else if(args.includes('recent'))data={list:[{groupId:'private',groupName:'同事',groupType:2,unreadCount:messages.length,lastMsgId:messages.at(-1).msgId}],more:false}
  else if(args.includes('im')&&args.includes('list')){const type=args[args.indexOf('--type')+1];const anchor=args[args.indexOf('--msg-id')+1];if(type==='old'&&failOld){success=false;data={};failOld=false}else{const stop=type==='old'?messages.findIndex(m=>m.msgId===anchor):messages.length;data={list:messages.slice(Math.max(0,stop-20),stop).map(message=>({message}))}}}
  else if(args.includes('contact'))data={list:[{openId:'colleague',name:'同事'}]}
  const text=JSON.stringify(success?{success:true,data}:{success:false,errorCode:43001});return{collected:{stdout:{readFrom:()=>({text,nextOffset:text.length,lossy:false})},stderr:{readFrom:()=>({text:'',nextOffset:0,lossy:false})}},done:Promise.resolve({exitCode:0}),terminate(){}}
 }}
 const oldContext=await api.addSource({provider:'yunzhijia',title:'旧全量上下文',excerpt:'请处理事项 144',externalId:'old-context-144',fetchedAt:messages.at(-1).sendTime,locator:{accountId:'me',groupId:'private',groupType:2,msgId:'msg-144',sentAt:messages.at(-1).sendTime,intake:false,direction:'inbound'}})
 const oldContextId=oldContext.sources.at(-1).id
 await host.mutateWorkbenchState(state=>{state.analysisQueue.push({id:'retired-context',sourceId:oldContextId,msgId:'msg-144',status:'pending',attempts:0,at:new Date().toISOString()});return state})
 check('旧普通上下文待处理队列自动停用',()=>assert.equal(host.loadWorkbenchState().analysisQueue.find(q=>q.id==='retired-context').status,'skipped'))
 await api.fetchMentions();let s=host.loadWorkbenchState()
 check('旧来源被当前未读窗口重新命中后沿用ID并恢复正确识别范围',()=>{const source=s.sources.find(x=>x.id===oldContextId);assert.equal(source.locator.intake,true);assert.ok(source.selection.reasons.includes('unread'));assert.equal(s.analysisQueue.find(q=>q.id==='retired-context').status,'pending');assert.equal(s.sources.filter(x=>x.locator?.msgId==='msg-144').length,1)})
 check('超过批次消息上限保留补采位',()=>{assert.equal(s.sources.length,80);assert.ok(s.syncCursors['me:private'].resumeBefore);assert.ok(!s.syncCursors['me:private'].lastMsgId)})
 await api.fetchMentions();s=host.loadWorkbenchState()
 check('第二次同步补齐145条群@消息，按边界无重复入库',()=>{assert.equal(s.sources.length,145);assert.equal(s.syncCursors['me:private'].lastMsgId,'msg-144');assert.ok(s.sources.every(row=>row.locator.intake))})
 messages.push({msgId:'msg-145',fromOpenId:'me',content:'收到，我下午处理',sendTime:'2026-10-28T01:00:00Z',param:{replyMsgId:'msg-144'}})
 await host.mutateWorkbenchState(state=>{state.replies.push({id:'fixture-followup',sourceId:state.sources.find(s=>s.locator.msgId==='msg-144').id,msgId:'msg-144',stage:'待回复',taskIds:[]});return state})
 await api.fetchMentions();s=host.loadWorkbenchState()
 check('游标同页新消息被保存；本人明确引用消息仅用于事项跟进',()=>{const own=s.sources.find(row=>row.locator.msgId==='msg-145');assert.ok(own);assert.equal(own.locator.direction,'outbound');assert.equal(own.locator.intake,false);assert.equal(s.syncCursors['me:private'].lastMsgId,'msg-145')})
 const count=s.sources.length;await api.fetchMentions();check('重复同步幂等',()=>assert.equal(host.loadWorkbenchState().sources.length,count))
 // Merge assertions use the same actual domain functions invoked after model validation.
 await host.mutateWorkbenchState(state=>{state.settings.aiExtract={enabled:true,autoRegister:true,batchSize:5};return state})
 const original=s.sources.find(row=>row.locator.msgId==='msg-144');const entry=s.analysisQueue.find(row=>row.sourceId===original.id)
 await host.mutateWorkbenchState(state=>{host.mergeAnalysisIntoState(state,entry,{noise:false,items:[{title:'开发验收',needsReply:true,needsAction:true,eventType:'feature',deliverable:'验收报告'},{title:'登记版本',needsReply:false,needsAction:true,eventType:'logging',registrationTarget:'功能登记表'}]});return state})
 s=host.loadWorkbenchState();const reply=s.replies.find(row=>row.sourceId===original.id);const task=s.tasks.find(row=>row.title==='开发验收')
 check('同消息拆两个任务，回复独立并关联全部任务',()=>{assert.ok(task);const registration=s.tasks.find(row=>row.title==='登记版本');assert.ok(registration);assert.ok(reply.taskIds.includes(task.id));assert.ok(reply.taskIds.includes(registration.id))})
 const own=s.sources.find(row=>row.locator.msgId==='msg-145');const ownEntry=s.analysisQueue.find(row=>row.sourceId===own.id)
 await host.mutateWorkbenchState(state=>{Object.assign(state.replies.find(r=>r.id===reply.id),{stage:'待回复',status:'pending',replyEvidence:null});host.mergeAnalysisIntoState(state,ownEntry,{noise:false,items:[{title:'确认收到',needsReply:true,needsAction:false,relatedReplyId:reply.id,replyStage:'已确认收到'}]});return state})
 check('确认收到保留回复义务且不完成任务',()=>{assert.equal(host.loadWorkbenchState().replies.find(row=>row.id===reply.id).stage,'已确认收到');assert.notEqual(host.loadWorkbenchState().tasks.find(row=>row.id===task.id).status,'completed')})
 await api.setReplyStage(reply.id,'不需回复')
 await host.mutateWorkbenchState(state=>{host.mergeAnalysisIntoState(state,ownEntry,{noise:false,items:[{title:'回复',needsReply:true,needsAction:false,relatedReplyId:reply.id,replyStage:'已实质答复'}]});return state})
 check('人工回复阶段不会被模型覆盖',()=>assert.equal(host.loadWorkbenchState().replies.find(row=>row.id===reply.id).stage,'不需回复'))
 const scope=host.analysisScope(host.loadWorkbenchState(),original)
 check('严格JSON结构、日期和跨会话ID校验',()=>{assert.throws(()=>host.validateAnalysis({noise:false,items:[{title:'x',needsReply:'true',needsAction:false}]},original,scope));assert.throws(()=>host.validateAnalysis({noise:false,items:[{title:'x',needsReply:false,needsAction:true,dueAt:'garbage'}]},original,scope));assert.throws(()=>host.validateAnalysis({noise:false,items:[{title:'x',needsReply:false,needsAction:true,relatedTaskId:'foreign'}]},original,scope))})
 const datedSource={...original,locator:{...original.locator,sentAt:'2026-10-27T23:00:00Z'},excerpt:'明天下班前完成验收',fetchedAt:'2026-10-27T23:00:00Z'}
 check('相对日期按原消息的中国时区日期核对',()=>{assert.throws(()=>host.validateAnalysis({noise:false,items:[{title:'验收',needsReply:false,needsAction:true,dueAt:'2026-10-28T10:00:00Z'}]},datedSource,scope),/相对日期/);assert.ok(host.validateAnalysis({noise:false,items:[{title:'验收',needsReply:false,needsAction:true,dueAt:'2026-10-29T10:00:00Z'}]},datedSource,scope).items[0].dueAt)})
 check('询问完成时间不写成本人承诺截止日期',()=>{const analysis=host.validateAnalysis({noise:false,items:[{title:'确认进度',needsReply:true,needsAction:false,dueAt:'2026-10-30T10:00:00Z'}]},{...original,excerpt:'周五能完成吗？'},scope);assert.equal(analysis.items[0].dueAt,null)})
 const tasksBefore=host.loadWorkbenchState().tasks.length
 await host.mutateWorkbenchState(state=>{host.mergeAnalysisIntoState(state,entry,{noise:false,items:[{title:'无义务',needsReply:false,needsAction:false}]});return state})
 check('两种义务皆无不创建任务',()=>assert.equal(host.loadWorkbenchState().tasks.length,tasksBefore))
 // A failed older page must never advance the committed newest boundary.
 messages=messages.concat(Array.from({length:35},(_,i)=>({msgId:'more-'+i,fromOpenId:'colleague',content:'补采事项 '+i,sendTime:'2026-10-28T02:00:00Z'})))
 failOld=true;const cursorBefore=host.loadWorkbenchState().syncCursors['me:private'].lastMsgId
 await api.fetchMentions()
 check('消息分页失败保留旧游标与续采锚点',()=>{const cursor=host.loadWorkbenchState().syncCursors['me:private'];assert.equal(cursor.lastMsgId,cursorBefore);assert.ok(cursor.resumeBefore);assert.equal(host.loadWorkbenchState().lastMentionsFetch.status,'partial')})
 await api.fetchMentions()
 check('失败重试补齐剩余消息且最新边界正确',()=>{assert.equal(host.loadWorkbenchState().sources.filter(s=>s.provider==='yunzhijia').length,messages.length);assert.equal(host.loadWorkbenchState().syncCursors['me:private'].lastMsgId,'more-34')})
 await api.analysisCancel(ownEntry.id)
 check('取消保留记录并禁止后续提交',()=>assert.equal(host.loadWorkbenchState().analysisQueue.find(row=>row.id===ownEntry.id).status,'cancelled'))
 await api.analysisRetry(ownEntry.id)
 check('显式重试重置退避与错误状态',()=>assert.equal(host.loadWorkbenchState().analysisQueue.find(row=>row.id===ownEntry.id).status,'pending'))
 const queued=await api.analysisStart({limit:1})
 await new Promise(resolve=>setTimeout(resolve,20))
 check('耗时指令返回JobID，依赖不可用如实记录失败',()=>{assert.ok(queued.jobId);const job=host.loadWorkbenchState().jobs.find(j=>j.id===queued.jobId);assert.equal(job.status,'failed');assert.equal(job.result.status,'unavailable')})
 const exported=await api.exportMigration();await api.importMigration({payload:exported,mode:'merge'})
 check('迁移包保留重点收件箱快照和新版消息选择标记',()=>{assert.ok(exported.data.messageInbox);assert.equal(exported.data.messageInbox.accountId,'me');assert.ok(exported.data.sources.filter(s=>s.provider==='yunzhijia').every(s=>s.selection.policy==='focused-v1'));assert.deepEqual(host.loadWorkbenchState().messageInbox,exported.data.messageInbox)})
 check('合并重试保持ID与记录数量',()=>{assert.equal(host.loadWorkbenchState().tasks.length,tasksBefore);assert.equal(host.loadWorkbenchState().replies.length,exported.counts.replies)})
 const legacy=host.normalizeState({version:1,tasks:[{id:'legacy',title:'旧任务',needsReply:true,replyStage:'已确认收到'}]})
 check('旧任务回复字段升级为独立Reply且保留TaskID',()=>{assert.equal(legacy.state.tasks[0].id,'legacy');assert.equal(legacy.state.replies[0].stage,'已确认收到');assert.deepEqual(legacy.state.replies[0].taskIds,['legacy'])})
 const tool=host.workbenchToolDefinitions().find(tool=>tool.name==='workbench_create_task')
 const created=await Promise.all(Array.from({length:8},()=>tool.execute({title:'同键并发创建',idempotencyKey:'same-user-intent'})))
 check('八个并发同幂等键只创建一个任务并返回同ID',()=>{assert.equal(new Set(created.map(row=>row.taskId)).size,1);assert.equal(host.loadWorkbenchState().tasks.filter(row=>row.title==='同键并发创建').length,1)})
 const runTool=host.workbenchToolDefinitions().find(tool=>tool.name==='workbench_record_run')
 const recorded=await Promise.all(Array.from({length:6},()=>runTool.execute({summary:'并发执行记录',status:'completed',idempotencyKey:'same-user-intent'})))
 check('执行记录幂等与任务隔离，六次并发只登记一条',()=>{assert.equal(new Set(recorded.map(row=>row.runId)).size,1);assert.notEqual(recorded[0].runId,created[0].taskId)})
 // A rate limit stops the sweep and preserves undispatched groups across reloads.
 let limited=true,messageCalls=0;
 spawner={resolveExecutable:async()=>'/fixture/yzj-cli',spawn(spec){const args=spec.argv;let data={},exitCode=0,output
  if(args.includes('whoami'))data={openId:'rate-user',orgId:'rate-org',name:'本人'}
  else if(args.includes('recent'))data={list:[0,1,2].map(i=>({groupId:'rate-group-'+i,groupName:'限流夹具'+i,groupType:1,unreadCount:1})),more:false}
  else if(args.includes('im')&&args.includes('list')){messageCalls++;if(limited){exitCode=1;output={success:false,error:{code:10000429,message:'请求过于频繁'}}}else{const group=args[args.indexOf('--group-id')+1];data={list:[{msgId:group+'-msg',fromOpenId:'other',content:'仅供参考',sendTime:new Date().toISOString()}]}}}
  const text=JSON.stringify(output||{success:true,data});return{collected:{stdout:{readFrom:()=>({text,nextOffset:text.length,lossy:false})},stderr:{readFrom:()=>({text:'',nextOffset:0,lossy:false})}},done:Promise.resolve({exitCode}),terminate(){}}
 }}
 await api.fetchMentions();await api.fetchMentions()
 check('限流即停止并冷却，不继续轰炸其他会话，未读取会话保留',()=>{assert.equal(messageCalls,1);const cursor=host.loadWorkbenchState().syncCursors['__pending:rate-org:rate-user'];assert.equal(cursor.pendingGroups.length,3);assert.ok(Date.parse(cursor.retryAt)>Date.now())})
 limited=false;await host.mutateWorkbenchState(state=>{state.syncCursors['__pending:rate-org:rate-user'].retryAt=new Date(Date.now()-1).toISOString();return state});await api.fetchMentions()
 check('冷却后继续未读会话且不丢消息',()=>{assert.equal(messageCalls,4);assert.equal(host.loadWorkbenchState().sources.filter(s=>s.locator?.accountId==='rate-org:rate-user').length,3);assert.equal(host.loadWorkbenchState().syncCursors['__pending:rate-org:rate-user'].pendingGroups.length,0)})
 // Large discovery sweep and account isolation use realistic long opaque IDs.
 let organization='org-A'
 const groupRows=Array.from({length:70},(_,i)=>({groupId:'long-group-'+String(i).padStart(2,'0')+'x'.repeat(45),groupName:'会话'+i,groupType:2,lastMsgId:'long-group-'+String(i).padStart(2,'0')+'x'.repeat(45)+'m1'+'z'.repeat(8)}))
 spawner={resolveExecutable:async()=>'/fixture/yzj-cli',spawn(spec){const args=spec.argv;let data={}
  if(args.includes('whoami'))data={openId:'same-user-with-long-id-0123456789',orgId:organization,name:'本人'}
  else if(args.includes('recent')){const page=Number(args[args.indexOf('--page')+1]);data={list:groupRows.slice((page-1)*12,page*12),more:page*12<groupRows.length}}
  else if(args.includes('im')&&args.includes('list')){const group=args[args.indexOf('--group-id')+1];data={list:[0,1].map(i=>({msgId:group+'m'+i+('z'.repeat(8)),fromOpenId:'colleague',content:'请完成会话事项 '+i,sendTime:'2026-10-28T01:00:00Z',param:{notifyType:1}}))}}
  else if(args.includes('contact'))data={list:[]}
  const text=JSON.stringify({success:true,data});return{collected:{stdout:{readFrom:()=>({text,nextOffset:text.length,lossy:false})},stderr:{readFrom:()=>({text:'',nextOffset:0,lossy:false})}},done:Promise.resolve({exitCode:0}),terminate(){}}
 }}
 async function drainFocused(){for(let i=0;i<15;i++){await host.mutateWorkbenchState(state=>{for(const [key,cursor] of Object.entries(state.syncCursors))if(key.startsWith('__pending:'))cursor.retryAt=null;return state});await api.fetchMentions();const cursor=host.loadWorkbenchState().syncCursors['__pending:'+organization+':same-user-with-long-id-0123456789'];if(!cursor?.pendingGroups?.length&&host.loadWorkbenchState().syncCursors['__focusedDiscovery:'+organization+':same-user-with-long-id-0123456789']?.discoveryPage===1)break}}
 const totalBefore=host.loadWorkbenchState().sources.length;await drainFocused()
 check('超过40个会话全部采集，长复合身份不截断碰撞',()=>{const rows=host.loadWorkbenchState().sources.slice(totalBefore);assert.equal(rows.length,140);assert.equal(new Set(rows.map(row=>row.externalId)).size,140)})
 await api.fetchMentions();check('长身份重复同步幂等',()=>assert.equal(host.loadWorkbenchState().sources.length,totalBefore+140))
 organization='org-B';await drainFocused()
 check('相同openId和会话消息在不同组织独立建档',()=>assert.equal(host.loadWorkbenchState().sources.length,totalBefore+280))
 const events=[];const modelSession={id:'session-targeted-check',get seq(){return events.length},snapshotEvents(from=0){return events.filter(e=>e.seq>from)}}
 sessionServices.sessions={get:id=>id===modelSession.id?modelSession:null}
 sessionServices.sessionController={create:async()=>({sessionId:modelSession.id}),prompt:async()=>{events.push({type:'turn/start',seq:events.length+1,data:{}});events.push({type:'assistant/message',seq:events.length+1,data:{message:{content:[{type:'text',text:JSON.stringify({noise:true,summary:'无需处理',items:[]})}]}}});events.push({type:'turn/end',seq:events.length+1,data:{}})}}
 // Each synthetic registry is the full durable fixture; absent IDs explicitly report not found.
 sessionServices.sessionController.resolveAgent=async id=>{const session=sessionServices.sessions.get(id);return session?{agent:{session,status:"idle"}}:{error:new Error(`session "${id}" not found`)}}
 const targetedSourceState=await api.addSource({provider:'test',title:'指定分析样本',excerpt:'辛苦了，无需回复或处理',externalId:'targeted-check'})
 const targetedSource=targetedSourceState.sources.at(-1)
 await host.mutateWorkbenchState(state=>{state.analysisQueue.push({id:'targeted-entry',sourceId:targetedSource.id,status:'pending',attempts:0,at:new Date().toISOString()});return state})
 const untouched=host.loadWorkbenchState().analysisQueue.filter(e=>e.id!=='targeted-entry').map(e=>({id:e.id,status:e.status}))
 const targetedJob=await api.analysisStart({limit:20,onlyIds:['targeted-entry']})
 for(let i=0;i<100&&['queued','running'].includes(host.loadWorkbenchState().jobs.find(j=>j.id===targetedJob.jobId)?.status);i++)await new Promise(resolve=>setTimeout(resolve,20))
 check('指定条目作业只分析选中的来源，其他消息队列保持原状',()=>{assert.equal(host.loadWorkbenchState().analysisQueue.find(e=>e.id==='targeted-entry').status,'done');assert.deepEqual(host.loadWorkbenchState().analysisQueue.filter(e=>e.id!=='targeted-entry').map(e=>({id:e.id,status:e.status})),untouched);assert.equal(host.loadWorkbenchState().jobs.find(j=>j.id===targetedJob.jobId).status,'completed')})
 const staleSource={...original,id:'historical-source',externalId:'historical-msg',excerpt:'请完成历史交办并回复',locator:{...original.locator,msgId:'historical-msg',sentAt:new Date(Date.now()-60*86400000).toISOString(),intake:true,direction:'inbound'}}
 const staleEntry={id:'historical-entry',sourceId:staleSource.id,msgId:'historical-msg',accountId:staleSource.locator.accountId,groupId:staleSource.locator.groupId,status:'pending',attempts:0}
 await host.mutateWorkbenchState(state=>{state.sources.push(staleSource);state.analysisQueue.push(staleEntry);return state})
 const skippedBatch=await api.analyzeRun({limit:20,onlyIds:[staleEntry.id]})
 check('安装日期前的消息跳过，不调用模型或制造当前义务',()=>{const state=host.loadWorkbenchState();const row=state.analysisQueue.find(e=>e.id===staleEntry.id);assert.equal(row.status,'skipped');assert.match(row.reviewReason,/安装日期/);assert.equal(skippedBatch.modelCalls,0);assert.ok(!state.tasks.some(t=>t.sourceRefId===staleSource.id));assert.ok(!state.replies.some(r=>r.sourceId===staleSource.id))})
 const historicalAnalysis={noise:false,items:[{title:'历史交办复核',needsAction:true,needsReply:true}]}
 await assert.rejects(host.mutateWorkbenchState(state=>{host.mergeAnalysisIntoState(state,staleEntry,historicalAnalysis,{forceCreate:true});return state}),/安装日期/)
 await host.mutateWorkbenchState(state=>{state.analysisQueue.find(e=>e.id===staleEntry.id).analysis=historicalAnalysis;return state})
 await assert.rejects(api.analyzeConfirm(staleEntry.id),/已跳过/)
 await assert.rejects(api.analysisRetry(staleEntry.id),/已跳过/)
 check('历史消息不能通过强制建档、确认或重试恢复处理',()=>{const state=host.loadWorkbenchState();assert.ok(!state.tasks.some(t=>t.sourceRefId===staleSource.id));assert.ok(!state.replies.some(r=>r.sourceId===staleSource.id));assert.equal(state.analysisQueue.find(e=>e.id===staleEntry.id).status,'skipped')})
 const queries=[];sessionServices.web={search:async({query})=>{queries.push(query);return{sources:[{url:'https://example.org/ai/'+encodeURIComponent(query),title:'AI 工程发布 '+query,snippet:'工具链公告'},{url:'https://example.org/game',title:'VALORANT Hush Agent Release Date',snippet:'Riot Games announces a character'},{url:'https://example.org/2023/10/18/old-rag',title:'历史RAG指南',snippet:'长期教程'}]}}}
 await api.saveSettings({topics:['Agent','LLM','RAG','Java','Python','数据库'],feeds:[]})
 await api.fetchRadar();await api.fetchRadar()
 check('联网资讯限定AI Agent并轮换全部关注主题，未知日期不补造',()=>{assert.ok(queries[0].includes('"AI Agent"'));assert.ok(queries[2].includes('retrieval augmented generation'));assert.ok(queries.some(q=>q.startsWith('Java ')));assert.ok(queries.some(q=>q.startsWith('Python ')));assert.ok(queries.some(q=>q.startsWith('数据库 ')));assert.ok(queries.some(q=>q.startsWith('site:github.com')));const article=host.loadWorkbenchState().radar.find(r=>r.title.startsWith('AI 工程发布'));assert.equal(article.publishedAt,null);assert.equal(article.dateKind,'unknown');assert.ok(!host.loadWorkbenchState().radar.some(r=>r.title==='历史RAG指南'));assert.ok(!host.loadWorkbenchState().radar.some(r=>r.topics.includes('Agent')&&r.title.includes('VALORANT')))})
 for(let i=0;i<6;i++)events.push({type:'turn/end',seq:events.length+1,data:{}})
 const freshSession={id:'session-targeted-fresh',seq:0,snapshotEvents:()=>[]};const renamed=[];let sessionCreates=0
 sessionServices.sessions={get:id=>id===modelSession.id?modelSession:id===freshSession.id?freshSession:null}
 sessionServices.sessionController.create=async()=>{sessionCreates++;return {sessionId:freshSession.id}}
 sessionServices.sessionController.rename=async request=>renamed.push(request)
 const assistantBefore=host.loadWorkbenchState().settings.assistantSessionId
 const stableSession=await host.ensureBackgroundSession({get:name=>sessionServices[name]},'analysis')
 check('后台超过6轮仍复用同一会话，不改变人工助手会话',()=>{assert.equal(stableSession.id,modelSession.id);assert.equal(sessionCreates,0);assert.equal(host.loadWorkbenchState().settings.assistantSessionId,assistantBefore)})
 const activeEvents=[{type:'turn/start',seq:1,data:{}}];const activeSession={id:modelSession.id,seq:1,snapshotEvents:()=>activeEvents};sessionServices.sessions={get:id=>id===activeSession.id?activeSession:null}
 await assert.rejects(host.ensureBackgroundSession({get:name=>sessionServices[name]},'analysis'),error=>error.code==='WORKBENCH_BACKGROUND_BUSY')
 check('后台会话运行中保留排队，不新建替代会话',()=>assert.equal(sessionCreates,0))
 sessionServices.sessions={get:id=>id===modelSession.id?modelSession:id===freshSession.id?freshSession:null}

 check('长文章摘要保留结尾的可用性限制',()=>{const prompt=host.summaryPrompt({title:'公告'},'开头'+('正文'.repeat(9000))+'仅计划在未来12个月内向美国地区提供');assert.ok(prompt.includes('未来12个月内向美国地区提供'));assert.ok(prompt.includes('中间内容省略'));assert.ok(prompt.includes('区分公告、预览、已可用和计划可用'))})
 check('资讯正文提取去除导航和页脚，保留正文末尾限制',()=>{const text=host.stripHtmlToText('<header>'+('导航'.repeat(9000))+'</header><main><p>产品公告</p><p>可用性限制：未来12个月，仅美国</p></main><footer>企业页脚</footer>');assert.ok(text.includes('未来12个月，仅美国'));assert.ok(!text.includes('导航'));assert.ok(!text.includes('页脚'))})
 check('本人引用待回复必须单独判定沟通阶段，兼容已回复别名',()=>{const responding={...original,excerpt:'结论已经给出，实际交付未完成',locator:{...original.locator,direction:'outbound',replyToMsgId:'prior-message'}};const replyScope={tasks:[],replies:[{id:'active-reply',msgId:'prior-message',stage:'待回复'}],context:[]};assert.throws(()=>host.validateAnalysis({noise:false,items:[{title:'答复',needsReply:false,needsAction:false}]},responding,replyScope),/未判定回复阶段/);const parsed=host.validateAnalysis({noise:false,items:[{title:'答复',needsReply:false,needsAction:false,relatedReplyId:'active-reply',replyStage:'已回复'}]},responding,replyScope);assert.equal(parsed.items[0].replyStage,'已实质答复')})
 const pauseRadarState=await api.saveRadarItem({title:'恢复测试原文',url:'https://example.org/resume-fixture',summary:{}});const pauseRadar=pauseRadarState.radar.find(r=>r.title==='恢复测试原文');let fetchCalls=0
 sessionServices.web={fetch:async()=>{fetchCalls++;host.runtimeCheckpoint(Date.now()+31000);throw Error('休眠时网络中断')},search:async()=>({sources:[]})}
 const pauseSummary=await api.radarSummarize({onlyIds:[pauseRadar.id]})
 check('休眠期间原文失败不烧重试次数，并停止本批后续请求',()=>{const target=host.loadWorkbenchState().radar.find(r=>r.id===pauseRadar.id);assert.equal(pauseSummary.status,'interrupted');assert.equal(pauseSummary.failed,0);assert.equal(target.summaryAttempts,0);assert.equal(target.summaryStatus,'pending');assert.equal(fetchCalls,1)})
 const pauseSourceState=await api.addSource({provider:'test',externalId:'pause-message',title:'恢复测试消息',excerpt:'仅供参考，无需处理',locator:{accountId:'pause-account',groupId:'pause-group',msgId:'pause-message',sentAt:new Date().toISOString(),direction:'inbound',intake:true}});const pauseSource=pauseSourceState.sources.at(-1);const pauseEntry={id:'pause-entry',sourceId:pauseSource.id,accountId:'pause-account',groupId:'pause-group',msgId:'pause-message',status:'pending',attempts:0}
 await host.mutateWorkbenchState(state=>{state.analysisQueue.push(pauseEntry);state.syncCursors['__pending:pause-account']={pendingGroups:[{groupId:'pause-group'}]};return state})
 let promptCalls=0;sessionServices.sessionController.prompt=async()=>{promptCalls++;host.runtimeCheckpoint(Date.now()+31000);throw new host.RuntimeInterruptedError()}
 const held=await api.analyzeRun({onlyIds:[pauseEntry.id]})
 check('尚未补采的会话不提前分析已有消息',()=>{assert.equal(held.status,'deferred');assert.ok(held.retryAt);assert.equal(promptCalls,0);assert.equal(host.loadWorkbenchState().analysisQueue.find(r=>r.id===pauseEntry.id).status,'pending')})
 await host.mutateWorkbenchState(state=>{state.syncCursors['__pending:pause-account']={pendingGroups:[]};return state})
 const pauseAnalysis=await api.analyzeRun({onlyIds:[pauseEntry.id]})
 check('休眠中断释放全部识别租约，待处理且不计失败',()=>{const row=host.loadWorkbenchState().analysisQueue.find(r=>r.id===pauseEntry.id);assert.equal(pauseAnalysis.status,'interrupted');assert.equal(row.status,'pending');assert.equal(row.leaseUntil,null);assert.equal(row.attempts,0)})
 const pauseJob=await api.analysisStart({onlyIds:[pauseEntry.id],limit:1});for(let i=0;i<100&&!host.loadWorkbenchState().jobs.find(r=>r.id===pauseJob.jobId)?.nextRetryAt;i++)await new Promise(r=>setTimeout(r,20))
 check('休眠中断的持久作业恢复排队，不误报失败或完成',()=>{const row=host.loadWorkbenchState().jobs.find(r=>r.id===pauseJob.jobId);assert.equal(row.status,'queued');assert.equal(row.attempts,0);assert.ok(row.nextRetryAt)})
 const resumedEvents=[];const resumedSession={id:'resumed-session',get seq(){return resumedEvents.length},snapshotEvents(from=0){return resumedEvents.filter(e=>e.seq>from)}};sessionServices.sessions={get:id=>id===resumedSession.id?resumedSession:null};sessionServices.sessionController.create=async()=>({sessionId:resumedSession.id});sessionServices.sessionController.prompt=async()=>{resumedEvents.push({type:'turn/start',seq:resumedEvents.length+1,data:{}},{type:'assistant/message',seq:resumedEvents.length+2,data:{message:{content:[{type:'text',text:'{"noise":true,"items":[]}' }]}}},{type:'turn/end',seq:resumedEvents.length+3,data:{}})}
 const manualResume=await api.analysisStart({onlyIds:[pauseEntry.id],limit:1});assert.equal(manualResume.jobId,pauseJob.jobId);for(let i=0;i<100&&host.loadWorkbenchState().jobs.find(r=>r.id===pauseJob.jobId)?.status!=='completed';i++)await new Promise(r=>setTimeout(r,20))
 check('显式重试清除作业退避，同一作业立即恢复且不重复建档',()=>{assert.equal(host.loadWorkbenchState().jobs.find(r=>r.id===pauseJob.jobId).status,'completed');const row=host.loadWorkbenchState().analysisQueue.find(r=>r.id===pauseEntry.id);assert.equal(row.status,'done');assert.equal(row.attempts,0);assert.equal(host.loadWorkbenchState().jobs.filter(r=>r.id===pauseJob.jobId).length,1)})
 const priorSettings=structuredClone(host.loadWorkbenchState().settings);let resumedSearches=0;sessionServices.web={search:async()=>{resumedSearches++;return{sources:[]}}};await api.saveSettings({automation:{enabled:true,radar:true,mentions:false,analyze:false,summarize:false}});const collectedAt=new Date(Date.now()-100000).toISOString();await host.mutateWorkbenchState(state=>{state.lastAutomation={at:collectedAt,collectedAt};return state});await host.runAutomationTick({get:name=>sessionServices[name]},{resumeMentionsOnly:true})
 check('补采排空不反复搜索资讯，也不重置完整采集时钟',()=>{assert.equal(resumedSearches,0);assert.equal(host.loadWorkbenchState().lastAutomation.collectedAt,collectedAt)})
 await api.saveSettings({automation:priorSettings.automation,aiExtract:priorSettings.aiExtract})

 const outageState=await api.addSource({provider:'test',externalId:'outage-one',title:'模型故障样本',excerpt:'请登记测试',locator:{direction:'inbound',intake:true,sentAt:new Date().toISOString()}});const outageSource=outageState.sources.at(-1);await host.mutateWorkbenchState(state=>{for(let i=0;i<3;i++)state.analysisQueue.push({id:'outage-'+i,sourceId:outageSource.id,status:'pending',attempts:0});return state});
 const outageEvents=[];const outageSession={id:'outage-session',get seq(){return outageEvents.length},snapshotEvents:(from=0)=>outageEvents.filter(e=>e.seq>from)};let outageCalls=0;sessionServices.sessions={get:id=>id===outageSession.id?outageSession:null};sessionServices.sessionController.create=async()=>({sessionId:outageSession.id});sessionServices.sessionController.prompt=async()=>{outageCalls++;outageEvents.push({type:'turn/start',seq:outageEvents.length+1,data:{}},{type:'turn/error',seq:outageEvents.length+2,data:{message:'provider temporarily unavailable'}},{type:'turn/end',seq:outageEvents.length+3,data:{}})};
 const outageRequest={onlyIds:['outage-0','outage-1','outage-2'],limit:3};const outage=await host.runAnalysisBatch({get:name=>sessionServices[name]},outageRequest);await host.runAnalysisBatch({get:name=>sessionServices[name]},outageRequest);
 check('模型服务错误停止整批并持久化冷却，不逐条消耗业务失败次数',()=>{assert.equal(outage.status,'deferred');assert.equal(outageCalls,1);for(const row of host.loadWorkbenchState().analysisQueue.filter(r=>r.id.startsWith('outage-'))){assert.equal(row.status,'pending');assert.equal(row.attempts,0);assert.equal(row.leaseUntil,null)}assert.ok(host.loadWorkbenchState().modelHealth.analysis.retryAt)})
 for(let i=0;i<2;i++){await host.mutateWorkbenchState(state=>{state.modelHealth.analysis.retryAt=new Date(Date.now()-1).toISOString();return state});await host.runAnalysisBatch({get:name=>sessionServices[name]},outageRequest)}await host.runAnalysisBatch({get:name=>sessionServices[name]},outageRequest);
 check('模型连续三次失败停止自动调用，重启归一化保留阻断',()=>{assert.equal(outageCalls,3);assert.equal(host.loadWorkbenchState().modelHealth.analysis.blocked,true);assert.equal(host.normalizeState(JSON.parse(readFileSync(file))).state.modelHealth.analysis.blocked,true)})
 sessionServices.sessionController.prompt=async()=>{outageCalls++;outageEvents.push({type:'turn/start',seq:outageEvents.length+1,data:{}},{type:'assistant/message',seq:outageEvents.length+2,data:{message:{content:[{type:'text',text:'{"noise":true,"items":[]}' }]}}},{type:'turn/end',seq:outageEvents.length+3,data:{}})};const outageRecovery=await api.analyzeRun({onlyIds:['outage-0'],limit:1});
 check('显式运行可解除模型阻断，恢复成功后原条目完成且不增加重试计数',()=>{assert.equal(outageRecovery.status,'ok');assert.equal(host.loadWorkbenchState().analysisQueue.find(r=>r.id==='outage-0').status,'done');assert.equal(host.loadWorkbenchState().analysisQueue.find(r=>r.id==='outage-0').attempts,0);assert.ok(!host.loadWorkbenchState().modelHealth.analysis)})

 sessionServices.web={fetch:async()=>({statusCode:200,body:{kind:'text',content:'这是公开原文。'.repeat(100)}})};let unavailableCalls=0;sessionServices.sessionController.prompt=async()=>{unavailableCalls++;throw Error('MISSING_CREDENTIAL provider unavailable')};const summaryOutage=await api.radarSummarize({onlyIds:[pauseRadar.id],retryFailed:true});
 check('摘要模型认证失败保留原文与待摘要，不消耗文章业务失败次数',()=>{assert.equal(summaryOutage.status,'deferred');assert.equal(summaryOutage.failed,0);assert.equal(unavailableCalls,1);const row=host.loadWorkbenchState().radar.find(r=>r.id===pauseRadar.id);assert.equal(row.summaryAttempts,0);assert.ok(host.loadWorkbenchState().modelHealth.summary.retryAt)})
 const rejectedOutage=await api.analyzeRun({onlyIds:['outage-1'],limit:1});
 check('提交阶段认证错误也进入模型退避，原消息仍待处理',()=>{assert.equal(rejectedOutage.status,'deferred');const row=host.loadWorkbenchState().analysisQueue.find(r=>r.id==='outage-1');assert.equal(row.status,'pending');assert.equal(row.attempts,0)})

 await host.mutateWorkbenchState(state=>{state.settings.analysisSessionId=null;state.settings.summarySessionId=null;return state});sessionServices.sessionController.create=async()=>{throw Error('MISSING_CREDENTIAL provider unavailable')};const creationAnalysis=await api.analyzeRun({onlyIds:['outage-2'],limit:1});const creationSummary=await api.radarSummarize({onlyIds:[pauseRadar.id],retryFailed:true});
 check('创建后台会话阶段的模型认证故障同样有限退避，不污染业务条目',()=>{assert.equal(creationAnalysis.status,'deferred');assert.equal(creationSummary.status,'deferred');assert.equal(host.loadWorkbenchState().modelHealth.analysis.failures,1);assert.equal(host.loadWorkbenchState().modelHealth.summary.failures,1);assert.equal(host.loadWorkbenchState().analysisQueue.find(r=>r.id==='outage-2').attempts,0)})
 const portable=await api.exportMigration();const portableFile=join(home,'portable.json');writeFileSync(portableFile,JSON.stringify(portable));const targetHome=join(home,'target-home');mkdirSync(targetHome)
 const childCode=`import fs from 'node:fs';import {apply} from ${JSON.stringify(new URL('../index.js',import.meta.url).href)};let api;const dispose=[];apply({provide:(k,v)=>{if(k==='workbench')api=v},inject(){},effect(fn){const d=fn();if(typeof d==='function')dispose.push(d)},get(){},logger:{info(){}}},{});if(process.argv[1])await api.importMigration({payload:JSON.parse(fs.readFileSync(process.argv[1],'utf8')),mode:'replace'});const pack=await api.exportMigration();console.log(JSON.stringify({counts:pack.counts,ids:pack.data.tasks.map(t=>t.id)}));dispose.forEach(fn=>fn())`
 const childEnv={...process.env,DSH_HOME:targetHome}
 const imported=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',childCode,portableFile],{env:childEnv,encoding:'utf8'}))
 const restarted=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',childCode],{env:childEnv,encoding:'utf8'}))
 check('新目录导入并独立进程重启，数量ID完全一致',()=>{assert.deepEqual(imported.counts,portable.counts);assert.deepEqual(restarted,imported)})
 const restartFile=join(targetHome,'storages/dev-workbench/state.json');const interrupted=JSON.parse(readFileSync(restartFile,'utf8'));interrupted.sources.push({id:'current-recovery-source',provider:'test',fetchedAt:new Date().toISOString(),locator:{sentAt:new Date().toISOString()}});interrupted.analysisQueue.unshift({id:'current-recovery-entry',sourceId:'current-recovery-source',status:'running',leaseUntil:new Date(Date.now()+600000).toISOString()});writeFileSync(restartFile,JSON.stringify(interrupted))
 const recoveryCode=`import {loadWorkbenchState} from ${JSON.stringify(new URL('file://'+bundle).href)};const s=loadWorkbenchState();console.log(JSON.stringify({entry:s.analysisQueue[0],taskCount:s.tasks.length,revision:s.revision}))`
 const recovered=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',recoveryCode],{env:childEnv,encoding:'utf8'}))
 check('独立进程立即恢复未过期的中断租约，任务不重复',()=>{assert.equal(recovered.entry.status,'pending');assert.equal(recovered.entry.leaseUntil,null);assert.equal(recovered.taskCount,interrupted.tasks.length);assert.ok(recovered.revision>interrupted.revision)})
 const reloadCode=`import assert from 'node:assert/strict';import fs from 'node:fs';
const moduleUrl=${JSON.stringify(new URL('file://'+bundle).href)};const a=await import(moduleUrl+'?generation=a');
function mount(module){let api;const cleanups=[];module.apply({provide:(k,v)=>{if(k==='workbench')api=v},inject(){},effect(fn){const d=fn();if(typeof d==='function')cleanups.push(d)},get(){},logger:{info(){}}},{});return{api,dispose:()=>cleanups.forEach(fn=>fn())}}
const first=mount(a);await first.api.createTask({title:'重载前任务'});const initial=a.loadWorkbenchState().revision;
let release,started;const gate=new Promise(r=>release=r);const ready=new Promise(r=>started=r);
const oldCommit=a.mutateWorkbenchState(async s=>{started();await gate;s.tasks=[]});const rejected=assert.rejects(oldCommit,/实例已替换/);await ready;
const b=await import(moduleUrl+'?generation=b');const second=mount(b);const newCommit=second.api.createTask({title:'重载后任务'});release();await rejected;await newCommit;
assert.throws(()=>a.loadWorkbenchState(),/实例已替换/);await assert.rejects(async()=>first.api.createTask({title:'旧实例误写'}),/实例已替换/);
first.dispose();await second.api.createTask({title:'旧清理后的任务'});const s=b.loadWorkbenchState();assert.equal(s.tasks.length,3);assert.ok(s.revision>initial);assert.deepEqual(s.tasks.map(t=>t.title),['重载前任务','重载后任务','旧清理后的任务']);
const c=await import(moduleUrl+'?generation=c');const third=mount(c);second.dispose();await third.api.createTask({title:'第三代任务'});const final=c.loadWorkbenchState();assert.equal(final.tasks.length,4);assert.ok(final.revision>s.revision);let releaseSame,startedSame;const sameGate=new Promise(r=>releaseSame=r),sameReady=new Promise(r=>startedSame=r);const sameCommit=c.mutateWorkbenchState(async state=>{startedSame();await sameGate;state.tasks=[]});const sameRejected=assert.rejects(sameCommit,/实例已替换/);await sameReady;const fourth=mount(c);third.dispose();releaseSame();await sameRejected;await fourth.api.createTask({title:'同模块再次挂载'});assert.equal(c.loadWorkbenchState().tasks.length,5);fourth.dispose();console.log(JSON.stringify({retained:final.tasks.length,revision:final.revision}))`
 const reloaded=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',reloadCode],{env:{...process.env,DSH_HOME:join(home,'reload-home')},encoding:'utf8'}))
 check('三代热重载共用提交队列，旧异步事务和旧API禁止写入，旧清理不影响新实例',()=>assert.equal(reloaded.retained,4))
 console.log('reliability:',checks,'scenario checks passed')
} finally {for(const dispose of disposers)dispose();rmSync(home,{recursive:true,force:true})}
