import * as React from 'react'
import {WB,Btn} from '../../core/runtime.js'
import {webAIConversationUrl,webAIProvider} from '../../../shared/web-ai.js'
import {webAIUploadScript} from '../../../shared/web-ai-upload.js'
import type {WebAIFile} from '../../../shared/web-ai-attachments.js'
import {webAIPageScript} from '../../../shared/web-ai-page.js'
import {webAIAuthScript,type WebAIAuthentication} from '../../../shared/web-ai-auth.js'
import {authenticationSummary} from './authentication.js'
import {acquireWebsiteSession,browserSessionMode,browserSessionMessage,nativeWebAIBridge,type BrowserLease,type BrowserSessionMode} from './browser-session.js'
export {nativeWebAIBridge} from './browser-session.js'

interface Guest extends HTMLElement {loadURL(url:string):Promise<void>;getURL():string;executeJavaScript(script:string,userGesture?:boolean):Promise<any>}
export interface WebsiteController {execute(action:'observe'|'inspect'|'prepare'|'submit',question?:string,requestId?:string):Promise<any>;authentication?():Promise<WebAIAuthentication>;navigate(url:string):Promise<void>;releaseInputFocus?():void;attach?(files:WebAIFile[],question:string,requestId:string,signal:AbortSignal):Promise<{status:string;note?:string}>}
export function NativeWebsite({providerId,scope,url,visible,onController,onNavigate,onAuthentication}:{providerId:string;scope:string;url:string;visible:boolean;onController:(controller:WebsiteController|null)=>void;onNavigate?:(url:string)=>void;onAuthentication?:(result:WebAIAuthentication)=>void}){
 const bridge=nativeWebAIBridge(),[lease,setLease]=React.useState<(BrowserLease&{mode:Exclude<BrowserSessionMode,'unavailable'>})|null>(null),[error,setError]=React.useState(''),[loading,setLoading]=React.useState(true),[retry,setRetry]=React.useState(0)
 const guest=React.useRef<Guest|null>(null),ready=React.useRef(false),documentVersion=React.useRef(0),mounted=React.useRef(true),target=React.useRef(url)
 const ownedAttachmentSignature=React.useRef('')
 const navigation=React.useRef(onNavigate);navigation.current=onNavigate
 const authentication=React.useRef(onAuthentication);authentication.current=onAuthentication
 const authRevision=React.useRef(0)
 target.current=url
 const checkAuthentication=React.useCallback(async()=>{
  const node=guest.current,version=documentVersion.current,revision=++authRevision.current
  if(!mounted.current||!node||!ready.current)return authenticationSummary(null)
  let timer:ReturnType<typeof setTimeout>|undefined,result=authenticationSummary(null)
  try{result=authenticationSummary(await Promise.race([node.executeJavaScript(webAIAuthScript(providerId),false),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),3000)})]))}catch{}finally{clearTimeout(timer)}
  if(!mounted.current||version!==documentVersion.current)return authenticationSummary(null)
  if(revision===authRevision.current)authentication.current?.(result)
  return result
 },[providerId])
 const controller=React.useMemo<WebsiteController>(()=>({
  authentication:checkAuthentication,
  async execute(action,question='',requestId=''){
   const until=Date.now()+15000;while(!ready.current&&mounted.current&&Date.now()<until)await new Promise(r=>setTimeout(r,100))
   const node=guest.current;if(!mounted.current||!node||!ready.current)throw new Error('官网仍在加载，请稍后重试')
   if(!webAIConversationUrl(providerId,node.getURL()))throw new Error('请先在官网完成登录并返回聊天页面')
   if(providerId==='glm'&&(action==='prepare'||action==='submit')){
    const deadline=Date.now()+1500;while(node.closest('[inert]')&&mounted.current&&Date.now()<deadline)await new Promise(r=>setTimeout(r,30))
    if(node.closest('[inert]'))throw new Error('智谱提交需要内嵌页面处于可操作状态，请展开官网后再试')
    node.focus({preventScroll:true});await new Promise(r=>setTimeout(r,30))
   }
   if(action==='prepare'||action==='submit'){
    const before=documentVersion.current,auth=await checkAuthentication()
    if(before!==documentVersion.current||!ready.current)throw new Error('官网页面已变化，请重新核对登录状态')
    if(auth.status==='needs_login'||auth.status==='verification')return {status:'needs_login',note:auth.note}
   }
   const version=documentVersion.current;let timer:ReturnType<typeof setTimeout>|undefined
   try{const result=await Promise.race([node.executeJavaScript(webAIPageScript(providerId,action,question,requestId,ownedAttachmentSignature.current),action==='prepare'||action==='submit'),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('官网操作超时，请核对页面；不会自动重发')),10000)})]);if(!mounted.current||version!==documentVersion.current&&!(action==='submit'&&result?.status==='generating'))throw new Error('官网页面已变化，请核对本轮是否已发送');return result}finally{clearTimeout(timer)}
  },
  async attach(files,question,requestId,signal){
   if(signal.aborted)throw new Error('附件处理已停止；请在官网核对，不会自动重传')
   if(providerId==='qianwen'&&files.some(file=>file.type.startsWith('image/'))&&files.some(file=>!file.type.startsWith('image/')))return {status:'unsupported',note:'千问当前网页会用文档覆盖图片，暂不支持混合上传；本轮附件未传输，请将图片与文档分开提问'}
   await controller.execute('observe',question)
   const auth=await checkAuthentication();if(auth.status==='needs_login'||auth.status==='verification')return {status:'needs_login',note:auth.note}
   const node=guest.current;if(!node||!ready.current)throw new Error('官网尚未就绪')
   const visibleUntil=Date.now()+1500;while(node.closest('[inert]')&&Date.now()<visibleUntil)await new Promise(resolve=>setTimeout(resolve,30))
   if(node.closest('[inert]'))throw new Error('上传附件需要展开工作台内嵌官网')
   node.scrollIntoView?.({block:'nearest'});node.focus({preventScroll:true})
   for(const file of files){
    if(signal.aborted)throw new Error('附件处理已停止；请在官网核对，不会自动重传')
    const id=requestId+':'+file.id,version=documentVersion.current
    const execute=async(action:'upload'|'attachment-status')=>{if(signal.aborted||!mounted.current||version!==documentVersion.current)throw new Error('附件处理已停止或页面变化，请在官网核对');let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([node.executeJavaScript(webAIUploadScript(providerId,action,action==='upload'?[file]:[{id:file.id,name:file.name,size:file.size,type:file.type}],question,id,ownedAttachmentSignature.current),action==='upload'),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('官网附件操作超时，请核对页面；不会重传')),10000)})])}finally{clearTimeout(timer)}}
    let result=await execute('upload');if(result.status!=='uploading')return result
    const deadline=Date.now()+90000;let stable=0
    while(Date.now()<deadline){
     await new Promise(resolve=>setTimeout(resolve,1000));result=await execute('attachment-status')
     if(result.status==='unsupported')return result
     if(result.status==='attached'){if(++stable>=2)break}else stable=0
    }
    if(stable<2)return {status:'unsupported',note:'90秒内未确认附件就绪；问题未发送，请在官网核对，不自动重传'}
   }
   if(signal.aborted||!mounted.current)throw new Error('附件处理已停止；不会发送问题')
   let timer:ReturnType<typeof setTimeout>|undefined
   try{
    const result=await Promise.race([node.executeJavaScript(webAIUploadScript(providerId,'attachment-verify',files.map(({base64,...metadata})=>metadata),question,requestId,ownedAttachmentSignature.current),false),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('附件核对超时，请检查官网')),10000)})])
    if(signal.aborted)throw new Error('附件处理已停止；不会发送问题')
    if(result.status==='attached'&&/^[a-f0-9]{8}$/.test(result.signature||''))ownedAttachmentSignature.current=result.signature
    return result
   }finally{clearTimeout(timer)}
  },
  async navigate(next){ownedAttachmentSignature.current='';if(!webAIConversationUrl(providerId,next))throw new Error('官网地址无效');const node=guest.current;if(!node)throw new Error('官网尚未准备好');ready.current=false;documentVersion.current++;authRevision.current++;authentication.current?.(authenticationSummary(null));await node.loadURL(next)},
  releaseInputFocus(){guest.current?.blur()},
 }),[providerId,checkAuthentication])
 React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;ready.current=false}},[])
 React.useEffect(()=>{
  if(!bridge)return;let disposed=false,held:BrowserLease|null=null
  setError('');setLoading(true);setLease(null);ownedAttachmentSignature.current=''
  acquireWebsiteSession(bridge,scope,providerId).then(value=>{if(disposed){void bridge.release(value.lease).catch(()=>{});return}held=value;setLease(value)}).catch(()=>{if(!disposed){setLoading(false);setError(browserSessionMode(bridge)==='persistent'?'持久化官网分区暂不可用，请重试；为保留登录隔离，没有改用临时分区。':'宿主未能创建内嵌网页，请重试。')}})
  return()=>{disposed=true;ready.current=false;if(held)void bridge.release(held.lease).catch(()=>{})}
 },[scope,providerId,retry])
 React.useEffect(()=>{
  const node=guest.current;if(!node||!lease||!bridge)return
  let disposed=false,initial=true
  const loading=()=>{ready.current=false;documentVersion.current++;authRevision.current++;authentication.current?.(authenticationSummary(null));setLoading(true)}
  const navigationStarted=(event:any)=>{if(event.isMainFrame!==false&&!event.isInPlace)loading()}
  const reportNavigation=()=>{if(disposed)return;const url=webAIConversationUrl(providerId,node.getURL());if(url)navigation.current?.(url)}
  const domReady=()=>{if(disposed)return;if(initial){initial=false;void node.loadURL(target.current).catch(()=>{if(!disposed){setLoading(false);setError('官网加载失败，请重试。')}});return}ready.current=true;setLoading(false);setError('');onController(controller);reportNavigation();void checkAuthentication()}
  const failed=(event:any)=>{if(event.errorCode===-3||event.isMainFrame===false)return;ready.current=false;documentVersion.current++;authentication.current?.(authenticationSummary(null));setLoading(false);setError('官网暂时无法加载，请检查网络或稍后重试。')}
  const inPage=()=>{documentVersion.current++;authRevision.current++;authentication.current?.(authenticationSummary(null));reportNavigation();void checkAuthentication()}
  node.addEventListener('did-start-navigation',navigationStarted);node.addEventListener('dom-ready',domReady);node.addEventListener('did-fail-load',failed)
  node.addEventListener('did-navigate-in-page',inPage)
  const off=bridge.onOpenRequested(lease.lease,next=>{if(webAIConversationUrl(providerId,next))void node.loadURL(next).catch(()=>{});else WB.toast('该登录跳转尚未适配内嵌，请保留当前页面；不会另开浏览器窗口','warn')})
  return()=>{disposed=true;documentVersion.current++;authRevision.current++;onController(null);node.removeEventListener('did-start-navigation',navigationStarted);node.removeEventListener('dom-ready',domReady);node.removeEventListener('did-fail-load',failed);node.removeEventListener('did-navigate-in-page',inPage);off()}
 },[lease,controller])
 React.useEffect(()=>{if(!visible||!lease)return;void checkAuthentication();const timer=setInterval(()=>{void checkAuthentication()},5000);return()=>clearInterval(timer)},[visible,lease,checkAuthentication])
 return <div className={'wb-website'+(!visible?' is-background-guest':'')} aria-hidden={!visible} {...(!visible?{inert:''}:{})}>
  {!bridge&&<div className="wb-web-status" role="status">{browserSessionMessage('unavailable')}</div>}
  {lease?.mode==='persistent'&&<div className="wb-tiny wb-muted" role="status">{browserSessionMessage('persistent',true)}</div>}
  {lease&&React.createElement('webview',{key:lease.lease,ref:(el:Guest|null):void=>{guest.current=el},name:lease.lease,partition:lease.partition,src:'about:blank#'+lease.lease,allowpopups:'','data-sidebar-browser-frame':'webview','aria-label':webAIProvider(providerId).name+' 官网聊天',style:{flex:1,width:'100%',minHeight:300,border:0}})}
  {(loading&&bridge||error)&&<div className="wb-web-status" role={error?'alert':'status'}>{error||'正在加载官网…'} {error&&<Btn size="sm" onClick={()=>setRetry(n=>n+1)}>重试网页</Btn>}</div>}
 </div>
}
