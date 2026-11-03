/** Explicit real-model acceptance: run with --download (about 47 MB), or --assets DIR for pinned offline files. */
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,cpSync,readFileSync,writeFileSync,rmSync,readdirSync,statSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {build} from 'esbuild'
if(!process.argv.includes('--download')&&!process.argv.includes('--assets'))throw Error('Specify --download or --assets DIR')
const home=mkdtempSync(join(tmpdir(),'workbench-local-embedding-live-'));process.env.DSH_HOME=home
await build({stdin:{contents:`export * from './src/host/knowledge/local-embedding.ts';export * from './src/host/knowledge/semantic.ts';export {knowledgeService} from './src/host/application/knowledge-service.ts';export {knowledgeEngine} from './src/host/knowledge/engine.ts';export {mutateWorkbenchState} from './src/host/storage/state-store.ts';export {EMBEDDING_MANIFEST} from './src/host/knowledge/embedding-manifest.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'engine.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
mkdirSync(join(home,'bin'));cpSync('bin/knowledge-embedding-worker.mjs',join(home,'bin/knowledge-embedding-worker.mjs'))
const h=await import(join(home,'engine.mjs')),dispose=h.activateLocalEmbedding(),manifest=h.EMBEDDING_MANIFEST,checks=[]
const check=(name,fn)=>{fn();checks.push(name);console.log('✓ '+name)}
try{
 const assetsIndex=process.argv.indexOf('--assets')
 if(assetsIndex>=0){const assets=resolve(process.argv[assetsIndex+1]);for(const file of manifest.files){const dest=join(home,'storages/dev-workbench/knowledge-engine',manifest.id,file.path);mkdirSync(join(dest,'..'),{recursive:true});cpSync(join(assets,file.path),dest)}}
 await h.configureLocalEmbedding(true);h.prepareLocalEmbedding()
 const until=Date.now()+240000;let status
 do{await new Promise(resolve=>setTimeout(resolve,250));status=await h.localEmbeddingStatus();if(status.phase==='error')throw Error(status.note)}while(status.phase!=='ready'&&Date.now()<until)
 check('官方固定版本下载、大小与SHA256校验完成',()=>{assert.equal(status.phase,'ready');assert.equal(status.downloaded,status.totalBytes);assert.equal(status.installed,true)})
 const before=performance.now(),texts=[{id:'same-topic',text:'数据库无法连接时检查网络、防火墙与连接池设置。'},{id:'other-topic',text:'今天午饭吃牛肉面，天气晴朗。'}]
 const vectors=await h.localEmbeddingVectors(texts),query=(await h.localEmbeddingVectors([{id:'query',text:'应用连接不上数据库怎么办？'}],true))[0],cosine=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0)/(Math.hypot(...a)*Math.hypot(...b))
 check('真实INT8模型输出512维有限数值',()=>{assert.equal(vectors.length,2);assert.ok(vectors.every(h.validEmbedding))})
 check('同义问题与相关业务文本比无关文本更接近',()=>assert.ok(cosine(query,vectors[0])>cosine(query,vectors[1])))
 const beforeReuse=(await h.localEmbeddingStatus()).computed;await h.localEmbeddingVectors(texts)
 let reused=await h.localEmbeddingStatus();check('同版本正文复用持久化向量',()=>{assert.equal(beforeReuse,2);assert.equal(reused.computed,2);assert.ok(reused.reused>=2)})
 await h.localEmbeddingVectors([{...texts[0],text:texts[0].text+'修改后先检查DNS解析。'}])
 reused=await h.localEmbeddingStatus();check('正文更新只新增计算变更片段',()=>assert.equal(reused.computed,3))
 await assert.rejects(()=>h.localEmbeddingVectors(Array.from({length:9},(_,index)=>({id:'pending-'+index,text:'未索引资料 '+index})),false,{maxMissing:8}),/尚未完成索引/);check('首次大批未索引资料不在提问中长时间重建',()=>assert.equal((reused.computed),3))
 const sourceDoc=(id,spaceId,body)=>({id,title:'业务说明',spaceId,body,reviewState:'confirmed'}),state={settings:{},projects:[],knowledgeSpaces:[{id:'company',name:'公司资料'},{id:'client',name:'客户资料'}],knowledge:[sourceDoc('one','company',texts[0].text),sourceDoc('two','client','客户机密：数据库连接使用客户专属网络。'),sourceDoc('three','company',texts[1].text)]}
 const hybrid=await h.retrieveKnowledgeAsync(state,'数据库连接不上如何排查',{scope:{spaceId:'company'}})
 check('真实混合RAG仅返回当前空间并带原文引用',()=>{assert.equal(hybrid.strategy,'local-hybrid-bm25-bge-rrf');assert.ok(hybrid.hits.some(hit=>hit.documentId==='one'));assert.ok(hybrid.hits.every(hit=>hit.documentId!=='two'));assert.ok(hybrid.hits.every(hit=>hit.id.includes('@')&&hit.lineStart>0))})
 await h.mutateWorkbenchState(state=>({...state,knowledgeSpaces:[{id:'company',name:'公司资料'}],knowledge:[]}))
 const beforeBackground=(await h.localEmbeddingStatus()).computed
 const created=await h.knowledgeService.createKnowledge({title:'自动索引',body:'接口上线之前先确认数据库可连接。',spaceId:'company',reviewState:'confirmed'})
 async function waitIndex(computed){for(let i=0;i<200;i++){const engine=await h.knowledgeEngine({});if(engine.index.phase==='ready'&&engine.computed>=computed)return engine;await new Promise(resolve=>setTimeout(resolve,25))}throw Error('background index timeout')}
 let background=await waitIndex(beforeBackground+1);check('新增已确认资料自动在后台建立索引',()=>{assert.equal(background.index.processed,1);assert.equal(background.index.scope.spaceId,'company')})
 await h.knowledgeService.updateKnowledge(created.knowledge[0].id,{body:'接口上线之前先确认数据库和DNS可连接。',reviewState:'confirmed'})
 background=await waitIndex(beforeBackground+2);check('编辑资料自动增量索引，不要求用户手动重建',()=>assert.equal(background.computed,beforeBackground+2))
 await new Promise(resolve=>setTimeout(resolve,16000));const idleStatus=await h.localEmbeddingStatus();check('空闲15秒自动释放Worker',()=>assert.equal(idleStatus.workerActive,false))
 const childScript=join(home,'restart.mjs');writeFileSync(childScript,`import assert from 'node:assert/strict';import * as h from './engine.mjs';globalThis.fetch=async()=>{throw Error('Restart must not access network')};const dispose=h.activateLocalEmbedding();try{const status=await h.localEmbeddingStatus();assert.equal(status.enabled,true);assert.equal(status.installed,true);const vectors=await h.localEmbeddingVectors(${JSON.stringify(texts)});assert.equal(vectors.length,2);assert.equal((await h.localEmbeddingStatus()).computed,0);assert.equal((await h.localEmbeddingStatus()).reused,2);await h.localEmbeddingVectors([{id:'offline-query',text:'服务器连不上数据库'}],true);console.log(JSON.stringify({restart:true,offline:true,persistentReuse:2,computed:0,workerActive:(await h.localEmbeddingStatus()).workerActive}))}finally{dispose()}`)
 const child=spawnSync(process.execPath,[childScript],{env:{...process.env,DSH_HOME:home},encoding:'utf8',timeout:120000})
 check('独立进程重启、断网、持久索引与本地查询推理通过',()=>assert.equal(child.status,0,child.stderr));console.log(child.stdout.trim())
 await h.configureLocalEmbedding(false);status=await h.localEmbeddingStatus();check('停用后保留模型索引且不占用Worker',()=>{assert.equal(status.enabled,false);assert.equal(status.workerActive,false);assert.equal(status.installed,true)})
 await assert.rejects(()=>h.localEmbeddingVectors(texts),/未启用/)
 const vectorDir=join(home,'storages/dev-workbench/knowledge-engine',manifest.id,'vectors');check('持久向量使用紧凑Float32文件，每片段2048字节',()=>{const files=readdirSync(vectorDir);assert.ok(files.length>0);assert.ok(files.every(file=>file.endsWith('.f32')&&statSync(join(vectorDir,file)).size===2048))})
 console.log(JSON.stringify({checks:checks.length,modelBytes:manifest.files.filter(f=>f.path.startsWith('models')).reduce((n,f)=>n+f.bytes,0),totalBytes:status.totalBytes,firstRunMs:Math.round(performance.now()-before),rssPeakReported:status.lastRss,similarityRelevant:cosine(query,vectors[0]),similarityIrrelevant:cosine(query,vectors[1]),status:'passed'}))
}finally{dispose();rmSync(home,{recursive:true,force:true})}
