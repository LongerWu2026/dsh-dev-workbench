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
  if(endpoint==='workbench/analysisStatus'){
   const entries=data.analysisQueue.filter(row=>row.status==='awaiting_human')
   value={pending:0,failed:0,awaitingHuman:entries.length,done:0,entries,jobs:data.jobs}
  }
  if(endpoint==='workbench/setAnalysisDismissed'){
   const {entryId,dismissed}=payload.args
   data={...data,revision:data.revision+1,analysisQueue:data.analysisQueue.map(row=>row.id===entryId?{...row,status:dismissed?'cancelled':'awaiting_human',reviewDismissed:dismissed}:row)}
   value=data
  }
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
 fireEvent.click(screen.getByRole('button',{name:'查看消息'}));
 const dialog=screen.getByRole('dialog',{name:'待确认消息'});
 fireEvent.click(within(dialog).getByRole('button',{name:'确认建档'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'待确认消息'})).toBeNull());
 expect(calls.filter(c=>c.endpoint==='workbench/analyzeConfirm').map(c=>c.args)).toEqual([{entryId:'valid-entry'}]);
})
it.each(['dashboard','replies'])('%s 可手工标为无需处理，随后从队列恢复待确认',async page=>{
 const excerpt='@本人 你看下\n这是一条较长的消息，预览会截断，请以详情中保存的内容为准。'.repeat(3);
 const locator={accountId:'account',groupId:'group',groupName:'验收会话',msgId:'original',replyToMsgId:'quote',sentAt:'2026-11-07T06:01:00Z',imageIds:[]};
 Object.assign(data.sources[0],{excerpt,provider:'yunzhijia',locator});
 data.messageInbox={accountId:'account',conversations:[]};
 data.sources.push({id:'other-quote',provider:'yunzhijia',excerpt:'其他会话的文本',locator:{...locator,msgId:'quote',groupId:'other-group'}});
 if(page==='replies')data.sources.push({id:'saved-quote',provider:'yunzhijia',excerpt:'同一会话的引用原文',locator:{...locator,msgId:'quote'}});
 const view=render(React.createElement(WB.pages[page]));
 fireEvent.click(await screen.findByRole('button',{name:'查看消息'}));
 const dialog=screen.getByRole('dialog',{name:'待确认消息'});
 expect(within(dialog).getByRole('region',{name:'原消息内容'}).querySelector('p').textContent).toBe(excerpt);
 expect(within(dialog).getByText('发件人：合成同事')).toBeTruthy();
 expect(within(dialog).getByText('来自：验收会话')).toBeTruthy();
 expect(within(dialog).getByText(/发出时间：2026-11-07 14:01:00/)).toBeTruthy();
 expect(within(dialog).getByText('引用原文缺失，请核对后重试')).toBeTruthy();
 expect(within(dialog).getByText(page==='replies'?'同一会话的引用原文':/工作台未找到被引用的原消息/)).toBeTruthy();
 expect(within(dialog).queryByText('其他会话的文本')).toBeNull();
 expect(within(dialog).queryByRole('button',{name:'确认建档'})).toBeNull();
 expect(calls.some(c=>c.endpoint==='workbench/setAnalysisDismissed')).toBe(false);
 fireEvent.click(within(dialog).getByRole('button',{name:'标为无需处理'}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'查看消息'})).toBeNull());
 expect(screen.queryByRole('dialog',{name:'待确认消息'})).toBeNull();
 if(page==='dashboard'){view.unmount();render(<WB.pages.replies/>)}
 const filter=screen.getByRole('combobox',{name:'识别记录'});
 fireEvent.change(filter,{target:{value:'dismissed'}});
 const row=screen.getByRole('button',{name:'恢复待确认'}).closest('article');
 expect(within(row).getByText('无需处理')).toBeTruthy();
 fireEvent.click(within(row).getByRole('button',{name:'恢复待确认'}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'恢复待确认'})).toBeNull());
 fireEvent.change(filter,{target:{value:'review'}});
 expect(screen.getByText('引用原文缺失，请核对后重试')).toBeTruthy();
 expect(calls.filter(c=>c.endpoint==='workbench/setAnalysisDismissed').map(c=>c.args)).toEqual([{entryId:'bad-entry',dismissed:true},{entryId:'bad-entry',dismissed:false}]);
 expect(calls.some(c=>/analysisStart|analysisRetry|analyzeConfirm/.test(c.endpoint))).toBe(false);
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
