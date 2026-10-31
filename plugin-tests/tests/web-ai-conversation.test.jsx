import React from 'react'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {ConversationThread} from '../../src/client/features/web-ai/ConversationThread.tsx'
import {ConversationSidebar} from '../../src/client/features/web-ai/ConversationSidebar.tsx'
import {answerPresentation} from '../../src/client/features/web-ai/answer-presentation.ts'
import {selectCapturedTurn} from '../../src/client/features/web-ai/capture.ts'
afterEach(cleanup)
const answer=(patch={})=>({providerId:'kimi',status:'generating',text:'第一段',note:'正在采集',url:null,updatedAt:'2026-10-30T00:00:00Z',...patch})
const round=(id,question,patch={})=>({id,topicId:'t1',requestId:id,question,createdAt:'2026-10-30T00:00:00Z',answers:[answer(patch)]})
const props=(rounds)=>({topicId:'t1',visible:true,rounds,total:rounds.length,filter:'all',authentication:{},busy:false,canEdit:true,onEarlier:vi.fn(),onOpen:vi.fn(),onCapture:vi.fn(),onEditQuestion:vi.fn(),onEditAnswer:vi.fn(),onKnowledge:vi.fn()})
describe('聚合聊天记录',()=>{
 it('官网格式化全角标点与标点旁空格仍绑定同一问题，其他问题保持隔离',()=>{
  const question='请读 PDF，按“代号,数量”输出。',turn={id:'live',ordinal:0,question:'请读 PDF，按 “代号，数量” 输出。',userIndex:0,text:'WB-LIVE-P7Q4,13',complete:true}
  expect(selectCapturedTurn({turns:[turn],userCount:1,lastQuestion:turn.question},question,{answerCount:0,userCount:0}).turn).toBe(turn)
  expect(selectCapturedTurn({turns:[{...turn,question:'另一条问题'}],userCount:1,lastQuestion:'另一条问题'},question,{answerCount:0,userCount:0}).foreign).toBe(true)
 })
 it('每轮保留独立厂商集合，切换一轮不改变其他轮',()=>{
  const first={...round('one','第一问'),answers:[answer({providerId:'kimi'}),answer({providerId:'glm',text:'智谱的第一轮'})]},second={...round('two','第二问'),answers:[answer({providerId:'kimi'}),answer({providerId:'doubao',text:'豆包的第二轮'})]}
  const view=render(<ConversationThread {...props([first,second])}/>),items=view.container.querySelectorAll('.wb-chat-round')
  fireEvent.click(within(items[0]).getByRole('tab',{name:/智谱清言/}));expect(within(items[0]).getByText('智谱的第一轮')).toBeTruthy()
  expect(within(items[1]).getByRole('tab',{name:/Kimi/}).getAttribute('aria-selected')).toBe('true');expect(within(items[1]).queryByRole('tab',{name:/智谱/})).toBeNull()
 })
 it('明确未发送项提供登录或单厂商发送入口，旧记录不获得补发权限',()=>{
  const a=answer({status:'needs_login',submission:'not_sent',text:''}),r={...round('r','未发送'),answers:[a]},p={...props([r]),onUnsent:vi.fn()},view=render(<ConversationThread {...p}/> )
  fireEvent.click(screen.getByRole('button',{name:'查看登录页'}));expect(p.onUnsent).toHaveBeenCalledWith(r,a)
  view.rerender(<ConversationThread {...p} authentication={{kimi:{status:'authenticated'}}}/>);expect(screen.getByRole('button',{name:'发送给Kimi'})).toBeTruthy()
  view.rerender(<ConversationThread {...p} rounds={[{...r,answers:[{...a,submission:undefined}]}]}/>);expect(screen.queryByRole('button',{name:'查看登录页'})).toBeNull()
 })
 it('按轮次显示问题和厂商回答，增量更新同一回答容器，完成后停止流式标记',()=>{
  const p=props([round('r1','第一问'),round('r2','第二问')]);const view=render(<ConversationThread {...p}/>)
  expect([...view.container.querySelectorAll('.wb-chat-question h3')].map(node=>node.textContent)).toEqual(['第一问','第二问'])
  const body=view.container.querySelector('.wb-chat-answer-body');expect(body.getAttribute('aria-live')).toBe('polite')
  view.rerender(<ConversationThread {...p} rounds={[round('r1','第一问',{text:'第一段\n追加内容'}),round('r2','第二问')]}/> )
  expect(view.container.querySelector('.wb-chat-answer-body')).toBe(body);expect(body.textContent).toContain('追加内容')
  view.rerender(<ConversationThread {...p} rounds={[round('r1','第一问',{status:'completed',text:'完整回答'}),round('r2','第二问')]}/> )
  expect(body.getAttribute('aria-live')).toBe('off')
 })
 it('切换厂商只筛选显示，恢复全部后仍保留各厂商内容',()=>{
  const item={...round('r','问题',{text:'Kimi 内容'}),answers:[answer({text:'Kimi 内容'}),answer({providerId:'glm',text:'智谱内容'})]},p=props([item]),view=render(<ConversationThread {...p} filter="kimi"/> )
  expect(screen.getByText('Kimi 内容')).toBeTruthy();expect(screen.queryByText('智谱内容')).toBeNull()
  fireEvent.click(screen.getByRole('tab',{name:/智谱清言/}));expect(screen.getByText('智谱内容')).toBeTruthy()
 })
 it('历史登录失败在未检查时显示待继续采集，已登录后显示可继续，不伪造完成',()=>{
  const a=answer({status:'needs_login',text:'',note:'请在官网完成登录。'}),p=props([{...round('r','历史问题'),answers:[a]}]),view=render(<ConversationThread {...p}/> )
  expect(screen.getByText('上次采集中断，打开官网核对当前状态后可继续采集。')).toBeTruthy();expect(screen.queryByText('需要登录')).toBeNull();expect(screen.queryByText('请在官网完成登录。')).toBeNull()
  view.rerender(<ConversationThread {...p} authentication={{kimi:{status:'authenticated',note:'',evidence:[]}}}/> )
  expect(screen.getByText('官网已登录，可继续采集本轮回答。')).toBeTruthy();expect(screen.queryByText('已保存')).toBeNull();expect(a.status).toBe('needs_login')
  expect(answerPresentation(a,{status:'needs_login',note:'',evidence:[]}).label).toBe('需要登录')
 })
 it('Markdown 标题、代码和列表可读，HTML 保持文本且不执行',()=>{
  const p=props([round('r','格式',{text:'# 标题\n\n- 第一项\n- 第二项\n\n```js\nconst value = 1\n```\n\n<img src=x onerror=alert(1)>'})]),view=render(<ConversationThread {...p}/> )
  expect(screen.getByRole('heading',{name:'标题'})).toBeTruthy();expect(screen.getAllByRole('listitem')).toHaveLength(2);expect(view.container.querySelector('pre code').textContent).toBe('const value = 1');expect(view.container.querySelector('img')).toBeNull()
 })
 it('阅读较早内容时增量更新不拉回底部，加载更早内容保持阅读位置',()=>{
  const p=props([round('r','问题')]),view=render(<ConversationThread {...p}/> ),node=screen.getByLabelText('聊天记录');let height=600
  Object.defineProperty(node,'scrollHeight',{get:()=>height,configurable:true});Object.defineProperty(node,'clientHeight',{value:200,configurable:true})
  node.scrollTop=100;fireEvent.scroll(node);height=800
  view.rerender(<ConversationThread {...p} rounds={[round('r','问题',{text:'追加后的内容'})]}/> );expect(node.scrollTop).toBe(100)
  view.rerender(<ConversationThread {...p} total={40}/> );fireEvent.click(screen.getByRole('button',{name:/加载更早的对话/}));height=1100
  view.rerender(<ConversationThread {...p} rounds={[round('older','更早的问题'),...p.rounds]}/> );expect(node.scrollTop).toBe(400);expect(p.onEarlier).toHaveBeenCalledTimes(1)
 })
})
describe('左侧会话历史',()=>{
 it('搜索历史内容并选择旧会话只通知选择，不创建或发送问题',async()=>{
  const state={topics:[{id:'t1',title:'项目讨论',createdAt:'2026-10-30T00:00:00Z',conversations:{}},{id:'t2',title:'另一会话',createdAt:'2026-10-29T00:00:00Z',conversations:{}}],rounds:[round('r','接口方案',{text:'部署验收规范'})],chatgptEnabled:false},select=vi.fn(),create=vi.fn(),user=userEvent.setup()
  render(<ConversationSidebar state={state} selected="t1" disabled={false} onSelect={select} onNew={create} onManage={()=>{}}/> )
  await user.type(screen.getByRole('textbox',{name:'搜索会话'}),'部署验收')
  expect(screen.queryByRole('button',{name:'选择会话 另一会话'})).toBeNull();await user.click(screen.getByRole('button',{name:'选择会话 项目讨论'}));expect(select).toHaveBeenCalledWith('t1');expect(create).not.toHaveBeenCalled()
 })
})
