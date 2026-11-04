/** Installed controller code, synthetic Agent/Session only. Never connects to live Harness or a model. */
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdtempSync,readFileSync,writeFileSync,symlinkSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
const root=process.env.WORKBENCH_HARNESS_MODULES||'/Applications/DeepSeek Harness.app/Contents/Resources/workbench-app/dsh',require=createRequire(join(root,'package.json')),temp=mkdtempSync(join(tmpdir(),'native-assistant-stop-'))
try{
 const entry=require.resolve('@deepseek-ai/dsh-api-session-controller'),source=readFileSync(entry,'utf8'),sha256=createHash('sha256').update(source).digest('hex')
 // Export one existing private command class from a temporary copy; command bodies are unchanged.
 symlinkSync(join(root,'node_modules'),join(temp,'node_modules'),'dir');const copy=join(temp,'controller.mjs');writeFileSync(copy,source+'\nexport {SessionCommandController as FixtureCommands};\n')
 const {SessionController,FixtureCommands}=await import(pathToFileURL(copy).href),{Session,SessionId}=await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session')).href)
 const sessions=new Map(),agents=new Map(),calls=[],retired=[]
 const ctx={agents:{get:id=>agents.get(id),isOwnedBy:()=>true},fileUploads:{retirePrompt:(agent,rpcId)=>retired.push({sessionId:agent.id,rpcId})}}
 const commands=new FixtureCommands(ctx,{},temp),surface={commands},cancel=req=>SessionController.prototype.cancel.call(surface,req),remove=req=>SessionController.prototype.updateQueue.call(surface,req)
 function fixture(id){const session=Session.create(SessionId(id));sessions.set(id,session);const inbox={nextTurn:[{id:'keep',source:{kind:'user',rpcId:'keep-request'}},{id:'remove',source:{kind:'user',rpcId:'this-request'}}],nextStep:[],remove(itemId){this.nextTurn=this.nextTurn.filter(r=>r.id!==itemId);this.nextStep=this.nextStep.filter(r=>r.id!==itemId)}};const agent={id,session,inbox,status:'running',cancel(reason,options){calls.push({id,reason,options})}};agents.set(id,agent);return agent}
 const ordinary=fixture('synthetic-ordinary'),before=ordinary.session.snapshotEvents()
 assert.deepEqual(await cancel({sessionId:ordinary.id}),{accepted:true});assert.deepEqual(calls,[{id:ordinary.id,reason:{kind:'user'},options:{keepInbox:true}}]);assert.equal(ordinary.status,'running');assert.equal(ordinary.inbox.nextTurn.length,2);assert.deepEqual(ordinary.session.snapshotEvents(),before)
 await assert.rejects(async()=>cancel({sessionId:'missing'}),e=>e.code==='session/not-found');assert.equal(calls.length,1)
 const child=fixture('synthetic-child');Object.defineProperty(child.session,'header',{value:{...child.session.header,origin:'subagent'}})
 await assert.rejects(async()=>cancel({sessionId:child.id}),e=>e.code==='session/agent-busy');assert.equal(calls.length,1)
 assert.deepEqual(await remove({sessionId:ordinary.id,itemId:'remove',action:{kind:'remove'}}),{accepted:true});assert.deepEqual(ordinary.inbox.nextTurn.map(r=>r.id),['keep']);assert.deepEqual(retired,[{sessionId:ordinary.id,rpcId:'this-request'}]);assert.deepEqual(ordinary.session.snapshotEvents(),before)
 await assert.rejects(async()=>remove({sessionId:ordinary.id,itemId:'remove',action:{kind:'remove'}}),e=>e.code==='session/queue-item-not-found');assert.equal(retired.length,1)
 console.log(JSON.stringify({status:'ok',nativeController:entry,sha256,checks:['public-cancel-delegation','user-reason-and-keepInbox','ack-is-not-settled','history-preserved','missing-agent-rejected','subagent-routing-rejected','remove-only-selected-queue-item','prompt-upload-reservation-retired-once'],realSessionsChanged:0,networkCalls:0}))
}finally{rmSync(temp,{recursive:true,force:true})}
