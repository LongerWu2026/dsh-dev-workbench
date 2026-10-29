import { messageOrigin, messageSender, messageSentTime } from '../../shared/message-display.js'
import * as React from 'react'
import { WB, Panel } from '../core/runtime.js'
import type { Source } from '../../shared/contracts.js'
interface Entry { id: string; sourceId: string; status: string; lastError?: string; reviewReason?: string; attempts?: number; analysis?: { summary?: string } }
export function AnalysisQueuePanel({ entries, sources }: { entries: Entry[]; sources: Source[] }): React.ReactElement {
  const [page, setPage] = React.useState(0)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [visibility, setVisibility] = React.useState('open')
  const rows = entries.filter(entry => visibility === 'all' || (visibility === 'failed' ? entry.status === 'failed' : visibility === 'done' ? entry.status === 'done' : visibility==='skipped' ? ['skipped','historical'].includes(entry.status) : !['done','cancelled','historical','skipped'].includes(entry.status))).slice().reverse()
  const index = Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1))
  const labels: Record<string, string> = { pending: '待识别', running: '分析中', failed: '失败', awaiting_human: '待确认', historical:'已跳过', skipped:'已跳过', done:'已完成', cancelled:'已取消' }
  async function action(entry: Entry, kind: 'analyze' | 'retry' | 'confirm' | 'cancel'): Promise<void> {
    if (busyId) return
    setBusyId(entry.id)
    try {
      if (kind === 'confirm') await WB.actions.analyzeConfirm(entry.id)
      else if (kind === 'cancel') await WB.actions.analysisCancel(entry.id)
      else {
        if (kind === 'retry') await WB.actions.analysisRetry(entry.id)
        const result = await WB.actions.analyzeRun(1, [entry.id])
        WB.toast('本条识别已入队：' + (result.jobId || ''), 'ok')
      }
      await WB.actions.reload()
    } catch (error) { WB.toast(error instanceof Error ? error.message : String(error), 'err') }
    finally { setBusyId(null) }
  }
  return <Panel title="AI 识别队列" sub={'当前 ' + rows.length + ' 条；采集、分析和人工确认分别跟踪'}><div>
    <label className="wb-label">识别记录 <select className="wb-select" aria-label="识别记录" value={visibility} onChange={event=>{setVisibility(event.target.value);setPage(0)}}><option value="open">待处理</option><option value="failed">识别失败</option><option value="done">已完成</option><option value="skipped">已跳过（历史消息）</option><option value="all">全部</option></select></label>
    {rows.slice(index * 20, index * 20 + 20).map(entry => { const source = sources.find(source => source.id === entry.sourceId); return <article key={entry.id} className="wb-reply-item">
      <strong>{labels[entry.status] || entry.status}</strong>
      <p className="wb-tiny wb-muted" style={{overflowWrap:'anywhere'}}>发件人：{messageSender(source)} · 来自：{messageOrigin(source)}</p>
      <p className="wb-tiny wb-muted">发出时间：{messageSentTime(source)}</p>
      <p>{source?.excerpt || '原消息不可用'}</p>
      {entry.analysis?.summary && <p className="wb-tiny wb-muted">{entry.analysis.summary}</p>}
      {entry.lastError && <p className="wb-tiny wb-muted">{entry.lastError}</p>}
      {entry.reviewReason && <p className="wb-tiny wb-muted">{entry.reviewReason}</p>}
      {!['skipped','historical'].includes(entry.status) && <div className="wb-reply-actions">
        {entry.analysis && <select className="wb-select" aria-label="复核识别结果" value="" onChange={event=>{const verdict=event.target.value;if(verdict)WB.rpc('workbench/reviewAnalysis',{entryId:entry.id,verdict,note:''}).then(()=>WB.toast('已记录质量复核','ok')).catch((e:Error)=>WB.toast(e.message,'err'))}}><option value="">复核识别结果</option><option value="correct">识别正确</option><option value="false_positive">误建事项</option><option value="missed_action">遗漏待办</option><option value="wrong_date">日期错误</option><option value="wrong_completion">完成误判</option><option value="wrong_link">关联错误</option></select>}

        {entry.status === 'pending' && <button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'analyze')}>识别本条</button>}
        {entry.status === 'awaiting_human' && (entry.analysis ? <><button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'confirm')}>确认建档</button><button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'retry')}>重新识别</button></> : <button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'retry')}>识别本条</button>)}
        {entry.status === 'failed' && <button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'retry')}>重试</button>}
        {['done','cancelled'].includes(entry.status) && <button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'retry')}>重新识别</button>}
        {!['done','cancelled'].includes(entry.status) && <button type="button" className="wb-chip" disabled={!!busyId} onClick={() => action(entry, 'cancel')}>取消分析</button>}
      </div>}
    </article>})}
    {!rows.length && <p className="wb-tiny wb-muted">没有待处理的识别条目。</p>}
    {rows.length > 20 && <div className="wb-reply-actions"><button type="button" className="wb-chip" disabled={index === 0} onClick={() => setPage(index - 1)}>上一页</button><span>{index + 1} / {Math.ceil(rows.length / 20)}</span><button type="button" className="wb-chip" disabled={(index + 1) * 20 >= rows.length} onClick={() => setPage(index + 1)}>下一页</button></div>}
  </div></Panel>
}
