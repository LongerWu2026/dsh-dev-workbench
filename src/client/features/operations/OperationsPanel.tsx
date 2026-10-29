import * as React from 'react';
import { WB, Panel, Btn, Input, Modal } from '../../core/runtime.js';
interface Change {
    id: string;
    title: string;
    reason: string;
    actor: string;
    at: string;
    before: unknown;
    after: unknown;
    revertedAt?: string;
}
export function OperationsPanel({ revision }: {
    revision?: number;
}) {
    const [evaluating, setEvaluating] = React.useState(false);
    const [status, setStatus] = React.useState<any>(null), [error, setError] = React.useState(''), [calls, setCalls] = React.useState(''), [tokens, setTokens] = React.useState(''), [history, setHistory] = React.useState<any>(null), [offset, setOffset] = React.useState(0), [selected, setSelected] = React.useState<Change | null>(null), [busy, setBusy] = React.useState(false);
    const readGeneration = React.useRef(0), draftGeneration = React.useRef(0);
    const read = () => {
        const generation = ++readGeneration.current;
        return WB.rpc('workbench/operationsStatus', {}, AbortSignal.timeout(15000)).then((value: any) => {
            if (generation !== readGeneration.current) return;
        setStatus(value);
        if (draftGeneration.current === 0) {
        setCalls(String(value?.policy?.dailyCallLimit || 0));
        setTokens(String(value?.policy?.dailyTokenLimit || 0));
        }
        }).catch((e: Error) => { if (generation === readGeneration.current) setError(e.message); });
    };
    React.useEffect(() => { void read(); return () => { readGeneration.current += 1; }; }, [revision]);
    async function saveBudget() {
        const draft = draftGeneration.current;
        try {
            await WB.actions.saveSettings({ aiPolicy: { dailyCallLimit: Number(calls), dailyTokenLimit: Number(tokens) } });
            if (draftGeneration.current === draft) draftGeneration.current = 0;
            await read();
        } catch (e) { setError(String((e as Error).message)); }
    }
    const loadHistory = (from = 0) => WB.rpc('workbench/changesPage', { request: { offset: from, limit: 10 } }).then((value: any) => { setHistory(value); setOffset(from); }).catch((e: Error) => setError(e.message));
    async function undo() { if (!selected || busy)
        return; setBusy(true); try {
        await WB.rpc('workbench/undoChange', { id: selected.id });
        setSelected(null);
        await loadHistory(offset);
        await WB.actions.reload();
    }
    catch (e) {
        setError(String((e as Error).message));
    }
    finally {
        setBusy(false);
    } }
    const reviews = status?.qualityReviews || [], counts = reviews.reduce((acc: Record<string, number>, row: any) => ({ ...acc, [row.verdict]: (acc[row.verdict] || 0) + 1 }), {});
    return <Panel title="运行与质量" sub="后台用量、积压和业务变更；不把执行成功当作识别正确">
  {error && <p role="alert">{error}</p>}
  <Btn size="sm" onClick={read}>读取最新状态</Btn>
  {status && <p>待分析 {status.queue?.pending || 0} · 失败 {status.queue?.failed || 0} · 最老待分析 {status.queue?.oldestPendingMinutes || 0} 分钟 · 数据 {(status.storageBytes / 1048576).toFixed(1)} MB</p>}
  <p>今日后台调用 {status?.usage?.calls || 0} 次；收到用量的步骤 {status?.usage?.reportedSteps || 0} 个</p>
  <p className="wb-tiny wb-muted">{status?.usage?.reportedSteps ? `非缓存输入 ${status.usage.inputTokens} · 输出 ${status.usage.outputTokens} · 缓存读取 ${status.usage.cacheReadTokens} · 缓存写入 ${status.usage.cacheWriteTokens}` : '模型尚未回传 Token 用量，不能按 0 用量计算费用。'} 同一会话历史仍可能计费。</p>
  <div className="wb-row wb-row--wrap"><label>每日后台调用上限<Input type="number" min="0" value={calls} onChange={(e: any) => { draftGeneration.current += 1; setCalls(e.target.value); }}/></label><label>每日已知 Token 上限<Input type="number" min="0" value={tokens} onChange={(e: any) => { draftGeneration.current += 1; setTokens(e.target.value); }}/></label><Btn onClick={saveBudget}>保存预算</Btn></div>
  <p className="wb-tiny wb-muted">0 表示不限。达到上限后暂停新的后台请求；Token 上限按已回传值判断，单次请求可能越过阈值。用量缺失时请使用调用次数上限。</p>
  <p>人工复核 {reviews.length} 条 · 正确 {counts.correct || 0} · 误建 {counts.false_positive || 0} · 漏办 {counts.missed_action || 0} · 日期错误 {counts.wrong_date || 0} · 完成误判 {counts.wrong_completion || 0} · 关联错误 {counts.wrong_link || 0}</p>
  <Btn size="sm" disabled={evaluating} onClick={async () => { setEvaluating(true); setError(''); try {
        const r = await WB.rpc('workbench/evaluateRecognition', {}, AbortSignal.timeout(240000));
        setStatus((previous: any) => ({ ...previous, qualityEvaluation: r }));
    }
    catch (e) {
        setError(String((e as Error).message));
    }
    finally {
        setEvaluating(false);
    } }}>{evaluating ? '正在运行标注样本…' : '运行 10 条识别质量样本'}</Btn>
  <p className="wb-tiny wb-muted">使用已有模型，仅分析合成样本，不创建业务事项。不是实际业务总体准确率。</p>
  {status?.qualityEvaluation && <p>最近样本：返回 {status.qualityEvaluation.report.returned}/{status.qualityEvaluation.report.samples} · 完全符合标签 {status.qualityEvaluation.report.exact} · 日期错误 {status.qualityEvaluation.report.wrongDate} · 完成误判 {status.qualityEvaluation.report.wrongCompletion}</p>}
  <Btn size="sm" onClick={() => loadHistory(0)}>查看变更记录</Btn>
  {history && <div>{(history.items || []).map((row: Change) => <article className="wb-reply-item" key={row.id}><strong>{row.title}</strong><p className="wb-tiny wb-muted">{row.actor === 'ai' ? 'AI' : '人工/工具'} · {row.at} · {row.reason}</p><Btn size="sm" onClick={() => setSelected(row)}>查看前后变化</Btn></article>)}<div className="wb-row"><Btn disabled={offset === 0} onClick={() => loadHistory(Math.max(0, offset - 10))}>上一页</Btn><span>{history.total} 条</span><Btn disabled={offset + 10 >= history.total} onClick={() => loadHistory(offset + 10)}>下一页</Btn></div></div>}
  <Modal open={!!selected} title="业务变更" onClose={() => setSelected(null)} footer={<div className="wb-row"><Btn onClick={() => setSelected(null)}>关闭</Btn><Btn disabled={busy || !!selected?.revertedAt || !selected?.after} onClick={undo}>撤销这次变更</Btn></div>}>
   <p>撤销前会检查是否有后续修改。撤销新建待办会取消该事项并保留证据。</p><details open><summary>修改前</summary><pre className="wb-code">{JSON.stringify(selected?.before, null, 2)}</pre></details><details open><summary>修改后</summary><pre className="wb-code">{JSON.stringify(selected?.after, null, 2)}</pre></details>
  </Modal>
 </Panel>;
}
