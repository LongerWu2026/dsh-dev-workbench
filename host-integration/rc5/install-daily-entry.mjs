/** Plan by default. --apply is for the exact user-approved /Applications replacement after a normal quit. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
import {replaceDailyEntry} from './daily-entry-transaction.mjs'
const project=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const output=resolve(process.argv.find(value=>value.startsWith('--staged='))?.slice('--staged='.length)||join(project,'.local-host/rc5-daily-entry'))
const record=JSON.parse(readFileSync(join(output,'result.json'),'utf8')),target='/Applications/DeepSeek Harness.app'
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex')
assert.ok(record.nativeEntry&&record.dailyEntry&&record.portable&&!record.originalAppModified)
assert.equal(record.target,target);assert.equal(record.bundle,join(output,'DeepSeek Harness.app'))
assert.equal(hash(join(record.bundle,'Contents/_CodeSignature/CodeResources')),record.codeResourcesSha256,'Staged signature changed')
const verify=path=>{
 execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',path],{stdio:'pipe'})
 const id=execFileSync('/usr/libexec/PlistBuddy',['-c','Print CFBundleIdentifier',join(path,'Contents/Info.plist')],{encoding:'utf8'}).trim()
 assert.equal(id,'com.deepseek.dsh')
 const info=JSON.parse(execFileSync('/usr/bin/plutil',['-convert','json','-o','-',join(path,'Contents/Info.plist')],{encoding:'utf8'}))
 assert.deepEqual(info.CFBundleURLTypes??[],record.dailyURLTypes??[],'Original login callback registration changed')
 for(const file of record.replacements)assert.equal(hash(join(path,'Contents/Resources/workbench-app',file.path)),file.sha256,'Reviewed build changed')
 assert.equal(hash(join(path,'Contents/Resources/workbench-app/dsh/node_modules/dsh-dev-workbench/client.js')),record.plugin.client)
}
verify(record.bundle)
assert.equal(hash(join(target,'Contents/Resources/app.asar')),record.stockAsarSha256,'Installed app changed; do not replace it')
const backup=join(project,'.local-host/original-app-backup-20261030','DeepSeek Harness.app.backup')
assert.ok(!existsSync(backup),'An earlier original app backup exists; review it before another install')
const commands=execFileSync('ps',['-axo','pid=,command='],{encoding:'utf8'}).split('\n')
const active=commands.filter(line=>{
 const command=line.trim().replace(/^\d+\s+/,'')
 return command.startsWith(target+'/Contents/MacOS/')||command.startsWith(join(project,'.local-host/rc5-native-login/智能工作台 Harness RC5.app/Contents/MacOS/'))
}).map(line=>Number(line.trim().match(/^\d+/)[0]))
const plan={target,staged:record.bundle,backup,activeProcesses:active,browserData:record.browserData,businessHome:record.businessHome,signature:record.signature,credentialMigration:false,originalBackupDeleted:false,applied:false}
if(!process.argv.includes('--apply')){console.log(JSON.stringify(plan,null,2));process.exit(0)}
assert.equal(active.length,0,'Normally quit existing hosts before replacing the daily entry')
const result=replaceDailyEntry({target,staged:record.bundle,backup,verifyInstalled:verify})
const deployment={...plan,...result,applied:true,appliedAt:new Date().toISOString(),launchServicesRegistered:false}
writeFileSync(join(output,'deployment.json'),JSON.stringify(deployment,null,2)+'\n',{mode:0o600})
execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',['-f',target],{stdio:'pipe'})
deployment.launchServicesRegistered=true
writeFileSync(join(output,'deployment.json'),JSON.stringify(deployment,null,2)+'\n',{mode:0o600})
writeFileSync(join(output,'installed-build.json'),JSON.stringify({...record,bundle:target,entry:join(target,'Contents/Resources/workbench-app'),installed:true},null,2)+'\n',{mode:0o600})
console.log(JSON.stringify(deployment,null,2))
