/** Read-only local Host metadata diagnostics. No cookie, token, or configuration value is emitted. */
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
const log=readFileSync('.local-host/launch.log','utf8')
const matches=[...log.matchAll(/^dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9._~-]+)$/gm)]
const url=matches.at(-1)?.[1];if(!url)throw new Error('No owned local Host launch URL')
const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(3000)})
const cookie=response.headers.get('set-cookie')?.split(';')[0];await response.body?.cancel()
if(response.status!==303||!cookie)throw new Error('Owned Host exchange failed: '+response.status)
const origin=new URL(url).origin
for(const method of ['productAnalytics/enabled','settings/describe','llm/listConfigurableProviders','account/getState']){
 const started=Date.now();let phase='request',status
 try{
  const request=await fetch(origin+'/api/'+method,{method:'POST',redirect:'error',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:randomUUID(),method,payload:{args:{}}}),signal:AbortSignal.timeout(3000)})
  status=request.status;phase='body';const body=await request.json()
  console.log(JSON.stringify({method,status,elapsed:Date.now()-started,envelope:body.type,resultOk:body.result?.ok===true}))
 }catch(error){console.log(JSON.stringify({method,status,phase,elapsed:Date.now()-started,error:error.name}))}
}
