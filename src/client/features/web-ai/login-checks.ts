import {authenticationSummary} from './authentication.js'
import type {WebAIAuthentication} from '../../../shared/web-ai-auth.js'

/** One provider cannot keep the menu busy or hold up other providers indefinitely. */
export async function checkWebsiteLogin(getController:()=>Promise<{authentication?:()=>Promise<unknown>}>,options:{timeoutMs?:number;intervalMs?:number;active?:()=>boolean}={}):Promise<WebAIAuthentication>{
 const timeout=options.timeoutMs??12000,interval=options.intervalMs??1000,active=options.active||(()=>true),deadline=Date.now()+timeout
 let expired=false,timer:ReturnType<typeof setTimeout>|undefined
 const unknown=()=>authenticationSummary(null)
 const work=async()=>{
  try{
   const controller=await getController()
   while(!expired&&active()&&Date.now()<deadline){
    const result=authenticationSummary(await controller.authentication?.())
    if(expired||!active())return unknown()
    if(result.status!=='unknown')return result
    const remaining=deadline-Date.now();if(remaining<=0)break
    await new Promise(resolve=>setTimeout(resolve,Math.min(interval,remaining)))
   }
  }catch{ /* An unavailable page is unknown, not logged out. */ }
  return unknown()
 }
 try{return await Promise.race([work(),new Promise<WebAIAuthentication>(resolve=>{timer=setTimeout(()=>{expired=true;resolve(unknown())},timeout)})])}
 finally{expired=true;clearTimeout(timer)}
}
