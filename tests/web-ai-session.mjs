import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync,symlinkSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {spawnSync} from 'node:child_process'
import {build} from 'esbuild'
const directory=mkdtempSync(join(tmpdir(),'workbench-session-policy-'))
let checks=0
const check=(label,fn)=>{fn();checks++;console.log('✓ '+label)}
try{
 const output=join(directory,'policy.mjs')
 await build({stdin:{contents:"export {DesktopBrowserPersistence} from './host-integration/overlay/apps/desktop/src/browser-persistence.ts';export {workbenchBrowserPolicy} from './host-integration/overlay/apps/desktop/src/workbench-browser-policy.ts'",resolveDir:resolve('.'),loader:'ts'},outfile:output,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const {DesktopBrowserPersistence,workbenchBrowserPolicy}=await import(output)
 const profile=join(directory,'profile');mkdirSync(profile)
 const other=join(directory,'other-profile');mkdirSync(other)
 const create=path=>new DesktopBrowserPersistence(path,[workbenchBrowserPolicy])
 const request={namespace:'dsh-dev-workbench.web-ai',providerId:'kimi'},pool=create(profile),partition=pool.resolve(request).partition
 check('实际宿主策略：同一profile和厂商派生稳定持久化分区',()=>assert.equal(create(profile).resolve(request).partition,partition))
 const code="import {DesktopBrowserPersistence,workbenchBrowserPolicy} from "+JSON.stringify(output)+";console.log(new DesktopBrowserPersistence("+JSON.stringify(profile)+",[workbenchBrowserPolicy]).resolve("+JSON.stringify(request)+").partition)"
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:10000})
 check('实际宿主策略：新Node进程派生同一身份；真实存储另由Electron跨进程测试验证',()=>{assert.equal(child.status,0);assert.equal(child.stdout.trim(),partition)})
 check('实际宿主策略：profile与厂商隔离',()=>{assert.notEqual(create(other).resolve(request).partition,partition);assert.notEqual(pool.resolve({...request,providerId:'glm'}).partition,partition)})
 const alias=join(directory,'alias');symlinkSync(profile,alias)
 check('实际宿主策略：路径别名不建立第二份账号存储',()=>assert.equal(create(alias).resolve(request).partition,partition))
 check('实际宿主策略：拒绝未知命名空间、厂商和客户端目录字段',()=>{for(const invalid of [{...request,namespace:'other'},{...request,providerId:'unknown'},{...request,path:'/external'},{...request,token:'synthetic'}])assert.throws(()=>pool.resolve(invalid),/unregistered|invalid/)})
 check('实际宿主策略：生产导航只允许本厂商来源，不接收HTTP、其他厂商或带凭据的URL',()=>{const account=pool.resolve(request);assert.equal(account.allowsNavigation('https://www.kimi.com/chat/test'),true);for(const url of ['http://www.kimi.com/','https://chatglm.cn/','https://www.kimi.com.evil/','https://x:y@www.kimi.com/'])assert.equal(account.allowsNavigation(url),false)})
 check('实际宿主策略：六家分区不同，输出不含profile明文或授权',()=>{const values=workbenchBrowserPolicy.providers.map(p=>pool.resolve({...request,providerId:p.id}));assert.equal(new Set(values.map(v=>v.partition)).size,6);assert.equal(values.some(v=>v.partition.includes(profile)),false)})
 let finish,flushes=0,storageFlushes=0
 pool.register(partition,{flushStorageData(){storageFlushes++},cookies:{flushStore(){flushes++;return new Promise(resolve=>{finish=resolve})}}})
 const a=pool.flush(partition),b=pool.flush(partition);await Promise.resolve()
 check('实际宿主落盘：并发释放共享在途flush，不能提前报告完成',()=>{assert.equal(a,b);assert.equal(flushes,1);assert.equal(storageFlushes,1);assert.equal(typeof finish,'function')})
 finish();await Promise.all([a,b])
 pool.register(partition,{flushStorageData(){},cookies:{async flushStore(){throw new Error('synthetic flush failure')}}})
 await assert.rejects(()=>pool.flush(partition),/synthetic flush failure/)
 check('实际宿主落盘：失败不伪装为保存成功，flushAll独立报告失败数量',()=>assert.equal(flushes,1))
 assert.equal(await pool.flushAll(),1);checks++
 console.log('web-ai-session: '+checks+' actual host-policy/flush checks passed')
}finally{rmSync(directory,{recursive:true,force:true})}
