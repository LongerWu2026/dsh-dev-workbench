/** Optional network smoke: real npm/CDN install in a temporary DSH_HOME; no real login. */
import assert from 'node:assert/strict'
import {spawn, execFileSync} from 'node:child_process'
import {mkdtempSync, rmSync, existsSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-yzj-real-'));process.env.DSH_HOME=home
const bundle=join(home,'host.mjs')
await build({stdin:{contents:`export {workbenchApi as api,setShared_workbenchCtx} from './src/host/application/workbench-service.ts'; export {disposeYunzhijiaSetup} from './src/host/integrations/yunzhijia-setup.ts'; export {yunzhijiaManagedBinary} from './src/host/integrations/yunzhijia-paths.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:bundle,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const host=await import(bundle);const launches=[]
host.setShared_workbenchCtx({get:name=>name==='subprocess'?{
    resolveExecutable:async()=>null, // Simulate a GUI host unable to resolve shell PATH.
    spawn(spec){
        launches.push(spec.argv)
        if(spec.argv.includes('whoami'))return {done:Promise.resolve({exitCode:0}),collected:{stdout:{readFrom:()=>({text:'{"success":false,"errorCode":401}'})}}}
        const child=spawn(spec.argv[0],spec.argv.slice(1),{cwd:spec.cwd,signal:spec.signal,stdio:['ignore','pipe','pipe']})
        let out='',err='';child.stdout.on('data',c=>{out=(out+c).slice(-16384)});child.stderr.on('data',c=>{err=(err+c).slice(-16384)})
        return {done:new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',exitCode=>resolve({exitCode}))}),terminate:()=>child.kill(),collected:{stdout:{readFrom:()=>({text:out})},stderr:{readFrom:()=>({text:err})}}}
    },
}:null})
try{
    assert.equal((await host.api.yunzhijiaStatus({force:true})).connector.installed,false)
    assert.equal((await host.api.yunzhijiaSetup({kind:'install'})).status,'running')
    const settled=async()=>{
        let result
        for(let n=0;n<200;n++){
            await new Promise(r=>setTimeout(r,1000))
            result=await host.api.yunzhijiaStatus({operationOnly:true})
            if(result.operation?.status!=='running')return result
        }
        throw Error('installation timed out')
    }
    let result=await settled()
    assert.equal(result.operation.status,'succeeded',result.operation.note)
    result=await host.api.yunzhijiaStatus({force:true})
    assert.equal(result.connector.installed,true);assert.equal(result.connector.authState,'unauthorized')
    assert.ok(existsSync(host.yunzhijiaManagedBinary()))
    const version=execFileSync(host.yunzhijiaManagedBinary(),['--version'],{encoding:'utf8',timeout:15000}).trim()
    assert.match(version,/\d+\.\d+/)
    // Replace only this test's temporary managed binary with a broken marker;
    // a same-version reinstall must download again and repair it.
    writeFileSync(host.yunzhijiaManagedBinary(),'broken old binary')
    await host.api.yunzhijiaSetup({kind:'install'});result=await settled()
    assert.equal(result.operation.status,'succeeded',result.operation.note)
    assert.equal(execFileSync(host.yunzhijiaManagedBinary(),['--version'],{encoding:'utf8',timeout:15000}).trim(),version)
    assert.ok(launches.filter(args=>args.includes('install')).every(args=>args.includes('@yunzhijia/cli@latest')&&args.includes('--prefer-online')))
    assert.equal(launches.filter(args=>args.includes('auth')).length,0)
    console.log('real install and same-version reinstall passed: '+version+'; latest tag requested, binary replaced, login not invoked')
}finally{host.disposeYunzhijiaSetup();rmSync(home,{recursive:true,force:true})}
