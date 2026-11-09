/** Public data service regression; isolated profile, no user database or credentials. */
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
const home=mkdtempSync(join(tmpdir(),'wb-data-workspace-service-'))
process.env.DSH_HOME=home
const target=resolve('.tmp/data-validation/workspace-service.mjs')
await build({stdin:{contents:"export {dataService} from './src/host/application/data-service.ts'; export {disposeDataTools} from './src/host/integrations/data-tools.ts';",resolveDir:resolve('.'),loader:'ts'},outfile:target,bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent'})
const {dataService:api,disposeDataTools}=await import(target+'?'+Date.now())
try{
 const saved=await api.dataSave({kind:'postgres',name:'原连接',host:'db.fixture',database:'orders',username:'reader',password:'private-fixture-password'})
 const id=saved.config.id
 const first=await api.dataWorkspaceLoad({id})
 assert.equal(first.id,id)
 assert.deepEqual(first.workspace,{})
 const written=await api.dataWorkspaceSave({id,key:first.key,revision:first.revision,patch:{query:'SELECT id FROM orders ORDER BY id',instruction:'继续统计',pageSize:50,selected:[{name:'orders',schemaName:'public'}]}})
 assert.equal(written.workspace.instruction,'继续统计')
 const defaultLoad=await api.dataWorkspaceLoad()
 assert.equal(defaultLoad.id,id)
 assert.equal(defaultLoad.workspace.query,'SELECT id FROM orders ORDER BY id')
 const child=execFileSync(process.execPath,['--input-type=module','-e',`
  const {dataService:api}=await import(process.argv[1]);
  const restored=await api.dataWorkspaceLoad();
  process.stdout.write(JSON.stringify(restored));
 `,target],{env:{...process.env,DSH_HOME:home},encoding:'utf8',timeout:20000})
 const restored=JSON.parse(child)
 assert.equal(restored.id,id)
 assert.equal(restored.workspace.instruction,'继续统计')
 assert.equal(JSON.stringify(restored).includes('private-fixture-password'),false)
 await api.dataSave({...saved.config,name:'新名称',password:'rotated-fixture-password'})
 const renamed=await api.dataWorkspaceLoad({id})
 assert.equal(renamed.key,first.key)
 assert.equal(renamed.workspace.query,written.workspace.query)
 await api.dataSave({...saved.config,database:'inventory'})
 const moved=await api.dataWorkspaceLoad({id})
 assert.notEqual(moved.key,first.key)
 assert.deepEqual(moved.workspace,{})
 await assert.rejects(api.dataWorkspaceSave({id,key:first.key,revision:written.revision,patch:{query:'STALE'}}),/变化|目标|连接|不匹配/)
 assert.deepEqual((await api.dataWorkspaceLoad({id:''})).workspace,{})
 await assert.rejects(api.dataWorkspaceLoad({id:'not-a-real-connection'}),/连接/)
 await api.dataWorkspaceSave({id,key:moved.key,revision:moved.revision,patch:{query:'SELECT id FROM inventory'}})
 const other=await api.dataSave({...saved.config,id:undefined,name:'另一条连接'})
 await assert.rejects(api.dataDelete({id}),/确认删除/)
 assert.equal((await api.dataConnections()).connections.length,2)
 assert.deepEqual(await api.dataDelete({id,confirmed:true}),{deleted:id})
 assert.deepEqual((await api.dataConnections()).connections.map(row=>row.id),[other.config.id])
 await assert.rejects(api.dataWorkspaceLoad({id}),/找不到该数据连接/)
 await assert.rejects(api.dataTest({id}),/尚未解锁/)
 assert.deepEqual(await api.dataDelete({id,confirmed:true}),{deleted:id})
 const replacement=await api.dataSave({...saved.config,id:undefined,database:'inventory'})
 const recovered=await api.dataWorkspaceLoad({id:replacement.config.id})
 assert.equal(recovered.key,moved.key)
 assert.equal(recovered.workspace.query,'SELECT id FROM inventory')
 console.log('data-workspace-service: restores after restart, isolates targets, rejects stale writes and preserves memory after confirmed connection deletion')
}finally{disposeDataTools()}
