import React from 'react'
import {beforeEach,afterEach,it,expect} from 'vitest'
import {render,screen,within,fireEvent,cleanup} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
import {radarFetchOutcome,newsSearchError} from '../../src/shared/news-fetch.ts'
let WB,data,response
const publishedDaysAgo=days=>new Date(Date.now()-days*86400000).toISOString()
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
 const view=render(<WB.pages.radar/>);expect(document.querySelector('.wb-news-fetch-status').textContent).toContain('暂无新增');view.unmount()
 render(<WB.pages.dashboard/>);const panel=screen.getByText('AI 动态').closest('section');expect(panel.querySelector('.wb-news-fetch-status').textContent).toContain('暂无新增');expect(within(panel).queryByText('尚未抓取')).toBeNull()
})

it('资讯页不重复展示后台摘要进度，继续提问进入固定资讯会话',()=>{
 data.jobs=[{id:'private-job-id',kind:'summary',status:'completed',result:{processed:2,failures:0,note:'已生成2条摘要'}}];WB.store.set({data})
 render(<WB.pages.radar/>);expect(screen.queryByLabelText('摘要进度')).toBeNull();expect(screen.queryByText('已生成2条摘要')).toBeNull();expect(screen.queryByRole('button',{name:'生成摘要'})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'继续问 AI'}));expect(WB.store.get().page).toBe('assistant');expect(WB.store.get().assistantConversationId).toBe('system:radar')
})
it('已有概览不因运行中或部分失败的后台摘要再显示一块任务状态',()=>{
 data.radar=[{id:'one',title:'研发实践更新',url:'https://example.test/practice',publishedAt:publishedDaysAgo(1)}];data.radarBrief={at:'latest',ids:['one'],overview:'关注模型与研发实践。',status:'done'};data.jobs=[{id:'summary-running',kind:'summary',status:'running'},{id:'summary-completed',kind:'summary',status:'completed',result:{status:'partial',note:'失败条目见 lastRadarSummarize'}}];WB.store.set({data})
 render(<WB.pages.radar/>);expect(screen.getByText('关注模型与研发实践。')).toBeTruthy();expect(screen.queryByLabelText('摘要进度')).toBeNull();expect(screen.queryByText(/lastRadarSummarize/)).toBeNull()
})

it('顶部只展示整批的一份总结，不逐条展开或显示分析分栏',()=>{
 const at=new Date().toISOString();data.radar=[{id:'one',title:'本批模型发布',url:'https://example.test/model',source:'官方动态',publishedAt:at},{id:'two',title:'本批技术发布',url:'https://example.test/tech',source:'官方动态',publishedAt:at}];data.radarBrief={at,ids:['one','two'],status:'done',overview:'本批资讯集中在模型推理能力与智能体工程的进展。模型更新改善了复杂任务处理，工程实践则关注长任务的稳定运行。'};data.lastRadarFetch={at,added:2,perFeed:[{status:'ok'}]};WB.store.set({data});render(<WB.pages.radar/>);const brief=screen.getByRole('region',{name:'AI 技术简报'});expect(within(brief).getByText('资讯集中在模型推理能力与智能体工程的进展。模型更新改善了复杂任务处理，工程实践则关注长任务的稳定运行。')).toBeTruthy();expect(brief.querySelectorAll('.wb-news-batch-text')).toHaveLength(1);expect(brief.querySelectorAll('ol,dl')).toHaveLength(0);expect(within(brief).queryByText('发生了什么')).toBeNull();expect(within(brief).queryByText('有什么用')).toBeNull();expect(within(brief).getByRole('region',{name:'相关资讯'}).closest('details')).toBeNull();fireEvent.click(within(brief).getByRole('button',{name:'继续问 AI'}));expect(WB.store.get().assistantConversationId).toBe('system:radar')
})
it('没有新资讯保留上一批总结，未生成时不把条目摘录拼成总结',()=>{
 const at=new Date().toISOString();data.radar=[{id:'one',title:'模型动态',url:'https://example.test/one',publishedAt:at}];data.radarBrief={at,ids:['one'],overview:'上一批的整体总结。',status:'done'};data.lastRadarFetch={at,added:0,perFeed:[{status:'empty'}]};WB.store.set({data});const view=render(<WB.pages.radar/>);expect(within(screen.getByRole('region',{name:'AI 技术简报'})).getByText(/保留上次简报/)).toBeTruthy();expect(screen.getByText('上一批的整体总结。')).toBeTruthy();view.unmount();data.radarBrief={at,ids:['one'],status:'pending'};data.radar=[{id:'one',title:'模型动态',url:'https://example.test/one',publishedAt:at,excerpt:'不能冒充整批总结的搜索摘录'}];WB.store.set({data});render(<WB.pages.radar/>);const brief=screen.getByRole('region',{name:'AI 技术简报'});expect(within(brief).queryByText('不能冒充整批总结的搜索摘录')).toBeNull();expect(within(brief).getByText(/开启 AI 识别后可生成总结/)).toBeTruthy()
})
it('整批总结运行中和失败有明确回应，可以重试',()=>{
 const at=new Date().toISOString();data.settings.aiExtract.enabled=true;data.radar=[{id:'one',title:'模型动态',url:'https://example.test/one',publishedAt:at}];data.radarBrief={at,ids:['one'],status:'running'};data.jobs=[{kind:'summary',status:'running'}];WB.store.set({data});const view=render(<WB.pages.radar/>);expect(within(screen.getByRole('region',{name:'AI 技术简报'})).getByText(/正在归纳资讯/)).toBeTruthy();view.unmount();data.jobs=[];data.radarBrief={...data.radarBrief,status:'failed',error:'模型暂不可用'};WB.store.set({data});render(<WB.pages.radar/>);const brief=screen.getByRole('region',{name:'AI 技术简报'});expect(within(brief).getByRole('button',{name:'重试总结'})).toBeTruthy();expect(within(brief).getByText(/总结暂不可用/)).toBeTruthy()
})
it('更新详情把RSS订阅和网页查询分组展示，仍属于同一次采集',()=>{
 data.lastRadarFetch={added:2,perFeed:[{channel:'rss',id:'official:openai',label:'OpenAI 官方动态',status:'ok',added:1},{channel:'search',id:'topic:Agent',label:'Agent 搜索',status:'ok',added:1}]};WB.store.set({data});render(<WB.pages.radar/>);fireEvent.click(screen.getByText('查看抓取详情'));expect(screen.getByRole('region',{name:'RSS 订阅'}).textContent).toContain('OpenAI 官方动态');expect(screen.getByRole('region',{name:'网页查询'}).textContent).toContain('Agent 搜索')
})
it('相关资讯原地展开剩余条目，不跳转或改变筛选，单条仍可定位',()=>{
 const at=new Date().toISOString();data.radar=Array.from({length:5},(_,i)=>({id:'source-'+i,title:'来源资讯 '+i,url:'https://example.test/news-'+i,source:'官方动态',publishedAt:at,summary:{change:'实际归纳 '+i}}));data.radarBrief={at,ids:data.radar.map(row=>row.id),overview:'主要介绍研发更新。',status:'done'};WB.store.set({data});render(<WB.pages.radar/>);
 const sources=screen.getByRole('region',{name:'相关资讯'}),buttons=()=>within(sources).getAllByRole('button',{name:/^查看资讯：/});expect(buttons()).toHaveLength(3);const search=screen.getByRole('textbox',{name:'搜索资讯'});fireEvent.change(search,{target:{value:'来源资讯 1'}});
 fireEvent.click(within(sources).getByRole('button',{name:'查看剩余资讯（2）'}));expect(buttons()).toHaveLength(5);expect(WB.store.get().page).toBe('radar');expect(search.value).toBe('来源资讯 1');expect(within(sources).getByRole('button',{name:'收起资讯'}).getAttribute('aria-expanded')).toBe('true');
 fireEvent.click(within(sources).getByRole('button',{name:'收起资讯'}));expect(buttons()).toHaveLength(3);fireEvent.click(within(sources).getByRole('button',{name:'查看资讯：来源资讯 1'}));expect(search.value).toBe('来源资讯 1');expect(document.querySelectorAll('.wb-news-grid>.wb-card')).toHaveLength(1)
})
it.each([0,1,3])('仅有%s条可用资讯时不显示更多入口',count=>{
 data.radar=Array.from({length:count},(_,i)=>({id:'source-'+i,title:'资讯 '+i,url:'https://example.test/'+i,publishedAt:publishedDaysAgo(1)}));data.radar.push({id:'ignored',title:'失效资讯',url:'https://example.test/ignored',availability:'ignored',publishedAt:publishedDaysAgo(1)},{id:'archived',title:'归档资讯',url:'https://example.test/archived',archivedAt:new Date().toISOString(),publishedAt:publishedDaysAgo(1)});data.radarBrief={at:'current',ids:data.radar.map(row=>row.id),overview:'资讯概括。',status:'done'};WB.store.set({data});render(<WB.pages.radar/>);const sources=screen.getByRole('region',{name:'相关资讯'});expect(within(sources).queryByRole('button',{name:/查看剩余资讯|收起资讯|查看全部资讯/})).toBeNull();expect(within(sources).queryAllByRole('button',{name:/^查看资讯：/})).toHaveLength(count)
})
it('同轮概览回写保留已展开资讯，新一轮更新恢复前3条',()=>{
 data.radar=Array.from({length:5},(_,i)=>({id:'source-'+i,title:'资讯 '+i,url:'https://example.test/'+i,publishedAt:publishedDaysAgo(1)}));data.radarBrief={at:'first',ids:data.radar.map(row=>row.id),overview:'资讯概括。',status:'done'};WB.store.set({data});const view=render(<WB.pages.radar/>);const buttons=()=>within(screen.getByRole('region',{name:'相关资讯'})).getAllByRole('button',{name:/^查看资讯：/});fireEvent.click(screen.getByRole('button',{name:'查看剩余资讯（2）'}));data.radarBrief={...data.radarBrief,overview:'更新后的概括。'};WB.store.set({data:{...data}});view.rerender(<WB.pages.radar/>);expect(buttons()).toHaveLength(5);data.radarBrief={...data.radarBrief,at:'next'};WB.store.set({data:{...data}});view.rerender(<WB.pages.radar/>);expect(buttons()).toHaveLength(3)
})
it('按实际发布日期区分近期、历史与待确认，历史支持筛选分页',()=>{
 const older=Array.from({length:40},(_,i)=>({id:'old-'+i,title:'AI 历史研究 '+i,url:'https://example.test/old-'+i,topics:['AI'],publishedAt:publishedDaysAgo(15)}))
 const recent=Array.from({length:4},(_,i)=>({id:'new-'+i,title:'Python 新进展 '+i,url:'https://example.test/new-'+i,topics:['Python'],publishedAt:publishedDaysAgo(i+1),summaryStatus:i===3?'failed':'done'}))
 const deepSeek={id:'deepseek',title:'DeepSeek V4 Preview Release',url:'https://api-docs.deepseek.com/news/news260424/',dateKind:'unknown',fetchedAt:publishedDaysAgo(0)}
 const unknown={id:'unknown',title:'无法核实发布日期',url:'https://example.test/unknown',dateKind:'unknown',fetchedAt:publishedDaysAgo(0)}
 data.radar=[...older,...recent,deepSeek,unknown]
 data.radarBrief={at:'latest',ids:[deepSeek.id,unknown.id,...recent.map(row=>row.id).reverse()],overview:'包含过期资讯的旧概览。',status:'done'}
 WB.store.set({data});render(<WB.pages.radar/>)
 const cards=()=>[...document.querySelectorAll('.wb-news-grid>.wb-card')]
 expect(cards().map(card=>card.querySelector('a').textContent)).toEqual(recent.map(row=>row.title))
 expect(screen.queryByText('包含过期资讯的旧概览。')).toBeNull()
 expect(within(screen.getByRole('region',{name:'相关资讯'})).queryByText(deepSeek.title)).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:/^日期待确认/}))
 expect(cards().map(card=>card.querySelector('a').textContent)).toEqual([unknown.title])
 fireEvent.click(screen.getByRole('button',{name:/^历史资讯/}))
 expect(cards()).toHaveLength(30)
 fireEvent.click(screen.getByRole('button',{name:'下一页'}))
 expect(cards()).toHaveLength(11)
 expect(within(screen.getByRole('region',{name:'历史资讯'})).getByText(deepSeek.title)).toBeTruthy()
 fireEvent.change(screen.getByRole('textbox',{name:'搜索资讯'}),{target:{value:'历史研究'}})
 expect(cards().every(card=>card.textContent.includes('历史研究'))).toBe(true)
})

it.each(['本批','这批','这一批','该批次'])('旧总结以%s开头时界面隐藏任务措辞，原始数据不变',(prefix)=>{
 const overview=prefix+'资讯关注模型能力与研发实践。';data.radar=[{id:'one',title:'模型动态',url:'https://example.test/one',publishedAt:publishedDaysAgo(1)}];data.radarBrief={at:new Date().toISOString(),ids:['one'],overview,status:'done'};WB.store.set({data});render(<WB.pages.radar/>);const brief=screen.getByRole('region',{name:'AI 技术简报'});expect(within(brief).getByText('资讯关注模型能力与研发实践。')).toBeTruthy();expect(brief.textContent).not.toMatch(/本批|这批|这一批|该批次/);expect(WB.store.get().data.radarBrief.overview).toBe(overview)
})

it.each(['dashboard','radar'])('%s 的概览不显示固定来源说明，剩余入口只展开当前更新的资讯',page=>{
 data.radar=Array.from({length:4},(_,i)=>({id:'latest-'+i,title:'最近资讯 '+i,url:'https://example.test/latest-'+i,source:'实际来源',topics:['AI'],publishedAt:publishedDaysAgo(1)}));data.radar.push({id:'history',title:'历史资讯',url:'https://example.test/history'});data.radarBrief={at:'latest',ids:data.radar.slice(0,4).map(row=>row.id),overview:'资讯概括。',status:'done'};WB.store.set({data,page});render(page==='dashboard'?<WB.pages.dashboard/>:<WB.pages.radar/>);const brief=screen.getByRole('region',{name:'AI 技术简报'}),sources=within(brief).getByRole('region',{name:'相关资讯'});expect(brief.textContent).not.toContain('来源：OpenAI');expect(within(brief).queryByRole('button',{name:'查看全部资讯'})).toBeNull();fireEvent.click(within(sources).getByRole('button',{name:'查看剩余资讯（1）'}));expect(within(sources).getAllByRole('button',{name:/^查看资讯：/})).toHaveLength(4);expect(within(sources).queryByText('历史资讯')).toBeNull();expect(WB.store.get().page).toBe(page);if(page==='dashboard')expect(screen.getByRole('button',{name:'全部资讯'})).toBeTruthy()
})
