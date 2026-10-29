interface Source {
    id: string;
    fetchedAt?: string;
    selection?:{reasons:string[];unreadCount:number|null};
    locator?: {
        sentAt?: string;
        accountId?: string;
        groupId?: string;
    };
}
interface Entry {
    id: string;
    sourceId: string;
    at?: string;
    status: string;
    attempts?: number;
}
/** Give recent conversations 4/5 of capacity, reserve 1/5 for backlog; keep each conversation chronological. */
export function selectQueueEntries<T extends Entry>(entries: T[], sources: Source[], limit: number, now = Date.now()): T[] {
    const index = new Map(sources.map(source => [source.id, source]));
    const time = (entry: T) => Date.parse(index.get(entry.sourceId)?.locator?.sentAt || index.get(entry.sourceId)?.fetchedAt || entry.at || '') || 0;
    const groups = new Map<string, T[]>();
    for (const entry of entries) {
        const source = index.get(entry.sourceId);
        const key = JSON.stringify([source?.locator?.accountId, source?.locator?.groupId || entry.sourceId]);
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key)!.push(entry);
    }
    const queues = [...groups.values()].map(rows => rows.sort((a, b) => time(a) - time(b)));
    const priority=(rows:T[])=>Math.max(...rows.map(row=>{const s=index.get(row.sourceId)?.selection;return s?.reasons.includes('mention_me')?3:s?.unreadCount&&s.unreadCount>0?2:s?.reasons.includes('mention_all')?1:0}));
    const recent = queues.filter(rows => time(rows.at(-1)!) >= now - 24 * 3600000).sort((a,b)=>priority(b)-priority(a)||time(b.at(-1)!)-time(a.at(-1)!));
    const backlog = queues.filter(rows => !recent.includes(rows)).sort((a, b) => time(a[0]) - time(b[0]));
    const take = (rows: T[][], n: number, out: T[]) => { while (n > 0 && rows.some(q => q.length)) {
        for (const q of rows)
            if (q.length && n > 0) {
                out.push(q.shift()!);
                n--;
            }
    } };
    const chosen: T[] = [];
    const reserve = backlog.length && recent.length && limit > 1 ? Math.max(1, Math.floor(limit / 5)) : 0;
    take(recent, limit - reserve, chosen);
    take(backlog, limit - chosen.length, chosen);
    take(recent, limit - chosen.length, chosen);
    return chosen.sort((a, b) => time(a) - time(b));
}
export function effectiveBatchSize(configured: number, last?: {
    status?: string;
    durationMs?: number;
    inputCount?:number;failures?:number;processed?:number;modelCalls?:number;
}, adaptive = true): number {
    const cap = Math.max(1, Math.min(20, configured || 5));
    if (!adaptive)
        return cap;
    const count=last?.inputCount||0;
    if(last?.status==='partial'&&count>1&&(last.failures||0)>=count&&last.processed===0&&(last.modelCalls||0)>=2)return Math.min(cap,Math.max(1,Math.floor(count/2)));
    if (last?.status === 'partial' || last?.status === 'deferred' || (last?.durationMs || 0) > 90000)
        return Math.min(cap, 5);
    return cap;
}
export function queueHealth(entries: Entry[], sources: Source[], now = Date.now()) {
    const index = new Map(sources.map(row => [row.id, row]));
    const pending = entries.filter(row => row.status === 'pending');
    const times = pending.map(row => Date.parse(index.get(row.sourceId)?.locator?.sentAt || index.get(row.sourceId)?.fetchedAt || row.at || '')).filter(Number.isFinite);
    return { pending: pending.length, failed: entries.filter(row => row.status === 'failed').length, historical: 0, skipped: entries.filter(row => ['skipped','historical'].includes(row.status)).length, oldestPendingMinutes: times.length ? Math.max(0, Math.round((now - Math.min(...times)) / 60000)) : 0 };
}
