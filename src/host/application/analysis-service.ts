import { messageSkipReason } from '../domain/message-policy.js'
import { loadWorkbenchState, mutateWorkbenchState } from '../storage/state-store.js'
import { extractCandidatesInto } from '../analysis/rule-candidates.js'
import { auditEntry, ensureArray, normalizeCandidate, normalizeTask } from '../domain/model.js'
import { startWorkflowJob } from '../automation/jobs.js'
import { workbenchContext } from './service-context.js'
import { confirmAnalysis, runAnalysisBatch } from '../analysis/message-analysis.js'

/** analysis-service: shared Remote and Agent business use cases. */
export const analysisService = {

    /**
     * Design report §3.2: pull @-mention messages as source evidence through the
     * real yzj-cli. Deterministic collection only — turning a mention into a task
     * stays an agent decision, so nothing is auto-created here.
     */
    /** 规则候选提取（确定性，无模型）：为尚未提取的 @我 来源生成待确认候选。 */
    async extractCandidates(): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            return extractCandidatesInto(state);
        });
    },

    /** 采纳候选：原子地建任务（带来源证据）并把候选标记为已采纳。 */
    async acceptCandidate(id?: any, patch?: any): Promise<any> {
        const input = patch && typeof patch === 'object' ? patch : {};
        return mutateWorkbenchState(function (state?: any): any {
            const candidate = ensureArray(state.candidates).find(function (row?: any): any {
                return row.id === id;
            });
            if (!candidate)
                throw new Error('找不到该候选：' + String(id));
            if (candidate.status === 'accepted' && candidate.taskId) {
                return state;
            }
            const source = state.sources.find((source:any)=>source.id===candidate.sourceRefId);
            const reason = messageSkipReason(state,source,state.analysisQueue.find((row:any)=>row.sourceId===source?.id && ['skipped','historical'].includes(row.status)));
            if (reason) throw new Error(reason);
            const task = normalizeTask({
                title: input.title || candidate.title,
                description: input.description ||
                    [candidate.excerpt, candidate.sourceTitle ? '来源：' + candidate.sourceTitle : '']
                        .filter(Boolean)
                        .join('\n'),
                status: input.status || 'ready',
                priority: input.priority || 'normal',
                dueAt: input.dueAt === undefined ? candidate.dueAt : input.dueAt,
                tags: input.tags || [],
                sourceRefId: candidate.sourceRefId,
                projectId: state.settings ? state.settings.defaultProjectId : null,
                aiExtracted: true,
                confidence: candidate.confidence,
            }, null);
            state.tasks = ensureArray(state.tasks).concat([task]);
            const index = state.candidates.indexOf(candidate);
            const next = normalizeCandidate(Object.assign({}, candidate, { status: 'accepted', taskId: task.id }), candidate);
            next.status = 'accepted';
            next.taskId = task.id;
            state.candidates = state.candidates.slice();
            state.candidates[index] = next;
            auditEntry(state, 'candidate.accepted', task.title);
            return state;
        });
    },

    async rejectCandidate(id?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            const candidate = ensureArray(state.candidates).find(function (row?: any): any {
                return row.id === id;
            });
            if (!candidate)
                throw new Error('找不到该候选：' + String(id));
            const index = state.candidates.indexOf(candidate);
            state.candidates = state.candidates.slice();
            state.candidates[index] = normalizeCandidate(Object.assign({}, candidate, { status: 'rejected' }), candidate);
            state.candidates[index].status = 'rejected';
            auditEntry(state, 'candidate.rejected', candidate.title);
            return state;
        });
    },

    /** TODO 15：AI 识别状态（队列概览）。 */
    async analysisStatus(): Promise<any> {
        const state = loadWorkbenchState();
        const queue = ensureArray(state.analysisQueue);
        const by = function (status?: any): any {
            return queue.filter(function (row?: any): any { return row.status === status; }).length;
        };
        return {
            enabled: !!(state.settings.aiExtract && state.settings.aiExtract.enabled),
            autoRegister: !!(state.settings.aiExtract && state.settings.aiExtract.autoRegister),
            pending: by('pending'),
            failed: by('failed'),
            awaitingHuman: by('awaiting_human'),
            historical: 0,
            skipped: by('skipped') + by('historical'),
            installedAt: state.installedAt,
            done: by('done'),
            modelHealth:state.modelHealth?.analysis || null,
            lastBatch:state.lastAnalysisBatch || null,
            jobs:ensureArray(state.jobs).filter((job:any)=>job.kind==='analysis').slice(-20).map((job:any)=>({id:job.id,kind:job.kind,status:job.status,createdAt:job.createdAt,updatedAt:job.updatedAt,nextRetryAt:job.nextRetryAt,error:job.error,progress:job.progress,result:job.result?{status:job.result.status,note:job.result.note,processed:job.result.processed,failures:job.result.failures}:null})),
            entries: queue.filter((row:any)=>['awaiting_human','failed'].includes(row.status)).slice(-12).reverse(),
            note: '仅处理插件安装日期起的消息；历史暂存已跳过，不再识别或重试。',
        };
    },

    /** TODO 15：运行一批 AI 识别（手动触发；自动运行由 19 接管）。 */
    async analysisStart(request?: any): Promise<any> { return startWorkflowJob(workbenchContext(), 'analysis', request || {}) },

    async analyzeRun(request?: any): Promise<any> {
        return runAnalysisBatch(workbenchContext(), {...request,retryModel:true});
    },

    async analysisRetry(entryId?: string): Promise<any> {
        return mutateWorkbenchState(function (state: any) {
            const row = state.analysisQueue.find((one: any) => one.id === entryId)
            if (!row) throw new Error('找不到分析条目')
            const reason = messageSkipReason(state,state.sources.find((source:any)=>source.id===row.sourceId),row)
            if (reason) throw new Error(reason)
            if (row.status === 'running') throw new Error('条目正在运行，请先取消或等待结束')
            Object.assign(row,{status:'pending',attempts:0,nextRetryAt:null,lastError:null,leaseUntil:null})
            return state
        })
    },

    async analysisCancel(entryId?: string): Promise<any> {
        return mutateWorkbenchState(function (state: any) {
            const row = state.analysisQueue.find((one: any) => one.id === entryId)
            if (!row) throw new Error('找不到分析条目')
            if (row.status === 'done') throw new Error('该分析已提交，不能取消已完成的结果')
            const reason = messageSkipReason(state,state.sources.find((source:any)=>source.id===row.sourceId),row)
            if (reason) throw new Error(reason)
            Object.assign(row,{status:'cancelled',leaseUntil:null})
            return state
        })
    },

    /** TODO 14：清空分析队列（重新采集/重整时使用）。 */
    async analyzeReset(): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            state.analysisQueue = [];
            state.jobs = [];
            auditEntry(state, 'analysis.reset', '清空分析队列');
            return state;
        });
    },

    /** TODO 15：人工确认——把 awaiting_human 的条目按已保存分析建待办。 */
    async analyzeConfirm(entryId?: any): Promise<any> {
        return confirmAnalysis(workbenchContext(), entryId);
    }
};
