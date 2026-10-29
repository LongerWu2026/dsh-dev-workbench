import { loadWorkbenchState, mutateWorkbenchState } from '../storage/state-store.js'
import { auditEntry, ensureArray, normalizeRadarItem, normalizeSource, normalizeTask } from '../domain/model.js'
import { asString, asTags, asUrl, hostNowIso } from '../platform/runtime.js'
import { refreshGithubQuality, runRadarFetchOrDiscover } from '../news/discovery.js'
import { workbenchContext } from './service-context.js'
import { startWorkflowJob } from '../automation/jobs.js'
import { runRadarSummarizeBatch } from '../news/summarizer.js'

/** news-service: shared Remote and Agent business use cases. */
export const newsService = {

    async saveRadarItem(input?: any): Promise<any> {
        const payload = input && typeof input === 'object' ? input : {};
        return mutateWorkbenchState(function (state?: any): any {
            const list = ensureArray(state.radar);
            const existing = payload.id
                ? list.find(function (item?: any): any {
                    return item.id === payload.id;
                })
                : payload.url
                    ? list.find(function (item?: any): any {
                        return item.url === asUrl(payload.url);
                    })
                    : null;
            const item = normalizeRadarItem(payload, existing || null);
            state.radar = existing
                ? list.map(function (row?: any): any {
                    return row.id === item.id ? item : row;
                })
                : list.concat([item]);
            auditEntry(state, existing ? 'radar.updated' : 'radar.added', item.title);
            return state;
        });
    },

    async deleteRadarItem(id?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            state.radar = ensureArray(state.radar).filter(function (item?: any): any {
                return item.id !== id;
            });
            auditEntry(state, 'radar.deleted', String(id));
            return state;
        });
    },

    async fetchRadar(): Promise<any> {
        // 未配置 RSS 时按关注主题走联网发现（TODO 06 的默认路径）
        await runRadarFetchOrDiscover(workbenchContext());
        await refreshGithubQuality(workbenchContext());
        return loadWorkbenchState();
    },

    /** 写回四段摘要（Agent 读原文后调用）；只改摘要字段，不动来源与时间。 */
    async updateRadar(id?: any, patch?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            const item = ensureArray(state.radar).find(function (row?: any): any {
                return row.id === id;
            });
            if (!item)
                throw new Error('找不到该资讯：' + String(id));
            const summary = patch && patch.summary && typeof patch.summary === 'object' ? patch.summary : null;
            const index = state.radar.indexOf(item);
            const next = normalizeRadarItem({
                title: patch && patch.title !== undefined ? patch.title : item.title,
                topics: patch && patch.topics !== undefined ? patch.topics : item.topics,
                summary: summary
                    ? {
                        change: asString(summary.change, 800),
                        usage: asString(summary.usage, 800),
                        risk: asString(summary.risk, 800),
                        practice: asString(summary.practice, 800),
                    }
                    : item.summary,
            }, item);
            next.id = item.id;
            next.createdAt = item.createdAt;
            state.radar = state.radar.slice();
            state.radar[index] = next;
            auditEntry(state, 'radar.summary', next.title);
            return state;
        });
    },

    /**
     * Design report §3.1 后续行动: turn one radar item into a real task, keeping
     * the source evidence. Atomic on the Host so the task can never exist
     * without its SourceRef.
     */
    async createTaskFromRadar(id?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            const item = ensureArray(state.radar).find(function (row?: any): any {
                return row.id === id;
            });
            if (!item)
                throw new Error('找不到该资讯：' + String(id));
            const summary = item.summary || {};
            const brief = [
                summary.change ? '技术变化：' + summary.change : '',
                summary.usage ? '应用场景：' + summary.usage : '',
                summary.risk ? '采用风险：' + summary.risk : '',
                summary.practice ? '推荐实践：' + summary.practice : '',
                item.excerpt ? '原文摘录：' + item.excerpt : '',
                item.url ? '原文：' + item.url : '',
            ]
                .filter(Boolean)
                .join('\n');
            const source = normalizeSource({
                provider: asString(item.source, 40) || 'radar',
                url: item.url,
                title: item.title,
                excerpt: brief.slice(0, 2000),
                fetchedAt: item.publishedAt || item.updatedAt || hostNowIso(),
            });
            const duplicate = ensureArray(state.sources).find(function (row?: any): any {
                return row.payloadHash === source.payloadHash;
            });
            const sourceId = duplicate ? duplicate.id : source.id;
            if (!duplicate) {
                state.sources = ensureArray(state.sources).concat([source]);
            }
            const duplicateTask = ensureArray(state.tasks).find(function (row?: any): any {
                return row.sourceRefId === sourceId && row.title === '实践：' + item.title;
            });
            if (duplicateTask) {
                auditEntry(state, 'task.fromRadar', '重复生成已忽略：' + item.title);
                return state;
            }
            const task = normalizeTask({
                title: '实践：' + item.title,
                description: brief,
                status: 'ready',
                priority: 'normal',
                tags: asTags(item.topics),
                sourceRefId: sourceId,
                projectId: state.settings ? state.settings.defaultProjectId : null,
            }, null);
            state.tasks = ensureArray(state.tasks).concat([task]);
            auditEntry(state, 'task.fromRadar', task.title);
            return state;
        });
    },

    async radarSummaryStart(request?: any): Promise<any> { return startWorkflowJob(workbenchContext(), 'summary', request || {}) },

    /** TODO 20：批量生成四段摘要（读原文 → 模型 → 写回卡片）。 */
    async radarSummarize(request?: any): Promise<any> {
        return runRadarSummarizeBatch(workbenchContext(), {...request,retryModel:true});
    }
};
