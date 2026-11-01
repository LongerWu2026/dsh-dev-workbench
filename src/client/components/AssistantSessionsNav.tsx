import * as React from 'react'
import {Btn,Icon,Input} from '../core/runtime.js'
export function AssistantSessionsNav({sessions,activeId,onSelect,onNew,disabled=false}:{sessions:any[];activeId:string|null;onSelect:(row:any)=>void;onNew?:()=>void;disabled?:boolean}){
    const [query,setQuery]=React.useState('')
    const rows=sessions.filter(row=>(row.title+' '+(row.taskTitle||'')).toLowerCase().includes(query.toLowerCase()))
    return <nav className="wb-assistant-sessions" aria-label="助手会话列表">
        <div className="wb-assistant-sessions-heading"><strong>最近会话</strong><span className="wb-muted">{sessions.length}</span></div>
        {onNew&&<Btn icon="plus" disabled={disabled} onClick={onNew}>新建对话</Btn>}
        <Input aria-label="搜索助手会话" placeholder="搜索待办或会话" value={query} onChange={(e:any)=>setQuery(e.target.value)}/>
        <div className="wb-assistant-session-items">{rows.map(row=><button type="button" key={row.id} data-session-id={row.id} className="wb-assistant-session" aria-label={'会话：'+row.title} aria-current={row.id===activeId?'true':undefined} onClick={()=>onSelect(row)} title={row.title}>
            <Icon name="messages" size={14}/><span><strong>{row.title}</strong><small>{row.taskTitle||'通用办公'}{row.createdAt?' · '+new Date(row.createdAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric'}):''}</small></span>
        </button>)}</div>
        {!rows.length&&<p className="wb-tiny wb-muted">{query?'没有匹配的会话':'点击“新建对话”开始，也可以从待办进入独立会话'}</p>}
    </nav>
}
