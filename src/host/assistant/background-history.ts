import {hostService} from './sessions.js'
import {transcriptDelta} from './transcript.js'
import {loadWorkbenchState,workbenchGenerationGuard,workbenchAudit} from '../storage/state-store.js'

interface HistoryRow {id:string;active:boolean;archived:boolean;protected:boolean}
interface ArchiveResult {id:string;status:'archived'|'skipped'|'failed';reason?:string}

function inventory(ctx:any):{registry:any;rows:HistoryRow[];supported:boolean} {
 const state=loadWorkbenchState(),registry=hostService(ctx,'workspaceRegistry')
 const active=new Set<string>([
  state.settings.analysisSessionId,state.settings.summarySessionId,
  ...Object.values(state.backgroundThreads||{}).map((row:any)=>row.sessionId),
 ].filter(Boolean))
 const known=new Set<string>([...(state.backgroundSessionIds||[]),...active])
 const archived=new Set<string>(registry?.archivedSessionIds||[])
 return {registry,supported:typeof registry?.archiveSession==='function',rows:[...known].reverse().map(id=>({
  id,active:active.has(id),archived:archived.has(id),protected:id===state.settings.assistantSessionId,
 }))}
}

/** Registry archive retains native logs. The current host has no public unarchive method. */
export function backgroundHistory(ctx:any,request:any={}) {
 const {rows,supported}=inventory(ctx)
 const filtered=rows.filter(row=>request.archived?row.archived:!row.archived)
 const offset=Math.max(0,Math.floor(Number(request.offset)||0)),limit=20
 return {supported,canRestoreSidebar:false,total:filtered.length,offset,limit,
  eligible:rows.filter(row=>!row.active&&!row.protected&&!row.archived).length,
  items:filtered.slice(offset,offset+limit),
  note:supported?'归档只从宿主侧栏隐藏，日志保留，可从这里打开。当前宿主没有公开的恢复侧栏接口。':'当前宿主未提供会话归档接口，未修改任何会话。'}
}

export async function archiveBackgroundHistory(ctx:any,ids:unknown) {
 if(!Array.isArray(ids)||!ids.length||ids.length>20||ids.some(id=>typeof id!=='string'))throw new Error('每次请选择 1–20 个后台会话')
 const unique=[...new Set<string>(ids)],initial=inventory(ctx)
 if(!initial.supported)throw new Error('当前宿主不支持会话归档')
 if(unique.some(id=>!initial.rows.some(row=>row.id===id)))throw new Error('只能归档工作台登记的后台会话')
 const assertCurrent=workbenchGenerationGuard(),controller=hostService(ctx,'sessionController'),sessions=hostService(ctx,'sessions'),agents=hostService(ctx,'agents')
 const results:ArchiveResult[]=[]
 for(const id of unique){
  assertCurrent()
  const row=inventory(ctx).rows.find(row=>row.id===id)
  if(!row||row.active||row.protected){results.push({id,status:'skipped',reason:'当前复用或人工会话受保护'});continue}
  if(row.archived){results.push({id,status:'skipped',reason:'已经归档'});continue}
  try{
   const live=sessions?.get?.(id)
   // The public Agent registry is authoritative for live drivers; absent agents are cold.
   // Older hosts fall back to the transcript/controller, never guessing unknown state is idle.
   if(typeof agents?.get==='function'){
    const agent=agents.get(id)
    if(agent&&agent.status!=='idle'){results.push({id,status:'skipped',reason:'会话正在运行或状态未知'});continue}
   }else if(live){if(transcriptDelta(live,0).turnActive){results.push({id,status:'skipped',reason:'会话正在运行'});continue}}
   else if(typeof controller?.state==='function'){
    const status=await controller.state({sessionId:id});assertCurrent()
    if(status.running){results.push({id,status:'skipped',reason:'会话正在运行'});continue}
   }else{results.push({id,status:'skipped',reason:'无法确认会话运行状态'});continue}
   const current=inventory(ctx).rows.find(row=>row.id===id)
   if(!current||current.active||current.protected){results.push({id,status:'skipped',reason:'会话已被重新使用'});continue}
   await initial.registry.archiveSession(id);assertCurrent()
   results.push({id,status:'archived'})
  }catch(error){
   assertCurrent()
   results.push({id,status:'failed',reason:String((error as Error).message).slice(0,300)})
  }
 }
 const archived=results.filter(row=>row.status==='archived').length
 if(archived)await workbenchAudit('sessions.archived',`归档 ${archived} 个已停用后台会话，保留原生日志`)
 return {archived,skipped:results.filter(row=>row.status==='skipped').length,failed:results.filter(row=>row.status==='failed').length,results}
}
