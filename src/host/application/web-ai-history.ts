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
   await mutateWorkbenchState((s:any)=>{
    const topic=checked(s,request)
    if(request.action==='restore'){if(!topic.deletedAt)throw new Error('该问答不在回收站');delete topic.deletedAt}
    else if(request.action==='purge'){
     if(!topic.deletedAt)throw new Error('请先将问答移入回收站')
     s.webAI.topics=s.webAI.topics.filter((t:any)=>t.id!==topic.id)
     s.webAI.rounds=s.webAI.rounds.filter((r:any)=>r.topicId!==topic.id)
     return s
    }else{
     if(topic.deletedAt)throw new Error('请先恢复回收站中的问答')
     if(request.action==='rename')topic.title=request.title.trim()
     else topic.deletedAt=hostNowIso()
    }
    touch(topic);return s
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
