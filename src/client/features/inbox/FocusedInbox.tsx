import {ConversationAttachmentHost} from './ConversationAttachment.js'
import {ConversationReader} from './ConversationReader.js'
import * as React from 'react'
import {Badge,Btn,Icon,Panel,WB} from '../../core/runtime.js'
import {useConversationRows} from './useConversationRows.js'
import {conversationReadMark,isConversationRead} from '../../../shared/conversation-read.js'
export function FocusedInbox({data,compact=false}:{data:any;compact?:boolean}){
 const inbox=data.messageInbox,account=inbox?.accountId,sources=(data.sources||[]).filter((s:any)=>account&&s.locator?.accountId===account&&s.selection?.policy==='focused-v1'),unread=(inbox?.conversations||[]).filter((c:any)=>c.unreadCount>0&&!isConversationRead(data,c))
 const [selected,setSelected]=React.useState<any>(null)
 const currentConversation=selected&&(inbox?.conversations||[]).find((row:any)=>row.groupId===selected.groupId)||selected
 React.useEffect(()=>{setSelected(null)},[account])
 const rows=useConversationRows(account,JSON.stringify(unread.map((c:any)=>[c.groupId,c.name,c.unreadCount,conversationReadMark(data,c)])))
 const shownCount=Math.min(unread.length,rows.count),remaining=unread.length-shownCount

 const content=<div className="wb-stack wb-focused-inbox" aria-label="云之家重点收件箱">
  <div className="wb-inbox-metrics"><Badge tone={inbox?.unreadTotal>0?'warn':'idle'}>云之家未读 {inbox?.unreadTotal??'未知'}</Badge><Badge tone="idle">累计收录 @本人 {sources.filter((s:any)=>s.selection.reasons.includes('mention_me')).length}</Badge><Badge tone="idle">累计收录 @全员 {sources.filter((s:any)=>s.selection.reasons.includes('mention_all')).length}</Badge><Btn size="sm" onClick={()=>WB.go('replies')}>待回复</Btn><Btn size="sm" onClick={()=>WB.go('tasks')}>待处理与会议</Btn>{inbox&&<><span className="wb-tiny wb-muted wb-inbox-snapshot">消息快照：{inbox.at?WB.fmt.relative(inbox.at):'尚未同步'}</span><span className="wb-tiny wb-muted wb-inbox-snapshot">日历：{inbox.calendar?.status==='ok'?'已同步 '+inbox.calendar.found+' 场':inbox.calendar?.note||'尚未同步'}</span></>}</div>
  {!!unread.length&&<section aria-label="未读会话预览">
   <div ref={rows.ref} role="list" aria-label="未读会话列表" className="wb-inbox-conversations" style={{maxHeight:rows.height,overflow:'hidden'}}>{unread.map((c:any,index:number)=><div role="listitem" aria-hidden={index>=shownCount?true:undefined} style={index>=shownCount?{visibility:'hidden'}:undefined} className="wb-inbox-conversation" key={c.groupId}><button type="button" tabIndex={index>=shownCount?-1:undefined} className="wb-btn wb-btn--ghost wb-inbox-conversation-open" aria-label={"查看会话："+c.name} title={c.name} onClick={()=>setSelected({...c,viewerAccountId:account})}><span className="wb-inbox-conversation-name">{c.name}</span></button><Badge tone="warn">{conversationReadMark(data,c)?'新消息':c.unreadCount}</Badge></div>)}</div>
   {rows.rows>3&&<div className="wb-row wb-row--wrap" style={{gap:8}}><span className="wb-tiny wb-muted">已展示 {shownCount} / {unread.length}</span><div className="wb-row wb-row--wrap" style={{gap:6}}>{remaining>0&&<Btn size="sm" onClick={rows.more}>展开更多</Btn>}{rows.rowLimit>3&&<Btn size="sm" onClick={rows.collapse}>收起列表</Btn>}</div></div>}
  </section>}

  {selected&&account&&selected.viewerAccountId===account&&<ConversationReader key={account+":"+selected.groupId} accountId={account} conversation={currentConversation} snapshotAt={inbox?.at} onClose={()=>setSelected(null)}/>}
  <ConversationAttachmentHost accountId={account}/>
 </div>
 return compact?<details className="wb-card wb-inbox-summary" open>
  <summary className="wb-card-head">
   <span className="wb-card-icon"><Icon name="chat" size={15}/></span>
   <div className="wb-card-titles"><h3 className="wb-card-title">云之家消息</h3><span className="wb-tiny wb-muted">工作台未读 {unread.length} 个会话</span></div>
   <span className="wb-inbox-summary-toggle wb-tiny wb-muted"><span className="wb-inbox-show">查看消息</span><span className="wb-inbox-hide">收起</span><Icon name="chevronDown" size={14}/></span>
  </summary>
  <div className="wb-card-body">{content}</div>
 </details>:<Panel title="消息概览" icon="chat">{content}</Panel>
}
