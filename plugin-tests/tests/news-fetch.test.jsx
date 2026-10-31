import React from 'react'
import {beforeEach,afterEach,it,expect} from 'vitest'
import {render,screen,within,fireEvent,cleanup} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
import {radarFetchOutcome,newsSearchError} from '../../src/shared/news-fetch.ts'
let WB,data,response
beforeEach(()=>{
 WB=loadClientBundle().WB
 data={revision:1,settings:{topics:['AI'],aiExtract:{enabled:false},automation:{enabled:false}},radar:[],projects:[],sources:[],tasks:[],replies:[],candidates:[],jobs:[],analysisQueue:[]};response=data
 WB.store.set({data,status:'ready',page:'radar'})
 WB.apply({effect:fn=>fn(),get:()=>undefined,connection:{rpc:{call:async()=>({ok:true,value:response})}},slots:{inject:()=>()=>{},register:()=>()=>{}},locale:{register:()=>()=>{},bind:()=>()=>''}})
})
afterEach(cleanup)
it.each([
 [null,'error','err'],
 [{added:0,perFeed:[],note:'缺少web服务'},'error','err'],
 [{added:0,perFeed:[{status:'error',note:'认证失败'}]},'error','err'],
 [{added:0,perFeed:[{status:'empty'}]},'empty','info'],
 [{added:0,perFeed:[{status:'ok'}]},'empty','info'],
 [{added:2,perFeed:[{status:'ok'}]},'ok','ok'],
 [{added:1,perFeed:[{status:'ok'},{status:'error'}]},'partial','warn'],
])('抓取报告 %j 如实显示 %s',(report,status,tone)=>expect(radarFetchOutcome(report)).toMatchObject({status,tone}))
it('无可用提供方有配置指导，多提供方冲突和普通错误保留差异',()=>{
 for(const code of ['WEB_PROVIDER_UNAVAILABLE','WEB_PROVIDER_CONFIGURED_MISSING','WEB_PROVIDER_CONFIGURED_UNAVAILABLE'])expect(newsSearchError({code})).toContain('配置并授权搜索服务')
 expect(newsSearchError({code:'WEB_PROVIDER_AMBIGUOUS'})).toContain('指定使用哪一个');expect(newsSearchError(Error('HTTP 403'))).toBe('HTTP 403')
})
it('首次抓取失败不提示成功，资讯页持续显示原因并可打开设置',async()=>{
 response={...data,revision:2,lastRadarFetch:{at:new Date().toISOString(),added:0,perFeed:[{label:'话题 AI',status:'error',note:'宿主未配置可用的联网搜索服务'}]}}
 await WB.actions.fetchRadar();expect(WB.store.get().toasts.at(-1)).toMatchObject({kind:'err',text:expect.stringContaining('未配置可用')})
 render(<WB.pages.radar/>);expect(screen.getByRole('alert').textContent).toContain('未配置可用');fireEvent.click(screen.getByText('查看抓取详情'));expect(screen.getByText(/话题 AI：失败/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'检查资讯配置'}));expect(WB.store.get().page).toBe('settings')
})
it('真实空结果显示暂无新增，首页和资讯页都能查看报告',()=>{
 data.lastRadarFetch={at:new Date().toISOString(),added:0,perFeed:[{status:'empty',label:'话题 AI',note:'搜索服务未返回资讯来源'}]};WB.store.set({data})
 const view=render(<WB.pages.radar/>);expect(screen.getByRole('status').textContent).toContain('暂无新增');view.unmount()
 render(<WB.pages.dashboard/>);const panel=screen.getByText('AI 动态').closest('section');expect(within(panel).getByRole('status').textContent).toContain('暂无新增');expect(within(panel).queryByText('尚未抓取')).toBeNull()
})
