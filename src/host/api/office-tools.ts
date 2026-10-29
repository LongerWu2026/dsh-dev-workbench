import {knowledgeAllowed,defaultKnowledgeScope} from '../knowledge/retrieval.js'
import { renderToolText, toolOutputSchema } from './tool-output.js'
import { KNOWLEDGE_KINDS, REPLY_STATUSES, ensureArray } from '../domain/model.js'
import { workbenchApi } from '../application/workbench-service.js'
import { loadWorkbenchState } from '../storage/state-store.js'
import { asString } from '../platform/runtime.js'
function officeToolDefinitions(): any {
    function tool(name?: any, description?: any, properties?: any, required?: any, execute?: any): any {
        return { name, description, parameters: { type: 'object', properties, required: required || [], additionalProperties: false }, output: { schema: toolOutputSchema(), render: renderToolText }, execute };
    }
    return [
        tool('workbench_knowledge_retrieve','按当前项目检索已确认知识原文，返回片段ID、版本、正文和行号。回答时用[知识:片段ID]引用；无命中不能冒充知识答案。', {query:{type:'string'},projectId:{type:'string'},accountId:{type:'string'}},['query'],async(args:any)=>{const result=await workbenchApi.knowledgeRetrieve({query:args.query,scope:{projectId:args.projectId,accountId:args.accountId}});return {text:JSON.stringify(result),...result}}),
        tool('workbench_knowledge_read','重新读取检索得到的知识片段；旧版本、失效、归档或其他范围的片段会拒绝。',{ids:{type:'array',items:{type:'string'},maxItems:8},projectId:{type:'string'},accountId:{type:'string'}},['ids'],async(args:any)=>{const result=await workbenchApi.knowledgeRead({ids:args.ids,scope:{projectId:args.projectId,accountId:args.accountId}});return {text:JSON.stringify(result),...result}}),
        tool('workbench_office_workflow', '用户要求批量准备回复、生成日报周报或整理待办处理方案时，启动可恢复办公作业。start后立即返回，不轮询。status查询进度，retry继续未完成步骤，cancel停止后续步骤。草稿不自动发送，不执行项目命令。', {
            action:{type:'string',enum:['start','status','retry','cancel']},kind:{type:'string',enum:['reply_batch','work_report','task_assist']},replyIds:{type:'array',items:{type:'string'},maxItems:20},taskId:{type:'string'},period:{type:'string',enum:['day','week']},id:{type:'string'}
        }, ['action'], async(args:any)=>{
            if(args.action==='start')await workbenchApi.officeWorkflowStart(args.kind,{replyIds:args.replyIds,taskId:args.taskId,period:args.period});
            else if(['retry','cancel'].includes(args.action))await workbenchApi.officeWorkflowControl(args.id,args.action);
            else if(args.action!=='status')throw new Error('未知动作');
            const jobs=loadWorkbenchState().jobs.filter((j:any)=>!args.id||j.id===args.id).slice(-20).map((j:any)=>({id:j.id,kind:j.kind,status:j.status,error:j.error,steps:j.steps?.map((s:any)=>({id:s.id,status:s.status,error:s.error,artifact:s.artifact}))}));
            return {text:JSON.stringify(jobs),jobs};
        }),
        tool('workbench_manage_replies', '查询或更新待回复。先查询取得真实 Reply ID；收到只标记已确认收到，实质答复才标已回复。此工具只维护本地记录，不发送消息。', {
            action: { type: 'string', enum: ['list', 'create', 'set_stage'] }, id: { type: 'string' }, sourceId: { type: 'string' }, stage: { type: 'string', enum: REPLY_STATUSES }, includeDone: { type: 'boolean' }, query: { type: 'string' },
        }, ['action'], async function (args?: any): Promise<any> {
            if (args.action === 'create') { const state = await workbenchApi.replyFromSource(args.sourceId); const reply=state.replies.find((row:any)=>row.sourceId===args.sourceId); return {text:'待回复已登记：'+reply.id,reply,revision:state.revision} }
        if (args.action === 'set_stage') {
                if (!args.id || !REPLY_STATUSES.includes(args.stage))
                    throw new Error('需要有效 Reply ID 和阶段');
                const state = await workbenchApi.setReplyStage(args.id, args.stage);
                const reply = state.replies.find(function (row?: any): any { return row.id === args.id; });
                return { text: '回复阶段已保存：' + reply.stage, reply, revision: state.revision };
            }
            const replies = ensureArray(loadWorkbenchState().replies).filter(function (row?: any): any { return (args.includeDone || ['待回复', '已确认收到'].includes(row.stage)) && (!args.query || [row.snippet, row.contact, row.groupName].join(' ').includes(args.query)); });
            return { text: JSON.stringify(replies), replies };
        }),
        tool('workbench_manage_knowledge', '查询、创建或更新工作台知识。新建或修改的内容进入待审核，不自动确认为事实；更新前先查询真实 ID，正文保留原文来源链接。', {
            action: { type: 'string', enum: ['list', 'create', 'update'] }, id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, url: { type: 'string' }, query: { type: 'string' }, kind: { type: 'string', enum: KNOWLEDGE_KINDS },
        }, ['action'], async function (args?: any): Promise<any> {
            if (args.action === 'list') {
                const rows = ensureArray(loadWorkbenchState().knowledge).filter(function (row?: any): any { return knowledgeAllowed(row,defaultKnowledgeScope(loadWorkbenchState()),true) && (!args.query || (row.title + ' ' + row.body).includes(args.query)); }).slice(-50);
                return { text: JSON.stringify(rows), items: rows };
            }
            if (args.action === 'create' && !asString(args.title, 200))
                throw new Error('知识标题不能为空');
            if (args.action === 'update' && !args.id)
                throw new Error('更新需要真实知识 ID');
            const patch: any = {reviewState:'candidate'};
            for (const key of ['title', 'body', 'url', 'kind'])
                if (args[key] !== undefined)
                    patch[key] = args[key];
            const state = args.action === 'create' ? await workbenchApi.createKnowledge(patch) : await workbenchApi.updateKnowledge(args.id, patch);
            const item = args.action === 'create' ? state.knowledge.find(function (row?: any): any { return row.title === String(args.title || '').trim() && (row.url || '') === (args.url && /^https?:\/\//.test(args.url) ? args.url.trim() : ''); }) : state.knowledge.find(function (row?: any): any { return row.id === args.id; });
            return { text: '知识已保存：' + item.id, item, revision: state.revision };
        }),
        tool('workbench_analyze_messages', '使用宿主模型分析已采集消息，区分回复和处理义务；关闭自动建待办时等待人工确认。onlyIds可限定来源或队列条目，省略则处理待识别队列。立即返回jobId，完成与失败数量在作业结果中查看。', { limit: { type: 'number' }, onlyIds: {type:'array',items:{type:'string'}} }, [], async function (args?: any): Promise<any> {
            const result = await workbenchApi.analysisStart(args);
            return Object.assign({ text: JSON.stringify(result) }, result);
        }),
        tool('workbench_summarize_radar', '读取资讯原文并生成四段摘要，保留来源；单条失败如实报告，可指定资讯 ID。', { onlyIds: { type: 'array', items: { type: 'string' } }, retryFailed: { type: 'boolean' } }, [], async function (args?: any): Promise<any> {
            const result = await workbenchApi.radarSummaryStart(args);
            return Object.assign({ text: JSON.stringify(result) }, result);
        }),
    ];
}

export { officeToolDefinitions }

