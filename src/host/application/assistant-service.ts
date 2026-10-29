import { backgroundHistory, archiveBackgroundHistory } from '../assistant/background-history.js'
import { listAssistantSessions, readAssistantDelta, readAssistantHistory, readAssistantMessage, readAssistantTranscript, resetAssistantSession, runAssistantAsk, sendAssistantPrompt } from '../assistant/sessions.js'
import { workbenchContext } from './service-context.js'

/** assistant-service: shared Remote and Agent business use cases. */
export const assistantService = {
    async backgroundHistory(request:any={}) { return backgroundHistory(workbenchContext(),request) },
    async archiveBackgroundHistory(ids:unknown) { return archiveBackgroundHistory(workbenchContext(),ids) },

    /** 按消息 id 取助手回复正文（原生聊天内嵌动作使用）。 */
    async assistantMessage(request?: any): Promise<any> {
        return readAssistantMessage(workbenchContext(), request || {});
    },

    /** 工作台助手：向原生会话提交提示并等待本轮回复（TODO 04）。 */
    async assistantAsk(request?: any): Promise<any> {
        return runAssistantAsk(workbenchContext(), request || {});
    },

    /** 只提交提示（立即返回 fromSeq），配合 assistantDelta 做渐进渲染。 */
    async assistantSend(request?: any): Promise<any> {
        return sendAssistantPrompt(workbenchContext(), request || {});
    },

    /** 增量读取会话记录（fromSeq 之后的新条目 + turnActive）。 */
    async assistantDelta(request?: any): Promise<any> {
        return readAssistantDelta(workbenchContext(), request || {});
    },

    async assistantHistory(): Promise<any> {
        return readAssistantHistory(workbenchContext());
    },

    /** 最近原生会话列表（供侧栏切换）。 */
    async assistantSessions(request?: any): Promise<any> {
        return listAssistantSessions(workbenchContext(), request || {});
    },

    /** 读取指定会话的记录（缺省为助手会话）。 */
    async assistantTranscript(request?: any): Promise<any> {
        return readAssistantTranscript(workbenchContext(), request || {});
    },

    async assistantReset(): Promise<any> {
        return resetAssistantSession(workbenchContext());
    }
};
