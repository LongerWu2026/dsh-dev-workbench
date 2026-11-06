import {toolButton,openTools} from './tool-picker.mjs'
import React from 'react'
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
import {render,screen,within,act,fireEvent,cleanup,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
import {version} from '../../package.json'
let WB,App,calls,fixture,deferred=[],feedSaveError
beforeEach(()=>{
 const plugin=loadClientBundle();WB=plugin.WB;calls=[];deferred=[];feedSaveError=null
 fixture={version:2,revision:10,updatedAt:new Date().toISOString(),settings:{topics:['Agent'],feeds:[],automation:{enabled:false},aiExtract:{enabled:false},assistantWidth:384},projects:[],tasks:[],sources:[],runs:[],knowledge:[],radar:[],connectors:[],candidates:[],analysisQueue:[],replies:[],jobs:[],audit:[]}
 const call=async(_channel,endpoint,payload)=>{calls.push({endpoint,args:payload.args});let value=fixture
  if(endpoint==='workbench/snapshot')return new Promise(resolve=>deferred.push(resolve))
  if(endpoint==='workbench/backgroundHistory')value={supported:true,total:2,eligible:1,items:[{id:'old-session',active:false,archived:false,protected:false},{id:'current-session',active:true,archived:false,protected:false}],note:'日志保留'}
  if(endpoint==='workbench/archiveBackgroundHistory')value={archived:1,skipped:0,failed:0,results:[{id:'old-session',status:'archived'}]}
  if(endpoint==='workbench/saveSettings'&&payload.args.patch?.feeds){
   if(feedSaveError)throw Error(feedSaveError)
   fixture={...fixture,revision:fixture.revision+1,settings:{...fixture.settings,feeds:payload.args.patch.feeds}}
   value=fixture
  }
  if(endpoint==='workbench/generateReplyDraft')value={text:'已收到，我核实后回复。'}
  if(endpoint==='workbench/dataPage')value={total:0,items:[]}
  if(endpoint==='workbench/knowledgeRetrieve')value={id:'retrieval-test',status:'ok',query:payload.args.request.query,scope:{},strategy:'local-bm25-chinese',elapsedMs:1,hits:[{id:'kb-test@v1:1',documentId:'kb-test',version:'v1',title:'知识验收规范',text:'发布前先完成灰度验收。',lineStart:1,lineEnd:1}]};
  if(endpoint==='workbench/knowledgeRead')value={hits:[{id:'kb-test@v1:1',documentId:'kb-test',version:'v1',title:'知识验收规范',text:'发布前先完成灰度验收。',lineStart:1,lineEnd:1}]};
  if(endpoint==='workbench/knowledgeTraces')value={items:[]};
  if(endpoint==='workbench/refreshStart')value={id:'fixture-refresh',scope:payload.args.request.scope,status:'completed',collecting:false,steps:{messages:{status:'completed',note:'已同步'}}};
  if(endpoint==='workbench/revision')value={revision:fixture.revision};
  if(endpoint==='workbench/analysisStatus')value={pending:0,failed:0,awaitingHuman:0,done:0,entries:[]}
  if(endpoint==='workbench/backups')value={backups:[]}
  if(endpoint==='workbench/automationStatus')value={enabled:false}
  if(endpoint==='workbench/assistantSessions')value={sessions:[]}
  if(endpoint==='workbench/assistantTranscript')value={entries:[],sessionId:null}
  if(endpoint==='workbench/assistantHub'&&payload.args.request?.action==='operate')value={status:'ok',note:'方案已进入当前待办会话',job:{jobId:'fixture-task-assist',status:'queued'}}
  if(endpoint==='workbench/importMigration')value={status:'preview',incomingTotal:1,countsByColumn:{tasks:1},conflictsByColumn:{tasks:0},mappedProjects:[{id:'p',name:'项目',from:'/old/project',to:'/old/project'}]}
  return {ok:true,value}
 }
 WB.store.set({data:fixture,status:'ready',page:'dashboard'})
 WB.apply({effect:fn=>fn(),get:()=>undefined,connection:{rpc:{call}},slots:{inject(name,fn){fn();return()=>{}},register(descriptor,component){if(descriptor.name==='main')App=component;return()=>{}}},locale:{register:()=>()=>{},bind:()=>()=>''}})
})
afterEach(()=>cleanup())
describe('办公流程与布局入口',()=>{
 it('待办详情内嵌原消息图片，待回复点击后交给 Harness 原生侧栏',async()=>{
  const account='org:fixture',sourceId='image-source'
  fixture.messageInbox={accountId:account,conversations:[]}
  fixture.sources=[{id:sourceId,provider:'yunzhijia',title:'带图消息',excerpt:'请处理 [图片]',locator:{groupId:'g',msgId:'m',accountId:account,imageIds:['img']}}]
  const task={id:'task-image',title:'检查图片证据',description:'含图片',status:'ready',priority:'normal',sourceRefId:sourceId,tags:[]}
  fixture.tasks=[task]
  fixture.replies=[{id:'reply-image',sourceId,msgId:'m',stage:'待回复',contact:'测试同事',taskIds:[],snippet:'请处理 [图片]'}]
  WB.store.set({data:fixture,page:'tasks'})
  const path='/tmp/图证.png'
  const read=vi.spyOn(WB.actions,'sourceImages').mockImplementation(async request=>request.mode==='open'?{path}:{mediaType:'image/png',data:'aW1hZ2U='})
  WB.openHarnessFile=vi.fn().mockResolvedValue(true)
  const view=render(<WB.pages.tasks/>)
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'展开来源证据'}))
  expect((await screen.findByRole('img',{name:'原消息图片 1'})).getAttribute('src')).toBe('data:image/png;base64,aW1hZ2U=')
  expect(read).toHaveBeenCalledWith({sourceId,index:0,mode:'inline'})
  view.unmount();read.mockClear()
  WB.store.set({data:fixture,page:'replies'})
  render(<WB.pages.replies/>)
  const button=await screen.findByRole('button',{name:'查看图片 1'})
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(button)
  await waitFor(()=>expect(WB.openHarnessFile).toHaveBeenCalledWith(path))
  expect(read).toHaveBeenCalledWith({sourceId,index:0,mode:'open'})
 })
 it('旧待办详情自动补查图片，描述按正文显示且可切换编辑',async()=>{
  const accountId='org:fixture'
  fixture.messageInbox={accountId,conversations:[]}
  const source={id:'legacy',provider:'yunzhijia',excerpt:'[图片] 请核对',locator:{groupId:'g',msgId:'m',accountId}}
  fixture.sources=[source,{...source,id:'duplicate'}]
  const task={id:'task-image',title:'核对旧图片',description:'请先看 [图片] 再核对',status:'ready',priority:'normal',sourceRefId:source.id,sourceRefs:[{sourceId:'duplicate'}],tags:[]}
  fixture.tasks=[task]
  WB.store.set({data:fixture,page:'tasks'})
  const images=vi.spyOn(WB.actions,'sourceImages').mockImplementation(async request=>request.mode==='list'?{count:1}:{mediaType:'image/png',data:'aW1hZ2U='})
  render(<App/>)
  await act(async()=>WB.openTaskForm(task))
  const description=screen.getByRole('region',{name:'描述'})
  expect(within(description).getByText(/请先看.*再核对/)).toBeTruthy()
  expect(within(description).queryByRole('textbox')).toBeNull()
  const image=await within(description).findByRole('img',{name:'原消息图片 1'})
  expect(image.getAttribute('src')).toContain('data:image/png;')
  expect(image.style.maxHeight).toBe('88px')
  const inline=image.closest('button').parentElement
  expect(inline.previousSibling.textContent).toBe('请先看 ')
  expect(inline.nextSibling.textContent).toBe(' 再核对')
  expect(images.mock.calls).toEqual([[{sourceId:'legacy',mode:'list'}],[{sourceId:'legacy',index:0,mode:'inline'}]])
  fireEvent.click(within(description).getByRole('button',{name:'编辑描述'}))
  fireEvent.change(within(description).getByRole('textbox',{name:'描述'}),{target:{value:'更新说明'}})
  fireEvent.click(within(description).getByRole('button',{name:'完成编辑'}))
  expect(within(description).getByText('更新说明')).toBeTruthy()
  expect(within(description).getByRole('img',{name:'原消息图片 1'})).toBeTruthy()
 })
 it('多条原消息遇到旧 Host 时只显示一条可操作提示',async()=>{
  const accountId='org:fixture'
  fixture.messageInbox={accountId,conversations:[]}
  fixture.sources=['s1','s2'].map(id=>({id,provider:'yunzhijia',excerpt:'[图片]',locator:{groupId:'g',msgId:id,accountId}}))
  const task={id:'task-missing-route',title:'图片接口未加载',description:'[图片]',status:'ready',priority:'normal',sourceRefId:'s1',sourceRefs:[{sourceId:'s2'}],tags:[]}
  fixture.tasks=[task]
  WB.store.set({data:fixture,page:'tasks'})
  vi.spyOn(WB.actions,'sourceImages').mockRejectedValue(Error('transport failure for /api/workbench/sourceImages: HTTP 404'))
  render(<App/>)
  await act(async()=>WB.openTaskForm(task))
  const description=screen.getByRole('region',{name:'描述'})
  await within(description).findByText('图片接口尚未加载，请完全退出并重新打开 Harness。')
  expect(within(description).getAllByText(/完全退出并重新打开/)).toHaveLength(1)
  expect(within(description).queryByText(/HTTP 404/)).toBeNull()
  expect(within(description).getByRole('button',{name:'重试加载图片'})).toBeTruthy()
 })
 it('消息工作时段与资讯间隔分别展示，不把消息同步误写为60分钟',()=>{WB.store.set({data:fixture,page:'settings'});render(<WB.pages.settings/>);expect(screen.getByText('资讯等自动化间隔')).toBeTruthy();expect(screen.getAllByText(/每天北京时间09:00–21:00，每5分钟同步一次/).length).toBeGreaterThan(0)})

 it.each(['dashboard','replies'])('%s刷新实际同步云之家，实际答复后从待回复移出',async(page)=>{
  fixture.replies=[{id:'private-reply',msgId:'private-original',stage:'待回复',contact:'合成同事',snippet:'私聊需答复',taskIds:[],createdAt:new Date().toISOString()}];WB.store.set({data:fixture,page});
  const user=userEvent.setup();render(page==='dashboard'?<WB.pages.dashboard/>:<WB.pages.replies/>);expect(screen.getByText('私聊需答复')).toBeTruthy();
  fixture={...fixture,revision:11,replies:fixture.replies.map(row=>({...row,stage:'已回复'}))};
  await user.click(screen.getByRole('button',{name:page==='dashboard'?'刷新全部内容':'刷新待回复'}));
  await waitFor(()=>expect(calls.some(call=>call.endpoint==='workbench/refreshStart')).toBe(true));
  let sync;await act(async()=>{sync=WB.actions.syncCheck()});await act(async()=>{deferred.shift()({ok:true,value:fixture});await sync});
  expect(screen.queryByText('私聊需答复')).toBeNull();expect(WB.store.get().data.replies[0].stage).toBe('已回复');
 })
  it('顶部目录直接显示多 AI 对话入口，快捷新建可编辑会议字段',async()=>{
  const user=userEvent.setup();const view=render(<App/>);const nav=screen.getByRole('navigation',{name:'工作台导航'})
  expect(nav.className).toContain('wb-topnav');expect(view.container.querySelector('.wb-nav')).toBeNull()
  expect(within(nav).getAllByRole('button',{hidden:true}).length).toBe(11)
  expect(within(nav).queryByRole('button',{name:'智能办公',hidden:true})).toBeNull()
  const multiAI=within(nav).getByRole('button',{name:'多 AI 对话'})
  expect(multiAI.parentElement).toBe(nav)
  expect(multiAI.closest('details')).toBeNull()
  expect(within(nav).queryByRole('button',{name:'工作搜索',hidden:true})).toBeNull();expect(screen.getByRole('button',{name:'搜索工作内容（⌘K / Ctrl+K）'})).toBeTruthy()
  await user.click(nav.querySelector('summary'));expect(nav.querySelector('details').open).toBe(true)
  await user.click(screen.getAllByRole('button',{name:'新建待办'})[0]);const type=screen.getByRole('combobox',{name:'事项类型'});await user.selectOptions(type,'meeting');expect(screen.getByLabelText('会议开始')).toBeTruthy();expect(screen.getByLabelText('会议地点')).toBeTruthy()
  expect(nav.querySelector('details').open).toBe(false)
 },10000)
 it('更多只展开菜单，子项保留选中状态，Escape关闭后回到触发器',async()=>{
  WB.store.set({data:fixture,page:'toolbox'});const user=userEvent.setup();render(<App/>);const nav=screen.getByRole('navigation',{name:'工作台导航'});const summary=nav.querySelector('summary')
  expect(summary.textContent).toBe('更多');expect(summary.parentElement.className).not.toContain('is-active');await user.click(summary);expect(summary.parentElement.open).toBe(true);expect(WB.store.get().page).toBe('toolbox');
  expect(within(summary.parentElement).getByRole('button',{name:'开发工具箱'}).getAttribute('aria-current')).toBe('page');
  expect(within(summary.parentElement).getAllByRole('button').map(button=>button.textContent)).toEqual(['开发工具箱','研发协作','连接与设置']);
  await user.click(within(summary.parentElement).getByRole('button',{name:'研发协作'}));expect(WB.store.get().page).toBe('collab');expect(summary.textContent).toBe('更多');expect(summary.parentElement.open).toBe(false);
  await user.click(summary);await user.keyboard('{Escape}');expect(summary.parentElement.open).toBe(false);expect(document.activeElement).toBe(summary)
 })
 it('十条待回复全部可访问，按Reply ID标记且不操作Task',async()=>{
  fixture.replies=Array.from({length:10},(_,i)=>({id:'reply-'+i,msgId:'m-'+i,stage:'待回复',contact:'同事'+i,snippet:'请求'+i,taskIds:[],createdAt:new Date().toISOString()}));WB.store.set({data:fixture,page:'replies'})
  const user=userEvent.setup();render(<WB.pages.replies/>);expect(screen.getByText('请求9')).toBeTruthy()
  const row=screen.getByText('请求9').closest('article');await user.click(within(row).getByRole('button',{name:'标记已收到'}))
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
 it('选择 ZIP 文件后以预检方式提交，且保留旧 JSON 输入入口',async()=>{
  WB.store.set({data:fixture,page:'settings'});const user=userEvent.setup();render(<WB.pages.settings/>)
  const section=screen.getByRole('region',{name:'迁移导入'})
  const archive=new File([Uint8Array.of(80,75,3,4)],'迁移.zip',{type:'application/zip'})
  await user.upload(within(section).getByLabelText('或选择迁移文件'),archive)
  expect(within(section).getByText('已选择 迁移.zip')).toBeTruthy()
  await user.click(within(section).getByRole('button',{name:'预检迁移包'}))
  await waitFor(()=>expect(within(section).getByText(/预检通过 · 1 条/)).toBeTruthy())
  const requests=calls.filter(call=>call.endpoint==='workbench/importMigration')
  expect(requests.map(call=>call.args.request)).toEqual([{archive:'UEsDBA==',mode:'merge',dryRun:true,mapPaths:{}}])
  expect(within(section).getByPlaceholderText('在这里粘贴导出的迁移包 JSON')).toBeTruthy()
 })
 it('资讯未知日期不冒充发布日期，摘要可展开且编辑入口有接线',async()=>{
  fixture.radar=[{id:'news-one',title:'AI工具发布',source:'test',publishedAt:null,createdAt:'2026-10-28T01:00:00Z',fetchedAt:'2026-10-28T01:00:00Z',url:'https://example.org/news',topics:['Agent'],excerpt:'可核对的原文摘录',summary:{}}];WB.store.set({data:fixture,page:'radar'})
  const user=userEvent.setup();render(<WB.pages.radar/>);expect(screen.queryByText('AI工具发布')).toBeNull();await user.click(screen.getByRole('button',{name:/^日期待确认/}));expect(screen.getByText(/发布日期待确认/)).toBeTruthy();expect(within(document.querySelector('.wb-news-grid')).getAllByText('AI工具发布')).toHaveLength(1)
  await user.click(screen.getByRole('button',{name:'展开摘要'}));expect(within(document.querySelector('.wb-news-grid')).getByText('可核对的原文摘录')).toBeTruthy()
  await user.click(screen.getByRole('button',{name:'这条资讯的操作'}));await user.click(screen.getByRole('button',{name:'编辑四段摘要'}));expect(screen.getByDisplayValue('AI工具发布')).toBeTruthy()
 })
 it('任务中心独立于回复，会议时间可见且事项类型筛选可重置',async()=>{
  fixture.tasks=[{id:'meeting',title:'验收会议',status:'ready',priority:'normal',eventType:'meeting',meetingStart:'2026-10-29T06:00:00Z',tags:[]},{id:'feature',title:'验收开发',status:'ready',priority:'normal',eventType:'feature',tags:[]}];WB.store.set({data:fixture,page:'tasks'})
  const user=userEvent.setup();render(<WB.pages.tasks/>);expect(screen.queryByRole('button',{name:/^待回复 \d/})).toBeNull();expect(screen.getByText(/2026-10-29/)).toBeTruthy()
  await user.click(screen.getByRole('button',{name:'筛选',exact:true}));await user.click(screen.getByRole('button',{name:'会议'}));expect(screen.queryByText('验收开发')).toBeNull();await user.click(screen.getByRole('button',{name:'重置筛选'}));expect(screen.getByText('验收开发')).toBeTruthy()
 })
 it('只有meetingStart的参会待办在首页日程展示并可进入会议列表，不改写截止时间',async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-29T06:00:00Z'));
  try{
   fixture.tasks=[{id:'broadcast-meeting',title:'参加月度质量星期四',status:'ready',priority:'normal',eventType:'meeting',dueAt:null,meetingStart:'2026-10-29T07:30:00Z',meetingLocation:'A303',tags:[]},{id:'tomorrow-meeting',title:'明天的会议',status:'ready',priority:'normal',eventType:'meeting',dueAt:null,meetingStart:'2026-10-30T07:30:00Z',tags:[]}];WB.store.set({data:fixture,page:'dashboard'});const user=userEvent.setup();render(<App/>);
   expect(screen.getByRole('button',{name:'参加月度质量星期四'})).toBeTruthy();expect(screen.getByText('A303')).toBeTruthy();expect(screen.queryByText('明天的会议')).toBeNull();expect(WB.taskCounts(fixture).today).toBe(1);
   await user.click(screen.getByRole('button',{name:'全部日程'}));expect(screen.getByRole('button',{name:'参加月度质量星期四'})).toBeTruthy();expect(fixture.tasks[0].dueAt).toBeNull();
  }finally{vi.useRealTimers()}
 })
 it.each([true,false])('识别队列旧图片点击一次即可查看，原生侧栏可用 %s',async(nativeAvailable)=>{
  const accountId='org:fixture',sourceId='queue-source',entryId='image-review'
  fixture.messageInbox={accountId,conversations:[]}
  fixture.sources=[{id:sourceId,provider:'yunzhijia',excerpt:'[图片]',locator:{accountId,groupId:'g',msgId:'m'}}]
  fixture.analysisQueue=[{id:entryId,sourceId,status:'awaiting_human',reviewKind:'recognition',reviewReason:'仅图片消息'}]
  WB.store.set({data:fixture,page:'replies'})
  const path='/tmp/识别原图.png'
  WB.openHarnessFile=vi.fn().mockResolvedValue(nativeAvailable)
  const images=vi.spyOn(WB.actions,'sourceImages').mockImplementation(async request=>request.mode==='open'?{path,count:1}:{mediaType:'image/png',data:'aW1hZ2U='})
  render(<WB.pages.replies/>)
  const row=screen.getByText('仅图片消息').closest('article')
  expect(images).not.toHaveBeenCalled()
  fireEvent.click(within(row).getByRole('button',{name:'查看图片'}))
  await waitFor(()=>expect(WB.openHarnessFile).toHaveBeenCalledWith(path))
  expect(images.mock.calls[0]).toEqual([{sourceId,entryId,index:0,mode:'open'}])
  if(nativeAvailable){
   expect(images).toHaveBeenCalledTimes(1)
  }else{
   const dialog=await screen.findByRole('dialog',{name:'原消息图片'})
   expect(within(dialog).getByRole('img',{name:'原消息图片'}).getAttribute('src')).toBe('data:image/png;base64,aW1hZ2U=')
   expect(images.mock.calls[1]).toEqual([{sourceId,entryId,index:0,mode:'inline'}])
  }
 })
 it('已完成的识别记录可以复核并只重跑选中条目',async()=>{
  fixture.sources=[{id:'source-history',excerpt:'可复核的已识别消息'}];fixture.analysisQueue=[{id:'done-entry',sourceId:'source-history',status:'done',analysis:{summary:'已有判断'}}];WB.store.set({data:fixture,page:'replies'})
  const user=userEvent.setup();render(<WB.pages.replies/>);await user.selectOptions(screen.getByRole('combobox',{name:'识别记录'}),'done');expect(screen.getByText('可复核的已识别消息')).toBeTruthy();await user.click(screen.getByRole('button',{name:'重新识别'}));await waitFor(()=>expect(calls.some(call=>call.endpoint==='workbench/analysisStart'&&call.args.request.onlyIds[0]==='done-entry')).toBe(true))
 })
 it('仅修改标题时保留含空格标签和原截止时间精度',async()=>{
  const task={id:'precision-task',title:'原标题',status:'ready',priority:'normal',dueAt:'2026-10-30T15:59:59.000Z',tags:['AI 识别','待处理']}
  fixture.tasks=[task];WB.store.set({data:fixture,taskForm:{task}})
  const user=userEvent.setup();render(<WB.TaskFormHost/>);const title=screen.getByPlaceholderText('例如：评审 @张三 提到的网关限流方案')
  await user.clear(title);await user.type(title,'只改标题');await user.click(screen.getByRole('button',{name:'保存'}))
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
 it('后台批量配置与手动每批50条连续识别分别说明',async()=>{
  fixture.settings.aiExtract={enabled:true,batchSize:10};WB.store.set({data:fixture,page:'settings'});const user=userEvent.setup();render(<WB.pages.settings/>);
  expect(screen.getByText(/云之家独立按北京时间09:00–21:00每5分钟同步，页面每12秒读取本地状态/)).toBeTruthy()
  const batch=within(screen.getByText('每批识别消息数').closest('.wb-item')).getByRole('combobox');expect(batch.value).toBe('10');await user.selectOptions(batch,'20');
  expect(calls.some(call=>call.endpoint==='workbench/saveSettings'&&call.args.patch.aiExtract.batchSize===20)).toBe(true)
  await WB.actions.analyzeRun();expect(calls.find(call=>call.endpoint==='workbench/analysisStart').args.request.limit).toBe(50)
 })

 it('首页展示整批总结，不展示逐条列表和原始错误，更多进入资讯页',async()=>{
  fixture.radar=Array.from({length:5},(_,i)=>({id:'ai-'+i,title:'AI release '+i,url:'https://github.com/example/ai-'+i,topics:['AI'],publishedAt:new Date().toISOString(),summary:{}}))
  fixture.radar.push({id:'expired',title:'AI expired article',topics:['AI'],summaryStatus:'failed',summaryAttempts:3,summaryError:'Unable to extract content HTTP 422 auth credential secret',summary:{}})
  fixture.radarBrief={at:new Date().toISOString(),ids:fixture.radar.filter(row=>row.id!=='expired').map(row=>row.id),status:'done',overview:'这一批主要关注模型与开源工具的更新。'};
  WB.store.set({data:fixture});const user=userEvent.setup();render(<WB.pages.dashboard/>);
  expect(screen.getByText('AI 动态')).toBeTruthy();const brief=screen.getByRole('region',{name:'AI 技术简报'});expect(within(brief).getByText('主要关注模型与开源工具的更新。')).toBeTruthy();expect(brief.querySelectorAll('ol,dl')).toHaveLength(0);expect(screen.queryByText('AI expired article')).toBeNull();expect(screen.queryByText(/auth credential secret/)).toBeNull()
  await user.click(screen.getByRole('button',{name:'全部资讯'}));expect(WB.store.get().page).toBe('radar')
 })
 it('资讯页提供按真实星数排序的新项目入口，已忽略内容退出列表',()=>{
  fixture.radar=[{id:'ignored',title:'失效项目',availability:'ignored',summary:{}}];WB.store.set({data:fixture});render(<WB.pages.radar/>);
  expect(screen.queryByText('失效项目')).toBeNull();const link=screen.getByRole('link',{name:'GitHub 新项目榜'});expect(decodeURIComponent(link.href)).toContain('stars:>100 created:>');expect(link.href).toContain('s=stars')
 })

 it('资讯转待办必须展示确认内容，取消不创建，确认仅提交一次',async()=>{
  fixture.radar=[{id:'practice-news',title:'AI 实践资讯',url:'https://example.org/news',topics:['AI'],publishedAt:new Date().toISOString(),summary:{}}];WB.store.set({data:fixture});const user=userEvent.setup();render(<WB.pages.radar/>);
  await user.click(screen.getByRole('button',{name:'这条资讯的操作'}));await user.click(screen.getByRole('button',{name:'添加为我的待办'}));expect(screen.getByText(/将创建「实践：AI 实践资讯」/)).toBeTruthy();expect(calls.some(c=>c.endpoint==='workbench/createTaskFromRadar')).toBe(false)
  await user.click(screen.getByRole('button',{name:'取消'}));expect(calls.some(c=>c.endpoint==='workbench/createTaskFromRadar')).toBe(false)
  await user.click(screen.getByRole('button',{name:'这条资讯的操作'}));await user.click(screen.getByRole('button',{name:'添加为我的待办'}));await user.click(screen.getByRole('button',{name:'确认添加待办'}));expect(calls.filter(c=>c.endpoint==='workbench/createTaskFromRadar')).toHaveLength(1)
 })

 it('设置页底部显示构建版本，归档入口留在数据管理',()=>{
  WB.store.set({page:'settings'});render(<WB.pages.settings/>);
  expect(screen.getByText('版本 v'+version).tagName).toBe('FOOTER');
  for(const name of ['关于','运行时诊断','运行与质量'])expect(screen.queryByRole('heading',{name})).toBeNull();
  expect(calls.some(call=>['workbench/diagnostics','workbench/operationsStatus'].includes(call.endpoint))).toBe(false);
  const data=screen.getByRole('heading',{name:'数据管理'}).closest('section');
  for(const name of ['管理记录归档','管理后台会话历史'])expect(within(data).getByText(name).closest('details').open).toBe(false);
 })
 it('载入示例提示会清空执行记录，只有确认才提交',async()=>{
  WB.store.set({page:'settings'});const user=userEvent.setup();render(<WB.pages.settings/>);
  const trigger=screen.getByRole('button',{name:'载入示例数据'});
  const demoCalls=()=>calls.filter(call=>call.endpoint==='workbench/seedDemo');
  await user.click(trigger);
  let dialog=within(screen.getByRole('dialog',{name:'载入示例数据'}));
  expect(dialog.getByText(/清空当前工作台的所有执行记录/)).toBeTruthy();
  expect(demoCalls()).toHaveLength(0);
  await user.click(dialog.getByRole('button',{name:'取消'}));
  expect(screen.queryByRole('dialog',{name:'载入示例数据'})).toBeNull();
  expect(demoCalls()).toHaveLength(0);
  await user.click(trigger);
  dialog=within(screen.getByRole('dialog',{name:'载入示例数据'}));
  await user.click(dialog.getByRole('button',{name:'确认载入'}));
  expect(demoCalls()).toHaveLength(1);
 })
 it('默认资讯来源只读，自定义订阅从弹窗添加和移除',async()=>{
  WB.store.set({page:'settings'});const user=userEvent.setup();render(<WB.pages.settings/>);
  const list=within(screen.getByRole('list',{name:'资讯源列表'})),add=screen.getByRole('button',{name:'添加资讯源'});
  expect(list.getAllByRole('listitem')).toHaveLength(5);
  expect(list.getByText('OpenAI 官方动态')).toBeTruthy();expect(list.getByText('DeepSeek 官方更新')).toBeTruthy();
  expect(list.queryByRole('button')).toBeNull();expect(screen.queryByRole('textbox',{name:'RSS / Atom 地址'})).toBeNull();
  await user.click(add);let dialog=within(screen.getByRole('dialog',{name:'添加资讯源'}));
  fireEvent.change(dialog.getByRole('textbox',{name:'RSS / Atom 地址'}),{target:{value:'https://example.test/cancel.xml'}});
  await user.keyboard('{Escape}');expect(document.activeElement).toBe(add);
  expect(calls.some(call=>call.endpoint==='workbench/saveSettings')).toBe(false);
  await user.click(add);dialog=within(screen.getByRole('dialog',{name:'添加资讯源'}));
  const address=dialog.getByRole('textbox',{name:'RSS / Atom 地址'}),save=dialog.getByRole('button',{name:'保存'});
  expect(address.value).toBe('');expect(save.disabled).toBe(true);
  fireEvent.change(address,{target:{value:'https://openai.com/news/rss.xml'}});await user.click(save);
  expect(dialog.getByRole('alert').textContent).toContain('已在列表中');
  fireEvent.change(address,{target:{value:'https://example.test/feed.xml'}});
  fireEvent.change(dialog.getByRole('textbox',{name:'名称（选填）'}),{target:{value:'测试订阅'}});
  fireEvent.change(dialog.getByRole('textbox',{name:'主题（选填）'}),{target:{value:'AI，开源'}});
  feedSaveError='测试保存失败';await user.click(save);
  expect((await dialog.findByRole('alert')).textContent).toContain('测试保存失败');expect(address.value).toBe('https://example.test/feed.xml');
  feedSaveError=null;await user.click(save);await waitFor(()=>expect(screen.queryByRole('dialog',{name:'添加资讯源'})).toBeNull());
  expect(document.activeElement).toBe(add);
  expect(list.getAllByRole('listitem')).toHaveLength(6);
  expect(fixture.settings.feeds[0]).toMatchObject({label:'测试订阅',url:'https://example.test/feed.xml',topics:['AI','开源']});
  await user.click(list.getByRole('button',{name:'移除资讯源 测试订阅'}));await waitFor(()=>expect(list.getAllByRole('listitem')).toHaveLength(5));
 })
 it('YAML 列表和嵌套配置可双向转换，拒绝重复键与别名',async()=>{
  WB.store.set({data:fixture,page:'toolbox'});const user=userEvent.setup();render(<WB.pages.toolbox/>);
  await user.click(toolButton('全部'));await user.click(toolButton(/YAML YAML/));await user.click(screen.getByRole('button',{name:'YAML → JSON'}));
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
  await waitFor(()=>expect(calls.find(call=>call.endpoint==='workbench/archiveBackgroundHistory')?.args.ids).toEqual(['old-session']));expect(screen.getByText(/^已归档 1，跳过 0，失败 0$/).getAttribute('role')).toBe('status');
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

describe('办公入口合入助手',()=>{
 it.each(['workflows','history'])('旧 office/%s 深链只读进入办公历史，保留原作业和记录',async(officeView)=>{
  fixture.jobs=[{id:'existing-job',kind:'work_report',status:'completed',steps:[]}];fixture.runs=[{id:'existing-run',status:'completed'}];
  WB.store.set({data:fixture,page:'office',officeView,assistantConversationId:'task:previous',assistantHubThreadId:'previous-thread',assistantRefs:[{kind:'task',id:'previous'}]});
  expect(WB.store.get()).toMatchObject({page:'assistant',assistantOpen:true,assistantConversationId:'system:office',assistantHubThreadId:null,assistantTaskId:null,assistantRefs:[],officeView:null});
  render(<WB.pages.office/>);expect(screen.queryByText('历史执行记录')).toBeNull();expect(screen.queryByRole('button',{name:'新建办公流程'})).toBeNull();expect(WB.store.get().data.jobs).toEqual(fixture.jobs);expect(WB.store.get().data.runs).toEqual(fixture.runs);expect(calls).toHaveLength(0)
 })
 it('旧go与函数式store链接均迁移；主导航保留任务和待回复',()=>{
  WB.go('office');expect(WB.store.get().assistantConversationId).toBe('system:office');expect(WB.store.get().page).toBe('assistant');
  WB.store.set(()=>({page:'office',officeView:'history'}));expect(WB.store.get().page).toBe('assistant');expect(WB.ORDER).not.toContain('office');expect(WB.NAV_GROUPS.flatMap(group=>group.items)).not.toContain('office');expect(WB.ORDER).toContain('tasks');expect(WB.ORDER).toContain('replies');expect(calls).toHaveLength(0)
 })
 it('命令面板恢复办公历史，不再前置原始执行记录',async()=>{
  fixture.runs=[{id:'raw-run',status:'completed'}];WB.store.set({data:fixture,page:'dashboard'});const user=userEvent.setup();render(<WB.Palette open={true} onClose={()=>{}}/>);
  expect(screen.queryByText(/查看执行记录/)).toBeNull();expect(screen.queryByText(/转到 智能办公/)).toBeNull();await user.click(screen.getByText('查看办公历史'));expect(WB.store.get()).toMatchObject({page:'assistant',assistantConversationId:'system:office'});expect(calls).toHaveLength(0)
 })
 it('待办方案进入该事项独立会话并使用可追溯助手操作',async()=>{
  const task={id:'task-work',title:'处理工作',status:'ready',priority:'normal',tags:[],createdAt:new Date().toISOString()};fixture.tasks=[task];WB.store.set({data:fixture,page:'tasks',taskView:'list'});const user=userEvent.setup();render(<WB.pages.tasks/>);
  await user.click(screen.getByRole('button',{name:'展开来源证据'}));await user.click(screen.getByRole('button',{name:'AI 整理处理方案'}));
  await waitFor(()=>expect(calls.some(call=>call.endpoint==='workbench/assistantHub')).toBe(true));const request=calls.find(call=>call.endpoint==='workbench/assistantHub').args.request;
  expect(request).toMatchObject({action:'operate',conversationId:'task:task-work',operation:'office.start',kind:'task_assist',input:{taskId:'task-work'},text:'整理待办处理方案'});expect(request.requestId).toMatch(/^task-assist-/);expect(WB.store.get()).toMatchObject({page:'assistant',assistantConversationId:'task:task-work',assistantTaskId:'task-work'});expect(calls.some(call=>call.endpoint==='workbench/officeWorkflowStart')).toBe(false)
 })
 it('待办方案提交中禁止重复操作，失败仍保留对应会话',async()=>{
  fixture.tasks=[{id:'task-failed',title:'待处理事项',status:'ready',priority:'normal',tags:[]}];WB.store.set({data:fixture,page:'tasks'});const user=userEvent.setup();let reject;const submit=vi.spyOn(WB.actions,'assistantHub').mockImplementation(()=>new Promise((_,r)=>{reject=r})),toast=vi.spyOn(WB,'toast').mockImplementation(()=>{});render(<WB.pages.tasks/>);
  await user.click(screen.getByRole('button',{name:'展开来源证据'}));const button=screen.getByRole('button',{name:'AI 整理处理方案'});await user.click(button);expect(button.disabled).toBe(true);await user.click(button);expect(submit).toHaveBeenCalledTimes(1);
  await act(async()=>{reject(Error('无法启动合成任务'))});expect(toast).toHaveBeenCalledWith('无法启动合成任务','err');expect(WB.store.get()).toMatchObject({page:'assistant',assistantConversationId:'task:task-failed'});expect(fixture.tasks[0].status).toBe('ready');submit.mockRestore();toast.mockRestore()
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
  await user.click(screen.getByRole('button',{name:/审核待确认知识/}));await user.selectOptions(screen.getByRole('combobox',{name:'知识状态'}),'confirmed');await user.click(screen.getByRole('button',{name:'保存'}));expect(calls.at(-1).args.patch.reviewState).toBe('confirmed');
  await user.click(screen.getByRole('button',{name:'导入文本资料'}));await user.type(screen.getByRole('textbox',{name:'资料标题'}),'导入验收');await user.type(screen.getByRole('textbox',{name:'资料正文'}),'接口发布前先灰度验收。');await user.click(screen.getByRole('button',{name:'保存为待审核资料'}));expect(calls.at(-1).args.input.reviewState).toBe('candidate')
 })
 it('助手可切换知识模式、空间和项目范围',async()=>{
  fixture.projects=[{id:'p-A',name:'项目A',knowledgeSpaceId:'company'}];fixture.knowledgeSpaces=[{id:'company',name:'公司资料'}];fixture.sources=[{id:'source-A',locator:{accountId:'account-A'}}];WB.store.set({data:fixture,assistantOpen:true});render(<App/>);const user=userEvent.setup();
  await screen.findByPlaceholderText('输入指令，或让我帮你整理待办…');await user.click(await screen.findByRole('button',{name:'知识设置'}));await user.selectOptions(screen.getByRole('combobox',{name:'知识模式'}),'only');await user.selectOptions(screen.getByRole('combobox',{name:'聊天知识空间'}),'company');await user.selectOptions(screen.getByRole('combobox',{name:'聊天知识项目'}),'p-A');expect(screen.getByRole('combobox',{name:'知识模式'}).value).toBe('only');expect(screen.getByRole('combobox',{name:'聊天知识项目'}).value).toBe('p-A')
 })
})
