/** Display only known business fields. Never expose tool transport, credentials or confirmation tokens. */
export type AssistantCommandDisplay={label:string;parameters:Record<string,string|number|boolean|string[]>}
const labels:Record<string,string>={
 'task.list':'查看待办','task.create':'新建待办','task.update':'修改待办','task.detail':'查看待办详情','task.recordRun':'记录任务执行结果',
 'reply.list':'查看待回复','reply.create':'登记待回复','reply.stage':'标记回复阶段','reply.draft':'准备回复草稿','reply.send':'预览发送回复',
 'analysis.status':'查看识别进度','analysis.results':'查看提取结果','analysis.updateResult':'修正提取结果','analysis.continue':'继续消息识别','analysis.retry':'重试失败消息','analysis.fetch':'获取新消息并识别',
 'radar.fetch':'获取资讯并生成摘要','radar.collect':'获取资讯','radar.summary':'生成资讯摘要','radar.update':'保存资讯摘要','radar.toTask':'将资讯转为待办','radar.toKnowledge':'将资讯保存为知识',
 'knowledge.search':'搜索知识','knowledge.read':'读取知识','knowledge.create':'创建待审核知识','knowledge.update':'预览修改知识','knowledge.delete':'预览删除知识',
 'development.issue.get':'查询 Linky 工作项与可用状态','development.issue.update':'修改 Linky 工作项',
 'development.continue':'继续研发任务','development.pause':'暂停研发任务','development.guidance':'补充研发要求','development.approve':'通过人工审查','development.reject':'退回研发审查','development.detail':'查看研发进度','development.writeback':'预览回写 Linky 评论',
 'busyReply.status':'查看忙碌自动回复','busyReply.configure':'设置忙碌自动回复','office.adoptReply':'采纳为回复草稿','office.saveKnowledge':'将工作成果保存为知识','office.start':'开始日常工作','office.status':'查看办公进度','office.retry':'继续办公作业','office.cancel':'停止办公作业',
 'confirm':'确认执行','cancel':'取消确认操作','search':'搜索工作台','messages.fetch':'获取消息',
}
const names:Record<string,string>={enabled:'开启',jobId:'成果编号',stepId:'步骤编号',id:'事项编号',query:'查询内容',status:'状态',stage:'回复阶段',dueAt:'截止时间',priority:'优先级',title:'标题',description:'描述',snippet:'摘要',body:'正文',text:'内容',note:'说明',assignee:'负责人',tags:'标签',kind:'类型',period:'周期',limit:'最多条数',offset:'起始位置',runId:'识别轮次',includeCompleted:'包含已完成',includeDone:'包含已处理',includeWeb:'搜索互联网',replyIds:'待回复编号',taskId:'待办编号',sourceId:'来源编号',onlyIds:'指定条目',ids:'知识片段编号',eventType:'事项类型',deliverable:'交付内容',meetingStart:'会议开始',meetingEnd:'会议结束',meetingLocation:'会议地点',registrationTarget:'登记对象',change:'技术变化',usage:'应用场景',risk:'采用风险',practice:'推荐实践'}
const values:Record<string,string>={ready:'待处理',running:'进行中',completed:'已完成',cancelled:'已取消',failed:'失败',draft:'草稿',waiting_approval:'待确认',urgent:'紧急',high:'高',normal:'普通',low:'低',all:'全部',task:'待办',reply:'待回复',reply_batch:'批量回复草稿',work_report:'工作报告',task_assist:'待办处理方案',day:'日报',week:'周报',meeting:'会议',feature:'研发需求',logging:'日志记录',other:'其他'}
function safeValue(value:any,key:string):string|number|boolean|string[]|undefined {
 if(value===null)return key==='dueAt'?'不设截止时间':undefined
 if(typeof value==='string'){const text=value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,360);return ['status','priority','kind','period','eventType'].includes(key)?(Object.hasOwn(values,text)?values[text]:text):text}
 if(typeof value==='number'&&Number.isFinite(value))return value
 if(typeof value==='boolean')return value
 if(Array.isArray(value))return value.filter(v=>typeof v==='string').slice(0,20).map(v=>v.slice(0,120))
 return undefined
}
export function describeAssistantCommand(operation:string,parameters:any={}):AssistantCommandDisplay {
 const known=Object.hasOwn(labels,operation),result:AssistantCommandDisplay={label:known?labels[operation]:'未识别的助手操作',parameters:{}}
 if(!known)return result
 if(operation==='busyReply.configure'&&typeof parameters?.enabled==='boolean')result.label=parameters.enabled?'开启忙碌自动回复':'关闭忙碌自动回复'
 if(operation==='office.start'){if(parameters?.kind==='work_report')result.label=parameters?.input?.period==='week'?'生成周报':'生成日报';else if(parameters?.kind==='task_assist')result.label='生成待办处理方案';else if(parameters?.kind==='reply_batch'){const n=Array.isArray(parameters?.input?.replyIds)?parameters.input.replyIds.length:0;result.label=n?'生成 '+n+' 条回复草稿':'生成回复草稿'}}
 const sources=[parameters,parameters?.patch,parameters?.input]
 for(const source of sources)if(source&&typeof source==='object')for(const [key,label] of Object.entries(names)){
  const value=safeValue(source[key],key);if(value!==undefined)result.parameters[label]=value
 }
 if(parameters?.latestRun===true)result.parameters['范围']='最新一轮'
 if(parameters?.retryFailed===true)result.parameters['包含失败重试']=true
 return result
}
export function describeAssistantTool(name:string,args:any={}):AssistantCommandDisplay|null {
 if(typeof args==='string')try{args=JSON.parse(args)}catch{return null}
 if(!args||typeof args!=='object'||Array.isArray(args))return null
 if(name==='workbench_assistant_action')return describeAssistantCommand(String(args.operation||''),args)
 const fixed:Record<string,string>={workbench_list_tasks:'task.list',workbench_create_task:'task.create',workbench_update_task:'task.update',workbench_task_brief:'task.detail',workbench_record_run:'task.recordRun',workbench_analyze_messages:'analysis.continue',workbench_summarize_radar:'radar.summary',workbench_fetch_radar:'radar.collect',workbench_fetch_mentions:'messages.fetch',workbench_update_radar:'radar.update',workbench_search:'search',workbench_knowledge_retrieve:'knowledge.search',workbench_knowledge_read:'knowledge.read'}
 if(Object.hasOwn(fixed,name))return describeAssistantCommand(fixed[name],args)
 const variants:Record<string,Record<string,string>>={workbench_office_workflow:{start:'office.start',status:'office.status',retry:'office.retry',cancel:'office.cancel'},workbench_manage_replies:{list:'reply.list',create:'reply.create',set_stage:'reply.stage'},workbench_manage_knowledge:{list:'knowledge.search',create:'knowledge.create',update:'knowledge.update',delete:'knowledge.delete'}}
 const variant=Object.hasOwn(variants,name)?variants[name]:null,operation=variant&&Object.hasOwn(variant,args.action)?variant[args.action]:null;return operation?describeAssistantCommand(operation,args):null
}
