import React from 'react'
import {describe,it,expect,vi,afterEach} from 'vitest'
import {render,screen,waitFor,cleanup,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(cleanup)
function setup(){
 const {WB}=loadClientBundle(),calls=[]
 WB.rpc=vi.fn(async(method,payload)=>{calls.push({method,request:payload?.request})
  if(method.endsWith('/httpDebug'))return {status:200,headers:{'content-type':'application/json'},text:'{"ok":true}',durationMs:12}
  if(method.endsWith('/mcpConnect'))return {connectionId:'fixture-connection',tools:[{name:'echo',description:'测试工具',inputSchema:{type:'object',properties:{text:{type:'string'}}}}],version:'2025-11-25',durationMs:1}
  if(method.endsWith('/mcpCall'))return {result:{content:[{type:'text',text:'测试返回'}]},durationMs:2}
  if(method.endsWith('/projectRuntime'))return {cwd:'/synthetic/project',commands:[{id:'dev',name:'pnpm run dev',argv:['pnpm','run','dev']}],runs:[],platform:'darwin'}
  return {status:'ok'}
 })
 return {WB,calls}
}
describe('研发协作与联网工具的职责边界',()=>{
 it('离线工具不请求宿主；切换HTTP后才显示联网提示，点击后发送所填参数',async()=>{
  const {WB,calls}=setup(),user=userEvent.setup();render(<WB.pages.toolbox/>);expect(calls).toHaveLength(0)
  await user.click(screen.getByRole('button',{name:/接口调试 HTTP/}));expect(calls).toHaveLength(0)
  expect(screen.getByText('宿主联网调试')).toBeTruthy();expect(screen.queryByText(/本地执行 · 全部计算/)).toBeNull()
  await user.type(screen.getByRole('textbox',{name:'接口请求地址'}),'http://localhost:8080/test');await user.selectOptions(screen.getByRole('combobox',{name:'HTTP 方法'}),'POST');await user.type(screen.getByRole('textbox',{name:'接口请求正文'}),'test-body');await user.click(screen.getByRole('button',{name:'发送请求'}))
  await screen.findByLabelText('调试响应');expect(calls.find(c=>c.method.endsWith('/httpDebug')).request).toMatchObject({url:'http://localhost:8080/test',method:'POST',body:'test-body'})
 })
 it('MCP先发现工具，再按选择和JSON参数调用，离开工具后断开连接',async()=>{
  const {WB,calls}=setup(),user=userEvent.setup();render(<WB.pages.toolbox/>);await user.click(screen.getByRole('button',{name:/MCP 调试 连接/}));await user.type(screen.getByRole('textbox',{name:'MCP 服务地址'}),'http://localhost:3000/mcp');await user.click(screen.getByRole('button',{name:'连接并发现工具'}))
  await screen.findByRole('combobox',{name:'MCP 工具'});expect(screen.getByRole('combobox',{name:'MCP 工具'}).value).toBe('echo');expect(screen.getByRole('textbox',{name:'MCP 服务地址'}).disabled).toBe(true)
  const args=screen.getByRole('textbox',{name:'MCP 工具参数'});await user.clear(args);await user.paste('{"text":"hello"}');await user.click(screen.getByRole('button',{name:'调用所选工具'}));await waitFor(()=>expect(calls.some(c=>c.method.endsWith('/mcpCall'))).toBe(true));expect(calls.find(c=>c.method.endsWith('/mcpCall')).request).toMatchObject({connectionId:'fixture-connection',name:'echo',arguments:'{"text":"hello"}'})
  await user.click(screen.getByRole('button',{name:/JSON 格式化/}));await waitFor(()=>expect(calls.some(c=>c.method.endsWith('/mcpDisconnect'))).toBe(true))
 })
 it('请求中禁止重复发送，可取消，切换工具不会继续等待旧请求',async()=>{
  const {WB,calls}=setup(),user=userEvent.setup();let reject
  const original=WB.rpc;WB.rpc=vi.fn((method,payload)=>method.endsWith('/httpDebug')?new Promise((_,r)=>{reject=r}):original(method,payload))
  render(<WB.pages.toolbox/>);await user.click(screen.getByRole('button',{name:/接口调试 HTTP/}));await user.type(screen.getByRole('textbox',{name:'接口请求地址'}),'http://localhost:8080/slow');await user.click(screen.getByRole('button',{name:'发送请求'}));expect(screen.getByRole('button',{name:'请求中…'}).disabled).toBe(true)
  await user.click(screen.getByRole('button',{name:'停止请求'}));expect(calls.some(c=>c.method.endsWith('/debugCancel'))).toBe(true);reject(new Error('请求已停止'));await screen.findByRole('alert')
 })
 it('研发协作显示项目启动与软件联动，启动只提交项目ID与配置ID',async()=>{
  const {WB,calls}=setup(),user=userEvent.setup();WB.store.set({data:{projects:[{id:'fixture',name:'测试项目',repoPath:'/synthetic/project'}]}});WB.actions.environment=async()=>({git:[],docker:{status:'ok',containers:[]}});WB.actions.github=async()=>({status:'unavailable',note:'fixture'})
  render(<WB.pages.collab/>);const start=await screen.findByRole('button',{name:'启动 pnpm run dev'});expect(calls.some(c=>c.method.endsWith('/projectStart'))).toBe(false)
  await user.click(screen.getByRole('button',{name:'打开 VS Code'}));await user.click(start)
  expect(calls.find(c=>c.method.endsWith('/projectOpen')).request).toEqual({projectId:'fixture',target:'vscode'});expect(calls.find(c=>c.method.endsWith('/projectStart')).request).toEqual({projectId:'fixture',commandId:'dev'})
  expect(screen.queryByRole('button',{name:'发送请求'})).toBeNull()
 })
})
