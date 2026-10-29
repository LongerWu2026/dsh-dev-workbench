/** Prepare a native local Electron shell, leaving the original signed installation unchanged. */
import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync,readlinkSync,lstatSync,unlinkSync} from 'node:fs'
import {join,resolve,dirname} from 'node:path'
import {homedir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
if(process.platform!=='darwin'||process.arch!=='arm64')throw new Error('This local shell targets macOS arm64')
const source=join(root,'.local-host/source/apps/desktop'),runtime=join(root,'.tmp/electron-runtime-44.7/Electron.app'),installed='/Applications/DeepSeek Harness.app'
const stockResources=join(installed,'Contents/Resources')
const version=execFileSync('/usr/libexec/PlistBuddy',['-c','Print CFBundleShortVersionString',join(installed,'Contents/Info.plist')],{encoding:'utf8'}).trim()
if(version!=='0.2.1-rc.3'||JSON.parse(readFileSync(join(source,'package.json'),'utf8')).version!==version)throw new Error('Rebuild against the installed runtime version')
if(!readFileSync(join(source,'lib/main.js'),'utf8').includes('browser-acquire-persistent'))throw new Error('Build the persistent shell first')
const output=join(root,'.local-host'),bundle=join(output,'DeepSeek Harness Workbench.app')
mkdirSync(output,{recursive:true,mode:0o700})
if(existsSync(bundle)){
 const previous=JSON.parse(readFileSync(join(output,'build.json'),'utf8'))
 if(previous.bundle!==bundle||previous.revision!=='1f81c047fc48fa190a683e469daa699857e9afe8')throw new Error('Refusing an unowned local application')
}else execFileSync('/usr/bin/ditto',[runtime,bundle])
const plist=join(bundle,'Contents/Info.plist')
for(const [key,value] of Object.entries({CFBundleIdentifier:'com.deepseek.dsh.workbench.local',CFBundleName:'DeepSeek Harness Workbench',CFBundleDisplayName:'DeepSeek Harness Workbench',CFBundleExecutable:'Workbench',CFBundleShortVersionString:version}))execFileSync('/usr/bin/plutil',['-replace',key,'-json',JSON.stringify(value),plist])
// The process executable matches CFBundleExecutable; no shell/native wrapper replaces its identity.
copyFileSync(join(runtime,'Contents/MacOS/Electron'),join(bundle,'Contents/MacOS/Workbench'))
const resources=join(bundle,'Contents/Resources'),runtimeLink=join(resources,'runtime')
if(existsSync(runtimeLink)&&lstatSync(runtimeLink).isSymbolicLink()){
 if(readlinkSync(runtimeLink)!==join(stockResources,'runtime'))throw new Error('Unexpected runtime link')
 unlinkSync(runtimeLink)
}
if(!existsSync(runtimeLink))execFileSync('/bin/cp',['-cR',join(stockResources,'runtime'),runtimeLink])
for(const name of ['icon.png','app-update.yml'])if(existsSync(join(stockResources,name)))copyFileSync(join(stockResources,name),join(resources,name))
const entry=join(resources,'app');mkdirSync(entry,{recursive:true})
writeFileSync(join(entry,'package.json'),JSON.stringify({name:'@deepseek-ai/dsh-desktop',version,main:'bootstrap.cjs'},null,2)+'\n')
const home=process.env.DSH_HOME||join(homedir(),'.dsh'),userData=join(output,'user-data')
// Never reuse the stock browser cookie jar: each local backend restart issues an authority cookie.
mkdirSync(userData,{recursive:true,mode:0o700})
const appPath=join(stockResources,'app.asar')
const bootstrap=[
 'const {app}=require("electron");const fs=require("node:fs");',
 'const original='+JSON.stringify(appPath)+';',
 'if(JSON.parse(fs.readFileSync(original+"/package.json","utf8")).version!=="0.2.1-rc.3")throw new Error("Installed runtime changed; rebuild the local host");',
 'delete process.env.NODE_OPTIONS;delete process.env.DSH_DESKTOP_HOST_INSPECT_PORT;',
 'process.env.DSH_HOME='+JSON.stringify(home)+';',
 'process.env.DSH_DESKTOP_DIAGNOSTIC_FILE='+JSON.stringify(join(output,'startup-error.log'))+';',
 'app.setPath("userData",'+JSON.stringify(userData)+');app.setAppPath(original);',
 'const stages=[];const stage=value=>{stages.push({stage:value,at:new Date().toISOString()});fs.writeFileSync('+JSON.stringify(join(output,'startup-state.json'))+',JSON.stringify(stages.slice(-50),null,2),{mode:0o600})};',
 'app.on("browser-window-created",(_event,window)=>{stage("window created");window.on("show",()=>stage("window shown"));window.on("ready-to-show",()=>stage("window ready"));window.webContents.on("did-finish-load",()=>stage("page loaded"));});',
 'import('+JSON.stringify(join(source,'lib/main.js'))+').catch(error=>{fs.writeFileSync('+JSON.stringify(join(output,'startup-import-error.log'))+',String(error.stack||error));app.exit(1)});',''
].join('\n')
writeFileSync(join(entry,'bootstrap.cjs'),bootstrap)
writeFileSync(join(output,'build.json'),JSON.stringify({version,revision:'1f81c047fc48fa190a683e469daa699857e9afe8',bundle,source,installedAppModified:false,debuggingPortsEnabled:false,home,userData,executable:join(bundle,'Contents/MacOS/Workbench')},null,2)+'\n',{mode:0o600})
execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-',bundle],{stdio:'pipe'})
execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',bundle],{stdio:'pipe'})
execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',['-f',bundle])
console.log('Local persistent host prepared: '+bundle)
console.log('Original application unchanged; local browser storage isolated. Do not run both hosts against the same DSH_HOME.')
