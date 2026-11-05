/** Controlled I/O only: never contacts a website or modifies a real profile. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-article-read-'));process.env.DSH_HOME=home
let count=0
const check=(name,fn)=>{fn();count++;console.log('✓ '+name)}
try{
 await build({stdin:{contents:`export * from './src/host/news/article-read.ts';export {readRadarArticle} from './src/host/news/article.ts';export {mutateWorkbenchState,loadWorkbenchState} from './src/host/storage/state-store.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'controlled-article-transport',setup(builder){builder.onLoad({filter:/article-transport\.ts$/},()=>({contents:'export const fetchPublicArticle=(url,signal)=>globalThis.__testArticleTransport(url,signal)',loader:'ts'}))}}]})
 const h=await import(join(home,'host.mjs'))
 let backupCalls=0
 const fast=await h.readArticleWithFallback(async()=> 'preferred',async()=>{backupCalls++;return 'backup'},{fallbackDelay:20,timeout:200})
 await new Promise(resolve=>setTimeout(resolve,30))
 check('首选快速成功时不启动备用读取',()=>{assert.equal(fast,'preferred');assert.equal(backupCalls,0)})
 let slowSignal
 const start=performance.now(),fallback=await h.readArticleWithFallback(signal=>{slowSignal=signal;return new Promise(()=>{})},async()=> 'usable backup',{fallbackDelay:10,timeout:200})
 const fallbackMs=performance.now()-start
 check('首选不响应且忽略取消时，备用读取独立返回并取消未完成请求',()=>{assert.equal(fallback,'usable backup');assert.equal(slowSignal.aborted,true);assert.ok(fallbackMs<500)})
 const quick=await h.readArticleWithFallback(async()=>{throw Error('primary failed')},async()=> 'recovered',{fallbackDelay:1000,timeout:200})
 check('首选明确失败立即尝试备用，不额外等待延迟',()=>assert.equal(quick,'recovered'))
 await assert.rejects(h.readArticleWithFallback(()=>new Promise(()=>{}),()=>new Promise(()=>{}),{fallbackDelay:5,timeout:30}),/读取超时/);count++
 await assert.rejects(h.readArticleWithFallback(async()=>{throw Error('首选错误')},async()=>{throw Error('备用错误')}),/首选错误.*备用错误/);count++
 const text='合成原文，完整包含使用方式、部署步骤和最终结论。'.repeat(12)
 let providerCalls=0,directCalls=0,releaseProvider,mode='slow'
 const ctx={get:name=>name==='web'?{fetch:async()=>{providerCalls++;if(mode==='failed')throw Error('合成首选读取失败');if(mode==='short')return {statusCode:200,body:{content:'只有导航'}};return new Promise(resolve=>{releaseProvider=resolve})}}:undefined}
 globalThis.__testArticleTransport=async()=>{directCalls++;if(mode==='failed')throw Error('合成备用读取失败');return {statusCode:200,body:{content:text}}}
 await h.mutateWorkbenchState(state=>{state.radar=[{id:'slow',title:'慢通道验收',url:'https://example.invalid/slow'},{id:'short',title:'短正文验收',url:'https://example.invalid/short'}];return state})
 const liveStart=performance.now(),[a,b]=await Promise.all([h.readRadarArticle(ctx,'slow'),h.readRadarArticle(ctx,'slow')]),elapsed=performance.now()-liveStart
 check('真实资讯读取链路合并并发，慢首选由备用取得完整正文',()=>{assert.equal(a.body,text);assert.equal(b.contentRef.hash,a.contentRef.hash);assert.equal(providerCalls,1);assert.equal(directCalls,1);assert.ok(elapsed<3000)})
 releaseProvider({statusCode:200,body:{content:'首选迟到内容。'.repeat(30)}});await new Promise(resolve=>setTimeout(resolve,0))
 const cached=await h.readRadarArticle(ctx,'slow')
 check('迟到回包不覆盖已采用正文，再次打开直接读本地快照',()=>{assert.equal(cached.body,text);assert.equal(cached.cached,true);assert.equal(providerCalls,1);assert.equal(directCalls,1)})
 mode='short';const recovered=await h.readRadarArticle(ctx,'short')
 check('HTTP成功但正文不足也切备用，不将导航当成文章',()=>{assert.equal(recovered.body,text);assert.equal(directCalls,2)})
 mode='failed';const prior=h.loadWorkbenchState().radar[0].article.contentRef.hash
 await assert.rejects(h.readRadarArticle(ctx,'slow',true),/原文读取失败/)
 check('双通道失败重读保留旧快照，不重复任务或知识条目',()=>{assert.equal(h.loadWorkbenchState().radar[0].article.contentRef.hash,prior);assert.equal(h.loadWorkbenchState().jobs.length,0);assert.equal(h.loadWorkbenchState().knowledge.length,0)})
 console.log(JSON.stringify({test:'article-read',checks:count,controlledFallbackMs:Math.round(fallbackMs),fullReadFallbackMs:Math.round(elapsed)}))
}finally{delete globalThis.__testArticleTransport;rmSync(home,{recursive:true,force:true})}
