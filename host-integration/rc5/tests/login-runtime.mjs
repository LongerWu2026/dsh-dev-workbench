/** Hidden Electron fixture using the patched MAIN, real preload bridge, and real webview. */
import {app,BrowserWindow,ipcMain,protocol,session} from 'electron'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {DesktopBrowserGuests} from '@harness/browser-guests'
import {DesktopBrowserPersistence} from '@harness/browser-persistence'
import {workbenchBrowserPolicy} from '@harness/workbench-browser-policy'
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
 const navigationDiagnostics=[]
 const persistence=new DesktopBrowserPersistence(options.profile,[workbenchBrowserPolicy],entry=>navigationDiagnostics.push(entry))
 guests=new DesktopBrowserGuests(()=>undefined,persistence)
 const initialized=new Set()
 const approve=event=>{assertDesktopSender(event,['app']);if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('Unowned fixture sender')}
 ipcMain.handle(DESKTOP_IPC.browserAcquirePersistent,(event,request)=>{
  approve(event)
  const value=guests.acquirePersistent(event.sender,request)
  if(!initialized.has(value.partition)){
   const s=session.fromPartition(value.partition)
   s.protocol.handle('https',request=>new Response('<html><body><a id=continue href=https://auth.openai.com/oauth/authorize>继续</a><form method=post action=https://accounts.google.com/v3/signin/identifier><input type=hidden name=fixture value=synthetic-only><button id=google type=submit>Google</button></form></body></html>',{headers:{'content-type':'text/html'}}))
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
   await guest.loadURL(${JSON.stringify('https://chatgpt.com/auth/login_with')});return reservation;
  })()`)
  output.partitions[provider]=result.partition
  return result
 }

 const reservation=await create('chatgpt')
 const run=code=>window.webContents.executeJavaScript(`document.getElementById('chatgpt').executeJavaScript(${JSON.stringify(code)})`)
 const current=()=>window.webContents.executeJavaScript("document.getElementById('chatgpt').getURL()")
 const until=async predicate=>{const deadline=Date.now()+8000;while(Date.now()<deadline){if(await predicate())return;await new Promise(done=>setTimeout(done,50))}throw Error('fixture navigation timed out')}
 await until(async()=>(await current())==='https://chatgpt.com/auth/login_with')
 check('login intermediate page is loaded by the real isolated webview',true)
 await run("document.getElementById('continue').click()")
 await until(async()=>(await current())==='https://auth.openai.com/oauth/authorize')
 check('real continue link reaches OpenAI authentication instead of being cancelled',true)
 await run("document.getElementById('google').click()")
 await until(async()=>(await current())==='https://accounts.google.com/v3/signin/identifier')
 check('same-window OAuth form POST can reach Google authentication',true)
 const partition=await window.webContents.executeJavaScript("document.getElementById('chatgpt').getAttribute('partition')")
 check('authentication keeps the original provider partition and creates no popup',partition===reservation.partition&&BrowserWindow.getAllWindows().length===1)
 await run("document.querySelector('form').target='_blank';document.getElementById('google').click()")
 await until(async()=>navigationDiagnostics.some(entry=>entry.reason==='popup_post'))
 check('blocked popup POST reports only the target origin, never the body',navigationDiagnostics.some(entry=>entry.reason==='popup_post'&&entry.origin==='https://accounts.google.com')&&!JSON.stringify(navigationDiagnostics).includes('synthetic-only'))
 const denied=await window.webContents.executeJavaScript("document.getElementById('chatgpt').loadURL('https://auth.openai.com.evil.invalid/').then(()=>false,()=>true)")
 check('lookalike authentication domains remain blocked by MAIN',denied)
 check('blocked navigation diagnostic omits URLs, query data and paths',navigationDiagnostics.some(entry=>entry.reason==='policy'&&entry.origin==='https://auth.openai.com.evil.invalid')&&navigationDiagnostics.every(entry=>Object.keys(entry).sort().join(',')==='origin,providerId,reason'))
 check('guest Node and process access remain isolated',await run("typeof require==='undefined'&&typeof process==='undefined'"))
 check('fixture uses hidden windows and no real accounts',!window.isVisible())
 await guests.shutdown();window.destroy();writeFileSync(options.output,JSON.stringify(output,null,2));app.quit()
}catch(error){writeFileSync(options.output,JSON.stringify({...output,error:String(error.stack||error)},null,2));app.exit(1)}}
void main()
