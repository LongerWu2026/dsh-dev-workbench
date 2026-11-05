/** Installed public Harness SDK, temporary sessions only; no live model or client writes. */
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,join,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
const root=process.env.WORKBENCH_HARNESS_MODULES||'/Applications/DeepSeek Harness.app/Contents/Resources/workbench-app/dsh',nativeRequire=createRequire(join(root,'package.json')),temp=mkdtempSync(join(tmpdir(),'workbench-native-context-sdk-'))
process.env.DSH_HOME=temp
const contexts=[]
try{
 const native=async name=>import(pathToFileURL(nativeRequire.resolve(name)).href)
 const [{Context},{agentEvents},{Session,SessionId},{createUserMessage}]=await Promise.all([native('@deepseek-ai/cordis'),native('@deepseek-ai/dsh-agent'),native('@deepseek-ai/dsh-session'),native('@deepseek-ai/dsh-llm')])
 const outfile=join(temp,'native-context.mjs');await build({entryPoints:[resolve('src/host/assistant/native-context.ts')],outfile,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const {prepareNativeContext,disposeNativeContexts}=await import(pathToFileURL(outfile).href)
 const ctx=new Context();contexts.push(ctx)
 const a={session:Session.create(SessionId('synthetic-native-a')),ctx},b={session:Session.create(SessionId('synthetic-native-b')),ctx},signal=new AbortController().signal
 const input=rpcId=>createUserMessage({content:[{type:'text',text:'请继续这个问题'}],source:{kind:'user',rpcId}})
 const preStep=(agent,messages)=>agentEvents(ctx,agent).waterfall('agent/pre-step',{turn:1,step:1,messages,signal},()=>Promise.resolve({kind:'enter',messages}))
 const snapshotA=prepareNativeContext(ctx,{sessionId:a.session.id,requestId:'sdk-request',userText:'请继续这个问题',text:'甲事项原生上下文'}),snapshotB=prepareNativeContext(ctx,{sessionId:b.session.id,requestId:'sdk-request',userText:'请继续这个问题',text:'乙事项原生上下文'})
 const original=input('sdk-request'),x=await preStep(a,[original]),y=await preStep(b,[original])
 assert.equal(x.messages.length,2);assert.equal(y.messages.length,2);assert.equal(x.messages[1],original);assert.equal(x.messages[0].id,snapshotA);assert.equal(y.messages[0].id,snapshotB);assert.notEqual(snapshotA,snapshotB)
 for(const message of x.messages)a.session.append('user/message',message,{surfaceOp:'append'})
 const model=a.session.deriveMessages();assert.equal(model.length,2);assert.equal(model[0].content[0].text,'甲事项原生上下文');assert.deepEqual(model[1],original);assert.equal(model[1].content[0].text,'请继续这个问题');assert.equal(model[0].source.form,'snapshot')
 assert.equal((await preStep(a,[original])).messages.length,1,'committed context must not be repeated')
 const outside=await preStep(b,[input('not-from-workbench')]);assert.equal(outside.messages.length,1)
 disposeNativeContexts(ctx);prepareNativeContext(ctx,{sessionId:b.session.id,requestId:'sdk-request',userText:'请继续这个问题',text:'乙事项原生上下文'});assert.equal((await preStep(b,[original])).messages[0].id,snapshotB)
 const devText='继续开发：SYNTHETIC-1 · 验证需求',devContext='阶段：implementation\n禁止提交、推送、发布\n完整角色技能：'+'研发技能'.repeat(20000)
 const devContextId=prepareNativeContext(ctx,{sessionId:a.session.id,requestId:'sdk-development',userText:devText,text:devContext,purpose:'development'}),devUser=createUserMessage({content:[{type:'text',text:devText}],source:{kind:'user',rpcId:'sdk-development'}}),dev=await preStep(a,[devUser])
 assert.equal(dev.messages.length,2);assert.equal(dev.messages[0].id,devContextId);assert.equal(dev.messages[0].content[0].text,devContext);assert.equal(dev.messages[0].source.sections[0].name,'研发上下文');assert.equal(dev.messages[1],devUser)
 for(const message of dev.messages)a.session.append('user/message',message,{surfaceOp:'append'})
 assert.equal(a.session.deriveMessages().at(-1).content[0].text,devText);assert.equal(a.session.deriveMessages().at(-2).content[0].text,devContext);assert.equal((await preStep(a,[devUser])).messages.length,1)
 // Inspect the installed native renderer contract rather than modifying the host UI.
 const client=readFileSync(join(dirname(nativeRequire.resolve('@deepseek-ai/dsh-client-ui-chat')),'client.js'),'utf8'),row=client.slice(client.indexOf('function ContextInjectionRow('),client.indexOf('function ContextInjectionRow(')+8500)
 assert.match(row,/useState\)\(false\)/);assert.match(row,/open: open && single === void 0/);assert.match(client,/if \(event\.data\.source\.kind !== ["']user["']\)/)
 disposeNativeContexts(ctx)
 console.log(JSON.stringify({status:'ok',nativeHarness:root,checks:['public-agent-pre-step-waterfall','separate-model-visible-snapshot','original-user-payload-preserved','session-request-isolation','committed-context-deduplication','unrelated-request-unchanged','plugin-reload-recovery','installed-native-context-classification','installed-default-collapsed-renderer','development-short-visible-message','development-complete-native-snapshot'],uiEvidence:'installed-renderer-contract-not-live-click',networkCalls:0,realSessionsChanged:0}))
}finally{for(const ctx of contexts)await ctx.fiber.dispose();rmSync(temp,{recursive:true,force:true})}
