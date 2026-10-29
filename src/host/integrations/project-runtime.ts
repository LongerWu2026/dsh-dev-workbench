import {readFileSync,existsSync,statSync,realpathSync} from 'node:fs'
import {join} from 'node:path'
import {platform} from 'node:os'
import {randomUUID} from 'node:crypto'
import {normalizeLaunchCommands, type LaunchCommand} from '../../shared/developer-tools.js'
import {loadWorkbenchState} from '../storage/state-store.js'
import {workbenchContext} from '../application/service-context.js'

type Run={id:string;projectId:string;name:string;argv:string[];cwd:string;status:string;startedAt:string;endedAt?:string;exitCode?:number|null;error?:string;handle:any}
const runs=new Map<string,Run>()
function project(id:string) {
    const row=loadWorkbenchState().projects.find((p:any)=>p.id===id)
    if(!row?.repoPath)throw new Error('请选择已配置目录的项目')
    const cwd=realpathSync(row.repoPath)
    if(!statSync(cwd).isDirectory())throw new Error('项目目录不可用')
    return {row,cwd}
}
function commands(row:any,cwd:string):LaunchCommand[] {
    const configured=normalizeLaunchCommands(row.launchCommands||[])
    const found:LaunchCommand[]=[]
    try {
        if(statSync(join(cwd,'package.json')).size>1024*1024)throw new Error('package.json超过1MB')
        const pkg=JSON.parse(readFileSync(join(cwd,'package.json'),'utf8'))
        const manager=existsSync(join(cwd,'pnpm-lock.yaml'))?'pnpm':existsSync(join(cwd,'yarn.lock'))?'yarn':existsSync(join(cwd,'bun.lock'))||existsSync(join(cwd,'bun.lockb'))?'bun':'npm'
        for(const name of Object.keys(pkg.scripts||{}).slice(0,60)) if(/^[\w:.-]+$/.test(name)&&!name.startsWith('-'))found.push({id:'script-'+name,name:manager+' run '+name,argv:[manager,'run',name]})
    }catch{}
    if(existsSync(join(cwd,'pom.xml')))found.push({id:'maven-run',name:'Spring Boot 启动',argv:[existsSync(join(cwd,'mvnw'))?'./mvnw':'mvn','spring-boot:run']})
    if(existsSync(join(cwd,'gradlew')))found.push({id:'gradle-run',name:'Gradle bootRun',argv:['./gradlew','bootRun']})
    return [...configured,...found.filter(item=>!configured.some(c=>c.id===item.id))]
}
function snapshot(run:Run) {
    const read=(stream:any)=>{try{const out=stream?.readFrom(0);return {text:String(out?.text||''),truncated:out?.lossy===true}}catch{return {text:'',truncated:false}}}
    const stdout=read(run.handle?.collected?.stdout),stderr=read(run.handle?.collected?.stderr)
    const {handle,...data}=run
    return {...data,stdout:stdout.text,stderr:stderr.text,truncated:stdout.truncated||stderr.truncated}
}
export function hasActiveProjectRuns(projectId:string){return [...runs.values()].some(run=>run.projectId===projectId&&['running','stopping'].includes(run.status))}
export function projectRuntimeState(projectId:string) {
    const {row,cwd}=project(projectId)
    return {projectId,cwd,commands:commands(row,cwd),runs:[...runs.values()].filter(run=>run.projectId===projectId).map(snapshot).reverse(),platform:platform()}
}
export function startProject(projectId:string,commandId:string) {
    const {row,cwd}=project(projectId),command=commands(row,cwd).find(c=>c.id===commandId)
    if(!command)throw new Error('启动配置不存在，请刷新项目')
    if([...runs.values()].some(run=>run.projectId===projectId&&['running','stopping'].includes(run.status)&&JSON.stringify(run.argv)===JSON.stringify(command.argv)))throw new Error('此命令已在运行')
    if([...runs.values()].filter(run=>['running','stopping'].includes(run.status)).length>=4)throw new Error('最多同时运行4个项目命令')
    const subprocess=workbenchContext()?.get?.('subprocess')
    if(!subprocess?.spawn)throw new Error('宿主没有提供进程执行服务')
    const run:Run={id:randomUUID(),projectId,name:command.name,argv:command.argv,cwd,status:'running',startedAt:new Date().toISOString(),handle:null}
    run.handle=subprocess.spawn({argv:run.argv,cwd,stdio:{stdin:'ignore',stdout:{maxBytes:64*1024},stderr:{maxBytes:64*1024}},graceMs:1500})
    runs.set(run.id,run)
    for(const [id,item] of runs)if(runs.size>8&&['completed','failed','stopped'].includes(item.status))runs.delete(id)
    Promise.resolve(run.handle.done).then(out=>{run.exitCode=out?.exitCode??null;run.status=run.status==='stopping'?'stopped':out?.exitCode===0?'completed':'failed'},error=>{run.status='failed';run.error=String(error?.message||error)}).finally(()=>{run.endedAt=new Date().toISOString();for(const [id,item] of runs)if(runs.size>8&&['completed','failed','stopped'].includes(item.status))runs.delete(id)})
    return snapshot(run)
}
export async function stopProject(runId:string) {
    const run=runs.get(runId)
    if(!run)throw new Error('运行记录不存在（宿主重启后不会恢复进程）')
    if(run.status==='running'){run.status='stopping';try{await run.handle.terminate()}catch(error){run.status='running';throw error}}
    return snapshot(run)
}
export async function openProject(projectId:string,target:string) {
    const {cwd}=project(projectId)
    const applications:Record<string,string>={vscode:'Visual Studio Code',idea:'IntelliJ IDEA',terminal:'Terminal'}
    if(!applications[target])throw new Error('不支持的打开方式')
    const argv=platform()==='darwin'?['/usr/bin/open','-a',applications[target],cwd]:target==='terminal'?null:[target==='vscode'?'code':'idea',cwd]
    if(!argv)throw new Error('当前系统暂未配置终端联动，请在macOS使用此入口')
    const subprocess=workbenchContext()?.get?.('subprocess')
    if(!subprocess?.spawn)throw new Error('宿主没有提供进程执行服务')
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000)
    try {
        const handle=subprocess.spawn({argv,cwd,stdio:{stdin:'ignore',stdout:{maxBytes:4096},stderr:{maxBytes:4096}},signal:controller.signal,graceMs:1000})
        const out=await handle.done
        if(out?.exitCode!==0)throw new Error('无法打开应用：'+String(handle.collected?.stderr?.readFrom(0)?.text||out?.exitCode||'未知错误').slice(0,500))
        return {status:'opened',target}
    }finally{clearTimeout(timer)}
}
export function disposeProjectRuntime(){for(const run of runs.values())if(['running','stopping'].includes(run.status)){try{run.status='stopping';void Promise.resolve(run.handle.terminate()).catch(()=>{})}catch{}}}
