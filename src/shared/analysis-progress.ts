export interface AnalysisProgress {
    processed: number;
    remaining: number;
    failed: number;
    batches: number;
    pauseReason: string | null;
}
