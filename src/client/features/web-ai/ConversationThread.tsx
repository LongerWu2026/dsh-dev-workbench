import {MessageRow} from '../../components/AssistantMessageIdentity.js'
import * as React from 'react'
import {Btn,WB} from '../../core/runtime.js'
import {WEB_AI_ACTIVE,webAIProvider,type WebAIRound,type WebAIAnswer} from '../../../shared/web-ai.js'
import type {WebAIAuthentication} from '../../../shared/web-ai-auth.js'
import {localQuestion} from './history.js'
import {answerPresentation} from './answer-presentation.js'
import {MessageContent} from './MessageContent.js'
import {useStreamingText} from './useStreamingText.js'

function AnswerBody({identity,text,placeholder,streaming,visible}:{identity:string;text:string;placeholder:string;streaming:boolean;visible:boolean}){
 const shown=useStreamingText(identity,text,streaming,visible)
 return <div className="wb-chat-answer-body" aria-live="off" aria-busy={streaming}>{text?<MessageContent text={shown}/>:<span className="wb-muted" role="status">{placeholder}</span>}{streaming&&<span className="wb-chat-stream-cursor" aria-hidden="true"/>}</div>
}

interface Props {topicId:string;visible:boolean;rounds:WebAIRound[];total:number;filter:string;authentication:Record<string,WebAIAuthentication>;busy:boolean;canEdit:boolean;answerChoices?:Record<string,string>;onSelectAnswer?:(roundId:string,providerId:string)=>void;onUnsent?:(round:WebAIRound,answer:WebAIAnswer)=>void;onEarlier:()=>void;onOpen:(round:WebAIRound,answer:WebAIAnswer)=>void;onEditQuestion:(round:WebAIRound)=>void;onEditAnswer:(round:WebAIRound,answer:WebAIAnswer)=>void;onKnowledge:(round:WebAIRound,answer:WebAIAnswer)=>void}
export function ConversationThread(props:Props){
 const {rounds,topicId}=props,viewport=React.useRef<HTMLDivElement|null>(null),following=React.useRef(true),previousTopic=React.useRef(topicId),restoreHeight=React.useRef<number|null>(null),restoreTop=React.useRef<number|null>(null)
 const [localChoices,setLocalChoices]=React.useState<Record<string,string>>({}),choices=props.answerChoices||localChoices
 React.useLayoutEffect(()=>{
  const node=viewport.current;if(!node||!props.visible)return
  if(previousTopic.current!==topicId){previousTopic.current=topicId;following.current=true;restoreHeight.current=null;restoreTop.current=null}
  if(restoreTop.current!==null){node.scrollTop=restoreTop.current;restoreTop.current=null}
  else if(restoreHeight.current!==null){node.scrollTop+=node.scrollHeight-restoreHeight.current;restoreHeight.current=null}
  else if(following.current)node.scrollTop=node.scrollHeight
 },[topicId,rounds,props.filter,props.visible,choices])
 React.useEffect(()=>{
  const node=viewport.current;if(!node||!props.visible||typeof ResizeObserver==='undefined')return
  const observer=new ResizeObserver(()=>{if(following.current)node.scrollTop=node.scrollHeight})
  observer.observe(node);const messages=node.querySelector('.wb-chat-messages');if(messages)observer.observe(messages)
  return()=>observer.disconnect()
 },[props.visible])
 const selectAnswer=(roundId:string,providerId:string)=>{
  // Changing providers is a reading action, not a new message. A longer
  // answer must not inherit the previous answer's follow-to-bottom state.
  following.current=false;restoreTop.current=viewport.current?.scrollTop??null
  if(!props.answerChoices)setLocalChoices(old=>({...old,[roundId]:providerId}));props.onSelectAnswer?.(roundId,providerId)
 }
 return <div ref={viewport} className="wb-chat-thread" aria-label="聊天记录" onScroll={()=>{const node=viewport.current;if(node)following.current=node.scrollHeight-node.clientHeight-node.scrollTop<80}}>
  {rounds.length<props.total&&<div className="wb-chat-earlier"><Btn size="sm" onClick={()=>{restoreHeight.current=viewport.current?.scrollHeight??null;following.current=false;props.onEarlier()}}>加载更早的对话（{props.total-rounds.length}）</Btn></div>}
  {!rounds.length&&<div className="wb-web-empty"><strong>今天想聊点什么？</strong></div>}
  <section aria-label="回答对比" className="wb-chat-messages">
   {rounds.map(round=>{const selected=round.answers.find(a=>a.providerId===choices[round.id])||round.answers[0];return <article key={round.id} className="wb-chat-round" aria-label={'对话轮次 '+localQuestion(round)}>
    <MessageRow author="user" at={round.createdAt} className="wb-chat-user"><div className="wb-chat-question wb-assistant-message is-user"><h3>{localQuestion(round)}</h3>{!!round.attachments?.length&&<div className="wb-chat-file-labels">{round.attachments.map(file=><span key={file.id}>▤ {file.name}</span>)}</div>}</div></MessageRow>
    <MessageRow author="assistant" label={selected?webAIProvider(selected.providerId).name:'网页 AI'} className="wb-chat-assistant">
    <div role="tablist" aria-label="本轮回答厂商" className="wb-chat-round-tabs">{round.answers.map(a=><button key={a.providerId} type="button" role="tab" id={'tab-'+round.id+'-'+a.providerId} aria-controls={'answer-'+round.id} aria-selected={selected===a} onClick={()=>selectAnswer(round.id,a.providerId)}>{webAIProvider(a.providerId).name}{props.authentication[a.providerId]?.status==='needs_login'&&a.status==='needs_login'&&<small> · 需登录</small>}{a.status==='generating'&&<small> · 正在回答</small>}</button>)}</div>
    {selected&&(()=>{const answer=selected,view=answerPresentation(answer,props.authentication[answer.providerId]),streaming=answer.status==='generating',unsent=answer.submission==='not_sent'&&!WEB_AI_ACTIVE.has(answer.status)&&answer.status!=='completed';return <article role="tabpanel" id={'answer-'+round.id} aria-labelledby={'tab-'+round.id+'-'+answer.providerId} className="wb-web-answer wb-assistant-message" aria-label={webAIProvider(answer.providerId).name+' 回答'}>
     <AnswerBody identity={topicId+':'+round.id+':'+answer.providerId} text={answer.text} placeholder={view.note||'等待厂商回复…'} streaming={streaming} visible={props.visible}/>
     {unsent&&<div className="wb-row" style={{gap:8,marginTop:12}}><Btn size="sm" disabled={props.busy} onClick={()=>props.onUnsent?.(round,answer)}>{props.authentication[answer.providerId]?.status==='authenticated'?'发送给'+webAIProvider(answer.providerId).name:'查看登录页'}</Btn><span className="wb-tiny wb-muted">本厂商尚未发送</span></div>}
     <div className="wb-row wb-chat-answer-actions"><Btn size="sm" disabled={!answer.text} onClick={()=>{void WB.util.copy(answer.text).then(()=>WB.toast('已复制','ok')).catch(()=>WB.toast('复制失败，请重试','error'))}}>复制</Btn><details data-chat-menu><summary aria-label="回答更多操作">⋯</summary><div className="wb-chat-message-menu"><Btn size="sm" onClick={()=>props.onOpen(round,answer)}>登录 / 查看原对话</Btn><Btn size="sm" disabled={!answer.text?.trim()||WEB_AI_ACTIVE.has(answer.status)} onClick={()=>props.onKnowledge(round,answer)}>收藏到知识库</Btn><Btn size="sm" disabled={WEB_AI_ACTIVE.has(answer.status)} onClick={()=>props.onEditAnswer(round,answer)}>粘贴 / 编辑回答</Btn><Btn size="sm" disabled={props.busy||!props.canEdit} onClick={()=>props.onEditQuestion(round)}>编辑本地问题</Btn></div></details></div>
    </article>})()}
    </MessageRow>
   </article>})}
  </section>
 </div>
}
