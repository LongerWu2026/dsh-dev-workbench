import {homedir} from 'node:os'
import {workbenchContext} from '../application/service-context.js'
import {readDevelopmentConfig} from '../storage/development-store.js'
import {issueFromLinky,DEVELOPMENT_ISSUE_TYPES} from '../../shared/development.js'
import {discoverLinky,executable} from '../storage/development-environment.js'

class LinkyError extends Error{constructor(message:string,public kind:string){super(message)}}

/** Only fixed operations built here reach the CLI. Issue text never becomes argv. */
export async function developmentCommand(argv:string[],cwd:string,timeoutMs=30000,signal?:AbortSignal){
    const subprocess=workbenchContext()?.get?.('subprocess')
    if(!subprocess?.spawn)throw new Error('宿主没有进程执行服务')
    const timeout=AbortSignal.timeout(timeoutMs),combined=signal?AbortSignal.any([timeout,signal]):timeout
    const handle=subprocess.spawn({argv,cwd,signal:combined,graceMs:1500,stdio:{stdin:'ignore',stdout:{maxBytes:512*1024},stderr:{maxBytes:64*1024}}})
    const outcome=await handle.done
    const stdout=handle.collected?.stdout?.readFrom(0),stderr=handle.collected?.stderr?.readFrom(0)
    if(combined.aborted)throw new Error(signal?.aborted?'执行已暂停':'命令超时，已停止')
    return {exitCode:outcome?.exitCode??null,stdout:String(stdout?.text||''),stderr:String(stderr?.text||''),truncated:stdout?.lossy===true||stderr?.lossy===true}
}
export async function linkyRead(args:string[],workspaceId?:string,profile?:string,timeoutMs=45000){
    const c=readDevelopmentConfig()
    if(!executable(c.cliPath))throw new LinkyError('没有找到可运行的 Linky CLI','missing_cli')
    const argv=[c.cliPath,'--profile',profile||c.profile,...(workspaceId?['--workspace-id',workspaceId]:[]),...args,'--output','json']
    const result=await developmentCommand(argv,homedir(),timeoutMs)
    if(result.exitCode!==0||result.truncated)throw new LinkyError(result.truncated?'Linky 输出超出上限，请缩小查询范围':result.exitCode===4?'Linky 登录已失效，请在客户端重新登录':result.exitCode===5?'当前账号没有访问权限':'Linky 请求失败（退出码 '+result.exitCode+'），请检查网络或稍后重试',result.exitCode===4?'needs_login':'unavailable')
    let value:any
    try{value=JSON.parse(result.stdout)}catch{throw new Error('Linky 没有返回有效 JSON，请检查登录状态和 CLI 版本')}
    if(value?.error||value?.success===false)throw new Error('Linky 拒绝请求，请检查权限、登录状态和工作空间')
    return value
}
export async function detectLinky(){
    const c=readDevelopmentConfig(),found=discoverLinky(),base={cliPath:c.cliPath,profile:c.profile,profiles:[...new Set([c.profile,...found.profiles])],cliPaths:found.cliPaths,installUrl:'https://linky.kingdee.com/home/'}
    if(!executable(c.cliPath))return {...base,status:'missing_cli',message:found.cliPaths.length?'已发现其他 Linky 安装，请在高级设置中选择，保留当前账号配置。':'未检测到 Linky。安装并登录客户端后，工作台会自动识别。'}
    try{return {...base,...await linkyConnection(12000),status:'ready',message:''}}
    catch(error){return {...base,status:error instanceof LinkyError?error.kind:'unavailable',message:String(error.message||error)}}
}
export function linkyRows(value:any,key:string){const rows=Array.isArray(value)?value:value?.[key]||value?.items||value?.data;if(!Array.isArray(rows))throw new Error('Linky 列表结构不兼容，请检查 CLI 版本');return rows}
export async function linkyConnection(timeoutMs=45000){
    const user=await linkyRead(['whoami'],undefined,undefined,timeoutMs),workspaces=await linkyRead(['workspace','list','--include-personal'],undefined,undefined,timeoutMs)
    return {user:{id:user?.id||user?.user?.id||'',name:user?.name||user?.display_name||user?.user?.name||''},workspaces:linkyRows(workspaces,'workspaces').map((w:any)=>({id:w.id,name:w.name}))}
}
export async function linkyIssues(type:string,offset:number,workspaceId?:string){
    const c={...readDevelopmentConfig(),...(workspaceId?{workspaceId}:{})};if(!c.workspaceId)throw new Error('请先选择 Linky 工作空间')
    if(!['requirement','bug','user_story'].includes(type))throw new Error('工作项类型无效')
    const rows=linkyRows(await linkyRead(['issue','list','--assignee','me','--type',type,'--limit','50','--offset',String(Math.max(0,Math.floor(offset/50)*50))],c.workspaceId),'issues')
    return {items:rows.map(row=>issueFromLinky(row,c.workspaceId)),hasMore:rows.length===50,offset}
}
export async function linkyIssue(code:string,workspaceId?:string){
    if(!/^[A-Za-z0-9][\w-]{0,119}$/.test(code))throw new Error('请输入工作项编号或 UUID')
    const c={...readDevelopmentConfig(),...(workspaceId?{workspaceId}:{})},raw=await linkyRead(['issue','show',code,'--full'],c.workspaceId)
    const row=issueFromLinky(raw?.issue||raw,c.workspaceId);if(!row.id)throw new Error('Linky 工作项缺少标识')
    if(c.workspaceId&&row.workspaceId!==c.workspaceId)throw new Error('工作项不属于所选工作空间')
    return row
}

const workItemTypes=DEVELOPMENT_ISSUE_TYPES.map(t=>t.id)
const statusCache=new Map<string,{at:number;items:any[]}>()
export async function linkyWorkItems(request:any){
    const c=readDevelopmentConfig(),workspace=request.workspaceId||c.workspaceId
    if(!workspace)throw new Error('请选择工作空间')
    const key=c.profile+':'+workspace
    let cached=statusCache.get(key)
    if(!cached||Date.now()-cached.at>300000){
        const value=await linkyRead(['issue','statuses','--type',workItemTypes.join(',')],workspace)
        const groups=linkyRows(value,'items'),items=groups.filter((g:any)=>g.workspace_id===workspace&&workItemTypes.includes(g.type_key)).flatMap((g:any)=>(g.statuses||[]).map((s:any)=>({type:g.type_key,key:String(s.key),name:String(s.name),category:String(s.category)})))
        if(!items.length)throw new Error('未读取到工作空间的状态配置，请重试')
        cached={at:Date.now(),items};statusCache.set(key,cached)
    }
    const statuses=cached.items
    if(!['all',...workItemTypes].includes(request.type||'all'))throw new Error('工作项类型无效')
    const status=request.status&&statuses.find(s=>s.type+':'+s.key===request.status)
    if(request.status&&!status)throw new Error('工作项状态无效')
    const types=(request.type&&request.type!=='all'?[request.type]:workItemTypes).filter(t=>!status||status.type===t)
    const pages=await Promise.all(types.map(async type=>{
        const offset=request.cursors?.[type]??0
        if(request.cursors&&request.cursors[type]===null)return {items:[],type,next:null}
        if(!Number.isInteger(offset)||offset<0||offset%50!==0)throw new Error('分页参数无效')
        const closed=statuses.filter(s=>s.type===type&&(s.category==='done'||s.key==='cancelled')).map(s=>s.key)
        const filters=status?['--status',status.key]:request.showCompleted===true?[]:closed.length?['--exclude-status',closed.join(',')]:[]
        const rows=linkyRows(await linkyRead(['issue','list','--assignee','me','--type',type,...filters,'--limit','50','--offset',String(offset)],workspace),'issues')
        return {type,next:rows.length===50?offset+50:null,items:rows.map((row:any)=>{
            const issue=issueFromLinky(row,workspace),rawKey=String(row.status?.key||row.status_key||row.status||'')
            const meta=statuses.find(s=>s.type===type&&(s.key===rawKey||s.name===issue.status))
            return {...issue,type,status:meta?.name||issue.status,statusKey:meta?.key||rawKey,statusCategory:meta?.category||''}
        }).filter((row:any)=>status||request.showCompleted===true||!(row.statusCategory==='done'||row.statusKey==='cancelled'))}
    }))
    return {items:pages.flatMap(p=>p.items),statuses,cursors:Object.fromEntries(pages.map(p=>[p.type,p.next])),hasMore:pages.some(p=>p.next!==null)}
}
