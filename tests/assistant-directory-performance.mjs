/** Count directory I/O and native metadata reads; temporary business data only. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {syncBuiltinESMExports} from 'node:module'
import {tmpdir} from 'node:os'
import {join,resolve,basename} from 'node:path'
import {build} from 'esbuild'
const home=fs.mkdtempSync(join(tmpdir(),'wb-directory-performance-'));process.env.DSH_HOME=home
const originalRead=fs.readFileSync
try{
 await build({stdin:{contents:`export {assistantHub} from './src/host/assistant/hub.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';export {rememberHubSession} from './src/host/assistant/hub-store.ts';export {saveDevelopmentTask} from './src/host/storage/development-store.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'fixture.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(join(home,'fixture.mjs')),sessions=new Map(),reads=new Map(),nativeReads=new Map();let count=0
 const check=(label,fn)=>{fn();count++;console.log('✓ '+label)}
 function native(id,title){const events=[{type:'session/title',time:1,data:{title},seq:1},{type:'turn/start',time:2,data:{},seq:2},{type:'user/message',time:3,data:{source:{kind:'user'},content:[{type:'text',text:'实际用户问题'}]},seq:3},...Array.from({length:2000},(_,i)=>({seq:i+4,type:'tool/result',time:i+4,data:{content:'PRIVATE_TOOL_BODY'}})),{type:'turn/end',seq:2004,time:2004,data:{}}],session={id,header:{cwd:home,createdAt:1},get seq(){return events.length},snapshotEvents(){nativeReads.set(id,(nativeReads.get(id)||0)+1);return events},append(type,data){events.push({type,data,seq:events.length+1,time:Date.now()})}};sessions.set(id,session);return session}
 for(let i=0;i<30;i++){h.saveDevelopmentTask({id:'development-'+i,issue:{id:'issue-'+i,code:'US-'+i,title:'研发 '+i},cwd:home,sessionId:'dev-native-'+i,status:'paused',stage:'analysis',steps:[{output:'large development evidence '.repeat(4000)}]});native('dev-native-'+i,'研发原会话 '+i)}
 for(let i=0;i<40;i++){const session=native('chat-native-'+i,'原生标题 '+i);h.rememberHubSession('chat:'+session.id,session.id,'过时的索引标题')}
 const ctx={get:key=>key==='sessions'?{get:id=>sessions.get(id),list(){assert.fail('目录不能枚举未接入的原生会话')}}:key==='workspaceRegistry'?{list:()=>[{id:'workspace',path:home,title:'工程',sessionIds:[...sessions.keys()]}],archivedSessionIds:[]}:undefined}
 fs.writeFileSync(join(home,'storages/dev-workbench/assistant-task-threads.json'),JSON.stringify({version:1,tasks:[]}))
 const state=h.loadWorkbenchState(),before=JSON.stringify(state)
 fs.readFileSync=function(path,...args){reads.set(String(path),(reads.get(String(path))||0)+1);return originalRead.call(this,path,...args)};syncBuiltinESMExports()
 const start=performance.now(),first=await h.assistantHub(ctx,{action:'list'}),duration=performance.now()-start
 check('目录中的每份研发文档只读取一次，不随会话数量重复读取',()=>{assert.equal(first.status,'ok');const documents=[...reads].filter(([path])=>path.includes('/development/tasks/'));assert.equal(documents.length,30);assert.ok(documents.every(([,calls])=>calls===1));assert.equal([...reads].filter(([path])=>basename(path)==='assistant-task-threads.json').reduce((n,[,calls])=>n+calls,0),1)})
 check('同一原生事件截面只读取一次元数据，不构造工具输出或助手正文',()=>{assert.equal(nativeReads.size,70);assert.ok([...nativeReads.values()].every(calls=>calls===1));assert.ok(!JSON.stringify(first).includes('PRIVATE_TOOL_BODY'));assert.equal(first.conversations.find(row=>row.id==='chat:chat-native-0').title,'原生标题 0')})
 nativeReads.clear();reads.clear();await h.assistantHub(ctx,{action:'list'})
 check('连续刷新复用未变化的原生元数据，不重复扫描完整会话',()=>assert.equal(nativeReads.size,0))
 const changed=sessions.get('chat-native-0');changed.append('session/title',{title:'原生重命名后的标题'});const renamed=await h.assistantHub(ctx,{action:'list'})
 check('原生重命名按事件序号更新，不用旧缓存覆盖新标题',()=>{assert.equal(renamed.conversations.find(row=>row.id==='chat:chat-native-0').title,'原生重命名后的标题');assert.deepEqual([...nativeReads.keys()],['chat-native-0'])})
 const dev=sessions.get('dev-native-0');dev.append('turn/start',{});const running=await h.assistantHub(ctx,{action:'list'});assert.equal(running.conversations.find(row=>row.id==='development:development-0').nativeBinding.canSend,false);dev.append('turn/end',{});const ended=await h.assistantHub(ctx,{action:'list'})
 check('运行中原生研发会话仍禁止发送，结束事件到达后及时解除',()=>assert.equal(ended.conversations.find(row=>row.id==='development:development-0').nativeBinding.canSend,true))
 check('所有目录读取均不修改业务状态或会话归属',()=>assert.equal(JSON.stringify(h.loadWorkbenchState()),before))
 console.log(JSON.stringify({test:'assistant-directory-performance',checks:count,conversations:first.conversations.length,developmentFiles:30,nativeSessions:70,firstListMs:duration}))
}finally{fs.readFileSync=originalRead;syncBuiltinESMExports();fs.rmSync(home,{recursive:true,force:true})}
