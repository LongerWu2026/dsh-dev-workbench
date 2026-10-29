import {webAIProvider} from './web-ai.js'
import {WEB_AI_ADAPTERS} from './web-ai-adapters.js'
import {observeWebAIPage,type WebAIPageRequest} from './web-ai-observation.js'
import {normalizeWebAIAttachments,type WebAIFile,type WebAIAttachment} from './web-ai-attachments.js'
export function webAIUploadScript(providerId:string,action:'upload'|'attachment-status'|'attachment-verify',files:(WebAIFile|WebAIAttachment)[],question:string,requestId:string,ownedAttachmentSignature=''){
 normalizeWebAIAttachments(files)
 const p=webAIProvider(providerId)
 const payload={providerId,hosts:p.hosts,adapter:WEB_AI_ADAPTERS[p.id],action,files,question,requestId,ownedAttachmentSignature:/^[a-f0-9]{8}$/.test(ownedAttachmentSignature)?ownedAttachmentSignature:''}
 return '('+uploadOnWebsite.toString()+')('+JSON.stringify(payload)+','+observeWebAIPage.toString()+')'
}
/** Runs only inside the approved vendor guest. No host path, fetch, cookie, or credential API. */
function uploadOnWebsite(req:WebAIPageRequest&{files:(WebAIFile|WebAIAttachment)[]},observe:typeof observeWebAIPage){
 if(location.protocol!=='https:'||!req.hosts.includes(location.hostname))return {status:'unsupported',note:'当前不是所选官网，未上传附件'}
 const {state,editor,find,text,stopping,login,blockedDialog,innermost,composer,attachmentNodes,previewImages}=observe(req)
 if(login||blockedDialog||stopping||!editor)return {status:'unsupported',note:state.note||'请先在官网结束当前操作'}
 const key='__workbenchWebAIUpload',all=(window as any)[key]||((window as any)[key]={}),record=all[req.requestId]
 const scope=composer||editor.parentElement||editor
 const busy=find(['[role="progressbar"]','[aria-busy="true"]','[class*="uploading"]','[class*="Uploading"]'],scope).length>0||/上传中|解析中|uploading|processing file/i.test(text(scope))
 const errors=find(['[role="alert"]','[class*="toast"]','[class*="Toast"]']).some(el=>/上传.{0,4}失败|解析失败|不支持.{0,12}格式|格式.{0,8}不支持|文件.{0,8}过大|upload failed|unsupported file|file too large|couldn.t upload/i.test(text(el)))
 const names=req.files.map(f=>f.name)
 const matching=req.files.filter(file=>attachmentNodes.some(el=>{
  const values=[text(el),el.getAttribute('title')||'',el.getAttribute('aria-label')||'',el.getAttribute('alt')||'']
  // ChatGPT may rename repeated uploads to name(2).ext. Accept only that
  // numeric suffix, retaining the exact original basename and extension.
  const dot=file.name.lastIndexOf('.'),escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  const renamed=dot>0?new RegExp(escape(file.name.slice(0,dot))+'\\s*\\(\\d{1,4}\\)'+escape(file.name.slice(dot))+'(?=$|[\\s）)»”"\\]])'):null
  if(values.some(value=>value.includes(file.name)||!!renamed?.test(value)))return true
  const display=(file.name.replace(/\.[^.]+$/,'')+' '+file.name.split('.').at(-1)).toLowerCase().replace(/\s+/g,' ')
  return values.some(value=>{const compact=value.toLowerCase().replace(/\s+/g,' ').trim();return compact.startsWith(display+' ')&&/\b\d+(?:\.\d+)?\s*(?:bytes|b|kb|mb|gb)\b/i.test(compact)})
 })).map(file=>file.name)
 const thumbs=previewImages.length
 const send=innermost(find(req.adapter.send))
 const enabled=send.length===1&&!send[0].matches(':disabled')&&send[0].getAttribute('aria-disabled')!=='true'&&![...send[0].classList].some(c=>/^(?:is-|btn-|button-|send-button-)?disabled$|(?:^|_)disabled(?:_|$)/.test(c))
 const imageOnly=req.files.every(f=>f.type.startsWith('image/'))
 if(req.action==='attachment-verify'){
  const records=req.files.map(file=>all[req.requestId+':'+file.id])
  if(records.some(record=>!record))return {status:'unsupported',note:'部分附件没有本轮上传记录，问题未发送'}
  const missingImages=req.files.filter(file=>file.type.startsWith('image/')&&!matching.includes(file.name)).length
  const docs=req.files.filter(file=>!file.type.startsWith('image/'))
  const received=docs.every(file=>matching.includes(file.name))&&(!missingImages||thumbs>=Math.min(...records.map(record=>record.thumbs))+missingImages)
  return {status:!errors&&received&&!busy&&enabled?'attached':'unsupported',signature:state.attachmentSignature,note:errors?'官网提示附件上传失败，请检查原对话':busy?'附件仍在处理，问题未发送':!received?'官网未保留全部附件，问题未发送，请检查原对话':!enabled?'官网发送按钮未就绪，问题未发送':'附件已全部就绪'}
 }
 if(req.action==='attachment-status'){
  if(!record)return {status:'unsupported',note:'网页已变化，无法确认附件；请在原对话核对，不自动重传'}
  const received=matching.length===names.length||imageOnly&&thumbs>=record.thumbs+names.length
  if(!errors&&received&&!busy&&enabled)record.signature=state.attachmentSignature
  return {status:errors?'unsupported':received&&!busy&&enabled?'attached':'uploading',note:errors?'官网提示附件上传失败，请在原对话处理':received?'附件已出现在官网，等待就绪':'等待官网显示附件',received,busy,matched:matching.length,thumbs,signature:state.attachmentSignature}
 }
 if(record)return {status:'uploading',note:'此轮已尝试上传，不重复传输'}
 const prefix=req.requestId.slice(0,req.requestId.lastIndexOf(':')+1),ownsFiles=Object.keys(all).some(id=>id.startsWith(prefix))
 if((state.hasAttachmentDraft||thumbs)&&!ownsFiles&&!state.attachmentsOwned||matching.length>0&&!ownsFiles)return {status:'unsupported',note:'官网已有附件草稿或同名文件，未覆盖或重复上传，请在原对话处理'}
 if(state.hasDraft&&!state.draftMatchesQuestion)return {status:'unsupported',note:'官网有其他草稿，未上传附件'}
 const candidates=(req.adapter.uploadInputs||[]).flatMap(s=>[...document.querySelectorAll<HTMLInputElement>(s)]).filter(el=>!el.disabled)
 const accepts=(input:HTMLInputElement)=>req.files.every(f=>!input.accept||input.accept.split(',').some(raw=>{const a=raw.trim().toLowerCase();return a==='*'||a==='*/*'?true:a.startsWith('.')?f.name.toLowerCase().endsWith(a):a.endsWith('/*')?f.type.startsWith(a.slice(0,-1)):f.type===a}))
 let eligible=[...new Set(candidates)].filter(accepts)
 const specific=eligible.filter(input=>!!input.accept.trim());if(specific.length===1)eligible=specific
 if(eligible.length>1)return {status:'unsupported',note:'官网附件入口不唯一，未上传；请在原对话处理'}
 if(candidates.length&&!eligible.length)return {status:'unsupported',note:'当前官网入口不支持这些附件格式，请在原对话选择合适模式'}
 let files:File[]
 try{files=req.files.map(f=>{const data=(f as WebAIFile).base64;if(typeof data!=='string'||data.length>14000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw Error();const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));if(bytes.length!==f.size)throw Error();return new File([bytes],f.name,{type:f.type})})}catch{return {status:'unsupported',note:'附件数据无效，未上传'}}
 if(eligible.length===1&&!eligible[0].multiple&&files.length>1)return {status:'unsupported',note:'官网当前仅支持单个附件，请拆分处理'}
 const transfer=new DataTransfer();files.forEach(file=>transfer.items.add(file))
 const forward=(input?:HTMLInputElement)=>{
  if(input&&!accepts(input))return {status:'unsupported',note:'官网当前入口不支持此附件格式'}
  if(input&&!input.multiple&&files.length>1)return {status:'unsupported',note:'官网当前只接受单个文件'}
  for(const old of Object.keys(all).slice(0,-50))delete all[old]
  all[req.requestId]={thumbs,names}
  if(input){input.files=transfer.files;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))}
  else{(editor as HTMLElement).focus();if(imageOnly&&req.adapter.uploadMethod!=='drop')editor.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));else for(const action of ['dragenter','dragover','drop'])editor.dispatchEvent(new DragEvent(action,{bubbles:true,cancelable:true,composed:true,dataTransfer:transfer}))}
  return {status:'uploading',note:'已交给官网上传；确认就绪前不会发送问题'}
 }
 const captureInput=async(target:HTMLElement)=>{
  // The user already selected a File. Capture the site's transient input instead of opening a second OS picker.
  const proto=HTMLInputElement.prototype,click=proto.click,clickOwn=Object.getOwnPropertyDescriptor(proto,'click'),pickerOwn=Object.getOwnPropertyDescriptor(proto,'showPicker'),captured:HTMLInputElement[]=[]
  const capture=function(this:HTMLInputElement){if(this.type==='file'){captured.push(this);return}return click.call(this)}
  try{
   Object.defineProperty(proto,'click',{configurable:true,writable:true,value:capture})
   if(pickerOwn)Object.defineProperty(proto,'showPicker',{configurable:true,writable:true,value:capture})
   ;target.click();await new Promise(resolve=>setTimeout(resolve,250))
  }finally{if(clickOwn)Object.defineProperty(proto,'click',clickOwn);else delete (proto as any).click;if(pickerOwn)Object.defineProperty(proto,'showPicker',pickerOwn)}
  const inputs=[...new Set(captured)].filter(accepts)
  if(inputs.length!==1)return {status:'unsupported',note:'官网未提供唯一附件输入，未传输文件，请在原对话操作'}
  return forward(inputs[0])
 }
 if(!eligible.length&&req.adapter.uploadDirect){const target=find([req.adapter.uploadDirect]);return target.length===1?captureInput(target[0] as HTMLElement):{status:'unsupported',note:'未识别唯一官网文件上传按钮，问题未发送'}}
 if(!eligible.length&&req.adapter.uploadLaunch)return (async()=>{
  const launch=req.adapter.uploadLaunch!,labels=imageOnly?launch.imageLabels:launch.fileLabels
  const menu=()=>innermost(find(['[role^="menuitem"]','[role="menu"] *','[data-radix-popper-content-wrapper] *','[role="option"]']).filter(el=>labels.some(label=>{const value=text(el).replace(/[\u200b-\u200f\ufeff]/g,'').trim();return value===label||value.startsWith(label+'\n')})))[0]
  if(!menu()){
   const trigger=find([launch.trigger]);if(trigger.length!==1)return {status:'unsupported',note:'未识别官网附件菜单，问题未发送'}
   const target=trigger[0] as HTMLElement
   for(const name of ['pointerdown','mousedown','pointerup','mouseup']){const options={bubbles:true,cancelable:true,composed:true,button:0,buttons:name.endsWith('down')?1:0,view:window,pointerId:1,pointerType:'mouse',isPrimary:true};target.dispatchEvent(name.startsWith('pointer')&&typeof PointerEvent==='function'?new PointerEvent(name,options):new MouseEvent(name,options))}
   await new Promise(resolve=>setTimeout(resolve,30))
   const created=[...document.querySelectorAll('[role="menu"]')].some(el=>labels.some(label=>text(el).includes(label)))
   if(!created)target.click()
  }
  const menuUntil=Date.now()+1800;while(!menu()&&Date.now()<menuUntil)await new Promise(resolve=>setTimeout(resolve,50))
  const item=menu();if(!item)return {status:'unsupported',note:'官网附件菜单暂不支持此类型，问题未发送，请在原对话操作'}
  return captureInput(item as HTMLElement)
 })()
 return forward(eligible[0])
}
