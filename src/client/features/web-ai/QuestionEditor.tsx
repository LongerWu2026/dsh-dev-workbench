import * as React from 'react'
import {Btn,Textarea,Modal} from '../../core/runtime.js'
import type {WebAIRound} from '../../../shared/web-ai.js'
import {localQuestion} from './history.js'
export function QuestionEditor({round,onSave,onClose}:{round:WebAIRound;onSave:(text:string)=>Promise<void>;onClose:()=>void}){
 const [text,setText]=React.useState(localQuestion(round)),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('')
 return <Modal open title="编辑本地问题" width={600} onClose={()=>{if(!busy)onClose()}}><p className="wb-tiny wb-muted">只修改本地显示。官网原提问和回答采集依据保留，追问仍使用原官网会话。</p><Textarea aria-label="本地问题正文" rows={6} value={text} onChange={(e:any)=>setText(e.target.value)}/>{error&&<p role="alert" className="wb-web-error">{error}</p>}<div className="wb-row wb-row--wrap" style={{gap:8}}><Btn disabled={busy} onClick={()=>setText(round.question)}>恢复原问题</Btn><Btn disabled={busy} onClick={onClose}>取消</Btn><Btn kind="primary" disabled={busy||!text.trim()||text.length>12000} onClick={async()=>{setBusy(true);setError('');try{await onSave(text);onClose()}catch(e){setError(e instanceof Error?e.message:'保存失败')}finally{setBusy(false)}}}>保存本地问题</Btn></div></Modal>
}
