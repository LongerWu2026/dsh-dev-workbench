import React from 'react'
import {afterEach,describe,it,expect,vi} from 'vitest'
import {render,screen,waitFor,cleanup,act} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(cleanup)
const fingerprint='a'.repeat(64),entry={name:'README.md',path:'README.md',kind:'file'}
const progress=(entries=[],extra={})=>({entries,total:entries.length,summary:{reviewed:0,pending:0,stale:0},...extra})
function setup(){
 const {WB}=loadClientBundle();let App
 WB.apply({effect:fn=>fn(),get:()=>undefined,slots:{inject(_name,fn){fn();return()=>{}},register(definition,component){if(definition.name==='main')App=component;return()=>{}}}})
 WB.store.set({page:'collab',status:'ready',data:{settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:false}},tasks:[],sources:[],replies:[],radar:[],knowledge:[],jobs:[],runs:[],connectors:[],projects:[{id:'front',name:'前端',repoPath:'/fixture/front'},{id:'back',name:'后端',repoPath:'/fixture/back'}]}})
 WB.actions.syncCheck=vi.fn().mockResolvedValue(null);WB.actions.environment=async()=>({git:[]});WB.openHarnessFile=vi.fn()
 let handler=async()=>undefined
 WB.rpc=vi.fn(async(method,{request})=>{
  const override=await handler(request);if(override!==undefined)return override
  if(request.action==='workspace')return {search:{query:'',caseSensitive:false,history:[]}}
  if(request.action==='reviews')return progress()
  if(request.action==='search')return {...request,hits:[{path:'README.md',line:2,column:1,snippet:'Needle content'}],scanned:2}
  if(request.action==='resolve')return {path:request.path,kind:'file'}
  if(request.action==='read')return {path:request.path,text:'first\nNeedle content\nlast',fingerprint,review:{status:'pending'}}
  if(request.action==='diff')return {path:request.path,status:' M',sections:[{id:'unstaged',label:'未暂存',text:'-old\n+new'}],fingerprint,review:{status:'pending'}}
  return {entries:[entry],total:1}
 })
 return {WB,App,respond:fn=>{handler=fn},calls:action=>WB.rpc.mock.calls.map(([,args])=>args.request).filter(row=>row.action===action)}
}
describe('项目全文搜索与审阅进度',()=>{
 it('搜索由用户触发，按项目传参，结果在工作台右侧定位真实行',async()=>{
  const {WB,App,calls}=setup(),user=userEvent.setup();render(<App/>);await screen.findByRole('button',{name:'打开文件 · README.md'})
  expect(calls('search')).toHaveLength(0);await user.type(screen.getByRole('textbox',{name:'项目全文搜索词'}),'Needle');await user.click(screen.getByRole('checkbox',{name:'区分大小写'}));await user.click(screen.getByRole('button',{name:'搜索项目'}))
  await user.click(await screen.findByRole('button',{name:'打开搜索结果 · README.md:2'}));await screen.findByText('定位到第 2 行')
  expect(screen.getByLabelText('文件内容').querySelector('mark').textContent).toBe('Needle content');expect(calls('search')).toEqual([{projectId:'front',action:'search',query:'Needle',caseSensitive:true}]);expect(WB.openHarnessFile).not.toHaveBeenCalled();expect(WB.store.get().page).toBe('collab')
 })
 it('切换项目分别恢复搜索词与结果，返回页面保持快照且不自动重搜',async()=>{
  const {App,respond,calls}=setup(),user=userEvent.setup();respond(async request=>request.action==='workspace'?{search:{query:request.projectId==='front'?'前端搜索':'后端搜索',history:[request.projectId+' history']}}:undefined)
  const view=render(<App/>);await waitFor(()=>expect(screen.getByRole('textbox',{name:'项目全文搜索词'}).value).toBe('前端搜索'))
  await user.click(screen.getByRole('button',{name:'搜索项目'}));await screen.findByRole('button',{name:'打开搜索结果 · README.md:2'})
  await user.selectOptions(screen.getByRole('combobox',{name:'当前项目'}),'back');await waitFor(()=>expect(screen.getByRole('textbox',{name:'项目全文搜索词'}).value).toBe('后端搜索'));expect(screen.queryByRole('button',{name:'打开搜索结果 · README.md:2'})).toBeNull()
  await user.clear(screen.getByRole('textbox',{name:'项目全文搜索词'}));await user.type(screen.getByRole('textbox',{name:'项目全文搜索词'}),'后端草稿')
  await user.selectOptions(screen.getByRole('combobox',{name:'当前项目'}),'front');expect(screen.getByRole('textbox',{name:'项目全文搜索词'}).value).toBe('前端搜索');await screen.findByRole('button',{name:'打开搜索结果 · README.md:2'})
  view.unmount();render(<App/>);expect(screen.getByRole('textbox',{name:'项目全文搜索词'}).value).toBe('前端搜索');expect(calls('search')).toHaveLength(1)
  await user.selectOptions(screen.getByRole('combobox',{name:'当前项目'}),'back');expect(screen.getByRole('textbox',{name:'项目全文搜索词'}).value).toBe('后端草稿')
 })
 it('迟到的历史不覆盖输入，旧项目的搜索响应不覆盖新项目',async()=>{
  const {App,respond}=setup(),user=userEvent.setup();let finishHistory,finishSearch
  respond(async request=>request.projectId==='front'&&request.action==='workspace'?new Promise(resolve=>{finishHistory=resolve}):request.projectId==='front'&&request.action==='search'?new Promise(resolve=>{finishSearch=resolve}):undefined)
  render(<App/>);await user.type(screen.getByRole('textbox',{name:'项目全文搜索词'}),'新输入');await act(async()=>finishHistory({search:{query:'旧输入',history:[]}}));expect(screen.getByRole('textbox',{name:'项目全文搜索词'}).value).toBe('新输入')
  await user.click(screen.getByRole('button',{name:'搜索项目'}));await screen.findByText('正在搜索当前项目…');await user.selectOptions(screen.getByRole('combobox',{name:'当前项目'}),'back')
  await act(async()=>finishSearch({query:'新输入',hits:[{path:'旧项目.ts',line:1,snippet:'旧结果'}]}));expect(screen.queryByText('旧结果')).toBeNull();expect(screen.getByRole('textbox',{name:'项目全文搜索词'}).value).toBe('')
 })
 it('文件与差异按当前内容标记，保存成功才刷新本项目进度并支持取消',async()=>{
  const {App,respond,calls}=setup(),user=userEvent.setup();let reviewed=false
  respond(async request=>{
   if(request.action==='reviews')return progress([{path:'README.md',view:'diff',changeStatus:' M',status:reviewed?'reviewed':'pending'}],{summary:{reviewed:reviewed?1:0,pending:reviewed?0:1}})
   if(request.action==='reviewMark'){reviewed=true;return {status:'reviewed',reviewedAt:'2026-11-07T00:00:00Z'}}
   if(request.action==='reviewUnmark'){reviewed=false;return {status:'pending'}}
  })
  render(<App/>);await user.click(await screen.findByRole('button',{name:'打开文件 · README.md'}));await user.click(await screen.findByRole('button',{name:'标记已审阅'}));await screen.findByRole('button',{name:'取消已审阅'});await screen.findByText('已阅 1')
  expect(calls('reviewMark')[0]).toMatchObject({projectId:'front',path:'README.md',view:'file',fingerprint});await user.click(screen.getByRole('button',{name:'取消已审阅'}));await screen.findByRole('button',{name:'标记已审阅'});expect(calls('reviewUnmark')[0]).toMatchObject({projectId:'front',path:'README.md',view:'file'})
  await user.click(screen.getByRole('button',{name:'关闭文件预览'}));await user.click(screen.getByRole('button',{name:'继续审阅 · README.md · diff'}));await screen.findByLabelText('文件差异');await user.click(screen.getByRole('button',{name:'标记已审阅'}));await screen.findByRole('button',{name:'取消已审阅'})
  expect(calls('reviewMark')[1]).toMatchObject({projectId:'front',path:'README.md',view:'diff',changeStatus:' M',fingerprint});expect(calls('reviews').every(row=>row.projectId==='front')).toBe(true)
 })
 it('标记失败不会伪造已审阅，旧项目保存迟到不会重开文件',async()=>{
  const {WB,App,respond}=setup(),user=userEvent.setup();let finish,fail=true
  respond(async request=>{if(request.action==='reviewMark'){if(fail)throw Error('文件内容已变化，请重新读取');return new Promise(resolve=>{finish=resolve})}})
  render(<App/>);await user.click(await screen.findByRole('button',{name:'打开文件 · README.md'}));await user.click(await screen.findByRole('button',{name:'标记已审阅'}));await screen.findByText('文件内容已变化，请重新读取');expect(screen.queryByRole('button',{name:'取消已审阅'})).toBeNull();expect(WB.store.get().projectFilePreview.review.status).toBe('pending')
  fail=false;await user.click(screen.getByRole('button',{name:'标记已审阅'}));await screen.findByRole('button',{name:'保存标记中…'});await user.selectOptions(screen.getByRole('combobox',{name:'当前项目'}),'back');await act(async()=>finish({status:'reviewed'}))
  expect(screen.queryByLabelText('项目文件预览')).toBeNull();expect(WB.store.get().projectReviewVersions.front).toBe(1);expect(WB.store.get().projectReviewVersions.back).toBeUndefined()
 })
 it('进度筛选重置分页，新项目不展示旧项目记录',async()=>{
  const {App,respond,calls}=setup(),user=userEvent.setup();respond(async request=>request.action==='reviews'?progress([{path:request.projectId+'-'+request.offset+'.ts',view:'diff',changeStatus:' M',status:request.offset?'stale':'pending'}],{total:21,hasMore:!request.offset}):undefined)
  render(<App/>);await screen.findByRole('button',{name:'继续审阅 · front-0.ts · diff'});await user.click(screen.getByRole('button',{name:'下一页记录'}));await screen.findByRole('button',{name:'继续审阅 · front-20.ts · diff'})
  await user.selectOptions(screen.getByRole('combobox',{name:'筛选审阅进度'}),'stale');await waitFor(()=>expect(calls('reviews').at(-1)).toMatchObject({projectId:'front',filter:'stale',offset:0}))
  await user.selectOptions(screen.getByRole('combobox',{name:'当前项目'}),'back');await screen.findByRole('button',{name:'继续审阅 · back-0.ts · diff'});expect(screen.queryByRole('button',{name:/继续审阅 · front/})).toBeNull();expect(screen.getByRole('combobox',{name:'筛选审阅进度'}).value).toBe('all')
 })
 it('过期搜索行号不制造定位，已消失的改动保留记录但不能打开',async()=>{
  const {App,respond}=setup(),user=userEvent.setup();respond(async request=>request.action==='search'?{...request,hits:[{path:'README.md',line:999,snippet:'旧快照'}]}:request.action==='reviews'?progress([{path:'gone.ts',view:'diff',status:'inactive'}]):undefined)
  render(<App/>);expect((await screen.findByRole('button',{name:'继续审阅 · gone.ts · diff'})).disabled).toBe(true);await user.type(screen.getByRole('textbox',{name:'项目全文搜索词'}),'Needle');await user.click(screen.getByRole('button',{name:'搜索项目'}));await user.click(await screen.findByRole('button',{name:'打开搜索结果 · README.md:999'}))
  await screen.findByText('搜索行号已超出当前文件范围，请重新搜索。');expect(screen.getByLabelText('文件内容').querySelector('mark')).toBeNull()
 })
})
