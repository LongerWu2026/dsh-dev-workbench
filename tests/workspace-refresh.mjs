import assert from 'node:assert/strict'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const dir=mkdtempSync(join(tmpdir(),'wb-refresh-'))
await build({entryPoints:['src/host/application/workspace-refresh.ts'],outfile:join(dir,'refresh.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const {createWorkspaceRefresh}=await import(join(dir,'refresh.mjs'))
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
function fixture(enabled=true){
 const calls=[],state={settings:{aiExtract:{enabled}},jobs:[],tasks:[{id:'manual',title:'人工编辑',humanGuard:true}],replies:[],analysisQueue:[{id:'done',status:'done'},{id:'failed',status:'failed',attempts:3}]}
 const dependencies={snapshot:()=>state,messages:async()=>{calls.push('messages');return{lastMentionsFetch:{status:'ok'}}},news:async()=>{calls.push('news');return{lastRadarFetch:{status:'ok'},jobs:state.jobs}},analysis:async(...args)=>{calls.push(['analysis',args]);state.jobs.push({id:'analysis',kind:'analysis',status:'queued'});return{jobId:'analysis'}}}
 return{state,calls,dependencies,coordinator:()=>createWorkspaceRefresh(dependencies)}
}
let count=0
const check=(label,fn)=>{fn();count++;console.log('✓ '+label)}
{
 const f=fixture(),before=structuredClone(f.state),c=f.coordinator(),first=c.start('all');await flush()
 check('全局刷新独立执行消息、日历入口与资讯，采集后排入增量识别',()=>{assert.equal(first.collecting,true);assert.deepEqual(f.calls.map(c=>Array.isArray(c)?c[0]:c).sort(),['analysis','messages','news']);assert.equal(c.status().steps.analysis.status,'queued');assert.equal(c.status().status,'running')})
 check('普通刷新不传强制重试参数，不改人工事项和历史识别',()=>{assert.deepEqual(f.calls.find(Array.isArray)[1],[]);assert.deepEqual(f.state.tasks,before.tasks);assert.deepEqual(f.state.analysisQueue,before.analysisQueue)})
 f.state.jobs[0].progress={processed:50,remaining:0,failed:0,batches:1};assert.equal(c.status().steps.analysis.progress.processed,50)
 f.state.jobs[0].status='completed'
 check('入队不当完成，实际后台作业完成后才报告刷新完成',()=>assert.equal(c.status().status,'completed'))
}
for(const scope of ['tasks','replies']){
 const f=fixture(),c=f.coordinator();c.start(scope);await flush()
 check(scope+'局部刷新不抓资讯，仍同步并统一分类待办和待回复',()=>{assert.ok(f.calls.includes('messages'));assert.ok(!f.calls.includes('news'));assert.ok(f.calls.some(Array.isArray));assert.equal(c.status().scope,scope)})
}
{
 const f=fixture(),g=gate();f.dependencies.messages=async()=>{f.calls.push('messages');await g.promise;return{lastMentionsFetch:{status:'ok'}}};const c=f.coordinator(),one=c.start('tasks'),two=c.start('replies'),three=c.start('all');c.start('all')
 check('同时点击局部和全局共享同一轮，局部可升级全局且不重复采集',()=>{assert.equal(one.id,two.id);assert.equal(two.id,three.id);assert.equal(three.scope,'all');assert.equal(f.calls.filter(c=>c==='messages').length,1);assert.equal(f.calls.filter(c=>c==='news').length,1)})
 g.resolve();await flush();assert.equal(c.status().collecting,false)
}
{
 const f=fixture();f.dependencies.messages=async()=>{throw Error('消息限流')};const c=f.coordinator();c.start('all');await flush()
 check('消息失败仍更新资讯并识别既有合格队列，错误独立展示',()=>{assert.equal(c.status().steps.messages.status,'failed');assert.match(c.status().steps.messages.note,/限流/);assert.ok(f.calls.includes('news'));assert.equal(c.status().steps.analysis.status,'queued')})
 f.state.jobs[0]={...f.state.jobs[0],status:'queued',nextRetryAt:'2999-01-01',error:'模型限流'}
 check('模型冷却明确等待重试，不能把刷新标成功',()=>{assert.equal(c.status().steps.analysis.status,'paused');assert.equal(c.status().status,'partial')})
 f.state.jobs[0].status='running';assert.equal(c.status().status,'running')
 f.state.jobs[0].status='completed';f.state.jobs[0].result={status:'partial',failures:1,note:'解析失败'}
 check('作业部分失败不假报成功',()=>assert.equal(c.status().steps.analysis.status,'partial'))
}
{
 const f=fixture(false),c=f.coordinator();c.start('all');await flush()
 check('未开启AI仍刷新数据，明确未识别，不偷偷开启AI',()=>{assert.equal(c.status().steps.analysis.status,'disabled');assert.equal(c.status().status,'partial');assert.ok(!f.calls.some(Array.isArray));assert.equal(f.state.settings.aiExtract.enabled,false)})
 assert.throws(()=>c.start('invalid'),/范围/)
}
{
 const f=fixture();f.dependencies.news=async()=>{f.state.jobs.push({id:'summary',kind:'summary',status:'running'});return{lastRadarFetch:{status:'partial',note:'部分网页失效'},jobs:f.state.jobs}};const c=f.coordinator();c.start('all');await flush()
 check('资讯抓取和摘要单独跟踪，失效页面反馈不遮盖消息状态',()=>{assert.equal(c.status().steps.news.status,'partial');assert.equal(c.status().steps.summary.jobId,'summary');assert.equal(c.status().steps.summary.status,'running')})
 f.state.jobs.find(j=>j.id==='summary').status='failed';assert.equal(c.status().steps.summary.status,'failed')
}
{
 const f=fixture();f.state.modelHealth={summary:{blocked:true,note:'历史 reasoning_content 不兼容，摘要待恢复'}}
 f.dependencies.news=async()=>({...f.state,lastRadarFetch:{status:'ok',added:0}})
 const c=f.coordinator();c.start('all');await flush();f.state.jobs[0].status='completed'
 check('没有新资讯时仍展示摘要暂停，刷新不能隐藏旧兼容故障或假报全部完成',()=>{assert.equal(c.status().steps.summary.status,'paused');assert.match(c.status().steps.summary.note,/reasoning_content/);assert.equal(c.status().status,'partial');assert.equal(f.state.modelHealth.summary.blocked,true)})
}
console.log('workspace refresh: '+count+' checks passed (isolated fixtures; no cloud or model requests)')
