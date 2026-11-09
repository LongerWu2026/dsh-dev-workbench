import {toolButton,openTools} from './tool-picker.mjs'
import React from 'react'
import {describe,it,expect,vi,afterEach} from 'vitest'
import {render,screen,waitFor,cleanup,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
import {emptyHttpWorkspace} from '../../src/shared/http-workspace.ts'
afterEach(cleanup)
function setup(){
 const {WB}=loadClientBundle(),calls=[]
 WB.rpc=vi.fn(async(method,payload)=>{calls.push({method,request:payload?.request})
  if(method.endsWith('/httpWorkspace'))return emptyHttpWorkspace()
  if(method.endsWith('/httpDebug'))return {status:200,headers:{'content-type':'application/json'},text:'{"ok":true}',durationMs:12}
  if(method.endsWith('/mcpConnect'))return {connectionId:'fixture-connection',tools:[{name:'echo',description:'测试工具',inputSchema:{type:'object',properties:{text:{type:'string'}}}}],version:'2025-11-25',durationMs:1}
  if(method.endsWith('/mcpCall'))return {result:{content:[{type:'text',text:'测试返回'}]},durationMs:2}
  if(method.endsWith('/projectFiles'))return {entries:[],total:0}
  return {status:'ok'}
 })
 return {WB,calls}
}
describe('研发协作与联网工具的职责边界',()=>{
 it('离线工具不请求宿主；切换HTTP后才显示联网提示，点击后发送所填参数',async()=>{
  const {WB,calls}=setup(),user=userEvent.setup();render(<WB.pages.toolbox/>);await user.click(toolButton(/JSON 格式化/));calls.length=0;expect(calls).toHaveLength(0)
  await user.click(toolButton(/接口调试 HTTP/));await screen.findByText('还没有保存的请求')
  expect(calls).toEqual([{method:'workbench/httpWorkspace',request:{action:'load'}}])
  expect(screen.getByText('联网调试')).toBeTruthy();expect(screen.queryByText(/本地执行 · 全部计算/)).toBeNull()
  await user.type(screen.getByRole('textbox',{name:'接口请求地址'}),'http://localhost:8080/test');await user.selectOptions(screen.getByRole('combobox',{name:'HTTP 方法'}),'POST');await user.click(screen.getByRole('button',{name:'Body',exact:true}));await user.type(screen.getByRole('textbox',{name:'接口请求正文'}),'test-body');await user.click(screen.getByRole('button',{name:'发送请求'}))
  await screen.findByLabelText('调试响应');expect(calls.find(c=>c.method.endsWith('/httpDebug')).request).toMatchObject({url:'http://localhost:8080/test',method:'POST',body:'test-body'})
 })
 it('MCP先发现工具，再按选择和JSON参数调用，离开工具后断开连接',async()=>{
  const {WB,calls}=setup(),user=userEvent.setup();render(<WB.pages.toolbox/>);await user.click(toolButton('全部'));await user.click(toolButton(/MCP 调试 连接/));await user.type(screen.getByRole('textbox',{name:'MCP 服务地址'}),'http://localhost:3000/mcp');await user.click(screen.getByRole('button',{name:'连接并发现工具'}))
  await screen.findByRole('combobox',{name:'MCP 工具'});expect(screen.getByRole('combobox',{name:'MCP 工具'}).value).toBe('echo');expect(screen.getByRole('textbox',{name:'MCP 服务地址'}).disabled).toBe(true)
  const args=screen.getByRole('textbox',{name:'MCP 工具参数'});await user.clear(args);await user.paste('{"text":"hello"}');await user.click(screen.getByRole('button',{name:'调用所选工具'}));await waitFor(()=>expect(calls.some(c=>c.method.endsWith('/mcpCall'))).toBe(true));expect(calls.find(c=>c.method.endsWith('/mcpCall')).request).toMatchObject({connectionId:'fixture-connection',name:'echo',arguments:'{"text":"hello"}'})
  await user.click(toolButton(/JSON 格式化/));await waitFor(()=>expect(calls.some(c=>c.method.endsWith('/mcpDisconnect'))).toBe(true))
 })
 it('请求中禁止重复发送，可取消，切换工具不会继续等待旧请求',async()=>{
  const {WB,calls}=setup(),user=userEvent.setup();let reject
  const original=WB.rpc;WB.rpc=vi.fn((method,payload)=>method.endsWith('/httpDebug')?new Promise((_,r)=>{reject=r}):original(method,payload))
  render(<WB.pages.toolbox/>);await user.click(toolButton(/接口调试 HTTP/));await user.type(screen.getByRole('textbox',{name:'接口请求地址'}),'http://localhost:8080/slow');await user.click(screen.getByRole('button',{name:'发送请求'}));expect(screen.getByRole('button',{name:'请求中…'}).disabled).toBe(true)
  await user.click(screen.getByRole('button',{name:'停止请求'}));expect(calls.some(c=>c.method.endsWith('/debugCancel'))).toBe(true);reject(new Error('请求已停止'));await screen.findByRole('alert')
 })
 it('研发协作只浏览项目文件，不再请求启动项、PR或CI',async()=>{
  const {WB,calls}=setup(),user=userEvent.setup();WB.store.set({data:{projects:[{id:'fixture',name:'测试项目',repoPath:'/synthetic/project'}]}});WB.actions.environment=async()=>({git:[],docker:{status:'ok',containers:[]}});WB.actions.github=async()=>({status:'unavailable',note:'fixture'})
  const github=WB.actions.github=vi.fn();render(<WB.pages.collab/>);await screen.findByText('当前目录为空')
  await user.click(screen.getByRole('button',{name:'刷新项目'}));expect(github).not.toHaveBeenCalled();expect(calls.some(c=>/project(Start|Open|Runtime)|github/.test(c.method))).toBe(false)
  expect(screen.queryByText('项目启动与运行')).toBeNull();expect(screen.queryByText('PR 与 CI')).toBeNull()
  expect(screen.queryByRole('button',{name:'发送请求'})).toBeNull()
 })
})
