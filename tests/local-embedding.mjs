import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-embedding-boundary-'));process.env.DSH_HOME=home
await build({stdin:{contents:`export * from './src/host/knowledge/local-embedding.ts';export {EMBEDDING_MANIFEST} from './src/host/knowledge/embedding-manifest.ts';export {retrieveKnowledgeAsync} from './src/host/knowledge/semantic.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const h=await import(join(home,'host.mjs')),dispose=h.activateLocalEmbedding(),originalFetch=globalThis.fetch;let calls=0,checks=0
const check=(name,fn)=>{fn();checks++;console.log('✓ '+name)},waitPhase=async phase=>{for(let n=0;n<100;n++){const status=await h.localEmbeddingStatus();if(status.phase===phase)return status;await new Promise(resolve=>setTimeout(resolve,10))}throw Error('phase timeout: '+phase)}
try{
 const initial=await h.localEmbeddingStatus();check('默认不启用不下载且没有Worker',()=>{assert.equal(initial.enabled,false);assert.equal(initial.installed,false);assert.equal(initial.workerActive,false)})
 check('仅分发固定版本且所有资源都有大小和SHA256',()=>{assert.equal(h.EMBEDDING_MANIFEST.files.length,8);assert.ok(h.EMBEDDING_MANIFEST.files.every(file=>file.url.startsWith('https://')&&/^[a-f0-9]{64}$/.test(file.sha256)&&file.bytes>0));assert.ok(initial.totalBytes<50_000_000)})
 check('拒绝非法维度、NaN、零向量与非数值向量',()=>{for(const vector of [[],[1],Array(512).fill(0),Array(512).fill(NaN),Array(512).fill('1')])assert.equal(h.validEmbedding(vector),false);assert.equal(h.validEmbedding(Array(512).fill(.1)),true)})
 await assert.rejects(()=>h.localEmbeddingVectors([{id:'q',text:'未启用'}],true),/未启用/);checks++
 await h.configureLocalEmbedding(true);globalThis.fetch=async()=>{calls++;return new Response('untrusted executable',{status:200})};h.prepareLocalEmbedding();h.prepareLocalEmbedding();let status=await waitPhase('error')
 check('重复准备共用一个任务，未通过完整性校验的运行时代码不安装',()=>{assert.equal(calls,1);assert.match(status.note,/校验/);assert.equal(status.installed,false);assert.equal(status.workerActive,false)})
 globalThis.fetch=async()=>new Response(new Uint8Array(h.EMBEDDING_MANIFEST.files[0].bytes+1));h.prepareLocalEmbedding();status=await waitPhase('error');check('响应超出声明大小时立即中断',()=>assert.match(status.note,/大小不匹配/))
 const fixture={settings:{},projects:[],knowledge:[{id:'fixture',title:'发布验收',body:'接口发布之前必须灰度验收',reviewState:'confirmed'}]}
 const fallback=await h.retrieveKnowledgeAsync(fixture,'接口发布灰度验收')
 check('模型未就绪时保留关键词命中并显式说明降级',()=>{assert.equal(fallback.status,'ok');assert.equal(fallback.hits[0].documentId,'fixture');assert.match(fallback.note,/保留关键词检索/)})
 globalThis.fetch=async(_url,{signal})=>{calls++;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))};h.prepareLocalEmbedding();await waitPhase('downloading');await h.configureLocalEmbedding(false);status=await waitPhase('idle');check('停用中止下载，退出后不残留Worker',()=>{assert.equal(status.enabled,false);assert.equal(status.workerActive,false)})
 const saved=JSON.parse(readFileSync(join(home,'storages/dev-workbench/knowledge-engine/config.json'),'utf8'));check('启用选择持久化且不写入业务正文',()=>assert.deepEqual(saved,{enabled:false}))
 console.log('local-embedding: '+checks+' checks passed; no model download or account access')
}finally{globalThis.fetch=originalFetch;dispose();rmSync(home,{recursive:true,force:true})}
