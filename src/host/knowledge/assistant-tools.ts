import {hubSessionKnowledgeScope} from '../assistant/hub-store.js'
import {identifyActiveHubTurn} from '../assistant/hub-turns.js'
import {loadWorkbenchState,workbenchGenerationGuard} from '../storage/state-store.js'
import {defaultKnowledgeScope,readKnowledgeChunks} from './retrieval.js'
import {knowledgeScopeKey} from './scope.js'
import {retrieveKnowledgeAsync} from './semantic.js'
import {assertKnowledgeSessionScope,recordRetrieval} from './context.js'

/** These tools use the native execution session; model scope arguments never grant access. */
function context(execution:any,args:any={}){
 const session=execution?.agent?.session
 if(!session?.id)throw Error('知识工具需要当前 Harness 会话身份')
 const state=loadWorkbenchState(),turn=identifyActiveHubTurn(session),binding=hubSessionKnowledgeScope(session.id),scope=defaultKnowledgeScope(state,turn?.knowledgeScope||binding||{})
 if(turn?.knowledgeMode==='off')throw Error('本轮已关闭工作台知识检索')
 if(turn?.knowledgeMode==='only')throw Error('本轮仅知识库回答，请使用已经提供的知识片段')
 for(const key of ['projectId','accountId','spaceId'])if(args[key]!==undefined&&(args[key]||null)!==(scope[key as keyof typeof scope]||null))throw Error('知识工具不能切换当前会话的项目、账号或知识空间')
 assertKnowledgeSessionScope(state,session.id,scope)
 const user=(session.snapshotEvents?.()||[]).filter((row:any)=>row.type==='user/message'&&row.data?.source?.kind!=='context').at(-1)
 const fromSeq=turn?.fromSeq??Math.max(0,(user?.seq||1)-1),turnId=turn?.id
 const assertCurrent=()=>{const current=identifyActiveHubTurn(session);if(current?.id!==turnId||knowledgeScopeKey(hubSessionKnowledgeScope(session.id)||{})!==knowledgeScopeKey(binding||{}))throw Error('当前知识轮次或隔离范围已变化，未返回旧检索结果')}
 return {session,scope,turn,turnId,fromSeq,assertCurrent}
}
export function assistantKnowledgeToolGuard(execution:any,name:string,args:any={}){
 const reads=name==='workbench_knowledge_retrieve'||name==='workbench_knowledge_read'||name==='workbench_assistant_action'&&args.operation==='knowledge.search'||name==='workbench_manage_knowledge'&&args.action==='list'
 if(reads&&identifyActiveHubTurn(execution?.agent?.session)?.knowledgeMode==='off')return '本轮已关闭工作台知识检索'
}
export async function retrieveAssistantToolKnowledge(execution:any,args:any={}){
 const c=context(execution,args),query=String(args.query||'').trim()
 if(!query||query.length>2000)throw Error('知识查询需要 1–2000 字符')
 const assertGeneration=workbenchGenerationGuard(),result=await retrieveKnowledgeAsync(loadWorkbenchState(),query,{mode:'auto',scope:c.scope})
 assertGeneration();c.assertCurrent()
 if(result.hits.length)readKnowledgeChunks(loadWorkbenchState(),result.hits.map((hit:any)=>hit.id),c.scope)
 if(c.turn?.knowledgeRetrievalId)result.id=c.turn.knowledgeRetrievalId
 result.turnId=c.turnId
 const prior=(loadWorkbenchState().retrievalTraces||[]).find((trace:any)=>trace.id===result.id&&trace.sessionId===c.session.id)
 const hits=[...new Map([...(prior?.hits||[]),...result.hits].map((hit:any)=>[hit.id,hit])).values()]
 if(hits.length>40)throw Error('本轮已检索过多知识片段，请缩小问题范围')
 await recordRetrieval({...result,hits,status:hits.length?'ok':result.status,...(hits.length&&result.status==='empty'?{note:'本轮已有 '+hits.length+' 个知识片段；本次查询未命中。'}:{})},c.session.id,c.fromSeq)
 assertGeneration();c.assertCurrent()
 return result
}
export async function readAssistantToolKnowledge(execution:any,args:any={}){
 const c=context(execution,args)
 const traces=(loadWorkbenchState().retrievalTraces||[]).filter((trace:any)=>trace.sessionId===c.session.id&&(c.turnId?trace.turnId===c.turnId:trace.fromSeq===c.fromSeq)&&knowledgeScopeKey(trace.scope)===knowledgeScopeKey(c.scope))
 const allowed=new Set(traces.flatMap((trace:any)=>trace.hits||[]).map((hit:any)=>hit.id))
 if(!Array.isArray(args.ids)||args.ids.length>8||args.ids.some((id:any)=>!allowed.has(id)))throw Error('请先检索本轮当前范围的知识片段，再读取返回的真实片段 ID')
 const hits=readKnowledgeChunks(loadWorkbenchState(),args.ids,c.scope);c.assertCurrent();return {hits}
}
