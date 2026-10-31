import React from 'react'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {render,screen,within,fireEvent,cleanup,act} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
let WB,connector,operation,calls,startFailure
beforeEach(()=>{
    WB=loadClientBundle().WB;calls=[];operation=null;startFailure=false
    connector={id:'yunzhijia',label:'云之家',installed:false,authState:'unconfigured',note:'未找到 CLI'}
    WB.store.set({data:{revision:1,settings:{topics:[],automation:{enabled:false}},connectors:[connector],projects:[],sources:[],tasks:[],replies:[],candidates:[],jobs:[],analysisQueue:[]},status:'ready',page:'settings'})
    WB.apply({effect:fn=>fn(),get:()=>undefined,connection:{rpc:{call:async(_channel,method,payload)=>{
        const args=payload.args||{}
        calls.push({method,args})
        if(method==='workbench/yunzhijiaStatus')return {ok:true,value:{connector,operation}}
        if(method==='workbench/yunzhijiaSetup'){
            if(startFailure)throw Error('网络不可用')
            operation={kind:args.request.kind,status:'running',note:'正在处理'};return {ok:true,value:operation}
        }
        return {ok:true,value:method==='workbench/diagnostics'?{counts:{},tools:[]}: {}}
    }}},slots:{inject:()=>()=>{},register:()=>()=>{}},locale:{register:()=>()=>{},bind:()=>()=>''}})
})
afterEach(()=>{cleanup();vi.useRealTimers()})
it('缺失CLI提供安装，成功安装后自动变为登录授权',async()=>{
    vi.useFakeTimers();render(<WB.pages.settings/>);await act(async()=>{})
    fireEvent.click(screen.getByRole('button',{name:'安装',exact:true}));await act(async()=>{})
    expect(screen.getByRole('button',{name:'安装中…'}).disabled).toBe(true)
    connector={...connector,installed:true,authState:'unauthorized',note:'请登录授权'};operation={kind:'install',status:'succeeded',note:'CLI 已安装'}
    await act(async()=>vi.advanceTimersByTimeAsync(3000))
    expect(screen.getByRole('button',{name:'登录授权'})).toBeTruthy();expect(screen.getByRole('button',{name:'重新安装'}).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button',{name:'登录授权'}));await act(async()=>{})
    expect(screen.getByRole('button',{name:'等待登录…'}).disabled).toBe(true)
    connector={...connector,authState:'ok',note:'whoami 已验证'};operation={kind:'login',status:'succeeded',note:'已验证'}
    await act(async()=>vi.advanceTimersByTimeAsync(3000))
    expect(screen.getByText('已连接')).toBeTruthy();expect(screen.queryByRole('button',{name:'登录授权'})).toBeNull()
})
it('进入页面、定时等待和返回窗口不自动检测，只有按钮触发检测',async()=>{
    vi.useFakeTimers();render(<WB.pages.settings/>);await act(async()=>{})
    await act(async()=>vi.advanceTimersByTimeAsync(60000));fireEvent.focus(window);fireEvent(document,new Event('visibilitychange'));await act(async()=>{})
    expect(calls.filter(c=>c.method==='workbench/yunzhijiaStatus')).toHaveLength(0)
    const section=screen.getByLabelText('云之家连接')
    expect(section.querySelectorAll('.wb-item-sub')).toHaveLength(1);expect(section.textContent).toContain('同步云之家消息与文档，安装时获取最新版 CLI。');expect(section.textContent).not.toContain('未找到 CLI')
    fireEvent.click(screen.getByRole('button',{name:'重新检测'}));await act(async()=>{})
    expect(calls.some(c=>c.args?.request?.force===true)).toBe(true)
    expect(calls.filter(c=>c.method==='workbench/yunzhijiaStatus')).toHaveLength(1)
})
it('失败可重试，卸载页面后停止检测',async()=>{
    vi.useFakeTimers();const view=render(<WB.pages.settings/>);await act(async()=>{})
    startFailure=true;fireEvent.click(screen.getByRole('button',{name:'安装',exact:true}));await act(async()=>{})
    expect(WB.store.get().toasts.at(-1).text).toContain('操作启动失败');expect(within(screen.getByLabelText('云之家连接')).queryByRole('alert')).toBeNull();expect(screen.getByRole('button',{name:'安装',exact:true}).disabled).toBe(false)
    view.unmount();const count=calls.length;await act(async()=>vi.advanceTimersByTimeAsync(18000));fireEvent.focus(window);expect(calls.length).toBe(count)
})
it('安装登录只查询操作进度，结束后停止查询',async()=>{
    vi.useFakeTimers();render(<WB.pages.settings/>);await act(async()=>{})
    fireEvent.click(screen.getByRole('button',{name:'安装',exact:true}));await act(async()=>{})
    await act(async()=>vi.advanceTimersByTimeAsync(3000))
    expect(calls.filter(c=>c.method==='workbench/yunzhijiaStatus').every(c=>c.args.request.operationOnly===true&&c.args.request.force===false)).toBe(true)
    operation={kind:'install',status:'succeeded'};connector={...connector,installed:true,authState:'unauthorized'}
    await act(async()=>vi.advanceTimersByTimeAsync(3000));const count=calls.length
    await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(calls.length).toBe(count)
})
it('已连接及旧宿主快照显示重新安装，按钮与名称在同一连接器行',async()=>{
    WB.store.set({data:{...WB.store.get().data,connectors:[{id:'yunzhijia',authState:'ok',note:'旧宿主说明'}]}})
    render(<WB.pages.settings/>);expect(screen.getByRole('button',{name:'重新安装'}).disabled).toBe(false);expect(screen.getByText('已连接')).toBeTruthy();expect(screen.queryByText('旧宿主说明')).toBeNull()
    const row=screen.getByLabelText('云之家连接');expect(row.classList.contains('wb-item')).toBe(true);expect(row.querySelector('.wb-item-title').textContent).toContain('云之家')
    fireEvent.click(screen.getByRole('button',{name:'重新安装'}));await act(async()=>{})
    expect(calls.some(c=>c.method==='workbench/yunzhijiaSetup'&&c.args.request.kind==='install')).toBe(true)
})
