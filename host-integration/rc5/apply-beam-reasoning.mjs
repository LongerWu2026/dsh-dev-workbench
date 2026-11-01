/** Apply the reviewed serializer bridge to the previously approved, stopped daily app. */
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {join,resolve} from 'node:path'
import {patchBeamReasoning} from './beam-reasoning-compat.mjs'
const root=resolve(import.meta.dirname,'../..'),recordPath=join(root,'.local-host/rc5-daily-entry/installed-build.json'),record=JSON.parse(readFileSync(recordPath,'utf8'))
const bundle='/Applications/DeepSeek Harness.app',file=join(bundle,'Contents/Resources/workbench-app/dsh/node_modules/@earendil-works/pi-ai/dist/api/openai-completions.js')
assert.equal(record.bundle,bundle);assert.equal(record.installed,true);assert.equal(record.nativeEntry,true)
const original=readFileSync(file,'utf8'),patched=patchBeamReasoning(original),digest=value=>createHash('sha256').update(value).digest('hex')
if(!process.argv.includes('--apply')){console.log(JSON.stringify({file,before:digest(original),after:digest(patched),changed:original!==patched}));process.exit(0)}
if(original===patched){console.log(JSON.stringify({file,alreadyApplied:true,sha256:digest(patched)}));process.exit(0)}
assert.equal(execFileSync('ps',['-axo','command='],{encoding:'utf8'}).split('\n').some(s=>s.includes(bundle+'/Contents/MacOS/')||s.includes(bundle+'/Contents/Resources/workbench-app/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/index.js')),false,'Normally quit the app first')
const backup=join(root,'.local-host/rc5-daily-entry/beam-adapter-backup-'+Date.now());mkdirSync(backup);copyFileSync(file,join(backup,'openai-completions.js'))
const identity=digest(readFileSync(join(bundle,'Contents/Info.plist')))
try{
 writeFileSync(file,patched)
 execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-',bundle],{stdio:'pipe'});execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',bundle],{stdio:'pipe'})
 assert.equal(digest(readFileSync(join(bundle,'Contents/Info.plist'))),identity)
 record.beamReasoningCompat={revision:1,before:digest(original),after:digest(patched),backup,at:new Date().toISOString()}
 record.codeResourcesSha256=digest(readFileSync(join(bundle,'Contents/_CodeSignature/CodeResources')))
 writeFileSync(recordPath,JSON.stringify(record,null,2)+'\n',{mode:0o600})
 console.log(JSON.stringify({signed:true,...record.beamReasoningCompat}))
}catch(error){writeFileSync(file,original);execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-',bundle],{stdio:'pipe'});throw error}
