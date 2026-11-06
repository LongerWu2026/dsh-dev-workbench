import {normalizeMessageImageIds} from '../../shared/message-intake.js'
import {loadWorkbenchState,mutateWorkbenchState,workbenchGenerationGuard} from '../storage/state-store.js'
import {attachmentKey,attachmentViewPath,describeAttachment,readAttachment,writeAttachment,type AttachmentRef} from '../storage/conversation-attachments.js'
import {conversationImageIds,imageMediaType} from './conversation-images.js'
import {linkedMessageSources} from './message-metadata.js'

type Dependencies = {
 probe(ctx:any):Promise<any>
 run(ctx:any,args:string[]):Promise<any>
 download(ctx:any,id:string):Promise<{mediaType:string;data:string}>
}

async function exactMessage(run:Dependencies['run'],ctx:any,loc:any){
 const page=async(type:string,limit:number,anchor?:string)=>{
  const args=['im','message','list','--group-id',loc.groupId,'--type',type,'--limit',String(limit)]
  if(anchor)args.push('--msg-id',anchor)
  const result=await run(ctx,args)
  if(result.status!=='ok')throw Error(result.note||'暂时无法读取原消息')
  if(!Array.isArray(result.json?.data?.list))throw Error('原消息接口返回无效')
  return result.json.data.list.map((row:any)=>row.message||row)
 }
 for(const direction of ['new','old']){
  const rows=await page(direction,1,loc.msgId)
  const exact=rows.find((row:any)=>row.msgId===loc.msgId)
  if(exact)return exact
  if(typeof rows[0]?.msgId==='string'){
   const nearby=await page(direction==='new'?'old':'new',2,rows[0].msgId)
   const found=nearby.find((row:any)=>row.msgId===loc.msgId)
   if(found)return found
  }
 }
 const newest=await page('newest',20)
 const exact=newest.find((row:any)=>row.msgId===loc.msgId)
 if(!exact)throw Error('未找到原消息，无法检查图片')
 return exact
}
const imageHint=/\[(?:图片|image)\]/i
const getKey=(loc:any,id:string)=>attachmentKey(loc.accountId,loc.groupId,loc.msgId,id)

export function createLinkedMessageImages(deps:Dependencies){
 const pending=new Map<string,Promise<string[]>>()
 const retries=new Map<string,number>()
 const scheduled=new Map<string,any>()
 let background:Promise<void>|undefined
 let limitedUntil=0

 function validate(state:any,id:string,entryId?:string){
  const source=entryId===undefined
   ? linkedMessageSources(state,true).find(row=>row.id===id)
   : state.sources.find((row:any)=>row.id===id&&row.provider==='yunzhijia')
  const loc=source?.locator
  if(!loc?.accountId||loc.accountId!==state.messageInbox?.accountId||!loc.msgId||!loc.groupId)
   throw Error('当前云之家账号无法查看这条消息的图片')
  if(entryId!==undefined&&!state.analysisQueue.some((entry:any)=>
   entry.id===entryId&&entry.sourceId===id&&
   (!entry.accountId||entry.accountId===loc.accountId)&&
   (!entry.groupId||entry.groupId===loc.groupId)&&(!entry.msgId||entry.msgId===loc.msgId)))
   throw Error('识别条目与原消息不匹配，请重新打开')
  return loc
 }

 function ensure(ctx:any,sourceId:string,repairId?:string,entryId?:string):Promise<string[]>{
  const state=loadWorkbenchState(),loc=validate(state,sourceId,entryId)
  const known=normalizeMessageImageIds(loc.imageIds)
  if(known&&known.every(id=>id!==repairId&&state.conversationAttachments?.[getKey(loc,id)]))
   return Promise.resolve(known)
  const existing=pending.get(sourceId)
  if(existing)return existing
  const guard=workbenchGenerationGuard()
  const operation=(async()=>{
   const checkAccount=async()=>{
    const probe=await deps.probe(ctx)
    guard()
    const current=loadWorkbenchState()
    const currentLoc=validate(current,sourceId,entryId)
    if(probe.state!=='ok'||![probe.accountId,probe.openId].includes(loc.accountId)||
        currentLoc.groupId!==loc.groupId||currentLoc.msgId!==loc.msgId)
     throw Error('云之家账号或原消息已变化，请重新打开')
   }
   await checkAccount()
   const ids=known??conversationImageIds(await exactMessage(deps.run,ctx,loc))
   const fetched:{key:string;bytes:Buffer;ref:AttachmentRef}[]=[]
   let failure:unknown
   for(const id of ids){
    const key=getKey(loc,id)
    if(state.conversationAttachments?.[key]&&id!==repairId)continue
    try{
     const image=await deps.download(ctx,id)
     const bytes=Buffer.from(image.data,'base64')
     fetched.push({key,bytes,ref:describeAttachment(bytes,'云之家图片.'+image.mediaType.slice(6),image.mediaType)})
    }catch(error){
     failure=error
     if(/限流|过于频繁/.test(String(error)))break
    }
   }
   await checkAccount()
   if(known===undefined||fetched.length){
    await mutateWorkbenchState((current:any)=>{
     guard()
     const currentLoc=validate(current,sourceId,entryId)
     if(currentLoc.groupId!==loc.groupId||currentLoc.msgId!==loc.msgId)throw Error('原消息已变化，请重新打开')
     if(currentLoc.imageIds===undefined)currentLoc.imageIds=ids
     for(const {key,ref,bytes} of fetched){
      writeAttachment(ref,bytes)
      current.conversationAttachments[key]=ref
     }
    })
   }
   if(failure)throw failure
   return ids
  })().finally(()=>pending.delete(sourceId))
  pending.set(sourceId,operation)
  return operation
 }

 async function read(ctx:any,request:any){
  const sourceId=request?.sourceId,entryId=request?.entryId
  if(typeof sourceId!=='string'||(entryId!==undefined&&typeof entryId!=='string')||
   !['list','inline','open','download'].includes(request.mode))throw Error('图片读取参数无效')
  let state=loadWorkbenchState(),loc=validate(state,sourceId,entryId)
  let ids=normalizeMessageImageIds(loc.imageIds)
  if(ids===undefined){
   ids=await ensure(ctx,sourceId,undefined,entryId)
   state=loadWorkbenchState()
   loc=validate(state,sourceId,entryId)
  }
  if(request.mode==='list')return {count:ids.length}
  if(!ids.length)throw Error('原消息中没有可查看的图片')
  const id=Number.isInteger(request.index)&&ids[request.index]
  if(!id)throw Error('该消息没有这张图片')
  const key=getKey(loc,id)
  let ref=state.conversationAttachments?.[key]
  let bytes:Buffer|undefined
  if(ref){try{bytes=readAttachment(ref)}catch{/* Re-fetch a damaged local copy. */}}
  if(!bytes){
   await ensure(ctx,sourceId,ref?id:undefined,entryId).catch(error=>{
    if(!loadWorkbenchState().conversationAttachments?.[key])throw error
   })
   state=loadWorkbenchState()
   validate(state,sourceId,entryId)
   ref=state.conversationAttachments?.[key]
   if(!ref)throw Error('未能保存原消息图片，请重试')
   bytes=readAttachment(ref)
  }
  const mediaType=imageMediaType(bytes)
  if(request.mode==='open')return {name:ref.name,path:attachmentViewPath(ref.name,bytes),...(entryId===undefined?{}:{count:ids.length})}
  return {name:ref.name,mediaType,data:bytes.toString('base64')}
 }

 function sync(ctx:any,onlyIds?:Set<string>){
  if(Date.now()<limitedUntil)return background??Promise.resolve()
  const state=loadWorkbenchState(),account=state.messageInbox?.accountId
  const recognized={...state,replies:(state.replies||[]).filter((reply:any)=>reply.triage!=='pending')}
  const candidates=linkedMessageSources(recognized).filter(source=>{
   const loc=source.locator,ids=normalizeMessageImageIds(loc?.imageIds)
   return account&&loc?.accountId===account&&loc.msgId&&loc.groupId&&(!onlyIds||onlyIds.has(source.id))&&
    (retries.get(source.id)||0)<=Date.now()&&
    (ids?ids.some(id=>!state.conversationAttachments?.[getKey(loc,id)]):imageHint.test(source.excerpt||''))
  })
  for(const source of onlyIds?candidates:candidates.slice(0,8)){
   if(scheduled.size>=250)break
   scheduled.set(source.id,ctx)
  }
  if(background||!scheduled.size)return background??Promise.resolve()
  background=(async()=>{
   for(const [id,context] of scheduled){
    try{await ensure(context,id);retries.delete(id)}
    catch(error){
     if(retries.size>=2000)retries.delete(retries.keys().next().value!)
     retries.set(id,Date.now()+15*60000)
     if(/限流|过于频繁/.test(String(error)))limitedUntil=Date.now()+120000
    }
    scheduled.delete(id)
    if(Date.now()<limitedUntil)break
   }
  })().finally(()=>{background=undefined})
  return background
 }
 return {read,sync}
}
