import {WEB_AI_ACTIVE,type WebAIState} from '../../shared/web-ai.js'
import {mutateWorkbenchState} from '../storage/state-store.js'
import {hostNowIso} from '../platform/runtime.js'

/** Local records only: no browser, provider API, cookie or credential operations. */
export function webAIHistoryService(state:()=>WebAIState){
 const checked=(s:any,request:any)=>{
  const topic=s.webAI.topics.find((t:any)=>t.id===request.topicId)
  if(!topic)throw new Error('历史问答不存在')
  if(request.expectedVersion!==(topic.version||0))throw new Error('历史问答已更新，请刷新后重试')
  if(s.webAI.rounds.some((r:any)=>r.topicId===topic.id&&r.answers.some((a:any)=>WEB_AI_ACTIVE.has(a.status)||a.status==='prepared')))throw new Error('请先停止该问答的采集或待发送操作')
  return topic
 }
 const touch=(topic:any)=>{topic.version=(topic.version||0)+1;topic.updatedAt=hostNowIso()}
 return {
  async webAIManageTopic(request:any={}){
   if(!['rename','trash','restore','purge'].includes(request.action))throw new Error('不支持的历史操作')
   if(['trash','purge'].includes(request.action)&&request.confirm!==true)throw new Error('删除前必须确认')
   if(request.action==='rename'&&(typeof request.title!=='string'||!request.title.trim()||request.title.trim().length>120))throw new Error('名称须为1–120个字符')
   const batch=request.topics!==undefined
   if(batch&&(!['trash','purge'].includes(request.action)||!Array.isArray(request.topics)||!request.topics.length||request.topics.length>100||request.topics.some((t:any)=>!t||typeof t.topicId!=='string'||!t.topicId||!Number.isSafeInteger(t.expectedVersion)||t.expectedVersion<0)||new Set(request.topics.map((t:any)=>t.topicId)).size!==request.topics.length))throw new Error('请选择1–100组不重复的本地问答及其版本，批量操作仅支持删除')
   await mutateWorkbenchState((s:any)=>{
    const topics=(batch?request.topics:[request]).map((item:any)=>checked(s,item))
    // Validate the entire selection before any change. A stale version, active
    // capture or wrong recycle-bin state cannot cause a partly deleted batch.
    for(const topic of topics){
     if(request.action==='restore'&&!topic.deletedAt)throw new Error('该问答不在回收站')
     if(request.action==='purge'&&!topic.deletedAt)throw new Error('请先将问答移入回收站')
     if(['rename','trash'].includes(request.action)&&topic.deletedAt)throw new Error('请先恢复回收站中的问答')
    }
    if(request.action==='purge'){
     const ids=new Set(topics.map((t:any)=>t.id))
     s.webAI.topics=s.webAI.topics.filter((t:any)=>!ids.has(t.id))
     s.webAI.rounds=s.webAI.rounds.filter((r:any)=>!ids.has(r.topicId))
     return s
    }
    for(const topic of topics){
     if(request.action==='restore')delete topic.deletedAt
     if(request.action==='rename')topic.title=request.title.trim()
     if(request.action==='trash')topic.deletedAt=hostNowIso()
     touch(topic)
    }
    return s
   });return state()
  },
  async webAIEditQuestion(request:any={}){
   if(typeof request.text!=='string'||!request.text.trim()||request.text.length>12000)throw new Error('问题须为1–12000个字符')
   await mutateWorkbenchState((s:any)=>{
    const topic=checked(s,request);if(topic.deletedAt)throw new Error('请先恢复回收站中的问答')
    const round=s.webAI.rounds.find((r:any)=>r.id===request.roundId&&r.topicId===topic.id)
    if(!round)throw new Error('问题记录不存在')
    // Preserve the original question used to bind provider answers and resume capture.
    if(request.text.trim()===round.question)delete round.displayQuestion
    else round.displayQuestion=request.text.trim()
    touch(topic);return s
   });return state()
  },
 }
}
