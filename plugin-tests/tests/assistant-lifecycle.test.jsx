import React from 'react'
import {afterEach, describe, expect, it} from 'vitest'
import {act, cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(cleanup)
function setup(delta,options={}) {
 const {WB}=loadClientBundle();let App;const opened=[],sent=[],transcripts=[]
 const fixture={version:2,revision:1,settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:false}},projects:[],tasks:[],sources:[],radar:[],replies:[],analysisQueue:[],jobs:[],knowledge:[],connectors:[],runs:[],audit:[]}
 const call=async(_channel,endpoint,payload)=>{
  const args=payload.args||{};let value=fixture
  if(endpoint==='workbench/analysisStatus')value={entries:[]}
  if(endpoint==='workbench/assistantSessions')value=options.sessionList||{assistantSessionId:'one',sessions:[{id:'one',title:'验收会话一'},{id:'two',title:'验收会话二'}]}
  if(endpoint==='workbench/assistantTranscript'){transcripts.push(args.request);value=options.transcript||{sessionId:args.request.sessionId,messages:[]}}
  if(endpoint==='workbench/assistantSend'){sent.push(args);value={status:'ok',sessionId:'one',fromSeq:0,...(options.retrieval?{retrieval:options.retrieval}:{})}}
  if(endpoint==='workbench/assistantDelta')value=await delta()
  if(options.respond){const override=options.respond(endpoint,args,fixture);if(override!==undefined)value=await override}
  return {ok:true,value}
 }
 WB.store.set({data:fixture,status:'ready',assistantOpen:options.closed!==true})
 WB.apply({get:name=>name==='uiWorkspace'?{openSession:id=>opened.push(id)}:undefined,effect:fn=>fn(),connection:{rpc:{call}},locale:{register:()=>()=>{},bind:()=>()=>''},slots:{inject(_slot,fn){return fn()},register(descriptor,component){if(descriptor.name==='main')App=component;return()=>{}}}})
 render(<App/>);return {WB,opened,sent,transcripts}
}
describe('助手真实运行时序回归',()=>{
 it('顶部AI助手可直接进入完整聊天页，无待办也能查看和搜索历史，通过导航返回简报',async()=>{
  const {WB,sent}=setup(async()=>({status:'ok',entries:[],turnEnded:true}),{closed:true}),user=userEvent.setup()
  expect(screen.queryByRole('navigation',{name:'助手会话列表'})).toBeNull();await user.click(screen.getByRole('navigation',{name:'工作台导航'}).querySelector('[data-page="assistant"]'))
  await screen.findByRole('button',{name:'会话：验收会话一'});expect(WB.store.get().page).toBe('assistant');expect(document.querySelector('.wb-workarea').classList.contains('wb-assistant-page')).toBe(true);expect(WB.store.get().assistantRefs).toEqual([])
  await user.type(screen.getByRole('textbox',{name:'搜索助手会话'}),'会话二');expect(screen.queryByRole('button',{name:'会话：验收会话一'})).toBeNull();await user.click(screen.getByRole('button',{name:'会话：验收会话二'}));await waitFor(()=>expect(screen.getByRole('button',{name:'会话：验收会话二'}).getAttribute('aria-current')).toBe('true'))
  expect(screen.queryByRole('button',{name:'关闭助手'})).toBeNull();await user.click(screen.getByRole('navigation',{name:'工作台导航'}).querySelector('[data-page="dashboard"]'));expect(WB.store.get().page).toBe('dashboard');expect(screen.queryByRole('navigation',{name:'助手会话列表'})).toBeNull();expect(sent).toHaveLength(0)
 })
 it('从待办聊天新建独立对话会退出待办归属，清除旧引用且不自动发送',async()=>{
  const resets=[],{WB,sent}=setup(async()=>({status:'ok',entries:[],turnEnded:true}),{respond:(endpoint,args)=>{
   if(endpoint==='workbench/assistantReset'){resets.push(args.request);return {status:'ok',sessionId:'general-new'}}
   if(endpoint==='workbench/assistantTranscript')return {status:'ok',sessionId:args.request.sessionId||'one',title:'新的对话',messages:[]}
  }}),user=userEvent.setup()
  await act(async()=>WB.assistant.openFor({kind:'task',id:'task-entry',title:'待办入口'}));await waitFor(()=>expect(screen.getByRole('button',{name:'新建对话'}).disabled).toBe(false));await user.click(screen.getByRole('button',{name:'新建对话'}))
  await waitFor(()=>expect(WB.store.get().assistantTaskId).toBe(null));expect(resets).toEqual([{}]);expect(WB.store.get().assistantRefs).toEqual([]);expect(WB.store.get().page).toBe('assistant');await waitFor(()=>expect(document.querySelector('[data-session-id="general-new"]')?.getAttribute('aria-current')).toBe('true'));expect(sent).toHaveLength(0)
 })
 it('各待办恢复自己的会话和草稿，左侧历史可折叠，打开待办不自动发送',async()=>{
  const chats=[{id:'chat-a',title:'甲的资料整理',taskId:'task-a',taskTitle:'待办甲'},{id:'chat-b',title:'乙的问题',taskId:'task-b',taskTitle:'待办乙'}]
  const {WB,sent}=setup(async()=>({status:'ok',entries:[],turnEnded:true}),{respond:(endpoint,args,fixture)=>{
   fixture.tasks=[{id:'task-a',title:'待办甲'},{id:'task-b',title:'待办乙'}]
   if(endpoint==='workbench/assistantSessions')return {sessions:chats,assistantSessionId:args.request.taskId==='task-b'?'chat-b':'chat-a'}
   if(endpoint==='workbench/assistantTranscript')return {status:'ok',sessionId:args.request.sessionId,messages:[{role:'assistant',text:args.request.taskId==='task-b'?'乙的历史':'甲的历史'}]}
  }}),user=userEvent.setup()
  await act(async()=>WB.assistant.openFor({kind:'task',id:'task-a',title:'待办甲'}));await screen.findByText('甲的历史');await user.type(screen.getByRole('textbox',{name:'助手消息'}),'甲尚未发送的草稿')
  await act(async()=>WB.assistant.openFor({kind:'task',id:'task-b',title:'待办乙'}));await screen.findByText('乙的历史');expect(screen.queryByText('甲的历史')).toBeNull();expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('')
  await user.click(screen.getByRole('button',{name:'会话：甲的资料整理'}));await screen.findByText('甲的历史');expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('甲尚未发送的草稿');expect(WB.store.get().assistantRefs[0].id).toBe('task-a')
  await user.click(screen.getByRole('button',{name:'收起会话列表'}));expect(screen.queryByRole('navigation',{name:'助手会话列表'})).toBeNull();await user.click(screen.getByRole('button',{name:'展开会话列表'}));expect(screen.getByRole('button',{name:'会话：甲的资料整理'}).getAttribute('aria-current')).toBe('true');expect(sent).toHaveLength(0)
 })
 it('待办切换时丢弃旧轮次回包，下一次发送带正确的待办和会话ID',async()=>{
  let release;const chats=[{id:'chat-a',title:'甲会话',taskId:'task-a'},{id:'chat-b',title:'乙会话',taskId:'task-b'}]
  const {WB,sent}=setup(()=>new Promise(resolve=>{release=resolve}),{respond:(endpoint,args)=>{
   if(endpoint==='workbench/assistantSessions')return {sessions:chats,assistantSessionId:args.request.taskId==='task-b'?'chat-b':'chat-a'}
   if(endpoint==='workbench/assistantTranscript')return {status:'ok',sessionId:args.request.sessionId,messages:[]}
   if(endpoint==='workbench/assistantSend')return {status:'ok',sessionId:args.request.sessionId,fromSeq:0}
  }}),user=userEvent.setup()
  await act(async()=>WB.assistant.openFor({kind:'task',id:'task-a',title:'待办甲'}));await waitFor(()=>expect(screen.getByRole('button',{name:'会话：甲会话'}).getAttribute('aria-current')).toBe('true'));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'甲的指令');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(release).toBeTypeOf('function'))
  await act(async()=>WB.assistant.openFor({kind:'task',id:'task-b',title:'待办乙'}));await waitFor(()=>expect(screen.getByRole('button',{name:'会话：乙会话'}).getAttribute('aria-current')).toBe('true'));await act(async()=>release({status:'ok',entries:[{role:'assistant',text:'甲的迟到回复'}],turnEnded:true}));expect(screen.queryByText('甲的迟到回复')).toBeNull()
  await user.type(screen.getByRole('textbox',{name:'助手消息'}),'乙的指令');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(sent).toHaveLength(2));expect(sent.map(row=>[row.request.taskId,row.request.sessionId])).toEqual([['task-a','chat-a'],['task-b','chat-b']])
 })
 it('换待办后本次发送只携带当前待办，不携带上次待办或手动选择的旧引用',async()=>{
  const {WB,sent}=setup(async()=>({status:'ok',entries:[],turnEnded:true})),user=userEvent.setup()
  await waitFor(()=>expect(screen.getByRole('navigation',{name:'助手会话列表'}).querySelector('[aria-current="true"]')?.dataset.sessionId).toBe('one'))
  await act(async()=>{WB.assistant.openFor({kind:'task',id:'previous',title:'上次的问题'});WB.assistant.add({kind:'knowledge',id:'old-manual',title:'上次手动引用'});WB.assistant.close()})
  await act(async()=>WB.assistant.openFor({kind:'task',id:'current',title:'本次待办',body:'只讨论本次的问题'}))
  expect(screen.queryByRole('button',{name:'移除上下文：上次的问题'})).toBeNull();expect(screen.queryByRole('button',{name:'移除上下文：上次手动引用'})).toBeNull();expect(screen.getByRole('button',{name:'移除上下文：本次待办'})).toBeTruthy();expect(sent).toHaveLength(0)
  await user.type(screen.getByPlaceholderText('输入指令，或让我帮你整理待办…'),'分析当前待办');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(sent).toHaveLength(1));expect(sent[0].request.refs).toEqual([{kind:'task',id:'current',title:'本次待办',body:'只讨论本次的问题'}])
 })
 it('没有办公默认会话时不选最新原生研发会话，由Host恢复办公会话并保留待办上下文',async()=>{
  const {WB,transcripts,sent}=setup(async()=>({status:'ok',entries:[],turnEnded:true}),{sessionList:{assistantSessionId:null,sessions:[{id:'development',title:'研发任务 US-1'}]},transcript:{status:'ok',sessionId:'office',title:'办公助手',messages:[]}})
  await act(async()=>WB.assistant.add({kind:'task',id:'office-task',title:'示例待办一'}))
  await waitFor(()=>expect(screen.getByRole('navigation',{name:'助手会话列表'}).querySelector('[aria-current="true"]')?.dataset.sessionId).toBe('office'))
  expect(transcripts).toHaveLength(1);expect(transcripts[0].sessionId).toBeFalsy();expect(WB.store.get().assistantRefs[0].id).toBe('office-task');expect(sent).toHaveLength(0)
 })
 it('空会话列表也恢复办公会话，不保持未知会话状态',async()=>{
  const {transcripts}=setup(async()=>({status:'ok',entries:[],turnEnded:true}),{sessionList:{sessions:[]},transcript:{status:'ok',sessionId:'office-new',title:'办公助手',messages:[]}})
  await waitFor(()=>expect(screen.getByRole('navigation',{name:'助手会话列表'}).querySelector('[aria-current="true"]')?.dataset.sessionId).toBe('office-new'));expect(transcripts).toHaveLength(1)
 })
 it('首个空增量和轮次中空回包都不结束等待，最终回复仍可见',async()=>{
  let polls=0
  setup(async()=>{polls++;return polls<3?{status:'ok',entries:[],nextSeq:polls,turnActive:polls===2,turnEnded:false}:{status:'ok',entries:[{role:'assistant',text:'工具写入已核实'}],nextSeq:3,turnActive:false,turnEnded:true}})
  const user=userEvent.setup();await waitFor(()=>expect(screen.getByRole('navigation',{name:'助手会话列表'}).querySelector('[aria-current="true"]')?.dataset.sessionId).toBe('one'))
  await user.type(screen.getByPlaceholderText('输入指令，或让我帮你整理待办…'),'测试');await user.click(screen.getByRole('button',{name:'发送'}))
  await waitFor(()=>expect(polls).toBe(2),{timeout:2200});expect(screen.getByRole('button',{name:'正在执行'})).toBeTruthy()
  await waitFor(()=>expect(screen.getByText('工具写入已核实')).toBeTruthy(),{timeout:2200});expect(screen.getByRole('button',{name:'发送'})).toBeTruthy()
 },7000)
 it('切换会话后丢弃旧会话晚到回包，完整会话入口使用正确ID',async()=>{
  let release;setup(()=>new Promise(resolve=>{release=resolve}))
  const user=userEvent.setup();await waitFor(()=>expect(screen.getByRole('navigation',{name:'助手会话列表'}).querySelector('[aria-current="true"]')?.dataset.sessionId).toBe('one'))
  await user.type(screen.getByPlaceholderText('输入指令，或让我帮你整理待办…'),'测试');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(release).toBeTypeOf('function'))
  await user.click(screen.getByRole('button',{name:'会话：验收会话二'}))
  await act(async()=>release({status:'ok',entries:[{role:'assistant',text:'旧会话晚到结果'}],nextSeq:1,turnEnded:true,turnActive:false}))
  expect(screen.queryByText('旧会话晚到结果')).toBeNull()
 },6000)
 it('完整会话按钮调用宿主导航，不静默丢失操作',async()=>{
  const {opened}=setup(async()=>({status:'ok',entries:[],turnEnded:true}))
  await waitFor(()=>expect(screen.getByRole('navigation',{name:'助手会话列表'}).querySelector('[aria-current="true"]')?.dataset.sessionId).toBe('one'));const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'在主面板打开该会话'}));expect(opened).toEqual(['one'])
 })
 it('等待模型时可切换打断并提交新指令，旧请求结果不会覆盖新轮次',async()=>{
  let release,polls=0;const {sent}=setup(()=>++polls===1?new Promise(resolve=>{release=resolve}):Promise.resolve({status:'ok',entries:[{role:'assistant',text:'已按新指令停止'}],nextSeq:2,turnEnded:true}))
  const user=userEvent.setup();await waitFor(()=>expect(screen.getByRole('navigation',{name:'助手会话列表'}).querySelector('[aria-current="true"]')?.dataset.sessionId).toBe('one'))
  await user.type(screen.getByPlaceholderText('输入指令，或让我帮你整理待办…'),'旧指令');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(release).toBeTypeOf('function'))
  await user.click(screen.getByRole('button',{name:'排队'}));await user.type(screen.getByPlaceholderText('输入指令，或让我帮你整理待办…'),'停止旧操作');await user.click(screen.getByRole('button',{name:'打断并发送'}))
  await waitFor(()=>expect(sent).toHaveLength(2));expect(sent[1].request.steer).toBe(true)
  await act(async()=>release({status:'ok',entries:[{role:'assistant',text:'过期结果'}],nextSeq:1,turnEnded:true}));expect(screen.queryByText('过期结果')).toBeNull()
  await waitFor(()=>expect(screen.getByText('已按新指令停止')).toBeTruthy())
 },6000)
 it('聊天内可搜索添加、逐项移除、清空上下文，移除后不再随消息发送',async()=>{
  const {WB,sent}=setup(async()=>({status:'ok',entries:[],turnEnded:true}));const user=userEvent.setup()
  await act(async()=>WB.store.set({data:{...WB.store.get().data,tasks:[{id:'context-task',title:'验收方案',description:'可核对的上下文'}]}}))
  await user.click(screen.getByRole('button',{name:'添加上下文'}));await user.type(screen.getByRole('textbox',{name:'搜索上下文'}),'验收')
  const option=screen.getByRole('checkbox',{name:'引用待办：验收方案'});await user.click(option);expect(WB.store.get().assistantRefs).toHaveLength(0);await user.click(screen.getByRole('button',{name:'添加 1 项'}));expect(WB.store.get().assistantRefs).toHaveLength(1)
  await user.click(screen.getByRole('button',{name:'移除上下文：验收方案'}));expect(WB.store.get().assistantRefs).toHaveLength(0)
  await user.click(screen.getByRole('button',{name:'添加上下文'}));await user.click(screen.getByRole('checkbox',{name:'引用待办：验收方案'}));await user.click(screen.getByRole('button',{name:'清空选择'}));expect(WB.store.get().assistantRefs).toHaveLength(0);await user.click(screen.getByRole('button',{name:'添加 0 项'}))
  await user.type(screen.getByPlaceholderText('输入指令，或让我帮你整理待办…'),'本轮无引用');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(sent).toHaveLength(1));expect(sent[0].request.refs).toEqual([])
  expect(screen.getByText('本轮无引用').parentElement.style.color).toBe('var(--dsw-alias-label-primary)')
 })

 it('知识设置从右上角打开，关闭后保留范围并用于后续发送',async()=>{
  const {WB,sent}=setup(async()=>({status:'ok',entries:[],turnEnded:true})),user=userEvent.setup();await act(async()=>WB.store.set({data:{...WB.store.get().data,projects:[{id:'project',name:'项目范围',knowledgeSpaceId:'company'}],knowledgeSpaces:[{id:'company',name:'公司资料'}],sources:[{id:'source',locator:{accountId:'org:me'}}]}}));
  expect(screen.queryByRole('combobox',{name:'知识模式'})).toBeNull();const settings=screen.getByRole('button',{name:'知识设置'});expect(settings.closest('.wb-assistant-head')).toBeTruthy();expect(document.querySelector('.wb-assistant-composer .wb-knowledge-controls')).toBeNull();
  await user.click(settings);await user.selectOptions(screen.getByRole('combobox',{name:'知识模式'}),'only');await user.selectOptions(screen.getByRole('combobox',{name:'聊天知识空间'}),'company');await user.selectOptions(screen.getByRole('combobox',{name:'聊天知识项目'}),'project');await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(settings);
  await user.click(settings);expect(screen.getByRole('combobox',{name:'知识模式'}).value).toBe('only');await user.click(screen.getByRole('button',{name:'完成',exact:true}));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'根据知识回答');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(sent).toHaveLength(1));expect(sent[0].request).toMatchObject({knowledgeMode:'only',projectId:'project',spaceId:'company'})
 })
 it('自动检索无命中仅展示一行提示，正常显示模型回答',async()=>{
  setup(async()=>({status:'ok',entries:[{role:'assistant',text:'这是正常的模型回答'}],turnEnded:true}),{retrieval:{id:'empty',status:'empty',mode:'auto',hits:[],note:'当前范围没有匹配的已确认有效知识'}});const user=userEvent.setup();await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).disabled).toBe(false));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'一般业务规则');await user.click(screen.getByRole('button',{name:'发送'}));await screen.findByText('这是正常的模型回答');expect(screen.getByText('本轮未命中知识库资料').tagName).toBe('P');expect(screen.queryByText(/知识依据 · 0/)).toBeNull();expect(screen.queryByRole('region',{name:'知识检索依据'})).toBeNull()
 })

})
