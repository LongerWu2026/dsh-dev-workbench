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
const startExtraction=async(f)=>{await act(async()=>{void f.WB.actions.analyzeRun().catch(()=>{})})};
it('提交立即失败在右下角显示一次失败提示，并保留识别状态',async()=>{
 const f=setup();f.start=async()=>{throw Error('模型未认证')};await startExtraction(f);await flush();expect(f.WB.store.get().analysisActivity.phase).toBe('failed');expect(screen.queryByLabelText('提取进行中')).toBeNull();expect(document.querySelector('.wb-toasts').textContent).toContain('提取启动失败：模型未认证');expect(f.WB.store.get().toasts.filter(t=>t.kind==='err')).toHaveLength(1)
});
it('已接受后很快失败也通知失败，不能把入队当成功',async()=>{
 const f=setup();f.jobs=[running({status:'failed',error:'缺少 reasoning_content'})];await startExtraction(f);await flush();expect(f.WB.store.get().analysisActivity.phase).toBe('failed');expect(screen.queryByLabelText('提取进行中')).toBeNull();expect(document.querySelector('.wb-toasts').textContent).toContain('提取失败：缺少 reasoning_content');expect(f.WB.store.get().toasts.some(t=>t.kind==='ok')).toBe(false)
});
it('识别进度每秒更新，完成后停止轮询，不依赖首页提取栏',async()=>{
 const f=setup();let accept;f.start=()=>new Promise(r=>accept=r);await startExtraction(f);await flush();expect(f.WB.store.get().analysisActivity.phase).toBe('starting');expect(f.starts).toBe(1)
 f.jobs=[running()];await act(async()=>accept({jobId:'new-extract'}));await flush();expect(f.WB.store.get().analysisActivity.phase).toBe('running');expect(f.WB.store.get().toasts).toHaveLength(0)
 f.jobs=[running({progress:{processed:6,remaining:4,failed:0,batches:1,pauseReason:null}})];await tick();expect(f.WB.store.get().analysisActivity.progress).toMatchObject({processed:6,remaining:4})
 f.jobs=[running({status:'completed',progress:{processed:10,remaining:0,failed:0,batches:2,pauseReason:null}})];await tick();expect(screen.queryByLabelText('提取进行中')).toBeNull();expect(f.WB.store.get().analysisActivity.phase).toBe('completed');const count=f.reads;await tick();expect(f.reads).toBe(count)
});
it('自动作业的快速完成也能捕获，历史失败不重复弹通知',async()=>{
 const f=setup([running()]);f.jobs=[running({status:'completed',result:{processed:10,failures:0}})];await tick();expect(f.WB.store.get().analysisActivity.phase).toBe('completed');cleanup();const old=setup([running({status:'failed',error:'历史失败'})]);await flush();expect(old.WB.store.get().toasts).toHaveLength(0)
});
it('模型失败进入等待重试时停止转圈，同一失败只通知一次，恢复后继续转圈',async()=>{
 const f=setup();f.jobs=[running({status:'queued',nextRetryAt:'2026-11-01T00:00:00Z',error:'模型暂不可用'})];await startExtraction(f);await flush();expect(f.WB.store.get().analysisActivity.phase).toBe('paused');expect(screen.queryByLabelText('提取进行中')).toBeNull();await tick();await tick();expect(f.WB.store.get().toasts.filter(t=>t.kind==='err')).toHaveLength(1);f.jobs=[running()];await tick();expect(f.WB.store.get().analysisActivity.phase).toBe('running')
});
it('已有补采等待记录不再报提取失败，保持原作业轮询且不重发启动请求',async()=>{
 const f=setup();f.jobs=[running({status:'queued',nextRetryAt:'2026-11-04T12:00:00Z',result:{status:'deferred',processed:0,failures:0,note:'指定消息仍在会话补采或重试等待中，保留作业，下一轮继续核对'}})];await startExtraction(f);await flush()
 expect(f.WB.store.get().analysisActivity.phase).toBe('waiting');expect(f.WB.store.get().toasts).toHaveLength(0)
 const reads=f.reads;await tick();await tick();expect(f.reads).toBeGreaterThan(reads);expect(f.starts).toBe(1);expect(f.WB.store.get().toasts).toHaveLength(0)
 f.jobs=[running()];await tick();expect(f.WB.store.get().analysisActivity.phase).toBe('running')
 f.jobs=[running({status:'completed',result:{status:'ok',processed:1,failures:0}})];await tick();await tick()
 expect(f.WB.store.get().analysisActivity.phase).toBe('completed');expect(f.WB.store.get().toasts.filter(t=>t.kind==='ok')).toHaveLength(1);expect(f.starts).toBe(1)
});
it.each(['conversation_backfill','retry_wait','lease_wait'])('%s有明确等待原因时不误报成功或失败',async waitReason=>{
 const f=setup();f.jobs=[running({status:'queued',nextRetryAt:'2026-11-04T12:00:00Z',result:{status:'deferred',waitReason,processed:0,failures:0,note:'本条消息暂时等待继续'}})];await startExtraction(f);await flush();expect(f.WB.store.get().analysisActivity.phase).toBe('waiting');await tick();expect(f.WB.store.get().toasts).toHaveLength(0)
});
it('已有识别批次运行时显示等待，排队的本条不误报失败或重发',async()=>{
 const f=setup();f.jobs=[running({status:'queued',nextRetryAt:'2026-11-04T12:00:00Z',result:{status:'busy',note:'识别批次正在运行'}})];await startExtraction(f);await flush();expect(f.WB.store.get().analysisActivity.phase).toBe('waiting');await tick();expect(f.starts).toBe(1);expect(f.WB.store.get().toasts).toHaveLength(0)
});
it('真实模型故障的deferred仍显示失败，不能被普通等待状态吞掉',async()=>{
 const f=setup();f.jobs=[running({status:'queued',nextRetryAt:'2026-11-04T12:00:00Z',result:{status:'deferred',note:'HTTP 401 模型认证失败'}})];await startExtraction(f);await flush();expect(f.WB.store.get().analysisActivity.phase).toBe('paused');expect(f.WB.store.get().toasts.filter(t=>t.kind==='err')).toHaveLength(1)
});
it('等待记录后来出现真实错误时仍发出一次失败通知',async()=>{
 const f=setup();f.jobs=[running({status:'queued',nextRetryAt:'2026-11-04T12:00:00Z',error:'模型执行失败',result:{status:'deferred',waitReason:'conversation_backfill'}})];await startExtraction(f);await flush();expect(f.WB.store.get().analysisActivity.phase).toBe('paused');expect(f.WB.store.get().toasts.filter(t=>t.kind==='err')).toHaveLength(1)
});
it('离开首页后仍跟踪失败，返回首页保留失败状态但不恢复旧操作栏',async()=>{
 const f=setup();f.jobs=[running()];await startExtraction(f);await flush();await act(async()=>f.WB.go('tasks'));f.jobs=[running({status:'failed',error:'提取模型返回400'})];await tick();expect(document.querySelector('.wb-toasts').textContent).toContain('提取失败：提取模型返回400');await act(async()=>f.WB.go('dashboard'));expect(f.WB.store.get().analysisActivity.phase).toBe('failed')
});
it('状态读取短暂失败不把任务报成提取失败，恢复后清除同步提示',async()=>{
 const f=setup();f.jobs=[running()];await startExtraction(f);await flush();f.offline=true;await tick();expect(f.WB.store.get().analysisStatusError).toBe('提取状态暂时无法同步，正在重试');expect(f.WB.store.get().toasts).toHaveLength(0);f.offline=false;await tick();expect(f.WB.store.get().analysisStatusError).toBeNull()
});

it('上一次完成后，新出现的自动提取作业继续更新首页，不被旧状态覆盖',async()=>{
 const f=setup();f.jobs=[running({status:'completed'})];await startExtraction(f);await flush();expect(f.WB.store.get().analysisActivity.phase).toBe('completed');const automatic=running({id:'automatic-next',updatedAt:new Date().toISOString()});f.jobs=[...f.jobs,automatic];await act(async()=>f.WB.store.set({data:{...f.WB.store.get().data,revision:2,jobs:f.jobs}}));await flush();expect(f.WB.store.get().analysisActivity.jobId).toBe('automatic-next');expect(f.WB.store.get().analysisActivity.phase).toBe('running')
});
it('重复启动提交共用同一次请求，不产生重复通知',async()=>{
 const f=setup();let accept;f.start=()=>new Promise(r=>accept=r);let one,two;await act(async()=>{one=f.WB.actions.analyzeRun();two=f.WB.actions.analyzeRun()});expect(one).toBe(two);expect(f.starts).toBe(1);f.jobs=[running({status:'failed',error:'快速失败'})];await act(async()=>accept({jobId:'new-extract'}));await flush();expect(f.WB.store.get().toasts.filter(t=>t.kind==='err')).toHaveLength(1)
});
it('有部分结果失败的任务不能报成提取成功',async()=>{
 const f=setup();f.jobs=[running({status:'completed',result:{status:'partial',processed:1,failures:1,note:'其中一条解析失败'}})];await startExtraction(f);await flush();expect(f.WB.store.get().analysisActivity.phase).toBe('failed');expect(f.WB.store.get().toasts.some(t=>t.kind==='ok')).toBe(false);expect(document.querySelector('.wb-toasts').textContent).toContain('其中一条解析失败')
});
it('无法识别转待确认后提示需要核对，不报失败或全部成功',async()=>{
 const f=setup();f.jobs=[running({status:'completed',progress:{processed:103,remaining:0,failed:0,awaitingHuman:1,batches:3,pauseReason:null},result:{status:'ok',processed:103,failures:0,reviewed:1}})];await startExtraction(f);await flush();
 expect(f.WB.store.get().analysisActivity.phase).toBe('completed');expect(f.WB.store.get().toasts.some(t=>t.kind==='err'||t.kind==='ok')).toBe(false);expect(document.querySelector('.wb-toasts').textContent).toContain('1 条消息待确认，可单条重试')
});
it('新一轮启动后忽略旧状态请求的迟到失败',async()=>{
 const f=setup();f.jobs=[running()];await startExtraction(f);await flush();let resolveOld;f.statusRead=()=>new Promise(r=>resolveOld=r);await tick();f.statusRead=null;f.jobs=[running({id:'second-extract'})];f.start=async()=>({jobId:'second-extract'});await act(async()=>f.WB.actions.analyzeRun(1,['second-entry']));await flush();await act(async()=>resolveOld({jobs:[running({status:'failed',error:'旧轮次迟到失败'})]}));expect(f.WB.store.get().analysisActivity.jobId).toBe('second-extract');expect(f.WB.store.get().analysisActivity.phase).toBe('running');expect(f.WB.store.get().toasts).toHaveLength(0)
});
it('显式重试保留重试意图；首页不再提供会重置失败次数的常驻按钮',async()=>{
 const f=setup();f.jobs=[running({status:'failed',error:'消息已达3次重试上限'})];await startExtraction(f);await flush();expect(screen.queryByLabelText('首页提取状态')).toBeNull();expect(screen.queryByRole('button',{name:'重试提取'})).toBeNull();let request;f.start=async()=>{request=true;return{jobId:'retry'}};await act(async()=>f.WB.actions.analyzeRun(undefined,undefined,true));expect(request).toBe(true)
});
