import {realpathSync} from 'node:fs'
import type {DevelopmentTask} from '../../shared/development.js'
import {workbenchContext} from './service-context.js'

/** The native registry owns directory identity, deduplication, titles and membership. */
async function workspaceFor(cwd:string){
    const registry=workbenchContext()?.get?.('workspaceRegistry')
    if(typeof registry?.create!=='function')throw new Error('当前宿主没有 Harness 工作区服务，请更新宿主后重试；未创建未分组会话')
    const path=realpathSync(cwd),workspace=await registry.create(path)
    if(!workspace?.id||workspace.path!==path||typeof workspace.attachSession!=='function')throw new Error('Harness 工作区未正确绑定开发目录，已停止创建会话')
    return workspace
}

/** Register old task sessions without replacing their logs or starting a model turn. */
export async function bindDevelopmentWorkspace(row:DevelopmentTask){
    const workspace=await workspaceFor(row.cwd)
    for(const id of [row.sessionId,row.reviewSessionId].filter(Boolean)){
        if(!workspace.sessionIds?.includes(id))await workspace.attachSession(id)
    }
    return {id:String(workspace.id),title:String(workspace.title),path:String(workspace.path)}
}

export async function createDevelopmentSession(cwd:string,title:string,onCreated:(id:string)=>void){
    const workspace=await workspaceFor(cwd),c=workbenchContext()?.get?.('sessionController'),create=c?.createSession||c?.create
    if(!create)throw new Error('宿主没有持久会话创建入口')
    let value:any
    try{
        // workspaceId and cwd are mutually exclusive. No sessionId: each task/review
        // gets its own conversation even when another blank session exists here.
        value=await create.call(c,{workspaceId:workspace.id})
    }catch(error){
        // Native creation may succeed before attachment fails. Retain that identity
        // so a retry repairs membership instead of allocating another orphan log.
        if(error?.code==='session/workspace-attach-failed'&&typeof error.details?.sessionId==='string')onCreated(error.details.sessionId)
        throw error
    }
    const session=value?.agent?.session||value?.session||value?.agentSession||(value?.id?value:null),id=session?.id||value?.sessionId
    if(!id)throw new Error('创建 Harness 会话没有返回会话标识')
    onCreated(String(id))
    if(c.rename)try{await c.rename({sessionId:id,title})}catch{/* Keep the persisted identity even when naming is unavailable. */}
    return String(id)
}
