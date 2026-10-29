export type KnowledgeMode = 'auto'|'only'|'off'
export interface KnowledgeScope { projectId?:string|null; accountId?:string|null }
export interface KnowledgeHit { id:string; documentId:string; version:string; title:string; text:string; lineStart:number; lineEnd:number; score:number; url?:string|null }
export interface RetrievalResult { id:string; mode:KnowledgeMode; status:'ok'|'empty'|'off'|'error'; query:string; scope:KnowledgeScope; hits:KnowledgeHit[]; elapsedMs:number; note?:string; strategy:string }
export function knowledgeMode(value:unknown):KnowledgeMode{return value==='only'||value==='off'?value:'auto'}
export const KNOWLEDGE_REVIEW_OPTIONS=[{value:'candidate',label:'待审核'},{value:'confirmed',label:'已确认'},{value:'obsolete',label:'已失效'}]
