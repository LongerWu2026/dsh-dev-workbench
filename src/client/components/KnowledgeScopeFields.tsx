import * as React from 'react'
import {Field,Select} from '../core/runtime.js'
import {knowledgeSpaceOptions,PERSONAL_KNOWLEDGE_SPACE} from '../../shared/knowledge.js'

export function KnowledgeScopeFields({data,scope,onChange,automatic=false,prefix='知识',disabled=false}:any){
 const spaces=knowledgeSpaceOptions(data),space=scope.spaceId||PERSONAL_KNOWLEDGE_SPACE
 const projects=(data?.projects||[]).filter((project:any)=>automatic&&scope.spaceId===undefined||(project.knowledgeSpaceId||PERSONAL_KNOWLEDGE_SPACE)===space||scope.projectId===project.id)
 function change(patch:any){const {accountId,...rest}=scope;onChange({...rest,...patch})}
 return <>
  <Field label="知识空间"><Select disabled={disabled} aria-label={prefix+'空间'} value={automatic&&scope.spaceId===undefined?'__auto':space} onChange={(event:any)=>change({spaceId:event.target.value==='__auto'?undefined:event.target.value,projectId:automatic?undefined:null})} options={[...(automatic?[{value:'__auto',label:'自动跟随当前事项'}]:[]),...spaces]}/></Field>
  <Field label="项目范围"><Select disabled={disabled} aria-label={prefix+'项目'} value={automatic&&scope.projectId===undefined?'__auto':scope.projectId||''} onChange={(event:any)=>{const value=event.target.value,project=(data?.projects||[]).find((row:any)=>row.id===value);change({projectId:value==='__auto'?undefined:value||null,...(project?{spaceId:project.knowledgeSpaceId||PERSONAL_KNOWLEDGE_SPACE}:{})})}} options={[...(automatic?[{value:'__auto',label:'自动跟随当前事项'}]:[]),{value:'',label:'空间通用资料'},...projects.map((project:any)=>({value:project.id,label:project.name}))]}/></Field>
 </>
}
