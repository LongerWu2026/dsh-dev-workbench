import * as React from 'react'
import {Btn,Icon,Modal} from '../core/runtime.js'

export function AssistantConversationDeleteButton({row,disabled,onClick}:any){
 if(row.canDelete!==true||row.kind!=='chat'||!row.id?.startsWith('chat:')||row.nativeBinding?.workspaceState!=='unbound')return null
 return <button type="button" className="wb-iconbtn wb-hub-delete" aria-label={'删除临时会话：'+row.title} title="删除临时会话" disabled={disabled} onClick={()=>onClick(row)}><Icon name="trash" size={14}/></button>
}
export function AssistantConversationDeleteDialog({target,request,onClose,onDeleted}:any){
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),mounted=React.useRef(true),inFlight=React.useRef(false)
 React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 function close(){if(!inFlight.current)onClose()}
 async function confirm(){
  if(inFlight.current)return
  inFlight.current=true;setBusy(true);setError('')
  try{
   const result=await request({action:'delete',conversationId:target.id,confirmed:true})
   if(result?.status!=='ok'||result.conversationId!==target.id||result.archived!==true)throw Error(result?.note||'删除未被确认，原会话仍保留')
   if(mounted.current)onDeleted(target,result)
  }catch(failure:any){if(mounted.current)setError(failure.message||'删除失败，原会话仍保留')}
  finally{inFlight.current=false;if(mounted.current)setBusy(false)}
 }
 return <Modal open title="删除临时会话" width={420} onClose={close} footer={<><Btn disabled={busy} onClick={close}>取消</Btn><Btn kind="danger" disabled={busy} onClick={confirm}>{busy?'正在删除…':'确认删除'}</Btn></>}>
  <strong>{target.title}</strong><p>删除后会从 AI 助手和 Harness 会话列表移除，聊天记录保留在 Harness 已归档会话中，可恢复。</p><p className="wb-tiny wb-muted">系统会话、关联事项及绑定工作区的会话不能删除。正在执行的会话请先处理完。</p>{error&&<p role="alert">{error}</p>}
 </Modal>
}
