/** Shared business contracts. Runtime input remains untrusted until validated. */
export type PageId = 'dashboard' | 'tasks' | 'replies' | 'radar' | 'knowledge' | 'search' | 'agents' | 'office' | 'toolbox' | 'collab' | 'settings' | 'web-ai'
export type ReplyStage = '已自动回复' | '待回复' | '已确认收到' | '已回复' | '不需回复'
export type TaskStatus = 'draft' | 'ready' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled'
export type EventType = 'meeting' | 'feature' | 'logging' | 'other'
export interface SourceLocator { sentAtVerified?:boolean; groupId: string | null; msgId: string | null; groupName: string | null; groupType?: number | null; accountId?: string | null; direction?: 'inbound' | 'outbound'; intake?: boolean; replyToMsgId?: string | null; senderId?: string | null; sentAt?: string | null }
export interface Source { selection?:import('./message-intake.js').MessageSelection|null;calendarMeta?:any;projectId?: string | null; id: string; provider: string; externalId: string | null; url: string | null; title: string; excerpt: string; fetchedAt: string; sender: string | null; locator: SourceLocator | null; payloadHash: string }
export interface HumanGuard { editedFields: string[]; ignored?: boolean; handledConfirmed?: boolean; snoozeUntil?: string | null }
export interface Task { id: string; title: string; description: string; status: TaskStatus; priority: 'urgent' | 'high' | 'normal' | 'low'; dueAt: string | null; projectId: string | null; sourceRefId: string | null; sourceRefs: Array<{sourceId: string; msgId?: string | null; snippet?: string | null}>; runIds: string[]; humanGuard: HumanGuard; eventType?: EventType | null; deliverable?: string | null; meetingStart?: string | null; meetingEnd?: string | null; meetingLocation?: string | null; registrationTarget?: string | null; createdAt: string; updatedAt: string; [key: string]: unknown }
export interface Reply {
    autoReplyId?:string|null;autoRepliedAt?:string|null; triage?:'pending'|'reply'|'task'|'noise'|null; id: string; sourceId: string | null; msgId: string; groupId: string | null; groupName: string | null; accountId: string | null; contact: string | null; snippet: string | null; stage: ReplyStage; humanGuard: boolean; evidenceMsgId: string | null; taskIds: string[]; repliedAt: string | null; createdAt: string; updatedAt: string }
export interface AnalysisItem { title: string; needsReply: boolean; needsAction: boolean; eventType?: EventType | null; relatedTaskId?: string | null; relatedReplyId?: string | null; replyToMsgId?: string | null; replyStage?: string | null; dueAt?: string | null; deliverable?: string | null; meetingStart?: string | null; meetingEnd?: string | null; meetingLocation?: string | null; registrationTarget?: string | null; completed?: boolean; cancelled?: boolean; evidence?: string }
export interface AnalysisResult { noise: boolean; relevance?: 'relevant' | 'irrelevant' | 'uncertain' | null; summary?: string; items: AnalysisItem[] }
export interface WorkbenchSnapshot { version: number; revision: number; tasks: Task[]; sources: Source[]; replies: Reply[]; updatedAt: string; [key: string]: unknown }
export type ContextPane = { kind: 'closed' } | { kind: 'assistant'; refs: Array<{ kind: string; id: string }> } | { kind: 'task' | 'reply' | 'article'; id: string }
export function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
export function assertAnalysisShape(value: unknown): asserts value is AnalysisResult {
  if (!isRecord(value) || typeof value.noise !== 'boolean' || !Array.isArray(value.items) || value.items.length > 3) throw new Error('识别结构无效')
  if (value.relevance != null && !['relevant', 'irrelevant', 'uncertain'].includes(String(value.relevance))) throw new Error('相关性判断无效')
  if (value.relevance === 'irrelevant' && (!value.noise || value.items.length)) throw new Error('无关判断与事项结果冲突')
  for (const item of value.items) {
    if (!isRecord(item) || typeof item.title !== 'string' || !item.title.trim() || typeof item.needsReply !== 'boolean' || typeof item.needsAction !== 'boolean') throw new Error('识别事项字段无效')
    for (const field of ['dueAt', 'meetingStart', 'meetingEnd']) if (item[field] != null && (typeof item[field] !== 'string' || !Number.isFinite(Date.parse(item[field] as string)))) throw new Error('无效日期：' + field)
  }
}
