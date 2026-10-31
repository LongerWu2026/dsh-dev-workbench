import * as React from 'react'
import {WB,acceptSnapshot} from '../../core/runtime.js'
import {BUSY_REPLY_TEXT} from '../../../shared/busy-reply.js'
export function BusyReply(){
 const data=WB.useStore().data||{},config=data.settings?.busyReply||{},[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');const lock=React.useRef(false)
 const uncertain=Object.values(data.busyReplyDeliveries||{}).filter((d:any)=>['reserved','sending','uncertain'].includes(d.status)).length
 const pending=(data.replies||[]).filter((r:any)=>!r.archivedAt&&r.stage==='已自动回复').length
 const description=[
  '开启后仅自动回复新收到的私聊，群聊不回复；本次忙碌每个会话仅告知一次。',
  `回复内容：${BUSY_REPLY_TEXT}`,
  '回复后保留在待回复中，标记为「已自动回复」，仍需人工答复。插件运行时每分钟检查，关闭后停止新的自动告知。',
  pending>0?`当前有 ${pending} 条已自动回复的消息待人工答复。`:'',
  uncertain>0?`${uncertain} 个会话正在处理或结果待核实，不会重复告知。`:'',
  error||data.lastBusyReplyError||'',
 ].filter(Boolean).join('\n')
 async function toggle(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const snapshot=await WB.rpc('workbench/busyReplyConfigure',{request:{enabled:!config.enabled}});acceptSnapshot(snapshot)}catch(e){const message=(e as Error).message;setError(message);WB.toast(message,'err')}finally{lock.current=false;setBusy(false)}}
 return <button className={`wb-btn wb-btn--sm wb-btn--${config.enabled?'primary':'ghost'}`} style={{whiteSpace:'nowrap'}} type="button" role="switch" aria-label="忙碌自动回复" aria-checked={!!config.enabled} title={description} disabled={busy} onClick={toggle}>{busy?'保存中…':`忙碌自动回复 · ${config.enabled?'已开启':'已关闭'}`}</button>
}
