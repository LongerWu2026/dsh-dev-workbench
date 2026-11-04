import {WB} from './runtime.js'

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
