import {disposeDataTools} from '../integrations/data-tools.js'
import {projectRuntimeState,startProject,stopProject,openProject,disposeProjectRuntime} from '../integrations/project-runtime.js'
import {sendHttpRequest,cancelDebugRequest,connectMcp,callMcp,disconnectMcp,disposeDebugClients} from '../integrations/debug-client.js'
import {disposeYunzhijiaSetup} from '../integrations/yunzhijia-setup.js'
import {disposeDevelopment} from './development-service.js'
export const developerService={
    async projectRuntime(request:any){return projectRuntimeState(request?.projectId,request?.force===true)},
    async projectStart(request:any){return startProject(request?.projectId,request?.commandId)},
    async projectStop(request:any){return stopProject(request?.runId)},
    async projectOpen(request:any){return openProject(request?.projectId,request?.target)},
    async httpDebug(request:any){return sendHttpRequest(request)},
    async debugCancel(request:any){return cancelDebugRequest(request?.requestId)},
    async mcpConnect(request:any){return connectMcp(request)},
    async mcpCall(request:any){return callMcp(request)},
    async mcpDisconnect(request:any){return disconnectMcp(request?.connectionId)},
}
export function disposeDeveloperServices(){disposeDataTools();disposeProjectRuntime();disposeDebugClients();disposeYunzhijiaSetup();disposeDevelopment()}
let activation:symbol|null=null
export function activateDeveloperServices(){
    disposeDeveloperServices()
    const owner=activation=Symbol('developer-runtime')
    return ()=>{if(activation===owner){activation=null;disposeDeveloperServices()}}
}
