import type {WebAIAdapter} from './web-ai-adapters.js'

export interface WebAIPageRequest {
 providerId:string;hosts:readonly string[];adapter:WebAIAdapter;action:string;question:string;requestId:string;ownedAttachmentSignature?:string
}

/** Serialized into the approved guest. Keep every runtime dependency inside this function. */
export function observeWebAIPage(req:WebAIPageRequest){
 const visible=(el:Element)=>{
  if(!el.getClientRects().length&&getComputedStyle(el).display!=='contents'||el.closest('[hidden],[aria-hidden="true"],[inert]'))return false
  for(let node:Element|null=el;node;node=node.parentElement){const s=getComputedStyle(node);if(s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||s.opacity==='0')return false;if(node.matches('.sr-only,.visually-hidden,.screen-reader-only'))return false;if(s.display!=='contents'){const r=node.getBoundingClientRect();if(/hidden|clip/.test(s.overflowY)&&r.height===0||/hidden|clip/.test(s.overflowX)&&r.width===0)return false}}
  return true
 }
 const text=(el:Element)=>((el as HTMLElement).innerText||el.textContent||'').trim()
 const order=(a:Element,b:Element)=>a===b?0:a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1
 const find=(selectors:readonly string[],root:ParentNode=document)=>[...new Set(selectors.flatMap(s=>[...root.querySelectorAll(s)]))].filter(visible).sort(order)
 const innermost=(elements:Element[])=>elements.filter(el=>!elements.some(other=>other!==el&&el.contains(other)))
 const outermost=(elements:Element[])=>elements.filter(el=>!elements.some(other=>other!==el&&other.contains(el)))
 const enabled=(el:Element)=>!el.matches(':disabled')&&!el.hasAttribute('disabled')&&el.getAttribute('aria-disabled')!=='true'&&![...el.classList].some(t=>/^(?:is-|btn-|button-|send-button-)?disabled$/.test(t))
 const buttons=find(['button','[role="button"]'])
 const label=(el:Element)=>[el.getAttribute('aria-label'),el.getAttribute('title'),text(el)].filter(Boolean).join(' ').trim()
 const stopping=find(req.adapter.busy).length>0||buttons.some(el=>/停止生成|停止回答|停止输出|停止对话|stop generating|stop response|stop streaming|^停止$|^Stop$/i.test(label(el)))
 const dialogs=find(['[role="dialog"]','dialog','[class*="login-modal"]','[class*="loginModal"]'])
 const verification=find(['#aliyunCaptcha-window-popup','#aliyunCaptcha-popup','.baxia-dialog','iframe[src*="baxia"]','iframe[src*="captcha"]','iframe[src*="/_____tmd_____"]','[class*="geetest_panel"]','[class*="captcha-modal"]']).at(0)
 const login=verification||dialogs.find(el=>/登录|sign in|log in/i.test(text(el))&&!!el.querySelector('input[type="tel"],input[type="password"],input[autocomplete="one-time-code"],input[autocomplete="username"],iframe[src*="login"],[class*="qrcode"],[class*="qr-code"]'))
 const blockedDialog=dialogs.find(el=>el!==login)
 const usable=(el:Element)=>!el.closest('[role="dialog"]')&&!el.hasAttribute('disabled')&&!(req.providerId==='chatgpt'&&el.id==='pending-home-input')
 const preferred=find(req.adapter.inputs).filter(usable)
 const editors=(preferred.length?preferred:find(['textarea:not([disabled])','[contenteditable="true"]'])).filter(usable)
 const editor=editors.length===1?editors[0]:null
 let draft=editor?('value'in editor?String((editor as HTMLTextAreaElement).value):text(editor).replace(/[\u200b\ufeff]/g,'')):''
 if(editor&&!('value'in editor)){for(const p of editor.querySelectorAll('[data-slate-placeholder],[data-lexical-placeholder]'))draft=draft.replace(text(p),'');draft=draft.trim()}

 const composerScopes:Element[]=[]
 if(editor)for(let node=editor.parentElement;node&&node!==document.body&&composerScopes.length<9;node=node.parentElement){if(req.adapter.answers.some(selector=>node!.querySelector(selector)))break;composerScopes.push(node);if(req.adapter.send.some(selector=>node!.querySelector(selector)))break}
 const explicitComposer=req.adapter.composer?editor?.closest(req.adapter.composer):null
 // Some sites remove the send control when the editor is empty. Keep their known
 // composer boundary instead of expanding into footer logos and navigation.
 const composer=explicitComposer||composerScopes.at(-1)||editor?.parentElement||null
 const attachmentNodes=composer?find(['*'],composer).filter(el=>!el.contains(editor)&&!editor?.contains(el)&&!el.closest('nav,aside')&&!el.matches('input,textarea,script,style')):[]
 const qianwenFileImage=(el:Element)=>req.providerId==='qianwen'&&el.matches('img')&&!!el.closest('[class*="imageThumbWrapper-"]')&&!!el.closest('[class*="fileWrap-"]')
 const previewImages=attachmentNodes.filter(el=>qianwenFileImage(el)||(el.matches('img')||/url\(/.test(getComputedStyle(el).backgroundImage))&&!/icon|avatar|头像|profile/i.test([el.getAttribute('class'),el.getAttribute('alt'),el.getAttribute('aria-label'),el.getAttribute('title')].filter(Boolean).join(' '))&&!/^(?:txt|pdf|docx?|xlsx?|pptx?)$/i.test(el.getAttribute('alt')||'')&&!/\/(?:txt|pdf|docx?|xlsx?|pptx?)[_-](?:normal|icon)/i.test(el.getAttribute('src')||''))
 const filePreviewNodes=attachmentNodes.filter(el=>previewImages.includes(el)||/file|attach/i.test(el.getAttribute('class')||el.getAttribute('data-testid')||'')&&/\.(?:png|jpe?g|webp|gif|txt|md|csv|json|log|pdf|docx?|xlsx?|pptx?)(?:$|[\s）)])/i.test(text(el)))
 const documentPreviews=attachmentNodes.filter(el=>/\b(?:TXT|PDF|MD|CSV|JSON|DOCX?|XLSX?|PPTX?)\s+\d+(?:\.\d+)?\s*(?:Bytes|B|KB|MB|GB)\b/i.test(text(el)))
 const attachmentPreviews=outermost([...new Set([...filePreviewNodes,...documentPreviews])])
 const hasAttachmentDraft=attachmentPreviews.length>0

 const ignored='script,style,button,[role="button"],svg,nav,aside,[hidden],[aria-hidden="true"],.thinking-content,.reasoning-content,.think-content,[data-role="reasoning"],[data-testid="thinking"]'
 const render=(node:Node):string=>{
  if(node.nodeType===Node.TEXT_NODE)return node.textContent||''
  if(!(node instanceof Element)||node.matches(ignored)||!visible(node))return ''
  if(node.matches('.cm-content'))return '\n\n```\n'+[...node.children].filter(el=>el.classList.contains('cm-line')).map(el=>el.textContent||'').join('\n').replace(/\u00a0/g,' ')+'\n```\n\n'
  if(node.tagName==='PRE'){
   const code=node.querySelector('code'),language=code?.className.match(/language-([\w+-]+)/)?.[1]||''
   const source=code||node,copy=source.cloneNode(true) as Element
   for(const el of copy.querySelectorAll('*'))if(el.matches('button,svg,[role="button"],[aria-hidden="true"]')||/line[-_]?numbers?|linenumber|lineno/i.test(el.getAttribute('class')||''))el.remove()
   return '\n\n```'+language+'\n'+(copy.textContent||'').replace(/\u00a0/g,' ').trimEnd()+'\n```\n\n'
  }
  if(node.tagName==='BR')return '\n'
  const content=[...node.childNodes].map(render).join('')
  if(node.tagName==='A'){
   try{const url=new URL(node.getAttribute('href')||'',location.href);if(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&content.trim())return '['+content.trim()+']('+url.href+')'}catch{}
  }
  if(/^H[1-6]$/.test(node.tagName))return '\n\n'+'#'.repeat(Number(node.tagName[1]))+' '+content.trim()+'\n\n'
  if(node.tagName==='LI'){
   const list=node.parentElement
   if(list?.tagName==='OL'){
    const items=[...list.children].filter(el=>el.tagName==='LI'),step=list.hasAttribute('reversed')?-1:1
    let number=Number(list.getAttribute('start')||(step<0?items.length:1))
    for(const item of items){if(item.hasAttribute('value'))number=Number(item.getAttribute('value'));if(item===node)break;number+=step}
    return '\n'+number+'. '+content.trim()
   }
   return '\n- '+content.trim()
  }
  if(node.tagName==='TR')return '\n'+[...node.children].map(el=>render(el).trim()).join(' | ')
  if(node.tagName==='CODE')return '`'+content+'`'
  return /^(P|DIV|SECTION|UL|OL|TABLE|BLOCKQUOTE)$/.test(node.tagName)?'\n'+content+'\n':content
 }
 const bodyText=(el:Element)=>render(el).trim()
 const users=innermost(find(req.adapter.users).filter(el=>!el.closest('nav,aside')))
 const primary=find(req.adapter.answers)
 const bodies=[...primary,...find(req.adapter.fallbackAnswers||[]).filter(root=>!primary.some(body=>root.contains(body)))].sort(order).filter(el=>!el.closest('nav,aside,.thinking-content,.reasoning-content,.think-content,[data-role="reasoning"]'))
 const groups=new Map<Element,Element[]>()
 for(const body of bodies){const root=(req.adapter.roots||[]).map(s=>body.closest(s)).find(Boolean)||body;groups.set(root,[...(groups.get(root)||[]),body])}
 const roots=[...groups.keys()].sort(order)
 const fingerprint=(value:string)=>{let hash=2166136261;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);return (hash>>>0).toString(16).padStart(8,'0')}
 const observations=(window as any).__workbenchWebAIObservations||((window as any).__workbenchWebAIObservations={nodes:new WeakMap<Element,string>(),next:0,prefix:Math.round(performance.timeOrigin).toString(36)})
 const identity=(el:Element)=>{
  const key=el.getAttribute('data-message-id')||el.closest('[data-turn-key]')?.getAttribute('data-turn-key')||el.closest('[data-content-search-turn-key]')?.getAttribute('data-content-search-turn-key')
  if(key&&key.length<=300){const value=req.providerId+'|'+location.pathname+'|'+key;return 'site-'+fingerprint(value)+fingerprint(value.split('').reverse().join(''))}
  let id=observations.nodes.get(el);if(!id){id=observations.prefix+'-'+(++observations.next);observations.nodes.set(el,id)}return id as string
 }
 const normalize=(s:string)=>s.replace(/\s+/g,' ').trim()
 const finishedSelector=['[data-streaming="false"]','[data-is-streaming="false"]','[data-status="completed"]','[data-status="finished"]',...(req.adapter.finished||[])].join(',')
 const turns=roots.map((root,ordinal)=>{
  const user=users.filter(el=>root.contains(el)||!!(el.compareDocumentPosition(root)&Node.DOCUMENT_POSITION_FOLLOWING)).at(-1)
  const question=user?text(user):null,userIndex=user?users.indexOf(user):null
  const selected=ordinal>=roots.length-8||!!req.question&&!!question&&normalize(question)===normalize(req.question)
  if(!selected)return null
  const content=outermost(groups.get(root)!).map(bodyText).filter(Boolean).join('\n\n')
  const scopedFinish=(el:Element)=>{for(let node:Element|null=el;node&&node!==root.parentElement;node=node.parentElement)if(node.matches(finishedSelector))return true;return false}
  const parts=groups.get(root)!,attribute=scopedFinish(root)||outermost(parts).every(scopedFinish)
  const scope=(req.adapter.endScope?root.closest(req.adapter.endScope):null)||root
  const composerReady=!req.adapter.ready?.length||find(req.adapter.ready).length>0
  const endControl=composerReady&&(req.adapter.done||[]).some(selector=>find([selector],scope).some(enabled))
  const completionEvidence=attribute?'attribute':endControl?'turn-control':null
  return {id:identity(root),ordinal,question,userIndex,text:content.slice(0,60000),truncated:content.length>60000,complete:!stopping&&!!completionEvidence,completionEvidence}
 }).filter((t):t is NonNullable<typeof t>=>t!==null)
 const last=turns.at(-1)
 const attachmentSignature=hasAttachmentDraft?fingerprint(attachmentPreviews.map(el=>text(el)+'|'+(el.getAttribute('src')||'')+'|'+getComputedStyle(el).backgroundImage).join('||')+'|images|'+previewImages.map(el=>(el.getAttribute('src')||'')+'|'+getComputedStyle(el).backgroundImage).join('||')):''
 const attachmentsOwned=!!attachmentSignature&&((window as any).__workbenchOwnedAttachments===attachmentSignature||req.ownedAttachmentSignature===attachmentSignature)
 const state:any={status:login?'needs_login':blockedDialog?'unsupported':stopping?'generating':editor?'ready':'unsupported',note:login?(verification?'官网需要本人完成安全验证，请在原页面处理；本轮不会自动重发。':'请在官网完成登录。'):blockedDialog?'官网有弹窗，请先在原页面处理后再试。':!editor?(req.providerId==='chatgpt'&&document.querySelector('#pending-home-input')?'官网编辑器仍在初始化，请稍后重试。':'尚未识别唯一的官网输入框，可直接在网页聊天。'):'',url:location.href,answers:turns.slice(-8).map(t=>t.text),answerCount:roots.length,userCount:users.length,lastQuestion:users.length?text(users.at(-1)!).slice(0,12000):null,complete:last?.complete===true,completionEvidence:last?.completionEvidence||null,busy:stopping,hasDraft:!!draft,draftMatchesQuestion:!!editor&&draft===req.question,answerSupported:roots.length>0,editorCount:editors.length,hasAttachmentDraft,attachmentSignature,attachmentsOwned,turns}
 state.conversationKey=fingerprint(location.pathname+'?'+[...new URLSearchParams(location.search)].filter(([key])=>['chatId','conversationId','conversation_id','sessionId','dialogueId','cid'].includes(key)).map(([k,v])=>k+'='+v).join('&'));state.lastAnswerId=last?.id||null;state.lastAnswerHash=last?fingerprint(last.text):null
 if(req.action==='inspect'){
  const describe=(el:Element)=>({tag:el.tagName.toLowerCase(),class:(el.getAttribute('class')||'').slice(0,160),id:el.id.slice(0,80),testId:el.getAttribute('data-testid')||'',role:el.getAttribute('role')||'',label:(el.getAttribute('aria-label')||el.getAttribute('title')||el.getAttribute('alt')||'').slice(0,80),icon:(el.getAttribute('src')||'').match(/([^/?#]+\.(?:svg|png|webp))(?:[?#].*)?$/i)?.[1]?.slice(0,80)||el.getAttribute('href')?.match(/^#[\w-]+$/)?.[0]||'',disabled:!enabled(el)})
  const ancestry=(el:Element)=>{const out=[];for(let p=el.parentElement;p&&out.length<6;p=p.parentElement)out.push({tag:p.tagName.toLowerCase(),class:(p.getAttribute('class')||'').slice(0,90),role:p.getAttribute('role')||''});return out}
  const parents:Element[]=[];for(let p=editor?.parentElement;p&&parents.length<6;p=p.parentElement)parents.push(p)
  const area=composer||parents.at(-1)
  const controls=area?find(['button','[role="button"]','[class*="send"]','[class*="Send"]','img'],area).slice(0,30).map(describe):[]
  const samples=roots.length?roots.slice(-2):outermost(find(['[class*="markdown"]','[class*="assistant-message"]'])).slice(-2)
  const messages=samples.map(el=>({...describe(el),parents:ancestry(el)}))
  const finalControls=find(['button','[role="button"]','[title]','[aria-label]','.simple-button']).filter(el=>!el.closest('nav,aside')&&/复制|赞|重试|重新生成|copy|regenerate|good response|bad response|read aloud/i.test(label(el))).slice(-25).map(el=>({...describe(el),parents:ancestry(el)}))
  const answerWidgets=samples.flatMap(root=>find(['button','[role="button"]','img','svg','use','[aria-label]','[title]','.simple-button','[class*="action"]','[class*="toolbar"]'],(req.adapter.endScope?root.closest(req.adapter.endScope):null)||root).slice(-30).map(describe))
  const contentFrames=find(['article','[data-testid*="conversation-turn"]','[class*="assistant"]','[class*="thread-turn"]','[class*="prose"]','[class*="message-content"]']).filter(el=>!el.contains(editor)&&!el.closest('nav,aside')).slice(-12).map(el=>({...describe(el),children:[...el.children].slice(0,4).map(child=>({tag:child.tagName.toLowerCase(),class:(child.getAttribute('class')||'').slice(0,90)}))}))
  const bodyParts=samples.flatMap(root=>(groups.get(root)||[]).map(el=>({...describe(el),length:text(el).length,parents:ancestry(el)})))
  const codeShapes=samples.flatMap(root=>find(['pre','.cm-content'],root).slice(-2).flatMap(pre=>[pre,...pre.querySelectorAll('*')].slice(0,25).map(describe)))
  const terminal=buttons.filter(el=>/regenerate response|重新生成|regenerate|read aloud/i.test(label(el))).at(-1)
  const endAncestors=[];for(let node=terminal?.parentElement;node&&endAncestors.length<8;node=node.parentElement)endAncestors.push({...describe(node),rawLength:text(node).length,attributes:[...node.attributes].map(a=>a.name).filter(n=>n.startsWith('data-')),children:[...node.children].slice(0,5).map(el=>({tag:el.tagName.toLowerCase(),class:(el.getAttribute('class')||'').slice(0,80),length:text(el).length,display:getComputedStyle(el).display}))})
  const userStructure=users.at(-1)?[users.at(-1)!,...users.at(-1)!.querySelectorAll('*')].slice(0,12).map(describe):[]
  const inputVariants=find(['textarea','[contenteditable]']).slice(0,8).map(el=>({...describe(el),editable:el.getAttribute('contenteditable')}))
  const fileInputs=[...document.querySelectorAll('input[type="file"]')].map(el=>({...describe(el),accept:el.getAttribute('accept')||'',multiple:el.hasAttribute('multiple'),parents:ancestry(el)}))
  const uploadControls=(composer?find(['button','[role="button"]','[title]','[aria-label]'],composer):[]).filter(el=>/上传|附件|文件|图片|attach|upload|add files/i.test(label(el))).slice(-12).map(el=>({...describe(el),parents:ancestry(el)}))
  const attachmentShapes=[...document.querySelectorAll('img,canvas,[role="img"],[style*="background-image"]')].filter(el=>visible(el)&&!el.closest('nav,aside')).slice(-16).map(el=>({...describe(el),insideComposer:!!composer?.contains(el),parents:ancestry(el),backgroundImage:/url\(/.test(getComputedStyle(el).backgroundImage)}))
  const uploadLabels=[...(req.adapter.uploadLaunch?.imageLabels||[]),...(req.adapter.uploadLaunch?.fileLabels||[])]
  const uploadMenuItems=[...document.querySelectorAll('[role^="menuitem"],[role="menu"] *')].filter(el=>uploadLabels.some(value=>text(el).startsWith(value))).slice(-10).map(el=>({...describe(el),visible:visible(el),label:text(el).slice(0,80)}))
  state.diagnostics={composer:composer?describe(composer):null,filePreviews:filePreviewNodes.slice(0,12).map(describe),fileInputs,uploadControls,uploadMenuItems,attachmentShapes,editorCount:editors.length,editor:editor?describe(editor):null,parents:parents.map(describe),controls,messages,userStructure,inputVariants,finalControls,answerWidgets,contentFrames,endAncestors,bodyParts,codeShapes,turnSummary:turns.slice(-3).map(({text,question,...t})=>({...t,bodyLength:text.length,questionIdentified:!!question}))}
 }
 return {state,editor,draft,buttons,find,innermost,text,login,blockedDialog,stopping,composer,attachmentNodes,previewImages}
}
