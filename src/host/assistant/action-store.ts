import {existsSync,mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs'
import {join} from 'node:path'
import {hostNowIso,newId,workbenchDir} from '../platform/runtime.js'

export interface AssistantActionEvent {id:string;conversationId:string;at:string;kind:'operation'|'user'|'assistant';text:string;operation?:string;status?:string;before?:any;after?:any;confirmation?:any;result?:any;knowledgeScope?:any;turnId?:string}
export interface AssistantConfirmation {turnId?:string;id:string;conversationId:string;operation:string;title:string;before:any;after:any;fingerprint:string;payload:any;expiresAt:string;state:'pending'|'executing'|'completed'|'failed'|'cancelled';result?:any}
interface ActionStore {version:1;events:AssistantActionEvent[];confirmations:AssistantConfirmation[]}
const path=()=>join(workbenchDir(),'assistant-actions.json')
function read():ActionStore {
 if(!existsSync(path()))return {version:1,events:[],confirmations:[]}
 const store=JSON.parse(readFileSync(path(),'utf8'))
 if(store.version!==1||!Array.isArray(store.events)||!Array.isArray(store.confirmations))throw Error('助手操作记录无法读取，原文件已保留')
 return store
}
function write(store:ActionStore){mkdirSync(workbenchDir(),{recursive:true});const temp=path()+'.'+process.pid+'.tmp';writeFileSync(temp,JSON.stringify(store),{mode:0o600});renameSync(temp,path())}
export function assistantActionEvents(conversationId:string):AssistantActionEvent[]{return read().events.filter(e=>e.conversationId===conversationId)}
export function assistantActionSnapshot(){return read()}
export function appendAssistantActionEvent(conversationId:string,event:Omit<AssistantActionEvent,'id'|'at'|'conversationId'>):AssistantActionEvent {
 const store=read(),row={...event,id:newId('assistant-event'),at:hostNowIso(),conversationId};store.events.push(row);write(store);return row
}
export function assistantConfirmations(conversationId:string){return read().confirmations.filter(c=>c.conversationId===conversationId)}
export function saveAssistantConfirmation(input:Omit<AssistantConfirmation,'id'|'state'|'expiresAt'>):AssistantConfirmation {
 const store=read(),row:AssistantConfirmation={...input,id:newId('confirm'),state:'pending',expiresAt:new Date(Date.now()+15*60000).toISOString()};store.confirmations.push(row);write(store);return row
}
/** Reserve synchronously before awaiting any external operation. A restart cannot replay it. */
export function reserveAssistantConfirmation(conversationId:string,id:string):AssistantConfirmation {
 const store=read(),row=store.confirmations.find(c=>c.id===id&&c.conversationId===conversationId)
 if(!row)throw Error('确认请求不存在或不属于当前会话')
 if(row.state==='completed')return row
 if(row.state!=='pending')throw Error(row.state==='executing'?'该操作正在执行或结果待核实，请勿重复提交':'该确认已失效，请重新预览')
 if(Date.parse(row.expiresAt)<Date.now())throw Error('确认已过期，请重新预览最新内容')
 row.state='executing';write(store);return row
}
export function finishAssistantConfirmation(id:string,state:AssistantConfirmation['state'],result?:any){const store=read(),row=store.confirmations.find(c=>c.id===id);if(!row)throw Error('确认记录不存在');row.state=state;row.result=result;write(store)}
export function cancelAssistantConfirmation(conversationId:string,id:string){const row=assistantConfirmations(conversationId).find(c=>c.id===id);if(!row||row.state!=='pending')throw Error('该确认不存在或已开始执行');finishAssistantConfirmation(id,'cancelled')}
