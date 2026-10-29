import { retrieveKnowledge, knowledgeAllowed, chunkKnowledge } from './retrieval.js'
import { hashText } from '../platform/runtime.js'
import type { KnowledgeHit } from '../../shared/knowledge.js'
const vectors=new Map<string,number[]>()
function cosine(a:number[],b:number[]){const norm=Math.hypot(...a)*Math.hypot(...b);return norm?a.reduce((n,v,i)=>n+v*b[i],0)/norm:0}
/** Optional Ollama /api/embed provider. No endpoint/model configured => no network or new dependency. */
export async function retrieveKnowledgeAsync(state:any,query:string,request:any={}){
 const local=retrieveKnowledge(state,query,request),endpoint=process.env.AWB_EMBEDDING_URL,model=process.env.AWB_EMBEDDING_MODEL
 if(local.status==='off'||!endpoint||!model)return local
 const began=performance.now(),controller=new AbortController();let timer:any
 try{
  const url=new URL(endpoint);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search)throw new Error('Embedding地址格式无效')
  const all=(state.knowledge||[]).filter((d:any)=>knowledgeAllowed(d,local.scope)&&d.body?.trim()).flatMap(chunkKnowledge)
  if(all.length>200)return {...local,note:'当前范围超过200片段，保留本地全文检索；请缩小项目范围再使用语义检索'}
  if(!all.length)return local
  const key=(h:KnowledgeHit)=>hashText(JSON.stringify([endpoint,model,h.id,h.title,h.text]))
  if(vectors.size>800)vectors.clear()
  const missing=all.filter((h:KnowledgeHit)=>!vectors.has(key(h)))
  const operation=(async()=>{
   const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',...(process.env.AWB_EMBEDDING_TOKEN?{Authorization:'Bearer '+process.env.AWB_EMBEDDING_TOKEN}:{})},body:JSON.stringify({model,input:[query,...missing.map((h:KnowledgeHit)=>h.title+'\n'+h.text)],truncate:false}),signal:controller.signal})
   if(!response.ok)throw new Error('Embedding HTTP '+response.status)
   const raw=await response.text();if(raw.length>4*1024*1024)throw new Error('Embedding响应过大')
   const rows=JSON.parse(raw).embeddings
   if(!Array.isArray(rows)||rows.length!==missing.length+1||rows.some((v:any)=>!Array.isArray(v)||v.length<1||v.length>8192||v.length!==rows[0].length||v.some((n:any)=>typeof n!=='number'||!Number.isFinite(n))))throw new Error('Embedding响应维度或数量无效')
   return rows as number[][]
  })()
  const rows=await Promise.race([operation,new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Embedding请求超时'))},8000)})])
  missing.forEach((h:KnowledgeHit,i:number)=>vectors.set(key(h),rows[i+1]))
  const semantic=all.map((h:KnowledgeHit)=>({...h,similarity:cosine(rows[0],vectors.get(key(h))||rows[missing.findIndex((m:KnowledgeHit)=>m.id===h.id)+1]||[])})).filter((h:any)=>h.similarity>=0.35).sort((a:any,b:any)=>b.similarity-a.similarity)
  const fused=new Map<string,{hit:KnowledgeHit;score:number}>()
  for(const list of [local.hits,semantic])list.forEach((h:KnowledgeHit,index:number)=>{const prior=fused.get(h.id)||{hit:h,score:0};prior.score+=1/(60+index+1);fused.set(h.id,prior)})
  const hits:KnowledgeHit[]=[],docs=new Set<string>();let chars=0
  for(const item of [...fused.values()].sort((a,b)=>b.score-a.score)){if(hits.length>=Math.min(8,Number(request.limit)||5))break;if(docs.has(item.hit.documentId)||chars+item.hit.text.length>12000)continue;docs.add(item.hit.documentId);chars+=item.hit.text.length;hits.push({...item.hit,score:item.score})}
  return {...local,status:hits.length?'ok' as const:'empty' as const,hits,note:hits.length?undefined:local.note,strategy:'hybrid-bm25-vector-rrf',elapsedMs:Math.round(performance.now()-began)}
 }catch(error){return {...local,status:local.hits.length?local.status:'error' as const,note:'语义检索不可用，已保留本地全文检索：'+String(error.message||error).slice(0,120),elapsedMs:Math.round(performance.now()-began)}}finally{clearTimeout(timer)}
}
