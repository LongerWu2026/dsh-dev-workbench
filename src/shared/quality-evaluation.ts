export function evaluateQuality(fixtures: any[], predictions: any[]) {
    const indexed = new Map(predictions.map(row => [row.id, row.analysis]));
    const metrics: any = { samples: fixtures.length, returned: 0, exact: 0, missing: [], invalid: [], action: { tp: 0, fp: 0, fn: 0 }, reply: { tp: 0, fp: 0, fn: 0 }, wrongCompletion: 0, wrongDate: 0, wrongEvent: 0 };
    for (const sample of fixtures) {
        const a = indexed.get(sample.id);
        if (!a) {
            metrics.missing.push(sample.id);
            for (const key of ['action', 'reply'])
                if (sample.expected[key])
                    metrics[key].fn++;
            continue;
        }
        metrics.returned++;
        if (typeof a.noise !== 'boolean' || !Array.isArray(a.items) || a.items.some((row: any) => !row || typeof row.needsAction !== 'boolean' || typeof row.needsReply !== 'boolean' || (row.completed != null && typeof row.completed !== 'boolean'))) {
            metrics.invalid.push(sample.id);
            for (const key of ['action', 'reply'])
                if (sample.expected[key])
                    metrics[key].fn++;
            continue;
        }
        const items = Array.isArray(a.items) ? a.items : [], actual: any = { action: items.some((row: any) => row.needsAction && !row.cancelled && !row.completed), reply: items.some((row: any) => row.needsReply), completed: items.some((row: any) => row.completed) };
        let exact = true;
        for (const key of ['action', 'reply']) {
            const got = actual[key], want = sample.expected[key];
            if (got && want)
                metrics[key].tp++;
            if (got && !want)
                metrics[key].fp++;
            if (!got && want)
                metrics[key].fn++;
            if (got !== want)
                exact = false;
        }
        if (actual.completed !== sample.expected.completed) {
            metrics.wrongCompletion++;
            exact = false;
        }
        if ('dueDate' in sample.expected) {
            const dates = items.map((row: any) => row.meetingStart || row.dueAt).filter(Boolean).map((value: any) => { const n = Date.parse(value); return Number.isFinite(n) ? new Date(n + 8 * 3600000).toISOString().slice(0, 10) : 'invalid'; });
            if (sample.expected.dueDate === null ? dates.length > 0 : !dates.includes(sample.expected.dueDate)) {
                metrics.wrongDate++;
                exact = false;
            }
        }
        if (sample.expected.eventType && !items.some((row: any) => row.eventType === sample.expected.eventType)) {
            metrics.wrongEvent++;
            exact = false;
        }
        if (exact)
            metrics.exact++;
    }
    for (const key of ['action', 'reply']) {
        const m = metrics[key];
        m.precision = m.tp + m.fp ? m.tp / (m.tp + m.fp) : null;
        m.recall = m.tp + m.fn ? m.tp / (m.tp + m.fn) : null;
    }
    return metrics;
}
