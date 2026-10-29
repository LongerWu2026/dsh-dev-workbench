import React from 'react'
import {afterEach,describe,it,expect,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(()=>{cleanup();vi.useRealTimers()})
function setup(respond){
 const {WB}=loadClientBundle();let App
 const data={version:2,revision:1,settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:false}},projects:[],tasks:[],sources:[],radar:[],replies:[],analysisQueue:[],jobs:[],knowledge:[],connectors:[],runs:[],audit:[]}
 const rpc=vi.fn(async(_channel,endpoint,payload,signal)=>{
  let value=await respond?.(endpoint,payload.args,signal)
  if(value===undefined){value=data;if(endpoint==='workbench/backups')value={backups:[]};if(endpoint==='workbench/diagnostics')value={tools:[],counts:{}};if(endpoint==='workbench/automationStatus')value={enabled:false}}
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
 it('设置中的实时统计随revision更新，预算草稿和新结果不被旧响应覆盖',async()=>{
  const pending=[];const {WB,data}=setup(endpoint=>endpoint==='workbench/operationsStatus'?new Promise(r=>pending.push(r)):undefined)
  render(<WB.pages.settings/>);await waitFor(()=>expect(pending.length).toBe(1))
  await act(async()=>pending[0]({queue:{pending:3},policy:{dailyCallLimit:10,dailyTokenLimit:1000},qualityReviews:[],storageBytes:1024}))
  const input=screen.getByRole('spinbutton',{name:'每日后台调用上限'});fireEvent.change(input,{target:{value:'99'}})
  await act(async()=>WB.store.set({data:{...data,revision:2}}));await waitFor(()=>expect(pending.length).toBe(2))
  await act(async()=>WB.store.set({data:{...data,revision:3}}));await waitFor(()=>expect(pending.length).toBe(3))
  await act(async()=>pending[2]({queue:{pending:1},policy:{dailyCallLimit:10},qualityReviews:[],storageBytes:1024}))
  await act(async()=>pending[1]({queue:{pending:9},policy:{dailyCallLimit:20},qualityReviews:[],storageBytes:1024}))
  expect(screen.getByText(/待分析 1 ·/)).toBeTruthy();expect(screen.queryByText(/待分析 9 ·/)).toBeNull();expect(input.value).toBe('99')
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
