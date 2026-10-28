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

const WORKBENCH_REMOTE_SIGNATURES = [
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
  { method: 'analyzeReset', params: [] },
  { method: 'radarSummarize', params: ['request'] },
  { method: 'exportMigration', params: [] },
  { method: 'importMigration', params: ['request'] },
  { method: 'analyzeConfirm', params: ['entryId'] },
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
]

function remoteJsonParam(name) {
  return { name: name, wire: name, source: 'json', codec: { mode: 'src-json' } }
}

function remoteJsonInvocation(service, namespace, method, params) {
  return {
    id: PLUGIN_NAME + '#' + namespace + '/' + method,
    service: service,
    namespace: namespace,
    method: method,
    invocation: { kind: 'direct' },
    parameters: params.map(remoteJsonParam),
    result: { mode: 'src-json' },
  }
}

const WORKBENCH_REMOTE = {
  package: PLUGIN_NAME,
  face: 'host',
  schemas: [],
  model: { services: [], events: [], objects: [] },
  invocations: WORKBENCH_REMOTE_SIGNATURES.map(function (entry) {
    return remoteJsonInvocation('workbench', 'workbench', entry.method, entry.params)
  }),
}
