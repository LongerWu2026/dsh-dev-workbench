/** Raw XML transport for configured subscriptions. Never calls a page-extraction provider. */
const MAX_RSS_BYTES=4*1024*1024
function feedUrl(value:string,base?:string):URL {
 const url=new URL(value,base)
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('RSS 地址必须是无内嵌账号密码的 HTTP/HTTPS 地址')
 return url
}
export async function fetchRssXml(request:{url:string},signal:AbortSignal=AbortSignal.timeout(12000),transport:typeof fetch=fetch):Promise<any>{
 let url=feedUrl(request.url)
 for(let redirects=0;redirects<=4;redirects++){
  const response=await transport(url.href,{method:'GET',redirect:'manual',signal,headers:{accept:'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9','accept-encoding':'gzip, deflate, br','user-agent':'AIWorkBench RSS Reader'}})
  if([301,302,303,307,308].includes(response.status)){
   await response.body?.cancel();const location=response.headers.get('location');if(!location)throw Error('RSS 跳转缺少目标地址');if(redirects===4)throw Error('RSS 跳转次数超过上限');url=feedUrl(location,url.href);continue
  }
  if(!response.ok){await response.body?.cancel();throw Error('RSS 直连返回 HTTP '+response.status)}
  const length=Number(response.headers.get('content-length'));if(length>MAX_RSS_BYTES){await response.body?.cancel();throw Error('RSS 内容超过 4 MB 限制')}
  const reader=response.body?.getReader();if(!reader)throw Error('RSS 返回空响应')
  const chunks:Uint8Array[]=[];let bytes=0
  try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>MAX_RSS_BYTES)throw Error('RSS 内容超过 4 MB 限制');chunks.push(part.value)}}finally{await reader.cancel().catch(()=>{})}
  const buffer=Buffer.concat(chunks),declaration=buffer.subarray(0,200).toString('ascii'),charset=/charset\s*=\s*["']?([^\s;"']+)/i.exec(response.headers.get('content-type')||'')?.[1]||/encoding\s*=\s*["']([^"']+)/i.exec(declaration)?.[1]||'utf-8'
  let content:string;try{content=new TextDecoder(charset).decode(buffer)}catch{throw Error('RSS 使用了不支持的文本编码')}
  return {statusCode:response.status,url:url.href,body:{kind:'text',content}}
 }
 throw Error('RSS 读取未完成')
}
