import React from 'react'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {act,cleanup,render,screen,waitFor,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
let WB,Actions,calls,disposers,fixture,failRead
beforeEach(()=>{
 WB=loadClientBundle().WB;calls=[];disposers=[];failRead=false
 fixture={version:2,revision:1,settings:{},tasks:[],projects:[],replies:[],sources:[],radar:[],runs:[],knowledge:[]}
 WB.apply({effect(fn){const d=fn();if(typeof d==='function')disposers.push(d);return d},get(){},connection:{rpc:{call:async(_channel,endpoint,payload)=>{
  calls.push({endpoint,args:payload.args})
  if(endpoint==='workbench/assistantMessage')return {ok:true,value:failRead?{status:'error',note:'测试读取失败'}:{status:'ok',text:'验收回复正文'}}
  return {ok:true,value:fixture}
 }}},slots:{inject(_name,fn){fn();return()=>{}},register(meta,component){if(meta.name==='conversation.chat.assistant-actions')Actions=component;return()=>{}}}})
})
afterEach(()=>{cleanup();disposers.reverse().forEach(fn=>fn());vi.restoreAllMocks()})
describe('原生聊天动作菜单',()=>{
 it('不打开工作台页面也安装自身样式，键盘执行时锁定重复操作并使用正确消息ID',async()=>{
  const user=userEvent.setup();let finish;const create=vi.spyOn(WB.actions,'createTask').mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
  const view=render(<Actions sessionId="session-style" messageId="message-style"/>);expect(view.container.querySelector('.wb-root')).toBeNull();expect(document.head.querySelector('style[data-workbench-chat-actions]')).toBeTruthy()
  const trigger=screen.getByRole('button',{name:'工作台操作'});trigger.focus();await user.keyboard('{ArrowDown}')
  const menu=screen.getByRole('menu',{name:'工作台操作'});const items=within(menu).getAllByRole('menuitem');expect(items).toHaveLength(3);expect(document.activeElement).toBe(items[0])
  await user.keyboard('{Enter}');await waitFor(()=>expect(create).toHaveBeenCalledTimes(1));expect(screen.getByRole('status').textContent).toBe('处理中…');expect(trigger.disabled).toBe(true);expect(items.every(item=>item.disabled)).toBe(true)
  expect(calls.find(c=>c.endpoint==='workbench/assistantMessage').args.request).toEqual({sessionId:'session-style',messageId:'message-style'});expect(create.mock.calls[0][0].description).toBe('验收回复正文')
  await act(async()=>finish(fixture));expect(screen.queryByRole('menu')).toBeNull();expect(document.activeElement).toBe(trigger)
 })
 it('方向键循环、Escape回到触发器，点外部关闭时保留外部焦点',async()=>{
  const user=userEvent.setup();render(<><Actions sessionId="s" messageId="m"/><button>其他操作</button></>);const trigger=screen.getByRole('button',{name:'工作台操作'})
  await user.click(trigger);const items=screen.getAllByRole('menuitem');await user.keyboard('{End}');expect(document.activeElement).toBe(items[2]);await user.keyboard('{ArrowDown}');expect(document.activeElement).toBe(items[0]);await user.keyboard('{ArrowUp}');expect(document.activeElement).toBe(items[2]);await user.keyboard('{Escape}');expect(screen.queryByRole('menu')).toBeNull();expect(document.activeElement).toBe(trigger)
  await user.click(trigger);const other=screen.getByRole('button',{name:'其他操作'});await user.click(other);expect(screen.queryByRole('menu')).toBeNull();expect(document.activeElement).toBe(other)
 })
 it('异步操作完成时不夺走用户正在编辑的其他输入框焦点',async()=>{
  const user=userEvent.setup();let finish;vi.spyOn(WB.actions,'createTask').mockImplementation(()=>new Promise(resolve=>{finish=resolve}));render(<><Actions sessionId="s" messageId="m"/><input aria-label="其他草稿"/></>);await user.click(screen.getByRole('button',{name:'工作台操作'}));await user.click(screen.getByRole('menuitem',{name:'生成待办'}));await waitFor(()=>expect(finish).toBeTruthy());const draft=screen.getByRole('textbox',{name:'其他草稿'});await user.type(draft,'保留编辑');await act(async()=>finish(fixture));expect(document.activeElement).toBe(draft);expect(draft.value).toBe('保留编辑');expect(screen.queryByRole('menu')).toBeNull()
 })
 it('读取失败保留可重试菜单且不会创建业务记录，成功后关闭',async()=>{
  failRead=true;const user=userEvent.setup();render(<Actions sessionId="s" messageId="m"/>);await user.click(screen.getByRole('button',{name:'工作台操作'}));await user.click(screen.getByRole('menuitem',{name:'生成待办'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toBe('操作没成功，请重试'));expect(calls.some(c=>c.endpoint==='workbench/createTask')).toBe(false);expect(screen.getByRole('menuitem',{name:'生成待办'}).disabled).toBe(false)
  failRead=false;await user.click(screen.getByRole('menuitem',{name:'生成待办'}));await waitFor(()=>expect(screen.queryByRole('menu')).toBeNull());expect(calls.filter(c=>c.endpoint==='workbench/createTask')).toHaveLength(1)
 })
})
