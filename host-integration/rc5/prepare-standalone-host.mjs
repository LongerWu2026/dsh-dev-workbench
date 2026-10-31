/** Build a self-contained local rc.5 app from shipped resources and reviewed source. Never modifies the installed app. */
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync,symlinkSync,readdirSync,lstatSync,realpathSync} from 'node:fs'
import {join,resolve,dirname,relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const here=dirname(fileURLToPath(import.meta.url)),project=resolve(here,'../..')
const installed='/Applications/DeepSeek Harness.app',resources=join(installed,'Contents/Resources')
const source=join(project,'.local-host/rc5-source'),runtime=join(project,'.tmp/electron-runtime-44.7/Electron.app')
const version='0.2.1-rc.5',revision='b830ec950faba0a46dda564be3e2d854afed94f1'
const expectedAsar='8dad52f295bdbe9fa71948fdf38ac2ce3c910213d3b89c37174b2af77db9fb31'
const digest=path=>createHash('sha256').update(readFileSync(path)).digest('hex')
assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64')
assert.equal(digest(join(resources,'app.asar')),expectedAsar,'Installed application changed; rebuild against its exact source')
execFileSync(process.execPath,[join(here,'apply.mjs'),source,'--check'],{stdio:'inherit'})
assert.equal(JSON.parse(readFileSync(join(source,'apps/desktop/package.json'),'utf8')).version,version)
const main=readFileSync(join(source,'apps/desktop/lib/main.js'),'utf8'),preload=readFileSync(join(source,'apps/desktop/lib/preload-app.cjs'),'utf8')
assert.ok(main.includes('browser-acquire-persistent')&&preload.includes('browser-acquire-persistent'),'Build the reviewed source first')
const output=resolve(process.argv[2]||join(project,'.local-host/rc5-native-login'))
assert.ok(!existsSync(output),'Refusing existing output; choose a new directory')
mkdirSync(output,{recursive:true,mode:0o700})
const bundle=join(output,'智能工作台 Harness RC5.app')
execFileSync('/usr/bin/ditto',[runtime,bundle])
// Keep the default Electron loader: it must honor the launcher's explicit application path.
// A directory named Resources/app would be auto-loaded before command-line test/dev entrypoints.
const appResources=join(bundle,'Contents/Resources'),entry=join(appResources,'workbench-app')
const require=createRequire(import.meta.url)
const asar=require(join(source,'node_modules/.pnpm/node_modules/@electron/asar'))
asar.extractAll(join(resources,'app.asar'),entry)
execFileSync('/bin/cp',['-cR',join(resources,'runtime'),join(appResources,'runtime')])
// Copy only reviewed MAIN and preload build outputs; the stock Host and client payloads stay aligned with rc.5.
const replacementFiles=['main.js','preload-app.cjs']
for(const name of replacementFiles)copyFileSync(join(source,'apps/desktop/lib',name),join(entry,'lib',name))
const manifestPath=join(entry,'package.json'),manifest=JSON.parse(readFileSync(manifestPath,'utf8'))
manifest.main='workbench-bootstrap.cjs';writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n')
const dsh=join(entry,'dsh'),plugin=join(dsh,'node_modules/dsh-dev-workbench')
assert.ok(!existsSync(plugin),'Unexpected workbench package in the stock payload')
mkdirSync(plugin,{recursive:true})
const pluginPackage=JSON.parse(readFileSync(join(project,'package.json'),'utf8'))
for(const name of ['package.json','index.js','client.js','cordis.patch.yml','icon.svg','README.md'])copyFileSync(join(project,name),join(plugin,name))
mkdirSync(join(plugin,'locale'));for(const name of readdirSync(join(project,'locale')))copyFileSync(join(project,'locale',name),join(plugin,'locale',name))
for(const dependency of Object.keys(pluginPackage.dependencies||{}))assert.ok(existsSync(join(dsh,'node_modules',dependency)),'Missing bundled plugin dependency '+dependency)
const dshManifestPath=join(dsh,'package.json'),dshManifest=JSON.parse(readFileSync(dshManifestPath,'utf8'))
dshManifest.dependencies['dsh-dev-workbench']=pluginPackage.version
dshManifest.dsh??={profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app']}}
dshManifest.dsh.profile.bundles.push('dsh-dev-workbench')
writeFileSync(dshManifestPath,JSON.stringify(dshManifest,null,2)+'\n')
mkdirSync(join(entry,'scripts'),{recursive:true});symlinkSync('../../runtime/bin',join(entry,'scripts/node-bin'),'dir')
const bootstrap=`const {app,dialog}=require('electron');
const path=require('node:path'),os=require('node:os'),fs=require('node:fs'),cp=require('node:child_process');
const root=__dirname,resources=path.dirname(root);
// This local source extension uses explicit bundled runtime paths and does not register update/protocol ownership.
Object.defineProperty(app,'isPackaged',{value:false});
delete process.env.NODE_OPTIONS;delete process.env.DSH_DESKTOP_HOST_INSPECT_PORT;delete process.env.DSH_DESKTOP_DEV_APP;
const home=process.env.DSH_HOME||path.join(os.homedir(),'.dsh');
const data=process.env.WORKBENCH_BROWSER_DATA||path.join(os.homedir(),'Library/Application Support/AIWorkBench Harness RC5');
const profile=path.join(home,'profiles/desktop');
// The local app shares business settings with the chosen home, but owns a separate browser data directory.
const running=cp.execFileSync('/bin/ps',['-axo','command='],{encoding:'utf8'}).split('\\n').some(line=>line.includes('--expose-internals ')&&line.includes('dsh-desktop-host/lib/index.js ')&&line.includes(' '+profile+' '));
if(running){dialog.showErrorBox('请先退出正在运行的宿主','为避免两个宿主同时写入同一工作目录，请先正常退出原版，再打开此应用。');app.exit(0)}else{
process.env.DSH_HOME=home;process.env.DSH_DESKTOP_DSH_DIR=path.join(root,'dsh');
process.env.DSH_DESKTOP_PRIMARY_RUNTIME_DIR=path.join(resources,'runtime/primary-runtime');
process.env.DSH_DESKTOP_PNPM_ENTRY=path.join(resources,'runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs');
process.env.DSH_DESKTOP_OPEN_DEVTOOLS='0';
fs.mkdirSync(data,{recursive:true,mode:0o700});app.setPath('userData',data);app.setAppPath(root);
import(require('node:url').pathToFileURL(path.join(root,'lib/main.js')).href).catch(error=>{console.error(error);app.exit(1)});
}
`
writeFileSync(join(entry,'workbench-bootstrap.cjs'),bootstrap)
// A real Mach-O executable matches CFBundleExecutable, so macOS window identity and Dock actions work normally.
copyFileSync(join(runtime,'Contents/MacOS/Electron'),join(bundle,'Contents/MacOS/WorkbenchRC5'))
const nativeEntry=join(appResources,'app');mkdirSync(nativeEntry)
writeFileSync(join(nativeEntry,'package.json'),JSON.stringify({name:'@deepseek-ai/dsh-desktop',version,main:'main.cjs'})+'\n')
writeFileSync(join(nativeEntry,'main.cjs'),"require('../workbench-app/workbench-bootstrap.cjs')\n")
const plist=join(bundle,'Contents/Info.plist')
for(const [key,value] of Object.entries({CFBundleIdentifier:'local.aiworkbench.harness.rc5.native',CFBundleName:'智能工作台 Harness RC5',CFBundleDisplayName:'智能工作台 Harness RC5',CFBundleExecutable:'WorkbenchRC5',CFBundleShortVersionString:version}))execFileSync('/usr/bin/plutil',['-replace',key,'-string',value,plist])
// Reject runtime dependencies that still point at the developer checkout or the original app.
const verifyLinks=directory=>{for(const child of readdirSync(directory)){const path=join(directory,child),stat=lstatSync(path);if(stat.isSymbolicLink()){const target=realpathSync(path);assert.ok(!relative(bundle,target).startsWith('..'),'External runtime link '+path)}else if(stat.isDirectory())verifyLinks(path)}}
verifyLinks(bundle)
execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-',bundle],{stdio:'pipe'})
execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',bundle],{stdio:'pipe'})
assert.equal(digest(join(resources,'app.asar')),expectedAsar)
const result={date:new Date().toISOString(),version,revision,bundle,entry,nativeEntry:true,portable:true,originalAppModified:false,registeredUrlHandlers:false,launched:false,businessHome:'DSH_HOME or ~/.dsh; original must quit before switching',browserData:'~/Library/Application Support/AIWorkBench Harness RC5',stockAsarSha256:expectedAsar,replacements:replacementFiles.map(name=>({path:'lib/'+name,sha256:digest(join(entry,'lib',name))})),plugin:{version:pluginPackage.version,host:digest(join(plugin,'index.js')),client:digest(join(plugin,'client.js'))}}
writeFileSync(join(output,'result.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600})
console.log(JSON.stringify(result,null,2))
