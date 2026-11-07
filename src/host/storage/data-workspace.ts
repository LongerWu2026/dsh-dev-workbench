import {createHash,randomUUID} from 'node:crypto'
import {mkdirSync,readFileSync,writeFileSync,renameSync,statSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {homedir} from 'node:os'
import type {DataConfig} from '../integrations/data-tools.js'
import {sanitizeDataWorkspacePatch,sanitizeDataWorkspaceTurn,DATA_WORKSPACE_LIMITS,type DataWorkspaceEnvelope,type DataWorkspaceSave,type DataWorkspaceClear,type DataWorkspaceAppend} from '../../shared/data-workspace.js'

type Cleared={revision:number;updatedAt:string}
type Document={version:1;targets:Record<string,DataWorkspaceEnvelope>;cleared:Record<string,Cleared>;completed:Record<string,string[]>;last:{id:string;key:string}|null}
type Runtime={owner:symbol;queues:Map<string,Promise<unknown>>}
// The queue survives host hot reload. A replaced module may not submit old work.
const runtime:Runtime=(globalThis as any)[Symbol.for('dev-workbench.data-workspaces.v1')]||={owner:Symbol(),queues:new Map()}
const owner=Symbol('data-workspace-generation');runtime.owner=owner
const storagePath=()=>resolve(process.env.DSH_HOME||join(homedir(),'.dsh'),'storages','dev-workbench','data-workspaces.json')
function queued<T>(action:(path:string)=>T):Promise<T>{
    const path=storagePath()
    const next=(runtime.queues.get(path)||Promise.resolve()).then(()=>{
        if(runtime.owner!==owner)throw Object.assign(Error('数据工作区服务已重载，请重新加载后重试'),{code:'DATA_WORKSPACE_INSTANCE_REPLACED'})
        return action(path)
    })
    runtime.queues.set(path,next.then(()=>{},()=>{}));return next
}
function record(value:any){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype}
function validRevision(value:any){return Number.isSafeInteger(value)&&value>0&&value<Number.MAX_SAFE_INTEGER}
function validTime(value:any){return typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value))}
function workspaceBytes(document:Document,key:string){return Buffer.byteLength(JSON.stringify([document.targets[key].workspace,document.completed[key]||[]]))}
function load(path:string):Document{
    try{
        if(statSync(path).size>DATA_WORKSPACE_LIMITS.workspaceBytes*DATA_WORKSPACE_LIMITS.targets+1024*1024)throw Error('文件容量异常')
        const raw=JSON.parse(readFileSync(path,'utf8'))
        if(!record(raw)||raw.version!==1||!record(raw.targets)||!record(raw.cleared)||!record(raw.completed)||Object.keys(raw.targets).length>DATA_WORKSPACE_LIMITS.targets)throw Error('文件版本或结构无效')
        const document:Document={version:1,targets:{},cleared:{},completed:{},last:null}
        for(const [key,value] of Object.entries(raw.cleared) as [string,any][]){
            if(!/^[a-f0-9]{64}$/.test(key)||!record(value)||!validRevision(value.revision)||!validTime(value.updatedAt))throw Error('清除修订记录无效')
            document.cleared[key]={revision:value.revision,updatedAt:value.updatedAt}
        }
        for(const [key,value] of Object.entries(raw.targets) as [string,any][]){
            if(!/^[a-f0-9]{64}$/.test(key)||!record(value)||value.key!==key||!validRevision(value.revision)||!validTime(value.updatedAt)||value.revision<=Number(document.cleared[key]?.revision||0))throw Error('目标修订记录无效')
            const workspace=sanitizeDataWorkspacePatch(value.workspace),ids=raw.completed[key]||[]
            if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!id||id.length>160)||new Set(ids).size!==ids.length)throw Error('AI去重记录无效')
            document.completed[key]=ids
            document.targets[key]={key,revision:value.revision,workspace,updatedAt:value.updatedAt}
            if(workspaceBytes(document,key)>DATA_WORKSPACE_LIMITS.workspaceBytes)throw Error('工作区容量异常')
        }
        if(raw.last!==null){
            if(!record(raw.last)||typeof raw.last.id!=='string'||!(/^[\w-]{1,80}$/).test(raw.last.id)||!(/^[a-f0-9]{64}$/).test(raw.last.key))throw Error('最后连接记录无效')
            document.last={id:raw.last.id,key:raw.last.key}
        }
        return document
    }catch(error:any){
        if(error.code==='ENOENT')return {version:1,targets:{},cleared:{},completed:{},last:null}
        throw Object.assign(Error('数据工作区读取失败或文件损坏，原文件未改动；请检查本地数据工作区文件后重试'),{code:'DATA_WORKSPACE_READ_FAILED',cause:error})
    }
}
function write(path:string,document:Document){
    if(Object.keys(document.targets).length>DATA_WORKSPACE_LIMITS.targets)throw Error('工作区容量已满，最多30个目标；请先清除不再需要的连接记忆')
    for(const key of Object.keys(document.targets))if(workspaceBytes(document,key)>DATA_WORKSPACE_LIMITS.workspaceBytes)throw Error('工作区容量超过4MiB，保存失败；请缩小内容或清除当前连接记忆')
    try{
        mkdirSync(join(path,'..'),{recursive:true,mode:0o700})
        const temporary=path+'.'+randomUUID()+'.tmp'
        writeFileSync(temporary,JSON.stringify(document),{mode:0o600,flag:'wx'});renameSync(temporary,path)
    }catch(error){throw Object.assign(Error('数据工作区保存失败，未确认的新内容尚未保存；请检查本地文件权限或磁盘空间后重试'),{code:'DATA_WORKSPACE_WRITE_FAILED',cause:error})}
}
export function dataWorkspaceKey(config:DataConfig){
    let target:unknown
    if(config.kind==='es'){
        const url=new URL(config.url)
        if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('工作区连接地址无效')
        target=url.href.replace(/\/$/,'')
    }else target=[config.host.trim().toLowerCase(),config.port||({mysql:3306,postgres:5432,redis:6379} as const)[config.kind]]
    const database=config.kind==='redis'?String(Number(config.database||0)):config.database
    const ca=createHash('sha256').update(config.ca.trim().replace(/\r\n/g,'\n')).digest('hex')
    return createHash('sha256').update(JSON.stringify([config.kind,target,database,config.username,config.tls===true,ca])).digest('hex')
}
function envelope(document:Document,key:string):DataWorkspaceEnvelope{
    const cleared=document.cleared[key]
    return document.targets[key]||{key,revision:cleared?.revision||0,workspace:{},updatedAt:cleared?.updatedAt||null}
}
function checkRequest(key:string,previous:DataWorkspaceEnvelope,request:DataWorkspaceClear){
    if(request?.key!==key)throw Object.assign(Error('连接目标身份已变化，请重新加载当前连接工作区'),{code:'DATA_WORKSPACE_TARGET_CHANGED'})
    if(!Number.isSafeInteger(request.revision)||request.revision!==previous.revision)throw Object.assign(Error('工作区保存冲突：其他窗口或AI回复已更新记录，请重新加载后重试'),{code:'DATA_WORKSPACE_CONFLICT'})
}
export function readDataWorkspace(config:DataConfig){return queued(path=>{
    const document=load(path),key=dataWorkspaceKey(config)
    if(document.last?.id!==config.id||document.last?.key!==key){document.last={id:config.id,key};write(path,document)}
    return envelope(document,key)
})}
export function saveDataWorkspace(config:DataConfig,request:DataWorkspaceSave){return queued(path=>{
    const document=load(path),key=dataWorkspaceKey(config),previous=envelope(document,key)
    checkRequest(key,previous,request)
    const patch=sanitizeDataWorkspacePatch(request.patch)
    if(patch.aiTurns!==undefined&&JSON.stringify(patch.aiTurns)!==JSON.stringify(previous.workspace.aiTurns||[]))throw Object.assign(Error('AI对话保存冲突：普通保存不能替换宿主已完成的对话，请重新加载'),{code:'DATA_WORKSPACE_CONFLICT'})
    const next={key,revision:previous.revision+1,workspace:{...previous.workspace,...patch},updatedAt:new Date().toISOString()}
    document.targets[key]=next;document.last={id:config.id,key};write(path,document);return next
})}
export function clearDataWorkspace(config:DataConfig,request:DataWorkspaceClear){return queued(path=>{
    const document=load(path),key=dataWorkspaceKey(config),previous=envelope(document,key)
    checkRequest(key,previous,request)
    delete document.targets[key];delete document.completed[key]
    document.cleared[key]={revision:previous.revision+1,updatedAt:new Date().toISOString()}
    document.last={id:config.id,key};write(path,document);return envelope(document,key)
})}
export function appendDataWorkspaceTurn(config:DataConfig,request:DataWorkspaceAppend){return queued(path=>{
    const document=load(path),key=dataWorkspaceKey(config),previous=envelope(document,key)
    if(request?.key!==key)throw Object.assign(Error('连接目标身份已变化，AI回复未写入；请重新加载'),{code:'DATA_WORKSPACE_TARGET_CHANGED'})
    if(typeof request.turnId!=='string'||!request.turnId||request.turnId.length>160)throw Error('AI轮次编号无效')
    if(request.baseRevision!==undefined&&(!Number.isSafeInteger(request.baseRevision)||request.baseRevision<0||request.baseRevision<Number(document.cleared[key]?.revision||0)||request.baseRevision>previous.revision))throw Object.assign(Error('工作区已清除或修订冲突，旧AI回复未写入，请重新加载'),{code:'DATA_WORKSPACE_CONFLICT'})
    if(document.completed[key]?.includes(request.turnId))return previous
    const turn=sanitizeDataWorkspaceTurn({...request.turn,id:request.turnId})
    const next={key,revision:previous.revision+1,workspace:{...previous.workspace,aiTurns:[...(previous.workspace.aiTurns||[]),turn].slice(-DATA_WORKSPACE_LIMITS.turns)},updatedAt:new Date().toISOString()}
    // ID-only receipts outlive the 20 visible turns, and count toward the target's 4MiB limit.
    document.completed[key]=[...(document.completed[key]||[]),request.turnId]
    document.targets[key]=next;write(path,document);return next
})}
export function lastDataWorkspaceConnection(){return queued(path=>load(path).last)}
