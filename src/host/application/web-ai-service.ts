import {webAIHistoryService} from './web-ai-history.js'
import {normalizeWebAIAttachments} from '../../shared/web-ai-attachments.js'
import {createHash} from 'node:crypto'
import {WEB_AI_ACTIVE,normalizeWebAI,normalizeWebAICapture,webAIProvider,webAIConversationUrl,type WebAIState} from '../../shared/web-ai.js'
import {loadWorkbenchState,mutateWorkbenchState} from '../storage/state-store.js'
import {hostNowIso,newId,workbenchDir} from '../platform/runtime.js'

export function webAIService(){
 const state=():WebAIState=>({...loadWorkbenchState().webAI||normalizeWebAI(null),revision:loadWorkbenchState().revision})
 const answer=(s:any,roundId:string,providerId:string)=>{const round=s.webAI.rounds.find((r:any)=>r.id===roundId);const topic=s.webAI.topics.find((t:any)=>t.id===round?.topicId);if(topic?.deletedAt)throw new Error('请先恢复回收站中的问答');const row=round?.answers.find((a:any)=>a.providerId===providerId);if(!row)throw new Error('对比记录不存在');return {round,row}}
 return {
  ...webAIHistoryService(state),
  disposeWebAI(){/* Compatibility lifecycle hook; this feature no longer starts external browsers. */},
  async webAIState(){return {state:state(),capabilities:{chromeAvailable:false,attachmentsProtocol:1,historyProtocol:1,storageScope:'workbench-web-ai:'+createHash('sha256').update(workbenchDir()).digest('hex').slice(0,32)}}},
  async webAIConfigure(request:any={}){await mutateWorkbenchState((s:any)=>{s.webAI.chatgptEnabled=request.chatgptEnabled===true;return s});return state()},
  async webAICreateTopic(request:any={}){const title=String(request.title||'新问题').trim().slice(0,120);const id=newId('web-topic');await mutateWorkbenchState((s:any)=>{if(s.webAI.topics.length>=100)throw new Error('最多保存100个对比主题，请先导出整理');s.webAI.topics.push({id,title,createdAt:hostNowIso(),conversations:{}});return s});return {state:state(),topicId:id}},
  async webAISaveConversation(request:any){const url=webAIConversationUrl(request.providerId,request.url);if(!url)throw new Error('官网会话地址无效');await mutateWorkbenchState((s:any)=>{const topic=s.webAI.topics.find((t:any)=>t.id===request.topicId);if(!topic||topic.deletedAt)throw new Error('主题不存在或已移入回收站');topic.conversations[request.providerId]=url;return s});return state()},
  async webAIStart(request:any={}){
   const requestId=String(request.requestId||'');if(!/^[\w-]{8,120}$/.test(requestId))throw new Error('提交标识无效')
   const questions=request.questions,providers=request.providers,attachments=normalizeWebAIAttachments(request.attachments||[])
   if(!Array.isArray(questions)||questions.length<1||questions.length>5||questions.some(q=>typeof q!=='string'||!q.trim()||q.length>12000))throw new Error('每批支持1–5个问题，每个不超过12000字符')
   if(!Array.isArray(providers)||!providers.length||providers.length>6||new Set(providers).size!==providers.length)throw new Error('请选择不重复的厂商')
   providers.forEach(webAIProvider)
   await mutateWorkbenchState((s:any)=>{
    if(s.webAI.rounds.some((r:any)=>r.requestId===requestId))return s
    let topic=s.webAI.topics.find((t:any)=>t.id===request.topicId);if(request.topicId&&(!topic||topic.deletedAt))throw new Error('历史问答不存在，请重新选择')
    if(providers.includes('chatgpt')&&!s.webAI.chatgptEnabled)throw new Error('请先启用可选的 ChatGPT')
    if(s.webAI.rounds.some((r:any)=>r.answers.some((a:any)=>WEB_AI_ACTIVE.has(a.status))))throw new Error('已有对比正在处理，请等待或停止采集')
    if(s.webAI.rounds.length+questions.length>300)throw new Error('最多保存300轮，请导出整理或在回收站确认永久删除')
    if(!topic){if(s.webAI.topics.length>=100)throw new Error('最多保存100组历史问答，请导出整理或在回收站确认永久删除' );topic={id:newId('web-topic'),title:questions[0].trim().split('\n')[0].slice(0,120),createdAt:hostNowIso(),conversations:{}};s.webAI.topics.push(topic)}
    if(topic.title==='新问题')topic.title=questions[0].trim().split('\n')[0].slice(0,120)
    topic.version=(topic.version||0)+1;topic.updatedAt=hostNowIso()
    for(const [i,question] of questions.entries())s.webAI.rounds.push({id:newId('web-round'),requestId,topicId:topic.id,question:question.trim(),...(i===0&&attachments.length?{attachments}:{}),createdAt:hostNowIso(),answers:providers.map((providerId:string)=>({providerId,status:'queued',text:'',url:null,note:'等待连接官网',updatedAt:hostNowIso()}))})
    return s
   });return state()
  },
  async webAIClaim(request:any){let executionId:string|null=null;await mutateWorkbenchState((s:any)=>{const {round,row}=answer(s,request.roundId,request.providerId);if(row.status!=='queued')return s;const prior=s.webAI.rounds.slice(0,s.webAI.rounds.indexOf(round)).filter((r:any)=>r.requestId===round.requestId).flatMap((r:any)=>r.answers.filter((a:any)=>a.providerId===request.providerId)).find((a:any)=>a.status!=='completed');if(prior){if(!WEB_AI_ACTIVE.has(prior.status))Object.assign(row,{status:'unsupported',note:'前一个问题需要在官网处理，本条未发送。',updatedAt:hostNowIso()});return s}executionId=newId('web-exec');Object.assign(row,{status:'preparing',executionId,updatedAt:hostNowIso()});return s});return {executionId}},
  async webAIUpdate(request:any){
   const allowed=['preparing','prepared','generating','completed','needs_login','unsupported','uncertain']
   if(!allowed.includes(request.status))throw new Error('不支持的对比状态')
   await mutateWorkbenchState((s:any)=>{const {round,row}=answer(s,request.roundId,request.providerId);if(!request.executionId||row.executionId!==request.executionId||!WEB_AI_ACTIVE.has(row.status)&&row.status!=='prepared')return s
    if(request.status==='completed'&&!String(request.text??row.text).trim())throw new Error('不能将空回答标为完成')
    const url=webAIConversationUrl(request.providerId,request.url)
    if(normalizeWebAICapture(request.capture)&&(!row.capture||row.status==='preparing'&&request.status==='preparing'))row.capture=normalizeWebAICapture(request.capture)
    Object.assign(row,{status:request.status,note:String(request.note||'').slice(0,300),text:typeof request.text==='string'?request.text.slice(0,60000):row.text,url:url||row.url,updatedAt:hostNowIso()})
    if(url){const topic=s.webAI.topics.find((t:any)=>t.id===round.topicId);if(topic)topic.conversations[request.providerId]=url}return s
   });return state()
  },
  async webAICancel(request:any={}){await mutateWorkbenchState((s:any)=>{for(const r of s.webAI.rounds.filter((r:any)=>(!request.topicId||r.topicId===request.topicId)&&(!request.requestId||r.requestId===request.requestId)))for(const a of r.answers)if(WEB_AI_ACTIVE.has(a.status)||a.status==='prepared')Object.assign(a,{status:'cancelled',note:'已停止采集；官网已发送的消息不会撤回。',executionId:null,updatedAt:hostNowIso()});return s});return state()},
  async webAIResumeCapture(request:any){let executionId:string|null=null;await mutateWorkbenchState((s:any)=>{const {row}=answer(s,request.roundId,request.providerId);if(!row.capture)throw new Error('这条历史记录没有采集基线，请粘贴保存官网回答');if(s.webAI.rounds.some((r:any)=>r.answers.some((a:any)=>WEB_AI_ACTIVE.has(a.status))))throw new Error('已有处理正在执行，请先等待或停止');executionId=newId('web-capture');Object.assign(row,{status:'generating',executionId,note:'仅采集本轮回答，不会发送问题',updatedAt:hostNowIso()});return s});return {executionId}},
  async webAIRecord(request:any){if(typeof request.text!=='string'||!request.text.trim()||request.text.length>60000)throw new Error('回答须为1–60000字符');await mutateWorkbenchState((s:any)=>{const {row,round}=answer(s,request.roundId,request.providerId);if(WEB_AI_ACTIVE.has(row.status))throw new Error('请先停止当前采集，再保存人工回答');if(request.expectedUpdatedAt!==row.updatedAt)throw new Error('回答已更新，请重新打开编辑');const url=webAIConversationUrl(request.providerId,request.url);Object.assign(row,{text:request.text.trim(),status:'completed',note:'人工从官网保存',url,updatedAt:hostNowIso(),executionId:null});if(url){const topic=s.webAI.topics.find((t:any)=>t.id===round.topicId);if(topic)topic.conversations[request.providerId]=url}return s});return state()},
  async webAIOpenExternal(_request:any){throw new Error('多 AI 对话仅使用工作台内嵌页面，已关闭另开浏览器窗口入口')},
 }
}
