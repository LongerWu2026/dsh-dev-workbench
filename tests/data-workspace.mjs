/** Public storage boundary: isolated profiles, no database or model calls. */
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {existsSync,mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
const home=mkdtempSync(join(tmpdir(),'wb-data-workspace-'));process.env.DSH_HOME=home
const entry=resolve('src/host/storage/data-workspace.ts')
const source=existsSync(entry)?(await build({entryPoints:[entry],bundle:true,write:false,packages:'external',platform:'node',format:'esm',logLevel:'silent'})).outputFiles[0].text:''
const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64')
const api=await import(url)
const config={id:'connection-a',name:'Orders',kind:'mysql',host:'db.example',port:3306,database:'orders',username:'reader',tls:false,ca:'',url:''}
assert.equal(typeof api.readDataWorkspace,'function','public store can restore a saved connection workspace')
const initial=await api.readDataWorkspace(config)
assert.deepEqual(initial.workspace,{})
const saved=await api.saveDataWorkspace(config,{key:initial.key,revision:initial.revision,patch:{query:'SELECT id FROM orders ORDER BY id',instruction:'待发送的需求',selected:[{name:'orders',schemaName:'orders'}]}})
const restored=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`
 const api=await import(process.env.WORKSPACE_MODULE);
 console.log(JSON.stringify(await api.readDataWorkspace(JSON.parse(process.env.WORKSPACE_CONFIG))));
`],{env:{...process.env,WORKSPACE_MODULE:url,WORKSPACE_CONFIG:JSON.stringify(config)},encoding:'utf8'}))
assert.deepEqual(restored,saved,'new host process restores the last confirmed workspace without running SQL')
console.log('✓ new process restores query, unsent requirement and selected object')
const duplicate={...config,id:'duplicate-card',name:'Renamed',host:'DB.EXAMPLE',password:'rotated',passwordSeal:{ciphertext:'private-seal'}}
assert.equal(api.dataWorkspaceKey(duplicate),saved.key,'rename, duplicate cards, hostname case and credential rotation share the same target')
assert.equal((await api.readDataWorkspace(duplicate)).workspace.instruction,'待发送的需求')
for(const changed of [{database:'other'},{username:'admin'},{tls:true},{ca:'CA certificate'},{host:'127.0.0.1'}]){
 assert.deepEqual((await api.readDataWorkspace({...config,...changed})).workspace,{},'different target/security context stays isolated')
}
const redis={...config,kind:'redis',port:6379,database:''}
assert.equal(api.dataWorkspaceKey(redis),api.dataWorkspaceKey({...redis,database:'0'}))
const es={...config,kind:'es',url:'https://ES.EXAMPLE:443/prefix/'}
assert.equal(api.dataWorkspaceKey(es),api.dataWorkspaceKey({...es,host:'unused',port:9201,url:'https://es.example/prefix'}))
assert.notEqual(api.dataWorkspaceKey(es),api.dataWorkspaceKey({...es,url:'https://es.example/other'}))
console.log('✓ normalized target identity shares only equivalent saved configurations')
const whitelistInput={query:'SELECT 2',instruction:'draft',mode:'query',generated:{query:'SELECT 2',mode:'query',selected:[{name:'orders',password:'selected-secret'}],passwordSeal:'draft-seal',explanation:'generated'},result:{kind:'mysql',rows:[{id:2}],columns:['id'],durationMs:5,truncation:{rowLimit:false,byteLimit:true,cellLimit:false,passwordSeal:'truncation-secret'},password:'result-secret',form:{password:'form-secret'}},form:{password:'form-secret'},password:'top-secret',passwordSeal:'private-seal',objects:[{name:'catalog-must-not-persist'}],error:'transient-stack'}
const clean=await api.saveDataWorkspace(duplicate,{key:saved.key,revision:saved.revision,patch:whitelistInput})
assert.deepEqual(clean.workspace.generated,{query:'SELECT 2',mode:'query',selected:[{name:'orders'}],explanation:'generated'})
assert.deepEqual(clean.workspace.result,{kind:'mysql',rows:[{id:2}],columns:['id'],durationMs:5,truncation:{rowLimit:false,byteLimit:true,cellLimit:false}})
assert.equal(clean.workspace.form,undefined)
const privateFile=join(home,'storages/dev-workbench/data-workspaces.json')
const {readFileSync,statSync}=await import('node:fs')
assert.doesNotMatch(readFileSync(privateFile,'utf8'),/form-secret|top-secret|private-seal|draft-seal|selected-secret|result-secret|catalog-must-not-persist|transient-stack|passwordSeal/)
assert.equal(statSync(privateFile).mode&0o777,0o600)
assert.equal(existsSync(join(home,'storages/dev-workbench/state.json')),false,'workspace stays outside generic workbench state')
await assert.rejects(api.saveDataWorkspace(config,{key:clean.key,revision:clean.revision,patch:{query:'x'.repeat(50001)}}),/查询|query|字符/)
assert.deepEqual(await api.readDataWorkspace(config),clean,'validation failure leaves last confirmed workspace intact')
console.log('✓ strict nested whitelist excludes forms, secrets and transient state')
await assert.rejects(api.saveDataWorkspace(config,{key:'client-forged-target',revision:clean.revision,patch:{query:'SELECT bad'}}),/目标|连接|身份/)
await assert.rejects(api.saveDataWorkspace(config,{key:clean.key,revision:clean.revision-1,patch:{query:'SELECT stale'}}),/冲突|修订|重新加载/)
const concurrent=await Promise.allSettled([
 api.saveDataWorkspace(config,{key:clean.key,revision:clean.revision,patch:{query:'SELECT winner'}}),
 api.saveDataWorkspace(config,{key:clean.key,revision:clean.revision,patch:{query:'SELECT loser'}}),
])
assert.equal(concurrent.filter(item=>item.status==='fulfilled').length,1)
const winner=concurrent.find(item=>item.status==='fulfilled').value
assert.equal((await api.readDataWorkspace(config)).workspace.query,'SELECT winner')
const cleared=await api.clearDataWorkspace(config,{key:winner.key,revision:winner.revision})
assert.deepEqual(cleared.workspace,{})
assert.ok(cleared.revision>winner.revision,'clear does not reuse an old revision')
await assert.rejects(api.saveDataWorkspace(config,{key:winner.key,revision:winner.revision,patch:{query:'SELECT resurrected'}}),/冲突|修订|重新加载/)
const afterClear=await api.saveDataWorkspace(config,{key:cleared.key,revision:cleared.revision,patch:{query:'SELECT fresh'}})
assert.ok(afterClear.revision>cleared.revision)
assert.deepEqual(await api.lastDataWorkspaceConnection(),{id:config.id,key:afterClear.key})
console.log('✓ stale writes and forged identities fail visibly; clear keeps revisions monotonic')
await assert.rejects(api.saveDataWorkspace(config,{key:afterClear.key,revision:afterClear.revision,patch:{aiTurns:[{instruction:'forged',clarification:'not a completed host reply'}]}}),/AI|对话|冲突/)
const turn={instruction:'列出订单',draft:{query:'SELECT id FROM orders',mode:'query',selected:[{name:'orders'}]}}
const appended=await api.appendDataWorkspaceTurn(config,{key:afterClear.key,turnId:'completed-1',turn,baseRevision:afterClear.revision})
assert.equal(appended.workspace.query,'SELECT fresh','AI completion merges the latest editor content')
assert.deepEqual(appended.workspace.aiTurns,[{...turn,id:'completed-1'}])
const other={...config,id:'other',database:'other'};await api.readDataWorkspace(other)
assert.deepEqual(await api.appendDataWorkspaceTurn(config,{key:appended.key,turnId:'completed-1',turn}),appended,'retry is idempotent and does not increment revision')
await api.appendDataWorkspaceTurn(config,{key:appended.key,turnId:'completed-2',turn:{instruction:' уточнение',clarification:'需要哪个时间范围？'}})
assert.deepEqual(await api.lastDataWorkspaceConnection(),{id:other.id,key:api.dataWorkspaceKey(other)},'late AI completion cannot switch the selected connection')
let latest=await api.readDataWorkspace(config)
await assert.rejects(api.saveDataWorkspace(config,{key:latest.key,revision:latest.revision,patch:{aiTurns:[]}}),/AI|对话|冲突/)
latest=await api.saveDataWorkspace(config,{key:latest.key,revision:latest.revision,patch:{aiTurns:latest.workspace.aiTurns,instruction:'unsent remains'}})
for(let i=3;i<=23;i++)latest=await api.appendDataWorkspaceTurn(config,{key:latest.key,turnId:'completed-'+i,turn:{instruction:'question '+i,clarification:'answer '+i}})
assert.equal(latest.workspace.aiTurns.length,20)
assert.equal(latest.workspace.aiTurns[0].id,'completed-4')
assert.equal(latest.workspace.instruction,'unsent remains')
assert.deepEqual(await api.appendDataWorkspaceTurn(config,{key:latest.key,turnId:'completed-1',turn}),latest,'retry of an aged-out turn cannot resurrect it or evict a newer reply')
const beforeClearAI=latest.revision
const clearedAI=await api.clearDataWorkspace(config,{key:latest.key,revision:latest.revision})
await assert.rejects(api.appendDataWorkspaceTurn(config,{key:latest.key,turnId:'late-after-clear',turn,baseRevision:beforeClearAI}),/清除|冲突|重新加载/)
assert.deepEqual(await api.readDataWorkspace(config),clearedAI)
console.log('✓ completed AI appends atomically, dedupes and cannot undo a clear or overwrite newer input')
await assert.rejects(api.saveDataWorkspace(config,{key:clearedAI.key,revision:clearedAI.revision,patch:{result:{kind:'es',result:{value:'界'.repeat(350000)}}}}),/1MiB|1MB|快照/)
assert.deepEqual(await api.readDataWorkspace(config),clearedAI)
let large=clearedAI
const largeTurn={instruction:'界'.repeat(2000),draft:{query:'界'.repeat(50000),mode:'query',selected:[],explanation:'界'.repeat(6000),rollback:'界'.repeat(20000)}}
for(let i=0;i<17;i++)large=await api.appendDataWorkspaceTurn(config,{key:large.key,turnId:'large-'+i,turn:largeTurn})
await assert.rejects(api.appendDataWorkspaceTurn(config,{key:large.key,turnId:'large-overflow',turn:largeTurn}),/4MiB|4MB|容量/)
assert.deepEqual(await api.readDataWorkspace(config),large,'capacity failure preserves all previously confirmed data')
const capacityHome=mkdtempSync(join(tmpdir(),'wb-data-workspace-capacity-'));process.env.DSH_HOME=capacityHome
for(let i=0;i<30;i++){
 const target={...config,database:'target-'+i},empty=await api.readDataWorkspace(target)
 await api.saveDataWorkspace(target,{key:empty.key,revision:empty.revision,patch:{query:'SELECT '+i}})
}
const full={...config,database:'target-30'},emptyFull=await api.readDataWorkspace(full)
await assert.rejects(api.saveDataWorkspace(full,{key:emptyFull.key,revision:0,patch:{query:'SELECT 30'}}),/30|容量|清除/)
const first={...config,database:'target-0'},firstSaved=await api.readDataWorkspace(first)
assert.equal(firstSaved.workspace.query,'SELECT 0','full store never silently evicts another connection')
await api.clearDataWorkspace(first,{key:firstSaved.key,revision:firstSaved.revision})
const admitted=await api.saveDataWorkspace(full,{key:emptyFull.key,revision:0,patch:{query:'SELECT 30'}})
assert.equal(admitted.workspace.query,'SELECT 30','clearing a target frees capacity')
process.env.DSH_HOME=home
assert.deepEqual(await api.readDataWorkspace(config),large,'profiles remain isolated')
console.log('✓ UTF-8 result/workspace limits reject atomically; 30 targets never silently evict')
const {writeFileSync,mkdirSync,chmodSync}=await import('node:fs')
const corruptHome=mkdtempSync(join(tmpdir(),'wb-data-workspace-corrupt-'));process.env.DSH_HOME=corruptHome
const corruptPath=join(corruptHome,'storages/dev-workbench/data-workspaces.json');mkdirSync(join(corruptPath,'..'),{recursive:true})
for(const corrupt of ['{not-json','{}','{"version":999,"targets":{},"cleared":{},"last":null}']){
 writeFileSync(corruptPath,corrupt)
 await assert.rejects(api.readDataWorkspace(config),/工作区.*损坏|工作区.*读取失败/)
 await assert.rejects(api.saveDataWorkspace(config,{key:api.dataWorkspaceKey(config),revision:0,patch:{query:'SELECT must_not_overwrite'}}),/工作区.*损坏|工作区.*读取失败/)
 assert.equal(readFileSync(corruptPath,'utf8'),corrupt,'damaged original remains available for recovery')
}
process.env.DSH_HOME=home
if(process.getuid?.()!==0){
 const dir=join(privateFile,'..');chmodSync(dir,0o500)
 try{await assert.rejects(api.saveDataWorkspace(config,{key:large.key,revision:large.revision,patch:{instruction:'must-not-publish'}}),/保存失败|EACCES/)}
 finally{chmodSync(dir,0o700)}
 assert.deepEqual(await api.readDataWorkspace(config),large,'failed disk write never publishes an unconfirmed revision')
}
const reloaded=await import(url+'#next-host-generation')
await assert.rejects(api.saveDataWorkspace(config,{key:large.key,revision:large.revision,patch:{query:'old-host'}}),/重载|重新加载/)
assert.deepEqual(await reloaded.readDataWorkspace(config),large)
console.log('✓ corruption/write failures preserve confirmed data; HMR fences replaced store modules')
console.log('data-workspace: 7 scenarios passed')
