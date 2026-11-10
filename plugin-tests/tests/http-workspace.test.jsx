import React from 'react'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react'
import {emptyHttpWorkspace,normalizeHttpRequest,normalizeHttpWorkspace} from '../../src/shared/http-workspace.ts'
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
        if (request.action === 'save') workspace = normalizeHttpWorkspace({...request.workspace,revision:workspace.revision+1})
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
  it.each([{}, {allow:'POST, OPTIONS'}])('空正文 405 显示失败原因与服务端允许的方法 %j',async headers=>{
    setup(emptyHttpWorkspace(),async()=>({status:405,statusText:'Method Not Allowed',durationMs:12,text:'',headers}));
    await screen.findByText('还没有保存的请求');
    input('接口请求地址','https://example.test/api');
    click('发送请求');
    await screen.findByText('已收到响应，但响应正文为空');
    expect(screen.getByRole('alert').textContent).toContain('HTTP 405');
    expect(screen.getByRole('alert').textContent).toContain(headers.allow?'服务端允许的方法：POST, OPTIONS':'服务端未提供 Allow');
    expect(screen.queryByLabelText('调试响应')).toBeNull();
  });

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
    click('加入集合')
    await screen.findByRole('button',{name:/GET 查询对账汇总/})
    expect(workspace().collections[0].requests[0].assertions).toEqual([
      {kind:'status',expected:200},{kind:'json',path:'$.data.total',expected:1280},
    ])
    click('变量')
    for (const [index,[name,value]] of Object.entries([['baseUrl','http://localhost:9000/epm'],['period','2026 10'],['token','fixture-runtime-token']])) {
      click('添加');
      input('变量名称 '+(Number(index)+1),name);
      input('变量值 '+(Number(index)+1),value);
    }
    click('保存')
    await waitFor(()=>expect(workspace().collections[0].variables.token).toBe('fixture-runtime-token'))
    click('运行')
    expect(calls('httpDebug')).toEqual([])
    click('运行全部请求')
    const report = await screen.findByRole('region',{name:'批跑结果'})
    await within(report).findByText('查询对账汇总 · 逐项核对')
    expect(within(report).getByText('1280')).toBeTruthy()
    expect(within(report).getByText('1240')).toBeTruthy()
    expect(within(report).getByRole('button',{name:/HTTP 200.*断言失败/})).toBeTruthy()
    expect(calls('httpDebug')).toEqual([expect.objectContaining({url:'http://localhost:9000/epm/summary?period=2026%2010',headers:{Authorization:'Bearer fixture-runtime-token'}})])
    expect(workspace().collections[0].variables.token).toBe('fixture-runtime-token')
    expect(JSON.stringify(calls('httpDebugGenerate'))).not.toContain('fixture-runtime-token')
    view.unmount()
    setup(workspace())
    expect(await screen.findByRole('button',{name:/GET 查询对账汇总/})).toBeTruthy()
    click('变量')
    expect(screen.getByLabelText('变量值 3').value).toBe('fixture-runtime-token')
    click('GET 查询对账汇总');click('发送请求')
    await screen.findByLabelText('调试响应')
  })

  it('只按当前集合顺序运行全部请求，预期的 HTTP 400 可通过，未核对和传输错误分别呈现',async()=>{
    const initial = emptyHttpWorkspace()
    initial.collections[0].variables = {baseUrl:'https://example.test'}
    initial.collections[0].requests = [
      {...request('无效期间','/invalid',[{kind:'status',expected:400}]),id:'negative'},
      {...request('正常请求','/ok'),id:'ok'},
      {...request('无断言','/unchecked'),id:'unchecked'},
      {...request('服务异常','/error',[{kind:'status',expected:200}]),id:'error'},
    ]
    initial.collections.push({id:'other',name:'其他集合',requests:[{...request('其他请求','https://other.test/never'),id:'never'}]})
    const {calls} = setup(initial,async ({url})=>{
      if (url.endsWith('/error')) throw Error('测试连接失败')
      return {status:url.endsWith('/invalid')?400:200,durationMs:10,text:'{}',headers:{}}
    })
    await screen.findByRole('button',{name:/GET 无效期间/})
    click('运行')
    expect(button('运行全部请求').disabled).toBe(false)
    click('运行全部请求')
    const report = await screen.findByRole('region',{name:'批跑结果'})
    await within(report).findByText('测试连接失败')
    expect(within(report).getByRole('button',{name:/无效期间.*HTTP 400.*通过/})).toBeTruthy()
    expect(within(report).getByRole('button',{name:/无断言.*未配置断言/})).toBeTruthy()
    expect(calls('httpDebug').map(call=>call.url)).toEqual(['https://example.test/invalid','https://example.test/ok','https://example.test/unchecked','https://example.test/error'])
  })

  it('停止批跑会取消在途请求，余下请求保持跳过',async()=>{
    const initial = emptyHttpWorkspace()
    initial.collections[0].variables = {baseUrl:'https://example.test'}
    initial.collections[0].requests = [{...request('慢接口','/slow'),id:'slow'},{...request('后续接口','/next'),id:'next'}]
    let reject
    const {calls} = setup(initial,()=>new Promise((_,fail)=>{reject=fail}))
    await screen.findByRole('button',{name:/GET 慢接口/})
    click('运行');click('运行全部请求')
    click('停止运行')
    expect(calls('debugCancel')).toEqual([{requestId:calls('httpDebug')[0].requestId}])
    await act(async()=>{reject(Error('已取消'))})
    const report = screen.getByRole('region',{name:'批跑结果'})
    expect(within(report).getByRole('button',{name:/后续接口.*已跳过/})).toBeTruthy()
    expect(calls('httpDebug')).toHaveLength(1)
  })
  it('变量隔离、保存失败保留草稿',async()=>{
    const initial=emptyHttpWorkspace();
    initial.environments=[{id:'legacy',name:'旧测试环境',baseUrl:'https://legacy.test/api'}];
    initial.collections[0].variables={baseUrl:'https://first.test',token:'first'};
    initial.collections.push({id:'second',name:'第二集合',requests:[],variables:{baseUrl:'https://second.test',token:'second'}});
    const {WB,calls,workspace}=setup(initial);
    await screen.findByText('还没有保存的请求');
    click('变量');
    input('变量值 1','https://unsaved.test');
    input('变量值 2','draft');
    input('选择集合','second');
    expect(screen.getByLabelText('变量值 2').value).toBe('second');
    input('接口请求地址','{{baseUrl}}/echo');click('发送请求');
    await waitFor(()=>expect(calls('httpDebug').at(-1).url).toBe('https://second.test/echo'));
    input('选择集合','default');
    expect(screen.getByLabelText('变量值 2').value).toBe('draft');
    const rpc=WB.rpc;
    WB.rpc=vi.fn((method,payload)=>method==='workbench/httpWorkspace'&&payload.request.action==='save'?Promise.reject(Error('模拟保存失败')):rpc(method,payload));
    click('保存');await screen.findByText('模拟保存失败');
    expect(workspace().collections[0].variables.token).toBe('first');
    expect(screen.getByLabelText('变量值 2').value).toBe('draft');
    WB.rpc=rpc;
    expect(screen.queryByLabelText('导入旧环境')).toBeNull();
    click('保存');
    await waitFor(()=>expect(workspace().collections[0].variables.baseUrl).toBe('https://unsaved.test'));
    expect(workspace().collections[1].variables.token).toBe('second');
    expect(workspace().environments).toBeUndefined();
    input('变量名称 2','baseUrl');click('保存');
    await screen.findByText('变量名称重复：baseUrl');
    expect(workspace().collections[0].variables.token).toBe('draft');
    click('删除变量 2');click('保存');
    await waitFor(()=>expect(workspace().collections[0].variables).toEqual({baseUrl:'https://unsaved.test'}));
  });

  it('宿主返回成功但漏掉变量时保留表单草稿',async()=>{
    const {WB}=setup();
    await screen.findByText('还没有保存的请求');
    const rpc=WB.rpc;
    WB.rpc=vi.fn(async (method,payload)=>{
      const result=await rpc(method,payload);
      if (method==='workbench/httpWorkspace' && payload.request.action==='save') {
        return {...result,collections:result.collections.map(({variables,...row})=>row)};
      }
      return result;
    });
    click('变量');click('添加');
    input('变量名称 1','baseUrl');input('变量值 1','https://example.test');
    click('保存');
    await screen.findByText(/宿主未确认保存集合变量/);
    expect(screen.getByLabelText('变量值 1').value).toBe('https://example.test');
    expect(screen.getByText('有未保存的修改，请保存后发送请求')).toBeTruthy();
  });

})
