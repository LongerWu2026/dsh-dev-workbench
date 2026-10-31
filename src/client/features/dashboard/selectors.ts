import { T, WB, h } from '../../core/runtime.js'

/* ============================================================================
 * dev-workbench — 今日简报 (dashboard)
 *
 * 首屏只回答一个问题：今天有哪些必须处理的事。顺序固定为
 * 待办统计 → 今日待办（可勾选完成）→ 技术雷达（关注主题过滤 + 收藏）
 * → 连接状态。所有数字来自 Host 快照，空集合一律渲染 <Empty>。
 *
 * Cross-module note: a stat card navigates to the task center with a
 * transient `taskPreset` store field ({status?, dueFilter?, view?}).
 * tasks/task-center.ts consumes it on mount and clears it. It is deliberately not
 * part of the public contract — nothing outside these two files reads it.
 * ========================================================================== */
/* ------------------------------------------------------------------ helpers */
function dashStoreNavigate(preset?: any): any {
    WB.store.set({ page: 'tasks', taskPreset: preset || null });
}

function dashToneColor(tone?: any): any {
    if (tone === 'err')
        return T.err;
    if (tone === 'warn')
        return T.warn;
    if (tone === 'ok')
        return T.ok;
    if (tone === 'accent')
        return T.accent;
    return T.text2;
}

function dashPriorityOf(task?: any): any {
    return WB.TASK_PRIORITY[task.priority] || WB.TASK_PRIORITY.normal;
}

function dashDueValue(task?: any): any {
    const at = task.dueAt || task.meetingStart;
    if (!at)
        return Infinity;
    const value = new Date(at).getTime();
    return Number.isNaN(value) ? Infinity : value;
}

function dashEndOfToday(now=Date.now()): number {
    const local=new Date(now+8*3600000);
    return Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()+1)-8*3600000-1;
}

function dashOpenTasks(data?:any):any[] {
    return WB.openTasks(data).filter((task:any)=>!task.archivedAt);
}
function dashAddedToday(task:any,now=Date.now()):boolean {
    const created=Date.parse(task.createdAt||'');
    const end=dashEndOfToday(now);
    return Number.isFinite(created)&&created>=end-86400000+1&&created<=end;
}
/** Newly added tasks remain visible even without a deadline or high priority. */
function dashActionable(data?: any,now=Date.now()): any {
    const endOfDay = dashEndOfToday(now);
    return dashOpenTasks(data)
        .filter(function (task?: any): any {
        if (dashAddedToday(task,now)||task.priority === 'urgent' || task.priority === 'high')
            return true;
        return dashDueValue(task) <= endOfDay;
    })
        .sort(function (a?: any, b?: any): any {
        const addedA=dashAddedToday(a,now),addedB=dashAddedToday(b,now);
        if(addedA!==addedB)return addedA?-1:1;
        if(addedA&&addedB){const delta=Date.parse(b.createdAt)-Date.parse(a.createdAt);if(delta)return delta;}
        const ad = dashDueValue(a);
        const bd = dashDueValue(b);
        if (ad !== bd)
            return ad - bd;
        const ar = dashPriorityOf(a).rank || 0;
        const br = dashPriorityOf(b).rank || 0;
        if (ar !== br)
            return br - ar;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
}

function dashEarliestOverdue(data?: any): any {
    let earliest: any = null;
    dashOpenTasks(data).forEach(function (task?: any): any {
        const value = dashDueValue(task);
        if (value === Infinity || value >= Date.now())
            return;
        if (earliest === null || value < earliest)
            earliest = value;
    });
    return earliest === null ? null : new Date(earliest).toISOString();
}

function dashStaleInfo(data?: any): any {
    if (!data || !data.updatedAt)
        return null;
    const settings = data.settings || {};
    const raw = Number(settings.staleHours);
    const staleHours = Number.isFinite(raw) && raw > 0 ? raw : 24;
    const updated = new Date(data.updatedAt).getTime();
    if (Number.isNaN(updated))
        return null;
    if (Date.now() - updated <= staleHours * 3600 * 1000)
        return null;
    return { staleHours: staleHours, updatedAt: data.updatedAt };
}

function dashProjectName(data?: any, projectId?: any): any {
    if (!projectId)
        return '';
    const projects = (data && data.projects) || [];
    for (let index = 0; index < projects.length; index += 1) {
        if (projects[index].id === projectId)
            return projects[index].name || '';
    }
    return '';
}

function dashTagPill(topic?: any, key?: any): any {
    return h('span', {
        key: key,
        style: {
            display: 'inline-flex',
            alignItems: 'center',
            height: 17,
            padding: '0 6px',
            borderRadius: 999,
            border: '1px solid ' + T.border1,
            background: T.layer2,
            color: T.text2,
            fontSize: 10.5,
            lineHeight: 1,
            whiteSpace: 'nowrap',
        },
    }, topic);
}

/* ------------------------------------------------------------- dashboard UI */
/** 回复阶段的展示色。 */
function replyStageTone(stage?: any): any {
    if (stage === '已实质答复')
        return 'ok';
    if (stage === '待答复')
        return 'warn';
    return 'idle';
}
export { dashStoreNavigate, dashToneColor, dashPriorityOf, dashDueValue, dashEndOfToday, dashOpenTasks, dashAddedToday, dashActionable, dashEarliestOverdue, dashStaleInfo, dashProjectName, dashTagPill, replyStageTone }
