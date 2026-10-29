import { hashText, newId } from '../platform/runtime.js'
import { knowledgeMode, type KnowledgeScope, type KnowledgeHit, type RetrievalResult } from '../../shared/knowledge.js'

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
export function knowledgeVersion(doc:any):string{return hashText(JSON.stringify([doc.title,doc.body,doc.tags,doc.url,doc.projectId||null,doc.accountId||null,doc.reviewState||'candidate',doc.validUntil||null]))}
export function knowledgeAllowed(doc:any,scope:KnowledgeScope,includeCandidates=false):boolean{
 return !doc.archivedAt && doc.reviewState!=='obsolete' && (doc.reviewState==='confirmed'||includeCandidates) && (!doc.validUntil||Date.parse(doc.validUntil)>Date.now()) && (!doc.projectId||doc.projectId===scope.projectId) && (!doc.accountId||doc.accountId===scope.accountId)
}
export function defaultKnowledgeScope(state:any,request:KnowledgeScope={}):KnowledgeScope{
 const projectId=request.projectId===undefined?state.settings?.defaultProjectId||null:request.projectId
 if(projectId&&!state.projects.some((p:any)=>p.id===projectId))throw new Error('知识检索项目不存在')
 const accounts=[...new Set<string>((state.sources||[]).map((s:any)=>s.locator?.accountId).filter(Boolean))]
 const accountId=request.accountId===undefined?(accounts.length===1?accounts[0]:null):request.accountId
 return {projectId,accountId:accountId||null}
}
export function chunkKnowledge(doc:any):KnowledgeHit[]{
 const version=knowledgeVersion(doc),prior=cache.get(doc.id)
 if(prior?.version===version)return prior.chunks
 const lines=String(doc.body||'').split('\n'),chunks:KnowledgeHit[]=[];let start=0,buffer='',fenced=false
 const flush=(end:number)=>{if(buffer.trim())chunks.push({id:doc.id+'@'+version.slice(0,16)+':'+(start+1),documentId:doc.id,version,title:doc.title,text:buffer.trim(),lineStart:start+1,lineEnd:end,score:0,url:doc.url||null});buffer='';start=end}
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(/^\s*```/.test(line))fenced=!fenced
  if(buffer&&!fenced&&(buffer.length+line.length>1000||/^#{1,6}\s/.test(line)))flush(i)
  buffer+=line+'\n'
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
