/** Optional native services; missing upload/account providers must not disable the workbench. */
declare const __WORKBENCH_VERSION__: string
export interface AssistantIdentity {name:string;avatarUrl?:string}

export function safeAssistantAvatar(value:unknown):string|undefined {
 if(typeof value!=='string'||value.length>1400000)return undefined
 if(/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return value
 try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password)return url.href}catch{}
 return undefined
}

export function installAssistantNative(WB:any,ctx:any):()=>void {
 let disposed=false,revision=0,identity:AssistantIdentity={name:'我'},pending:Promise<AssistantIdentity>|null=null
 const get=(name:string):any=>{try{return typeof ctx.get==='function'?ctx.get(name):ctx[name]}catch{return undefined}}
 const publish=(next:AssistantIdentity)=>{if(disposed)return;identity=next;WB.store.set((state:any)=>({assistantIdentityRevision:(state.assistantIdentityRevision||0)+1}))}
 const upload=async(sessionId:string,data:any,name?:string,signal?:AbortSignal,onProgress?:(progress:any)=>void)=>{
  if(disposed)throw Error('附件服务已重新加载，请重新发送')
  if(typeof sessionId!=='string'||!sessionId.trim())throw Error('请先准备当前会话，再上传附件')
  if(signal?.aborted)throw Error('附件上传已取消')
  const service=get('fileUpload')
  if(typeof service?.upload!=='function')throw Error('当前 Harness 未提供附件上传服务，请更新客户端后重试；本条消息尚未发送')
  const response=await service.upload(sessionId,data,name,signal,onProgress)
  if(disposed||signal?.aborted)throw Error('附件上传已取消，请在当前会话重试')
  if(response?.ok!==true)throw Error(String(response?.error?.message||'附件上传失败，请重试或移除该附件').slice(0,500))
  const value=response.value
  if(typeof value?.receiptId!=='string'||!value.receiptId||typeof value?.file?.attachmentId!=='string'||!value.file.attachmentId||typeof value.file.name!=='string'||!Number.isFinite(value.file.bytes)||value.file.bytes<0)throw Error('附件服务未返回有效凭证，本条消息尚未发送')
  return value
 }
 const load=async():Promise<AssistantIdentity>=>{
  if(disposed)return {name:'我'}
  if(pending)return pending
  const account=get('remote.account')||get('remote')?.account
  if(typeof account?.getProfile!=='function')return identity
  const current=++revision
  pending=(async()=>{
   try{
    if(typeof account.getState==='function'){
     const state=await account.getState()
     if(state?.ok!==true||state.value?.status!=='credential-stored'){if(current===revision)publish({name:'我'});return identity}
    }
    // This is the requesting plugin UI's real build version, never a fabricated Harness version.
    const result=await account.getProfile({version:__WORKBENCH_VERSION__,locale:'zh-CN',timezoneOffsetSeconds:-new Date().getTimezoneOffset()*60})
    if(disposed||current!==revision)return identity
    const profile=result?.ok===true&&result.value?.status==='ready'?result.value.value:null
    const name=typeof profile?.name==='string'?profile.name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40):''
    publish({name:name||'我',...(safeAssistantAvatar(profile?.avatarUrl)?{avatarUrl:safeAssistantAvatar(profile.avatarUrl)}:{})})
   }catch{if(!disposed&&current===revision)publish({name:'我'})}
   return identity
  })().finally(()=>{if(current===revision)pending=null})
  return pending
 }
 WB.getAssistantIdentity=()=>identity
 WB.loadAssistantIdentity=load
 WB.uploadAssistantFile=upload
 WB.nativeAttachmentCapabilities=()=>({fileUpload:!disposed&&typeof get('fileUpload')?.upload==='function'})
 const focus=()=>{if(WB.store.get().page==='assistant')void load()}
 if(typeof window!=='undefined')window.addEventListener('focus',focus)
 return ()=>{disposed=true;revision++;pending=null;identity={name:'我'};if(typeof window!=='undefined')window.removeEventListener('focus',focus)}
}
