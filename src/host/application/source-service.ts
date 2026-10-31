import {configureBusyReply} from '../integrations/busy-reply.js'
import { REPLY_STATUSES, auditEntry, ensureArray, normalizeReplies, normalizeSource } from '../domain/model.js'
import { loadWorkbenchState, mutateWorkbenchState } from '../storage/state-store.js'
import { probeYunzhijia, sendYzjTextReply, syncYunzhijiaMessages } from '../integrations/yunzhijia.js'
import { workbenchContext } from './service-context.js'
import { asString, hostNowIso, newId } from '../platform/runtime.js'
import {taskReplyMatches,taskReplyTarget} from '../../shared/task-reply.js'

/** Validate the exact target reviewed by the user. Never infer a private recipient. */
function replySendTarget(state: any, request: any): any {
    const reply = state.replies.find((row:any) => row.id === request.id);
    if (!reply) throw new Error('待回复不存在');
    if(request.taskId&&!taskReplyMatches(state,request.taskId,reply))throw new Error('待办与原私聊消息关联已变化，请重新核对');
    const taskReply=request.taskId&&reply.stage==='不需回复'&&reply.triage==='task';
    if (reply.archivedAt || !taskReply&&!['待回复', '已确认收到', '已自动回复'].includes(reply.stage)) throw new Error('该消息已处理，请先核实回复状态');
    const source = state.sources.find((row:any) => row.id === reply.sourceId);
    const loc = source?.locator;
    if (source?.provider !== 'yunzhijia' || !loc?.groupId || !loc.msgId || !loc.accountId || loc.direction === 'outbound') throw new Error('缺少有效的云之家原消息定位，不能直接回复');
    if (request.groupId !== loc.groupId || request.msgId !== loc.msgId || request.accountId !== loc.accountId || reply.msgId !== loc.msgId || (reply.groupId && reply.groupId !== loc.groupId) || (reply.accountId && reply.accountId !== loc.accountId)) throw new Error('原消息或发送目标已变化，请重新核对');
    const delivery = state.replyDrafts?.[reply.id]?.delivery;
    if (delivery && ['sending', 'uncertain', 'sent'].includes(delivery.status)) throw new Error('此消息已有发送记录，请先到云之家核实，避免重复发送');
    const conversation=state.messageInbox?.accountId===loc.accountId?state.messageInbox?.conversations?.find((c:any)=>c.groupId===loc.groupId):null;
    const groupType=loc.groupType||conversation?.groupType||state.syncCursors?.[loc.accountId+':'+loc.groupId]?.groupType;
    return { reply, source, loc, privateChat:Number(groupType)===1 };
}

/** source-service: shared Remote and Agent business use cases. */
export const sourceService = {
    async busyReplyConfigure(request:any){const ctx=workbenchContext();const snapshot=await configureBusyReply(request,()=>probeYunzhijia(ctx));if(request.enabled)void syncYunzhijiaMessages(ctx).catch(()=>{});return snapshot},

    /** Prepare local communication evidence without reopening a reply obligation. */
    async prepareTaskReply(taskId:string):Promise<any> {
        let replyId='';
        const snapshot=await mutateWorkbenchState((state:any)=>{
            const target=taskReplyTarget(state,taskId);
            if(!target)throw new Error('此待办没有有效的私聊原消息，不能直接回复');
            const {source,loc}=target;
            let reply=state.replies.find((row:any)=>row.sourceId===source.id&&row.msgId===loc.msgId&&(!row.accountId||row.accountId===loc.accountId)&&(!row.groupId||row.groupId===loc.groupId));
            if(reply?.archivedAt)throw new Error('原回复记录已归档，请先恢复后再处理');
            if(!reply){
                reply=normalizeReplies([{sourceId:source.id,msgId:loc.msgId,accountId:loc.accountId,groupId:loc.groupId,groupName:loc.groupName,contact:source.sender,snippet:source.excerpt,stage:'不需回复',triage:'task',taskIds:[taskId]}])[0];
                state.replies.push(reply);
            }else{
                reply.accountId ||= loc.accountId;reply.groupId ||= loc.groupId;
                reply.taskIds=[...new Set([...(reply.taskIds||[]),taskId])];
            }
            replyId=reply.id;
            return state;
        });
        return {replyId,snapshot};
    },

    async addSource(input?: any): Promise<any> {
        const source = normalizeSource(input || {});
        return mutateWorkbenchState(function (state?: any): any {
            const duplicate = ensureArray(state.sources).find(function (item?: any): any {
                return item.payloadHash === source.payloadHash;
            });
            if (!duplicate) {
                state.sources = ensureArray(state.sources).concat([source]);
                auditEntry(state, 'source.added', source.title);
            }
            return state;
        });
    },

    async fetchMentions(): Promise<any> {
        return syncYunzhijiaMessages(workbenchContext());
    },

    /** UI-only action: not exposed as an Agent tool or background automation. */
    async sendReply(request: any = {}): Promise<any> {
        if (request.confirmed !== true) throw new Error('请先核对目标、原消息和回复正文并确认发送');
        if (typeof request.text !== 'string' || !request.text.trim() || request.text.length > 8000) throw new Error('回复正文须为 1–8000 字符');
        const ctx = workbenchContext();
        replySendTarget(loadWorkbenchState(), request);
        const probe = await probeYunzhijia(ctx);
        if (probe.state !== 'ok') throw new Error(probe.note || '云之家账号不可用');
        if (![probe.accountId, probe.openId].includes(request.accountId)) throw new Error('当前云之家账号与原消息账号不一致，请切回原账号');
        const attemptId = newId('send');
        let target: any;
        await mutateWorkbenchState((state:any) => {
            target = replySendTarget(state, request);
            state.replyDrafts ||= {};
            state.replyDrafts[request.id] = { ...state.replyDrafts[request.id], text: request.text, at: hostNowIso(), delivery: { id: attemptId, status: 'sending', text:request.text, groupId: request.groupId, sourceMsgId:request.msgId,replyMsgId:target.privateChat?null:request.msgId,mode:target.privateChat?'plain':'quoted', at: hostNowIso() } };
            return state;
        });
        // Persist the reservation first; concurrent calls and restarts cannot resend.
        const result = await sendYzjTextReply(ctx, request.groupId, target.privateChat?null:request.msgId, request.text);
        const snapshot = await mutateWorkbenchState((state:any) => {
            const delivery = state.replyDrafts?.[request.id]?.delivery;
            if (delivery?.id !== attemptId) throw new Error('发送记录已变化，请到云之家核实发送结果');
            delivery.status = result.status === 'ok' ? 'sent' : result.uncertain ? 'uncertain' : 'failed';
            delivery.at = hostNowIso();
            delivery.note = result.note || null;
            if (result.status === 'ok') {
                delivery.msgId = asString(result.json?.data?.msgId || result.json?.data?.messageId, 80) || null;
                const reply = state.replies.find((row:any) => row.id === request.id);
                if (reply && reply.stage === target.reply.stage) Object.assign(reply, { stage: '已回复', humanGuard: true, repliedAt: delivery.at, updatedAt: delivery.at });
                auditEntry(state, 'reply.sent', request.id);
            } else auditEntry(state, 'reply.send_failed', request.id + '：' + delivery.status);
            return state;
        });
        if (result.status !== 'ok') throw new Error((result.uncertain ? '发送结果未确认，请到云之家核实，勿重复发送。' : '发送失败，未标记已回复。') + (result.note || ''));
        return snapshot;
    },

    async replyFromSource(sourceId?: string): Promise<any> {
        return mutateWorkbenchState((state:any)=>{
            const source=state.sources.find((row:any)=>row.id===sourceId)
            if(!source)throw new Error('找不到消息来源')
            if(source.locator?.direction==='outbound')throw new Error('本人发出的消息不能作为本人待回复')
            if(state.replies.some((row:any)=>row.sourceId===source.id))return state
            const loc=source.locator||{}
            state.replies.push(normalizeReplies([{sourceId:source.id,msgId:loc.msgId||'local:'+source.id,accountId:loc.accountId,groupId:loc.groupId,groupName:loc.groupName,contact:source.sender,snippet:source.excerpt,stage:'待回复'}])[0])
            auditEntry(state,'reply.created',source.title)
            return state
        })
    },

    /** TODO 16：推进回复阶段（待回复 → 已回复 / 不需回复）。标记已回复会记录 repliedAt。 */
    async setReplyStage(id?: any, stage?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            const index = ensureArray(state.replies).findIndex(function (row?: any): any {
                return row.id === id;
            });
            if (index < 0)
                throw new Error('找不到该回复：' + String(id));
            const stageText = asString(stage, 20);
            if (REPLY_STATUSES.indexOf(stageText) < 0)
                throw new Error('未知的回复阶段：' + stageText);
            const reply = state.replies[index];
            if(stageText==='已自动回复'&&reply.stage!=='已自动回复')throw Error('已自动回复状态由实际自动发送结果设置');
            const next = normalizeReplies([Object.assign({}, reply, {
                    stage: stageText,
                    humanGuard: true,
                    repliedAt: stageText === '已回复' ? hostNowIso() : reply.repliedAt || null,
                    updatedAt: hostNowIso(),
                })])[0];
            state.replies = state.replies.slice();
            state.replies[index] = next;
            auditEntry(state, 'reply.stage', (reply.contact || reply.msgId) + ' → ' + stageText);
            return state;
        });
    },

    /** 删除来源证据：同时清理派生候选，并把引用它的待办解除来源关联。 */
    async deleteSource(id?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            const sourceId = String(id);
            const exists = ensureArray(state.sources).some(function (row?: any): any {
                return row.id === sourceId;
            });
            if (!exists)
                throw new Error('找不到该来源：' + sourceId);
            state.sources = ensureArray(state.sources).filter(function (row?: any): any {
                return row.id !== sourceId;
            });
            state.candidates = ensureArray(state.candidates).filter(function (candidate?: any): any {
                return candidate.sourceRefId !== sourceId;
            });
            state.tasks = ensureArray(state.tasks).map(function (task?: any): any {
                if (task.sourceRefId !== sourceId)
                    return task;
                return Object.assign({}, task, { sourceRefId: null, updatedAt: hostNowIso() });
            });
            for (const task of state.tasks) task.sourceRefs = ensureArray(task.sourceRefs).filter((ref:any)=>ref.sourceId!==sourceId);
            for (const reply of ensureArray(state.replies)) if(reply.sourceId===sourceId) reply.sourceId=null;
            state.analysisQueue = ensureArray(state.analysisQueue).filter((row:any)=>row.sourceId!==sourceId);
            auditEntry(state, 'source.deleted', '删除来源 ' + sourceId);
            return state;
        });
    },

    /** 删除候选（彻底移除，区别于 reject）。 */
    async deleteCandidate(id?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            const candidateId = String(id);
            const exists = ensureArray(state.candidates).some(function (row?: any): any {
                return row.id === candidateId;
            });
            if (!exists)
                throw new Error('找不到该候选：' + candidateId);
            state.candidates = ensureArray(state.candidates).filter(function (row?: any): any {
                return row.id !== candidateId;
            });
            auditEntry(state, 'candidate.deleted', '删除候选 ' + candidateId);
            return state;
        });
    }
};
