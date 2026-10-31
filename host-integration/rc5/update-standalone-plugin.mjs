/** Refresh an owned, stopped app's plugin snapshot; --installed targets the previously approved daily entry. No personal data writes. */
import {readFileSync,writeFileSync,copyFileSync,readdirSync,mkdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {dirname,join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const project=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),installed=process.argv.includes('--installed'),output=resolve(process.argv[2]||join(project,'.local-host/rc5-native-login'))
const resultPath=join(output,installed?'installed-build.json':'result.json'),record=JSON.parse(readFileSync(resultPath,'utf8'))
assert.equal(record.nativeEntry,true);assert.equal(record.originalAppModified,false);assert.equal(record.bundle,installed?'/Applications/DeepSeek Harness.app':join(output,'智能工作台 Harness RC5.app'))
assert.equal(record.entry,join(record.bundle,'Contents/Resources/workbench-app'))
if(installed)assert.equal(record.installed,true)
const running=execFileSync('ps',['-axo','command='],{encoding:'utf8'}).split('\n').some(command=>command.startsWith(record.bundle+'/Contents/MacOS/WorkbenchRC5'))
assert.equal(running,false,'Normally quit this standalone app before updating its signed resources')
const plugin=join(record.entry,'dsh/node_modules/dsh-dev-workbench'),digest=path=>createHash('sha256').update(readFileSync(path)).digest('hex')
assert.equal(digest(join(plugin,'index.js')),record.plugin.host,'Refusing an unexpected plugin snapshot')
assert.equal(digest(join(plugin,'client.js')),record.plugin.client,'Refusing an unexpected plugin snapshot')
execFileSync(process.execPath,[join(project,'scripts/build.mjs'),'--check'],{stdio:'inherit'})
const names=['package.json','index.js','client.js','cordis.patch.yml','icon.svg','README.md',...readdirSync(join(project,'locale')).map(name=>'locale/'+name)]
const backup=join(output,'plugin-snapshot-backup-'+Date.now());mkdirSync(join(backup,'locale'),{recursive:true})
for(const name of names)copyFileSync(join(plugin,name),join(backup,name))
const plist=join(record.bundle,'Contents/Info.plist'),plistBefore=digest(plist)
try{
 for(const name of names)copyFileSync(join(project,name),join(plugin,name))
 execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-',record.bundle],{stdio:'pipe'})
 execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',record.bundle],{stdio:'pipe'})
 assert.equal(digest(plist),plistBefore,'App identity and URL handlers must remain unchanged')
}catch(error){
 for(const name of names)copyFileSync(join(backup,name),join(plugin,name))
 execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-',record.bundle],{stdio:'pipe'})
 throw error
}
record.plugin={version:JSON.parse(readFileSync(join(plugin,'package.json'),'utf8')).version,host:digest(join(plugin,'index.js')),client:digest(join(plugin,'client.js'))}
record.updatedAt=new Date().toISOString()
record.codeResourcesSha256=digest(join(record.bundle,'Contents/_CodeSignature/CodeResources'))
record.pluginSnapshotBackup=backup
writeFileSync(resultPath,JSON.stringify(record,null,2)+'\n',{mode:0o600})
console.log(JSON.stringify({bundle:record.bundle,plugin:record.plugin,signed:true}))
