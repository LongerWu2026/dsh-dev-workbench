import * as React from 'react'
import {Badge,Btn,WB} from '../../core/runtime.js'
import {ReplyDraft} from '../inbox/ReplyDraft.js'
import {messageOrigin,messageSender,messageSentTime} from '../../../shared/message-display.js'
import {briefReplyOpen} from './linked-actions.js'

export function LinkedReplies({replies,data}:{replies:any[];data:any}) {
 const [error,setError]=React.useState(''),[expanded,setExpanded]=React.useState<Record<string,boolean>>({});const prefix='wb-brief-reply-'
 return <div style={{padding:'8px 4px 10px',minWidth:0}} aria-label="关联回复">
  {replies.map(reply=>{const source=(data.sources||[]).find((s:any)=>s.id===reply.sourceId);return <div key={reply.id} style={{padding:'6px 0',overflowWrap:'anywhere'}}>
   <div className="wb-row wb-row--wrap" style={{gap:6}}><Badge tone={briefReplyOpen(reply)?'warn':'ok'}>回复：{reply.stage}</Badge><span className="wb-tiny wb-muted">{messageSender(source,reply.contact)} · {messageOrigin(source,reply)}</span></div>
   <button type="button" className="wb-brief-reply-content wb-tiny wb-muted" aria-label={'查看待回复：'+messageSender(source,reply.contact)+'：'+(reply.snippet||'').slice(0,50)} onClick={()=>WB.openReply(reply.id)}>{reply.snippet||'查看回复详情'}</button>
   <div className="wb-brief-task-footer">
    {briefReplyOpen(reply)&&<button type="button" className="wb-btn wb-btn--sm wb-btn--ghost" aria-expanded={!!expanded[reply.id]} aria-controls={prefix+reply.id} onClick={()=>setExpanded(previous=>({...previous,[reply.id]:!previous[reply.id]}))}>处理回复</button>}
   </div>
   {briefReplyOpen(reply)&&<div id={prefix+reply.id} hidden={!expanded[reply.id]}>
    <p className="wb-tiny wb-muted">发出时间：{messageSentTime(source)}</p>
    <ReplyDraft key={reply.id} reply={reply} data={data} actions={<div className="wb-row wb-row--wrap">{['已回复','不需回复'].map(stage=><Btn key={stage} size="sm" title={stage==='不需回复'?'已查阅且无需本人回复：仅结束本条提醒，不发送消息，不改变云之家未读状态':undefined} onClick={()=>WB.actions.setReplyStage(reply.id,stage).catch((e:Error)=>setError(e.message))}>{stage==='已回复'?'标记已回复':'无需回复'}</Btn>)}</div>}/>
   </div>}
  </div>})}
  {error&&<p role="alert">{error}</p>}
 </div>
}
