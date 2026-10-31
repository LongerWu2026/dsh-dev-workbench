import React from 'react'
import {it,expect,vi,afterEach} from 'vitest'
import {render,screen,fireEvent,act,cleanup} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(()=>{cleanup();vi.useRealTimers()})
const running=(patch={})=>({id:'new-extract',kind:'analysis',status:'running',progress:{processed:0,remaining:10,failed:0,batches:0,pauseReason:null},...patch})
function setup(initial=[]){
 vi.useFakeTimers();const {WB}=loadClientBundle();let App,jobs=initial,start=async()=>({jobId:'new-extract',status:'queued'}),reads=0,starts=0,statusError=false,read=null;
 const data={version:2,revision:1,updatedAt:new Date().toISOString(),settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:false}},tasks:[],replies:[],sources:[],jobs:initial,projects:[],knowledge:[],radar:[],runs:[],audit:[],analysisQueue:[],connectors:[]};WB.store.set({data,status:'ready',page:'dashboard'});
 WB.apply({get:()=>undefined,effect:fn=>fn(),connection:{rpc:{call:async(_c,endpoint)=>{let value=data;if(endpoint==='workbench/revision')value={revision:1};if(endpoint==='workbench/analysisStart'){starts++;value=await start()};if(endpoint==='workbench/analysisStatus'){reads++;if(statusError)throw Error('offline');value=read?await read():{pending:0,failed:0,awaitingHuman:0,done:0,jobs}};return{ok:true,value}}}},slots:{inject(_n,fn){fn();return()=>{}},register(d,c){if(d.name==='main')App=c;return()=>{}}},locale:{register:()=>()=>{},bind:()=>()=>''}});
 render(<App/>);return{WB,get reads(){return reads},get starts(){return starts},get jobs(){return jobs},set statusRead(fn){read=fn},set jobs(value){jobs=value},set start(fn){start=fn},set offline(value){statusError=value}};
}
const flush=async()=>act(async()=>{}),tick=async()=>act(async()=>vi.advanceTimersByTimeAsync(1000));
it('提交立即失败在右下角显示一次失败提示，并保留首页失败状态',async()=>{
 const f=setup();f.start=async()=>{throw Error('模型未认证')};fireEvent.click(screen.getByRole('button',{name:'提取消息',exact:true}));await flush();expect(screen.getByRole('status').textContent).toBe('提取失败');expect(screen.queryByLabelText('提取进行中')).toBeNull();expect(document.querySelector('.wb-toasts').textContent).toContain('提取启动失败：模型未认证');expect(f.WB.store.get().toasts.filter(t=>t.kind==='err')).toHaveLength(1)
});
it('已接受后很快失败也通知失败，不能把入队当成功',async()=>{
 const f=setup();f.jobs=[running({status:'failed',error:'缺少 reasoning_content'})];fireEvent.click(screen.getByRole('button',{name:'提取消息',exact:true}));await flush();expect(screen.getByRole('button',{name:'重试提取'})).toBeTruthy();expect(screen.queryByLabelText('提取进行中')).toBeNull();expect(document.querySelector('.wb-toasts').textContent).toContain('提取失败：缺少 reasoning_content');expect(f.WB.store.get().toasts.some(t=>t.kind==='ok')).toBe(false)
});
it('启动中与运行中转圈，进度每秒更新，完成后停止轮询和转圈',async()=>{
 const f=setup();let accept;f.start=()=>new Promise(r=>accept=r);fireEvent.click(screen.getByRole('button',{name:'提取消息',exact:true}));await flush();expect(screen.getByText('正在启动提取',{exact:true})).toBeTruthy();expect(screen.getByLabelText('提取进行中')).toBeTruthy();expect(f.starts).toBe(1)
 f.jobs=[running()];await act(async()=>accept({jobId:'new-extract'}));await flush();expect(screen.getByText('正在提取',{exact:true})).toBeTruthy();expect(f.WB.store.get().toasts).toHaveLength(0)
 f.jobs=[running({progress:{processed:6,remaining:4,failed:0,batches:1,pauseReason:null}})];await tick();expect(screen.getByText('已提取 6 条 · 剩余 4 条')).toBeTruthy()
 f.jobs=[running({status:'completed',progress:{processed:10,remaining:0,failed:0,batches:2,pauseReason:null}})];await tick();expect(screen.queryByLabelText('提取进行中')).toBeNull();expect(screen.getAllByText('提取完成',{exact:true}).length).toBeGreaterThan(0);const count=f.reads;await tick();expect(f.reads).toBe(count)
});
it('自动作业的快速完成也能捕获，历史失败不重复弹通知',async()=>{
 const f=setup([running()]);f.jobs=[running({status:'completed',result:{processed:10,failures:0}})];await tick();expect(f.WB.store.get().analysisActivity.phase).toBe('completed');cleanup();const old=setup([running({status:'failed',error:'历史失败'})]);await flush();expect(old.WB.store.get().toasts).toHaveLength(0)
});
it('模型失败进入等待重试时停止转圈，同一失败只通知一次，恢复后继续转圈',async()=>{
 const f=setup();f.jobs=[running({status:'queued',nextRetryAt:'2026-11-01T00:00:00Z',error:'模型暂不可用'})];fireEvent.click(screen.getByRole('button',{name:'提取消息',exact:true}));await flush();expect(screen.getByText('提取已暂停',{exact:true})).toBeTruthy();expect(screen.queryByLabelText('提取进行中')).toBeNull();await tick();await tick();expect(f.WB.store.get().toasts.filter(t=>t.kind==='err')).toHaveLength(1);f.jobs=[running()];await tick();expect(screen.getByLabelText('提取进行中')).toBeTruthy()
});
it('离开首页后仍跟踪失败，返回首页保留失败状态',async()=>{
 const f=setup();f.jobs=[running()];fireEvent.click(screen.getByRole('button',{name:'提取消息',exact:true}));await flush();await act(async()=>f.WB.go('tasks'));f.jobs=[running({status:'failed',error:'提取模型返回400'})];await tick();expect(document.querySelector('.wb-toasts').textContent).toContain('提取失败：提取模型返回400');await act(async()=>f.WB.go('dashboard'));expect(screen.getByRole('button',{name:'重试提取'})).toBeTruthy()
});
it('状态读取短暂失败不把任务报成提取失败，恢复后清除同步提示',async()=>{
 const f=setup();f.jobs=[running()];fireEvent.click(screen.getByRole('button',{name:'提取消息',exact:true}));await flush();f.offline=true;await tick();expect(screen.getByText('提取状态暂时无法同步，正在重试')).toBeTruthy();expect(f.WB.store.get().toasts).toHaveLength(0);f.offline=false;await tick();expect(screen.queryByText('提取状态暂时无法同步，正在重试')).toBeNull()
});

it('上一次完成后，新出现的自动提取作业继续更新首页，不被旧状态覆盖',async()=>{
 const f=setup();f.jobs=[running({status:'completed'})];fireEvent.click(screen.getByRole('button',{name:'提取消息',exact:true}));await flush();expect(f.WB.store.get().analysisActivity.phase).toBe('completed');const automatic=running({id:'automatic-next',updatedAt:new Date().toISOString()});f.jobs=[...f.jobs,automatic];await act(async()=>f.WB.store.set({data:{...f.WB.store.get().data,revision:2,jobs:f.jobs}}));await flush();expect(f.WB.store.get().analysisActivity.jobId).toBe('automatic-next');expect(screen.getByText('正在提取',{exact:true})).toBeTruthy()
});
it('重复启动提交共用同一次请求，不产生重复通知',async()=>{
 const f=setup();let accept;f.start=()=>new Promise(r=>accept=r);let one,two;await act(async()=>{one=f.WB.actions.analyzeRun();two=f.WB.actions.analyzeRun()});expect(one).toBe(two);expect(f.starts).toBe(1);f.jobs=[running({status:'failed',error:'快速失败'})];await act(async()=>accept({jobId:'new-extract'}));await flush();expect(f.WB.store.get().toasts.filter(t=>t.kind==='err')).toHaveLength(1)
});
it('有部分结果失败的任务不能报成提取成功',async()=>{
 const f=setup();f.jobs=[running({status:'completed',result:{status:'partial',processed:1,failures:1,note:'其中一条解析失败'}})];fireEvent.click(screen.getByRole('button',{name:'提取消息',exact:true}));await flush();expect(f.WB.store.get().analysisActivity.phase).toBe('failed');expect(f.WB.store.get().toasts.some(t=>t.kind==='ok')).toBe(false);expect(document.querySelector('.wb-toasts').textContent).toContain('其中一条解析失败')
});
it('新一轮启动后忽略旧状态请求的迟到失败',async()=>{
 const f=setup();f.jobs=[running()];fireEvent.click(screen.getByRole('button',{name:'提取消息',exact:true}));await flush();let resolveOld;f.statusRead=()=>new Promise(r=>resolveOld=r);await tick();f.statusRead=null;f.jobs=[running({id:'second-extract'})];f.start=async()=>({jobId:'second-extract'});await act(async()=>f.WB.actions.analyzeRun(1,['second-entry']));await flush();await act(async()=>resolveOld({jobs:[running({status:'failed',error:'旧轮次迟到失败'})]}));expect(f.WB.store.get().analysisActivity.jobId).toBe('second-extract');expect(f.WB.store.get().analysisActivity.phase).toBe('running');expect(f.WB.store.get().toasts).toHaveLength(0)
});
it('首页重试明确携带重试失败消息意图，普通提取不重置失败次数',async()=>{
 const f=setup();f.jobs=[running({status:'failed',error:'消息已达3次重试上限'})];fireEvent.click(screen.getByRole('button',{name:'提取消息',exact:true}));await flush();const run=vi.spyOn(f.WB.actions,'analyzeRun').mockResolvedValue({jobId:'retry'});fireEvent.click(screen.getByRole('button',{name:'重试提取',exact:true}));expect(run).toHaveBeenCalledWith(undefined,undefined,true)
});
