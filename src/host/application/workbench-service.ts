import {dataService} from './data-service.js'
import {developerService} from './developer-service.js'
import {developmentService} from './development-service.js'
import {connectorService} from './connector-service.js'
import { workflowService } from './workflow-service.js'
import {webAIService} from './web-ai-service.js'
/** Composition root. Implement business use cases in the service for their domain. */
import { officeService } from '../workflows/office-service.js'
import { workbenchContext } from './service-context.js'
import { taskService } from './task-service.js'
import { knowledgeService } from './knowledge-service.js'
import { sourceService } from './source-service.js'
import { newsService } from './news-service.js'
import { analysisService } from './analysis-service.js'
import { assistantService } from './assistant-service.js'
import { systemService } from './system-service.js'
const workbenchApi: any = {
 ...developmentService,
 ...connectorService,
 ...developerService,
 ...dataService,
 ...webAIService(),
 ...officeService(workbenchContext),
 ...workflowService(workbenchContext),
 ...taskService,
 ...knowledgeService,
 ...sourceService,
 ...newsService,
 ...analysisService,
 ...assistantService,
 ...systemService
};

/* ---------------------------------------------------------------------------
 * The Typert gateway resolves `workbench/<method>` by reading a `typertRemote`
 * binding off the service instance that `ctx.get('workbench')` returns — see
 * the gateway's validateBinding(): `Reflect.get(original, 'typertRemote')`
 * must yield `{ service: original, serviceKey: 'workbench', namespace: … }`,
 * otherwise it throws
 *   gateway/binding-invalid: Service "workbench" has no visible typertRemote
 *   binding
 * which is exactly the failure the shipped UI reported. `service` must be this
 * same object so readBinding()'s identity check passes; the frozen shape
 * mirrors bindTypertRemote() from @deepseek-ai/dsh-typert-protocol.
 * ------------------------------------------------------------------------- */
Object.defineProperty(workbenchApi, 'typertRemote', {
    value: Object.freeze({
        service: workbenchApi,
        serviceKey: 'workbench',
        namespace: 'workbench',
    }),
    enumerable: false,
    configurable: false,
    writable: false,
});
export { workbenchApi }
export { workbenchCtx, workbenchContext, workbenchServiceState, requireTask, workbenchToolNames, workbenchCtxToolNames, registerWorkbenchToolNames, setShared_workbenchCtx } from './service-context.js'
export { applyCreateTask, applyUpdateTask, applyRecordRun } from '../domain/task-commands.js'
