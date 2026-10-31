import * as React from 'react'
import {Badge,Btn,Panel,WB} from '../../core/runtime.js'
import {MessageSelectionBadges} from '../../components/MessageSelectionBadges.js'
import {dashEndOfToday} from './selectors.js'

export function briefTime(at:string,now=Date.now()):string {
 const value=Date.parse(at);if(!Number.isFinite(value))return '时间待确认'
 const date=new Date(value+8*3600000)
 const calendarDay=(date.getUTCFullYear()!==new Date(now+8*3600000).getUTCFullYear()?date.getUTCFullYear()+'年':'')+(date.getUTCMonth()+1)+'月'+date.getUTCDate()+'日'
 const today=dashEndOfToday(now),start=today-86400000+1
 const day=value>=start&&value<=today?'今天':value>today&&value<=today+86400000?'明天':calendarDay
 return day+' '+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(value)
}

export function BriefAgenda({data,now}:{data:any;now:number}) {
 const account=data.messageInbox?.accountId
 const own=(t:any)=>{const refs=[t.sourceRefId,...(t.sourceRefs||[]).map((r:any)=>r.sourceId)].filter(Boolean);return !refs.length||refs.some((id:string)=>{const source=(data.sources||[]).find((s:any)=>s.id===id);return source&&(!source.locator?.accountId||source.locator.accountId===account)})}
 const meetings=(data.tasks||[]).filter((t:any)=>t.eventType==='meeting'&&own(t)&&!t.archivedAt&&!['completed','cancelled'].includes(t.status)&&Date.parse(t.meetingEnd||t.meetingStart)>=now).sort((a:any,b:any)=>Date.parse(a.meetingStart)-Date.parse(b.meetingStart))
 const today=meetings.filter((t:any)=>Date.parse(t.meetingStart)<=dashEndOfToday(now))
 const shown=today.length?today.slice(0,3):meetings.slice(0,1)
 return <Panel title="日程" icon="calendar" actions={<Btn size="sm" kind="subtle" onClick={()=>WB.store.set({page:'tasks',taskPreset:{typeFilter:'meeting',status:'open',dueFilter:'all'}})}>全部日程</Btn>}>
  {!shown.length?<p className="wb-tiny wb-muted">今天没有会议安排</p>:shown.map((t:any)=>{
   const delta=Date.parse(t.meetingStart)-now
   const label=delta<=0?'进行中':delta<=30*60000?'即将开始':Date.parse(t.meetingStart)<=dashEndOfToday(now)?'今日会议':'下一场'
   return <div className="wb-item" key={t.id}><div className="wb-item-main"><div className="wb-row wb-row--wrap"><MessageSelectionBadges source={(data.sources||[]).find((s:any)=>s.id===t.sourceRefId)}/><Badge tone={delta>0&&delta<=30*60000?'warn':'idle'}>{label}</Badge><span className="wb-tiny wb-muted">{briefTime(t.meetingStart,now)}</span></div><button style={{display:'block',textAlign:'left',background:'transparent',border:0,color:'inherit',font:'inherit',fontWeight:600,padding:'8px 0',cursor:'pointer',overflowWrap:'anywhere',width:'100%'}} onClick={()=>WB.openTaskForm(t)}>{t.title}</button>{t.meetingLocation&&<div className="wb-tiny wb-muted">{t.meetingLocation}</div>}</div></div>
  })}
  {today.length>3&&<p className="wb-tiny wb-muted">今天还有 {today.length-3} 场会议</p>}
 </Panel>
}
