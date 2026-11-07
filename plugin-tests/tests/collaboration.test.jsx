import React from 'react'
import {afterEach,describe,it,expect,vi} from 'vitest'
import {render,screen,waitFor,cleanup,act} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(cleanup)
const projects=[{id:'p1',name:'前端项目',repoPath:'/fixture/front'},{id:'p2',name:'后端项目',repoPath:'/fixture/back'}]
const environment=id=>({projectId:id,at:new Date().toISOString(),git:[{dir:id==='p1'?'/fixture/front':'/fixture/back',label:id+'仓库',status:'ok',branch:id+'-branch',changed:0,staged:0,unstaged:0,untracked:0,files:[]}],docker:{status:'ok',containers:[]}})
function setup(){
 const {WB}=loadClientBundle();WB.store.set({data:{projects:structuredClone(projects)}})
 WB.actions.environment=vi.fn(async({projectId})=>environment(projectId));WB.actions.github=vi.fn()
 WB.rpc=vi.fn(async()=>({entries:[],total:0}))
 return {WB}
}
describe('研发协作项目文件与环境联动',()=>{
 it('项目切换同时更新仓库和文件，统一刷新不再请求启动项及PR/CI',async()=>{
  const {WB}=setup(),user=userEvent.setup();render(<WB.pages.collab/>);await screen.findByText('p1仓库')
  await user.selectOptions(screen.getByRole('combobox',{name:'当前项目'}),'p2');await screen.findByText('p2仓库');expect(screen.queryByText('p1仓库')).toBeNull()
  expect(WB.actions.environment).toHaveBeenLastCalledWith({projectId:'p2',force:false,scope:'repository'});expect(WB.rpc.mock.calls.at(-1)[1].request.projectId).toBe('p2')
  const reads=WB.rpc.mock.calls.length;await user.click(screen.getByRole('button',{name:'刷新项目'}));await waitFor(()=>expect(WB.rpc.mock.calls.length).toBeGreaterThan(reads))
  expect(WB.actions.environment).toHaveBeenLastCalledWith({projectId:'p2',force:true,scope:'repository'});expect(WB.actions.github).not.toHaveBeenCalled();expect(WB.rpc.mock.calls.every(([method])=>method.endsWith('/projectFiles'))).toBe(true)
  expect(screen.queryByText('项目启动与运行')).toBeNull();expect(screen.queryByText('PR 与 CI')).toBeNull()
  for(const title of ['探测范围','环境诊断（本机）','端口占用','Docker 容器','进程 CPU / 内存'])expect(screen.queryByText(title)).toBeNull()
 })
 it('旧项目迟到的环境响应不会覆盖当前项目',async()=>{
  const {WB}=setup(),user=userEvent.setup();let finish
  WB.actions.environment=vi.fn(({projectId})=>projectId==='p1'?new Promise(resolve=>{finish=resolve}):Promise.resolve(environment(projectId)))
  render(<WB.pages.collab/>);await user.selectOptions(screen.getByRole('combobox',{name:'当前项目'}),'p2');await screen.findByText('p2仓库')
  await act(async()=>finish(environment('p1')));expect(screen.queryByText('p1仓库')).toBeNull();expect(screen.getByRole('combobox',{name:'当前项目'}).value).toBe('p2')
 })
 it('较慢的环境探测不会阻塞文件浏览',async()=>{
  const {WB}=setup();let finish;WB.actions.environment=vi.fn(()=>new Promise(resolve=>{finish=resolve}))
  render(<WB.pages.collab/>);await screen.findByText('当前目录为空');expect(screen.getByRole('button',{name:'刷新中…'}).disabled).toBe(true)
  await act(async()=>finish(environment('p1')));await screen.findByRole('button',{name:'刷新项目'})
 })
 it('探测失败保留文件区，手动重试后恢复当前项目状态',async()=>{
  const {WB}=setup(),user=userEvent.setup();WB.actions.environment.mockRejectedValueOnce(Error('环境暂不可用'))
  render(<WB.pages.collab/>);await screen.findByRole('alert');expect(screen.getByText('当前目录为空')).toBeTruthy()
  await user.click(screen.getByRole('button',{name:'刷新项目'}));await screen.findByText('p1仓库');expect(screen.queryByRole('alert')).toBeNull()
 })
})
