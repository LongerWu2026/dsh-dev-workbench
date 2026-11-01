import * as React from 'react'
import {Btn,Field,Modal,Select} from '../core/runtime.js'

export function AssistantKnowledgeSettings({open,onClose,data,mode,onMode,scope,onScope}:any){
 const projects=data?.projects||[],accounts=[...new Set<string>((data?.sources||[]).map((source:any)=>source.locator?.accountId).filter(Boolean))]
 return <Modal open={open} title="知识设置" sub="应用于后续发送的消息" width={440} onClose={onClose} footer={<Btn kind="primary" onClick={onClose}>完成</Btn>}>
  <div className="wb-stack" style={{gap:14,paddingTop:8}}>
   <Field label="知识模式"><Select aria-label="知识模式" value={mode} onChange={(event:any)=>onMode(event.target.value)} options={[{value:'auto',label:'自动检索'},{value:'only',label:'仅知识库'},{value:'off',label:'关闭'}]}/></Field>
   <Field label="项目范围"><Select aria-label="聊天知识项目" value={scope.projectId===undefined?'__auto':scope.projectId||''} onChange={(event:any)=>onScope({...scope,projectId:event.target.value==='__auto'?undefined:event.target.value||null})} options={[{value:'__auto',label:'项目：自动'},{value:'',label:'个人通用'},...projects.map((project:any)=>({value:project.id,label:project.name}))]}/></Field>
   <Field label="账号范围"><Select aria-label="聊天知识账号" value={scope.accountId===undefined?'__auto':scope.accountId||''} onChange={(event:any)=>onScope({...scope,accountId:event.target.value==='__auto'?undefined:event.target.value||null})} options={[{value:'__auto',label:'账号：自动'},{value:'',label:'通用资料'},...accounts.map(id=>({value:id,label:id}))]}/></Field>
  </div>
 </Modal>
}
