/** Full built-shell smoke in an isolated home; every test window remains hidden. */
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawn} from 'node:child_process'
import assert from 'node:assert/strict'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),source=join(root,'.local-host/source/apps/desktop')
const directory=mkdtempSync(join(root,'.tmp/full-shell-')),entry=join(directory,'boot.cjs'),result=join(directory,'result.json')
const installed='/Applications/DeepSeek Harness.app/Contents/Resources'
writeFileSync(entry,`
const fs=require('node:fs'),electron=require('electron');
const {app,BrowserWindow,dialog}=electron;
const state={events:[],windows:[],dialogs:[]};
const save=()=>fs.writeFileSync(${JSON.stringify(result)},JSON.stringify(state,null,2));
app.setAppPath(${JSON.stringify(source)});app.setPath('userData',${JSON.stringify(join(directory,'userData'))});
BrowserWindow.prototype.show=function(){state.events.push('show suppressed');save()};
dialog.showMessageBox=async(options)=>{state.dialogs.push({message:options?.message,title:options?.title});save();app.exit(1);return{response:2,checkboxChecked:false}};
app.on('browser-window-created',(_event,window)=>{state.windows.push({id:window.id});save();window.webContents.on('did-finish-load',async()=>{
 const url=window.webContents.getURL();state.events.push('loaded '+url);save();
 if(url==='dsh-app://app/'){
   state.bridge=await window.webContents.executeJavaScript('window.dshDesktop?.browser?.persistence?.protocolVersion');
   state.events.push('bridge checked');save();
   try{state.backendBoot=await window.webContents.executeJavaScript('globalThis.__DSH_BOOT_READY__.promise.then(()=>true)');state.visibleWindows=BrowserWindow.getAllWindows().filter(w=>w.isVisible()).length;save();app.exit(state.bridge===1&&state.backendBoot&&state.dialogs.length===0?0:1)}catch(error){state.error=String(error);save();app.exit(1)}
 }
})});
app.whenReady().then(()=>app.dock?.hide());
state.events.push('importing built main');save();
import(${JSON.stringify(join(source,'lib/main.js'))}).then(()=>{state.events.push('main imported');save()}).catch(error=>{state.error=String(error.stack);save();app.exit(1)});
setTimeout(()=>{state.error='full-shell deadline';save();app.exit(1)},20000);
`)
const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,SHELL:'/bin/sh',LANG:'en_US.UTF-8',DSH_HOME:join(directory,'home'),DSH_DESKTOP_DSH_DIR:join(installed,'app.asar/dsh'),DSH_DESKTOP_PRIMARY_RUNTIME_DIR:join(installed,'runtime/primary-runtime'),DSH_DESKTOP_PNPM_ENTRY:join(installed,'runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs'),DSH_DESKTOP_OPEN_DEVTOOLS:'0',DSH_DESKTOP_DIAGNOSTIC_FILE:join(directory,'diagnostic.log')}
const electron=join(root,'.tmp/electron-runtime-44.7/Electron.app/Contents/MacOS/Electron')
const exit=await new Promise((resolve,reject)=>{const child=spawn(electron,[entry],{env,stdio:['ignore','pipe','pipe']});let log='',timedOut=false;child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL')},25000);child.on('error',reject);child.on('exit',(exitCode,signal)=>{clearTimeout(timer);writeFileSync(join(directory,'boot.log'),log);resolve({exitCode,signal,timedOut})})})
console.log(JSON.stringify({directory,...exit,result:JSON.parse(readFileSync(result,'utf8'))},null,2))
assert.equal(exit.timedOut,false);assert.equal(exit.exitCode,0)
