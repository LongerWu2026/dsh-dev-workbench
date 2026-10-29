import * as React from 'react'
import {Btn} from '../../core/runtime.js'
import {WEB_AI_FILE_ACCEPT,normalizeWebAIAttachments,type WebAIAttachment,type WebAIFile} from '../../../shared/web-ai-attachments.js'
export interface SelectedWebAIFile extends WebAIAttachment {file:File}
export function selectWebAIFiles(existing:SelectedWebAIFile[],files:readonly File[],clipboard=false):SelectedWebAIFile[]{
 const names=new Set(existing.map(item=>item.name))
 const next=[...existing,...files.map((original,i)=>{
  let file=original
  // Screenshots commonly all arrive as image.png. Give pasted images distinct
  // names so the website can acknowledge each one without confusing receipts.
  if(clipboard&&file.type.startsWith('image/')&&names.has(file.name)){
   const dot=file.name.lastIndexOf('.'),base=dot>0?file.name.slice(0,dot):file.name,ext=dot>0?file.name.slice(dot):'';let n=2,name=base+' ('+n+')'+ext
   while(names.has(name))name=base+' ('+(++n)+')'+ext
   file=new File([file],name,{type:file.type,lastModified:file.lastModified})
  }
  names.add(file.name)
  return {id:'file-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+i,name:file.name,size:file.size,type:file.type,file}
 })]
 normalizeWebAIAttachments(next);return next
}
export async function readWebAIFiles(files:SelectedWebAIFile[]):Promise<WebAIFile[]>{
 normalizeWebAIAttachments(files)
 return Promise.all(files.map(async({file,...meta})=>({...meta,base64:await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('无法读取附件：'+meta.name));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file)})})))
}
function FilePreview({item}:{item:SelectedWebAIFile}){
 const [url,setUrl]=React.useState('')
 React.useEffect(()=>{if(!/^image\/(png|jpeg|webp|gif)$/.test(item.type)||!URL.createObjectURL)return;const value=URL.createObjectURL(item.file);setUrl(value);return()=>URL.revokeObjectURL(value)},[item])
 return <>{url&&<img src={url} alt={item.name} style={{width:48,height:48,objectFit:'contain',borderRadius:6}}/>}<span style={{minWidth:0,overflowWrap:'anywhere'}}>{item.name}<small className="wb-muted" style={{display:'block'}}>{Math.ceil(item.size/1024)} KB</small></span></>
}
export function WebAIAttachments({files,disabled,onAdd,onRemove}:{files:SelectedWebAIFile[];disabled:boolean;onAdd:(files:File[])=>void;onRemove:(id:string)=>void}){
 const chooser=React.useRef<HTMLInputElement>(null)
 return <div className="wb-stack" aria-label="问题附件">
  <input ref={chooser} aria-label="选择问题附件" type="file" multiple accept={WEB_AI_FILE_ACCEPT} disabled={disabled} style={{display:'none'}} onChange={event=>{onAdd(Array.from(event.target.files||[]));event.target.value=''}}/>
  <div className="wb-row wb-row--wrap" style={{gap:8}}><Btn disabled={disabled} onClick={()=>chooser.current?.click()}>添加图片 / 文件</Btn><span className="wb-tiny wb-muted">可粘贴截图或拖入文件；最多5个，单个10MB，总计20MB。格式以官网为准。</span></div>
  {!!files.length&&<><div className="wb-row wb-row--wrap" style={{gap:8}}>{files.map(item=><div key={item.id} className="wb-row" style={{gap:8,maxWidth:'100%',padding:8,border:'1px solid var(--dsw-alias-border-l1)',borderRadius:8}}><FilePreview item={item}/><Btn size="sm" disabled={disabled} aria-label={'移除附件 '+item.name} onClick={()=>onRemove(item.id)}>移除</Btn></div>)}</div><p className="wb-tiny wb-muted">附件将发送至勾选官网；批量仅附在第一问，后续复用会话。内容临时保留，历史仅保存附件信息；刷新后需重新选择。</p></>}
 </div>
}
