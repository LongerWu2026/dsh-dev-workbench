import React from 'react'
import {afterEach,describe,it,expect,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(()=>{cleanup();vi.useRealTimers()})
function setup(respond){
 const {WB}=loadClientBundle();let App
 const data={version:2,revision:1,settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:false}},projects:[],tasks:[],sources:[],radar:[],replies:[],analysisQueue:[],jobs:[],knowledge:[],connectors:[],runs:[],audit:[]}
 const rpc=vi.fn(async(_channel,endpoint,payload,signal)=>{
  let value=await respond?.(endpoint,payload.args,signal)
  if(value===undefined){value=data;if(endpoint==='workbench/backups')value={backups:[]};if(endpoint==='workbench/automationStatus')value={enabled:false}}
  return {ok:true,value}
 })
 WB.store.set({data,status:'ready',page:'settings'})
 WB.apply({get:()=>undefined,effect:fn=>fn(),connection:{rpc:{call:rpc}},locale:{register:()=>()=>{},bind:()=>()=>''},slots:{inject(_name,fn){fn();return()=>{}},register(d,c){if(d.name==='main')App=c;return()=>{}}}})
 return {WB,App,rpc,data}
}
describe('长时间打开与唤醒恢复',()=>{
 it('一百次同时同步只发一次修订查询和一次快照',async()=>{
  let release;const {WB,rpc,data}=setup((endpoint)=>endpoint==='workbench/revision'?new Promise(r=>release=r):{...data,revision:2})
  const requests=Array.from({length:100},()=>WB.actions.syncCheck());expect(rpc).toHaveBeenCalledTimes(1)
  release({revision:2});await Promise.all(requests);expect(rpc).toHaveBeenCalledTimes(2);expect(WB.store.get().data.revision).toBe(2)
 })
 it('超时释放同步锁，忽略旧快照晚到，并允许下一轮恢复',async()=>{
  vi.useFakeTimers();let release;const {WB,data}=setup(endpoint=>endpoint==='workbench/revision'?{revision:2}:new Promise(r=>release=r))
  const first=WB.actions.syncCheck();await vi.advanceTimersByTimeAsync(15001);expect(await first).toBe(false)
  WB.store.set({data:{...data,revision:3}});release({...data,revision:99});await Promise.resolve();await Promise.resolve();expect(WB.store.get().data.revision).toBe(3)
  expect(await WB.actions.syncCheck()).toBe(false)
 })
 it('设置随修订更新时保留资讯源草稿，无需读取诊断或运行质量',async()=>{
  const {WB,data,rpc}=setup();render(<WB.pages.settings/>);
  fireEvent.click(screen.getByRole('button',{name:'添加资讯源'}));
  const address=screen.getByRole('textbox',{name:'RSS / Atom 地址'});
  fireEvent.change(address,{target:{value:'https://example.test/draft.xml'}});
  const feeds=[{id:'updated-feed',label:'同步的订阅',url:'https://example.test/updated.xml',topics:[]}];
  await act(async()=>WB.store.set({data:{...data,revision:2,settings:{...data.settings,feeds}}}));
  expect(screen.getByText('同步的订阅')).toBeTruthy();
  expect(screen.getByRole('textbox',{name:'RSS / Atom 地址'})).toBe(address);
  expect(address.value).toBe('https://example.test/draft.xml');
  expect(rpc.mock.calls.map(call=>call[1])).not.toContain('workbench/diagnostics');
  expect(rpc.mock.calls.map(call=>call[1])).not.toContain('workbench/operationsStatus');
 })
 it('后台标签停止轮询，重新可见时立即同步，卸载后移除监听',async()=>{
  vi.useFakeTimers();const {WB,App}=setup();const sync=vi.spyOn(WB.actions,'syncCheck').mockResolvedValue(false)
  let visibility='visible';Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visibility})
  const view=render(<App/>);await act(async()=>{});sync.mockClear();visibility='hidden'
  await act(async()=>{await vi.advanceTimersByTimeAsync(60000)});expect(sync).not.toHaveBeenCalled()
  visibility='visible';await act(async()=>document.dispatchEvent(new Event('visibilitychange')));expect(sync).toHaveBeenCalledTimes(1)
  view.unmount();sync.mockClear();window.dispatchEvent(new Event('focus'));expect(sync).not.toHaveBeenCalled();delete document.visibilityState
 })
})
