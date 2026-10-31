import type {WebAIAuthentication,WebAIAuthenticationStatus} from '../../../shared/web-ai-auth.js'

const NOTES:Record<WebAIAuthenticationStatus,string>={
 authenticated:'已识别官网账号入口；登录有效期由官网决定。',
 needs_login:'官网需要登录，请在下方页面完成登录。',
 verification:'官网需要安全验证，请在下方页面完成验证后重试。',
 unknown:'暂未确认登录状态，可在官网核对后重新检查。',
}
/** Only fixed status text crosses into the workbench; no page identity or arbitrary strings. */
export function authenticationSummary(value:unknown):WebAIAuthentication {
 const candidate=(value as any)?.status
 const status:WebAIAuthenticationStatus=typeof candidate==='string'&&Object.prototype.hasOwnProperty.call(NOTES,candidate)?candidate as WebAIAuthenticationStatus:'unknown'
 const evidence=Array.isArray((value as any)?.evidence)?(value as any).evidence.filter((item:unknown)=>typeof item==='string'&&/^Kimi检查:(?:导航|历史|头像|升级)=[01]$/.test(item)).slice(0,4):[]
 return {status,note:NOTES[status],evidence}
}
export const AUTHENTICATION_LABEL:Record<WebAIAuthenticationStatus,string>={authenticated:'已识别登录',needs_login:'需要登录',verification:'需要验证',unknown:'登录待确认'}
