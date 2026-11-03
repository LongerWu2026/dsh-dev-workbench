import * as React from 'react'
import {Btn,Input,Icon} from '../../core/runtime.js'
import {AssistantSidebar} from '../../components/AssistantSidebar.js'
import type {WebAIState} from '../../../shared/web-ai.js'
import {searchWebAIHistory} from './history.js'

type Props={state:WebAIState;selected:string;disabled:boolean;onSelect:(id:string)=>void;onNew:()=>void;onManage:()=>void;compact?:boolean;collapsed?:boolean;onCollapse?:(value:boolean)=>void}
export function ConversationSidebar({state,selected,disabled,onSelect,onNew,onManage,compact=false,collapsed:controlled,onCollapse}:Props){
 const [query,setQuery]=React.useState(''),[limit,setLimit]=React.useState(20),[localCollapsed,setLocalCollapsed]=React.useState(false)
 const collapsed=controlled??localCollapsed,collapse=onCollapse||setLocalCollapsed
 const rows=React.useMemo(()=>searchWebAIHistory(state,query),[state,query])
 function dismiss(){if(compact)collapse(true)}
 return <AssistantSidebar collapsed={collapsed} compact={compact} onChange={collapse} onNew={()=>{dismiss();onNew()}} busy={disabled} label="会话历史" listId="wb-web-ai-conversations" newLabel="新对话" className="wb-chat-sidebar">
  <div className="wb-chat-sidebar-search"><Input aria-label="搜索会话" placeholder="搜索会话或回答" value={query} onChange={(event:any)=>{setQuery(event.target.value);setLimit(20)}}/></div>
  <nav className="wb-chat-session-list wb-assistant-session-items" aria-label="历史会话列表">
   {!selected&&!query&&<div className="wb-chat-session wb-assistant-session is-selected is-new" aria-current="true"><span><strong>新对话</strong><small>输入问题开始聊天</small></span></div>}
   {rows.length>0&&<h3 className="wb-chat-section-title">最近更新</h3>}
   {rows.slice(0,limit).map(({topic,count,preview})=><button type="button" key={topic.id} disabled={disabled} title={topic.title} aria-label={'选择会话 '+topic.title} aria-current={selected===topic.id?'true':undefined} className={'wb-chat-session wb-assistant-session'+(selected===topic.id?' is-selected':'')} onClick={()=>{dismiss();onSelect(topic.id)}}><span><strong>{topic.title}</strong>{query&&<small>{preview}</small>}<small className="wb-chat-session-meta">{count?count+' 轮对话':'尚无回答'}</small></span></button>)}
   {!rows.length&&<p className="wb-tiny wb-muted">{query?'没有匹配的会话':'历史对话将保存在这里'}</p>}
   {rows.length>limit&&<Btn size="sm" onClick={()=>setLimit(value=>value+20)}>显示更多会话</Btn>}
  </nav>
  <Btn className="wb-chat-manage" size="sm" onClick={()=>{dismiss();onManage()}} aria-label="管理历史与回收站"><Icon name="clock" size={13}/>历史管理</Btn>
 </AssistantSidebar>
}
