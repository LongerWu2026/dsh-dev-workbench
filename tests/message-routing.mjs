/** Agreed routing rules, real domain functions and isolated read-only CLI fixtures. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-routing-'));process.env.DSH_HOME=home
await build({stdin:{contents:`export {emptyWorkbenchState,normalizeState,normalizeSource} from './src/host/domain/model.ts';export * from './src/host/domain/reply-routing.ts';export {canCreateMessageTask} from './src/shared/message-intake.ts';export {mergeAnalysisIntoState,upsertReply,validateAnalysis,analysisScope} from './src/host/analysis/message-analysis.ts';export {syncYunzhijiaMessages} from './src/host/integrations/yunzhijia.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const h=await import(join(home,'host.mjs'));let checks=0
const at=new Date(Date.now()-30000).toISOString(),later=new Date().toISOString(),check=(label,fn)=>{fn();checks++;console.log('✓ '+label)}
const source=(id,type=1,reasons=['unread'],extra={})=>h.normalizeSource({id,provider:'yunzhijia',externalId:id,title:'合成消息',excerpt:'请处理并反馈',fetchedAt:at,selection:{policy:'focused-v1',reasons,unreadCount:1,observedAt:later},locator:{accountId:'org:me',groupId:'group',groupName:'合成会话',groupType:type,msgId:id,senderId:'other',sentAt:at,direction:'inbound',intake:true},...extra})
const entry=s=>({id:'queue-'+s.id,sourceId:s.id,msgId:s.locator.msgId,groupId:s.locator.groupId,accountId:s.locator.accountId,status:'pending',attempts:0,at})
const make=sources=>{const s=h.emptyWorkbenchState();s.settings.aiExtract={enabled:true,autoRegister:true};s.sources=sources;s.analysisQueue=sources.map(entry);return s}
const work={noise:false,items:[{title:'开发接口',needsAction:true,needsReply:true,eventType:'feature'}]},question={noise:false,items:[{title:'反馈进度',needsAction:false,needsReply:true}]}
const merge=(s,analysis,index=0)=>h.mergeAnalysisIntoState(s,s.analysisQueue[index],analysis)
try{
 let s=make([source('private')]);h.seedUnreadPrivateReplies(s,'org:me')
 check('私聊未读在调用AI前即进入待回复，AI关闭也能显示',()=>{assert.equal(s.replies.length,1);assert.equal(s.replies[0].triage,'pending');assert.equal(s.replies[0].stage,'待回复');assert.equal(s.tasks.length,0)})
 h.seedUnreadPrivateReplies(s,'org:me');check('重复采集同一私聊消息不新增待回复',()=>assert.equal(s.replies.length,1))
 merge(s,work)
 check('私聊具体事项只建待办，即使模型同时返回需答复也不会两边重复',()=>{assert.equal(s.tasks.length,1);assert.equal(s.replies[0].stage,'不需回复');assert.equal(s.replies[0].triage,'task');assert.equal(s.replies[0].taskIds[0],s.tasks[0].id);assert.equal(s.replies[0].repliedAt,null)})
 merge(s,work);check('重复识别沿用同一任务和回复记录',()=>{assert.equal(s.tasks.length,1);assert.equal(s.replies.length,1)})
 s=make([source('private-meeting')]);h.seedUnreadPrivateReplies(s,'org:me');merge(s,{noise:false,items:[{title:'参加评审会议',needsAction:true,needsReply:true,eventType:'meeting',meetingStart:later}]});check('私聊明确参会通知形成会议待办，不重复留在待回复',()=>{assert.equal(s.tasks[0].eventType,'meeting');assert.equal(s.replies[0].triage,'task');assert.equal(s.replies[0].stage,'不需回复')})
 s=make([source('review')]);s.settings.aiExtract.autoRegister=false;h.seedUnreadPrivateReplies(s,'org:me');merge(s,work);check('关闭自动建档仍尊重人工确认设置，事项转至识别复核而非冒充已建任务',()=>{assert.equal(s.tasks.length,0);assert.equal(s.replies[0].triage,'task');assert.equal(s.replies[0].taskIds.length,0)})
 s=make([source('question')]);h.seedUnreadPrivateReplies(s,'org:me');merge(s,question)
 check('普通私聊问题保留待回复、不制造业务任务',()=>{assert.equal(s.tasks.length,0);assert.equal(s.replies[0].triage,'reply');assert.equal(s.replies[0].stage,'待回复')})
 s.messageInbox={accountId:'org:me',conversations:[{groupId:'group',groupType:1,unreadCount:0,latestDirection:'inbound',latestMsgId:'question',latestSentAt:at}]};h.seedUnreadPrivateReplies(s,'org:me')
 check('已读但没回只更新标记，确认的回复义务不消失',()=>assert.equal(s.replies[0].stage,'待回复'))
 s.messageInbox.conversations[0]={...s.messageInbox.conversations[0],latestDirection:'outbound',latestMsgId:'own',latestSentAt:later};h.seedUnreadPrivateReplies(s,'org:me')
 check('最新本人消息将私聊标已回复，保留真实时间和消息证据',()=>{assert.equal(s.replies[0].stage,'已回复');assert.equal(s.replies[0].repliedAt,later);assert.equal(s.replies[0].evidenceMsgId,'own')})
 const second=source('followup');second.locator.sentAt=new Date(Date.parse(later)+1000).toISOString();s.sources.push(second);s.analysisQueue.push(entry(second));h.seedUnreadPrivateReplies(s,'org:me')
 check('对方发来新一轮未读消息创建新的待回复，不篡改原已回复历史',()=>{assert.equal(s.replies[0].stage,'已回复');assert.equal(s.replies[1].stage,'待回复')})
 s=make([source('noise')]);h.seedUnreadPrivateReplies(s,'org:me');merge(s,{noise:true,items:[]})
 check('问候感谢表情等无义务内容识别后退出待回复，不伪造已答复',()=>{assert.equal(s.tasks.length,0);assert.equal(s.replies[0].triage,'noise');assert.equal(s.replies[0].stage,'不需回复');assert.equal(s.replies[0].repliedAt,null)})
 s=make([source('manual')]);h.seedUnreadPrivateReplies(s,'org:me');s.replies[0].humanGuard=true;merge(s,work)
 check('人工明确保留的回复阶段受保护，AI不会覆盖人工选择',()=>assert.equal(s.replies[0].stage,'待回复'))
 s=make([source('group',2)]);merge(s,work)
 check('未@的群未读消息即使模型误判为工作，代码也拒绝新建任务',()=>{assert.equal(s.tasks.length,0);assert.equal(s.replies.length,1);assert.equal(h.canCreateMessageTask(s.sources[0]),false);h.mergeAnalysisIntoState(s,s.analysisQueue[0],work,{forceCreate:true});assert.equal(s.tasks.length,0)})
 s=make([source('group-meeting',2)]);merge(s,{noise:false,items:[{title:'群会议通知',eventType:'meeting',needsAction:true,needsReply:false,meetingStart:later}]})
 check('未@的群会议通知不绕过任务创建硬限制',()=>assert.equal(s.tasks.length,0))
 for(const reason of ['mention_me','mention_all']){s=make([source(reason,2,[reason])]);merge(s,work);check(reason+'交办由AI判断后可以建任务',()=>assert.equal(s.tasks.length,1))}
 s=make([source('broadcast',2,['mention_all'])]);merge(s,{noise:true,items:[]});check('@全员纯知会不生成待办或待回复',()=>{assert.equal(s.tasks.length,0);assert.equal(s.replies.length,0)})
 s=make([source('read',2)]);s.sources[0].selection=null;assert.throws(()=>merge(s,work),/旧全量消息队列/);check('普通已读群聊不能绕过入口进入自动识别',()=>assert.equal(s.tasks.length,0))
 s=make([source('work')]);merge(s,work);const task=s.tasks[0],own=source('own',1,['followup'],{excerpt:'已完成、已提交；这个不用处理，取消'});own.locator={...own.locator,direction:'outbound',intake:false,replyToMsgId:'work',sentAt:later};s.sources.push(own);s.analysisQueue.push(entry(own));merge(s,{noise:false,items:[{title:'完成',needsAction:true,needsReply:false,relatedTaskId:task.id,completed:true,cancelled:true}]},1)
 check('本人说完成/取消及最新发言变化都不改变任务处理状态',()=>assert.equal(s.tasks[0].status,'ready'))
 s=make([source('quoted',2,['mention_me'])]);merge(s,question);const r=s.replies[0],unrelated=source('unrelated',2,['followup']);unrelated.locator.direction='outbound';unrelated.locator.intake=false;unrelated.locator.sentAt=later;s.sources.push(unrelated)
 h.upsertReply(s,entry(unrelated),unrelated,'已回复',r.id)
 check('群里本人无关发言不能借模型关联关闭原待回复',()=>assert.equal(r.stage,'待回复'))
 unrelated.locator.replyToMsgId='quoted';h.upsertReply(s,entry(unrelated),unrelated,'已回复',r.id)
 check('群里本人明确引用原消息后关闭对应待回复',()=>{assert.equal(r.stage,'已回复');assert.equal(r.repliedAt,later)})
 s=make([source('late')]);s.messageInbox={accountId:'org:me',conversations:[{groupId:'group',groupType:1,latestDirection:'outbound',latestMsgId:'late-own',latestSentAt:later}]};merge(s,question)
 check('AI结果晚于本人答复到达时，不会重新产生待回复义务',()=>assert.equal(s.replies[0].stage,'已回复'))
 s=make([source('isolated')]);s.messageInbox={accountId:'other',conversations:[{groupId:'group',latestDirection:'outbound',latestMsgId:'own',latestSentAt:later}]};h.seedUnreadPrivateReplies(s,'other');check('私聊占位和回复事实严格隔离账号',()=>assert.equal(s.replies.length,0))
 h.seedUnreadPrivateReplies(s,'org:me');const normalized=h.normalizeState(s).state
 check('重启标准化保留待识别分流和最新消息事实',()=>{assert.equal(normalized.replies[0].triage,'pending');assert.equal(normalized.messageInbox.conversations[0].latestDirection,'outbound')})
 s=make([source('legacy-type')]);s.sources[0].locator.groupType=null;s.messageInbox={accountId:'org:me',conversations:[{groupId:'group',groupType:1}]};h.seedUnreadPrivateReplies(s,'org:me');check('旧来源缺失会话类型时按同账号已验证快照补齐，不猜姓名或ID',()=>{assert.equal(s.sources[0].locator.groupType,1);assert.equal(s.replies[0].triage,'pending')})
 // Exercise the real sync commit before AI, including changes in latest sender.
 let latest={msgId:'live-unread',fromOpenId:'other',content:'请反馈一下进展',sendTime:later},unread=1,calls=[]
 const subprocess={resolveExecutable:async()=>'/fixture/yzj-cli',spawn(spec){const args=spec.argv.slice(1);calls.push(args);let data={};if(args[0]==='whoami')data={orgId:'org',openId:'me',name:'本人'};else if(args.includes('recent'))data={list:[{groupId:'live',groupType:1,groupName:'合成私聊',unreadCount:unread,lastMsg:latest,lastMsgId:latest.msgId}],unreadTotal:unread,more:false};else if(args[0]==='im'&&args.includes('list'))data={list:[latest]};else if(args[0]==='contact')data={list:[{openId:'other',name:'同事'}]};const text=JSON.stringify({success:true,data});return{done:Promise.resolve({exitCode:0}),collected:{stdout:{readFrom:()=>({text})},stderr:{readFrom:()=>({text:''})}}}}};const ctx={get:key=>key==='subprocess'?subprocess:null}
 await h.mutateWorkbenchState(st=>{st.sources=[];st.tasks=[];st.replies=[];st.analysisQueue=[];st.syncCursors={};st.settings.aiExtract={enabled:false};return st});await h.syncYunzhijiaMessages(ctx)
 check('真实同步提交链路在AI关闭时也登记私聊未读待回复',()=>{const st=h.loadWorkbenchState();assert.equal(st.replies.length,1);assert.equal(st.replies[0].triage,'pending')})
 unread=0;await h.syncYunzhijiaMessages(ctx);check('真实同步未读清零不关闭未答复消息',()=>assert.equal(h.loadWorkbenchState().replies[0].stage,'待回复'))
 latest={...latest,msgId:'live-own',fromOpenId:'me',sendTime:new Date(Date.now()+1000).toISOString()};await h.syncYunzhijiaMessages(ctx)
 check('真实同步最新本人发言关闭待回复，任务保持独立且未发送消息',()=>{const st=h.loadWorkbenchState();assert.equal(st.replies[0].stage,'已回复');assert.equal(st.tasks.length,0);assert.ok(calls.every(a=>!a.includes('send')))} )
 console.log('message-routing: '+checks+' scenarios passed')
}finally{rmSync(home,{recursive:true,force:true})}
