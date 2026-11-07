import React from 'react'
import {it,expect,vi,afterEach} from 'vitest'
import {render,screen,fireEvent,act,cleanup} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(()=>{cleanup();vi.useRealTimers()})
function setup(page='dashboard'){
 vi.useFakeTimers();const {WB}=loadClientBundle();let App,report=null,offline=false,revision=1
 const calls=[],data={version:2,revision,updatedAt:new Date().toISOString(),settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:true}},tasks:[],replies:[{id:'reply',stage:'待回复',contact:'合成同事',snippet:'请答复',taskIds:[]}],sources:[],jobs:[],projects:[],knowledge:[],radar:[],runs:[],audit:[],analysisQueue:[],connectors:[]}
 WB.store.set({data,status:'ready',page})
 WB.apply({get:()=>undefined,effect:fn=>fn(),connection:{rpc:{call:async(_c,endpoint,payload)=>{calls.push({endpoint,args:payload.args});let value=data
  if(endpoint==='workbench/revision')value={revision}
  if(endpoint==='workbench/analysisStatus')value={jobs:[],entries:[]}
  if(endpoint==='workbench/refreshStart'){report={id:'refresh-1',scope:payload.args.request.scope,status:'running',collecting:true,steps:{messages:{status:'running',note:'同步中'}},startedAt:new Date().toISOString()};value=report}
  if(endpoint==='workbench/refreshStatus'){if(offline)throw Error('offline');value=report}
  if(endpoint==='workbench/snapshot')value={...data,revision}
  return{ok:true,value}
 }}},slots:{inject(_n,fn){fn();return()=>{}},register(d,c){if(d.name==='main')App=c;return()=>{}}},locale:{register:()=>()=>{},bind:()=>()=>''}})
 render(<App/>);return{WB,calls,set report(value){report=value},set offline(value){offline=value},set revision(value){revision=value}}
}
const flush=()=>act(async()=>{}),tick=()=>act(async()=>vi.advanceTimersByTimeAsync(1600))
it('首页去掉独立提取操作栏，全局刷新入口有清晰范围',async()=>{
 const f=setup();await flush();expect(screen.queryByLabelText('首页提取状态')).toBeNull();expect(screen.queryByRole('button',{name:'提取消息',exact:true})).toBeNull()
 const buttons=screen.getAllByRole('button',{name:'刷新全部内容',exact:true});expect(buttons).toHaveLength(2)
 fireEvent.click(buttons.find(b=>b.textContent==='刷新'));await flush()
 expect(f.calls.find(c=>c.endpoint==='workbench/refreshStart').args.request.scope).toBe('all');expect(f.calls.some(c=>c.endpoint==='workbench/fetchMentions')).toBe(false)
 expect(screen.getAllByRole('button',{name:'刷新全部内容'}).every(b=>b.disabled)).toBe(true)
 expect(f.WB.store.get().toasts.some(t=>t.kind==='ok')).toBe(false)
})
it.each([['summary','资讯摘要','workbench/radarSummaryStart','radar'],['analysis','消息识别','workbench/analysisStart','replies']])('设置显示%s的真实暂停原因，手工恢复调用现有后台入口',async(purpose,title,endpoint,page)=>{
 const f=setup('settings');await flush();const data=f.WB.store.get().data
 await act(async()=>f.WB.store.set({data:{...data,modelHealth:{[purpose]:{blocked:true,note:'历史 reasoning_content 不兼容'}}}}))
 expect(screen.getByText(new RegExp(title+'待恢复'))).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'恢复'+title}));await flush()
 expect(f.calls.filter(call=>call.endpoint===endpoint)).toHaveLength(1)
 expect(f.WB.store.get().page).toBe(page)
 expect(f.calls.some(call=>call.endpoint==='workbench/refreshStart')).toBe(false)
})
it.each([['dashboard','刷新待办','tasks'],['dashboard','刷新待回复','replies'],['tasks','刷新待办','tasks'],['replies','刷新待回复','replies']])('%s的%s调用局部刷新',async(page,label,scope)=>{
 const f=setup(page);await flush();fireEvent.click(screen.getByRole('button',{name:label,exact:true}));await flush();expect(f.calls.find(c=>c.endpoint==='workbench/refreshStart').args.request.scope).toBe(scope)
})
it('切换目录仍跟踪刷新，任务入队不当成功，终态才更新提示',async()=>{
 const f=setup();await flush();fireEvent.click(screen.getAllByRole('button',{name:'刷新全部内容'})[0]);await flush();await act(async()=>f.WB.go('tasks'))
 f.report={id:'refresh-1',scope:'all',status:'running',collecting:false,steps:{analysis:{status:'running',note:'识别中'}}};await tick();expect(f.WB.store.get().toasts.some(t=>t.kind==='ok')).toBe(false)
 f.report={id:'refresh-1',scope:'all',status:'completed',collecting:false,steps:{analysis:{status:'completed',note:'完成'}}};f.revision=2;await tick();expect(f.WB.store.get().data.revision).toBe(2);expect(f.WB.store.get().toasts.filter(t=>t.text==='刷新完成')).toHaveLength(1)
 const reads=f.calls.filter(c=>c.endpoint==='workbench/refreshStatus').length;await tick();expect(f.calls.filter(c=>c.endpoint==='workbench/refreshStatus')).toHaveLength(reads)
})
it('部分失败在进度中分别说明，短暂断线不伪造任务失败',async()=>{
 const f=setup();await flush();fireEvent.click(screen.getAllByRole('button',{name:'刷新全部内容'})[0]);await flush();f.offline=true;await tick();expect(f.WB.store.get().refreshStatusError).toContain('稍后重试');expect(f.WB.store.get().workspaceRefresh.status).toBe('running')
 f.offline=false;f.report={id:'refresh-1',scope:'all',status:'partial',collecting:false,steps:{messages:{status:'completed',note:'消息已更新'},news:{status:'failed',note:'搜索暂不可用'}}};await tick()
 fireEvent.click(screen.getByRole('button',{name:'查看刷新进度'}));await flush();expect(screen.getByRole('dialog').textContent).toContain('搜索暂不可用');expect(screen.getByRole('dialog').textContent).toContain('消息已更新');expect(f.WB.store.get().toasts.some(t=>t.kind==='ok')).toBe(false)
})
it('刷新结果同步跳过正在编辑的表单，并保留会话引用与草稿附件',async()=>{
 const f=setup();await flush();const draft={title:'未保存'};await act(async()=>f.WB.store.set({taskForm:draft,assistantRefs:[{kind:'task',id:'local'}],assistantConversationId:'task:local',attachmentDraft:['fixture.png']}))
 await act(async()=>f.WB.actions.refreshWorkspace('all'));f.revision=3;f.report={id:'refresh-1',scope:'all',status:'completed',collecting:false,steps:{messages:{status:'completed',note:'完成'}}};await tick()
 expect(f.WB.store.get().taskForm).toEqual(draft);expect(f.WB.store.get().assistantConversationId).toBe('task:local');expect(f.WB.store.get().attachmentDraft).toEqual(['fixture.png']);expect(f.WB.store.get().data.revision).toBe(1)
})
