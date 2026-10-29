/** Real metadata repair/merge paths with an isolated CLI and profile. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-metadata-'));process.env.DSH_HOME=home
await build({stdin:{contents:`export {repairYunzhijiaMetadata} from './src/host/integrations/yunzhijia.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';export {workbenchApi as api} from './src/host/application/workbench-service.ts';export {setShared_workbenchCtx} from './src/host/application/service-context.ts';export {messageSender} from './src/shared/message-display.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const h=await import(join(home,'host.mjs'));let mode='ok',searches=[],contacts=[],hold=null,checks=0
const fixtureMessage=(group)=>({msgId:'msg-'+group,fromOpenId:'24fa28ac-complete',content:'sit 请核实历史消息',sendTime:'2026-08-24 09:32:03.625'})
const subprocess={resolveExecutable:async()=>'/fixture/yzj-cli',spawn(spec){
 const args=spec.argv.slice(1);let data={},exitCode=0,json,done
 if(args[0]==='whoami')data={openId:'me',orgId:'org',name:'本人'}
 else if(args.includes('recent'))data={list:[],more:false}
 else if(args.includes('list') && args.includes('--msg-id') && mode==='keyword-miss'){
  const group=args[args.indexOf('--group-id')+1],anchor=args[args.indexOf('--msg-id')+1];
  data={list:[{message:anchor==='msg-'+group?{...fixtureMessage(group),msgId:'next-'+group}:fixtureMessage(group)}]}
 }
 else if(args[0]==='contact'){const ids=args.filter((_,i)=>args[i-1]==='--open-id');contacts.push(ids);data={list:ids.map(openId=>({openId,name:'补全同事'}))}}
 else if(args.includes('search')){
  searches.push(args);const group=args[args.indexOf('--group-id')+1],message=fixtureMessage(group)
  if(mode==='wrong' || mode==='keyword-miss')message.msgId='foreign-message'
  data={list:[{group:{groupId:group,groupName:'历史讨论群'},messages:[{message},...(mode==='duplicate'?[{message}]:[])]}]}
  if(mode==='rate'){json={success:false,error:{code:10000429,message:'too many requests'}};exitCode=1}
  if(hold)done=new Promise(r=>hold.release=r)
 }
 const text=JSON.stringify(json || {success:true,data})
 return{done:done || Promise.resolve({exitCode}),collected:{stdout:{readFrom:()=>({text})},stderr:{readFrom:()=>({text:''})}}}
}}
const ctx={get:key=>key==='subprocess'?subprocess:null};h.setShared_workbenchCtx(ctx)
const state=()=>h.loadWorkbenchState(),check=(label,fn)=>{fn();checks++;console.log('✓',label)}
const legacy=(id,accountId)=>({id,provider:'yunzhijia',selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:null,observedAt:new Date().toISOString()},externalId:'yzj:msg:msg-'+id,title:'旧消息',excerpt:'@all sit 请核实历史消息',fetchedAt:'2026-08-24T01:32:03.405Z',sender:'24fa28ac...',locator:{groupId:id,msgId:'msg-'+id,groupName:'历史讨论群',...(accountId?{accountId}:{})}})
async function seed(rows){await h.mutateWorkbenchState(s=>{s.sources=rows;s.tasks=rows.map(r=>({id:'task-'+r.id,title:'原有待办',status:'ready',sourceRefId:r.id,humanGuard:{editedFields:[]},tags:[]}));s.replies=rows.map(r=>({id:'reply-'+r.id,sourceId:r.id,msgId:r.locator.msgId,groupId:r.locator.groupId,contact:r.sender,stage:'待回复',humanGuard:true,createdAt:'2026-10-28T00:00:00Z',updatedAt:'2026-10-28T00:00:00Z'}));s.analysisQueue=[];s.syncCursors={};return s});searches=[];contacts=[]}
try{
 await seed([legacy('august')]);await h.repairYunzhijiaMetadata(ctx)
 check('精确匹配8月旧消息，补全原时间、完整发送人ID与姓名',()=>{const source=state().sources[0];assert.equal(source.locator.sentAt,'2026-08-24T01:32:03.625Z');assert.equal(source.locator.senderId,'24fa28ac-complete');assert.equal(source.locator.accountId,'org:me');assert.equal(source.sender,'补全同事');assert.equal(state().replies[0].contact,'补全同事');assert.ok(searches[0].includes('2026-08-24'));assert.ok(searches[0].includes('sit'))})
 check('只补元数据，不新建任务/来源/队列，不改变回复阶段、人工保护或建档时间',()=>{assert.equal(state().sources.length,1);assert.equal(state().tasks.length,1);assert.equal(state().tasks[0].id,'task-august');assert.equal(state().analysisQueue.length,0);assert.equal(state().replies[0].stage,'待回复');assert.equal(state().replies[0].humanGuard,true);assert.equal(state().replies[0].createdAt,'2026-10-28T00:00:00Z')})
 const count=searches.length;await h.repairYunzhijiaMetadata(ctx);check('已补全消息不重复检索',()=>assert.equal(searches.length,count))
 await seed([legacy('wrong')]);mode='wrong';await h.repairYunzhijiaMetadata(ctx);const wrongCount=searches.length;await h.repairYunzhijiaMetadata(ctx)
 check('同关键词但消息ID不同不补时间，失败记录冷却且不冒用fetchedAt',()=>{assert.equal(state().sources[0].locator.sentAt,undefined);assert.equal(state().sources[0].locator.senderId,undefined);assert.equal(searches.length,wrongCount);assert.equal(contacts.length,0)})
 await seed([legacy('anchor')]);mode='keyword-miss';await h.repairYunzhijiaMetadata(ctx)
 check('常见关键词搜索未返回原消息时，按已知消息ID前后定位后精确补全',()=>{assert.equal(state().sources[0].locator.sentAt,'2026-08-24T01:32:03.625Z');assert.equal(state().sources[0].sender,'补全同事')})
 await seed([legacy('duplicate')]);mode='duplicate';await h.repairYunzhijiaMetadata(ctx);check('多个精确结果有歧义时不选择第一条',()=>assert.equal(state().sources[0].locator.sentAt,undefined))
 await seed([legacy('other','other:me')]);mode='ok';await h.repairYunzhijiaMetadata(ctx);check('另一账号的历史来源不查询、不改写',()=>{assert.equal(searches.length,0);assert.equal(state().sources[0].locator.senderId,undefined)})
 await seed([legacy('linked'),legacy('unlinked')]);await h.mutateWorkbenchState(s=>{s.tasks=s.tasks.slice(0,1);s.replies=s.replies.slice(0,1);return s});await h.repairYunzhijiaMetadata(ctx)
 check('只修复当前待办/待回复引用的来源，不扫描全部历史',()=>{assert.equal(searches.length,1);assert.equal(state().sources[1].locator.sentAt,undefined)})
 await seed([legacy('limit-a'),legacy('limit-b')]);mode='rate';await h.repairYunzhijiaMetadata(ctx);await h.repairYunzhijiaMetadata(ctx)
 check('历史检索限流立即停止并保留IM补采信息，冷却不重复请求',()=>{assert.equal(searches.length,1);assert.ok(state().syncCursors['__messageMetadata:org:me'].retryAt);assert.ok(state().syncCursors['__pending:org:me'].retryAt)})
 await seed([legacy('race')]);mode='ok';hold={};const repairing=h.repairYunzhijiaMetadata(ctx)
 for(let i=0;i<100&&!hold.release;i++)await new Promise(r=>setTimeout(r,1));assert.ok(hold.release)
 await h.mutateWorkbenchState(s=>{s.sources[0].sender='人工保留姓名';s.sources[0].locator.sentAt='2026-08-24T02:00:00Z';s.sources[0].locator.groupName='人工保留群名';s.tasks[0].status='completed';return s});hold.release({exitCode:0});await repairing;hold=null
 check('检索期间的人工姓名、时间、群名和任务状态不被旧快照覆盖',()=>{assert.equal(state().sources[0].sender,'人工保留姓名');assert.equal(state().sources[0].locator.sentAt,'2026-08-24T02:00:00Z');assert.equal(state().sources[0].locator.groupName,'人工保留群名');assert.equal(state().tasks[0].status,'completed')})
 await seed(Array.from({length:13},(_,i)=>legacy('bounded-'+i)));await h.repairYunzhijiaMetadata(ctx)
 check('每轮最多检索12条旧来源',()=>assert.equal(searches.length,12));await h.repairYunzhijiaMetadata(ctx)
 check('后续一轮继续剩余旧来源，不重复处理已补全记录',()=>{assert.equal(searches.length,13);assert.ok(state().sources.every(row=>row.locator.sentAt))})
 await seed([legacy('normal-sync')]);await h.api.fetchMentions()
 check('正常同步也持久合并元数据，历史来源不重新进入识别队列',()=>{assert.ok(state().sources[0].locator.sentAt);assert.equal(state().sources[0].sender,'补全同事');assert.equal(state().analysisQueue.length,0);assert.equal(state().tasks.length,1)})
 check('完整ID已验证后，ASCII和Unicode两种截短ID都不冒充姓名',()=>{const locator={senderId:'24fa28ac-complete'};assert.equal(h.messageSender({sender:'24fa28ac...',locator}),'未知发件人');assert.equal(h.messageSender({sender:'24fa28ac…',locator}),'未知发件人')})
 console.log('message-metadata: '+checks+' scenarios passed')
}finally{rmSync(home,{recursive:true,force:true})}
