import {randomUUID} from 'node:crypto'
import {loadWorkbenchState,mutateWorkbenchState,workbenchGenerationGuard} from '../storage/state-store.js'
import {auditEntry,normalizeKnowledge} from '../domain/model.js'
import {defaultKnowledgeScope,knowledgeAllowed} from '../knowledge/retrieval.js'
import {knowledgeBody,readKnowledgeContent,storeKnowledgeContent,MAX_KNOWLEDGE_TEXT,contentDigest as hashText} from '../knowledge/content-store.js'
import {scheduleKnowledgeIndex} from '../knowledge/engine.js'
import {selectedConversationMessages} from './source-service.js'
import {getHubTurn,projectLegacyHubTurns} from '../assistant/hub-turns.js'
import {hubSessionKnowledgeScope,hubSessionOwner} from '../assistant/hub-store.js'
import {finalAssistantOutput} from '../assistant/final-output.js'
import {readRadarArticle} from '../news/article.js'
import {workbenchContext} from './service-context.js'

const drafts=new Map<string,any>(),TTL=30*60*1000
function canonicalUrl(value:string){const url=new URL(value);url.hash='';for(const key of [...url.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(key))url.searchParams.delete(key);return url.href}
function selectedScope(state:any,input:any,bound?:any){
 const scope=defaultKnowledgeScope(state,input||bound||{})
 if(bound&&(scope.spaceId!==defaultKnowledgeScope(state,bound).spaceId||scope.projectId!==defaultKnowledgeScope(state,bound).projectId))throw Error('不能将当前项目或知识空间的回答保存到其他范围')
 return scope
}
async function prepare(request:any){
 const state=loadWorkbenchState(),ctx=workbenchContext(),active=workbenchGenerationGuard()
 let title='',body='',url=null,source:any,bound:any
 if(request.kind==='messages'){
  const selected=await selectedConversationMessages(request);active()
  title=selected.name+' · 消息笔记'
  body=selected.messages.map((row:any)=>`### ${row.sender} · ${row.at||'时间未注明'}\n\n${row.text}`).join('\n\n')
  source={kind:'messages',key:hashText(JSON.stringify([selected.accountId,selected.groupId,selected.messages.map((row:any)=>row.id).sort()])),label:'云之家 · '+selected.name,accountId:selected.accountId,groupId:selected.groupId,messageIds:selected.messages.map((row:any)=>row.id)}
 }else if(request.kind==='assistant'){
  const session=ctx?.get?.('sessions')?.get(request.sessionId)
  const turn=getHubTurn(request.turnId)||(hubSessionOwner(request.sessionId)===request.conversationId?projectLegacyHubTurns(request.conversationId,session,{knowledgeScope:hubSessionKnowledgeScope(request.sessionId)}).find(row=>row.id===request.turnId):null)
  if(!turn||turn.conversationId!==request.conversationId||turn.status!=='completed'||turn.source!=='ai'||!turn.reply?.trim()||turn.replySource==='tools')throw Error('仅能保存本轮已经完成的 AI 最终回答')
  bound=turn.knowledgeScope||hubSessionKnowledgeScope(turn.sessionId||'')
  title=turn.text.slice(0,100)||'AI 回答笔记';body='## 问题\n\n'+turn.text+'\n\n## 回答\n\n'+turn.reply
  source={kind:'assistant',key:hashText(JSON.stringify([turn.conversationId,turn.sessionId,turn.id])),label:'AI 回答',conversationId:turn.conversationId,turnId:turn.id,sessionId:turn.sessionId,question:turn.text.slice(0,4000)}
 }else if(request.kind==='native'){
  const session=ctx?.get?.('sessions')?.get(request.sessionId),events=session?.snapshotEvents?.()||[]
  const index=events.findIndex((event:any)=>event.type==='assistant/message'&&[event.data?.message?.id,event.data?.messageId,String(event.seq)].includes(request.messageId))
  if(index<0)throw Error('原回复已不可用')
  let start=index;while(start>0&&!['turn/start','user/message'].includes(events[start].type))start--
  let end=index+1;while(end<events.length&&!['turn/start','user/message'].includes(events[end].type))end++
  const output=finalAssistantOutput(events.slice(start,end))
  if(!output?.text||output.event!==events[index])throw Error('仅能保存本轮最后的定稿回答，不能保存思考或中间输出')
  bound=hubSessionKnowledgeScope(request.sessionId);body=output.text;title=body.split('\n')[0].replace(/^#+\s*/,'').slice(0,100)
  source={kind:'native',key:hashText(JSON.stringify([request.sessionId,request.messageId])),label:'Harness AI 回答',sessionId:request.sessionId,messageId:request.messageId}
 }else if(request.kind==='radar'){
  const row=state.radar.find((row:any)=>row.id===request.id);if(!row?.url)throw Error('资讯不存在或缺少链接')
  title=row.title;url=row.url
  if(request.linkOnly!==true){const article=await readRadarArticle(ctx,row.id,request.reload===true);active();body=article.body}
  source={kind:'radar',key:hashText(canonicalUrl(row.url)),label:row.source||'资讯',radarId:row.id,url:row.url,publishedAt:row.publishedAt||null,linkOnly:request.linkOnly===true}
 }else throw Error('不支持的笔记来源')
 const scope=selectedScope(loadWorkbenchState(),request.scope,bound)
 for(const [id,draft] of drafts)if(draft.expires<Date.now())drafts.delete(id)
 if(drafts.size>=60)drafts.delete(drafts.keys().next().value!)
 const draftId=randomUUID();drafts.set(draftId,{title,body,url,source,scope,bound,expires:Date.now()+TTL})
 return {status:'ok',draftId,title,body,url,source,scope,scopeLocked:!!bound}
}
export const knowledgeCaptureService={
 async radarArticle(request:any){return readRadarArticle(workbenchContext(),request.id,request.reload===true)},
 async knowledgeCapture(request:any={}):Promise<any>{
  if(request.action==='prepare')return prepare(request)
  if(request.action==='search'){
   const state=loadWorkbenchState(),scope=defaultKnowledgeScope(state,request.scope||{}),query=String(request.query||'').trim().toLowerCase()
   if(!query||query.length>500)throw Error('笔记搜索内容须为1–500字符')
   return {status:'ok',ids:state.knowledge.filter((doc:any)=>doc.contentRef&&knowledgeAllowed(doc,scope,true)&&knowledgeBody(doc).toLowerCase().includes(query)).map((doc:any)=>doc.id)}
  }
  if(request.action==='read'){
   const state=loadWorkbenchState(),scope=defaultKnowledgeScope(state,request.scope||{}),doc=state.knowledge.find((row:any)=>row.id===request.id)
   if(!doc||!knowledgeAllowed(doc,scope,true))throw Error('笔记不属于当前知识空间或项目')
   return {status:'ok',item:{...doc,body:request.original===true&&doc.capture?.originalRef?readKnowledgeContent(doc.capture.originalRef):knowledgeBody(doc)}}
  }
  if(request.action!=='save')throw Error('未知笔记操作')
  const draft=drafts.get(request.draftId);if(!draft||draft.expires<Date.now())throw Error('笔记草稿已过期，请重新选择来源')
  const scope=selectedScope(loadWorkbenchState(),request.scope||draft.scope,draft.bound)
  if(draft.source.kind==='messages'&&loadWorkbenchState().messageInbox?.accountId!==draft.source.accountId)throw Error('消息账号已变化，请重新选择消息')
  const title=String(request.title||'').trim(),body=typeof request.body==='string'?request.body.trim():draft.body
  if(!title||title.length>200)throw Error('标题须为1–200字符')
  if(body.length>MAX_KNOWLEDGE_TEXT||!body&&!draft.source.linkOnly)throw Error('正文须为1–100万字符')
  const contentHash=hashText(body),ref=body.length>20000?storeKnowledgeContent(body):null,originalRef=draft.body?storeKnowledgeContent(draft.body):null
  let itemId='',duplicate=false
  const snapshot=await mutateWorkbenchState((state:any)=>{
   selectedScope(state,scope,draft.bound)
   if(draft.source.kind==='messages'&&state.messageInbox?.accountId!==draft.source.accountId)throw Error('消息账号已变化，请重新选择消息')
   const existing=state.knowledge.find((row:any)=>!row.archivedAt&&row.spaceId===scope.spaceId&&(row.projectId||null)===(scope.projectId||null)&&row.capture?.sourceKey===draft.source.key&&row.capture?.contentHash===contentHash)
   if(existing){itemId=existing.id;duplicate=true;if(request.useForAnswers===true&&!draft.source.linkOnly&&existing.reviewState==='candidate'){existing.reviewState='confirmed';auditEntry(state,'knowledge.confirmed',existing.title)}return state}
   const item=normalizeKnowledge({title,body:body.slice(0,20000),url:draft.url,kind:draft.source.kind==='radar'?'bookmark':'note',reviewState:request.useForAnswers===true&&!draft.source.linkOnly?'confirmed':'candidate',spaceId:scope.spaceId,projectId:scope.projectId,accountId:draft.source.accountId||null,tags:request.tags,sourceLabel:draft.source.label,contentRef:ref,capture:{sourceKey:draft.source.key,contentHash,source:draft.source,originalRef}})
   state.knowledge.push(item);itemId=item.id
   if(draft.source.kind==='radar'){const row=state.radar.find((row:any)=>row.id===draft.source.radarId);if(row){row.saved=true;row.knowledgeId=item.id}}
   auditEntry(state,'knowledge.captured',item.title);return state
  })
  void scheduleKnowledgeIndex(scope).catch(()=>{})
  return {status:'ok',itemId,duplicate,snapshot}
 }
}
