import {createWorkspaceRefresh} from './workspace-refresh.js'
import {loadWorkbenchState} from '../storage/state-store.js'
import {sourceService} from './source-service.js'
import {newsService} from './news-service.js'
import {analysisService} from './analysis-service.js'

const refresh=createWorkspaceRefresh({
 snapshot:loadWorkbenchState,
 messages:()=>sourceService.fetchMentions(),
 news:()=>newsService.fetchRadar(),
 analysis:()=>analysisService.analysisStart({preserveModelHealth:true}),
})
export const refreshService={
 async refreshStart(request?:any){return refresh.start(request?.scope||'all')},
 async refreshStatus(){return refresh.status()},
}
