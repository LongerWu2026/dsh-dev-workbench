import * as React from 'react'
import {Chip,Input} from '../../core/runtime.js'
import {ENTERPRISE_SEARCH_TYPES,enterpriseHasDates} from '../../../shared/enterprise-search.js'

export function EnterpriseSearchFilters({value,onChange,range,onRange}:any){
 const selected=ENTERPRISE_SEARCH_TYPES.find(row=>row.id===value)||ENTERPRISE_SEARCH_TYPES[0]
 return <section aria-label="云之家查询类型" style={{marginBottom:14}}>
  <div className="wb-row wb-row--wrap" role="group" aria-label="云之家搜索类型" style={{gap:6}}>{ENTERPRISE_SEARCH_TYPES.map(type=><Chip key={type.id} active={value===type.id} onClick={()=>onChange(type.id)}>{type.label}</Chip>)}</div>
  <p className="wb-tiny wb-muted" role="note">{selected.hint}</p>
  {enterpriseHasDates(value)&&<div className="wb-row wb-row--wrap" style={{gap:12}}>
   <label className="wb-tiny">开始（北京时间） <Input type={value==='rooms'?'datetime-local':'date'} aria-label="云之家查询开始时间" value={range.start} onChange={(event:any)=>onRange({...range,start:event.target.value})}/></label>
   <label className="wb-tiny">结束（北京时间） <Input type={value==='rooms'?'datetime-local':'date'} aria-label="云之家查询结束时间" value={range.end} onChange={(event:any)=>onRange({...range,end:event.target.value})}/></label>
  </div>}
 </section>
}
