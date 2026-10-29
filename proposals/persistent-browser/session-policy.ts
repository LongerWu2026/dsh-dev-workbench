/**
 * Historical design reference. Actual MAIN implementation lives in host-integration/overlay.
 * The installed app and its Browser permission policy are not changed by this file.
 */
import {createHash} from 'node:crypto'
import {realpathSync} from 'node:fs'
import {isAbsolute} from 'node:path'

const NAMESPACE='dsh-dev-workbench.web-ai'
const PLUGIN='dsh-dev-workbench'
const PROVIDERS=new Set(['kimi','glm','doubao','yuanbao','qianwen','chatgpt'])
export interface TrustedBrowserOwner {
 /** Selected by the host's profile manager, never from the renderer request. */
 profileDirectory:string
 /** Window renderer approved by the host for the registered plugin capability. */
 webContentsId:number
 pluginId:typeof PLUGIN
}
/** Construct only after the host has authorized this plugin in this window/profile. */
export function persistentSessionPolicy(owner:TrustedBrowserOwner){
 if(owner.pluginId!==PLUGIN||!Number.isSafeInteger(owner.webContentsId)||owner.webContentsId<1||!isAbsolute(owner.profileDirectory))throw new Error('Invalid trusted browser owner')
 const canonicalProfile=realpathSync(owner.profileDirectory),sender=owner.webContentsId
 return (senderWebContentsId:number,request:unknown):{partition:string;providerId:string;persistence:'persistent'}=>{
  if(senderWebContentsId!==sender)throw new Error('Browser owner mismatch')
  if(!request||typeof request!=='object'||Array.isArray(request))throw new Error('Invalid browser request')
  const input=request as Record<string,unknown>
  if(Object.keys(input).sort().join(',')!=='namespace,providerId'||input.namespace!==NAMESPACE||typeof input.providerId!=='string'||!PROVIDERS.has(input.providerId))throw new Error('Unsupported browser namespace or provider')
  const identity=JSON.stringify([canonicalProfile,PLUGIN,NAMESPACE,input.providerId,'v1'])
  // No process nonce, conversation ID or renderer-provided path enters persistent identity.
  const key=createHash('sha256').update(identity).digest('hex')
  return {partition:'persist:dsh-workbench-web-ai-v1-'+key,providerId:input.providerId,persistence:'persistent'}
 }
}
