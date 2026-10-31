import {copyFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync} from 'node:fs'
import {basename, dirname, join} from 'node:path'
import {homedir} from 'node:os'
import {invalidateYzjPathCache, resolveYzjPath} from './yunzhijia.js'
import {yunzhijiaBinDirs, yunzhijiaInstallDir, yunzhijiaManagedBinary} from './yunzhijia-paths.js'

type Operation = {kind: 'install'|'login'; status: 'running'|'succeeded'|'failed'; note: string}
let operation: Operation|null = null
let active: {controller: AbortController; handle?: any}|null = null

export function yunzhijiaSetupStatus() { return operation ? {...operation, status:active ? 'running' : operation.status} : null }
export function disposeYunzhijiaSetup() {
    const previous = active
    active = null
    if (previous) {
        previous.controller.abort()
        try { void Promise.resolve(previous.handle?.terminate?.()).catch(()=>{}) } catch {}
        operation = {...operation!, status:'failed', note:'操作已随插件停用而停止，请重新检测后重试'}
    }
    invalidateYzjPathCache()
}

async function npmCommand(subprocess: any): Promise<string[]> {
    // Invoke npm's JS with the host Node, avoiding npm.cmd and stale shebang PATHs.
    const nodeDir = dirname(process.execPath)
    const candidates = [join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'), join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')].map(cli=>({cli,node:process.execPath}))
    let resolved: string|null = null
    try { resolved = await subprocess.resolveExecutable?.('npm', undefined, AbortSignal.timeout(2500)) } catch {}
    for (const path of [resolved, ...yunzhijiaBinDirs().map(dir=>join(dir,'npm'))]) {
        if (!path) continue
        try {
            const target = realpathSync(path)
            if (target.endsWith('npm-cli.js')) {
                const node = join(dirname(path), process.platform === 'win32' ? 'node.exe' : 'node')
                candidates.push({cli:target,node:existsSync(node) ? node : process.execPath})
            }
        } catch {}
    }
    const found = candidates.find(({cli})=>existsSync(cli))
    if (!found) throw new Error('未找到 npm，请先安装 Node.js，再点击安装；也可在终端执行 npm install -g @yunzhijia/cli')
    return [found.node, found.cli]
}

export function startYunzhijiaSetup(ctx: any, kind: unknown, onFinished: ()=>Promise<unknown>) {
    if (kind !== 'install' && kind !== 'login') throw new Error('不支持的云之家操作')
    if (active) throw new Error('云之家安装或登录正在进行，请等待结果')
    const subprocess = ctx?.get ? ctx.get('subprocess') : ctx?.subprocess
    if (!subprocess?.spawn) throw new Error('宿主没有提供进程执行服务')
    const current = active = {controller:new AbortController(), handle:undefined as any}
    const result = operation = {kind, status:'running', note:kind === 'install' ? '正在安装云之家 CLI…' : '请在打开的浏览器中完成云之家登录…'} as Operation
    // The Remote returns immediately. Polling can resume after page navigation.
    void (async()=>{
        const timer = setTimeout(()=>current.controller.abort(), kind === 'install' ? 180000 : 300000)
        let stagingDir: string|null = null
        try {
            let argv: string[], cwd = homedir(), node = process.execPath
            invalidateYzjPathCache()
            if (kind === 'install') {
                const npm = await npmCommand(subprocess)
                node = npm[0]
                cwd = yunzhijiaInstallDir()
                mkdirSync(cwd, {recursive:true})
                argv = [...npm, 'install', '--prefix', cwd, '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-online', '--registry=https://registry.npmjs.org', '@yunzhijia/cli@latest']
            } else {
                const path = await resolveYzjPath(ctx)
                if (!path) throw new Error('请先安装云之家 CLI')
                argv = [path, 'auth', 'login']
            }
            if (active !== current) return
            if (current.controller.signal.aborted) throw new Error('操作超时，请重新检测后重试')
            const execute = async (command: string[]) => {
                current.handle = subprocess.spawn({argv:command, cwd, signal:current.controller.signal, graceMs:1500, stdio:{stdin:'ignore', stdout:{maxBytes:16384}, stderr:{maxBytes:16384}}})
                return current.handle.done
            }
            let outcome = await execute(argv)
            if (active === current && !current.controller.signal.aborted && outcome?.exitCode === 0 && kind === 'install') {
                // The official postinstall also replaces global Agent skills. Run
                // its binary installer in an owned directory without a skills/
                // tree, so installing this connector cannot overwrite those files.
                const pkg = join(cwd, 'node_modules', '@yunzhijia', 'cli')
                // Always download into a fresh directory: the vendor installer
                // otherwise skips an existing binary, including a same-version reinstall.
                const native = stagingDir = mkdtempSync(join(cwd, 'native-download-'))
                mkdirSync(join(native, 'scripts'), {recursive:true})
                copyFileSync(join(pkg, 'package.json'), join(native, 'package.json'))
                copyFileSync(join(pkg, 'scripts', 'install.js'), join(native, 'scripts', 'install.js'))
                outcome = await execute([node, join(native, 'scripts', 'install.js')])
                if (active !== current) return
                if (current.controller.signal.aborted) throw new Error('操作超时，请重新检测后重试')
                if (outcome?.exitCode !== 0) throw new Error('下载最新版云之家 CLI 失败，请检查网络后重试')
                const binary = join(native, 'bin', basename(yunzhijiaManagedBinary()))
                if (!existsSync(binary)) throw new Error('安装命令已退出，但未找到云之家可执行文件，请检查下载网络后重试')
                outcome = await execute([binary, '--version'])
                if (active !== current) return
                if (current.controller.signal.aborted) throw new Error('操作超时，请重新检测后重试')
                if (outcome?.exitCode !== 0) throw new Error('新版云之家 CLI 验证失败，已保留原版本')
                mkdirSync(dirname(yunzhijiaManagedBinary()), {recursive:true})
                renameSync(binary, yunzhijiaManagedBinary())
            }
            if (active !== current) return
            if (current.controller.signal.aborted) throw new Error('操作超时，请检查网络或登录授权后重试')
            if (outcome?.exitCode !== 0) throw new Error(kind === 'install' ? '安装失败，请检查网络、Node.js/npm 和安装目录权限后重试' : '登录未完成，请重新登录')
            if (kind === 'install' && !existsSync(yunzhijiaManagedBinary())) throw new Error('安装命令已退出，但未找到云之家可执行文件，请检查下载网络后重试')
            result.status = 'succeeded'
            result.note = kind === 'install' ? 'CLI 已安装，正在检测登录状态；未登录时请点击登录授权' : '登录流程已结束，正在重新验证账号'
        } catch (error) {
            if (active !== current) return
            result.status = 'failed'
            // Never forward CLI output: login output may contain access-bearing URLs.
            result.note = current.controller.signal.aborted ? '操作超时，请重新检测后重试' : String(error?.message || '云之家操作失败')
        } finally {
            clearTimeout(timer)
            if (stagingDir) { try { rmSync(stagingDir, {recursive:true, force:true}) } catch {} }
            if (active === current) {
                invalidateYzjPathCache()
                try { await onFinished() } catch { result.note += '；自动检测失败，请点击重新检测' }
                if (active === current) active = null
            }
        }
    })()
    return yunzhijiaSetupStatus()
}
