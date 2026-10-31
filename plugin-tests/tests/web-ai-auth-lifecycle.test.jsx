import React from 'react'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {act,cleanup,render,waitFor} from '@testing-library/react'
import {NativeWebsite} from '../../src/client/features/web-ai/NativeWebsite.tsx'
import {authenticationSummary} from '../../src/client/features/web-ai/authentication.ts'

let restore=()=>{}
afterEach(()=>{cleanup();restore();vi.unstubAllGlobals()})
async function fixture(){
 let current='about:blank#fixture-auth',controller,auth={status:'unknown'},nextProbe=null
 const onAuthentication=vi.fn(),operations=vi.fn(async()=>({status:'prepared'}))
 const descriptors={};for(const key of ['loadURL','getURL','executeJavaScript','addEventListener'])descriptors[key]=Object.getOwnPropertyDescriptor(HTMLElement.prototype,key)
 restore=()=>{for(const [key,value] of Object.entries(descriptors)){if(value)Object.defineProperty(HTMLElement.prototype,key,value);else delete HTMLElement.prototype[key]}}
 const subscribed=new WeakSet(),add=HTMLElement.prototype.addEventListener
 HTMLElement.prototype.addEventListener=function(name,...args){const result=add.call(this,name,...args);if(name==='dom-ready')subscribed.add(this);return result}
 HTMLElement.prototype.loadURL=async function(url){current=url;queueMicrotask(()=>this.dispatchEvent(new Event('dom-ready')))}
 HTMLElement.prototype.getURL=()=>current
 HTMLElement.prototype.executeJavaScript=function(script,gesture){if(script.includes('observeWebAIAuthentication')){if(nextProbe){const result=nextProbe;nextProbe=null;return result}return Promise.resolve(auth)}return operations(script,gesture)}
 vi.stubGlobal('dshDesktop',{protocolVersion:1,browser:{acquire:async()=>({lease:'fixture-auth',partition:'fixture-memory'}),release:vi.fn(async()=>{}),onOpenRequested:()=>()=>{}}})
 const view=render(<NativeWebsite providerId="kimi" scope="fixture" url="https://www.kimi.com/" visible={false} onController={value=>{controller=value}} onAuthentication={onAuthentication}/> )
 await waitFor(()=>expect(view.container.querySelector('webview')).toBeTruthy())
 const guest=view.container.querySelector('webview')
 // A synthetic webview emits no native readiness event; wait for subscription before dispatching it.
 await waitFor(()=>expect(subscribed.has(guest)).toBe(true))
 await act(async()=>guest.dispatchEvent(new Event('dom-ready')))
 await waitFor(()=>expect(controller?.authentication).toBeTypeOf('function'))
 return {view,guest,controller,onAuthentication,operations,setAuth:value=>{auth=value},probe:promise=>{nextProbe=promise}}
}
describe('登录探测与内嵌页面生命周期',()=>{
 it('登录与安全验证阻止填写/发送/上传；未知状态不冒充已登录且保留官网兼容流程',async()=>{
  const f=await fixture()
  for(const status of ['needs_login','verification']){
   f.setAuth({status,note:'identity@example.test',evidence:['private']})
   for(const action of ['prepare','submit'])expect((await f.controller.execute(action,'合成问题','request')).status).toBe('needs_login')
   expect((await f.controller.attach([], '合成问题','request',new AbortController().signal)).status).toBe('needs_login')
  }
  // attach performs a read-only observe, but no prepare/submit/upload script ran.
  expect(f.operations.mock.calls).toHaveLength(2)
  expect(f.operations.mock.calls.every(([script])=>script.includes('"action":"observe"'))).toBe(true)
  expect(JSON.stringify(f.onAuthentication.mock.calls)).not.toMatch(/identity@|private/)
  f.setAuth({status:'unknown'})
  expect((await f.controller.execute('prepare','合成问题','request')).status).toBe('prepared')
 })
 it('导航立即清除旧状态，旧文档的异步结果不能覆盖新状态或触发填写',async()=>{
  const f=await fixture();f.setAuth({status:'authenticated'})
  await act(async()=>{await f.controller.authentication()})
  expect(f.onAuthentication.mock.calls.at(-1)[0].status).toBe('authenticated')
  let finish;f.probe(new Promise(resolve=>{finish=resolve}))
  const pending=f.controller.execute('prepare','问题','request')
  await act(async()=>{const event=new Event('did-start-navigation');event.isMainFrame=true;f.guest.dispatchEvent(event)})
  expect(f.onAuthentication.mock.calls.at(-1)[0].status).toBe('unknown')
  finish({status:'authenticated'})
  await expect(pending).rejects.toThrow('页面已变化')
  expect(f.operations).not.toHaveBeenCalled()
  expect(f.onAuthentication.mock.calls.at(-1)[0].status).toBe('unknown')
 })
 it('卸载后不发布探测结果，原始网页字段不进入状态',async()=>{
  const f=await fixture();let finish;f.probe(new Promise(resolve=>{finish=resolve}))
  const pending=f.controller.authentication(),count=f.onAuthentication.mock.calls.length
  f.view.unmount();finish({status:'authenticated',email:'private@example.test'})
  expect((await pending).status).toBe('unknown');expect(f.onAuthentication).toHaveBeenCalledTimes(count)
  expect(authenticationSummary({status:['authenticated']})).toEqual(authenticationSummary(null))
  expect(authenticationSummary({status:'authenticated',note:'secret',evidence:['secret'],token:'secret'})).toEqual({status:'authenticated',note:'已识别官网账号入口；登录有效期由官网决定。',evidence:[]})
 })
})
