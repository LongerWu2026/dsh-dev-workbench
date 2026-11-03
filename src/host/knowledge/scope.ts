import {knowledgeSpaceOf,PERSONAL_KNOWLEDGE_SPACE,legacyKnowledgeSpace,type KnowledgeScope} from '../../shared/knowledge.js'
import {defaultKnowledgeScope,knowledgeAllowed} from './retrieval.js'

export const knowledgeScopeKey=(scope:KnowledgeScope={})=>JSON.stringify({projectId:scope.projectId||null,accountId:scope.accountId||null,spaceId:scope.spaceId||(scope.accountId?legacyKnowledgeSpace(scope.accountId):PERSONAL_KNOWLEDGE_SPACE)})
/** Resolve business ownership before retrieval/session selection, not from a model guess. */
export function assistantKnowledgeScope(state:any,input:any={},entity?:any):KnowledgeScope{
 const explicit={...(input.knowledgeScope||{}),...Object.fromEntries(['projectId','spaceId','accountId'].filter(key=>input[key]!==undefined).map(key=>[key,input[key]]))}
 const refs=Array.isArray(input.refs)?input.refs:[],records:any[]=[]
 const unboundDevelopment=entity?.issue&&entity?.projectId&&!(state.projects||[]).some((project:any)=>project.id===entity.projectId)
 if(entity)records.push(unboundDevelopment?{...entity,projectId:null}:entity)
 if(input.taskId){const task=(state.tasks||[]).find((row:any)=>row.id===input.taskId);if(task)records.push(task)}
 const id=String(input.conversationId||''),kind=id.split(':')[0],key=id.slice(kind.length+1),collection=({task:'tasks',reply:'replies',knowledge:'knowledge',radar:'radar'} as any)[kind]
 if(collection){const row=(state[collection]||[]).find((row:any)=>row.id===key);if(row)records.push(row)}
 for(const ref of refs){const bucket=({task:'tasks',reply:'replies',source:'sources',knowledge:'knowledge',radar:'radar'} as any)[ref.kind];const row=(state[bucket]||[]).find((row:any)=>row.id===ref.id);if(row)records.push(row)}
 for(const row of [...records])if(row.sourceId){const source=(state.sources||[]).find((source:any)=>source.id===row.sourceId);if(source)records.push(source)}
 for(const row of [...records])for(const taskId of row.taskIds||[]){const task=(state.tasks||[]).find((task:any)=>task.id===taskId);if(task)records.push(task)}
 const projectIds=[...new Set(records.map(row=>row.projectId).filter(Boolean))]
 if(projectIds.length>1)throw Error('请只选择同一项目的上下文，再进行知识检索')
 if(projectIds.length&&explicit.projectId!==undefined&&explicit.projectId!==projectIds[0])throw Error('知识范围与当前事项项目不一致')
 const knowledgeRefs=refs.filter((ref:any)=>ref.kind==='knowledge').map((ref:any)=>(state.knowledge||[]).find((doc:any)=>doc.id===ref.id)).filter(Boolean)
 if(kind==='knowledge'){const doc=(state.knowledge||[]).find((doc:any)=>doc.id===key);if(doc)knowledgeRefs.push(doc)}
 const spaces=[...new Set(knowledgeRefs.filter((doc:any)=>!doc.sharedAcrossSpaces).map(knowledgeSpaceOf))]
 if(spaces.length>1)throw Error('请只选择同一知识空间的上下文')
 const projectId=explicit.projectId===undefined?projectIds[0]??(unboundDevelopment?null:state.settings?.defaultProjectId)??null:explicit.projectId
 const scope=defaultKnowledgeScope(state,{...explicit,projectId,spaceId:explicit.spaceId===undefined?spaces[0]:explicit.spaceId})
 for(const doc of knowledgeRefs)if(!knowledgeAllowed(doc,scope,true))throw Error('引用资料不属于当前知识空间或项目，请切换到对应范围')
 return scope
}
