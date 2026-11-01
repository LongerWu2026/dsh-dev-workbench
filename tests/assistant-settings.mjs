/** Assistant naming persistence over a disposable profile. */
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-assistant-settings-'));process.env.DSH_HOME=home
try{
 const outfile=join(home,'fixture.mjs');await build({stdin:{contents:`export {systemService} from './src/host/application/system-service.ts';export {normalizeSettings} from './src/host/domain/model.ts';export {loadWorkbenchState} from './src/host/storage/state-store.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile,bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent'})
 const {systemService,normalizeSettings,loadWorkbenchState}=await import(outfile)
 assert.equal(normalizeSettings({}).assistantName,'AI 助手')
 const before=JSON.stringify(loadWorkbenchState().settings.automation)
 await systemService.saveSettings({assistantName:'  小鲸  '})
 assert.equal(loadWorkbenchState().settings.assistantName,'小鲸');assert.equal(JSON.stringify(loadWorkbenchState().settings.automation),before)
 for(const assistantName of ['', ' ', 'x'.repeat(41), '名字\n换行', 42])await assert.rejects(systemService.saveSettings({assistantName}),/助手名称/)
 assert.equal(loadWorkbenchState().settings.assistantName,'小鲸')
 const persisted=JSON.parse(readFileSync(join(home,'storages/dev-workbench/state.json'),'utf8'));assert.equal(persisted.settings.assistantName,'小鲸')
 console.log('assistant-settings: default, trim, validation, persistence and unrelated settings passed')
}finally{rmSync(home,{recursive:true,force:true})}
