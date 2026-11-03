import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-local-search-'));process.env.DSH_HOME=home
try{
 await build({stdin:{contents:`export {runUnifiedSearch} from './src/host/search/unified-search.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts'`,loader:'ts',resolveDir:resolve('.')},bundle:true,format:'esm',platform:'node',outfile:join(home,'host.mjs'),logLevel:'silent'})
 const h=await import(join(home,'host.mjs'));h.loadWorkbenchState();await h.mutateWorkbenchState(s=>{s.tasks=[{id:'t',title:'CI 联动验证',description:'工程方案',status:'ready'}];s.sources=[{id:'s',title:'CI 原消息',excerpt:'完整消息内容',provider:'test'}];return s})
 const touched=[],ctx={get:name=>{touched.push(name);throw Error('本地搜索不得访问外部服务：'+name)}}
 const result=await h.runUnifiedSearch(ctx,{query:'CI',scope:'local',includeWeb:true,includeEnterprise:true})
 assert.deepEqual(result.groups.map(g=>g.id),['tasks','knowledge','radar','sources']);assert.equal(result.total,2);assert.equal(result.groups[0].items[0].id,'t');assert.deepEqual(touched,[])
 const empty=await h.runUnifiedSearch(ctx,{query:'不存在的关键词',scope:'local'});assert.equal(empty.total,0);assert.ok(empty.groups.every(g=>g.status==='empty'));assert.deepEqual(touched,[])
 console.log('search-local: scoped results and empty results passed; no network, CLI or file-provider service accessed')
}finally{rmSync(home,{recursive:true,force:true})}
