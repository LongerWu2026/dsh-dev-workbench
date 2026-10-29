import React from 'react'
import {afterEach, describe, expect, it} from 'vitest'
import {act, cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(cleanup)
function setup(delta) {
 const {WB}=loadClientBundle();let App;const opened=[],sent=[]
 const fixture={version:2,revision:1,settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:false}},projects:[],tasks:[],sources:[],radar:[],replies:[],analysisQueue:[],jobs:[],knowledge:[],connectors:[],runs:[],audit:[]}
 const call=async(_channel,endpoint,payload)=>{
  const args=payload.args||{};let value=fixture
  if(endpoint==='workbench/analysisStatus')value={entries:[]}
  if(endpoint==='workbench/assistantSessions')value={assistantSessionId:'one',sessions:[{id:'one',title:'验收会话一'},{id:'two',title:'验收会话二'}]}
  if(endpoint==='workbench/assistantTranscript')value={sessionId:args.request.sessionId,messages:[]}
  if(endpoint==='workbench/assistantSend'){sent.push(args);value={status:'ok',sessionId:'one',fromSeq:0}}
  if(endpoint==='workbench/assistantDelta')value=await delta()
  return {ok:true,value}
 }
 WB.store.set({data:fixture,status:'ready',assistantOpen:true})
 WB.apply({get:name=>name==='uiWorkspace'?{openSession:id=>opened.push(id)}:undefined,effect:fn=>fn(),connection:{rpc:{call}},locale:{register:()=>()=>{},bind:()=>()=>''},slots:{inject(_slot,fn){return fn()},register(descriptor,component){if(descriptor.name==='main')App=component;return()=>{}}}})
 render(<App/>);return {WB,opened,sent}
}
describe('助手真实运行时序回归',()=>{
 it('首个空增量和轮次中空回包都不结束等待，最终回复仍可见',async()=>{
  let polls=0
  setup(async()=>{polls++;return polls<3?{status:'ok',entries:[],nextSeq:polls,turnActive:polls===2,turnEnded:false}:{status:'ok',entries:[{role:'assistant',text:'工具写入已核实'}],nextSeq:3,turnActive:false,turnEnded:true}})
  const user=userEvent.setup();await waitFor(()=>expect(screen.getByRole('combobox',{name:'切换原生会话'}).value).toBe('one'))
  await user.type(screen.getByPlaceholderText('输入指令，或让我帮你整理待办…'),'测试');await user.click(screen.getByRole('button',{name:'发送'}))
  await waitFor(()=>expect(polls).toBe(2),{timeout:2200});expect(screen.getByRole('button',{name:'正在执行'})).toBeTruthy()
  await waitFor(()=>expect(screen.getByText('工具写入已核实')).toBeTruthy(),{timeout:2200});expect(screen.getByRole('button',{name:'发送'})).toBeTruthy()
 },7000)
 it('切换会话后丢弃旧会话晚到回包，完整会话入口使用正确ID',async()=>{
  let release;setup(()=>new Promise(resolve=>{release=resolve}))
  const user=userEvent.setup();await waitFor(()=>expect(screen.getByRole('combobox',{name:'切换原生会话'}).value).toBe('one'))
  await user.type(screen.getByPlaceholderText('输入指令，或让我帮你整理待办…'),'测试');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(release).toBeTypeOf('function'))
  await user.selectOptions(screen.getByRole('combobox',{name:'切换原生会话'}),'two')
  await act(async()=>release({status:'ok',entries:[{role:'assistant',text:'旧会话晚到结果'}],nextSeq:1,turnEnded:true,turnActive:false}))
  expect(screen.queryByText('旧会话晚到结果')).toBeNull()
 },6000)
 it('完整会话按钮调用宿主导航，不静默丢失操作',async()=>{
  const {opened}=setup(async()=>({status:'ok',entries:[],turnEnded:true}))
  await waitFor(()=>expect(screen.getByRole('combobox',{name:'切换原生会话'}).value).toBe('one'));const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'在主面板打开该会话'}));expect(opened).toEqual(['one'])
 })
 it('等待模型时可切换打断并提交新指令，旧请求结果不会覆盖新轮次',async()=>{
  let release,polls=0;const {sent}=setup(()=>++polls===1?new Promise(resolve=>{release=resolve}):Promise.resolve({status:'ok',entries:[{role:'assistant',text:'已按新指令停止'}],nextSeq:2,turnEnded:true}))
  const user=userEvent.setup();await waitFor(()=>expect(screen.getByRole('combobox',{name:'切换原生会话'}).value).toBe('one'))
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
  const option=screen.getByRole('button',{name:/待办.*验收方案/});await user.click(option);expect(WB.store.get().assistantRefs).toHaveLength(1)
  await user.click(screen.getByRole('button',{name:'移除上下文：验收方案'}));expect(WB.store.get().assistantRefs).toHaveLength(0)
  await user.click(option);await user.click(screen.getByRole('button',{name:'清空上下文'}));expect(WB.store.get().assistantRefs).toHaveLength(0)
  await user.type(screen.getByPlaceholderText('输入指令，或让我帮你整理待办…'),'本轮无引用');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(sent).toHaveLength(1));expect(sent[0].request.refs).toEqual([])
  expect(screen.getByText('本轮无引用').parentElement.style.color).toBe('var(--dsw-alias-label-primary)')
 })

})
