/** Isolated CLI fixtures: never sends a real enterprise message. */
import assert from 'node:assert/strict'
import {mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {build} from 'esbuild'
const home = mkdtempSync(join(tmpdir(), 'workbench-reply-send-'))
process.env.DSH_HOME = home
await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';export {runYzj,resolveSenderNames} from './src/host/integrations/yunzhijia.ts';export {normalizeState} from './src/host/domain/model.ts';export {messageSender,messageConversation} from './src/shared/message-display.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const host = await import(join(home, 'host.mjs'))
let api, checks=0, account='org:me', sendMode='ok', contactMode='ok', sends=[], lookups=[], holdSend, holdContact
let invalidContacts=new Set(), imRateLimited=false
const cleanups=[]
const envelope=data=>JSON.stringify({success:true,data})
const subprocess={resolveExecutable:async()=>'/fixture/yzj-cli',spawn(spec){
 const args=spec.argv.slice(1);let output=envelope({}),done=Promise.resolve({exitCode:0})
 if(args[0]==='whoami')output=envelope({openId:account.split(':').at(-1),orgId:account.split(':')[0],name:'当前用户'})
 if(args.includes('recent'))output=envelope({list:[],more:false})
 if(args.includes('recent')&&imRateLimited){output=JSON.stringify({success:false,error:{code:10000429,message:'too many requests'}});done=Promise.resolve({exitCode:1})}
 if(args[0]==='contact'){
  const ids=args.filter((_,i)=>args[i-1]==='--open-id');lookups.push(ids)
  output=contactMode==='fail'?JSON.stringify({success:false,errorCode:43001}):envelope({list:ids.map(openId=>({openId,name:'姓名'+openId}))})
  if(ids.some(id=>invalidContacts.has(id))){output=JSON.stringify({success:false,error:{code:1001001,message:'API error: errorCode=1001001, Invalid openIds'}});done=Promise.resolve({exitCode:1})}
  if(contactMode==='rate'){output=JSON.stringify({success:false,error:{code:10000429,message:'too many requests'}});done=Promise.resolve({exitCode:1})}
  if(holdContact)done=new Promise(r=>holdContact.release=r)
 }
 if(args.includes('send')){
  sends.push(spec)
  output=sendMode==='reject'?JSON.stringify({success:false,errorCode:43001}):sendMode==='invalid'?'not-json':envelope({msgId:'sent-fixture'})
  if(holdSend)done=new Promise(r=>holdSend.release=r)
 }
 return {collected:{stdout:{readFrom:()=>({text:output})},stderr:{readFrom:()=>({text:''})}},done,terminate(){}}
}}
const ctx={provide:(n,v)=>{if(n==='workbench')api=v},get:n=>n==='subprocess'?subprocess:null,inject(){},effect:fn=>{const d=fn();if(typeof d==='function')cleanups.push(d)},logger:{info(){}}}
host.apply(ctx,{})
const state=()=>host.loadWorkbenchState(),check=(label,fn)=>{fn();checks++;console.log('✓',label)}
const source=(id,senderId='sender-'+id,acct='org:me')=>({id,provider:'yunzhijia',selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:null,observedAt:new Date().toISOString()},externalId:'ext-'+id,title:'消息 · conversation',excerpt:'请回复进度',sender:senderId.slice(0,8)+'…',fetchedAt:new Date().toISOString(),locator:{groupId:'conversation',groupName:'conversation',msgId:'msg-'+id,accountId:acct,senderId,direction:'inbound',intake:true}})
const request=id=>({id,text:'已收到，我会核实。\n保留 $() 与 `文本`',groupId:'conversation',msgId:'msg-'+id,accountId:'org:me',confirmed:true})
async function seed(id){await host.mutateWorkbenchState(s=>{s.sources.push(source(id));s.replies.push({id,sourceId:id,msgId:'msg-'+id,groupId:'conversation',groupName:'conversation',accountId:'org:me',stage:'待回复',contact:'conversation',taskIds:[]});return s})}
async function until(test){for(let i=0;i<100&&!test();i++)await new Promise(r=>setTimeout(r,1));assert.ok(test())}
try {
 await seed('ok')
 const count=sends.length
 await assert.rejects(api.sendReply({...request('ok'),confirmed:false}),/核对/)
 await assert.rejects(api.sendReply({...request('ok'),text:'  '}),/正文/)
 await assert.rejects(api.sendReply({...request('ok'),text:'字'.repeat(8001)}),/正文/)
 await assert.rejects(api.sendReply({...request('ok'),groupId:'wrong'}),/变化/)
 await assert.rejects(api.sendReply({...request('ok'),msgId:'wrong'}),/变化/)
 account='other:me';await assert.rejects(api.sendReply(request('ok')),/账号/);account='org:me'
 check('未确认、空正文、超长、目标变化和账号不匹配均不发送',()=>assert.equal(sends.length,count))
 const refused=await host.runYzj(ctx,['im','message','send','--group-id','conversation','--msg-type','text','--content','禁止后台发送'])
 check('后台只读入口仍拒绝send',()=>{assert.equal(refused.status,'refused');assert.equal(sends.length,count)})
 await api.sendReply(request('ok'))
 check('引用原消息向原会话发送纯文本，正文原样作为argv单个参数',()=>{
  assert.deepEqual(sends.at(-1).argv,['/fixture/yzj-cli','im','message','send','--group-id','conversation','--msg-type','text','--content',request('ok').text,'--reply-msg-id','msg-ok'])
  const r=state().replies.find(r=>r.id==='ok');assert.equal(r.stage,'已回复');assert.ok(r.repliedAt);assert.equal(r.humanGuard,true)
  assert.equal(state().replyDrafts.ok.delivery.msgId,'sent-fixture')
 })
 await assert.rejects(api.sendReply(request('ok')),/已处理/)
 await api.setReplyStage('ok','待回复');await api.saveReplyDraft('ok','修改草稿不清除发送记录')
 await assert.rejects(api.sendReply(request('ok')),/发送记录/)
 check('重新打开阶段或编辑草稿不能重复发送',()=>assert.equal(sends.length,count+1))
 await seed('private-plain');await host.mutateWorkbenchState(s=>{s.sources.find(x=>x.id==='private-plain').locator.groupType=1;return s});await api.sendReply(request('private-plain'))
 check('私聊直接发送原正文，不添加@参数或原消息引用，仍保留本地来源',()=>{const args=sends.at(-1).argv;assert.deepEqual(args,['/fixture/yzj-cli','im','message','send','--group-id','conversation','--msg-type','text','--content',request('private-plain').text]);assert.equal(state().replyDrafts['private-plain'].delivery.mode,'plain');assert.equal(state().replyDrafts['private-plain'].delivery.sourceMsgId,'msg-private-plain');assert.equal(state().replies.find(r=>r.id==='private-plain').stage,'已回复')})
 await seed('rejected');sendMode='reject'
 await assert.rejects(api.sendReply(request('rejected')),/发送失败/)
 check('服务端拒绝不标记已回复并保留正文',()=>{assert.equal(state().replies.find(r=>r.id==='rejected').stage,'待回复');assert.equal(state().replyDrafts.rejected.text,request('rejected').text);assert.equal(state().replyDrafts.rejected.delivery.status,'failed')})
 sendMode='ok';await api.sendReply(request('rejected'))
 await seed('uncertain');sendMode='invalid'
 await assert.rejects(api.sendReply(request('uncertain')),/未确认/)
 const prior=sends.length;await assert.rejects(api.sendReply(request('uncertain')),/发送记录/)
 check('结果不明确时保留待回复并阻止重发，重启标准化保留发送记录',()=>{assert.equal(sends.length,prior);assert.equal(state().replies.find(r=>r.id==='uncertain').stage,'待回复');assert.equal(host.normalizeState(state()).state.replyDrafts.uncertain.delivery.status,'uncertain')})
 await seed('concurrent');sendMode='ok';holdSend={}
 const inFlight=api.sendReply(request('concurrent'));await until(()=>!!holdSend.release)
 await assert.rejects(api.sendReply(request('concurrent')),/发送记录/)
 await api.saveReplyDraft('concurrent','发送期间的人工草稿')
 await api.setReplyStage('concurrent','不需回复')
 await api.createTask({title:'并发保留的待办'})
 holdSend.release({exitCode:0});await inFlight;holdSend=null
 check('并发点击只发一次，网络等待期间的人工草稿、状态和待办均保留',()=>{assert.equal(sends.length,prior+1);assert.equal(state().replyDrafts.concurrent.text,'发送期间的人工草稿');assert.equal(state().replies.find(r=>r.id==='concurrent').stage,'不需回复');assert.ok(state().tasks.some(t=>t.title==='并发保留的待办'))})
 await seed('local');await host.mutateWorkbenchState(s=>{s.sources.find(r=>r.id==='local').provider='manual';return s})
 await assert.rejects(api.sendReply(request('local')),/有效/)
 const seedTask=async(id,withReply=true)=>{
  await host.mutateWorkbenchState(s=>{const src=source(id);src.locator.groupType=1;s.sources.push(src);s.tasks.push({id:'task-'+id,title:'提交代码 '+id,status:'ready',priority:'normal',sourceRefId:id,description:'保留业务内容',tags:[]});if(withReply)s.replies.push({id,sourceId:id,msgId:'msg-'+id,groupId:'conversation',accountId:'org:me',stage:'不需回复',triage:'task',taskIds:['task-'+id]});return s})
 }
 await seedTask('task-reply');const taskBefore=JSON.stringify(state().tasks.find(t=>t.id==='task-task-reply')),sendBefore=sends.length
 const prepared=await api.prepareTaskReply('task-task-reply');await api.prepareTaskReply('task-task-reply')
 check('待办回复准备复用原记录，不重开待回复、不发送、不修改任务',()=>{assert.equal(prepared.replyId,'task-reply');assert.equal(state().replies.filter(r=>r.sourceId==='task-reply').length,1);assert.equal(state().replies.find(r=>r.id==='task-reply').stage,'不需回复');assert.equal(sends.length,sendBefore);assert.equal(JSON.stringify(state().tasks.find(t=>t.id==='task-task-reply')),taskBefore)})
 await assert.rejects(api.sendReply(request('task-reply')),/已处理/)
 await assert.rejects(api.sendReply({...request('task-reply'),taskId:'unknown-task'}),/关联/)
 await assert.rejects(api.sendReply({...request('task-reply'),taskId:'task-task-reply',groupId:'wrong'}),/变化/)
 check('关闭的任务来源仅允许有效任务上下文发送，伪造任务或目标均拒绝',()=>assert.equal(sends.length,sendBefore))
 sendMode='ok';await api.sendReply({...request('task-reply'),taskId:'task-task-reply'})
 check('待办内私聊回复成功仅更新沟通记录，任务仍待处理且正文不带引用',()=>{assert.equal(JSON.stringify(state().tasks.find(t=>t.id==='task-task-reply')),taskBefore);assert.equal(state().replies.find(r=>r.id==='task-reply').stage,'已回复');assert.equal(state().replyDrafts['task-reply'].delivery.text,request('task-reply').text);assert.ok(!sends.at(-1).argv.includes('--reply-msg-id'))})
 await assert.rejects(api.sendReply({...request('task-reply'),taskId:'task-task-reply'}),/已处理|发送记录/)
 await seedTask('task-new',false);const both=await Promise.all([api.prepareTaskReply('task-task-new'),api.prepareTaskReply('task-task-new')]);
 check('无旧回复的待办并发准备只创建一个非活动沟通记录',()=>{assert.equal(both[0].replyId,both[1].replyId);const reply=state().replies.find(r=>r.id===both[0].replyId);assert.equal(reply.stage,'不需回复');assert.equal(reply.triage,'task');assert.deepEqual(reply.taskIds,['task-task-new'])})
 await seedTask('task-failure');sendMode='reject';await assert.rejects(api.sendReply({...request('task-failure'),taskId:'task-task-failure'}),/发送失败/)
 check('待办回复失败保留草稿和原任务状态，不添加活动待回复',()=>{assert.equal(state().tasks.find(t=>t.id==='task-task-failure').status,'ready');assert.equal(state().replies.find(r=>r.id==='task-failure').stage,'不需回复');assert.equal(state().replyDrafts['task-failure'].delivery.status,'failed')})
 sendMode='invalid';await assert.rejects(api.sendReply({...request('task-failure'),taskId:'task-task-failure'}),/未确认/);const uncertainBefore=sends.length;await assert.rejects(api.sendReply({...request('task-failure'),taskId:'task-task-failure'}),/发送记录/)
 check('待办回复不明确结果继续阻止重复发送',()=>assert.equal(sends.length,uncertainBefore));sendMode='ok'
 await seedTask('task-moved');await api.prepareTaskReply('task-task-moved');await host.mutateWorkbenchState(s=>{s.tasks.find(t=>t.id==='task-task-moved').sourceRefId='task-new';return s});await assert.rejects(api.sendReply({...request('task-moved'),taskId:'task-task-moved'}),/关联/)
 await seedTask('task-archived');await host.mutateWorkbenchState(s=>{s.tasks.find(t=>t.id==='task-task-archived').archivedAt=new Date().toISOString();return s});await assert.rejects(api.prepareTaskReply('task-task-archived'),/有效/)
 await seedTask('task-group');await host.mutateWorkbenchState(s=>{s.sources.find(x=>x.id==='task-group').locator.groupType=2;return s});await assert.rejects(api.prepareTaskReply('task-task-group'),/有效/)
 check('待办换来源、归档或群聊不允许冒用私聊回复通道',()=>assert.equal(sends.length,uncertainBefore))
 lookups=[];const names=await host.resolveSenderNames(ctx,Array.from({length:123},(_,i)=>'user-'+i))
 check('超过6人可全部解析，123人按50/50/23批量查询',()=>{assert.equal(names.size,123);assert.deepEqual(lookups.map(r=>r.length),[50,50,23])})
 await host.mutateWorkbenchState(s=>{s.sources=[...Array.from({length:8},(_,i)=>source('history-'+i,'history-user-'+i)),source('other-account','history-user-0','other:me')];s.replies=s.sources.map(row=>({id:'reply-'+row.id,sourceId:row.id,msgId:row.locator.msgId,groupId:row.locator.groupId,accountId:row.locator.accountId,contact:'conversation',stage:'待回复'}));return s})
 lookups=[];await api.fetchMentions()
 check('没有新增消息也回填旧来源和待回复姓名，且不串账号',()=>{assert.equal(state().lastMentionsFetch.added,0);assert.equal(lookups.flat().length,8);assert.equal(state().replies[7].contact,'姓名history-user-7');assert.equal(state().sources[0].title,'消息 · 姓名history-user-0');assert.equal(state().sources.at(-1).sender,'history-…');assert.equal(state().replies.at(-1).contact,'conversation')})
 lookups=[];await api.fetchMentions()
 check('同账号已解析姓名复用，不重复查通讯录',()=>assert.equal(lookups.length,0))
 await host.mutateWorkbenchState(s=>{s.sources.push(source('failed-name'));return s});contactMode='fail';await api.fetchMentions()
 check('通讯录失败保持来源和游标同步可用，并回退未知发件人',()=>assert.equal(host.messageSender(state().sources.at(-1)),'未知发件人'))
 contactMode='ok';await api.fetchMentions()
 check('后续同步可重试失败的姓名补全',()=>assert.equal(state().sources.at(-1).sender,'姓名sender-failed-name'))
 await host.mutateWorkbenchState(s=>{s.sources.push(source('manual-name'));return s});holdContact={}
 const sync=api.fetchMentions();await until(()=>!!holdContact.release)
 await host.mutateWorkbenchState(s=>{s.sources.find(row=>row.id==='manual-name').sender='人工姓名';s.sources.find(row=>row.id==='manual-name').title='人工标题';return s})
 holdContact.release({exitCode:0});await sync;holdContact=null
 check('补全期间的人工姓名和标题不会被旧快照覆盖',()=>{assert.equal(state().sources.at(-1).sender,'人工姓名');assert.equal(state().sources.at(-1).title,'人工标题')})
 check('界面姓名和会话展示不会把会话ID当发件人',()=>{assert.equal(host.messageSender({locator:{groupId:'conversation'}},'conversation'),'未知发件人');assert.equal(host.messageConversation('conversation','conversation'),'原会话')})
 invalidContacts=new Set(['invalid-user']);lookups=[];const invalidReport={};
 const recoveredNames=await host.resolveSenderNames(ctx,['valid-before','invalid-user',...Array.from({length:48},(_,i)=>'valid-after-'+i)],invalidReport)
 check('真实Invalid openIds信封导致的整批失败可隔离，49位有效发送人仍解析成功',()=>{assert.equal(recoveredNames.size,49);assert.equal(recoveredNames.get('valid-after-47'),'姓名valid-after-47');assert.deepEqual(invalidReport.invalidIds,['invalid-user']);assert.equal(invalidReport.status,'partial');assert.ok(lookups.length<=16)})
 await host.mutateWorkbenchState(s=>{s.sources=[source('valid-name','valid-user'),source('invalid-name','invalid-user')];s.replies=[];s.syncCursors={};return s});lookups=[];await api.fetchMentions();const invalidCalls=lookups.length;await api.fetchMentions()
 check('失效ID临时跳过并可持久恢复，重复同步不再阻塞其余姓名',()=>{assert.equal(lookups.length,invalidCalls);assert.equal(state().sources[0].sender,'姓名valid-user');assert.ok(host.normalizeState(state()).state.syncCursors['__senderNames:org:me'].unavailableSenders.some(row=>row.id==='invalid-user'))})
 invalidContacts=new Set();await host.mutateWorkbenchState(s=>{s.syncCursors['__senderNames:org:me'].unavailableSenders[0].retryAt=new Date(Date.now()-1).toISOString();return s});await api.fetchMentions()
 check('失效记录到期后重新查询，恢复有效的账号可以补全姓名',()=>assert.equal(state().sources[1].sender,'姓名invalid-user'))
 invalidContacts=new Set();contactMode='fail';lookups=[];const denied={};await host.resolveSenderNames(ctx,['permission-a','permission-b'],denied)
 check('权限错误不拆分放大请求，错误原因如实保留',()=>{assert.equal(lookups.length,1);assert.equal(denied.status,'unauthorized');assert.match(denied.note,/43001/)})
 contactMode='ok';imRateLimited=true;lookups=[]
 await host.mutateWorkbenchState(s=>{s.sources=[...Array.from({length:160},(_,i)=>source('many-'+i))];s.replies=[{id:'priority-reply',sourceId:'many-0',msgId:'msg-many-0',groupId:'conversation',accountId:'org:me',stage:'待回复',contact:'sender-m…'}];s.syncCursors={};return s})
 await api.fetchMentions()
 check('IM采集限流前先补全当前待回复，旧来源再多也优先处理可见联系人',()=>{assert.equal(lookups.flat().length,100);assert.ok(lookups[0].includes('sender-many-0'));assert.equal(state().replies[0].contact,'姓名sender-many-0');assert.equal(state().lastMentionsFetch.status,'partial')})
 await host.mutateWorkbenchState(s=>{s.sources.push(source('during-im-cooldown'));return s});lookups=[];await api.fetchMentions()
 check('IM处于冷却也可独立补全姓名，不继续读取受限消息',()=>{assert.ok(lookups.flat().includes('sender-during-im-cooldown'));assert.equal(state().sources.at(-1).sender,'姓名sender-during-im-cooldown')})
 contactMode='rate';await host.mutateWorkbenchState(s=>{s.sources.push(source('name-rate'));return s});lookups=[];await api.fetchMentions();const lookupCount=lookups.length;await api.fetchMentions()
 check('姓名接口自身限流立即停止且单独持久化冷却，重复同步不继续请求',()=>{assert.equal(lookupCount,1);assert.equal(lookups.length,1);assert.ok(state().syncCursors['__senderNames:org:me'].retryAt);assert.ok(host.normalizeState(state()).state.syncCursors['__senderNames:org:me'].retryAt)})
 console.log('reply-send: '+checks+' scenarios passed')
} finally {cleanups.forEach(fn=>fn());rmSync(home,{recursive:true,force:true})}
