import {ConversationReader} from './ConversationReader.js'
import * as React from 'react'
import {Badge,Btn,Panel,WB} from '../../core/runtime.js'
import {isIrrelevantConversation} from '../../../shared/inbox-triage.js'
import {conversationReadMark,isConversationRead} from '../../../shared/conversation-read.js'
const UNREAD_PREVIEW_SIZE=3
export function FocusedInbox({data,compact=false}:{data:any;compact?:boolean}){
 const inbox=data.messageInbox,account=inbox?.accountId,sources=(data.sources||[]).filter((s:any)=>account&&s.locator?.accountId===account&&s.selection?.policy==='focused-v1'),unread=(inbox?.conversations||[]).filter((c:any)=>c.unreadCount>0&&!isConversationRead(data,c))
 const [includeHidden,setIncludeHidden]=React.useState(false),[visibleCount,setVisibleCount]=React.useState(UNREAD_PREVIEW_SIZE),[selected,setSelected]=React.useState<any>(null)
 React.useEffect(()=>{setIncludeHidden(false);setVisibleCount(UNREAD_PREVIEW_SIZE);setSelected(null)},[account])
 const hidden=new Set(unread.filter((c:any)=>isIrrelevantConversation(data,c)).map((c:any)=>c.groupId))
 const visible=includeHidden?unread:unread.filter((c:any)=>!hidden.has(c.groupId))
 const shown=visible.slice(0,visibleCount),remaining=Math.max(0,visible.length-shown.length)

 const content=<Panel title="消息概览" icon="chat"><div className="wb-stack" aria-label="云之家重点收件箱">
  <div className="wb-row wb-row--wrap" style={{gap:8}}><Badge tone={inbox?.unreadTotal>0?'warn':'idle'}>云之家未读 {inbox?.unreadTotal??'未知'}</Badge><Badge tone="idle">累计收录 @本人 {sources.filter((s:any)=>s.selection.reasons.includes('mention_me')).length}</Badge><Badge tone="idle">累计收录 @全员 {sources.filter((s:any)=>s.selection.reasons.includes('mention_all')).length}</Badge><Btn size="sm" onClick={()=>WB.go('replies')}>待回复</Btn><Btn size="sm" onClick={()=>WB.go('tasks')}>待处理与会议</Btn></div>
  {inbox&&<p className="wb-tiny wb-muted">消息快照：{inbox.at?WB.fmt.relative(inbox.at):'尚未同步'} · 日历：{inbox.calendar?.status==='ok'?'已同步 '+inbox.calendar.found+' 场':inbox.calendar?.note||'尚未同步'}</p>}
  {!!unread.length&&<section aria-label="未读会话预览">
   <div className="wb-row wb-row--wrap" style={{gap:8,justifyContent:'space-between'}}><h3 className="wb-tiny" style={{margin:0,fontWeight:600}}>未读会话（{visible.length}）</h3>{!!hidden.size&&<Btn size="sm" onClick={()=>{setIncludeHidden(!includeHidden);setVisibleCount(UNREAD_PREVIEW_SIZE)}}>{includeHidden?'隐藏已收起':'显示已收起 '+hidden.size}</Btn>}</div>
   <div role="list" aria-label="未读会话列表">{shown.map((c:any)=><div role="listitem" className="wb-row wb-row--wrap" key={c.groupId} style={{gap:8,padding:'6px 0',overflowWrap:'anywhere'}}><button type="button" className="wb-btn wb-btn--ghost" aria-label={"查看会话："+c.name} title={c.name} style={{minWidth:0,flex:1,height:"auto",minHeight:30,padding:"6px 8px",textAlign:"left",justifyContent:"flex-start",whiteSpace:"normal",overflowWrap:"anywhere"}} onClick={()=>setSelected({...c,viewerAccountId:account})}><span className="wb-inbox-conversation-name" style={{minWidth:0,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",overflowWrap:"anywhere"}}>{c.name}</span></button>{includeHidden&&hidden.has(c.groupId)&&<Badge tone="idle">已收起</Badge>}<Badge tone="warn">{conversationReadMark(data,c)?'新消息':c.unreadCount}</Badge></div>)}</div>
   {!visible.length&&<p className="wb-tiny wb-muted">暂无待关注会话</p>}
   {visible.length>UNREAD_PREVIEW_SIZE&&<div className="wb-row wb-row--wrap" style={{gap:8,justifyContent:'space-between'}}><span className="wb-tiny wb-muted">已展示 {shown.length} / {visible.length}</span><div className="wb-row wb-row--wrap" style={{gap:6}}>{remaining>0&&<Btn size="sm" onClick={()=>setVisibleCount(count=>count+UNREAD_PREVIEW_SIZE)}>展开更多（{Math.min(UNREAD_PREVIEW_SIZE,remaining)}条）</Btn>}{visibleCount>UNREAD_PREVIEW_SIZE&&<Btn size="sm" onClick={()=>setVisibleCount(UNREAD_PREVIEW_SIZE)}>收起列表</Btn>}</div></div>}
  </section>}

  {selected&&account&&selected.viewerAccountId===account&&<ConversationReader key={account+":"+selected.groupId} accountId={account} conversation={selected} onClose={()=>setSelected(null)}/>}
 </div></Panel>
 return compact?<details className="wb-compact-status" open><summary>云之家消息 · 工作台未读 {unread.length} 个会话<span className="wb-tiny wb-muted">查看消息</span></summary>{content}</details>:content
}
