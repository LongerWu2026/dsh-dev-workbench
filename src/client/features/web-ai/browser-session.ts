import {webAIProvider} from '../../../shared/web-ai.js'

export interface BrowserLease {lease:string;partition:string}
/** Existing public Harness Browser API. */
export interface BrowserBridge {
 acquire(scope:string):Promise<BrowserLease>
 release(lease:string):Promise<void>
 onOpenRequested(lease:string,fn:(url:string)=>void):()=>void
 /** Local host extension implemented in host-integration; unmodified stock Harness does not supply it. */
 persistence?:PersistentBrowserBridge
}
export const WEB_AI_BROWSER_NAMESPACE='dsh-dev-workbench.web-ai' as const
export interface PersistentBrowserBridge {
 readonly protocolVersion:1
 acquire(request:{namespace:typeof WEB_AI_BROWSER_NAMESPACE;providerId:string}):Promise<BrowserLease&{persistence:'persistent';providerId:string}>
}
export type BrowserSessionMode='unavailable'|'memory'|'persistent'
export function nativeWebAIBridge():BrowserBridge|null {
 const desktop=(globalThis as any).dshDesktop,b=desktop?.protocolVersion===1?desktop.browser:null
 return b&&typeof b.acquire==='function'&&typeof b.release==='function'&&typeof b.onOpenRequested==='function'?b:null
}
export function browserSessionMode(bridge:BrowserBridge|null):BrowserSessionMode {
 if(!bridge)return 'unavailable'
 return bridge.persistence?.protocolVersion===1&&typeof bridge.persistence.acquire==='function'?'persistent':'memory'
}
export function browserSessionMessage(mode:BrowserSessionMode,acquired=false):string {
 if(mode==='unavailable')return '当前环境不支持内嵌官网。请在支持内嵌网页的 Harness 桌面端使用。'
 if(mode==='memory')return '当前宿主仅在本次运行保留登录；完整退出后需要重新登录。跨重启保留需宿主提供持久化分区。'
 return acquired?'已使用内嵌持久化分区；登录是否有效由官网确认，过期时请在此重新登录。':'宿主提供持久化分区，打开官网后使用；实际登录恢复仍需官网验证。'
}
/** Never manufacture a persist: partition, read credentials, or fall back after a persistent acquisition fails. */
export async function acquireWebsiteSession(bridge:BrowserBridge,scope:string,providerId:string):Promise<BrowserLease&{mode:Exclude<BrowserSessionMode,'unavailable'>}> {
 webAIProvider(providerId)
 if(!/^[\w:-]{1,160}$/.test(scope))throw new Error('内嵌网页存储范围无效')
 const persistent=browserSessionMode(bridge)==='persistent'
 const reservation=persistent
  ?await bridge.persistence!.acquire({namespace:WEB_AI_BROWSER_NAMESPACE,providerId})
  :await bridge.acquire(scope+':'+providerId)
 const valid=reservation&&typeof reservation.lease==='string'&&reservation.lease.length>0&&reservation.lease.length<=200&&typeof reservation.partition==='string'&&reservation.partition.length>0&&reservation.partition.length<=200
 const matching=persistent
  ?reservation&&'persistence' in reservation&&reservation.persistence==='persistent'&&'providerId' in reservation&&reservation.providerId===providerId&&/^persist:[\w-]+$/.test(reservation.partition)
  :valid&&!reservation.partition.startsWith('persist:')
 if(!valid||!matching){
  if(reservation&&typeof reservation.lease==='string'&&reservation.lease)await bridge.release(reservation.lease).catch(()=>{})
  throw new Error('宿主返回的内嵌存储能力不匹配，未创建官网页面')
 }
 return {...reservation,mode:persistent?'persistent':'memory'}
}
