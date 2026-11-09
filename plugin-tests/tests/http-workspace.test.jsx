import React from 'react'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react'
import {emptyHttpWorkspace,normalizeHttpRequest} from '../../src/shared/http-workspace.ts'
import {loadClientBundle} from './load-plugin.mjs'
import {openTools} from './tool-picker.mjs'

afterEach(cleanup)
const button = name=>screen.getByRole('button',{name})
const click = name=>fireEvent.click(button(name))
const input = (name,value)=>fireEvent.change(screen.getByLabelText(name),{target:{value}})
const request = (name,url,assertions=[])=>normalizeHttpRequest({name,url,method:'GET',headers:{},assertions})
const generated = normalizeHttpRequest({
  name:'查询对账汇总',url:'{{baseUrl}}/summary?period={{period}}',method:'GET',headers:{Authorization:'Bearer {{token}}'},
  assertions:[{kind:'status',expected:200}],
})
function setup(initial=emptyHttpWorkspace(), execute=async()=>({status:200,durationMs:13,text:'{"data":{"total":1240}}',headers:{}})) {
  let workspace = initial
  const {WB} = loadClientBundle()
  WB.rpc = vi.fn(async (endpoint,{request})=>{
    switch (endpoint) {
      case 'workbench/httpWorkspace':
        if (request.action === 'save') workspace = {...request.workspace,revision:workspace.revision+1}
        return structuredClone(workspace)
      case 'workbench/httpDebugGenerate':
        return request.mode === 'request'
          ? {request:generated,basis:'GET /summary'}
          : {assertions:[{kind:'json',path:'$.data.total',expected:1280}],basis:'已确认的对账基准'}
      case 'workbench/httpDebug': return execute(request)
      case 'workbench/debugCancel': return {status:'cancelled'}
      default: throw Error('unexpected RPC '+endpoint)
    }
  })
  const view = render(<WB.pages.toolbox/>)
  openTools();click(/接口调试 HTTP/)
  return {WB,view,workspace:()=>workspace,calls:name=>WB.rpc.mock.calls.filter(([endpoint])=>endpoint==='workbench/'+name).map(([,args])=>args.request)}
}

describe('接口调试工作台',()=>{
  it('审阅 AI 请求与追加断言后显式保存，运行按环境解析并展示业务差异',async()=>{
    const {calls,workspace,view} = setup()
    await screen.findByText('还没有保存的请求')
    click('AI 生成请求')
    input('接口 AI 生成要求','生成查询对账汇总的请求，返回 HTTP 200')
    input('接口依据','GET /summary，period 为查询参数')
    click('生成草稿')
    await screen.findByRole('region',{name:'待采用草稿'})
    expect(screen.getByLabelText('接口请求地址').value).toBe('')
    expect(calls('httpDebug')).toEqual([])
    click('填入编辑器')
    expect(screen.getByLabelText('接口请求地址').value).toBe(generated.url)
    expect(workspace().collections[0].requests).toHaveLength(0)
    click('AI 生成断言')
    input('接口 AI 生成要求','总额应当等于 1280')
    click('生成草稿')
    await screen.findByText('依据 · 已确认的对账基准')
    expect(calls('httpDebugGenerate')[1]).toEqual({mode:'assertions',instruction:'总额应当等于 1280',source:'',method:'GET'})
    click('采用断言草稿')
    click('加入 Collection')
    await screen.findByRole('button',{name:/GET 查询对账汇总/})
    expect(workspace().collections[0].requests[0].assertions).toEqual([
      {kind:'status',expected:200},{kind:'json',path:'$.data.total',expected:1280},
    ])
    click('环境配置')
    input('环境名称','本地联调')
    input('环境基础地址','http://localhost:9000/epm')
    click('保存环境')
    await waitFor(()=>expect(screen.getByLabelText('运行环境').value).toBe(workspace().environments[0]?.id))
    input('运行变量','{"period":"2026 10","token":"fixture-runtime-token"}')
    click('批量运行')
    expect(calls('httpDebug')).toEqual([])
    click('运行所选请求')
    const report = await screen.findByRole('region',{name:'批跑结果'})
    await within(report).findByText('查询对账汇总 · 逐项核对')
    expect(within(report).getByText('1280')).toBeTruthy()
    expect(within(report).getByText('1240')).toBeTruthy()
    expect(within(report).getByRole('button',{name:/HTTP 200.*断言失败/})).toBeTruthy()
    expect(calls('httpDebug')).toEqual([expect.objectContaining({url:'http://localhost:9000/epm/summary?period=2026%2010',headers:{Authorization:'Bearer fixture-runtime-token'}})])
    expect(JSON.stringify(calls('httpWorkspace'))).not.toContain('fixture-runtime-token')
    view.unmount()
    setup(workspace())
    expect(await screen.findByRole('button',{name:/GET 查询对账汇总/})).toBeTruthy()
    expect(screen.getByRole('option',{name:'本地联调'})).toBeTruthy()
  })

  it('按 Collection 顺序运行选中项，预期的 HTTP 400 可通过，未核对和传输错误分别呈现',async()=>{
    const initial = emptyHttpWorkspace()
    initial.environments = [{id:'local',name:'测试',baseUrl:'https://example.test'}]
    initial.collections[0].requests = [
      {...request('无效期间','/invalid',[{kind:'status',expected:400}]),id:'negative'},
      {...request('未勾选','/skip'),id:'skip'},
      {...request('无断言','/unchecked'),id:'unchecked'},
      {...request('服务异常','/error',[{kind:'status',expected:200}]),id:'error'},
    ]
    const {calls} = setup(initial,async ({url})=>{
      if (url.endsWith('/error')) throw Error('测试连接失败')
      return {status:url.endsWith('/invalid')?400:200,durationMs:10,text:'{}',headers:{}}
    })
    await screen.findByRole('button',{name:/GET 无效期间/})
    click('批量运行')
    expect(button('运行所选请求').disabled).toBe(true)
    input('运行环境','local')
    fireEvent.click(screen.getByRole('checkbox',{name:/未勾选/}))
    click('运行所选请求')
    const report = await screen.findByRole('region',{name:'批跑结果'})
    await within(report).findByText('测试连接失败')
    expect(within(report).getByRole('button',{name:/无效期间.*HTTP 400.*通过/})).toBeTruthy()
    expect(within(report).getByRole('button',{name:/无断言.*未配置断言/})).toBeTruthy()
    expect(calls('httpDebug').map(call=>call.url)).toEqual(['https://example.test/invalid','https://example.test/unchecked','https://example.test/error'])
  })

  it('停止批跑会取消在途请求，余下请求保持跳过',async()=>{
    const initial = emptyHttpWorkspace()
    initial.environments = [{id:'local',name:'测试',baseUrl:'https://example.test'}]
    initial.collections[0].requests = [{...request('慢接口','/slow'),id:'slow'},{...request('后续接口','/next'),id:'next'}]
    let reject
    const {calls} = setup(initial,()=>new Promise((_,fail)=>{reject=fail}))
    await screen.findByRole('button',{name:/GET 慢接口/})
    input('运行环境','local')
    click('批量运行');click('运行所选请求')
    click('停止批量运行')
    expect(calls('debugCancel')).toEqual([{requestId:calls('httpDebug')[0].requestId}])
    await act(async()=>{reject(Error('已取消'))})
    const report = screen.getByRole('region',{name:'批跑结果'})
    expect(within(report).getByRole('button',{name:/后续接口.*已跳过/})).toBeTruthy()
    expect(calls('httpDebug')).toHaveLength(1)
  })
})
