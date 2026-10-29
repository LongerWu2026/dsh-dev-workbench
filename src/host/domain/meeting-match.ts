const title=(x:any)=>String(x||'').toLowerCase().replace(/参加|通知|请|部门|月度|会议|开会|[\s，。；：:、()（）【】\-]/g,'')
const room=(x:any)=>String(x||'').toUpperCase().match(/[A-Z]?\d{2,5}[A-Z]?/)?.[0]||String(x||'').trim()
/** Unique, same-account/time match only. Never merge on a similar title alone. */
export function findCalendarMeetingTask(state:any,item:any,source:any,calendarOnly=true):any|null {
 if(item.eventType!=='meeting'||!item.meetingStart)return null
 const sources=new Map<string,any>((state.sources||[]).map((s:any)=>[s.id,s])),account=source.locator?.accountId
 const rows=(state.tasks||[]).filter((t:any)=>{
  if(t.archivedAt||t.eventType!=='meeting'||!t.meetingStart||Date.parse(t.meetingStart)!==Date.parse(item.meetingStart)||(t.projectId||null)!==(source.projectId||null))return false
  const refs=[t.sourceRefId,...(t.sourceRefs||[]).map((r:any)=>r.sourceId)].map(id=>sources.get(id)).filter(Boolean)
  if(!refs.some((s:any)=>s.locator?.accountId===account&&(calendarOnly?s.provider==='yunzhijia-calendar':s.provider==='yunzhijia'||s.provider==='yunzhijia-calendar')))return false
  const a=title(t.title),b=title(item.title),x=room(t.meetingLocation),y=room(item.meetingLocation)
  if(a.length<3||b.length<3||!(a.includes(b)||b.includes(a)))return false
  return x&&y?x===y:a===b&&a.length>=4
 });return rows.length===1?rows[0]:null
}
