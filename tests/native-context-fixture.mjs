/** Test-only native pre-step simulation. Requests remain the exact transport
 * payload; modelText() reads separately admitted context, never rewrites it. */
const contexts=new WeakMap(),modelMessages=new WeakMap()
export function installNativeContextFixture(ctx,controller=ctx.get?.('sessionController')||ctx.sessionController){
 if(contexts.has(ctx))return ctx
 const hooks=[];contexts.set(ctx,hooks)
 const originalOn=ctx.on
 ctx.on=(name,handler,options)=>{
  if(name!=='agent/pre-step')return originalOn?.call(ctx,name,handler,options)||(()=>{})
  const row={handler};if(options?.prepend)hooks.unshift(row);else hooks.push(row)
  return ()=>{const index=hooks.indexOf(row);if(index>=0)hooks.splice(index,1)}
 }
 if(controller?.prompt){
  const original=controller.prompt
  controller.prompt=async function(request,signal){
   const native=ctx.get?.('sessions')?.get?.(request.sessionId)||ctx.sessions?.get?.(request.sessionId)
   const input={id:'fixture-user-'+request.requestId,role:'user',content:request.content,source:{kind:'user',rpcId:request.requestId}},payload={agent:{session:native||{id:request.sessionId,snapshotEvents:()=>[]}},messages:[input],turn:1,step:1,signal:signal||new AbortController().signal}
   const run=index=>index<hooks.length?hooks[index].handler(payload,()=>run(index+1)):Promise.resolve({kind:'enter',messages:[input]})
   const decision=await run(0)
   if(decision.kind==='reject')throw Error('fixture native pre-step rejected')
   modelMessages.set(request,decision.messages)
   return original.call(this,request,signal)
  }
 }
 return ctx
}
export function modelText(request){return (modelMessages.get(request)||[{content:request.content}]).flatMap(message=>message.content||[]).filter(part=>part.type==='text').map(part=>part.text).join('\n')}
export function admittedMessages(request){return modelMessages.get(request)||[]}
