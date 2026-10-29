interface Item {
    id: string;
    title?: string;
    snippet?: string;
    status?: string;
    stage?: string;
    sourceRefId?: string;
    sourceRefs?: {
        sourceId: string;
    }[];
    sourceId?: string;
    msgId?: string;
    updatedAt?: string;
}
interface Message {
    id: string;
    excerpt?: string;
    locator?: {
        replyToMsgId?: string | null;
        msgId?: string | null;
    };
    fetchedAt?: string;
}
/** Pinned reply references, open obligations, lexical relevance, then recency. */
export function selectRelatedItems<T extends Item>(items: T[], messages: Message[], sources: Message[], limit = 20): T[] {
    const replyIds = new Set(messages.map(row => row.locator?.replyToMsgId).filter(Boolean));
    const sourceIds = new Set(sources.filter(row => replyIds.has(row.locator?.msgId)).map(row => row.id));
    const text = messages.map(row => row.excerpt || '').join(' ').toLowerCase();
    const grams = new Set(text.match(/[a-z0-9_]{3,}|[\u4e00-\u9fff]{2}/g) || []);
    const score = (row: T) => {
        const pinned = replyIds.has(row.msgId) || sourceIds.has(row.sourceId || row.sourceRefId || '') || row.sourceRefs?.some(ref => sourceIds.has(ref.sourceId));
        const open = row.stage ? !['已回复', '不需回复'].includes(row.stage) : !['completed', 'cancelled'].includes(row.status || '');
        const body = (row.title || row.snippet || '').toLowerCase();
        const relevant = [...grams].filter(word => body.includes(word)).length;
        return (pinned ? 100000 : 0) + (open ? 1000 : 0) + Math.min(100, relevant) * 5;
    };
    return [...items].sort((a, b) => score(b) - score(a) || (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0) || a.id.localeCompare(b.id)).slice(0, limit);
}
