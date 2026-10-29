import * as React from 'react'
import {Badge,Btn,Panel,WB} from '../../core/runtime.js'
import {isIrrelevantConversation} from '../../../shared/inbox-triage.js'
export function FocusedInbox({data}:{data:any}){
 const inbox=data.messageInbox,account=inbox?.accountId,sources=(data.sources||[]).filter((s:any)=>account&&s.locator?.accountId===account&&s.selection?.policy==='focused-v1'),unread=(inbox?.conversations||[]).filter((c:any)=>c.unreadCount>0)
 const ownSources=new Set((data.sources||[]).filter((s:any)=>account&&s.locator?.accountId===account).map((s:any)=>s.id))
 const [showAll,setShowAll]=React.useState(false)
 React.useEffect(()=>setShowAll(false),[account])
 const hidden=new Set(unread.filter((c:any)=>isIrrelevantConversation(data,c)).map((c:any)=>c.groupId))
 const visible=showAll?unread:unread.filter((c:any)=>!hidden.has(c.groupId))
 const meetings=(data.tasks||[]).filter((t:any)=>t.eventType==='meeting'&&!t.archivedAt&&!['completed','cancelled'].includes(t.status)&&Date.parse(t.meetingEnd||t.meetingStart)>Date.now()&&(ownSources.has(t.sourceRefId)||(t.sourceRefs||[]).some((r:any)=>ownSources.has(r.sourceId)))).sort((a:any,b:any)=>Date.parse(a.meetingStart)-Date.parse(b.meetingStart)).slice(0,3)
 return <Panel title="消息与会议" icon="chat"><div className="wb-stack" aria-label="云之家重点收件箱">
  <div className="wb-row wb-row--wrap" style={{gap:8}}><Badge tone={inbox?.unreadTotal>0?'warn':'idle'}>未读总数 {inbox?.unreadTotal??'未知'}</Badge><Badge tone="idle">收录 @本人 {sources.filter((s:any)=>s.selection.reasons.includes('mention_me')).length}</Badge><Badge tone="idle">收录 @全员 {sources.filter((s:any)=>s.selection.reasons.includes('mention_all')).length}</Badge><Btn size="sm" onClick={()=>WB.go('replies')}>待回复</Btn><Btn size="sm" onClick={()=>WB.go('tasks')}>待处理与会议</Btn></div>
  {inbox&&<p className="wb-tiny wb-muted">消息快照：{inbox.at?WB.fmt.relative(inbox.at):'尚未同步'} · 日历：{inbox.calendar?.status==='ok'?'已同步 '+inbox.calendar.found+' 场':inbox.calendar?.note||'尚未同步'}</p>}
  {!!hidden.size&&<div className="wb-row wb-row--wrap"><span className="wb-tiny wb-muted">AI 判定无关 {hidden.size} 个会话{showAll?'':'，已在工作台收起'}；云之家仍为未读。</span><Btn size="sm" onClick={()=>setShowAll(!showAll)}>{showAll?'收起无关会话':'显示全部'}</Btn></div>}
  {!!unread.length&&<details><summary>未读会话（{visible.length}）</summary>{(showAll?visible:visible.slice(0,10)).map((c:any)=><div className="wb-row wb-row--wrap" key={c.groupId} style={{gap:8,padding:'6px 0',overflowWrap:'anywhere'}}><span style={{minWidth:0,flex:1}}>{c.name}</span>{showAll&&hidden.has(c.groupId)&&<Badge tone="idle">AI 判定无关</Badge>}<Badge tone="warn">{c.unreadCount}</Badge></div>)}{!visible.length&&<p className="wb-tiny wb-muted">其余未读会话均已收起，可显示全部查看。</p>}{!showAll&&visible.length>10&&<div className="wb-row wb-row--wrap"><span className="wb-tiny wb-muted">显示最近10个未读会话。</span><Btn size="sm" onClick={()=>setShowAll(true)}>显示全部</Btn></div>}{showAll&&!hidden.size&&unread.length>10&&<Btn size="sm" onClick={()=>setShowAll(false)}>收起列表</Btn>}</details>}
  {meetings.map((t:any)=><div key={t.id} className="wb-row wb-row--wrap" style={{gap:8,overflowWrap:'anywhere'}}><Badge tone="accent">{Date.parse(t.meetingStart)<Date.now()?'会议进行中':'即将开会'}</Badge><span style={{minWidth:0,flex:1}}>{t.title} · {WB.fmt.datetime(t.meetingStart)}{t.meetingLocation?' · '+t.meetingLocation:''}</span></div>)}
 </div></Panel>
}
