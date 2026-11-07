import * as React from 'react'
import type { Source } from '../../shared/contracts.js'
import { messageOrigin, messageSender, messageSentTime } from '../../shared/message-display.js'
import { Btn, Modal, WB, useStore } from '../core/runtime.js'
import { LinkedMessageImages, type ImageData } from './LinkedMessageImages.js'

export function AnalysisMessageDialog({entryId,source,sources,accountId,reason,canConfirm,onClose}:{
  entryId:string; source?:Source; sources:Source[]; accountId?:string; reason?:string; canConfirm:boolean; onClose:()=>void
}) {
  const [image,setImage]=React.useState<ImageData|null>(null)
  const {busy}=useStore()
  const loc=source?.locator
  const quoted=source&&loc?.replyToMsgId&&loc.groupId?sources.find(row=>{
    const other=row.locator
    return other&&row.id!==source.id&&row.provider===source.provider&&other.msgId===loc.replyToMsgId&&other.groupId===loc.groupId&&
      (other.accountId||null)===(loc.accountId||null)&&(row.projectId||null)===(source.projectId||null)
  }):undefined

  async function mark(confirm:boolean) {
    try {
      if(confirm) await WB.actions.analyzeConfirm(entryId)
      else await WB.actions.setAnalysisDismissed(entryId,true)
      onClose()
    } catch { /* The shared action displays the error. */ }
  }

  return <>
    <Modal open title="待确认消息" width={660} onClose={onClose} footer={<>
      <Btn onClick={onClose}>返回列表</Btn>
      <Btn disabled={busy} onClick={()=>void mark(false)}>标为无需处理</Btn>
      {canConfirm&&<Btn kind="primary" disabled={busy} onClick={()=>void mark(true)}>确认建档</Btn>}
    </>}>
      <div className="wb-stack" style={{gap:12,overflowWrap:'anywhere'}}>
        {source&&<div className="wb-inbox-meta">
          <span>发件人：{messageSender(source)}</span><span>来自：{messageOrigin(source)}</span><span>发出时间：{messageSentTime(source)}</span>
        </div>}
        <section aria-label="原消息内容">
          <strong>原消息</strong>
          <p style={{whiteSpace:'pre-wrap'}}>{source?source.excerpt||'没有保存文本内容':'工作台未找到这条原消息'}</p>
          <LinkedMessageImages source={source} accountId={accountId} entryId={entryId} allowLookup onPreview={setImage}/>
        </section>
        {loc?.replyToMsgId&&<section aria-label="引用消息">
          <strong>引用消息</strong>
          {quoted&&<div className="wb-tiny wb-muted">{messageSender(quoted)} · {messageSentTime(quoted)}</div>}
          <p style={{whiteSpace:'pre-wrap'}}>{quoted?quoted.excerpt||'引用消息没有保存文本内容':'工作台未找到被引用的原消息，请回到原会话核对。'}</p>
        </section>}
        {reason&&<section aria-label="待确认原因"><strong>待确认原因</strong><p>{reason}</p></section>}
      </div>
    </Modal>
    {image&&<Modal open title="原消息图片" width={840} onClose={()=>setImage(null)}>
      <img src={`data:${image.mediaType};base64,${image.data}`} alt="原消息图片"
        style={{display:'block',maxWidth:'100%',maxHeight:'60vh',objectFit:'contain',margin:'0 auto'}}/>
    </Modal>}
  </>
}
