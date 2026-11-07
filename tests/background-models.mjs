/** Isolated business-state and prompt-admission regression, with no real model calls. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-background-models-'));process.env.DSH_HOME=home
try{
 const outfile=join(home,'host.mjs');await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export {loadWorkbenchState as state,mutateWorkbenchState as mutate} from './src/host/storage/state-store.ts';export {runAnalysisBatch,waitStructuredReply,recordModelFailure} from './src/host/analysis/message-analysis.ts';export {ensureBackgroundSession} from './src/host/assistant/sessions.ts';export {normalizeState} from './src/host/domain/model.ts';export {runRadarSummarizeBatch} from './src/host/news/summarizer.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'})
 const h=await import(outfile),sessions=new Map(),agents=new Map(),prompts=[],cleanups=[];let api,creates=0,checks=0,globalWrites=0,hold,invalid=false,resolutions=0
 const globalDefault={provider:'global',model:'default'},groups=[{id:'alpha',name:'服务商甲',models:[{id:'one',name:'模型一'},{id:'two',name:'模型二'}]},{id:'beta',name:'服务商乙',models:[{id:'summary',name:'摘要模型'},{id:'one',name:'同名模型'}]}]
 const routeA={provider:'alpha',model:'one'},routeB={provider:'alpha',model:'two'},summaryRoute={provider:'beta',model:'summary'}
 function scoped(){const handlers=new Map();return {on(name,fn,options){const rows=handlers.get(name)||[];options?.prepend?rows.unshift(fn):rows.push(fn);handlers.set(name,rows);return()=>{const index=rows.indexOf(fn);if(index>=0)rows.splice(index,1)}},async run(name,args,seed){const rows=[...(handlers.get(name)||[])];let index=0;const next=()=>index<rows.length?rows[index++](...args,next):Promise.resolve(seed);return next()},handlers}}
 function create(id){const events=[],session={id,events,get seq(){return events.length},snapshotEvents:from=>events.filter(event=>event.seq>(from||0)),requestHeader:()=>events.filter(event=>event.type==='request/header').at(-1)?.data.header};sessions.set(id,session);const agent={session,ctx:scoped(),status:'idle'};agents.set(id,agent);return session}
 function append(session,type,data){session.events.push({seq:session.seq+1,type,data})}
 const controller={
  async modelCatalog(){return {groups,default:globalDefault,failures:[{id:'offline',message:'do-not-return-private-error'}],apiKey:'must-not-leak'}},
  async create(){return {sessionId:create('persistent-'+(++creates)).id}},async rename(){},async state({sessionId}){return {running:agents.get(sessionId)?.status==='running',cursor:sessions.get(sessionId)?.seq||0}},
  async resolveAgent(id){resolutions++;return {agent:agents.get(id)}},
  async selectModel(){globalWrites++;throw Error('必须禁止使用会修改全局默认的接口')},
  async prompt(request){
   if(invalid)throw Object.assign(Error('模型配置暂不可用'),{code:'WORKBENCH_MODEL_UNAVAILABLE'})
   const agent=agents.get(request.sessionId),session=agent.session;agent.status='running'
   const assembly=await agent.ctx.run('system-prompt/assemble',[{},{}],{variables:globalDefault}),config=await agent.ctx.run('agent/request',[{}],{...globalDefault,temperature:.2,reasoningEffort:'old-model-effort'})
   const row={sessionId:session.id,text:request.content[0].text,assembly,config};prompts.push(row);append(session,'user/message',{content:request.content});append(session,'turn/start',{});append(session,'request/header',{header:{config}})
   if(hold)await hold(row,agent)
   const packet=(()=>{try{return JSON.parse(row.text.split('\n').at(-1))}catch{return null}})()
   const output=packet?.batchId?{batchId:packet.batchId,results:packet.messages.map(message=>({sourceId:message.sourceId,analysis:{noise:true,items:[]}}))}:{answer:'ok'}
   append(session,'assistant/message',{message:{content:[{type:'text',text:JSON.stringify(output)}]}});append(session,'turn/end',{});agent.status='idle';return {accepted:true}
  }
 }
 const services={sessionController:controller,sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]},llm:{async resolveCallConfig(route){if(invalid)throw Error('credential-secret-must-not-leak');return route}},agentDefaultModel:{async saveSelection(){globalWrites++;throw Error('不得修改默认模型')}}}
 const ctx={get:key=>services[key],provide:(key,value)=>{if(key==='workbench')api=value},inject(){},effect(fn){const cleanup=fn();if(typeof cleanup==='function')cleanups.push(cleanup)},logger:{info(){}}};h.apply(ctx,{})
 const check=(label,fn)=>{fn();checks++;console.log('✓ '+label)}
 const configure=(purpose,model)=>api.backgroundModels({action:'configure',purpose,model})
 await api.saveSettings({aiExtract:{enabled:true,autoRegister:true},assistantSessionId:'human-history-preserved'})
 const catalog=await api.backgroundModels({action:'catalog'})
 check('模型目录只返回名称与ID，不携带默认路由、凭据或供应商原始错误',()=>{assert.equal(catalog.available,true);assert.equal(catalog.groups.length,2);assert.ok(!JSON.stringify(catalog).includes('must-not'));assert.ok(!JSON.stringify(catalog).includes('do-not-return'));assert.equal(catalog.default,undefined)})
 const background=create('existing-analysis'),summary=create('existing-summary');append(background,'assistant/message',{message:{content:[{type:'text',text:'已经完成的历史结果'}]}})
 await h.mutate(s=>{s.settings.analysisSessionId=background.id;s.settings.summarySessionId=summary.id;s.modelHealth={analysis:{blocked:true,failures:3},summary:{blocked:true,failures:3}};s.replies=[{id:'keep-reply',msgId:'keep-message',stage:'待回复'}];s.tasks=[{id:'keep-task',title:'仍需交付',status:'ready'}]})
 const history=JSON.stringify(background.events),business=JSON.stringify([h.state().tasks,h.state().replies])
 await configure('analysis',routeA)
 check('配置保存不调用模型、不建会话、不修改历史/任务/回复，只解除对应功能的旧失败暂停',()=>{assert.equal(prompts.length,0);assert.equal(creates,0);assert.equal(JSON.stringify(background.events),history);assert.equal(JSON.stringify([h.state().tasks,h.state().replies]),business);assert.equal(h.state().modelHealth.analysis,undefined);assert.equal(h.state().modelHealth.summary.blocked,true);assert.equal(globalWrites,0)})
 await configure('summary',summaryRoute)
 const [first,sameBranch]=await Promise.all([h.ensureBackgroundSession(ctx,'analysis'),h.ensureBackgroundSession(ctx,'analysis')]);await h.waitStructuredReply(ctx,controller,first,'合成问题',1000,'analysis')
 check('所选模型使用独立分支，并发获取同分支只创建一次，旧日志保留',()=>{assert.notEqual(first.id,background.id);assert.equal(sameBranch.id,first.id);assert.equal(creates,1);assert.deepEqual(prompts.at(-1).config,{...routeA,temperature:.2});assert.deepEqual(prompts.at(-1).assembly.variables,routeA);assert.equal(JSON.stringify(background.events),history);assert.equal(sessions.get(first.id).events.some(event=>JSON.stringify(event).includes('已经完成的历史结果')),false)})
 const second=await h.ensureBackgroundSession(ctx,'summary');await h.waitStructuredReply(ctx,controller,second,'合成摘要',1000,'summary')
 check('资讯摘要独立绑定另一模型，不串用识别模型或旧摘要历史',()=>{assert.notEqual(second.id,summary.id);assert.notEqual(second.id,first.id);assert.equal(prompts.at(-1).sessionId,second.id);assert.deepEqual(prompts.at(-1).config,{...summaryRoute,temperature:.2});assert.deepEqual(h.state().settings.backgroundModels,{analysis:routeA,summary:summaryRoute})})
 let during
 hold=async(row,agent)=>{await configure('analysis',routeB);during=await agent.ctx.run('agent/request',[{}],globalDefault);assert.deepEqual(row.config,{...routeA,temperature:.2})}
 await h.waitStructuredReply(ctx,controller,first,'本轮保持原模型',1000,'analysis');hold=null
 check('执行过程中修改设置不改变本轮后续步骤',()=>assert.deepEqual(during,routeA))
 const branchB=await h.ensureBackgroundSession(ctx,'analysis');await h.waitStructuredReply(ctx,controller,branchB,'下一轮改用模型二',1000,'analysis')
 check('下一轮进入模型二分支，旧问题不重发，宿主全局配置保留',()=>{assert.deepEqual(prompts.at(-1).config,{...routeB,temperature:.2});assert.notEqual(branchB.id,first.id);assert.equal(prompts.at(-1).sessionId,branchB.id);assert.equal(prompts.filter(row=>row.text==='本轮保持原模型').length,1);assert.equal(creates,3);assert.equal(globalWrites,0);assert.deepEqual(globalDefault,{provider:'global',model:'default'})})
 await configure('analysis',routeA);const createsBeforeReturn=creates,returned=await h.ensureBackgroundSession(ctx,'analysis');
 check('切回模型一复用它的原分支，规则和推理历史保持独立',()=>{assert.equal(returned.id,first.id);assert.equal(h.state().settings.analysisSessionId,first.id);assert.equal(creates,createsBeforeReturn);assert.equal(sessions.get(returned.id).events.some(event=>JSON.stringify(event).includes('下一轮改用模型二')),false)});await configure('analysis',routeB);await h.ensureBackgroundSession(ctx,'analysis')
 hold=async()=>{await configure('analysis',routeA);throw Error('HTTP 503 合成旧模型故障')};let oldFailure;try{await h.waitStructuredReply(ctx,controller,branchB,'旧模型在保存后才返回失败',1000,'analysis')}catch(error){oldFailure=error};hold=null;agents.get(branchB.id).status='idle';await h.recordModelFailure('analysis',oldFailure)
 check('配置更新后的旧轮次迟到故障不重新阻断新模型',()=>{assert.equal(h.state().modelHealth.analysis,undefined);assert.deepEqual(h.state().settings.backgroundModels.analysis,routeA)});await configure('analysis',routeB)
 const saved=JSON.parse(readFileSync(join(home,'storages/dev-workbench/state.json'),'utf8')),reloaded=h.normalizeState(saved).state
 check('跨重启标准化保留各模型分支、既有会话和业务进度',()=>{assert.deepEqual(reloaded.settings.backgroundModels,{analysis:routeB,summary:summaryRoute});assert.equal(reloaded.settings.analysisSessionId,branchB.id);assert.equal(reloaded.settings.summarySessionId,second.id);assert.ok(Object.values(reloaded.backgroundThreads).some(thread=>thread.sessionId===first.id&&JSON.stringify(thread.model)===JSON.stringify(routeA)));assert.equal(reloaded.tasks[0].status,'ready');assert.equal(reloaded.replies[0].stage,'待回复')})
 await h.mutate(s=>{s.backgroundThreads=reloaded.backgroundThreads});sessions.delete(branchB.id);let restored=false;
 const originalResolve=controller.resolveAgent;controller.resolveAgent=async id=>{if(id===branchB.id){sessions.set(id,agents.get(id).session);restored=true}return originalResolve(id)};
 const resumed=await h.ensureBackgroundSession(ctx,'analysis');await h.waitStructuredReply(ctx,controller,resumed,'重启后继续模型二',1000,'analysis');controller.resolveAgent=originalResolve;
 check('冷恢复重用模型二的原会话和正确模型，不再建分支',()=>{assert.equal(resumed.id,branchB.id);assert.equal(restored,true);assert.equal(creates,createsBeforeReturn);assert.deepEqual(prompts.at(-1).config,{...routeB,temperature:.2})})
 const revision=h.state().revision;await assert.rejects(configure('analysis',{provider:'alpha',model:'missing'}),/不可用/);await assert.rejects(configure('analysis',{...routeA,apiKey:'not-accepted'}),/有效/);await assert.rejects(api.saveSettings({backgroundModels:{analysis:routeA}}),/配置入口/)
 invalid=true;await assert.rejects(configure('analysis',routeA),error=>!error.message.includes('credential-secret')&&/配置不可用/.test(error.message));invalid=false
 check('不可用模型、额外凭据字段和绕过入口均拒绝且不覆盖原设置',()=>{assert.equal(h.state().revision,revision);assert.deepEqual(h.state().settings.backgroundModels.analysis,routeB)})
 agents.get(branchB.id).status='running';const before=prompts.length;await assert.rejects(h.waitStructuredReply(ctx,controller,branchB,'不可并发发送',1000,'analysis'),/仍在执行/);agents.get(branchB.id).status='idle';check('活动会话不因切换模型而中断或额外提交',()=>assert.equal(prompts.length,before))
 create('unrelated-session');await controller.prompt({sessionId:'unrelated-session',content:[{type:'text',text:'其他会话'}]})
 check('普通会话继续使用原宿主默认路由',()=>assert.deepEqual(prompts.at(-1).config,{...globalDefault,temperature:.2,reasoningEffort:'old-model-effort'}))
 const sourceAt=new Date().toISOString(),add=async id=>h.mutate(s=>{s.sources.push({id,provider:'yunzhijia',title:id,excerpt:'仅供参考的合成消息',fetchedAt:sourceAt,locator:{accountId:'test-account',groupId:'test-group',msgId:id,sentAt:sourceAt,intake:true,direction:'inbound'},selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:1,observedAt:sourceAt}});s.analysisQueue.push({id:'entry-'+id,sourceId:id,msgId:id,accountId:'test-account',groupId:'test-group',status:'pending',attempts:0})})
 await add('source-one');await h.runAnalysisBatch(ctx,{onlyIds:['entry-source-one'],limit:5});const completed=structuredClone(h.state().analysisQueue.find(row=>row.sourceId==='source-one')),accountSession=prompts.at(-1).sessionId;await configure('analysis',routeA);await add('source-two');await h.runAnalysisBatch(ctx,{onlyIds:['entry-source-one','entry-source-two'],limit:5})
 check('切换后只处理未完成消息，在新分支补发规则和当前事项快照',()=>{assert.deepEqual(h.state().analysisQueue.find(row=>row.sourceId==='source-one'),completed);assert.equal(prompts.filter(row=>{try{return JSON.parse(row.text.split('\n').at(-1)).messages?.some(message=>message.sourceId==='source-one')}catch{return false}}).length,1);assert.notEqual(prompts.at(-1).sessionId,accountSession);assert.match(prompts.at(-1).text,/工作台消息批处理协议/);const packet=JSON.parse(prompts.at(-1).text.split('\n').at(-1));assert.deepEqual(packet.messages.map(row=>row.sourceId),['source-two']);assert.ok(packet.conversations.length);assert.deepEqual(prompts.at(-1).config,{...routeA,temperature:.2});assert.equal(globalWrites,0)})
 await configure('analysis',routeB);await add('source-model-unavailable');invalid=true;const unavailableBatch=await h.runAnalysisBatch(ctx,{onlyIds:['entry-source-model-unavailable'],limit:5});invalid=false
 check('模型配置临时失效保留待识别条目和重试次数，不消耗业务失败额度',()=>{assert.equal(unavailableBatch.status,'deferred');const row=h.state().analysisQueue.find(row=>row.id==='entry-source-model-unavailable');assert.equal(row.status,'pending');assert.equal(row.attempts,0);assert.equal(row.leaseUntil,null)});await configure('analysis',routeA)
 const fetches=[];services.web={async fetch(request){fetches.push(request.url);return {statusCode:200,body:{content:'<article>'+('合成资讯原文用于摘要验证。'.repeat(20))+'</article>'}}}}
 await h.mutate(s=>{s.radar=[{id:'done-news',title:'已完成摘要的资讯',url:'https://example.invalid/done',summary:{change:'完成的变化',usage:'完成的用法',risk:'完成的风险',practice:'完成的实践'},summaryStatus:'done',summaryAttempts:1},{id:'new-news',title:'尚未摘要的资讯',url:'https://example.invalid/new',summary:{},summaryAttempts:0}]})
 const doneNews=structuredClone(h.state().radar[0]);await configure('summary',routeB);const summarized=await h.runRadarSummarizeBatch(ctx,{onlyIds:['done-news','new-news'],limit:5})
 check('切换摘要模型只处理未完成资讯，使用独立摘要分支',()=>{assert.equal(summarized.done,1);assert.deepEqual(h.state().radar.find(row=>row.id==='done-news'),doneNews);assert.deepEqual(fetches,['https://example.invalid/new']);assert.notEqual(prompts.at(-1).sessionId,second.id);assert.notEqual(prompts.at(-1).sessionId,summary.id);assert.notEqual(prompts.at(-1).sessionId,branchB.id);assert.deepEqual(prompts.at(-1).config,{...routeB,temperature:.2});assert.equal(globalWrites,0)})
 await h.mutate(s=>{s.radar.push(...['switch-first','switch-second'].map(id=>({id,title:id,url:'https://example.invalid/'+id,summary:{},summaryAttempts:0})))})
 const beforeSummarySwitch=prompts.length
 hold=async row=>{if(row.text.includes('switch-first'))await configure('summary',summaryRoute)}
 await h.runRadarSummarizeBatch(ctx,{onlyIds:['switch-first','switch-second'],limit:2});hold=null
 check('摘要执行中修改模型，下一篇使用对应分支，不中断或重发前一篇',()=>{const rows=prompts.slice(beforeSummarySwitch);assert.equal(rows.length,2);assert.deepEqual(rows.map(row=>row.config.model),[routeB.model,summaryRoute.model]);assert.equal(rows[1].sessionId,second.id);assert.equal(h.state().radar.find(row=>row.id==='switch-first').summaryStatus,'done');assert.equal(h.state().radar.find(row=>row.id==='switch-second').summaryStatus,'done')})
 await configure('analysis',null);const native=await h.ensureBackgroundSession(ctx,'analysis');await h.waitStructuredReply(ctx,controller,native,'沿用宿主会话模型',1000,'analysis');check('取消覆盖进入原生模型分支，保留各显式模型分支和全局默认',()=>{assert.notEqual(native.id,first.id);assert.notEqual(native.id,branchB.id);assert.deepEqual(prompts.at(-1).config,{...globalDefault,temperature:.2,reasoningEffort:'old-model-effort'});assert.equal(globalWrites,0)})
 await configure('analysis',routeA);const accountA=await h.ensureBackgroundSession(ctx,'analysis','test-account'),accountB=await h.ensureBackgroundSession(ctx,'analysis','another-account')
 await configure('analysis',{provider:'beta',model:'one'});const otherProvider=await h.ensureBackgroundSession(ctx,'analysis','test-account')
 check('同模型的不同账号、同名模型的不同服务商分别使用独立分支',()=>{assert.notEqual(accountA.id,accountB.id);assert.notEqual(otherProvider.id,accountA.id);assert.notEqual(otherProvider.id,second.id);assert.equal(h.state().settings.assistantSessionId,'human-history-preserved')})
 for(const cleanup of cleanups.reverse())cleanup()
 check('卸载插件撤回会话模型钩子',()=>{assert.equal([...agents.get(summary.id).ctx.handlers.values()].flat().length,0)})
 console.log('background-models: '+checks+' scenarios passed')
}finally{rmSync(home,{recursive:true,force:true})}
