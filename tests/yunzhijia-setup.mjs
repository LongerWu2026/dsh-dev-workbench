/** Isolated connector lifecycle fixtures; never reads a real account or installs globally. */
import assert from 'node:assert/strict'
import {mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, dirname, basename, resolve} from 'node:path'
import {build} from 'esbuild'
const home = mkdtempSync(join(tmpdir(), 'workbench-yzj-setup-'))
process.env.DSH_HOME = home
const bundle = join(home, 'host.mjs')
await build({stdin:{contents:`export {workbenchApi as api,setShared_workbenchCtx} from './src/host/application/workbench-service.ts'; export {disposeYunzhijiaSetup,yunzhijiaSetupStatus} from './src/host/integrations/yunzhijia-setup.ts'; export {resolveYzjPath,invalidateYzjPathCache,yzjCommandAllowed} from './src/host/integrations/yunzhijia.ts'; export {yunzhijiaManagedBinary,yunzhijiaInstallDir} from './src/host/integrations/yunzhijia-paths.ts'; export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts'; export {WORKBENCH_REMOTE_SIGNATURES} from './src/host/api/remote.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:bundle,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const host = await import(bundle), {api} = host
let installed = false, loggedIn = false, failed = false, missingBinary = false, invalidBinary = false, explicitOnly = false, blocked = null, checks = 0, downloads = 0
const launches = []
const fixturePath = join(home, 'external', 'yzj-cli')
const provider = {
    async resolveExecutable(command) {
        if (explicitOnly) { try { return realpathSync(command) === realpathSync(fixturePath) ? fixturePath : null } catch { return null } }
        return installed && command === 'yzj-cli' ? fixturePath : null
    },
    spawn(spec) {
        launches.push(spec)
        const args = spec.argv
        let output = '', exitCode = 0
        if (args.includes('install')) {
            if (failed) exitCode = 1
            else {
                const pkg = join(host.yunzhijiaInstallDir(),'node_modules','@yunzhijia','cli')
                mkdirSync(join(pkg,'scripts'),{recursive:true})
                writeFileSync(join(pkg,'package.json'),'{}')
                writeFileSync(join(pkg,'scripts','install.js'),'// fixture')
            }
        } else if (args.at(-1)?.endsWith(join('scripts','install.js'))) {
            downloads++
            const binary=join(dirname(dirname(args.at(-1))),'bin',basename(host.yunzhijiaManagedBinary()))
            if (!missingBinary) { mkdirSync(dirname(binary),{recursive:true}); writeFileSync(binary,'fixture-'+downloads) }
        } else if (args.includes('--version')) {
            if(invalidBinary)exitCode=1
        } else if (args.includes('whoami')) {
            output = JSON.stringify(loggedIn ? {success:true,data:{name:'测试账号',openId:'fixture',orgId:'test'}} : {success:false,errorCode:401})
        } else if (args.includes('auth')) {
            if (!blocked) loggedIn = true
        } else throw Error('Unexpected spawn '+args)
        const done = blocked && args.includes('auth') ? blocked.promise : Promise.resolve({exitCode})
        return {done,collected:{stdout:{readFrom:()=>({text:output})},stderr:{readFrom:()=>({text:'secret-output-must-not-escape'})}},terminate(){blocked?.resolve({exitCode:null});return Promise.resolve()}}
    },
}
const ctx = {get:name=>name === 'subprocess' ? provider : null}
host.setShared_workbenchCtx(ctx)
const check = (label, fn)=>{fn();checks++;console.log('✓ '+label)}
async function settled() {
    for(let n=0;n<200;n++) {
        const result = await api.yunzhijiaStatus({force:true})
        if(result.operation?.status !== 'running') { await new Promise(r=>setTimeout(r,0)); return result }
        await new Promise(r=>setTimeout(r,5))
    }
    throw Error('Operation did not settle')
}
try {
    let result = await api.yunzhijiaStatus({force:true})
    check('缺失CLI如实显示未配置',()=>{assert.equal(result.connector.installed,false);assert.equal(result.connector.authState,'unconfigured')})
    installed = true
    result = await api.yunzhijiaStatus({force:true})
    check('启动后外部安装可立即发现且区分未授权',()=>{assert.equal(result.connector.installed,true);assert.equal(result.connector.authState,'unauthorized')})
    loggedIn = true
    const count = launches.length
    result = await api.yunzhijiaStatus()
    check('自动检测使用短缓存，强制检测绕过缓存',()=>assert.equal(launches.length,count))
    result = await api.yunzhijiaStatus({force:true})
    check('同一宿主中外部登录后强制检测立即连接',()=>assert.equal(result.connector.authState,'ok'))
    loggedIn = false
    await host.mutateWorkbenchState(state=>{for(const row of state.connectors)row.updatedAt=new Date(Date.now()-16000).toISOString();return state})
    const beforeProgressRead = launches.length
    result = await api.yunzhijiaStatus({operationOnly:true})
    check('读取安装登录进度不触发连接探测，即使检测缓存已过期',()=>{assert.equal(launches.length,beforeProgressRead);assert.equal(result.connector.authState,'ok')})
    result = await api.yunzhijiaStatus()
    check('缓存过期后主动读取状态可检测授权变化，无需重启',()=>assert.equal(result.connector.authState,'unauthorized'))
    installed = false; loggedIn = false
    result = await api.yunzhijiaStatus({force:true})
    check('重检清理旧路径缓存，卸载后不继续显示已安装',()=>assert.equal(result.connector.installed,false))
    mkdirSync(dirname(fixturePath),{recursive:true});writeFileSync(fixturePath,'fixture')
    const originalNvm = process.env.NVM_DIR
    process.env.NVM_DIR = join(home,'nvm');const bin=join(process.env.NVM_DIR,'versions','node','v1','bin');mkdirSync(bin,{recursive:true})
    // Use an isolated nvm directory, with a provider that only accepts an absolute path.
    const {symlinkSync}=await import('node:fs');symlinkSync(fixturePath,join(bin,'yzj-cli'));explicitOnly=true
    result=await api.yunzhijiaStatus({force:true})
    check('GUI的旧PATH无法解析命令名时，通过提供方验证新nvm路径',()=>assert.equal(result.connector.installed,true))
    explicitOnly=false
    if(originalNvm===undefined)delete process.env.NVM_DIR;else process.env.NVM_DIR=originalNvm
    await api.createTask({title:'保留已有事项'})
    const started = await api.yunzhijiaSetup({kind:'install'})
    check('安装立即返回进行中状态，重复请求被拒绝',()=>assert.equal(started.status,'running'))
    await assert.rejects(api.yunzhijiaSetup({kind:'install'}),/正在进行/)
    result = await settled()
    check('安装完成立即重新验证，CLI存在不冒充已授权',()=>{assert.equal(result.operation.status,'succeeded');assert.equal(result.connector.installed,true);assert.equal(result.connector.authState,'unauthorized')})
    check('固定官方包、独立目录、跳过全局skills覆盖，原事项不丢失',()=>{
        const spec=launches.find(item=>item.argv.includes('install'))
        assert.ok(spec.argv.includes('@yunzhijia/cli@latest'));assert.ok(spec.argv.includes('--prefer-online'));assert.ok(spec.argv.includes('--ignore-scripts'));assert.ok(spec.argv.includes('--prefix'));assert.equal(spec.cwd,host.yunzhijiaInstallDir());assert.ok(spec.signal);assert.equal(host.loadWorkbenchState().tasks[0].title,'保留已有事项')
    })
    await api.yunzhijiaSetup({kind:'install'});result=await settled()
    check('重新安装重新下载并替换已有二进制，不跳过同版本文件',()=>{assert.equal(result.operation.status,'succeeded');assert.equal(downloads,2);assert.equal(readFileSync(host.yunzhijiaManagedBinary(),'utf8'),'fixture-2')})
    invalidBinary=true
    await api.yunzhijiaSetup({kind:'install'});result=await settled()
    check('新版验证失败保留原有可用二进制',()=>{assert.equal(result.operation.status,'failed');assert.equal(readFileSync(host.yunzhijiaManagedBinary(),'utf8'),'fixture-2')})
    invalidBinary=false
    await api.yunzhijiaSetup({kind:'login'});result = await settled()
    check('浏览器登录结束自动验证账号，未放宽后台命令白名单',()=>{assert.equal(result.connector.authState,'ok');assert.equal(host.yzjCommandAllowed(['auth','login']),false);assert.ok(launches.some(s=>s.argv.slice(-2).join(' ')==='auth login'));assert.ok(!JSON.stringify(result).includes('secret-output'))})
    loggedIn = false;let release;const promise=new Promise(resolve=>{release=resolve});blocked={promise,resolve:release}
    await api.yunzhijiaSetup({kind:'login'});await new Promise(r=>setTimeout(r,10));host.disposeYunzhijiaSetup();blocked=null
    check('插件停用终止自己的登录进程并保留可恢复状态',()=>{assert.equal(host.yunzhijiaSetupStatus().status,'failed')})
    rmSync(host.yunzhijiaManagedBinary());failed=true
    await api.yunzhijiaSetup({kind:'install'});result = await settled()
    check('安装失败显示原因，不泄露CLI输出，允许再次尝试',()=>{assert.equal(result.operation.status,'failed');assert.equal(result.connector.installed,false);assert.ok(!JSON.stringify(result).includes('secret-output'))})
    failed=false;missingBinary=true
    await api.yunzhijiaSetup({kind:'install'});result = await settled()
    check('npm与安装器成功退出但缺失原生文件仍判失败',()=>{assert.equal(result.operation.status,'failed');assert.match(result.operation.note,/未找到云之家可执行文件/)})
    await assert.rejects(api.yunzhijiaSetup({kind:'send'}),/不支持/)
    host.setShared_workbenchCtx({get:()=>null});await assert.rejects(api.yunzhijiaSetup({kind:'install'}),/进程执行服务/)
    check('安装与检测Remote已注册，无效动作及缺失宿主服务被拒绝',()=>{for(const name of ['yunzhijiaSetup','yunzhijiaStatus'])assert.ok(host.WORKBENCH_REMOTE_SIGNATURES.some(s=>s.method===name))})
    console.log('yunzhijia-setup: '+checks+' scenarios passed')
} finally { host.disposeYunzhijiaSetup();rmSync(home,{recursive:true,force:true}) }
