import * as React from 'react'
import {Badge,Btn,WB} from '../../core/runtime.js'
import {ReplyDraft} from '../inbox/ReplyDraft.js'
import {messageOrigin,messageSender,messageSentTime} from '../../../shared/message-display.js'
import {briefReplyOpen} from './linked-actions.js'

export function LinkedReplies({replies,data}:{replies:any[];data:any}) {
 const [error,setError]=React.useState('')
 return <div style={{padding:'10px 4px',borderTop:'1px solid var(--dsw-alias-border-l1)',minWidth:0}} aria-label="关联回复">
  {replies.map(reply=>{const source=(data.sources||[]).find((s:any)=>s.id===reply.sourceId);return <div key={reply.id} style={{padding:'6px 0',overflowWrap:'anywhere'}}>
   <div className="wb-row wb-row--wrap" style={{gap:6}}><Badge tone={briefReplyOpen(reply)?'warn':'ok'}>回复：{reply.stage}</Badge><span className="wb-tiny wb-muted">{messageSender(source,reply.contact)} · {messageOrigin(source,reply)}</span><Btn size="sm" kind="subtle" aria-label={'查看待回复：'+messageSender(source,reply.contact)+'：'+(reply.snippet||'').slice(0,50)} onClick={()=>WB.openReply(reply.id)}>查看并处理</Btn></div>
   {briefReplyOpen(reply)&&<details><summary className="wb-tiny" style={{cursor:'pointer',padding:'8px 0'}}>处理回复</summary>
    <p className="wb-tiny wb-muted">{reply.snippet} · 发出时间：{messageSentTime(source)}</p>
    <ReplyDraft key={reply.id} reply={reply} data={data} actions={<div className="wb-row wb-row--wrap">{['已回复','不需回复'].map(stage=><Btn key={stage} size="sm" onClick={()=>WB.actions.setReplyStage(reply.id,stage).catch((e:Error)=>setError(e.message))}>{stage==='已回复'?'我已回复':'不需回复'}</Btn>)}</div>}/>
   </details>}
  </div>})}
  {error&&<p role="alert">{error}</p>}
 </div>
}
