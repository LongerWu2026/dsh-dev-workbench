import React from 'react'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {render,screen,within,fireEvent,cleanup,act} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
let WB,data
const now=new Date().toISOString(),selection={policy:'focused-v1',reasons:['mention_me','mention_all'],unreadCount:2,observedAt:now}
const source={id:'source',provider:'yunzhijia',selection,sender:'合成同事',excerpt:'请处理',locator:{accountId:'me',groupId:'group',groupName:'合成群',msgId:'message',sentAt:now}}
beforeEach(()=>{WB=loadClientBundle().WB;data={revision:1,updatedAt:now,settings:{automation:{enabled:false},aiExtract:{enabled:false},topics:[]},projects:[],tasks:[],runs:[],knowledge:[],radar:[],sources:[source],replies:[],analysisQueue:[],candidates:[],jobs:[],connectors:[],messageInbox:{accountId:'me',at:now,unreadTotal:2,conversations:[{groupId:'group',name:'合成群',unreadCount:2}],calendar:{status:'ok',found:1}}};WB.store.set({data,status:'ready',page:'dashboard'})})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
function withIrrelevantConversation(){
 data.messageInbox.conversations=[{groupId:'group',name:'无关广告群',latestMsgId:'message',unreadCount:1},{groupId:'pending',name:'尚待识别的项目群',latestMsgId:'pending-message',unreadCount:1}]
 data.syncCursors={'me:group':{accountId:'me',intakePolicy:'focused-v1',lastMsgId:'message',unreadHeadId:'message',unreadMsgIds:['message'],unreadCount:1}}
 data.sources=[{...source,fetchedAt:now,selection:{...selection,reasons:['unread']},locator:{...source.locator,direction:'inbound'}}]
 data.analysisQueue=[{sourceId:'source',accountId:'me',groupId:'group',msgId:'message',status:'done',analyzedAt:now,analysis:{noise:true,relevance:'irrelevant',items:[]}}]
}
it('AI判为无关的未读会话也默认显示，不提供已收起入口或改动业务记录',()=>{
 withIrrelevantConversation();WB.store.set({data});const before=JSON.stringify(data);render(<WB.pages.dashboard/>);const panel=screen.getByLabelText('云之家重点收件箱')
 expect(within(panel).getByText('无关广告群')).toBeTruthy();expect(within(panel).getByText('尚待识别的项目群')).toBeTruthy()
 expect(within(panel).queryByRole('button',{name:/已收起/})).toBeNull();expect(within(panel).queryByText('已收起')).toBeNull();expect(JSON.stringify(WB.store.get().data)).toBe(before)
})
it('新快照更新会话未读数，既有会话不被AI分类隐藏',async()=>{
 withIrrelevantConversation();WB.store.set({data});render(<WB.pages.dashboard/>);const panel=screen.getByLabelText('云之家重点收件箱');expect(within(panel).getByText('无关广告群')).toBeTruthy()
 await act(async()=>WB.store.set({data:{...data,revision:2,messageInbox:{...data.messageInbox,unreadTotal:3,conversations:[{...data.messageInbox.conversations[0],latestMsgId:'new-message',unreadCount:2},data.messageInbox.conversations[1]]}}}));expect(within(panel).getByText('无关广告群')).toBeTruthy();expect(panel.textContent).toContain('云之家未读 3')
})
it('全部会话判为无关时仍直接展示，旧识别结果同样保持可见',async()=>{
 withIrrelevantConversation();data.messageInbox.conversations.pop();WB.store.set({data});render(<WB.pages.dashboard/>);const panel=screen.getByLabelText('云之家重点收件箱');expect(within(panel).getByText('无关广告群')).toBeTruthy()
 await act(async()=>WB.store.set({data:{...data,revision:2,analysisQueue:[{...data.analysisQueue[0],analysis:{noise:true,items:[]}}]}}));expect(within(panel).getByText('无关广告群')).toBeTruthy();expect(within(panel).queryByRole('button',{name:/已收起/})).toBeNull()
})
it('未同步时显示未知，不用0误导，也不显示其他账号的会议',()=>{data.messageInbox=null;data.tasks=[{id:'foreign',title:'不属于当前账号的会议',eventType:'meeting',meetingStart:new Date(Date.now()+60000).toISOString(),meetingEnd:new Date(Date.now()+3600000).toISOString(),status:'ready',sourceRefId:'source'}];WB.store.set({data});render(<WB.pages.dashboard/>);const panel=screen.getByLabelText('云之家重点收件箱');expect(panel.textContent).toContain('云之家未读 未知');expect(panel.textContent).not.toContain('不属于当前账号的会议')})
it('工作台收件箱显示未读/@本人/@全员，入口能跳转待回复',()=>{render(<WB.pages.dashboard/>);const panel=screen.getByLabelText('云之家重点收件箱');expect(panel.textContent).toContain('云之家未读 2');expect(panel.textContent).toContain('收录 @本人 1');expect(panel.textContent).toContain('收录 @全员 1');fireEvent.click(within(panel).getByRole('button',{name:'待回复',exact:true}));expect(WB.store.get().page).toBe('replies')})
it('待回复标记随新快照变已读，界面本身不伪造回复阶段',async()=>{data.replies=[{id:'reply',sourceId:'source',msgId:'message',stage:'待回复',taskIds:[],contact:'合成同事',snippet:'请处理'}];WB.store.set({data,page:'replies'});render(<WB.pages.replies/>);expect(screen.getByText('会话未读 2')).toBeTruthy();expect(screen.getByText('@本人')).toBeTruthy();expect(screen.getByText('@全员')).toBeTruthy();await act(async()=>WB.store.set({data:{...data,revision:2,messageInbox:{...data.messageInbox,unreadTotal:0,conversations:[{groupId:'group',unreadCount:0}]}}}));expect(screen.getByText('会话已读')).toBeTruthy();expect(WB.store.get().data.replies[0].stage).toBe('待回复')})
it('会话未读缺失显示未知，不能默认为已读',()=>{data.replies=[{id:'reply',sourceId:'source',msgId:'message',stage:'待回复',taskIds:[],contact:'合成同事'}];data.messageInbox.conversations[0].unreadCount=null;WB.store.set({data,page:'replies'});render(<WB.pages.replies/>);expect(screen.getByText('会话未读未知')).toBeTruthy();expect(screen.queryByText('会话已读')).toBeNull()})
it('日历来源标签与即将会议可见，取消和其他账号的会议不混入',()=>{const future=new Date(Date.now()+600000).toISOString(),end=new Date(Date.now()+3600000).toISOString();data.sources=[...data.sources,{id:'calendar',provider:'yunzhijia-calendar',locator:{accountId:'me'}},{id:'foreign',provider:'yunzhijia-calendar',locator:{accountId:'other'}}];data.tasks=[{id:'meeting',title:'合成会议',eventType:'meeting',meetingStart:future,meetingEnd:end,status:'ready',priority:'normal',sourceRefId:'calendar',tags:[]},{id:'cancelled',title:'已取消会议',eventType:'meeting',meetingStart:future,meetingEnd:end,status:'cancelled',sourceRefId:'calendar',tags:[]},{id:'other',title:'其他账号会议',eventType:'meeting',meetingStart:future,meetingEnd:end,status:'ready',sourceRefId:'foreign',tags:[]}];WB.store.set({data});render(<WB.pages.dashboard/>);const panel=screen.getByRole('heading',{name:'日程'}).closest('section');expect(panel.textContent).toContain('合成会议');expect(panel.textContent).not.toContain('已取消会议');expect(panel.textContent).not.toContain('其他账号会议');expect(screen.getAllByText('日历会议').length).toBeGreaterThan(0)})
it('未读会话展开后可查看长名称，其他账号@统计隔离',()=>{data.sources=[...data.sources,{...source,id:'other',locator:{...source.locator,accountId:'other'}}];data.messageInbox.conversations[0].name='合成长名称'.repeat(60);WB.store.set({data});render(<WB.pages.dashboard/>);const panel=screen.getByLabelText('云之家重点收件箱');expect(panel.textContent).toContain('收录 @本人 1');expect(within(panel).getByText('合成长名称'.repeat(60))).toBeTruthy()})

const previewConversations=(count,prefix='预览会话')=>Array.from({length:count},(_,index)=>({groupId:prefix+'-'+index,name:prefix+' '+(index+1),latestMsgId:'head-'+index,unreadCount:index+1}))
it.each([0,1,3,4])('没有超过三行时全部显示，%i条不按条数截断',count=>{
 data.messageInbox.conversations=previewConversations(count);WB.store.set({data});render(<WB.pages.dashboard/>);const panel=screen.getByLabelText('云之家重点收件箱')
 expect(panel.closest('details').open).toBe(true);expect(within(panel).queryByRole('heading',{name:/未读会话/})).toBeNull();expect(within(panel).queryAllByRole('listitem')).toHaveLength(count)
 for(const button of within(panel).queryAllByRole('button',{name:/^查看会话：/}))expect(button.closest('details').open).toBe(true)
 expect(within(panel).queryByRole('button',{name:/展开更多/})).toBeNull()
 expect(panel.textContent).not.toMatch(/查阅后从工作台|AI 判定无关|云之家仍为未读/)
})
// Synthetic geometry for the row interaction contract; real wrapping is checked in Playwright.
function mockConversationRows(perRow=2){
 const original=HTMLElement.prototype.getBoundingClientRect
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(){
  if(this.classList.contains('wb-inbox-conversations'))return {top:0,bottom:200,width:600,height:200,left:0,right:600}
  if(this.classList.contains('wb-inbox-conversation')){const index=[...this.parentElement.children].indexOf(this),top=Math.floor(index/perRow)*36;return {top,bottom:top+30,width:200,height:30,left:0,right:200}}
  return original.call(this)
 })
}
it('更多按三行增量展开且可收起，不改真实未读、识别结果、待回复或待办',()=>{
 mockConversationRows();data.messageInbox.conversations=previewConversations(14);data.tasks=[{id:'keep-task',status:'ready',title:'保持待办'}];data.replies=[{id:'keep-reply',stage:'待回复',msgId:'message',snippet:'保持回复'}];WB.store.set({data});const before=JSON.stringify(data),rpc=vi.spyOn(WB,'rpc').mockResolvedValue(data);render(<WB.pages.dashboard/>);const panel=screen.getByLabelText('云之家重点收件箱')
 expect(within(panel).getAllByRole('listitem')).toHaveLength(6)
 expect(panel.querySelectorAll('[aria-hidden="true"] button[tabindex="-1"]')).toHaveLength(8)
 fireEvent.click(within(panel).getByRole('button',{name:'展开更多',exact:true}));expect(within(panel).getAllByRole('listitem')).toHaveLength(12)
 fireEvent.click(within(panel).getByRole('button',{name:'展开更多',exact:true}));expect(within(panel).getAllByRole('listitem')).toHaveLength(14);expect(within(panel).queryByRole('button',{name:/展开更多/})).toBeNull();expect(panel.textContent).toContain('已展示 14 / 14')
 fireEvent.click(within(panel).getByRole('button',{name:'收起列表'}));expect(within(panel).getAllByRole('listitem')).toHaveLength(6);expect(JSON.stringify(WB.store.get().data)).toBe(before);expect(rpc.mock.calls.some(([name])=>/send|read|analy|createTask|fetchMentions/i.test(name))).toBe(false)
})
it('同账号快照刷新保留已展开行数，切换账号恢复三行且不泄露前账号会话',async()=>{
 mockConversationRows();data.messageInbox.conversations=previewConversations(8);WB.store.set({data});render(<WB.pages.dashboard/>);const panel=screen.getByLabelText('云之家重点收件箱');fireEvent.click(within(panel).getByRole('button',{name:'展开更多',exact:true}))
 await act(async()=>WB.store.set({data:{...data,revision:2,messageInbox:{...data.messageInbox,conversations:previewConversations(9)}}}));expect(within(panel).getAllByRole('listitem')).toHaveLength(9)
 await act(async()=>WB.store.set({data:{...data,revision:3,messageInbox:{...data.messageInbox,accountId:'other',conversations:previewConversations(7,'另一账号')}}}));expect(within(panel).getAllByRole('listitem')).toHaveLength(6);expect(within(panel).queryByRole('button',{name:/查看会话：预览会话/})).toBeNull()
 await act(async()=>WB.store.set({data:{...data,revision:4,messageInbox:{...data.messageInbox,conversations:previewConversations(9)}}}));expect(within(panel).getAllByRole('listitem')).toHaveLength(6)
})
it('手动收起整个概览后，普通数据刷新不强制重新展开',async()=>{
 render(<WB.pages.dashboard/>);const panel=screen.getByLabelText('云之家重点收件箱'),outer=panel.closest('details');outer.open=false;fireEvent(outer,new Event('toggle'))
 await act(async()=>WB.store.set({data:{...data,revision:2}}));expect(outer.open).toBe(false)
})
it('私聊未读待识别可见，转为待办后从默认待回复移出且保留去向',async()=>{data.sources[0]={...source,locator:{...source.locator,groupType:1}};data.replies=[{id:'reply',sourceId:'source',msgId:'message',stage:'待回复',triage:'pending',taskIds:[],contact:'合成同事',snippet:'合成接口交办'}];WB.store.set({data,page:'replies'});render(<WB.pages.replies/>);expect(screen.getByText('待AI识别')).toBeTruthy();await act(async()=>WB.store.set({data:{...data,revision:2,tasks:[{id:'task',title:'合成接口开发',status:'ready'}],replies:[{...data.replies[0],stage:'不需回复',triage:'task',taskIds:['task']}]}}));expect(screen.queryByText('合成接口交办')).toBeNull();fireEvent.change(screen.getByTitle('回复阶段'),{target:{value:'all'}});expect(screen.getByText('已转待办')).toBeTruthy();expect(screen.getByRole('button',{name:'待办：合成接口开发'})).toBeTruthy()})
it('无义务内容从待回复退出，全量历史保留无需处理标识',()=>{data.replies=[{id:'noise',sourceId:'source',msgId:'message',stage:'不需回复',triage:'noise',taskIds:[],contact:'合成同事',snippet:'谢谢'}];WB.store.set({data,page:'replies'});render(<WB.pages.replies/>);expect(screen.queryByText('谢谢')).toBeNull();fireEvent.change(screen.getByTitle('回复阶段'),{target:{value:'all'}});expect(screen.getByText('谢谢')).toBeTruthy();expect(screen.getByText('无需处理',{selector:'.wb-badge'})).toBeTruthy()})

it('私聊回复编辑器说明直接发正文且不自动@，群聊保留引用说明',()=>{data.sources=[{...source,locator:{...source.locator,groupType:1}}];data.replies=[{id:'private',sourceId:'source',msgId:'message',stage:'待回复',taskIds:[],contact:'合成同事'}];WB.store.set({data,page:'replies'});render(<WB.pages.replies/>);fireEvent.click(screen.getByRole('button',{name:'回复',exact:true}));expect(screen.getByText(/私聊将直接发送正文，不自动@对方或引用原消息/)).toBeTruthy();expect(screen.getByRole('textbox',{name:'回复草稿'}).value).toBe('')})

it.each(['dashboard','replies'].flatMap(page=>[['不需回复','无需回复'],['已回复','标记已回复']].map(([targetStage,label])=>[page,targetStage,label])))('%s 标记为%s后移出待回复，不发送消息或改变真实未读与待办',async(page,targetStage,label)=>{
 data.tasks=[{id:'task-keep',title:'仍需交付的事项',status:'ready',priority:'normal',createdAt:now}]
 data.replies=[{id:'review-one',sourceId:'source',msgId:'message',stage:'待回复',contact:'合成同事',snippet:'这条群讨论无需本人答复',taskIds:[],repliedAt:null}]
 WB.store.set({data,page});const before=JSON.stringify(data.messageInbox),originalSources=JSON.stringify(data.sources),transport=vi.spyOn(WB,'rpc').mockResolvedValue(data)
 const stage=vi.spyOn(WB.actions,'setReplyStage').mockImplementation(async(id,value)=>{data={...data,revision:2,replies:data.replies.map(row=>row.id===id?{...row,stage:value,humanGuard:true,repliedAt:value==='已回复'?now:row.repliedAt}:row)};WB.store.set({data});return data})
 const Page=WB.pages[page];render(<Page/>);const button=screen.getByRole('button',{name:label,exact:true});if(targetStage==='不需回复')expect(button.title).toContain('不改变云之家未读状态');expect(screen.queryByRole('button',{name:'已回复',exact:true})).toBeNull();expect(screen.queryByRole('button',{name:'已查阅',exact:true})).toBeNull()
 await act(async()=>fireEvent.click(button));expect(stage).toHaveBeenCalledWith('review-one',targetStage);expect(screen.queryByText('这条群讨论无需本人答复')).toBeNull()
 expect(data.replies[0]).toMatchObject({stage:targetStage,humanGuard:true,repliedAt:targetStage==='已回复'?now:null});expect(data.tasks[0].status).toBe('ready');expect(JSON.stringify(data.messageInbox)).toBe(before);expect(JSON.stringify(data.sources)).toBe(originalSources)
 expect(transport.mock.calls.some(([endpoint])=>/sendReply|fetchMentions|mark.*read/i.test(endpoint))).toBe(false)
 if(page==='replies'){fireEvent.change(screen.getByTitle('回复阶段'),{target:{value:'all'}});expect(screen.getByRole('heading',{name:'全部回复记录'})).toBeTruthy();expect(screen.getAllByText(targetStage).length).toBeGreaterThan(0);expect(screen.getByText('人工标记已保护')).toBeTruthy()}
})
