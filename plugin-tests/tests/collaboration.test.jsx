import React from 'react'
import {afterEach,describe,it,expect,vi} from 'vitest'
import {render,screen,waitFor,cleanup,within,act} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(cleanup)
const projects=[{id:'p1',name:'前端项目',repoPath:'/fixture/front',launchCommands:[]},{id:'p2',name:'后端项目',repoPath:'/fixture/back',launchCommands:[]}]
const environment=id=>({projectId:id,at:new Date().toISOString(),git:[{dir:id==='p1'?'/fixture/front':'/fixture/back',label:id+'仓库',status:'ok',branch:id+'-branch',changed:0,staged:0,unstaged:0,untracked:0,files:[]}],docker:{status:'ok',containers:[]}})
const github=id=>({projectId:id,at:new Date().toISOString(),status:'ok',prs:{status:'ok',items:[{number:1,title:id+'的PR',state:'OPEN'}]},runs:{status:'ok',items:[]}})
function setup(){
 const {WB}=loadClientBundle();WB.store.set({data:{projects:structuredClone(projects)}})
 WB.actions.environment=vi.fn(async({projectId})=>environment(projectId));WB.actions.github=vi.fn(async({projectId})=>github(projectId))
 let runtime={commands:[{id:'dev',name:'开发服务',argv:['npm','run','dev']},{id:'build',name:'构建项目',argv:['npm','run','build']}],runs:[]}
 WB.rpc=vi.fn(async(method,{request})=>method.endsWith('/projectRuntime')?{...runtime,projectId:request.projectId,at:new Date().toISOString()}:{status:'ok'})
 WB.actions.saveProject=vi.fn(async patch=>{const data=WB.store.get().data;WB.store.set({data:{...data,projects:data.projects.map(row=>row.id===patch.id?{...row,...patch}:row)}})})
 return {WB,setRuntime:value=>{runtime=value}}
}
describe('研发协作项目联动与运行反馈',()=>{
 it('项目切换同时更新仓库、PR/CI和运行区；统一刷新绕过缓存',async()=>{
  const {WB}=setup(),user=userEvent.setup();render(<WB.pages.collab/>);await screen.findByText('p1的PR')
  await user.selectOptions(screen.getByRole('combobox',{name:'当前项目'}),'p2');await screen.findByText('p2的PR');expect(screen.queryByText('p1的PR')).toBeNull()
  expect(WB.actions.environment).toHaveBeenLastCalledWith({projectId:'p2',force:false});expect(WB.actions.github).toHaveBeenLastCalledWith({projectId:'p2',force:false})
  await user.click(screen.getByRole('button',{name:'重新探测'}));await waitFor(()=>expect(WB.actions.github).toHaveBeenLastCalledWith({projectId:'p2',force:true}))
  expect(WB.actions.environment).toHaveBeenLastCalledWith({projectId:'p2',force:true});expect(WB.rpc.mock.calls.some(([method,args])=>method.endsWith('/projectRuntime')&&args.request.projectId==='p2'&&args.request.force)).toBe(true)
  expect(WB.rpc.mock.calls.some(([method])=>method.endsWith('/projectStart'))).toBe(false)
 })
 it('旧项目迟到的仓库、PR和运行响应不会覆盖新项目',async()=>{
  const {WB}=setup(),user=userEvent.setup();let finishEnvironment,finishGithub,finishRuntime
  WB.actions.environment=vi.fn(({projectId})=>projectId==='p1'?new Promise(resolve=>{finishEnvironment=resolve}):Promise.resolve(environment(projectId)))
  WB.actions.github=vi.fn(({projectId})=>projectId==='p1'?new Promise(resolve=>{finishGithub=resolve}):Promise.resolve(github(projectId)))
  const rpc=WB.rpc;WB.rpc=vi.fn((method,payload)=>method.endsWith('/projectRuntime')&&payload.request.projectId==='p1'?new Promise(resolve=>{finishRuntime=resolve}):rpc(method,payload))
  render(<WB.pages.collab/>);await user.selectOptions(screen.getByRole('combobox',{name:'当前项目'}),'p2');await screen.findByText('p2的PR')
  await act(async()=>{finishEnvironment(environment('p1'));finishGithub(github('p1'));finishRuntime({commands:[{id:'old',name:'旧项目命令',argv:['node','old.js']}],runs:[]})})
  expect(screen.queryByText('p1的PR')).toBeNull();expect(screen.queryByRole('button',{name:'启动 旧项目命令'})).toBeNull();expect(screen.getByRole('combobox',{name:'当前项目'}).value).toBe('p2')
 })
 it('PR失败时保留成功的CI，不把失败显示成空列表',async()=>{
  const {WB}=setup();WB.actions.github=vi.fn(async()=>({status:'partial',prs:{status:'error',note:'GitHub 登录失效'},runs:{status:'ok',items:[{id:3,workflow:'已成功读取的流水线',conclusion:'success'}]}}))
  render(<WB.pages.collab/>);await screen.findByText('GitHub 登录失效');expect(screen.getByText('已成功读取的流水线')).toBeTruthy();expect(screen.queryByText('当前仓库没有打开的 PR。')).toBeNull();expect(screen.getByText('部分失败')).toBeTruthy()
 })
 it('已返回的PR与CI立即显示，不被较慢的环境探测阻塞',async()=>{
  const {WB}=setup();let finish;WB.actions.environment=vi.fn(()=>new Promise(resolve=>{finish=resolve}))
  render(<WB.pages.collab/>);await screen.findByText('p1的PR');expect(screen.getByRole('button',{name:'探测中…'}).disabled).toBe(true)
  await act(async()=>finish(environment('p1')));await screen.findByRole('button',{name:'重新探测'})
 })
 it('表单保存参数空格、常用标记和服务地址，保留项目其他字段且不自动启动',async()=>{
  const {WB}=setup(),user=userEvent.setup();const data=WB.store.get().data;data.projects[0].launchCommands=[{id:'custom',name:'本地服务',argv:['node','server with spaces.js']}]
  render(<WB.pages.collab/>);await screen.findByRole('button',{name:'启动 开发服务'});expect(screen.getByRole('button',{name:'启动 构建项目'}).closest('details').open).toBe(false)
  await user.click(screen.getByRole('button',{name:'启动配置'}));expect(screen.getByRole('textbox',{name:'启动参数 1'}).value).toBe('server with spaces.js')
  await user.type(screen.getByRole('textbox',{name:'服务地址 1'}),'http://localhost:3000/health');await user.click(screen.getByRole('button',{name:'保存启动配置'}))
  await waitFor(()=>expect(WB.actions.saveProject).toHaveBeenCalledTimes(1));expect(WB.actions.saveProject.mock.calls[0][0]).toEqual({id:'p1',repoPath:'/fixture/front',launchCommands:[{id:'custom',name:'本地服务',argv:['node','server with spaces.js'],common:true,serviceUrl:'http://localhost:3000/health'}]})
  expect(WB.store.get().data.projects[0].name).toBe('前端项目');expect(WB.rpc.mock.calls.some(([method])=>method.endsWith('/projectStart'))).toBe(false)
 })
 it('可以从发现脚本生成配置，非法远端服务地址不会保存',async()=>{
  const {WB}=setup(),user=userEvent.setup();render(<WB.pages.collab/>);await screen.findByRole('button',{name:'启动 开发服务'});await user.click(screen.getByRole('button',{name:'启动配置'}))
  await user.selectOptions(screen.getByRole('combobox',{name:'从项目脚本添加'}),'dev');expect(screen.getByRole('textbox',{name:'启动参数 1'}).value).toBe('run\ndev')
  await user.type(screen.getByRole('textbox',{name:'服务地址 1'}),'https://example.com/health');await user.click(screen.getByRole('button',{name:'保存启动配置'}));await screen.findByRole('alert');expect(WB.actions.saveProject).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button',{name:'取消'}));expect(screen.queryByRole('form',{name:'项目启动配置'})).toBeNull()
 })
 it('重新保存已有配置保留显式空参数及非常用标记',async()=>{
  const {WB}=setup(),user=userEvent.setup();WB.store.get().data.projects[0].launchCommands=[{id:'empty',name:'空参数',argv:['node','-e',''],common:false}]
  render(<WB.pages.collab/>);await screen.findByRole('button',{name:'启动 开发服务'});await user.click(screen.getByRole('button',{name:'启动配置'}));await user.click(screen.getByRole('button',{name:'保存启动配置'}))
  await waitFor(()=>expect(WB.actions.saveProject).toHaveBeenCalledTimes(1));expect(WB.actions.saveProject.mock.calls[0][0].launchCommands[0]).toMatchObject({argv:['node','-e',''],common:false})
 })
 it('启动中、进程运行和地址可访问分别呈现，只有确认可访问才提供打开服务',async()=>{
  const {WB,setRuntime}=setup(),user=userEvent.setup(),run={id:'run',name:'服务',argv:['node','server.js'],startedAt:new Date().toISOString(),status:'running'}
  setRuntime({commands:[],runs:[{...run,service:{status:'checking',url:'http://localhost:3000/'}}]});render(<WB.pages.collab/>);await screen.findByText('正在检测服务地址…');expect(screen.queryByRole('link',{name:'打开服务'})).toBeNull()
  setRuntime({commands:[],runs:[{...run,service:{status:'reachable',url:'http://localhost:3000/',httpStatus:200}}]});await user.click(screen.getByRole('button',{name:'刷新运行状态'}));await screen.findByRole('link',{name:'打开服务'});expect(screen.getByText(/服务地址可访问/)).toBeTruthy()
  setRuntime({commands:[],runs:[{...run,service:{status:'notConfigured'}}]});await user.click(screen.getByRole('button',{name:'刷新运行状态'}));await screen.findByText('未配置服务地址，尚未检测就绪状态');expect(screen.queryByRole('link',{name:'打开服务'})).toBeNull()
 })
})
