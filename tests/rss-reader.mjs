/** Real raw HTTP transport over local fixtures; no extraction service or credentials. */
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {gzipSync} from 'node:zlib'
import {mkdtempSync,rmSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'rss-reader-')),xml='<rss><channel><item><title>AI 模型更新</title><link>https://example.test/news</link></item></channel></rss>'
const server=createServer((req,res)=>{assert.ok(req.headers.accept.includes('xml'));assert.equal(req.headers.authorization,undefined);if(req.url==='/redirect'){res.writeHead(302,{location:'/gzip'});res.end()}else if(req.url==='/gzip'){res.writeHead(200,{'content-type':'text/xml','content-encoding':'gzip'});res.end(gzipSync(xml))}else if(req.url==='/loop'){res.writeHead(302,{location:'/loop'});res.end()}else if(req.url==='/large'){res.writeHead(200,{'content-length':5*1024*1024});res.end()}else if(req.url==='/slow'){setTimeout(()=>res.end(xml),150)}else if(req.url==='/bad'){res.writeHead(403);res.end()}else if(req.url==='/html'){res.end('<html>not a feed</html>')}else{res.writeHead(200,{'content-type':'application/xml; charset=utf-8'});res.end(xml)}})
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port
try{
 const outfile=join(home,'reader.mjs');await build({stdin:{contents:`export {fetchRssXml} from './src/host/news/rss-reader.ts';export {fetchOneFeed} from './src/host/news/discovery.ts'`,resolveDir:resolve('.'),loader:'ts'},bundle:true,packages:'external',platform:'node',format:'esm',outfile,logLevel:'silent'});const h=await import(outfile)
 assert.equal((await h.fetchRssXml({url:base+'/plain'})).body.content,xml);assert.equal((await h.fetchRssXml({url:base+'/redirect'})).body.content,xml)
 await assert.rejects(h.fetchRssXml({url:base+'/loop'}),/跳转次数/);await assert.rejects(h.fetchRssXml({url:base+'/large'}),/4 MB/);await assert.rejects(h.fetchRssXml({url:base+'/bad'}),/403/);await assert.rejects(h.fetchRssXml({url:base+'/slow'},AbortSignal.timeout(10)))
 for(const url of ['file:///etc/passwd','https://user:secret@example.test/rss'])await assert.rejects(h.fetchRssXml({url}))
 const html=await h.fetchOneFeed({fetch:h.fetchRssXml},{url:base+'/html'});assert.equal(html.status,'error');assert.match(html.note,/RSS\/Atom/)
 const valid=await h.fetchOneFeed({fetch:h.fetchRssXml},{url:base+'/gzip'});assert.equal(valid.status,'ok');assert.equal(valid.items[0].title,'AI 模型更新')
 console.log('rss-reader: raw XML, gzip, redirects, loops, limits, timeout, URL validation, HTML rejection and feed parsing passed')
}finally{await new Promise(done=>server.close(done));server.closeAllConnections();rmSync(home,{recursive:true,force:true})}
