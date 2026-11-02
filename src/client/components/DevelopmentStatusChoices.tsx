import * as React from 'react'
import {Btn,Input,Textarea} from '../core/runtime.js'

/** Workflow choices come from Linky; the server checks the transition again when submitted. */
export function DevelopmentStatusChoices({value,disabled,onAction}:any){
 const [selected,setSelected]=React.useState<any>(null),[fields,setFields]=React.useState<any>({}),[comment,setComment]=React.useState('')
 const targets=Array.isArray(value?.targets)?value.targets:[]
 if(!value||!onAction)return null
 function choose(target:any){setSelected(target);setFields({});setComment('')}
 const formFields=selected?.form?.fields||[]
 const empty=(value:any)=>value==null||typeof value==='string'&&!value.trim()||Array.isArray(value)&&!value.length
 const missing=formFields.some((field:any)=>field.required&&empty(fields[field.column_key]??field.default))||selected?.form?.comment_mode==='required'&&!comment.trim()
 const unsupported=formFields.some((field:any)=>field.required&&field.supported===false&&empty(field.default))
 function submit(event:React.FormEvent){
  event.preventDefault();if(disabled||missing||unsupported||!selected)return
  void onAction('development.issue.update',{patch:{status:selected.key},...(Object.keys(fields).length?{fields}:{}),...(comment.trim()?{comment}: {})})
 }
 return <section aria-label="Linky 可用状态" className="wb-hub-artifact">
  <p className="wb-tiny wb-muted">查询时状态：{value.current} · 请选择要流转到的状态</p>
  <div className="wb-row" style={{flexWrap:'wrap',gap:8}}>{targets.map((target:any)=><Btn key={target.key} size="sm" disabled={disabled||value.pending} onClick={()=>choose(target)}>{target.name}</Btn>)}{!targets.length&&<span className="wb-muted">当前暂无可用流转</span>}<button type="button" className="wb-link" disabled={disabled} onClick={()=>{setSelected(null);void onAction('development.issue.get')}}>重新查询</button></div>
  {value.pending&&<p role="status">上次修改仍待核实，请先核对结果。</p>}
  {selected&&<form aria-label={'修改状态为'+selected.name} onSubmit={submit}>
   <p>将 Linky 业务状态修改为「{selected.name}」</p>
   {formFields.filter((field:any)=>field.supported!==false).map((field:any)=>{
    const options=(field.options||[]).map((option:any)=>typeof option==='object'?{value:option.value??option.key??option.id,label:option.label??option.name??option.title??option.value??option.key??option.id}:{value:option,label:option}).filter((option:any)=>['string','number','boolean'].includes(typeof option.value))
    const props={value:fields[field.column_key]??field.default??'',disabled,onChange:(event:any)=>setFields((previous:any)=>({...previous,[field.column_key]:event.target.value}))}
    return <label className="wb-field" key={field.column_key}><span>{field.name||field.column_key}{field.required?'（必填）':''}</span>{options.length?<select className="wb-input" {...props}><option value="">请选择</option>{options.map((option:any)=><option key={String(option.value)} value={String(option.value)}>{String(option.label)}</option>)}</select>:<Input {...props}/>}</label>
   })}
   {(selected.form?.comment_mode==='required'||selected.form?.comment_mode==='optional')&&<label className="wb-field"><span>流转说明{selected.form.comment_mode==='required'?'（必填）':'（选填）'}</span><Textarea value={comment} disabled={disabled} onChange={(event:any)=>setComment(event.target.value)} rows={2}/></label>}
   {unsupported&&<p role="status">此流转包含暂不支持填写的必填字段，请到 Linky 中完成。</p>}
   <div className="wb-row" style={{gap:8}}><button className="wb-btn wb-btn--primary" disabled={disabled||value.pending||missing||unsupported} type="submit">修改为{selected.name}</button><Btn disabled={disabled} onClick={()=>setSelected(null)}>取消</Btn></div>
  </form>}
 </section>
}
