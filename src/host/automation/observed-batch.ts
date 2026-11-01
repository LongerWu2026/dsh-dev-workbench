import {completeHubRun} from '../assistant/hub-runs.js'
import {hostNowIso,newId} from '../platform/runtime.js'
import {mutateWorkbenchState,workbenchGenerationGuard} from '../storage/state-store.js'

/** Observe legacy/scheduled synchronous batches without putting another retry in
 * the workflow queue. Call begin only after selecting actual work: idle polls and
 * model cooldowns must not fill the user's conversation with empty runs. */
export async function observeBackgroundBatch(ctx:any,kind:'analysis'|'summary',input:any,execute:(request:any,begin:()=>Promise<void>)=>Promise<any>):Promise<any>{
    const key=kind==='analysis'?'analysisJobId':'hubRunId'
    if(input?.[key])return execute(input,async()=>{}) // The existing workflow owns its status and completion.
    const request={...input,[key]:newId('job')},assertCurrent=workbenchGenerationGuard()
    let job:any
    const begin=async()=>{
        if(job)return
        assertCurrent()
        const at=hostNowIso()
        const record={id:request[key],kind,status:'running',input:{observed:true,limit:input?.limit,onlyIds:Array.isArray(input?.onlyIds)?input.onlyIds:[]},createdAt:at,updatedAt:at,attempts:0}
        await mutateWorkbenchState((state:any)=>{assertCurrent();state.jobs.push(record);return state})
        job=record
    }
    const finish=async(result:any,error?:any)=>{
        if(!job)return
        let historyError:string|undefined
        try{assertCurrent();completeHubRun(ctx,job,result)}catch(cause){historyError=String(cause.message||cause)}
        // History is observational. A failed index/write must never turn a
        // successfully committed business batch into an automatically retried job.
        try{await mutateWorkbenchState((state:any)=>{
            assertCurrent()
            const row=state.jobs.find((item:any)=>item.id===job.id)
            if(row){
                Object.assign(row,{status:!error&&['ok','partial'].includes(result?.status)?'completed':'failed',result,updatedAt:hostNowIso(),nextRetryAt:null,error:error?String(error.message||error):!['ok','partial'].includes(result?.status)?result?.note:undefined})
                if(historyError)row.historyError=historyError
            }
            return state
        })}catch(cause){try{ctx?.logger?.warn?.('后台执行已结束，但运行记录未能更新：'+String(cause.message||cause))}catch{}}
    }
    let result:any
    try{result=await execute(request,begin)}catch(error){await finish(undefined,error);throw error}
    await finish(result)
    return result
}
