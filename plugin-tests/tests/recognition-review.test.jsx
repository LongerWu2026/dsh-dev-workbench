import React from 'react'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {render,screen,within,act,cleanup,waitFor,fireEvent} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
let WB,data,calls
beforeEach(()=>{
 WB=loadClientBundle().WB;calls=[]
 data={version:2,revision:1,settings:{topics:[],feeds:[],aiExtract:{enabled:true},automation:{enabled:false}},projects:[],tasks:[],replies:[],sources:[{id:'bad-source',excerpt:'@本人 你看下',sender:'合成同事'}],radar:[],knowledge:[],jobs:[],runs:[],audit:[],connectors:[],candidates:[],analysisQueue:[{id:'bad-entry',sourceId:'bad-source',status:'awaiting_human',reviewKind:'recognition',reviewReason:'引用原文缺失，请核对后重试',analysis:null,rejectedEvidence:['模型改写的错误依据']}]}
 WB.store.set({data,status:'ready',page:'replies'})
 WB.apply({effect:fn=>fn(),get:()=>undefined,connection:{rpc:{call:async(_c,endpoint,payload)=>{
  calls.push({endpoint,args:payload.args});let value=data
  if(endpoint==='workbench/analysisStatus')value={pending:0,failed:0,awaitingHuman:1,done:0,entries:data.analysisQueue,jobs:data.jobs}
  if(endpoint==='workbench/operationsStatus')value={reminders:[]}
  if(endpoint==='workbench/analysisStart')value={jobId:'single-retry',status:'queued'}
  if(endpoint==='workbench/revision')value={revision:data.revision}
  return{ok:true,value}
 }}},slots:{inject:()=>()=>{},register:()=>()=>{}},locale:{register:()=>()=>{},bind:()=>()=>''}})
})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
it('待确认显示原文和原因，可查看被拒绝依据，无直接建档按钮',async()=>{
 render(<WB.pages.replies/>);await act(async()=>{})
 fireEvent.change(screen.getByRole('combobox',{name:'识别记录'}),{target:{value:'review'}})
 const row=screen.getByText('@本人 你看下').closest('article')
 expect(within(row).getByText('待确认')).toBeTruthy();expect(within(row).getByText('引用原文缺失，请核对后重试')).toBeTruthy()
 expect(within(row).getByText('未通过校验的依据')).toBeTruthy();expect(within(row).getByText('模型改写的错误依据')).toBeTruthy()
 expect(within(row).queryByRole('button',{name:'确认建档'})).toBeNull();expect(within(row).getByRole('button',{name:'重试本条'})).toBeTruthy()
})
it.each(['replies','dashboard'])('%s仅重置和识别点击的单条消息，不发起整队重跑',async page=>{
 render(React.createElement(WB.pages[page]));await act(async()=>{})
 fireEvent.click(screen.getByRole('button',{name:'重试本条'}));await waitFor(()=>expect(calls.some(c=>c.endpoint==='workbench/analysisStart')).toBe(true))
 expect(calls.filter(c=>c.endpoint==='workbench/analysisRetry').map(c=>c.args)).toEqual([{entryId:'bad-entry'}])
 expect(calls.filter(c=>c.endpoint==='workbench/analysisStart').map(c=>c.args.request)).toEqual([{limit:1,onlyIds:['bad-entry']}])
 expect(calls.some(c=>c.endpoint==='workbench/analyzeConfirm')).toBe(false)
})
it('合法待确认候选仍可确认建档，已有功能不被误禁用',async()=>{
 data.analysisQueue[0]={id:'valid-entry',sourceId:'bad-source',status:'awaiting_human',analysis:{summary:'提交材料'}}
 WB.store.set({data});render(<WB.pages.replies/>);await act(async()=>{})
 expect(screen.getByRole('button',{name:'确认建档'})).toBeTruthy();expect(screen.getByRole('button',{name:'重新识别'})).toBeTruthy()
})
it('单条重试失败保留待确认原因，显示真实错误',async()=>{
 WB.actions.analysisRetry=vi.fn().mockRejectedValue(Error('当前条目正在处理，请稍后重试'))
 render(<WB.pages.replies/>);fireEvent.click(screen.getByRole('button',{name:'重试本条'}));await act(async()=>{})
 expect(data.analysisQueue[0].status).toBe('awaiting_human');expect(screen.getByText('引用原文缺失，请核对后重试')).toBeTruthy()
 expect(WB.store.get().toasts.some(t=>t.text?.includes('当前条目正在处理'))).toBe(true)
 expect(calls.some(c=>c.endpoint==='workbench/analysisStart')).toBe(false)
})
it('连续处理结束显示待确认数量，不能把待确认算成全部成功',async()=>{
 data.jobs=[{id:'review-job',kind:'analysis',status:'completed',progress:{processed:103,remaining:0,failed:0,awaitingHuman:1,batches:3,pauseReason:null}}];WB.store.set({data})
 render(<WB.pages.replies/>);await act(async()=>{})
 expect(screen.getByText(/待确认 1 条/)).toBeTruthy();expect(screen.getByText(/识别已结束，1 条消息待确认，可核对原因或单条重试/)).toBeTruthy()
 expect(screen.queryByText(/本次识别队列已处理完毕/)).toBeNull()
})
