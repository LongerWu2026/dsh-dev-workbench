import {mkdirSync,readFileSync,writeFileSync,existsSync,renameSync} from 'node:fs'
import {join} from 'node:path'
import {createHash,workbenchDir} from '../platform/runtime.js'
import {MAX_KNOWLEDGE_TEXT,normalizeContentRef} from '../../shared/knowledge-capture.js'
export {MAX_KNOWLEDGE_TEXT,normalizeContentRef}

export function contentDigest(text:string){return createHash('sha256').update(text).digest('hex')}
export function contentPath(hash:string){if(!/^[a-f0-9]{64}$/.test(hash))throw Error('正文快照标识无效');return join(workbenchDir(),'knowledge-content',hash+'.md')}
export function storeKnowledgeContent(text:string){
 if(typeof text!=='string'||!text.trim()||text.length>MAX_KNOWLEDGE_TEXT)throw Error('正文须为1–100万字符')
 const hash=contentDigest(text),path=contentPath(hash)
 mkdirSync(join(workbenchDir(),'knowledge-content'),{recursive:true})
 if(!existsSync(path)||contentDigest(readFileSync(path,'utf8'))!==hash){const temporary=path+'.tmp';writeFileSync(temporary,text,{mode:0o600});renameSync(temporary,path)}
 return {hash,chars:text.length}
}
export function readKnowledgeContent(ref:any):string{
 let text:string;try{text=readFileSync(contentPath(ref?.hash),'utf8')}catch{throw Error('正文快照缺失，请重新采集或导入完整迁移包')}
 if(text.length>MAX_KNOWLEDGE_TEXT||contentDigest(text)!==ref.hash||text.length!==ref.chars)throw Error('正文快照缺失或校验失败，请重新采集')
 return text
}
export function knowledgeBody(doc:any):string{return doc.contentRef?readKnowledgeContent(doc.contentRef):String(doc.body||'')}

/** Portable packages carry only referenced, checksum-verified Markdown, never filesystem paths. */
function referenced(data:any){return [...(data.knowledge||[]).flatMap((doc:any)=>[doc.contentRef,doc.capture?.originalRef]),...(data.radar||[]).map((row:any)=>row.article?.contentRef)].filter(Boolean)}
export function exportKnowledgeContents(data:any){const entries:Record<string,string>={};for(const ref of referenced(data))entries[ref.hash]=readKnowledgeContent(ref);return entries}
export function validateKnowledgeContents(data:any){
 const contents=data.knowledgeContents||{}
 for(const row of referenced(data)){const ref=normalizeContentRef(row),text=ref&&contents[ref.hash];if(!ref||typeof text!=='string'||text.length!==ref.chars||contentDigest(text)!==ref.hash)throw Error('迁移包正文快照缺失或校验失败')}
}
export function importKnowledgeContents(data:any){validateKnowledgeContents(data);for(const ref of referenced(data))storeKnowledgeContent(data.knowledgeContents[ref.hash])}
