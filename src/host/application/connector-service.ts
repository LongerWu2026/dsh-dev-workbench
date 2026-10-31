import {workbenchContext} from './service-context.js'
import {loadWorkbenchState} from '../storage/state-store.js'
import {refreshConnectors} from '../integrations/connectors.js'
import {startYunzhijiaSetup, yunzhijiaSetupStatus} from '../integrations/yunzhijia-setup.js'

async function refresh(force = false) {
    const ctx = workbenchContext()
    if (!ctx) throw new Error('工作台宿主尚未就绪')
    const state = await refreshConnectors(ctx, loadWorkbenchState(), force, 15000)
    return {connector:state.connectors.find((row:any)=>row.id === 'yunzhijia') || null, operation:yunzhijiaSetupStatus()}
}
export const connectorService = {
    async yunzhijiaStatus(request?: {force?: boolean; operationOnly?: boolean}) {
        if (request?.operationOnly === true) return {connector:loadWorkbenchState().connectors.find((row:any)=>row.id === 'yunzhijia') || null, operation:yunzhijiaSetupStatus()}
        return refresh(request?.force === true)
    },
    async yunzhijiaSetup(request: {kind?: unknown}) {
        return startYunzhijiaSetup(workbenchContext(), request?.kind, ()=>refresh(true))
    },
}
