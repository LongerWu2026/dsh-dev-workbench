/** Native archive uses a fake public registry; no user session is modified by this test. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-archive-'));process.env.DSH_HOME=home
await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export {mutateWorkbenchState,loadWorkbenchState} from './src/host/storage/state-store.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const host=await import(join(home,'host.mjs'));let api,checks=0;const disposers=[],services={},archived=[],calls=[]
const check=(name,fn)=>{fn();checks++;console.log('✓ '+name)}
host.apply({provide:(name,v)=>{if(name==='workbench')api=v},inject(){},get:name=>services[name],effect:fn=>{const d=fn();if(typeof d==='function')disposers.push(d)},logger:{info(){}}},{})
try{
 check('不支持的宿主明确报告，不伪造归档能力',()=>assert.equal(api.backgroundHistory instanceof Function,true))
 assert.equal((await api.backgroundHistory()).supported,false);checks++
 services.workspaceRegistry={get archivedSessionIds(){return archived},async archiveSession(id){calls.push(id);if(id==='fails')throw Error('模拟持久化失败');archived.push(id)}}
 services.sessions={get:id=>id==='live-busy'?{snapshotEvents:()=>[{type:'turn/start',seq:1}]}:null}
 services.sessionController={async state({sessionId:id}){if(id==='becomes-active')await host.mutateWorkbenchState(s=>{s.backgroundThreads.late={sessionId:id};return s});return {running:id==='cold-busy'}}}
 const known=['old','active','human','live-busy','cold-busy','becomes-active','fails']
 await host.mutateWorkbenchState(s=>{s.backgroundSessionIds=known;s.backgroundThreads={current:{sessionId:'active'}};s.settings.assistantSessionId='human';return s})
 await assert.rejects(api.archiveBackgroundHistory(['unrelated']),/只能归档/);checks++
 await assert.rejects(api.archiveBackgroundHistory(Array(21).fill('old')),/1–20/);checks++
 const result=await api.archiveBackgroundHistory(known)
 check('当前、人工、热运行、冷运行及等待中重新使用的会话都受保护',()=>{assert.equal(result.skipped,5);assert.deepEqual(calls,['old','fails'])})
 check('部分失败准确报告，成功条目的原日志仍由宿主管理',()=>{assert.equal(result.archived,1);assert.equal(result.failed,1);assert.deepEqual(archived,['old'])})
 const again=await api.archiveBackgroundHistory(['old']);check('已归档请求幂等，不重复调用宿主',()=>{assert.equal(again.skipped,1);assert.equal(calls.filter(id=>id==='old').length,1)})
 const page=await api.backgroundHistory({archived:true});check('归档记录仍可分页查阅且不冒充支持恢复侧栏',()=>{assert.equal(page.items[0].id,'old');assert.equal(page.canRestoreSidebar,false)})
 check('归档不删除工作台登记ID、不改变业务事项',()=>{assert.equal(host.loadWorkbenchState().backgroundSessionIds.length,known.length);assert.equal(host.loadWorkbenchState().tasks.length,0)})
 delete services.sessionController;const unknown=await api.archiveBackgroundHistory(['fails']);check('无法确认运行状态时不归档',()=>assert.equal(unknown.skipped,1))
 await host.mutateWorkbenchState(s=>{s.backgroundSessionIds.push('registry-cold','registry-running');return s})
 services.agents={get:id=>id==='registry-running'?{status:'running'}:undefined}
 const native=await api.archiveBackgroundHistory(['registry-cold','registry-running'])
 check('现代宿主通过 AgentRegistry 判断冷会话，无需不存在的 controller.state',()=>{assert.equal(native.archived,1);assert.ok(archived.includes('registry-cold'))})
 check('AgentRegistry 标记运行时不归档，即使没有历史事件',()=>{assert.equal(native.skipped,1);assert.ok(!calls.includes('registry-running'))})
 console.log('background-history: '+checks+' checks passed')
}finally{disposers.forEach(fn=>fn());rmSync(home,{recursive:true,force:true})}
