import * as React from 'react'
import { WB } from '../core/runtime.js'
import type {EventType} from '../../shared/contracts.js'
export interface EventFields {eventType: EventType | ''; deliverable: string; meetingStart: string; meetingEnd: string; meetingLocation: string; registrationTarget: string}
export function TaskEventFields({value,onChange}:{value:EventFields;onChange:(value:EventFields)=>void}):React.ReactElement {
  const patch=(key:keyof EventFields,next:string)=>onChange({...value,[key]:next})
  return <div className="wb-stack"><label className="wb-label">事项类型<select className="wb-select" aria-label="事项类型" value={value.eventType} onChange={e=>patch('eventType',e.target.value)}><option value="">普通事项</option><option value="feature">开发交付</option><option value="meeting">会议</option><option value="logging">登记填报</option><option value="other">其他</option></select></label>
    <label className="wb-label">交付物<input className="wb-input" value={value.deliverable} onChange={e=>patch('deliverable',e.target.value)} placeholder="未知可留空"/></label>
    {value.eventType==='meeting'&&<><label className="wb-label">会议开始<input className="wb-input" type="datetime-local" value={WB.fmt.toLocalInput(value.meetingStart)} onChange={e=>patch('meetingStart',WB.fmt.fromLocalInput(e.target.value)||'')}/></label><label className="wb-label">会议结束<input className="wb-input" type="datetime-local" value={WB.fmt.toLocalInput(value.meetingEnd)} onChange={e=>patch('meetingEnd',WB.fmt.fromLocalInput(e.target.value)||'')}/></label><label className="wb-label">会议地点<input className="wb-input" value={value.meetingLocation} onChange={e=>patch('meetingLocation',e.target.value)}/></label></>}
    {value.eventType==='logging'&&<label className="wb-label">登记对象<input className="wb-input" value={value.registrationTarget} onChange={e=>patch('registrationTarget',e.target.value)}/></label>}
  </div>
}
