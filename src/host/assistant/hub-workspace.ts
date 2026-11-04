import {realpathSync,statSync} from 'node:fs'
import {basename,isAbsolute} from 'node:path'
import {loadWorkbenchState} from '../storage/state-store.js'
import {readDevelopmentTask} from '../storage/development-store.js'
import {cwdForHostCommands} from '../integrations/environment.js'
import {hostService} from './sessions.js'

export interface HubWorkspaceBinding {
 workspaceId?:string;workspaceTitle?:string;cwd?:string
 workspaceState:'bound'|'unbound'|'pending'|'unavailable';workspaceError?:string
}
function canonical(path:string){
 if(typeof path!=='string'||!path||!isAbsolute(path))throw Error('已配置的工作目录必须是完整本地路径')
 const resolved=realpathSync(path);if(!statSync(resolved).isDirectory())throw Error('已配置的工作目录不是目录')
 return resolved
}
function nativeCwd(session:any){return typeof session?.header?.cwd==='string'?session.header.cwd:typeof session?.cwd==='string'?session.cwd:undefined}
function registryRows(ctx:any):any[]{const registry=hostService(ctx,'workspaceRegistry');return typeof registry?.list==='function'?registry.list():[]}
function member(ctx:any,sessionId?:string){return sessionId?registryRows(ctx).find(row=>Array.isArray(row.sessionIds)&&row.sessionIds.includes(sessionId)):undefined}
function view(workspace:any):HubWorkspaceBinding{return {workspaceState:'bound',workspaceId:String(workspace.id),workspaceTitle:String(workspace.title||basename(workspace.path)),cwd:String(workspace.path)}}

/** Only saved business relationships can select a project. Request paths are ignored. */
function configuredDirectory(conversation:any,state:any,developmentTask?:any){
 const kind=String(conversation?.kind||conversation?.id?.split(':')[0]||''),entityId=conversation?.entityId||String(conversation?.id||'').slice(kind.length+1)
 if(kind==='development')return (developmentTask||readDevelopmentTask(entityId)).cwd
 let projectId:string|undefined
 if(kind==='task')projectId=state.tasks.find((row:any)=>row.id===entityId)?.projectId
 if(kind==='reply'){
  const reply=state.replies.find((row:any)=>row.id===entityId),source=state.sources.find((row:any)=>row.id===reply?.sourceId)
  projectId=source?.projectId
  if(!projectId){const projects=new Set<string>((reply?.taskIds||[]).map((id:string)=>state.tasks.find((row:any)=>row.id===id)?.projectId).filter(Boolean));if(projects.size===1)projectId=[...projects][0]}
 }
 if(!projectId)return undefined
 const project=state.projects.find((row:any)=>row.id===projectId)
 if(!project)throw Error('事项绑定的项目已不存在，请先确认项目目录')
 return project.repoPath||undefined
}

/** Cold membership is read-only; loaded sessions must agree with their persisted group. */
export function readHubWorkspace(ctx:any,conversation:any,sessionId?:string,state=loadWorkbenchState(),loadedSession?:any,developmentTask?:any):HubWorkspaceBinding {
 let known:HubWorkspaceBinding|undefined
 try{
  const workspace=member(ctx,sessionId),session=loadedSession||(sessionId?hostService(ctx,'sessions')?.get?.(sessionId):undefined),cwd=nativeCwd(session)
  if(workspace)known=view(workspace)
  const configured=configuredDirectory(conversation,state,developmentTask)
  if(workspace){
   known=view(workspace);const path=canonical(workspace.path)
   if(session&&(!cwd||canonical(cwd)!==path))return {...known,workspaceState:'unavailable',workspaceError:'原会话运行目录与登记工作区不同或无法确认，已保留原会话及归组；请核对绑定后继续'}
   if(configured&&canonical(configured)!==path)return {...known,workspaceState:'unavailable',workspaceError:'原会话工作区与事项项目目录不同，已保留原会话及归组；请核对绑定后继续'}
   return known
  }
  if(configured){
   const path=canonical(configured)
   if(typeof hostService(ctx,'workspaceRegistry')?.create!=='function')return {workspaceState:'unavailable',cwd:path,workspaceTitle:basename(path),workspaceError:'当前宿主没有 Harness 工作区服务，无法继续此事项会话'}
   if(cwd&&canonical(cwd)!==path)return {workspaceState:'unavailable',cwd,workspaceError:'原会话目录与事项项目目录不同，已保留原会话；请核对绑定后继续'}
   if(session&&!cwd)return {workspaceState:'unavailable',cwd:path,workspaceError:'无法确认原会话运行目录，已保留原会话；请核对绑定后继续'}
   return {workspaceState:'pending',cwd:path,workspaceTitle:basename(path)}
  }
  return {workspaceState:'unbound',...(cwd?{cwd}:{})}
 }catch(error){return {...known,workspaceState:'unavailable',workspaceError:String((error as Error).message)}}
}

async function workspaceFor(ctx:any,cwd:string){
 const registry=hostService(ctx,'workspaceRegistry')
 if(typeof registry?.create!=='function')throw Error('当前宿主没有 Harness 工作区服务，未创建未分组会话')
 const path=canonical(cwd),workspace=await registry.create(path)
 if(!workspace?.id||workspace.path!==path||typeof workspace.attachSession!=='function')throw Error('Harness 工作区未正确绑定事项目录，已停止创建会话')
 return workspace
}

/** On explicit send only: repair membership, never change the original session cwd. */
export async function ensureHubWorkspace(ctx:any,conversation:any,session:any):Promise<HubWorkspaceBinding>{
 const current=readHubWorkspace(ctx,conversation,session?.id,loadWorkbenchState(),session)
 if(current.workspaceState==='unavailable')throw Error(current.workspaceError)
 if(current.workspaceState==='bound')return current
 const configured=configuredDirectory(conversation,loadWorkbenchState())
 if(!configured)return current
 const expected=canonical(configured),actual=nativeCwd(session)
 if(!actual||canonical(actual)!==expected)throw Error('原会话目录与事项项目目录不同或无法确认，已保留原会话；请核对绑定后继续，未新建会话')
 const workspace=await workspaceFor(ctx,expected)
 if(!workspace.sessionIds?.includes(session.id))await workspace.attachSession(session.id)
 return view(workspace)
}

/** Preserve an allocated native id even when attachment or restoration fails. */
export async function createHubWorkspaceSession(ctx:any,conversation:any,onCreated:(id:string)=>void){
 const configured=configuredDirectory(conversation,loadWorkbenchState())
 const workspace=configured?await workspaceFor(ctx,configured):undefined,controller=hostService(ctx,'sessionController'),create=typeof controller?.createSession==='function'?controller.createSession:controller?.create
 if(typeof create!=='function')throw Error('宿主没有持久会话创建入口')
 let value:any
 try{value=await create.call(controller,workspace?{workspaceId:workspace.id}:{cwd:cwdForHostCommands(ctx)})}
 catch(error){if(error?.code==='session/workspace-attach-failed'&&typeof error.details?.sessionId==='string')onCreated(error.details.sessionId);throw error}
 let session=value?.agent?.session||value?.session||value?.agentSession||(value?.id?value:undefined)
 const id=session?.id||value?.sessionId;if(typeof id!=='string'||!id)throw Error('创建 Harness 会话没有返回会话标识')
 onCreated(id)
 if(!session)session=hostService(ctx,'sessions')?.get?.(id)
 if(!session&&typeof controller.resolveAgent==='function'){const restored=await controller.resolveAgent(id);if(restored?.error)throw restored.error;session=hostService(ctx,'sessions')?.get?.(id)||restored?.agent?.session}
 if(!session||session.id!==id)throw Error('已保存新建的 Harness 会话标识，但暂时无法读取会话；请重试恢复原会话')
 return session
}
