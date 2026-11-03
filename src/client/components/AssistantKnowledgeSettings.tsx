import {KnowledgeScopeFields} from './KnowledgeScopeFields.js'
import * as React from 'react'
import {Btn,Field,Modal,Select} from '../core/runtime.js'

export function AssistantKnowledgeSettings({open,onClose,data,mode,onMode,scope,onScope}:any){
 return <Modal open={open} title="知识设置" sub="应用于后续发送的消息" width={440} onClose={onClose} footer={<Btn kind="primary" onClick={onClose}>完成</Btn>}>
  <div className="wb-stack" style={{gap:14,paddingTop:8}}>
   <Field label="知识模式"><Select aria-label="知识模式" value={mode} onChange={(event:any)=>onMode(event.target.value)} options={[{value:'auto',label:'自动检索'},{value:'only',label:'仅知识库'},{value:'off',label:'关闭'}]}/></Field>
   <KnowledgeScopeFields data={data} scope={scope} onChange={onScope} automatic prefix="聊天知识"/>
   <p className="wb-tiny wb-muted">自动跟随当前事项的项目。切换隔离范围后使用独立会话，原会话与草稿保留。</p>
  </div>
 </Modal>
}
