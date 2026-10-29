export const OFFICE_WORKFLOW_LABELS = { reply_batch: '批量回复草稿', work_report: '日报 / 周报', task_assist: '待办处理方案' } as const
export type OfficeWorkflowKind = keyof typeof OFFICE_WORKFLOW_LABELS
export interface OfficeStep {
 id: string; label: string; status: 'pending'|'running'|'completed'|'failed'; attempts: number
 input: Record<string, any>; error?: string; artifact?: { text: string; evidenceIds: string[]; at: string }; adoptedAt?: string
}
export const isOfficeWorkflow = (kind: string): kind is OfficeWorkflowKind => Object.hasOwn(OFFICE_WORKFLOW_LABELS, kind)
