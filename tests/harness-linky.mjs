/** Real adapter process + deterministic ACP transport peer. Never invokes Codex or a business daemon. */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync,rmSync,readdirSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
const home=mkdtempSync(join(tmpdir(),'harness-linky-')),cwd=join(home,'workdir');mkdirSync(cwd)
const fixture=join(home,'acp.mjs'),configPath=join(home,'config.json'),received=join(home,'received.jsonl')
writeFileSync(fixture,`import {createInterface} from 'node:readline';import fs from 'node:fs';const input=createInterface({input:process.stdin});const send=p=>console.log(JSON.stringify(p));
input.on('line',line=>{const p=JSON.parse(line);fs.appendFileSync(${JSON.stringify(received)},JSON.stringify(p)+'\\n');let result={};
 if(p.method==='initialize')result={protocolVersion:1};
 if(p.method==='session/new')result={sessionId:'harness-session',configOptions:[{id:'model',category:'model',currentValue:JSON.stringify(['fixture','deepseek-v4-flash']),options:[]}]};
 if(p.method==='session/resume')result={configOptions:[{id:'model',category:'model',currentValue:JSON.stringify(['fixture','deepseek-v4-flash']),options:[]}]};
 if(p.method==='session/prompt'){
  const text=p.params.prompt[0].text;
  if(text.includes('CANCEL')){setTimeout(()=>send({jsonrpc:'2.0',id:p.id,result:{stopReason:'cancelled'}}),300);return}
  if(text.includes('DISCONNECT')){process.exit(3);return}
  send({jsonrpc:'2.0',method:'session/update',params:{sessionId:p.params.sessionId,update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'ACP_OK'}}}});result={stopReason:'end_turn'};
 }
 if(p.id&&p.method)send({jsonrpc:'2.0',id:p.id,result});
});`)
writeFileSync(configPath,JSON.stringify({harnessCommand:[process.execPath,fixture],worktreeRoot:home,adapterRoots:[],model:'deepseek-v4-flash',profile:'fixture',adapterPermissionMode:'read-only'}))
let count=0,children=[];const check=(name,fn)=>{fn();count++;console.log('✓ '+name)}
function start(args=['app-server','--listen','stdio://']){
 const child=spawn(process.execPath,[resolve('bin/harness-linky.mjs'),...args],{env:{...process.env,DSH_HOME:home,HARNESS_LINKY_CONFIG:configPath,LINKY_TASK_ID:'native-fixture-'+children.length,LINKY_ISSUE_ID:'issue-fixture',LINKY_TOKEN:'fixture-DO-NOT-LOG',CODEX_HOME:join(home,'role-resources')},stdio:['pipe','pipe','pipe']});children.push(child)
 let err='',text='';child.stderr.on('data',d=>err+=d);child.stdout.on('data',d=>text+=d)
 const packets=[],pending=new Map(),waiters=[];let id=0
 createInterface({input:child.stdout}).on('line',line=>{let p;try{p=JSON.parse(line)}catch{return}packets.push(p);if(p.id!=null&&pending.has(p.id)){const handler=pending.get(p.id);pending.delete(p.id);clearTimeout(handler.timer);p.error?handler.reject(Error(p.error.message)):handler.resolve(p.result)}for(const w of [...waiters])if(w.match(p)){clearTimeout(w.timer);waiters.splice(waiters.indexOf(w),1);w.resolve(p)}})
 const done=new Promise(resolve=>child.once('close',code=>resolve({code,text,err})))
 return {child,packets,done,call(method,params={}){return new Promise((resolve,reject)=>{const i=++id,timer=setTimeout(()=>reject(Error('wire timeout '+method)),4000);pending.set(i,{resolve,reject,timer});child.stdin.write(JSON.stringify({id:i,method,params})+'\n')})},wait(match){const old=packets.find(match);if(old)return Promise.resolve(old);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('event timeout')),4000);waiters.push({match,resolve,timer})})}}
}
try{
 const version=await start(['--version']).done;check('版本明确标注兼容协议，探测不启动 Harness',()=>{assert.equal(version.code,0);assert.match(version.text,/compatible.*backend=Harness/)} )
 const models=await start(['debug','models','--bundled']).done;check('模型探测只返回配置的真实 Harness 模型',()=>assert.equal(JSON.parse(models.text).models[0].id,'deepseek-v4-flash'))
 const wire=start();await wire.call('initialize');await assert.rejects(wire.call('thread/start',{cwd:'/tmp',model:'deepseek-v4-flash'}),/outside/)
 await assert.rejects(wire.call('thread/start',{cwd,model:'gpt-fictional'}),/Unsupported model/)
 await assert.rejects(wire.call('unknown',{}),/Unsupported method/)
 check('越界目录、未知模型和未知方法明确失败',()=>{})
 const thread=await wire.call('thread/start',{cwd,model:'deepseek-v4-flash',developerInstructions:'LINKY_ROLE_CONTEXT'})
 await assert.rejects(wire.call('turn/start',{threadId:thread.thread.id,input:[{type:'image',url:'x'}]}),/Only text/)
 const turn=await wire.call('turn/start',{threadId:thread.thread.id,input:[{type:'text',text:'READONLY'}]})
 const final=await wire.wait(p=>p.method==='item/completed'&&p.params.item.type==='agentMessage');const end=await wire.wait(p=>p.method==='turn/completed')
 check('真实进程将 app-server 请求转成 ACP 并返回最终事件',()=>{assert.equal(final.params.item.text,'ACP_OK');assert.equal(end.params.turn.status,'completed');assert.equal(turn.turn.id,end.params.turn.id)})
 const rpc=readFileSync(received,'utf8').trim().split('\n').map(s=>JSON.parse(s)),prompt=rpc.find(p=>p.method==='session/prompt')
 check('角色、原生技能目录和任务文本传入 Harness，凭据不进入提示',()=>{assert.match(prompt.params.prompt[0].text,/LINKY_ROLE_CONTEXT/);assert.match(prompt.params.prompt[0].text,/role-resources/);assert.ok(!JSON.stringify(rpc).includes('fixture-DO-NOT-LOG'))})
 wire.child.stdin.end();await wire.done
 const files=readdirSync(join(home,'storages/dev-workbench/development/native-runs')),record=JSON.parse(readFileSync(join(home,'storages/dev-workbench/development/native-runs',files[0]),'utf8'))
 check('最终结果先持久化，Linky 关闭连接不会丢失关联会话',()=>{assert.equal(record.status,'completed');assert.equal(record.sessionId,'harness-session');assert.equal(record.issueId,'issue-fixture');assert.ok(!JSON.stringify(record).includes('fixture-DO-NOT-LOG'))})
 const cancel=start();await cancel.call('thread/resume',{threadId:'harness-session',cwd});const ct=await cancel.call('turn/start',{threadId:'harness-session',input:[{type:'text',text:'CANCEL'}]});await cancel.call('turn/interrupt',{threadId:'harness-session',turnId:ct.turn.id});const cancelled=await cancel.wait(p=>p.method==='turn/completed');assert.equal(cancelled.params.turn.status,'interrupted');cancel.child.stdin.end();await cancel.done
 check('恢复保留会话 ID，取消转发 session/cancel 并返回中断状态',()=>assert.ok(readFileSync(received,'utf8').includes('session/cancel')))
 const broken=start();await broken.call('thread/start',{cwd});await broken.call('turn/start',{threadId:'harness-session',input:[{type:'text',text:'DISCONNECT'}]});const failed=await broken.wait(p=>p.method==='turn/completed');assert.equal(failed.params.turn.status,'failed');broken.child.stdin.end();await broken.done
 check('Harness 断开传播为失败，不能冒充修复成功',()=>{})
 console.log('harness-linky: '+count+' transport scenarios passed')
}finally{for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');rmSync(home,{recursive:true,force:true})}
