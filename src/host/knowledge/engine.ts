import {knowledgeScopeKey} from './scope.js'
import {localEmbeddingStatus,configureLocalEmbedding,prepareLocalEmbedding,localEmbeddingVectors} from './local-embedding.js'
import {loadWorkbenchState,workbenchGenerationGuard} from '../storage/state-store.js'
import {knowledgeAllowed,chunkKnowledge,defaultKnowledgeScope} from './retrieval.js'

let indexing:Promise<void>|null=null
const pending=new Map<string,any>()
let progress:any={phase:'idle',total:0,processed:0,note:''}
export async function knowledgeEngine(request:any={}){
 const action=request.action||'status'
 if(action==='enable'){await configureLocalEmbedding(true);prepareLocalEmbedding()}
 else if(action==='disable'){pending.clear();await configureLocalEmbedding(false)}
 else if(action==='prepare')prepareLocalEmbedding()
 else if(action==='index'){
  const engine=await localEmbeddingStatus();if(!engine.enabled||!engine.installed)throw Error('请先启用并完成模型准备')
  if(!indexing){
   const state=loadWorkbenchState(),scope=defaultKnowledgeScope(state,request.scope||{}),assertCurrent=workbenchGenerationGuard()
   const chunks=(state.knowledge||[]).filter((doc:any)=>knowledgeAllowed(doc,scope)&&doc.body?.trim()).flatMap(chunkKnowledge)
   progress={phase:'indexing',total:chunks.length,processed:0,note:'',scope}
   indexing=(async()=>{for(let index=0;index<chunks.length;index+=8){assertCurrent();const batch=chunks.slice(index,index+8);await localEmbeddingVectors(batch.map((hit:any)=>({id:hit.id,text:String(hit.title||'').slice(0,80)+'\n'+hit.text})));assertCurrent();progress.processed+=batch.length}progress.phase='ready';progress.note='当前范围索引已更新'})().catch(error=>{progress.phase='error';progress.note=String(error.message||error).slice(0,180)}).finally(()=>{indexing=null;const next=pending.entries().next().value;if(next){pending.delete(next[0]);void knowledgeEngine({action:'index',scope:next[1]}).catch(()=>{})}})
  }else{const scope=defaultKnowledgeScope(loadWorkbenchState(),request.scope||{});pending.set(knowledgeScopeKey(scope),scope)}
 }else if(action!=='status')throw Error('未知知识引擎操作')
 return {...await localEmbeddingStatus(),index:{...progress}}
}

export async function scheduleKnowledgeIndex(scope:any){
 const status=await localEmbeddingStatus()
 if(status.enabled&&status.installed)await knowledgeEngine({action:'index',scope})
}
