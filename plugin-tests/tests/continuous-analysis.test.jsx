import React from 'react'
import {beforeEach,afterEach,it,expect} from 'vitest'
import {render,screen,act,cleanup} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
let WB,data,calls
beforeEach(()=>{
 WB=loadClientBundle().WB;calls=[]
 data={revision:1,settings:{topics:['AI'],aiExtract:{enabled:true,batchSize:5},automation:{enabled:false}},radar:[],projects:[],sources:[],tasks:[],replies:[],candidates:[],jobs:[{id:'continuous-job',kind:'analysis',status:'running',input:{continuous:true,limit:50},progress:{processed:50,remaining:73,failed:0,batches:1,pauseReason:null}}],analysisQueue:[]}
 WB.store.set({data,status:'ready',page:'dashboard'})
 WB.apply({effect:fn=>fn(),get:()=>undefined,connection:{rpc:{call:async(_channel,endpoint,payload)=>{calls.push({endpoint,args:payload.args});return{ok:true,value:endpoint==='workbench/analysisStatus'?{pending:73,failed:0,awaitingHuman:0,done:50,entries:[]}:endpoint==='workbench/operationsStatus'?{reminders:[]}:data}}}},slots:{inject:()=>()=>{},register:()=>()=>{}},locale:{register:()=>()=>{},bind:()=>()=>''}})
})
afterEach(cleanup)
it.each(['dashboard','replies'])('%s页面可查看累计和剩余，快照更新后自动显示下一批进度',async page=>{
 render(React.createElement(WB.pages[page]));await act(async()=>{});if(page==='dashboard')await act(async()=>screen.getByRole('button',{name:'查看刷新进度'}).click())
 expect(screen.getByText(/累计处理 50 条 · 剩余 73 条/)).toBeTruthy()
 expect(screen.getByText(/已执行 1 批（每批最多 50 条）/)).toBeTruthy()
 if(page==='dashboard')expect(screen.getByRole('button',{name:'运行分析'}).disabled).toBe(true)
 data={...data,revision:2,jobs:data.jobs.map(job=>({...job,progress:{...job.progress,processed:100,remaining:23,batches:2}}))}
 await act(async()=>WB.store.set({data}))
 expect(screen.getByText(/累计处理 100 条 · 剩余 23 条/)).toBeTruthy()
})
it('首页通过刷新进度查看暂停原因与北京时间自动重试时间，无需翻历史记录',async()=>{
 Object.assign(data.jobs[0],{status:'queued',nextRetryAt:'2026-10-30T06:05:00Z',progress:{processed:50,remaining:73,failed:2,batches:2,pauseReason:'失败消息等待自动重试：模型返回结果不完整'}})
 render(<WB.pages.dashboard/>);await act(async()=>{});await act(async()=>screen.getByRole('button',{name:'查看刷新进度'}).click())
 const reason=screen.getByText(/暂停原因：失败消息等待自动重试：模型返回结果不完整/)
 expect(reason.closest('details')).toBeNull();expect(reason.textContent).toContain('14:05:00');expect(reason.textContent).toContain('自动继续')
 expect(screen.getByText('消息识别 · 等待重试')).toBeTruthy()
})
it('达到重试上限显示暂停，剩余消息不能显示全部完成',async()=>{
 Object.assign(data.jobs[0],{status:'failed',progress:{processed:50,remaining:1,failed:1,batches:3,pauseReason:'消息已达 3 次重试上限：证据不符'}})
 render(<WB.pages.replies/>);await act(async()=>{})
 expect(screen.getByText(/剩余 1 条 · 失败 1 条/)).toBeTruthy();expect(screen.getByText(/暂停原因：消息已达 3 次重试上限/)).toBeTruthy();expect(screen.queryByText(/本次识别队列已处理完毕/)).toBeNull()
})
it('连续作业优先展示，后续单条识别记录不会遮住累计进度',async()=>{
 data.jobs.push(...Array.from({length:6},(_,i)=>({id:'targeted-'+i,kind:'analysis',status:'completed',result:{processed:1,failures:0}})))
 render(<WB.pages.replies/>);await act(async()=>{})
 expect(screen.getByText(/累计处理 50 条 · 剩余 73 条/)).toBeTruthy();expect(screen.getByText('消息识别 · 运行中')).toBeTruthy()
})
it('全部处理后明确展示累计完成和零剩余',async()=>{
 Object.assign(data.jobs[0],{status:'completed',progress:{processed:123,remaining:0,failed:0,batches:3,pauseReason:null}})
 render(<WB.pages.replies/>);await act(async()=>{})
 expect(screen.getByText(/累计处理 123 条 · 剩余 0 条 · 失败 0 条/)).toBeTruthy();expect(screen.getByText(/本次识别队列已处理完毕/)).toBeTruthy()
})
it('手动固定每批50条，识别本条仍传1条和指定ID',async()=>{
 await WB.actions.analyzeRun();await WB.actions.analyzeRun(1,['e-1'])
 expect(calls.filter(call=>call.endpoint==='workbench/analysisStart').map(call=>call.args.request)).toEqual([{limit:50,onlyIds:[]},{limit:1,onlyIds:['e-1']}])
})

it('进度保留一份，历史作业编号和列表由助手会话承接',async()=>{
 data.jobs.push({id:'old-job-internal',kind:'analysis',status:'completed',result:{processed:1,failures:0}})
 render(<WB.pages.replies/>);await act(async()=>{})
 expect(screen.queryByText('old-job-internal')).toBeNull();expect(screen.queryByText('continuous-job')).toBeNull()
 expect(screen.getAllByText(/累计处理 50 条/)).toHaveLength(1)
 await act(async()=>screen.getByRole('button',{name:'在助手中继续'}).click())
 expect(WB.store.get().page).toBe('assistant');expect(WB.store.get().assistantConversationId).toBe('system:analysis')
})

it('查阅自动识别进度时完成仍保留最终结果，关闭后不留首页完成操作栏',async()=>{
 render(<WB.pages.dashboard/>);await act(async()=>screen.getByRole('button',{name:'查看刷新进度'}).click());
 data={...data,revision:3,jobs:data.jobs.map(job=>({...job,status:'completed',progress:{processed:123,remaining:0,failed:0,batches:3,pauseReason:null}}))};await act(async()=>WB.store.set({data}));
 expect(screen.getByRole('dialog',{name:'刷新进度'})).toBeTruthy();expect(screen.getByText(/累计处理 123 条 · 剩余 0 条/)).toBeTruthy();expect(screen.getByText('消息识别 · 完成')).toBeTruthy();await act(async()=>screen.getByRole('button',{name:'关闭',exact:true}).click());expect(screen.queryByRole('button',{name:'查看刷新进度'})).toBeNull();expect(screen.queryByLabelText('首页提取状态')).toBeNull()
})
