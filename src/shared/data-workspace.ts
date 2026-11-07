/** Deliberately excludes connection forms, credentials, clients and catalog caches. */
export type DataWorkspaceObject={name:string;schemaName?:string}
export type DataWorkspaceDraft={query:string;explanation?:string;rollback?:string;mode:'query'|'script';schemaHash?:string;at?:string;selected:DataWorkspaceObject[]}
export type DataWorkspaceTurn={id?:string;instruction:string;draft?:DataWorkspaceDraft;clarification?:string}
export type DataWorkspace={
    query?:string;instruction?:string;mode?:'query'|'script';aiTurns?:DataWorkspaceTurn[];
    generated?:DataWorkspaceDraft|null;selected?:DataWorkspaceObject[];pattern?:string;
    connectionsOpen?:boolean;aiOpen?:boolean;pageSize?:50|100|200;pageOffsets?:number[];
    pageIndex?:number;result?:unknown;queriedAt?:string|null;
}
export type DataWorkspaceEnvelope={key:string;revision:number;workspace:DataWorkspace;updatedAt:string|null}
export type DataWorkspaceSave={key:string;revision:number;patch:DataWorkspace}
export type DataWorkspaceClear={key:string;revision:number}
export type DataWorkspaceAppend={key:string;turnId:string;turn:DataWorkspaceTurn;baseRevision?:number}
export const DATA_WORKSPACE_LIMITS={turns:20,resultBytes:1024*1024,workspaceBytes:4*1024*1024,targets:30} as const

function object(value:unknown,label:string):Record<string,any>{
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw Error(label+'格式无效')
    return value as Record<string,any>
}
function text(value:unknown,max:number,label:string){
    if(typeof value!=='string'||value.length>max)throw Error(label+'必须是不超过'+max+'字符的文本')
    return value
}
function integer(value:unknown,label:string){
    if(!Number.isSafeInteger(value)||Number(value)<0)throw Error(label+'必须是非负安全整数')
    return value as number
}
function refs(value:unknown):DataWorkspaceObject[]{
    if(!Array.isArray(value)||value.length>12)throw Error('工作区最多选择12个对象')
    return value.map(raw=>{const item=object(raw,'对象引用');return {name:text(item.name,300,'对象名'),...(item.schemaName!==undefined?{schemaName:text(item.schemaName,300,'数据库名')}:{})}})
}
function draft(value:unknown):DataWorkspaceDraft{
    const raw=object(value,'生成草稿')
    if(!['query','script'].includes(raw.mode))throw Error('生成草稿模式无效')
    const result:DataWorkspaceDraft={query:text(raw.query,50000,'查询'),mode:raw.mode,selected:refs(raw.selected??[])}
    for(const [key,max] of [['explanation',6000],['rollback',20000],['schemaHash',128],['at',40]] as const)if(raw[key]!==undefined)result[key]=text(raw[key],max,key)
    return result
}
export function sanitizeDataWorkspaceTurn(value:unknown):DataWorkspaceTurn{
    const raw=object(value,'AI轮次'),result:DataWorkspaceTurn={instruction:text(raw.instruction,2000,'AI需求')}
    if(raw.id!==undefined)result.id=text(raw.id,160,'AI轮次编号')
    if(raw.draft!==undefined)result.draft=draft(raw.draft)
    if(raw.clarification!==undefined)result.clarification=text(raw.clarification,6000,'AI回复')
    return result
}
function json(value:unknown,depth=0):any{
    if(depth>40)throw Error('结果嵌套超过40层')
    if(value===null||typeof value==='string'||typeof value==='boolean')return value
    if(typeof value==='number'&&Number.isFinite(value))return value
    if(Array.isArray(value))return value.map(item=>json(item,depth+1))
    const raw=object(value,'查询结果'),result:Record<string,unknown>={}
    for(const [key,item] of Object.entries(raw))Object.defineProperty(result,key,{value:json(item,depth+1),enumerable:true})
    return result
}
function snapshot(value:unknown){
    if(value===null)return null
    const raw=object(value,'结果快照'),result:Record<string,unknown>={}
    for(const key of ['kind','rows','columns','result','note','durationMs','pageSize','offset','hasMore','nextOffset','truncated','queriedAt'])if(raw[key]!==undefined)result[key]=json(raw[key])
    if(raw.truncation!==undefined){
        const limits=object(raw.truncation,'截断信息'),truncation:Record<string,boolean>={}
        for(const key of ['rowLimit','byteLimit','cellLimit']){if(typeof limits[key]!=='boolean')throw Error('截断信息无效');truncation[key]=limits[key]}
        result.truncation=truncation
    }
    if(result.rows!==undefined&&(!Array.isArray(result.rows)||result.rows.length>200))throw Error('结果快照最多200行')
    if(result.columns!==undefined&&(!Array.isArray(result.columns)||result.columns.length>1000))throw Error('结果快照列数无效')
    if(new TextEncoder().encode(JSON.stringify(result)).byteLength>DATA_WORKSPACE_LIMITS.resultBytes)throw Error('结果快照超过1MiB，保存失败；请缩小结果或清除快照')
    return result
}
/** Unknown top-level fields and nested draft metadata are intentionally discarded. */
export function sanitizeDataWorkspacePatch(value:unknown):DataWorkspace{
    const raw=object(value,'工作区'),result:DataWorkspace={}
    for(const [key,max] of [['query',50000],['instruction',2000],['pattern',500]] as const)if(raw[key]!==undefined)result[key]=text(raw[key],max,key)
    if(raw.mode!==undefined){if(!['query','script'].includes(raw.mode))throw Error('工作区模式无效');result.mode=raw.mode}
    if(raw.aiTurns!==undefined){if(!Array.isArray(raw.aiTurns)||raw.aiTurns.length>DATA_WORKSPACE_LIMITS.turns)throw Error('工作区最多20轮AI对话');result.aiTurns=raw.aiTurns.map(sanitizeDataWorkspaceTurn)}
    if(raw.generated!==undefined)result.generated=raw.generated===null?null:draft(raw.generated)
    if(raw.selected!==undefined)result.selected=refs(raw.selected)
    for(const key of ['connectionsOpen','aiOpen'] as const)if(raw[key]!==undefined){if(typeof raw[key]!=='boolean')throw Error('面板状态无效');result[key]=raw[key]}
    if(raw.pageSize!==undefined){if(![50,100,200].includes(raw.pageSize))throw Error('分页大小无效');result.pageSize=raw.pageSize}
    if(raw.pageOffsets!==undefined){if(!Array.isArray(raw.pageOffsets)||raw.pageOffsets.length>10000)throw Error('分页偏移记录无效');result.pageOffsets=raw.pageOffsets.map((v:unknown)=>integer(v,'分页偏移'))}
    if(raw.pageIndex!==undefined)result.pageIndex=integer(raw.pageIndex,'页码')
    if(raw.result!==undefined)result.result=snapshot(raw.result)
    if(raw.queriedAt!==undefined){if(raw.queriedAt!==null&&(typeof raw.queriedAt!=='string'||raw.queriedAt.length>40||!Number.isFinite(Date.parse(raw.queriedAt))))throw Error('查询时间无效');result.queriedAt=raw.queriedAt}
    return result
}
