import * as React from 'react'
import {Btn,Input} from '../../core/runtime.js'
import type {WebAIState} from '../../../shared/web-ai.js'
import {searchWebAIHistory} from './history.js'

export function ConversationSidebar({state,selected,disabled,onSelect,onNew,onManage}:{state:WebAIState;selected:string;disabled:boolean;onSelect:(id:string)=>void;onNew:()=>void;onManage:()=>void}){
 const [query,setQuery]=React.useState(''),[limit,setLimit]=React.useState(20),[expanded,setExpanded]=React.useState(false)
 const rows=React.useMemo(()=>searchWebAIHistory(state,query),[state,query])
 return <aside className={'wb-chat-sidebar'+(expanded?' is-expanded':'')} aria-label="会话历史">
  <div className="wb-chat-sidebar-head"><strong>会话</strong><button className="wb-chat-mobile-history wb-btn" type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>会话历史</button><Btn kind="primary" size="sm" disabled={disabled} onClick={()=>{setExpanded(false);onNew()}}>新对话</Btn></div>
  <div className="wb-chat-sidebar-search"><Input aria-label="搜索会话" placeholder="搜索会话或回答" value={query} onChange={(event:any)=>{setQuery(event.target.value);setLimit(20)}}/></div>
  <nav className="wb-chat-session-list" aria-label="历史会话列表">
   {!selected&&!query&&<div className="wb-chat-session is-selected" aria-current="page"><strong>新对话</strong><span>输入问题开始聊天</span></div>}
   {rows.slice(0,limit).map(({topic,count,preview})=><button type="button" key={topic.id} disabled={disabled} title={topic.title} aria-label={'选择会话 '+topic.title} aria-current={selected===topic.id?'page':undefined} className={'wb-chat-session'+(selected===topic.id?' is-selected':'')} onClick={()=>{setExpanded(false);onSelect(topic.id)}}><strong>{topic.title}</strong></button>)}
   {!rows.length&&<p className="wb-tiny wb-muted">{query?'没有匹配的会话':'历史对话将保存在这里'}</p>}
   {rows.length>limit&&<Btn size="sm" onClick={()=>setLimit(value=>value+20)}>显示更多会话</Btn>}
  </nav>
  <Btn size="sm" onClick={()=>{setExpanded(false);onManage()}} aria-label="管理历史与回收站">⋯</Btn>
 </aside>
}
