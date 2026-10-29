import { loadWorkbenchState } from '../storage/state-store.js'
import { refreshConnectors } from '../integrations/connectors.js'
import { ensureArray } from '../domain/model.js'

/* ============================================================================
 * dev-workbench host — workbench service
 *
 * The single authority for workbench state. Every mutation returns the whole
 * new snapshot, so the Client never has to merge: it swaps. That is the
 * "Host 维护可重建快照" contract from design report §5.2, kept deliberately
 * boring so a reconnecting Client cannot drift.
 * ========================================================================== */
let workbenchCtx: any = null;

function workbenchContext(): any {
    return workbenchCtx;
}

async function workbenchServiceState(): Promise<any> {
    const state = loadWorkbenchState();
    const ctx = workbenchContext();
    if (!ctx)
        return state;
    try {
        return await refreshConnectors(ctx, state);
    }
    catch (e) {
        return state;
    }
}

function requireTask(state?: any, id?: any): any {
    const task = ensureArray(state.tasks).find(function (item?: any): any {
        return item.id === id;
    });
    if (!task)
        throw new Error('找不到该待办：' + String(id));
    return task;
}

let workbenchToolNames: any = [];

function workbenchCtxToolNames(): any {
    return workbenchToolNames;
}

function registerWorkbenchToolNames(names?: any): any {
    workbenchToolNames = names.slice();
}

export function setShared_workbenchCtx(value: any): any { return workbenchCtx = value }
export { workbenchCtx, workbenchContext, workbenchServiceState, requireTask, workbenchToolNames, workbenchCtxToolNames, registerWorkbenchToolNames }
