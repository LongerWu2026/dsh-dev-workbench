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
for(const name of ['login-runtime','preload'])await build({entryPoints:[join(here,'tests',name+'.mjs')],outfile:join(directory,name+'.cjs'),bundle:true,format:'cjs',platform:'node',external:['electron'],plugins:[alias],logLevel:'silent'})
const userData=join(directory,'browser-data'),profile=join(directory,'profile');mkdirSync(userData);mkdirSync(profile)
const output=join(directory,'login.json'),options={phase:'login-navigation',userData,profile,preload:join(directory,'preload.cjs'),output}
const child=spawn(electron,[join(directory,'login-runtime.cjs'),JSON.stringify(options)],{env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,LANG:'en_US.UTF-8'},stdio:['ignore','pipe','pipe']})
let logs='';child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data)
const timer=setTimeout(()=>child.kill('SIGKILL'),30000)
const code=await new Promise((done,reject)=>{child.on('error',reject);child.on('exit',done)});clearTimeout(timer)
writeFileSync(join(directory,'login.log'),logs);assert.equal(code,0,'Login navigation fixture failed: '+directory)
const record=JSON.parse(readFileSync(output,'utf8'));assert.ok(!record.error,record.error);console.log(JSON.stringify({checks:record.checks.length,accounts:[],network:'all HTTPS intercepted with synthetic fixtures',output}))
