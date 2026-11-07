import { messageOrigin, messageSender, messageSentTime } from '../../shared/message-display.js'
import * as React from 'react'
import { WB, Modal, Panel, useStore } from '../core/runtime.js'
import {LinkedMessageImages,type ImageData} from './LinkedMessageImages.js'
import {AnalysisMessageDialog} from './AnalysisMessageDialog.js'
import type { Source } from '../../shared/contracts.js'
interface Entry { id: string; sourceId: string; status: string; lastError?: string; reviewReason?: string; reviewKind?:string; reviewDismissed?:boolean; rejectedEvidence?:string[]; attempts?: number; analysis?: { summary?: string } }
type QueueImage = {accountId:string;entryId:string;image:ImageData}
export function AnalysisQueuePanel({ entries, sources, accountId }: { entries: Entry[]; sources: Source[]; accountId?:string }): React.ReactElement {
  const preview:QueueImage|undefined=useStore().analysisQueueImagePreview
  const previewVisible=preview&&preview.accountId===accountId&&entries.some(entry=>entry.id===preview.entryId)
  React.useEffect(()=>{
    if(preview&&!previewVisible)WB.store.set({analysisQueueImagePreview:null})
  },[preview,previewVisible])
  function showImage(entry:Entry,image:ImageData){
    if(accountId)WB.store.set({analysisQueueImagePreview:{accountId,entryId:entry.id,image}})
  }
  const [page, setPage] = React.useState(0)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [visibility, setVisibility] = React.useState('open')
  const [review, setReview] = React.useState<{id:string;accountId?:string}|null>(null)
  const reviewing = review && review.accountId === accountId
    ? entries.find(entry => entry.id === review.id && entry.status === 'awaiting_human') : undefined
  React.useEffect(()=>{if(review&&!reviewing)setReview(null)},[review,reviewing])
  const rows = entries.filter(entry => {
    if (visibility === 'all') return true
    if (visibility === 'review') return entry.status === 'awaiting_human'
    if (visibility === 'dismissed') return entry.reviewDismissed === true
    if (visibility === 'skipped') return ['skipped','historical'].includes(entry.status)
    if (visibility === 'open') return !['done','cancelled','historical','skipped'].includes(entry.status)
    return entry.status === visibility
  }).reverse()
  const index = Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1))
  const labels: Record<string, string> = { pending: '待识别', running: '分析中', failed: '失败', awaiting_human: '待确认', historical:'已跳过', skipped:'已跳过', done:'已完成', cancelled:'已取消' }
  async function action(entry: Entry, kind: 'analyze' | 'retry' | 'confirm' | 'cancel' | 'dismiss' | 'restore'): Promise<void> {
    if (busyId) return
    setBusyId(entry.id)
    try {
      if (kind === 'dismiss' || kind === 'restore') {
        await WB.actions.setAnalysisDismissed(entry.id, kind === 'dismiss').catch(() => {})
        return
      }
      if (kind === 'confirm') await WB.actions.analyzeConfirm(entry.id)
      else if (kind === 'cancel') await WB.actions.analysisCancel(entry.id)
      else {
        if (kind === 'retry') await WB.actions.analysisRetry(entry.id)
        const result = await WB.actions.analyzeRun(1, [entry.id])
        // Startup and final outcome are reported by the shared analysis monitor.
      }
      await WB.actions.reload()
    } catch (error) { if(!(error as any)?.workbenchAnalysisNotified)WB.toast(error instanceof Error ? error.message : String(error), 'err') }
    finally { setBusyId(null) }
  }
  return <Panel title="AI 识别队列" sub={'当前 ' + rows.length + ' 条；采集、分析和人工确认分别跟踪'}><div>
    <label className="wb-label">识别记录 <select className="wb-select" aria-label="识别记录" value={visibility} onChange={event=>{setVisibility(event.target.value);setPage(0)}}><option value="open">待处理</option><option value="review">待确认</option><option value="failed">识别失败</option><option value="done">已完成</option><option value="dismissed">无需处理</option><option value="skipped">已跳过（历史消息）</option><option value="all">全部</option></select></label>
    {rows.slice(index * 20, index * 20 + 20).map(entry => { const source = sources.find(source => source.id === entry.sourceId); return <article key={entry.id} className="wb-reply-item">
      <strong>{entry.reviewDismissed ? '无需处理' : labels[entry.status] || entry.status}</strong>
      <p className="wb-tiny wb-muted" style={{overflowWrap:'anywhere'}}>发件人：{messageSender(source)} · 来自：{messageOrigin(source)}</p>
      <p className="wb-tiny wb-muted">发出时间：{messageSentTime(source)}</p>
      <p>{source?.excerpt || '原消息不可用'}</p>
      <LinkedMessageImages source={source} accountId={accountId} entryId={entry.id} onPreview={image=>showImage(entry,image)}/>
      {entry.analysis?.summary && <p className="wb-tiny wb-muted">{entry.analysis.summary}</p>}
      {entry.lastError && <p className="wb-tiny wb-muted">{entry.lastError}</p>}
      {entry.reviewReason && <p className="wb-tiny wb-muted">{entry.reviewReason}</p>}
      {!!entry.rejectedEvidence?.length&&<details><summary className="wb-tiny wb-muted">未通过校验的依据</summary>{entry.rejectedEvidence.map((text,index)=><p key={index} className="wb-tiny" style={{overflowWrap:'anywhere'}}>{text}</p>)}</details>}
      {!['skipped','historical'].includes(entry.status) && <div className="wb-reply-actions">
        {entry.analysis && <select className="wb-select" aria-label="复核识别结果" value="" onChange={event=>{const verdict=event.target.value;if(verdict)WB.rpc('workbench/reviewAnalysis',{entryId:entry.id,verdict,note:''}).then(()=>WB.toast('已记录质量复核','ok')).catch((e:Error)=>WB.toast(e.message,'err'))}}><option value="">复核识别结果</option><option value="correct">识别正确</option><option value="false_positive">误建事项</option><option value="missed_action">遗漏待办</option><option value="wrong_date">日期错误</option><option value="wrong_completion">完成误判</option><option value="wrong_link">关联错误</option></select>}

        {entry.status === 'pending' && <button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'analyze')}>识别本条</button>}
        {entry.status === 'awaiting_human' && <button type="button" className="wb-chip" onClick={() => setReview({id:entry.id,accountId})}>查看消息</button>}
        {entry.status === 'awaiting_human' && (entry.analysis&&entry.reviewKind!=='recognition' ? <><button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'confirm')}>确认建档</button><button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'retry')}>重新识别</button></> : <button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'retry')}>重试本条</button>)}
        {entry.status === 'awaiting_human' && <button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'dismiss')}>标为无需处理</button>}
        {entry.reviewDismissed && <button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'restore')}>恢复待确认</button>}
        {entry.status === 'failed' && <button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'retry')}>重试</button>}
        {['done','cancelled'].includes(entry.status) && <button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'retry')}>重新识别</button>}
        {!['done','cancelled','awaiting_human'].includes(entry.status) && <button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'cancel')}>取消分析</button>}
      </div>}
    </article>})}
    {!rows.length && <p className="wb-tiny wb-muted">没有待处理的识别条目。</p>}
    {rows.length > 20 && <div className="wb-reply-actions"><button type="button" className="wb-chip" disabled={index === 0} onClick={() => setPage(index - 1)}>上一页</button><span>{index + 1} / {Math.ceil(rows.length / 20)}</span><button type="button" className="wb-chip" disabled={(index + 1) * 20 >= rows.length} onClick={() => setPage(index + 1)}>下一页</button></div>}
    {reviewing&&<AnalysisMessageDialog key={reviewing.id} entryId={reviewing.id} source={sources.find(source=>source.id===reviewing.sourceId)}
      sources={sources} accountId={accountId} reason={reviewing.reviewReason||reviewing.analysis?.summary}
      canConfirm={!!reviewing.analysis&&reviewing.reviewKind!=='recognition'} onClose={()=>setReview(current=>current===review?null:current)}/>}
    {previewVisible&&<Modal open title="原消息图片" width={840} onClose={()=>WB.store.set({analysisQueueImagePreview:null})}>
      <img src={`data:${preview.image.mediaType};base64,${preview.image.data}`} alt="原消息图片"
        style={{display:'block',maxWidth:'100%',maxHeight:'60vh',objectFit:'contain',margin:'0 auto'}}/>
    </Modal>}
  </div></Panel>
}
