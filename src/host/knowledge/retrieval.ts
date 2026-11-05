import { hashText, newId } from '../platform/runtime.js'
import {knowledgeBody} from './content-store.js'
import { knowledgeMode, knowledgeSpaceOf, knowledgeSpaces, legacyKnowledgeSpace, PERSONAL_KNOWLEDGE_SPACE, type KnowledgeScope, type KnowledgeHit, type RetrievalResult } from '../../shared/knowledge.js'

/** Derived index only; every lookup rechecks document hash and scope against current records. */
const cache=new Map<string,{version:string;chunks:KnowledgeHit[]}>()
const SYNONYMS=[['宕机','不可用','故障','中断'],['扩容','内存不足','内存不够','容量不足'],['鉴权','认证','身份校验','权限校验'],['接口','api'],['向量','embedding'],['超时','timeout'],['回滚','撤回发布'],['部署','发布上线']]
const STOP=new Set(['的','了','吗','呢','我','你','我们','怎么','如何','什么','一下','这个','那个','the','a','an','is','to','of','and','please'])
export function knowledgeTokens(text:string):string[]{
 const words=(text||'').replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().match(/[a-z0-9_./-]+|[\u3400-\u9fff]+/g)||[]
 return words.flatMap(word=>/^[\u3400-\u9fff]+$/.test(word)?[...(word.length<=6?[word]:[]),...Array.from({length:Math.max(0,word.length-1)},(_,i)=>word.slice(i,i+2))]:[word,...word.split(/[_./-]/)]).filter(w=>w.length>1&&!STOP.has(w))
}
export function expandKnowledgeQuery(query:string):string{
 return query+' '+SYNONYMS.filter(group=>group.some(term=>query.toLowerCase().includes(term))).flat().join(' ')
}
export function knowledgeVersion(doc:any):string{return hashText(JSON.stringify(['chunks-v3',doc.title,doc.body,doc.contentRef,doc.tags,doc.url,doc.projectId||null,doc.accountId||null,knowledgeSpaceOf(doc),!!doc.sharedAcrossSpaces,doc.reviewState||'candidate',doc.validUntil||null]))}
export function knowledgeAllowed(doc:any,scope:KnowledgeScope,includeCandidates=false):boolean{
 const space=scope.spaceId||(scope.accountId?legacyKnowledgeSpace(scope.accountId):PERSONAL_KNOWLEDGE_SPACE),own=knowledgeSpaceOf(doc)
 const shared=own===PERSONAL_KNOWLEDGE_SPACE&&!doc.projectId&&doc.sharedAcrossSpaces===true
 return !doc.archivedAt && doc.reviewState!=='obsolete' && (doc.reviewState==='confirmed'||includeCandidates) && (!doc.validUntil||Date.parse(doc.validUntil)>Date.now()) && (!doc.projectId||doc.projectId===scope.projectId) && (own===space||shared)
}
export function defaultKnowledgeScope(state:any,request:KnowledgeScope={}):KnowledgeScope{
 const projectId=request.projectId===undefined?state.settings?.defaultProjectId||null:request.projectId
 if(projectId&&!state.projects.some((p:any)=>p.id===projectId))throw new Error('知识检索项目不存在')
 const project=projectId?(state.projects||[]).find((p:any)=>p.id===projectId):null
 const known=knowledgeSpaces(state),legacy=request.accountId?legacyKnowledgeSpace(request.accountId):null
 const spaceId=request.spaceId|| (legacy&&known.some(space=>space.id===legacy)?legacy:project?.knowledgeSpaceId||PERSONAL_KNOWLEDGE_SPACE)
 if(!knowledgeSpaces(state).some(space=>space.id===spaceId))throw new Error('知识空间不存在，请重新选择')
 if(project&&request.spaceId&&spaceId!==(project.knowledgeSpaceId||PERSONAL_KNOWLEDGE_SPACE))throw new Error('项目不属于当前知识空间')
 return {projectId,accountId:request.accountId||null,spaceId}
}
export function chunkKnowledge(doc:any):KnowledgeHit[]{
 const version=knowledgeVersion(doc),prior=cache.get(doc.id)
 if(prior?.version===version)return prior.chunks
 const lines=knowledgeBody(doc).split('\n'),chunks:KnowledgeHit[]=[];let start=0,buffer=''
 const flush=(end:number)=>{if(buffer.trim())chunks.push({id:doc.id+'@'+version.slice(0,16)+':'+(start+1)+':'+(chunks.length+1),documentId:doc.id,version,title:doc.title,text:buffer.trim(),lineStart:start+1,lineEnd:Math.max(start+1,end),score:0,url:doc.url||null});buffer='';start=end}
 // Bounded Chinese-sized fragments fit the 512-token embedding model even for
 // long single-line paragraphs/code. Fragment ordinal disambiguates one line.
 for(let i=0;i<lines.length;i++){
  const line=lines[i]
  if(buffer&&(buffer.length+line.length>350||/^#{1,6}\s/.test(line)))flush(i)
  if(line.length>350){for(let offset=0;offset<line.length;offset+=350){start=i;buffer=line.slice(offset,offset+350);flush(i+1)}}
  else{if(!buffer)start=i;buffer+=line+'\n'}
 }
 flush(lines.length)
 cache.set(doc.id,{version,chunks});if(cache.size>500)cache.delete(cache.keys().next().value!)
 return chunks
}
export function retrieveKnowledge(state:any,query:string,request:any={}):RetrievalResult{
 const began=performance.now(),scope=defaultKnowledgeScope(state,request.scope||{}),mode=knowledgeMode(request.mode)
 const base={id:newId('retrieval'),query:String(query||'').slice(0,2000),scope,mode,hits:[] as KnowledgeHit[],strategy:'local-bm25-chinese',elapsedMs:0}
 if(mode==='off')return {...base,status:'off'}
 const terms=[...new Set(knowledgeTokens(expandKnowledgeQuery(base.query)).slice(0,40))];if(!terms.length)return {...base,status:'empty',note:'问题中没有可检索关键词'}
 const docs=(state.knowledge||[]).filter((d:any)=>knowledgeAllowed(d,scope,request.includeCandidates===true)&&String(d.body||'').trim())
 const corpus=docs.flatMap((d:any)=>chunkKnowledge(d).map(hit=>({hit,tokens:knowledgeTokens([d.title,d.title,(d.tags||[]).join(' '),hit.text].join(' '))})))
 const avg=corpus.reduce((n:any,c:any)=>n+c.tokens.length,0)/Math.max(1,corpus.length)
 const df=new Map(terms.map(term=>[term,corpus.filter((c:any)=>c.tokens.includes(term)).length]))
 const ranked=corpus.map(({hit,tokens}:any)=>{let score=0,matched=0;for(const term of terms){const tf=tokens.filter((t:string)=>t===term).length;if(tf){matched++;const idf=Math.log(1+(corpus.length-(df.get(term)||0)+0.5)/((df.get(term)||0)+0.5));score+=idf*tf*2.2/(tf+1.2*(0.25+0.75*tokens.length/Math.max(1,avg)))}}return {...hit,score,matched}}).filter((r:any)=>r.matched>=Math.min(2,terms.length)&&r.score>0).sort((a:any,b:any)=>b.score-a.score)
 const hits:KnowledgeHit[]=[],seen=new Set<string>();let chars=0
 for(const row of ranked){if(hits.length>=Math.min(8,Math.max(1,Number(request.limit)||5)))break;if(seen.has(row.documentId)||chars+row.text.length>12000)continue;seen.add(row.documentId);chars+=row.text.length;const {matched,...hit}=row;hits.push(hit)}
 return {...base,status:hits.length?'ok':'empty',hits,elapsedMs:Math.round(performance.now()-began),note:hits.length?undefined:ranked.length?'命中内容超过上下文预算，请拆分长段落或代码块后重试':'当前范围没有匹配的已确认有效知识'}
}
export function readKnowledgeChunks(state:any,ids:string[],scope:KnowledgeScope):KnowledgeHit[]{
 if(!Array.isArray(ids)||ids.length>8)throw new Error('每次最多读取8个片段')
 return ids.map(id=>{const doc=(state.knowledge||[]).find((d:any)=>id.startsWith(d.id+'@'));if(!doc||!knowledgeAllowed(doc,scope))throw new Error('知识片段已失效或不属于当前范围');const hit=chunkKnowledge(doc).find(c=>c.id===id);if(!hit)throw new Error('知识版本已更新，请重新检索');return hit})
}
