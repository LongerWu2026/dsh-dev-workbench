import type {WebAIFile} from '../../../shared/web-ai-attachments.js'
import type {WebAIAnswer,WebAIRound} from '../../../shared/web-ai.js'
import type {WebsiteController} from './NativeWebsite.js'
import {runWebsiteQuestion} from './runner.js'

interface BatchDependencies {
 claim(round:WebAIRound,providerId:string):Promise<{executionId:string|null}>
 update(round:WebAIRound,providerId:string,executionId:string,patch:Partial<WebAIAnswer>):Promise<void>
 open(round:WebAIRound,providerId:string):Promise<WebsiteController>
 attachments?:WebAIFile[]
 run?:typeof runWebsiteQuestion
}
/** Two vendors at most; each vendor's followups remain strictly sequential. */
export async function runWebsiteBatch(rounds:WebAIRound[],providers:string[],dependencies:BatchDependencies,signal:AbortSignal,prepareOnly=false){
 const process=async(providerId:string)=>{
  let blocked=false
  for(const round of rounds){
   if(signal.aborted)return
   const claim=await dependencies.claim(round,providerId)
   if(!claim.executionId)continue
   const executionId=claim.executionId
   const update=async(patch:Partial<WebAIAnswer>)=>{
    if(patch.status&&['prepared','needs_login','unsupported','uncertain'].includes(patch.status))blocked=true
    if(patch.status==='completed'||patch.status==='generating')blocked=false
    await dependencies.update(round,providerId,executionId,patch)
   }
   if(blocked){await update({status:'unsupported',note:'前一个问题需要在官网处理，本条未发送。'});continue}
   try{const website=await dependencies.open(round,providerId);await (dependencies.run||runWebsiteQuestion)(website,round.question,round.id+':'+providerId,update,signal,prepareOnly,undefined,undefined,round.id===rounds[0]?.id?dependencies.attachments:[])}
   catch(error){blocked=true;if(!signal.aborted)await update({status:'uncertain',note:error instanceof Error?error.message:'官网处理失败，请核对页面。'})}
  }
 }
 const queue=[...providers]
 const workers=await Promise.allSettled(Array.from({length:Math.min(dependencies.attachments?.length?1:2,queue.length)},async()=>{while(queue.length&&!signal.aborted){const provider=queue.shift();if(provider)await process(provider)}}))
 const failed=workers.find((value):value is PromiseRejectedResult=>value.status==='rejected')
 if(failed)throw failed.reason
}

/** Retry only fenced updates, scoped cancellation, and creation with the SAME server-deduplicated request ID. Never retry website submits/uploads or claims. */
export async function persistWebAIState<T>(write:()=>Promise<T>,signal?:AbortSignal,pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))):Promise<T>{
 for(let attempt=0;;attempt++){
  if(signal?.aborted)throw new Error('已停止采集；不会发送问题')
  try{return await write()}catch(error){
   if(attempt>=2||signal?.aborted||!/Failed to fetch|NetworkError|network request failed|fetch failed|ERR_NETWORK|ERR_CONNECTION/i.test(error instanceof Error?error.message:String(error)))throw error
   await pause(300*(attempt+1))
  }
 }
}
