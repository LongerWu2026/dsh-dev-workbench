import {lookup} from 'node:dns/promises'
import {request as httpRequest} from 'node:http'
import {request as httpsRequest} from 'node:https'
import {isIP} from 'node:net'

export function publicArticleAddress(address:string):boolean{
 if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return a>0&&a<224&&a!==10&&a!==127&&!(a===169&&b===254)&&!(a===172&&b>=16&&b<=31)&&!(a===192&&[0,168].includes(b))&&!(a===100&&b>=64&&b<=127)&&!(a===198&&[18,19].includes(b))}
 return isIP(address)===6&&/^[23][0-9a-f]{3}:/i.test(address)&&!/^2002:/i.test(address)
}
/** Public pages only. Every redirect is revalidated; socket DNS is pinned to the checked address. */
export async function fetchPublicArticle(value:string,signal=AbortSignal.timeout(15000)){
 let url=new URL(value)
 for(let redirects=0;redirects<=4;redirects++){
  signal.throwIfAborted()
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port&&!['80','443'].includes(url.port))throw Error('只支持公开 HTTP/HTTPS 网页')
  const host=url.hostname.replace(/^\[|\]$/g,'')
  if(host==='localhost'||/\.(?:local|localhost|internal)$/i.test(host))throw Error('不读取本机或内网网页')
  const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await lookup(host,{all:true})
  if(!addresses.length||addresses.some(row=>!publicArticleAddress(row.address)))throw Error('不读取本机或内网地址')
  signal.throwIfAborted();const target=addresses.find(row=>row.family===4)||addresses[0]
  const response:any=await new Promise((resolve,reject)=>{
   const request=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{signal,headers:{accept:'text/html,application/xhtml+xml,text/plain;q=0.9','accept-encoding':'identity','user-agent':'Mozilla/5.0 (compatible; AIWorkBench/0.4)'},lookup:(_hostname,options,callback:any)=>{if(options.all)callback(null,[target]);else callback(null,target.address,target.family)}},resolve)
   request.on('error',reject);request.end()
  })
  if([301,302,303,307,308].includes(response.statusCode)){response.destroy();if(!response.headers.location||redirects===4)throw Error('网页跳转次数过多或缺少地址');url=new URL(response.headers.location,url);continue}
  if(response.statusCode<200||response.statusCode>=300){response.destroy();throw Error('网页直接读取返回 HTTP '+response.statusCode)}
  if(!/^(text\/(?:html|plain|markdown)|application\/xhtml\+xml)/i.test(response.headers['content-type']||'')){response.destroy();throw Error('网页没有返回可读取的文本正文')}
  const chunks:Buffer[]=[];let bytes=0
  for await(const part of response){const chunk=Buffer.from(part);bytes+=chunk.length;if(bytes>3*1024*1024){response.destroy();throw Error('网页正文超过3 MB，未截断保存')}chunks.push(chunk)}
  const charset=/charset\s*=\s*["']?([^\s;"']+)/i.exec(response.headers['content-type']||'')?.[1]||'utf-8'
  return {statusCode:response.statusCode,url:url.href,body:{content:new TextDecoder(charset).decode(Buffer.concat(chunks))}}
 }
 throw Error('网页读取未完成')
}
