/** Opt-in real Harness inference. No Linky daemon or work-item writes. */
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
const argv=JSON.parse(process.env.HARNESS_LIVE_ARGV||'null'),harnessHome=process.env.HARNESS_LIVE_HOME
if(!Array.isArray(argv)||!argv.length||!harnessHome)throw Error('Explicit HARNESS_LIVE_ARGV and HARNESS_LIVE_HOME required')
const home=mkdtempSync(join(tmpdir(),'harness-linky-live-')),cwd=join(home,'workdir');mkdirSync(cwd)
const wrapper=join(home,'launch.mjs'),config=join(home,'config.json'),marker='HARNESS_ADAPTER_LIVE_'+randomUUID()
writeFileSync(wrapper,`import {spawn} from 'node:child_process';const argv=${JSON.stringify(argv)};const child=spawn(argv[0],argv.slice(1),{stdio:'inherit',env:{...process.env,DSH_HOME:${JSON.stringify(harnessHome)}}});child.once('exit',code=>process.exit(code||0));for(const s of ['SIGINT','SIGTERM'])process.once(s,()=>child.kill(s));`)
writeFileSync(config,JSON.stringify({profile:'live-readonly-verification',harnessCommand:[process.execPath,wrapper],worktreeRoot:home,adapterRoots:[],model:process.env.HARNESS_LIVE_MODEL||'deepseek-v4-flash',adapterPermissionMode:'read-only'}))
const child=spawn(process.execPath,[resolve('bin/harness-linky.mjs'),'app-server','--listen','stdio://'],{stdio:['pipe','pipe','pipe'],env:{...process.env,DSH_HOME:home,HARNESS_LINKY_CONFIG:config}})
const pending=new Map(),events=[];let id=0,resolveFinal,rejectFinal
const final=new Promise((resolve,reject)=>{resolveFinal=resolve;rejectFinal=reject})
const timer=setTimeout(()=>rejectFinal(Error('live verification timeout')),90000)
child.stderr.resume();child.on('error',rejectFinal)
createInterface({input:child.stdout}).on('line',line=>{const p=JSON.parse(line);if(p.id!=null){const handler=pending.get(p.id);if(handler){pending.delete(p.id);p.error?handler.reject(Error(p.error.message)):handler.resolve(p.result)}}else{events.push(p);if(p.method==='turn/completed')resolveFinal(p)}})
const call=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});child.stdin.write(JSON.stringify({id:i,method,params})+'\n')})
try{
 await call('initialize');const thread=await call('thread/start',{cwd,model:process.env.HARNESS_LIVE_MODEL||'deepseek-v4-flash',developerInstructions:'只读链路验证。禁止调用工具、读取业务文件、修改文件或调用任何 Linky 写操作。只输出用户指定的标记。'})
 await call('turn/start',{threadId:thread.thread.id,input:[{type:'text',text:'只输出以下字符串，不添加说明：'+marker}]})
 const completed=await final;assert.equal(completed.params.turn.status,'completed')
 const message=events.find(e=>e.method==='item/completed'&&e.params.item.type==='agentMessage');assert.equal(message?.params.item.text.trim(),marker)
 const tools=events.filter(e=>e.params?.item?.type==='commandExecution');assert.equal(tools.length,0)
 const result={verifiedAt:new Date().toISOString(),status:'passed',engine:'official Harness ACP',sessionId:thread.thread.id,marker,toolCount:tools.length,turnStatus:completed.params.turn.status}
 if(process.env.HARNESS_LIVE_REPORT){mkdirSync(resolve(process.env.HARNESS_LIVE_REPORT,'..'),{recursive:true});writeFileSync(process.env.HARNESS_LIVE_REPORT,JSON.stringify(result,null,2))}
 console.log(JSON.stringify(result))
}finally{clearTimeout(timer);child.stdin.end();child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('close',resolve)});rmSync(home,{recursive:true,force:true})}
