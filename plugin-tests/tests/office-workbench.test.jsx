import React from 'react'
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
import {render,screen,within,act,fireEvent,cleanup,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
let WB,App,calls,fixture,deferred=[]
beforeEach(()=>{
 const plugin=loadClientBundle();WB=plugin.WB;calls=[];deferred=[]
 fixture={version:2,revision:10,updatedAt:new Date().toISOString(),settings:{topics:['Agent'],feeds:[],automation:{enabled:false},aiExtract:{enabled:false},assistantWidth:384},projects:[],tasks:[],sources:[],runs:[],knowledge:[],radar:[],connectors:[],candidates:[],analysisQueue:[],replies:[],jobs:[],audit:[]}
 const call=async(_channel,endpoint,payload)=>{calls.push({endpoint,args:payload.args});let value=fixture
  if(endpoint==='workbench/snapshot')return new Promise(resolve=>deferred.push(resolve))
  if(endpoint==='workbench/backgroundHistory')value={supported:true,total:2,eligible:1,items:[{id:'old-session',active:false,archived:false,protected:false},{id:'current-session',active:true,archived:false,protected:false}],note:'日志保留'}
  if(endpoint==='workbench/archiveBackgroundHistory')value={archived:1,skipped:0,failed:0,results:[{id:'old-session',status:'archived'}]}
  if(endpoint==='workbench/operationsStatus')value={queue:{pending:2,failed:0,oldestPendingMinutes:5},policy:{dailyCallLimit:0,dailyTokenLimit:0},qualityReviews:[],reminders:[],storageBytes:1024}
  if(endpoint==='workbench/changesPage')value={total:1,items:[{id:'change-test',title:'变更待办',reason:'测试变更',before:{title:'旧标题'},after:{title:'新标题'}}]}
  if(endpoint==='workbench/generateReplyDraft')value={text:'已收到，我核实后回复。'}
  if(endpoint==='workbench/dataPage')value={total:0,items:[]}
  if(endpoint==='workbench/knowledgeRetrieve')value={id:'retrieval-test',status:'ok',query:payload.args.request.query,scope:{},strategy:'local-bm25-chinese',elapsedMs:1,hits:[{id:'kb-test@v1:1',documentId:'kb-test',version:'v1',title:'知识验收规范',text:'发布前先完成灰度验收。',lineStart:1,lineEnd:1}]};
  if(endpoint==='workbench/knowledgeRead')value={hits:[{id:'kb-test@v1:1',documentId:'kb-test',version:'v1',title:'知识验收规范',text:'发布前先完成灰度验收。',lineStart:1,lineEnd:1}]};
  if(endpoint==='workbench/knowledgeTraces')value={items:[]};
  if(endpoint==='workbench/analysisStatus')value={pending:0,failed:0,awaitingHuman:0,done:0,entries:[]}
  if(endpoint==='workbench/diagnostics')value={platform:'test',counts:{},tools:[],dataPath:'/fixture/state.json'}
  if(endpoint==='workbench/backups')value={backups:[]}
  if(endpoint==='workbench/automationStatus')value={enabled:false}
  if(endpoint==='workbench/assistantSessions')value={sessions:[]}
  if(endpoint==='workbench/assistantTranscript')value={entries:[],sessionId:null}
  if(endpoint==='workbench/importMigration')value={status:'preview',incomingTotal:1,countsByColumn:{tasks:1},conflictsByColumn:{tasks:0},mappedProjects:[{id:'p',name:'项目',from:'/old/project',to:'/old/project'}]}
  return {ok:true,value}
 }
 WB.store.set({data:fixture,status:'ready',page:'dashboard'})
 WB.apply({effect:fn=>fn(),get:()=>undefined,connection:{rpc:{call}},slots:{inject(name,fn){fn();return()=>{}},register(descriptor,component){if(descriptor.name==='main')App=component;return()=>{}}},locale:{register:()=>()=>{},bind:()=>()=>''}})
})
afterEach(()=>cleanup())
describe('办公流程与布局入口',()=>{
 it('消息工作时段与资讯间隔分别展示，不把消息同步误写为60分钟',()=>{WB.store.set({data:fixture,page:'settings'});render(<WB.pages.settings/>);expect(screen.getByText('资讯等自动化间隔')).toBeTruthy();expect(screen.getAllByText(/每天北京时间09:00–21:00，每5分钟同步一次/).length).toBeGreaterThan(0)})

 it.each(['dashboard','replies'])('%s刷新实际同步云之家，实际答复后从待回复移出',async(page)=>{
  fixture.replies=[{id:'private-reply',msgId:'private-original',stage:'待回复',contact:'合成同事',snippet:'私聊需答复',taskIds:[],createdAt:new Date().toISOString()}];WB.store.set({data:fixture,page});
  const user=userEvent.setup();render(page==='dashboard'?<WB.pages.dashboard/>:<WB.pages.replies/>);expect(screen.getByText('私聊需答复')).toBeTruthy();
  fixture={...fixture,revision:11,replies:fixture.replies.map(row=>({...row,stage:'已回复'}))};
  await user.click(screen.getByRole('button',{name:page==='dashboard'?'刷新':'同步消息'}));
  await waitFor(()=>expect(calls.some(call=>call.endpoint==='workbench/fetchMentions')).toBe(true));
  expect(screen.queryByText('私聊需答复')).toBeNull();expect(WB.store.get().data.replies[0].stage).toBe('已回复');
 })
  it('顶部目录直接显示多 AI 对话入口，快捷新建可编辑会议字段',async()=>{
  const user=userEvent.setup();const view=render(<App/>);const nav=screen.getByRole('navigation',{name:'工作台导航'})
  expect(nav.className).toContain('wb-topnav');expect(view.container.querySelector('.wb-nav')).toBeNull()
  expect(within(nav).getAllByRole('button',{hidden:true}).length).toBe(11)
  const multiAI=within(nav).getByRole('button',{name:'多 AI 对话'})
  expect(multiAI.parentElement).toBe(nav)
  expect(multiAI.closest('details')).toBeNull()
  await user.click(nav.querySelector('summary'));expect(nav.querySelector('details').open).toBe(true)
  await user.click(screen.getAllByRole('button',{name:'新建待办'})[0]);const type=screen.getByRole('combobox',{name:'事项类型'});await user.selectOptions(type,'meeting');expect(screen.getByLabelText('会议开始')).toBeTruthy();expect(screen.getByLabelText('会议地点')).toBeTruthy()
  expect(nav.querySelector('details').open).toBe(false)
 },10000)
 it('更多目录的选中状态可识别，Escape关闭后回到目录触发器',async()=>{
  WB.store.set({data:fixture,page:'toolbox'});const user=userEvent.setup();render(<App/>);const nav=screen.getByRole('navigation',{name:'工作台导航'});const summary=nav.querySelector('summary')
  expect(summary.textContent).toBe('开发工具箱');expect(summary.parentElement.className).toContain('is-active');await user.click(summary);expect(summary.parentElement.open).toBe(true);await user.keyboard('{Escape}');expect(summary.parentElement.open).toBe(false);expect(document.activeElement).toBe(summary)
 })
 it('十条待回复全部可访问，按Reply ID标记且不操作Task',async()=>{
  fixture.replies=Array.from({length:10},(_,i)=>({id:'reply-'+i,msgId:'m-'+i,stage:'待回复',contact:'同事'+i,snippet:'请求'+i,taskIds:[],createdAt:new Date().toISOString()}));WB.store.set({data:fixture,page:'replies'})
  const user=userEvent.setup();render(<WB.pages.replies/>);expect(screen.getByText('请求9')).toBeTruthy()
  const row=screen.getByText('请求9').closest('article');await user.click(within(row).getByRole('button',{name:'已确认收到'}))
  expect(calls.some(c=>c.endpoint==='workbench/setReplyStage'&&c.args.id==='reply-9'&&c.args.stage==='已确认收到')).toBe(true)
  expect(calls.some(c=>c.endpoint==='workbench/updateTask')).toBe(false)
 })
 it('任务分页仍可通过来源定位到第 35 条并展开',async()=>{
  fixture.tasks=Array.from({length:40},(_,i)=>({id:'page-'+i,title:'分页事项'+i,status:'ready',priority:'normal',tags:[]}));WB.store.set({data:fixture,page:'tasks'});render(<WB.pages.tasks/>);
  expect(screen.queryByText('分页事项34')).toBeNull();await act(async()=>WB.focusTask('page-34'));
  await waitFor(()=>expect(screen.getByText('分页事项34')).toBeTruthy());expect(screen.getByRole('navigation',{name:'列表分页'}).textContent).toContain('2 / 2');
 })
 it('旧快照晚到不会覆盖新revision，后台刷新不会重置任务草稿',async()=>{
  WB.store.set({data:fixture});const older=WB.actions.reload();const newer=WB.actions.reload()
  deferred[1]({ok:true,value:{...fixture,revision:12,tasks:[{id:'new',title:'最新数据'}]}});await newer
  deferred[0]({ok:true,value:{...fixture,revision:11,tasks:[]}});await older
  expect(WB.store.get().data.revision).toBe(12)
  const user=userEvent.setup();render(<App/>);await user.click(screen.getAllByRole('button',{name:'新建待办'})[0])
  const field=screen.getByPlaceholderText('例如：评审 @张三 提到的网关限流方案');await user.type(field,'保留的草稿')
  await act(async()=>WB.store.set({data:{...WB.store.get().data,revision:13}}));expect(field.value).toBe('保留的草稿')
  const nav=screen.getByRole('navigation',{name:'工作台导航'});await user.click(within(nav).getByRole('button',{name:'待回复'}));expect(screen.queryByPlaceholderText('例如：评审 @张三 提到的网关限流方案')).toBeNull();await user.click(screen.getByRole('button',{name:'继续编辑'}));expect(screen.getByPlaceholderText('例如：评审 @张三 提到的网关限流方案').value).toBe('保留的草稿')
 })
 it('迁移输入可达，预检只发送dryRun并展示目录映射',async()=>{
  WB.store.set({data:fixture,page:'settings'});const user=userEvent.setup();render(<WB.pages.settings/>);
  const section=screen.getByRole('region',{name:'迁移导入'});const input=within(section).getByPlaceholderText('在这里粘贴导出的迁移包 JSON')
  fireEvent.change(input,{target:{value:'{"format":"test"}'}});await user.click(within(section).getByRole('button',{name:'预检迁移包'}));await waitFor(()=>expect(screen.getByText(/预检通过 · 1 条/)).toBeTruthy())
  expect(calls.filter(c=>c.endpoint==='workbench/importMigration')[0].args.request.dryRun).toBe(true)
  expect(screen.getByRole('textbox',{name:'目标目录 项目'})).toBeTruthy()
 })
 it('资讯未知日期不冒充发布日期，摘要可展开且编辑入口有接线',async()=>{
  fixture.radar=[{id:'news-one',title:'AI工具发布',source:'test',publishedAt:null,createdAt:'2026-10-28T01:00:00Z',fetchedAt:'2026-10-28T01:00:00Z',url:'https://example.org/news',topics:['Agent'],excerpt:'可核对的原文摘录',summary:{}}];WB.store.set({data:fixture,page:'radar'})
  const user=userEvent.setup();render(<WB.pages.radar/>);expect(screen.getByText(/日期未注明/)).toBeTruthy();expect(screen.getAllByText('AI工具发布')).toHaveLength(1)
  await user.click(screen.getByRole('button',{name:'展开摘要'}));expect(screen.getByText('可核对的原文摘录')).toBeTruthy()
  await user.click(screen.getByRole('button',{name:'这条资讯的操作'}));await user.click(screen.getByRole('button',{name:'编辑四段摘要'}));expect(screen.getByDisplayValue('AI工具发布')).toBeTruthy()
 })
 it('任务中心独立于回复，会议时间可见且事项类型筛选可重置',async()=>{
  fixture.tasks=[{id:'meeting',title:'验收会议',status:'ready',priority:'normal',eventType:'meeting',meetingStart:'2026-10-29T06:00:00Z',tags:[]},{id:'feature',title:'验收开发',status:'ready',priority:'normal',eventType:'feature',tags:[]}];WB.store.set({data:fixture,page:'tasks'})
  const user=userEvent.setup();render(<WB.pages.tasks/>);expect(screen.queryByRole('button',{name:/^待回复 \d/})).toBeNull();expect(screen.getByText(/2026-10-29/)).toBeTruthy()
  await user.click(screen.getByRole('button',{name:'会议'}));expect(screen.queryByText('验收开发')).toBeNull();await user.click(screen.getByRole('button',{name:'重置筛选'}));expect(screen.getByText('验收开发')).toBeTruthy()
 })
 it('只有meetingStart的参会待办进入今日列表、统计和今日筛选，不改写截止时间',async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-29T06:00:00Z'));
  try{
   fixture.tasks=[{id:'broadcast-meeting',title:'参加月度质量星期四',status:'ready',priority:'normal',eventType:'meeting',dueAt:null,meetingStart:'2026-10-29T07:30:00Z',meetingLocation:'A303',tags:[]},{id:'tomorrow-meeting',title:'明天的会议',status:'ready',priority:'normal',eventType:'meeting',dueAt:null,meetingStart:'2026-10-30T07:30:00Z',tags:[]}];WB.store.set({data:fixture,page:'dashboard'});const user=userEvent.setup();render(<App/>);
   expect(screen.getByRole('button',{name:'参加月度质量星期四'})).toBeTruthy();expect(screen.getByText(/会议 .*A303/)).toBeTruthy();expect(screen.queryByText('明天的会议')).toBeNull();expect(WB.taskCounts(fixture).today).toBe(1);
   await user.click(screen.getByRole('button',{name:'今日到期 1'}));expect(screen.getByRole('button',{name:'参加月度质量星期四'})).toBeTruthy();expect(screen.queryByText('明天的会议')).toBeNull();expect(fixture.tasks[0].dueAt).toBeNull();
  }finally{vi.useRealTimers()}
 })
 it('已完成的识别记录可以复核并只重跑选中条目',async()=>{
  fixture.sources=[{id:'source-history',excerpt:'可复核的已识别消息'}];fixture.analysisQueue=[{id:'done-entry',sourceId:'source-history',status:'done',analysis:{summary:'已有判断'}}];WB.store.set({data:fixture,page:'replies'})
  const user=userEvent.setup();render(<WB.pages.replies/>);await user.selectOptions(screen.getByRole('combobox',{name:'识别记录'}),'done');expect(screen.getByText('可复核的已识别消息')).toBeTruthy();await user.click(screen.getByRole('button',{name:'重新识别'}));await waitFor(()=>expect(calls.some(call=>call.endpoint==='workbench/analysisStart'&&call.args.request.onlyIds[0]==='done-entry')).toBe(true))
 })
 it('仅修改标题时保留含空格标签和原截止时间精度',async()=>{
  const task={id:'precision-task',title:'原标题',status:'ready',priority:'normal',dueAt:'2026-10-30T15:59:59.000Z',tags:['AI 识别','待处理']}
  fixture.tasks=[task];WB.store.set({data:fixture,taskForm:{task}})
  const user=userEvent.setup();render(<WB.TaskFormHost/>);const title=screen.getByPlaceholderText('例如：评审 @张三 提到的网关限流方案')
  await user.clear(title);await user.type(title,'只改标题');await user.click(screen.getByRole('button',{name:'保存修改'}))
  const update=calls.find(call=>call.endpoint==='workbench/updateTask');expect(update.args.patch.tags).toEqual(['AI 识别','待处理']);expect(update.args.patch.dueAt).toBe(task.dueAt)
 })
 it('自动化执行期间锁定按钮，错误显示给用户而非静默吞掉',async()=>{
  let rejectRun;WB.actions.automationStatus=async()=>({enabled:true,intervalMinutes:60});WB.actions.automationRun=()=>new Promise((_,reject)=>{rejectRun=reject});const toast=vi.spyOn(WB,'toast')
  const user=userEvent.setup();render(<WB.pages.settings/>);await waitFor(()=>expect(screen.getByRole('button',{name:'立即执行'}).disabled).toBe(false));await user.click(screen.getByRole('button',{name:'立即执行'}))
  expect(screen.getByRole('button',{name:'正在执行…'}).disabled).toBe(true)
  await act(async()=>rejectRun(Error('测试连接失败')));await waitFor(()=>expect(screen.getByRole('button',{name:'立即执行'}).disabled).toBe(false));expect(toast).toHaveBeenCalledWith('自动化失败：测试连接失败','err')
 })
 it('历史暂存和已跳过记录不挤占待处理列表，也没有重新识别入口',async()=>{
  fixture.sources=[{id:'old-source',excerpt:'历史消息样本'}];fixture.analysisQueue=[{id:'old-entry',sourceId:'old-source',status:'historical',reviewReason:'历史暂存消息已跳过'},{id:'skipped-entry',sourceId:'old-source',status:'skipped',reviewReason:'消息早于插件安装日期'}];WB.store.set({data:fixture,page:'replies'})
  const user=userEvent.setup();render(<WB.pages.replies/>);expect(screen.queryByText('历史消息样本')).toBeNull();await user.selectOptions(screen.getByRole('combobox',{name:'识别记录'}),'skipped');expect(screen.getAllByText('历史消息样本')).toHaveLength(2)
  for(const item of screen.getAllByText('历史消息样本'))expect(within(item.closest('article')).queryAllByRole('button')).toHaveLength(0)
  expect(calls.some(call=>/analysisStart|analysisRetry|analyzeConfirm/.test(call.endpoint))).toBe(false)
 })
 it('后台修订号变化后首页识别计数自动更新，不停留在初次进入时',async()=>{
  let done=1;WB.actions.analysisStatus=async()=>({pending:0,failed:0,awaitingHuman:0,done,entries:[]})
  render(<WB.pages.dashboard/>);await waitFor(()=>expect(screen.getByText(/待识别 0 · 待确认 0 · 失败 0 · 完成 1/)).toBeTruthy())
  done=2;await act(async()=>WB.store.set({data:{...fixture,revision:fixture.revision+1}}));await waitFor(()=>expect(screen.getByText(/待识别 0 · 待确认 0 · 失败 0 · 完成 2/)).toBeTruthy())
 })
 it('窗口恢复焦点后自动获取后台新快照，用户无需点刷新',async()=>{
  WB.actions.analysisStatus=async()=>({pending:0,failed:0,awaitingHuman:0,done:WB.store.get().data.analysisQueue.length,entries:[]})
  const view=render(<App/>);await act(async()=>{});fixture={...fixture,revision:fixture.revision+1,analysisQueue:[{id:'focus-new',status:'done'}]}
  await act(async()=>window.dispatchEvent(new Event('focus')));expect(deferred).toHaveLength(1)
  await act(async()=>deferred.shift()({ok:true,value:fixture}));expect(WB.store.get().data.revision).toBe(fixture.revision)
  await waitFor(()=>expect(screen.getByText(/待识别 0 · 待确认 0 · 失败 0 · 完成 1/)).toBeTruthy());view.unmount()
 })
 it('完整采集和本地刷新分开说明，批次数配置接入手动识别',async()=>{
  fixture.settings.aiExtract={enabled:true,batchSize:10};WB.store.set({data:fixture,page:'settings'});const user=userEvent.setup();render(<WB.pages.settings/>);
  expect(screen.getByText(/云之家独立按北京时间09:00–21:00每5分钟同步，页面每12秒读取本地状态/)).toBeTruthy()
  const batch=within(screen.getByText('每批识别消息数').closest('.wb-item')).getByRole('combobox');expect(batch.value).toBe('10');await user.selectOptions(batch,'20');
  expect(calls.some(call=>call.endpoint==='workbench/saveSettings'&&call.args.patch.aiExtract.batchSize===20)).toBe(true)
  await WB.actions.analyzeRun();expect(calls.find(call=>call.endpoint==='workbench/analysisStart').args.request.limit).toBe(10)
 })

 it('首页只展示3条AI动态，不展示失效页和原始错误，更多进入资讯页',async()=>{
  fixture.radar=Array.from({length:5},(_,i)=>({id:'ai-'+i,title:'AI release '+i,url:'https://github.com/example/ai-'+i,topics:['AI'],createdAt:new Date().toISOString(),summary:{}}))
  fixture.radar.push({id:'expired',title:'AI expired article',topics:['AI'],summaryStatus:'failed',summaryAttempts:3,summaryError:'Unable to extract content HTTP 422 auth credential secret',summary:{}})
  WB.store.set({data:fixture});const user=userEvent.setup();render(<WB.pages.dashboard/>);
  expect(screen.getByText('AI 动态')).toBeTruthy();expect(screen.getAllByText(/^AI release /)).toHaveLength(3);expect(screen.queryByText('AI expired article')).toBeNull();expect(screen.queryByText(/auth credential secret/)).toBeNull()
  await user.click(screen.getByRole('button',{name:'全部资讯'}));expect(WB.store.get().page).toBe('radar')
 })
 it('资讯页提供按真实星数排序的新项目入口，已忽略内容退出列表',()=>{
  fixture.radar=[{id:'ignored',title:'失效项目',availability:'ignored',summary:{}}];WB.store.set({data:fixture});render(<WB.pages.radar/>);
  expect(screen.queryByText('失效项目')).toBeNull();const link=screen.getByRole('link',{name:'GitHub 新项目榜'});expect(decodeURIComponent(link.href)).toContain('stars:>100 created:>');expect(link.href).toContain('s=stars')
 })

 it('资讯转待办必须展示确认内容，取消不创建，确认仅提交一次',async()=>{
  fixture.radar=[{id:'practice-news',title:'AI 实践资讯',url:'https://example.org/news',topics:['AI'],summary:{}}];WB.store.set({data:fixture});const user=userEvent.setup();render(<WB.pages.radar/>);
  await user.click(screen.getByRole('button',{name:'这条资讯的操作'}));await user.click(screen.getByRole('button',{name:'添加为我的待办'}));expect(screen.getByText(/将创建「实践：AI 实践资讯」/)).toBeTruthy();expect(calls.some(c=>c.endpoint==='workbench/createTaskFromRadar')).toBe(false)
  await user.click(screen.getByRole('button',{name:'取消'}));expect(calls.some(c=>c.endpoint==='workbench/createTaskFromRadar')).toBe(false)
  await user.click(screen.getByRole('button',{name:'这条资讯的操作'}));await user.click(screen.getByRole('button',{name:'添加为我的待办'}));await user.click(screen.getByRole('button',{name:'确认添加待办'}));expect(calls.filter(c=>c.endpoint==='workbench/createTaskFromRadar')).toHaveLength(1)
 })

 it('预算保存传递明确阈值，变更需打开预览后才能撤销',async()=>{
  WB.store.set({page:'settings'});const user=userEvent.setup();render(<App/>);
  const callsInput=screen.getByRole('spinbutton',{name:'每日后台调用上限'}),tokenInput=screen.getByRole('spinbutton',{name:'每日已知 Token 上限'});
  await user.clear(callsInput);await user.type(callsInput,'20');await user.clear(tokenInput);await user.type(tokenInput,'10000');await user.click(screen.getByRole('button',{name:'保存预算'}));
  expect(calls.find(call=>call.endpoint==='workbench/saveSettings').args.patch.aiPolicy).toEqual({dailyCallLimit:20,dailyTokenLimit:10000});
  await user.click(screen.getByRole('button',{name:'查看变更记录'}));await user.click(await screen.findByRole('button',{name:'查看前后变化'}));
  expect(screen.getByText(/旧标题/)).toBeTruthy();expect(calls.some(call=>call.endpoint==='workbench/undoChange')).toBe(false);
  await user.click(screen.getByRole('button',{name:'撤销这次变更'}));await waitFor(()=>expect(calls.some(call=>call.endpoint==='workbench/undoChange'&&call.args.id==='change-test')).toBe(true));
 })
 it('YAML 列表和嵌套配置可双向转换，拒绝重复键与别名',async()=>{
  WB.store.set({data:fixture,page:'toolbox'});const user=userEvent.setup();render(<WB.pages.toolbox/>);
  await user.click(screen.getByRole('button',{name:/YAML YAML/}));await user.click(screen.getByRole('button',{name:'YAML → JSON'}));
  expect(screen.getByRole('button',{name:'复制'}).disabled).toBe(false);expect(screen.getByText(/"offline"/).textContent).toContain('"browser"');
  const input=screen.getByPlaceholderText(/name: dev-workbench/);fireEvent.change(input,{target:{value:'service:\n  ports:\n    - 80\n    - 443\nname: "a,b"'}});await user.click(screen.getByRole('button',{name:'YAML → JSON'}));expect(screen.getByText(/"ports"/).textContent).toContain('443');
  fireEvent.change(input,{target:{value:'name: first\nname: second'}});await user.click(screen.getByRole('button',{name:'YAML → JSON'}));expect(screen.getByRole('button',{name:'复制'}).disabled).toBe(true);expect(screen.getByText(/Map keys must be unique/)).toBeTruthy();
  fireEvent.change(input,{target:{value:'base: &base [1, 2]\ncopy: *base'}});await user.click(screen.getByRole('button',{name:'YAML → JSON'}));expect(screen.getByRole('button',{name:'复制'}).disabled).toBe(true);
  const original={service:{ports:[80,443]},name:'a,b',notes:'line one\nline two\n'};
  fireEvent.change(input,{target:{value:JSON.stringify(original)}});await user.click(screen.getByRole('button',{name:'JSON → YAML'}));
  const yaml=screen.getByText(/ports:/).textContent;expect(yaml).toContain('443');
  fireEvent.change(input,{target:{value:yaml}});await user.click(screen.getByRole('button',{name:'YAML → JSON'}));expect(JSON.parse(screen.getByText(/"ports"/).textContent)).toEqual(original);
 })
 it('打开历史先选择正确原生Session，未知ID不能仅切换面板并假报成功',()=>{
  const opened=[],panels=[];WB.setNativeSessions({open:id=>{if(id==='missing')throw Error('unknown session');opened.push(id)}});WB.setLayout({selectPanel:panel=>panels.push(panel)});
  expect(WB.openSessionById('archived-real-id')).toBe(true);expect(opened).toEqual(['archived-real-id']);expect(panels).toEqual([]);
  expect(WB.openSessionById('missing')).toBe(false);expect(panels).toEqual([]);WB.setNativeSessions(null);WB.setUiWorkspace(null);expect(WB.openSessionById('unavailable')).toBe(false);
 })
 it('后台归档只提交显式选择的旧会话，当前会话不可选',async()=>{
  WB.store.set({data:fixture,page:'settings'});const user=userEvent.setup();render(<WB.pages.settings/>);await user.click(screen.getByText('管理后台会话历史'));
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:'选择后台会话 current-'}).disabled).toBe(true));
  expect(calls.some(call=>call.endpoint==='workbench/archiveBackgroundHistory')).toBe(false);
  await user.click(screen.getByRole('button',{name:'选择本页旧会话'}));await user.click(screen.getByRole('button',{name:'归档选中会话（1）'}));
  await waitFor(()=>expect(calls.find(call=>call.endpoint==='workbench/archiveBackgroundHistory')?.args.ids).toEqual(['old-session']));expect(screen.getByRole('status').textContent).toContain('已归档 1');
 })
 it('回复草稿生成和保存不发送企业消息、不自动标记已回复',async()=>{
  fixture.replies=[{id:'reply-draft-test',sourceId:'source-draft-test',snippet:'请确认一下进度',stage:'待回复',contact:'测试联系人',taskIds:[]}];fixture.sources=[{id:'source-draft-test',excerpt:'请确认一下进度'}];WB.store.set({page:'replies',data:fixture});const user=userEvent.setup();render(<App/>);
  await user.click(screen.getByRole('button',{name:'生成回复草稿'}));await waitFor(()=>expect(screen.getByRole('textbox',{name:'回复草稿'}).value).toBe('已收到，我核实后回复。'));
  await user.click(screen.getByRole('button',{name:'保存草稿'}));expect(calls.some(call=>call.endpoint==='workbench/saveReplyDraft')).toBe(true);expect(calls.some(call=>call.endpoint==='workbench/setReplyStage')).toBe(false);
  expect(calls.some(call=>/sendMessage|imSend|sendReply/.test(call.endpoint))).toBe(false);
 })
 it.each([
  ['2026-10-28T16:05:09.000Z','2026-10-29 00:05:09（北京时间）'],
  [null,'未知'],
  ['invalid-time','未知'],
 ])('列表、识别队列和确认框使用原消息发出时间 %s',async(sentAt,expected)=>{
  fixture.replies=[{id:'time-reply',sourceId:'time-source',msgId:'time-msg',stage:'待回复',contact:'时间联系人',taskIds:[],createdAt:'2026-10-29T03:00:00Z',updatedAt:'2026-10-29T04:00:00Z'}];
  fixture.sources=[{id:'time-source',provider:'yunzhijia',sender:'时间联系人',excerpt:'核对原消息时间',fetchedAt:'2026-10-29T05:00:00Z',locator:{groupId:'time-group',groupName:'时间讨论组',msgId:'time-msg',accountId:'time-account',sentAt}}];
  fixture.analysisQueue=[{id:'time-entry',sourceId:'time-source',status:'pending'}];WB.store.set({page:'replies',data:fixture});const user=userEvent.setup();render(<WB.pages.replies/>);
  const row=screen.getByText('时间联系人').closest('article');expect(row.textContent).toContain('发出时间：'+expected);expect(row.textContent).not.toContain('2026-10-29T05:00:00Z');
  expect(screen.getByText('待识别').closest('article').textContent).toContain('发出时间：'+expected);
  await user.click(within(row).getByRole('button',{name:'回复'}));fireEvent.change(within(row).getByRole('textbox',{name:'回复草稿'}),{target:{value:'核实后回复'}});await user.click(within(row).getByRole('button',{name:'发送回复'}));
  expect(within(screen.getByRole('dialog')).getByText('原消息发出时间：'+expected)).toBeTruthy();expect(calls.some(c=>c.endpoint==='workbench/sendReply')).toBe(false);
 })
 it('今日待回复摘要显示原消息发出时间',()=>{
  fixture.replies=[{id:'brief-time-reply',sourceId:'brief-time-source',msgId:'brief-time-msg',stage:'待回复',contact:'摘要联系人',snippet:'摘要消息',taskIds:[],createdAt:'2026-10-29T03:00:00Z'}];fixture.sources=[{id:'brief-time-source',sender:'摘要联系人',locator:{sentAt:'2026-10-28T23:15:07+08:00'}}];WB.store.set({page:'dashboard',data:fixture});render(<WB.pages.dashboard/>);
  expect(screen.getByText('发出时间：2026-10-28 23:15:07（北京时间）')).toBeTruthy();
 })
 it.each(['primary','refs'])('今日待办、任务列表、看板及来源详情显示消息发出时间 %s',async(binding)=>{
  fixture.tasks=[{id:'message-time-task',title:'消息时间验收待办',status:'ready',priority:'high',tags:[],sourceRefId:binding==='primary'?'message-time-source':'missing-primary',sourceRefs:binding==='refs'?[{sourceId:'message-time-source'}]:[],createdAt:'2026-10-29T03:00:00Z',dueAt:'2026-10-30T10:00:00Z'}];
  fixture.sources=[{id:'message-time-source',provider:'yunzhijia',title:'消息来源',sender:'时间发件人',fetchedAt:'2026-10-29T05:00:00Z',excerpt:'原消息时间不同于抓取和任务建档时间',locator:{groupId:'time-group',groupName:'时间来源群',sentAt:'2026-08-24T01:32:03.405Z'}}];WB.store.set({data:fixture,page:'dashboard'});const user=userEvent.setup();render(<App/>);
  const expected='消息发出时间：2026-08-24 09:32:03（北京时间）';expect(screen.getByRole('group',{name:'消息来源'}).textContent).toContain(expected);expect(screen.getByRole('group',{name:'消息来源'}).textContent).toContain('发件人：时间发件人 · 来自：时间来源群');
  await act(async()=>WB.go('tasks'));const row=screen.getByRole('button',{name:'消息时间验收待办'}).closest('tr');expect(within(row).getByText('2026-08-24 09:32:03').closest('td').cellIndex).toBe(4);expect(within(row).getByRole('group',{name:'消息来源'}).textContent).toContain('发件人：时间发件人');await user.click(within(row).getByRole('button',{name:'展开来源证据'}));expect(screen.getAllByRole('group',{name:'消息来源'})).toHaveLength(2);expect(screen.getAllByRole('group',{name:'消息来源'}).some(node=>node.textContent.includes(expected))).toBe(true);
  await user.click(screen.getByRole('button',{name:'看板'}));expect(screen.getByRole('group',{name:'消息来源'}).textContent).toContain(expected);expect(fixture.tasks[0].dueAt).toBe('2026-10-30T10:00:00Z');
 })
 it.each([
  ['张三','张三','sender-id','张三'],
  ['BOT-6a50…',null,null,'机器人'],
  ['BOT-6a50…','发布提醒机器人','BOT-6a501234abcd','发布提醒机器人'],
 ])('首页和待回复同时展示发送人及来源群名 %s',async(contact,sender,senderId,expected)=>{
  fixture.replies=[{id:'group-reply',sourceId:sender?'group-source':null,msgId:'group-msg',groupId:'group-id',groupName:'研发协作群',contact,snippet:'@ALL 开发进度',stage:'待回复',taskIds:[]}];
  fixture.sources=sender?[{id:'group-source',provider:'yunzhijia',sender,excerpt:'@ALL 开发进度',locator:{groupId:'group-id',groupName:'研发协作群',msgId:'group-msg',accountId:'account-id',senderId}}]:[];
  WB.store.set({data:fixture,page:'dashboard'});const view=render(<WB.pages.dashboard/>);expect(screen.getByText(expected)).toBeTruthy();expect(screen.getByText('来自：研发协作群')).toBeTruthy();if(expected!==contact)expect(screen.queryByText(contact)).toBeNull();view.unmount();
  const user=userEvent.setup();render(<WB.pages.replies/>);expect(screen.getByText(expected)).toBeTruthy();expect(screen.getByText('来自：研发协作群').closest('article').textContent).toContain('发出时间：未知');await user.type(screen.getByRole('textbox',{name:'搜索待回复'}),'研发协作群');expect(screen.getByText(expected).closest('article').querySelector('p').textContent).toBe('@ALL 开发进度');
 })
 it('群名优先读取原消息，确认框保留来源，缺失时不把会话ID当群名',async()=>{
  fixture.replies=[{id:'origin-reply',sourceId:'origin-source',msgId:'origin-msg',groupId:'group-id',groupName:'旧群名',contact:'张三',snippet:'请确认进度',stage:'待回复',taskIds:[]}];fixture.sources=[{id:'origin-source',provider:'yunzhijia',sender:'张三',excerpt:'请确认进度',locator:{groupId:'group-id',groupName:'当前项目群',msgId:'origin-msg',accountId:'account-id'}}];WB.store.set({data:fixture,page:'replies'});const user=userEvent.setup();render(<WB.pages.replies/>);
  expect(screen.getByText('来自：当前项目群').closest('article').textContent).toContain('发出时间：未知');await user.type(screen.getByRole('textbox',{name:'搜索待回复'}),'当前项目群');await user.click(screen.getByRole('button',{name:'回复'}));fireEvent.change(screen.getByRole('textbox',{name:'回复草稿'}),{target:{value:'确认收到'}});await user.click(screen.getByRole('button',{name:'发送回复'}));expect(within(screen.getByRole('dialog')).getByText('会话：当前项目群')).toBeTruthy();await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'取消'}));
  await user.clear(screen.getByRole('textbox',{name:'搜索待回复'}));await act(async()=>{WB.store.set({data:{...fixture,revision:11,replies:[{...fixture.replies[0],sourceId:null,groupName:'group-id'}],sources:[]}})});expect(screen.getByText('来自：会话名称未知').closest('article').textContent).toContain('发出时间：未知');expect(screen.queryByText('group-id')).toBeNull();expect(calls.some(c=>c.endpoint==='workbench/sendReply')).toBe(false);
 })
 it('回复先展示原消息和最终正文，取消不发送，确认仅发送一次',async()=>{
  fixture.replies=[{id:'send-reply',sourceId:'send-source',msgId:'original-msg',stage:'待回复',groupId:'session-id',groupName:'session-id',contact:'session-id',taskIds:[]}];fixture.sources=[{id:'send-source',provider:'yunzhijia',sender:'张三',excerpt:'请确认最新进度',locator:{groupId:'session-id',groupName:'session-id',msgId:'original-msg',accountId:'account-id',senderId:'sender-id'}}];WB.store.set({page:'replies',data:fixture});const user=userEvent.setup();render(<WB.pages.replies/>);
  expect(screen.getByText('张三')).toBeTruthy();expect(screen.queryByText('session-id')).toBeNull();
  await user.click(screen.getByRole('button',{name:'回复'}));const input=screen.getByRole('textbox',{name:'回复草稿'});expect(screen.getByRole('button',{name:'发送回复'}).disabled).toBe(true);
  fireEvent.change(input,{target:{value:'已收到，核实后答复。\n第二行原样发送'}});await user.click(screen.getByRole('button',{name:'发送回复'}));let dialog=screen.getByRole('dialog');expect(within(dialog).getByText('发件人：张三')).toBeTruthy();expect(within(dialog).getByText('原消息：请确认最新进度')).toBeTruthy();expect(within(dialog).getByText(/第二行原样发送/)).toBeTruthy();expect(calls.some(c=>c.endpoint==='workbench/sendReply')).toBe(false);
  await user.click(within(dialog).getByRole('button',{name:'取消'}));expect(input.value).toContain('第二行原样发送');expect(calls.some(c=>c.endpoint==='workbench/sendReply')).toBe(false);
  await user.click(screen.getByRole('button',{name:'发送回复'}));dialog=screen.getByRole('dialog');await user.dblClick(within(dialog).getByRole('button',{name:'确认发送'}));
  expect(calls.filter(c=>c.endpoint==='workbench/sendReply')).toEqual([{endpoint:'workbench/sendReply',args:{request:{id:'send-reply',text:'已收到，核实后答复。\n第二行原样发送',groupId:'session-id',msgId:'original-msg',accountId:'account-id',confirmed:true}}}]);
  expect(calls.some(c=>c.endpoint==='workbench/setReplyStage')).toBe(false);
 })
 it('发送失败保留输入和待回复状态；缺少原消息定位只能保存或复制',async()=>{
  fixture.replies=[{id:'fail-reply',sourceId:'fail-source',msgId:'original-msg',stage:'待回复',contact:'张三',taskIds:[]}];fixture.sources=[{id:'fail-source',provider:'yunzhijia',sender:'张三',excerpt:'请回复',locator:{groupId:'session-id',msgId:'original-msg',accountId:'account-id'}}];WB.store.set({page:'replies',data:fixture});const user=userEvent.setup();render(<WB.pages.replies/>);
  const rpc=WB.rpc;const mocked=vi.spyOn(WB,'rpc').mockImplementation((endpoint,args)=>endpoint==='workbench/sendReply'?Promise.reject(Error('发送失败，未标记已回复。权限不足')):rpc(endpoint,args));
  await user.click(screen.getByRole('button',{name:'回复'}));fireEvent.change(screen.getByRole('textbox',{name:'回复草稿'}),{target:{value:'人工编辑的回复'}});await user.click(screen.getByRole('button',{name:'发送回复'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'确认发送'}));
  expect((await screen.findByRole('alert')).textContent).toContain('发送失败');expect(screen.getByRole('textbox',{name:'回复草稿'}).value).toBe('人工编辑的回复');expect(fixture.replies[0].stage).toBe('待回复');expect(calls.some(c=>c.endpoint==='workbench/setReplyStage')).toBe(false);mocked.mockRestore();
  await act(async()=>{WB.store.set({data:{...fixture,revision:11,sources:[{id:'fail-source',provider:'manual',excerpt:'本地记录'}]}})});expect(screen.getByRole('button',{name:'发送回复'}).disabled).toBe(true);expect(screen.getByRole('button',{name:'保存草稿'}).disabled).toBe(false);
 })

})

describe('Agent办公执行实际界面',()=>{
 it('选择多条待回复并提交一个批次，日报与待办模板共享入口',async()=>{
  fixture.replies=[1,2].map(n=>({id:'reply-'+n,stage:'待回复',contact:'同事',snippet:'请求'+n}));fixture.tasks=[{id:'task-work',title:'处理工作',status:'ready',priority:'normal'}];WB.store.set({data:fixture,page:'agents'});
  const user=userEvent.setup();render(<WB.pages.agents/>);await user.click(screen.getByRole('button',{name:'新建办公流程'}));
  const dialog=screen.getByRole('dialog');await user.click(within(dialog).getByLabelText('同事：请求1'));await user.click(within(dialog).getByLabelText('同事：请求2'));await user.click(within(dialog).getByRole('button',{name:'加入执行队列'}));
  expect(calls.find(c=>c.endpoint==='workbench/officeWorkflowStart').args).toEqual({kind:'reply_batch',input:{replyIds:['reply-1','reply-2']}})
  await user.click(screen.getByRole('button',{name:'新建办公流程'}));await user.selectOptions(screen.getByRole('combobox',{name:'流程类型'}),'work_report');await user.selectOptions(screen.getByRole('combobox',{name:'报告范围'}),'week');await user.click(screen.getByRole('button',{name:'加入执行队列'}));
  expect(calls.at(-1).args).toEqual({kind:'work_report',input:{period:'week'}})
  await user.click(screen.getByRole('button',{name:'新建办公流程'}));await user.selectOptions(screen.getByRole('combobox',{name:'流程类型'}),'task_assist');await user.selectOptions(screen.getByRole('combobox',{name:'关联待办'}),'task-work');await user.click(screen.getByRole('button',{name:'加入执行队列'}));expect(calls.at(-1).args).toEqual({kind:'task_assist',input:{taskId:'task-work'}})
 })
 it('产物可复制及采纳，取消和继续使用真实作业ID',async()=>{
  fixture.jobs=[{id:'workflow-1',kind:'reply_batch',title:'批量回复草稿',status:'failed',createdAt:new Date().toISOString(),steps:[{id:'reply-1',label:'第一条',status:'completed',artifact:{text:'可用草稿',evidenceIds:['source-1'],at:new Date().toISOString()}},{id:'reply-2',label:'第二条',status:'failed',error:'引用校验失败'}]}];WB.store.set({data:fixture,page:'agents'});
  const user=userEvent.setup();render(<WB.pages.agents/>);await user.click(screen.getByText(/批量回复草稿 · 需处理/));expect(screen.getByText('可用草稿')).toBeTruthy();await user.click(screen.getByRole('button',{name:'存为候选知识'}));expect(calls.at(-1).args.input.reviewState).toBe('candidate');await user.click(screen.getByRole('button',{name:'采纳为回复草稿'}));expect(calls.at(-1).args).toEqual({jobId:'workflow-1',stepId:'reply-1'});
  const copied=vi.spyOn(WB.util,'copy').mockResolvedValue();await user.click(screen.getByRole('button',{name:'复制产物'}));expect(copied).toHaveBeenCalledWith('可用草稿');copied.mockRestore();await user.click(screen.getByRole('button',{name:'继续未完成步骤'}));expect(calls.at(-1).args).toEqual({id:'workflow-1',action:'retry'});
  await act(async()=>{fixture={...fixture,revision:11,jobs:[{...fixture.jobs[0],status:'running'}]};WB.store.set({data:fixture})});await user.click(screen.getByRole('button',{name:'取消后续步骤'}));expect(calls.at(-1).args).toEqual({id:'workflow-1',action:'cancel'});
 })
})


describe('知识库自动检索界面',()=>{
 it('检索测试可打开真实片段原文与版本',async()=>{
  WB.store.set({data:fixture,page:'knowledge'});const user=userEvent.setup();render(<WB.pages.knowledge/>);
  await user.type(screen.getByRole('textbox',{name:'知识检索测试问题'}),'接口发布验收');await user.click(screen.getByRole('button',{name:'测试检索'}));await user.click(screen.getByText(/知识依据 · 1 个片段/));await user.click(screen.getByRole('button',{name:'知识验收规范 · 行1–1'}));
  expect(calls.find(c=>c.endpoint==='workbench/knowledgeRead').args.request.ids).toEqual(['kb-test@v1:1']);expect(screen.getByText('发布前先完成灰度验收。')).toBeTruthy();expect(screen.getByText(/知识版本 v1/)).toBeTruthy()
 })
 it('资料导入作为候选，审核可显式确认项目与有效期',async()=>{
  fixture.knowledge=[{id:'candidate-1',title:'待审核材料',body:'资料正文',reviewState:'candidate',kind:'note',tags:[]}];WB.store.set({data:fixture,page:'knowledge'});const user=userEvent.setup();render(<WB.pages.knowledge/>);
  await user.click(screen.getByRole('button',{name:/审核待确认知识/}));await user.selectOptions(screen.getByRole('combobox',{name:'知识状态'}),'confirmed');await user.click(screen.getByRole('button',{name:'保存修改'}));expect(calls.at(-1).args.patch.reviewState).toBe('confirmed');
  await user.click(screen.getByRole('button',{name:'导入文本资料'}));await user.type(screen.getByRole('textbox',{name:'资料标题'}),'导入验收');await user.type(screen.getByRole('textbox',{name:'资料正文'}),'接口发布前先灰度验收。');await user.click(screen.getByRole('button',{name:'保存为待审核资料'}));expect(calls.at(-1).args.input.reviewState).toBe('candidate')
 })
 it('助手可切换知识模式、项目和账号范围',async()=>{
  fixture.projects=[{id:'p-A',name:'项目A'}];fixture.sources=[{id:'source-A',locator:{accountId:'account-A'}}];WB.store.set({data:fixture,assistantOpen:true});render(<App/>);const user=userEvent.setup();
  await user.click(screen.getByText('知识设置：自动检索'));await user.selectOptions(screen.getByRole('combobox',{name:'知识模式'}),'only');await user.selectOptions(screen.getByRole('combobox',{name:'聊天知识项目'}),'p-A');await user.selectOptions(screen.getByRole('combobox',{name:'聊天知识账号'}),'account-A');expect(screen.getByRole('combobox',{name:'知识模式'}).value).toBe('only');expect(screen.getByRole('combobox',{name:'聊天知识项目'}).value).toBe('p-A')
 })
})
