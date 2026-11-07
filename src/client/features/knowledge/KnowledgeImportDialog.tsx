import * as React from 'react'
import {WB,Btn,Input,Field,Textarea,Modal} from '../../core/runtime.js'
import {KnowledgeScopeFields} from '../../components/KnowledgeScopeFields.js'

export function KnowledgeImportDialog({data,scope,onClose,onImported}:any){
 const [title,setTitle]=React.useState(''),[body,setBody]=React.useState(''),[busy,setBusy]=React.useState(false),[reading,setReading]=React.useState(false),[error,setError]=React.useState('')
 const active=React.useRef(true),lock=React.useRef(false),fileVersion=React.useRef(0)
 React.useEffect(()=>{active.current=true;return()=>{active.current=false;fileVersion.current++}},[])
 async function read(file?:File){
  if(!file)return;const version=++fileVersion.current;setError('');setReading(false)
  if(file.size>80000){setError('文件过大，请按章节拆分');return}
  setReading(true)
  try{const text=await file.text();if(!active.current||version!==fileVersion.current)return;if(text.length>20000){setError('正文超过20000字符，请按章节拆分');return}setBody(text);setTitle(old=>old||file.name)}
  catch(failure:any){if(active.current&&version===fileVersion.current)setError(failure.message||'文件读取失败')}
  finally{if(active.current&&version===fileVersion.current)setReading(false)}
 }
 async function save(){
  if(lock.current||reading)return
  if(!title.trim()||!body.trim()){setError('请填写标题及正文');return}
  if(body.length>20000){setError('正文超过20000字符，请按章节拆分后导入');return}
  lock.current=true;setBusy(true);setError('')
  try{await WB.actions.createKnowledge({title:title.trim(),body,kind:'note',reviewState:'candidate',...scope,sourceLabel:'手动导入正文'});if(active.current){onImported?.();onClose()}}
  catch(failure:any){if(active.current)setError(failure.message)}
  finally{lock.current=false;if(active.current)setBusy(false)}
 }
 return <Modal open title="导入资料" width={600} onClose={()=>!busy&&onClose()} footer={<><Btn disabled={busy} onClick={onClose}>取消</Btn><Btn kind="primary" disabled={busy||reading} onClick={save}>{busy?'正在保存…':'保存为待审核资料'}</Btn></>}>
  <div className="wb-stack" style={{gap:12}}>
   <div className="wb-row wb-row--wrap" style={{gap:8}}><KnowledgeScopeFields data={data} scope={scope} disabled prefix="导入知识"/></div>
   <Field label="资料标题"><Input disabled={busy} value={title} onChange={(event:any)=>setTitle(event.target.value)}/></Field>
   <Field label="文本文件（Markdown / TXT）"><input type="file" accept=".md,.txt" disabled={busy} aria-label="导入知识文本文件" onChange={(event:any)=>void read(event.target.files?.[0])}/></Field>
   <Field label="资料正文"><Textarea disabled={busy||reading} rows={8} value={body} onChange={(event:any)=>setBody(event.target.value)}/></Field>
   {error&&<p role="alert">{error}</p>}
  </div>
 </Modal>
}
