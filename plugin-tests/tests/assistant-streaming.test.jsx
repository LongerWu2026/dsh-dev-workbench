import React from 'react'
import {afterEach,it,expect,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers()})
function setup({reopened=false}={}){
 const {WB}=loadClientBundle();let App,turn=reopened?{id:'native:one:2',text:'原会话的问题',at:1000,source:'ai',status:'recognizing',commands:[],sessionId:'one',streamingText:'进入前已生成',replyStreaming:true}:null
 const pending=[],calls=[],data={revision:1,settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:false}},projects:[],tasks:[{id:'a',title:'甲事项'},{id:'b',title:'乙事项'}],sources:[],radar:[],replies:[],analysisQueue:[],jobs:[],runs:[],knowledge:[],connectors:[],audit:[]},conversations=[{id:'task:a',kind:'task',title:'甲事项'},{id:'task:b',kind:'task',title:'乙事项'}]
 WB.store.set({data,status:'ready',page:'assistant',assistantOpen:true,assistantConversationId:'task:a'})
 WB.apply({get:()=>undefined,effect:fn=>fn(),locale:{register:()=>()=>{},bind:()=>()=>''},slots:{inject(_name,fn){return fn()},register(d,c){if(d.name==='main')App=c;return()=>{}}},connection:{rpc:{call:async(_channel,endpoint,payload)=>{
  let value=data
  if(endpoint==='workbench/assistantHub'){
   const request=payload.args.request;calls.push(request)
   if(request.action==='list')value={status:'ok',conversations}
   if(request.action==='detail')value={status:'ok',conversation:conversations.find(row=>row.id===request.conversationId),sessionId:request.conversationId==='task:a'?'one':'two',turnActive:request.conversationId==='task:a'&&!!turn?.replyStreaming,messages:[],turns:request.conversationId==='task:a'&&turn?[turn]:[],events:[],runs:[],threads:[],confirmations:[]}
   if(request.action==='send'){turn={id:'first-turn',requestId:request.requestId,text:request.text,at:1000,source:'ai',status:'recognizing',commands:[],sessionId:'one'};value={status:'ok',sessionId:'one',fromSeq:0,turn,turnId:turn.id}}
   if(request.action==='delta')value=await new Promise(resolve=>pending.push((patch,ended=false)=>{turn={...turn,...patch};if(ended){delete turn.streamingText;delete turn.replyStreaming}resolve({status:'ok',turns:[turn],entries:[],nextSeq:3,turnEnded:ended})}))
  }
  return {ok:true,value}
 }}}})
 render(<App/>);return {WB,calls,pending,update:patch=>turn={...turn,...patch}}
}
async function ready(){await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).disabled).toBe(false))}
async function send(){await ready();fireEvent.change(screen.getByRole('textbox',{name:'助手消息'}),{target:{value:'请继续说明当前问题'}});fireEvent.click(screen.getByRole('button',{name:'发送'}))}
async function emit(fixture,patch,ended=false){await waitFor(()=>expect(fixture.pending.length).toBeGreaterThan(0));await act(async()=>fixture.pending.shift()(patch,ended))}
it('完整回复未到达时同一回复卡片逐步更新，结束后保留一份最终内容',async()=>{
 const fixture=setup();await send();await emit(fixture,{streamingText:'第一段正在输出',replyStreaming:true})
 const first=await screen.findByText('第一段正在输出'),card=first.closest('[aria-label="处理回复"]');expect(card.getAttribute('aria-busy')).toBe('true');expect(screen.getAllByLabelText('提交与处理结果')).toHaveLength(1)
 await emit(fixture,{streamingText:'第一段正在输出，第二段已到达',replyStreaming:true});expect((await screen.findByText('第一段正在输出，第二段已到达')).closest('[aria-label="处理回复"]')).toBe(card)
 await emit(fixture,{reply:'第一段与第二段的最终完整回复',status:'completed',replySource:'assistant'},true);await screen.findByText('第一段与第二段的最终完整回复')
 expect(screen.getAllByLabelText('处理回复')).toHaveLength(1);expect(screen.queryByText('第一段正在输出，第二段已到达')).toBeNull();expect(card.getAttribute('aria-busy')).toBeNull();expect(fixture.calls.filter(row=>row.action==='send')).toHaveLength(1)
})
it('用户上滚后流式内容继续增加，但不跳回底部',async()=>{
 const fixture=setup();await send();const body=document.querySelector('.wb-hub-body');Object.defineProperty(body,'scrollHeight',{value:2000,configurable:true});Object.defineProperty(body,'clientHeight',{value:300,configurable:true})
 await emit(fixture,{streamingText:'第一段',replyStreaming:true});expect(body.scrollTop).toBe(2000)
 body.scrollTop=100;fireEvent.scroll(body);await emit(fixture,{streamingText:'第一段及继续生成的第二段',replyStreaming:true});await screen.findByText('第一段及继续生成的第二段');expect(body.scrollTop).toBe(100)
 await emit(fixture,{status:'completed',reply:'最终输出',replySource:'assistant'},true);await screen.findByText('最终输出');expect(body.scrollTop).toBe(100)
})
it('生成时切换事项，旧轮次迟到片段不串入新会话',async()=>{
 const fixture=setup();await send();await emit(fixture,{streamingText:'甲的生成片段',replyStreaming:true});await screen.findByText('甲的生成片段');await waitFor(()=>expect(fixture.pending.length).toBeGreaterThan(0))
 fireEvent.click(screen.getByRole('button',{name:'会话：乙事项'}));await ready();await emit(fixture,{streamingText:'甲的迟到片段',replyStreaming:true})
 expect(screen.queryByText('甲的迟到片段')).toBeNull();expect(within(screen.getByRole('navigation',{name:'助手会话列表'})).getByRole('button',{name:'会话：乙事项'}).getAttribute('aria-current')).toBe('true');expect(fixture.calls.filter(row=>row.action==='send')).toHaveLength(1)
})
it('重新打开正在生成的会话继续显示实时前缀，不再发送模型请求',async()=>{
 const fixture=setup({reopened:true});await screen.findByText('进入前已生成');const initialReads=fixture.calls.filter(row=>row.action==='detail').length
 fixture.update({streamingText:'进入前已生成，进入后继续更新'});await screen.findByText('进入前已生成，进入后继续更新',{}, {timeout:1500})
 expect(fixture.calls.filter(row=>row.action==='detail').length).toBeGreaterThan(initialReads);expect(fixture.calls.filter(row=>row.action==='send')).toHaveLength(0)
})
it('中断后的已接收内容保留，同时显示未完成原因',async()=>{
 const fixture=setup();await send();await emit(fixture,{streamingText:'已接收但未完成的内容',replyStreaming:true});await screen.findByText('已接收但未完成的内容')
 await emit(fixture,{streamingText:'已接收但未完成的内容',replyStreaming:false,status:'interrupted',reply:'本轮已中断，未确认完成'})
 await screen.findByText('本轮已中断，未确认完成');expect(screen.getByText('已接收但未完成的内容')).toBeTruthy();expect(screen.getByLabelText('处理回复').getAttribute('aria-busy')).toBeNull()
})
