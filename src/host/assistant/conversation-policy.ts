import {hubSessionOwner} from './hub-store.js'

export const PLAIN_CHAT_BUSINESS_NOTE='普通对话只回答问题，不识别或执行工作台业务指令；请进入消息识别、待办、待回复等对应专用会话处理。'
export const isPlainAssistantChat=(id:string)=>id.startsWith('chat:')
export const plainChatReadOperation=(operation:string)=>['knowledge.search','search','busyReply.status'].includes(operation)

/** Native execution identity wins over any model-supplied conversation ID. */
export function plainChatToolGuard(execution:any,name:string,args:any):string|undefined{
 const sessionId=execution?.agent?.session?.id,owner=sessionId?hubSessionOwner(sessionId):undefined
 if(!owner||!isPlainAssistantChat(owner)||!name.startsWith('workbench_'))return
 if(['workbench_list_tasks','workbench_task_brief','workbench_search','workbench_knowledge_retrieve','workbench_knowledge_read'].includes(name))return
 if(name==='workbench_assistant_action'&&plainChatReadOperation(String(args?.operation||'')))return
 if(name==='workbench_manage_knowledge'&&args?.action==='list'||name==='workbench_manage_replies'&&args?.action==='list')return
 return PLAIN_CHAT_BUSINESS_NOTE
}
/** Also enforce at registered execute boundaries on hosts without tools.guard. */
export function withPlainChatToolGuard(definition:any){
 const execute=definition.execute
 return {...definition,async execute(args:any,execution:any){const denied=plainChatToolGuard(execution,definition.name,args);if(denied)throw Error(denied);return execute(args,execution)}}
}
