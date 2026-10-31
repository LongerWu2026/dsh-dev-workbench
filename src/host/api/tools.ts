import { officeToolDefinitions } from './office-tools.js'
import { RUN_STATUSES, TASK_PRIORITIES, TASK_STATUSES, auditEntry, ensureArray, normalizeRadarItem, taskBrief } from '../domain/model.js'
import { renderToolText, toolOutputSchema, toolText } from './tool-output.js'
import { findOperation, loadWorkbenchState, mutateWorkbenchState, recordOperation } from '../storage/state-store.js'
import { asString, hashText } from '../platform/runtime.js'
import { applyCreateTask, applyRecordRun, applyUpdateTask, workbenchCtx } from '../application/workbench-service.js'
import { runRadarFetch } from '../news/discovery.js'
import { syncYunzhijiaMessages } from '../integrations/yunzhijia.js'
import { runUnifiedSearch } from '../search/unified-search.js'

function taskLine(task?: any): any {
    const due = task.dueAt ? ' · 截止 ' + task.dueAt.slice(0, 16).replace('T', ' ') : '';
    const project = task.projectId ? ' · 项目 ' + task.projectId : '';
    return '- [' + task.status + '] ' + task.title + ' (id=' + task.id + ')' + due + project;
}

function workbenchToolDefinitions(): any {
    return [
        ...officeToolDefinitions(),
        {
            name: 'workbench_list_tasks',
            description: '列出智能工作台里的待办。用它回答“我今天还有什么没做”“哪些任务逾期”“某项目的待办有哪些”。' +
                '默认只返回未完成（不是 completed/cancelled）的任务，按优先级与截止时间排序。' +
                '返回里的每个任务都带 id，需要修改时把该 id 传给 workbench_update_task。',
            parameters: {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        enum: TASK_STATUSES,
                        description: '只看某个状态；省略表示所有未完成状态。',
                    },
                    includeCompleted: {
                        type: 'boolean',
                        description: '为 true 时连已完成与已取消一起返回（默认 false）。',
                    },
                    limit: {
                        type: 'number',
                        description: '最多返回多少条，默认 20，上限 100。',
                    },
                },
                additionalProperties: false,
            },
            output: { schema: toolOutputSchema(), render: renderToolText },
            async execute(args?: any): Promise<any> {
                const input = args && typeof args === 'object' ? args : {};
                const state = loadWorkbenchState();
                const limit = Math.max(1, Math.min(100, Number(input.limit) || 20));
                const tasks = ensureArray(state.tasks)
                    .filter(function (task?: any): any {
                    if (input.status)
                        return task.status === input.status;
                    if (input.includeCompleted === true)
                        return true;
                    return task.status !== 'completed' && task.status !== 'cancelled';
                })
                    .sort(function (a?: any, b?: any): any {
                    const rank: any = { urgent: 4, high: 3, normal: 2, low: 1 };
                    const priority = (rank[b.priority] || 0) - (rank[a.priority] || 0);
                    if (priority !== 0)
                        return priority;
                    const left = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
                    const right = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
                    return left - right;
                })
                    .slice(0, limit);
                if (tasks.length === 0) {
                    return { text: '工作台当前没有匹配的待办。', count: 0 };
                }
                const header = '共 ' + tasks.length + ' 条待办：';
                return {
                    text: header + '\n' + tasks.map(taskLine).join('\n'),
                    count: tasks.length,
                };
            },
        },
        {
            name: 'workbench_create_task',
            description: '在智能工作台新建一条待办。当用户说“记一下”“帮我建个待办”“把这个加进任务中心”时使用。' +
                '标题必填，其余字段可省略。不要把用户没有提到的截止时间或负责人编造出来：' +
                '不确定就留空，让用户在任务中心补。',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: '一句话说清要做的事。' },
                    description: { type: 'string', description: '背景、期望结果、链接；保留原始上下文。' },
                    priority: { type: 'string', enum: TASK_PRIORITIES, description: '默认 normal。' },
                    dueAt: { type: 'string', description: 'ISO 8601 时间；用户没有明确期限时不要填。' },
                    tags: { type: 'array', items: { type: 'string' }, description: '最多 12 个短标签。' },
                    projectId: { type: 'string', description: '已存在的项目 id；不确定就省略。' },
                    eventType: {type:'string',enum:['meeting','feature','logging','other']},
                    deliverable: {type:'string'}, meetingStart:{type:'string'}, meetingEnd:{type:'string'}, meetingLocation:{type:'string'}, registrationTarget:{type:'string'},
                    idempotencyKey: {
                        type: 'string',
                        description: '可选幂等键：同一个键重复调用只会创建一次（用于网络重试或模型重复调用）。' +
                            '建议用「意图 + 目标」的稳定字符串，例如 "create-task:压测结论"（不要用随机值）。',
                    },
                },
                required: ['title'],
                additionalProperties: false,
            },
            output: { schema: toolOutputSchema(), render: renderToolText },
            async execute(args?: any): Promise<any> {
                const input = args && typeof args === 'object' ? args : {};
                if (!asString(input.title, 200))
                    throw new Error('title 不能为空');
                const rawKey = asString(input.idempotencyKey, 160);
                const key = rawKey ? 'workbench_create_task:' + hashText(rawKey) : '';
                if (key) {
                    const previous = findOperation(loadWorkbenchState(), key);
                    if (previous && previous.entityIds.length > 0) {
                        return {
                            text: '幂等命中：' + key + ' 之前已创建（taskId=' + previous.entityIds[0] + '），本次未重复创建。',
                            taskId: previous.entityIds[0],
                            idempotent: true,
                        };
                    }
                }
                let createdId: string | undefined; let idempotent = false;
                const result = await mutateWorkbenchState(function (current?: any): any {
                    const previous = key && findOperation(current,key);
                    if (previous) {createdId=previous.entityIds[0];idempotent=true;return current}
                    const applied = applyCreateTask(current, Object.assign({}, input));
                    createdId = applied.entity.id;
                    if (key)
                        recordOperation(current, { key: key, tool: 'workbench_create_task', entityIds: [applied.entity.id] });
                    auditEntry(current, 'task.created', applied.entity.title + '（来自 Agent 工具）');
                    return current;
                });
                const created = result.tasks.find((row:any)=>row.id===createdId);
                if (!created) throw new Error('该幂等操作对应的待办已被删除');
                return {
                    text: '已创建待办：' + created.title + ' (id=' + created.id + '，状态 ' + created.status + ')',
                    taskId: created.id,
                    idempotent,
                };
            },
        },
        {
            name: 'workbench_update_task',
            description: '修改智能工作台里的一条待办：状态、优先级、截止时间、标题、描述、标签或事件字段。需要 id —— 先用 ' +
                'workbench_list_tasks 拿到。只传用户要求修改的字段，不重复发送或猜测其他字段。用户说“这个做完了”就把 status 设为 completed。',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: '待办 id。' },
                    status: { type: 'string', enum: TASK_STATUSES },
                    priority: { type: 'string', enum: TASK_PRIORITIES },
                    dueAt: { type: 'string', description: 'ISO 8601；传空字符串表示清除截止时间。' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' }, description: '完整标签数组；保留标签内的空格，空数组清除标签。' },
                    assignee: { type: 'string' },
                    eventType: {type:'string',enum:['meeting','feature','logging','other']},
                    deliverable: {type:'string'}, meetingStart:{type:'string'}, meetingEnd:{type:'string'}, meetingLocation:{type:'string'}, registrationTarget:{type:'string'},

                },
                required: ['id'],
                additionalProperties: false,
            },
            output: { schema: toolOutputSchema(), render: renderToolText },
            async execute(args?: any): Promise<any> {
                const input = args && typeof args === 'object' ? args : {};
                if (!asString(input.id, 100))
                    throw new Error('id 不能为空');
                const patch = Object.assign({}, input);
                delete patch.id;
                if (patch.dueAt === '')
                    patch.dueAt = null;
                const state = await mutateWorkbenchState(function (current?: any): any {
                    const applied = applyUpdateTask(current, input.id, patch);
                    auditEntry(current, 'task.updated', applied.entity.title + ' → ' + applied.entity.status + '（来自 Agent 工具）');
                    return current;
                });
                const updated = state.tasks.find(function (task?: any): any {
                    return task.id === input.id;
                });
                return { text: '已更新：' + taskLine(updated), taskId: input.id };
            },
        },
        {
            name: 'workbench_record_run',
            description: '把一次 Agent 执行的结果登记到智能工作台“研发任务 → 办公与历史”，并在任务详情里留下执行记录。' +
                '分析、诊断、代码审查这类工作完成后调用，让用户能在 UI 里回看结论与证据。' +
                'evidence 里每条都要是可以回跳的来源（文件、URL 或报告章节）。',
            parameters: {
                type: 'object',
                properties: {
                    taskId: { type: 'string', description: '关联的待办 id；纯探索可以不填。' },
                    status: {
                        type: 'string',
                        enum: RUN_STATUSES,
                        description: '本次执行的最终状态，通常是 completed 或 failed。',
                    },
                    summary: { type: 'string', description: '一到三句话说明做了什么、结论是什么。' },
                    idempotencyKey: { type: 'string', description: '可选幂等键：同一个键重复调用只登记一次。' },
                    profile: { type: 'string', description: '逻辑 Agent 角色，如 Coding Agent / Research Agent。' },
                    sessionId: { type: 'string', description: '关联会话 id，便于回跳。' },
                    evidence: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: { label: { type: 'string' }, url: { type: 'string' } },
                            required: ['label'],
                        },
                    },
                    steps: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: { text: { type: 'string' } },
                            required: ['text'],
                        },
                    },
                },
                required: ['status', 'summary'],
                additionalProperties: false,
            },
            output: { schema: toolOutputSchema(), render: renderToolText },
            async execute(args?: any, exec?: any): Promise<any> {
                const input = args && typeof args === 'object' ? args : {};
                const payload = Object.assign({}, input);
                const rawRunKey = asString(input.idempotencyKey, 160);
                const runKey = rawRunKey ? 'workbench_record_run:' + hashText(rawRunKey) : '';
                if (runKey) {
                    const previous = findOperation(loadWorkbenchState(), runKey);
                    if (previous && previous.entityIds.length > 0) {
                        return {
                            text: '幂等命中：' + runKey + ' 之前已登记（runId=' + previous.entityIds[0] + '），本次未重复登记。',
                            runId: previous.entityIds[0],
                            idempotent: true,
                        };
                    }
                }
                if (!payload.sessionId && exec && exec.agent && exec.agent.session && exec.agent.session.id) {
                    payload.sessionId = String(exec.agent.session.id);
                }
                let recordedId: string | undefined; let idempotent = false;
                const state = await mutateWorkbenchState(function (current?: any): any {
                    const previous = runKey && findOperation(current,runKey);
                    if (previous) {recordedId=previous.entityIds[0];idempotent=true;return current}
                    const applied = applyRecordRun(current, payload);
                    recordedId = applied.entity.id;
                    if (runKey)
                        recordOperation(current, { key: runKey, tool: 'workbench_record_run', entityIds: [applied.entity.id] });
                    auditEntry(current, 'agent.run.created', applied.entity.summary || applied.entity.id);
                    return current;
                });
                const run = state.runs.find((row:any)=>row.id===recordedId);
                if (!run) throw new Error('该幂等操作对应的执行记录已被删除');
                return { text: '已登记执行记录 ' + run.id + '（' + run.status + '）：' + run.summary, runId: run.id, idempotent };
            },
        },
        {
            name: 'workbench_fetch_radar',
            description: '按关注主题联网发现资讯；已配置 RSS/Atom 时读取订阅源。' +
                '用户说“抓一下最新的技术资讯”“刷新雷达”，或用户设置了每日提醒让你更新雷达时调用。' +
                '返回真实来源、ID、时间及逐路结果；摘要可交给 workbench_summarize_radar 在后台生成。' +
                '这个工具只采集原始条目和原文摘录，不生成 AI 摘要——如需摘要，读完原文后自己归纳，' +
                '把结论用 workbench_record_run 写回，并附来源链接。',
            parameters: {
                type: 'object',
                properties: {},
                additionalProperties: false,
            },
            output: { schema: toolOutputSchema(), render: renderToolText },
            async execute(): Promise<any> {
                const state = await runRadarFetch(workbenchCtx);
                const report = state.lastRadarFetch || {};
                if (!report.perFeed || report.perFeed.length === 0) {
                    return { text: '技术雷达：' + (report.note || '没有可用的抓取结果。') };
                }
                const lines = report.perFeed.map(function (row?: any): any {
                    return ('- ' +
                        row.label +
                        '：' +
                        (row.status === 'ok'
                            ? '新增 ' + row.added + ' 条，跳过 ' + row.skipped + ' 条'
                            : row.status + (row.note ? '（' + row.note + '）' : '')));
                });
                return {
                    text: '技术雷达抓取完成：新增 ' + (report.added || 0) + ' 条，跳过 ' + (report.skipped || 0) + ' 条。\n' +
                        lines.join('\n') +
                        '\n可在工作台的「今日简报 → 技术雷达」查看。',
                };
            },
        },
        {
            name: 'workbench_fetch_mentions',
            description: '通过云之家 CLI（yzj-cli）拉取 @我 的消息，作为待办来源证据存入工作台。' +
                '用户说“看看有没有人@我”“拉一下@我的消息”时调用。' +
                '只做确定性采集：把消息原文、所在群、时间存为来源（SourceRef），不自动创建待办——' +
                '是否生成待办、标题和截止时间怎么定，由你在会话里分析后决定（可用 workbench_create_task 并带 sourceRef）' +
                '或交回用户。云之家未配置或 token 失效时如实报告，不要编造。',
            parameters: {
                type: 'object',
                properties: {},
                additionalProperties: false,
            },
            output: { schema: toolOutputSchema(), render: renderToolText },
            async execute(): Promise<any> {
                const state = await syncYunzhijiaMessages(workbenchCtx);
                const report = state.lastMentionsFetch || {};
                if (report.status !== 'ok') {
                    return { text: '@我 拉取未完成：' + (report.note || report.status) };
                }
                const lines: any = [];
                for (const source of ensureArray(state.sources).slice(-Math.max(report.added, 0))) {
                    if (source.provider !== 'yunzhijia')
                        continue;
                    lines.push('- [' + source.title + '] ' + source.excerpt.slice(0, 80));
                }
                return {
                    text: '云之家 @我 检索完成：发现 ' + (report.found || 0) + ' 条，新增来源 ' + (report.added || 0) + ' 条。' +
                        (report.note ? '\n' + report.note : '') +
                        (lines.length > 0 ? '\n新增：\n' + lines.join('\n') : '\n没有新增（此前已采集过）。') +
                        '\n要分析这些消息时，用 workbench_task_brief 或直接读来源证据。',
                };
            },
        },
        {
            name: 'workbench_update_radar',
            description: '把四段摘要写回一条技术雷达资讯：技术变化 / 应用场景 / 采用风险 / 推荐实践。' +
                '先用 workbench_fetch_radar 抓取（或联网发现）拿到条目 id，读原文后再归纳并调用本工具。' +
                '每条结论都应来自原文，不要凭标题猜测；无法确认的段落留空。',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: '资讯 id（来自抓取报告或快照）。' },
                    change: { type: 'string', description: '技术变化：这次变化的关键事实。' },
                    usage: { type: 'string', description: '应用场景：适合用在哪里。' },
                    risk: { type: 'string', description: '采用风险：可能踩的坑。' },
                    practice: { type: 'string', description: '推荐实践：怎么落地。' },
                },
                required: ['id'],
                additionalProperties: false,
            },
            output: { schema: toolOutputSchema(), render: renderToolText },
            async execute(args?: any): Promise<any> {
                const input = args && typeof args === 'object' ? args : {};
                if (!asString(input.id, 100))
                    throw new Error('id 不能为空');
                if (!input.change && !input.usage && !input.risk && !input.practice) {
                    throw new Error('至少填写一段摘要（change / usage / risk / practice）');
                }
                const state = await mutateWorkbenchState(function (current?: any): any {
                    const item = ensureArray(current.radar).find(function (row?: any): any {
                        return row.id === input.id;
                    });
                    if (!item)
                        throw new Error('找不到该资讯：' + input.id);
                    const index = current.radar.indexOf(item);
                    const next = normalizeRadarItem({
                        summary: {
                            change: asString(input.change, 800),
                            usage: asString(input.usage, 800),
                            risk: asString(input.risk, 800),
                            practice: asString(input.practice, 800),
                        },
                    }, item);
                    next.id = item.id;
                    next.createdAt = item.createdAt;
                    current.radar = current.radar.slice();
                    current.radar[index] = next;
                    auditEntry(current, 'radar.summary', next.title + '（来自 Agent 工具）');
                    return current;
                });
                const updated = ensureArray(state.radar).find(function (row?: any): any {
                    return row.id === input.id;
                });
                return { text: '已写回摘要：' + updated.title + '（' + updated.url + '）', radarId: updated.id };
            },
        },
        {
            name: 'workbench_search',
            description: '统一检索工作台的多路来源（待办 / 知识 / 雷达 / 来源证据 / 本地项目 / 企业云之家 / PR·CI / 互联网），' +
                '返回按来源分组的结果与每路状态。回答用户问题时先用它取证据，再在回答里给出处；' +
                '某一路 status 不是 ok 时要如实说明该路不可用，不要把「没查到」说成「不存在」。',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: '检索词。' },
                    includeWeb: { type: 'boolean', description: '是否查互联网（默认 true）。' },
                },
                required: ['query'],
                additionalProperties: false,
            },
            output: { schema: toolOutputSchema(), render: renderToolText },
            async execute(args?: any): Promise<any> {
                const input = args && typeof args === 'object' ? args : {};
                const result = await runUnifiedSearch(workbenchCtx, {
                    query: input.query,
                    includeWeb: input.includeWeb !== false,
                });
                const lines: any = [];
                for (const group of result.groups) {
                    lines.push('## ' + group.label + '（' + group.status + '，' + group.items.length + ' 条）');
                    if (group.note)
                        lines.push('说明：' + group.note);
                    for (const item of group.items.slice(0, 6)) {
                        const ref = item.url ? ' — ' + item.url : '';
                        lines.push('- ' + item.title + (item.snippet ? '｜' + item.snippet.slice(0, 80) : '') + ref);
                    }
                }
                return { text: '检索「' + input.query + '」共 ' + result.total + ' 条：\n' + lines.join('\n') };
            },
        },
        {
            name: 'workbench_task_brief',
            description: '把一条待办连同它的来源证据渲染成可直接用作提示词的任务简报。' +
                '需要上下文（背景、来源、期望产出）时先调用它，再开始分析。',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: '待办 id。' },
                },
                required: ['id'],
                additionalProperties: false,
            },
            output: { schema: toolOutputSchema(), render: renderToolText },
            async execute(args?: any): Promise<any> {
                const input = args && typeof args === 'object' ? args : {};
                const state = loadWorkbenchState();
                const task = ensureArray(state.tasks).find(function (item?: any): any {
                    return item.id === input.id;
                });
                if (!task)
                    throw new Error('找不到该待办：' + String(input.id));
                const source = task.sourceRefId
                    ? ensureArray(state.sources).find(function (item?: any): any {
                        return item.id === task.sourceRefId;
                    })
                    : null;
                return { text: taskBrief(task, source) };
            },
        },
    ];
}


export { toolText, toolOutputSchema, renderToolText, taskLine, workbenchToolDefinitions }
