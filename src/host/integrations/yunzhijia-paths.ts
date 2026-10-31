import {dirname, join} from 'node:path'
import {existsSync, readdirSync, realpathSync} from 'node:fs'
import {homedir, platform, workbenchDir} from '../platform/runtime.js'

export const yunzhijiaInstallDir = () => join(workbenchDir(), 'tools', 'yunzhijia')
export const yunzhijiaManagedBinary = () => join(yunzhijiaInstallDir(), 'native-install', 'bin', platform() === 'win32' ? 'yzj-cli.exe' : 'yzj-cli')
export function nativeYunzhijiaBinary(path: string): string {
    try {
        const target = realpathSync(path)
        if (target.endsWith(join('@yunzhijia', 'cli', 'scripts', 'run.js'))) {
            const binary = join(dirname(target), '..', 'bin', platform() === 'win32' ? 'yzj-cli.exe' : 'yzj-cli')
            if (existsSync(binary)) return binary
        }
    } catch {}
    return path
}
export function yunzhijiaBinDirs(): string[] {
    const home = homedir()
    const nvm = join(process.env.NVM_DIR || join(home,'.nvm'), 'versions', 'node')
    let versions: string[] = []
    try { versions = readdirSync(nvm).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})).map(version=>join(nvm,version,'bin')) } catch {}
    return [...new Set([
        dirname(process.execPath), '/opt/homebrew/bin', '/usr/local/bin',
        join(home, '.local', 'bin'), join(home, '.cargo', 'bin'), join(home, 'bin'), join(home, '.local', 'share', 'pnpm'),
        ...(process.env.APPDATA ? [join(process.env.APPDATA, 'npm')] : []),
        ...(process.env.npm_config_prefix ? [join(process.env.npm_config_prefix, 'bin')] : []),
        ...versions,
    ])]
}
