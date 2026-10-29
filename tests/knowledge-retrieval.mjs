import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-knowledge-'));process.env.DSH_HOME=home
await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export * from './src/host/knowledge/retrieval.ts';export * from './src/host/knowledge/context.ts';export * from './src/host/knowledge/semantic.ts';export {normalizeState} from './src/host/domain/model.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';export {prepareOfficeSteps,enqueueOfficeWorkflow} from './src/host/workflows/office-jobs.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const h=await import(join(home,'host.mjs')),sessions=new Map(),disposers=[];let api,guard,creates=0,calls=0,checks=0,lastPrompt=''
const controller={create:async()=>{const events=[],s={id:'kb-session-'+(++creates),events,get seq(){return events.length},snapshotEvents(from=0){return events.filter(e=>e.seq>from)}};sessions.set(s.id,s);return {sessionId:s.id}},rename:async()=>{},state:async({sessionId})=>({cursor:sessions.get(sessionId)?.seq||0,running:false}),prompt:async req=>{calls++;lastPrompt=req.content[0].text;const line=lastPrompt.split('\n').find(l=>l.startsWith('{"status":')),retrieval=line?JSON.parse(line):null,s=sessions.get(req.sessionId);s.events.push({type:'user/message',seq:s.seq+1,data:{content:req.content}},{type:'turn/start',seq:s.seq+2,data:{}},{type:'assistant/message',seq:s.seq+3,data:{message:{content:[{type:'text',text:retrieval?.hits[0]?'按规范处理 [知识:'+retrieval.hits[0].id+']':'普通回答'}]}}},{type:'turn/end',seq:s.seq+4,data:{}});return{accepted:true}}}
const services={sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]},sessionController:controller}
const ctx={provide:(n,v)=>{if(n==='workbench')api=v},get:n=>services[n],inject:(deps,fn)=>{if(deps.includes('tools'))fn({tools:{register:()=>()=>{},guard:fn=>{guard=fn;return()=>{}}}})},effect:fn=>{const d=fn();if(typeof d==='function')disposers.push(d)},logger:{info(){}}};h.apply(ctx,{})
const check=(label,fn)=>{fn();checks++;console.log('✓',label)},doc=(id,body,extra={})=>({id,title:'项目技术规范',body,reviewState:'confirmed',tags:[],...extra}),base={settings:{},projects:[{id:'A'},{id:'B'}],sources:[],knowledge:[]}
try{
 const s={...base,knowledge:[doc('general','服务器内存不足时先扩容，再分析分区数据量。'),doc('project-A','接口鉴权需要校验用户身份及签名。',{projectId:'A'}),doc('project-B','接口鉴权采用另一个系统规范。',{projectId:'B'}),doc('account-B','接口鉴权专属资料。',{accountId:'B'})]}
 check('中文同义问法召回内存扩容知识',()=>assert.equal(h.retrieveKnowledge(s,'服务器内存不够了怎么办').hits[0].documentId,'general'))
 const scoped=h.retrieveKnowledge(s,'接口认证和鉴权怎么做',{scope:{projectId:'A',accountId:'A'}})
 check('项目与账号分区不混入其他范围，通用资料可共用',()=>{assert.ok(scoped.hits.some(x=>x.documentId==='project-A'));assert.ok(!scoped.hits.some(x=>['project-B','account-B'].includes(x.documentId)))})
 check('候选、失效、归档、过期资料不进入自动检索',()=>{const docs=['candidate','obsolete'].map((reviewState,i)=>doc('review-'+i,'接口鉴权规范',{reviewState}));docs.push(doc('arch','接口鉴权规范',{archivedAt:new Date().toISOString()}),doc('expired','接口鉴权规范',{validUntil:'2000-01-01T00:00:00Z'}));assert.equal(h.retrieveKnowledge({...base,knowledge:docs},'接口鉴权').hits.length,0)})
 const mutable=doc('versioned','# 部署规范\n接口发布前先验收。\n## 回滚\n发布失败执行回滚。'),vstate={...base,knowledge:[mutable]},hit=h.retrieveKnowledge(vstate,'发布失败如何回滚').hits[0]
 check('按段落切块且带版本和行号，原文读取一致',()=>{assert.ok(hit.id.includes('@'));assert.ok(hit.lineStart>0);assert.equal(h.readKnowledgeChunks(vstate,[hit.id],{})[0].text,hit.text)})
 mutable.body='新的发布规范：先执行灰度检查。';await assert.rejects(async()=>h.readKnowledgeChunks(vstate,[hit.id],{}),/版本已更新/);checks++
 mutable.archivedAt=new Date().toISOString();check('归档后旧引用立即拒绝',()=>assert.throws(()=>h.readKnowledgeChunks(vstate,[hit.id],{}),/已失效/))
 check('关闭检索不注入任何片段',()=>assert.equal(h.retrieveKnowledge(s,'接口鉴权',{mode:'off'}).status,'off'))
 check('无答案保留empty，与错误分开',()=>assert.equal(h.retrieveKnowledge(s,'完全无关的蝴蝶标本').status,'empty'))
 const audit=h.validateKnowledgeCitations('[知识:'+scoped.hits[0].id+'] [知识:fake]',scoped)
 check('引用审核标出不存在的ID，缺少引用可检测',()=>{assert.deepEqual(audit.invalid,['fake']);assert.equal(h.validateKnowledgeCitations('无引用回答',scoped).missing,true)})
 const long={...base,knowledge:[doc('long','```\n'+'abc '.repeat(4000)+'\n```')]};check('过长代码块不静默截断或冒充未找到',()=>assert.match(h.retrieveKnowledge(long,'abc').note,/预算/))
 await api.createKnowledge({title:'接口发布验收规范',body:'接口发布前必须通过灰度验收，失败后先回滚。',reviewState:'confirmed'});const saved=h.loadWorkbenchState().knowledge[0]
 const miss=await api.assistantSend({text:'完全无关的蝴蝶标本',knowledgeMode:'only'});check('仅知识库无命中不调用模型',()=>{assert.equal(miss.status,'knowledge_empty');assert.equal(calls,0)})
 const sent=await api.assistantSend({text:'接口发布前如何验收',knowledgeMode:'only'});check('渐进聊天默认注入真实知识及原文，不需要手动refs',()=>{assert.equal(sent.retrieval.hits[0].documentId,saved.id);assert.ok(lastPrompt.includes('接口发布前必须通过灰度验收'));assert.equal(calls,1)})
 check('仅知识库轮次禁止工具调用',()=>assert.match(guard({agent:{session:sessions.get(sent.sessionId)}}),/仅知识库/))
 const delta=await api.assistantDelta({sessionId:sent.sessionId,fromSeq:sent.fromSeq,retrievalId:sent.retrieval.id})
 check('轮次结束审核引用且解除工具限制',()=>{assert.equal(delta.citationAudit.invalid.length,0);assert.equal(delta.citationAudit.cited.length,1);assert.equal(guard({agent:{session:sessions.get(sent.sessionId)}}),undefined)})
 const followup=await h.retrieveAssistantKnowledge(h.loadWorkbenchState(),'现在应该如何改？',{sessionId:sent.sessionId});check('短追问复用同一会话检索主题与范围',()=>assert.equal(followup.hits[0].documentId,saved.id));
 const asked=await api.assistantAsk({text:'接口发布前如何验收'});check('同步问答同样自动检索并复用会话',()=>{assert.equal(asked.retrieval.hits.length,1);assert.equal(creates,1)})
 const rows=await api.knowledgeTraces({});check('检索记录保留片段元数据而不重复存正文',()=>{assert.ok(rows.items.length>=2);assert.equal(rows.items[0].hits[0].text,undefined)})
 await api.createTask({title:'接口发布验收',description:'请准备处理方案'});const task=h.loadWorkbenchState().tasks[0]
 const step=h.prepareOfficeSteps(h.loadWorkbenchState(),'task_assist',{taskId:task.id})[0]
 check('待办方案冻结知识版本与片段，而非只保留事项文本',()=>assert.equal(step.input.knowledge.hits[0].documentId,saved.id))
 await h.enqueueOfficeWorkflow('task_assist',{taskId:task.id});await h.enqueueOfficeWorkflow('task_assist',{taskId:task.id});check('检索请求ID变化不打破同输入作业去重',()=>assert.equal(h.loadWorkbenchState().jobs.filter(j=>j.kind==='task_assist').length,1))
 const pack=await api.exportMigration();check('迁移含知识状态与检索记录',()=>{assert.equal(pack.data.knowledge[0].reviewState,'confirmed');assert.ok(pack.data.retrievalTraces.length)})
 const originalFetch=globalThis.fetch,embeddingEnv=Object.fromEntries(['AWB_EMBEDDING_URL','AWB_EMBEDDING_MODEL','AWB_EMBEDDING_TOKEN'].map(key=>[key,process.env[key]]))
 try{
 process.env.AWB_EMBEDDING_URL='http://127.0.0.1:11434/api/embed';process.env.AWB_EMBEDDING_MODEL='isolated-test'
 let embeddedTexts=[];globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);embeddedTexts.push(body.input);assert.equal(body.truncate,false);return new Response(JSON.stringify({embeddings:body.input.map((t,i)=>i===0||t.includes('扩容')?[1,0]:[0,1])}),{status:200})}
 const hybrid=await h.retrieveKnowledgeAsync(s,'资源不够怎么办',{scope:{projectId:'A'}})
 check('可选向量召回及混合排序，不把其他项目内容发给提供者',()=>{assert.equal(hybrid.strategy,'hybrid-bm25-vector-rrf');assert.ok(hybrid.hits.some(x=>x.documentId==='general'));assert.ok(!embeddedTexts.flat().some(t=>t.includes('另一个系统规范')))})
 await h.retrieveKnowledgeAsync(s,'容量如何处理',{scope:{projectId:'A'}});check('同版本向量复用缓存，后续只向量化新问题',()=>assert.equal(embeddedTexts.at(-1).length,1))
 globalThis.fetch=async()=>new Response('{"embeddings":[[1,"bad"]]}',{status:200});const fallback=await h.retrieveKnowledgeAsync(s,'内存不足')
 check('向量错误保留本地全文结果并显示降级原因',()=>{assert.equal(fallback.hits[0].documentId,'general');assert.match(fallback.note,/语义检索不可用/)})
 process.env.AWB_EMBEDDING_TOKEN='synthetic-transport-test-only'
 let transportCalls=[];globalThis.fetch=async(url,options)=>{transportCalls.push({url,options});const body=JSON.parse(options.body);return new Response(JSON.stringify({embeddings:body.input.map(()=>[1,0])}),{status:200})}
 for(const endpoint of ['https://embedding.example.com/api/embed','https://192.168.1.20/api/embed','http://localhost:11434/api/embed','http://127.0.0.1:11434/api/embed','http://127.0.0.2:11434/api/embed','http://[::1]:11434/api/embed']){
  process.env.AWB_EMBEDDING_URL=endpoint;transportCalls=[]
  const result=await h.retrieveKnowledgeAsync(s,'内存不足',{scope:{projectId:'A'}})
  check('HTTPS及本机回环HTTP可用：'+endpoint,()=>{assert.equal(result.strategy,'hybrid-bm25-vector-rrf');assert.equal(transportCalls.length,1);assert.equal(transportCalls[0].options.headers.Authorization,'Bearer synthetic-transport-test-only');assert.equal(transportCalls[0].options.redirect,'error')})
 }
 for(const endpoint of ['http://embedding.example.com/api/embed','http://203.0.113.10:11434/api/embed','http://192.168.1.20/api/embed','http://localhost.example.com/api/embed','http://127.0.0.1.example.com/api/embed','http://[2001:db8::1]/api/embed','http://[::ffff:203.0.113.10]/api/embed']){
  process.env.AWB_EMBEDDING_URL=endpoint;transportCalls=[]
  const result=await h.retrieveKnowledgeAsync(s,'内存不足')
  check('远程HTTP在发送令牌与正文前阻断：'+endpoint,()=>{assert.equal(transportCalls.length,0);assert.equal(result.hits[0].documentId,'general');assert.match(result.note,/必须使用HTTPS/);assert.ok(!result.note.includes(process.env.AWB_EMBEDDING_TOKEN))})
 }
 for(const endpoint of ['http://localhost@embedding.example.com/api/embed','https://user:synthetic@example.com/api/embed','http://127.0.0.1:11434/api/embed?token=synthetic']){
  process.env.AWB_EMBEDDING_URL=endpoint;transportCalls=[]
  const result=await h.retrieveKnowledgeAsync(s,'内存不足')
  check('URL内凭据与查询参数继续拒绝：'+new URL(endpoint).hostname,()=>{assert.equal(transportCalls.length,0);assert.match(result.note,/地址格式无效/);assert.ok(!result.note.includes('synthetic'))})
 }
 }finally{globalThis.fetch=originalFetch;for(const [key,value] of Object.entries(embeddingEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value}}
 const corpus={...base,knowledge:Array.from({length:1000},(_,i)=>doc('perf-'+i,'项目规范文档。接口发布前验收，失败先回滚。'+i))};const began=performance.now();const perf=h.retrieveKnowledge(corpus,'接口发布验收');check('千条知识检索有界并保留结果',()=>{assert.ok(perf.hits.length<=5&&perf.hits.length>0);assert.ok(performance.now()-began<5000)});console.log('knowledge retrieval benchmark ms:',Math.round(performance.now()-began))
 const evaluation=JSON.parse(readFileSync('tests/fixtures/knowledge-evaluation.json','utf8'));const quality={...base,knowledge:evaluation.documents};let correct=0;for(const sample of evaluation.queries){const hits=h.retrieveKnowledge(quality,sample.query).hits;if(sample.expected?hits.some(h=>h.documentId===sample.expected):!hits.length)correct++;else console.log('evaluation miss',sample.query,hits.map(h=>h.documentId))};check('30条标注合成问题与无答案检索评测',()=>assert.equal(correct,30));console.log('retrieval evaluation: '+correct+'/30 synthetic cases');
 const pendingOnly=await api.assistantSend({text:'接口发布前如何验收',knowledgeMode:'only'});
 await build({entryPoints:[resolve('src/host.ts')],outfile:join(home,'fresh.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'});const fresh=await import(join(home,'fresh.mjs'));fresh.apply(ctx,{});
 check('热重载后仅知识库工具限制从持久记录恢复',()=>assert.match(guard({agent:{session:sessions.get(pendingOnly.sessionId)}}),/仅知识库/));await api.assistantDelta({sessionId:pendingOnly.sessionId,fromSeq:pendingOnly.fromSeq,retrievalId:pendingOnly.retrieval.id});check('恢复轮次结束后解除限制并持久记录完成',()=>assert.equal(guard({agent:{session:sessions.get(pendingOnly.sessionId)}}),undefined));
 console.log('knowledge-retrieval: '+checks+' checks passed')
}finally{disposers.forEach(d=>d());rmSync(home,{recursive:true,force:true})}
