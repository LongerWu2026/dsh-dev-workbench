import assert from 'node:assert/strict'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const directory=mkdtempSync(join(tmpdir(),'web-ai-unsent-'));process.env.DSH_HOME=directory
await build({stdin:{contents:"export {webAIService} from './src/host/application/web-ai-service.ts';export {normalizeWebAI} from './src/shared/web-ai.ts'",resolveDir:resolve('.'),loader:'ts'},outfile:join(directory,'service.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const {webAIService,normalizeWebAI}=await import(join(directory,'service.mjs')),api=webAIService()
let state=await api.webAIStart({requestId:'unsent-test-0001',questions:['本轮问题'],providers:['kimi','doubao']})
const round=state.rounds[0],request=providerId=>({roundId:round.id,providerId})
const kimi=await api.webAIClaim(request('kimi')),doubao=await api.webAIClaim(request('doubao'))
await api.webAIUpdate({...request('kimi'),executionId:kimi.executionId,status:'completed',text:'已经完成的回答'})
state=await api.webAIUpdate({...request('doubao'),executionId:doubao.executionId,status:'needs_login'})
const blocked=state.rounds[0].answers[1]
assert.equal(blocked.submission,'not_sent')
const retry={...request('doubao'),retryUnsent:true,expectedUpdatedAt:blocked.updatedAt}
await assert.rejects(()=>api.webAIClaim({...retry,expectedUpdatedAt:'stale'}),/状态已变化/)
const claims=await Promise.allSettled([api.webAIClaim(retry),api.webAIClaim(retry)])
assert.equal(claims.filter(c=>c.status==='fulfilled'&&c.value.executionId).length,1)
const executionId=claims.find(c=>c.status==='fulfilled').value.executionId
await assert.rejects(()=>api.webAIUpdate({...request('doubao'),executionId:doubao.executionId,status:'prepared',submission:'attempting'}),/权限已失效/)
state=await api.webAIUpdate({...request('doubao'),executionId,status:'prepared',submission:'attempting'})
assert.equal(normalizeWebAI(state,true).rounds[0].answers[1].submission,'attempting')
state=await api.webAICancel({topicId:round.topicId})
await assert.rejects(()=>api.webAIClaim({...retry,expectedUpdatedAt:state.rounds[0].answers[1].updatedAt}),/状态已变化/)
assert.equal(state.rounds[0].answers[0].text,'已经完成的回答')
assert.equal(state.rounds.length,1)
const legacy=normalizeWebAI({...state,rounds:[{...round,answers:[{...blocked,submission:undefined}]}]},true)
assert.equal(legacy.rounds[0].answers[0].submission,undefined)
const attachments=[{id:'file-1',name:'original.txt',size:3,type:'text/plain'}]
state=await api.webAIStart({requestId:'unsent-file-0001',questions:['附件问题'],providers:['doubao'],attachments})
const fileRound=state.rounds.at(-1),fileClaim=await api.webAIClaim({roundId:fileRound.id,providerId:'doubao'})
state=await api.webAIUpdate({roundId:fileRound.id,providerId:'doubao',executionId:fileClaim.executionId,status:'needs_login'})
const fileRetry={roundId:fileRound.id,providerId:'doubao',retryUnsent:true,expectedUpdatedAt:state.rounds.at(-1).answers[0].updatedAt}
await assert.rejects(()=>api.webAIClaim(fileRetry),/原附件/)
assert.ok((await api.webAIClaim({...fileRetry,attachments})).executionId)
await api.webAICancel({topicId:fileRound.topicId})
console.log('web-ai-unsent: concurrent claim, stale fence, submit uncertainty, history compatibility, attachment requirements passed')
