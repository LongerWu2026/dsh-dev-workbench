import {officeJobOwners,officeJobAllowed,officeArtifacts,busyReplyView} from './office-results.js'
import {loadWorkbenchState} from '../storage/state-store.js'
import {hashText} from '../platform/runtime.js'
import {TASK_STATUSES,REPLY_STATUSES} from '../domain/model.js'
import {taskService} from '../application/task-service.js'
import {sourceService} from '../application/source-service.js'
import {knowledgeService} from '../application/knowledge-service.js'
import {analysisService} from '../application/analysis-service.js'
import {newsService} from '../application/news-service.js'
import {developmentService} from '../application/development-service.js'
import {readDevelopmentTask} from '../storage/development-store.js'
import {officeService} from '../workflows/office-service.js'
import {workflowService} from '../application/workflow-service.js'
import {defaultKnowledgeScope} from '../knowledge/retrieval.js'
import {appendAssistantActionEvent,assistantConfirmations,saveAssistantConfirmation,reserveAssistantConfirmation,finishAssistantConfirmation,cancelAssistantConfirmation,type AssistantConfirmation} from './action-store.js'
import {hubSessionOwner,hubSessionKnowledgeScope,rememberOfficeJobOwner,hubIndex} from './hub-store.js'
import {taskThreadOwner} from './task-threads.js'
import {listAnalysisResults,analysisResultTarget} from './analysis-results.js'
import {officeTopicFor,boundOfficeInput,officeManagementConversation,assertOfficeTopicDate} from './office-topics.js'

const fingerprint=(value:any)=>hashText(JSON.stringify(value))
const clean=(value:any)=>JSON.parse(JSON.stringify(value??null))
const state=()=>loadWorkbenchState()
function scope(request:any){const id=String(request.conversationId||''),at=id.indexOf(':'),kind=id.slice(0,at),entityId=id.slice(at+1);if(at<1||!entityId||!['system','task','reply','development','radar','knowledge','chat','office'].includes(kind))throw Error('请选择有效的助手会话');if(kind==='system'&&!['office','analysis','radar','knowledge'].includes(entityId))throw Error('系统会话不存在');if(kind==='office'&&!officeTopicFor(id))throw Error('找不到对应办公主题');return {id,kind,entityId}}
function entity(collection:string,id:string){const row=(state()[collection]||[]).find((r:any)=>r.id===id);if(!row)throw Error('对应事项已不存在，请刷新后重新选择');return row}
function target(request:any,kind:string,collection:string){const s=scope(request);if(s.kind!==kind)throw Error('请在对应事项会话中执行此操作');if(request.id&&request.id!==s.entityId)throw Error('操作对象与当前会话不一致');return entity(collection,s.entityId)}
function systemScope(request:any,name:string){const s=scope(request);if(s.kind!=='system'||s.entityId!==name)throw Error('请在对应系统会话中执行此操作')}
function busyReplyScope(request:any){const s=scope(request),collections:any={task:'tasks',reply:'replies',radar:'radar',knowledge:'knowledge'};if(collections[s.kind])entity(collections[s.kind],s.entityId);if(s.kind==='development')readDevelopmentTask(s.entityId);if(s.kind==='chat'&&!hubIndex().conversations.some(row=>row.id===s.id))throw Error('找不到当前工作会话');return s}
function knowledgeScope(request:any,item?:any){const s=scope(request);return defaultKnowledgeScope(state(),s.kind==='knowledge'&&item?{projectId:item.projectId||null,accountId:item.accountId||null}:request.knowledgeScope||{})}
function knowledgeTarget(request:any){const s=scope(request);if(!(s.kind==='chat'||s.kind==='knowledge'||s.kind==='system'&&s.entityId==='knowledge'))throw Error('请在知识库或对应知识会话中操作');const id=s.kind==='knowledge'?s.entityId:String(request.id||'');if(s.kind==='knowledge'&&request.id&&request.id!==id)throw Error('知识条目与当前会话不一致');if(!id)throw Error('请先搜索并选择具体知识条目');const item=entity('knowledge',id),allowed=knowledgeScope(request,item);if(item.projectId&&item.projectId!==allowed.projectId||item.accountId&&item.accountId!==allowed.accountId)throw Error('该知识不属于当前项目或账号范围');return item}
function replyEvidence(id:string){const s=state(),reply=entity('replies',id),source=s.sources.find((r:any)=>r.id===reply.sourceId);return {reply,source,draft:s.replyDrafts?.[id]||null}}
function publicConfirmation(row:AssistantConfirmation){const {id,conversationId,operation,title,before,after,expiresAt,state,turnId}=row;return {id,conversationId,operation,title,before,after,expiresAt,state,turnId}}
function preview(request:any,operation:string,title:string,before:any,after:any,payload:any,versionValue=before){const confirmation=saveAssistantConfirmation({turnId:request.assistantTurnId,conversationId:request.conversationId,operation,title,before:clean(before),after:clean(after),fingerprint:fingerprint(versionValue),payload:clean(payload)});return {status:'confirmation_required',note:title+'，请核对后确认。',operation,confirmation:publicConfirmation(confirmation)}}
function knowledgePatch(input:any){const patch:any={reviewState:'candidate'};for(const key of ['title','body','url','kind'])if(input?.[key]!==undefined)patch[key]=input[key];if(Object.keys(patch).length===1)throw Error('请提供需要修改的知识内容');if(patch.body!==undefined&&(typeof patch.body!=='string'||patch.body.length>20000))throw Error('知识正文限 20000 字符');if(patch.title!==undefined&&(typeof patch.title!=='string'||!patch.title.trim()))throw Error('知识标题不能为空');return patch}
function officeJobMatches(conversation:any,job:any){return officeJobAllowed(conversation.id,job)}
function checkedTaskPatch(patch:any,strict=false){
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('请提供待办修改内容')
 const allowed=['status','dueAt','priority','title','description','assignee','tags']
 if(strict&&Object.keys(patch).some(key=>!allowed.includes(key)))throw Error('只能修改待办标题、描述、状态、期限、优先级、负责人和标签')
 if(patch.status!==undefined&&!TASK_STATUSES.includes(patch.status))throw Error('无效的待办状态')
 if(patch.dueAt!==undefined&&patch.dueAt!==null&&!Number.isFinite(Date.parse(patch.dueAt)))throw Error('请提供明确的截止日期')
 if(patch.title!==undefined&&(typeof patch.title!=='string'||!patch.title.trim()||patch.title.length>200))throw Error('待办标题须为 1–200 字符')
 const safe=Object.fromEntries(Object.entries(patch).filter(([key])=>allowed.includes(key)));if(!Object.keys(safe).length)throw Error('没有可修改的字段');return safe
}

/** Tool execution identity, never a model-supplied conversation ID, determines ownership. */
export function assistantToolConversation(execution:any):string|null {const id=execution?.agent?.session?.id;if(!id)return null;return hubSessionOwner(id)||(taskThreadOwner(id)?'task:'+taskThreadOwner(id):null)}
export function assistantToolKnowledgeScope(execution:any){const id=execution?.agent?.session?.id;return id?hubSessionKnowledgeScope(id)||{}:{}}

async function confirm(ctx:any,request:any){
 const row=reserveAssistantConfirmation(request.conversationId,String(request.confirmationId||''))
 if(row.state==='completed')return {...row.result,replayed:true}
 try{
  let result:any
  if(row.operation.startsWith('knowledge.')){
   if(scope(request).kind!=='knowledge'&&request.knowledgeScope&&['projectId','accountId'].some(key=>request.knowledgeScope[key]!==undefined&&request.knowledgeScope[key]!==row.payload.knowledgeScope?.[key]))throw Error('当前知识范围已切换，请返回原范围或重新预览')
   const item=knowledgeTarget({...request,id:row.payload.id,knowledgeScope:row.payload.knowledgeScope});if(fingerprint(item)!==row.fingerprint)throw Error('知识已更新，原确认失效，请重新预览差异')
   const snapshot=row.operation==='knowledge.delete'?await knowledgeService.deleteKnowledge(item.id,row.fingerprint):await knowledgeService.updateKnowledge(item.id,row.payload.patch,row.fingerprint)
   result={status:'ok',note:row.operation==='knowledge.delete'?'已删除该工作台知识条目，未删除外部原文。':'知识已更新，进入待审核状态。',item:snapshot.knowledge.find((k:any)=>k.id===item.id)||null}
  }else if(row.operation==='busyReply.configure'){
   busyReplyScope(request);const before=busyReplyView(state())
   if(typeof row.payload.enabled!=='boolean'||fingerprint(before.config)!==row.fingerprint)throw Error('忙碌回复配置已变化，请重新核对开关')
   const snapshot=await sourceService.busyReplyConfigure({enabled:row.payload.enabled}),after=busyReplyView(snapshot)
   result={status:'ok',note:after.config.enabled?'已开启私聊忙碌自动回复，每个会话最多告知一次。':'已关闭忙碌自动回复。',busyReply:after}
  }else if(row.operation==='reply.send'){
   const evidence=replyEvidence(row.payload.id);if(fingerprint(evidence)!==row.fingerprint)throw Error('原消息、回复状态或草稿已变化，请重新核对发送内容')
   const snapshot=await sourceService.sendReply({...row.payload,confirmed:true});result={status:'ok',note:'消息发送成功，已标记为已回复。',item:snapshot.replies.find((r:any)=>r.id===row.payload.id)}
  }else if(row.operation==='development.writeback'){
   const item=readDevelopmentTask(row.payload.id);if(fingerprint(item)!==row.fingerprint)throw Error('研发任务已有变化，请重新核对回写内容')
   const task=await developmentService.development({action:'writeback',id:item.id});result={status:'ok',note:'结果已回写 Linky 评论，业务状态仍需按 Linky 流程流转。',task}
  }else throw Error('该操作不能确认执行')
  finishAssistantConfirmation(row.id,'completed',result);return {...result,operation:row.operation,before:row.before,after:result.item??result.task??result.busyReply?.config??null,knowledgeScope:row.payload.knowledgeScope}
 }catch(error){const result={status:'error',note:String(error.message||error),operation:row.operation};finishAssistantConfirmation(row.id,'failed',result);throw error}
}

/** Only the UI/user-command path calls confirmations. Model tools can prepare previews, never confirm. */
export async function runAssistantOperation(ctx:any,request:any):Promise<any>{
 let conversationId='',operation=String(request.operation||'')
 try{
  conversationId=scope(request).id;let result:any
  if(operation==='confirm')result=await confirm(ctx,request)
  else if(operation==='cancel'){cancelAssistantConfirmation(conversationId,String(request.confirmationId||''));result={status:'ok',note:'已取消，本次没有执行修改。'}}
  else if(operation==='task.update'){
   const before=clean(target(request,'task','tasks')),safe=checkedTaskPatch(request.patch||{});
   const snapshot=await taskService.updateTask(before.id,safe),after=snapshot.tasks.find((t:any)=>t.id===before.id)
   const labels:any={ready:'待处理',running:'进行中',completed:'已完成',cancelled:'已取消',failed:'失败',draft:'草稿',waiting_approval:'待确认'}
   result={status:'ok',note:'已更新「'+after.title+'」'+(safe.status?'为'+labels[after.status]:'')+'。',before,after,item:after}
  }else if(operation==='reply.stage'){
   const before=clean(target(request,'reply','replies'));if(!REPLY_STATUSES.includes(request.stage)||request.stage==='已自动回复')throw Error('无效的人工回复状态')
   const snapshot=await sourceService.setReplyStage(before.id,request.stage),after=snapshot.replies.find((r:any)=>r.id===before.id);result={status:'ok',note:'已人工标记为「'+after.stage+'」，本次未发送消息。',before,after,item:after}
  }else if(operation==='reply.draft'){
   const reply=target(request,'reply','replies'),service=officeService(()=>ctx)
   if(typeof request.text==='string')await service.saveReplyDraft(reply.id,request.text);else await service.generateReplyDraft(reply.id)
   const draft=state().replyDrafts?.[reply.id];result={status:'ok',note:'回复草稿已保存，尚未发送。',draft,text:draft?.text}
  }else if(operation==='reply.send'){
   const reply=target(request,'reply','replies'),evidence=replyEvidence(reply.id),text=typeof request.text==='string'?request.text.trim():String(evidence.draft?.text||'').trim(),loc=evidence.source?.locator
   if(!text||text.length>8000)throw Error('请先准备 1–8000 字符的回复正文')
   if(evidence.source?.provider!=='yunzhijia'||!loc?.groupId||!loc.msgId||!loc.accountId||loc.direction==='outbound')throw Error('缺少有效原消息，不能发送')
   if(!['待回复','已确认收到','已自动回复'].includes(reply.stage)||['sending','uncertain','sent'].includes(evidence.draft?.delivery?.status))throw Error('此消息已有处理或发送记录，请先核实，避免重复发送')
   result=preview(request,operation,'确认发送给 '+(reply.contact||evidence.source?.sender||reply.groupName||loc.groupId),{contact:reply.contact,groupName:reply.groupName,original:evidence.source.excerpt},{text},{id:reply.id,text,groupId:loc.groupId,msgId:loc.msgId,accountId:loc.accountId},evidence)
  }else if(operation.startsWith('analysis.')){
   systemScope(request,'analysis')
   if(operation==='analysis.status')result={status:'ok',note:'已刷新实际识别进度，未重新执行。',progress:await analysisService.analysisStatus()}
   else if(operation==='analysis.results'){
    if(request.kind!==undefined&&!['all','task','reply'].includes(request.kind))throw Error('请选择全部、待办或待回复结果');
    const snapshot=state(),runId=request.latestRun?snapshot.jobs.filter((job:any)=>job.kind==='analysis').sort((a:any,b:any)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0]?.id:request.runId;
    if(request.latestRun&&!runId)throw Error('尚无可关联的识别轮次；可输入“查看提取结果”查看全部已保存事项');
    const page=listAnalysisResults(snapshot,{query:request.query,kind:request.kind,limit:request.limit,offset:request.offset,runId});result={status:'ok',note:(request.latestRun?'最新一轮已保存的提取结果':'已读取实际提取结果')+'，共 '+page.total+' 项；本次没有重新识别。',runId,...page}
   }else if(operation==='analysis.updateResult'){
    if(!['task','reply'].includes(request.kind)||typeof request.id!=='string'||!request.id)throw Error('请先查看提取结果，并指定一条已保存的待办或待回复');
    const before=clean(analysisResultTarget(state(),request.kind,request.id)),validate=(snapshot:any)=>{analysisResultTarget(snapshot,request.kind,request.id)};
    const snapshot=request.kind==='task'?await taskService.updateTask(request.id,checkedTaskPatch(request.patch,true),validate):await sourceService.updateReply(request.id,request.patch,validate);
    const after=snapshot[request.kind==='task'?'tasks':'replies'].find((row:any)=>row.id===request.id);
    result={status:'ok',note:'已修正原'+(request.kind==='task'?'待办「'+after.title+'」':'待回复摘要或阶段')+'，已保留人工修改；本次没有发送消息。',before,after,item:after,kind:request.kind,conversationId:request.kind+':'+request.id}
   }
   else if(['analysis.continue','analysis.retry','analysis.fetch'].includes(operation)){
    if(operation==='analysis.fetch')await sourceService.fetchMentions()
    const job=await analysisService.analysisStart(operation==='analysis.retry'?{retryFailed:true}:{});result={status:'ok',note:job.note||'识别任务已进入后台队列。',job}
   }else throw Error('未知的识别操作')
  }else if(operation.startsWith('radar.')){
   const s=scope(request);if(!(s.kind==='radar'||s.kind==='system'&&s.entityId==='radar'))throw Error('请在资讯会话中操作')
   if(operation==='radar.fetch'){await newsService.fetchRadar();const job=await newsService.radarSummaryStart({});result={status:'ok',note:'资讯已更新，摘要正在后台处理。',job,items:state().radar}}
   else if(operation==='radar.summary'){const job=await newsService.radarSummaryStart(s.kind==='radar'?{onlyIds:[s.entityId],retryFailed:true}:{});result={status:'ok',note:'已启动资讯摘要。',job}}
   else if(operation==='radar.toTask'){const row=target(request,'radar','radar'),snapshot=await newsService.createTaskFromRadar(row.id);result={status:'ok',note:'已根据资讯建立待办，保留原文来源。',items:snapshot.tasks}}
   else if(operation==='radar.toKnowledge'){const row=target(request,'radar','radar');await knowledgeService.createKnowledge({title:row.title,body:[row.excerpt,...Object.values(row.summary||{})].filter(Boolean).join('\n'),url:row.url,reviewState:'candidate'});result={status:'ok',note:'已保存为待审核知识，保留资讯来源。'}}
   else throw Error('未知的资讯操作')
  }else if(operation==='knowledge.search'){
   const s=scope(request);if(!(s.kind==='chat'||s.kind==='knowledge'||s.kind==='system'&&s.entityId==='knowledge'))throw Error('请在知识会话中查询')
   const selected=s.kind==='knowledge'?entity('knowledge',s.entityId):undefined,query=String(request.query||'').trim().toLowerCase(),allowed=knowledgeScope(request,selected),items=state().knowledge.filter((k:any)=>(s.kind!=='knowledge'||k.id===s.entityId)&&(!k.projectId||k.projectId===allowed.projectId)&&(!k.accountId||k.accountId===allowed.accountId)&&(!query||[k.title,k.body].join(' ').toLowerCase().includes(query))).slice(0,100)
   result={status:'ok',note:'找到 '+items.length+' 条知识。',items}
  }else if(operation==='knowledge.update'||operation==='knowledge.delete'){
   const item=knowledgeTarget(request),patch=operation==='knowledge.update'?knowledgePatch(request.patch):null
   result=preview(request,operation,(patch?'确认修改知识「':'确认删除工作台知识「')+item.title+'」',item,patch?{...item,...patch}:null,{id:item.id,patch,knowledgeScope:knowledgeScope(request,item)})
  }else if(operation.startsWith('development.')){
   const s=scope(request);if(s.kind!=='development')throw Error('请在对应研发事项会话中操作');if(request.id&&request.id!==s.entityId)throw Error('研发事项不匹配');const before=clean(readDevelopmentTask(s.entityId))
   if(operation==='development.writeback'){if(before.status!=='approved'||!before.approvedHash)throw Error('请先完成人工审查，再确认回写');result=preview(request,operation,'确认回写 Linky 结果评论',before,{issue:before.issue,reviewNote:before.reviewNote,description:'仅回写评论，不提交代码、不关闭工作项。'},{id:before.id})}
   else if(operation==='development.continue'&&!['ready','paused','rejected'].includes(before.status)){
    const reasons:Record<string,string>={waiting_review:'当前正在等待人工审查，请先填写审查意见并通过或退回；本次没有重新启动开发。',approved:'人工审查已通过，下一步是核对并确认回写；本次没有重新启动开发。',delivered:'该研发任务已经交付，本次没有重复启动开发。',running:'研发流程正在执行，请等待本轮结果或先暂停；本次没有重复启动。',preparing:'研发工程仍在准备，请等待准备完成后继续。'}
    result={status:'error',code:'development_not_startable',blocked:true,failurePhase:'execution',note:reasons[before.status]||before.pauseReason||'当前研发阶段暂不能启动，请查看进度并处理尚未满足的条件；本次没有启动开发。',task:before}
   }
   else {const actions:any={'development.continue':'start','development.pause':'pause','development.guidance':'guidance','development.approve':'approve','development.reject':'reject','development.detail':'detail'},action=actions[operation];if(!action)throw Error('不支持的研发操作');const task=action==='detail'?before:await developmentService.development({action,id:s.entityId,text:request.text,note:request.note});result={status:'ok',note:action==='pause'?'已请求暂停，等待当前步骤安全结束。':action==='start'?'研发任务已继续，进度按实际执行更新。':action==='guidance'?'补充要求已保存，可以继续开发。':action==='approve'?'人工审查已通过，等待确认回写。':action==='reject'?'已记录审查意见，等待继续修复。':'已读取研发进度。',task,before,after:task}}
  }else if(operation.startsWith('busyReply.')){
   busyReplyScope(request)
   const before=busyReplyView(state())
   if(operation==='busyReply.status')result={status:'ok',note:'忙碌自动回复'+(before.config.enabled?'已开启':'已关闭')+'；仅处理私聊，同一次忙碌期间每个会话最多告知一次。'+(before.error?' '+before.error:''),busyReply:before}
   else if(operation==='busyReply.configure'){
    if(typeof request.enabled!=='boolean')throw Error('请明确开启或关闭忙碌自动回复')
    if(request.executionOrigin==='tool')result=preview(request,operation,'确认'+(request.enabled?'开启':'关闭')+'私聊忙碌自动回复',before.config,{...before.config,enabled:request.enabled},{enabled:request.enabled},before.config)
    else {const snapshot=await sourceService.busyReplyConfigure({enabled:request.enabled}),after=busyReplyView(snapshot)
     result={status:'ok',note:after.config.enabled?'已开启忙碌自动回复：仅对符合规则的新私聊告知一次，仍保留待回复。':'已关闭忙碌自动回复，已有记录保留。',before,after,busyReply:after}}

   }else throw Error('未知的忙碌回复操作')
  }else if(operation.startsWith('office.')){
   const service=workflowService(()=>ctx),s=scope(request)
   if(operation==='office.start'){
    if(s.kind==='office'){const bound=boundOfficeInput(s.id,request.kind,request.input);request={...request,...bound}}
    const input={...(request.input||{})},general=officeManagementConversation(s.id)
    if(request.kind==='task_assist'){if(s.kind!=='task')throw Error('请在对应待办会话中整理处理方案');if(input.taskId&&input.taskId!==s.entityId)throw Error('不能为另一待办启动方案');input.taskId=s.entityId}
    else if(request.kind==='reply_batch'){
     if(s.kind==='reply'){if(input.replyIds&&(!Array.isArray(input.replyIds)||input.replyIds.some((id:any)=>id!==s.entityId)))throw Error('不能在此会话处理另一条待回复');input.replyIds=[s.entityId]}
     else if(!general)throw Error('批量回复草稿请在日常工作会话中准备')
     else if(Array.isArray(input.replyIds)&&input.replyIds.length===1)throw Error('单条回复请打开对应待回复会话准备草稿')
    }else if(request.kind==='work_report'){if(!general)throw Error('日报和周报请在日常工作会话中生成')}
    else throw Error('请选择回复草稿、工作报告或待办处理方案')
    const priorOwners=officeJobOwners(state().jobs||[]);let selectedId='',owner=''
    const snapshot=await service.officeWorkflowStart(request.kind,input,id=>{selectedId=id;owner=rememberOfficeJobOwner(id,priorOwners.get(id)||s.id)},s.kind==='office'?(now:number)=>assertOfficeTopicDate(s.id,now):undefined),job=snapshot.jobs.find((job:any)=>job.id===selectedId)
    if(owner!==s.id)result={status:'ok',note:'相同内容已有处理记录，请打开原会话继续；本次没有重复执行。',conversationId:owner,existing:true,jobs:[],after:{jobIds:[]}}
    else result={status:'ok',note:job?.status==='completed'?'已找到同一输入的完成结果，没有重复执行。':'已开始处理，成果会直接显示在本会话中。',jobs:job?[job]:[],after:{jobIds:job?[job.id]:[]}}
   }else if(operation==='office.status'){
    const owners=officeJobOwners(state().jobs||[]),jobs=state().jobs.filter((job:any)=>officeJobAllowed(s.id,job,owners));result={status:'ok',note:jobs.length?'已读取当前会话的真实工作成果和进度。':'当前会话还没有工作成果。',jobs,artifacts:officeArtifacts(state(),jobs)}
   }else if(['office.retry','office.cancel'].includes(operation)){const job=state().jobs.find((j:any)=>j.id===request.id);if(!job||!officeJobMatches(s,job))throw Error('该办公作业不属于当前事项');const snapshot=await service.officeWorkflowControl(String(request.id||''),operation.slice(7));result={status:'ok',note:operation==='office.retry'?'已继续未完成步骤。':'已停止后续步骤。',jobs:snapshot.jobs.filter((j:any)=>j.id===job.id),after:{jobIds:[job.id]}}}
   else if(['office.adoptReply','office.saveKnowledge'].includes(operation)){
    const job=state().jobs.find((job:any)=>job.id===request.jobId),step=job?.steps?.find((step:any)=>step.id===request.stepId)
    if(!job||!officeJobMatches(s,job))throw Error('该工作成果不属于当前会话')
    if(step?.status!=='completed'||typeof step.artifact?.text!=='string'||!step.artifact.text.trim())throw Error('该步骤尚无已完成的成果')
    if(operation==='office.adoptReply'){
     if(job.kind!=='reply_batch')throw Error('只有回复成果可以采纳为草稿')
     const snapshot=await service.adoptReplyArtifact(job.id,step.id);result={status:'ok',note:'已采纳为待审核回复草稿，尚未发送。',draft:snapshot.replyDrafts?.[step.id],after:{jobIds:[job.id]}}
    }else{
     const sourceLabel='办公作业 '+job.id+' / '+step.id,at=step.artifact.at||job.createdAt,date=Number.isFinite(Date.parse(at))?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(at)).replaceAll('/','-')+'（北京时间）':'',title=(job.title||'工作成果')+' · '+(step.label||'结果')+(date?' · '+date:''),projectId=step.input?.task?.projectId||null,accountId=step.input?.source?.locator?.accountId||null
     const existing=state().knowledge.find((item:any)=>item.sourceLabel===sourceLabel&&item.body===step.artifact.text&&item.projectId===projectId&&item.accountId===accountId)
     const snapshot=existing?state():await knowledgeService.createKnowledge({title,body:step.artifact.text,kind:'note',reviewState:'candidate',projectId,accountId,sourceLabel})
     const item=existing||snapshot.knowledge.find((item:any)=>item.title===title&&item.projectId===projectId&&item.accountId===accountId)
     if(item?.body!==step.artifact.text)throw Error('已有同名知识且正文不同，请在知识库会话核对后修改，原知识未被覆盖')
     result={status:'ok',note:'已保存为候选知识，保留工作成果来源，等待审核。',item,after:{knowledgeId:item.id}}
    }
   }else throw Error('未知的办公操作')
  }else throw Error('不支持的助手操作')
  const output={...result,operation:result.operation||operation}
  const savedResult:any={};for(const key of ['draft','text','job','progress','item','task','busyReply','artifacts','blocked','failurePhase','code'])if(output[key]!==undefined)savedResult[key]=clean(output[key]);
  if(output.items)savedResult.items=output.items.map((item:any)=>({id:item.id,kind:item.kind,conversationId:item.conversationId,title:item.title,body:item.body,excerpt:item.excerpt,url:item.url,status:item.status,stage:item.stage,updatedAt:item.updatedAt,sourceId:item.sourceId,sourceText:item.sourceText,analysisEntryId:item.analysisEntryId,runId:item.runId,dueAt:item.dueAt,priority:item.priority}));
  if(output.jobs)savedResult.jobIds=output.jobs.map((job:any)=>job.id);
  if(output.existing&&output.conversationId)savedResult.relatedConversationId=output.conversationId;
  appendAssistantActionEvent(conversationId,{turnId:request.assistantTurnId,kind:'operation',text:output.note,operation:output.operation,status:output.status,before:output.before,after:output.after,confirmation:output.confirmation,...(Object.keys(savedResult).length?{result:savedResult}:{}),...(conversationId==='system:knowledge'?{knowledgeScope:output.knowledgeScope||knowledgeScope(request)}:{})})
  return output
 }catch(error){const result={status:'error',note:String(error.message||error),operation,failurePhase:'execution',...(error.code==='office_topic_expired'?{code:error.code,officeTopicRequest:error.officeTopicRequest}:{})};let scoped:any={};if(conversationId==='system:knowledge')try{scoped={knowledgeScope:knowledgeScope(request)}}catch{}if(conversationId)appendAssistantActionEvent(conversationId,{turnId:request.assistantTurnId,kind:'operation',text:result.note,operation,status:'error',...(result.code?{result:{code:result.code,officeTopicRequest:result.officeTopicRequest}}:{}),...scoped});return result}
}

/** Questions and hypothetical/negative instructions are discussion, not permission to mutate. */
function clarificationReason(text:string,matchedWrite=false):string|undefined {
 if(/^无需回复[。！!]*$/.test(text))return undefined
 // Everything after an explicit body/title replacement is user data, including its punctuation.
 const shell=text.match(/^(?:请|请帮我|帮我)?(?:把)?(?:知识)?(?:标题|正文)(?:改为|改成|更新为|替换为)[：:]?\s*/)?.[0]
 const intent=shell||text
 if((/[？?]|(?:是否|能否|可否|要不要|是不是)|(?:吗|(?<!什)么)[。！!]*$/.test(intent))&&(matchedWrite||/(?:确认|同意|删除|移除|修改|更新|替换|改为|改成|标记|设置|完成|开启|关闭|启用|停用|取消|发送|生成|起草|新建|创建|收集|拉取|同步|继续|开始|恢复|暂停|回写)/.test(intent)))return '这条消息是在询问操作，先确认你的意图，不直接修改。'
 if(/^(?:(?:请|请帮我|帮我|麻烦)\s*)?(?:不要|别|不用|无需|暂不|先不|如果|假如|假设)/.test(intent))return '这条消息包含否定或假设，先理解你的意思，不直接修改。'
 return undefined
}

/** Intentionally narrow commands; ambiguous natural language is delegated to the model for clarification. */
export function recognizeAssistantCommand(request:any,onClarification?:(reason:string)=>void):any|null{
 const {id,kind,entityId}=scope(request),text=String(request.text||'').trim(),plain=text.replace(/[。！!？?]+$/,'').replace(/^(?:请帮我|麻烦帮我|麻烦你|帮忙|请你|麻烦)\s*/,'');let action:any=null
 const currentKnowledgeScope=id==='system:knowledge'?knowledgeScope(request):null
 const pending=assistantConfirmations(id).filter(c=>c.state==='pending'&&Date.parse(c.expiresAt)>Date.now()&&(!currentKnowledgeScope||!c.operation.startsWith('knowledge.')||['projectId','accountId'].every(key=>(c.payload.knowledgeScope?.[key]||null)===(currentKnowledgeScope[key as keyof typeof currentKnowledgeScope]||null))))
 if(/^(确认|确认修改|确认删除|确认发送|确认回写|同意执行)$/.test(plain)){
  const required:Record<string,string>={'确认修改':'knowledge.update','确认删除':'knowledge.delete','确认发送':'reply.send','确认回写':'development.writeback'}
  if(pending.length!==1||required[plain]&&pending[0]?.operation!==required[plain])action={operation:'confirm',recognitionError:pending.length>1?'有多个待确认操作，请点击具体确认卡片。':pending.length?'确认的动作与待执行操作不一致，请核对确认卡片。':'没有待确认的操作，请先预览。'}
  else action={operation:'confirm',confirmationId:pending[0].id}
 }
 else if(/^(取消|取消操作)$/.test(plain)&&pending.length===1)action={operation:'cancel',confirmationId:pending[0].id}
 else if(/^(?:请|帮我)?(?:开启|打开|启用)忙碌自动回复$/.test(plain))action={operation:'busyReply.configure',enabled:true}
 else if(/^(?:请|帮我)?(?:关闭|停用|停止)忙碌自动回复$/.test(plain))action={operation:'busyReply.configure',enabled:false}
 else if(/^(?:请)?(?:查看)?忙碌自动回复(?:状态|开启了吗|开了吗)?$/.test(plain))action={operation:'busyReply.status'}
 else if(kind==='task'){
  const statusText=plain.replace(/^(?:请|帮我)?(?:(?:把|将)(?:这个|这条|这项|当前|该)?(?:任务|待办)?|(?:这个|这条|这项|当前|该)(?:任务|待办))(?:的状态)?/,'')
  if(/^(?:请|帮我)?(?:标记|设置|设|改)?(?:为|成)?(?:已完成|完成|办完了)$/.test(statusText)||/^(?:我)?已经(?:处理|做|办)完了(?:，?标记完成)?$/.test(plain))action={operation:'task.update',patch:{status:'completed'}}
  else if(/^(?:请|帮我)?(?:标记|设置|设|改)?(?:为|成)?(?:进行中|处理中|正在处理)$/.test(statusText)||/^(?:开始|继续)处理(?:这个|这条|这项|当前)?(?:任务|待办)$/.test(plain))action={operation:'task.update',patch:{status:'running'}}
  else if(/^(?:请|帮我)?(?:标记|设置|设|改|恢复)(?:为|成)?待处理$/.test(statusText))action={operation:'task.update',patch:{status:'ready'}}
  else if(/^(?:请|帮我)?(?:整理|生成|准备)(?:这个待办的|待办)?处理方案$/.test(plain))action={operation:'office.start',kind:'task_assist'}
  else {const due=plain.match(/^(?:请)?(?:把)?截止(?:时间|日期)?(?:改为|改成|设为|设置为|是|：|:)\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?$/);if(due)action={operation:'task.update',patch:{dueAt:due[1]+'T'+(due[2]||'18:00')+':00+08:00'}}}
 }else if(kind==='reply'){
  if(/^(?:请|帮我)?(?:(?:把|将)?(?:这条|当前)?(?:消息|回复))?(?:标记为|标记|改为)?(?:已回复|我已经回复了|已经在外部回复了)$/.test(plain))action={operation:'reply.stage',stage:'已回复'}
  else if(/^(?:请|帮我)?(?:标记为|标记|改为)(?:不需回复|无需回复)$/.test(plain)||/^(?:不需回复|无需回复)$/.test(plain))action={operation:'reply.stage',stage:'不需回复'}
  else if(/^(?:请|帮我)?(?:生成|准备|起草|拟一份|拟个)(?:一份|一条)?回复(?:草稿)?$/.test(plain))action={operation:'reply.draft'}
  else if(/^(?:请|帮我)?发送(?:当前)?(?:回复|草稿)$/.test(plain))action={operation:'reply.send'}
 }else if(officeManagementConversation(id)){
  if(/^(?:请|帮我)?(?:生成|整理|准备)(?:今天的|今日)?日报$/.test(plain))action={operation:'office.start',kind:'work_report',input:{period:'day'}}
  else if(/^(?:请|帮我)?(?:生成|整理|准备)(?:本周的|本周)?周报$/.test(plain))action={operation:'office.start',kind:'work_report',input:{period:'week'}}
  else if(/^(?:请|帮我)?(?:查看|刷新)(?:工作成果|办公进度|工作进度)$/.test(plain))action={operation:'office.status'}
 }else if(kind==='system'&&entityId==='analysis'){
  if(/^(?:请)?(?:查看|列出|看看)(?:本轮|这次|已保存的)?(?:识别|提取)结果$/.test(plain)||/^这次提取了什么$/.test(plain))action={operation:'analysis.results',latestRun:/本轮|这次/.test(plain)}
  else if(/^(?:请|帮我)?(?:刷新|(?:刷新|查看|看看)(?:识别|提取|处理)?进度|现在处理到哪里了|为什么暂停了)$/.test(plain))action={operation:'analysis.status'}
  else if(/^(?:请|帮我)?(?:继续|继续处理|(?:继续|开始)(?:识别|提取)(?:消息)?|(?:识别|提取)消息)$/.test(plain))action={operation:'analysis.continue'}
  else if(/^(?:请|帮我)?重试失败(?:的)?(?:消息|项)?$/.test(plain))action={operation:'analysis.retry'}
  else if(/^(?:请|帮我)?(?:获取|拉取|刷新|识别|同步)(?:最新|新)消息(?:并(?:识别|提取))?$/.test(plain))action={operation:'analysis.fetch'}
 }else if(kind==='system'&&entityId==='radar'){
  if(/^(?:请|帮我)?(?:更新|获取|收集|刷新|拉取)(?:今天的|最新|今天)?(?:AI\s*)?(?:资讯|新闻)$/.test(plain))action={operation:'radar.fetch'}
  else if(/^(?:请|帮我)?(?:继续|生成|重新生成|重新整理)(?:资讯)?摘要$/.test(plain))action={operation:'radar.summary'}
 }else if(kind==='knowledge'||kind==='system'&&entityId==='knowledge'){
  const search=plain.match(/^(?:请|帮我)?(?:搜索|查询|查找|找到)(?:知识)?[：:]?\s*(.+)$/)
  if(search)action={operation:'knowledge.search',query:search[1]}
  else if(kind==='knowledge'&&/^(?:请|帮我)?删除(?:这条|该|当前)?(?:知识|条目)?$/.test(plain))action={operation:'knowledge.delete'}
  else if(kind==='knowledge'){const change=text.match(/^(?:请|帮我)?(?:把)?(?:知识)?(标题|正文)(?:改为|改成|更新为|替换为)[：:]?\s*([\s\S]+)$/);if(change)action={operation:'knowledge.update',patch:{[change[1]==='标题'?'title':'body']:change[2]}}}
 }else if(kind==='development'){
  if(/^(?:请|帮我)?(?:继续|(?:继续|开始|恢复)(?:开发|修复)(?:任务)?|继续研发(?:任务)?)$/.test(plain))action={operation:'development.continue'}
  else if(/^(?:请|帮我)?暂停(?:开发|研发|执行|修复)?(?:任务)?$/.test(plain))action={operation:'development.pause'}
  else if(/^(?:请)?回写(?:Linky|linky)?(?:结果|评论)?$/.test(plain))action={operation:'development.writeback'}
  else if(/^(?:请|帮我)?(?:查看|刷新|看看)(?:研发|开发|修复|任务)?(?:进度|状态)$/.test(plain))action={operation:'development.detail'}
 }
 const readOnly=new Set(['busyReply.status','analysis.status','analysis.results','knowledge.search','development.detail','office.status'])
 const reason=clarificationReason(text,!!action&&!readOnly.has(action.operation))
 if(reason&&!readOnly.has(action?.operation)){onClarification?.(reason);return null}
 return action
}

/** Existing callers keep execution behavior; hub callers can persist the recognized turn first. */
export async function maybeAssistantCommand(ctx:any,request:any):Promise<any|null>{
 let action:any,fallback:any,clarification:string|undefined
 // Do not catch callbacks or execution here: once execution begins it must never be retried by AI.
 try{action=recognizeAssistantCommand(request,reason=>{clarification=reason})}catch(error){if(!request.onUnrecognized)throw error;fallback={outcome:'error',reason:'规则暂时无法判断这条消息，需要先理解并澄清。',clarificationOnly:true}}
 if(!action&&!fallback){const reason=clarification||clarificationReason(String(request.text||'').trim());fallback={outcome:reason?'ambiguous':'unmatched',...(reason?{reason,clarificationOnly:true}:{})}}
 if(action?.recognitionError&&request.onUnrecognized)fallback={outcome:'ambiguous',reason:action.recognitionError,clarificationOnly:true}
 if(fallback){request.onUnrecognized?.(fallback);return null}
 request.onRecognized?.(action)
 const {id}=scope(request),text=String(request.text||'').trim(),scoped=id==='system:knowledge'?{knowledgeScope:knowledgeScope(request)}:{}
 if(!request.assistantTurnId)appendAssistantActionEvent(id,{kind:'user',text,...scoped})
 if(action.recognitionError){const result={status:'error',note:action.recognitionError,operation:action.operation};appendAssistantActionEvent(id,{turnId:request.assistantTurnId,kind:'assistant',text:result.note,...scoped});return result}
 return runAssistantOperation(ctx,{conversationId:id,knowledgeScope:request.knowledgeScope,assistantTurnId:request.assistantTurnId,...action})
}
