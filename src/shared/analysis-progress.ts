export interface AnalysisProgress {
    processed: number;
    remaining: number;
    failed: number;
    awaitingHuman?: number;
    batches: number;
    pauseReason: string | null;
}
