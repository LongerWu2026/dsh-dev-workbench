import { newId, hostNowIso } from '../platform/runtime.js';
export interface ChangeRecord {
    id: string;
    at: string;
    collection: string;
    entityId: string;
    title: string;
    actor: string;
    reason: string;
    before: Record<string, any> | null;
    after: Record<string, any> | null;
    revertedAt?: string;
}
const collections = ['tasks', 'replies', 'knowledge', 'radar'];
const equal = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** Persist with the business commit; no independent write can report a change that failed to save. */
export function appendChangeHistory(previous: any, next: any): void {
    const events = (next.audit || []).filter((event: any) => !(previous.audit || []).some((old: any) => old.id === event.id));
    if (events.some((event: any) => event.event === 'migration.applied'))
        return;
    const automated = events.some((event: any) => /^analysis\.|^radar.summarized/.test(event.event || event.type || ''));
    const reason = events.map((event: any) => event.summary).filter(Boolean).join('；').slice(0, 500) || '业务数据更新';
    next.changeHistory ||= [];
    for (const collection of collections) {
        const before = new Map<string, any>((previous[collection] || []).map((row: any) => [row.id, row]));
        const after = new Map<string, any>((next[collection] || []).map((row: any) => [row.id, row]));
        for (const id of new Set([...before.keys(), ...after.keys()])) {
            const a = before.get(id) || null, b = after.get(id) || null;
            if (equal(a, b))
                continue;
            next.changeHistory.push({ id: newId('change'), at: hostNowIso(), collection, entityId: id, title: b?.title || a?.title || b?.snippet || a?.snippet || id, actor: automated ? 'ai' : 'user-or-tool', reason, before: a, after: b } satisfies ChangeRecord);
        }
    }
}
/** Compare the fields being reverted, not unrelated later edits; never delete a created record. */
export function revertChange(state: any, id: string): any {
    const record: ChangeRecord | undefined = state.changeHistory?.find((row: ChangeRecord) => row.id === id);
    if (record && !collections.includes(record.collection))
        throw new Error('不支持的变更集合');
    if (!record || record.revertedAt)
        throw new Error('变更不存在或已经撤销');
    if (!record.after)
        throw new Error('已删除记录请通过备份恢复，以保证关联完整');
    const current = state[record.collection]?.find((row: any) => row.id === record.entityId);
    if (!current)
        throw new Error('记录已不存在，不能撤销');
    const fields = Object.keys(record.after).filter(key => !['__proto__', 'constructor', 'prototype', 'id', 'createdAt', 'updatedAt', 'humanGuard', 'runIds', 'sourceRefs', 'taskIds'].includes(key) && !equal(record.before?.[key], record.after?.[key]));
    if (fields.some(key => !equal(current[key], record.after?.[key])))
        throw new Error('这些字段已有后续修改，请先检查最新变更，未覆盖现有内容');
    if (!record.before && record.collection === 'tasks' && (current.humanGuard?.editedFields || []).some((key: string) => !['runIds'].includes(key)))
        throw new Error('新增事项已被人工编辑，请在任务中心处理，未自动取消');
    if (!record.before) {
        if (record.collection === 'tasks') {
            current.status = 'cancelled';
            current.humanGuard = { ...current.humanGuard, ignored: true, editedFields: [...new Set([...(current.humanGuard?.editedFields || []), 'status'])] };
        }
        else if (record.collection === 'replies') {
            current.stage = '不需回复';
            current.humanGuard = true;
        }
        else
            throw new Error('新增资讯或知识请使用对应管理入口处理');
    }
    else {
        for (const key of fields)
            current[key] = record.before[key] ?? null;
        if (record.collection === 'tasks')
            current.humanGuard = { ...current.humanGuard, editedFields: [...new Set([...(current.humanGuard?.editedFields || []), ...fields])] };
        if (record.collection === 'replies')
            current.humanGuard = true;
    }
    current.updatedAt = hostNowIso();
    record.revertedAt = current.updatedAt;
    return current;
}
