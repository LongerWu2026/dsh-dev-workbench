export const MAX_KNOWLEDGE_TEXT=1000000
export function normalizeContentRef(ref:any){return ref&&/^[a-f0-9]{64}$/.test(ref.hash)&&Number.isInteger(ref.chars)&&ref.chars>0&&ref.chars<=MAX_KNOWLEDGE_TEXT?{hash:ref.hash,chars:ref.chars}:null}
export function normalizeKnowledgeCapture(value:any){
 if(!value||!/^[a-f0-9]{64}$/.test(value.sourceKey)||!/^[a-f0-9]{64}$/.test(value.contentHash))return null
 const input=value.source||{},source:any={}
 for(const key of ['kind','key','label','accountId','groupId','conversationId','turnId','sessionId','messageId','radarId','url','publishedAt','question'])if(typeof input[key]==='string')source[key]=input[key].slice(0,key==='question'?4000:2000)
 if(Array.isArray(input.messageIds))source.messageIds=input.messageIds.slice(0,100).filter((id:any)=>typeof id==='string').map((id:string)=>id.slice(0,200))
 source.linkOnly=input.linkOnly===true
 return {sourceKey:value.sourceKey,contentHash:value.contentHash,source,originalRef:normalizeContentRef(value.originalRef)}
}
