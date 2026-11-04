export type KnowledgeMode = 'auto'|'only'|'off'
export interface KnowledgeScope { projectId?:string|null; spaceId?:string|null; /** Legacy source metadata, never a login/permission claim. */ accountId?:string|null }
export interface KnowledgeSpace {id:string;name:string;sourceAccountId?:string}
export const PERSONAL_KNOWLEDGE_SPACE='personal'
export const legacyKnowledgeSpace=(accountId:string)=>'source:'+accountId
export const knowledgeSpaceOf=(doc:any)=>doc?.spaceId|| (doc?.accountId?legacyKnowledgeSpace(doc.accountId):PERSONAL_KNOWLEDGE_SPACE)
export function knowledgeSpaces(data:any):KnowledgeSpace[]{
 const rows:KnowledgeSpace[]=[{id:PERSONAL_KNOWLEDGE_SPACE,name:'个人知识'}]
 for(const row of data?.knowledgeSpaces||[])if(row&&typeof row.id==='string'&&row.id&&typeof row.name==='string'&&!rows.some(s=>s.id===row.id))rows.push({id:row.id,name:row.name})
 for(const doc of data?.knowledge||[]){const id=knowledgeSpaceOf(doc);if(!rows.some(s=>s.id===id))rows.push({id,name:doc.accountId?'历史来源资料 '+(rows.filter(s=>s.sourceAccountId).length+1):'历史知识空间',...(doc.accountId?{sourceAccountId:doc.accountId}:{})})}
 return rows
}
export function knowledgeSpaceOptions(data:any){return knowledgeSpaces(data).map(space=>({value:space.id,label:space.name}))}
export interface KnowledgeHit { id:string; documentId:string; version:string; title:string; text:string; lineStart:number; lineEnd:number; score:number; url?:string|null }
export interface RetrievalResult { id:string; mode:KnowledgeMode; status:'ok'|'empty'|'off'|'error'|'deferred'; query:string; scope:KnowledgeScope; hits:KnowledgeHit[]; elapsedMs:number; note?:string; strategy:string; turnId?:string }
export function knowledgeMode(value:unknown):KnowledgeMode{return value==='only'||value==='off'?value:'auto'}
export const KNOWLEDGE_REVIEW_OPTIONS=[{value:'candidate',label:'待审核'},{value:'confirmed',label:'已确认'},{value:'obsolete',label:'已失效'}]
