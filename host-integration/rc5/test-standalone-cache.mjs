/** Actual standalone app + actual workbench UI, synthetic site login only, three clean process launches. */
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawn,execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const here=dirname(fileURLToPath(import.meta.url)),project=resolve(here,'../..')
assert.ok(process.argv[2],'Usage: node host-integration/rc5/test-standalone-cache.mjs <standalone output>')
const build=JSON.parse(readFileSync(join(resolve(process.argv[2]),process.argv.includes('--installed')?'installed-build.json':'result.json'),'utf8'))
assert.equal(build.portable,true);assert.equal(build.originalAppModified,false)
const directory=mkdtempSync(join(here,'artifacts/standalone-cache-')),home=join(directory,'home'),browserData=join(directory,'browser-data')
const profile=join(home,'profiles/desktop');mkdirSync(profile,{recursive:true})
writeFileSync(join(profile,'package.json'),JSON.stringify({private:true,dependencies:{},dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app','dsh-dev-workbench']}}},null,2)+'\n')

async function scenario({window,session,phase,profile,state,save}){
 const assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{realpathSync}=require('node:fs')
 const evaluate=code=>window.webContents.executeJavaScript(code)
 const waitFor=predicate=>evaluate(`new Promise((resolve,reject)=>{const until=Date.now()+20000;const check=()=>{try{if((${predicate})()){resolve(true);return}}catch{}if(Date.now()>until)reject(new Error('UI condition timed out'));else setTimeout(check,100)};check()})`)
 const check=(label,value)=>{assert.ok(value,label);state.checks.push(label);save()}
 await evaluate('globalThis.__DSH_BOOT_READY__.promise')
 await waitFor('()=>document.querySelector("[data-shell-overlay]")')
 check('standalone client fully mounted',true)
 await waitFor('()=>document.querySelector(\'button[aria-label="智能工作台"]\')')
 await evaluate('document.querySelector(\'button[aria-label="智能工作台"]\').click()')
 await waitFor('()=>document.querySelector(".wb-root")')
 check('bundled workbench plugin mounted in the actual host',true)
 await evaluate('[...document.querySelectorAll(".wb-topnav button")].find(el=>el.textContent.includes("多 AI 对话")).click()')
 await waitFor('()=>document.querySelector(".wb-web-tabs")')
 const identity=JSON.stringify([realpathSync(profile),'dsh-dev-workbench.web-ai','kimi','v1'])
 const partition='persist:dsh-browser-v1-'+createHash('sha256').update(identity).digest('hex'),site=session.fromPartition(partition)
 const fixture=`<!doctype html><meta charset="utf-8"><title>Account-free synthetic login fixture</title><script>document.addEventListener('DOMContentLoaded',()=>{document.body.innerHTML=localStorage.getItem('cache-fixture')?'<button aria-label="个人中心" aria-haspopup="menu">合成账户菜单</button><textarea></textarea>':'<form><h2>登录</h2><input type="tel"><button>登录</button></form>'})</script>`
 await site.protocol.handle('https',request=>new Response(new URL(request.url).origin==='https://www.kimi.com'?fixture:'Blocked fixture origin',{headers:{'content-type':'text/html'}}))
 await evaluate('document.querySelector(".wb-chat-provider-picker summary") ? (document.querySelector(".wb-chat-provider-picker summary").click(), document.querySelector(".wb-chat-provider-menu button").click()) : [...document.querySelectorAll(".wb-web-tabs button")].find(el=>el.textContent==="登录 / 查看原对话").click()')
 await waitFor('()=>document.querySelector("webview")?.getURL?.()==="https://www.kimi.com/"')
 const guest=code=>evaluate(`document.querySelector('webview').executeJavaScript(${JSON.stringify(code)})`)
 check('actual NativeWebsite uses the MAIN approved persistent partition',await evaluate(`document.querySelector('webview').getAttribute('partition')===${JSON.stringify(partition)}`))
 const read=`(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cache-fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('markers');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const marker=await new Promise((resolve,reject)=>{const r=db.transaction('markers').objectStore('markers').get('fixture');r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error)});db.close();return {local:localStorage.getItem('cache-fixture'),indexed:marker,cookie:document.cookie,node:typeof require==='function'||typeof process==='object'}})()`
 if(phase==='write'){
  await waitFor('()=>document.querySelector(".wb-web-auth")?.textContent.includes("需要登录")')
  check('fresh profile is reported as requiring login',true)
  await guest(`(async()=>{localStorage.setItem('cache-fixture','synthetic-login');document.cookie='cache-fixture=synthetic; Secure; Max-Age=86400; SameSite=Lax; Path=/';const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cache-fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('markers');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const t=db.transaction('markers','readwrite');t.objectStore('markers').put('synthetic-login','fixture');t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close();document.body.innerHTML='<button aria-label="个人中心" aria-haspopup="menu">合成账户菜单</button><textarea></textarea>'})()`)
  await site.cookies.set({url:'https://www.kimi.com',name:'cache-fixture-http-only',value:'synthetic',secure:true,httpOnly:true,expirationDate:Date.now()/1000+86400})
  await evaluate('document.querySelector(".wb-web-auth button").click()')
  await waitFor('()=>document.querySelector(".wb-web-auth")?.textContent.includes("已识别登录")')
  check('actual workbench auth probe recognizes the synthetic account menu',true)
 }else if(phase==='read'){
  await waitFor('()=>document.querySelector(".wb-web-auth")?.textContent.includes("已识别登录")')
  const value=await guest(read),cookies=await site.cookies.get({url:'https://www.kimi.com',name:'cache-fixture-http-only'})
  check('localStorage survives a complete standalone application restart',value.local==='synthetic-login')
  check('IndexedDB survives a complete standalone application restart',value.indexed==='synthetic-login')
  check('persistent Cookie survives a complete standalone application restart',value.cookie.includes('cache-fixture=synthetic'))
  check('HttpOnly Cookie survives without renderer export',cookies.length===1&&cookies[0].value==='synthetic'&&!value.cookie.includes('cache-fixture-http-only'))
  check('guest retains Node isolation',value.node===false)
  check('login state is rechecked by the real UI after restart',true)
  await site.clearStorageData({storages:['cookies','localstorage','indexdb']})
  state.checks.push('synthetic logout clears site storage before clean shutdown')
 }else{
  await waitFor('()=>document.querySelector(".wb-web-auth")?.textContent.includes("需要登录")')
  const value=await guest(read),cookies=await site.cookies.get({url:'https://www.kimi.com'})
  check('logout is retained across restart and no credential is resurrected',value.local===null&&value.indexed===null&&cookies.length===0)
  check('real UI reports requiring login after synthetic logout',true)
 }
 check('no visible Electron window is left open',require('electron').BrowserWindow.getAllWindows().every(value=>!value.isVisible()))
 state.partition=partition
}

const results=[]
for(const phase of ['write','read','loggedout']){
 const entry=join(directory,phase+'.cjs'),output=join(directory,phase+'.json')
 writeFileSync(entry,`
const fs=require('node:fs'),{app,BrowserWindow,dialog,powerMonitor,session}=require('electron');
const state={phase:${JSON.stringify(phase)},pid:process.pid,checks:[],personalProfilesUsed:false};const save=()=>fs.writeFileSync(${JSON.stringify(output)},JSON.stringify(state,null,2));
save();
BrowserWindow.prototype.show=function(){};BrowserWindow.prototype.showInactive=function(){};app.relaunch=()=>{state.relaunchBlocked=true;save()};
dialog.showMessageBox=async()=>{state.error='Unexpected native dialog';save();app.exit(1);return {response:0}};
dialog.showErrorBox=()=>{state.error='Unexpected error dialog';save();app.exit(1)};
let started=false;app.on('browser-window-created',(_event,window)=>window.webContents.on('did-finish-load',async()=>{if(started||window.webContents.getURL()!=='dsh-app://app/')return;started=true;try{await (${scenario.toString()})({window,session,phase:state.phase,profile:${JSON.stringify(profile)},state,save});save();powerMonitor.emit('shutdown');app.quit()}catch(error){state.error=String(error.stack);save();app.exit(1)}}));
app.whenReady().then(()=>app.dock?.hide());app.setAppPath(${JSON.stringify(build.entry)});require(${JSON.stringify(join(build.entry,'workbench-bootstrap.cjs'))});
setTimeout(()=>{state.error='Standalone cache test deadline';save();app.exit(1)},50000);
`)
 // A packaged Electron entry ignores NODE_OPTIONS preloads; use the same official runtime's
 // test loader to install hidden-window hooks, then load all application code from the final bundle.
 const binary=join(project,'.tmp/electron-runtime-44.7/Electron.app/Contents/MacOS/Electron')
 const outcome=await new Promise((resolve,reject)=>{
  const child=spawn(binary,[entry],{env:{PATH:process.env.PATH,HOME:home,TMPDIR:process.env.TMPDIR,SHELL:'/bin/sh',LANG:'en_US.UTF-8',DSH_HOME:home,WORKBENCH_BROWSER_DATA:browserData},stdio:['ignore','pipe','pipe']});let log='',timedOut=false
  child.stdout.on('data',value=>{log+=value});child.stderr.on('data',value=>{log+=value})
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL')},55000)
  child.on('error',error=>{clearTimeout(timer);reject(error)})
  child.on('exit',(exitCode,signal)=>{clearTimeout(timer);writeFileSync(join(directory,phase+'.log'),log);resolve({exitCode,signal,timedOut})})
 })
 // Match only this build's executable plus this run's fresh directory; never close the daily host.
 for(const line of execFileSync('ps',['-axo','pid=,command='],{encoding:'utf8'}).split('\n')){
  const match=line.trim().match(/^(\d+)\s+(.+)$/)
  if(match&&(match[2].startsWith(build.bundle+'/Contents/')||match[2].startsWith(join(project,'.tmp/electron-runtime-44.7/Electron.app/')))&&match[2].includes(directory+'/'))try{process.kill(Number(match[1]),'SIGTERM')}catch(error){if(error.code!=='ESRCH')throw error}
 }
 const record=JSON.parse(readFileSync(output,'utf8'));assert.equal(outcome.timedOut,false,JSON.stringify({directory,...record}));assert.equal(outcome.exitCode,0,JSON.stringify({directory,...record}))
 results.push(record);console.log(phase+': '+record.checks.length+' checks passed')
}
assert.equal(new Set(results.map(value=>value.pid)).size,3);assert.equal(new Set(results.map(value=>value.partition)).size,1)
const evidence={date:new Date().toISOString(),bundle:build.bundle,loader:'official Electron 44.7 test entry; all MAIN/preload/plugin code loaded from the final bundle',realAccountsUsed:false,personalProfilesUsed:false,checks:results.reduce((sum,value)=>sum+value.checks.length,0)+2,results}
writeFileSync(join(directory,'result.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({checks:evidence.checks,evidence:join(directory,'result.json')}))
