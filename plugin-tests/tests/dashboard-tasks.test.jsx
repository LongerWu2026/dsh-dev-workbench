import React from 'react'
import {afterEach,it,expect,vi} from 'vitest'
import {render,screen,within,act,fireEvent,cleanup} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'

afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers()})
const now=Date.parse('2026-10-29T12:00:00Z')
const task=(id,patch={})=>({id,title:id,status:'ready',priority:'normal',tags:[],createdAt:'2026-10-28T00:00:00Z',...patch})
function setup(tasks){
 const {WB}=loadClientBundle();let App
 let data={version:2,revision:1,updatedAt:new Date().toISOString(),settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:false}},projects:[],tasks,sources:[],radar:[],replies:[],analysisQueue:[],jobs:[],knowledge:[],connectors:[],runs:[],audit:[]}
 const calls=[]
 WB.store.set({data,status:'ready',page:'dashboard'})
 WB.apply({get:()=>undefined,effect:fn=>fn(),connection:{rpc:{call:async(_channel,endpoint,payload)=>{
  calls.push(endpoint);if(endpoint==='workbench/updateTask'){data={...data,revision:data.revision+1,tasks:data.tasks.map(task=>task.id===payload.args.id?{...task,...payload.args.patch}:task)}}let value=data
  if(endpoint==='workbench/revision')value={revision:data.revision}
  if(endpoint==='workbench/analysisStatus')value={pending:0,failed:0,done:0,entries:[]}
  if(endpoint==='workbench/operationsStatus')value={queue:{},policy:{},reminders:[]}
  return {ok:true,value}
 }}},slots:{inject(_name,fn){fn();return()=>{}},register(d,c){if(d.name==='main')App=c;return()=>{}}},locale:{register:()=>()=>{},bind:()=>()=>''}})
 return {WB,App,calls,replace(next){data=next},get data(){return data}}
}
const panel=()=>within(screen.getByRole('heading',{name:/今日待办/}).closest('section'))

it('今日新增普通无截止待办可见，旧普通待办可切换全部查看，已结束/归档始终排除',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(now)
 const fixture=setup([task('提交代码',{createdAt:'2026-10-29T09:29:16Z'}),task('旧普通事项'),task('明天会议',{meetingStart:'2026-10-30T01:30:00Z'}),task('高优先级',{priority:'high'}),task('已完成',{status:'completed'}),task('已取消',{status:'cancelled'}),task('归档高优先级',{archivedAt:'2026-10-29T00:00:00Z',priority:'high'})])
 const user=userEvent.setup();render(<fixture.WB.pages.dashboard/>);expect(panel().getByRole('button',{name:'提交代码',exact:true})).toBeTruthy();expect(panel().queryByRole('button',{name:'旧普通事项',exact:true})).toBeNull()
 await user.click(panel().getByRole('button',{name:'全部未完成 4'}));for(const title of ['提交代码','旧普通事项','明天会议','高优先级'])expect(panel().getByRole('button',{name:title,exact:true})).toBeTruthy()
 for(const title of ['已完成','已取消','归档高优先级'])expect(panel().queryByRole('button',{name:title,exact:true})).toBeNull()
 expect(fixture.data.tasks[0].status).toBe('ready');expect(fixture.calls.some(endpoint=>endpoint==='workbench/fetchMentions')).toBe(false)
})

it('新增任务不会被超过8条旧紧急事项挤走，剩余条目可直接展开和收起',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(now)
 const fixture=setup([...Array.from({length:12},(_,i)=>task('旧紧急'+i,{priority:'high',dueAt:'2026-10-28T00:00:00Z'})),task('新识别任务',{createdAt:'2026-10-29T09:00:00Z'})])
 const user=userEvent.setup();render(<fixture.WB.pages.dashboard/>);expect(panel().getAllByRole('button',{name:/标记“/})[0].getAttribute('aria-label')).toContain('新识别任务')
 expect(panel().getAllByRole('button',{name:/标记“/})).toHaveLength(8);await user.click(panel().getByRole('button',{name:'展开其余 5 条'}));expect(panel().getAllByRole('button',{name:/标记“/})).toHaveLength(13)
 await user.click(panel().getByRole('button',{name:'收起列表'}));expect(panel().getAllByRole('button',{name:/标记“/})).toHaveLength(8)
 const copy=vi.spyOn(fixture.WB.util,'copy').mockResolvedValue(undefined);await user.click(screen.getByRole('button',{name:'复制今日简报'}));expect(copy.mock.calls[0][0]).toContain('新识别任务');expect(copy.mock.calls[0][0]).toContain('其余 5 条')
})

it('今日新增按北京时间建档日期判断，更新旧任务不会冒充新增',()=>{
 vi.spyOn(Date,'now').mockReturnValue(now)
 const fixture=setup([task('起始边界',{createdAt:'2026-10-28T16:00:00Z'}),task('末尾边界',{createdAt:'2026-10-29T15:59:59.999Z'}),task('昨天边界',{createdAt:'2026-10-28T15:59:59.999Z'}),task('明天边界',{createdAt:'2026-10-29T16:00:00Z'}),task('旧任务今日编辑',{updatedAt:'2026-10-29T09:00:00Z'}),task('坏时间',{createdAt:'invalid'})])
 render(<fixture.WB.pages.dashboard/>);for(const title of ['起始边界','末尾边界'])expect(panel().getByRole('button',{name:title,exact:true})).toBeTruthy()
 for(const title of ['昨天边界','明天边界','旧任务今日编辑','坏时间'])expect(panel().queryByRole('button',{name:title,exact:true})).toBeNull()
})

it('前台下一次12秒修订检查自动显示新入库任务，不重新采集云之家',async()=>{
 vi.useFakeTimers();vi.setSystemTime(now);const fixture=setup([]);render(<fixture.App/>);await act(async()=>{});expect(panel().queryByRole('button',{name:'后台新增',exact:true})).toBeNull()
 fixture.replace({...fixture.data,revision:2,tasks:[task('后台新增',{createdAt:new Date(now).toISOString()})]})
 await act(async()=>vi.advanceTimersByTimeAsync(12000));expect(panel().getByRole('button',{name:'后台新增',exact:true})).toBeTruthy();expect(fixture.calls).toContain('workbench/snapshot');expect(fixture.calls).not.toContain('workbench/fetchMentions')
})

it('跨北京时间午夜重新计算今日范围，任务仍可在全部未完成中查看',async()=>{
 vi.useFakeTimers();vi.setSystemTime('2026-10-29T15:59:30Z');const fixture=setup([task('午夜前新增',{createdAt:'2026-10-29T09:00:00Z'})]);render(<fixture.WB.pages.dashboard/>);expect(panel().getByRole('button',{name:'午夜前新增',exact:true})).toBeTruthy()
 await act(async()=>vi.advanceTimersByTimeAsync(61000));expect(panel().queryByRole('button',{name:'午夜前新增',exact:true})).toBeNull();fireEvent.click(panel().getByRole('button',{name:'全部未完成 1'}));expect(panel().getByRole('button',{name:'午夜前新增',exact:true})).toBeTruthy()
})

it('首页先展示待办和日程，消息与后台信息默认折叠，不再重复渲染到期提醒',()=>{
 vi.spyOn(Date,'now').mockReturnValue(now)
 const fixture=setup([task('需要处理',{createdAt:new Date(now).toISOString()})]);fixture.WB.store.set({data:{...fixture.data,lastMentionsFetch:{status:'partial',at:new Date(now).toISOString(),added:0},messageInbox:{accountId:'me',at:new Date(now).toISOString(),unreadTotal:48,conversations:[{groupId:'one',name:'项目群',unreadCount:48}]}}})
 render(<fixture.WB.pages.dashboard/>);
 const overview=screen.getByLabelText('今日行动概览');const tasks=screen.getByRole('heading',{name:/今日待办/});const inbox=screen.getByLabelText('云之家重点收件箱')
 expect(overview.compareDocumentPosition(tasks)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(tasks.compareDocumentPosition(inbox)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
 expect(inbox.closest('details').open).toBe(false);expect(screen.getByText('消息尚未同步完整').closest('details').open).toBe(false);expect(screen.queryByRole('heading',{name:'到期提醒'})).toBeNull();expect(fixture.calls).not.toContain('workbench/fetchMentions')
})

it('会议在日程中仅显示一次，未来会议不称即将开会，首页待办排除会议',()=>{
 vi.spyOn(Date,'now').mockReturnValue(now)
 const fixture=setup([task('下周评审',{eventType:'meeting',meetingStart:'2026-11-03T11:00:00Z',meetingLocation:'A101'}),task('完成方案',{createdAt:new Date(now).toISOString()})]);render(<fixture.WB.pages.dashboard/>);
 expect(screen.getAllByRole('button',{name:'下周评审',exact:true})).toHaveLength(1);expect(panel().queryByRole('button',{name:'下周评审',exact:true})).toBeNull();expect(screen.getByText('下一场')).toBeTruthy();expect(screen.queryByText('即将开会')).toBeNull();expect(screen.getByText('11月3日 19:00')).toBeTruthy()
})

it('首页日程区分会前30分钟和会议进行中，结束及归档会议不占首屏',()=>{
 vi.spyOn(Date,'now').mockReturnValue(now)
 const fixture=setup([task('即将评审',{eventType:'meeting',meetingStart:'2026-10-29T12:20:00Z'}),task('正在讨论',{eventType:'meeting',meetingStart:'2026-10-29T11:30:00Z',meetingEnd:'2026-10-29T12:30:00Z'}),task('结束会议',{eventType:'meeting',meetingStart:'2026-10-29T10:00:00Z',meetingEnd:'2026-10-29T11:00:00Z'}),task('归档会议',{eventType:'meeting',meetingStart:'2026-10-29T12:20:00Z',archivedAt:new Date(now).toISOString()})]);render(<fixture.WB.pages.dashboard/>);
 expect(screen.getByText('即将开始')).toBeTruthy();expect(screen.getByText('进行中')).toBeTruthy();expect(screen.getByText('今天 20:20')).toBeTruthy();expect(screen.queryByRole('button',{name:'结束会议',exact:true})).toBeNull();expect(screen.queryByRole('button',{name:'归档会议',exact:true})).toBeNull()
})

it('已归档回复不参与首页行动概览，也不会重新出现在待回复预览',()=>{
 const fixture=setup([]);fixture.WB.store.set({data:{...fixture.data,replies:[{id:'old',contact:'已归档同事',stage:'待回复',archivedAt:new Date().toISOString()},{id:'current',contact:'当前同事',stage:'待回复'}]}});render(<fixture.WB.pages.dashboard/>);expect(screen.getByRole('button',{name:'待回复 1'})).toBeTruthy();expect(screen.queryByText('已归档同事')).toBeNull();expect(screen.getByText('当前同事')).toBeTruthy()
})

it('需要人工确认的识别结果保持展开，其余运行详情收起',async()=>{
 const fixture=setup([]);vi.spyOn(fixture.WB.actions,'analysisStatus').mockResolvedValue({pending:0,awaitingHuman:1,failed:0,done:5,entries:[{id:'pending',status:'awaiting_human',analysis:{summary:'请确认交付范围'}}]});render(<fixture.WB.pages.dashboard/>);await act(async()=>{});
 expect(screen.getByRole('button',{name:'待确认 1'})).toBeTruthy();const confirm=screen.getByRole('button',{name:'确认建档'});expect(confirm.closest('details')).toBeNull();expect(confirm.closest('#wb-brief-analysis')).toBeTruthy()
})

it('关联回复在待办卡片内只显示一次，完成与回复分别操作',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(now);const fixture=setup([task('交付方案',{createdAt:new Date(now).toISOString()})]);const reply={id:'linked-reply',stage:'待回复',contact:'协作同事',snippet:'请交付后告知',taskIds:['交付方案']};const data={...fixture.data,replies:[reply]};fixture.WB.store.set({data});const complete=vi.spyOn(fixture.WB.actions,'updateTask').mockResolvedValue(undefined),stage=vi.spyOn(fixture.WB.actions,'setReplyStage').mockResolvedValue(undefined);const user=userEvent.setup();render(<fixture.WB.pages.dashboard/>);
 expect(screen.getAllByRole('button',{name:'交付方案',exact:true})).toHaveLength(1);expect(screen.queryByRole('heading',{name:'待回复',exact:true})).toBeNull();expect(screen.getAllByText('回复：待回复')).toHaveLength(1);expect(screen.getByRole('button',{name:'编辑待办：交付方案'}).closest('.wb-brief-task-actions')).toBeTruthy()
 await user.click(screen.getByRole('button',{name:'标记“交付方案”为完成'}));expect(complete).toHaveBeenCalledWith('交付方案',{status:'completed'});expect(stage).not.toHaveBeenCalled()
 await act(async()=>fixture.WB.store.set({data:{...data,tasks:[{...data.tasks[0],status:'completed'}]}}));expect(screen.getByText('待办：已完成')).toBeTruthy();expect(screen.getByText('回复：待回复')).toBeTruthy();expect(screen.getByRole('button',{name:'待办状态：已完成'}).disabled).toBe(true)
 await user.click(screen.getByText('处理回复',{exact:true}));await user.click(screen.getByRole('button',{name:'我已回复',exact:true}));expect(stage).toHaveBeenCalledWith('linked-reply','已回复');expect(complete).toHaveBeenCalledTimes(1)
})

it('一条回复关联多条待办时聚合一组，已处理回复不使待办消失',()=>{
 vi.spyOn(Date,'now').mockReturnValue(now);const fixture=setup([task('接口开发',{createdAt:new Date(now).toISOString()}),task('文档更新',{createdAt:new Date(now).toISOString()})]);fixture.WB.store.set({data:{...fixture.data,replies:[{id:'one',stage:'已回复',taskIds:['接口开发','文档更新'],contact:'协作同事'}]}});render(<fixture.WB.pages.dashboard/>);
 expect(screen.getAllByLabelText('关联回复')).toHaveLength(1);expect(screen.getAllByText('回复：已回复')).toHaveLength(1);for(const title of ['接口开发','文档更新'])expect(screen.getByRole('button',{name:title,exact:true})).toBeTruthy();expect(screen.getByRole('button',{name:'待回复 0'})).toBeTruthy();for(const title of ['接口开发','文档更新'])expect(screen.getAllByRole('button',{name:'编辑待办：'+title})).toHaveLength(1)
})

it('未纳入今日关注的旧待办在有待回复义务时仍显示，失效关联回复独立保留',()=>{
 vi.spyOn(Date,'now').mockReturnValue(now);const fixture=setup([task('旧普通待办')]);fixture.WB.store.set({data:{...fixture.data,replies:[{id:'one',stage:'待回复',taskIds:['旧普通待办'],contact:'关联同事'},{id:'missing',stage:'待回复',taskIds:['不存在'],contact:'独立同事'},{id:'archived',stage:'待回复',taskIds:['旧普通待办'],archivedAt:new Date(now).toISOString(),contact:'归档同事'}]}});render(<fixture.WB.pages.dashboard/>);
 expect(panel().getByRole('button',{name:'旧普通待办',exact:true})).toBeTruthy();expect(screen.getByRole('heading',{name:/^待回复/})).toBeTruthy();expect(screen.getByText('独立同事')).toBeTruthy();expect(screen.queryByText('归档同事')).toBeNull();expect(screen.getByRole('button',{name:'待回复 2'})).toBeTruthy()
})

it('有待回复的会议聚合到事项卡片，日程不重复显示',()=>{
 const fixture=setup([task('会议关联回复',{eventType:'meeting',meetingStart:new Date(Date.now()+600000).toISOString()})]);fixture.WB.store.set({data:{...fixture.data,replies:[{id:'meeting-reply',stage:'待回复',taskIds:['会议关联回复']}]}});render(<fixture.WB.pages.dashboard/>);expect(screen.getAllByRole('button',{name:'会议关联回复',exact:true})).toHaveLength(1);expect(screen.getByText('回复：待回复')).toBeTruthy()
})

it('AI资讯与日程处于同一侧栏，不随左侧待办数量向下推移',()=>{
 const fixture=setup(Array.from({length:12},(_,i)=>task('任务'+i,{priority:'high'})));render(<fixture.WB.pages.dashboard/>);const news=screen.getByRole('heading',{name:/AI 动态/}).closest('#wb-brief-news');const agenda=screen.getByRole('heading',{name:'日程'}).closest('section');expect(news.parentElement).toBe(agenda.parentElement);expect(news.parentElement.contains(screen.getByRole('heading',{name:/今日待办/}))).toBe(false);expect(screen.getByRole('button',{name:'AI 资讯 0'})).toBeTruthy();expect(within(news).getAllByRole('button',{name:'抓取资讯',exact:true}).length).toBeGreaterThan(0)
})

it('关联链聚合去重，标题相同或来源相同不会自动合并',()=>{
 const fixture=setup(['A','B','C','同名事项'].map(title=>task(title,{priority:'high',sourceRefId:'same-source'})));fixture.WB.store.set({data:{...fixture.data,replies:[{id:'ab',stage:'待回复',taskIds:['A','B'],contact:'同事一'},{id:'bc',stage:'已确认收到',taskIds:['B','C'],contact:'同事二'},{id:'separate',stage:'待回复',sourceId:'same-source',taskIds:[],snippet:'同名事项',contact:'独立消息'}]}});render(<fixture.WB.pages.dashboard/>);expect(screen.getAllByLabelText('关联回复')).toHaveLength(1);for(const title of ['A','B','C','同名事项'])expect(screen.getAllByRole('button',{name:title,exact:true})).toHaveLength(1);expect(screen.getByText('独立消息')).toBeTruthy();expect(screen.getByRole('button',{name:'待回复 3'})).toBeTruthy()
})

it('跨账号的失效关联不折叠到另一账号的待办中',()=>{
 const fixture=setup([task('账号甲事项',{priority:'high',sourceRefId:'account-a'})]);fixture.WB.store.set({data:{...fixture.data,sources:[{id:'account-a',locator:{accountId:'a'}}],replies:[{id:'different',stage:'待回复',accountId:'b',taskIds:['账号甲事项'],contact:'账号乙消息'}]}});render(<fixture.WB.pages.dashboard/>);expect(screen.queryByLabelText('关联回复')).toBeNull();expect(screen.getByRole('heading',{name:/^待回复/})).toBeTruthy();expect(screen.getByText('账号乙消息')).toBeTruthy()
})

it('首页待办右侧集中显示编辑、跳转和AI分析，操作各自独立',async()=>{
 const fixture=setup([task('可直接操作的待办',{priority:'high',description:'任务原始内容'})]),WB=fixture.WB;
 const edit=vi.spyOn(WB,'openTaskForm').mockImplementation(()=>{}),jump=vi.spyOn(WB,'focusTask').mockImplementation(()=>{}),analyze=vi.spyOn(WB.assistant,'openFor').mockImplementation(()=>{}),complete=vi.spyOn(WB.actions,'updateTask').mockResolvedValue(undefined);
 render(<WB.pages.dashboard/>);const user=userEvent.setup(),row=document.querySelector('[data-task-id="可直接操作的待办"]'),controls=within(row);
 expect(controls.queryByText('更多',{exact:true})).toBeNull();const pencil=controls.getByRole('button',{name:'编辑待办：可直接操作的待办'});expect(pencil.closest('.wb-brief-task-title')).toBeNull();expect(pencil.parentElement).toBe(controls.getByRole('button',{name:'在任务中心定位'}).parentElement);expect(pencil.closest('.wb-brief-task-footer')).toBeNull();expect(pencil.closest('details')).toBeNull();expect(controls.getByRole('button',{name:'在任务中心定位'}).closest('details')).toBeNull();
 await user.click(pencil);expect(edit).toHaveBeenLastCalledWith(fixture.data.tasks[0],null,{presentation:'modal'});await user.click(controls.getByRole('button',{name:'可直接操作的待办',exact:true}));expect(edit).toHaveBeenCalledTimes(2);
 await user.click(controls.getByRole('button',{name:'在任务中心定位'}));expect(jump).toHaveBeenCalledWith('可直接操作的待办');await user.click(controls.getByRole('button',{name:'AI 分析这条待办（带上下文进入会话）'}));expect(analyze).toHaveBeenCalledWith(expect.objectContaining({kind:'task',id:'可直接操作的待办'}));expect(complete).not.toHaveBeenCalled();expect(fixture.data.tasks[0].status).toBe('ready')
})

it('切换待办AI协助替换上次上下文，关闭再打开及已满引用也只选择当前待办',async()=>{
 const fixture=setup([task('本次待办甲',{priority:'high',description:'甲的内容'}),task('本次待办乙',{priority:'high',description:'乙的内容'})]),WB=fixture.WB,user=userEvent.setup()
 WB.store.set({assistantRefs:Array.from({length:8},(_,i)=>({kind:'knowledge',id:'old-'+i,title:'旧引用'+i}))})
 render(<WB.pages.dashboard/>);const assist=id=>within(document.querySelector('[data-task-id="'+id+'"]')).getByRole('button',{name:'AI 分析这条待办（带上下文进入会话）'})
 await user.click(assist('本次待办甲'));expect(WB.store.get().assistantRefs).toEqual([expect.objectContaining({kind:'task',id:'本次待办甲',body:expect.stringContaining('甲的内容')})])
 await act(async()=>WB.assistant.close());await user.click(assist('本次待办乙'));expect(WB.store.get().assistantOpen).toBe(true);expect(WB.store.get().assistantRefs).toEqual([expect.objectContaining({kind:'task',id:'本次待办乙',body:expect.stringContaining('乙的内容')})])
 await user.click(assist('本次待办乙'));expect(WB.store.get().assistantRefs).toHaveLength(1)
 await act(async()=>WB.assistant.add({kind:'knowledge',id:'manual',title:'手动补充知识'}));expect(WB.store.get().assistantRefs.map(ref=>ref.id)).toEqual(['本次待办乙','manual'])
 expect(fixture.calls.some(endpoint=>endpoint==='workbench/assistantSend')).toBe(false)
})


it('首页编辑以弹窗打开，不挤压列表；取消和Escape不保存，保存后刷新标题',async()=>{
 const fixture=setup([task('弹窗编辑的待办',{priority:'high',description:'原始描述'})]),WB=fixture.WB,user=userEvent.setup();render(<fixture.App/>);
 await user.click(screen.getByRole('button',{name:'编辑待办：弹窗编辑的待办'}));let dialog=screen.getByRole('dialog');expect(dialog.classList.contains('wb-modal')).toBe(true);expect(dialog.getAttribute('aria-modal')).toBe('true');expect(document.querySelector('.wb-context-pane')).toBeNull();expect(document.querySelector('.wb-workarea').classList.contains('is-context-open')).toBe(false);
 await user.clear(within(dialog).getByRole('textbox',{name:'标题',exact:true}));await user.type(within(dialog).getByRole('textbox',{name:'标题',exact:true}),'取消的改动');await user.click(within(dialog).getByRole('button',{name:'取消',exact:true}));expect(screen.queryByRole('dialog')).toBeNull();expect(fixture.calls).not.toContain('workbench/updateTask');
 await user.click(screen.getByRole('button',{name:'弹窗编辑的待办',exact:true}));dialog=screen.getByRole('dialog');expect(within(dialog).getByRole('textbox',{name:'标题',exact:true}).value).toBe('弹窗编辑的待办');await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull();expect(fixture.calls).not.toContain('workbench/updateTask');
 await user.click(screen.getByRole('button',{name:'编辑待办：弹窗编辑的待办'}));dialog=screen.getByRole('dialog');await user.clear(within(dialog).getByRole('textbox',{name:'标题',exact:true}));await user.type(within(dialog).getByRole('textbox',{name:'标题',exact:true}),'修改后的待办');await user.click(within(dialog).getByRole('button',{name:'保存修改'}));expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByRole('button',{name:'修改后的待办',exact:true})).toBeTruthy();expect(fixture.calls.filter(endpoint=>endpoint==='workbench/updateTask')).toHaveLength(1);expect(WB.store.get().data.tasks[0]).toMatchObject({title:'修改后的待办',description:'原始描述',status:'ready'})
})


it('首页消息来源直接显示，无需展开即可查看发件人、会话和原消息时间',()=>{
 const fixture=setup([task('展示消息来源',{priority:'high',sourceRefId:'source-visible'})]);fixture.WB.store.set({data:{...fixture.data,sources:[{id:'source-visible',provider:'yunzhijia',sender:'来源发件人',locator:{groupId:'group-visible',groupName:'来源会话',sentAt:'2026-11-01T07:01:43Z'}}]}});render(<fixture.WB.pages.dashboard/>);
 const source=screen.getByRole('group',{name:'消息来源'});expect(source.closest('details')).toBeNull();expect(source.textContent).toContain('发件人：来源发件人 · 来自：来源会话');expect(source.textContent).toContain('消息发出时间：2026-11-01 15:01:43（北京时间）');expect(screen.getByRole('button',{name:'编辑待办：展示消息来源'}).closest('.wb-brief-task-actions')).toBeTruthy()
})
