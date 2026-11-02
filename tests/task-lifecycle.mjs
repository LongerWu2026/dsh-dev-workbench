/** Removing task approval must not lose legacy personal work or relax execution gates. */
import assert from 'node:assert/strict'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {build} from 'esbuild'
const dir=mkdtempSync(join(tmpdir(),'wb-task-lifecycle-'))
await build({entryPoints:['src/host/domain/model.ts'],outfile:join(dir,'model.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const h=await import(join(dir,'model.mjs'))
let checks=0;const check=(label,fn)=>{fn();checks++;console.log('✓ '+label)}
const old={id:'legacy-task',title:'个人事项',description:'保留工作内容',status:'waiting_approval',priority:'high',dueAt:'2026-11-04T01:00:00.000Z',sourceRefId:'original-message',tags:['保留'],createdAt:'2026-10-28T01:00:00.000Z',humanGuard:{editedFields:['title'],ignored:false,handledConfirmed:false}}
check('个人任务状态不再提供审批，保留草稿、待处理、执行、完成、失败和取消',()=>assert.deepEqual(h.TASK_STATUSES,['draft','ready','running','completed','failed','cancelled']))
check('读取旧待审批任务兼容为待处理，ID、正文、来源、时间与人工保护不丢失',()=>{const task=h.normalizeState({version:2,tasks:[old]}).state.tasks[0];assert.equal(task.status,'ready');for(const key of ['id','title','description','priority','dueAt','sourceRefId','createdAt'])assert.equal(task[key],old[key]);assert.deepEqual(task.tags,old.tags);assert.deepEqual(task.humanGuard.editedFields,['title'])})
check('旧客户端提交审批状态也不会重新产生审批任务',()=>assert.equal(h.normalizeTask({status:'waiting_approval'},{...old,status:'running'}).status,'ready'))
check('局部编辑旧任务可正常继续处理；现有合法任务状态不受影响',()=>{assert.equal(h.normalizeTask({title:'新标题'},old).status,'ready');for(const status of h.TASK_STATUSES)assert.equal(h.normalizeTask({description:'仅编辑正文'},{...old,status}).status,status)})
check('任务状态简化不影响执行授权等待和AI识别人工确认',()=>{assert.ok(h.RUN_STATUSES.includes('waiting_approval'));assert.ok(h.ANALYSIS_STATUSES.includes('awaiting_human'))})
console.log('task-lifecycle: '+checks+' checks passed; isolated data only')
