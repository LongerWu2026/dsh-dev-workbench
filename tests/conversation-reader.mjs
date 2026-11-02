/** Actual reader with synthetic CLI responses. No real account or state writes. */
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,join} from 'node:path'
const dir=mkdtempSync(join(tmpdir(),'workbench-conversation-reader-'))
try{
 await build({entryPoints:[resolve('src/host/integrations/conversation-reader.ts')],outfile:join(dir,'reader.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const {createConversationReader}=await import(join(dir,'reader.mjs'));let count=0
 await build({stdin:{contents:`export * from '${resolve('src/shared/conversation-read.ts')}';export {normalizeState} from '${resolve('src/host/domain/model.ts')}';`,resolveDir:process.cwd(),loader:'ts'},outfile:join(dir,'read-state.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const {conversationReadKey,mergeConversationReadMark,isConversationRead,normalizeConversationReadMarks,normalizeState}=await import(join(dir,'read-state.mjs'))
 const check=(name,fn)=>{fn();count++;console.log('✓ '+name)}
 function fixture({unread=3,total=30,overlap=false,extra=0}={}){
  const messages=Array.from({length:total+extra},(_,i)=>({msgId:'msg-'+i,content:'消息 '+i,fromOpenId:i%5?'other':'me',sendTime:new Date(1760000000000+i*1000).toISOString()})),state={messageInbox:{accountId:'org:me',at:'2026-11-02T02:00:00Z',conversations:[{groupId:'group',name:'合成会话',latestMsgId:'msg-'+(total-1),unreadCount:unread}]},sources:[],replies:[],tasks:[],analysisQueue:[],syncCursors:{}},calls=[],ctx={},probe={state:'ok',accountId:'org:me',openId:'me'}
  let beforeRead=null,failed=0,markFailed=false,markWrites=0
  const read=createConversationReader({state:()=>state,probe:async()=>probe,markRead:async mark=>{if(markFailed)throw Error('合成保存失败');markWrites++;state.conversationReadMarks=mergeConversationReadMark(state.conversationReadMarks,mark);return {readMark:state.conversationReadMarks[conversationReadKey(mark.accountId,mark.groupId)],snapshot:structuredClone(state)}},run:async(_ctx,args)=>{calls.push(args);if(beforeRead)await beforeRead(args);if(failed-->0)return {status:'rate_limited',note:'合成限流'};if(args[0]==='contact')return {status:'ok',json:{data:{list:[{openId:'other',name:'合成同事'}]}}};const anchor=args.includes('--msg-id')?args[args.indexOf('--msg-id')+1]:null,stop=anchor?messages.findIndex(row=>row.msgId===anchor)+(overlap?1:0):messages.length;return {status:'ok',json:{data:{list:messages.slice(Math.max(0,stop-20),stop)}}}}})
  const request={accountId:'org:me',groupId:'group'},next=(r,mode='unread')=>read(ctx,{...request,viewId:r.viewId,cursor:r.nextCursor,mode})
  return {read,ctx,state,calls,request,next,messages,probe,ack:r=>read.markRead(ctx,{...request,viewId:r.viewId}),markWrites:()=>markWrites,failMark:value=>{markFailed=value},setBeforeRead:fn=>{beforeRead=fn},fail:n=>{failed=n}}
 }
 let f=fixture(),before=JSON.stringify(f.state),r=await f.read(f.ctx,f.request)
 check('首次只返回3条未读，不把接口同页历史提前展示',()=>{assert.equal(r.unreadComplete,true);assert.equal(r.messages.length,3);assert.deepEqual(r.messages.map(m=>m.id),['msg-27','msg-28','msg-29']);assert.ok(r.messages.every(m=>m.unread));assert.equal(r.contextLoaded,0);assert.equal(r.hasMoreHistory,true)})
 const firstHistory=await f.next(r,'history'),secondHistory=await f.next(firstHistory,'history'),lastHistory=await f.next(secondHistory,'history')
 check('每次历史请求只返回更早10条，最后不足10条按实际7条返回',()=>{assert.deepEqual(firstHistory.messages.map(m=>m.id),Array.from({length:10},(_,i)=>'msg-'+(i+17)));assert.deepEqual(secondHistory.messages.map(m=>m.id),Array.from({length:10},(_,i)=>'msg-'+(i+7)));assert.equal(lastHistory.messages.length,7);assert.equal(lastHistory.hasMoreHistory,false);assert.equal(lastHistory.contextLoaded,27);assert.ok(firstHistory.messages.every(m=>!m.unread))})
 check('查阅不改变快照、来源、队列、回复或待办，不使用发送/标读命令',()=>{assert.equal(JSON.stringify(f.state),before);assert.ok(f.calls.every(a=>a.join(' ').startsWith('im message list ')||a.join(' ').startsWith('contact user get ')))})
 f=fixture({unread:69,total:120});r=await f.read(f.ctx,f.request);const second=await f.next(r),all=[...second.messages,...r.messages]
 check('69条未读跨批次读完仍不返回历史，未读边界准确',()=>{assert.equal(r.unreadLoaded,60);assert.equal(r.unreadComplete,false);assert.equal(second.unreadComplete,true);assert.equal(all.length,69);assert.equal(new Set(all.map(m=>m.id)).size,69);assert.ok(all.every(m=>m.unread));assert.equal(all[0].id,'msg-51');assert.equal(second.contextLoaded,0)})
 const callsBefore=f.calls.length,replayed=await f.read(f.ctx,{...f.request,viewId:r.viewId,cursor:1})
 check('相同分页请求重试不重复读取或推进',()=>{assert.deepEqual(replayed,second);assert.equal(f.calls.length,callsBefore)})
 const bufferedCalls=f.calls.filter(a=>a[0]==='im').length,buffered=await f.next(second,'history')
 check('接口多返回的历史缓存到上滚时展示，不漏掉未读边缘消息',()=>{assert.equal(buffered.messages.length,10);assert.equal(buffered.messages[0].id,'msg-41');assert.equal(buffered.messages.at(-1).id,'msg-50');assert.equal(f.calls.filter(a=>a[0]==='im').length,bufferedCalls)})
 f=fixture({unread:69,total:120,overlap:true});r=await f.read(f.ctx,f.request);const overlaps=await f.next(r),overlapHistory=await f.next(overlaps,'history')
 check('接口重复锚点时未读和连续历史均去重，不偏移10条边界',()=>{const rows=[...overlapHistory.messages,...overlaps.messages,...r.messages];assert.equal(rows.length,79);assert.equal(new Set(rows.map(m=>m.id)).size,79);assert.equal(rows.filter(m=>m.unread).length,69)})
 f=fixture({unread:5,total:120,extra:50});r=await f.read(f.ctx,f.request);const moved=await f.next(r,'history')
 check('快照后新消息不挤入旧未读或历史窗口',()=>{const rows=[...moved.messages,...r.messages];assert.equal(r.messages.length,5);assert.equal(rows.length,15);assert.equal(rows.at(-1).id,'msg-119');assert.equal(rows[0].id,'msg-105')})
 f=fixture({unread:2,total:6});r=await f.read(f.ctx,f.request);const short=await f.next(r,'history')
 check('首次仅未读2条，滚动后不足10条只返回实际4条历史',()=>{assert.equal(r.messages.length,2);assert.equal(short.messages.length,4);assert.equal(short.contextLoaded,4);assert.equal(short.hasMoreHistory,false)})
 f=fixture({unread:10,total:6});r=await f.read(f.ctx,f.request)
 check('撤回或不可见导致数量不足时明确说明',()=>{assert.equal(r.unreadLoaded,6);assert.equal(r.contextLoaded,0);assert.match(r.note,/少于未读快照/);assert.equal(r.hasMoreHistory,false)})
 f=fixture();f.state.messageInbox.conversations[0].latestMsgId='gone';r=await f.read(f.ctx,f.request)
 check('无法找到快照锚点时不把最近消息误报为原未读',()=>{assert.equal(r.messages.length,0);assert.match(r.note,/未找到/)})
 f=fixture();await assert.rejects(f.read(f.ctx,{accountId:'wrong',groupId:'group'}),/账号/);await assert.rejects(f.read(f.ctx,{...f.request,groupId:'not-known'}),/未读位置/)
 check('跨账号或未知会话在调用消息接口前拒绝',()=>assert.equal(f.calls.length,0))
 f=fixture({unread:69,total:120});r=await f.read(f.ctx,f.request);await assert.rejects(f.read(f.ctx,{...f.request,viewId:r.viewId,cursor:99}),/分页/);await assert.rejects(f.read({}, {...f.request,viewId:r.viewId,cursor:r.nextCursor}),/过期/);await assert.rejects(f.next(r,'history'),/未读消息仍在读取/)
 check('不允许伪造游标、跨Host窗口或跳过未完成的未读读取',()=>{})
 f=fixture();f.probe.accountId='other';f.probe.openId='other';await assert.rejects(f.read(f.ctx,f.request),/账号与消息/);check('切换登录账号时不返回旧账号消息',()=>assert.equal(f.calls.length,0))
 f=fixture();f.setBeforeRead(async()=>{f.state.messageInbox.accountId='switched'});await assert.rejects(f.read(f.ctx,f.request),/账号已变化/);check('网络等待期间换账号也丢弃原内容',()=>{})
 f=fixture({unread:69,total:120});let n=0;f.setBeforeRead(async args=>{if(args[0]==='im'&&++n===2)f.fail(1)});r=await f.read(f.ctx,f.request);const retry=await f.next(r),retried=[...retry.messages,...r.messages]
 check('未读中途限流保留已读取内容，重试不重读不漏读',()=>{assert.equal(r.status,'partial');assert.equal(r.messages.length,20);assert.equal(retry.unreadComplete,true);assert.equal(retried.length,69);assert.equal(new Set(retried.map(m=>m.id)).size,69)})
 f=fixture();r=await f.read(f.ctx,f.request);const h1=await f.next(r,'history');f.fail(1);const h2=await f.next(h1,'history'),h2Retry=await f.next(h2,'history')
 check('历史批次中途失败后只补余下3条，本次累计仍是10条',()=>{assert.equal(h2.status,'partial');assert.equal(h2.messages.length,7);assert.equal(h2.batchComplete,false);assert.equal(h2Retry.messages.length,3);assert.equal(h2Retry.batchComplete,true);assert.equal(h2Retry.contextLoaded,20)})
 f=fixture();r=await f.read(f.ctx,f.request);const beforeConcurrent=f.calls.filter(a=>a[0]==='im').length,both=await Promise.all([f.next(r,'history'),f.next(r,'history')])
 check('并发同一历史游标只发一批10条，不额外推进到第二批',()=>{assert.deepEqual(both[0],both[1]);assert.equal(both[0].messages.length,10);assert.equal(both[0].contextLoaded,10);assert.equal(f.calls.filter(a=>a[0]==='im').length,beforeConcurrent)})
 await assert.rejects(f.read(f.ctx,{...f.request,viewId:r.viewId,cursor:1,mode:'unread'}),/分页操作已变化/);check('同一游标不能更换读取阶段以绕过幂等约束',()=>{})

 f=fixture();f.state.replies=[{id:'reply',msgId:'original',stage:'待回复',humanGuard:false}];f.state.tasks=[{id:'task',status:'ready'}];const businessBefore=JSON.stringify([f.state.replies,f.state.tasks,f.state.messageInbox,f.state.syncCursors]);r=await f.read(f.ctx,f.request);const ack=await f.ack(r);await f.ack(r)
 check('成功展示后仅保存工作台已读，回复/待办/云端未读/采集游标不变，重复确认幂等',()=>{assert.equal(f.markWrites(),1);assert.equal(ack.providerReadSynced,false);assert.equal(isConversationRead(f.state,f.state.messageInbox.conversations[0]),true);assert.equal(JSON.stringify([f.state.replies,f.state.tasks,f.state.messageInbox,f.state.syncCursors]),businessBefore)})
 const persisted=normalizeState(JSON.parse(JSON.stringify(f.state))).state
 check('重启标准化仍保留工作台已读，不改变待回复',()=>{assert.equal(isConversationRead(persisted,persisted.messageInbox.conversations[0]),true);assert.equal(persisted.replies[0].stage,'待回复')})
 const oldHead=f.state.messageInbox.conversations[0].latestMsgId;f.messages.push({msgId:'new-arrival',content:'新消息',fromOpenId:'other',sendTime:'2026-11-02T03:00:00Z'});Object.assign(f.state.messageInbox.conversations[0],{latestMsgId:'new-arrival',unreadCount:4,latestSentAt:'2026-11-02T03:00:00Z'});r=await f.read(f.ctx,f.request);const oldHistory=await f.next(r,'history')
 check('同一会话新消息重新出现，只显示上次查阅位置后的未读，上滚仍能查到旧消息',()=>{assert.equal(isConversationRead(f.state,f.state.messageInbox.conversations[0]),false);assert.equal(r.unreadTotal,1);assert.deepEqual(r.messages.map(row=>row.id),['new-arrival']);assert.equal(oldHistory.messages.at(-1).id,oldHead);assert.ok(oldHistory.messages.every(row=>!row.unread))})
 await f.ack(r);check('查阅新消息后推进已读位置',()=>assert.equal(isConversationRead(f.state,f.state.messageInbox.conversations[0]),true))
 f=fixture({unread:69,total:120});r=await f.read(f.ctx,f.request);await assert.rejects(f.ack(r),/未完整展示/);check('未读未读完不能提前清除',()=>assert.equal(f.markWrites(),0))
 f=fixture({unread:10,total:6});r=await f.read(f.ctx,f.request);await assert.rejects(f.ack(r),/未完整展示/);check('可见消息少于未读快照不能误标已读',()=>assert.equal(f.markWrites(),0))
 f=fixture();f.state.messageInbox.conversations[0].latestMsgId='gone';r=await f.read(f.ctx,f.request);await assert.rejects(f.ack(r),/未完整展示/);check('缺失快照锚点不能误标已读',()=>assert.equal(f.markWrites(),0))
 f=fixture();r=await f.read(f.ctx,f.request);f.failMark(true);await assert.rejects(f.ack(r),/保存失败/);assert.equal(f.state.conversationReadMarks,undefined);f.failMark(false);await f.ack(r);check('保存失败不改变列表，重试可继续且不重读正文',()=>assert.equal(f.markWrites(),1))
 f=fixture();r=await f.read(f.ctx,f.request);await assert.rejects(f.read.markRead({}, {...f.request,viewId:r.viewId}),/过期/);f.state.messageInbox.accountId='another';await assert.rejects(f.ack(r),/账号已变化/);check('其他窗口或切换账号不能标记旧会话已读',()=>assert.equal(f.markWrites(),0))
 f=fixture();r=await f.read(f.ctx,f.request);f.state.messageInbox.conversations[0].latestMsgId='arrived-during-reading';await f.ack(r);check('查看期间到达的新消息不被旧窗口确认一起清掉',()=>{assert.equal(isConversationRead(f.state,f.state.messageInbox.conversations[0]),false);assert.equal(Object.values(f.state.conversationReadMarks)[0].headMsgId,'msg-29')})
 const mark={accountId:'org:me',groupId:'group',headMsgId:'old',headSentAt:'2026-11-02T02:00:00Z',openedAt:'2026-11-02T02:01:00Z',readAt:'2026-11-02T02:01:10Z'},newer={...mark,headMsgId:'new',headSentAt:'2026-11-02T02:02:00Z',openedAt:'2026-11-02T02:03:00Z'},latest=mergeConversationReadMark(mergeConversationReadMark({},newer),{...mark,readAt:'2026-11-02T02:04:00Z'})
 check('旧窗口迟到确认不能回退新窗口的已读位置，账号隔离且同秒不同消息仍可见',()=>{const key=conversationReadKey(mark.accountId,mark.groupId);assert.equal(latest[key].headMsgId,'new');assert.equal(isConversationRead({messageInbox:{accountId:'another'},conversationReadMarks:latest},{groupId:'group',latestMsgId:'new'}),false);assert.equal(isConversationRead({messageInbox:{accountId:'org:me'},conversationReadMarks:latest},{groupId:'group',latestMsgId:'same-second-other',latestSentAt:newer.headSentAt}),false)})
 check('非法持久化标记被丢弃，键名由账号和会话重建',()=>{const normalized=normalizeConversationReadMarks({wrong:mark,bad:{...mark,readAt:'invalid'}});assert.deepEqual(Object.keys(normalized),[conversationReadKey(mark.accountId,mark.groupId)])})
 console.log('conversation-reader: '+count+' scenarios passed')
}finally{rmSync(dir,{recursive:true,force:true})}
