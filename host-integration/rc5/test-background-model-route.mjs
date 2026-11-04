/** Actual installed Harness Agent/Context waterfalls. Synthetic sessions; no model/provider calls. */
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
const root=process.env.WORKBENCH_HARNESS_MODULES||'/Applications/DeepSeek Harness.app/Contents/Resources/workbench-app/dsh',nativeRequire=createRequire(join(root,'package.json')),temp=mkdtempSync(join(tmpdir(),'workbench-native-model-route-'))
process.env.DSH_HOME=temp
try{
 const native=async name=>import(pathToFileURL(nativeRequire.resolve(name)).href)
 const [{Context},{default:SystemPrompt},{installModelSelection,agentEvents},{Session,SessionId},{createUserMessage}]=await Promise.all([native('@deepseek-ai/cordis'),native('@deepseek-ai/dsh-system-prompt'),native('@deepseek-ai/dsh-agent'),native('@deepseek-ai/dsh-session'),native('@deepseek-ai/dsh-llm')])
 const outfile=join(temp,'route.mjs');await build({entryPoints:[resolve('src/host/assistant/background-models.ts')],outfile,bundle:true,platform:'node',format:'esm',logLevel:'silent'});const {installBackgroundModelRoute}=await import(pathToFileURL(outfile).href)
 const globalDefault={provider:'unchanged-default',model:'old',reasoningEffort:'max'},selected={provider:'analysis-provider',model:'analysis-model'},other={provider:'summary-provider',model:'summary-model'},contexts=[],signal=new AbortController().signal,input=createUserMessage({content:[{type:'text',text:'合成验收，不执行任务'}],source:{kind:'user'}})
 async function make(id){const ctx=new Context();contexts.push(ctx);await ctx.plugin(SystemPrompt);const agent={session:Session.create(SessionId(id)),ctx};const ref={current:{...globalDefault},assembled:undefined};installModelSelection(ctx,ref);agent.session.append('request/header',{header:{config:globalDefault},reason:'initial'});return {ctx,agent,ref}}
 const a=await make('analysis-fixture'),b=await make('summary-fixture'),ordinary=await make('ordinary-fixture'),removeA=installBackgroundModelRoute(a.agent,selected),removeB=installBackgroundModelRoute(b.agent,other)
 const request=async item=>{const assembly=await item.ctx.systemPrompt.assemble(),config=await agentEvents(item.ctx,item.agent).waterfall('agent/request',{turn:1,step:0,signal},()=>Promise.resolve({...globalDefault,temperature:.25}));return {assembly,config}}
 const x=await request(a),y=await request(b),z=await request(ordinary)
 assert.deepEqual(x.assembly.variables,selected);assert.deepEqual(x.config,{...selected,temperature:.25});assert.deepEqual(y.assembly.variables,other);assert.deepEqual(y.config,{...other,temperature:.25});assert.deepEqual(z.config,{...globalDefault,temperature:.25});assert.deepEqual(a.ref.current,globalDefault);assert.deepEqual(b.ref.current,globalDefault)
 const preStep=async item=>agentEvents(item.ctx,item.agent).waterfall('agent/pre-step',{turn:1,step:1,messages:[input],signal},()=>Promise.resolve({kind:'enter',messages:[input]}))
 const first=await preStep(a);assert.equal(first.messages.filter(m=>m.source?.kind==='model-selection').length,1);assert.match(first.messages.at(-1).content[0].text,/analysis-provider\/analysis-model/)
 a.agent.session.append('request/header',{header:{config:selected},reason:'initial'});await request(a);const next=await preStep(a);assert.equal(next.messages.filter(m=>m.source?.kind==='model-selection').length,0,'native selection must not announce a switch back to the old default')
 removeA();removeB();const restored=await request(a);assert.deepEqual(restored.config,{...globalDefault,temperature:.25})
 for(const ctx of contexts)await ctx.fiber.dispose()
 console.log(JSON.stringify({status:'ok',nativeHarness:root,checks:['analysis-summary-isolation','ordinary-session-default-unchanged','assembly-request-route-agree','old-reasoning-effort-cleared','accurate-model-switch-notice','native-selected-state-unchanged','hook-disposal'],networkCalls:0,realSessionsChanged:0}))
}finally{rmSync(temp,{recursive:true,force:true})}
