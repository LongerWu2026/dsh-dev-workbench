/** Content/format errors are reviewable; authentication and transport failures
 * retain the model service's own pause/retry policy. */
export function isRecognitionError(error: unknown): boolean {
    return /识别依据|证据校验|识别结构|识别事项|相关性判断|无关判断|模型关联|本批未返回|批次|JSON|本批关联|会话范围|回复阶段|相对日期|无效日期|会议结束时间/.test(String((error as any)?.message || error || ''));
}

/** Permit whitespace differences only, and retain the actual source substring. */
export function sourceEvidence(text: string, evidence: unknown): string | null {
    if (typeof evidence !== 'string' || !evidence.trim()) return null;
    const parts = evidence.trim().split(/\s+/u).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return text.match(new RegExp(parts.join('\\s+'), 'u'))?.[0] || null;
}

export function rejectedEvidence(analysis: any, source: any): string[] {
    if (!Array.isArray(analysis?.items)) return [];
    const text = String(source.excerpt || source.title || '');
    return analysis.items.filter((item: any) => item?.evidence && !sourceEvidence(text, item.evidence))
        .slice(0, 3).map((item: any) => String(item.evidence).slice(0, 400));
}

export function markRecognitionReview(row: any, reason: string, at: string, jobId?: string, analysis?: any): void {
    Object.assign(row, {status:'awaiting_human', reviewKind:'recognition', reviewReason:reason.slice(0, 200),
        analysis:null, analyzedAt:at, leaseUntil:null, nextRetryAt:null, lastError:null,
        rejectedEvidence:Array.isArray(analysis?.items) ? analysis.items.filter((item: any) => item?.evidence).slice(0, 3).map((item: any) => String(item.evidence).slice(0, 400)) : row.rejectedEvidence || []});
    if (jobId) row.analysisJobId = jobId;
}

/** Old exhausted content errors must not block newly arriving messages. */
export function recoverRecognitionReviews(state: any, at: string, jobId?: string): number {
    let count = 0;
    for (const row of state.analysisQueue) {
        if (row.status !== 'failed' || !isRecognitionError(row.lastError) && !((row.attempts || 0) >= 3 && /模型处理超时/.test(row.lastError || ''))) continue;
        markRecognitionReview(row, row.lastError || '多次识别未成功，请核对原消息后重试本条', at, jobId);
        count++;
    }
    return count;
}
