import { normalizeAiPolicy } from '../../shared/ai-policy.js';
import { loadWorkbenchState, mutateWorkbenchState } from '../storage/state-store.js';
export const usageDay = (at = Date.now()) => new Date(at + 8 * 3600000).toISOString().slice(0, 10);
export class AiBudgetError extends Error {
    readonly code = 'WORKBENCH_AI_BUDGET';
    readonly retryAt = new Date(Date.parse(usageDay() + 'T00:00:00+08:00') + 86400000).toISOString();
    constructor() { super('今日后台 AI 调用预算已用完，明日恢复；可以在设置调整预算'); }
}
export async function reserveModelCall(purpose: string): Promise<void> {
    await mutateWorkbenchState((state: any) => {
        const day = usageDay();
        state.aiUsage ||= {};
        const u = state.aiUsage[day] ||= { calls: 0, reportedSteps: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, seen: {} };
        const policy = normalizeAiPolicy(state.settings.aiPolicy);
        if (policy.dailyCallLimit && u.calls >= policy.dailyCallLimit || policy.dailyTokenLimit && u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens >= policy.dailyTokenLimit)
            throw new AiBudgetError();
        u.calls++;
        u.lastPurpose = purpose;
        return state;
    });
}
export function foldUsage(events: any[]): Map<string, Record<string, number>> {
    const steps = new Map<string, Record<string, number>>();
    for (const event of events) {
        const d = event.data || {};
        const usage = event.type === 'assistant/message' ? d.usage : event.type === 'assistant/chunk' && d.chunk?.type === 'usage' ? d.chunk.usage : undefined;
        if (!usage || !Number.isFinite(usage.inputTokens) || !Number.isFinite(usage.outputTokens))
            continue;
        const values = Object.fromEntries(['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'].map(key => [key, Math.max(0, Number(usage[key]) || 0)]));
        steps.set(JSON.stringify([d.turn ?? event.seq, d.step ?? 0]), values);
    }
    return steps;
}
export async function captureModelUsage(session: any, fromSeq: number): Promise<void> {
    if (typeof session?.snapshotEvents !== 'function')
        return;
    const steps = foldUsage(session.snapshotEvents(fromSeq));
    if (!steps.size)
        return;
    await mutateWorkbenchState((state: any) => {
        const day = usageDay();
        state.aiUsage ||= {};
        const u = state.aiUsage[day] ||= { calls: 0, reportedSteps: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, seen: {} };
        for (const [key, values] of steps) {
            const id = session.id + ':' + key;
            const previous = u.seen[id];
            if (!previous)
                u.reportedSteps++;
            for (const field of Object.keys(values))
                u[field] = (u[field] || 0) + values[field] - (previous?.[field] || 0);
            u.seen[id] = values;
        }
        return state;
    });
}
