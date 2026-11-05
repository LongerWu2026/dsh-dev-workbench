import {WB,wbConnection} from './runtime.js'

// Memory only, scoped to the actual Host connection and knowledge scope. Page
// navigation must not throw away an already-readable directory. Never reuse it
// for another connection, and never use a cached binding to authorize a send.
const directories=new WeakMap<object,Map<string,any[]>>()
export function cachedAssistantDirectory(scope:any={}):any[]|undefined {
 return wbConnection&&directories.get(wbConnection)?.get(JSON.stringify(scope))
}
export function rememberAssistantDirectory(scope:any,rows:any[],connection:object){
 if(!connection||connection!==wbConnection)return
 let cache=directories.get(wbConnection)
 if(!cache){cache=new Map();directories.set(wbConnection,cache)}
 const key=JSON.stringify(scope||{});cache.delete(key);cache.set(key,rows)
 while(cache.size>8)cache.delete(cache.keys().next().value!)
}
export function updateAssistantDirectories(update:(rows:any[])=>any[]){
 const cache=wbConnection&&directories.get(wbConnection)
 if(cache)for(const [key,rows] of cache)cache.set(key,update(rows))
}

/** Only read requests may time out/retry. Never resubmit a mutation or prompt. */
export async function readAssistantHub(request:any,signal?:AbortSignal){
 if(!['list','detail','history','delta','availableSessions'].includes(request.action))throw new Error('仅支持读取助手记录')
 if(signal?.aborted)throw new Error('已停止读取')
 const controller=new AbortController()
 let timer:ReturnType<typeof setTimeout>|undefined,abort:()=>void=()=>{}
 const stopped=new Promise<never>((_,reject)=>{
  abort=()=>{controller.abort();reject(new Error('已停止读取'))}
  if(signal?.aborted)abort()
  else signal?.addEventListener('abort',abort,{once:true})
  timer=setTimeout(()=>{controller.abort();reject(Object.assign(new Error(request.action==='list'?'会话列表读取较慢，正在自动重试；已显示的会话仍可打开。':'当前会话读取较慢，请稍后重试或切换其他会话。'),{code:'assistant_read_timeout'}))},10000)
 })
 try{return await Promise.race([stopped,WB.actions.assistantHub(request,controller.signal)])}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
