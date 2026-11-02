import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'news-overview-'));process.env.DSH_HOME=home
try{
 const outfile=join(home,'fixture.mjs');await build({stdin:{contents:`export * from './src/host/news/batch-overview.ts';export {mutateWorkbenchState as mutate,loadWorkbenchState as state} from './src/host/storage/state-store.ts';export {normalizeState} from './src/host/domain/model.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile,bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(outfile),at=new Date().toISOString(),session={id:'original-summary-session',workbenchThreadKey:'same-thread'};let calls=0
 await h.mutate(s=>{s.radar=[{id:'a',title:'模型推理能力更新',url:'https://example.test/a',summary:{change:'推理能力更新'}},{id:'b',title:'智能体工程更新',url:'https://example.test/b',excerpt:'长任务恢复的新进展'},{id:'older',title:'上批内容',url:'https://example.test/older',summary:{change:'不应混入新批次'}}];s.radarBrief={at,ids:['a','b'],status:'pending'};return s})
 const overview='这一批资讯主要围绕模型推理和智能体工程展开，既有复杂任务处理能力的更新，也有长任务恢复方面的新进展。'
 const reply=async(_ctx,_controller,actual,prompt)=>{calls++;assert.equal(actual,session);const packet=JSON.parse(prompt.split('\n').at(-1));assert.deepEqual(packet.articles.map(row=>row.id),['a','b']);assert.match(prompt,/不是逐条摘要/);assert.ok(!prompt.includes('不应混入新批次'));return {overview}}
 await h.summarizeNewsBatch({}, {},session,{},reply);assert.equal(calls,1);assert.equal(h.state().radarBrief.overview,overview);assert.equal(h.state().radarBrief.status,'done');await h.summarizeNewsBatch({}, {},session,{},reply);assert.equal(calls,1)
 const persisted=JSON.parse(readFileSync(join(home,'storages/dev-workbench/state.json'),'utf8'));assert.equal(h.normalizeState(persisted).state.radarBrief.overview,overview)
 await h.mutate(s=>{s.radarBrief={at:at+'-next',ids:['a'],status:'pending'};return s});await h.summarizeNewsBatch({}, {},session,{},async()=>({overview:''}));assert.equal(h.state().radarBrief.status,'failed');assert.ok(h.state().radarBrief.error)
 await h.mutate(s=>{s.radarBrief={at,ids:['a'],status:'pending'};return s});let release;const pending=h.summarizeNewsBatch({}, {},session,{},()=>new Promise(done=>{release=done}));while(!release)await new Promise(done=>setTimeout(done,0));await h.mutate(s=>{s.radarBrief={at:'next-batch',ids:['b'],status:'pending'};return s});release({overview:'这是前一批晚到的总结'});await pending;assert.equal(h.state().radarBrief.at,'next-batch');assert.equal(h.state().radarBrief.overview,undefined)
 console.log('news-batch-overview: one response per batch, exact scope, original session, no repeat, persistence, invalid result and stale response isolation passed')
}finally{rmSync(home,{recursive:true,force:true})}
