import React from 'react'
import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import {render,screen,within,fireEvent,waitFor,cleanup,act} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
let WB,data,prepare,copy
const at='2026-11-04T09:00:00Z'
beforeEach(()=>{
 WB=loadClientBundle().WB
 data={revision:1,settings:{topics:[],automation:{enabled:false},aiExtract:{enabled:false}},projects:[{id:'A',name:'项目A',knowledgeSpaceId:'company'}],knowledgeSpaces:[{id:'company',name:'公司资料'}],tasks:[],runs:[],knowledge:[],radar:[{id:'news',title:'资讯原文验收',url:'https://example.com/news',publishedAt:new Date().toISOString(),summary:{change:'摘要内容'}}],sources:[],replies:[],analysisQueue:[],candidates:[],jobs:[],connectors:[],messageInbox:{accountId:'me',at,unreadTotal:2,conversations:[{groupId:'group',name:'验收群',latestMsgId:'m2',unreadCount:2}]}}
 WB.store.set({data,status:'ready',page:'dashboard'});vi.spyOn(WB,'rpc').mockResolvedValue(data);copy=vi.spyOn(WB.util,'copy').mockResolvedValue()
 prepare=vi.spyOn(WB.actions,'knowledgeCapture').mockImplementation(async request=>request.action==='prepare'?{status:'ok',draftId:'draft',title:'合成笔记',body:'# 完整正文\n\n合成内容',source:{label:'云之家 · 验收群'},scope:{spaceId:'personal',projectId:null}}:request.action==='read'?{status:'ok',item:{...data.knowledge[0],body:'# 完整笔记\n\n读取到尾部正文'}}:{status:'ok',itemId:'saved',duplicate:false,snapshot:data})
 vi.spyOn(WB.actions,'conversationRead').mockResolvedValue({status:'ok'})
 vi.spyOn(WB.actions,'conversationMessages').mockResolvedValue({status:'ok',viewId:'view',groupId:'group',accountId:'me',unreadTotal:2,unreadLoaded:2,contextLoaded:0,unreadComplete:true,hasMoreHistory:false,batchComplete:true,nextCursor:1,messages:[{id:'m1',text:'第一条消息',sender:'同事甲',at,unread:true},{id:'m2',text:'第二条消息',sender:'同事乙',at,unread:true}]})
})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
it('云之家选择消息后复制与保存，保存范围和用于回答选项明确可改',async()=>{
 render(<WB.pages.dashboard/>);fireEvent.click(screen.getByRole('button',{name:'查看会话：验收群'}));const reader=await screen.findByRole('dialog',{name:'验收群'});await within(reader).findByText('第二条消息')
 fireEvent.click(within(reader).getByRole('button',{name:'选择消息'}));fireEvent.click(within(reader).getByRole('checkbox',{name:'选择消息：m2'}));fireEvent.click(within(reader).getByRole('button',{name:'复制所选消息'}));expect(copy).toHaveBeenCalledWith(expect.stringContaining('第二条消息'));expect(copy.mock.calls[0][0]).not.toContain('第一条消息')
 fireEvent.click(within(reader).getByRole('button',{name:'保存笔记'}));const dialog=await screen.findByRole('dialog',{name:'保存笔记'});await within(dialog).findByRole('textbox',{name:'笔记标题'})
 expect(prepare).toHaveBeenCalledWith({action:'prepare',kind:'messages',accountId:'me',groupId:'group',viewId:'view',messageIds:['m2']})
 expect(within(dialog).getByRole('checkbox',{name:'用于 AI 回答'}).checked).toBe(false)
 fireEvent.change(within(dialog).getByLabelText('笔记空间'),{target:{value:'company'}});fireEvent.change(within(dialog).getByLabelText('笔记项目'),{target:{value:'A'}});fireEvent.click(within(dialog).getByRole('checkbox',{name:'用于 AI 回答'}));fireEvent.click(within(dialog).getByRole('button',{name:'保存',exact:true}))
 await waitFor(()=>expect(prepare).toHaveBeenCalledWith(expect.objectContaining({action:'save',scope:{spaceId:'company',projectId:'A'},useForAnswers:true})))
 expect(data.tasks).toHaveLength(0);expect(data.replies).toHaveLength(0)
})
it('保存失败保留编辑内容供重试，已锁定的AI知识范围不可切换',async()=>{
 prepare.mockImplementation(async request=>{if(request.action==='save')throw Error('合成保存失败');return {draftId:'d',title:'不可丢失标题',body:'保留正文',source:{label:'AI 回答'},scope:{spaceId:'company',projectId:'A'},scopeLocked:true}})
 render(<WB.pages.dashboard/>);fireEvent.click(screen.getByRole('button',{name:'查看会话：验收群'}));const reader=await screen.findByRole('dialog',{name:'验收群'});await within(reader).findByText('第二条消息');fireEvent.click(within(reader).getByRole('button',{name:'选择消息'}));fireEvent.click(within(reader).getByRole('checkbox',{name:'选择消息：m1'}));fireEvent.click(within(reader).getByRole('button',{name:'保存笔记'}));const dialog=await screen.findByRole('dialog',{name:'保存笔记'});const title=await within(dialog).findByRole('textbox',{name:'笔记标题'});fireEvent.change(title,{target:{value:'修改后的标题'}});expect(within(dialog).getByLabelText('笔记空间').disabled).toBe(true);expect(within(dialog).getByLabelText('笔记项目').disabled).toBe(true);fireEvent.click(within(dialog).getByRole('button',{name:'保存',exact:true}));await within(dialog).findByText('合成保存失败');expect(title.value).toBe('修改后的标题')
})
it('资讯标题在工作台内阅读原文并渲染表格代码，收藏调用完整原文入口',async()=>{
 vi.spyOn(WB.actions,'radarArticle').mockResolvedValue({body:'# 文章标题\n\n| 字段 | 值 |\n| --- | --- |\n| 端口 | 18496 |\n\n```js\nconst ok = true;\n```\n\n末尾证据。',fetchedAt:at,cached:true})
 render(<WB.pages.radar/>);fireEvent.click(screen.getByRole('link',{name:/资讯原文验收/}));const dialog=await screen.findByRole('dialog',{name:'资讯原文验收'});await within(dialog).findByText('末尾证据。');expect(dialog.querySelector('table')).toBeTruthy();expect(dialog.querySelector('pre code').textContent).toContain('const ok');expect(within(dialog).getByRole('link',{name:'打开官网'}).href).toBe('https://example.com/news')
 fireEvent.click(within(dialog).getByRole('button',{name:'收藏原文'}));await screen.findByRole('dialog',{name:'保存笔记'});expect(prepare).toHaveBeenCalledWith(expect.objectContaining({action:'prepare',kind:'radar',id:'news',linkOnly:false}))
})
it('原文请求悬空时弹窗和已有摘要立即可读，切换摘要不等待网络也不重复读取',async()=>{
 const fetch=vi.spyOn(WB.actions,'radarArticle').mockImplementation(()=>new Promise(()=>{}))
 render(<WB.pages.radar/>);fireEvent.click(screen.getByRole('link',{name:/资讯原文验收/}))
 const dialog=screen.getByRole('dialog',{name:'资讯原文验收'})
 expect(within(dialog).getByRole('region',{name:'资讯摘要预览'}).textContent).toContain('摘要内容')
 expect(within(dialog).getByRole('status').textContent).toContain('正在读取原文')
 fireEvent.click(within(dialog).getByRole('button',{name:'摘要',exact:true}));expect(within(dialog).getByText('摘要内容')).toBeTruthy()
 expect(within(dialog).queryByRole('status')).toBeNull();expect(fetch).toHaveBeenCalledTimes(1)
 fireEvent.click(within(dialog).getAllByRole('button',{name:'关闭',exact:true}).at(-1));expect(screen.queryByRole('dialog',{name:'资讯原文验收'})).toBeNull()
})
it('原文完成后替换摘要预览，重读失败仍保留上次正文',async()=>{
 let complete
 const fetch=vi.spyOn(WB.actions,'radarArticle').mockImplementation(()=>new Promise(resolve=>{complete=resolve}))
 render(<WB.pages.radar/>);fireEvent.click(screen.getByRole('link',{name:/资讯原文验收/}));const dialog=screen.getByRole('dialog',{name:'资讯原文验收'})
 expect(within(dialog).getByRole('region',{name:'资讯摘要预览'})).toBeTruthy()
 await act(async()=>complete({body:'读取成功的完整原文',fetchedAt:at,cached:false}))
 expect(within(dialog).getByText('读取成功的完整原文')).toBeTruthy();expect(within(dialog).queryByRole('region',{name:'资讯摘要预览'})).toBeNull()
 fetch.mockRejectedValue(Error('重读超时'));fireEvent.click(within(dialog).getByRole('button',{name:'重新读取'}));await within(dialog).findByRole('alert')
 expect(within(dialog).getByText('读取成功的完整原文')).toBeTruthy();expect(within(dialog).getByRole('alert').textContent).toContain('已保留上次快照')
})
it('资讯原文失败仍可仅收藏链接，不假装已有全文',async()=>{
 vi.spyOn(WB.actions,'radarArticle').mockRejectedValue(Error('HTTP 404'))
 render(<WB.pages.radar/>);fireEvent.click(screen.getByRole('link',{name:/资讯原文验收/}));const dialog=await screen.findByRole('dialog',{name:'资讯原文验收'});await within(dialog).findByRole('alert');expect(within(dialog).queryByRole('button',{name:'收藏原文'})).toBeNull();fireEvent.click(within(dialog).getByRole('button',{name:'仅收藏链接'}));await waitFor(()=>expect(prepare).toHaveBeenCalledWith(expect.objectContaining({kind:'radar',linkOnly:true})))
})
it('知识卡片可读取完整笔记，不把预览当作全文',async()=>{
 data.knowledge=[{id:'saved',title:'原文笔记',body:'预览文字',contentRef:{hash:'a'.repeat(64),chars:30000},spaceId:'personal',projectId:null,reviewState:'confirmed',kind:'note',tags:[]}];WB.store.set({data,page:'knowledge'});render(<WB.pages.knowledge/>);fireEvent.click(screen.getByRole('button',{name:'查看笔记：原文笔记'}));const dialog=await screen.findByRole('dialog',{name:'原文笔记'});await within(dialog).findByText('读取到尾部正文');expect(prepare).toHaveBeenCalledWith({action:'read',id:'saved',scope:{spaceId:'personal',projectId:null},original:false})
})
