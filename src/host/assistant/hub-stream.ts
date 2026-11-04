import {assistantOutputText} from './final-output.js'

const LIMIT=24000,IDLE_MS=60000,MAX_SESSIONS=8
/** Presentation only. Reasoning, tool arguments and usage never enter this fold. */
export class VisibleAssistantStream {
 private blocks=new Map<number,{type:string;text:string;closed:boolean}>()
 push(chunk:any){
  const index=chunk?.index;if(!Number.isSafeInteger(index)||index<0||index>1000)return
  if(chunk.type==='block-start'){this.blocks.set(index,{type:chunk.blockType,text:'',closed:false});return}
  const previous=this.blocks.get(index)
  if(previous?.closed)return
  if(chunk.type==='text-delta'){
   if(previous&&previous.type!=='text')return
   this.blocks.set(index,{type:'text',text:((previous?.text||'')+String(chunk.text||'')).slice(0,LIMIT),closed:false})
  }else if(chunk.type==='block-end')this.blocks.set(index,{type:chunk.block?.type,text:chunk.block?.type==='text'?String(chunk.block.text||'').slice(0,LIMIT):'',closed:true})
 }
 text(){return assistantOutputText({content:[...this.blocks].sort(([a],[b])=>a-b).map(([,block])=>({type:block.type,text:block.text}))}).slice(0,LIMIT)}
}
interface Attempt {id:string;turn:number;step:number;after:number;next:number;active:boolean;visible:VisibleAssistantStream}
interface Reader {abort:AbortController;touched:number;revision:number;attempt?:Attempt;timer?:ReturnType<typeof setTimeout>;retryAt?:number}
const contexts=new WeakMap<object,Map<string,Reader>>()
function compactText(stream:any[]):VisibleAssistantStream{
 const visible=new VisibleAssistantStream()
 for(const record of stream||[]){
  if(record.type==='text-chunks')for(const text of record.texts||[])visible.push({type:'text-delta',index:record.index,text})
  else if(record.type==='chunk')visible.push(record.chunk)
 }
 return visible
}
function baseline(reader:Reader,value:any){
 reader.revision=Number(value?.revision)||0;reader.attempt=undefined
 const opening=value?.activeAttempt;if(!opening)return
 const visible=compactText(opening.stream)
 reader.attempt={id:opening.attemptId,turn:opening.turn,step:opening.step,after:opening.startedAfterSeq,next:opening.nextIndex,active:true,visible}
}
function frame(reader:Reader,value:any){
 if(value?.type==='start'&&value.revision===1&&reader.revision!==0){reader.revision=0;reader.attempt=undefined}
 if(!value||!Number.isSafeInteger(value.revision)||value.revision<=reader.revision)return
 if(value.revision!==reader.revision+1){reader.attempt=undefined;throw Error('assistant stream revision gap')}
 reader.revision=value.revision
 if(value.type==='start')reader.attempt={id:value.attemptId,turn:value.turn,step:value.step,after:value.startedAfterSeq,next:0,active:true,visible:new VisibleAssistantStream()}
 else {
  const attempt=reader.attempt
  if(!attempt||attempt.id!==value.attemptId||!attempt.active)return
  if(value.index!==attempt.next){reader.attempt=undefined;throw Error('assistant stream index gap')}
  if(value.type==='chunk'){attempt.visible.push(value.chunk);attempt.next++}
  else if(value.type==='end'){
   if(value.outcome?.kind==='committed'&&value.outcome.eventType==='assistant/message')reader.attempt=undefined
   else attempt.active=false
  }
 }
}
function stop(reader:Reader){clearTimeout(reader.timer);reader.abort.abort()}
export function disposeHubStreams(ctx:object){const readers=contexts.get(ctx);if(readers)for(const reader of readers.values())stop(reader);contexts.delete(ctx)}
/** One bounded native read subscription per already-authorized Session. Never prompts or activates an agent. */
export function watchHubStream(ctx:any,sessionId:string){
 const controller=(typeof ctx?.get==='function'?ctx.get('sessionController'):undefined)||ctx?.sessionController
 if(typeof controller?.follow!=='function')return
 let readers=contexts.get(ctx);if(!readers){readers=new Map();contexts.set(ctx,readers)}
 const prior=readers.get(sessionId),now=Date.now()
 if(prior&&!prior.abort.signal.aborted){prior.touched=now;return}
 if(prior?.retryAt&&prior.retryAt>now)return
 if(prior)readers.delete(sessionId)
 if(readers.size>=MAX_SESSIONS){const oldest=[...readers].sort((a,b)=>a[1].touched-b[1].touched)[0];stop(oldest[1]);readers.delete(oldest[0])}
 const reader:Reader={abort:new AbortController(),touched:now,revision:0};readers.set(sessionId,reader)
 const expire=()=>{const remaining=IDLE_MS-(Date.now()-reader.touched);if(remaining<=0){stop(reader);if(readers!.get(sessionId)===reader)readers!.delete(sessionId)}else{reader.timer=setTimeout(expire,remaining);reader.timer.unref?.()}}
 reader.timer=setTimeout(expire,IDLE_MS);reader.timer.unref?.()
 void (async()=>{
  try{
   for await(const event of controller.follow({address:{kind:'session',sessionId},assistantStream:true,maxMessages:1},reader.abort.signal)){
    if(reader.abort.signal.aborted)break
    if(event.type==='snapshot')baseline(reader,event.assistantStream)
    else if(event.type==='assistant-stream')frame(reader,event.frame)
   }
  }catch{if(!reader.abort.signal.aborted){reader.attempt=undefined;reader.retryAt=Date.now()+5000}}
  finally{stop(reader)}
 })()
}
/** Older hosts persist raw chunks; newer hosts expose transient follow frames instead. */
function legacyAttempt(session:any):Attempt|undefined{
 let attempt:Attempt|undefined
 for(const event of session.snapshotEvents?.()||[]){
  if(event.type==='assistant/attempt'||event.type==='assistant/message'&&event.data?.interrupted===true){
   const data=event.data||{},visible=event.type==='assistant/message'?new VisibleAssistantStream():compactText(data.stream)
   if(event.type==='assistant/message'){const text=assistantOutputText(data.message);visible.push({type:'block-end',index:0,block:{type:'text',text}})}
   attempt={id:'interrupted',turn:data.turn,step:data.step,after:event.seq-1,next:0,active:false,visible}
  }else if(event.type==='turn/start'||event.type==='step/start'||event.type==='user/message'||event.type==='assistant/message'||event.type==='tool/call'||event.type==='tool/result')attempt=undefined
  else if(event.type==='assistant/chunk'){
   const data=event.data||{}
   if(!attempt||attempt.turn!==data.turn||attempt.step!==data.step)attempt={id:'legacy',turn:data.turn,step:data.step,after:event.seq-1,next:0,active:true,visible:new VisibleAssistantStream()}
   attempt.visible.push(data.chunk)
  }else if(event.type==='turn/end'&&attempt)attempt.active=false
 }
 return attempt
}
export function streamingHubTurns(ctx:object,session:any,turns:any[]){
 if(!session)return turns
 const attempt=contexts.get(ctx)?.get(session.id)?.attempt||legacyAttempt(session),text=attempt?.visible.text()
 if(!attempt||!text||!Number.isSafeInteger(attempt.after))return turns
 const user=(session.snapshotEvents?.()||[]).filter((event:any)=>event.type==='user/message'&&event.seq<=attempt.after&&(!event.data?.source||event.data.source.kind==='user')).at(-1)
 if(!user)return turns
 return turns.map(turn=>{
  if(turn.sessionId!==session.id||turn.userSeq!==user.seq||turn.nativeTurn==null||turn.nativeTurn!==attempt.turn||turn.replySource==='assistant'&&!['recognizing','executing'].includes(turn.status))return turn
  if(!['recognizing','executing','interrupted','failed'].includes(turn.status))return turn
  return {...turn,streamingText:text,replyStreaming:attempt.active&&['recognizing','executing'].includes(turn.status)}
 })
}
