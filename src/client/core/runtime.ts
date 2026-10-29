import * as React from 'react'
import { T, h } from './theme.js'
import { MAX_ASSISTANT_CONTEXTS } from '../../shared/assistant-context.js'
import { fmt, pad2, parseDate, util } from './format.js'
import { Badge, Btn, Chip, Divider, Empty, Field, Icon, IconBtn, Input, Kbd, Modal, PageHead, Panel, Progress, Segmented, Select, Spinner, Stat, Tabs, Textarea, Toggle, WB_ICON_PATHS } from '../components/primitives.js'
import { WB_CSS } from './styles.js'

/* ------------------------------------------------------------------- WB bag */
const WB: any = {
    NS: 'dev-workbench',
    PANEL_KEY: 'dev-workbench',
    inject: ['slots', 'locale', 'connection', 'layout', 'uiWorkspace', 'sessions'],
    pages: {},
    T: T,
    ICONS: {},
    PAGE_META: {},
    ORDER: [],
};

/* ---------------------------------------------------------------- stylesheet */
/* ------------------------------------------------------------------- store */
const wbStore = (function (): any {
    let state: any = {
        status: 'loading',
        error: null,
        data: null,
        busy: false,
        toasts: [],
        page: 'dashboard',
        focusTaskId: null,
        taskForm: null,
        /** Transient hand-off from the dashboard to the task center
         *  ({status?|dueFilter?}); the task page consumes it and clears it. */
        taskPreset: null,
        /** 工作台助手：可移除的上下文引用（task / source / radar / knowledge / search） */
        assistantOpen: false,
        assistantRefs: [],
        /** 命令面板 → 搜索页的交接：{query, groups} */
        searchPreset: null,
    };
    const listeners = new Set();
    return {
        get(): any {
            return state;
        },
        set(patch?: any): any {
            const next = typeof patch === 'function' ? patch(state) : patch;
            state = Object.assign({}, state, next);
            listeners.forEach(function (fn?: any): any {
                try {
                    fn();
                }
                catch (e) {
                    /* a page that throws must not blank the others */
                }
            });
        },
        subscribe(fn?: any): any {
            listeners.add(fn);
            return function (): any {
                listeners.delete(fn);
            };
        },
    };
})();

function useStore(): any {
    return React.useSyncExternalStore(wbStore.subscribe, wbStore.get);
}

/* --------------------------------------------------------------------- i18n */
// 产品语言固定为中文：无论 DSH 界面是中文还是英文环境，插件自身一律显示中文。
// 因此 zh / en 两个字典内容相同，避免英文环境下导航出现 Briefing / Task center 之类。
const WB_DICT: any = {
    zh: {
        'app.title': '智能工作台',
        'app.subtitle': '每天的入口',
        'nav.overview': '概览',
        'nav.work': '工作',
        'nav.tools': '工具',
        'nav.dashboard': '今日简报',
        'nav.tasks': '任务中心',
        'nav.search': '搜索',
        'nav.agents': 'Agent 中心',
        'nav.collab': '研发协作',
        'nav.radar': '技术雷达',
        'nav.toolbox': '开发工具箱',
        'nav.knowledge': '知识空间',
        'nav.settings': '连接与设置',
        'common.refresh': '刷新',
        'common.new': '新建',
        'common.save': '保存',
        'common.cancel': '取消',
        'common.delete': '删除',
        'common.close': '关闭',
        'common.search': '搜索待办、知识、资讯或命令',
        'common.loading': '加载中…',
        'common.empty': '暂无内容',
        'common.retry': '重试',
        'common.all': '全部',
        'dash.title': '今日简报',
        'tasks.title': '任务中心',
        'agents.title': 'Agent 中心',
        'radar.title': '技术雷达',
        'toolbox.title': '开发工具箱',
        'knowledge.title': '知识空间',
        'settings.title': '连接与设置',
    },
};

// 英文环境复用同一份中文文案（产品语言固定为中文，不做英文版）
WB_DICT.en = WB_DICT.zh;

let wbTranslate = function (key?: any): any {
    return key;
};

WB.t = function (key?: any, fallback?: any): any {
    let value = key;
    try {
        value = wbTranslate(key);
    }
    catch (e) {
        value = key;
    }
    if (typeof value === 'string' && value.length > 0 && value !== key)
        return value;
    return fallback === undefined ? key : fallback;
};

/* --------------------------------------------------------------------- RPC */
let wbConnection: any = null;

let wbUiWorkspace: any = null;
let wbNativeSessions: {open:(id:string)=>void}|null = null;

let wbLayout: any = null;

/**
 * Open the harness directory picker. Resolves null when the profile has no
 * picker or the user cancels — callers must treat null as "nothing happened",
 * never as an empty path.
 */
function pickDirectory(): any {
    if (!wbUiWorkspace || typeof wbUiWorkspace.pickDirectory !== 'function') {
        return Promise.resolve(null);
    }
    return Promise.resolve()
        .then(function (): any {
        return wbUiWorkspace.pickDirectory();
    })
        .then(function (value?: any): any {
        return typeof value === 'string' && value.length > 0 ? value : null;
    })
        .catch(function (): any {
        return null;
    });
}

function wbRpc(endpoint?: any, args?: any, signal?: any): any {
    if (!wbConnection || !wbConnection.rpc || typeof wbConnection.rpc.call !== 'function') {
        return Promise.reject(new Error('与 Host 的连接尚未就绪'));
    }
    return wbConnection.rpc.call('/api', endpoint, { args: args || {} }, signal).then(function (envelope?: any): any {
        if (!envelope || envelope.ok !== true) {
            const error = envelope && envelope.error;
            const message = error === undefined
                ? '远端调用失败'
                : String(error && error.message !== undefined ? error.message : error);
            throw new Error(message);
        }
        return envelope.value;
    });
}

/* ------------------------------------------------------------------ toasts */
let wbToastSeq = 0;

function toast(text?: any, kind?: any): any {
    const id = ++wbToastSeq;
    wbStore.set(function (state?: any): any {
        return { toasts: state.toasts.concat([{ id: id, kind: kind || 'info', text: String(text) }]) };
    });
    setTimeout(function (): any {
        wbStore.set(function (state?: any): any {
            return { toasts: state.toasts.filter(function (item?: any): any {
                    return item.id !== id;
                }) };
        });
    }, kind === 'err' ? 6000 : 3200);
    return id;
}

/** 我们注册的 Agent 工具名：原生聊天的工具卡片按这些 key 注册。 */
WB.WORKBENCH_TOOL_NAMES = [
    'workbench_create_task',
    'workbench_update_task',
    'workbench_list_tasks',
    'workbench_task_brief',
    'workbench_record_run',
    'workbench_fetch_radar',
    'workbench_fetch_mentions',
    'workbench_update_radar',
    'workbench_search',
    'workbench_manage_replies', 'workbench_manage_knowledge', 'workbench_analyze_messages', 'workbench_summarize_radar',
];

/* --------------------------------------------------------------- 助手上下文 */
/**
 * 工作台助手：把「当前在看的东西」作为**可见、可移除**的上下文引用收集起来，
 * 交给原生会话里的 Agent（它有 workbench_* 工具，结果会写回同一份数据）。
 * 插件内不嵌模型；这里只负责组装上下文与跳转（TODO 04 的备选路径）。
 */
const assistant: any = {
    open(): any {
        wbStore.set({ assistantOpen: true });
    },
    close(): any {
        wbStore.set({ assistantOpen: false });
    },
    toggle(): any {
        wbStore.set(function (state?: any): any {
            return { assistantOpen: !state.assistantOpen };
        });
    },
    add(ref?: any): any {
        if (!ref || !ref.kind)
            return;
        wbStore.set(function (state?: any): any {
            const exists = state.assistantRefs.some(function (item?: any): any {
                return item.kind === ref.kind && item.id === ref.id;
            });
            return {
                assistantOpen: true,
                assistantRefs: exists ? state.assistantRefs : state.assistantRefs.length >= MAX_ASSISTANT_CONTEXTS ? state.assistantRefs : state.assistantRefs.concat([ref]),
            };
        });
    },
    remove(kind?: any, id?: any): any {
        wbStore.set(function (state?: any): any {
            return {
                assistantRefs: state.assistantRefs.filter(function (item?: any): any {
                    return !(item.kind === kind && item.id === id);
                }),
            };
        });
    },
    clear(): any {
        wbStore.set({ assistantRefs: [] });
    },
};

/** 把上下文引用渲染成可直接粘贴给会话的 Markdown 简报。 */
function assistantBrief(refs?: any, instruction?: any): any {
    const lines: any = [];
    lines.push('请基于下面的工作台上下文协助我，并在有结论时用 workbench_* 工具写回（创建/更新待办、登记执行记录、写回资讯摘要）。');
    lines.push('');
    refs.forEach(function (ref?: any, index?: any): any {
        lines.push('### 上下文 ' + (index + 1) + '：' + (ref.label || ref.kind) + ' · ' + (ref.title || ref.id));
        if (ref.url)
            lines.push('- 链接：' + ref.url);
        if (ref.meta)
            lines.push('- 信息：' + ref.meta);
        if (ref.body) {
            lines.push('- 内容：');
            lines.push(String(ref.body).slice(0, 1200));
        }
        lines.push('');
    });
    lines.push('### 我的要求');
    lines.push(String(instruction || '').trim() || '（在这里补充要求）');
    return lines.join('\n');
}

/* ----------------------------------------------------------------- actions */
let wbPendingRequests = 0;
let wbSyncInFlight: Promise<boolean> | null = null;

function acceptSnapshot(snapshot?: any): any {
    const current = wbStore.get().data;
    if (current && Number(snapshot.revision || 0) < Number(current.revision || 0))
        return false;
    wbStore.set({ status: 'ready', error: null, data: snapshot });
    return true;
}

function settle(promise?: any, okText?: any): any {
    wbPendingRequests += 1;
    wbStore.set({ busy: true });
    return promise
        .then(function (snapshot?: any): any {
        acceptSnapshot(snapshot);
        if (okText)
            toast(okText, 'ok');
        return snapshot;
    })
        .catch(function (e?: any): any {
        const message = String((e && e.message) || e);
        wbStore.set({ busy: false, error: message });
        toast(message, 'err');
        throw e;
    }).finally(function (): any { wbPendingRequests -= 1; wbStore.set({ busy: wbPendingRequests > 0 }); });
}

const wbActions: any = {
    knowledgeRetrieve(request:any){return wbRpc('workbench/knowledgeRetrieve',{request})},
    knowledgeRead(request:any){return wbRpc('workbench/knowledgeRead',{request})},
    knowledgeTraces(request:any){return wbRpc('workbench/knowledgeTraces',{request})},
    officeWorkflowStart(kind:string,input:any){return settle(wbRpc('workbench/officeWorkflowStart',{kind,input}),'已进入办公执行队列')},
    officeWorkflowControl(id:string,action:string){return settle(wbRpc('workbench/officeWorkflowControl',{id,action}))},
    adoptReplyArtifact(jobId:string,stepId:string){return settle(wbRpc('workbench/adoptReplyArtifact',{jobId,stepId}),'草稿已保存，尚未发送')},
    reload(): any {
        return settle(wbRpc('workbench/snapshot', {}));
    },
    saveSettings(patch?: any): any {
        return settle(wbRpc('workbench/saveSettings', { patch: patch }), '设置已保存');
    },
    createTask(input?: any): any {
        return settle(wbRpc('workbench/createTask', { input: input }), '待办已创建');
    },
    updateTask(id?: any, patch?: any): any {
        return settle(wbRpc('workbench/updateTask', { id: id, patch: patch }));
    },
    deleteTask(id?: any): any {
        return settle(wbRpc('workbench/deleteTask', { id: id }), '待办已删除');
    },
    addSource(input?: any): any {
        return settle(wbRpc('workbench/addSource', { input: input }));
    },
    createKnowledge(input?: any): any {
        const before = (wbStore.get().data && wbStore.get().data.knowledge) || [];
        return settle(wbRpc('workbench/createKnowledge', { input: input })).then(function (snapshot?: any): any {
            const after = (snapshot && snapshot.knowledge) || [];
            if (after.length === before.length)
                WB.toast('这条已经收藏过了，未重复添加', 'info');
            else
                WB.toast('已收藏', 'ok');
            return snapshot;
        });
    },
    updateKnowledge(id?: any, patch?: any): any {
        return settle(wbRpc('workbench/updateKnowledge', { id: id, patch: patch }), '知识条目已更新');
    },
    deleteKnowledge(id?: any): any {
        return settle(wbRpc('workbench/deleteKnowledge', { id: id }), '已删除');
    },
    saveRadarItem(input?: any): any {
        return settle(wbRpc('workbench/saveRadarItem', { input: input }));
    },
    deleteRadarItem(id?: any): any {
        return settle(wbRpc('workbench/deleteRadarItem', { id: id }), '已移除');
    },
    recordRun(input?: any): any {
        return settle(wbRpc('workbench/recordRun', { input: input }), '已登记执行记录');
    },
    updateRun(id?: any, patch?: any): any {
        return settle(wbRpc('workbench/updateRun', { id: id, patch: patch }));
    },
    reset(scope?: any): any {
        return settle(wbRpc('workbench/reset', { scope: scope || 'all' }), '数据已重置');
    },
    seedDemo(): any {
        return settle(wbRpc('workbench/seedDemo', {}), '已载入示例数据');
    },
    saveProject(input?: any): any {
        return settle(wbRpc('workbench/saveProject', { input: input }), '项目已保存');
    },
    deleteProject(id?: any): any {
        return settle(wbRpc('workbench/deleteProject', { id: id }), '项目已删除');
    },
    /** Pull @-mention messages through yzj-cli; report lands in data.lastMentionsFetch.
     *  Zero-parameter endpoint: the gateway strictly validates arg fields against
     *  the descriptor, so the payload must be exactly {}. */
    fetchMentions(): any {
        return settle(wbRpc('workbench/fetchMentions', {}), '@我 消息已拉取');
    },
    /** Fetch the configured RSS/Atom feeds; the report lands in data.lastRadarFetch.
     *  Zero-parameter endpoint — payload must be exactly {} (see fetchMentions). */
    fetchRadar(): any {
        return settle(wbRpc('workbench/fetchRadar', {}), '抓取完成');
    },
    /** Turn one radar item into a real task with its source evidence attached. */
    createTaskFromRadar(id?: any): any {
        return settle(wbRpc('workbench/createTaskFromRadar', { id: id }), '已生成实践任务');
    },
    addFeed(input?: any): any {
        const snapshot = wbStore.get().data;
        const current = (snapshot && snapshot.settings && snapshot.settings.feeds) || [];
        const url = String((input && input.url) || '').trim();
        if (!/^https?:\/\//i.test(url)) {
            WB.toast('资讯源地址必须是 http(s) URL', 'err');
            return Promise.reject(new Error('invalid feed url'));
        }
        const next = current
            .filter(function (feed?: any): any {
            return feed.url !== url;
        })
            .concat([
            {
                id: WB.util.uid('feed'),
                label: String((input && input.label) || '').trim() || url.replace(/^https?:\/\//, '').slice(0, 60),
                url: url,
                topics: (input && input.topics) || [],
            },
        ])
            .slice(0, 12);
        return settle(wbRpc('workbench/saveSettings', { patch: { feeds: next } }), '资讯源已添加');
    },
    deleteFeed(id?: any): any {
        const snapshot = wbStore.get().data;
        const current = (snapshot && snapshot.settings && snapshot.settings.feeds) || [];
        const next = current.filter(function (feed?: any): any {
            return feed.id !== id;
        });
        return settle(wbRpc('workbench/saveSettings', { patch: { feeds: next } }), '资讯源已移除');
    },
    /** 规则候选：为尚未提取的 @我 来源生成待确认候选（确定性，无模型）。 */
    extractCandidates(): any {
        return settle(wbRpc('workbench/extractCandidates', {}), '已生成待确认候选');
    },
    acceptCandidate(id?: any, patch?: any): any {
        return settle(wbRpc('workbench/acceptCandidate', { id: id, patch: patch || {} }), '已采纳为待办');
    },
    rejectCandidate(id?: any): any {
        return settle(wbRpc('workbench/rejectCandidate', { id: id }), '已忽略该候选');
    },
    /** Unified search. Returns {query, at, total, groups[]} — NOT a snapshot. */
    search(query?: any, options?: any): any {
        return wbRpc('workbench/search', {
            request: { query: query, includeWeb: !options || options.includeWeb !== false },
        });
    },
    /** Read-only engineering environment: git status per project + docker ps. */
    environment(): any {
        return wbRpc('workbench/environment', {});
    },
    /** GitHub 只读快照（PR / CI）。 */
    github(): any {
        return wbRpc('workbench/github', {});
    },
    /**
     * 自动同步：只比对业务修订号，变新才重取快照；正在编辑表单时跳过，
     * 避免后台刷新打断输入（TODO 08）。
     */
    syncCheck(): any {
        if (wbSyncInFlight) return wbSyncInFlight;
        const store = wbStore.get();
        const current = store.data;
        if (!current)
            return Promise.resolve(false);
        if (store.taskForm)
            return Promise.resolve(false);
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error('同步超时，稍后重试')); }, 15000);
        });
        wbSyncInFlight = (async () => {
            const info = await Promise.race([wbRpc('workbench/revision', {}, controller.signal), timeout]);
            if (!info || Number(info.revision) <= Number(current.revision || 0))
                return false;
            const snapshot = await Promise.race([wbRpc('workbench/snapshot', {}, controller.signal), timeout]);
            acceptSnapshot(snapshot);
            return true;
        })().catch(() => false).finally(() => { clearTimeout(timer); wbSyncInFlight = null; });
        return wbSyncInFlight;
    },
    /** 侧栏助手：向原生会话提交一次问答，返回 {status, reply, toolCalls, note}。 */
    assistantAsk(text?: any, refs?: any, sessionId?: any): any {
        return wbRpc('workbench/assistantAsk', {
            request: { text: text, refs: refs || [], sessionId: sessionId || null },
        });
    },
    /** 只提交提示，立即返回 {sessionId, fromSeq}；配合 assistantDelta 渐进渲染。 */
    assistantSend(text?: any, refs?: any, sessionId?: any, steer?: any, knowledgeMode?:string, knowledgeScope?:any): any {
        return wbRpc('workbench/assistantSend', {
            request: { text: text, refs: refs || [], sessionId: sessionId || null, steer: steer === true, knowledgeMode, ...(knowledgeScope||{}) },
        });
    },
    /** 增量读取：{entries, nextSeq, turnActive}。 */
    assistantDelta(sessionId?: any, fromSeq?: any, retrievalId?:string): any {
        return wbRpc('workbench/assistantDelta', {
            request: { sessionId: sessionId || null, fromSeq: fromSeq || 0, retrievalId },
        });
    },
    /** 按消息 id 取助手回复正文（原生聊天内嵌动作）。 */
    assistantMessage(sessionId?: any, messageId?: any): any {
        return wbRpc('workbench/assistantMessage', {
            request: { sessionId: sessionId || null, messageId: messageId || null },
        });
    },
    deleteSource(id?: any): any {
        return settle(wbRpc('workbench/deleteSource', { id: id }), '来源已删除');
    },
    deleteRun(id?: any): any {
        return settle(wbRpc('workbench/deleteRun', { id: id }), '执行记录已删除');
    },
    deleteCandidate(id?: any): any {
        return settle(wbRpc('workbench/deleteCandidate', { id: id }), '候选已删除');
    },
    assistantSessions(limit?: any): any {
        return wbRpc('workbench/assistantSessions', { request: { limit: limit || 12 } });
    },
    assistantTranscript(sessionId?: any, limit?: any): any {
        return wbRpc('workbench/assistantTranscript', {
            request: { sessionId: sessionId || null, limit: limit || 40 },
        });
    },
    assistantHistory(): any {
        return wbRpc('workbench/assistantHistory', {});
    },
    assistantReset(): any {
        return wbRpc('workbench/assistantReset', {});
    },
    analysisRetry(entryId?: string): any { return settle(wbRpc('workbench/analysisRetry', {entryId}), '已加入重试队列') },
    analysisCancel(entryId?: string): any { return settle(wbRpc('workbench/analysisCancel', {entryId}), '已取消分析') },
    analysisStatus(): any {
        return wbRpc('workbench/analysisStatus', {});
    },
    analyzeRun(limit?: any, onlyIds?: string[]): any {
        return wbRpc('workbench/analysisStart', { request: { limit: limit || wbStore.get().data?.settings?.aiExtract?.batchSize || 5, onlyIds: onlyIds || [] } });
    },
    /** TODO 20：对指定资讯批量生成四段摘要（读原文 → 模型 → 写回卡片）。 */
    radarSummarize(onlyIds?: any, retryFailed?: boolean): any {
        return wbRpc('workbench/radarSummaryStart', { request: { onlyIds: onlyIds || [], retryFailed: retryFailed === true } });
    },
    exportMigration(): any {
        return wbRpc('workbench/exportMigration', {});
    },
    importMigration(payload?: any, mode?: any, dryRun?: any, mapPaths?: any): any {
        return wbRpc('workbench/importMigration', { request: { payload: payload, mode: mode, dryRun: dryRun === true, mapPaths: mapPaths || {} } });
    },
    analyzeConfirm(entryId?: any): any {
        return settle(wbRpc('workbench/analyzeConfirm', { entryId: entryId }), '已按分析登记待办');
    },
    automationRun(): any {
        return wbRpc('workbench/automationRun', {});
    },
    /** TODO 16：人工推进回复阶段（AI 不得覆盖人工设置）。 */
    setReplyStage(id?: any, stage?: any): any {
        return settle(wbRpc('workbench/setReplyStage', { id: id, stage: stage }), '回复阶段：' + stage);
    },
    taskMarkHuman(id?: any, mark?: any): any {
        return settle(wbRpc('workbench/taskMarkHuman', { id: id, mark: mark || {} }), '已记录人工处置');
    },
    automationStatus(): any {
        return wbRpc('workbench/automationStatus', {});
    },
    backup(): any {
        return wbRpc('workbench/backup', {});
    },
    backups(): any {
        return wbRpc('workbench/backups', {});
    },
    restoreBackup(id?: any): any {
        return settle(wbRpc('workbench/restoreBackup', { id: id }), '已从备份恢复');
    },
    diagnostics(): any {
        return wbRpc('workbench/diagnostics', {});
    },
};

WB.ICONS = Object.keys(WB_ICON_PATHS);

/* --------------------------------------------------------- task presentation */
/** Open the shared task form for an existing task (or null to create one). */
WB.openTaskForm = function (task?: any, defaults?: any): any {
    wbStore.set({ assistantOpen:false, contextHidden:false, taskForm: { open: true, task: task || null, defaults: defaults || null } });
};

/** Jump to the task center with one task selected. */
WB.focusTask = function (id?: any): any {
    wbStore.set({ page: 'tasks', focusTaskId: id });
};

WB.TASK_STATUS = {
    draft: { label: '草稿', tone: 'idle', order: 0 },
    ready: { label: '待处理', tone: 'accent', order: 1 },
    running: { label: '执行中', tone: 'warn', order: 2 },
    waiting_approval: { label: '待审批', tone: 'warn', order: 3 },
    completed: { label: '已完成', tone: 'ok', order: 4 },
    failed: { label: '失败', tone: 'err', order: 5 },
    cancelled: { label: '已取消', tone: 'idle', order: 6 },
};

WB.TASK_PRIORITY = {
    urgent: { label: '紧急', tone: 'err', rank: 4 },
    high: { label: '高', tone: 'warn', rank: 3 },
    normal: { label: '普通', tone: 'idle', rank: 2 },
    low: { label: '低', tone: 'idle', rank: 1 },
};

WB.RUN_STATUS = {
    queued: { label: '排队中', tone: 'idle' },
    running: { label: '运行中', tone: 'warn' },
    waiting_approval: { label: '待审批', tone: 'warn' },
    completed: { label: '已完成', tone: 'ok' },
    failed: { label: '失败', tone: 'err' },
    cancelled: { label: '已取消', tone: 'idle' },
};

/** Unknown auth states must never render as "connected". */
WB.connectorState = function (authState?: any): any {
    if (WB.CONNECTOR_STATE[authState])
        return WB.CONNECTOR_STATE[authState];
    return { label: String(authState || '未知'), tone: 'idle', unknown: true };
};

WB.CONNECTOR_STATE = {
    ok: { label: '已连接', tone: 'ok' },
    unconfigured: { label: '未配置', tone: 'idle' },
    error: { label: '异常', tone: 'err' },
    unauthorized: { label: '待授权', tone: 'warn' },
};

WB.openTasks = function (data?: any): any {
    if (!data || !Array.isArray(data.tasks))
        return [];
    return data.tasks.filter(function (task?: any): any {
        return task.status !== 'completed' && task.status !== 'cancelled';
    });
};

WB.dueSoon = function (data?: any, hours?: any): any {
    const horizon = Date.now() + (hours || 48) * 3600 * 1000;
    return WB.openTasks(data).filter(function (task?: any): any {
        const due = task.dueAt || task.meetingStart ? new Date(task.dueAt || task.meetingStart).getTime() : null;
        return due !== null && !Number.isNaN(due) && due <= horizon;
    });
};

WB.taskCounts = function (data?: any): any {
    const counts: any = { total: 0, open: 0, overdue: 0, today: 0, completed: 0, running: 0 };
    const tasks = (data && data.tasks) || [];
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    tasks.forEach(function (task?: any): any {
        counts.total += 1;
        if (task.status === 'completed')
            counts.completed += 1;
        else if (task.status === 'cancelled') {
            /* not counted as open */
        }
        else
            counts.open += 1;
        if (task.status === 'running')
            counts.running += 1;
        if ((task.dueAt || task.meetingStart) && task.status !== 'completed' && task.status !== 'cancelled') {
            const due = new Date(task.dueAt || task.meetingStart).getTime();
            if (!Number.isNaN(due)) {
                if (due < Date.now())
                    counts.overdue += 1;
                else if (due <= endOfDay.getTime())
                    counts.today += 1;
            }
        }
    });
    return counts;
};

/* ------------------------------------------------------------------- export */
WB.actions = wbActions;

WB.store = wbStore;

WB.useStore = useStore;

WB.useWorkbench = function (): any {
    return useStore();
};

/** 命令面板选中搜索结果后，把查询与分类交给搜索页。 */
WB.setSearchPreset = function (preset?: any): any {
    wbStore.set({ searchPreset: preset || null });
};

WB.clearSearchPreset = function (): any {
    wbStore.set({ searchPreset: null });
};

WB.toast = toast;

WB.assistant = assistant;

WB.assistantBrief = assistantBrief;

WB.pickDirectory = pickDirectory;

WB.setUiWorkspace = function (value?: any): any {
    wbUiWorkspace = value || null;
};

WB.setLayout = function (value?: any): any {
    wbLayout = value || null;
};

/** Bind the supported current Client sessions service; keep the legacy workspace adapter. */
WB.setNativeSessions = function(value:any): void { wbNativeSessions = value || null; };
/** Select the requested identity before switching panels; never report success for an unrelated chat. */
WB.openSessionById = function(sessionId?:string): boolean {
    if(!sessionId)return false;
    try {
        if(typeof wbNativeSessions?.open==='function')wbNativeSessions.open(sessionId);
        else if(typeof wbUiWorkspace?.openSession==='function')wbUiWorkspace.openSession(sessionId);
        else return false;
        return true;
    } catch { return false; }
};

/** 回到原生会话面板（助手把上下文复制到剪贴板后调用）。 */
WB.openConversation = function (): any {
    if (!wbLayout || typeof wbLayout.selectPanel !== 'function')
        return false;
    try {
        wbLayout.selectPanel(null);
        return true;
    }
    catch (e) {
        return false;
    }
};

WB.rpc = wbRpc;

WB.fmt = fmt;

WB.util = util;

WB.Icon = Icon;

WB.ui = {
    Panel: Panel,
    PageHead: PageHead,
    Stat: Stat,
    Btn: Btn,
    IconBtn: IconBtn,
    Badge: Badge,
    Chip: Chip,
    Field: Field,
    Input: Input,
    Textarea: Textarea,
    Select: Select,
    Toggle: Toggle,
    Segmented: Segmented,
    Tabs: Tabs,
    Empty: Empty,
    Spinner: Spinner,
    Progress: Progress,
    Kbd: Kbd,
    Modal: Modal,
    Divider: Divider,
};

WB.cn = function (): any {
    return Array.prototype.slice.call(arguments).filter(Boolean).join(' ');
};


export { h, T, WB, WB_CSS, wbStore, useStore, WB_DICT, wbTranslate, wbConnection, wbUiWorkspace, wbLayout, pickDirectory, wbRpc, wbToastSeq, toast, assistant, assistantBrief, wbPendingRequests, acceptSnapshot, settle, wbActions, WB_ICON_PATHS, Icon, Divider, Spinner, Btn, IconBtn, Badge, Chip, Panel, PageHead, Stat, Field, Input, Textarea, Select, Toggle, Segmented, Tabs, Empty, Progress, Kbd, Modal, parseDate, pad2, fmt, util }

export function setShared_wbConnection(value: any): any { return wbConnection = value }

export function setShared_wbTranslate(value: any): any { return wbTranslate = value }
