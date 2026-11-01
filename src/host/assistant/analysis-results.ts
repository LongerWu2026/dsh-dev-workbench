/** Read committed message-extraction results from their real source relationships.
 * Model summaries and mutable browser excerpts never establish edit ownership. */
function resultIndex(state:any,runId?:string){
    const sources=new Map<string,any>((state.sources||[]).map((row:any)=>[row.id,row]))
    const bySource=new Map<string,any>(),byTask=new Map<string,any[]>()
    for(const entry of state.analysisQueue||[]){
        if(!sources.has(entry.sourceId)||runId&&entry.analysisJobId!==runId||!entry.analysis&&!['done','awaiting_human'].includes(entry.status))continue
        const previous=bySource.get(entry.sourceId)
        if(!previous||time(entry.analyzedAt||entry.at)>=time(previous.analyzedAt||previous.at))bySource.set(entry.sourceId,entry)
        for(const taskId of entry.taskIds||[])byTask.set(taskId,[...(byTask.get(taskId)||[]),entry])
    }
    return {sources,bySource,byTask}
}
const time=(value:any)=>new Date(value||0).getTime()||0
function evidence(index:ReturnType<typeof resultIndex>,kind:string,row:any){
    const ids=kind==='task'?[row.sourceRefId,...(row.sourceRefs||[]).map((ref:any)=>ref.sourceId||ref.id)]:[row.sourceId]
    const entries=[...ids.map(id=>index.bySource.get(id)).filter(Boolean),...(kind==='task'?index.byTask.get(row.id)||[]:[])]
    entries.sort((a,b)=>time(b.analyzedAt||b.at)-time(a.analyzedAt||a.at))
    return entries[0]||null
}
function view(index:ReturnType<typeof resultIndex>,kind:'task'|'reply',row:any,entry:any){
    const source=index.sources.get(entry.sourceId)
    return {id:row.id,kind,title:kind==='task'?row.title:row.snippet||row.contact||'待回复',body:kind==='task'?String(row.description||'').slice(0,3000):String(row.snippet||'').slice(0,3000),status:row.status||row.stage,
        dueAt:row.dueAt||null,priority:row.priority,assignee:row.assignee,contact:row.contact,groupName:row.groupName,
        sourceId:entry.sourceId,sourceText:String(source.excerpt||source.title||'').slice(0,800),sourceAt:source.locator?.sentAt||source.fetchedAt,
        analyzedAt:entry.analyzedAt||entry.at||row.createdAt,updatedAt:row.updatedAt||row.createdAt,analysisEntryId:entry.id,runId:entry.analysisJobId||null,conversationId:kind+':'+row.id}
}
export function analysisResultTarget(state:any,kind:string,id:string):any {
    if(!['task','reply'].includes(kind)||!id)throw Error('请明确选择要修改的提取结果：待办或待回复及其 ID')
    const row=(state[kind==='task'?'tasks':'replies']||[]).find((item:any)=>item.id===id)
    if(!row||row.archivedAt)throw Error('该提取结果已不存在或已归档，请刷新后重新选择')
    if(!evidence(resultIndex(state),kind,row))throw Error('该事项不属于实际消息提取结果，请从对应事项会话处理')
    return row
}
export function listAnalysisResults(state:any,input:any={}){
    const index=resultIndex(state,input.runId),all:any[]=[],query=String(input.query||'').trim().toLowerCase()
    for(const kind of ['task','reply'] as const)for(const row of state[kind==='task'?'tasks':'replies']||[]){
        if(row.archivedAt)continue
        const entry=evidence(index,kind,row);if(!entry)continue
        const result=view(index,kind,row,entry)
        if(!query||[result.id,result.title,result.body,result.contact,result.groupName,result.sourceText].filter(Boolean).join(' ').toLowerCase().includes(query))all.push(result)
    }
    const pendingReview=(state.analysisQueue||[]).filter((row:any)=>row.status==='awaiting_human'&&index.bySource.has(row.sourceId)&&(!input.runId||row.analysisJobId===input.runId)&&(!query||[row.id,JSON.stringify(row.analysis||{}),index.sources.get(row.sourceId)?.excerpt].join(' ').toLowerCase().includes(query))).length
    const counts={tasks:all.filter(row=>row.kind==='task').length,replies:all.filter(row=>row.kind==='reply').length,pendingReview}
    const filtered=all.filter(row=>!['task','reply'].includes(input.kind)||row.kind===input.kind)
    filtered.sort((a,b)=>time(b.analyzedAt)-time(a.analyzedAt)||time(b.updatedAt)-time(a.updatedAt)||(a.kind+':'+a.id).localeCompare(b.kind+':'+b.id))
    const limit=Math.max(1,Math.min(50,Math.floor(Number(input.limit)||6))),total=filtered.length
    const requested=Math.max(0,Math.floor(Number(input.offset)||0)),offset=Math.min(requested,Math.max(0,Math.floor((total-1)/limit)*limit))
    return {items:filtered.slice(offset,offset+limit),total,counts,offset,limit,hasMore:offset+limit<total}
}
