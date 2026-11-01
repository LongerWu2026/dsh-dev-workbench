import * as React from 'react'
import {WB,Icon,Spinner} from '../core/runtime.js'
import {AssistantContextPicker,type AssistantContextRef} from './AssistantContextPicker.js'
import {ASSISTANT_MAX_ATTACHMENTS,ASSISTANT_IMAGE_MEDIA_TYPES,ASSISTANT_DEFAULT_IMAGE_LIMITS,assistantAttachmentName,type AssistantAttachmentInput} from '../../shared/assistant-attachments.js'

export type AssistantDraftAttachment={id:string;type:'image'|'file';name:string;size:number;mediaType?:string;file:File;status:'ready'|'reading'|'uploading'|'prepared'|'failed';note?:string;progress?:number;data?:string;receiptId?:string;uploadedSessionId?:string;uploadedFile?:{attachmentId:string;name:string;bytes:number}}
type ImageLimits={maxImageBytes?:number;maxImagesPerMessage?:number;maxMessageImageBytes?:number;mediaTypes?:readonly string[]}
const drafts=new Map<string,AssistantDraftAttachment[]>(),listeners=new Set<()=>void>(),empty:AssistantDraftAttachment[]=[],preparing=new Map<string,{sessionId:string;ids:string[];promise:Promise<AssistantAttachmentInput[]>}>()
const snapshot=(key:string)=>drafts.get(key)||empty
function save(key:string,rows:AssistantDraftAttachment[]){if(rows.length)drafts.set(key,rows);else drafts.delete(key);listeners.forEach(fn=>fn())}
function patch(key:string,id:string,value:Partial<AssistantDraftAttachment>){save(key,snapshot(key).map(row=>row.id===id?{...row,...value}:row))}
const makeId=()=>typeof globalThis.crypto?.randomUUID==='function'?'attachment-'+globalThis.crypto.randomUUID():'attachment-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)
const imageType=(file:File)=>file.type||({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'} as Record<string,string>)[file.name.split('.').pop()?.toLowerCase()||'']||''
export function assistantAttachmentSize(bytes:number){return bytes>=1024*1024?(bytes/(1024*1024)).toFixed(bytes>=10*1024*1024?0:1)+' MB':bytes>=1024?Math.ceil(bytes/1024)+' KB':bytes+' B'}
export function selectAssistantFiles(existing:AssistantDraftAttachment[],files:readonly File[],clipboard=false):AssistantDraftAttachment[]{
 if(existing.length+files.length>ASSISTANT_MAX_ATTACHMENTS)throw Error('每条消息最多添加 '+ASSISTANT_MAX_ATTACHMENTS+' 个附件，请先移除部分文件。')
 const names=new Set(existing.map(row=>row.name))
 return [...existing,...files.map(file=>{
  if(!(file instanceof Blob)||typeof file.name!=='string'||!Number.isSafeInteger(file.size)||file.size<0)throw Error('请选择有效的本地文件，不能使用文件路径代替附件。')
  let name=assistantAttachmentName(file.name),mediaType=imageType(file)
  if(clipboard&&mediaType.startsWith('image/')&&names.has(name)){const index=name.lastIndexOf('.'),base=index>0?name.slice(0,index):name,ext=index>0?name.slice(index):'';let n=2;while(names.has(base+' ('+n+')'+ext))n++;name=base+' ('+n+')'+ext}
  names.add(name)
  return {id:makeId(),type:(ASSISTANT_IMAGE_MEDIA_TYPES as readonly string[]).includes(mediaType)?'image' as const:'file' as const,name,size:file.size,...(mediaType?{mediaType}:{}),file,status:'ready' as const}
 })]
}
function readImage(file:File,signal?:AbortSignal):Promise<string>{return new Promise((resolve,reject)=>{
 const reader=new FileReader(),cancel=()=>reader.abort(),clean=()=>signal?.removeEventListener('abort',cancel)
 reader.onerror=()=>{clean();reject(Error('图片读取失败，请重新选择文件。'))};reader.onabort=()=>{clean();reject(new DOMException('附件准备已取消，请重新发送。','AbortError'))};reader.onload=()=>{clean();const result=String(reader.result||''),at=result.indexOf(',');if(at<0)reject(Error('图片内容无效，请重新选择文件。'));else resolve(result.slice(at+1))}
 if(signal?.aborted){reject(new DOMException('附件准备已取消，请重新发送。','AbortError'));return}signal?.addEventListener('abort',cancel,{once:true});reader.readAsDataURL(file)
})}
function validateImages(rows:AssistantDraftAttachment[],limits?:ImageLimits){
 const imageRows=rows.filter(row=>row.type==='image'),resolved={...ASSISTANT_DEFAULT_IMAGE_LIMITS,...limits}
 if(imageRows.length>resolved.maxImagesPerMessage)throw Error('当前宿主每条消息最多支持 '+resolved.maxImagesPerMessage+' 张图片。')
 if(imageRows.reduce((n,row)=>n+row.size,0)>resolved.maxMessageImageBytes)throw Error('图片合计超过当前宿主的 '+assistantAttachmentSize(resolved.maxMessageImageBytes)+' 限制。')
 for(const row of imageRows){if(!resolved.mediaTypes.includes(row.mediaType||''))throw Error('当前宿主不支持图片格式：'+row.name);if(row.size>resolved.maxImageBytes)throw Error('图片「'+row.name+'」超过当前宿主的 '+assistantAttachmentSize(resolved.maxImageBytes)+' 限制。')}
}
async function prepareDraft(key:string,{sessionId,imageLimits,signal,ids}:{sessionId:string;imageLimits?:ImageLimits;signal?:AbortSignal;ids?:string[]}):Promise<AssistantAttachmentInput[]>{
 if(!sessionId)throw Error('附件尚未关联原生会话，请重新发送。')
 const source=ids?ids.map(id=>{const row=snapshot(key).find(item=>item.id===id);if(!row)throw Error('本条消息的附件已移除，请重新发送。');return row}):snapshot(key).slice(),selectedIds=source.map(row=>row.id)
 if(new Set(selectedIds).size!==selectedIds.length)throw Error('附件选择重复，请重新发送。')
 const active=preparing.get(key);if(active){if(active.sessionId!==sessionId||JSON.stringify(active.ids)!==JSON.stringify(selectedIds))throw Error('附件正在为原消息准备，请等待完成后再发送。');return active.promise}
 if(!source.length)return []
 const work=(async()=>{
  try{validateImages(source,imageLimits)}catch(error:any){for(const row of source.filter(row=>row.type==='image'))patch(key,row.id,{status:'failed',note:error.message});throw error}
  const attachments:AssistantAttachmentInput[]=[]
  for(const original of source){
   if(signal?.aborted)throw new DOMException('附件准备已取消，请重新发送。','AbortError')
   const row=snapshot(key).find(item=>item.id===original.id);if(!row)throw Error('附件选择已变化，请重新发送。')
   try{
    if(row.type==='image'){
     patch(key,row.id,{status:'reading',note:undefined,progress:undefined})
     const data=row.data||await readImage(row.file,signal)
     patch(key,row.id,{status:'prepared',data,note:undefined})
     attachments.push({id:row.id,type:'image',name:row.name,size:row.size,mediaType:row.mediaType,data})
    }else{
     let receiptId=row.receiptId,file=row.uploadedFile
     if(!receiptId||!file||row.uploadedSessionId!==sessionId){
      if(typeof WB.uploadAssistantFile!=='function'||WB.nativeAttachmentCapabilities?.().fileUpload===false)throw Error('当前客户端暂未提供文件上传能力，本条消息未发送。')
      patch(key,row.id,{status:'uploading',note:undefined,progress:0})
      const value=await WB.uploadAssistantFile(sessionId,row.file,row.name,signal,(progress:any)=>{const total=Number(progress.total)||row.size;patch(key,row.id,{progress:total?Math.max(0,Math.min(1,Number(progress.loaded)/total)):0})})
      if(typeof value?.receiptId!=='string'||typeof value?.file?.attachmentId!=='string'||value.file.bytes!==row.size)throw Error('附件上传回执无效，请重试该文件。')
      receiptId=value.receiptId;file=value.file
     }
     patch(key,row.id,{status:'prepared',receiptId,uploadedFile:file,uploadedSessionId:sessionId,note:undefined,progress:1})
     attachments.push({id:row.id,type:'file',name:row.name,size:row.size,...(row.mediaType?{mediaType:row.mediaType}:{}),receiptId,file})
    }
   }catch(error:any){patch(key,row.id,{status:'failed',note:error?.message||'附件准备失败，请重试或移除。',receiptId:undefined,uploadedFile:undefined,uploadedSessionId:undefined,progress:undefined});throw error}
  }
  return attachments
 })()
 preparing.set(key,{sessionId,ids:selectedIds,promise:work});try{return await work}finally{if(preparing.get(key)?.promise===work)preparing.delete(key)}
}
/** Drafts are isolated by logical conversation, selected history and knowledge scope. No upload occurs on selection. */
export function useAssistantAttachments(scopeKey:string){
 const subscribe=React.useCallback((fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}},[]),get=React.useCallback(()=>snapshot(scopeKey),[scopeKey]),items=React.useSyncExternalStore(subscribe,get,get)
 return {
  items,
  add:(files:readonly File[],clipboard=false)=>{if(preparing.has(scopeKey))throw Error('附件正在准备，请稍后再添加文件。');save(scopeKey,selectAssistantFiles(snapshot(scopeKey),files,clipboard))},
  remove:(id:string)=>{if(!preparing.has(scopeKey))save(scopeKey,snapshot(scopeKey).filter(row=>row.id!==id))},
  retry:(id:string)=>{if(!preparing.has(scopeKey))patch(scopeKey,id,{status:'ready',note:undefined,receiptId:undefined,uploadedFile:undefined,uploadedSessionId:undefined,progress:undefined})},
  prepare:(options:{sessionId:string;imageLimits?:ImageLimits;signal?:AbortSignal;ids?:string[]})=>prepareDraft(scopeKey,options),
  clearSent:(ids:string[])=>{const sent=new Set(ids);save(scopeKey,snapshot(scopeKey).filter(row=>!sent.has(row.id)))},
  markFailed:(ids:string[],note:string)=>{const failed=new Set(ids);save(scopeKey,snapshot(scopeKey).map(row=>failed.has(row.id)?{...row,status:'failed',note,receiptId:undefined,uploadedFile:undefined,uploadedSessionId:undefined,progress:undefined}:row))},
 }
}
function AttachmentPreview({item}:{item:AssistantDraftAttachment}){
 const [url,setUrl]=React.useState('')
 React.useEffect(()=>{if(item.type!=='image'||typeof URL.createObjectURL!=='function')return;const value=URL.createObjectURL(item.file);setUrl(value);return()=>URL.revokeObjectURL(value)},[item.file,item.type])
 return url?<img src={url} alt={item.name} className="wb-attachment-thumbnail"/>:<span className="wb-attachment-symbol"><Icon name={item.type==='image'?'eye':'book'} size={17}/></span>
}
export function AssistantAttachmentCards({items,disabled=false,onRemove,onRetry}:{items:AssistantDraftAttachment[];disabled?:boolean;onRemove:(id:string)=>void;onRetry:(id:string)=>void}){
 if(!items.length)return null
 return <><style>{ATTACHMENT_CSS}</style><div className="wb-assistant-attachments" role="region" aria-label="本轮附件">{items.map(item=><div key={item.id} className={'wb-assistant-attachment'+(item.status==='failed'?' is-failed':'')} aria-label={'附件：'+item.name} title={item.note}>
  <AttachmentPreview item={item}/><div className="wb-attachment-info"><span className="wb-attachment-name" title={item.name}>{item.name}</span><small role="status">{assistantAttachmentSize(item.size)} · {item.status==='uploading'?'正在上传 '+Math.round((item.progress||0)*100)+'%':item.status==='reading'?'正在读取':item.status==='failed'?'准备失败':item.status==='prepared'?'已准备':'待发送'}</small>{item.note&&<span className="wb-attachment-note">{item.note}</span>}</div>
  {['reading','uploading'].includes(item.status)?<Spinner size={13}/>:<div className="wb-attachment-actions">{item.status==='failed'&&<button type="button" className="wb-link" disabled={disabled} onClick={()=>onRetry(item.id)}>重试</button>}<button type="button" className="wb-iconbtn" aria-label={'移除附件：'+item.name} disabled={disabled} onClick={()=>onRemove(item.id)}><Icon name="close" size={13}/></button></div>}
 </div>)}</div></>
}
export function attachmentDragHandlers(add:(files:File[],clipboard?:boolean)=>void,disabled=false){return {
 onDragOver:(event:React.DragEvent)=>{if(Array.from(event.dataTransfer?.types||[]).includes('Files'))event.preventDefault()},
 onDrop:(event:React.DragEvent)=>{const files=Array.from(event.dataTransfer?.files||[]);if(!files.length)return;event.preventDefault();if(!disabled)add(files)},
 onPaste:(event:React.ClipboardEvent)=>{const files=Array.from(event.clipboardData?.files||[]);if(!files.length)return;event.preventDefault();if(!disabled)add(files,true)},
}}
export function AssistantAddMaterials({data,refs,disabled=false,onAddFiles}:{data:any;refs:AssistantContextRef[];disabled?:boolean;onAddFiles:(files:File[],clipboard?:boolean)=>void}){
 const [menu,setMenu]=React.useState(false),[picker,setPicker]=React.useState(false),[error,setError]=React.useState(''),anchor=React.useRef<HTMLDivElement>(null),trigger=React.useRef<HTMLButtonElement>(null),chooser=React.useRef<HTMLInputElement>(null),chooserTarget=React.useRef<typeof onAddFiles|null>(null)
 React.useEffect(()=>{if(!menu)return;const close=(event:MouseEvent)=>{if(!anchor.current?.contains(event.target as Node))setMenu(false)},escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMenu(false);trigger.current?.focus()}};document.addEventListener('mousedown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',escape)}},[menu])
 React.useEffect(()=>{if(menu)anchor.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()},[menu])
 React.useEffect(()=>{if(disabled)setMenu(false)},[disabled])
 const moveMenu=(event:React.KeyboardEvent)=>{const keys=['ArrowDown','ArrowUp','Home','End'];if(!keys.includes(event.key))return;const items=Array.from(anchor.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')||[]);if(!items.length)return;event.preventDefault();const at=items.indexOf(document.activeElement as HTMLButtonElement),next=event.key==='Home'?0:event.key==='End'?items.length-1:(at+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next].focus()}
 return <><style>{ATTACHMENT_CSS}</style><div className="wb-assistant-add-materials" ref={anchor}>
  <button ref={trigger} type="button" className="wb-iconbtn" disabled={disabled} aria-label="添加资料" title="上传附件或引用事项" aria-haspopup="menu" aria-expanded={menu} onClick={()=>{setMenu(!menu);setError('')}}><Icon name="plus" size={16}/></button>
  <input ref={chooser} type="file" multiple aria-label="选择助手附件" style={{display:'none'}} disabled={disabled} onChange={event=>{try{(chooserTarget.current||onAddFiles)(Array.from(event.target.files||[]));setError('')}catch(failure:any){setError(failure.message||'无法添加附件')}finally{chooserTarget.current=null;event.target.value=''}}}/>
  {menu&&<div className="wb-assistant-add-menu" role="menu" aria-label="添加资料方式" onKeyDown={moveMenu}><button type="button" role="menuitem" onClick={()=>{chooserTarget.current=onAddFiles;setMenu(false);chooser.current?.click()}}><Icon name="upload" size={17}/><span>上传附件<small>图片、文档或其他文件</small></span></button><button type="button" role="menuitem" onClick={()=>{setMenu(false);setPicker(true)}}><Icon name="link" size={17}/><span>引用事项<small>待办、待回复、消息、资讯与知识</small></span></button></div>}
  {error&&<span role="alert" className="wb-attachment-picker-error">{error}</span>}
 </div><AssistantContextPicker data={data} refs={refs} open={picker} onOpenChange={value=>{setPicker(value);if(!value)trigger.current?.focus()}} hideTrigger disabled={disabled}/></>
}
const ATTACHMENT_CSS=`.wb-assistant-attachments{display:flex;flex-wrap:wrap;gap:7px;min-width:0;margin-bottom:8px;max-height:180px;overflow:auto}.wb-assistant-attachment{display:flex;align-items:center;gap:8px;max-width:100%;min-width:0;padding:7px 8px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:9px}.wb-assistant-attachment.is-failed{border-color:color-mix(in srgb,var(--dsw-alias-status-warning,var(--dsw-alias-label-secondary)) 50%,var(--dsw-alias-border-l1))}.wb-attachment-thumbnail{width:34px;height:34px;object-fit:cover;flex:none;border-radius:5px}.wb-attachment-symbol{width:28px;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);flex:none}.wb-attachment-info{min-width:0;display:flex;flex-direction:column;gap:3px;max-width:280px;overflow-wrap:anywhere}.wb-attachment-name{font-size:12px;line-height:1.5}.wb-attachment-info small,.wb-attachment-note{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary)}.wb-attachment-actions{display:flex;align-items:center;gap:5px;flex:none}.wb-attachment-actions .wb-link{font-size:11px}.wb-assistant-add-materials{position:relative;flex:none}.wb-assistant-add-menu{position:absolute;left:0;bottom:calc(100% + 8px);width:264px;max-width:min(264px,calc(100vw - 64px));padding:5px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:11px;box-shadow:0 8px 28px #0002;z-index:10}.wb-assistant-add-menu>button{display:flex;align-items:center;gap:11px;width:100%;padding:10px;border:0;border-radius:7px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}.wb-assistant-add-menu>button:hover,.wb-assistant-add-menu>button:focus-visible{background:var(--dsw-alias-bg-layer-1)}.wb-assistant-add-menu>button>span{font-size:12px}.wb-assistant-add-menu small{display:block;margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}.wb-attachment-picker-error{position:absolute;left:0;bottom:calc(100% + 8px);width:264px;max-width:calc(100vw - 64px);padding:9px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);font-size:12px;line-height:1.6;color:var(--dsw-alias-status-error,var(--dsw-alias-label-primary));z-index:10}@media(max-width:480px){.wb-assistant-attachment{width:100%}.wb-attachment-info{max-width:none;flex:1}.wb-assistant-attachments{max-height:140px}}@media(max-height:420px){.wb-assistant-attachments{flex-wrap:nowrap;max-height:28px;min-height:28px;gap:5px;margin-bottom:0;overflow-x:auto;overflow-y:hidden}.wb-assistant-attachment{position:relative;flex:0 0 205px;width:205px;height:28px;box-sizing:border-box;padding:2px 5px;gap:5px}.wb-attachment-thumbnail{width:20px;height:20px}.wb-attachment-symbol{width:20px}.wb-attachment-info{flex:1;max-width:none;gap:0;overflow:hidden}.wb-attachment-name{font-size:10px;line-height:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wb-attachment-info small{font-size:9px;line-height:10px;white-space:nowrap}.wb-attachment-actions{gap:3px}.wb-attachment-actions .wb-link{font-size:10px}.wb-attachment-actions .wb-iconbtn{width:20px;height:20px;min-width:20px}.wb-attachment-note{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.wb-assistant-add-menu{bottom:calc(100% + 4px)}.wb-assistant-add-menu>button{padding:7px 10px}.wb-assistant-add-menu small{margin-top:2px}}`
