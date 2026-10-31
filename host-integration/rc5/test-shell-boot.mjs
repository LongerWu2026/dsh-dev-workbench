/** Full compiled rc.5 MAIN/preload boot in an isolated review profile; no real accounts or visible windows. */
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawn,execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..')
assert.ok(process.argv[2],'Usage: node host-integration/rc5/test-shell-boot.mjs <review-host directory>')
const review=JSON.parse(readFileSync(join(resolve(process.argv[2]),'result.json'),'utf8'))
assert.equal(review.version,'0.2.1-rc.5');assert.equal(review.originalAppModified,false)
const directory=mkdtempSync(join(here,'artifacts/shell-')),entry=join(directory,'boot.cjs'),result=join(directory,'result.json')
const source=review.portable?review.entry:join(review.source,'apps/desktop'),home=join(directory,'home');mkdirSync(home)
if(review.portable){
 const profile=join(home,'profiles/desktop');mkdirSync(profile,{recursive:true})
 writeFileSync(join(profile,'package.json'),JSON.stringify({private:true,dependencies:{},dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app','dsh-dev-workbench']}}},null,2)+'\n')
}
writeFileSync(entry,`
const fs=require('node:fs'),electron=require('electron');
const {app,BrowserWindow,dialog,powerMonitor}=electron;
const state={events:[],windows:[],dialogs:[],personalProfilesUsed:false};
const save=()=>fs.writeFileSync(${JSON.stringify(result)},JSON.stringify(state,null,2));
app.setAppPath(${JSON.stringify(source)});app.setPath('userData',${JSON.stringify(join(directory,'browser-data'))});
BrowserWindow.prototype.show=function(){state.events.push('show suppressed');save()};
BrowserWindow.prototype.showInactive=BrowserWindow.prototype.show;
// Startup recovery may relaunch the shell. A smoke test must never leave an unowned GUI process.
app.relaunch=()=>{state.relaunchPrevented=true;save()};
dialog.showMessageBox=async()=>{state.dialogs.push('unexpected native dialog');save();app.exit(1);return{response:2,checkboxChecked:false}};
app.on('browser-window-created',(_event,window)=>{state.windows.push(window.id);save();window.webContents.on('did-finish-load',async()=>{
 if(window.webContents.getURL()!=='dsh-app://app/')return;
 try{
  state.bridge=await window.webContents.executeJavaScript('window.dshDesktop?.browser?.persistence?.protocolVersion');
  state.backendBoot=await window.webContents.executeJavaScript('globalThis.__DSH_BOOT_READY__.promise.then(()=>true)');
  state.clientMounted=await window.webContents.executeJavaScript('new Promise((resolve,reject)=>{const until=Date.now()+15000;const check=()=>{if(document.querySelector("[data-shell-overlay]"))resolve(true);else if(Date.now()>until)reject(new Error("client did not mount"));else setTimeout(check,100)};check()})');
  state.reservation=await window.webContents.executeJavaScript('(async()=>{const b=window.dshDesktop.browser,r=await b.persistence.acquire({namespace:"dsh-dev-workbench.web-ai",providerId:"kimi"});await b.release(r.lease);return {persistent:r.persistence,provider:r.providerId,partitionApproved:r.partition.startsWith("persist:")}})()');
  state.visibleWindows=BrowserWindow.getAllWindows().filter(w=>w.isVisible()).length;
  state.events.push('boot and persistent lease verified');save();
  powerMonitor.emit('shutdown');app.quit();
 }catch(error){state.error=String(error);save();app.exit(1)}
})});
app.whenReady().then(()=>app.dock?.hide());
import(${JSON.stringify(join(source,review.portable?'workbench-bootstrap.cjs':'lib/main.js'))}).catch(error=>{state.error=String(error.stack);save();app.exit(1)});
setTimeout(()=>{state.error='full-shell deadline';save();app.exit(1)},30000);
`)
const environment={PATH:process.env.PATH,HOME:home,TMPDIR:process.env.TMPDIR,SHELL:'/bin/sh',LANG:'en_US.UTF-8',DSH_HOME:home,WORKBENCH_BROWSER_DATA:join(directory,'browser-data'),DSH_DESKTOP_DSH_DIR:review.projectDir,DSH_DESKTOP_PRIMARY_RUNTIME_DIR:join(review.bundle,'Contents/Resources/workbench-primary-runtime'),DSH_DESKTOP_PNPM_ENTRY:join(source,'node_modules/pnpm/bin/pnpm.mjs'),DSH_DESKTOP_OPEN_DEVTOOLS:'0',DSH_DESKTOP_DIAGNOSTIC_FILE:join(directory,'diagnostic.log')}
const outcome=await new Promise((resolve,reject)=>{
 const child=spawn(join(root,'.tmp/electron-runtime-44.7/Electron.app/Contents/MacOS/Electron'),[entry],{env:environment,stdio:['ignore','pipe','pipe']});let log='',timedOut=false
 child.stdout.on('data',chunk=>{log+=chunk});child.stderr.on('data',chunk=>{log+=chunk})
 const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL')},40000)
 child.on('error',error=>{clearTimeout(timer);reject(error)})
 child.on('exit',(exitCode,signal)=>{clearTimeout(timer);writeFileSync(join(directory,'boot.log'),log);resolve({exitCode,signal,timedOut})})
})
// Close any children left by a fatal boot, matching this test's fresh directory and exact runtime only.
const runtimePrefix=join(root,'.tmp/electron-runtime-44.7/Electron.app/')
for(const line of execFileSync('ps',['-axo','pid=,command='],{encoding:'utf8'}).split('\n')){
 const match=line.trim().match(/^(\d+)\s+(.+)$/)
 if(match&&match[2].startsWith(runtimePrefix)&&match[2].includes(directory+'/')){
  try{process.kill(Number(match[1]),'SIGTERM')}catch(error){if(error.code!=='ESRCH')throw error}
 }
}
const record=JSON.parse(readFileSync(result,'utf8'));console.log(JSON.stringify({directory,...outcome,...record},null,2))
assert.equal(outcome.timedOut,false);assert.equal(outcome.exitCode,0);assert.equal(record.bridge,1);assert.equal(record.backendBoot,true)
assert.deepEqual(record.reservation,{persistent:'persistent',provider:'kimi',partitionApproved:true});assert.equal(record.visibleWindows,0);assert.deepEqual(record.dialogs,[])
assert.equal(record.clientMounted,true)
