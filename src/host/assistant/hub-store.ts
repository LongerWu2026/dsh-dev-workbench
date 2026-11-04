import {existsSync,mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {workbenchDir} from '../platform/runtime.js'

export interface HubThread {id:string;title:string;createdAt:string;lastAt:string;nativeTitle?:string;knowledgeScope?:{projectId?:string|null;accountId?:string|null;spaceId?:string|null}}
export interface OfficeTopic {kind:'work_report'|'reply_batch';input:{period?:'day'|'week';replyIds?:string[]};date?:string;from?:string;to?:string}
export interface HubConversation {id:string;title:string;activeId:string;threads:HubThread[];pinned?:boolean;createdAt?:string;officeTopic?:OfficeTopic;selection?:{sessionId:string;primarySessionId?:string};admission?:{origin:'created'|'adopted';sessionId:string;at:string}}
export interface HubRunLink {sessionId:string;fromSeq:number;toSeq:number;purpose:string;accountId?:string}
interface HubIndex {version:1;conversations:HubConversation[];runs:Record<string,{links:HubRunLink[];items:any[];conversationId?:string}>}
const path=()=>join(workbenchDir(),'assistant-hub.json')
export function hubIndex():HubIndex {
    if(!existsSync(path()))return {version:1,conversations:[],runs:{}}
    const value=JSON.parse(readFileSync(path(),'utf8'))
    if(value.version!==1||!Array.isArray(value.conversations)||!value.runs||typeof value.runs!=='object')throw Error('助手会话索引无法读取，已保留原文件')
    return value
}
function save(value:HubIndex){mkdirSync(workbenchDir(),{recursive:true});const temp=path()+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(value,null,2),{mode:0o600});renameSync(temp,path())}
export function hubSessionOwner(sessionId:string):string|undefined{return hubIndex().conversations.find(row=>row.threads.some(thread=>thread.id===sessionId))?.id}
export function hubSessionKnowledgeScope(sessionId:string){return hubIndex().conversations.flatMap(row=>row.threads).find(row=>row.id===sessionId)?.knowledgeScope}
export function hubSessionNativeTitle(sessionId:string){return hubIndex().conversations.flatMap(row=>row.threads).find(row=>row.id===sessionId)?.nativeTitle}
export function rememberHubNativeTitle(sessionId:string,title:string){const value=hubIndex(),thread=value.conversations.flatMap(row=>row.threads).find(row=>row.id===sessionId);if(!thread)throw Error('找不到会话归属');thread.nativeTitle=title;save(value)}
export function setHubSessionKnowledgeScope(sessionId:string,scope:{projectId?:string|null;accountId?:string|null;spaceId?:string|null}){const value=hubIndex(),thread=value.conversations.flatMap(row=>row.threads).find(row=>row.id===sessionId);if(!thread)throw Error('找不到会话归属');thread.knowledgeScope=scope;save(value)}
export function rememberHubConversation(id:string,title:string){const value=hubIndex();if(!value.conversations.some(row=>row.id===id)){value.conversations.push({id,title,activeId:'',threads:[]});save(value)}}
export function rememberOfficeTopic(id:string,title:string,topic:OfficeTopic){const value=hubIndex(),existing=value.conversations.find(row=>row.id===id);if(existing){if(JSON.stringify(existing.officeTopic)!==JSON.stringify(topic))throw Error('主题身份与已有会话不一致');return existing}const row:HubConversation={id,title,activeId:'',threads:[],createdAt:new Date().toISOString(),officeTopic:topic};value.conversations.push(row);save(value);return row}
export function pinHubConversation(id:string,title:string,pinned:boolean){if(typeof pinned!=='boolean')throw Error('请明确置顶或取消置顶');const value=hubIndex();let row=value.conversations.find(row=>row.id===id);if(!row){row={id,title,activeId:'',threads:[],createdAt:new Date().toISOString()};value.conversations.push(row)}row.pinned=pinned;save(value);return row}
export function rememberHubSession(conversationId:string,sessionId:string,title:string,options?:{selected?:boolean;primarySessionId?:string;admission?:'created'|'adopted'}){
    const value=hubIndex(),owner=value.conversations.find(row=>row.threads.some(thread=>thread.id===sessionId))
    if(owner&&owner.id!==conversationId)throw Error('会话已关联另一事项，不能混用')
    const at=new Date().toISOString();let row=value.conversations.find(row=>row.id===conversationId)
    if(!row){row={id:conversationId,title,activeId:sessionId,threads:[]};value.conversations.push(row)}
    let thread=row.threads.find(thread=>thread.id===sessionId)
    if(!thread){thread={id:sessionId,title,createdAt:at,lastAt:at};row.threads.push(thread)}
    thread.lastAt=at;row.activeId=sessionId;row.title=title;if(options?.selected)row.selection={sessionId,...(options.primarySessionId?{primarySessionId:options.primarySessionId}:{})};if(options?.admission&&conversationId==='chat:'+sessionId)row.admission={origin:options.admission,sessionId,at};save(value)
}
/** Native identities and sequence boundaries stay local, outside portable business exports. */
export function recordHubRun(runId:string,links:HubRunLink[],items:any[]){
    const value=hubIndex(),prior=value.runs[runId]||{links:[],items:[]}
    for(const link of links){
        // Keep individual ranges: an interactive turn must never be attributed to a batch.
        const previous=prior.links.find(row=>row.sessionId===link.sessionId&&row.fromSeq===link.fromSeq&&row.purpose===link.purpose)
        if(previous)previous.toSeq=Math.max(previous.toSeq,link.toSeq);else prior.links.push(link)
    }
    const byId=new Map(prior.items.map(item=>[item.kind+':'+item.id,item]));for(const item of items)byId.set(item.kind+':'+item.id,item)
    value.runs[runId]={...prior,links:prior.links,items:[...byId.values()]};save(value)
}

/** Persist the first office owner before exposing a newly selected shared job. */
export function rememberOfficeJobOwner(jobId:string,conversationId:string):string{const value=hubIndex(),run=value.runs[jobId]||{links:[],items:[]};if(!run.conversationId){run.conversationId=conversationId;value.runs[jobId]=run;save(value)}return run.conversationId}
