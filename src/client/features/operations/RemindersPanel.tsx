import * as React from 'react';
import { WB, Panel, Btn } from '../../core/runtime.js';
export function downloadText(name: string, text: string, type = 'text/plain') { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function RemindersPanel({ revision }: {
    revision?: number;
}) {
    const [items, setItems] = React.useState<any[]>([]), [error, setError] = React.useState('');
    React.useEffect(() => { let live = true; const read = () => WB.rpc('workbench/operationsStatus', {}).then((r: any) => { if (live)
        setItems(r?.reminders || []); }).catch((e: Error) => { if (live)
        setError(e.message); }); read(); const timer = setInterval(read, 60000); return () => { live = false; clearInterval(timer); }; }, [revision]);
    if (!items.length && !error)
        return null;
    return <Panel className="wb-panel--separated" title="到期提醒" sub="会前 30 分钟、24 小时内到期、超过一天待回复；关闭软件期间不弹出提醒">
 {error && <p role="alert">{error}</p>}{items.slice(0, 8).map(row => <div className="wb-reply-item" key={row.id}><strong>{row.kind === 'meeting' ? '会议' : row.kind === 'reply' ? '待回复' : '待办'} · {row.title}</strong><p className="wb-tiny wb-muted">{row.kind==='reply'?'等待回复':row.overdue?(row.kind==='meeting'?'会议已开始':'已逾期'):'即将到期'} · {WB.fmt.datetime(row.at)}</p><div className="wb-row"><Btn size="sm" onClick={() => { if (row.kind === 'reply') {
        WB.store.set({ page: 'replies' });
    }
    else {
        const t = WB.store.get().data?.tasks?.find((t: any) => t.id === row.entityId);
        if (t)
            WB.openTaskForm(t);
        else
            WB.store.set({ page: 'tasks' });
    } }}>查看</Btn><Btn size="sm" onClick={() => WB.rpc('workbench/snoozeReminder', { id: row.id, minutes: 60 }).then(() => { setItems(previous => previous.filter(item => item.id !== row.id)); return WB.actions.reload(); }).catch((e: Error) => setError(e.message))}>稍后 1 小时</Btn>{row.kind !== 'reply' && <Btn size="sm" onClick={() => WB.rpc('workbench/exportCalendar', { id: row.entityId }).then((r: any) => downloadText(r.filename, r.content, 'text/calendar;charset=utf-8')).catch((e: Error) => setError(e.message))}>导出到日历</Btn>}</div></div>)}{items.length > 8 && <p>还有 {items.length - 8} 条，请到任务中心或待回复查看。</p>}
 </Panel>;
}
