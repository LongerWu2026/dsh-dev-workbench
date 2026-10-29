/** Same-module remounts must replace their timers without old cleanup stopping new work. */
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
const home=mkdtempSync(join(tmpdir(),'workbench-scheduler-'));process.env.DSH_HOME=home
const file=join(home,'host.mjs');await build({entryPoints:[resolve('src/host/plugin.ts')],outfile:file,bundle:true,format:'esm',platform:'node',logLevel:'silent'})
const original={setInterval,clearInterval,setTimeout,clearTimeout},intervals=new Map(),timeouts=new Map();let id=0,checks=0
globalThis.setInterval=(fn,ms)=>{const handle={id:++id,unref(){}};intervals.set(handle,{fn,ms});return handle}
globalThis.setTimeout=(fn,ms)=>{const handle={id:++id,unref(){}};timeouts.set(handle,{fn,ms});return handle}
globalThis.clearInterval=handle=>intervals.delete(handle);globalThis.clearTimeout=handle=>timeouts.delete(handle)
try{
 const host=await import(file);const mount=()=>{const cleanups=[];host.apply({provide(){},get(){},inject(){},effect:fn=>{const cleanup=fn();if(typeof cleanup==='function')cleanups.push(cleanup)}});return()=>cleanups.forEach(fn=>fn())}
 let dispose=mount()
 for(let i=0;i<100;i++){
  const oldCallbacks=[...intervals.values()].map(row=>row.fn),nextDispose=mount();dispose()
  assert.equal(intervals.size,2,'old cleanup must retain the new scheduler and heartbeat');checks++
  assert.equal(timeouts.size,1,'only the current boot check remains');checks++
  oldCallbacks.forEach(fn=>fn());await Promise.resolve();dispose=nextDispose
 }
 dispose();assert.equal(intervals.size,0);assert.equal(timeouts.size,0);checks+=2
 console.log(`scheduler-lifecycle: ${checks} checks; 100 same-module remounts, no timer accumulation or stale cleanup`)
}finally{Object.assign(globalThis,original);rmSync(home,{recursive:true,force:true})}
