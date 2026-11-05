import React from 'react'
import {afterEach,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,act,cleanup} from '@testing-library/react'
import {ConversationThread} from '../../src/client/features/web-ai/ConversationThread.tsx'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
function fixture(extra={}){
 const rounds=[{id:'r',topicId:'t',question:'架构方案',createdAt:'2026-11-03T10:00:00Z',answers:[{providerId:'kimi',status:'completed',text:'简短回答'},{providerId:'chatgpt',status:'completed',text:'较长的架构回答\n'.repeat(100)}]}]
 return {topicId:'t',visible:true,rounds,total:1,filter:'all',authentication:{},busy:false,canEdit:true,onEarlier:vi.fn(),onOpen:vi.fn(),onEditQuestion:vi.fn(),onEditAnswer:vi.fn(),onKnowledge:vi.fn(),...extra}
}
function geometry(node,initial=1000){let height=initial;Object.defineProperty(node,'scrollHeight',{get:()=>height,configurable:true});Object.defineProperty(node,'clientHeight',{value:200,configurable:true});return value=>height=value}
it('原来位于底部时切换更长回答保留阅读位置，后续尺寸变化也不跳到底',()=>{
 const observers=[];vi.stubGlobal('ResizeObserver',class{constructor(callback){observers.push(callback)}observe(){}disconnect(){}})
 const p=fixture(),view=render(<ConversationThread {...p}/>),node=screen.getByLabelText('聊天记录'),height=geometry(node)
 node.scrollTop=800;fireEvent.scroll(node);height(2400)
 fireEvent.click(screen.getByRole('tab',{name:'ChatGPT'}))
 expect(node.scrollTop).toBe(800);expect(screen.getByRole('tab',{name:'ChatGPT'}).getAttribute('aria-selected')).toBe('true')
 act(()=>observers.forEach(callback=>callback([])));expect(node.scrollTop).toBe(800)
})
it('切换后收到新内容保持位置，用户滚回底部后恢复跟随',()=>{
 const p=fixture(),view=render(<ConversationThread {...p}/>),node=screen.getByLabelText('聊天记录'),height=geometry(node)
 node.scrollTop=800;fireEvent.scroll(node);fireEvent.click(screen.getByRole('tab',{name:'ChatGPT'}));height(2400)
 const rows=p.rounds.map(r=>({...r,answers:r.answers.map(a=>({...a,text:a.text+'追加内容'}))}));view.rerender(<ConversationThread {...p} rounds={rows}/>);expect(node.scrollTop).toBe(800)
 node.scrollTop=2200;fireEvent.scroll(node);height(2600);view.rerender(<ConversationThread {...p} rounds={rows.map(r=>({...r}))}/>);expect(node.scrollTop).toBe(2600)
})
it('受控厂商页签同样保留位置，不受父组件刷新影响',()=>{
 const select=vi.fn(),p=fixture({answerChoices:{r:'kimi'},onSelectAnswer:select}),view=render(<ConversationThread {...p}/>),node=screen.getByLabelText('聊天记录'),height=geometry(node)
 node.scrollTop=800;fireEvent.scroll(node);fireEvent.click(screen.getByRole('tab',{name:'ChatGPT'}));height(2400)
 view.rerender(<ConversationThread {...p} answerChoices={{r:'chatgpt'}}/>);expect(node.scrollTop).toBe(800);expect(select).toHaveBeenCalledWith('r','chatgpt')
})
it('切换厂商后再打开另一会话仍使用新会话的正常定位',()=>{
 const p=fixture(),view=render(<ConversationThread {...p}/>),node=screen.getByLabelText('聊天记录');geometry(node)
 node.scrollTop=800;fireEvent.scroll(node);fireEvent.click(screen.getByRole('tab',{name:'ChatGPT'}))
 view.rerender(<ConversationThread {...p} topicId="another-topic"/>);expect(node.scrollTop).toBe(1000)
})
