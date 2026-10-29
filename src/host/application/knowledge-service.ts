import { retrieveKnowledgeAsync } from '../knowledge/semantic.js'
import { retrieveKnowledge, readKnowledgeChunks, defaultKnowledgeScope } from '../knowledge/retrieval.js'
import { recordRetrieval } from '../knowledge/context.js'
import { loadWorkbenchState } from '../storage/state-store.js'
import { auditEntry, ensureArray, normalizeKnowledge } from '../domain/model.js'
import { mutateWorkbenchState } from '../storage/state-store.js'

/** knowledge-service: shared Remote and Agent business use cases. */
export const knowledgeService = {
    async knowledgeRetrieve(request:any={}){const result=await retrieveKnowledgeAsync(loadWorkbenchState(),String(request.query||''),request);await recordRetrieval(result);return result},
    async knowledgeRead(request:any={}){const state=loadWorkbenchState();return {hits:readKnowledgeChunks(state,request.ids,defaultKnowledgeScope(state,request.scope||{}))}},
    async knowledgeTraces(request:any={}){return {items:(loadWorkbenchState().retrievalTraces||[]).filter((t:any)=>!request.sessionId||t.sessionId===request.sessionId).slice(-30).reverse()}},

    async createKnowledge(input?: any): Promise<any> {
        if(typeof input?.body==='string'&&input.body.length>20000)throw new Error('知识正文超过20000字符，请按章节拆分');
        if(input?.validUntil&&!Number.isFinite(Date.parse(input.validUntil)))throw new Error('知识有效期格式无效');
        const item = normalizeKnowledge(input || {});
        return mutateWorkbenchState(function (state?: any): any {
            if(item.projectId&&!state.projects.some((p:any)=>p.id===item.projectId))throw new Error('关联项目不存在');
            const duplicate = ensureArray(state.knowledge).find(function (existing?: any): any {
                return existing.title === item.title && (existing.url || '') === (item.url || '') && existing.projectId===item.projectId && existing.accountId===item.accountId;
            });
            if (!duplicate) {
                state.knowledge = ensureArray(state.knowledge).concat([item]);
                auditEntry(state, 'knowledge.created', item.title);
            }
            return state;
        });
    },

    async updateKnowledge(id?: any, patch?: any): Promise<any> {
        if(typeof patch?.body==='string'&&patch.body.length>20000)throw new Error('知识正文超过20000字符，请按章节拆分');
        if(patch?.validUntil&&!Number.isFinite(Date.parse(patch.validUntil)))throw new Error('知识有效期格式无效');
        return mutateWorkbenchState(function (state?: any): any {
            const existing = ensureArray(state.knowledge).find(function (item?: any): any {
                return item.id === id;
            });
            if (!existing)
                throw new Error('找不到该知识条目：' + String(id));
            const next = normalizeKnowledge(patch || {}, existing);
            next.id = existing.id;
            if(next.projectId&&!state.projects.some((p:any)=>p.id===next.projectId))throw new Error('关联项目不存在');
            state.knowledge = ensureArray(state.knowledge).map(function (item?: any): any {
                return item.id === id ? next : item;
            });
            auditEntry(state, 'knowledge.updated', next.title);
            return state;
        });
    },

    async deleteKnowledge(id?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            state.knowledge = ensureArray(state.knowledge).filter(function (item?: any): any {
                return item.id !== id;
            });
            auditEntry(state, 'knowledge.deleted', String(id));
            return state;
        });
    }
};
