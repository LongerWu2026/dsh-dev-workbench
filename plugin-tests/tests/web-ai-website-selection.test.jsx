import React from 'react'
import {afterEach,describe,it,expect,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {WB} from '../../src/client/core/runtime.ts'
import {WebAIPage} from '../../src/client/features/web-ai/WebAIPage.tsx'

const fixtures=vi.hoisted(()=>({operations:[]}))
vi.mock('../../src/client/features/web-ai/NativeWebsite.tsx',async()=>{
 const React=await import('react')
 return{nativeWebAIBridge:()=>({protocolVersion:1}),NativeWebsite:({providerId,url,visible,onController})=>{
  React.useEffect(()=>{onController({execute:async action=>{fixtures.operations.push(action);return{status:'ready',busy:false,hasDraft:false}},navigate:async()=>{},authentication:async()=>({status:'authenticated'})});return()=>onController(null)},[providerId])
  return <div data-testid={'website-'+providerId} data-url={url} hidden={!visible}/>
 }}
})
afterEach(()=>{cleanup();fixtures.operations.length=0;vi.restoreAllMocks()})
const at='2026-11-03T08:00:00Z'
const answer=providerId=>({providerId,text:providerId+' 回答',status:'completed',url:null,note:'',updatedAt:at})
const round=(id,topicId='a')=>({id,topicId,requestId:id,question:id+' 问题',createdAt:at,answers:['kimi','glm','doubao'].map(answer)})
async function setup(empty=false){
 const state={topics:[{id:'b',title:'会话 B',createdAt:at,conversations:{}},{id:'a',title:'会话 A',createdAt:at,conversations:{doubao:'https://www.doubao.com/chat/a'}}],rounds:empty?[]:[round('较早'),round('最后'),round('另一会话','b')],chatgptEnabled:false}
 WB.store.set({data:{webAI:state,revision:1},status:'ready'})
 const rpc=vi.spyOn(WB,'rpc').mockImplementation(async method=>{if(method==='workbench/webAIState')return{state,capabilities:{storageScope:'website-selection',historyProtocol:1}};throw Error('不应调用 '+method)})
 const view=render(<WebAIPage/>),user=userEvent.setup();await screen.findByRole('heading',{name:'会话 A',level:2})
 return{state,user,rpc,view}
}
const message=id=>screen.getByRole('article',{name:'对话轮次 '+id+' 问题'})
async function open(user,provider){
 await user.click(screen.getByRole('button',{name:'登录 / 官网',exact:true}));const dialog=await screen.findByRole('dialog',{name:'登录与原对话'})
 expect(within(dialog).getByTestId('website-'+provider).hidden).toBe(false);return dialog
}
async function close(user){await user.click(screen.getByRole('button',{name:'返回聊天',exact:true}))}
describe('顶部官网跟随最后一轮回答页签',()=>{
 it('最后一轮选豆包，打开对应已保存原对话；官网中切换厂商不改变回答页签选择',async()=>{
  const{user,rpc}=await setup();const editor=screen.getByRole('textbox',{name:'多 AI 对话问题'});await user.type(editor,'保留的草稿')
  await user.click(within(message('最后')).getByRole('tab',{name:'豆包'}));let dialog=await open(user,'doubao')
  expect(within(dialog).getByTestId('website-doubao').getAttribute('data-url')).toBe('https://www.doubao.com/chat/a')
  await user.click(within(dialog).getByRole('button',{name:'智谱清言',exact:true}));expect(within(dialog).getByTestId('website-glm').hidden).toBe(false);await close(user)
  expect(within(message('最后')).getByRole('tab',{name:'豆包'}).getAttribute('aria-selected')).toBe('true');await open(user,'doubao');await close(user);expect(editor.value).toBe('保留的草稿');expect(rpc.mock.calls.every(([method])=>method==='workbench/webAIState')).toBe(true)
 })
 it('切换较早轮次只改变该轮回答，顶部仍打开最后一轮的默认Kimi',async()=>{
  const{user}=await setup();await user.click(within(message('较早')).getByRole('tab',{name:'豆包'}));await open(user,'kimi');await close(user)
  await user.click(within(message('最后')).getByRole('tab',{name:'智谱清言'}));await open(user,'glm');await close(user)
  await user.click(within(message('较早')).getByRole('tab',{name:'Kimi'}));await open(user,'glm')
 })
 it('切换会话各自记住最后一轮页签，新对话默认Kimi',async()=>{
  const{user}=await setup();await user.click(within(message('最后')).getByRole('tab',{name:'豆包'}));await open(user,'doubao');await close(user)
  await user.click(screen.getByRole('button',{name:'选择会话 会话 B'}));await open(user,'kimi');await close(user)
  await user.click(screen.getByRole('button',{name:'选择会话 会话 A'}));await open(user,'doubao');await close(user)
  await user.click(screen.getByRole('button',{name:'新对话',exact:true}));await open(user,'kimi')
 })
 it('无消息时不沿用官网上次选中的厂商，始终默认Kimi',async()=>{
  const{user}=await setup(true);const dialog=await open(user,'kimi');await user.click(within(dialog).getByRole('button',{name:'豆包',exact:true}));await close(user);await open(user,'kimi')
 })
 it('新增最后一轮后不沿用上一轮选择，正文增量更新保留已有选择',async()=>{
  const{user,state}=await setup();await user.click(within(message('最后')).getByRole('tab',{name:'豆包'}))
  await act(async()=>WB.store.set({data:{webAI:structuredClone(state),revision:2}}));await open(user,'doubao');await close(user)
  const next={...state,rounds:[...state.rounds,round('新增')]};await act(async()=>WB.store.set({data:{webAI:next,revision:3}}));await open(user,'kimi')
 })
 it('回答自己的原对话操作仍按该条回答打开，不受最后一轮选择影响',async()=>{
  const{user}=await setup();await user.click(within(message('最后')).getByRole('tab',{name:'豆包'}));const older=message('较早');await user.click(within(older).getByRole('tab',{name:'智谱清言'}))
  fireEvent.click(within(older).getByLabelText('回答更多操作'));await user.click(within(older).getByRole('button',{name:'登录 / 查看原对话'}))
  const dialog=await screen.findByRole('dialog',{name:'登录与原对话'});expect(within(dialog).getByTestId('website-glm').hidden).toBe(false)
 })
})
