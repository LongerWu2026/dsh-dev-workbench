import * as React from 'react'
import {Badge,Btn,Modal,Spinner,WB} from '../../core/runtime.js'
import {messageSentTime} from '../../../shared/message-display.js'

/** Open at the newest unread message; upward gestures fetch history without moving the reading anchor. */
export function ConversationReader({conversation,accountId,onClose}:{conversation:any;accountId:string;onClose:()=>void}){
 const [messages,setMessages]=React.useState<any[]>([]),[result,setResult]=React.useState<any>(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[bottomSpace,setBottomSpace]=React.useState(0)
 const [readStatus,setReadStatus]=React.useState(''),[readError,setReadError]=React.useState(''),ackView=React.useRef('')
 const generation=React.useRef(0),loading=React.useRef(false),cursor=React.useRef<any>(null),phase=React.useRef<'unread'|'history'>('unread'),positioned=React.useRef(false),root=React.useRef<HTMLDivElement|null>(null),scrollBody=React.useRef<HTMLElement|null>(null),anchor=React.useRef<{id:string;offset:number}|null>(null),loadRef=React.useRef<(mode:'unread'|'history')=>void>(()=>{})
 function captureAnchor(){
  const body=scrollBody.current;if(!body)return
  const top=body.getBoundingClientRect().top,nodes=Array.from(root.current?.querySelectorAll<HTMLElement>('[data-message-id]')||[]),node=nodes.find(node=>node.getBoundingClientRect().bottom>top)||nodes[0]
  if(node)anchor.current={id:node.dataset.messageId!,offset:node.getBoundingClientRect().top-top}
 }
 async function load(mode:'unread'|'history'){
  if(loading.current||mode==='history'&&(!cursor.current?.unreadComplete||!cursor.current?.hasMoreHistory))return
  const g=generation.current;loading.current=true;phase.current=mode;setBusy(true);setError('')
  try{
   for(;;){
    const previous=cursor.current
    const response=await WB.actions.conversationMessages({accountId,groupId:conversation.groupId,mode,...(previous?{viewId:previous.viewId,cursor:previous.nextCursor}:{})})
    if(g!==generation.current)return
    if(!['ok','partial'].includes(response?.status)||!response.viewId)throw Error(response?.note||'未能读取会话消息，请重试')
    if(typeof response.unreadComplete!=='boolean'||typeof response.hasMoreHistory!=='boolean')throw Error('消息查看接口尚未更新，请重载智能工作台插件')
    if(mode==='history'&&response.messages?.length)captureAnchor()
    cursor.current=response;setResult(response)
    setMessages(previous=>[...new Map([...(response.messages||[]),...previous].map(row=>[row.id,row])).values()])
    if(response.status==='partial'){setError(response.note||'部分消息未能读取，请重试');break}
    if(mode==='unread'?response.unreadComplete:response.batchComplete)break
   }
  }catch(failure:any){if(g===generation.current)setError(failure.message||'会话读取失败，请重试')}
  finally{if(g===generation.current){loading.current=false;setBusy(false)}}
 }
 loadRef.current=load
 React.useEffect(()=>{generation.current++;cursor.current=null;loading.current=false;positioned.current=false;phase.current='unread';anchor.current=null;ackView.current='';setReadStatus('');setReadError('');setBottomSpace(0);setMessages([]);setResult(null);void load('unread');return()=>{generation.current++;loading.current=false}},[accountId,conversation.groupId])
 async function markRead(){
  const current=cursor.current,g=generation.current;if(!current||ackView.current===current.viewId)return
  ackView.current=current.viewId;setReadStatus('saving');setReadError('')
  try{await WB.actions.conversationRead({accountId,groupId:conversation.groupId,viewId:current.viewId});if(g===generation.current)setReadStatus('saved')}
  catch(failure:any){if(g===generation.current){setReadStatus('failed');setReadError(failure.message||'保存已读失败，未读列表保持不变')}}
 }
 // An effect runs after the unread messages are committed to the screen, never merely on opening.
 React.useEffect(()=>{if(!busy&&result?.status==='ok'&&result.unreadComplete&&result.unreadTotal>0&&result.unreadLoaded===result.unreadTotal&&!ackView.current)void markRead()},[busy,result])
 React.useEffect(()=>{
  const body=root.current?.closest<HTMLElement>('.wb-modal-body');if(!body)return
  scrollBody.current=body;let lastWheel=0,consumed=false,touchY=0,touchConsumed=false
  const canLoad=()=>body.scrollTop<=1&&!loading.current&&cursor.current?.unreadComplete&&cursor.current?.hasMoreHistory
  const wheel=(event:WheelEvent)=>{if(event.deltaY>=0){consumed=false;return}const now=Date.now();if(now-lastWheel>250)consumed=false;lastWheel=now;if(!consumed&&canLoad()){event.preventDefault();consumed=true;loadRef.current('history')}}
  const touchStart=(event:TouchEvent)=>{touchY=event.touches[0]?.clientY||0;touchConsumed=false}
  const touchMove=(event:TouchEvent)=>{if(!touchConsumed&&event.touches[0]&&event.touches[0].clientY-touchY>8&&canLoad()){touchConsumed=true;loadRef.current('history')}}
  body.addEventListener('wheel',wheel,{passive:false});body.addEventListener('touchstart',touchStart,{passive:true});body.addEventListener('touchmove',touchMove,{passive:true})
  return()=>{body.removeEventListener('wheel',wheel);body.removeEventListener('touchstart',touchStart);body.removeEventListener('touchmove',touchMove);scrollBody.current=null}
 },[accountId,conversation.groupId])
 React.useLayoutEffect(()=>{
  const body=scrollBody.current;if(!body)return
  if(anchor.current){
   const saved=anchor.current,node=Array.from(root.current?.querySelectorAll<HTMLElement>('[data-message-id]')||[]).find(node=>node.dataset.messageId===saved.id)
   if(node){const desired=body.scrollTop+node.getBoundingClientRect().top-body.getBoundingClientRect().top-saved.offset,missing=desired-(body.scrollHeight-body.clientHeight);if(missing>1){setBottomSpace(value=>value+Math.ceil(missing));return}body.scrollTop=desired}
   anchor.current=null
  }else if(!busy&&cursor.current?.unreadComplete&&!positioned.current){body.scrollTop=body.scrollHeight;positioned.current=true}
 },[messages,busy,bottomSpace])
 const firstUnreadIndex=messages.findIndex(row=>row.unread),contextCount=messages.filter(row=>!row.unread).length
 return <Modal open title={conversation.name||'会话消息'} sub="默认显示最新消息 · 向上滚动查看历史" width={760} onClose={onClose} footer={<>
  <span className="wb-tiny wb-muted" style={{flex:1}}>{result?`未读 ${result.unreadLoaded}/${result.unreadTotal} 条 · 已查看历史 ${result.contextLoaded} 条`:'正在读取未读消息…'}</span>
  {!busy&&error&&<Btn size="sm" onClick={()=>load(phase.current)}>重试读取</Btn>}
  {readStatus==='saved'&&<span className="wb-tiny wb-muted" title="仅记录工作台已读；云之家客户端未读红点暂不同步。待回复仍保留。">工作台已读</span>}
  {readStatus==='failed'&&<Btn size="sm" title={readError} onClick={()=>{ackView.current='';void markRead()}}>重试保存已读</Btn>}
 </>}>
  <style>{READER_CSS}</style>
  <div ref={root} className="wb-conversation-reader" aria-label="会话消息">
   <div className="wb-conversation-history-control" role="status">
    {busy?<span className="wb-row wb-muted"><Spinner size={14}/>{phase.current==='history'?'正在读取更早消息…':'正在读取未读消息…'}</span>:result?.unreadComplete?result.hasMoreHistory?<button type="button" className="wb-link" aria-label="加载更早10条消息" onClick={()=>load('history')}>向上滚动，查看更早 10 条</button>:<span className="wb-tiny wb-muted">已到最早消息</span>:null}
   </div>
   {contextCount>0&&<div className="wb-conversation-divider" role="separator">历史消息 · {contextCount} 条</div>}
   {messages.map((message,index)=><React.Fragment key={message.id}>
    {index===firstUnreadIndex&&<div className="wb-conversation-divider is-unread" role="separator">以下为打开时的未读消息</div>}
    <article className={'wb-conversation-message'+(message.own?' is-own':'')} data-message-id={message.id} aria-label={(message.unread?'未读消息：':'之前的消息：')+message.sender}>
     <header><strong>{message.sender}</strong><time>{messageSentTime({locator:{sentAt:message.at}})}</time>{message.own&&<Badge tone="idle">本人</Badge>}</header>
     <p>{message.text||'[非文本消息]'}</p>
    </article>
   </React.Fragment>)}
   {error&&<p role="alert">{error}</p>}
   {!busy&&result?.note&&!error&&<p role="status" className="wb-tiny wb-muted">{result.note}</p>}
   {!busy&&result?.unreadComplete&&!messages.length&&!error&&!result.note&&<p className="wb-muted">当前没有未读消息，可向上滚动查看历史。</p>}
   <div aria-hidden="true" style={{height:bottomSpace,flex:"none",marginTop:-12}}/>
  </div>
 </Modal>
}
const READER_CSS=`
.wb-modal:has(.wb-conversation-reader) .wb-modal-head h2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.wb-modal:has(.wb-conversation-reader){height:76vh}.wb-modal:has(.wb-conversation-reader) .wb-modal-body{overflow-anchor:none;flex:1}.wb-conversation-history-control{min-height:26px;display:flex;align-items:center;justify-content:center;font-size:11px}.wb-conversation-history-control button{appearance:none;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);padding:3px 6px;font:inherit;cursor:pointer}.wb-conversation-history-control button:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}.wb-conversation-history-control button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.wb-conversation-reader{display:flex;flex-direction:column;gap:12px;min-width:0}.wb-conversation-reader>p{margin:0;overflow-wrap:anywhere}.wb-conversation-divider{display:flex;align-items:center;justify-content:center;gap:8px;min-height:24px;font-size:11px;color:var(--dsw-alias-label-secondary);scroll-margin-top:12px}.wb-conversation-divider:before,.wb-conversation-divider:after{content:'';height:1px;background:var(--dsw-alias-border-l1);flex:1}.wb-conversation-divider.is-unread{color:var(--dsw-alias-brand-primary)}.wb-conversation-message{align-self:flex-start;max-width:94%;min-width:0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:3px 12px 12px 12px;background:var(--dsw-alias-bg-layer-1)}.wb-conversation-message.is-own{align-self:flex-end;background:var(--dsw-alias-bg-layer-2);border-radius:12px 3px 12px 12px}.wb-conversation-message header{display:flex;align-items:center;gap:6px 10px;flex-wrap:wrap;font-size:12px}.wb-conversation-message header time{font-size:10px;color:var(--dsw-alias-label-secondary)}.wb-conversation-message p{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.7}.wb-conversation-message strong{overflow-wrap:anywhere}@media(max-width:640px){.wb-conversation-message{max-width:100%}}
`
