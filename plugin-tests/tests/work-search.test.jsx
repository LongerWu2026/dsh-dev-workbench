import {toolButton,openTools} from './tool-picker.mjs'
import React from 'react'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
let WB
const group=(id,kind,title,count=1)=>({id,label:id,status:'ok',items:Array.from({length:count},(_,i)=>({id:id+i,kind,title:title+i,snippet:'合成内容',extra:{}}))})
beforeEach(()=>{WB=loadClientBundle().WB;WB.store.set({status:'ready',data:{settings:{},projects:[],tasks:[],sources:[],knowledge:[],radar:[],replies:[],analysisQueue:[],jobs:[]}})})
afterEach(()=>{cleanup();vi.useRealTimers()})
describe('工作搜索与首页简化',()=>{
 it('工作与网页检索分别传递范围，工作类型切换仅筛选结果',async()=>{
  const user=userEvent.setup();WB.actions.search=vi.fn(async()=>({query:'验收',groups:[group('tasks','task','待办结果'),group('knowledge','knowledge','知识结果'),{id:'enterprise',label:'企业',status:'ok',items:[{id:'doc',kind:'knowledge',title:'企业文档'},{id:'msg',kind:'source',title:'企业消息'}]},group('web','web','网页结果')]}));render(<WB.pages.search/>);
  await user.type(screen.getByRole('textbox',{name:'工作搜索关键词'}),'验收');await user.click(screen.getByRole('button',{name:'搜索',exact:true}));await screen.findByText('待办结果0');expect(screen.queryByText('网页结果0')).toBeNull();
  expect(WB.actions.search).toHaveBeenLastCalledWith('验收',{scope:'work',includeWeb:false});await user.click(screen.getByRole('button',{name:'知识',exact:true}));expect(screen.queryByText('待办结果0')).toBeNull();expect(screen.getByText('知识结果0')).toBeTruthy();expect(screen.getByText('企业文档')).toBeTruthy();expect(screen.queryByText('企业消息')).toBeNull();expect(WB.actions.search).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('tab',{name:'互联网',exact:true}));expect(screen.queryByText('知识结果0')).toBeNull();await user.click(screen.getByRole('button',{name:'搜索',exact:true}));await screen.findByText('网页结果0');expect(screen.queryByText('待办结果0')).toBeNull();expect(WB.actions.search).toHaveBeenLastCalledWith('验收',{scope:'web',includeWeb:true});
 })
 it('切换模式后旧请求晚到不能覆盖新模式，输入关键词不自动发请求',async()=>{
  let finish;WB.actions.search=vi.fn(()=>new Promise(resolve=>{finish=resolve}));render(<WB.pages.search/>);fireEvent.change(screen.getByRole('textbox'),{target:{value:'延迟'}});expect(WB.actions.search).not.toHaveBeenCalled();fireEvent.submit(screen.getByRole('textbox').closest('form'));fireEvent.click(screen.getByRole('tab',{name:'互联网'}));await act(async()=>finish({groups:[group('tasks','task','旧结果')]}));expect(screen.queryByText('旧结果0')).toBeNull();expect(screen.getByRole('button',{name:'搜索',exact:true}).disabled).toBe(false);
 })
 it('结果直接展开，较多结果提供查看更多，筛选归入单一入口',async()=>{
  WB.actions.search=vi.fn(async()=>({groups:[group('knowledge','knowledge','展开结果',8)]}));render(<WB.pages.search/>);fireEvent.change(screen.getByRole('textbox'),{target:{value:'验收'}});fireEvent.click(screen.getByRole('button',{name:'搜索',exact:true}));await screen.findByText('展开结果0');expect(screen.queryByText('展开结果5')).toBeNull();expect(screen.getByText('展开结果0').closest('details')).toBeNull();fireEvent.click(screen.getByRole('button',{name:/查看更多/}));expect(screen.getByText('展开结果7')).toBeTruthy();expect(screen.queryByText('来源筛选：')).toBeNull();expect(screen.getByText('筛选').closest('details').open).toBe(false);
 })
 it('命令面板交接网页范围时使用网页请求，并保留来源筛选交接',async()=>{
  WB.actions.search=vi.fn(async()=>({groups:[group('web','web','交接网页')]}));WB.store.set({searchPreset:{query:'网页问题',groups:['web']}});render(<WB.pages.search/>);await screen.findByText('交接网页0');expect(WB.actions.search).toHaveBeenLastCalledWith('网页问题',{scope:'web',includeWeb:true});expect(screen.getByRole('tab',{name:'互联网'}).getAttribute('aria-selected')).toBe('true');
 })
 it('首页不显示快捷折叠卡，工具箱番茄钟切换工具后继续计时',async()=>{
  const view=render(<WB.pages.dashboard/>);expect(screen.queryByText('快捷操作与专注')).toBeNull();expect(screen.queryByText('25:00')).toBeNull();view.unmount();vi.useFakeTimers();render(<WB.pages.toolbox/>);openTools();const group=screen.getByText('专注与休息').closest('details');expect(group.open).toBe(false);expect(toolButton(/番茄钟 25 分钟/).closest('details')).toBe(group);openTools();fireEvent.click(screen.getByText('专注与休息'));expect(group.open).toBe(true);fireEvent.click(toolButton(/番茄钟 25 分钟/));fireEvent.click(screen.getByRole('button',{name:'开始',exact:true}));await act(async()=>vi.advanceTimersByTimeAsync(2000));expect(screen.getByText('24:58')).toBeTruthy();openTools();fireEvent.click(screen.getByText('专注与休息'));expect(group.open).toBe(false);fireEvent.click(toolButton(/JSON 格式化/));await act(async()=>vi.advanceTimersByTimeAsync(1000));openTools();fireEvent.click(screen.getByText('专注与休息'));fireEvent.click(toolButton(/番茄钟 25 分钟/));expect(screen.getByText('24:57')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'重置',exact:true}));expect(screen.getByText('25:00')).toBeTruthy();
 })
})
