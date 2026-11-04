import React from 'react'
import {afterEach,it,expect,vi} from 'vitest'
import {render,screen,within,fireEvent,cleanup,waitFor,act} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(()=>{cleanup();vi.restoreAllMocks()})
const a={provider:'alpha',model:'one'},b={provider:'beta',model:'summary'},key=route=>JSON.stringify([route.provider,route.model])
function setup(options={}){
 const {WB}=loadClientBundle(),calls=[];let data={revision:1,settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:false},backgroundModels:options.models||{analysis:null,summary:null}},projects:[],tasks:[{id:'keep',title:'保留的已完成事项',status:'completed'}],sources:[],runs:[],knowledge:[],radar:[],replies:[],analysisQueue:[],candidates:[],jobs:[],connectors:[]}
 let catalog=options.catalog||{available:true,groups:[{id:'alpha',name:'服务商甲',models:[{id:'one',name:'模型一'}]},{id:'beta',name:'服务商乙',models:[{id:'summary',name:'摘要模型'}]}],failedProviders:[]}
 WB.store.set({data,status:'ready',page:'settings'})
 WB.apply({effect:fn=>fn(),get:()=>undefined,connection:{rpc:{call:async(_channel,endpoint,payload)=>{
  calls.push({endpoint,args:payload.args});let value=data
  if(endpoint==='workbench/backgroundModels'){
   const request=payload.args.request
   if(request.action==='catalog')value=await (options.load?options.load():catalog)
   else {if(options.save)await options.save(request);data={...data,revision:data.revision+1,settings:{...data.settings,backgroundModels:{...data.settings.backgroundModels,[request.purpose]:request.model}}};value=data}
  }
  if(endpoint==='workbench/diagnostics')value={counts:{},connectors:[]}
  return {ok:true,value}
 }}},slots:{inject:()=>()=>{},register:()=>()=>{}},locale:{register:()=>()=>{},bind:()=>()=>''}})
 render(<WB.pages.settings/>);return {WB,calls,get data(){return data},setCatalog:value=>{catalog=value}}
}
it('配置中心分别保存识别与摘要模型，写回原快照且不启动业务',async()=>{
 const test=setup();const analysis=await screen.findByRole('combobox',{name:'消息识别模型'}),summary=screen.getByRole('combobox',{name:'资讯摘要模型'});await waitFor(()=>expect(analysis.disabled).toBe(false));const tasks=JSON.stringify(test.data.tasks)
 fireEvent.change(analysis,{target:{value:key(a)}});await waitFor(()=>expect(analysis.value).toBe(key(a)));fireEvent.change(summary,{target:{value:key(b)}});await waitFor(()=>expect(summary.value).toBe(key(b)))
 expect(test.WB.store.get().data.settings.backgroundModels).toEqual({analysis:a,summary:b});expect(JSON.stringify(test.WB.store.get().data.tasks)).toBe(tasks)
 expect(test.calls.filter(row=>row.endpoint==='workbench/backgroundModels').map(row=>row.args.request)).toEqual([{action:'catalog'},{action:'configure',purpose:'analysis',model:a},{action:'configure',purpose:'summary',model:b}]);expect(test.calls.some(row=>/analysisStart|summarize|assistantHub|selectModel/.test(row.endpoint))).toBe(false);expect(screen.getByText('保留历史与已完成进度；不改变 Harness 默认模型。')).toBeTruthy()
})
it('保存中锁定选择，失败显示原因并保留原模型，重试成功后再更新',async()=>{
 let release,failed=true;const test=setup({models:{analysis:a,summary:null},save:()=>failed?new Promise((resolve,reject)=>{release=()=>reject(Error('合成保存失败'))}):Promise.resolve()});const select=await screen.findByRole('combobox',{name:'消息识别模型'});await waitFor(()=>expect(select.disabled).toBe(false));fireEvent.change(select,{target:{value:key(b)}});await waitFor(()=>expect(release).toBeTypeOf('function'));expect(select.disabled).toBe(true);expect(screen.getByRole('combobox',{name:'资讯摘要模型'}).disabled).toBe(true);await act(async()=>release());await screen.findByText('合成保存失败',{selector:'[role=alert]'});expect(select.value).toBe(key(a));expect(test.WB.store.get().data.settings.backgroundModels.analysis).toEqual(a);failed=false;fireEvent.change(select,{target:{value:key(b)}});await waitFor(()=>expect(select.value).toBe(key(b)))
})
it('配置中的模型失效仍展示原选择，可切换到其他可用服务商',async()=>{
 const missing={provider:'offline',model:'old-model'},test=setup({models:{analysis:missing,summary:null},catalog:{available:true,groups:[{id:'beta',name:'服务商乙',models:[{id:'summary',name:'摘要模型'}]}],failedProviders:[{id:'offline'}]}});const select=await screen.findByRole('combobox',{name:'消息识别模型'});await waitFor(()=>expect(select.disabled).toBe(false));expect(select.value).toBe(key(missing));expect(within(select).getByRole('option',{name:/old-model.*当前不可用/})).toBeTruthy();fireEvent.change(select,{target:{value:key(b)}});await waitFor(()=>expect(test.WB.store.get().data.settings.backgroundModels.analysis).toEqual(b));expect(screen.getByText(/部分服务商暂不可用/)).toBeTruthy()
})
it('刷新模型列表保留两类设置，选择沿用只清除对应覆盖',async()=>{
 const test=setup({models:{analysis:a,summary:b}});const select=await screen.findByRole('combobox',{name:'消息识别模型'});await waitFor(()=>expect(select.disabled).toBe(false));test.setCatalog({available:true,groups:[{id:'beta',name:'服务商乙',models:[{id:'summary',name:'摘要模型'}]}]});fireEvent.click(screen.getByRole('button',{name:'刷新模型列表'}));await screen.findByRole('option',{name:/one.*当前不可用/});expect(test.WB.store.get().data.settings.backgroundModels).toEqual({analysis:a,summary:b});fireEvent.change(select,{target:{value:''}});await waitFor(()=>expect(test.WB.store.get().data.settings.backgroundModels).toEqual({analysis:null,summary:b}))
})
it('不支持模型列表的宿主清楚说明并禁止配置',async()=>{
 const test=setup({catalog:{available:false,groups:[],note:'旧宿主不支持读取模型列表'}});await screen.findByText('旧宿主不支持读取模型列表');expect(screen.getByRole('combobox',{name:'消息识别模型'}).disabled).toBe(true);expect(test.calls.some(row=>row.args.request?.action==='configure')).toBe(false)
})
