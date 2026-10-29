import React from 'react'
import {beforeEach,afterEach,it,expect} from 'vitest'
import {render,screen,within,cleanup} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'

let WB,data,calls,sendError
beforeEach(()=>{
 WB=loadClientBundle().WB;calls=[];sendError=''
 data={version:2,revision:20,settings:{},projects:[],candidates:[],sources:[{id:'private-source',provider:'yunzhijia',sender:'合成同事',excerpt:'代码记得提交',locator:{groupType:1,groupId:'private-conversation',groupName:'合成私聊',msgId:'private-message',accountId:'fixture:me',direction:'inbound',sentAt:'2026-10-29T09:18:41Z'}}],tasks:[{id:'private-task',title:'提交代码',description:'保留业务内容',status:'ready',priority:'normal',tags:[],sourceRefId:'private-source'}],replies:[{id:'private-reply',sourceId:'private-source',groupId:'private-conversation',msgId:'private-message',accountId:'fixture:me',stage:'不需回复',triage:'task',taskIds:['private-task']}],replyDrafts:{}}
 WB.store.set({data,status:'ready',page:'tasks'})
 WB.apply({effect:fn=>fn(),get:()=>undefined,connection:{rpc:{call:async(_channel,endpoint,payload)=>{
  const args=payload.args;calls.push({endpoint,args})
  if(endpoint==='workbench/prepareTaskReply')return {ok:true,value:{replyId:'private-reply',snapshot:data}}
  if(endpoint==='workbench/generateReplyDraft')return {ok:true,value:{text:'收到，我先核对提交范围。'}}
  if(endpoint==='workbench/saveReplyDraft'){data.replyDrafts[args.id]={text:args.text};return {ok:true,value:data}}
  if(endpoint==='workbench/sendReply'){
   if(sendError)return {ok:false,error:sendError}
   data={...data,revision:data.revision+1,replies:data.replies.map(r=>({...r,stage:'已回复'})),replyDrafts:{'private-reply':{text:args.request.text,delivery:{status:'sent',text:args.request.text,at:'2026-10-29T10:00:00Z'}}}}
  }
  return {ok:true,value:data}
 }}},slots:{inject:()=>()=>{},register:()=>()=>{}},locale:{register:()=>()=>{},bind:()=>()=>''}})
})
afterEach(cleanup)

const sent=()=>calls.filter(c=>c.endpoint==='workbench/sendReply')
async function openReply(user){await user.click(screen.getByRole('button',{name:'回复原会话 提交代码'}));return screen.findByRole('textbox',{name:'回复草稿'})}

it('列表直接回复，预览核对原会话且取消不发送；确认后保留任务和发送记录',async()=>{
 const user=userEvent.setup(),originalTask=JSON.stringify(data.tasks);render(<WB.pages.tasks/>);
 const editor=await openReply(user);expect(editor.value).toBe('');expect(screen.getByText(/私聊将直接发送正文，不自动@对方/)).toBeTruthy()
 expect(data.replies[0].stage).toBe('不需回复');expect(WB.store.get().page).toBe('tasks')
 await user.type(editor,'收到，我先核对提交范围。');await user.click(screen.getByRole('button',{name:'发送回复',exact:true}));
 let dialog=screen.getByRole('dialog');expect(dialog.textContent).toContain('合成私聊');expect(dialog.textContent).toContain('代码记得提交');expect(dialog.textContent).toContain('2026-10-29 17:18:41');expect(sent()).toHaveLength(0)
 await user.click(within(dialog).getByRole('button',{name:'取消'}));expect(editor.value).toBe('收到，我先核对提交范围。');expect(sent()).toHaveLength(0)
 await user.click(screen.getByRole('button',{name:'发送回复',exact:true}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'确认发送'}));
 expect(sent()).toHaveLength(1);expect(sent()[0].args.request).toMatchObject({id:'private-reply',taskId:'private-task',groupId:'private-conversation',msgId:'private-message',accountId:'fixture:me',confirmed:true,text:'收到，我先核对提交范围。'})
 expect(JSON.stringify(data.tasks)).toBe(originalTask);expect(data.replies[0].stage).toBe('已回复');expect(screen.getByRole('combobox',{name:'状态 提交代码'}).value).toBe('ready');expect(screen.getByText(/已发送：收到/)).toBeTruthy();expect(screen.getByRole('button',{name:'发送回复',exact:true}).disabled).toBe(true)
 expect(calls.some(c=>c.endpoint==='workbench/updateTask'||c.endpoint==='workbench/setReplyStage')).toBe(false)
})

it('生成、保存及重开草稿不发送，不自动@；失败保留待办和草稿供核对',async()=>{
 const user=userEvent.setup();render(<WB.pages.tasks/>);const editor=await openReply(user)
 await user.click(screen.getByRole('button',{name:'生成回复草稿'}));expect(editor.value).toBe('收到，我先核对提交范围。');expect(sent()).toHaveLength(0)
 await user.click(screen.getByRole('button',{name:'保存草稿'}));expect(data.replyDrafts['private-reply'].text).toBe(editor.value)
 await user.click(screen.getByRole('button',{name:'回复原会话 提交代码'}));await openReply(user);expect(screen.getByRole('textbox',{name:'回复草稿'}).value).toBe('收到，我先核对提交范围。')
 sendError='发送失败，未标记已回复。';await user.click(screen.getByRole('button',{name:'发送回复',exact:true}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'确认发送'}));expect(await screen.findByRole('alert')).toBeTruthy();expect(data.tasks[0].status).toBe('ready');expect(data.replies[0].stage).toBe('不需回复');expect(screen.getByRole('textbox',{name:'回复草稿'}).value).toBe('收到，我先核对提交范围。')
})

it('私聊任务看板和编辑页都能回复，点击不误触卡片或提交任务表单',async()=>{
 const user=userEvent.setup();render(<><WB.pages.tasks/><WB.TaskFormHost/></>);
 await user.click(screen.getByRole('button',{name:'看板'}));await user.click(screen.getByRole('button',{name:'回复原会话',exact:true}));await screen.findByRole('textbox',{name:'回复草稿'});expect(WB.store.get().taskForm).toBeNull()
 await user.click(screen.getByRole('button',{name:'列表',exact:true}));await user.click(screen.getByRole('button',{name:'提交代码',exact:true}));const dialog=screen.getByRole('dialog');await user.click(within(dialog).getByRole('button',{name:'回复原会话',exact:true}));const editor=await within(dialog).findByRole('textbox',{name:'回复草稿'});await user.type(editor,'收到');await user.click(within(dialog).getByRole('button',{name:'发送回复',exact:true}));expect(screen.getAllByRole('dialog')).toHaveLength(2);await user.keyboard('{Escape}');expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(WB.store.get().taskForm).toBeTruthy();expect(editor.value).toBe('收到');expect(calls.some(c=>c.endpoint==='workbench/updateTask')).toBe(false);expect(sent()).toHaveLength(0)
})

it('群聊、手动和本人发出的消息不提供私聊任务回复入口',()=>{
 data.sources[0].locator.groupType=2;data.tasks.push({id:'manual',title:'手动待办',status:'ready',priority:'normal',tags:[]});WB.store.set({data});const view=render(<WB.pages.tasks/>);expect(screen.queryByRole('button',{name:/回复原会话/})).toBeNull();view.unmount()
 data.sources[0].locator.groupType=1;data.sources[0].locator.direction='outbound';WB.store.set({data});render(<WB.pages.tasks/>);expect(screen.queryByRole('button',{name:/回复原会话/})).toBeNull()
})
