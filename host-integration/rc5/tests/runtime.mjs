/** Hidden Electron fixture using the patched MAIN, real preload bridge, and real webview. */
import {app,BrowserWindow,ipcMain,protocol,session} from 'electron'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {DesktopBrowserGuests} from '@harness/browser-guests'
import {DesktopBrowserPersistence} from '@harness/browser-persistence'
import {DESKTOP_IPC,assertDesktopSender} from '@harness/ipc'

const options=JSON.parse(process.argv.at(-1))
app.setPath('userData',options.userData)
protocol.registerSchemesAsPrivileged([{scheme:'dsh-app',privileges:{standard:true,secure:true,supportFetchAPI:true}}])
let guests,window
const origin='https://storage.fixture.invalid'
const fixture='<!doctype html><title>Synthetic storage fixture</title><p>No account or network is used.</p>'
const output={pid:process.pid,phase:options.phase,checks:[],partitions:{},visibleWindows:0}
const check=(label,condition)=>{assert.ok(condition,label);output.checks.push(label)}
async function main(){try{
 writeFileSync(options.output+'.progress','entry\n')
 await app.whenReady();app.dock?.hide()
 writeFileSync(options.output+'.progress','ready\n')
 mkdirSync(options.profile,{recursive:true})
 const persistence=new DesktopBrowserPersistence(options.profile,[{namespace:'dsh-dev-workbench.web-ai',providers:[{id:'kimi',origins:[origin]},{id:'glm',origins:[origin]}]}])
 guests=new DesktopBrowserGuests(()=>undefined,persistence)
 const initialized=new Set()
 const approve=event=>{assertDesktopSender(event,['app']);if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('Unowned fixture sender')}
 ipcMain.handle(DESKTOP_IPC.browserAcquirePersistent,(event,request)=>{
  approve(event)
  const value=guests.acquirePersistent(event.sender,request)
  if(!initialized.has(value.partition)){
   const s=session.fromPartition(value.partition)
   s.protocol.handle('https',request=>new Response(new URL(request.url).origin===origin?fixture:'Blocked fixture request',{headers:{'content-type':'text/html'}}))
   initialized.add(value.partition)
  }
  return value
 })
 ipcMain.handle(DESKTOP_IPC.browserRelease,(event,id)=>{approve(event);return guests.release(event.sender,id)})
 protocol.handle('dsh-app',()=>new Response('<!doctype html><title>Hidden workbench carrier</title><div id="fixtures"></div>',{headers:{'content-type':'text/html'}}))
 window=new BrowserWindow({show:false,webPreferences:{preload:options.preload,webviewTag:true,nodeIntegration:false,contextIsolation:true,sandbox:true}})
 guests.bind(window,()=>()=>{})
 await window.loadURL('dsh-app://app/')
 writeFileSync(options.output+'.progress','carrier loaded\n')
 check('preload exposes persistence v1 through the narrow Browser bridge',await window.webContents.executeJavaScript('window.dshDesktop.browser.persistence.protocolVersion===1 && !window.require && !window.process'))
 const create=async provider=>{
  const result=await window.webContents.executeJavaScript(`(async()=>{
   const reservation=await window.dshDesktop.browser.persistence.acquire({namespace:'dsh-dev-workbench.web-ai',providerId:${JSON.stringify(provider)}});
   const guest=document.createElement('webview');guest.id=${JSON.stringify(provider)};guest.setAttribute('partition',reservation.partition);guest.setAttribute('src','about:blank#'+reservation.lease);guest.setAttribute('allowpopups','');
   const ready=new Promise((resolve,reject)=>{guest.addEventListener('dom-ready',()=>resolve(),{once:true});guest.addEventListener('did-fail-load',e=>reject(new Error('guest failed '+e.errorCode)),{once:true})});document.querySelector('#fixtures').append(guest);await ready;
   await guest.loadURL(${JSON.stringify(origin+'/')});return reservation;
  })()`)
  output.partitions[provider]=result.partition
  return result
 }
 const run=(provider,code)=>window.webContents.executeJavaScript(`document.getElementById(${JSON.stringify(provider)}).executeJavaScript(${JSON.stringify(code)})`)
 const read=`(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('workbench-fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('markers');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const marker=await new Promise((resolve,reject)=>{const t=db.transaction('markers');const r=t.objectStore('markers').get('only-synthetic');r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error)});db.close();return {local:localStorage.getItem('workbench-fixture'),cookie:document.cookie,indexed:marker,node:typeof process==='object'||typeof require==='function'};})()`
 const kimi=await create('kimi')
 if(options.phase==='write'){
  const before=await run('kimi',read);check('new profile starts without fixture storage',before.local===null&&before.indexed===null&&!before.cookie.includes('workbench-fixture'))
  await run('kimi',`(async()=>{localStorage.setItem('workbench-fixture','synthetic-20261029');document.cookie='workbench-fixture=synthetic-20261029; Max-Age=86400; Secure; SameSite=Lax; Path=/';const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('workbench-fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('markers');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const t=db.transaction('markers','readwrite');t.objectStore('markers').put('synthetic-20261029','only-synthetic');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)});db.close()})()`)
  await session.fromPartition(kimi.partition).cookies.set({url:origin,name:'workbench-http-only',value:'synthetic-http-only',httpOnly:true,secure:true,expirationDate:Date.now()/1000+86400})
  await session.fromPartition(kimi.partition).cookies.set({url:origin,name:'workbench-session-only',value:'synthetic-session',httpOnly:true,secure:true})
  const sessionOnly=await session.fromPartition(kimi.partition).cookies.get({url:origin,name:'workbench-session-only'})
  check('ordinary HttpOnly session cookie exists during this process without an expiration',sessionOnly.length===1&&sessionOnly[0].session===true)
 }else if(options.phase==='read'){
  const values=await run('kimi',read)
  const sessionOnly=await session.fromPartition(kimi.partition).cookies.get({url:origin,name:'workbench-session-only'})
  check('ordinary session cookie is not force-restored after a clean process restart',sessionOnly.length===0)
  check('localStorage survives a complete Electron process restart',values.local==='synthetic-20261029')
  check('persistent Cookie survives a complete Electron process restart',values.cookie.includes('workbench-fixture=synthetic-20261029'))
  check('IndexedDB survives a complete Electron process restart',values.indexed==='synthetic-20261029')
  const cookies=await session.fromPartition(kimi.partition).cookies.get({url:origin,name:'workbench-http-only'})
  check('HttpOnly fixture cookie survives without any renderer credential export',cookies.length===1&&cookies[0].value==='synthetic-http-only'&&!values.cookie.includes('workbench-http-only'))
 }else{
  const values=await run('kimi',read);const allCookies=await session.fromPartition(kimi.partition).cookies.get({url:origin});check(options.phase==='loggedout'?'logout does not resurrect HttpOnly cookies':'trusted profile isolates HttpOnly cookies',allCookies.length===0);check(options.phase==='loggedout'?'explicitly cleared storage is not restored after restart':'another trusted profile cannot read previous profile storage',values.local===null&&values.indexed===null&&!values.cookie.includes('workbench-fixture'))
 }
 const values=await run('kimi',read);check('guest retains sandbox and Node isolation',values.node===false)
 const glm=await create('glm'),other=await run('glm',read)
 check('different providers isolate the SAME fixture origin',other.local===null&&other.indexed===null&&!other.cookie.includes('workbench-fixture')&&glm.partition!==kimi.partition)
 const otherCookies=await session.fromPartition(glm.partition).cookies.get({url:origin})
 check('different providers isolate HttpOnly and session cookies',otherCookies.length===0)
 const denied=await window.webContents.executeJavaScript(`(async()=>{let denied=0;for(const request of [{namespace:'other',providerId:'kimi'},{namespace:'dsh-dev-workbench.web-ai',providerId:'unknown'},{namespace:'dsh-dev-workbench.web-ai',providerId:'kimi',path:'/tmp/forbidden'}]){try{await window.dshDesktop.browser.persistence.acquire(request)}catch{denied++}}return denied})()`)
 check('IPC rejects unknown namespaces/providers and client directory fields',denied===3)
 check('no visible external browser window is created',BrowserWindow.getAllWindows().every(value=>!value.isVisible()))
 // A direct loadURL bypasses renderer navigation callbacks; MAIN webRequest must still enforce the origin policy.
 await assert.rejects(()=>window.webContents.executeJavaScript(`document.getElementById('kimi').loadURL('https://outside.fixture.invalid/')`))
 output.checks.push('MAIN blocks out-of-policy top-level navigation including loadURL')
 await window.webContents.executeJavaScript(`Promise.all([window.dshDesktop.browser.release(${JSON.stringify(kimi.lease)}),window.dshDesktop.browser.release(${JSON.stringify(kimi.lease)})])`)
 await window.webContents.executeJavaScript(`document.getElementById('kimi').remove()`)
 check('duplicate release waits without clearing persistent storage',true)
 const again=await create('kimi')
 check('new lease uses the same account partition',again.partition===kimi.partition)
 if(options.phase==='write'||options.phase==='read'){const after=await run('kimi',read);check('releasing a guest preserves all committed storage',after.local==='synthetic-20261029'&&after.indexed==='synthetic-20261029')}
 if(options.phase==='read'){
  await session.fromPartition(kimi.partition).clearStorageData({storages:['cookies','localstorage','indexdb']})
  await persistence.flush(kimi.partition)
  output.checks.push('explicit logout-style storage deletion is flushed without credential recovery')
 }
 await guests.shutdown()
 assert.throws(()=>guests.acquirePersistent(window.webContents,{namespace:'dsh-dev-workbench.web-ai',providerId:'kimi'}),/unavailable/)
 output.checks.push('shutdown drains guests and rejects new leases')
 writeFileSync(options.output,JSON.stringify(output,null,2)+'\n')
 app.exit(0)
}catch(error){
 writeFileSync(options.output,JSON.stringify({...output,error:String(error?.stack||error)},null,2)+'\n')
 try{await guests?.shutdown()}catch{/* The recorded primary failure owns the test result. */}
 app.exit(1)
}}
void main()
