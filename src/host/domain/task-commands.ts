import { hostNowIso } from '../platform/runtime.js'
import {normalizeTask,normalizeRun,ensureArray,auditEntry} from './model.js'
function applyCreateTask(state?: any, payload?: any): any {
    if (payload.projectId === undefined && state.settings.defaultProjectId) {
        payload.projectId = state.settings.defaultProjectId;
    }
    if (payload.projectId && !state.projects.some((row:any)=>row.id===payload.projectId)) throw new Error('关联项目不存在：'+payload.projectId);
    if (payload.sourceRefId && !state.sources.some((row:any)=>row.id===payload.sourceRefId)) throw new Error('关联来源不存在：'+payload.sourceRefId);
    const task = normalizeTask(payload, null);
    state.tasks = ensureArray(state.tasks).concat([task]);
    auditEntry(state, 'task.created', task.title);
    return { state: state, entity: task };
}
function applyUpdateTask(state?: any, id?: any, patch?: any, options?: any): any {
    const index = ensureArray(state.tasks).findIndex(function (task?: any): any {
        return task.id === id;
    });
    if (index < 0)
        throw new Error('找不到该待办：' + String(id));
    const next = normalizeTask(patch || {}, state.tasks[index]);
    // TODO 17 人工保护：记录人工实际修改的字段，后台/AI 不得直接覆盖它们
    const watched: any = ['title', 'description', 'status', 'priority', 'dueAt', 'assignee', 'projectId', 'tags', 'replyStage', 'needsReply', 'needsAction', 'eventType', 'meetingStart', 'meetingEnd', 'meetingLocation', 'registrationTarget', 'deliverable'];
    const previous = state.tasks[index];
    const edited = watched.filter(function (field?: any): any {
        return JSON.stringify(next[field] === undefined ? null : next[field]) !== JSON.stringify(previous[field] === undefined ? null : previous[field]);
    });
    const guard = Object.assign({}, next.humanGuard, { editedFields: [...new Set(ensureArray(previous.humanGuard && previous.humanGuard.editedFields).concat(options && options.automated ? [] : edited))] });
    next.humanGuard = guard;
    next.id = state.tasks[index].id;
    next.createdAt = state.tasks[index].createdAt;
    state.tasks = state.tasks.slice();
    state.tasks[index] = next;
    auditEntry(state, 'task.updated', next.title + ' → ' + next.status);
    return { state: state, entity: next };
}
function applyRecordRun(state?: any, payload?: any): any {
    const run = normalizeRun(payload || {}, null);
    if (run.taskId && !ensureArray(state.tasks).some(function (task?: any): any {
        return task.id === run.taskId;
    })) {
        throw new Error('关联的待办不存在：' + run.taskId);
    }
    state.runs = ensureArray(state.runs).concat([run]);
    if (run.taskId) {
        state.tasks = ensureArray(state.tasks).map(function (task?: any): any {
            if (task.id !== run.taskId)
                return task;
            const next = Object.assign({}, task);
            next.runIds = ensureArray(task.runIds).concat([run.id]);
            next.updatedAt = hostNowIso();
            if (run.status === 'failed')
                next.status = 'failed';
            else if (run.status === 'running' && (task.status === 'ready' || task.status === 'draft'))
                next.status = 'running';
            return next;
        });
    }
    auditEntry(state, 'agent.run.created', run.summary || run.id);
    return { state: state, entity: run };
}

export { applyCreateTask, applyUpdateTask, applyRecordRun }
