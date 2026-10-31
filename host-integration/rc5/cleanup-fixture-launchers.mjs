/** Default is plan only. Remove only launch registrations for this task's marker-only fake app directories. */
import {execFileSync,spawnSync} from 'node:child_process'
import {existsSync,readFileSync,writeFileSync,readdirSync,lstatSync,realpathSync,renameSync} from 'node:fs'
import {dirname,join,resolve,relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const here=dirname(fileURLToPath(import.meta.url)),base=join(here,'artifacts')
const ls='/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
const pattern=/^daily-entry-[a-zA-Z0-9]{6}\/(?:success|rollback|collision|symlink)\/(?:Applications|stage)\/DeepSeek Harness\.app$/
const planFile=join(base,'fixture-launcher-cleanup-plan.json'),resultFile=join(base,'fixture-launcher-cleanup-result.json')
const paths=()=>[...execFileSync(ls,['-dump'],{encoding:'utf8',maxBuffer:64*1024*1024}).matchAll(/^\s*path:\s+(.+?)\s+\(0x[0-9a-f]+\)\s*$/gm)].map(match=>match[1])
const assertFixture=path=>{
 assert.ok(pattern.test(relative(base,path)),'Refusing a non-fixture path')
 assert.equal(realpathSync(path),path,'Refusing symlinks')
 assert.ok(lstatSync(path).isDirectory())
 assert.deepEqual(readdirSync(path),['app-marker'],'Refusing an application or extra data')
 const marker=readFileSync(join(path,'app-marker'),'utf8')
 assert.ok(marker==='original'||marker==='persistent','Refusing an unknown fixture')
 return marker
}
if(!process.argv.includes('--apply')){
 const entries=[...new Set(paths())].filter(path=>pattern.test(relative(base,path))).map(path=>({path,renamedTo:path.replace(/\.app$/,'.fixture'),marker:assertFixture(path)}))
 const plan={preparedAt:new Date().toISOString(),scope:base,entries,count:entries.length,filesDeleted:false,cacheDirectoriesTouched:false,installedApplicationTouched:false}
 writeFileSync(planFile,JSON.stringify(plan,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(plan,null,2));process.exit(0)
}
const plan=JSON.parse(readFileSync(planFile,'utf8'))
assert.equal(plan.scope,base);assert.equal(plan.count,plan.entries.length)
for(const item of plan.entries){
 assert.equal(item.renamedTo,item.path.replace(/\.app$/,'.fixture'))
 assert.equal(assertFixture(item.path),item.marker)
 assert.ok(!existsSync(item.renamedTo),'Refusing an existing rename target')
}
// All entries are checked before the first system or filesystem change.
const results=[]
for(const item of plan.entries){
 const unregistered=spawnSync(ls,['-u',item.path],{encoding:'utf8'})
 assert.equal(unregistered.status,0,'Unregister failed for '+item.path)
 renameSync(item.path,item.renamedTo)
 results.push({path:item.path,renamedTo:item.renamedTo,unregistered:true,markerPreserved:readFileSync(join(item.renamedTo,'app-marker'),'utf8')===item.marker})
 writeFileSync(resultFile,JSON.stringify({results,filesDeleted:false,cacheDirectoriesTouched:false,installedApplicationTouched:false},null,2)+'\n',{mode:0o600})
}
const remaining=paths().filter(path=>plan.entries.some(item=>item.path===path))
assert.equal(remaining.length,0,'Fixture registration still exists')
console.log(JSON.stringify({cleaned:results.length,remainingFixtureRegistrations:remaining.length,resultFile,filesDeleted:false,cacheDirectoriesTouched:false}))
