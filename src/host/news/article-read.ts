export const ARTICLE_READ_TIMEOUT_MS=15000
export const ARTICLE_FALLBACK_DELAY_MS=800
type ArticleRead<T>=(signal:AbortSignal)=>Promise<T>

/** Race usable content, not just HTTP responses. A slow/abort-ignoring service
 * must not hold the public-page fallback or double the overall wait. */
export function readArticleWithFallback<T>(primary:ArticleRead<T>,fallback:ArticleRead<T>,options:{timeout?:number;fallbackDelay?:number}={}):Promise<T>{
 return new Promise<T>((resolve,reject)=>{
  const controller=new AbortController(),errors:any[]=[]
  let settled=false,backupStarted=false,remaining=0,backupTimer:ReturnType<typeof setTimeout>,deadline:ReturnType<typeof setTimeout>
  function finish(value:T|undefined,error?:Error){
   if(settled)return;settled=true;clearTimeout(backupTimer);clearTimeout(deadline);controller.abort()
   if(error)reject(error);else resolve(value!)
  }
  function start(read:ArticleRead<T>){
   remaining++
   void Promise.resolve().then(()=>read(controller.signal)).then(value=>finish(value),error=>{
    if(settled)return
    errors.push(error);remaining--
    if(!backupStarted)backup()
    else if(!remaining)finish(undefined,Error(errors.map(error=>String(error?.message||error)).join('；').slice(0,200)))
   })
  }
  function backup(){if(settled||backupStarted)return;backupStarted=true;clearTimeout(backupTimer);start(fallback)}
  backupTimer=setTimeout(backup,options.fallbackDelay??ARTICLE_FALLBACK_DELAY_MS)
  deadline=setTimeout(()=>finish(undefined,Error('原文读取超时，请稍后重试或打开官网')),options.timeout??ARTICLE_READ_TIMEOUT_MS)
  start(primary)
 })
}
