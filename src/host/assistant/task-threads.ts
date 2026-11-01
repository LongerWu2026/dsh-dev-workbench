import {existsSync,mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs'
import {join} from 'node:path'
import {workbenchDir} from '../platform/runtime.js'

export interface TaskThread {id:string;title:string;createdAt:string;lastAt:string}
export interface TaskThreads {taskId:string;activeId:string;threads:TaskThread[]}
const path=()=>join(workbenchDir(),'assistant-task-threads.json')
/** Local session identities are kept outside portable business-data exports. */
export function taskThreads():TaskThreads[]{
    if(!existsSync(path()))return []
    const value=JSON.parse(readFileSync(path(),'utf8'))
    if(value.version!==1||!Array.isArray(value.tasks))throw new Error('待办会话索引无法读取，已保留原文件，请检查本地存储')
    return value.tasks
}
export function taskThreadOwner(id:string):string|undefined{return taskThreads().find(row=>row.threads.some(thread=>thread.id===id))?.taskId}
export function rememberTaskThread(taskId:string,id:string,title?:string){
    const rows=taskThreads(),at=new Date().toISOString();let row=rows.find(row=>row.taskId===taskId)
    if(!row){row={taskId,activeId:id,threads:[]};rows.push(row)}
    const owner=rows.find(row=>row.taskId!==taskId&&row.threads.some(thread=>thread.id===id))
    if(owner)throw new Error('该会话属于另一条待办，不能混用')
    let thread=row.threads.find(thread=>thread.id===id)
    if(!thread){thread={id,title:title||'新会话',createdAt:at,lastAt:at};row.threads.push(thread)}
    if(title)thread.title=title;thread.lastAt=at;row.activeId=id
    mkdirSync(workbenchDir(),{recursive:true});const temp=path()+'.'+process.pid+'.tmp'
    writeFileSync(temp,JSON.stringify({version:1,tasks:rows},null,2),{mode:0o600});renameSync(temp,path())
}
