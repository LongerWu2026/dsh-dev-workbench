import { retrieveKnowledgeAsync } from '../knowledge/semantic.js'
import { retrieveKnowledge, readKnowledgeChunks, defaultKnowledgeScope } from '../knowledge/retrieval.js'
import { recordRetrieval } from '../knowledge/context.js'
import { loadWorkbenchState } from '../storage/state-store.js'
import { auditEntry, ensureArray, normalizeKnowledge } from '../domain/model.js'
import { mutateWorkbenchState } from '../storage/state-store.js'
import { hashText } from '../platform/runtime.js'
import {knowledgeEngine,scheduleKnowledgeIndex} from '../knowledge/engine.js'
import {knowledgeSpaces,knowledgeSpaceOf,PERSONAL_KNOWLEDGE_SPACE} from '../../shared/knowledge.js'
import {knowledgeScopeKey} from '../knowledge/scope.js'
import {randomUUID} from 'node:crypto'

/** knowledge-service: shared Remote and Agent business use cases. */
export const knowledgeService = {
    knowledgeEngine,
    async knowledgeSpace(request:any={}){
        if(request.action==='list'||!request.action)return {spaces:knowledgeSpaces(loadWorkbenchState())}
        return mutateWorkbenchState((state:any)=>{
            if(request.action==='create'){
                const name=String(request.name||'').trim();if(!name||name.length>80)throw Error('请输入1–80字的知识空间名称')
                if(knowledgeSpaces(state).some(space=>space.name===name))throw Error('知识空间名称已存在')
                state.knowledgeSpaces=[...(state.knowledgeSpaces||[]),{id:'space:'+randomUUID(),name}]
            }else if(request.action==='assignProject'){
                const project=state.projects.find((row:any)=>row.id===request.projectId)
                if(!project||!knowledgeSpaces(state).some(space=>space.id===request.spaceId))throw Error('请选择有效的项目和知识空间')
                project.knowledgeSpaceId=request.spaceId
                for(const doc of state.knowledge||[])if(doc.projectId===project.id)doc.spaceId=request.spaceId
                auditEntry(state,'knowledge.projectSpace',project.name)
            }else throw Error('未知知识空间操作')
            return state
        })
    },
    async knowledgeRetrieve(request:any={}){const result=await retrieveKnowledgeAsync(loadWorkbenchState(),String(request.query||''),request);await recordRetrieval(result);return result},
    async knowledgeRead(request:any={}){const state=loadWorkbenchState();return {hits:readKnowledgeChunks(state,request.ids,defaultKnowledgeScope(state,request.scope||{}))}},
    async knowledgeTraces(request:any={}){const state=loadWorkbenchState(),scope=defaultKnowledgeScope(state,request.scope||{});return {items:(state.retrievalTraces||[]).filter((t:any)=>(!request.sessionId||t.sessionId===request.sessionId)&&knowledgeScopeKey(t.scope)===knowledgeScopeKey(scope)).slice(-30).reverse()}},

    async createKnowledge(input?: any): Promise<any> {
        if(typeof input?.body==='string'&&input.body.length>20000)throw new Error('知识正文超过20000字符，请按章节拆分');
        if(input?.validUntil&&!Number.isFinite(Date.parse(input.validUntil)))throw new Error('知识有效期格式无效');
        const state=loadWorkbenchState(),project=(state.projects||[]).find((row:any)=>row.id===input?.projectId)
        const item = normalizeKnowledge({...input,spaceId:input?.spaceId||project?.knowledgeSpaceId||knowledgeSpaceOf(input)});
        validateOwnership(state,item)
        const saved=await mutateWorkbenchState(function (state?: any): any {
            if(item.projectId&&!state.projects.some((p:any)=>p.id===item.projectId))throw new Error('关联项目不存在');
            const duplicate = ensureArray(state.knowledge).find(function (existing?: any): any {
                return existing.title === item.title && (existing.url || '') === (item.url || '') && existing.projectId===item.projectId && knowledgeSpaceOf(existing)===item.spaceId && existing.accountId===item.accountId;
            });
            if (!duplicate) {
                state.knowledge = ensureArray(state.knowledge).concat([item]);
                auditEntry(state, 'knowledge.created', item.title);
            }
            return state;
        });
        void scheduleKnowledgeIndex({spaceId:item.spaceId,projectId:item.projectId}).catch(()=>{});return saved;
    },

    async updateKnowledge(id?: any, patch?: any, expectedFingerprint?:string): Promise<any> {
        if(typeof patch?.body==='string'&&patch.body.length>20000)throw new Error('知识正文超过20000字符，请按章节拆分');
        if(patch?.validUntil&&!Number.isFinite(Date.parse(patch.validUntil)))throw new Error('知识有效期格式无效');
        const saved=await mutateWorkbenchState(function (state?: any): any {
            const existing = ensureArray(state.knowledge).find(function (item?: any): any {
                return item.id === id;
            });
            if (!existing)
                throw new Error('找不到该知识条目：' + String(id));
            if(expectedFingerprint&&hashText(JSON.stringify(existing))!==expectedFingerprint)throw new Error('知识已更新，确认失效，请重新预览');
            const next = normalizeKnowledge(patch || {}, existing);
            if(patch?.projectId&&patch.projectId!==existing.projectId&&!patch.spaceId)next.spaceId=state.projects.find((row:any)=>row.id===patch.projectId)?.knowledgeSpaceId||PERSONAL_KNOWLEDGE_SPACE
            next.id = existing.id;
            validateOwnership(state,next,existing)
            if(next.projectId&&!state.projects.some((p:any)=>p.id===next.projectId))throw new Error('关联项目不存在');
            state.knowledge = ensureArray(state.knowledge).map(function (item?: any): any {
                return item.id === id ? next : item;
            });
            auditEntry(state, 'knowledge.updated', next.title);
            return state;
        });
        const item=saved.knowledge.find((row:any)=>row.id===id);if(item)void scheduleKnowledgeIndex({spaceId:item.spaceId,projectId:item.projectId}).catch(()=>{});return saved;
    },

    async deleteKnowledge(id?: any, expectedFingerprint?:string): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            if(expectedFingerprint){const existing=ensureArray(state.knowledge).find((item:any)=>item.id===id);if(!existing||hashText(JSON.stringify(existing))!==expectedFingerprint)throw new Error('知识已更新或已删除，确认失效，请重新预览');}
            state.knowledge = ensureArray(state.knowledge).filter(function (item?: any): any {
                return item.id !== id;
            });
            auditEntry(state, 'knowledge.deleted', String(id));
            return state;
        });
    }
};
function validateOwnership(state:any,item:any,existing?:any){
    if(!knowledgeSpaces(state).some(space=>space.id===item.spaceId))throw Error('知识空间不存在')
    const project=item.projectId?state.projects.find((row:any)=>row.id===item.projectId):null
    if(item.projectId&&!project)throw Error('关联项目不存在')
    if(project&&item.spaceId!==(project.knowledgeSpaceId||PERSONAL_KNOWLEDGE_SPACE)&&!(existing&&existing.projectId===item.projectId&&knowledgeSpaceOf(existing)===item.spaceId))throw Error('项目不属于所选知识空间，请先设置项目归属')
    if(item.sharedAcrossSpaces&&(item.spaceId!==PERSONAL_KNOWLEDGE_SPACE||item.projectId))throw Error('只有个人通用知识可以明确允许跨空间复用')
}
