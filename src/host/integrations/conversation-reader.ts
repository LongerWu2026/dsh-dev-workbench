import {randomUUID} from 'node:crypto'
import {messageSentAt} from './reply-reconciliation.js'
import {conversationReadMark,isConversationRead,type ConversationReadMark} from '../../shared/conversation-read.js'
import {attachmentKey,attachmentName,attachmentViewPath,type AttachmentRef} from '../storage/conversation-attachments.js'
import {conversationFilePreview} from './conversation-file-preview.js'
import {conversationFile,conversationImageIds,imageMediaType} from './conversation-images.js'

type AttachmentBytes = {name:string;bytes:Buffer;saveFailed?:boolean}
type ImagePreview = {mediaType:string;data:string;saved?:boolean;saveFailed?:boolean}
type AttachmentAccess = {
 read:(ref:AttachmentRef)=>Buffer
 download:(ctx:any,fileId:string)=>Promise<Buffer>
 save:(key:string,account:string,name:string,mediaType:string,bytes:Buffer)=>Promise<void>
}
type Dependencies={attachments?:AttachmentAccess;state:()=>any;probe:(ctx:any)=>Promise<any>;run:(ctx:any,args:string[])=>Promise<any>;downloadImage:(ctx:any,fileId:string)=>Promise<{mediaType:string;data:string}>;markRead?:(mark:ConversationReadMark)=>Promise<{readMark:ConversationReadMark;snapshot:any}>}
type View={ctx:any;id:string;accountId:string;groupId:string;name:string;head:string;headSentAt:string|null;openedAt:string;readBoundary:string|null;ack?:Promise<any>;unread:number;at:string;expires:number;before:string|null;found:boolean;loaded:number;scanned:number;exhausted:boolean;historyTarget:number|null;buffer:any[];next:number;seen:Set<string>;replies:Map<number,{mode:string;promise:Promise<any>}>;names:Map<string,string>;displayed:Map<string,any>;images:Map<string,string[]>;files:Map<string,{id:string;name:string}>}
const TTL=15*60*1000
/** Explicit UI reader. Local acknowledgement is separate from provider receipts and reply obligations. */
export function createConversationReader(deps:Dependencies){
 const views=new Map<string,View>()
 const pendingImages=new Map<string,Promise<ImagePreview>>()
 const pendingFiles=new Map<string,Promise<AttachmentBytes>>()
 async function conversationMessages(ctx:any,request:any={}):Promise<any>{
  if(!request||typeof request!=='object'||Array.isArray(request))throw Error('会话读取参数无效')
  const mode=request.mode||'unread'
  if(!['unread','history'].includes(mode)||!request.viewId&&mode!=='unread')throw Error('请先读取本次未读消息')
  const state=deps.state(),account=state.messageInbox?.accountId
  if(!account||request.accountId!==account)throw Error('消息账号已变化，请重新打开会话')
  const probe=await deps.probe(ctx)
  if(probe.state!=='ok')throw Error(probe.note||'请先登录云之家')
  if(probe.accountId!==account&&probe.openId!==account)throw Error('当前云之家账号与消息快照不一致')
  // Recheck after every network wait; a later account can never receive an earlier account's messages.
  const assertAccount=()=>{if(deps.state().messageInbox?.accountId!==account)throw Error('消息账号已变化，请重新打开会话')}
  assertAccount()
  for(const [id,view] of views)if(view.expires<Date.now())views.delete(id)
  let view:View|undefined
  if(request.viewId){
   view=views.get(request.viewId)
   if(!view||view.ctx!==ctx||view.accountId!==account||view.groupId!==request.groupId)throw Error('会话查看已过期，请关闭后重新打开')
  }else{
   const c=state.messageInbox.conversations?.find((c:any)=>c.groupId===request.groupId)
   if(!c?.latestMsgId||!Number.isInteger(c.unreadCount)||c.unreadCount<0)throw Error('会话缺少可靠的未读位置，请先同步消息')
   if(views.size>=20)views.delete(views.keys().next().value!)
   const names=new Map<string,string>()
   for(const source of state.sources||[])if(source.provider==='yunzhijia'&&source.locator?.accountId===account&&source.locator?.senderId&&source.sender)names.set(source.locator.senderId,source.sender)
   view={ctx,id:randomUUID(),accountId:account,groupId:c.groupId,name:c.name||'原会话',head:c.latestMsgId,headSentAt:c.latestSentAt||null,openedAt:new Date().toISOString(),readBoundary:conversationReadMark(state,c)?.headMsgId||null,unread:isConversationRead(state,c)?0:c.unreadCount,at:state.messageInbox.at||new Date().toISOString(),expires:Date.now()+TTL,before:null,found:false,loaded:0,scanned:0,exhausted:false,historyTarget:null,buffer:[],next:0,seen:new Set(),replies:new Map(),names,displayed:new Map(),images:new Map(),files:new Map()}
   views.set(view.id,view)
  }
  const cursor=request.viewId?request.cursor:0
  if(!Number.isInteger(cursor)||cursor<0)throw Error('消息分页位置无效')
  const prior=view.replies.get(cursor)
  if(prior){if(prior.mode!==mode)throw Error('分页操作已变化，请重新打开会话');return prior.promise}
  if(cursor!==view.next)throw Error('消息分页位置已变化，请重新打开会话')
  const current=view
  if(mode==='history'&&current.loaded<current.unread&&!current.exhausted)throw Error('未读消息仍在读取，请稍后查看历史')
  if(mode==='history'&&current.historyTarget===null)current.historyTarget=current.loaded+10
  const target=()=>mode==='unread'?current.unread:current.historyTarget!
  const promise=(async()=>{
   const chunk:any[]=[];let note='',status='ok'
   try{
    let pages=0
    while(current.loaded<target()){
     if(current.buffer.length){
      const needed=target()-current.loaded,taken=current.buffer.splice(-Math.min(needed,current.buffer.length)),previous=current.loaded
      chunk.unshift(...taken.map((row:any,index:number)=>{
       const imageIds=conversationImageIds(row)
       if(imageIds.length)current.images.set(row.msgId,imageIds)
       const file=!imageIds.length&&conversationFile(row)
       if(file)current.files.set(row.msgId,file)
       return {id:row.msgId,senderId:typeof row.fromOpenId==='string'?row.fromOpenId:null,
        text:typeof row.content==='string'?row.content:'[非文本消息]',at:messageSentAt(row.sendTime),
        own:row.fromOpenId===probe.openId,unread:previous+taken.length-1-index<current.unread,
        replyToMsgId:row.param?.replyMsgId||row.replyMsgId||null,...(imageIds.length?{imageCount:imageIds.length}:{}),...(file?{fileName:attachmentName(file.name)}:{})}
      }))
      current.loaded+=taken.length
      continue
     }
     if(current.exhausted||pages>=3)break
     const args=['im','message','list','--group-id',current.groupId,'--type',current.before?'old':'newest','--limit','20']
     if(current.before)args.push('--msg-id',current.before)
     const response=await deps.run(ctx,args);assertAccount();pages++
     if(response.status!=='ok')throw Error(response.note||'消息读取失败，请重试')
     if(!Array.isArray(response.json?.data?.list))throw Error('消息接口未返回有效列表，请重试')
     const raw=response.json.data.list.map((r:any)=>r?.message||r)
     if(raw.some((r:any)=>typeof r?.msgId!=='string'||!r.msgId))throw Error('消息列表缺少有效定位，未继续翻页')
     const rows=[...new Map<string,any>(raw.map((r:any)=>[r.msgId,r])).values()]
     const fresh=rows.filter((r:any)=>!current.seen.has(r.msgId))
     for(const row of fresh)current.seen.add(row.msgId)
     current.scanned+=fresh.length
     const next=rows[0]?.msgId||null,stuck=!!current.before&&(!fresh.length||next===current.before)
     let available=fresh
     if(!current.found){const head=fresh.findIndex((r:any)=>r.msgId===current.head);if(head>=0){current.found=true;current.headSentAt=messageSentAt(fresh[head].sendTime)||current.headSentAt;available=fresh.slice(0,head+1)}else available=[]}
     if(mode==='unread'&&current.readBoundary){const boundary=available.findIndex((row:any)=>row.msgId===current.readBoundary);if(boundary>=0)current.unread=Math.min(current.unread,current.loaded+available.length-boundary-1)}
     current.buffer.unshift(...available);current.before=next
     if(raw.length<20){current.exhausted=true;if(!current.found)note='未找到打开时的消息位置，请同步后重新打开。';else if(current.loaded+current.buffer.length<current.unread)note='服务端返回的可见消息少于未读快照，部分消息可能已撤回或不可见。'}
     else if(stuck)throw Error('消息翻页没有前进，请稍后重试')
     if(!current.found&&current.scanned>=1000){current.exhausted=true;note='未读位置已超出本次查阅范围，请先同步消息后重新打开。'}
    }
    const missing=[...new Set<string>(chunk.filter(row=>!row.own&&row.senderId&&!current.names.has(row.senderId)).map(row=>row.senderId))].slice(0,50)
    if(missing.length){
     const names=await deps.run(ctx,['contact','user','get',...missing.flatMap(id=>['--open-id',id])]);assertAccount()
     const data=names.json?.data,list=Array.isArray(data?.list)?data.list:data?[data]:[]
     for(const user of list)if(missing.includes(user.openId)&&typeof (user.name||user.userName)==='string')current.names.set(user.openId,String(user.name||user.userName).slice(0,80))
    }
   }catch(error:any){assertAccount();status='partial';note=String(error.message||error).slice(0,300)}
   current.next++;current.expires=Date.now()+TTL
   const messages=chunk.map(({senderId,...row})=>({...row,sender:row.own?'我':current.names.get(senderId)||'未知发件人'}))
   for(const message of messages)current.displayed.set(message.id,message)
   const exhausted=current.exhausted&&!current.buffer.length,unreadComplete=current.loaded>=current.unread||exhausted,batchComplete=current.loaded>=target()||exhausted
   if(mode==='history'&&batchComplete)current.historyTarget=null
   return {status,viewId:current.id,accountId:account,groupId:current.groupId,name:current.name,snapshotAt:current.at,unreadTotal:current.unread,unreadLoaded:Math.min(current.unread,current.loaded),contextLoaded:Math.max(0,current.loaded-current.unread),messages,unreadComplete,hasMoreHistory:!exhausted,batchComplete,complete:unreadComplete,nextCursor:current.next,note}
  })()
  current.replies.set(cursor,{mode,promise})
  // Retain the current/previous response for retry deduplication, without caching an entire chat.
  for(const key of current.replies.keys())if(key<cursor-1)current.replies.delete(key)
  return promise
 }
 async function markRead(ctx:any,request:any={}):Promise<any>{
  const view=views.get(request?.viewId),account=deps.state().messageInbox?.accountId
  if(!view||view.expires<Date.now()||view.ctx!==ctx||view.accountId!==request.accountId||view.groupId!==request.groupId)throw Error('会话查看已过期，请重新打开')
  if(account!==view.accountId)throw Error('消息账号已变化，请重新打开会话')
  // Do not clear unread on a failed/partial fetch, a missing snapshot head or an unread-count shortfall.
  if(!view.found||view.loaded<view.unread)throw Error('未读消息尚未完整展示，暂不标记已读')
  if(!deps.markRead)throw Error('工作台已读接口尚未更新，请重载插件')
  if(view.ack)return view.ack
  view.ack=(async()=>{
   const probe=await deps.probe(ctx)
   if(probe.state!=='ok'||![probe.accountId,probe.openId].includes(account))throw Error('当前云之家账号与消息快照不一致')
   if(deps.state().messageInbox?.accountId!==account)throw Error('消息账号已变化，请重新打开会话')
   const saved=await deps.markRead!({accountId:account,groupId:view.groupId,headMsgId:view.head,headSentAt:view.headSentAt,openedAt:view.openedAt,readAt:new Date().toISOString()})
   return {status:'ok',...saved,providerReadSynced:false}
  })()
  try{return await view.ack}catch(error){view.ack=undefined;throw error}
 }
 async function selectedMessages(ctx:any,request:any){
  const view=views.get(request?.viewId),account=deps.state().messageInbox?.accountId
  if(!view||view.ctx!==ctx||view.expires<Date.now()||view.accountId!==account||request.accountId!==account||request.groupId!==view.groupId)throw Error('会话查看已过期或账号已变化，请重新打开')
  const ids=request.messageIds
  if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length||ids.some(id=>!view.displayed.has(id)))throw Error('请选择本次已经读取的1–100条消息')
  const probe=await deps.probe(ctx)
  if(probe.state!=='ok'||![probe.accountId,probe.openId].includes(account)||deps.state().messageInbox?.accountId!==account)throw Error('消息账号已变化，请重新打开会话')
  return {accountId:account,groupId:view.groupId,name:view.name,messages:ids.map(id=>view.displayed.get(id)).sort((a,b)=>String(a.at).localeCompare(String(b.at)))}
 }
 async function attachmentAccess(ctx:any,request:any){
  const view=views.get(request?.viewId),account=deps.state().messageInbox?.accountId
  if(!view||view.ctx!==ctx||view.expires<Date.now()||view.accountId!==account||request.accountId!==account||request.groupId!==view.groupId)throw Error('会话查看已过期或账号已变化，请重新打开')
  const index=request.imageIndex
  const file=request.file===true&&view.displayed.has(request.messageId)&&view.files.get(request.messageId)
  const imageId=Number.isInteger(index)&&index>=0&&view.displayed.has(request.messageId)&&view.images.get(request.messageId)?.[index]
  const fileId=file ? file.id : request.file===true ? null : imageId
  if(!fileId)throw Error(request.file===true?'请选择本次已读取消息中的文件':'请选择本次已读取消息中的图片')
  const key=attachmentKey(account,view.groupId,request.messageId,fileId)
  const assertScope=()=>{
   if(deps.state().messageInbox?.accountId!==account)throw Error('消息账号已变化，请重新打开会话')
   if(views.get(view.id)!==view||view.expires<Date.now())throw Error('会话查看已过期，请重新打开')
  }
  const assertAccount=async()=>{
   const probe=await deps.probe(ctx)
   if(probe.state!=='ok')throw Error(probe.note||'请先登录云之家')
   if(![probe.accountId,probe.openId].includes(account))throw Error('消息账号已变化，请重新打开会话')
   assertScope()
  }
  await assertAccount()
  return {account, key, fileId, file, assertAccount, assertScope, viewId:view.id}
 }
 async function previewImage(ctx:any,request:any):Promise<ImagePreview>{
  const {account,key,fileId,assertAccount,assertScope,viewId}=await attachmentAccess(ctx,{...request,file:false})
  const attachments=deps.attachments
  const saved=deps.state().conversationAttachments?.[key]
  if(saved&&attachments){
   try{
    const bytes=attachments.read(saved)
    return {mediaType:imageMediaType(bytes),data:bytes.toString('base64'),saved:true}
   }catch{ /* Re-download a missing or damaged local copy. */ }
  }
  const pendingKey=viewId+':'+key
  let pending=pendingImages.get(pendingKey)
  if(!pending){
   pending=(async()=>{
    const image=await deps.downloadImage(ctx,fileId)
    await assertAccount()
    if(!attachments)return image
    try{
     await attachments.save(key,account,'云之家图片.'+image.mediaType.slice(6),image.mediaType,Buffer.from(image.data,'base64'))
    }catch{
     assertScope()
     return {...image,saveFailed:true}
    }
    return {...image,saved:true}
   })().finally(()=>pendingImages.delete(pendingKey))
   pendingImages.set(pendingKey,pending)
  }
  const image=await pending
  assertScope()
  return image
 }
 async function conversationAttachment(ctx:any,request:any){
  const attachments=deps.attachments
  if(!attachments)throw Error('附件保存不可用')
  const {account,key,fileId,file,assertAccount,assertScope,viewId}=await attachmentAccess(ctx,request)
  const saved=deps.state().conversationAttachments?.[key]
  let attachment:AttachmentBytes|undefined
  if(saved){
   try{attachment={name:saved.name,bytes:attachments.read(saved)}}
   catch{ /* Re-download a missing or damaged local copy. */ }
  }
  if(!attachment){
   const pendingKey=viewId+':'+key
   let pending=pendingFiles.get(pendingKey)
   if(!pending){
    pending=(async()=>{
     const bytes=await attachments.download(ctx,fileId)
     await assertAccount()
     let mediaType='application/octet-stream'
     if(!file){try{mediaType=imageMediaType(bytes)}catch{/* Save other formats as originals. */}}
     const name=saved?.name||(file?attachmentName(file.name):mediaType.startsWith('image/')?'云之家图片.'+mediaType.slice(6):'云之家图片')
     try{await attachments.save(key,account,name,mediaType,bytes)}
     catch{assertScope();return {name,bytes,saveFailed:true}}
     return {name,bytes}
    })().finally(()=>pendingFiles.delete(pendingKey))
    pendingFiles.set(pendingKey,pending)
   }
   attachment=await pending
  }
  assertScope()
  const {name,bytes,saveFailed}=attachment
  if(request.download===true)return {name,data:bytes.toString('base64')}
  if(request.native===true){
   // These suffixes have document renderers or a text view in the Harness file plugin.
   const supported=/\.(?:png|jpe?g|gif|webp|bmp|ico|pdf|txt|log|md|markdown|csv|tsv|json|jsonl|ya?ml|ini|conf|docx?|xlsx?|pptx?)$/i.test(name)
   let path:string|undefined
   if(supported&&!saveFailed){
    try{path=attachmentViewPath(name,bytes)}catch{/* The original remains available to download. */}
   }
   return {name,bytes:bytes.length,saved:!saveFailed,supported,path}
  }
  if(request.open===true)return {name,bytes:bytes.length,saved:!saveFailed,preview:conversationFilePreview(name,bytes)}
  if(saveFailed)throw Error('本地保存失败，请重试')
  return {name,saved:true}
 }
 return Object.assign(conversationMessages,{markRead,selectedMessages,previewImage,conversationAttachment})
}
