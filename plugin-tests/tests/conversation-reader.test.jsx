import React from 'react'
import {afterEach,expect,it,vi} from 'vitest'
import {render,screen,within,fireEvent,act,cleanup,waitFor} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(()=>{cleanup();vi.restoreAllMocks()})
const at='2026-11-02T02:00:00Z'
function setup(read){
 const {WB}=loadClientBundle(),data={revision:1,settings:{topics:[],automation:{enabled:false},aiExtract:{enabled:false}},projects:[],tasks:[],runs:[],knowledge:[],radar:[],sources:[],replies:[],analysisQueue:[],candidates:[],jobs:[],connectors:[],messageInbox:{accountId:'org:me',at,unreadTotal:3,conversations:[{groupId:'one',name:'第一会话',latestMsgId:'m1',unreadCount:2},{groupId:'two',name:'第二会话',latestMsgId:'m2',unreadCount:1}]}}
 WB.store.set({data,status:'ready',page:'dashboard'});const reader=vi.spyOn(WB.actions,'conversationMessages').mockImplementation(read),transport=vi.spyOn(WB,'rpc').mockResolvedValue(data)
 const acknowledge=vi.spyOn(WB.actions,'conversationRead').mockResolvedValue({status:'ok'});render(<WB.pages.dashboard/>);const panel=screen.getByLabelText('云之家重点收件箱'),outer=panel.closest('details');if(!outer.open)fireEvent.click(outer.querySelector('summary'))
 return {WB,data,panel,reader,transport,acknowledge}
}
const row=(id,text,unread=true)=>({id,text,unread,sender:'合成同事',at})
const result=(messages=[],extra={})=>({status:'ok',viewId:'view-one',groupId:'one',accountId:'org:me',unreadTotal:2,unreadLoaded:2,contextLoaded:0,messages,unreadComplete:true,hasMoreHistory:true,batchComplete:true,nextCursor:1,...extra})
it('首次仅显示未读，内容纯文本且不启动识别或写入业务',async()=>{
 const {WB,data,panel,reader,transport}=setup(async()=>result([row('u1','<img src=x onerror=alert(1)>'),row('u2','第二条未读')])),before=JSON.stringify(data)
 fireEvent.click(within(panel).getByRole('button',{name:'查看会话：第一会话'}));const dialog=await screen.findByRole('dialog',{name:'第一会话'});await within(dialog).findByText('第二条未读')
 expect(reader).toHaveBeenCalledWith({accountId:'org:me',groupId:'one',mode:'unread'});expect(within(dialog).getAllByRole('article')).toHaveLength(2);expect(within(dialog).queryByText(/历史消息 ·/)).toBeNull();expect(dialog.querySelector('img')).toBeNull();expect(within(dialog).getByText('<img src=x onerror=alert(1)>')).toBeTruthy();expect(JSON.stringify(WB.store.get().data)).toBe(before);expect(transport.mock.calls.some(([name])=>/analy|send|fetchMentions|setReply|createTask/i.test(name))).toBe(false)
})
it('未读部分失败保留已加载内容，重试沿用未读游标且不提前查历史',async()=>{
 let n=0;const {panel,reader}=setup(async()=>++n===1?result([row('u2','已读取的未读')],{status:'partial',note:'服务限流，稍后重试',unreadComplete:false,unreadLoaded:1}):result([row('u1','较早未读'),row('u2','已读取的未读')],{nextCursor:2}))
 fireEvent.click(within(panel).getByRole('button',{name:'查看会话：第一会话'}));const dialog=await screen.findByRole('dialog');await within(dialog).findByRole('alert');fireEvent.click(within(dialog).getByRole('button',{name:'重试读取'}));await within(dialog).findByText('较早未读');await waitFor(()=>expect(within(dialog).queryByRole('alert')).toBeNull());expect(reader.mock.calls[1][0]).toMatchObject({mode:'unread',viewId:'view-one',cursor:1});expect(within(dialog).getAllByRole('article')).toHaveLength(2)
})
it('关闭后打开另一会话，前一会话迟到回包不能串入',async()=>{
 let release;const {panel,acknowledge}=setup(request=>request.groupId==='one'?new Promise(resolve=>{release=resolve}):Promise.resolve(result([row('two','第二会话的消息')],{viewId:'view-two',groupId:'two',unreadLoaded:1,unreadTotal:1})))
 fireEvent.click(within(panel).getByRole('button',{name:'查看会话：第一会话'}));await screen.findByRole('dialog');fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'关闭',exact:true}));fireEvent.click(within(panel).getByRole('button',{name:'查看会话：第二会话'}));await screen.findByText('第二会话的消息');await act(async()=>release(result([row('late','第一会话晚到消息')])));expect(screen.queryByText('第一会话晚到消息')).toBeNull();expect(screen.getByRole('dialog',{name:'第二会话'})).toBeTruthy();expect(acknowledge.mock.calls.every(([r])=>r.groupId==='two')).toBe(true)
})
it('账号切换关闭旧窗口，不以新账号读取旧会话',async()=>{
 let release;const {WB,data,panel,reader,acknowledge}=setup(()=>new Promise(resolve=>{release=resolve}));fireEvent.click(within(panel).getByRole('button',{name:'查看会话：第一会话'}));await screen.findByRole('dialog')
 await act(async()=>WB.store.set({data:{...data,revision:2,messageInbox:{...data.messageInbox,accountId:'another-account'}}}));expect(screen.queryByRole('dialog')).toBeNull();expect(reader).toHaveBeenCalledTimes(1);await act(async()=>release(result([row('secret','旧账号内容')])));expect(screen.queryByText('旧账号内容')).toBeNull();expect(acknowledge).not.toHaveBeenCalled()
})
it('长未读自动读完全部未读，仍不请求历史',async()=>{
 let n=0;const {panel,reader}=setup(async()=>{n++;return result([row('unread-'+n,'未读批次 '+n)],{unreadComplete:n===3,unreadTotal:150,unreadLoaded:n===1?60:n===2?120:150,nextCursor:n})})
 fireEvent.click(within(panel).getByRole('button',{name:'查看会话：第一会话'}));const dialog=await screen.findByRole('dialog');await within(dialog).findByText('未读 150/150 条 · 已查看历史 0 条');expect(reader).toHaveBeenCalledTimes(3);expect(reader.mock.calls.every(([request])=>request.mode==='unread')).toBe(true);expect(within(dialog).getAllByRole('article')).toHaveLength(3)
})
it('只有顶部的上滚手势加载一批10条，连发滚轮不级联；程序滚动不加载',async()=>{
 let time=1000,n=0;vi.spyOn(Date,'now').mockImplementation(()=>time)
 const {panel,reader}=setup(async request=>request.mode==='unread'?result([row('u1','未读一'),row('u2','未读二')]):result(Array.from({length:10},(_,i)=>row('h'+n+'-'+i,'历史批次 '+n+' 第 '+i,false)),{contextLoaded:10*(++n),nextCursor:n+1}))
 fireEvent.click(within(panel).getByRole('button',{name:'查看会话：第一会话'}));const dialog=await screen.findByRole('dialog');await within(dialog).findByText('未读二');const body=dialog.querySelector('.wb-modal-body')
 await act(async()=>{for(let i=0;i<12;i++)fireEvent.wheel(body,{deltaY:-10})});expect(reader).toHaveBeenCalledTimes(2);expect(reader.mock.calls[1][0]).toMatchObject({mode:'history',cursor:1});expect(within(dialog).getAllByRole('article')).toHaveLength(12)
 body.scrollTop=40;time+=300;fireEvent.wheel(body,{deltaY:-10});expect(reader).toHaveBeenCalledTimes(2);body.scrollTop=0;fireEvent.scroll(body);expect(reader).toHaveBeenCalledTimes(2);time+=300;await act(async()=>fireEvent.wheel(body,{deltaY:-10}));expect(reader).toHaveBeenCalledTimes(3);expect(within(dialog).getAllByRole('article')).toHaveLength(22)
})
it('历史不足10条时显示实际条数并停止进一步读取，触摸上拉只加载一批',async()=>{
 const {panel,reader}=setup(async request=>request.mode==='unread'?result([row('u1','仅有一条未读')],{unreadTotal:1,unreadLoaded:1}):result(Array.from({length:4},(_,i)=>row('h'+i,'最后历史 '+i,false)),{unreadTotal:1,unreadLoaded:1,contextLoaded:4,hasMoreHistory:false,nextCursor:2}))
 fireEvent.click(within(panel).getByRole('button',{name:'查看会话：第一会话'}));const dialog=await screen.findByRole('dialog');await within(dialog).findByText('仅有一条未读');const body=dialog.querySelector('.wb-modal-body')
 await act(async()=>{fireEvent.touchStart(body,{touches:[{clientY:10}]});fireEvent.touchMove(body,{touches:[{clientY:30}]});fireEvent.touchMove(body,{touches:[{clientY:50}]})});expect(reader).toHaveBeenCalledTimes(2);expect(within(dialog).getAllByRole('article')).toHaveLength(5);expect(within(dialog).getByText('已到最早消息')).toBeTruthy();fireEvent.wheel(body,{deltaY:-50});expect(reader).toHaveBeenCalledTimes(2)
})
it('历史读取失败后重试仍是历史阶段，并保留原未读内容',async()=>{
 let n=0;const {panel,reader}=setup(async request=>request.mode==='unread'?result([row('u1','保留未读')],{unreadTotal:1,unreadLoaded:1}):++n===1?result([],{status:'partial',note:'历史暂时不可用',unreadTotal:1,unreadLoaded:1,batchComplete:false,nextCursor:2}):result([row('h1','重试得到的历史',false)],{unreadTotal:1,unreadLoaded:1,contextLoaded:1,hasMoreHistory:false,nextCursor:3}))
 fireEvent.click(within(panel).getByRole('button',{name:'查看会话：第一会话'}));const dialog=await screen.findByRole('dialog');await within(dialog).findByText('保留未读');fireEvent.click(within(dialog).getByRole('button',{name:'加载更早10条消息'}));await within(dialog).findByRole('alert');expect(within(dialog).getByText('保留未读')).toBeTruthy();fireEvent.click(within(dialog).getByRole('button',{name:'重试读取'}));await within(dialog).findByText('重试得到的历史');expect(reader.mock.calls[2][0]).toMatchObject({mode:'history',cursor:2})
})

it('查阅成功从未读列表移出但窗口保留，回复和待办原样，重新载入仍已读，新消息再出现',async()=>{
 const {WB,data,panel,acknowledge,transport}=setup(async()=>result([row('u1','查阅内容一'),row('u2','查阅内容二')]))
 acknowledge.mockRestore();const business={replies:[{id:'pending',stage:'待回复',contact:'本人需回复',snippet:'仍需要回复',taskIds:[]}],tasks:[{id:'todo',title:'仍需交付',status:'ready',priority:'normal'}]};Object.assign(data,business);await act(async()=>WB.store.set({data:{...data}}));const before=JSON.stringify(business),mark={accountId:'org:me',groupId:'one',headMsgId:'m1',headSentAt:at,openedAt:at,readAt:at},snapshot={...data,revision:2,conversationReadMarks:{[JSON.stringify(['org:me','one'])]:mark}}
 transport.mockImplementation(async(endpoint)=>{if(endpoint==='workbench/conversationRead')return {status:'ok',readMark:mark,snapshot,providerReadSynced:false};throw Error('不应调用其他业务接口：'+endpoint)})
 WB.apply({effect:fn=>fn(),get:()=>undefined,connection:{rpc:{call:async(_channel,endpoint,payload)=>({ok:true,value:await transport(endpoint,payload.args)})}},slots:{inject:()=>()=>{},register:()=>()=>{}},locale:{register:()=>()=>{},bind:()=>()=>''}})
 fireEvent.click(within(panel).getByRole('button',{name:'查看会话：第一会话'}));const dialog=await screen.findByRole('dialog');await within(dialog).findByText('工作台已读');expect(within(panel).queryByRole('button',{name:'查看会话：第一会话'})).toBeNull();expect(within(panel).getByRole('button',{name:'查看会话：第二会话'})).toBeTruthy();expect(within(dialog).getByText('查阅内容二')).toBeTruthy();expect(JSON.stringify({replies:WB.store.get().data.replies,tasks:WB.store.get().data.tasks})).toBe(before);expect(WB.store.get().data.messageInbox.unreadTotal).toBe(3);expect(transport.mock.calls.filter(([e])=>e==='workbench/conversationRead')).toHaveLength(1)
 fireEvent.click(within(dialog).getByRole('button',{name:'关闭',exact:true}));cleanup();WB.store.set({data:JSON.parse(JSON.stringify(snapshot))});render(<WB.pages.dashboard/>);expect(screen.queryByRole('button',{name:'查看会话：第一会话'})).toBeNull();await act(async()=>WB.store.set({data:{...snapshot,revision:3,messageInbox:{...snapshot.messageInbox,conversations:snapshot.messageInbox.conversations.map(c=>c.groupId==='one'?{...c,latestMsgId:'new-head',latestSentAt:'2026-11-02T02:01:00Z',unreadCount:3}:c)}}}));expect(screen.getByRole('button',{name:'查看会话：第一会话'})).toBeTruthy();expect(screen.getByText('新消息')).toBeTruthy()
})
it('读取失败和数量不足不标读，保存失败可单独重试而不重读',async()=>{
 const {panel,acknowledge,reader}=setup(async()=>result([row('u1','未读仍保留')],{status:'partial',note:'读取失败',unreadComplete:false,unreadLoaded:1}))
 fireEvent.click(within(panel).getByRole('button',{name:'查看会话：第一会话'}));const dialog=await screen.findByRole('dialog');await within(dialog).findByRole('alert');expect(acknowledge).not.toHaveBeenCalled();reader.mockResolvedValueOnce(result([row('u2','补全内容')],{nextCursor:2}));acknowledge.mockRejectedValueOnce(Error('合成落盘失败'));fireEvent.click(within(dialog).getByRole('button',{name:'重试读取'}));await within(dialog).findByRole('button',{name:'重试保存已读'});expect(within(panel).getByRole('button',{name:'查看会话：第一会话'})).toBeTruthy();fireEvent.click(within(dialog).getByRole('button',{name:'重试保存已读'}));await within(dialog).findByText('工作台已读');expect(acknowledge).toHaveBeenCalledTimes(2);expect(reader).toHaveBeenCalledTimes(2)
})
it('服务端消息不足时展示说明并保留未读，不因unreadComplete而清除',async()=>{
 const {panel,acknowledge}=setup(async()=>result([row('u1','唯一可见消息')],{unreadLoaded:1,unreadTotal:2,note:'可见消息少于未读快照',hasMoreHistory:false}))
 fireEvent.click(within(panel).getByRole('button',{name:'查看会话：第一会话'}));await screen.findByText('可见消息少于未读快照');expect(acknowledge).not.toHaveBeenCalled();expect(within(panel).getByRole('button',{name:'查看会话：第一会话'})).toBeTruthy()
})

it('未读跨页全部加载后默认定位末尾，标读回包不打断向上阅读',async()=>{
 let releaseFirst,releaseLast
 const {panel,reader}=setup(()=>new Promise(resolve=>{if(!releaseFirst)releaseFirst=resolve;else releaseLast=resolve}))
 fireEvent.click(within(panel).getByRole('button',{name:'查看会话：第一会话'}));const dialog=await screen.findByRole('dialog'),body=dialog.querySelector('.wb-modal-body')
 Object.defineProperty(body,'scrollHeight',{value:1800,configurable:true});Object.defineProperty(body,'clientHeight',{value:300,configurable:true})
 await act(async()=>releaseFirst(result([row('u2','最新一条')],{unreadComplete:false,unreadLoaded:1})))
 expect(reader).toHaveBeenCalledTimes(2);expect(body.scrollTop).toBe(0)
 await act(async()=>releaseLast(result([row('u1','较早一条')],{nextCursor:2})))
 expect(body.scrollTop).toBe(1800)
 body.scrollTop=500;fireEvent.scroll(body)
 await within(dialog).findByText('工作台已读');expect(body.scrollTop).toBe(500)
 expect(reader.mock.calls.every(([request])=>request.mode==='unread')).toBe(true)
})
it('在顶部读取历史时保留原消息锚点，不跳回末尾',async()=>{
 let releaseUnread,releaseHistory
 const {panel}=setup(request=>new Promise(resolve=>{if(request.mode==='unread')releaseUnread=resolve;else releaseHistory=resolve}))
 fireEvent.click(within(panel).getByRole('button',{name:'查看会话：第一会话'}));const dialog=await screen.findByRole('dialog'),body=dialog.querySelector('.wb-modal-body');let height=1000
 Object.defineProperty(body,'scrollHeight',{get:()=>height,configurable:true});Object.defineProperty(body,'clientHeight',{value:300,configurable:true})
 await act(async()=>releaseUnread(result([row('u1','保留的阅读锚点')],{unreadTotal:1,unreadLoaded:1})))
 expect(body.scrollTop).toBe(1000);body.scrollTop=0
 const node=within(dialog).getByRole('article')
 vi.spyOn(body,'getBoundingClientRect').mockImplementation(()=>({top:0,bottom:300}))
 vi.spyOn(node,'getBoundingClientRect').mockImplementation(()=>{const top=40+(within(dialog).getAllByRole('article').length-1)*400-body.scrollTop;return {top,bottom:top+100}})
 fireEvent.wheel(body,{deltaY:-20})
 await act(async()=>{height=1400;releaseHistory(result([row('h1','插入的历史',false)],{unreadTotal:1,unreadLoaded:1,contextLoaded:1,nextCursor:2}))})
 expect(body.scrollTop).toBe(400);expect(node.getBoundingClientRect().top).toBe(40)
 expect(body.scrollTop).not.toBe(body.scrollHeight)
})
it('关闭后打开另一未读会话也定位到其自己的最新消息',async()=>{
 let release
 const {panel}=setup(()=>new Promise(resolve=>{release=resolve}))
 for(const [name,height] of [['第一会话',1200],['第二会话',2400]]){
  fireEvent.click(within(panel).getByRole('button',{name:'查看会话：'+name}));const dialog=await screen.findByRole('dialog',{name}),body=dialog.querySelector('.wb-modal-body')
  Object.defineProperty(body,'scrollHeight',{value:height,configurable:true})
  await act(async()=>release(result([row(name,'当前会话末条消息')],{viewId:name,groupId:name,unreadTotal:1,unreadLoaded:1})))
  expect(body.scrollTop).toBe(height);fireEvent.click(within(dialog).getByRole('button',{name:'关闭',exact:true}))
 }
})
