import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {hashText,workbenchDir} from '../platform/runtime.js'
import {getHubTurn} from './hub-turns.js'
import {WORKBENCH_CONTEXT_SOURCE} from '../../shared/assistant-context.js'

interface ContextRecord {version:1;sessionId:string;requestId:string;turnId?:string;messageId:string;userText:string;text:string;digest:string;purpose?:'development'}
// Development includes the bounded role snapshot, real diff and test evidence.
// Keep the existing assistant limit unchanged and never silently truncate either.
const contextLimit=(purpose?:string)=>purpose==='development'?2*1024*1024:64000
const installed=new WeakMap<object,()=>void>()
const path=(sessionId:string,requestId:string)=>join(workbenchDir(),'assistant-native-contexts',hashText(JSON.stringify([sessionId,requestId]))+'.json')
function read(sessionId:string,requestId:string):ContextRecord|undefined{
 const file=path(sessionId,requestId);if(!existsSync(file))return
 const value=JSON.parse(readFileSync(file,'utf8'))
 if(value.version!==1||value.sessionId!==sessionId||value.requestId!==requestId||value.purpose!==undefined&&value.purpose!=='development'||typeof value.messageId!=='string'||typeof value.text!=='string'||typeof value.userText!=='string'||value.text.length>contextLimit(value.purpose)||value.digest!==hashText(JSON.stringify([value.userText,value.text])))throw Error('本轮上下文记录无法核对，未向模型提交，请保留原会话后重试')
 return value
}
function contextMessage(record:ContextRecord){
 const section=Object.freeze({name:record.purpose==='development'?'研发上下文':'智能工作台',text:record.text})
 return Object.freeze({id:record.messageId,role:'user',content:Object.freeze([Object.freeze({type:'text',text:record.text})]),source:Object.freeze({kind:WORKBENCH_CONTEXT_SOURCE,form:'snapshot',sections:Object.freeze([section]),requestId:record.requestId,sessionId:record.sessionId,...(record.turnId?{turnId:record.turnId}:{})})})
}
/** Join at native pre-step admission, not an earlier inject() which could be
 * claimed by an unrelated running step. No user message is modified or sent. */
export function activateNativeContexts(ctx:any):boolean{
 if(!ctx||typeof ctx.on!=='function')return false
 if(installed.has(ctx))return true
 const dispose=ctx.on('agent/pre-step',async({agent,signal}:any,next:any)=>{
  const decision=await next()
  if(decision?.kind!=='enter'||signal?.aborted)return decision
  const session=agent?.session;if(!session?.id)return decision
  const logged=session.snapshotEvents?.()||[],messages:any[]=[]
  for(const message of decision.messages){
   const requestId=message.source?.kind==='user'?message.source.rpcId:undefined
   const record=typeof requestId==='string'?read(session.id,requestId):undefined
   if(record){
    const text=(message.content||[]).filter((block:any)=>block.type==='text').map((block:any)=>block.text).join('\n')
    if(text!==record.userText)throw Error('本轮用户消息与登记的上下文不一致，未向模型提交')
    if(record.turnId){const turn=getHubTurn(record.turnId);if(!turn||turn.sessionId!==session.id||turn.requestId!==requestId)throw Error('本轮上下文归属已变化，未向模型提交');if(turn.stopRequestedAt)throw Error('用户已停止本轮，未向模型提交上下文')}
    const committed=logged.some((event:any)=>event.type==='user/message'&&event.data?.id===record.messageId&&event.data?.source?.kind===WORKBENCH_CONTEXT_SOURCE)
    const selected=decision.messages.some((candidate:any)=>candidate.id===record.messageId&&candidate.source?.kind===WORKBENCH_CONTEXT_SOURCE)
    if(!committed&&!selected&&!messages.some(candidate=>candidate.id===record.messageId))messages.push(contextMessage(record))
   }
   messages.push(message)
  }
  return {...decision,messages}
 },{prepend:true})
 if(typeof dispose!=='function')return false
 installed.set(ctx,dispose)
 return true
}
export function disposeNativeContexts(ctx:object){const dispose=installed.get(ctx);installed.delete(ctx);dispose?.()}
/** Durable before prompt admission, so a queued request keeps its exact snapshot
 * through plugin reloads. A retry cannot replace its payload or its native ID. */
export function prepareNativeContext(ctx:any,input:{sessionId:string;requestId:string;userText:string;text:string;turnId?:string;reuseSnapshot?:boolean;purpose?:'development'}){
 if(!activateNativeContexts(ctx))throw Error('当前宿主未提供原生上下文注入能力，请更新或重连 Harness；本条消息尚未发送')
 if(!input.sessionId||!input.requestId||!input.text||input.purpose!==undefined&&input.purpose!=='development'||input.text.length>contextLimit(input.purpose))throw Error('本轮上下文为空或过长，未发送消息')
 const prior=read(input.sessionId,input.requestId),digest=hashText(JSON.stringify([input.userText,input.text]))
 if(prior){if(prior.purpose!==input.purpose||prior.turnId!==input.turnId||prior.userText!==input.userText||prior.digest!==digest&&!input.reuseSnapshot)throw Error('相同请求的上下文已变化，请以新消息继续；原会话与上下文保留');return prior.messageId}
 const file=path(input.sessionId,input.requestId),dir=join(workbenchDir(),'assistant-native-contexts');mkdirSync(dir,{recursive:true,mode:0o700})
 const {reuseSnapshot,...snapshot}=input
 const record:ContextRecord={version:1,...snapshot,messageId:randomUUID(),digest},temp=file+'.'+randomUUID()+'.tmp'
 writeFileSync(temp,JSON.stringify(record),{mode:0o600});renameSync(temp,file)
 return record.messageId
}
