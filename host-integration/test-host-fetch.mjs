/** Exercise the HTTP 431 regression without any personal cookies or account. */
import {build} from 'esbuild'
import {createServer} from 'node:http'
import {once} from 'node:events'
import {mkdtempSync} from 'node:fs'
import {resolve,join} from 'node:path'
import assert from 'node:assert/strict'
const directory=mkdtempSync(resolve('.tmp/host-fetch-')),output=join(directory,'transport.mjs')
await build({entryPoints:[resolve('host-integration/overlay/apps/desktop/src/host-fetch.ts')],outfile:output,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const {desktopHostFetch}=await import(output)
let requests=0
const server=createServer({maxHeaderSize:1024},(request,response)=>{requests++;if(request.url==='/redirect'){response.writeHead(302,{location:'http://127.0.0.1:1/forbidden'});response.end();return}if(request.url==='/stall')return;response.writeHead(request.headers.cookie==='host-current=synthetic'&&request.headers.origin==='http://'+request.headers.host?200:401,{'content-type':'application/json'});response.end(JSON.stringify({cookie:request.headers.cookie}))})
server.listen(0,'127.0.0.1');await once(server,'listening')
const origin='http://127.0.0.1:'+server.address().port
try{
 const large=await fetch(origin,{headers:{cookie:'unrelated-localhost='+('x'.repeat(5000))}});assert.equal(large.status,431);await large.body?.cancel()
 const send=desktopHostFetch(origin,'host-current=synthetic')
 const response=await send(origin,{headers:{cookie:'unrelated='+('y'.repeat(5000))}});assert.equal(response.status,200);assert.deepEqual(await response.json(),{cookie:'host-current=synthetic'})
 const before=requests;await assert.rejects(()=>send('http://127.0.0.1:1/'),/cross-origin/);await assert.rejects(()=>send(origin.replace('http://','http://user:pass@')),/cross-origin/);assert.equal(requests,before)
 await assert.rejects(()=>send(origin+'/redirect'),/fetch failed/)
 const bounded=desktopHostFetch(origin,'host-current=synthetic',fetch,30);await assert.rejects(()=>bounded(origin+'/stall'),/timeout|abort/i)
 console.log('host-fetch: 7 HTTP boundary checks passed; HTTP 431 reproduced, auth/limits retained, stalled metadata request aborted')
}finally{server.close();server.closeAllConnections();await once(server,'close')}
