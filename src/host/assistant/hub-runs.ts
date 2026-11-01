import {loadWorkbenchState} from '../storage/state-store.js'
import {recordHubRun} from './hub-store.js'

/** Result identifiers are captured after the same business commit. Native spans are
 * recorded at the actual structured prompt submission, never inferred globally. */
export function completeHubRun(ctx:any,job:any,result:any){
    if(!['analysis','summary'].includes(job.kind))return
    const state=loadWorkbenchState()
    const sources=new Set(state.analysisQueue.filter((row:any)=>row.analysisJobId===job.id).map((row:any)=>row.sourceId))
    const view=(kind:string,row:any)=>({id:row.id,kind,title:row.title||row.snippet||row.contact,status:row.status||row.stage,body:row.description||row.snippet||Object.values(row.summary||{}).join('\n'),conversationId:kind+':'+row.id})
    const items=job.kind==='analysis'?[
        ...state.tasks.filter((row:any)=>sources.has(row.sourceRefId)||(row.sourceRefs||[]).some((ref:any)=>sources.has(ref.sourceId))).map((row:any)=>view('task',row)),
        ...state.replies.filter((row:any)=>sources.has(row.sourceId)).map((row:any)=>view('reply',row))
    ]:state.radar.filter((row:any)=>result?.items?.some((item:any)=>item.id===row.id)).map((row:any)=>view('radar',row))
    recordHubRun(job.id,[],items)
}
