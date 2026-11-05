/** Slow/cold native-session fixtures; no real accounts, models or task mutations. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-hub-loading-'));process.env.DSH_HOME=home
try{
 await build({stdin:{contents:`export {assistantHub as hub} from './src/host/assistant/hub.ts';export {mutateWorkbenchState as mutate,loadWorkbenchState as state} from './src/host/storage/state-store.ts';export {rememberHubSession} from './src/host/assistant/hub-store.ts';export {HUB_READ_TIMEOUT_MS} from './src/host/assistant/hub-read.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const host=await import(join(home,'host.mjs')),sessions=new Map(),restores=[],held=new Map();let count=0
 const check=(label,fn)=>{fn();count++;console.log('✓ '+label)}
 function native(id,text,{active=false}={}){const events=[{type:'turn/start',data:{}},{type:'user/message',data:{content:[{type:'text',text:'历史输入'}]}},{type:'assistant/message',data:{message:{content:[{type:'text',text}]}}},...(!active?[{type:'turn/end',data:{reason:{kind:'completed'}}}]:[])].map((row,i)=>({...row,seq:i+1,time:Date.now()+i}));return {id,seq:events.length,header:{createdAt:Date.now()},snapshotEvents:(from=0)=>events.filter(row=>row.seq>from)}}
 const ready=native('ready','可正常读取的后台结果'),slow=native('slow','稍后恢复的旧记录'),running=native('running','执行中的已有输出',{active:true})
 sessions.set(running.id,running)
 const controller={resolveAgent(id){restores.push(id);if(id==='ready'){sessions.set(id,ready);return {agent:{session:ready}}}if(id==='missing')throw Error('测试历史不存在');return new Promise(resolve=>held.set(id,row=>{sessions.set(id,row);resolve({agent:{session:row}})}))},prompt(){assert.fail('读取不能启动模型')},create(){assert.fail('读取不能创建替代会话')},cancel(){assert.fail('读取不能停止运行中的任务')}}
 const ctx={get:key=>({sessionController:controller,sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]},workspaceRegistry:{list:()=>[]}})[key]},hub=request=>host.hub(ctx,request)
 await host.mutate(state=>{state.backgroundThreads={slow:{purpose:'summary',sessionId:slow.id},ready:{purpose:'summary',sessionId:ready.id},running:{purpose:'summary',sessionId:running.id}};return state})
 const before=JSON.stringify(host.state()),start=Date.now(),first=hub({action:'detail',conversationId:'system:radar'}),second=hub({action:'detail',conversationId:'system:radar'})
 await new Promise(resolve=>setTimeout(resolve,20))
 check('先前旧会话悬空时，后面的冷会话仍独立开始恢复',()=>assert.ok(restores.includes('ready')))
 const listed=await Promise.race([hub({action:'list'}),new Promise((_,reject)=>setTimeout(()=>reject(Error('目录被会话阻塞')),250))])
 check('会话恢复未结束时目录独立返回',()=>assert.equal(listed.status,'ok'))
 const [a,b]=await Promise.all([first,second])
 check('多个慢会话不会累加等待，返回可用内容与局部待加载提示',()=>{assert.ok(Date.now()-start<host.HUB_READ_TIMEOUT_MS+1200);assert.equal(a.status,'ok');assert.ok(a.background.messages.some(row=>row.text==='可正常读取的后台结果'));assert.ok(a.background.messages.some(row=>row.text==='执行中的已有输出'));assert.equal(a.background.turnActive,true);assert.equal(a.background.errors[0].pending,true);assert.equal(b.background.errors[0].sessionId,'slow')})
 check('并发刷新共享未完成的恢复，未重复请求同一原生会话',()=>assert.equal(restores.filter(id=>id==='slow').length,1))
 held.get('slow')(slow);await new Promise(resolve=>setTimeout(resolve,0))
 const later=await hub({action:'detail',conversationId:'system:radar'})
 check('慢会话最终返回后自动补齐原历史，身份和seq不重复',()=>{assert.ok(later.background.messages.some(row=>row.text==='稍后恢复的旧记录'));assert.equal(later.background.errors.length,0);assert.equal(new Set(later.background.messages.map(row=>row.id)).size,later.background.messages.length);assert.equal(restores.filter(id=>id==='slow').length,1)})
 await host.mutate(state=>{state.backgroundThreads.missing={purpose:'summary',sessionId:'missing'};return state})
 const partial=await hub({action:'detail',conversationId:'system:radar'})
 check('单个历史失败不丢掉其他会话的已有内容',()=>{assert.ok(partial.background.messages.some(row=>row.sessionId==='ready'));assert.match(partial.background.errors[0].note,/测试历史不存在/)})
 host.rememberHubSession('chat:primary','primary','正在恢复的主会话')
 const reads=await Promise.all([hub({action:'detail',conversationId:'chat:primary'}),hub({action:'detail',conversationId:'chat:primary'})])
 check('主会话读取也有局部截止与合并，不把未读历史当空会话继续发送',()=>{assert.ok(reads.every(row=>row.status==='ok'&&/仍在读取/.test(row.historyError)&&row.nativeBinding.canSend===false));assert.equal(restores.filter(id=>id==='primary').length,1)})
 held.get('primary')(native('primary','原主会话的历史'));await new Promise(resolve=>setTimeout(resolve,0))
 const recovered=await hub({action:'detail',conversationId:'chat:primary'})
 check('主会话恢复后仍是原生id，读取期间无新任务或业务进度改变',()=>{assert.equal(recovered.sessionId,'primary');assert.equal(recovered.historyError,undefined);assert.equal(recovered.messages.at(-1).text,'原主会话的历史');assert.deepEqual(host.state().jobs,JSON.parse(before).jobs);assert.deepEqual(host.state().analysisQueue,JSON.parse(before).analysisQueue)})
 const heavyThreads={}
 for(let i=0;i<40;i++){
  const session=native('long-background-'+i,'原有后台结果 '+i),snapshot=session.snapshotEvents
  session.snapshotEvents=(from=0)=>{const until=performance.now()+12;while(performance.now()<until){};return snapshot(from)}
  sessions.set(session.id,session);heavyThreads[i]={purpose:'summary',sessionId:session.id}
 }
 await host.mutate(state=>{state.backgroundThreads=heavyThreads;state.settings.summarySessionId=null;return state})
 const busyStart=performance.now(),projecting=hub({action:'detail',conversationId:'system:radar',limit:200})
 // This must run from another event-loop turn, like a later incoming RPC.
 // Racing two already-constructed promises misses synchronous Host starvation.
 await new Promise(resolve=>setTimeout(resolve,0))
 const responsive=await hub({action:'list'}),directoryMs=performance.now()-busyStart
 check('大量已加载历史正在同步投影时，新到达的目录请求也能及时返回',()=>{assert.equal(responsive.status,'ok');assert.ok(directoryMs<250,'directory blocked '+directoryMs+'ms')})
 const complete=await projecting
 check('分批处理后仍返回全部原有后台记录，不丢历史或重跑任务',()=>{assert.ok(complete.background.messages.filter(row=>row.role==='assistant'&&row.sessionId.startsWith('long-background-')).length===40);assert.equal(new Set(complete.background.messages.map(row=>row.id)).size,complete.background.messages.length);assert.deepEqual(host.state().jobs,JSON.parse(before).jobs)})
 console.log('busy-history directory latency: '+Math.round(directoryMs)+'ms')
 console.log('assistant-hub-loading: '+count+' scenarios passed')
}finally{rmSync(home,{recursive:true,force:true})}
