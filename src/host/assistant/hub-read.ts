/** Read deadlines do not stop a native run or discard its eventual restoration.
 * A stuck cold session cannot hold a directory/detail response indefinitely. */
export const HUB_READ_TIMEOUT_MS=2000
export function withHubReadDeadline<T>(read:Promise<T>,timeout=HUB_READ_TIMEOUT_MS):Promise<T>{
 let timer:ReturnType<typeof setTimeout>
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('该会话历史仍在读取，其他记录已先显示，稍后将自动刷新。'),{code:'assistant_history_pending'})),timeout)})
 return Promise.race([read,deadline]).finally(()=>clearTimeout(timer))
}
const pendingRestores=new WeakMap<object,Map<string,Promise<any>>>()
export function readHubSession(ctx:object,id:string,restore:()=>Promise<any>){
 let pending=pendingRestores.get(ctx)
 if(!pending){pending=new Map();pendingRestores.set(ctx,pending)}
 let read=pending.get(id)
 if(!read){
  read=Promise.resolve().then(restore);pending.set(id,read)
  const done=()=>{if(pending!.get(id)===read)pending!.delete(id)}
  void read.then(done,done)
 }
 return withHubReadDeadline(read)
}
