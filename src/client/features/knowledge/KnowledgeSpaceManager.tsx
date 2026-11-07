import * as React from 'react'
import {WB,Btn,Input,Field,Select,Modal} from '../../core/runtime.js'
import {knowledgeSpaceOptions} from '../../../shared/knowledge.js'

export function KnowledgeSpaceManager({data,scope,onClose}:any){
 const [name,setName]=React.useState(''),[project,setProject]=React.useState(''),[space,setSpace]=React.useState(scope.spaceId||'personal'),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('')
 const lock=React.useRef(false),active=React.useRef(true)
 React.useEffect(()=>{active.current=true;return()=>{active.current=false}},[])
 async function save(request:any){
  if(lock.current)return;lock.current=true;setBusy(true);setError('')
  try{await WB.actions.knowledgeSpace(request);await WB.actions.reload();if(active.current)onClose()}
  catch(failure:any){if(active.current)setError(failure.message)}
  finally{lock.current=false;if(active.current)setBusy(false)}
 }
 return <Modal open title="管理知识空间" width={480} onClose={()=>!busy&&onClose()} footer={<Btn disabled={busy} onClick={onClose}>关闭</Btn>}>
  <div className="wb-stack" style={{gap:12}}>
   <Field label="新空间名称"><Input aria-label="新知识空间名称" disabled={busy} value={name} onChange={(event:any)=>setName(event.target.value)} placeholder="例如：公司资料、客户项目"/></Field>
   <Btn disabled={busy||!name.trim()} onClick={()=>save({action:'create',name:name.trim()})}>创建知识空间</Btn>
   <Field label="项目归属"><Select aria-label="归属项目" disabled={busy} value={project} onChange={(event:any)=>setProject(event.target.value)} options={[{value:'',label:'选择项目'},...(data?.projects||[]).map((row:any)=>({value:row.id,label:row.name}))]}/></Field>
   <Field label="归属空间"><Select aria-label="项目归属空间" disabled={busy} value={space} onChange={(event:any)=>setSpace(event.target.value)} options={knowledgeSpaceOptions(data)}/></Field>
   <p className="wb-tiny wb-muted">设置后，该项目已有知识随项目归属进入目标空间，原文和来源账号保留。</p>
   <Btn disabled={busy||!project} onClick={()=>save({action:'assignProject',projectId:project,spaceId:space})}>保存项目归属</Btn>
   {error&&<p role="alert">{error}</p>}
  </div>
 </Modal>
}
