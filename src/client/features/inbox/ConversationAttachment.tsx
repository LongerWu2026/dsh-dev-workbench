import * as React from 'react'
import {downloadBytes} from '../../core/download.js'
import {Btn, Modal, Spinner, WB, useStore} from '../../core/runtime.js'

type Request = {
 accountId:string;groupId:string;viewId:string;messageId:string;name:string;file?:true;imageIndex?:number
}
type Result = {name:string;bytes:number;saved:boolean;supported:boolean;path?:string}
type Preview = {request:Request;result?:Result;error?:string}
const field = 'conversationAttachmentPreview'

export async function openConversationAttachment(request:Request) {
 const preview:Preview={request}
 WB.store.set({[field]:preview})
 const isCurrent=()=>WB.store.get()[field]===preview&&WB.store.get().data?.messageInbox?.accountId===request.accountId
 const {name,...target}=request
 try{
  const result:Result=await WB.actions.conversationAttachment({...target,native:true})
  if(!isCurrent())return
  let opened=false
  if(result.path){
   try{opened=await WB.openHarnessFile?.(result.path)===true}catch{/* Offer the original as a download. */}
  }
  if(isCurrent())WB.store.set({[field]:opened?null:{request,result}})
 }catch(error){
  if(isCurrent())WB.store.set({[field]:{request,error:(error as Error).message||'附件读取失败，请重试'}})
 }
}

export function ConversationAttachmentHost({accountId}:{accountId?:string}){
 const preview:Preview|null=useStore()[field]
 const [downloading,setDownloading]=React.useState(false)
 React.useEffect(()=>{
  if(preview&&preview.request.accountId!==accountId)WB.store.set({[field]:null})
 },[preview,accountId])
 if(!preview||preview.request.accountId!==accountId)return null
 const {request,result,error}=preview
 async function download(){
  if(!preview)return
  const {name,...target}=preview.request
  setDownloading(true)
  try{
   const value=await WB.actions.conversationAttachment({...target,download:true})
   if(WB.store.get().data?.messageInbox?.accountId===target.accountId)downloadBytes(value.name,value.data,'application/octet-stream')
  }catch(failure){WB.toast(String((failure as Error).message||failure),'err')}
  finally{setDownloading(false)}
 }
 return <Modal open title="附件" sub={result?.name||request.name} onClose={()=>WB.store.set({[field]:null})}
  footer={result&&<Btn size="sm" kind="primary" disabled={downloading} onClick={()=>void download()}>{downloading?'正在下载…':'下载文件'}</Btn>}>
  {error?<div className="wb-stack"><p role="alert">{error}</p><div><Btn size="sm" onClick={()=>void openConversationAttachment(request)}>重试打开</Btn></div></div>:
   result?<div className="wb-stack"><p>{result.supported?'当前无法打开 Harness 文件侧栏，可以下载后查看。':'此格式可下载后打开。'}</p>
    <span className="wb-tiny wb-muted">{WB.fmt.bytes(result.bytes)} · {result.saved?'已保存到工作台':'本地保存失败，下次打开时会重试'}</span></div>:
   <span role="status" className="wb-row wb-muted"><Spinner size={14}/>正在打开附件…</span>}
 </Modal>
}
