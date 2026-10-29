/** Real sync/merge and analysis paths; enterprise messages are synthetic. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-reply-status-'));process.env.DSH_HOME=home
await build({stdin:{contents:`export {syncYunzhijiaMessages} from './src/host/integrations/yunzhijia.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';export {normalizeState} from './src/host/domain/model.ts';export {upsertReply} from './src/host/analysis/message-analysis.ts';export {reconcileYunzhijiaReplies} from './src/host/integrations/reply-reconciliation.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const h=await import(join(home,'host.mjs'))
const originalAt=new Date(Date.now()-120000).toISOString(),sentAt=new Date(Date.now()-60000).toISOString()
let groups=[],history={},calls=[],mode='ok',hold=null,checks=0
const msg=(msgId,fromOpenId='other',extra={})=>({msgId,fromOpenId,content:'合成消息',sendTime:fromOpenId==='me'?sentAt:originalAt,...extra})
const own=(id='own',replyMsgId)=>msg(id,'me',replyMsgId?{param:{replyMsgId}}:{})
const subprocess={resolveExecutable:async()=>'/fixture/yzj-cli',spawn(spec){
 const args=spec.argv.slice(1);calls.push(args);let data={},error=null,done
 if(args[0]==='whoami')data={orgId:'org',openId:'me',name:'本人'}
 else if(args[0]==='contact')data={list:args.filter((_,i)=>args[i-1]==='--open-id').map(openId=>({openId,name:'同事'}))}
 else if(args.includes('recent'))data={list:groups,more:false}
 else if(args.includes('list') && args.includes('--group-id')){
  const groupId=args[args.indexOf('--group-id')+1],type=args[args.indexOf('--type')+1],anchor=args[args.indexOf('--msg-id')+1];let messages=history[groupId] || []
  if(type==='new')messages=messages.slice(messages.findIndex(row=>row.msgId===anchor)+1).slice(0,20)
  else if(type==='old')messages=[]
  else messages=messages.slice(-20)
  data={list:messages.map(message=>({message}))}
  if(mode==='error')error={code:43001,message:'synthetic permission error'}
  if(mode==='rate')error={code:10000429,message:'too many requests'}
  if(hold && !hold.release)done=new Promise(resolve=>hold.release=resolve)
 }else if(args.includes('search'))data={list:[]}
 const text=JSON.stringify(error?{success:false,error}:{success:true,data})
 return{done:done || Promise.resolve({exitCode:error?1:0}),collected:{stdout:{readFrom:()=>({text})},stderr:{readFrom:()=>({text:''})}}}
}}
const ctx={get:key=>key==='subprocess'?subprocess:null}
const state=()=>h.loadWorkbenchState(),check=(label,fn)=>{fn();checks++;console.log('✓',label)}
const source=(id='original',groupId='chat',groupType=1,accountId='org:me')=>({id,provider:'yunzhijia',selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:null,observedAt:new Date().toISOString()},externalId:'fixture-'+id,title:'消息 · 同事',sender:'同事',excerpt:'请回复进度',fetchedAt:originalAt,locator:{msgId:id,groupId,groupName:'合成会话',groupType,accountId,senderId:'other',sentAt:originalAt,direction:'inbound',intake:true}})
const reply=(source,stage='待回复')=>({id:'reply-'+source.id,sourceId:source.id,msgId:source.locator.msgId,groupId:source.locator.groupId,accountId:source.locator.accountId,contact:'同事',stage,humanGuard:true,createdAt:originalAt,updatedAt:originalAt})
async function seed(sources=[source()],stages=[]){
 mode='ok';hold=null;groups=[];history={};calls=[]
 await h.mutateWorkbenchState(s=>{s.sources=sources;s.replies=sources.map((row,i)=>reply(row,stages[i]));s.tasks=[{id:'task',title:'独立任务',status:'ready',tags:[]}];s.syncCursors={};s.analysisQueue=[];s.replyDrafts={'reply-original':{text:'保留人工草稿'}};s.settings.aiExtract={enabled:false};return s})
}
function observe(groupType,messages,unreadCount=1,groupId='chat'){
 history[groupId]=messages
 groups.push({groupId,groupType,groupName:'合成会话',lastMsg:messages.at(-1),lastMsgId:messages.at(-1)?.msgId,...(unreadCount===null?{}:{unreadCount})})
}
const sync=()=>h.syncYunzhijiaMessages(ctx)
async function waitHeld(){for(let i=0;i<100&&!hold?.release;i++)await new Promise(resolve=>setTimeout(resolve,1));assert.ok(hold?.release)}
try{
 await seed();observe(1,[msg('original'),own()],0);await h.mutateWorkbenchState(s=>{s.syncCursors['org:me:chat']={accountId:'org:me',lastMsgId:'own',intakePolicy:'focused-v1'};return s});await sync()
 check('没有新增消息且AI关闭，私聊最新消息本人发送仍立即标为已回复',()=>{const s=state(),r=s.replies[0];assert.equal(s.lastMentionsFetch.added,0);assert.equal(r.stage,'已回复');assert.equal(r.repliedAt,sentAt);assert.equal(r.evidenceMsgId,'own');assert.equal(r.humanGuard,true);assert.equal(s.tasks[0].status,'ready');assert.equal(s.replyDrafts[r.id].text,'保留人工草稿')})
 const updated=state().replies[0].updatedAt;await sync();check('重复刷新保持已回复时间及证据，不反复改写',()=>assert.equal(state().replies[0].updatedAt,updated))
 await seed();observe(1,[msg('original')],2);await sync();check('未读私聊且最后发送人是对方，继续待回复',()=>assert.equal(state().replies[0].stage,'待回复'))
 await seed();observe(1,[msg('original')],0);await sync();check('私聊未读数为0仍保留待回复，不伪造回复时间',()=>{assert.equal(state().replies[0].stage,'待回复');assert.ok(!state().replies[0].repliedAt);assert.equal(state().lastMentionsFetch.note.includes('已读只更新标记，不关闭待回复'),true)})
 check('已读但未答复的私聊仍可由AI确认回复义务，任务保持独立',()=>{const s=state();s.replies=[];const r=h.upsertReply(s,{sourceId:'original',msgId:'original',groupId:'chat',accountId:'org:me'},s.sources.find(row=>row.id==='original'),'待回复');assert.ok(r.reply);assert.equal(s.replies.length,1);assert.equal(s.tasks[0].status,'ready')})
 await seed();observe(1,[msg('original')],null);await sync();check('未读数字段缺失不当成0，不擅自移除待回复',()=>assert.equal(state().replies[0].stage,'待回复'))
 await seed();observe(1,[msg('original')],0);await h.mutateWorkbenchState(s=>{s.syncCursors['org:me:chat']={accountId:'org:me',lastMsgId:'original',intakePolicy:'focused-v1',groupType:1,unreadCount:3};return s});await sync();
 check('消息ID没变但未读变0只更新标记，保留回复义务且无需读取正文',()=>{assert.equal(state().replies[0].stage,'待回复');assert.equal(state().syncCursors['org:me:chat'].unreadCount,0);assert.equal(calls.filter(a=>a.includes('--group-id')).length,0)})
 await seed();const limited=JSON.parse(JSON.stringify(state()));limited.syncCursors['__pending:org:me']={retryAt:new Date(Date.now()+60000).toISOString()};
 const limitedReport=await h.reconcileYunzhijiaReplies(ctx,limited,{accountId:'org:me',openId:'me'},()=>{throw new Error('冷却时不应发起请求')},[{groupId:'chat',groupType:1,unreadCount:0,messages:[own()],latest:own()}]);
 check('后续分页限流仍可提交本轮已读到的本人答复事实，不发起额外请求',()=>{assert.equal(limited.replies[0].stage,'已回复');assert.equal(limitedReport.replied,1);assert.equal(limitedReport.rateLimited,true)})
 await seed([source('original','chat',2)]);observe(2,[msg('original'),own()],0);await sync();check('群聊已读或本人最后发出无关消息都不能标为已回复',()=>assert.equal(state().replies[0].stage,'待回复'))
 await seed([source('original','chat',2),source('second','chat',2)]);observe(2,[msg('original'),msg('second'),own('quoted','original')],0);await sync();check('群聊只关闭本人明确引用的原消息，不关闭同群其他待回复',()=>{assert.equal(state().replies[0].stage,'已回复');assert.equal(state().replies[0].evidenceMsgId,'quoted');assert.equal(state().replies[1].stage,'待回复')})
 await seed([source('original','chat',2)]);observe(2,[msg('original'),msg('others-reply','other',{param:{replyMsgId:'original'}})]);await sync();check('其他人的引用回复不能代替本人答复',()=>assert.equal(state().replies[0].stage,'待回复'))
 await seed([source('original','chat',2)]);observe(2,[msg('original')]);observe(2,[own('wrong-group','original')],1,'another');await sync();check('相同消息ID不能跨群匹配',()=>assert.equal(state().replies[0].stage,'待回复'))
 await seed([source('original','chat',1,'another:me')]);observe(1,[msg('original'),own()],0);await sync();check('另一个组织账号的记录不会被当前账号关闭',()=>assert.equal(state().replies[0].stage,'待回复'))
 await seed([source('original','chat',2)]);observe(2,[msg('original'),own('bad-time','original')]);history.chat.at(-1).sendTime='invalid';await sync();check('无效发送时间不能伪造已回复证据',()=>assert.equal(state().replies[0].stage,'待回复'))
 await seed();observe(1,[msg('original'),own('too-early')]);history.chat.at(-1).sendTime=new Date(Date.parse(originalAt)-1000).toISOString();await sync();check('早于原消息的本人消息不能关闭较新的待回复',()=>assert.equal(state().replies[0].stage,'待回复'))
 const old=source('old','chat',2);old.locator.sentAt='2000-01-01T00:00:00Z';old.fetchedAt=old.locator.sentAt
 await seed([old]);observe(2,[own('answer-old','old')]);await sync();check('安装日期前的既有待回复也能核对实际答复，不重采历史消息',()=>{assert.equal(state().replies[0].stage,'已回复');assert.equal(state().sources.filter(s=>s.locator?.msgId==='old').length,1)})
 await seed([source('original','quiet',2)]);history.quiet=[msg('original'),...Array.from({length:100},(_,i)=>i===55?own('historic-quote','original'):msg('after-'+i))];await sync();const cursorKey=Object.keys(state().syncCursors).find(key=>key.startsWith('__replyStatus:'))
 check('不在最近会话的旧群按原消息向后检查，单轮有界并保存进度',()=>{assert.equal(state().replies[0].stage,'待回复');assert.equal(state().syncCursors[cursorKey].lastMsgId,'after-39');assert.equal(calls.filter(a=>a.includes('--group-id')).length,3)})
 await sync();check('下轮接续进度查到旧引用答复，退出待回复',()=>{assert.equal(state().replies[0].stage,'已回复');assert.equal(state().replies[0].evidenceMsgId,'historic-quote');assert.equal(state().syncCursors[cursorKey],undefined)})
 await seed();history.chat=[msg('original')];mode='error';await sync();check('读取失败保留待回复，不推断已读或已回复',()=>{assert.equal(state().replies[0].stage,'待回复');assert.equal(state().lastMentionsFetch.status,'partial')})
 await seed([source('original','quiet',2),source('second','another',2)]);mode='rate';await sync();const queryCount=calls.filter(a=>a.includes('--group-id')).length;await sync();check('限流立即停止且冷却后续查，保留待回复和补采状态',()=>{assert.equal(queryCount,1);assert.equal(calls.filter(a=>a.includes('--group-id')).length,queryCount);assert.ok(state().syncCursors['__pending:org:me'].retryAt);assert.ok(state().replies.every(r=>r.stage==='待回复'))})
 await seed(Array.from({length:14},(_,i)=>source('p-'+i,'quiet-'+i,1)));await sync();let reads=calls.filter(a=>a.includes('--group-id')).length;check('每轮最多额外检查12次，避免无界历史读取',()=>assert.equal(reads,12));await sync();check('下一轮优先继续上轮未检查的会话',()=>{const checked=calls.filter(a=>a.includes('--group-id')).slice(reads).slice(0,2).map(a=>a[a.indexOf('--group-id')+1]);assert.deepEqual(checked,['quiet-12','quiet-13'])})
 await seed();observe(1,[msg('original'),own()],0);hold={};let pending=sync();await waitHeld();await h.mutateWorkbenchState(s=>{s.replies[0].stage='不需回复';s.replies[0].updatedAt=new Date().toISOString();s.replyDrafts['reply-original'].text='网络等待期间的草稿';s.tasks[0].status='completed';return s});hold.release({exitCode:0});await pending;hold=null
 check('同步期间人工阶段、草稿和任务修改均保留',()=>{assert.equal(state().replies[0].stage,'不需回复');assert.equal(state().replyDrafts['reply-original'].text,'网络等待期间的草稿');assert.equal(state().tasks[0].status,'completed')})
 await seed();observe(1,[msg('original'),own()],0);hold={};pending=sync();await waitHeld();await h.mutateWorkbenchState(s=>{s.sources[0].locator.groupId='manually-changed';return s});hold.release({exitCode:0});await pending;hold=null
 check('网络等待期间原消息定位已变，不提交旧会话的回复结果',()=>assert.equal(state().replies[0].stage,'待回复'))
 await seed();observe(1,[msg('original'),own()],0);await h.mutateWorkbenchState(s=>{s.replyDrafts['reply-original'].delivery={status:'sending'};return s});await sync();check('正在发送的本地回复不被同步结果打断',()=>assert.equal(state().replies[0].stage,'待回复'))
 await seed([source('original','chat',2)],['不需回复']);observe(2,[own('later-quote','original')]);await sync();check('已经手工处理或归档的记录不会被同步改成另一阶段',()=>assert.equal(state().replies[0].stage,'不需回复'))
 await seed();observe(1,[msg('original')],0);await sync();const normalized=h.normalizeState(state()).state;check('重启标准化保留会话类型和未读数，避免已读消息重新建档',()=>{assert.equal(normalized.syncCursors['org:me:chat'].groupType,1);assert.equal(normalized.syncCursors['org:me:chat'].unreadCount,0)})
 check('所有调用始终为只读，没有向真实或合成会话发送消息',()=>assert.ok(calls.every(a=>!a.includes('send'))))
 console.log('reply-reconciliation: '+checks+' scenarios passed')
}finally{rmSync(home,{recursive:true,force:true})}
