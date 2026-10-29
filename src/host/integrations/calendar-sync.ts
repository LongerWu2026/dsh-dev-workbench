import {createHash,hostNowIso,asIso,hashText} from '../platform/runtime.js'
import {normalizeSource,normalizeHumanGuard} from '../domain/model.js'
import {applyCreateTask,applyUpdateTask} from '../domain/task-commands.js'
import {findCalendarMeetingTask} from '../domain/meeting-match.js'
const time=(v:any):string|null=>{if(v==null||v===0||v==='0'||v==='')return null;try{return asIso(typeof v==='number'?new Date(v).toISOString():typeof v==='string'&&/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(v)?v.replace(' ','T')+'+08:00':v)}catch{return null}}
export async function fetchCalendarPlan(ctx:any,state:any,probe:any,run:any):Promise<any>{
 const day=(n:number)=>new Date(Date.now()+8*3600000+n*86400000).toISOString().slice(0,10)
 const result=await run(ctx,['calendar','event','list','--start',day(0),'--end',day(7)])
 const rows=result.status==='ok'&&Array.isArray(result.json?.data?.list)?result.json.data.list:[]
 const events=rows.filter((e:any)=>e.id&&e.title&&Number.isFinite(Date.parse(time(e.startDate)||''))&&time(e.endDate)&&Date.parse(time(e.endDate)!)>Date.parse(time(e.startDate)!)).map((e:any)=>({id:String(e.id),title:String(e.title).slice(0,200),start:time(e.startDate),end:time(e.endDate),location:String(e.meetingPlace||'').slice(0,200),cancelled:!!e.cancelDate&&Number.isFinite(Date.parse(time(e.cancelDate)||'')),readStatus:typeof e.readStatus==='number'?e.readStatus:null,noticeTime:typeof e.noticeTime==='number'?e.noticeTime:null}))
 return {accountId:probe.accountId||probe.openId,projectId:state.settings.defaultProjectId||null,events,report:{at:hostNowIso(),status:result.status,found:events.length,note:result.status==='ok'?'今日起7天内的日历会议；缺失不视为取消':String(result.note||'日历查询失败，保留原会议').slice(0,200)}}
}
/** Called inside the local commit lock. Explicit cancellations only; human edits win. */
export function applyCalendarPlan(state:any,plan:any):void {
 if(!plan||plan.report?.status!=='ok')return
 for(const event of plan.events){
  const externalId='yzj-calendar:'+createHash('sha256').update(JSON.stringify([plan.accountId,event.id])).digest('hex')
  let source=state.sources.find((s:any)=>s.provider==='yunzhijia-calendar'&&s.externalId===externalId)
  const previousCancelled=source?.calendarMeta?.cancelled===true
  if(!source){source=normalizeSource({provider:'yunzhijia-calendar',externalId,title:event.title,excerpt:event.title,projectId:plan.projectId,locator:{groupId:null,msgId:event.id,accountId:plan.accountId,sentAt:hostNowIso()}});state.sources.push(source)}
  Object.assign(source,{title:event.title,excerpt:[event.title,event.start,event.end,event.location,event.cancelled?'会议已取消':''].filter(Boolean).join(' · '),calendarMeta:{...event,at:plan.report.at}})
  source.payloadHash=hashText([source.url||'',source.title,source.excerpt].join('|'))
  const linked=state.tasks.find((t:any)=>t.sourceRefId===source.id||(t.sourceRefs||[]).some((r:any)=>r.sourceId===source.id))
  const match=linked||findCalendarMeetingTask(state,{title:event.title,eventType:'meeting',meetingStart:event.start,meetingLocation:event.location},source,false)
  const ref={sourceId:source.id,msgId:event.id,snippet:source.excerpt.slice(0,160)}
  if(!match){if(event.cancelled)continue;applyCreateTask(state,{title:event.title,description:source.excerpt,eventType:'meeting',meetingStart:event.start,meetingEnd:event.end,meetingLocation:event.location,sourceRefId:source.id,sourceRefs:[ref],projectId:plan.projectId,status:'ready',tags:['云之家日历'],idempotencyKey:externalId});continue}
  const guard=normalizeHumanGuard(match.humanGuard);if(guard.ignored||guard.handledConfirmed||match.archivedAt)continue
  const patch:any={sourceRefs:(match.sourceRefs||[]).some((r:any)=>r.sourceId===source.id)?match.sourceRefs:[...(match.sourceRefs||[]),ref]}
  for(const [field,value] of Object.entries({title:event.title,meetingStart:event.start,meetingEnd:event.end,meetingLocation:event.location,eventType:'meeting'}))if(!guard.editedFields.includes(field))patch[field]=value
  if(!guard.editedFields.includes('status')&&match.status!=='completed'){
   if(event.cancelled)patch.status='cancelled'
   else if(previousCancelled&&match.status==='cancelled')patch.status='ready'
  }
  if(Object.entries(patch).some(([key,value])=>JSON.stringify(match[key])!==JSON.stringify(value)))applyUpdateTask(state,match.id,patch,{automated:true})
 }
}
