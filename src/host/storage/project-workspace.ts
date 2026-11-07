import {createHash,randomUUID} from 'node:crypto'
import {mkdirSync,readFileSync,writeFileSync,renameSync,rmSync,statSync} from 'node:fs'
import {join} from 'node:path'
import {workbenchDir} from '../platform/runtime.js'

export type ProjectReviewRecord={path:string;view:'file'|'diff';changeStatus?:string;fingerprint:string;at:string}
type Workspace={version:1;projectId:string;root:string;search:{query:string;caseSensitive:boolean;history:string[]};reviews:Record<string,ProjectReviewRecord>}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex')
export const projectReviewKey=(path:string,view:string,changeStatus='')=>hash(JSON.stringify([path,view,changeStatus]))
const fileOf=(projectId:string,root:string)=>join(workbenchDir(),'project-workspaces',hash(JSON.stringify([projectId,root]))+'.json')
export function readProjectWorkspace(projectId:string,root:string):Workspace {
    const empty:Workspace={version:1,projectId,root,search:{query:'',caseSensitive:false,history:[]},reviews:{}}
    const file=fileOf(projectId,root)
    try{
        if(statSync(file).size>2*1024*1024)throw Error('项目记录超过读取上限')
        const value=JSON.parse(readFileSync(file,'utf8'))
        if(value.version!==1||value.projectId!==projectId||value.root!==root||!value.search||typeof value.search.query!=='string'||!Array.isArray(value.search.history)||!value.reviews||Array.isArray(value.reviews)||typeof value.reviews!=='object')throw Error('项目记录格式无效')
        return value
    }catch(error:any){if(error.code==='ENOENT')return empty;throw Error('项目记录读取失败：'+error.message)}
}
export function updateProjectWorkspace(projectId:string,root:string,update:(value:Workspace)=>void):Workspace {
    const value=readProjectWorkspace(projectId,root);update(value)
    if(Object.keys(value.reviews).length>1000)throw Error('每个项目最多保存 1000 条审阅记录，请先取消不再需要的标记')
    const serialized=JSON.stringify(value)
    if(Buffer.byteLength(serialized)>2*1024*1024)throw Error('项目记录超过保存上限，请减少审阅标记')
    const directory=join(workbenchDir(),'project-workspaces'),file=fileOf(projectId,root),temporary=file+'.'+randomUUID()+'.tmp'
    mkdirSync(directory,{recursive:true,mode:0o700})
    try{writeFileSync(temporary,serialized,{mode:0o600,flag:'wx'});renameSync(temporary,file)}
    finally{rmSync(temporary,{force:true})}
    return value
}
export function projectReviewState(projectId:string,root:string,path:string,view:'file'|'diff',fingerprint:string,changeStatus=''){
    const record=readProjectWorkspace(projectId,root).reviews[projectReviewKey(path,view,changeStatus)]
    return {status:record?(record.fingerprint===fingerprint?'reviewed':'stale'):'pending',reviewedAt:record?.at}
}
