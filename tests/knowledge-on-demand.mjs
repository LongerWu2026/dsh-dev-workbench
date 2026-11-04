import {installNativeContextFixture,modelText} from './native-context-fixture.mjs'
/** Real Hub/tools with an isolated profile and simulated native model; no live accounts. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-on-demand-'));process.env.DSH_HOME=home
const oldFetch=globalThis.fetch,envKeys=['AWB_EMBEDDING_URL','AWB_EMBEDDING_MODEL'],oldEnv=Object.fromEntries(envKeys.map(key=>[key,process.env[key]])),disposers=[]
let checks=0;const check=(label,fn)=>{fn();checks++;console.log('✓ '+label)}
try{
 await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export {assistantHub} from './src/host/assistant/hub.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';export * from './src/host/assistant/hub-store.ts';export * from './src/host/assistant/hub-turns.ts';export {retrieveAssistantToolKnowledge} from './src/host/knowledge/assistant-tools.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(join(home,'host.mjs')),sessions=new Map(),tools=new Map(),plans=[],prompts=[],outputs=[];let guard,serial=0,created=0,embeddingCalls=0
 const state=()=>h.loadWorkbenchState()
 function native(id){const events=[],session={id,header:{cwd:home},get seq(){return events.length},snapshotEvents(from=0){return events.filter(row=>row.seq>from)},append(type,data){events.push({type,data,seq:events.length+1,time:Date.now()})}};sessions.set(id,session);return session}
 const original=native('original-chat'),controller={async create(){created++;return {session:native('created-'+created)}},async rename(){},async resolveAgent(id){return {agent:{session:sessions.get(id)}}},async prompt(request){
  const session=sessions.get(request.sessionId),turn=++serial,plan=plans.shift()||{};prompts.push(request);session.append('turn/start',{turn});session.append('user/message',{source:{kind:'user',rpcId:request.requestId},content:request.content})
  const results=[]
  for(const step of plan.tools||[]){const args=typeof step.args==='function'?step.args(results):step.args||{},execution={agent:{session},name:step.name,arguments:args},callId='call-'+turn+'-'+results.length;session.append('tool/call',{turn,callId,name:step.name,arguments:JSON.stringify(args)});let result,isError=false
   try{const denied=guard(execution);if(denied)throw Error(denied);result=await tools.get(step.name).execute(args,execution)}catch(error){isError=true;result={status:'error',note:error.message}}
   results.push(result);session.append('tool/result',{turn,message:{toolCallId:callId,isError,content:[{type:'text',text:JSON.stringify(result)}]}})
  }
  outputs.push(results);const text=typeof plan.answer==='function'?plan.answer(results):plan.answer||'普通回答。';session.append('assistant/message',{message:{content:[{type:'text',text}]}});session.append('turn/end',{turn,reason:{kind:'completed'}});return {accepted:true}
 }}
 const services={sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]},sessionController:controller},ctx={get:key=>services[key],provide(){},inject(deps,fn){if(deps.includes('tools'))fn({tools:{guard(fn){guard=fn;return()=>{}},register(def){tools.set(def.name,def);return()=>{}}}})},effect(fn){const stop=fn();if(typeof stop==='function')disposers.push(stop)},logger:{info(){}}};installNativeContextFixture(ctx);h.apply(ctx,{})
 await h.mutateWorkbenchState(s=>{s.settings.defaultProjectId='A';s.projects=[{id:'A',name:'项目甲',knowledgeSpaceId:'company'},{id:'B',name:'项目乙',knowledgeSpaceId:'company'}];s.knowledgeSpaces=[{id:'company',name:'公司资料'},{id:'client',name:'客户资料'}];s.tasks=[{id:'task-a',projectId:'A',title:'验收任务',status:'ready'}];s.knowledge=[
  {id:'release-a',title:'发布灰度规范',body:'接口发布验收前必须执行灰度验证。',projectId:'A',spaceId:'company',reviewState:'confirmed'},
  {id:'rollback-a',title:'数据库回滚手册',body:'数据库回滚前必须先保存快照。',projectId:'A',spaceId:'company',reviewState:'confirmed'},
  {id:'release-b',title:'乙项目发布规范',body:'接口发布验收 SECRET_PROJECT_B',projectId:'B',spaceId:'company',reviewState:'confirmed'},
  {id:'client-secret',title:'客户发布规范',body:'接口发布验收 SECRET_CLIENT_SPACE',spaceId:'client',reviewState:'confirmed'},
  {id:'candidate',title:'候选发布规范',body:'接口发布验收 SECRET_CANDIDATE',projectId:'A',spaceId:'company',reviewState:'candidate'}];return s})
 process.env.AWB_EMBEDDING_URL='https://embedding.invalid/embed';process.env.AWB_EMBEDDING_MODEL='fixture';globalThis.fetch=async()=>{embeddingCalls++;throw Error('synthetic embedding unavailable')}
 const hub=req=>h.assistantHub(ctx,req),send=(text,extra={})=>hub({action:'send',conversationId:'chat:'+original.id,text,requestId:'on-demand-'+(prompts.length+checks+1),...extra})
 const admitted=await hub({action:'adopt',sessionId:original.id,confirmed:true});assert.equal(admitted.status,'ok',admitted.note)
 const plain=await send('当前目录有多少技能？'),initialPrompt=modelText(prompts.at(-1))
 check('普通自动聊天不预检索或调用Embedding，继续原Harness会话',()=>{assert.equal(plain.status,'ok',plain.note);assert.equal(plain.sessionId,original.id);assert.equal(created,0);assert.equal(embeddingCalls,0);assert.equal(plain.retrieval.status,'deferred');assert.equal(plain.retrieval.hits.length,0);assert.match(initialPrompt,/按需检索/);assert.ok(!initialPrompt.includes('接口发布验收前必须'));assert.ok(!initialPrompt.includes('当前范围没有匹配'))})
 const plainDetail=await hub({action:'detail',conversationId:'chat:'+original.id})
 check('普通聊天正文和标题不混入按需知识设置或普通对话约束',()=>{assert.equal(plainDetail.messages.find(row=>row.role==='user').text,'当前目录有多少技能？');assert.ok(!plainDetail.messages.some(row=>row.text.includes('【本轮知识设置】')))})
 plans.push({tools:[{name:'workbench_knowledge_retrieve',args:{query:'发布 灰度 验收'}},{name:'workbench_knowledge_read',args:rows=>({ids:rows[0].hits.map(hit=>hit.id)})}],answer:rows=>'先执行灰度验证 [知识:'+rows[0].hits[0].id+']'})
 const found=await send('根据保存的发布规范，验收前要做什么？'),last=outputs.at(-1),hit=last[0].hits[0]
 check('模型按需查询并读取本轮原文，项目与空间从会话绑定而非模型参数取得',()=>{assert.equal(found.status,'ok',found.note);assert.equal(last[0].scope.projectId,'A');assert.equal(last[0].scope.spaceId,'company');assert.equal(hit.documentId,'release-a');assert.match(last[1].hits[0].text,/灰度验证/);assert.ok(embeddingCalls>0);assert.ok(!JSON.stringify(last).includes('SECRET_'))})
 const detail=await hub({action:'detail',conversationId:'chat:'+original.id}),trace=detail.retrievals.find(row=>row.turnId===found.turnId)
 check('按需结果关联本轮回答，不能被发送后的未检索占位覆盖',()=>{assert.equal(found.retrieval.id,last[0].id);assert.equal(found.retrieval.status,'ok');assert.equal(trace.id,found.retrieval.id);assert.equal(trace.status,'ok');assert.equal(trace.hits[0].id,hit.id);assert.equal(trace.sessionId,original.id);assert.equal(trace.fromSeq,found.fromSeq);assert.ok(!Object.hasOwn(trace.hits[0],'text'))})
 const delta=await hub({action:'delta',conversationId:'chat:'+original.id,fromSeq:found.fromSeq,retrievalId:found.retrieval.id})
 check('增量返回实际知识依据和引用核验，原文仍有版本读取约束',()=>{assert.ok(delta.retrievals.some(row=>row.id===trace.id));assert.deepEqual(delta.citationAudit.cited,[hit.id]);assert.equal(delta.citationAudit.missing,false);assert.equal(delta.citationAudit.invalid.length,0)})
 plans.push({tools:[{name:'workbench_knowledge_retrieve',args:{query:'发布 灰度 验收'}},{name:'workbench_knowledge_retrieve',args:{query:'数据库 回滚 快照'}}],answer:rows=>rows.map(row=>'[知识:'+row.hits[0].id+']').join(' ')})
 const multiple=await send('一起比较发布和回滚规范'),multiTrace=state().retrievalTraces.find(row=>row.id===multiple.retrieval.id)
 check('同轮多次检索合并引用片段，后一次查询不丢失前一次依据',()=>{assert.deepEqual(new Set(multiTrace.hits.map(row=>row.documentId)),new Set(['release-a','rollback-a']));assert.equal(multiTrace.turnId,multiple.turnId)})
 plans.push({tools:[{name:'workbench_knowledge_read',args:{ids:[hit.id]}}]});await send('继续聊一个新问题')
 check('新一轮不能将上轮片段直接冒充本轮检索，须先按需检索',()=>assert.match(outputs.at(-1)[0].note,/先检索本轮/))
 for(const forged of [{projectId:'B'},{accountId:'foreign-account'},{spaceId:'client'}]){plans.push({tools:[{name:'workbench_knowledge_retrieve',args:{query:'发布 验收',...forged}}]});await send('检查范围隔离');assert.match(outputs.at(-1)[0].note,/不能切换/)}
 check('模型伪造项目、账号或空间参数均在检索前拒绝',()=>assert.ok(!JSON.stringify(outputs).includes('SECRET_PROJECT_B')))
 const beforeOff=embeddingCalls;plans.push({tools:[{name:'workbench_knowledge_retrieve',args:{query:'发布 验收'}}]});const off=await send('此轮不要使用知识库',{knowledgeMode:'off'})
 check('关闭模式不预检索，模型误调用知识工具也被阻止',()=>{assert.equal(off.retrieval.status,'off');assert.equal(embeddingCalls,beforeOff);assert.match(outputs.at(-1)[0].note,/已关闭/);assert.match(modelText(prompts.at(-1)),/本轮关闭/)} )
 const beforeOnly=prompts.length,empty=await send('完全无关的蝴蝶标本',{knowledgeMode:'only'})
 check('仅知识库无命中时仍不调用模型',()=>{assert.equal(empty.status,'knowledge_empty');assert.equal(prompts.length,beforeOnly)})
 const only=await send('发布灰度验收',{knowledgeMode:'only'})
 check('仅知识库先检索并注入原文，按需规则不影响强制知识模式',()=>{assert.equal(only.retrieval.status,'ok');assert.match(modelText(prompts.at(-1)),/接口发布验收前必须执行灰度验证/);assert.match(modelText(prompts.at(-1)),/本轮仅依据知识片段/);assert.equal(only.sessionId,original.id)})
 const task=await hub({action:'send',conversationId:'task:task-a',text:'解释发布灰度验收规范'})
 check('专用事项会话仍保持原来的预检索行为',()=>{assert.equal(task.retrieval.status,'ok');assert.match(modelText(prompts.at(-1)),/接口发布验收前必须执行灰度验证/)})
 plans.push({tools:[{name:'workbench_assistant_action',args:{operation:'knowledge.search',query:'发布 灰度 验收'}}],answer:rows=>'[知识:'+rows[0].retrieval.hits[0].id+']'});const alias=await send('检索保存的发布规范')
 check('旧知识查询工具同样绑定范围并登记本轮引用，不能绕过按需链路',()=>{assert.equal(alias.retrieval.status,'ok');assert.equal(outputs.at(-1)[0].retrieval.scope.projectId,'A');assert.equal(alias.retrieval.turnId,alias.turnId)})
 const concurrent=native('scope-change'),scope={projectId:'A',spaceId:'company',accountId:null};h.rememberHubSession('chat:scope-change',concurrent.id,'范围变化');h.setHubSessionKnowledgeScope(concurrent.id,scope)
 const current=h.beginHubTurn({conversationId:'chat:scope-change',text:'发布验收',mode:'execute',source:'ai',sessionId:concurrent.id,fromSeq:0,requestId:'scope-change-query',knowledgeMode:'auto',knowledgeScope:scope});concurrent.append('turn/start',{turn:100});concurrent.append('user/message',{source:{kind:'user',rpcId:current.requestId},content:[{type:'text',text:'发布验收'}]})
 let release,entered;const gate=new Promise(resolve=>entered=resolve);globalThis.fetch=async()=>{entered();return new Promise(resolve=>release=()=>resolve(new Response(JSON.stringify({embeddings:[[1,0],[1,0],[1,0]]}),{status:200})))}
 const waiting=h.retrieveAssistantToolKnowledge({agent:{session:concurrent}},{query:'发布验收'});await gate;h.setHubSessionKnowledgeScope(concurrent.id,{projectId:'B',spaceId:'company'});release();await assert.rejects(waiting,/隔离范围已变化/)
 check('检索等待期间范围切换，旧片段不返回也不登记到新范围',()=>assert.ok(!state().retrievalTraces.some(row=>row.turnId===current.id&&row.status==='ok')))
 console.log('knowledge-on-demand: '+checks+' scenarios passed')
}finally{globalThis.fetch=oldFetch;for(const key of envKeys){if(oldEnv[key]===undefined)delete process.env[key];else process.env[key]=oldEnv[key]}for(const stop of disposers.reverse())stop();rmSync(home,{recursive:true,force:true})}
