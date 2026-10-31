/** Stage the verified persistence build under the user's existing daily application identity. No install writes. */
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs'
import {resolve,join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const project=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const source=JSON.parse(readFileSync(join(project,'.local-host/rc5-native-login/result.json'),'utf8'))
const output=resolve(process.argv[2]||join(project,'.local-host/rc5-daily-entry'))
assert.ok(source.nativeEntry&&source.portable&&!source.originalAppModified)
assert.ok(!existsSync(output),'Refusing existing staging output')
execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',source.bundle],{stdio:'pipe'})
mkdirSync(output,{recursive:true,mode:0o700})
const bundle=join(output,'DeepSeek Harness.app');execFileSync('/bin/cp',['-cR',source.bundle,bundle])
const plist=join(bundle,'Contents/Info.plist')
for(const [key,value] of Object.entries({CFBundleIdentifier:'com.deepseek.dsh',CFBundleName:'DeepSeek Harness',CFBundleDisplayName:'DeepSeek Harness',CFBundleIconFile:'icon.icns'}))execFileSync('/usr/bin/plutil',['-replace',key,'-string',value,plist])
const originalInfo=JSON.parse(execFileSync('/usr/bin/plutil',['-convert','json','-o','-','/Applications/DeepSeek Harness.app/Contents/Info.plist'],{encoding:'utf8'}))
if(originalInfo.CFBundleURLTypes)execFileSync('/usr/bin/plutil',['-replace','CFBundleURLTypes','-json',JSON.stringify(originalInfo.CFBundleURLTypes),plist])
copyFileSync('/Applications/DeepSeek Harness.app/Contents/Resources/icon.icns',join(bundle,'Contents/Resources/icon.icns'))
execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-',bundle],{stdio:'pipe'})
execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',bundle],{stdio:'pipe'})
const result={...source,bundle,entry:join(bundle,'Contents/Resources/workbench-app'),dailyEntry:true,dailyURLTypes:originalInfo.CFBundleURLTypes??[],preparedAt:new Date().toISOString(),target:'/Applications/DeepSeek Harness.app',signature:'local ad-hoc; stock app will be preserved as a backup',codeResourcesSha256:createHash('sha256').update(readFileSync(join(bundle,'Contents/_CodeSignature/CodeResources'))).digest('hex')}
writeFileSync(join(output,'result.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600})
console.log(JSON.stringify({bundle,target:result.target,signature:result.signature,installed:false}))
