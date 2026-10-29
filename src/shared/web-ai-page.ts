import {webAIProvider} from './web-ai.js'
import {WEB_AI_ADAPTERS} from './web-ai-adapters.js'
import {observeWebAIPage,type WebAIPageRequest} from './web-ai-observation.js'
/** Fixed, origin-scoped DOM operations. No arbitrary script/selector or credential access. */
export function webAIPageScript(providerId:string,action:'observe'|'inspect'|'prepare'|'submit',question='',requestId='',ownedAttachmentSignature=''){
 const p=webAIProvider(providerId)
 return '('+pageAction.toString()+')('+JSON.stringify({providerId,hosts:p.hosts,adapter:WEB_AI_ADAPTERS[p.id],action,question,requestId,ownedAttachmentSignature:/^[a-f0-9]{8}$/.test(ownedAttachmentSignature)?ownedAttachmentSignature:''})+','+observeWebAIPage.toString()+')'
}
function pageAction(req:WebAIPageRequest,observe:typeof observeWebAIPage){
 if(location.protocol!=='https:'||!req.hosts.includes(location.hostname))return {status:'unsupported',note:'当前页面不是所选厂商的聊天官网，可能正在登录。'}
 const {state,editor,draft,buttons,find,innermost,text,login,blockedDialog,stopping}=observe(req)
 if(req.action==='observe'||req.action==='inspect')return state
 if(login||blockedDialog||stopping)return {...state,status:login?'needs_login':'unsupported',note:login||blockedDialog?state.note:'官网正在生成，请等待本轮结束。'}
 if(!editor)return state
 const key='__workbenchWebAIRequest'
 const previous=(window as any)[key]
 if(req.action==='prepare'){
  if(draft&&draft!==req.question)return {...state,status:'unsupported',note:'官网已有未发送的草稿，本次未覆盖。'}
  if(previous?.id===req.requestId&&previous.sent)return {...state,status:'uncertain',note:'此问题曾提交过，请在官网核对，不会重复发送。'}
  if(draft===req.question){(window as any)[key]={id:req.requestId,sent:false};return {...state,status:'prepared',note:'官网已包含相同问题，未重复填入。'}}
  ;(editor as HTMLElement).focus()
  if(editor.tagName==='TEXTAREA'||editor.tagName==='INPUT'){
   const proto=editor.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype
   Object.getOwnPropertyDescriptor(proto,'value')?.set?.call(editor,req.question)
   editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:req.question}))
  }else{
   const range=document.createRange();range.selectNodeContents(editor);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)
   // Qianwen's controlled editor must receive its paste handler; DOM-only insertText can leave Send disabled.
   let pasted=false
   if(req.providerId==='qianwen'&&typeof DataTransfer==='function'&&typeof ClipboardEvent==='function'){
    const data=new DataTransfer();data.setData('text/plain',req.question)
    const paste=new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data})
    editor.dispatchEvent(paste)
    pasted=paste.defaultPrevented||text(editor)===req.question
   }
   // Chromium dispatches input itself. Dispatching a second InputEvent duplicates text in some editors.
   if(!pasted&&!document.execCommand('insertText',false,req.question))return {...state,status:'unsupported',note:'官网编辑器未接受自动填入，请直接在网页输入。'}
  }
  ;(window as any)[key]={id:req.requestId,sent:false}
  return {...state,status:'prepared',note:'已填入官网输入框；可在官网检查。'}
 }
 if(req.action==='submit'){
  if(previous?.id!==req.requestId||previous.sent||draft!==req.question)return {...state,status:'uncertain',note:'问题或页面状态已变化，请在官网核对。'}
  // Tailwind variants such as disabled:text-disabled describe possible styling, not current state.
  const enabled=(el:Element)=>!el.matches(':disabled')&&!el.hasAttribute('disabled')&&el.getAttribute('aria-disabled')!=='true'&&![...el.classList].some(token=>/^(?:is-|btn-|button-|send-button-)?disabled$/.test(token))
  const matched=innermost(find(req.adapter.send)),known=matched.filter(enabled)
  const send=known.length?known:buttons.filter(el=>editor?.parentElement?.contains(el)&&[el.getAttribute('aria-label'),el.getAttribute('title'),el.getAttribute('data-testid'),text(el)].some(v=>v&&/^(发送|发送消息|send|send message|send prompt|send-button|chat-input-send-button)$/i.test(v.trim()))).filter(enabled)
  if(send.length!==1)return {...state,status:'prepared',retryableBeforeSend:matched.length===1&&!enabled(matched[0]),note:matched.length===1&&!enabled(matched[0])?'官网发送按钮尚未启用，请在原页面核对草稿。':'尚未识别唯一发送按钮，请在官网发送后采集回答。'}
  const uploads=Object.entries((window as any).__workbenchWebAIUpload||{}).filter(([id])=>id.startsWith(req.requestId+':')).map(([,value])=>value as any)
  const owned=!!state.attachmentSignature&&uploads.some(file=>file.signature===state.attachmentSignature)
  if(state.hasAttachmentDraft&&!state.attachmentsOwned&&!owned)return {...state,status:'unsupported',note:'官网附件已变化或未经确认，未点击发送，请核对原对话'}
  if(owned)(window as any).__workbenchOwnedAttachments=state.attachmentSignature
  ;(window as any)[key]={id:req.requestId,sent:true}
  const target=send[0] as HTMLElement
  if(req.providerId==='glm'){
   const stillPrepared=()=>target.isConnected&&editor.isConnected&&('value'in editor?String((editor as HTMLTextAreaElement).value):text(editor))===req.question
   // The current paper-plane control needs its pointer/mouse press sequence, not a bare HTMLElement.click().
   for(const [name,pressed] of [['pointerdown',true],['mousedown',true],['pointerup',false],['mouseup',false]] as const){
    if(!stillPrepared())break
    const options={bubbles:true,cancelable:true,composed:true,view:window,button:0,buttons:pressed?1:0,detail:1}
    target.dispatchEvent(name.startsWith('pointer')&&typeof PointerEvent==='function'?new PointerEvent(name,{...options,pointerId:1,pointerType:'mouse',isPrimary:true}):new MouseEvent(name,options))
   }
   if(stillPrepared())target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,composed:true,view:window,button:0,detail:1}))
  }else target.click()
  return {...state,status:'generating',note:'已点击官网发送，等待新回答。'}
 }
 return {status:'unsupported',note:'不支持的网页操作。'}
}
