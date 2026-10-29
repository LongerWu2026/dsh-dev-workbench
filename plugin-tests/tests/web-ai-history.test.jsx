import React from 'react'
import {describe,it,expect,vi,afterEach} from 'vitest'
import {render,screen,cleanup,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {HistoryManager} from '../../src/client/features/web-ai/HistoryManager.tsx'
import {QuestionEditor} from '../../src/client/features/web-ai/QuestionEditor.tsx'
import {searchWebAIHistory} from '../../src/client/features/web-ai/history.ts'
import {restoreWebAITopic} from '../../src/client/features/web-ai/preferences.ts'
afterEach(cleanup)
function fixture(){return {topics:Array.from({length:42},(_,i)=>({id:'t'+i,title:'历史主题'+i,createdAt:'2026-10-29T00:00:00.000Z',version:0,conversations:{},...(i===41?{deletedAt:'2026-10-29T01:00:00.000Z'}:{})})),rounds:[{id:'r',topicId:'t20',requestId:'test',question:'官网原问题',displayQuestion:'本地修订问题',createdAt:'2026-10-29T00:01:00.000Z',attachments:[{id:'a',name:'architecture.pdf',type:'application/pdf',size:6}],answers:[{providerId:'kimi',text:'稀有关键词完整回答',status:'completed',updatedAt:'2026-10-29T01:00:00.000Z',url:null}]}],chatgptEnabled:false}}
describe('本地问答历史',()=>{
 it('标题、原提问、本地修订、回答、附件与厂商可组合搜索；回收站默认不进入结果',()=>{
  const s=fixture();for(const query of ['历史主题20','官网原问题','本地修订','稀有关键词','architecture.pdf','Kimi 稀有关键词'])expect(searchWebAIHistory(s,query).map(x=>x.topic.id)).toEqual(['t20']);expect(searchWebAIHistory(s,'不存在')).toEqual([]);expect(searchWebAIHistory(s,'')).toHaveLength(41);expect(searchWebAIHistory(s,'',true).map(x=>x.topic.id)).toEqual(['t41'])
 })
 it('历史分页仅显示10条，搜索后回到第一页，并可打开命中的问答',async()=>{
  const select=vi.fn(),manage=vi.fn(),user=userEvent.setup();render(<HistoryManager state={fixture()} selected="" disabled={false} onSelect={select} onManage={manage} onClose={()=>{}}/>);expect(screen.getAllByRole('article')).toHaveLength(10);await user.click(screen.getByRole('button',{name:'历史下一页'}));await user.type(screen.getByRole('textbox',{name:'搜索历史问答'}),'稀有关键词');expect(screen.getAllByRole('article')).toHaveLength(1);await user.click(screen.getByRole('button',{name:'打开问答 历史主题20'}));expect(select).toHaveBeenCalledWith('t20');expect(manage).not.toHaveBeenCalled()
 })
 it('删除先显示范围确认，取消不写入；恢复不触及官网，永久删除须另一次确认',async()=>{
  const manage=vi.fn(async()=>{}),user=userEvent.setup(),s=fixture();render(<HistoryManager state={s} selected="t20" disabled={false} onSelect={()=>{}} onManage={manage} onClose={()=>{}}/>);await user.click(screen.getByRole('button',{name:'删除问答 历史主题20'}));expect(screen.getByRole('dialog').textContent).toContain('不会删除厂商官网对话');expect(manage).not.toHaveBeenCalled();await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'取消'}));expect(manage).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'删除问答 历史主题20'}));await user.click(screen.getByRole('button',{name:'确认移入回收站'}));expect(manage).toHaveBeenCalledWith({topicId:'t20',expectedVersion:0,action:'trash',title:'历史主题20',confirm:true});await user.click(screen.getByRole('button',{name:'回收站（1）'}));await user.click(screen.getByRole('button',{name:'恢复问答'}));expect(manage).toHaveBeenLastCalledWith({topicId:'t41',expectedVersion:0,action:'restore'});await user.click(screen.getByRole('button',{name:'永久删除'}));expect(manage).toHaveBeenCalledTimes(2);await user.click(screen.getByRole('button',{name:'确认永久删除'}));expect(manage).toHaveBeenLastCalledWith({topicId:'t41',expectedVersion:0,action:'purge',title:'历史主题41',confirm:true})
 })
 it('重命名传递版本，失败保留输入与错误，不显示伪成功',async()=>{
  const manage=vi.fn(async()=>{throw Error('历史问答已更新，请刷新后重试')}),user=userEvent.setup();render(<HistoryManager state={fixture()} selected="t20" disabled={false} onSelect={()=>{}} onManage={manage} onClose={()=>{}}/>);await user.click(screen.getByRole('button',{name:'重命名问答 历史主题20'}));await user.clear(screen.getByRole('textbox',{name:'问答名称'}));await user.type(screen.getByRole('textbox',{name:'问答名称'}),'我的项目');await user.click(screen.getByRole('button',{name:'保存名称'}));expect((await screen.findByRole('alert')).textContent).toContain('已更新');expect(screen.getByRole('textbox',{name:'问答名称'}).value).toBe('我的项目')
 })
 it('本地问题编辑和恢复原问题均显式保存，不改官网原文',async()=>{
  const round=fixture().rounds[0],save=vi.fn(async()=>{}),close=vi.fn(),user=userEvent.setup();render(<QuestionEditor round={round} onSave={save} onClose={close}/>);expect(screen.getByRole('textbox',{name:'本地问题正文'}).value).toBe('本地修订问题');await user.click(screen.getByRole('button',{name:'恢复原问题'}));expect(save).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'保存本地问题'}));expect(save).toHaveBeenCalledWith('官网原问题');expect(round.question).toBe('官网原问题');expect(close).toHaveBeenCalled()
 })
 it('冷启动不恢复已删除的最后选中问答',()=>{const s=fixture();expect(restoreWebAITopic('scope',s.topics,{getItem:()=> 't41'})).toBe('t40')})
})
