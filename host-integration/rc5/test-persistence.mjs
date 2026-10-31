/** Real, account-free Electron process restart regression. No personal profile or visible window is used. */
import {build} from 'esbuild'
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {resolve,join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawn} from 'node:child_process'
import assert from 'node:assert/strict'
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..')
const source=resolve(process.env.WORKBENCH_HARNESS_SOURCE||join(root,'.local-host/rc5-source'))
const electron=resolve(process.env.WORKBENCH_ELECTRON_BINARY||join(root,'.tmp/electron-runtime-44.7/Electron.app/Contents/MacOS/Electron'))
mkdirSync(join(here,'artifacts'),{recursive:true});const directory=mkdtempSync(join(here,'artifacts/process-'))
const alias={name:'harness-source',setup(b){b.onResolve({filter:/^@harness\//},args=>({path:join(source,'apps/desktop/src',args.path.slice('@harness/'.length)+'.ts')}))}}
for(const name of ['runtime','preload'])await build({entryPoints:[join(here,'tests',name+'.mjs')],outfile:join(directory,name+'.cjs'),bundle:true,format:'cjs',platform:'node',external:['electron'],plugins:[alias],logLevel:'silent'})
const userData=join(directory,'browser-data'),profile=join(directory,'profile');mkdirSync(userData);mkdirSync(profile)
assert.equal(JSON.parse(readFileSync(join(source,'apps/desktop/package.json'),'utf8')).version,'0.2.1-rc.5');const all=[]
for(const phase of ['write','read','loggedout','isolated']){
 const output=join(directory,phase+'.json'),options={phase,userData,profile:phase==='isolated'?join(directory,'other-profile'):profile,preload:join(directory,'preload.cjs'),output}
 const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,LANG:'en_US.UTF-8'}
 const result=await new Promise((resolve,reject)=>{
  const child=spawn(electron,[join(directory,'runtime.cjs'),JSON.stringify(options)],{env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',timedOut=false
  child.stdout.on('data',chunk=>{stdout+=chunk});child.stderr.on('data',chunk=>{stderr+=chunk})
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL')},45000)
  child.on('error',error=>{clearTimeout(timer);reject(error)})
  child.on('exit',(exitCode,signal)=>{clearTimeout(timer);resolve({exitCode,signal,timedOut,stdout,stderr})})
 })
 writeFileSync(join(directory,phase+'.log'),result.stdout+result.stderr)
 assert.equal(result.timedOut,false,phase+' timed out; inspect '+directory)
 assert.equal(result.exitCode,0,phase+' failed; inspect '+output+' and '+directory)
 const record=JSON.parse(readFileSync(output,'utf8'));all.push(record)
 console.log(phase+': '+record.checks.length+' checks passed; Electron pid '+record.pid)
}
assert.notEqual(all[0].pid,all[1].pid)
assert.equal(all[0].partitions.kimi,all[1].partitions.kimi)
assert.notEqual(all[1].partitions.kimi,all[3].partitions.kimi)
const evidence={date:new Date().toISOString(),electron:'44.7.0',source:'b830ec950faba0a46dda564be3e2d854afed94f1',realElectronProcesses:all.map(v=>v.pid),checks:all.reduce((sum,v)=>sum+v.checks.length,0)+3,accounts:[],visibleWindows:0,personalProfilesUsed:false,results:all,directory}
writeFileSync(join(directory,'result.json'),JSON.stringify(evidence,null,2)+'\n')
console.log('host-persistence: '+evidence.checks+' checks passed; evidence '+join(directory,'result.json'))
