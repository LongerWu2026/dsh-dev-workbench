/** Prepare a separate review-only macOS host, without launching or registering URL handlers. */
import {build} from 'esbuild'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,existsSync,symlinkSync} from 'node:fs'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const here=dirname(fileURLToPath(import.meta.url)),project=resolve(here,'../..')
const source=resolve(process.env.WORKBENCH_HARNESS_SOURCE||join(project,'.local-host/rc5-source'))
const runtime=resolve(process.env.WORKBENCH_ELECTRON_APP||join(project,'.tmp/electron-runtime-44.7/Electron.app'))
const primaryRuntime=resolve(process.env.WORKBENCH_PRIMARY_RUNTIME||'/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime')
assert.equal(JSON.parse(readFileSync(join(source,'apps/desktop/package.json'),'utf8')).version,'0.2.1-rc.5')
execFileSync(process.execPath,[join(here,'apply.mjs'),source,'--check'],{stdio:'inherit'})
for(const file of ['apps/desktop/lib/main.js','apps/desktop/lib/preload-app.cjs','apps/desktop-host/lib/index.js'])assert.ok(existsSync(join(source,file)),'Build is required: '+file)
assert.ok(existsSync(join(primaryRuntime,'runtime.json')),'Prepared runtime is required')
const officeSkills=join(dirname(primaryRuntime),'office-skills')
assert.ok(existsSync(join(officeSkills,'office/SKILL.md')),'Bundled Office skills are required')
mkdirSync(join(here,'artifacts'),{recursive:true})
const directory=mkdtempSync(join(here,'artifacts/review-host-')),appRoot=join(source,'apps/desktop')
const projectDir=join(directory,'project'),userData=join(directory,'browser-data'),home=join(directory,'home')
const release={schemaVersion:1,version:'0.2.1-rc.5',hostProtocolVersion:1,nodeVersion:execFileSync(join(runtime,'Contents/MacOS/Electron'),['-p','process.versions.node'],{encoding:'utf8',env:{PATH:process.env.PATH,HOME:process.env.HOME,ELECTRON_RUN_AS_NODE:'1'}}).trim(),pnpmVersion:JSON.parse(readFileSync(join(appRoot,'node_modules/pnpm/package.json'),'utf8')).version}
const generated=join(directory,'prepare-project.mjs')
await build({stdin:{contents:`import {prepareDevelopmentProject} from ${JSON.stringify(join(appRoot,'scripts/development-project.ts'))};import {DESKTOP_HOST_PROTOCOL_VERSION} from ${JSON.stringify(join(appRoot,'src/host-protocol.ts'))};const options=${JSON.stringify({projectDir,cliDir:join(source,'apps/cli'),hostDir:join(source,'apps/desktop-host'),dependencyDir:join(source,'node_modules/.pnpm/node_modules'),release,target:'mac-arm64'})};options.release.hostProtocolVersion=DESKTOP_HOST_PROTOCOL_VERSION;prepareDevelopmentProject(options)`,resolveDir:source},outfile:generated,bundle:true,format:'esm',platform:'node',logLevel:'silent'})
execFileSync(process.execPath,[generated],{stdio:'inherit'})
// Review the actual local plugin without copying any daily host settings or credentials.
const projectManifestPath=join(projectDir,'package.json'),projectManifest=JSON.parse(readFileSync(projectManifestPath,'utf8'))
projectManifest.dependencies['dsh-dev-workbench']='file:'+project
projectManifest.dsh.profile.bundles.push('dsh-dev-workbench')
writeFileSync(projectManifestPath,JSON.stringify(projectManifest,null,2)+'\n',{mode:0o600})
symlinkSync(project,join(projectDir,'node_modules/dsh-dev-workbench'),'dir')
const bundle=join(directory,'Harness Persistence RC5.app')
execFileSync('/usr/bin/ditto',[runtime,bundle])
const bundledPrimary=join(bundle,'Contents/Resources/workbench-primary-runtime')
execFileSync('/usr/bin/ditto',[primaryRuntime,bundledPrimary])
execFileSync('/usr/bin/ditto',[officeSkills,join(bundle,'Contents/Resources/office-skills')])
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'"
const executable=join(bundle,'Contents/MacOS/HarnessPersistenceRC5')
const environment={DSH_HOME:home,DSH_DESKTOP_DSH_DIR:projectDir,DSH_DESKTOP_PNPM_ENTRY:join(appRoot,'node_modules/pnpm/bin/pnpm.mjs'),DSH_DESKTOP_PRIMARY_RUNTIME_DIR:bundledPrimary,DSH_DESKTOP_OPEN_DEVTOOLS:'0'}
const launcher=['#!/bin/sh','unset ELECTRON_RUN_AS_NODE DSH_DESKTOP_DEV_APP',...Object.entries(environment).map(([key,value])=>'export '+key+'='+quote(value)),'cd '+quote(appRoot),'exec '+[join(bundle,'Contents/MacOS/Electron'),'--user-data-dir='+userData,appRoot].map(quote).join(' ')+' "$@"',''].join('\n')
writeFileSync(executable,launcher,{mode:0o755})
const plist=join(bundle,'Contents/Info.plist')
for(const [key,value] of Object.entries({CFBundleIdentifier:'local.workbench.harness-persistence.rc5.'+createHash('sha256').update(directory).digest('hex').slice(0,12),CFBundleName:'Harness Persistence RC5',CFBundleDisplayName:'Harness Persistence RC5',CFBundleExecutable:'HarnessPersistenceRC5'}))execFileSync('/usr/bin/plutil',['-replace',key,'-string',value,plist])
execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-',bundle],{stdio:'pipe'})
execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',bundle],{stdio:'pipe'})
const evidence={date:new Date().toISOString(),version:release.version,source,revision:'b830ec950faba0a46dda564be3e2d854afed94f1',bundle,home,userData,projectDir,pluginSource:project,launched:false,registeredUrlHandlers:false,originalAppModified:false,usesSourceBuild:true,portable:false,notes:'Review app depends on this exact source checkout and its built dependencies; a fresh profile is used. No daily user data or credentials are copied. Primary runtime payload only is copied read-only from installed rc.5.'}
writeFileSync(join(directory,'result.json'),JSON.stringify(evidence,null,2)+'\n')
console.log(JSON.stringify(evidence,null,2))
