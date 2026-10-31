/** A display-only decision. Never changes provider read receipts or business records. */
export function isIrrelevantConversation(data: any, conversation: any): boolean {
    const account = data.messageInbox?.accountId, group = conversation.groupId;
    const count = conversation.unreadCount, head = conversation.latestMsgId;
    if (!account || !group || !head || !Number.isInteger(count) || count <= 0) return false;
    const cursor = data.syncCursors?.[account + ':' + group];
    if (!cursor || cursor.accountId !== account || cursor.intakePolicy !== 'focused-v1' || cursor.resumeBefore ||
        cursor.lastMsgId !== head || cursor.unreadHeadId !== head || cursor.unreadCount !== count ||
        data.syncCursors?.['__pending:' + account]?.pendingGroups?.some((row: any) => row.groupId === group)) return false;
    const ids = new Set<string>(Array.isArray(cursor.unreadMsgIds) ? cursor.unreadMsgIds : []);
    if (ids.size !== count || !ids.has(head)) return false;
    const sources = (data.sources || []).filter((source: any) => source.provider === 'yunzhijia' &&
        source.locator?.accountId === account && source.locator?.groupId === group);
    const sourceIds = new Set(sources.map((source: any) => source.id));
    if ((data.tasks || []).some((task: any) => !['completed', 'cancelled'].includes(task.status) &&
        (sourceIds.has(task.sourceRefId) || task.sourceRefs?.some((ref: any) => sourceIds.has(ref.sourceId))))) return false;
    if ((data.replies || []).some((reply: any) => ['待回复', '已确认收到', '已自动回复'].includes(reply.stage) &&
        (sourceIds.has(reply.sourceId) || reply.accountId === account && reply.groupId === group))) return false;
    return [...ids].every(msgId => {
        const matches = sources.filter((source: any) => source.locator.msgId === msgId);
        if (matches.length !== 1) return false;
        const source = matches[0];
        if (source.locator.direction !== 'inbound' || String(source.excerpt || '').length >= 4000 || source.selection?.policy !== 'focused-v1' || !source.selection.reasons?.includes('unread')) return false;
        const entries = (data.analysisQueue || []).filter((row: any) => row.sourceId === source.id);
        return entries.length === 1 && entries.every((row: any) => row.accountId === account && row.groupId === group && row.msgId === msgId &&
            row.status === 'done' && row.analysis?.relevance === 'irrelevant' && row.analysis.noise === true &&
            Array.isArray(row.analysis.items) && !row.analysis.items.length &&
            Number.isFinite(Date.parse(source.fetchedAt)) && Date.parse(row.analyzedAt) >= Date.parse(source.fetchedAt));
    });
}
