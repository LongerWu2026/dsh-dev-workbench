import {normalizeMessageSelection,normalizeMessageInbox} from '../../shared/message-intake.js'
import {normalizeLaunchCommands} from '../../shared/developer-tools.js'
import { knowledgeMode } from '../../shared/knowledge.js'
import {normalizeWebAI} from '../../shared/web-ai.js'
import { normalizeAiPolicy } from '../../shared/ai-policy.js'
import type { Source, Reply, Task } from '../../shared/contracts.js'
import { HOST_STATE_VERSION, asEvidence, asIso, asSteps, asString, asTags, asUrl, hashText, hostNowIso, newId } from '../platform/runtime.js'
/* ============================================================================
 * dev-workbench host — data model
 *
 * The entity set follows design report §6.1 (Task, SourceRef, AgentRun,
 * AgentEvent→steps, Approval→waiting_approval runs, Connector, SyncCursor→
 * updatedAt, Project). Everything is plain JSON so a snapshot round-trips
 * through the Remote channel without a codec.
 * ========================================================================== */
const TASK_STATUSES: any = ['draft', 'ready', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled'];
const TASK_PRIORITIES: any = ['urgent', 'high', 'normal', 'low'];
const RUN_STATUSES: any = ['queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled'];
const KNOWLEDGE_KINDS: any = ['bookmark', 'note', 'snippet'];
const AUDIT_LIMIT = 200;
const CANDIDATE_LIMIT = 200;
const CANDIDATE_STATUSES: any = ['pending', 'accepted', 'rejected'];
/** TODO 17 可选字段契约（全部可选；旧数据缺省 = 旧行为，不破坏原状态机） */
const REPLY_STAGES: any = ['待答复', '已确认收到', '已实质答复', '不需答复'];
const EVENT_TYPES: any = ['meeting', 'feature', 'logging', 'other'];
const HUMAN_GUARD_STATUSES: any = ['ignored', 'snoozed', null];
const OPERATION_LIMIT = 200;
const DEFAULT_TOPICS: any = ['Agent', 'LLM', 'RAG', 'Java', 'Python', '数据库'];
function emptyWorkbenchState(): any {
    return {
        version: HOST_STATE_VERSION,
        revision: 0,
        installedAt: hostNowIso(),
        updatedAt: hostNowIso(),
        settings: normalizeSettings({
            topics: DEFAULT_TOPICS.slice(),
            defaultProjectId: null,
            staleHours: 24,
            showCompleted: false,
        }),
        webAI: normalizeWebAI(null),
        projects: [],
        tasks: [],
        sources: [],
        runs: [],
        knowledge: [],
        radar: [],
        connectors: [],
        candidates: [],
        /** TODO 14：分析队列（采集已入库、等待/正在/失败 AI 识别的消息） */
        analysisQueue: [],
        jobs: [],
        /** TODO 16 重构：回复义务（平行于待办；一条消息可同时产生回复与待办） */
        replies: [],
        syncCursors: {},
        lastAutomation: null,
        audit: [],
    };
}
function ensureArray(value?: any): any {
    return Array.isArray(value) ? value : [];
}
function normalizeFeed(raw?: any): any {
    const input = raw && typeof raw === 'object' ? raw : {};
    const url = asUrl(input.url);
    return {
        id: asString(input.id, 80) || newId('feed'),
        label: asString(input.label, 80) || (url ? String(url).replace(/^https?:\/\//, '').slice(0, 60) : '未命名资讯源'),
        url: url,
        topics: asTags(input.topics, 6),
    };
}
function normalizeAiExtract(raw?: any): any {
    const input = raw && typeof raw === 'object' ? raw : {};
    return {
        enabled: input.enabled === true,
        autoRegister: input.autoRegister === true,
        batchSize: (function (): any {
            const n = Number(input.batchSize);
            return Number.isFinite(n) ? Math.max(1, Math.min(20, Math.round(n))) : 5;
        })(),
    };
}
function normalizeAutomation(raw?: any): any {
    const input = raw && typeof raw === 'object' ? raw : {};
    const minutes = Number(input.intervalMinutes);
    return {
        enabled: input.enabled === true,
        intervalMinutes: Number.isFinite(minutes) && minutes >= 5 ? Math.min(24 * 60, Math.round(minutes)) : 60,
        radar: input.radar !== false,
        mentions: input.mentions !== false,
        analyze: input.analyze !== false,
        summarize: input.summarize !== false,
    };
}
const ANALYSIS_STATUSES: any = ['pending', 'running', 'failed', 'done', 'awaiting_human', 'historical', 'skipped', 'cancelled'];
/** TODO 16：回复义务条目（upsert by msgId；stage 独立于任务状态机） */
function normalizeReplies(raw?: any): Reply[] {
    const list = ensureArray(raw)
        .map(function (item?: any): any {
        const row = item && typeof item === 'object' ? item : {};
        const msgId = asString(row.msgId, 80);
        if (!msgId)
            return null;
        return {
            archivedAt: asIso(row.archivedAt),
            id: asString(row.id, 80) || newId('rep'),
            sourceId: asString(row.sourceId, 80) || null,
            msgId: msgId,
            groupId: asString(row.groupId, 80) || null,
            groupName: asString(row.groupName, 120) || null,
            accountId: asString(row.accountId, 120) || null,
            contact: asString(row.contact, 80) || null,
            snippet: asString(row.snippet, 300) || null,
            stage: REPLY_STATUSES.indexOf(row.stage) >= 0 ? row.stage : '待回复',
            triage:['pending','reply','task','noise'].includes(row.triage)?row.triage:null,
            humanGuard: row.humanGuard === true,
            evidenceMsgId: asString(row.evidenceMsgId, 80) || null,
            taskIds: ensureArray(row.taskIds).slice(0, 6).map(function (id?: any): any { return asString(id, 80); }).filter(Boolean),
            repliedAt: asIso(row.repliedAt) || null,
            createdAt: asIso(row.createdAt) || hostNowIso(),
            updatedAt: asIso(row.updatedAt) || hostNowIso(),
        };
    })
        .filter(Boolean);
    return list;
}
/** 回复阶段（Reply 自身状态机，平行于 Task 的处理状态机） */
const REPLY_STATUSES: any = ['待回复', '已确认收到', '已回复', '不需回复'];
/** TODO 14：分析队列条目（按 msgId 幂等；失败保留 attempts/lastError 以便重放） */
function normalizeAnalysisQueue(raw?: any): any {
    const list = ensureArray(raw)
        .map(function (item?: any): any {
        const row = item && typeof item === 'object' ? item : {};
        const sourceId = asString(row.sourceId, 80);
        if (!sourceId)
            return null;
        const analysis = row.analysis && typeof row.analysis === 'object' ? row.analysis : null;
        return {
            id: asString(row.id, 80) || newId('aq'),
            sourceId: sourceId,
            msgId: asString(row.msgId, 80) || null,
            groupId: asString(row.groupId, 80) || null,
            accountId: asString(row.accountId, 120) || null,
            nextRetryAt: asIso(row.nextRetryAt),
            leaseUntil: asIso(row.leaseUntil),
            status: row.status==='awaiting_human' && row.reviewReason && !analysis ? 'historical' : ANALYSIS_STATUSES.indexOf(row.status) >= 0 ? row.status : 'pending',
            attempts: Number(row.attempts) || 0,
            lastError: asString(row.lastError, 200) || null,
            reviewReason: asString(row.reviewReason, 200) || null,
            at: asIso(row.at) || hostNowIso(),
            analyzedAt: asIso(row.analyzedAt) || null,
            analysis: analysis
                ? {
                    noise: analysis.noise === true,
                    relevance: ['relevant','irrelevant','uncertain'].includes(analysis.relevance) ? analysis.relevance : null,
                    items: (ensureArray(analysis.items).slice(0, 6).map(function (item?: any): any {
                        const one = item && typeof item === 'object' ? item : {};
                        return {
                            needsReply: one.needsReply === true,
                            needsAction: one.needsAction === true,
                            eventType: EVENT_TYPES.indexOf(one.eventType) >= 0 ? one.eventType : null,
                            title: asString(one.title, 200) || null,
                            dueAt: asIso(one.dueAt) || null,
                            deliverable: asString(one.deliverable, 300) || null,
                            meetingStart: asIso(one.meetingStart),
                            meetingEnd: asIso(one.meetingEnd),
                            meetingLocation: asString(one.meetingLocation, 200) || null,
                            registrationTarget: asString(one.registrationTarget, 200) || null,
                            relatedTaskId: asString(one.relatedTaskId, 80) || null,
                            relatedReplyId: asString(one.relatedReplyId, 80) || null,
                            replyToMsgId: asString(one.replyToMsgId, 80) || null,
                            completed: one.completed === true,
                            cancelled: one.cancelled === true,
                            replyStage: REPLY_STAGES.indexOf(one.replyStage) >= 0 ? one.replyStage : null,
                        };
                    })).filter(function (item?: any): any { return item.title; }),
                    summary: asString(analysis.summary, 400) || null,
                }
                : null,
            taskIds: ensureArray(row.taskIds).slice(0, 6).map(function (id?: any): any { return asString(id, 80); }).filter(Boolean),
        };
    })
        .filter(Boolean);
    return list;
}
function normalizeSyncCursors(raw?: any): any {
    if (!raw || typeof raw !== 'object')
        return {};
    const out: any = {};
    Object.keys(raw)
        .forEach(function (groupId?: any): any {
        const item = raw[groupId];
        if (!item || typeof item !== 'object')
            return;
        const lastMsgId = asString(item.lastMsgId, 80);
        if (!lastMsgId && !item.resumeBefore && !item.discoveryPage && !item.retryAt && !ensureArray(item.pendingGroups).length && !ensureArray(item.unavailableSenders).length)
            return;
        out[groupId] = {
            lastMsgId: lastMsgId,
            intakePolicy:item.intakePolicy==='focused-v1'?'focused-v1':null,
                accountId: asString(item.accountId, 120) || null,
            resumeBefore: asString(item.resumeBefore, 80) || null,
            pendingNewest: asString(item.pendingNewest, 80) || null,
            unreadHeadId: asString(item.unreadHeadId,80)||null,
            unreadMsgIds: [...new Set(ensureArray(item.unreadMsgIds).map((id:any)=>asString(id,80)).filter(Boolean))].slice(-2000),
            unreadRemaining: typeof item.unreadRemaining==='number'&&item.unreadRemaining>=0?item.unreadRemaining:null,
            discoveryPage: Number(item.discoveryPage) || null,
            retryAt: asIso(item.retryAt),
            reason:item.reason==='budget'?'budget':null,
            ...(Array.isArray(item.unavailableSenders) ? {unavailableSenders: item.unavailableSenders.filter((row:any) => asString(row?.id,120) && asIso(row?.retryAt)).slice(-2000).map((row:any) => ({id:asString(row.id,120),retryAt:asIso(row.retryAt)}))} : {}),
            pendingGroups: ensureArray(item.pendingGroups).filter((group:any)=>group?.groupId).map((group:any)=>({groupId:asString(group.groupId,120),groupName:asString(group.groupName,120),groupType:group.groupType,unreadCount:typeof group.unreadCount==='number'?group.unreadCount:null,lastMsgId:asString(group.lastMsgId,80),lastMsg:group.lastMsg})),
            lastSendTime: asIso(item.lastSendTime),
            groupName: asString(item.groupName, 120),
            groupType: [1,2,3,8].includes(Number(item.groupType)) ? Number(item.groupType) : null,
            unreadCount: typeof item.unreadCount==='number' && item.unreadCount>=0 ? item.unreadCount : null,
            at: asIso(item.at) || hostNowIso(),
        };
    });
    return out;
}
function normalizeFetchReport(raw?: any): any {
    if (!raw || typeof raw !== 'object')
        return null;
    return {
        at: asIso(raw.at) || hostNowIso(),
        added: Number.isFinite(Number(raw.added)) ? Math.max(0, Math.round(Number(raw.added))) : 0,
        skipped: Number.isFinite(Number(raw.skipped)) ? Math.max(0, Math.round(Number(raw.skipped))) : 0,
        perFeed: ensureArray(raw.perFeed)
            .slice(0, 12)
            .map(function (row?: any): any {
            const item = row && typeof row === 'object' ? row : {};
            return {
                id: asString(item.id, 80),
                label: asString(item.label, 80),
                status: asString(item.status, 20) || 'ok',
                added: Number.isFinite(Number(item.added)) ? Math.max(0, Math.round(Number(item.added))) : 0,
                skipped: Number.isFinite(Number(item.skipped)) ? Math.max(0, Math.round(Number(item.skipped))) : 0,
                note: asString(item.note, 300),
            };
        }),
        note: asString(raw.note, 300),
    };
}
function normalizeMentionsReport(raw?: any): any {
    if (!raw || typeof raw !== 'object')
        return null;
    return {
        at: asIso(raw.at) || hostNowIso(),
        status: asString(raw.status, 20) || 'ok',
        found: Number.isFinite(Number(raw.found)) ? Math.max(0, Math.round(Number(raw.found))) : 0,
        added: Number.isFinite(Number(raw.added)) ? Math.max(0, Math.round(Number(raw.added))) : 0,
        user: asString(raw.user, 80),
        note: asString(raw.note, 400),
    };
}
function normalizeSettings(raw?: any): any {
    const input = raw && typeof raw === 'object' ? raw : {};
    const topics = asTags(input.topics, 24);
    const staleHours = Number(input.staleHours);
    const feeds = ensureArray(input.feeds)
        .map(normalizeFeed)
        .filter(function (feed?: any): any {
        return !!feed.url;
    })
        .slice(0, 12);
    return {
        knowledgeMode: knowledgeMode(input.knowledgeMode),
        topics: topics.length > 0 || input.topics !== undefined ? topics : DEFAULT_TOPICS.slice(),
        defaultProjectId: typeof input.defaultProjectId === 'string' && input.defaultProjectId ? input.defaultProjectId : null,
        staleHours: Number.isFinite(staleHours) && staleHours > 0 ? Math.min(24 * 30, Math.round(staleHours)) : 24,
        showCompleted: input.showCompleted === true,
        feeds: feeds,
        /** 昵称/别名 @ 的补充关键词（增量游标覆盖不到时的兜底检索） */
        mentionKeywords: asTags(input.mentionKeywords, 6),
        /** 工作台助手复用的原生会话 id（侧栏聊天） */
        assistantSessionId: asString(input.assistantSessionId, 120) || null,
        analysisSessionId: asString(input.analysisSessionId, 120) || null,
        summarySessionId: asString(input.summarySessionId, 120) || null,
        newsDays: Math.max(1, Math.min(90, Number(input.newsDays) || 7)),
        /** TODO 15：AI 结构化识别配置（默认全关；自动运行另由 automation/19 控制） */
        aiExtract: normalizeAiExtract(input.aiExtract),
        /** 助手侧栏宽度（px）：拖拽分栏后持久化，重启/刷新保持 */
        assistantWidth: (function (): any {
            const width = Number(input.assistantWidth);
            if (!Number.isFinite(width))
                return 384;
            return Math.max(240, Math.min(760, Math.round(width)));
        })(),
        /** 后台自动化（TODO 07）：插件侧定时执行确定性采集 */
        automation: normalizeAutomation(input.automation),
        aiPolicy: normalizeAiPolicy(input.aiPolicy),
    };
}
function normalizeProject(raw?: any, existing?: any): any {
    const input = raw && typeof raw === 'object' ? raw : {};
    const base = existing || {};
    return {
        id: base.id || newId('proj'),
        name: asString(input.name === undefined ? base.name : input.name, 120) || '未命名项目',
        repoPath: asString(input.repoPath === undefined ? base.repoPath : input.repoPath, 500),
        color: asString(input.color === undefined ? base.color : input.color, 20) || null,
        launchCommands: normalizeLaunchCommands(input.launchCommands === undefined ? base.launchCommands || [] : input.launchCommands),
    };
}
function normalizeTask(raw?: any, existing?: any): Task {
    const input = raw && typeof raw === 'object' ? raw : {};
    const base = existing || {};
    const createdAt = base.createdAt || hostNowIso();
    const status = TASK_STATUSES.indexOf(input.status) >= 0 ? input.status : base.status || 'ready';
    const priority = TASK_PRIORITIES.indexOf(input.priority) >= 0 ? input.priority : base.priority || 'normal';
    const confidenceRaw = input.confidence === undefined ? base.confidence : input.confidence;
    const confidence = typeof confidenceRaw === 'number' && confidenceRaw >= 0 && confidenceRaw <= 1 ? confidenceRaw : null;
    const completedAt = status === 'completed'
        ? base.completedAt || (base.status === 'completed' ? createdAt : hostNowIso())
        : null;
    return {
        archivedAt: asIso(input.archivedAt === undefined ? base.archivedAt : input.archivedAt),
        id: base.id || newId('task'),
        title: asString(input.title === undefined ? base.title : input.title, 200) || '未命名待办',
        description: asString(input.description === undefined ? base.description : input.description, 4000),
        status: status,
        priority: priority,
        dueAt: input.dueAt === undefined ? base.dueAt || null : asIso(input.dueAt),
        projectId: input.projectId === undefined
            ? base.projectId || null
            : typeof input.projectId === 'string' && input.projectId
                ? input.projectId
                : null,
        tags: input.tags === undefined ? asTags(base.tags) : asTags(input.tags),
        assignee: input.assignee === undefined
            ? base.assignee || null
            : asString(input.assignee, 80) || null,
        sourceRefId: input.sourceRefId === undefined
            ? base.sourceRefId || null
            : typeof input.sourceRefId === 'string' && input.sourceRefId
                ? input.sourceRefId
                : null,
        confidence: confidence,
        aiExtracted: input.aiExtracted === undefined ? base.aiExtracted === true : input.aiExtracted === true,
        demo: input.demo === undefined ? base.demo === true : input.demo === true,
        runIds: ensureArray(base.runIds).slice(),
        // ---- TODO 17 可选契约字段（旧数据缺省 = 旧行为） ----
        needsReply: input.needsReply === undefined ? base.needsReply === true : input.needsReply === true,
        needsAction: input.needsAction === undefined ? base.needsAction === true : input.needsAction === true,
        replyStage: input.replyStage === undefined
            ? base.replyStage || null
            : REPLY_STAGES.indexOf(input.replyStage) >= 0
                ? input.replyStage
                : null,
        eventType: input.eventType === undefined
            ? base.eventType || null
            : EVENT_TYPES.indexOf(input.eventType) >= 0
                ? input.eventType
                : null,
        deliverable: input.deliverable === undefined ? base.deliverable || null : asString(input.deliverable, 300) || null,
        meetingStart: input.meetingStart === undefined ? base.meetingStart || null : asIso(input.meetingStart),
        meetingEnd: input.meetingEnd === undefined ? base.meetingEnd || null : asIso(input.meetingEnd),
        meetingLocation: input.meetingLocation === undefined ? base.meetingLocation || null : asString(input.meetingLocation, 160) || null,
        registrationTarget: input.registrationTarget === undefined ? base.registrationTarget || null : asString(input.registrationTarget, 200) || null,
        // 多来源引用（兼容单条 sourceRefId 的读取）
        sourceRefs: normalizeSourceRefs(input.sourceRefs === undefined ? base.sourceRefs : input.sourceRefs),
        // 人工保护：后台/AI 不得覆盖人工判断；updateTask 自动记录被人工改过的字段
        humanGuard: input.humanGuard === undefined
            ? normalizeHumanGuard(base.humanGuard)
            : normalizeHumanGuard(Object.assign({}, normalizeHumanGuard(base.humanGuard), input.humanGuard || {})),
        createdAt: createdAt,
        updatedAt: hostNowIso(),
        completedAt: completedAt,
    };
}
/** TODO 17：多来源引用条目（sourceId/msgId 必须有其一，snippet 截断）。 */
function normalizeSourceRefs(raw?: any): any {
    const list = ensureArray(raw)
        .map(function (item?: any): any {
        const row = item && typeof item === 'object' ? item : {};
        const sourceId = asString(row.sourceId, 80) || null;
        const msgId = asString(row.msgId, 80) || null;
        if (!sourceId && !msgId)
            return null;
        return {
            sourceId: sourceId,
            msgId: msgId,
            snippet: asString(row.snippet, 240) || null,
        };
    })
        .filter(Boolean);
    return list.slice(0, 12);
}
/** TODO 17：人工保护标记（ignored/handled 等由后续端点写入，AI 不得清除）。 */
function normalizeHumanGuard(raw?: any): any {
    const input = raw && typeof raw === 'object' ? raw : {};
    const snoozeUntil = asIso(input.snoozeUntil);
    return {
        editedFields: asTags(input.editedFields, 12),
        ignored: input.ignored === true,
        handledConfirmed: input.handledConfirmed === true,
        snoozeUntil: snoozeUntil,
    };
}
function normalizeSource(raw?: any): Source {
    const input = raw && typeof raw === 'object' ? raw : {};
    const url = asUrl(input.url);
    const title = asString(input.title, 300) || url || '未命名来源';
    const excerpt = asString(input.excerpt, 2000);
    return {
        id: newId('src'),
        provider: asString(input.provider, 40) || 'manual',
        selection:normalizeMessageSelection(input.selection),
        ...(input.calendarMeta?{calendarMeta:input.calendarMeta}:{}),
        externalId: asString(input.externalId, 200) || null,
        url: url,
        title: title,
        excerpt: excerpt,
        fetchedAt: asIso(input.fetchedAt) || hostNowIso(),
        projectId: asString(input.projectId, 80) || null,
        payloadHash: hashText([url || '', title, excerpt].join('|')),
        // 消息类来源的可回溯信息：发送人与原始定位（IM 无文档化深链，故只存 ID）
        sender: asString(input.sender, 80) || null,
        locator: input.locator && typeof input.locator === 'object'
            ? {
                groupId: asString(input.locator.groupId, 80) || null,
                msgId: asString(input.locator.msgId, 80) || null,
                groupName: asString(input.locator.groupName, 120) || null,
                groupType: [1,2,3,8].includes(Number(input.locator.groupType)) ? Number(input.locator.groupType) : null,
                accountId: asString(input.locator.accountId, 120) || null,
                direction: input.locator.direction === 'outbound' ? 'outbound' : 'inbound',
                intake: input.locator.intake !== false,
                replyToMsgId: asString(input.locator.replyToMsgId, 80) || null,
                senderId: asString(input.locator.senderId, 120) || null,
                sentAt: asIso(input.locator.sentAt) || asIso(input.fetchedAt),
            }
            : null,
    };
}
function normalizeKnowledge(raw?: any, existing?: any): any {
    const input = raw && typeof raw === 'object' ? raw : {};
    const base = existing || {};
    const kind = KNOWLEDGE_KINDS.indexOf(input.kind) >= 0 ? input.kind : base.kind || 'note';
    const body = asString(input.body === undefined ? base.body : input.body, 20000);
    const url = input.url === undefined ? base.url || null : asUrl(input.url);
    return {
        archivedAt: asIso(input.archivedAt === undefined ? base.archivedAt : input.archivedAt),
        id: base.id || newId('kb'),
        projectId: asString(input.projectId===undefined?base.projectId:input.projectId,80)||null,
        accountId: asString(input.accountId===undefined?base.accountId:input.accountId,120)||null,
        reviewState: ['candidate','confirmed','obsolete'].includes(input.reviewState)?input.reviewState:base.reviewState||'candidate',
        validUntil: asIso(input.validUntil===undefined?base.validUntil:input.validUntil),
        sourceLabel: asString(input.sourceLabel===undefined?base.sourceLabel:input.sourceLabel,200),
        kind: kind,
        title: asString(input.title === undefined ? base.title : input.title, 200) ||
            (kind === 'bookmark' ? url || '未命名收藏' : '未命名笔记'),
        url: url,
        body: body,
        tags: input.tags === undefined ? asTags(base.tags) : asTags(input.tags),
        createdAt: base.createdAt || hostNowIso(),
        updatedAt: hostNowIso(),
    };
}
function normalizeCandidate(raw?: any, existing?: any): any {
    const input = raw && typeof raw === 'object' ? raw : {};
    const base = existing || {};
    const status = CANDIDATE_STATUSES.indexOf(input.status) >= 0 ? input.status : base.status || 'pending';
    const confidenceRaw = input.confidence === undefined ? base.confidence : input.confidence;
    return {
        id: base.id || newId('cand'),
        sourceRefId: input.sourceRefId === undefined ? base.sourceRefId || null : input.sourceRefId || null,
        sourceTitle: asString(input.sourceTitle === undefined ? base.sourceTitle : input.sourceTitle, 200),
        title: asString(input.title === undefined ? base.title : input.title, 200) || '待确认事项',
        excerpt: asString(input.excerpt === undefined ? base.excerpt : input.excerpt, 2000),
        dueAt: input.dueAt === undefined ? base.dueAt || null : asIso(input.dueAt),
        assignee: input.assignee === undefined ? base.assignee || null : asString(input.assignee, 80) || null,
        confidence: typeof confidenceRaw === 'number' && confidenceRaw >= 0 && confidenceRaw <= 1 ? confidenceRaw : null,
        reasons: input.reasons === undefined ? ensureArray(base.reasons) : asTags(input.reasons, 8),
        /** 提取方式：'rule' = 确定性规则候选（非模型判断），供 UI 与审计区分 */
        extractor: asString(input.extractor === undefined ? base.extractor : input.extractor, 20) || 'rule',
        status: status,
        taskId: input.taskId === undefined ? base.taskId || null : input.taskId || null,
        createdAt: base.createdAt || hostNowIso(),
        updatedAt: hostNowIso(),
    };
}
function normalizeRadarItem(raw?: any, existing?: any): any {
    const input = raw && typeof raw === 'object' ? raw : {};
    const base = existing || {};
    const summaryInput = input.summary && typeof input.summary === 'object' ? input.summary : base.summary || {};
    const url = input.url === undefined ? base.url || null : asUrl(input.url);
    return {
        archivedAt: asIso(input.archivedAt === undefined ? base.archivedAt : input.archivedAt),
        github: base.github || null,
        id: base.id || newId('radar'),
        title: asString(input.title === undefined ? base.title : input.title, 300) || '未命名资讯',
        source: asString(input.source === undefined ? base.source : input.source, 80) || 'manual',
        url: url,
        publishedAt: input.publishedAt === undefined ? base.publishedAt || null : asIso(input.publishedAt),
        /** TODO 20 日期纪律：publishedAt 可核实才标 published；未知 → unknown（不得用抓取时间冒充） */
        dateKind: (function (): any {
            if (input.dateKind !== undefined)
                return input.dateKind === 'published' ? 'published' : 'unknown';
            if (base.dateKind)
                return base.dateKind;
            if (base.publishedAt || input.publishedAt)
                return 'published';
            return 'unknown';
        })(),
        fetchedAt: input.fetchedAt === undefined ? base.fetchedAt || base.createdAt || hostNowIso() : asIso(input.fetchedAt) || hostNowIso(),
        topics: input.topics === undefined ? asTags(base.topics, 8) : asTags(input.topics, 8),
        summary: {
            change: asString(summaryInput.change, 800),
            usage: asString(summaryInput.usage, 800),
            risk: asString(summaryInput.risk, 800),
            practice: asString(summaryInput.practice, 800),
        },
        /** Raw source excerpt for fetched items; the four-part summary stays empty
         *  until an agent digests it, so nothing pretends to be an AI summary. */
        excerpt: asString(input.excerpt === undefined ? base.excerpt : input.excerpt, 2000),
        summaryStatus: asString(input.summaryStatus === undefined ? base.summaryStatus : input.summaryStatus, 20) || null,
        summaryAttempts: Number(input.summaryAttempts === undefined ? base.summaryAttempts : input.summaryAttempts) || 0,
        summaryError: asString(input.summaryError === undefined ? base.summaryError : input.summaryError, 200) || null,
        summaryRetryAt: asIso(input.summaryRetryAt === undefined ? base.summaryRetryAt : input.summaryRetryAt),
        availability: (input.availability === undefined ? base.availability : input.availability)==='ignored'?'ignored':'active',
        sourceFailures: Math.max(0,Number(input.sourceFailures === undefined ? base.sourceFailures : input.sourceFailures)||0),
        saved: input.saved === undefined ? base.saved === true : input.saved === true,
        demo: input.demo === undefined ? base.demo === true : input.demo === true,
        createdAt: base.createdAt || hostNowIso(),
        updatedAt: hostNowIso(),
    };
}
function normalizeRun(raw?: any, existing?: any): any {
    const input = raw && typeof raw === 'object' ? raw : {};
    const base = existing || {};
    const status = RUN_STATUSES.indexOf(input.status) >= 0 ? input.status : base.status || 'queued';
    const terminal = status === 'completed' || status === 'failed' || status === 'cancelled';
    return {
        id: base.id || newId('run'),
        taskId: input.taskId === undefined ? base.taskId || null : typeof input.taskId === 'string' && input.taskId ? input.taskId : null,
        sessionId: input.sessionId === undefined ? base.sessionId || null : asString(input.sessionId, 200) || null,
        status: status,
        profile: asString(input.profile === undefined ? base.profile : input.profile, 60) || 'workbench',
        summary: asString(input.summary === undefined ? base.summary : input.summary, 2000),
        steps: input.steps === undefined ? asSteps(base.steps) : asSteps(input.steps),
        evidence: input.evidence === undefined ? asEvidence(base.evidence) : asEvidence(input.evidence),
        startedAt: base.startedAt || asIso(input.startedAt) || hostNowIso(),
        endedAt: terminal ? base.endedAt || hostNowIso() : null,
    };
}
function normalizeState(raw?: any): any {
    const base = emptyWorkbenchState();
    if (!raw || typeof raw !== 'object' || raw.__corrupt) {
        return { state: base, migrated: false, corrupt: raw && raw.__corrupt ? raw.__corrupt : null };
    }
    const state: any = {
        version: HOST_STATE_VERSION,
        revision: Number.isFinite(Number(raw.revision)) ? Number(raw.revision) : 0,
        installedAt: asIso(raw.installedAt),
        updatedAt: asIso(raw.updatedAt) || hostNowIso(),
        settings: normalizeSettings(raw.settings),
        messageInbox:normalizeMessageInbox(raw.messageInbox),
        // 恢复时必须把「已存的记录自身」当作 base 传入：normalizeX(raw, null) 会把
        // base 当成空对象，从而为每条记录重新生成 ID，导致 projectId / taskId /
        // runIds / sourceRefId 等关联在每次加载后全部失效。
        projects: ensureArray(raw.projects)
            .map(function (project?: any): any {
            return normalizeProject(project, project);
        }),
        tasks: ensureArray(raw.tasks)
            .map(function (task?: any): any {
            return normalizeTask(task, task);
        }),
        sources: ensureArray(raw.sources),
        runs: ensureArray(raw.runs)
            .map(function (run?: any): any {
            return normalizeRun(run, run);
        }),
        knowledge: ensureArray(raw.knowledge)
            .map(function (item?: any): any {
            return normalizeKnowledge(item, item);
        }),
        radar: ensureArray(raw.radar),
        connectors: ensureArray(raw.connectors).slice(0, 40),
        candidates: ensureArray(raw.candidates)
            .slice(-CANDIDATE_LIMIT)
            .map(function (candidate?: any): any {
            return normalizeCandidate(candidate, candidate);
        }),
        operations: ensureArray(raw.operations)
            .slice()
            .map(function (operation?: any): any {
            const item = operation && typeof operation === 'object' ? operation : {};
            return {
                key: asString(item.key, 160),
                tool: asString(item.tool, 60),
                at: asIso(item.at) || hostNowIso(),
                entityIds: ensureArray(item.entityIds).slice(0, 10).map(function (id?: any): any {
                    return asString(id, 80);
                }),
                status: asString(item.status, 20) || 'succeeded',
            };
        })
            .filter(function (operation?: any): any {
            return operation.key.length > 0;
        }),
        changeHistory: ensureArray(raw.changeHistory),
        aiUsage: raw.aiUsage && typeof raw.aiUsage==='object' ? raw.aiUsage : {},
        reminderSnoozes: raw.reminderSnoozes && typeof raw.reminderSnoozes==='object' ? raw.reminderSnoozes : {},
        replyDrafts: raw.replyDrafts && typeof raw.replyDrafts==='object' ? raw.replyDrafts : {},
        qualityReviews: ensureArray(raw.qualityReviews),
        qualityEvaluation: raw.qualityEvaluation || null,
        retrievalTraces: ensureArray(raw.retrievalTraces).slice(-100),
        webAI: normalizeWebAI(raw.webAI,true),
        jobs: ensureArray(raw.jobs).map((row:any)=>Object.assign({},row,{status:row.status === 'running' ? 'queued' : row.status,...(Array.isArray(row.steps)?{steps:row.steps.map((step:any)=>({...step,status:step.status==='running'?'pending':step.status}))}:{})})),
        backgroundThreads: Object.fromEntries(Object.entries(raw.backgroundThreads || {}).filter(([key,value]:any)=>/^[a-f0-9]{16,64}$/.test(key) && value && typeof value==='object' && typeof value.sessionId==='string').map(([key,value]:any)=>[key,{purpose:value.purpose==='summary'?'summary':'analysis',accountId:typeof value.accountId==='string'?value.accountId:null,sessionId:asString(value.sessionId,120),protocol:asString(value.protocol,80)||null,rulesHash:asString(value.rulesHash,64)||null,compactionSeq:Number(value.compactionSeq)||0,seen:Object.fromEntries(Object.entries(value.seen || {}).filter(([id,hash])=>typeof hash==='string').slice(-256))}])),
        backgroundSessionIds: [...new Set(ensureArray(raw.backgroundSessionIds).filter((id:any)=>typeof id==='string' && id.length<=120))],
        lastAnalysisBatch: raw.lastAnalysisBatch && typeof raw.lastAnalysisBatch==='object' ? {at:asIso(raw.lastAnalysisBatch.at),status:asString(raw.lastAnalysisBatch.status,40),...Object.fromEntries(['durationMs','processed','failures','inputCount','modelCalls','promptChars','ruleInitializations','contextMessages','batches','reusedBatches'].map(key=>[key,Math.max(0,Number(raw.lastAnalysisBatch[key])||0)]))} : null,
        modelHealth: Object.fromEntries(['analysis','summary'].filter(key=>raw.modelHealth?.[key] && typeof raw.modelHealth[key]==='object').map(key=>{const h=raw.modelHealth[key];return[key,{failures:Math.max(0,Math.min(3,Number(h.failures)||0)),blocked:h.blocked===true,retryAt:asIso(h.retryAt),note:asString(h.note,200),detail:asString(h.detail,200),at:asIso(h.at)}]})),
        analysisQueue: normalizeAnalysisQueue(raw.analysisQueue),
        replies: normalizeReplies(raw.replies),
        syncCursors: normalizeSyncCursors(raw.syncCursors),
        lastMessageSyncAttemptAt:asIso(raw.lastMessageSyncAttemptAt),
        lastAutomation: raw.lastAutomation && typeof raw.lastAutomation === 'object'
            ? {
                at: asIso(raw.lastAutomation.at) || hostNowIso(),
                collectedAt: asIso(raw.lastAutomation.collectedAt),
                radarAdded: Number(raw.lastAutomation.radarAdded) || 0,
                mentionsAdded: Number(raw.lastAutomation.mentionsAdded) || 0,
                status: asString(raw.lastAutomation.status, 20) || 'ok',
                note: asString(raw.lastAutomation.note, 300),
            }
            : null,
        lastRadarSummarize: raw.lastRadarSummarize && typeof raw.lastRadarSummarize === 'object'
            ? {
                at: asIso(raw.lastRadarSummarize.at) || hostNowIso(),
                done: Number(raw.lastRadarSummarize.done) || 0,
                failed: Number(raw.lastRadarSummarize.failed) || 0,
                interrupted: raw.lastRadarSummarize.interrupted === true,
                note: asString(raw.lastRadarSummarize.note, 200) || null,
            }
            : null,
        lastRadarFetch: normalizeFetchReport(raw.lastRadarFetch),
        lastMentionsFetch: normalizeMentionsReport(raw.lastMentionsFetch),
        audit: ensureArray(raw.audit).slice(-AUDIT_LIMIT),
    };
    // Compatibility upgrade: legacy task reply fields become independent obligations once.
    for (const task of state.tasks) {
        if (!task.needsReply || state.replies.some((row: any) => row.taskIds.includes(task.id))) continue
        let source = state.sources.find((row: any) => row.id === task.sourceRefId)
        if (!source) {
            source = normalizeSource({ provider:'legacy', externalId:'legacy-task:'+task.id, title:task.title, excerpt:task.description || task.title })
            state.sources.push(source)
        }
        const loc = source.locator || {}
        let reply = state.replies.find((row: any) => row.sourceId === source.id)
        if (!reply) {
            reply = normalizeReplies([{ sourceId:source.id, msgId:loc.msgId || 'legacy-task:'+task.id, groupId:loc.groupId, accountId:loc.accountId, groupName:loc.groupName, contact:source.sender, snippet:source.excerpt,
              stage:task.replyStage === '已实质答复' ? '已回复' : task.replyStage === '已确认收到' ? '已确认收到' : task.replyStage === '不需答复' ? '不需回复' : '待回复', taskIds:[task.id] }])[0]
            state.replies.push(reply)
        } else reply.taskIds = [...new Set(reply.taskIds.concat(task.id))]
    }
    return { state: state, migrated: (raw.version || 0) !== HOST_STATE_VERSION, corrupt: null };
}
function auditEntry(state?: any, event?: any, summary?: any): any {
    state.audit = ensureArray(state.audit).concat([
        { id: newId('audit'), at: hostNowIso(), event: event, summary: asString(summary, 300) },
    ]);
    if (state.audit.length > AUDIT_LIMIT)
        state.audit = state.audit.slice(-AUDIT_LIMIT);
}
function seedDemoData(state?: any): any {
    const now = Date.now();
    const demoFeeds: any = [
        normalizeFeed({ label: 'Hacker News · LLM', url: 'https://hnrss.org/newest?q=LLM', topics: ['LLM'] }),
        normalizeFeed({ label: 'Hacker News · Agent', url: 'https://hnrss.org/newest?q=AI+agent', topics: ['Agent'] }),
    ];
    const demoFeedUrls = new Set(demoFeeds.map(function (feed?: any): any { return feed.url; }));
    state.settings.feeds = ensureArray(state.settings.feeds)
        .filter(function (feed?: any): any {
        return !demoFeedUrls.has(feed.url);
    })
        .concat(demoFeeds);
    const projectId = state.projects.length > 0 ? state.projects[0].id : null;
    state.projects = state.projects.filter(function (row?: any): any { return row.id !== 'proj-demo-gateway'; }).concat([
        { id: 'proj-demo-gateway', name: '网关限流', repoPath: '', color: null },
    ]);
    const demoProject = 'proj-demo-gateway';
    const due = function (hours?: any): any {
        return new Date(now + hours * 3600 * 1000).toISOString();
    };
    const demoSource = normalizeSource({
        provider: 'yunzhijia',
        externalId: 'demo-msg-1',
        url: null,
        title: '@我 · 网关压测群',
        excerpt: '张三：限流阈值在 2000 QPS 下仍然打到下游，@我 今天下班前给个结论，附压测报告。',
        fetchedAt: new Date(now - 3 * 3600 * 1000).toISOString(),
    });
    state.sources = state.sources.concat([demoSource]);
    state.tasks = state.tasks.concat([
        normalizeTask({
            title: '给出网关限流阈值结论',
            description: '在 2000 QPS 压测下复现下游打满，输出阈值建议与压测报告链接。',
            status: 'ready',
            priority: 'urgent',
            dueAt: due(6),
            projectId: demoProject,
            tags: ['后端', '限流'],
            assignee: '我',
            sourceRefId: demoSource.id,
            confidence: 0.82,
            aiExtracted: true,
            demo: true,
        }, null),
        normalizeTask({
            title: '评审 Tokenizer 选型对比',
            description: '比较三种分词方案在中文技术文档上的召回与成本。',
            status: 'ready',
            priority: 'high',
            dueAt: due(30),
            projectId: demoProject,
            tags: ['RAG', '评测'],
            demo: true,
        }, null),
        normalizeTask({
            title: '补充 Docker 只读诊断的权限说明',
            description: '在设计报告 §7.1 中补充 L1 只读诊断的边界。',
            status: 'completed',
            priority: 'normal',
            dueAt: due(-20),
            projectId: demoProject,
            tags: ['文档'],
            demo: true,
        }, null),
    ]);
    state.radar = state.radar.concat([
        normalizeRadarItem({
            title: 'Harness Web Client Slots：扩展点从装饰走向整页',
            source: '官方文档',
            url: 'https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/slots',
            publishedAt: new Date(now - 26 * 3600 * 1000).toISOString(),
            topics: ['Agent', 'RAG'],
            summary: {
                change: '插槽体系把 main 面板开放为按 key 派发，插件可以注册独立页面而不改核心代码。',
                usage: '适合把跨模块的工作入口做成一个常驻面板，而不是塞进会话流。',
                risk: 'Slot 注册与主题、语言、Remote 契约都随版本演进，需要版本固定与回归。',
                practice: '先用最小页面验证 Slots + Remote 全链路，再堆业务模块。',
            },
            demo: true,
        }, null),
        normalizeRadarItem({
            title: 'RAG 评测：把“检索召回”和“答案忠实度”分开度量',
            source: '研发博客',
            url: null,
            publishedAt: new Date(now - 50 * 3600 * 1000).toISOString(),
            topics: ['RAG', 'LLM'],
            summary: {
                change: '单一端到端分数掩盖了两段误差，分层度量后才能定位是检索还是生成的问题。',
                usage: '适合在知识问答上线前建立基线。',
                risk: '评测集泄露会让分数虚高。',
                practice: '为每个失败样本标注是“没检索到”还是“检索到但答错”。',
            },
            demo: true,
        }, null),
    ]);
    state.runs = state.runs.concat([
        normalizeRun({
            taskId: state.tasks[state.tasks.length - 1].id,
            sessionId: null,
            status: 'completed',
            profile: 'Coding Agent',
            summary: '补充了 §7.1 的 L1 边界说明并提交到设计报告。',
            steps: [
                { at: new Date(now - 21 * 3600 * 1000).toISOString(), text: '读取设计报告 §7.1' },
                { at: new Date(now - 20.5 * 3600 * 1000).toISOString(), text: '写入只读诊断边界说明' },
            ],
            evidence: [{ label: '设计报告 §7.1', url: null }],
            startedAt: new Date(now - 21 * 3600 * 1000).toISOString(),
        }, null),
    ]);
    state.knowledge = state.knowledge.concat([
        normalizeKnowledge({
            kind: 'bookmark',
            title: 'Harness Web Client Slots 参考',
            url: 'https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/slots',
            body: '注册 main / sidebar.panellist 的最小示例。',
            tags: ['Harness', 'Slots'],
        }),
    ]);
    return state;
}
/** A paste-ready brief for a task, used by the Agent center and the UI. */
function taskBrief(task?: any, source?: any): any {
    const lines: any = [];
    lines.push('## 任务：' + task.title);
    lines.push('');
    lines.push('- 状态：' + task.status + ' · 优先级：' + task.priority);
    if (task.dueAt)
        lines.push('- 截止：' + task.dueAt);
    if (task.assignee)
        lines.push('- 负责人：' + task.assignee);
    lines.push('');
    if (task.description) {
        lines.push('### 背景');
        lines.push(task.description);
        lines.push('');
    }
    if (source) {
        lines.push('### 来源证据');
        lines.push('- ' + source.provider + ' · ' + source.title);
        if (source.url)
            lines.push('- ' + source.url);
        if (source.excerpt)
            lines.push('- 原文摘录：' + source.excerpt);
        lines.push('');
    }
    lines.push('### 期望产出');
    lines.push('1. 结论与依据（引用来源）');
    lines.push('2. 可执行的下一步');
    lines.push('3. 需要人工确认的风险点');
    return lines.join('\n');
}

export { TASK_STATUSES, TASK_PRIORITIES, RUN_STATUSES, KNOWLEDGE_KINDS, AUDIT_LIMIT, CANDIDATE_LIMIT, CANDIDATE_STATUSES, REPLY_STAGES, EVENT_TYPES, HUMAN_GUARD_STATUSES, OPERATION_LIMIT, DEFAULT_TOPICS, emptyWorkbenchState, ensureArray, normalizeFeed, normalizeAiExtract, normalizeAutomation, ANALYSIS_STATUSES, normalizeReplies, REPLY_STATUSES, normalizeAnalysisQueue, normalizeSyncCursors, normalizeFetchReport, normalizeMentionsReport, normalizeSettings, normalizeProject, normalizeTask, normalizeSourceRefs, normalizeHumanGuard, normalizeSource, normalizeKnowledge, normalizeCandidate, normalizeRadarItem, normalizeRun, normalizeState, auditEntry, seedDemoData, taskBrief }

