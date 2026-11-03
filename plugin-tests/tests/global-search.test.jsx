import React from 'react'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {render,screen,within,fireEvent,waitFor,act,cleanup} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
let WB,App,data,calls,search
const hit=(kind,id,title)=>({kind,id,title,snippet:'命中的内容摘要',url:null,extra:{}})
const groups=()=>[
 {id:'tasks',label:'我的待办',status:'ok',items:[hit('task','t','验收待办')]},
 {id:'knowledge',label:'知识空间',status:'ok',items:[hit('knowledge','k','验收知识')]},
 {id:'radar',label:'资讯',status:'ok',items:[hit('radar','r','验收资讯')]},
 {id:'sources',label:'消息来源',status:'ok',items:[hit('source','s','验收消息'),hit('source','unlinked','未关联消息')]}
]
beforeEach(()=>{
 WB=loadClientBundle().WB;calls=[]
 data={version:2,revision:1,settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:false}},projects:[],tasks:[{id:'t',title:'验收待办',description:'待办完整内容',status:'ready',priority:'normal'}],knowledge:[{id:'k',title:'验收知识',body:'当前已保存的完整知识正文'}],radar:[{id:'r',title:'验收资讯',summary:{change:'资讯正文'}}],sources:[{id:'s',title:'验收消息',excerpt:'消息完整内容'},{id:'unlinked',title:'未关联消息',excerpt:'原消息正文'}],replies:[{id:'rep',sourceId:'s',snippet:'验收回复',stage:'待回复',taskIds:[]}],analysisQueue:[],jobs:[],runs:[],audit:[],connectors:[],candidates:[]}
 WB.store.set({data,status:'ready',page:'dashboard',assistantRefs:[{kind:'source',id:'stale',title:'上次的上下文'}]})
 WB.apply({effect:fn=>fn(),get:()=>undefined,connection:{rpc:{call:async(_channel,endpoint,payload)=>{
  calls.push({endpoint,args:payload.args});let value=data
  if(endpoint==='workbench/revision')value={revision:data.revision}
  if(endpoint==='workbench/analysisStatus')value={pending:0,failed:0,awaitingHuman:0,done:0,jobs:[],entries:[]}
  if(endpoint==='workbench/operationsStatus')value={reminders:[]}
  if(endpoint==='workbench/assistantHub'){
   const req=payload.args.request;value=req.action==='list'?{status:'ok',conversations:[{id:'system:radar',kind:'system',title:'AI 资讯'}]}:{status:'ok',conversation:{id:req.conversationId,kind:req.conversationId?.split(':')[0],title:'搜索后的原事项会话'},messages:[],events:[],runs:[],items:[],threads:[],confirmations:[]}
  }
  return {ok:true,value}
 }}},slots:{inject(_name,fn){fn();return()=>{}},register(d,c){if(d.name==='main')App=c;return()=>{}}},locale:{register:()=>()=>{},bind:()=>()=>''}})
 search=vi.fn(async()=>({groups:groups()}));WB.actions.search=search
})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
async function quick(){const user=userEvent.setup();render(<App/>);await user.click(screen.getByRole('button',{name:'搜索工作内容（⌘K / Ctrl+K）'}));return user}
async function query(user,text='验收'){await user.type(screen.getByRole('textbox',{name:'搜索工作内容关键词'}),text);await screen.findByText('验收待办')}
it('工作搜索不在一级导航或更多中，顶部按钮与Cmd/Ctrl+K共用同一入口',async()=>{
 const user=await quick(),nav=screen.getByRole('navigation',{name:'工作台导航'})
 expect(nav.querySelector('[data-page="search"]')).toBeNull();expect(screen.getByRole('dialog',{name:'搜索工作内容'})).toBeTruthy()
 await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull()
 fireEvent.keyDown(window,{key:'k',ctrlKey:true});expect(screen.getByRole('dialog',{name:'搜索工作内容'})).toBeTruthy()
 fireEvent.keyDown(window,{key:'k',metaKey:true});expect(screen.queryByRole('dialog')).toBeNull()
})
it('默认仅本地搜索，类型筛选不再次调用搜索，回车直接定位结果',async()=>{
 const user=await quick();await query(user)
 expect(search).toHaveBeenLastCalledWith('验收',{scope:'local',includeWeb:false,includeEnterprise:false})
 await user.click(within(screen.getByRole('group',{name:'搜索类型'})).getByRole('button',{name:'知识'}));expect(screen.queryByText('验收待办')).toBeNull();expect(screen.getByText('验收知识')).toBeTruthy();expect(search).toHaveBeenCalledTimes(1)
 await user.click(within(screen.getByRole('group',{name:'搜索类型'})).getByRole('button',{name:'全部'}));await user.click(screen.getByRole('textbox',{name:'搜索工作内容关键词'}));await user.keyboard('{Enter}')
 expect(WB.store.get().page).toBe('tasks');expect(screen.getAllByText('待办完整内容').length).toBeGreaterThan(0);expect(screen.queryByRole('dialog',{name:'搜索工作内容'})).toBeNull()
})
it('查看全部携带关键词、范围和类型进入保留的完整结果页',async()=>{
 const user=await quick();await query(user);await user.click(within(screen.getByRole('group',{name:'搜索类型'})).getByRole('button',{name:'知识'}));await user.click(screen.getByRole('button',{name:/查看全部搜索结果/}))
 expect(WB.store.get().page).toBe('search');await screen.findByRole('heading',{name:'搜索结果'});await screen.findByText('验收知识');expect(screen.queryByText('验收待办')).toBeNull();expect(screen.getByRole('textbox',{name:'工作搜索关键词'}).value).toBe('验收');expect(search).toHaveBeenLastCalledWith('验收',{scope:'local',includeWeb:false})
})
it('结果直接查看完整已保存内容，避免只展示搜索摘要',async()=>{
 const user=await quick();await query(user);await user.click(screen.getByRole('button',{name:/^验收知识/}));const modal=screen.getByRole('dialog',{name:'验收知识'})
 expect(within(modal).getByText('当前已保存的完整知识正文')).toBeTruthy();expect(within(modal).getByRole('button',{name:'交给 AI 继续处理'})).toBeTruthy();expect(calls.some(c=>/update|create|delete/i.test(c.endpoint))).toBe(false)
})
it.each([['验收待办','task:t','task','t'],['验收知识','knowledge:k','knowledge','k'],['验收资讯','radar:r','radar','r'],['验收消息','reply:rep','reply','rep'],['未关联消息','system:analysis','source','unlinked']])('%s交给AI时恢复对应会话并替换旧上下文',async(title,conversationId,kind,id)=>{
 const user=await quick();await query(user);await user.click(screen.getByRole('button',{name:'交给 AI 继续处理：'+title}));expect(WB.store.get().page).toBe('assistant');expect(WB.store.get().assistantConversationId).toBe(conversationId);expect(WB.store.get().assistantRefs.map(r=>[r.kind,r.id])).toEqual([[kind,id]]);expect(calls.some(c=>c.endpoint==='workbench/assistantHub'&&['reset','send'].includes(c.args.request.action))).toBe(false)
})
it('晚到的旧结果和关闭后的请求不能覆盖当前搜索',async()=>{
 const promises={};search.mockImplementation(q=>new Promise(resolve=>promises[q]=resolve));const user=await quick(),input=screen.getByRole('textbox',{name:'搜索工作内容关键词'})
 await user.type(input,'旧');await waitFor(()=>expect(promises['旧']).toBeTruthy());await user.clear(input);await user.type(input,'新');await waitFor(()=>expect(promises['新']).toBeTruthy())
 await act(async()=>promises['新']({groups:[{id:'tasks',label:'待办',status:'ok',items:[hit('task','new','新结果')]}]}));await screen.findByText('新结果')
 await act(async()=>promises['旧']({groups:[{id:'tasks',label:'待办',status:'ok',items:[hit('task','old','旧结果')]}]}));expect(screen.queryByText('旧结果')).toBeNull();expect(screen.getByText('新结果')).toBeTruthy()
 await user.keyboard('{Escape}');await user.click(screen.getByRole('button',{name:'搜索工作内容（⌘K / Ctrl+K）'}));expect(screen.queryByText('新结果')).toBeNull()
})
it('互联网搜索只预填助手指令，用户发送前不调用模型或联网',async()=>{
 const user=await quick();await query(user);await user.click(screen.getByRole('button',{name:'在助手中搜索互联网'}));const input=await screen.findByRole('textbox',{name:'助手消息'})
 await waitFor(()=>expect(input.value).toContain('请搜索互联网：验收'));expect(WB.store.get().assistantConversationId).toBe('system:radar');expect(WB.store.get().assistantRefs).toEqual([]);expect(calls.some(c=>c.endpoint==='workbench/assistantHub'&&['send','operate','reset'].includes(c.args.request.action))).toBe(false);expect(search.mock.calls.every(([,options])=>options.scope==='local')).toBe(true)
})
it('搜索失败可见，Escape关闭后焦点返回顶部搜索按钮',async()=>{
 search.mockRejectedValue(Error('本地读取失败'));const user=await quick();await user.type(screen.getByRole('textbox',{name:'搜索工作内容关键词'}),'验收');expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('本地读取失败'))
 await user.keyboard('{Escape}');expect(document.activeElement).toBe(screen.getByRole('button',{name:'搜索工作内容（⌘K / Ctrl+K）'}))
})
