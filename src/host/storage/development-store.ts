import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,readdirSync} from 'node:fs'
import {join,resolve,isAbsolute} from 'node:path'
import {homedir} from 'node:os'
import {randomUUID} from 'node:crypto'
import {checkedArgv,type DevelopmentConfig,type DevelopmentTask} from '../../shared/development.js'
import {discoverLinky} from './development-environment.js'

export function developmentDir(){return join(process.env.DSH_HOME||join(homedir(),'.dsh'),'storages','dev-workbench','development')}
export function developmentConfigPath(){return join(developmentDir(),'config.json')}
function installedHarnessCommand():string[]{
    // Desktop installations may leave a broken /usr/local/bin/dsh. Prefer a complete
    // official npm installation, paired with its own Node, without copying credentials.
    const base=join(homedir(),'.nvm','versions','node')
    if(existsSync(base))for(const version of readdirSync(base).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})).slice(0,20)){
        const node=join(base,version,'bin','node'),cli=join(base,version,'lib','node_modules','@deepseek-ai','dsh','lib','bin.js')
        if(existsSync(node)&&existsSync(cli))return [node,'--expose-internals',cli,'--profile','acp']
    }
    return ['dsh','--profile','acp']
}
export function writeDevelopmentFile(path:string,value:unknown){
    mkdirSync(resolve(path,'..'),{recursive:true,mode:0o700})
    const tmp=path+'.'+randomUUID()+'.tmp'
    writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});renameSync(tmp,path)
}
export function readDevelopmentConfig():DevelopmentConfig {
    const found=discoverLinky()
    const defaults:DevelopmentConfig={cliPath:found.cliPaths[0]||join(homedir(),'.local','bin','linky'),profile:found.profile,workspaceId:'',
        worktreeRoot:join(homedir(),'HarnessWorkspaces'),harnessCommand:installedHarnessCommand(),model:'deepseek-v4-flash',adapterRoots:[],checks:{},adapterPermissionMode:'read-only',agentId:''}
    if(!existsSync(developmentConfigPath()))return defaults
    return {...defaults,...JSON.parse(readFileSync(developmentConfigPath(),'utf8'))}
}
export function saveDevelopmentConfig(patch:any):DevelopmentConfig {
    const next=readDevelopmentConfig()
    if(next.defaultWorkspaceId===undefined)next.defaultWorkspaceId=next.workspaceId
    for(const key of ['cliPath','worktreeRoot'] as const)if(key in patch){if(typeof patch[key]!=='string'||!isAbsolute(patch[key])||patch[key].includes('\0'))throw new Error('请配置绝对路径');next[key]=resolve(patch[key])}
    for(const key of ['profile','workspaceId','defaultWorkspaceId','model','agentId'] as const)if(key in patch){if(typeof patch[key]!=='string'||!(/^[\w.-]{0,120}$/).test(patch[key])||(['profile','model'].includes(key)&&!patch[key]))throw new Error('配置标识无效');next[key]=patch[key]}
    if('harnessCommand' in patch)next.harnessCommand=checkedArgv(patch.harnessCommand)
    if('adapterPermissionMode' in patch){if(!['read-only','workspace-write'].includes(patch.adapterPermissionMode))throw new Error('无效权限模式');next.adapterPermissionMode=patch.adapterPermissionMode}
    if('adapterRoots' in patch){if(!Array.isArray(patch.adapterRoots)||patch.adapterRoots.length>12||patch.adapterRoots.some((p:any)=>typeof p!=='string'||!isAbsolute(p)||resolve(p)===resolve('/')))throw new Error('请配置有限的适配工作区根目录');next.adapterRoots=patch.adapterRoots.map((p:string)=>resolve(p))}
    if('checks' in patch){
        if(!patch.checks||typeof patch.checks!=='object'||Array.isArray(patch.checks))throw new Error('测试配置无效')
        const checks:Record<string,string[][]>={}
        for(const [id,commands] of Object.entries(patch.checks)){if(!/^[\w.-]{1,120}$/.test(id)||!Array.isArray(commands)||commands.length>10)throw new Error('测试配置无效');checks[id]=commands.map(checkedArgv)}
        next.checks=checks
    }
    writeDevelopmentFile(developmentConfigPath(),next);return next
}
function taskPath(id:string){if(!/^[\w-]{1,120}$/.test(id))throw new Error('任务标识无效');return join(developmentDir(),'tasks',id+'.json')}
export function saveDevelopmentTask(task:DevelopmentTask){task.updatedAt=new Date().toISOString();writeDevelopmentFile(taskPath(task.id),task);return task}
export function readDevelopmentTask(id:string):DevelopmentTask{return JSON.parse(readFileSync(taskPath(id),'utf8'))}
export function listDevelopmentTasks():DevelopmentTask[]{
    const dir=join(developmentDir(),'tasks');if(!existsSync(dir))return []
    return readdirSync(dir).filter(name=>/^[\w-]+\.json$/.test(name)).map(name=>readDevelopmentTask(name.slice(0,-5))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
}
