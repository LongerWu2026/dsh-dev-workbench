/** Test the real shipped serializer with synthetic model responses and a network-free fetch. */
import assert from 'node:assert/strict'
import {mkdtempSync,cpSync,mkdirSync,symlinkSync,readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {patchBeamReasoning,originalBeamAdapter} from './beam-reasoning-compat.mjs'
const root=resolve(import.meta.dirname,'../..'),modules=process.argv[2]||'/Applications/DeepSeek Harness.app/Contents/Resources/workbench-app/dsh/node_modules'
mkdirSync(join(root,'.tmp'),{recursive:true})
const dir=mkdtempSync(join(root,'.tmp/beam-wire-')),pkg=join(dir,'pi-ai')
cpSync(join(modules,'@earendil-works/pi-ai'),pkg,{recursive:true,verbatimSymlinks:true})
symlinkSync(modules,join(dir,'node_modules'),'dir')
const file=join(pkg,'dist/api/openai-completions.js'),original=originalBeamAdapter(readFileSync(file,'utf8'))
writeFileSync(file,original)
const baseline=await import(pathToFileURL(file).href+'?baseline')
const patched=patchBeamReasoning(original);writeFileSync(file,patched)
assert.equal(patchBeamReasoning(patched),patched)
assert.throws(()=>patchBeamReasoning(original+'\n// drift'),/Unreviewed/)
assert.throws(()=>patchBeamReasoning(patched+'\n// drift'),/Unreviewed/)
const {convertMessages,stream}=await import(pathToFileURL(file).href+'?patched')
const model={api:'openai-completions',provider:'command-code',id:'reflection/beam:free',baseUrl:'https://api.commandcode.ai/v1',name:'fixture',reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:4096,maxTokens:1024}
const detail={type:'reasoning.text',text:'fixture returned reasoning',format:'unknown',index:0}
const user={role:'user',content:'fixture question',timestamp:0}
const calls=[]
const fetch=async(_url,options)=>{
 const payload=JSON.parse(options.body);calls.push(payload)
 const delta=calls.length===1?{role:'assistant',reasoning:detail.text,reasoning_details:[detail],tool_calls:[{index:0,id:'call_fixture',type:'function',function:{name:'lookup',arguments:'{}'}}]}:{role:'assistant',content:'fixture answer'}
 const frames=[{id:'fixture_response',choices:[{index:0,delta,finish_reason:null}]},{choices:[{index:0,delta:{},finish_reason:calls.length===1?'tool_calls':'stop'}],usage:{prompt_tokens:2,completion_tokens:1}}]
 return new Response(frames.map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}})
}
const tools=[{name:'lookup',description:'fixture',parameters:{type:'object',properties:{}}}]
const first=await stream(model,{messages:[user],tools},{apiKey:'fixture-only',fetch,maxRetries:0}).result()
assert.equal(first.stopReason,'toolUse');assert.equal(first.content[0].thinking,detail.text)
const result={role:'toolResult',toolCallId:'call_fixture',toolName:'lookup',content:[{type:'text',text:'fixture result'}],isError:false,timestamp:0}
const context={messages:[user,first,result],tools}
const oldWire=baseline.convertMessages(model,context,{requiresThinkingAsText:false,requiresAssistantAfterToolResult:false}).find(x=>x.role==='assistant')
assert.equal(oldWire.reasoning_content,undefined);assert.deepEqual(oldWire.reasoning_details,[detail])
const second=await stream(model,context,{apiKey:'fixture-only',fetch,maxRetries:0}).result()
assert.equal(second.stopReason,'stop');assert.equal(calls.length,2)
const assistant=calls[1].messages.find(x=>x.role==='assistant')
assert.equal(assistant.reasoning_content,detail.text);assert.deepEqual(assistant.reasoning_details,[detail]);assert.equal(assistant.tool_calls[0].id,'call_fixture');assert.equal(calls[1].messages.find(x=>x.role==='tool').tool_call_id,'call_fixture')
const compat={requiresThinkingAsText:false,requiresAssistantAfterToolResult:false}
const wire=(m,msg=first)=>convertMessages(m,{messages:[user,msg,result]},compat).find(x=>x.role==='assistant')
for(const changed of [{...model,provider:'other'},{...model,id:'other-model'},{...model,baseUrl:'https://other.example/v1'},{...model,baseUrl:'https://api.commandcode.ai.evil.example/v1'}])assert.equal(wire(changed).reasoning_content,undefined)
assert.equal(wire(model,{...first,provider:'other'}).reasoning_content,undefined)
const withoutReasoning={...first,content:first.content.filter(x=>x.type!=='thinking')}
assert.equal(wire(model,withoutReasoning).reasoning_content,undefined)
console.log(JSON.stringify({requests:calls.length,baselineReproduced:true,toolPairPreserved:true,realReturnedReasoningReplayed:true,negativeRoutesAndMissingReasoningPassed:true,personalDataUsed:false,installedAppModified:false,evidence:dir}))
