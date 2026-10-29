/** IDs remain available as message evidence, never as a person's display name. */
export function messageSender(source: any, contact?: string | null): string {
    const loc = source?.locator || {};
    const ids = [loc.senderId, loc.groupId].filter(Boolean);
    const botId = /^BOT-[0-9a-f]{4,}(?:-[0-9a-f]+)*(?:…|\.{3})?$/i;
    for (const name of [source?.sender, contact]) {
        if (typeof name === 'string' && name.trim() && !botId.test(name) && !ids.some(id => name === id || name === id.slice(0, 8) + '…' || name === id.slice(0, 8) + '...')) return name;
    }
    if (String(loc.senderId || '').toUpperCase().startsWith('BOT-') || [source?.sender, contact].some(name => typeof name === 'string' && botId.test(name))) return '机器人';
    return '未知发件人';
}

export function messageConversation(groupName?: string | null, groupId?: string | null): string {
    return groupName && groupName !== groupId && groupName !== '未知会话' ? groupName : '原会话';
}

/** Prefer original-message metadata; legacy replies can retain the group name. */
export function messageOrigin(source: any, reply?: any): string {
    const loc = source?.locator || {};
    for (const [name, id] of [[loc.groupName, loc.groupId || reply?.groupId], [reply?.groupName, reply?.groupId || loc.groupId]]) {
        const label = messageConversation(name, id);
        if (label !== '原会话') return label;
    }
    return '会话名称未知';
}

export function taskSource(task:any, sources:any[]):any {
    const ids=[task?.sourceRefId,...(task?.sourceRefs || []).map((ref:any)=>ref.sourceId)].filter(Boolean);
    for(const id of ids){const source=sources.find(row=>row.id===id);if(source)return source}
    return null;
}

const messageTimeFormat = /* @__PURE__ */ new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
/** Only the original message timestamp counts; intake and reply updates do not. */
export function messageSentTime(source: any): string {
    const sentAt = source?.locator?.sentAt;
    if (typeof sentAt !== 'string' || !sentAt.trim()) return '未知';
    const date = new Date(sentAt);
    if (Number.isNaN(date.getTime())) return '未知';
    const parts = Object.fromEntries(messageTimeFormat.formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}（北京时间）`;
}
