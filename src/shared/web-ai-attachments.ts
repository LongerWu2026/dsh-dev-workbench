/** Files remain in the renderer; persisted history carries this metadata only. */
export interface WebAIAttachment {id:string;name:string;size:number;type:string}
export interface WebAIFile extends WebAIAttachment {base64:string}
export const WEB_AI_FILE_LIMITS={count:5,single:10*1024*1024,total:20*1024*1024}
export const WEB_AI_FILE_ACCEPT='.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.csv,.json,.log,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx'
export function normalizeWebAIAttachments(raw:unknown):WebAIAttachment[]{
 if(!Array.isArray(raw)||raw.length>WEB_AI_FILE_LIMITS.count)throw new Error('每次最多添加5个附件')
 const names=new Set<string>();let total=0
 return raw.map(a=>{
  if(!a||typeof a.id!=='string'||!/^[\w-]{1,120}$/.test(a.id)||typeof a.name!=='string'||!a.name.trim()||a.name.length>180||/[\x00-\x1f/\\]/.test(a.name)||names.has(a.name))throw new Error('附件名称无效或重复，请使用不同文件名')
  if(!Number.isInteger(a.size)||a.size<=0||a.size>WEB_AI_FILE_LIMITS.single)throw new Error('附件不能为空，单个最大10MB')
  if(!WEB_AI_FILE_ACCEPT.split(',').some(ext=>a.name.toLowerCase().endsWith(ext)))throw new Error('暂不支持此附件格式')
  if(typeof a.type!=='string'||a.type.length>120||a.type&&!/^[\w.+-]+\/[\w.+-]+$/.test(a.type))throw new Error('附件类型无效')
  names.add(a.name);total+=a.size;if(total>WEB_AI_FILE_LIMITS.total)throw new Error('附件总大小不能超过20MB')
  return {id:a.id,name:a.name,size:a.size,type:a.type}
 })
}
