import * as React from 'react'
import {Badge,Btn,Panel,WB} from '../../core/runtime.js'
import {isIrrelevantConversation} from '../../../shared/inbox-triage.js'
export function FocusedInbox({data,compact=false}:{data:any;compact?:boolean}){
 const inbox=data.messageInbox,account=inbox?.accountId,sources=(data.sources||[]).filter((s:any)=>account&&s.locator?.accountId===account&&s.selection?.policy==='focused-v1'),unread=(inbox?.conversations||[]).filter((c:any)=>c.unreadCount>0)
 const [showAll,setShowAll]=React.useState(false)
 React.useEffect(()=>setShowAll(false),[account])
 const hidden=new Set(unread.filter((c:any)=>isIrrelevantConversation(data,c)).map((c:any)=>c.groupId))
 const visible=showAll?unread:unread.filter((c:any)=>!hidden.has(c.groupId))

 const content=<Panel title="消息概览" icon="chat"><div className="wb-stack" aria-label="云之家重点收件箱">
  <div className="wb-row wb-row--wrap" style={{gap:8}}><Badge tone={inbox?.unreadTotal>0?'warn':'idle'}>未读总数 {inbox?.unreadTotal??'未知'}</Badge><Badge tone="idle">累计收录 @本人 {sources.filter((s:any)=>s.selection.reasons.includes('mention_me')).length}</Badge><Badge tone="idle">累计收录 @全员 {sources.filter((s:any)=>s.selection.reasons.includes('mention_all')).length}</Badge><Btn size="sm" onClick={()=>WB.go('replies')}>待回复</Btn><Btn size="sm" onClick={()=>WB.go('tasks')}>待处理与会议</Btn></div>
  {inbox&&<p className="wb-tiny wb-muted">消息快照：{inbox.at?WB.fmt.relative(inbox.at):'尚未同步'} · 日历：{inbox.calendar?.status==='ok'?'已同步 '+inbox.calendar.found+' 场':inbox.calendar?.note||'尚未同步'}</p>}
  {!!hidden.size&&<div className="wb-row wb-row--wrap"><span className="wb-tiny wb-muted">AI 判定无关 {hidden.size} 个会话{showAll?'':'，已在工作台收起'}；云之家仍为未读。</span><Btn size="sm" onClick={()=>setShowAll(!showAll)}>{showAll?'收起无关会话':'显示全部'}</Btn></div>}
  {!!unread.length&&<details><summary>未读会话（{visible.length}）</summary>{(showAll?visible:visible.slice(0,10)).map((c:any)=><div className="wb-row wb-row--wrap" key={c.groupId} style={{gap:8,padding:'6px 0',overflowWrap:'anywhere'}}><span style={{minWidth:0,flex:1}}>{c.name}</span>{showAll&&hidden.has(c.groupId)&&<Badge tone="idle">AI 判定无关</Badge>}<Badge tone="warn">{c.unreadCount}</Badge></div>)}{!visible.length&&<p className="wb-tiny wb-muted">其余未读会话均已收起，可显示全部查看。</p>}{!showAll&&visible.length>10&&<div className="wb-row wb-row--wrap"><span className="wb-tiny wb-muted">显示最近10个未读会话。</span><Btn size="sm" onClick={()=>setShowAll(true)}>显示全部</Btn></div>}{showAll&&!hidden.size&&unread.length>10&&<Btn size="sm" onClick={()=>setShowAll(false)}>收起列表</Btn>}</details>}

 </div></Panel>
 return compact?<details className="wb-compact-status"><summary>云之家消息 · 未读 {inbox?.unreadTotal??'未知'} 条 · {unread.length} 个已同步未读会话<span className="wb-tiny wb-muted">查看消息</span></summary>{content}</details>:content
}
