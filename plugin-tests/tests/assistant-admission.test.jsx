import React from 'react'
import {afterEach,it,expect,vi} from 'vitest'
import {render,screen,within,fireEvent,waitFor,act,cleanup} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(()=>{cleanup();vi.restoreAllMocks()})
function setup({adopt,listFailure}={}){
 const {WB}=loadClientBundle();let App;const calls=[],conversations=[{id:'system:analysis',kind:'system',title:'消息识别',fixed:true},{id:'chat:owned',kind:'chat',title:'助手内已有会话'}],data={revision:1,settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:false}},projects:[],tasks:[],sources:[],knowledge:[],radar:[],replies:[],analysisQueue:[],jobs:[],runs:[],connectors:[],audit:[]}
 const candidates=[{sessionId:'native-external',title:'原始工程会话',cwd:'/external/project',workspaceTitle:'外部工程'},{sessionId:'native-other',title:'另一个会话',cwd:'/other/project',workspaceTitle:'另一个工程'}]
 WB.store.set({data,status:'ready',page:'assistant',assistantOpen:true,assistantConversationId:'chat:owned'})
 WB.apply({get:()=>undefined,effect:fn=>fn(),locale:{register:()=>()=>{},bind:()=>()=>''},slots:{inject(_name,fn){return fn()},register(d,c){if(d.name==='main')App=c;return()=>{}}},connection:{rpc:{call:async(_channel,endpoint,payload)=>{
  let value=data
  if(endpoint==='workbench/assistantHub'){
   const request=payload.args.request;calls.push(request)
   if(request.action==='list')value={status:'ok',conversations}
   if(request.action==='detail')value={status:'ok',conversation:conversations.find(row=>row.id===request.conversationId),sessionId:request.conversationId?.slice(5),messages:request.conversationId==='chat:native-external'?[{role:'assistant',seq:1,text:'原会话历史已经恢复'}]:[],turns:[],events:[],runs:[],threads:[],confirmations:[]}
   if(request.action==='availableSessions'){if(listFailure)throw Error(listFailure);value={status:'ok',sessions:candidates}}
   if(request.action==='adopt'){if(adopt)value=await adopt(request);else{conversations.push({id:'chat:'+request.sessionId,kind:'chat',title:candidates.find(row=>row.sessionId===request.sessionId).title});value={status:'ok',conversationId:'chat:'+request.sessionId,sessionId:request.sessionId}}}
  }
  return {ok:true,value}
 }}}})
 render(<App/>);return {WB,calls,candidates}
}
async function ready(){await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).disabled).toBe(false))}
async function picker(){await ready();fireEvent.click(screen.getByLabelText('更多助手操作'));fireEvent.click(screen.getByRole('button',{name:'接入已有会话'}));const dialog=await screen.findByRole('dialog',{name:'接入已有会话'});return dialog}
it('默认不请求或展示外部会话，打开接入选择器后才读取候选',async()=>{
 const fixture=setup();await ready();expect(fixture.calls.some(row=>row.action==='availableSessions')).toBe(false);expect(screen.queryByText('原始工程会话')).toBeNull()
 const dialog=await picker();await within(dialog).findByRole('button',{name:/原始工程会话/});expect(fixture.calls.filter(row=>row.action==='availableSessions')).toHaveLength(1);expect(within(dialog).getByRole('button',{name:'接入并打开'}).disabled).toBe(true)
 fireEvent.click(within(dialog).getByRole('button',{name:'取消'}));expect(fixture.calls.some(row=>row.action==='adopt')).toBe(false);expect(fixture.WB.store.get().assistantConversationId).toBe('chat:owned')
})
it('选择并确认后关联原ID并恢复原历史，不发送消息或新建会话',async()=>{
 const fixture=setup(),dialog=await picker();const option=await within(dialog).findByRole('button',{name:/原始工程会话/});fireEvent.click(option);expect(option.getAttribute('aria-pressed')).toBe('true');fireEvent.click(within(dialog).getByRole('button',{name:'接入并打开'}))
 await screen.findByText('原会话历史已经恢复');expect(screen.queryByRole('dialog',{name:'接入已有会话'})).toBeNull();expect(fixture.WB.store.get().assistantConversationId).toBe('chat:native-external');expect(fixture.calls.filter(row=>row.action==='adopt')).toEqual([{action:'adopt',sessionId:'native-external',confirmed:true}]);expect(fixture.calls.some(row=>['send','reset'].includes(row.action))).toBe(false)
 expect(screen.getByRole('button',{name:'会话：原始工程会话'})).toBeTruthy()
})
it('搜索可按工作区定位，搜索隐藏已选项时不能误接入其它会话',async()=>{
 const fixture=setup(),dialog=await picker();fireEvent.click(await within(dialog).findByRole('button',{name:/另一个会话/}));fireEvent.change(within(dialog).getByRole('textbox',{name:'搜索可接入会话'}),{target:{value:'/external/'}})
 expect(within(dialog).queryByRole('button',{name:/另一个会话/})).toBeNull();expect(within(dialog).getByRole('button',{name:'接入并打开'}).disabled).toBe(true);expect(fixture.calls.some(row=>row.action==='adopt')).toBe(false)
})
it('取消保留当前输入和原会话，不修改绑定',async()=>{
 const fixture=setup();await ready();fireEvent.change(screen.getByRole('textbox',{name:'助手消息'}),{target:{value:'保留未发送草稿'}});const dialog=await picker();await within(dialog).findByText('原始工程会话');fireEvent.click(within(dialog).getByRole('button',{name:'取消'}));expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('保留未发送草稿');expect(fixture.WB.store.get().assistantConversationId).toBe('chat:owned');expect(fixture.calls.some(row=>row.action==='adopt')).toBe(false)
})
it('接入时归属变化显示真实原因，保持当前会话，不宣称成功',async()=>{
 const fixture=setup({adopt:async()=>({status:'error',note:'该会话已关联其他事项，请从对应事项进入'})}),dialog=await picker();fireEvent.click(await within(dialog).findByRole('button',{name:/原始工程会话/}));fireEvent.click(within(dialog).getByRole('button',{name:'接入并打开'}));await within(dialog).findByText('该会话已关联其他事项，请从对应事项进入');expect(fixture.WB.store.get().assistantConversationId).toBe('chat:owned');expect(within(dialog).getByRole('button',{name:'接入并打开'}).disabled).toBe(false)
})
it('连续点击只提交一次明确接入，取消和搜索不重复提交',async()=>{
 let finish;const fixture=setup({adopt:()=>new Promise(resolve=>{finish=resolve})}),dialog=await picker();fireEvent.click(await within(dialog).findByRole('button',{name:/原始工程会话/}));const button=within(dialog).getByRole('button',{name:'接入并打开'});fireEvent.click(button);fireEvent.click(button);await waitFor(()=>expect(finish).toBeTypeOf('function'));expect(fixture.calls.filter(row=>row.action==='adopt')).toHaveLength(1)
 await act(async()=>finish({status:'error',note:'模拟暂时无法接入'}));await within(dialog).findByText('模拟暂时无法接入')
})
it('读取外部候选失败可重试，原会话保持可追溯',async()=>{
 const fixture=setup({listFailure:'候选读取暂时失败'}),dialog=await picker();await within(dialog).findByText('候选读取暂时失败');expect(within(dialog).getByRole('button',{name:'刷新列表'}).disabled).toBe(false);expect(fixture.WB.store.get().assistantConversationId).toBe('chat:owned');expect(fixture.calls.some(row=>row.action==='adopt')).toBe(false)
})
