/** Scoped intake + deterministic calendar merge. Synthetic temp data only, no live provider calls. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const dir=mkdtempSync(join(tmpdir(),'workbench-focused-'));process.env.DSH_HOME=dir
await build({stdin:{contents:`export * from './src/shared/message-intake.ts';export {fetchFocusedMessages} from './src/host/integrations/message-intake.ts';export * from './src/host/integrations/calendar-sync.ts';export * from './src/host/domain/meeting-match.ts';export {emptyWorkbenchState,normalizeState} from './src/host/domain/model.ts';export {skipHistoricalMessages,messageSkipReason} from './src/host/domain/message-policy.ts';export {mergeAnalysisIntoState,buildAnalysisPacket,analysisScope,validateAnalysis} from './src/host/analysis/message-analysis.ts';export {collectReminders} from './src/host/workflows/reminders.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:join(dir,'fixture.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const h=await import(join(dir,'fixture.mjs'));let checks=0
const check=(name,fn)=>{fn();checks++;console.log('✓ '+name)},at=new Date().toISOString(),start=new Date(Date.now()+3600000).toISOString(),end=new Date(Date.now()+7200000).toISOString(),selection={policy:'focused-v1',reasons:['mention_me'],unreadCount:0,observedAt:at}
const msg=(id,extra={})=>({msgId:id,content:'普通消息',fromOpenId:'other',sendTime:at,param:{},...extra})
try{
 check('结构化@他人不能因notifyType误入本人；@all支持desc/flag和明确正文',()=>{assert.deepEqual(h.mentionSignals(msg('x',{param:{notifyType:1,desc:[{type:'at',data:'other'}]}}),'me'),[]);for(const param of [{desc:[{type:'at',data:'all'}]},{notifyToAll:true}])assert.deepEqual(h.mentionSignals(msg('x',{param}),'me'),['mention_all']);assert.deepEqual(h.mentionSignals(msg('x',{content:'@all 请参加会议'}),'me'),['mention_all'])})
 const liveHead=msg('private-head',{content:'代码记得提交'}),headGroup={groupId:'priority-private',groupType:1,unreadCount:2,lastMsgId:liveHead.msgId,lastMsg:liveHead};let firstRead=null;const headerRun=async(_ctx,args)=>{if(args.includes('recent'))return {status:'ok',json:{data:{list:[{groupId:'old-mentioned',groupType:2,unreadCount:0,lastMsg:msg('old-at',{param:{notifyType:1}})},headGroup],more:false}}};firstRead ||= args[args.indexOf('--group-id')+1];return {status:'rate_limited',note:'synthetic rate limit'}};const early=await h.fetchFocusedMessages({}, {openId:'me'}, {},at,headerRun,{})
 check('新私聊未读优先于群历史@补采，正文接口限流也保留可信最新消息',()=>{assert.equal(firstRead,'priority-private');assert.equal(early.mentions.length,1);assert.equal(early.mentions[0].content,'代码记得提交');assert.deepEqual(early.mentions[0].selection.reasons,['unread']);assert.equal(early.rateLimited,true)})
 const duplicateHead=await h.fetchFocusedMessages({}, {openId:'me'}, {},at,async(_ctx,args)=>({status:'ok',json:{data:args.includes('recent')?{list:[headGroup],more:false}:{list:[liveHead]}}}),{})
 check('最新私聊同时来自会话头和正文页时只入库一次',()=>assert.equal(duplicateHead.mentions.length,1))
 const groups=[{groupId:'read',groupType:2,unreadCount:0,lastMsgId:'r4'},{groupId:'unread',groupType:2,unreadCount:1,lastMsgId:'u2'},{groupId:'private-read',groupType:1,unreadCount:0,lastMsgId:'p1'},{groupId:'follow',groupType:2,unreadCount:0,lastMsgId:'f2'}]
 const messages={read:[msg('r1'),msg('r2',{param:{desc:[{type:'at',data:'me'}]}}),msg('r3',{param:{desc:[{type:'at',data:'all'}]}}),msg('r4',{param:{desc:[{type:'at',data:'other'}]}})],unread:[msg('u1'),msg('u2')],'private-read':[msg('p1')],follow:[msg('f1',{fromOpenId:'me',param:{replyMsgId:'known'}}),msg('f2',{fromOpenId:'me'})]}
 let calls=0
 const run=async(_ctx,args)=>{if(args.includes('recent'))return {status:'ok',json:{data:{list:groups,more:false,unreadTotal:1}}};calls++;return {status:'ok',json:{data:{list:messages[args[args.indexOf('--group-id')+1]]}}}}
 const context={sources:[{id:'known-source',provider:'yunzhijia',locator:{accountId:'me',groupId:'follow',msgId:'known'}}],tasks:[{id:'t',status:'ready',sourceRefId:'known-source'}],replies:[]}
 const fetched=await h.fetchFocusedMessages({}, {openId:'me'}, {},at,run,context)
 check('只收未读窗口/@本人/@全员/明确引用，已读私聊与普通群聊不入库不排队',()=>{assert.deepEqual(fetched.mentions.map(m=>m.msgId).sort(),['r2','r3','u2','f1'].sort());assert.equal(fetched.mentions.find(m=>m.msgId==='f1').intake,false);assert.deepEqual(fetched.mentions.find(m=>m.msgId==='u2').selection.reasons,['unread']);assert.equal(fetched.inbox.unreadTotal,1)})
 const legacyCursors=structuredClone(fetched.cursors);delete legacyCursors['me:unread'].unreadHeadId;delete legacyCursors['me:unread'].unreadMsgIds;calls=0;
 const reverified=await h.fetchFocusedMessages({}, {openId:'me'},legacyCursors,at,run,context)
 check('旧游标缺少未读清单时仅对当前未读补验，后续无新消息不重复读取',()=>{assert.equal(calls,1);assert.deepEqual(reverified.cursors['me:unread'].unreadMsgIds,['u2']);assert.equal(reverified.cursors['me:unread'].unreadHeadId,'u2')})
 calls=0;await h.fetchFocusedMessages({}, {openId:'me'},reverified.cursors,at,run,context);check('补验完成后保留完整清单且不重复读取正文',()=>assert.equal(calls,0))
 calls=0;groups.forEach(g=>g.unreadCount=0)
 const next=await h.fetchFocusedMessages({}, {openId:'me'},fetched.cursors,at,run,context)
 check('无新消息仍刷新未读快照，不再次抓取和提交已见消息',()=>{assert.equal(calls,0);assert.equal(next.mentions.length,0);assert.ok(next.inbox.conversations.every(c=>c.unreadCount===0))})
 groups[1].unreadCount=1
 const raised=await h.fetchFocusedMessages({}, {openId:'me'},next.cursors,at,run,context)
 check('同一条最新消息由已读转未读仍重新筛选，普通已读部分不入库',()=>assert.deepEqual(raised.mentions.map(m=>m.msgId),['u2']))
 const many=Array.from({length:145},(_,i)=>msg('tail-'+i)),header={groupId:'tail',groupType:1,lastMsgId:'tail-144',unreadCount:100}
 const tailRun=async(_ctx,args)=>{if(args.includes('recent'))return {status:'ok',json:{data:{list:[header],more:false}}};const old=args.includes('old'),anchor=args[args.indexOf('--msg-id')+1],stop=old?many.findIndex(m=>m.msgId===anchor):many.length;return {status:'ok',json:{data:{list:many.slice(Math.max(0,stop-20),stop)}}}}
 const tail=await h.fetchFocusedMessages({}, {openId:'me'}, {},at,tailRun,{}),resumed=await h.fetchFocusedMessages({}, {openId:'me'},h.normalizeState({...h.emptyWorkbenchState(),syncCursors:tail.cursors}).state.syncCursors,at,tailRun,{})
 check('长未读窗口跨重启续采，145条中只收最后100条，不把更旧已读消息纳入',()=>{const ids=new Set([...tail.mentions,...resumed.mentions].map(m=>m.msgId));assert.equal(ids.size,100);assert.ok(ids.has('tail-45'));assert.ok(!ids.has('tail-44'));assert.equal(resumed.cursors['me:tail'].lastMsgId,'tail-144')})
 check('未读清单跨分页及重启完整保留，并绑定会话最新消息',()=>{const cursor=resumed.cursors['me:tail'];assert.equal(cursor.unreadMsgIds.length,100);assert.equal(new Set(cursor.unreadMsgIds).size,100);assert.equal(cursor.unreadHeadId,'tail-144');assert.ok(cursor.unreadMsgIds.includes('tail-45'));assert.ok(!cursor.unreadMsgIds.includes('tail-44'));assert.equal(resumed.inbox.conversations[0].latestMsgId,'tail-144');const normalized=h.normalizeState({...h.emptyWorkbenchState(),syncCursors:resumed.cursors}).state;assert.deepEqual(normalized.syncCursors['me:tail'].unreadMsgIds,cursor.unreadMsgIds)})
 check('明确相关性在识别及落盘正常化后保留，旧结果保持未知',()=>{const source={excerpt:'其他项目的广告',locator:{}},scope={tasks:[],replies:[]};const analysis=h.validateAnalysis({noise:true,relevance:'irrelevant',items:[]},source,scope);assert.equal(analysis.relevance,'irrelevant');assert.equal(h.validateAnalysis({noise:true,items:[]},source,scope).relevance,null);const state=h.normalizeState({...h.emptyWorkbenchState(),analysisQueue:[{id:'triage',sourceId:'triage-source',status:'done',analysis}]}).state;assert.equal(state.analysisQueue[0].analysis.relevance,'irrelevant');assert.throws(()=>h.validateAnalysis({noise:false,relevance:'irrelevant',items:[]},source,scope),/冲突/);assert.match(h.buildAnalysisPacket(h.emptyWorkbenchState(),[],{},'relevance-test').text,/relevance/)})
 let budgetCalls=0;const budgetGroups=Array.from({length:20},(_,i)=>({groupId:'budget-'+i,groupType:2,lastMsgId:'bm-'+i,unreadCount:1}))
 const budgetRun=async(_ctx,args)=>{budgetCalls++;return args.includes('recent')?{status:'ok',json:{data:{list:budgetGroups,more:false}}}:{status:'ok',json:{data:{list:[msg('bm-'+args[args.indexOf('--group-id')+1].slice(7))]}}}}
 const budget=await h.fetchFocusedMessages({}, {openId:'me'}, {},at,budgetRun,{})
 check('单轮最多12次CLI读取，待采会话和预算原因持久化；不冒充限流',()=>{assert.equal(budgetCalls,12);assert.equal(budget.deferred,true);assert.equal(budget.rateLimited,false);assert.ok(budget.cursors['__pending:me'].pendingGroups.length);assert.equal(budget.cursors['__pending:me'].reason,'budget')})
 budgetCalls=0;const cooldown=await h.fetchFocusedMessages({}, {openId:'me'},budget.cursors,at,budgetRun,{})
 check('预算等待期间不再次读取正文，冷却报告区别于服务限流',()=>{assert.equal(budgetCalls,0);assert.equal(cooldown.deferred,true);assert.equal(cooldown.rateLimited,false)})
 budget.cursors['__pending:me'].retryAt=null;const drained=await h.fetchFocusedMessages({}, {openId:'me'},budget.cursors,at,budgetRun,{})
 check('下轮优先补齐未采会话，同页去重后20条全部覆盖',()=>{assert.equal(new Set([...budget.mentions,...drained.mentions].map(m=>m.msgId)).size,20);assert.equal(drained.cursors['__pending:me'].pendingGroups.length,0)})
 let freshHeader=false;const staleHeader={groupId:'stale',groupType:2,lastMsgId:'stale-msg',unreadCount:1},staleRun=async(_ctx,args)=>args.includes('recent')?{status:'ok',json:{data:{list:freshHeader?[staleHeader]:[],more:false}}}:{status:'ok',json:{data:{list:[msg('stale-msg')]}}}
 const stale=await h.fetchFocusedMessages({}, {openId:'me'},{'__pending:me':{intakePolicy:'focused-v1',pendingGroups:[staleHeader]}},at,staleRun,{})
 freshHeader=true;const verified=await h.fetchFocusedMessages({}, {openId:'me'},stale.cursors,at,staleRun,{})
 check('旧补采头未刷新时未读保持未知，后续同ID取得新快照仍补收未读窗口',()=>{assert.equal(stale.mentions.length,0);assert.equal(stale.cursors['me:stale'].unreadCount,null);assert.equal(verified.mentions[0].msgId,'stale-msg');assert.deepEqual(verified.mentions[0].selection.reasons,['unread'])})
 const legacy=h.emptyWorkbenchState();legacy.sources=[{id:'legacy',provider:'yunzhijia',excerpt:'普通旧消息',fetchedAt:at,locator:{sentAt:at}}];legacy.analysisQueue=[{sourceId:'legacy',status:'pending'},{sourceId:'legacy',status:'done'}];h.skipHistoricalMessages(legacy)
 check('旧全量队列退役但保留已完成结果；显式重试也不能绕过范围',()=>{assert.equal(legacy.analysisQueue[0].status,'skipped');assert.equal(legacy.analysisQueue[1].status,'done');assert.ok(h.messageSkipReason(legacy,legacy.sources[0]));assert.equal(h.messageSkipReason(legacy,{...legacy.sources[0],selection}),null)})
 const legacyScopeState={...h.emptyWorkbenchState(),sources:[{id:'old',provider:'yunzhijia',excerpt:'不应发给AI的旧聊天原文',projectId:null,locator:{accountId:'me',groupId:'scope',msgId:'origin'}},{id:'new',provider:'yunzhijia',selection,projectId:null,excerpt:'已处理',fetchedAt:at,locator:{accountId:'me',groupId:'scope',replyToMsgId:'origin',sentAt:at}}],tasks:[{id:'existing',title:'原有待办',sourceRefId:'old',status:'ready'}],replies:[{id:'existing-reply',sourceId:'old',msgId:'origin',stage:'待回复',taskIds:[]}]}
 check('明确跟进能关联原有业务记录，旧全量聊天原文仍不进入模型上下文',()=>{const scope=h.analysisScope(legacyScopeState,legacyScopeState.sources[1]);assert.equal(scope.tasks[0].id,'existing');assert.equal(scope.replies[0].id,'existing-reply');assert.ok(!scope.context.some(s=>s.id==='old'))})
 const state=h.emptyWorkbenchState(),plan={accountId:'me',projectId:null,report:{status:'ok',at,found:1},events:[{id:'event-1',title:'部门质量星期四',start,end,location:'A303培训教室',cancelled:false,readStatus:0,noticeTime:0}]}
 h.applyCalendarPlan(state,plan);h.applyCalendarPlan(state,plan)
 check('日历会议直接建档，重复拉取仅一任务一来源且不进入AI队列',()=>{assert.equal(state.tasks.length,1);assert.equal(state.sources.length,1);assert.equal(state.analysisQueue.length,0);assert.equal(state.tasks[0].meetingStart,start)})
 const source={id:'chat',provider:'yunzhijia',selection,projectId:null,excerpt:'@all 质量星期四，A303，请参加。',fetchedAt:at,locator:{accountId:'me',groupId:'g',msgId:'chat',sentAt:at,intake:true}};state.sources.push(source)
 const merged=h.mergeAnalysisIntoState(state,{sourceId:'chat',msgId:'chat'},{noise:false,items:[{title:'月度质量星期四',eventType:'meeting',needsAction:true,needsReply:false,meetingStart:start,meetingEnd:null,meetingLocation:'A303'}]},{forceCreate:true})
 check('@all会议与同账号/时间/地点的唯一日历会议合并引用，不生成第二任务',()=>{assert.equal(state.tasks.length,1);assert.equal(merged.created.length,0);assert.equal(state.tasks[0].sourceRefs.length,2)})
 const id=state.tasks[0].id,changed={...plan,events:[{...plan.events[0],start:new Date(Date.parse(start)+1800000).toISOString(),end:new Date(Date.parse(end)+1800000).toISOString(),location:'A305'}]};h.applyCalendarPlan(state,changed)
 check('日历改期和地点更新沿用原ID，会议提醒只产生一条',()=>{assert.equal(state.tasks[0].id,id);assert.equal(state.tasks[0].meetingLocation,'A305');assert.equal(state.tasks[0].meetingStart,changed.events[0].start);assert.equal(h.collectReminders(state,Date.parse(changed.events[0].start)-60000).filter(r=>r.kind==='meeting').length,1)})
 state.tasks[0].humanGuard.editedFields=['title','meetingLocation'];state.tasks[0].title='人工标题';state.tasks[0].meetingLocation='人工地点';h.applyCalendarPlan(state,{...changed,events:[{...changed.events[0],title:'远端新标题',location:'A306'}]})
 check('远端更新保留人工字段',()=>{assert.equal(state.tasks[0].title,'人工标题');assert.equal(state.tasks[0].meetingLocation,'人工地点')})
 h.applyCalendarPlan(state,{...plan,events:[{...plan.events[0],cancelled:true}]})
 check('明确取消更新原会议状态；接口失败或会议未列出不能假定取消',()=>{assert.equal(state.tasks[0].status,'cancelled');const copy=structuredClone(state);h.applyCalendarPlan(state,{...plan,report:{status:'error'},events:[]});assert.deepEqual(state,copy)})
 h.applyCalendarPlan(state,{...plan,events:[{...plan.events[0],cancelled:false}]})
 check('远端撤销取消可恢复自动状态，已完成人工记录不被重开',()=>{assert.equal(state.tasks[0].status,'ready');state.tasks[0].status='completed';h.applyCalendarPlan(state,plan);assert.equal(state.tasks[0].status,'completed')})
 h.applyCalendarPlan(state,{...plan,accountId:'other-account'})
 check('不同账号同一event ID隔离，状态正常化保留日历来源和重点标记',()=>{assert.equal(state.tasks.length,2);const normalized=h.normalizeState({...state,messageInbox:fetched.inbox}).state;assert.equal(normalized.messageInbox.unreadTotal,1);assert.equal(normalized.sources.find(s=>s.id==='chat').selection.policy,'focused-v1')})
 check('结束的会议不继续产生会前提醒，不伪造任务完成状态',()=>{const task={...state.tasks[1],meetingStart:new Date(Date.now()-7200000).toISOString(),meetingEnd:new Date(Date.now()-3600000).toISOString()};assert.equal(h.collectReminders({tasks:[task],replies:[]}).length,0);assert.equal(task.status,'ready')})
 check('同时间地点存在多场候选会议时不猜测合并',()=>{const duplicate={...state.tasks[1],id:'ambiguous'};state.tasks.push(duplicate);assert.equal(h.findCalendarMeetingTask(state,{eventType:'meeting',meetingStart:start,title:'质量星期四',meetingLocation:'A303'},{projectId:null,locator:{accountId:'other-account'}}),null)})
 console.log('focused-intake: '+checks+' scenarios passed')
}finally{rmSync(dir,{recursive:true,force:true})}
