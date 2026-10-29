/** Installation boundary, durable retirement and real collection/analysis paths. Isolated profiles only. */
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,statSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-message-boundary-'))
process.env.DSH_HOME=home
const bundle=join(home,'host.mjs'),dir=join(home,'storages/dev-workbench'),file=join(dir,'state.json')
await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';export {messageProcessingStart,messageSkipReason} from './src/host/domain/message-policy.ts';export {analysisScope,mergeAnalysisIntoState,runAnalysisBatch} from './src/host/analysis/message-analysis.ts';export {fetchMentionsIncremental,fetchYunzhijiaMentionsInto} from './src/host/integrations/yunzhijia.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:bundle,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const host=await import(bundle)
const installedAt='2026-10-28T01:30:00.000Z',start='2026-10-27T16:00:00.000Z',older='2026-10-27T15:59:59.999Z'
const source=(id,at)=>({id,provider:'yunzhijia',selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:null,observedAt:new Date().toISOString()},externalId:id,title:'请明天提交合成报告',excerpt:'请明天提交合成报告',fetchedAt:at,locator:{msgId:id,groupId:'group',accountId:'me',sentAt:at,intake:true,direction:'inbound'}})
const sources=[source('old',older),source('today',start),source('held',start)]
const analysis={noise:false,items:[{title:'合成事项',needsAction:true,needsReply:true}]}
const queue=['pending','failed','running','awaiting_human','done','cancelled'].map(status=>({id:status,sourceId:'old',msgId:'old',status,analysis,attempts:1,leaseUntil:new Date(Date.now()+60000).toISOString()}))
queue.push({id:'held',sourceId:'held',status:'historical',attempts:0})
mkdirSync(dir,{recursive:true})
writeFileSync(file,JSON.stringify({version:2,installedAt,sources,analysisQueue:queue,settings:{aiExtract:{enabled:true,autoRegister:true}},tasks:[{id:'existing-task',title:'已建档事项'}]}))
let checks=0,api,modelCalls=0,creates=0
const cleanups=[],events=[]
function check(label,fn){fn();checks++;console.log('✓',label)}
const session={id:'synthetic-model',snapshotEvents:(from=0)=>events.filter(row=>row.seq>from)}
const controller={create:async()=>{creates++;return {sessionId:session.id}},prompt:async request=>{
 modelCalls++;const packet=JSON.parse(request.content[0].text.split('\n').at(-1))
 events.push({type:'assistant/message',seq:events.length+1,data:{message:{content:[{type:'text',text:JSON.stringify({batchId:packet.batchId,results:packet.messages.map(message=>({sourceId:message.sourceId,analysis:{noise:true,items:[]}}))})}]}}},{type:'turn/end',seq:events.length+2,data:{}})
}}
const services={sessionController:controller,sessions:{get:()=>session,list:()=>[session]}}
const ctx={provide:(name,value)=>{if(name==='workbench')api=value},inject:()=>{},get:name=>services[name],effect:fn=>{const cleanup=fn();if(typeof cleanup==='function')cleanups.push(cleanup)},logger:{info(){}}}
try {
 host.apply(ctx,{})
 let state=host.loadWorkbenchState()
 check('安装日期按北京时间零点固定，安装当天更早的消息仍在范围内',()=>{assert.equal(host.messageProcessingStart(installedAt),start);assert.ok(host.messageSkipReason(state,sources[0]));assert.equal(host.messageSkipReason(state,sources[1]),null)})
 check('升级跳过旧待处理、失败、在途和待确认条目，并保留已完成记录及任务',()=>{for(const status of ['pending','failed','running','awaiting_human']){const row=state.analysisQueue.find(e=>e.id===status);assert.equal(row.status,'skipped');assert.equal(row.leaseUntil,null);assert.equal(row.nextRetryAt,null)}assert.equal(state.analysisQueue.find(e=>e.id==='done').status,'done');assert.equal(state.analysisQueue.find(e=>e.id==='cancelled').status,'cancelled');assert.equal(state.tasks[0].id,'existing-task');assert.equal(state.sources.length,3)})
 check('已有历史暂存直接跳过，即使它的消息日期在安装当天',()=>assert.equal(state.analysisQueue.find(e=>e.id==='held').status,'skipped'))
 const batch=await host.runAnalysisBatch(ctx,{limit:20,onlyIds:['pending','held']})
 check('定向运行历史条目不建立模型会话，也不调用模型',()=>{assert.equal(batch.modelCalls,0);assert.equal(modelCalls,0);assert.equal(creates,0)})
 for(const id of ['pending','failed','running','awaiting_human','done','cancelled','held'])await assert.rejects(api.analysisRetry(id),/跳过|安装日期/)
 await assert.rejects(api.analysisCancel('held'),/跳过/)
 await assert.rejects(api.analysisRetry('held'),/跳过/)
 await assert.rejects(api.analyzeConfirm('awaiting_human'),/跳过/)
 await assert.rejects(host.mutateWorkbenchState(s=>{host.mergeAnalysisIntoState(s,s.analysisQueue.find(e=>e.id==='pending'),analysis,{forceCreate:true});return s}),/跳过/)
 check('重试、人工确认和强制提交都不能绕过历史边界',()=>assert.equal(host.loadWorkbenchState().tasks.length,1))
 check('安装日期前消息和已跳过历史暂存都不进入新消息的模型上下文',()=>assert.ok(!host.analysisScope(state,sources[1]).context.some(row=>['old','held'].includes(row.id))))
 await api.extractCandidates()
 check('规则候选提取也跳过旧消息及已跳过的历史暂存',()=>assert.ok(!host.loadWorkbenchState().candidates.some(row=>['old','held'].includes(row.sourceRefId))))
 await host.mutateWorkbenchState(s=>{s.analysisQueue.push({id:'new',sourceId:'today',status:'pending',attempts:0});return s})
 await host.runAnalysisBatch(ctx,{limit:1,onlyIds:['new']})
 check('安装当天零点的正常消息仍可完成识别',()=>{assert.equal(host.loadWorkbenchState().analysisQueue.find(e=>e.id==='new').status,'done');assert.equal(modelCalls,1)})
 const currentInstallDay=host.messageProcessingStart(new Date().toISOString())
 await host.mutateWorkbenchState(s=>{s.installedAt='2099-01-01T00:00:00.000Z';return s})
 check('后续写入不能改变本机安装日期',()=>assert.equal(host.loadWorkbenchState().installedAt,installedAt))
 const restarted=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`const h=await import(${JSON.stringify(bundle)});const s=h.loadWorkbenchState();console.log(JSON.stringify({installedAt:s.installedAt,status:s.analysisQueue.find(e=>e.id==='held').status}))`],{env:{...process.env,DSH_HOME:home},encoding:'utf8'}))
 check('独立进程重启保留固定安装日期及跳过状态',()=>assert.deepEqual(restarted,{installedAt,status:'skipped'}))

 let rows=[],oldRows=[],recent=true,messageCalls=0,groupType=1
 const message=(id,sendTime)=>({msgId:id,fromOpenId:'other',content:'请核对合成事项',sendTime,param:{notifyType:1}})
 services.subprocess={resolveExecutable:async()=>'/fixture/yzj-cli',spawn(spec){
  const args=spec.argv;let data={}
  if(args.includes('whoami'))data={openId:'me',name:'本人'}
  else if(args.includes('recent'))data={list:recent?[{groupId:'group',groupType,groupName:'合成会话'}]:[],more:false}
  else if(args.includes('list')&&args.includes('--group-id')){messageCalls++;data={list:(args[args.indexOf('--type')+1]==='old'?oldRows:rows).map(message=>({message}))}}
  else if(args.includes('search'))data={list:[{group:{groupId:'group',groupName:'合成会话'},messages:rows.map(message=>({message}))}]}
  const text=JSON.stringify({success:true,data});return {collected:{stdout:{readFrom:()=>({text,nextOffset:text.length,lossy:false})},stderr:{readFrom:()=>({text:'',nextOffset:0,lossy:false})}},done:Promise.resolve({exitCode:0}),terminate(){}}
 }}
 rows=[message('too-old',older),...Array.from({length:19},(_,i)=>message('valid-'+i,new Date(Date.parse(start)+i*1000).toISOString()))]
 let fetched=await host.fetchMentionsIncremental(ctx,{openId:'me'}, {},installedAt)
 check('同页跨安装日期只保留新消息，停止历史翻页并推进游标',()=>{assert.equal(messageCalls,1);assert.equal(fetched.mentions.length,19);assert.ok(fetched.mentions.every(row=>row.msgId!=='too-old'));assert.equal(fetched.cursors['me:group'].lastMsgId,'valid-18');assert.ok(!fetched.cursors['me:group'].resumeBefore)})
 rows=Array.from({length:20},(_,i)=>message('old-'+i,older));oldRows=rows;messageCalls=0
 fetched=await host.fetchMentionsIncremental(ctx,{openId:'me'},{'me:group':{intakePolicy:'focused-v1',resumeBefore:'old-anchor',pendingNewest:'newest-seen'}},installedAt)
 check('已有历史补采游标碰到安装边界即结束，不再逐页回翻',()=>{assert.equal(messageCalls,1);assert.equal(fetched.mentions.length,0);assert.equal(fetched.cursors['me:group'].lastMsgId,'newest-seen');assert.ok(!fetched.cursors['me:group'].resumeBefore)})
 rows=Array.from({length:20},(_,i)=>message('fresh-'+i,new Date(Date.parse(start)+i*1000).toISOString()));messageCalls=0
 fetched=await host.fetchMentionsIncremental(ctx,{openId:'me'},{},installedAt)
 check('新消息跨页正常收齐，下一页旧消息不入库',()=>{assert.equal(messageCalls,2);assert.equal(fetched.mentions.length,20);assert.equal(fetched.cursors['me:group'].lastMsgId,'fresh-19')})
 recent=false;rows=[message('keyword-old',older),message('keyword-new',start),message('unknown-time',null)]
 const empty={installedAt,settings:{},sources:[],analysisQueue:[],replies:[],syncCursors:[]}
 const fallback=await host.fetchYunzhijiaMentionsInto(ctx,empty)
 check('关键词兜底同样排除旧消息和时间缺失消息',()=>{assert.equal(fallback.lastMentionsFetch.mode,'keyword');assert.deepEqual(fallback.sources.map(s=>s.locator.msgId),['keyword-new']);assert.equal(fallback.analysisQueue.length,1)})
 groupType=2;recent=true;rows=[
  {...message('all-desc',start),content:'@all 15:30，A303，月度质量星期四，请大家安排参加。',param:{desc:[{type:'at',data:'all'}],notifyType:0}},
  {...message('all-flag',start),param:{notifyToAll:true}},
  {...message('other-target',start),param:{notifyType:1,desc:[{type:'at',data:'someone-else'}]}},
  {...message('plain-group',start),param:{}},
  {...message('own-all',start),fromOpenId:'me',param:{notifyToAll:true}},
 ]
 const broadcast=await host.fetchMentionsIncremental(ctx,{openId:'me'},{},installedAt)
 check('@all两种元数据均入选，已读普通消息和本人广播不再进入队列',()=>{assert.deepEqual(broadcast.mentions.map(row=>[row.msgId,row.intake]),[['all-desc',true],['all-flag',true]])})
 recent=false;const broadcastFallback=await host.fetchYunzhijiaMentionsInto(ctx,{installedAt,settings:{},sources:[],analysisQueue:[],replies:[],tasks:[],syncCursors:{}})
 check('关键词兜底同样采集真实@all通知，不把@他人当成本人新义务',()=>assert.deepEqual(broadcastFallback.sources.map(row=>row.locator.msgId),['all-desc','all-flag']))

 // A legacy profile has no install field. Directory birth time is used once,
 // rather than updatedAt or message send dates, and then written durably.
 const legacy=join(home,'legacy'),legacyDir=join(legacy,'storages/dev-workbench'),legacyFile=join(legacyDir,'state.json')
 mkdirSync(legacyDir,{recursive:true});writeFileSync(legacyFile,JSON.stringify({version:2,updatedAt:'2000-01-01T00:00:00Z',sources:[source('legacy-old','2001-01-01T00:00:00Z')],analysisQueue:[{id:'legacy-pending',sourceId:'legacy-old',status:'pending'}]}))
 process.env.DSH_HOME=legacy
 state=host.loadWorkbenchState()
 check('旧版从本机数据目录创建日期补齐安装时间并落盘，不采用消息日期',()=>{assert.equal(state.installedAt,new Date(statSync(legacyDir).birthtimeMs).toISOString());assert.equal(host.messageProcessingStart(state.installedAt),currentInstallDay);assert.equal(state.analysisQueue[0].status,'skipped');assert.equal(JSON.parse(readFileSync(legacyFile)).installedAt,state.installedAt)})
 // Post-install messages stay eligible even after 14 days: this is a fixed boundary.
 check('固定安装边界不随日期滚动，安装后的较早消息仍可识别',()=>assert.equal(host.messageSkipReason({installedAt:'2020-01-01T00:00:00Z'},source('after','2020-02-01T00:00:00Z')),null))
 console.log('message-boundary: '+checks+' scenarios passed')
} finally {process.env.DSH_HOME=home;cleanups.forEach(fn=>fn());rmSync(home,{recursive:true,force:true})}
