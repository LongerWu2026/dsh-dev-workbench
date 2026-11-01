import {hashText} from '../platform/runtime.js'
import {hubIndex,rememberOfficeTopic,type OfficeTopic} from './hub-store.js'

export function officeDate(now=Date.now()){return new Date(now+8*3600000).toISOString().slice(0,10)}
function replyIds(input:any):string[]{if(!Array.isArray(input)||!input.length||input.length>20||input.some(id=>typeof id!=='string'||!id))throw Error('每批请选择 1–20 条待回复');return [...new Set<string>(input)].sort()}
export function officeTopicFor(id:string){return hubIndex().conversations.find(row=>row.id===id)?.officeTopic}
export function assertOfficeTopicDate(id:string,now=Date.now()){
 const topic=officeTopicFor(id);if(!topic)throw Error('找不到对应办公主题')
 if(topic.kind==='work_report'&&topic.date!==officeDate(now))throw Object.assign(Error('该报告主题对应历史日期，请继续查看或讨论原成果；生成当前报告请打开今日报告主题'),{code:'office_topic_expired',officeTopicRequest:{action:'officeTopic',kind:topic.kind,input:topic.input}})
}
export function officeTopicTarget(state:any,kind:string,input:any={}){
 let topic:OfficeTopic,title:string
 if(kind==='work_report'){
  const period=input.period||'day';if(!['day','week'].includes(period))throw Error('请选择日报或近七日周报')
  const now=Date.now(),date=officeDate(now),from=officeDate(now-(period==='week'?6:0)*86400000)
  topic={kind,input:{period},date,from,to:date};title=period==='day'?'日报 · '+date.slice(5).replace('-','/'):'周报 · '+from.slice(5).replace('-','/')+'–'+date.slice(5).replace('-','/')
 }else if(kind==='reply_batch'){
  const ids=replyIds(input.replyIds)
  const existing=hubIndex().conversations.find(row=>row.officeTopic?.kind==='reply_batch'&&JSON.stringify(row.officeTopic.input.replyIds)===JSON.stringify(ids))
  if(existing)return {status:'ok',conversationId:existing.id,title:existing.title,operation:'office.start',kind,input:existing.officeTopic!.input,topic:existing.officeTopic}
  for(const id of ids){const row=state.replies.find((row:any)=>row.id===id);if(!row||row.archivedAt||!['待回复','已确认收到','已自动回复'].includes(row.stage))throw Error('所选待回复已处理或不存在，请重新选择')}
  if(ids.length===1){const row=state.replies.find((row:any)=>row.id===ids[0]);return {status:'ok',conversationId:'reply:'+ids[0],title:row.snippet||row.contact||'待回复',operation:'office.start',kind,input:{replyIds:ids}}}
  topic={kind,input:{replyIds:ids}};title='回复草稿 · '+ids.length+' 条'
 }else throw Error('请选择工作报告或回复草稿')
 const conversationId='office:'+hashText(JSON.stringify(topic));const row=rememberOfficeTopic(conversationId,title,topic)
 return {status:'ok',conversationId,title:row.title,operation:'office.start',kind:topic.kind,input:topic.input,topic}
}
/** Topic identity is stored by the host. A tool cannot change its bound business input. */
export function boundOfficeInput(conversationId:string,kind:any,input:any={}){
 const topic=officeTopicFor(conversationId);if(!topic)throw Error('找不到对应办公主题')
 if(kind!==undefined&&kind!==topic.kind)throw Error('操作类型与当前办公主题不一致')
 if(topic.kind==='work_report'){
  if(input.period!==undefined&&input.period!==topic.input.period||Object.keys(input).some(key=>input[key]!==undefined&&key!=='period'))throw Error('报告范围与当前办公主题不一致')
  assertOfficeTopicDate(conversationId)
 }else{
  if(Object.keys(input).some(key=>input[key]!==undefined&&key!=='replyIds')||input.replyIds!==undefined&&JSON.stringify(replyIds(input.replyIds))!==JSON.stringify(topic.input.replyIds))throw Error('待回复范围与当前办公主题不一致')
 }
 return {kind:topic.kind,input:structuredClone(topic.input)}
}
export function officeManagementConversation(id:string){return id==='system:office'||id.startsWith('chat:')||id.startsWith('office:')&&!!officeTopicFor(id)}
