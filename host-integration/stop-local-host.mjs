/** Explicitly authorized cleanup of this project's test shell; never targets other applications. */
import {readFileSync,readlinkSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {join} from 'node:path'
const record=JSON.parse(readFileSync('.local-host/build.json','utf8'))
let link
try{link=readlinkSync(join(record.userData,'SingletonLock'))}catch(error){if(error.code==='ENOENT'){console.log('Local test host is not running');process.exit(0)}throw error}
const pid=Number(link.match(/-(\d+)$/)?.[1]);if(!Number.isSafeInteger(pid)||pid<2)throw new Error('Invalid test host PID')
let actual
try{actual=execFileSync('/bin/ps',['-p',String(pid),'-o','comm='],{encoding:'utf8'}).trim()}catch{console.log('Local test host already exited');process.exit(0)}
if(!['Electron','Workbench'].map(name=>join(record.bundle,'Contents/MacOS',name)).includes(actual))throw new Error('Refusing to stop another executable')
process.kill(pid,'SIGTERM')
let exited=false;const until=Date.now()+5000
while(Date.now()<until){try{process.kill(pid,0)}catch(error){if(error.code==='ESRCH'){exited=true;break}throw error}await new Promise(resolve=>setTimeout(resolve,100))}
if(!exited)throw new Error('Test host did not exit')
console.log('Verified local test-host PID exited: '+pid)
