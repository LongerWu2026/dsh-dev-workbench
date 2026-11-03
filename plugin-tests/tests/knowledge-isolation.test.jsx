import React from 'react'
import {describe,it,expect,afterEach} from 'vitest'
import {render,screen,fireEvent,waitFor,act,within,cleanup} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(cleanup)
function setup(override){
 const {WB}=loadClientBundle(),calls=[];let App,engine={enabled:false,installed:false,phase:'idle',index:{phase:'idle'}}
 const data={version:2,revision:1,settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:false}},projects:[{id:'A',name:'项目A',knowledgeSpaceId:'company'},{id:'B',name:'项目B',knowledgeSpaceId:'company'}],knowledgeSpaces:[{id:'company',name:'公司资料'},{id:'client',name:'客户资料'}],tasks:[],sources:[{id:'fake',locator:{accountId:'aw-test-account'}}],radar:[],replies:[],analysisQueue:[],jobs:[],connectors:[],runs:[],audit:[],knowledge:[{id:'personal',title:'个人经验',body:'个人技术笔记',kind:'note',reviewState:'confirmed',spaceId:'personal'},{id:'company',title:'公司规范',body:'接口规范',kind:'bookmark',reviewState:'confirmed',spaceId:'company'},{id:'project',title:'项目A接口',body:'接口规范A',kind:'snippet',reviewState:'confirmed',spaceId:'company',projectId:'A'},{id:'other',title:'项目B接口',body:'接口规范B',kind:'note',reviewState:'confirmed',spaceId:'company',projectId:'B'},{id:'client',title:'客户专属',body:'客户规则',kind:'note',reviewState:'confirmed',spaceId:'client'}]}
 WB.store.set({data,status:'ready',page:'knowledge'})
 WB.apply({effect:fn=>fn(),locale:{register:()=>()=>{},bind:()=>()=>''},connection:{rpc:{call:async(_channel,endpoint,payload)=>{const request=payload.args?.request||{};calls.push({endpoint,request,args:payload.args});let value=data
  if(endpoint.endsWith('/knowledgeEngine')){if(request.action==='enable')engine={...engine,enabled:true,installed:true,phase:'ready'};if(request.action==='disable')engine={...engine,enabled:false};if(request.action==='index')engine={...engine,index:{phase:'ready',processed:3,total:3,note:'当前范围索引已更新'}};value=engine}
  if(endpoint.endsWith('/knowledgeRetrieve'))value={id:'r',status:'empty',hits:[],scope:request.scope,note:'未找到资料'}
  if(endpoint.endsWith('/knowledgeTraces'))value={items:[]}
  const result=override?.({endpoint,request,args:payload.args,data,value});if(result!==undefined)value=await result
  return {ok:true,value}
 }}},slots:{inject(_slot,fn){return fn()},register(descriptor,component){if(descriptor.name==='main')App=component;return()=>{}}}})
 render(<App/>);return {WB,calls,data}
}
describe('知识空间与本地语义增强',()=>{
 it('来源账号不再成为知识范围，空间和项目统一过滤所有知识类型',async()=>{
  setup();const user=userEvent.setup();expect(await screen.findByText('个人经验')).toBeTruthy();expect(screen.queryByText('公司规范')).toBeNull();expect(screen.queryByLabelText('账号范围')).toBeNull()
  const space=screen.getByRole('combobox',{name:'检索知识空间'});expect(within(space).queryByRole('option',{name:'aw-test-account'})).toBeNull()
  await user.selectOptions(space,'company');await user.selectOptions(screen.getByRole('combobox',{name:'检索知识项目'}),'A');expect(screen.getByText('公司规范')).toBeTruthy();expect(screen.getByText('项目A接口')).toBeTruthy();expect(screen.queryByText('项目B接口')).toBeNull();expect(screen.queryByText('客户专属')).toBeNull();expect(screen.queryByText('个人经验')).toBeNull()
 })
 it('检索和原文范围随项目传递，切换空间后迟到的旧结果不会显示',async()=>{
  let release;const {calls}=setup(({endpoint,request})=>endpoint.endsWith('/knowledgeRetrieve')?new Promise(resolve=>{release=()=>resolve({id:'old',status:'ok',scope:request.scope,hits:[{id:'old@v:1',title:'旧空间检索结果',lineStart:1,lineEnd:2}]})}):undefined),user=userEvent.setup()
  await user.selectOptions(screen.getByRole('combobox',{name:'检索知识空间'}),'company');await user.selectOptions(screen.getByRole('combobox',{name:'检索知识项目'}),'A');await user.type(screen.getByRole('textbox',{name:'知识检索测试问题'}),'接口规范');await user.click(screen.getByRole('button',{name:'测试检索'}));await waitFor(()=>expect(release).toBeTypeOf('function'));expect(calls.find(call=>call.endpoint.endsWith('/knowledgeRetrieve')).request.scope).toEqual({spaceId:'company',projectId:'A'})
  await user.selectOptions(screen.getByRole('combobox',{name:'检索知识空间'}),'client');await act(async()=>release());expect(screen.queryByRole('region',{name:'知识检索依据'})).toBeNull();expect(screen.getByText('客户专属')).toBeTruthy()
 })
 it('启用、当前范围索引与停用仅调用知识引擎，不创建聊天或上传附件',async()=>{
  const {calls}=setup(),user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'下载并启用（约 47 MB）'}));await screen.findByText('本地模型已就绪');await user.click(screen.getByRole('button',{name:'更新当前范围索引'}));await screen.findByText('当前范围索引已更新');await user.click(screen.getByRole('button',{name:'停用语义增强'}));await screen.findByRole('button',{name:'启用本地语义检索'});expect(calls.filter(call=>call.endpoint.endsWith('/knowledgeEngine')).map(call=>call.request.action).filter(Boolean)).toEqual(['enable','index','disable']);expect(calls.some(call=>/assistant|upload|send/i.test(call.endpoint))).toBe(false)
 })
 it('知识设置管理空间和项目归属，资料编辑保持来源账号为元数据',async()=>{
  const {calls}=setup(),user=userEvent.setup();await user.click(screen.getByRole('button',{name:'管理知识空间'}));await user.type(screen.getByRole('textbox',{name:'新知识空间名称'}),'研发资料');await user.click(screen.getByRole('button',{name:'创建知识空间'}));await waitFor(()=>expect(calls.some(call=>call.request.action==='create')).toBe(true));expect(calls.find(call=>call.request.action==='create').request).toEqual({action:'create',name:'研发资料'})
  await user.click(screen.getByRole('button',{name:'管理知识空间'}));await user.selectOptions(screen.getByRole('combobox',{name:'归属项目'}),'A');await user.selectOptions(screen.getByRole('combobox',{name:'项目归属空间'}),'client');await user.click(screen.getByRole('button',{name:'保存项目归属'}));await waitFor(()=>expect(calls.some(call=>call.request.action==='assignProject')).toBe(true));expect(calls.find(call=>call.request.action==='assignProject').request.spaceId).toBe('client')
 })
})
