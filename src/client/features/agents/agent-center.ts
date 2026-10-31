import {BusyReply} from './BusyReply.js'
import { WorkflowPanel } from './WorkflowPanel.js'
import { DevelopmentPage } from './DevelopmentPage.js'
import { Badge, Btn, Divider, Empty, Field, Icon, IconBtn, Input, Modal, PageHead, Panel, Segmented, Select, T, Textarea, WB, h } from '../../core/runtime.js'
import * as React from 'react'
/* ============================================================================
 * dev-workbench page: Agent center
 *
 * Renders only what the Host persisted in `data.runs`: queue, status counts,
 * duration metrics, expanded step/evidence timelines and the approval area.
 * The page registers itself as `WB.pages.agents` and never executes anything
 * itself: mark-complete / mark-failed and "record a run" are Host actions.
 * ========================================================================== */
/* --------------------------------------------------------------- presentation */
function agentStatusMeta(status?: any): any {
    const meta = WB.RUN_STATUS[status];
    if (meta)
        return meta;
    return { label: status ? String(status) : '未知', tone: 'idle' };
}
function agentFormatTime(value?: any): any {
    return value ? WB.fmt.datetime(value) : '—';
}
/* Duration in minutes for a finished run, or null when the record is open. */
function agentDurationMinutes(run?: any): any {
    if (!run || !run.startedAt || !run.endedAt)
        return null;
    const start = new Date(run.startedAt).getTime();
    const end = new Date(run.endedAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start)
        return null;
    return (end - start) / 60000;
}
function agentDurationText(minutes?: any): any {
    if (minutes === null || minutes === undefined)
        return '—';
    const value = Number(minutes);
    if (!Number.isFinite(value) || value < 0)
        return '—';
    if (value < 1)
        return Math.max(1, Math.round(value * 60)) + ' 秒';
    if (value < 60) {
        const rounded = Math.round(value * 10) / 10;
        return rounded + ' 分钟';
    }
    const hours = Math.floor(value / 60);
    const rest = Math.round(value % 60);
    return hours + ' 小时' + (rest > 0 ? ' ' + rest + ' 分' : '');
}
function agentSortRuns(runs?: any): any {
    return (runs || []).slice().sort(function (a?: any, b?: any): any {
        const av = a && a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const bv = b && b.startedAt ? new Date(b.startedAt).getTime() : 0;
        const left = Number.isNaN(av) ? 0 : av;
        const right = Number.isNaN(bv) ? 0 : bv;
        return right - left;
    });
}
function agentRunAverage(runs?: any): any {
    const durations: any = [];
    (runs || []).forEach(function (run?: any): any {
        const minutes = agentDurationMinutes(run);
        if (minutes !== null)
            durations.push(minutes);
    });
    if (!durations.length)
        return { minutes: null, count: 0 };
    let total = 0;
    durations.forEach(function (value?: any): any {
        total += value;
    });
    return { minutes: total / durations.length, count: durations.length };
}
/* Task title by id; the raw id is the honest fallback. */
function agentTaskTitle(tasks?: any, taskId?: any): any {
    if (!taskId)
        return null;
    const list = tasks || [];
    for (let index = 0; index < list.length; index += 1) {
        const task = list[index];
        if (task && task.id === taskId)
            return task.title || task.id;
    }
    return String(taskId);
}
function agentPriorityRank(priority?: any): any {
    const meta = WB.TASK_PRIORITY[priority] || WB.TASK_PRIORITY.normal;
    return meta.rank;
}
/* Plain-text task brief used by "复制任务简报". */
function agentBriefMarkdown(data?: any): any {
    const open = WB.openTasks(data);
    const counts = WB.taskCounts(data);
    const lines: any = [];
    lines.push('# 任务简报 · ' + WB.fmt.datetime(WB.util.nowIso()));
    lines.push('');
    lines.push('未完成 ' + open.length + ' 项 · 逾期 ' + counts.overdue + ' 项 · 今日到期 ' + counts.today + ' 项');
    lines.push('');
    if (!open.length) {
        lines.push('当前没有未完成的任务。');
        return lines.join('\n');
    }
    const projects: any = {};
    const projectList = data && Array.isArray(data.projects) ? data.projects : [];
    projectList.forEach(function (project?: any): any {
        if (project && project.id)
            projects[project.id] = project.name;
    });
    const ranked = open.slice().sort(function (a?: any, b?: any): any {
        const rankDiff = agentPriorityRank(b.priority) - agentPriorityRank(a.priority);
        if (rankDiff !== 0)
            return rankDiff;
        const at = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
        const bt = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
        const left = Number.isNaN(at) ? Infinity : at;
        const right = Number.isNaN(bt) ? Infinity : bt;
        return left - right;
    });
    ranked.forEach(function (task?: any, index?: any): any {
        const status = WB.TASK_STATUS[task.status] || { label: task.status || '未知' };
        const priority = WB.TASK_PRIORITY[task.priority] || { label: task.priority || '普通' };
        lines.push('## ' + (index + 1) + '. ' + (task.title || '(无标题)'));
        lines.push('- 状态：' + status.label + ' · 优先级：' + priority.label);
        if (task.projectId && projects[task.projectId])
            lines.push('- 项目：' + projects[task.projectId]);
        if (task.dueAt) {
            const due = WB.fmt.due(task.dueAt);
            lines.push('- 截止：' + WB.fmt.datetime(task.dueAt) + '（' + due.text + '）');
        }
        if (Array.isArray(task.tags) && task.tags.length)
            lines.push('- 标签：' + task.tags.join('、'));
        if (task.description) {
            lines.push('');
            lines.push(String(task.description));
        }
        lines.push('');
    });
    return lines.join('\n');
}
/* ------------------------------------------------------------------ run row */
function agentRunRow(props?: any): any {
    const run = props.run;
    if (!run)
        return null;
    const meta = agentStatusMeta(run.status);
    const expanded = !!props.expanded;
    const minutes = agentDurationMinutes(run);
    const title = agentTaskTitle(props.tasks, run.taskId) || WB.util.truncate(String(run.summary || '').split('\n')[0], 80) || '通用执行记录';
    const steps = Array.isArray(run.steps) ? run.steps : [];
    const evidence = Array.isArray(run.evidence) ? run.evidence : [];
    const toggleLabel = expanded ? '收起执行详情' : '展开执行详情';
    const detail = expanded
        ? h('div', {
            style: {
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '2px 0 12px 26px',
                minWidth: 0,
            },
        }, h('div', {
            className: 'wb-tiny',
            style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.6 },
        }, run.summary ? String(run.summary) : '（该记录没有填写摘要）'), h(Divider, null), h('div', { className: 'wb-tiny wb-muted', style: { fontWeight: 600 } }, '步骤时间线'), steps.length
            ? h('div', { className: 'wb-stack', style: { gap: 6 } }, steps.map(function (step?: any, index?: any): any {
                const at = step && step.at ? WB.fmt.datetime(step.at) : '—';
                return h('div', { key: 'step-' + index, style: { display: 'flex', gap: 8, alignItems: 'flex-start' } }, h('span', { className: 'wb-mono wb-muted', style: { flex: '0 0 128px', fontSize: 10.5 } }, at), h('span', {
                    style: {
                        flex: '0 0 6px',
                        width: 6,
                        height: 6,
                        marginTop: 6,
                        borderRadius: '50%',
                        background: T.accent,
                    },
                }), h('span', {
                    className: 'wb-tiny',
                    style: { minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
                }, String((step && step.text) || '')));
            }))
            : h('div', { className: 'wb-tiny wb-muted' }, '这条记录没有步骤明细'), h('div', { className: 'wb-tiny wb-muted', style: { fontWeight: 600 } }, '证据与链接'), evidence.length
            ? h('div', { className: 'wb-stack', style: { gap: 4 } }, evidence.map(function (item?: any, index?: any): any {
                const label = (item && item.label) || (item && item.url) || '证据 ' + (index + 1);
                if (item && item.url) {
                    return h('a', {
                        key: 'ev-' + index,
                        className: 'wb-link wb-tiny',
                        href: item.url,
                        target: '_blank',
                        rel: 'noreferrer',
                        style: { overflowWrap: 'anywhere' },
                    }, String(label));
                }
                return h('span', { key: 'ev-' + index, className: 'wb-tiny wb-muted' }, String(label));
            }))
            : h('div', { className: 'wb-tiny wb-muted' }, '这条记录没有关联证据'), h('div', { className: 'wb-row wb-tiny wb-muted wb-row--wrap', style: { gap: 12 } }, h('span', null, '开始：' + agentFormatTime(run.startedAt)), h('span', null, '结束：' + agentFormatTime(run.endedAt)), h('span', null, 'session：' + (run.sessionId || '未记录')), h('span', null, 'profile：' + (run.profile || '—')), h('span', { className: 'wb-mono' }, 'run id：' + run.id)))
        : null;
    return h('div', { className: 'wb-item wb-office-run-row', style: { flexDirection: 'column', alignItems: 'stretch' } }, h('div', { className: 'wb-row wb-office-run-main', style: { gap: 8, alignItems: 'flex-start', width: '100%' } }, h('button', {
        type: 'button',
        className: 'wb-item-main',
        onClick: props.onToggle,
        'aria-expanded': expanded ? 'true' : 'false',
        'aria-label': toggleLabel,
        title: toggleLabel,
        style: {
            display: 'block',
            minWidth: 0,
            padding: 0,
            border: 0,
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
        },
    }, h('span', { className: 'wb-row', style: { gap: 6, flexWrap: 'wrap' } }, h(Icon, { name: expanded ? 'chevronDown' : 'chevronRight', size: 13 }), h('span', { className: 'wb-item-title' }, title), h(Badge, { tone: meta.tone }, meta.label)), h('span', { className: 'wb-item-sub' }, h('span', null, agentFormatTime(run.startedAt)), minutes !== null ? h('span', null, '耗时 ' + agentDurationText(minutes)) : null)), h('div', { style: { display: 'flex', alignItems: 'center', gap: 4, flex: 'none' } }, h(Btn, {
        size: 'sm',
        icon: 'check',
        disabled: run.status === 'completed',
        title: '把这条记录标记为已完成',
        onClick: function (): any {
            props.onMark(run, 'completed');
        },
        children: '完成',
    }), h(Btn, {
        size: 'sm',
        kind: 'danger',
        icon: 'xCircle',
        disabled: run.status === 'failed',
        title: '把这条记录标记为失败',
        onClick: function (): any {
            props.onMark(run, 'failed');
        },
        children: '失败',
    }), h(IconBtn, {
        name: 'edit',
        label: '编辑这条执行记录',
        onClick: function (): any {
            props.onEdit(run);
        },
    }), h(IconBtn, {
        name: 'trash',
        label: '删除这条执行记录',
        onClick: function (): any {
            if (!window.confirm('删除这条执行记录？任务本身保留，只是解除关联。'))
                return;
            WB.actions.deleteRun(run.id).catch(function (): any { });
        },
    }))), detail);
}
/* --------------------------------------------------------------------- page */
function agentPage(): any {
    const wbState = WB.useStore();
    const data = wbState && wbState.data ? wbState.data : null;
    const runs = data && Array.isArray(data.runs) ? data.runs : [];
    const tasks = data && Array.isArray(data.tasks) ? data.tasks : [];
    const [filter, setFilter] = React.useState<any>('all');
    const [expanded, setExpanded] = React.useState<any>({});
    const [recordOpen, setRecordOpen] = React.useState<any>(false);
    const [editingRunId, setEditingRunId] = React.useState<any>(null);
    const [draft, setDraft] = React.useState<any>(function (): any {
        return { taskId: '', status: 'completed', profile: '', summary: '', sessionId: '', startedAt: '' };
    });
    const counts: any = { running: 0, waiting: 0, completed: 0, failed: 0, queued: 0, executing: 0 };
    runs.forEach(function (run?: any): any {
        if (!run)
            return;
        if (run.status === 'running' || run.status === 'queued')
            counts.running += 1;
        if (run.status === 'queued')
            counts.queued = (counts.queued || 0) + 1;
        if (run.status === 'running')
            counts.executing = (counts.executing || 0) + 1;
        else if (run.status === 'waiting_approval')
            counts.waiting += 1;
        else if (run.status === 'completed')
            counts.completed += 1;
        else if (run.status === 'failed')
            counts.failed += 1;
    });
    const waiting = runs.filter(function (run?: any): any {
        return run && run.status === 'waiting_approval';
    });
    const average = agentRunAverage(runs);
    let visible = agentSortRuns(runs);
    if (filter === 'active') {
        visible = visible.filter(function (run?: any): any {
            return run.status === 'queued' || run.status === 'running';
        });
    }
    else if (filter !== 'all') {
        visible = visible.filter(function (run?: any): any {
            return run.status === filter;
        });
    }
    function patchDraft(patch?: any): any {
        setDraft(function (previous?: any): any {
            return Object.assign({}, previous, patch);
        });
    }
    function toggleRun(runId?: any): any {
        setExpanded(function (previous?: any): any {
            const next = Object.assign({}, previous);
            if (next[runId])
                delete next[runId];
            else
                next[runId] = true;
            return next;
        });
    }
    function markRun(run?: any, status?: any): any {
        if (!run || !run.id)
            return;
        const label = status === 'completed' ? '已完成' : '失败';
        WB.actions.updateRun(run.id, { status: status })
            .then(function (): any {
            WB.toast('执行记录已标记为' + label, 'ok');
        })
            .catch(function (): any {
            /* settle() already surfaced the Host error */
        });
    }
    function copyBrief(): any {
        const text = agentBriefMarkdown(data);
        WB.util.copy(text)
            .then(function (): any {
            WB.toast('任务简报已复制（' + WB.openTasks(data).length + ' 项未完成）', 'ok');
        })
            .catch(function (error?: any): any {
            WB.toast(String((error && error.message) || error), 'err');
        });
    }
    function openEditRun(run?: any): any {
        if (!run || !run.id)
            return;
        setEditingRunId(run.id);
        setDraft({
            taskId: run.taskId || '',
            status: run.status || 'completed',
            profile: run.profile || '',
            summary: run.summary || '',
            sessionId: run.sessionId || '',
            startedAt: WB.fmt.toLocalInput(run.startedAt),
        });
        setRecordOpen(true);
    }
    function closeRecord(): any {
        setRecordOpen(false);
        setEditingRunId(null);
        setDraft({ taskId: '', status: 'completed', profile: '', summary: '', sessionId: '', startedAt: '' });
    }
    function submitRecord(): any {
        const input: any = { status: draft.status };
        if (draft.taskId)
            input.taskId = draft.taskId;
        const profile = String(draft.profile || '').trim();
        if (profile)
            input.profile = profile;
        const summary = String(draft.summary || '').trim();
        if (summary)
            input.summary = summary;
        const sessionId = String(draft.sessionId || '').trim();
        if (sessionId)
            input.sessionId = sessionId;
        const startedAt = WB.fmt.fromLocalInput(draft.startedAt);
        if (startedAt)
            input.startedAt = startedAt;
        const action = editingRunId
            ? WB.actions.updateRun(editingRunId, input)
            : WB.actions.recordRun(input);
        action
            .then(function (): any {
            if (editingRunId)
                WB.toast('执行记录已更新', 'ok');
            closeRecord();
        })
            .catch(function (): any {
            /* Host error is already toasted */
        });
    }
    const taskOptions = [{ value: '', label: '不关联任务（通用记录）' }].concat(tasks.map(function (task?: any): any {
        return { value: task.id, label: WB.util.truncate(task.title || task.id, 48) };
    }));
    const statusOptions = Object.keys(WB.RUN_STATUS).map(function (key?: any): any {
        return { value: key, label: WB.RUN_STATUS[key].label };
    });
    const approval = waiting.length ? h('details', { className: 'wb-office-approvals' },
        h('summary', null, h(Icon, { name: 'lock', size: 13 }), '待审批标记', h(Badge, { tone: 'warn' }, String(waiting.length)), h('span', { className: 'wb-muted' }, '查看记录')),
        h('p', { className: 'wb-tiny wb-muted' }, '以下为历史记录标记，实际审批请回原会话完成。'),
        h('div', { className: 'wb-list' }, waiting.map(function (run?: any): any {
            return h('div', { key: run.id, className: 'wb-item' },
                h('div', { className: 'wb-item-main' }, h('div', { className: 'wb-item-title' }, agentTaskTitle(tasks, run.taskId) || WB.util.truncate(run.summary || '通用执行记录', 80)), h('div', { className: 'wb-item-sub' }, '开始 ' + agentFormatTime(run.startedAt))),
                h(Btn, { size: 'sm', onClick: function (): any { setFilter('waiting_approval'); setExpanded(function (previous: any): any { return { ...previous, [run.id]: true }; }); }, children: '查看详情' }));
        }))) : null;
    const overview = h('div', { className: 'wb-office-run-overview' },
        h('div', { className: 'wb-office-run-filters', role: 'group', 'aria-label': '筛选执行记录' }, [
            { value: 'all', label: '全部', count: runs.length },
            { value: 'active', label: '进行中', count: counts.running },
            { value: 'waiting_approval', label: '待审批', count: counts.waiting },
            { value: 'completed', label: '已完成', count: counts.completed },
            { value: 'failed', label: '失败', count: counts.failed },
        ].map(function (item): any {
            return h('button', { key: item.value, type: 'button', className: 'wb-office-run-filter' + (filter === item.value ? ' is-active' : ''), 'aria-pressed': filter === item.value, onClick: function (): any { setFilter(item.value); } }, item.label, h('span', null, item.count));
        })),
        h('span', { className: 'wb-tiny wb-muted wb-office-run-average', title: average.count ? '按 ' + average.count + ' 条具有开始和结束时间的记录计算' : '暂无可计算耗时的已结束记录' }, '平均耗时 ', h('strong', null, average.minutes === null ? '—' : agentDurationText(average.minutes))));
    const queue = h(Panel, {
        title: '历史执行记录',
        sub: runs.length > 0
            ? '共 ' + runs.length + ' 条记录 · 按开始时间倒序 · 点击一行展开详情'
            : '还没有执行记录',
        icon: 'play',
        actions: h('div', { className: 'wb-row wb-row--wrap' },
            h(Btn, { kind: 'primary', size: 'sm', icon: 'plus', onClick: function (): any { setRecordOpen(true); }, children: '登记执行记录' }),
            h(Btn, { size: 'sm', icon: 'copy', onClick: copyBrief, children: '复制任务简报' })),
    }, visible.length
        ? h('div', { className: 'wb-list' }, visible.map(function (run?: any): any {
            return h(agentRunRow, {
                key: run.id,
                run: run,
                tasks: tasks,
                expanded: !!expanded[run.id],
                onToggle: function (): any {
                    toggleRun(run.id);
                },
                onMark: markRun,
                onEdit: openEditRun,
            });
        }))
        : h(Empty, {
            icon: runs.length ? 'filter' : 'play',
            title: runs.length ? '当前筛选下没有执行记录' : '还没有登记过执行记录',
            hint: runs.length
                ? '切换到“全部”，或者换一个状态筛选。'
                : '执行发生在会话中；结束后在这里登记一条记录，任务与结果的关联就能被追溯。',
            action: runs.length
                ? null
                : h(Btn, {
                    kind: 'primary',
                    size: 'sm',
                    icon: 'plus',
                    onClick: function (): any {
                        setRecordOpen(true);
                    },
                    children: '登记执行记录',
                }),
        }));
    const recordModal = h(Modal, {
        open: recordOpen,
        title: editingRunId ? '编辑执行记录' : '登记执行记录',
        sub: editingRunId ? '修改摘要、状态或关联任务（会话里真正的执行过程不变）' : '只登记事实：真正的执行发生在会话里',
        onClose: function (): any {
            setRecordOpen(false);
        },
        footer: [
            h(Btn, {
                key: 'cancel',
                onClick: closeRecord,
                children: '取消',
            }),
            h(Btn, {
                key: 'save',
                kind: 'primary',
                icon: 'save',
                disabled: !!wbState.busy,
                onClick: submitRecord,
                children: editingRunId ? '保存修改' : '保存记录',
            }),
        ],
    }, h('div', { className: 'wb-stack', style: { gap: 10 } }, h(Field, { label: '关联任务', hint: '不选择表示这是一条通用执行记录' }, h(Select, {
        value: draft.taskId,
        options: taskOptions,
        onChange: function (event?: any): any {
            patchDraft({ taskId: event.target.value });
        },
    })), h(Field, { label: '状态' }, h(Select, {
        value: draft.status,
        options: statusOptions,
        onChange: function (event?: any): any {
            patchDraft({ status: event.target.value });
        },
    })), h(Field, { label: 'Profile', hint: '可选：执行所用 profile，例如 default / reviewer' }, h(Input, {
        value: draft.profile,
        placeholder: 'default',
        onChange: function (event?: any): any {
            patchDraft({ profile: event.target.value });
        },
    })), h(Field, {
        label: '开始时间',
        hint: '可选：留空则按当前时间登记，耗时约为 0，会拉低平均耗时；填写真实开始时间更有意义',
    }, h(Input, {
        type: 'datetime-local',
        value: draft.startedAt,
        onChange: function (event?: any): any {
            patchDraft({ startedAt: event.target.value });
        },
    })), h(Field, { label: 'Session ID', hint: '可选：关联会话 id，便于回到会话查看上下文' }, h(Input, {
        value: draft.sessionId,
        placeholder: '可选',
        onChange: function (event?: any): any {
            patchDraft({ sessionId: event.target.value });
        },
    })), h(Field, { label: '摘要' }, h(Textarea, {
        value: draft.summary,
        rows: 3,
        placeholder: '这次执行做了什么、结论是什么',
        onChange: function (event?: any): any {
            patchDraft({ summary: event.target.value });
        },
    })), h('p', { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.7 } }, '登记后可在执行队列里展开查看，并继续标记完成 / 失败；这里不会触发任何命令执行。')));
    return h('section', { className: 'wb-office-history', 'aria-label': '执行记录' }, overview, approval, queue, recordModal);
}
WB.pages.agents = DevelopmentPage;
WB.pages.office = function OfficePage(){
    const tab=WB.useStore().officeView||'workflows',setTab=(officeView:string)=>WB.store.set({officeView});
    return h('div',{className:'wb-page'},h(PageHead,{icon:'layers',title:'智能办公',sub:'整理回复、生成工作报告，跟进办公流程与产物。',actions:h(BusyReply)}),h(Segmented,{value:tab,onChange:setTab,items:[{value:'workflows',label:'办公流程'},{value:'history',label:'执行记录'}]}),tab==='workflows'?h('div',{style:{marginTop:20}},h(WorkflowPanel)):h(agentPage));
};

export { agentStatusMeta, agentFormatTime, agentDurationMinutes, agentDurationText, agentSortRuns, agentRunAverage, agentTaskTitle, agentPriorityRank, agentBriefMarkdown, agentRunRow, agentPage }
