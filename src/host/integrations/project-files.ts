import {constants} from 'node:fs'
import {open,readdir,realpath,stat} from 'node:fs/promises'
import {isAbsolute,join,relative,resolve,sep} from 'node:path'
import {loadWorkbenchState} from '../storage/state-store.js'
import {workbenchContext} from '../application/service-context.js'
import {runReadOnlyCommand} from '../platform/command-runner.js'
import {createHash} from 'node:crypto'
import {searchProjectFiles} from './project-search.js'
import {readProjectWorkspace,updateProjectWorkspace,projectReviewKey,projectReviewState} from '../storage/project-workspace.js'

const PAGE_SIZE=100,PREVIEW_BYTES=256*1024
function reviewed(projectId:string,root:string,path:string,view:'file'|'diff',result:any,changeStatus=''){
    if(view==='diff'&&result.sections?.some((section:any)=>section.unavailable))return result
    const fingerprint=createHash('sha256').update(JSON.stringify([root,path,view,view==='file'?[result.text,result.contentFingerprint]:[result.status,result.previousPath,result.sections,result.contentFingerprint]])).digest('hex')
    let review:any
    try{review=projectReviewState(projectId,root,path,view,fingerprint,changeStatus)}catch(error:any){review={status:'unavailable',reason:error.message}}
    return {...result,fingerprint,review}
}
function inside(root:string,path:string){const rel=relative(root,path);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep))}
function localPath(value:unknown){
    if(value===undefined||value==='')return ''
    if(typeof value!=='string'||value.length>4096||/[\x00\r\n]/.test(value)||isAbsolute(value)||/^[A-Za-z]:|^\\/.test(value)||value.split(/[\\/]/).some(part=>part==='..'||part==='.git'))throw Error('文件路径必须位于当前项目内')
    return value
}
/** Porcelain -z keeps spaces, Unicode, quotes and rename targets unambiguous. */
export function projectChangeEntries(output:string){
    if(output&&!output.endsWith('\0'))throw Error('Git 改动列表不完整，请重新刷新')
    const records=output.split('\0'),entries=[]
    for(let i=0;i<records.length;i++){
        const record=records[i];if(!record)continue
        if(record.length<4||record[2]!==' ')throw Error('Git 改动列表不完整，请重新刷新')
        const status=record.slice(0,2),path=record.slice(3),renamed=/[RC]/.test(status)
        const previousPath=renamed?records[++i]:undefined
        if(renamed&&!previousPath)throw Error('Git 改动列表不完整，请重新刷新')
        entries.push({name:path.split('/').at(-1)||path,path,kind:'file',status,deleted:status.includes('D'),...(previousPath?{previousPath}:{})})
    }
    return entries
}
async function gitChanges(root:string){
    const [result,prefixResult]=await Promise.all([
        runReadOnlyCommand(workbenchContext(),['git','status','--porcelain=v1','-z','--untracked-files=all','--','.'],root),
        runReadOnlyCommand(workbenchContext(),['git','rev-parse','--show-prefix'],root),
    ])
    if(result.status!=='ok')throw Error(result.reason||result.stderr||'无法读取 Git 改动')
    if(prefixResult.status!=='ok')throw Error('无法定位项目在 Git 仓库中的路径')
    if(result.truncated||prefixResult.truncated)throw Error('Git 改动输出超出读取上限，请缩小仓库范围')
    const prefix=prefixResult.stdout.replace(/\r?\n$/,'')
    return projectChangeEntries(result.stdout).filter(row=>row.path.startsWith(prefix)).map(row=>({...row,path:row.path.slice(prefix.length),...(row.previousPath?.startsWith(prefix)?{previousPath:row.previousPath.slice(prefix.length)}:{})}))
}
/** Read-only files, scoped to a registered project; the request never supplies the root. */
export async function projectFiles(request:any={},context:{changes:Map<string,Promise<any[]>>}={changes:new Map()}):Promise<any>{
    const project=loadWorkbenchState().projects.find((row:any)=>row.id===request.projectId)
    if(!project?.repoPath)throw Error('请选择已配置目录的项目')
    const root=await realpath(project.repoPath)
    if(!(await stat(root)).isDirectory())throw Error('项目目录不可用')
    const action=request.action||'list',path=localPath(request.path)
    if(!['list','changes','resolve','read','diff','handoff','workspace','search','reviews','reviewMark','reviewUnmark'].includes(action))throw Error('不支持的文件操作')
    const query=String(request.query||'').slice(0,200).toLocaleLowerCase(),offset=Number(request.offset||0)
    if(!Number.isSafeInteger(offset)||offset<0)throw Error('文件分页参数无效')
    const changes=()=>{let result=context.changes.get(root);if(!result){result=gitChanges(root);context.changes.set(root,result)}return result}
    if(action==='workspace')return {search:readProjectWorkspace(project.id,root).search}
    if(action==='search'){
        const result=await searchProjectFiles(root,request)
        updateProjectWorkspace(project.id,root,value=>{value.search={query:result.query,caseSensitive:result.caseSensitive,history:[result.query,...value.search.history.filter(row=>row!==result.query)].slice(0,10)}})
        return {...result,projectId:project.id}
    }
    if(action==='reviewMark'||action==='reviewUnmark'){
        if(!path||!['file','diff'].includes(request.view))throw Error('请选择要标记的文件或差异')
        const view=request.view as 'file'|'diff',changeStatus=view==='diff'?String(request.changeStatus||''):''
        const key=projectReviewKey(path,view,changeStatus)
        if(action==='reviewUnmark'){updateProjectWorkspace(project.id,root,value=>{delete value.reviews[key]});return {status:'pending'}}
        if(typeof request.fingerprint!=='string'||!(/^[a-f0-9]{64}$/).test(request.fingerprint))throw Error('请先读取文件内容，再标记已审阅')
        const current=await projectFiles({projectId:project.id,path,action:view==='diff'?'diff':'read',changeStatus},context)
        if(!current.fingerprint||current.fingerprint!==request.fingerprint)throw Error('文件内容已变化，请重新读取并审阅后再标记')
        const at=new Date().toISOString()
        updateProjectWorkspace(project.id,root,value=>{value.reviews[key]={path,view,...(changeStatus?{changeStatus}:{}),fingerprint:current.fingerprint,at}})
        return {status:'reviewed',reviewedAt:at}
    }
    if(action==='reviews'){
        const workspace=readProjectWorkspace(project.id,root),candidates=new Map<string,any>()
        let changeError=''
        try{
            const entries=await changes(),counts=new Map<string,number>();for(const entry of entries)counts.set(entry.path,(counts.get(entry.path)||0)+1)
            for(const entry of entries){const key=projectReviewKey(entry.path,'diff',entry.status),previous=counts.get(entry.path)===1?Object.values(workspace.reviews).filter(record=>record.path===entry.path&&record.view==='diff').sort((a,b)=>b.at.localeCompare(a.at))[0]:undefined;candidates.set(key,{path:entry.path,view:'diff',changeStatus:entry.status,record:workspace.reviews[key]||previous,active:true})}
        }
        catch(error:any){changeError=error.message||String(error)}
        for(const [key,record] of Object.entries(workspace.reviews))if(!candidates.has(key)&&!(record.view==='diff'&&[...candidates.values()].some(row=>row.path===record.path&&row.view==='diff')))candidates.set(key,{...record,record,active:record.view==='file'||!!changeError})
        const rows=[...candidates.values()],deadline=Date.now()+5000;let cursor=0
        await Promise.all(Array.from({length:4},async()=>{
            while(cursor<rows.length){
                const row=rows[cursor++]
                if(!row.active){row.status='inactive';continue}
                if(!row.record){row.status='pending';continue}
                if(Date.now()>deadline){row.status='unverified';continue}
                try{const current=await projectFiles({projectId:project.id,path:row.path,action:row.view==='diff'?'diff':'read',changeStatus:row.changeStatus},context);row.status=current.fingerprint===row.record.fingerprint?'reviewed':'stale';row.reason=current.fingerprint?'':current.sections?.find((section:any)=>section.unavailable)?.unavailable}
                catch(error:any){row.status='stale';row.reason=error.message||String(error)}
            }
        }))
        const summary={total:rows.length,reviewed:0,pending:0,stale:0,inactive:0,unverified:0}
        for(const row of rows)(summary as any)[row.status]++
        const rank:any={stale:0,pending:1,unverified:2,reviewed:3,inactive:4}
        rows.sort((a,b)=>rank[a.status]-rank[b.status]||a.path.localeCompare(b.path))
        const filtered=rows.filter(row=>!request.filter||request.filter==='all'||row.status===request.filter)
        return {projectId:project.id,summary,total:filtered.length,offset,hasMore:offset+20<filtered.length,changeError,entries:filtered.slice(offset,offset+20).map(({record,...row})=>({...row,reviewedAt:record?.at}))}
    }
    if(action==='changes'||action==='handoff'||action==='diff'){
        const all=await changes()
        if(action==='handoff')return {projectId:project.id,projectName:project.name,root,at:new Date().toISOString(),entries:all,total:all.length}
        if(action==='diff'){
            const entry=all.find(row=>row.path===path&&(!request.changeStatus||row.status===request.changeStatus))
            if(!entry)throw Error('该文件已无未提交改动，请刷新改动列表')
            const meta={projectId:project.id,projectName:project.name,root,path,status:entry.status,previousPath:entry.previousPath,at:new Date().toISOString()}
            if(entry.status==='??'){
                try{const file=await projectFiles({projectId:project.id,path,action:'read'},context);return reviewed(project.id,root,path,'diff',{...meta,contentFingerprint:file.fingerprint,sections:[{id:'untracked',label:'新增文件内容（未跟踪）',text:file.text}]},entry.status)}
                catch(error:any){return {...meta,sections:[{id:'untracked',label:'新增文件内容（未跟踪）',unavailable:error.message||String(error)}]}}
            }
            const paths=[path]
            if(entry.previousPath){try{localPath(entry.previousPath);paths.push(entry.previousPath)}catch{/* Keep a rename into this project scoped to the new path. */}}
            const sections=await Promise.all(['staged','unstaged'].map(async id=>{
                const result=await runReadOnlyCommand(workbenchContext(),['git','--literal-pathspecs','diff','--no-ext-diff','--no-textconv','--no-color','--full-index','--relative',...(id==='staged'?['--cached']:[]),'--',...paths],root)
                if(result.status!=='ok')throw Error(result.reason||result.stderr||'无法读取代码差异')
                if(result.truncated)throw Error('差异超过读取上限，请在 IDE 中查看完整变更')
                return {id,label:id==='staged'?'已暂存':'未暂存',text:result.stdout}
            }))
            return reviewed(project.id,root,path,'diff',{...meta,sections},entry.status)
        }
        const entries=all.filter(row=>!query||row.path.toLocaleLowerCase().includes(query))
        return {projectId:project.id,root,path:'',entries:entries.slice(offset,offset+PAGE_SIZE),total:entries.length,changed:all.length,offset,hasMore:offset+PAGE_SIZE<entries.length}
    }
    const candidate=resolve(root,path)
    if(!inside(root,candidate))throw Error('文件路径必须位于当前项目内')
    const target=await realpath(candidate)
    if(!inside(root,target)||relative(root,target).split(sep).includes('.git'))throw Error('文件链接指向当前项目以外或 Git 内部目录')
    if(action==='list'){
        const rows=await readdir(target,{withFileTypes:true})
        const entries=rows.filter(row=>row.name!=='.git'&&(!query||row.name.toLocaleLowerCase().includes(query)))
            .map(row=>({name:row.name,path:join(path,row.name).split(sep).join('/'),kind:row.isDirectory()?'directory':row.isSymbolicLink()?'link':row.isFile()?'file':'other'}))
            .sort((a,b)=>Number(b.kind==='directory')-Number(a.kind==='directory')||a.name.localeCompare(b.name,'zh-CN'))
        return {projectId:project.id,root,path,entries:entries.slice(offset,offset+PAGE_SIZE),total:entries.length,offset,hasMore:offset+PAGE_SIZE<entries.length}
    }
    const handle=await open(target,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK)
    try{
        const info=await handle.stat()
        if(info.isDirectory()&&action==='resolve')return {projectId:project.id,path,absolutePath:target,kind:'directory'}
        if(!info.isFile())throw Error('此条目不是普通文件')
        const meta={projectId:project.id,path,absolutePath:target,kind:'file',bytes:info.size}
        if(action==='resolve')return meta
        const buffer=Buffer.alloc(Math.min(info.size,PREVIEW_BYTES)+1),result=await handle.read(buffer,0,buffer.length,0)
        if(info.size>PREVIEW_BYTES||result.bytesRead>PREVIEW_BYTES)throw Error('文件超过 256 KB，请使用 IDE 查看')
        const bytes=buffer.subarray(0,result.bytesRead)
        if(bytes.includes(0))throw Error('此文件为二进制格式，当前侧栏仅支持文本预览，请使用对应应用查看')
        let text:string
        try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw Error('此文件不是 UTF-8 文本，请使用 IDE 查看')}
        return reviewed(project.id,root,path,'file',{...meta,text,contentFingerprint:createHash('sha256').update(bytes).digest('hex')})
    }finally{await handle.close()}
}
