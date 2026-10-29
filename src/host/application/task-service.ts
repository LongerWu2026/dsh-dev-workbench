import { asIso, asString, hostNowIso } from '../platform/runtime.js'
import { mutateWorkbenchState } from '../storage/state-store.js'
import { applyCreateTask, applyRecordRun, applyUpdateTask } from '../domain/task-commands.js'
import { requireTask } from './service-context.js'
import { auditEntry, ensureArray, normalizeHumanGuard, normalizeRun, normalizeTask } from '../domain/model.js'

/** task-service: shared Remote and Agent business use cases. */
export const taskService = {

    async createTask(input?: any): Promise<any> {
        const payload = input && typeof input === 'object' ? Object.assign({}, input) : {};
        if (!asString(payload.title, 200))
            throw new Error('待办标题不能为空');
        return mutateWorkbenchState(function (state?: any): any {
            return applyCreateTask(state, payload).state;
        });
    },

    async updateTask(id?: any, patch?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            return applyUpdateTask(state, id, patch).state;
        });
    },

    async deleteTask(id?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            const task = requireTask(state, id);
            state.tasks = ensureArray(state.tasks).filter(function (item?: any): any {
                return item.id !== id;
            });
            state.runs = ensureArray(state.runs).filter(function (run?: any): any {
                return run.taskId !== id;
            });
            for (const reply of ensureArray(state.replies)) reply.taskIds = ensureArray(reply.taskIds).filter((key:string)=>key!==id);
            for (const row of ensureArray(state.analysisQueue)) row.taskIds = ensureArray(row.taskIds).filter((key:string)=>key!==id);
            for (const row of ensureArray(state.candidates)) if(row.taskId===id) Object.assign(row,{taskId:null,status:'rejected'});
            auditEntry(state, 'task.deleted', task.title);
            return state;
        });
    },

    async recordRun(input?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            return applyRecordRun(state, input).state;
        });
    },

    async updateRun(id?: any, patch?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            const run = ensureArray(state.runs).find(function (item?: any): any {
                return item.id === id;
            });
            if (!run)
                throw new Error('找不到该执行记录：' + String(id));
            const next = normalizeRun(Object.assign({}, patch || {}, { taskId: run.taskId }), run);
            next.id = run.id;
            next.startedAt = run.startedAt;
            state.runs = ensureArray(state.runs).map(function (item?: any): any {
                return item.id === id ? next : item;
            });
            if (next.taskId && next.status === 'completed') {
                state.tasks = ensureArray(state.tasks).map(function (task?: any): any {
                    if (task.id !== next.taskId)
                        return task;
                    return Object.assign({}, task, { updatedAt: hostNowIso() });
                });
            }
            auditEntry(state, 'agent.run.' + next.status, next.summary || next.id);
            return state;
        });
    },

    /** TODO 17：人工处置（保护字段）。ignore/snooze/handled 不改任务 status，仅写 humanGuard。 */
    async taskMarkHuman(id?: any, mark?: any): Promise<any> {
        const payload = mark && typeof mark === 'object' ? mark : {};
        return mutateWorkbenchState(function (state?: any): any {
            const index = ensureArray(state.tasks).findIndex(function (task?: any): any {
                return task.id === id;
            });
            if (index < 0)
                throw new Error('找不到该待办：' + String(id));
            const task = state.tasks[index];
            const guard = normalizeHumanGuard(Object.assign({}, normalizeHumanGuard(task.humanGuard), {
                ignored: payload.ignored === true ? true : normalizeHumanGuard(task.humanGuard).ignored && payload.ignored !== false,
                handledConfirmed: payload.handledConfirmed === true ? true : normalizeHumanGuard(task.humanGuard).handledConfirmed && payload.handledConfirmed !== false,
                snoozeUntil: payload.snoozeUntil === undefined ? normalizeHumanGuard(task.humanGuard).snoozeUntil : asIso(payload.snoozeUntil) || null,
            }));
            const next = normalizeTask({ status: task.status }, task);
            next.humanGuard = guard;
            state.tasks = state.tasks.slice();
            state.tasks[index] = next;
            auditEntry(state, 'task.humanMarked', task.title + '（' + JSON.stringify(payload).slice(0, 80) + '）');
            return state;
        });
    },

    /** 删除执行记录：同步从关联任务的 runIds 中移除。 */
    async deleteRun(id?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            const runId = String(id);
            const exists = ensureArray(state.runs).some(function (row?: any): any {
                return row.id === runId;
            });
            if (!exists)
                throw new Error('找不到该执行记录：' + runId);
            state.runs = ensureArray(state.runs).filter(function (row?: any): any {
                return row.id !== runId;
            });
            state.tasks = ensureArray(state.tasks).map(function (task?: any): any {
                if (ensureArray(task.runIds).indexOf(runId) < 0)
                    return task;
                return Object.assign({}, task, { runIds: ensureArray(task.runIds).filter(function (item?: any): any { return item !== runId; }), updatedAt: hostNowIso() });
            });
            auditEntry(state, 'run.deleted', '删除执行记录 ' + runId);
            return state;
        });
    }
};
