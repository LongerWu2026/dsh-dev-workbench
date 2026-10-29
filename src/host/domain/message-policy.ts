/** A profile's installation day is a fixed boundary, in Asia/Shanghai. */
export function messageProcessingStart(installedAt: unknown): string | null {
    const time = typeof installedAt === 'string' ? Date.parse(installedAt) : NaN;
    if (!Number.isFinite(time)) return null;
    const offset = 8 * 3600000;
    return new Date(Math.floor((time + offset) / 86400000) * 86400000 - offset).toISOString();
}

export function messageSkipReason(state: any, source: any, entry?: any): string | null {
    if (entry?.status === 'skipped') return entry.reviewReason || '历史消息已跳过，不再识别';
    if (entry?.status === 'historical') return '历史暂存消息已跳过，不再识别';
    if(source?.provider==='yunzhijia' && (source.selection?.policy!=='focused-v1'||!source.selection?.reasons?.some((x:string)=>['unread','mention_me','mention_all','followup'].includes(x))))return '旧全量消息队列已停用：仅识别未读、@本人、@全员及明确关联事项';
    const start = messageProcessingStart(state.installedAt);
    if (!start || !source) return null;
    const time = Date.parse(source.locator?.sentAt || source.fetchedAt || '');
    if (!Number.isFinite(time)) return '原消息时间缺失，已跳过识别';
    return time < Date.parse(start) ? '消息早于插件安装日期（北京时间），已跳过识别' : null;
}

/** Keep evidence and completed results; retire old work without allowing retries. */
export function skipHistoricalMessages(state: any): number {
    const sources = new Map((state.sources || []).map((source: any) => [source.id, source]));
    let skipped = 0;
    for (const entry of state.analysisQueue || []) {
        if (['done', 'cancelled', 'skipped'].includes(entry.status)) continue;
        const reason = messageSkipReason(state, sources.get(entry.sourceId), entry);
        if (!reason) continue;
        Object.assign(entry, {status:'skipped', reviewReason:reason, leaseUntil:null, nextRetryAt:null, lastError:null});
        skipped++;
    }
    return skipped;
}
