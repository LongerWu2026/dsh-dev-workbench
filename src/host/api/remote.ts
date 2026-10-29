import { PLUGIN_NAME } from '../platform/runtime.js'
/* ============================================================================
 * dev-workbench host — Remote endpoints
 *
 * Hand-written `src-json` descriptors registered through ctx.typert.register:
 * the supported manual path for a plain-JavaScript plugin, without a generated
 * schema bundle. Each endpoint becomes `workbench/<method>` on the shared
 * `/api` channel, callable from the Client half through
 * `ctx.connection.rpc.call('/api', 'workbench/<method>', { args })`.
 *
 * The plain-object `workbenchApi` carries the same service under
 * `ctx.provide('workbench', …)`, so the gateway can bind the two halves.
 * ========================================================================== */
const WORKBENCH_REMOTE_SIGNATURES: any = [
    {method:'projectRuntime',params:['request']},
    {method:'projectStart',params:['request']},
    {method:'projectStop',params:['request']},
    {method:'projectOpen',params:['request']},
    {method:'httpDebug',params:['request']},
    {method:'debugCancel',params:['request']},
    {method:'mcpConnect',params:['request']},
    {method:'mcpCall',params:['request']},
    {method:'mcpDisconnect',params:['request']},
    {method:'webAIState',params:[]},
    {method:'webAIConfigure',params:['request']},
    {method:'webAICreateTopic',params:['request']},
    {method:'webAISaveConversation',params:['request']},
    {method:'webAIStart',params:['request']},
    {method:'webAIClaim',params:['request']},
    {method:'webAIResumeCapture',params:['request']},
    {method:'webAIUpdate',params:['request']},
    {method:'webAICancel',params:['request']},
    {method:'webAIRecord',params:['request']},
    {method:'webAIManageTopic',params:['request']},
    {method:'webAIEditQuestion',params:['request']},
    {method:'webAIOpenExternal',params:['request']},
    {method:'knowledgeRetrieve',params:['request']},
    {method:'knowledgeRead',params:['request']},
    {method:'knowledgeTraces',params:['request']},
    { method: 'officeWorkflowStart', params: ['kind', 'input'] },
    { method: 'officeWorkflowControl', params: ['id', 'action'] },
    { method: 'adoptReplyArtifact', params: ['jobId', 'stepId'] },
    { method: 'backgroundHistory', params: ['request'] },
    { method: 'archiveBackgroundHistory', params: ['ids'] },
    { method: 'evaluateRecognition', params: [] },
    { method: 'operationsStatus', params: [] },
    { method: 'changesPage', params: ['request'] },
    { method: 'undoChange', params: ['id'] },
    { method: 'snoozeReminder', params: ['id', 'minutes'] },
    { method: 'exportCalendar', params: ['id'] },
    { method: 'generateReplyDraft', params: ['id'] },
    { method: 'saveReplyDraft', params: ['id', 'text'] },
    { method: 'sendReply', params: ['request'] },
    { method: 'prepareTaskReply', params: ['taskId'] },
    { method: 'reviewAnalysis', params: ['entryId', 'verdict', 'note'] },
    { method: 'dataPage', params: ['request'] },
    { method: 'archiveRecord', params: ['collection', 'id', 'archived'] },
    { method: 'snapshot', params: [] },
    { method: 'saveSettings', params: ['patch'] },
    { method: 'createTask', params: ['input'] },
    { method: 'updateTask', params: ['id', 'patch'] },
    { method: 'deleteTask', params: ['id'] },
    { method: 'addSource', params: ['input'] },
    { method: 'createKnowledge', params: ['input'] },
    { method: 'updateKnowledge', params: ['id', 'patch'] },
    { method: 'deleteKnowledge', params: ['id'] },
    { method: 'saveRadarItem', params: ['input'] },
    { method: 'updateRadar', params: ['id', 'patch'] },
    { method: 'deleteRadarItem', params: ['id'] },
    { method: 'recordRun', params: ['input'] },
    { method: 'updateRun', params: ['id', 'patch'] },
    { method: 'saveProject', params: ['input'] },
    { method: 'fetchRadar', params: [] },
    { method: 'fetchMentions', params: [] },
    { method: 'extractCandidates', params: [] },
    { method: 'acceptCandidate', params: ['id', 'patch'] },
    { method: 'rejectCandidate', params: ['id'] },
    { method: 'createTaskFromRadar', params: ['id'] },
    { method: 'deleteProject', params: ['id'] },
    { method: 'search', params: ['request'] },
    { method: 'environment', params: [] },
    { method: 'github', params: [] },
    { method: 'reset', params: ['scope'] },
    { method: 'seedDemo', params: [] },
    { method: 'analysisStatus', params: [] },
    { method: 'analyzeRun', params: ['request'] },
    { method: 'analysisStart', params: ['request'] },
    { method: 'radarSummaryStart', params: ['request'] },
    { method: 'analyzeReset', params: [] },
    { method: 'analysisRetry', params: ['entryId'] },
    { method: 'analysisCancel', params: ['entryId'] },
    { method: 'radarSummarize', params: ['request'] },
    { method: 'exportMigration', params: [] },
    { method: 'importMigration', params: ['request'] },
    { method: 'analyzeConfirm', params: ['entryId'] },
    { method: 'setReplyStage', params: ['id', 'stage'] },
    { method: 'replyFromSource', params: ['sourceId'] },
    { method: 'taskMarkHuman', params: ['id', 'mark'] },
    { method: 'assistantMessage', params: ['request'] },
    { method: 'deleteSource', params: ['id'] },
    { method: 'deleteRun', params: ['id'] },
    { method: 'deleteCandidate', params: ['id'] },
    { method: 'assistantAsk', params: ['request'] },
    { method: 'assistantSend', params: ['request'] },
    { method: 'assistantDelta', params: ['request'] },
    { method: 'assistantHistory', params: [] },
    { method: 'assistantSessions', params: ['request'] },
    { method: 'assistantTranscript', params: ['request'] },
    { method: 'assistantReset', params: [] },
    { method: 'automationRun', params: [] },
    { method: 'automationStatus', params: [] },
    { method: 'backup', params: [] },
    { method: 'backups', params: [] },
    { method: 'restoreBackup', params: ['id'] },
    { method: 'revision', params: [] },
    { method: 'diagnostics', params: [] },
];
function remoteJsonParam(name?: any): any {
    return { name: name, wire: name, source: 'json', codec: { mode: 'src-json' } };
}
function remoteJsonInvocation(service?: any, namespace?: any, method?: any, params?: any): any {
    return {
        id: PLUGIN_NAME + '#' + namespace + '/' + method,
        service: service,
        namespace: namespace,
        method: method,
        invocation: { kind: 'direct' },
        parameters: params.map(remoteJsonParam),
        result: { mode: 'src-json' },
    };
}
const WORKBENCH_REMOTE: any = {
    package: PLUGIN_NAME,
    face: 'host',
    schemas: [],
    model: { services: [], events: [], objects: [] },
    invocations: WORKBENCH_REMOTE_SIGNATURES.map(function (entry?: any): any {
        return remoteJsonInvocation('workbench', 'workbench', entry.method, entry.params);
    }),
};

export { WORKBENCH_REMOTE_SIGNATURES, remoteJsonParam, remoteJsonInvocation, WORKBENCH_REMOTE }
