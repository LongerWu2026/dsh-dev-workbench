import React from 'react'
import {afterEach,describe,it,expect,vi} from 'vitest'
import {render,screen,waitFor,cleanup,act,fireEvent} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(cleanup)
const entry=(path,kind='file',extra={})=>({name:path.split('/').at(-1),path,kind,...extra})
function setup(){
 const {WB}=loadClientBundle();let App
 const selectPanel=vi.fn(),layout={panelInfo:{getSnapshot:()=>({activePanelId:'dev-workbench'})},selectPanel}
 WB.apply({effect:fn=>fn(),get:key=>key==='layout'?layout:undefined,slots:{inject(_name,fn){fn();return()=>{}},register(definition,component){if(definition.name==='main')App=component;return()=>{}}}})
 WB.store.set({page:'collab',status:'ready',data:{settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:false}},tasks:[],sources:[],replies:[],radar:[],knowledge:[],jobs:[],runs:[],connectors:[],projects:[{id:'front',name:'前端',repoPath:'/fixture/front'},{id:'back',name:'后端',repoPath:'/fixture/back'}]}})
 WB.actions.syncCheck=vi.fn().mockResolvedValue(null)
 WB.actions.environment=async()=>({git:[],docker:{status:'ok',containers:[]}});WB.actions.github=async()=>({status:'ok',prs:{status:'ok',items:[]},runs:{status:'ok',items:[]}})
 let respond=async request=>request.action==='resolve'?{path:request.path,absolutePath:'/fixture/'+request.projectId+'/'+request.path,kind:'file'}:request.action==='read'?{path:request.path,absolutePath:'/fixture/'+request.projectId+'/'+request.path,text:'真实内容 <img src=x onerror=alert(1)>'}:{entries:[entry('src','directory'),entry('README.md')],total:2,hasMore:false}
 WB.rpc=vi.fn(async(method,{request})=>method.endsWith('/projectFiles')?(request.action==='workspace'?{search:{query:'',history:[]}}:request.action==='reviews'?{entries:[],total:0,summary:{}}:respond(request)):{commands:[],runs:[]})
 return {WB,App,selectPanel,respond:fn=>{respond=fn},fileCalls:()=>WB.rpc.mock.calls.filter(([method,args])=>method.endsWith('/projectFiles')&&!['workspace','reviews'].includes(args.request.action)).map(([,args])=>args.request)}
}
describe('项目文件与现有侧栏联动',()=>{
 it('浏览目录、翻页、筛选与统一刷新始终携带当前项目ID',async()=>{
  const {WB,App,respond,fileCalls}=setup(),user=userEvent.setup()
  respond(async request=>({entries:request.path==='src'?[entry('src/index.ts')]:[entry('src','directory')],total:request.path==='src'?101:1,hasMore:request.path==='src'&&!request.offset}))
  render(<App/>);await user.click(await screen.findByRole('button',{name:'打开目录 · src'}));await screen.findByRole('button',{name:'打开文件 · src/index.ts'})
  expect(fileCalls().at(-1)).toMatchObject({projectId:'front',action:'list',path:'src',offset:0})
  await user.click(screen.getByRole('button',{name:'下一页'}));await waitFor(()=>expect(fileCalls().at(-1).offset).toBe(100))
  await user.type(screen.getByRole('textbox',{name:'筛选项目文件'}),'index');await waitFor(()=>expect(fileCalls().at(-1)).toMatchObject({query:'index',offset:0}))
  const count=fileCalls().length;await user.click(screen.getByRole('button',{name:'刷新项目'}));await waitFor(()=>expect(fileCalls().length).toBeGreaterThan(count))
  await user.selectOptions(screen.getByRole('combobox',{name:'当前项目'}),'back');await screen.findByRole('button',{name:'打开目录 · src'});expect(fileCalls().at(-1)).toMatchObject({projectId:'back',path:'',query:''})
 })
 it('点击文件直接在整个工作台右侧打开，不调用会切回聊天的入口',async()=>{
  const {WB,App,selectPanel,respond,fileCalls}=setup(),user=userEvent.setup(),path='报告 #1.ts'
  respond(async request=>request.action==='resolve'?{path,absolutePath:'/fixture/报告 #1.ts',kind:'file'}:request.action==='read'?{path,text:'中文文件内容'}:{entries:[entry(path)],total:1})
  WB.openHarnessFile=vi.fn().mockResolvedValue(true);render(<App/>);await user.click(await screen.findByRole('button',{name:'打开文件 · '+path}))
  await screen.findByText('中文文件内容');expect(WB.openHarnessFile).not.toHaveBeenCalled();expect(selectPanel).not.toHaveBeenCalled();expect(WB.store.get().page).toBe('collab')
  expect(fileCalls().some(row=>row.action==='read'&&row.path===path)).toBe(true)
  const sidebar=screen.getByLabelText('项目文件预览');expect(sidebar.parentElement.parentElement.classList.contains('wb-workarea')).toBe(true);expect(sidebar.closest('.wb-card')).toBeNull()
  expect(screen.queryByRole('button',{name:'在宿主文件侧栏打开'})).toBeNull();expect(screen.getByRole('combobox',{name:'当前项目'}).value).toBe('front')
 })
 it('没有原生会话也能只读预览，Escape关闭并恢复焦点',async()=>{
  const {WB,App}=setup(),user=userEvent.setup();WB.openHarnessFile=vi.fn().mockResolvedValue(false);render(<App/>)
  const trigger=await screen.findByRole('button',{name:'打开文件 · README.md'});await user.click(trigger);const content=await screen.findByLabelText('文件内容')
  expect(content.textContent).toContain('<img src=x onerror=alert(1)>');expect(content.querySelector('img')).toBeNull();expect(WB.openHarnessFile).not.toHaveBeenCalled()
  await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('button',{name:'关闭文件预览'})));await user.keyboard('{Escape}');expect(screen.queryByLabelText('文件内容')).toBeNull();expect(document.activeElement).toBe(trigger)
 })
 it('读取失败留在右侧展示原因，可重试且不跳转聊天',async()=>{
  const {WB,App,respond}=setup(),user=userEvent.setup();WB.openHarnessFile=vi.fn().mockResolvedValue(true);let failed=true
  respond(async request=>request.action==='read'?(failed?Promise.reject(Error('暂时无法读取文件')):{path:request.path,text:'重试成功'}):request.action==='resolve'?{path:request.path,absolutePath:'/fixture/README.md',kind:'file'}:{entries:[entry('README.md')],total:1})
  render(<App/>);await user.click(await screen.findByRole('button',{name:'就地预览 · README.md'}));await screen.findByText('暂时无法读取文件');expect(WB.store.get().page).toBe('collab')
  failed=false;await user.click(screen.getByRole('button',{name:'重新读取'}));await screen.findByText('重试成功');expect(WB.openHarnessFile).not.toHaveBeenCalled()
 })
 it('改动列表展示重命名前路径，已删除文件不可打开，列表失败可重试',async()=>{
  const {WB,App,respond,fileCalls}=setup(),user=userEvent.setup();let attempts=0
  respond(async request=>{if(request.action==='changes'&&attempts++===0)throw Error('Git 暂不可用');return {entries:[entry('new.ts','file',{status:'R ',previousPath:'old.ts'}),entry('gone.ts','file',{status:' D',deleted:true})],total:2}})
  render(<App/>);await screen.findByRole('button',{name:'打开文件 · new.ts'});await user.click(screen.getByRole('button',{name:'未提交改动'}));await screen.findByText('Git 暂不可用');await user.click(screen.getByRole('button',{name:'重试读取文件'}))
  await screen.findByText('原路径：old.ts');expect(screen.getByRole('button',{name:'打开文件 · gone.ts'}).disabled).toBe(true);expect(screen.queryByRole('button',{name:'就地预览 · gone.ts'})).toBeNull();expect(fileCalls().at(-1).action).toBe('changes')
 })
 it('旧目录、旧文件及旧项目的迟到响应不能覆盖当前选择',async()=>{
  const {WB,App,respond}=setup(),user=userEvent.setup();let finishFile,finishDirectory
  respond(async request=>request.action==='read'?new Promise(resolve=>{finishFile=resolve}):request.action==='resolve'?{path:request.path,absolutePath:'/fixture/'+request.path,kind:'file'}:request.path==='src'?new Promise(resolve=>{finishDirectory=resolve}):{entries:[entry('src','directory'),entry('README.md')],total:2})
  render(<App/>);await user.click(await screen.findByRole('button',{name:'就地预览 · README.md'}));await screen.findByText('正在读取文件…');await user.click(screen.getByRole('button',{name:'打开目录 · src'}))
  await user.selectOptions(screen.getByRole('combobox',{name:'当前项目'}),'back');await screen.findByRole('button',{name:'打开文件 · README.md'})
  await act(async()=>{finishFile({path:'README.md',text:'旧文件内容'});finishDirectory({entries:[entry('stale.ts')],total:1})})
  expect(screen.queryByText('旧文件内容')).toBeNull();expect(screen.queryByRole('button',{name:'打开文件 · stale.ts'})).toBeNull()
 })
 it('离开再返回研发协作时保留该项目的文件目录',async()=>{
  const {App,respond}=setup(),user=userEvent.setup();respond(async request=>({entries:request.path?[entry('src/index.ts')]:[entry('src','directory')],total:1}))
  const view=render(<App/>);await user.click(await screen.findByRole('button',{name:'打开目录 · src'}));await screen.findByRole('button',{name:'打开文件 · src/index.ts'});view.unmount()
  render(<App/>);await screen.findByRole('button',{name:'打开文件 · src/index.ts'});expect(screen.getByRole('navigation',{name:'项目目录'}).textContent).toContain('src')
 })
 it('关闭侧栏、离开页面或切换项目后，迟到的文件内容不会重开侧栏',async()=>{
  const {WB,App,respond}=setup(),user=userEvent.setup();let finish
  respond(async request=>request.action==='read'?new Promise(resolve=>{finish=resolve}):request.action==='resolve'?{path:request.path,kind:'file'}:{entries:[entry('README.md')],total:1})
  render(<App/>);await user.click(await screen.findByRole('button',{name:'打开文件 · README.md'}));await screen.findByText('正在读取文件…');await user.click(screen.getByRole('button',{name:'关闭文件预览'}))
  await act(async()=>finish({text:'已关闭的文件'}));expect(screen.queryByLabelText('项目文件预览')).toBeNull()
  await user.click(screen.getByRole('button',{name:'打开文件 · README.md'}));await screen.findByText('正在读取文件…');await act(async()=>WB.store.set({page:'settings'}));await act(async()=>finish({text:'旧页面的文件'}))
  expect(screen.queryByLabelText('项目文件预览')).toBeNull();expect(WB.store.get().projectFilePreview).toBeNull()
 })
 it('切换项目关闭右侧文件，不清空列表筛选；新建待办优先且保留草稿',async()=>{
  const {WB,App}=setup(),user=userEvent.setup();render(<App/>)
  await user.type(screen.getByRole('textbox',{name:'筛选项目文件'}),'README');await user.click(await screen.findByRole('button',{name:'打开文件 · README.md'}));await screen.findByLabelText('文件内容')
  expect(screen.getByRole('textbox',{name:'筛选项目文件'}).value).toBe('README');await user.selectOptions(screen.getByRole('combobox',{name:'当前项目'}),'back');await waitFor(()=>expect(screen.queryByLabelText('项目文件预览')).toBeNull())
  await user.click(await screen.findByRole('button',{name:'打开文件 · README.md'}));await screen.findByLabelText('文件内容');await act(async()=>WB.openTaskForm(null,{title:'待保留草稿'}))
  await waitFor(()=>expect(screen.queryByLabelText('项目文件预览')).toBeNull());expect(WB.store.get().taskForm.defaults.title).toBe('待保留草稿')
 })
 it('可审阅已删除文件，在右侧分别展示暂存和未暂存差异并复制',async()=>{
  const {WB,App,respond,fileCalls}=setup(),user=userEvent.setup();WB.util.copy=vi.fn().mockResolvedValue();WB.openHarnessFile=vi.fn()
  respond(async request=>request.action==='diff'?{path:request.path,status:' D',projectName:'前端',sections:[{id:'staged',label:'已暂存',text:''},{id:'unstaged',label:'未暂存',text:'--- a/gone.ts\n+++ /dev/null\n-old value\n'}]}:{entries:[entry('gone.ts','file',{status:' D',deleted:true})],total:1})
  render(<App/>);await user.click(screen.getByRole('button',{name:'未提交改动'}));await user.click(await screen.findByRole('button',{name:'审阅改动 · gone.ts'}));const diff=await screen.findByLabelText('文件差异')
  expect(diff.textContent).toContain('已暂存');expect(diff.textContent).toContain('此部分没有差异');expect(diff.textContent).toContain('-old value');expect(fileCalls().at(-1)).toEqual({projectId:'front',path:'gone.ts',action:'diff',changeStatus:' D'})
  await user.click(screen.getByRole('button',{name:'复制差异'}));expect(WB.util.copy.mock.calls[0][0]).toContain('状态：删除');expect(WB.util.copy.mock.calls[0][0]).toContain('-old value');expect(WB.openHarnessFile).not.toHaveBeenCalled();expect(WB.store.get().page).toBe('collab')
 })
 it('解释改动只交接到助手草稿，不自动发送或修改文件',async()=>{
  const {WB,App,respond}=setup(),user=userEvent.setup();WB.assistant.openHub=vi.fn()
  respond(async request=>request.action==='diff'?{path:request.path,status:' M',sections:[{id:'unstaged',label:'未暂存',text:'-old\n+new'}]}:{entries:[entry('a.ts','file',{status:' M'})],total:1})
  render(<App/>);await user.click(screen.getByRole('button',{name:'未提交改动'}));await user.click(await screen.findByRole('button',{name:'审阅改动 · a.ts'}));await screen.findByLabelText('文件差异');await user.click(screen.getByRole('button',{name:'交给 AI 解释'}))
  expect(WB.assistant.openHub).toHaveBeenCalledWith('system','analysis');const draft=WB.store.get().assistantDraftRequest;expect(draft.conversationId).toBe('system:analysis');expect(draft.text).toContain('-old\n+new');expect(draft.text).toContain('不把建议测试当作已通过测试');expect(WB.rpc.mock.calls.every(([method])=>method.endsWith('/projectFiles'))).toBe(true)
 })
 it('复制交接摘要覆盖当前筛选之外的改动，不伪造测试通过',async()=>{
  const {WB,App,respond,fileCalls}=setup(),user=userEvent.setup();WB.util.copy=vi.fn().mockResolvedValue()
  respond(async request=>request.action==='handoff'?{projectName:'前端',root:'/fixture/front',at:'2026-11-07T12:00:00Z',entries:[entry('visible.ts','file',{status:' M'}),entry('outside-current-page.ts','file',{status:'??'})]}:{entries:[entry('visible.ts')],total:1})
  render(<App/>);await user.type(screen.getByRole('textbox',{name:'筛选项目文件'}),'visible');await user.click(screen.getByRole('button',{name:'复制交接摘要'}));await waitFor(()=>expect(WB.util.copy).toHaveBeenCalledTimes(1))
  const text=WB.util.copy.mock.calls[0][0];expect(text).toContain('outside-current-page.ts');expect(text).toContain('本页未执行测试');expect(text).toContain('改动目的：待补充');expect(fileCalls().some(row=>row.action==='handoff'&&!row.query&&!row.offset)).toBe(true)
 })
 it('旧项目差异迟到后不会覆盖新项目或重新打开右侧栏',async()=>{
  const {App,respond}=setup(),user=userEvent.setup();let finish
  respond(async request=>request.action==='diff'?new Promise(resolve=>{finish=resolve}):{entries:[entry('a.ts','file',{status:' M'})],total:1})
  render(<App/>);await user.click(screen.getByRole('button',{name:'未提交改动'}));await user.click(await screen.findByRole('button',{name:'审阅改动 · a.ts'}));await screen.findByText('正在读取差异…');await user.selectOptions(screen.getByRole('combobox',{name:'当前项目'}),'back')
  await act(async()=>finish({sections:[{id:'unstaged',label:'未暂存',text:'旧差异'}]}));expect(screen.queryByLabelText('文件差异')).toBeNull();expect(screen.queryByText('旧差异')).toBeNull()
 })
})
