import React from 'react'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {act,cleanup,render,screen,waitFor,within,fireEvent} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {loadClientBundle} from './load-plugin.mjs'
afterEach(()=>{cleanup();vi.useRealTimers();globalThis.localStorage?.removeItem?.('workbench.assistant.sidebarCollapsed.v1');vi.unstubAllGlobals()})
async function leaveAssistant(user){await user.click(screen.getByRole('navigation',{name:'工作台导航'}).querySelector('[data-page="dashboard"]'))}
async function ready(){await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).disabled).toBe(false))}
async function openReport(user,label){await user.click(screen.getByRole('button',{name:'＋工具'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:new RegExp('^'+label+' ')}))}
async function openMore(user){const menu=await screen.findByLabelText('更多助手操作');if(!menu.closest('details').open)await user.click(menu)}
const fixed=[{id:'system:office',kind:'system',title:'办公历史',fixed:false},{id:'system:analysis',kind:'system',title:'消息识别'},{id:'system:radar',kind:'system',title:'AI 资讯'},{id:'system:knowledge',kind:'system',title:'知识库'}]
function setup(options={}){
 const {WB}=loadClientBundle();let App;const calls=[],conversations=[...fixed,{id:'task:a',kind:'task',entityId:'a',title:'甲的工作'},{id:'task:b',kind:'task',entityId:'b',title:'乙的工作'},{id:'knowledge:k',kind:'knowledge',entityId:'k',title:'部署知识'}]
 const fixture={version:2,revision:1,settings:{topics:[],feeds:[],automation:{enabled:false},aiExtract:{enabled:false}},projects:[],tasks:[{id:'a',title:'甲的工作',status:'ready'},{id:'b',title:'乙的工作',status:'running'}],sources:[],radar:[],replies:[],analysisQueue:[],jobs:[],knowledge:[{id:'k',title:'部署知识',body:'旧地址'}],connectors:[],runs:[],audit:[]}
 if(options.patchFixture)options.patchFixture(fixture)
 const entries={},events={},confirmations={},threads={},settingsPatches=[]
 const handler=async(_channel,endpoint,payload)=>{const request=payload.args?.request||{};let value=fixture
  if(endpoint==='workbench/saveSettings'){if(options.settingsFailure)throw Error(options.settingsFailure);settingsPatches.push(payload.args.patch);fixture.settings={...fixture.settings,...payload.args.patch};fixture.revision++}
  if(endpoint==='workbench/analysisStatus')value={entries:[]}
  if(endpoint==='workbench/assistantHub'){
   calls.push(request);const id=request.conversationId,entity=fixture.tasks.find(t=>'task:'+t.id===id)||fixture.knowledge.find(t=>'knowledge:'+t.id===id)
   if(request.action==='list')value={status:'ok',conversations}
   if(request.action==='detail'||request.action==='select')value={status:'ok',conversation:conversations.find(c=>c.id===id)||{id,kind:'chat',title:'新工作对话'},entity,sessionId:null,messages:entries[id]||[],events:events[id]||[],runs:[],items:[],threads:threads[id]||[],confirmations:confirmations[id]||[]}
   if(request.action==='send'){entries[id]=[...(entries[id]||[]),{role:'user',text:request.text},{role:'assistant',text:'继续处理已登记'}];value={status:'ok',handled:true,note:'继续处理已登记'}}
   if(request.action==='officeTopic'){const topic={kind:request.kind,input:request.input},topicId=request.kind==='work_report'?'office:report-'+request.input.period:request.input.replyIds.length===1?'reply:'+request.input.replyIds[0]:'office:batch';if(!conversations.some(row=>row.id===topicId))conversations.push({id:topicId,kind:topicId.split(':')[0],title:request.kind==='work_report'?(request.input.period==='week'?'本周周报':'今日日报'):'回复主题',topic});value={status:'ok',conversationId:topicId,title:conversations.find(row=>row.id===topicId).title,operation:'office.start',kind:request.kind,input:request.kind==='reply_batch'&&request.input.replyIds.length===1?{replyIds:[request.input.replyIds[0]]}:request.input}}
   if(request.action==='pin'){const row=conversations.find(row=>row.id===id);if(row)row.pinned=request.pinned;value={status:'ok',conversationId:id,pinned:request.pinned}}
   if(request.action==='reset'){value={status:'ok',conversationId:request.conversationId||'chat:new',sessionId:'native-new'}}
   if(request.action==='history')value={status:'ok',messages:[{role:'user',text:'本轮真实提交内容'},{role:'assistant',text:'本轮真实模型结果'}]}
   if(request.action==='operate'){
    if(request.operation==='task.update'){Object.assign(entity,request.patch);fixture.revision++;events[id]=[{id:'change',at:'2026-11-01T10:00:00Z',text:'已将甲的工作标记为已完成'}];value={status:'ok',note:'状态已保存'}}
    if(request.operation==='knowledge.delete'){const confirmation={id:'confirmation-one',title:'删除部署知识',conversationId:id,state:'pending',before:{title:'部署知识',body:'旧地址'}};confirmations[id]=[confirmation];value={status:'confirmation_required',confirmation,note:'请确认删除的知识条目'}}
    if(request.operation==='confirm'){confirmations[id]=[];events[id]=[{id:'deleted',text:'知识已删除'}];value={status:'ok',note:'知识已删除'}}
   }
   const override=options.hub?.(request,{fixture,entries,events,confirmations,threads,conversations,value});if(override!==undefined)value=await override
  }
  return {ok:true,value}
 }
 WB.store.set({data:fixture,status:'ready',page:'assistant',assistantOpen:true,assistantConversationId:options.id||'system:analysis'})
 WB.apply({get:name=>options.services?.[name],effect:fn=>fn(),connection:{rpc:{call:handler}},locale:{register:()=>()=>{},bind:()=>()=>''},slots:{inject(_slot,fn){return fn()},register(descriptor,component){if(descriptor.name==='main')App=component;return()=>{}}}})
 render(<App/>);return {WB,calls,fixture,entries,events,confirmations,settingsPatches}
}
describe('统一助手真实业务入口',()=>{
 it('研发运行时从其他页面返回立即显示上次列表，慢刷新只替换目录且仍可切换会话',async()=>{
  let slow=false,release
  const {WB,calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='list'&&slow?new Promise(resolve=>{release=()=>resolve({...value,conversations:[...value.conversations,{id:'chat:late',kind:'chat',title:'局部刷新新增会话'}]})}):request.action==='detail'?{...value,turnActive:true,messages:[{role:'assistant',text:'运行中的原有进度'}]}:undefined})
  await screen.findByRole('button',{name:'会话：乙的工作'});await screen.findByText('运行中的原有进度')
  slow=true
  await act(async()=>WB.store.set({page:'dashboard',assistantOpen:false}))
  await act(async()=>WB.assistant.openHub('task','a'))
  // Cached directory is available before the new list RPC resolves.
  expect(screen.getByRole('button',{name:'会话：乙的工作'})).toBeTruthy()
  expect(screen.queryByText('正在读取最近会话…')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'会话：乙的工作'}))
  await waitFor(()=>expect(calls.some(row=>row.action==='detail'&&row.conversationId==='task:b')).toBe(true))
  await act(async()=>release());await screen.findByRole('button',{name:'会话：局部刷新新增会话'})
  expect(WB.store.get().assistantConversationId).toBe('task:b')
  expect(calls.every(row=>['list','detail'].includes(row.action))).toBe(true)
 })
 it('首次打开优先读取目录，消息识别不重复提交相同的初始化详情请求',async()=>{
  const {calls}=setup()
  await screen.findByRole('button',{name:'会话：乙的工作'});await ready()
  expect(calls[0].action).toBe('list')
  await new Promise(resolve=>setTimeout(resolve,250))
  expect(calls.filter(row=>row.action==='detail')).toHaveLength(1)
 })
 it.each([['conversation_backfill','rate_limit','等待云之家限流恢复'],['conversation_backfill',null,'等待历史消息补齐'],['lease_wait',null,'等待其他识别结束'],['retry_wait',null,'等待重试时间']])('识别等待按真实原因展示且不重复正文：%s %s',async(waitReason,waitDetail,heading)=>{
  const reason='15 条消息等待历史补齐，补采完成后自动继续'
  setup({hub:(request,{value})=>request.action==='detail'?{...value,runs:[{id:'waiting-run',kind:'analysis',status:'queued',nextRetryAt:'2026-11-04T11:15:00Z',progress:{processed:0,remaining:15,failed:0,pauseReason:reason},result:{waitReason,waitDetail,note:reason}}]}:undefined})
  await screen.findByText(heading);const card=screen.getByRole('article',{name:'执行结果：消息识别'});expect(within(card).getAllByText(reason)).toHaveLength(1);expect(card.textContent).toContain('累计处理 0 条 · 剩余 15 条 · 失败 0 条');expect(card.textContent).toContain(waitReason==='conversation_backfill'?'下次补采检查：':'下次重试：');expect(card.textContent).not.toContain('识别完成')
 })
 it('列表一直未返回也先显示完整助手，当前内容独立加载且系统目录可切换',async()=>{
  const {calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='list'?new Promise(()=>{}):request.action==='detail'?{...value,messages:[{role:'assistant',text:'独立显示的当前内容'}]}:undefined})
  expect(screen.getByRole('navigation',{name:'助手会话列表'})).toBeTruthy()
  expect(screen.getByRole('navigation',{name:'系统能力'})).toBeTruthy()
  await screen.findByText('独立显示的当前内容');await ready()
  expect(screen.queryByText('正在读取最近会话…')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'系统能力：AI资讯'}))
  await waitFor(()=>expect(calls.some(row=>row.action==='detail'&&row.conversationId==='system:radar')).toBe(true))
  expect(calls.every(row=>['list','detail'].includes(row.action))).toBe(true)
 })
 it('一个会话读取未结束仍能切到其他会话，旧会话迟到结果不覆盖当前内容',async()=>{
  let release
  const {calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?request.conversationId==='task:a'?new Promise(resolve=>{release=()=>resolve({...value,messages:[{role:'assistant',text:'旧会话迟到消息'}]})}):{...value,messages:[{role:'assistant',text:'其他会话正常显示'}]}:undefined})
  await screen.findByRole('button',{name:'会话：乙的工作'})
  fireEvent.click(screen.getByRole('button',{name:'会话：乙的工作'}))
  await screen.findByText('其他会话正常显示');await ready()
  await act(async()=>release())
  expect(screen.queryByText('旧会话迟到消息')).toBeNull()
  expect(calls.every(row=>['list','detail'].includes(row.action))).toBe(true)
 })
 it('目录读取失败仅在左侧重试，保留当前内容和草稿，不误切旧助手',async()=>{
  let failed=true
  setup({id:'task:a',hub:(request,{value})=>request.action==='list'&&failed?Promise.reject(Error('某条 session not found')):request.action==='detail'?{...value,messages:[{role:'assistant',text:'当前内容保留'}]}:undefined})
  await screen.findByText('当前内容保留');await ready()
  const draft=screen.getByRole('textbox',{name:'助手消息'});fireEvent.change(draft,{target:{value:'尚未发送的草稿'}})
  await screen.findByText('某条 session not found')
  expect(screen.getByRole('navigation',{name:'助手会话列表'}).contains(screen.getByText('某条 session not found'))).toBe(true)
  failed=false;fireEvent.click(screen.getByRole('button',{name:'重试列表'}))
  await screen.findByRole('button',{name:'会话：乙的工作'})
  expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('尚未发送的草稿')
  expect(screen.getByText('当前内容保留')).toBeTruthy()
 })
 it('内容请求悬空时目录仍定时更新，内容超时有局部重试且不重发任务',async()=>{
  vi.useFakeTimers();let latest=false
  const {calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?new Promise(()=>{}):request.action==='list'&&latest?{...value,conversations:[...value.conversations,{id:'chat:newest',kind:'chat',title:'另一个会话的新进度'}]}:undefined})
  await act(async()=>vi.advanceTimersByTimeAsync(0))
  expect(screen.getByRole('button',{name:'会话：乙的工作'})).toBeTruthy()
  latest=true;await act(async()=>vi.advanceTimersByTimeAsync(10000))
  expect(screen.getByRole('button',{name:'会话：另一个会话的新进度'})).toBeTruthy()
  expect(screen.getByRole('button',{name:'重试读取'})).toBeTruthy()
  expect(calls.filter(row=>row.action==='list')).toHaveLength(2)
  expect(calls.every(row=>['list','detail'].includes(row.action))).toBe(true)
 })
 it('局部刷新失败保留已有消息、输入和查阅位置',async()=>{
  let fail=false
  setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?fail?Promise.reject(Error('单个会话暂不可读')):{...value,messages:[{role:'assistant',text:'已读到的内容不会清空'}]}:undefined})
  await screen.findByText('已读到的内容不会清空');await ready()
  fireEvent.change(screen.getByRole('textbox',{name:'助手消息'}),{target:{value:'草稿保持'}})
  const body=document.querySelector('.wb-hub-body');Object.defineProperties(body,{scrollHeight:{configurable:true,value:2000},clientHeight:{configurable:true,value:400}});body.scrollTop=150;fireEvent.scroll(body)
  fail=true;fireEvent.click(screen.getByRole('button',{name:'刷新进度'}));await screen.findByText('单个会话暂不可读')
  expect(screen.getByText('已读到的内容不会清空')).toBeTruthy()
  expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('草稿保持')
  expect(body.scrollTop).toBe(150)
 })
 it('重新进入已读事项时先保留历史，超时后可只重试读取',async()=>{
  let slow=false
  const {WB,calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?slow?Promise.reject(Error('当前会话读取较慢')):{...value,messages:[{role:'assistant',text:'已经读到的事项回复'}]}:undefined})
  await screen.findByText('已经读到的事项回复')
  slow=true
  await act(async()=>WB.store.set({page:'dashboard',assistantOpen:false}))
  await act(async()=>WB.assistant.openHub('task','a'))
  await screen.findByText('当前会话读取较慢')
  expect(screen.getByText('已经读到的事项回复')).toBeTruthy()
  expect(screen.queryByText('从这里继续处理这件事')).toBeNull()
  fireEvent.change(screen.getByRole('textbox',{name:'助手消息'}),{target:{value:'保留草稿'}})
  expect(screen.getByRole('button',{name:'发送',exact:true}).disabled).toBe(true)
  slow=false
  fireEvent.click(screen.getByRole('button',{name:'重试读取'}))
  await waitFor(()=>expect(screen.queryByText('当前会话读取较慢')).toBeNull())
  expect(screen.getByRole('button',{name:'发送',exact:true}).disabled).toBe(false)
  expect(calls.every(request=>['list','detail'].includes(request.action))).toBe(true)
 })
 it('原历史暂未恢复的局部响应也保留已显示的消息和进度',async()=>{
  let pending=false
  setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,sessionId:'original',messages:pending?[]:[{role:'assistant',text:'已完成步骤的原历史'}],historyError:pending?'原历史仍在恢复':undefined,nativeBinding:{sessionId:'original',canSend:!pending},runs:[{id:'completed-step',kind:'analysis',status:'completed'}]}:undefined})
  await screen.findByText('已完成步骤的原历史');await ready()
  pending=true;fireEvent.click(screen.getByRole('button',{name:'刷新进度'}))
  await screen.findByText('历史记录暂不可读：原历史仍在恢复')
  expect(screen.getByText('已完成步骤的原历史')).toBeTruthy()
  expect(screen.getByLabelText('执行结果：消息识别')).toBeTruthy()
 })
 it('普通聊天按需模式尚未查询知识时不展示未命中或知识卡片',async()=>{
  const turn={id:'deferred-answer',text:'当前目录有多少技能',source:'ai',status:'completed',reply:'当前目录有 36 个技能。',commands:[]},retrieval={id:'not-searched',turnId:turn.id,mode:'auto',status:'deferred',strategy:'agent-on-demand',scope:{},hits:[]}
  const {calls}=setup({id:'chat:on-demand',hub:(request,{value})=>request.action==='detail'?{...value,turns:[turn],messages:[],retrievals:[retrieval]}:undefined});await screen.findByText(turn.reply);expect(screen.queryByRole('region',{name:'知识检索依据'})).toBeNull();expect(screen.queryByText('本轮未命中知识库资料')).toBeNull();expect(screen.queryByLabelText('工具执行记录')).toBeNull();expect(calls.every(row=>['list','detail'].includes(row.action))).toBe(true)
 })
 it('普通聊天实际调用知识工具后通过增量显示本轮依据，未检索占位不覆盖结果',async()=>{
  let phase=0,release;const turn={id:'on-demand-turn',requestId:'tracked-demand',sessionId:'native-demand',fromSeq:0,text:'根据发布规范说明验收要求',source:'ai',status:'executing',commands:[]},deferred={id:'demand-retrieval',turnId:turn.id,sessionId:turn.sessionId,fromSeq:0,status:'deferred',mode:'auto',scope:{},hits:[]},found={...deferred,status:'ok',hits:[{id:'demand-chunk',documentId:'doc',title:'发布验收规范',lineStart:1,lineEnd:2}]},completed={...turn,status:'completed',reply:'发布前需要灰度验收 [知识:demand-chunk]'}
  setup({id:'chat:demand',hub:(request,{value})=>{
   if(request.action==='detail')return {...value,messages:[],turns:phase?[phase===2?completed:turn]:[],retrievals:phase?[phase===2?found:deferred]:[]}
   if(request.action==='send'){phase=1;return {status:'ok',turn:{...turn,requestId:request.requestId},turnId:turn.id,sessionId:turn.sessionId,fromSeq:0,retrieval:deferred}}
   if(request.action==='delta')return new Promise(resolve=>{release=()=>{phase=2;resolve({status:'ok',entries:[],nextSeq:4,turnEnded:true,turns:[completed],retrievals:[found],citationAudit:{cited:['demand-chunk'],invalid:[],stale:[],missing:false}})}})
  }});await ready();const user=userEvent.setup();await user.type(screen.getByRole('textbox',{name:'助手消息'}),turn.text);await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(release).toBeTypeOf('function'));expect(screen.queryByRole('region',{name:'知识检索依据'})).toBeNull();await act(async()=>release());await screen.findByText(/发布前需要灰度验收/);const card=screen.getByRole('article',{name:'处理回复'});expect(within(card).getByRole('region',{name:'知识检索依据'})).toBeTruthy();await user.click(within(card).getByText('知识依据 · 1 个片段 · 已提供给模型'));expect(within(card).getByRole('button',{name:'发布验收规范 · 行1–2'})).toBeTruthy();expect(screen.queryByText('本轮未命中知识库资料')).toBeNull()
 })
 it('知识提示分别放在对应 AI 回复卡片内，不串到规则或系统结果',async()=>{
  const at=new Date().toISOString(),trace=(id,fromSeq,status='empty')=>({id,sessionId:'native-a',fromSeq,status,hits:status==='ok'?[{id:'chunk-one',title:'部署说明',lineStart:1,lineEnd:2}]:[],note:'当前范围没有匹配的已确认有效知识'}),empty=trace('empty',0),hit=trace('hit',5,'ok'),orphan=trace('orphan',99)
  setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,sessionId:'native-a',retrieval:orphan,retrievals:[empty,hit,orphan,{...trace('other-session',10),sessionId:'native-b'}],turns:[{id:'turn-empty',text:'普通问题',reply:'第一轮回答',at,source:'ai',status:'completed',sessionId:'native-a',fromSeq:0},{id:'turn-hit',text:'部署问题',reply:'第二轮回答',at,source:'ai',status:'completed',sessionId:'native-a',fromSeq:5},{id:'turn-rule',text:'刷新进度',reply:'规则处理结果',at,source:'rule',status:'completed',sessionId:'native-a',fromSeq:99},{id:'turn-other',text:'其他问题',reply:'没有本轮检索记录',at,source:'ai',status:'completed',sessionId:'native-a',fromSeq:10}]}:undefined})
  await screen.findByText('第一轮回答');await ready()
  const emptyCard=screen.getByText('第一轮回答').closest('article'),hitCard=screen.getByText('第二轮回答').closest('article')
  expect(within(emptyCard).getByText('本轮未命中知识库资料')).toBeTruthy()
  expect(within(hitCard).getByRole('region',{name:'知识检索依据'})).toBeTruthy()
  expect(screen.getAllByText('本轮未命中知识库资料')).toHaveLength(1)
  expect(within(screen.getByText('规则处理结果').closest('article')).queryByText('本轮未命中知识库资料')).toBeNull()
  expect(within(screen.getByText('没有本轮检索记录').closest('article')).queryByText('本轮未命中知识库资料')).toBeNull()
 })
 it('未能定位轮次的旧知识检索记录不悬浮显示，也不附到后台识别结果',async()=>{
  setup({hub:(request,{value})=>request.action==='detail'?{...value,retrieval:{id:'old-empty',status:'empty',hits:[],sessionId:'old-native',fromSeq:0},background:{messages:[{id:'background-answer',role:'assistant',displayText:'后台识别完成',text:'后台识别完成',at:new Date().toISOString()}]}}:undefined})
  await screen.findByText('后台识别完成');await ready()
  expect(screen.queryByText('本轮未命中知识库资料')).toBeNull()
 })
 it('消息识别的更早记录入口位于提取卡片和所有聊天记录上方，读取期间防重复加载',async()=>{
  let release;const at=new Date().toISOString(),cursor={at,sessionId:'background',seq:20}
  const {calls}=setup({hub:(request,{value})=>request.action==='detail'?request.backgroundBefore?new Promise(resolve=>{release=()=>resolve({...value,background:{messages:[{id:'earlier',role:'assistant',text:'更早的后台消息',at}],hasMore:false,before:null}})}):{...value,background:{messages:[{id:'latest',role:'assistant',text:'最新的后台消息',at}],hasMore:true,before:cursor},extraction:{items:[],total:0,counts:{}}}:undefined})
  await screen.findByText('最新的后台消息');const controls=screen.getByRole('group',{name:'加载历史消息'}),extraction=screen.getByRole('region',{name:'提取结果'}),message=screen.getByText('最新的后台消息')
  expect(controls.compareDocumentPosition(extraction)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(controls.compareDocumentPosition(message)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(within(controls).getByRole('button',{name:'加载更早的系统记录'}));await waitFor(()=>expect(release).toBeTypeOf('function'));const loading=within(controls).getByRole('button',{name:'正在读取系统记录…'});expect(loading.disabled).toBe(true);fireEvent.click(loading);expect(calls.filter(request=>request.backgroundBefore)).toHaveLength(1);await act(async()=>release());await screen.findByText('更早的后台消息');expect(screen.queryByRole('group',{name:'加载历史消息'})).toBeNull()
 })
 it('再次点击当前系统会话回到最新位置，打开记录不执行业务',async()=>{
  const at=new Date().toISOString(),{calls}=setup({hub:(request,{value})=>request.action==='detail'?{...value,messages:[{id:'latest',role:'assistant',text:'当前会话最新结果',at}]}:undefined})
  await screen.findByText('当前会话最新结果');const body=document.querySelector('.wb-hub-body');Object.defineProperties(body,{scrollHeight:{configurable:true,value:2000},clientHeight:{configurable:true,value:400}});body.scrollTop=150;fireEvent.scroll(body);fireEvent.click(screen.getByRole('button',{name:'系统能力：消息识别'}));expect(body.scrollTop).toBe(2000);expect(calls.every(request=>['list','detail'].includes(request.action))).toBe(true)
 })
 it('固定系统会话展示实际进度，原始记录通过更多菜单打开且不启动业务',async()=>{
  const {calls}=setup({hub:(request,{value})=>request.action==='detail'?{...value,runs:[{id:'run-one',kind:'analysis',status:'running',progress:{processed:50,remaining:30,failed:1}}]}:undefined}),user=userEvent.setup()
  await screen.findByLabelText('执行结果：消息识别');expect(screen.getByText('累计处理 50 条 · 剩余 30 条 · 失败 1 条')).toBeTruthy();expect(screen.getByRole('navigation',{name:'系统能力'})).toBeTruthy()
  await user.click(screen.getByRole('button',{name:'刷新进度'}));expect(screen.queryByRole('button',{name:'查看本轮记录'})).toBeNull();await user.click(screen.getByLabelText('更多助手操作'));await user.click(screen.getByRole('button',{name:'后台历史',exact:true}));await screen.findByText('本轮真实模型结果');expect(screen.getByRole('dialog',{name:'后台历史'})).toBeTruthy()
  expect(calls.every(c=>['list','detail','history'].includes(c.action))).toBe(true)
  expect(screen.getByRole('navigation',{name:'工作台导航'}).querySelector('[data-page="tasks"]')).toBeTruthy()
 })
 it('自动识别回执使用单层消息气泡，保留实际反馈和关联事项而不显示日志按钮',async()=>{
  const at=new Date().toISOString(),job={id:'receipt-job',kind:'analysis',status:'completed',createdAt:at,result:{processed:2,failures:0},items:[{id:'a',kind:'task',title:'关联的实际待办',conversationId:'task:a'}]}
  const {calls}=setup({hub:(request,{value})=>request.action==='detail'&&request.conversationId==='system:analysis'?{...value,runs:[job],background:{messages:[{id:'input',role:'user',sessionId:'backend',seq:1,at,text:'实际提交的两条消息'},{id:'answer',role:'assistant',sessionId:'backend',seq:2,at,text:'实际逐条反馈，只有一条需要跟进。'}]}}:undefined}),user=userEvent.setup()
  const receipt=await screen.findByLabelText('执行结果：消息识别');expect(receipt.classList.contains('wb-assistant-message')).toBe(true);expect(receipt.closest('.wb-hub-event')).toBeNull();expect(within(receipt).getByText('识别完成')).toBeTruthy();expect(within(receipt).getByText('已处理 2 条消息 · 失败 0 条')).toBeTruthy();expect(screen.queryByRole('button',{name:'查看本轮记录'})).toBeNull();expect(screen.getByText('实际逐条反馈，只有一条需要跟进。')).toBeTruthy()
  await user.click(within(receipt).getByRole('button',{name:'关联的实际待办'}));await waitFor(()=>expect(calls.some(request=>request.action==='detail'&&request.conversationId==='task:a')).toBe(true));expect(calls.every(request=>['list','detail'].includes(request.action))).toBe(true)
 })
 it('关闭后台历史时忽略迟到回包，不重开弹窗且保留会话草稿',async()=>{
  let release
  const {calls}=setup({hub:request=>request.action==='history'?new Promise(resolve=>{release=()=>resolve({status:'ok',messages:[{role:'assistant',text:'关闭后迟到的后台记录'}]})}):undefined}),user=userEvent.setup();await ready();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'未发送的草稿');await user.click(screen.getByLabelText('更多助手操作'));await user.click(screen.getByRole('button',{name:'后台历史',exact:true}));const dialog=screen.getByRole('dialog',{name:'后台历史'});expect(within(dialog).getByRole('status').textContent).toContain('正在读取处理记录');await user.click(within(dialog).getByRole('button',{name:'关闭',exact:true}));await act(async()=>release());expect(screen.queryByRole('dialog')).toBeNull();expect(screen.queryByText('关闭后迟到的后台记录')).toBeNull();expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('未发送的草稿');expect(calls.every(request=>['list','detail','history'].includes(request.action))).toBe(true)
 })
 it('后台历史读取失败在弹窗中显示原因，重试只读取不重新执行任务',async()=>{
  let fail=true
  const {calls}=setup({hub:request=>{if(request.action==='history'){if(fail)throw Error('历史存储暂不可读');return {status:'ok',messages:[{role:'assistant',text:'原来的真实处理记录'}]}}}}),user=userEvent.setup();await ready();await user.click(screen.getByLabelText('更多助手操作'));await user.click(screen.getByRole('button',{name:'后台历史',exact:true}));const dialog=await screen.findByRole('dialog',{name:'后台历史'});await within(dialog).findByText('历史存储暂不可读');fail=false;await user.click(within(dialog).getByRole('button',{name:'重试读取'}));await within(dialog).findByText('原来的真实处理记录');expect(calls.filter(request=>request.action==='history')).toHaveLength(2);expect(calls.every(request=>['list','detail','history'].includes(request.action))).toBe(true)
 })
 it('切换事项只读取当前内容，不重复请求整个目录，原会话草稿仍可恢复',async()=>{
  const {calls}=setup({id:'task:a'}),user=userEvent.setup();await ready();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'留在甲的草稿');const before=calls.filter(request=>request.action==='list').length
  await user.click(screen.getByRole('button',{name:'会话：乙的工作'}));await ready();await user.click(screen.getByRole('button',{name:'会话：甲的工作'}));await ready();expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('留在甲的草稿');expect(calls.filter(request=>request.action==='list')).toHaveLength(before);expect(calls.every(request=>['list','detail'].includes(request.action))).toBe(true)
 })
 it('已显示的目录超时后自动恢复，保留会话、输入和已读内容且不要求手动重试',async()=>{
  vi.useFakeTimers();let lists=0
  const {calls}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='list'){lists++;if(lists===2)return new Promise(()=>{});if(lists===3)return {...value,conversations:[...value.conversations,{id:'chat:late-index',kind:'chat',title:'自动刷新恢复的会话'}]}}
   if(request.action==='detail')return {...value,messages:[{role:'assistant',text:'已经显示的会话正文'}]}
  }})
  await act(async()=>vi.advanceTimersByTimeAsync(0));fireEvent.change(screen.getByRole('textbox',{name:'助手消息'}),{target:{value:'目录慢时仍保留的草稿'}});await act(async()=>vi.advanceTimersByTimeAsync(10000));expect(lists).toBe(2);await act(async()=>vi.advanceTimersByTimeAsync(10000));expect(screen.getByText('列表正在后台更新，已显示的会话仍可使用。')).toBeTruthy();expect(screen.getByRole('button',{name:'会话：乙的工作'})).toBeTruthy();expect(screen.queryByRole('button',{name:'重试列表'})).toBeNull();expect(screen.getByText('已经显示的会话正文')).toBeTruthy();await act(async()=>vi.advanceTimersByTimeAsync(2000));expect(screen.getByRole('button',{name:'会话：自动刷新恢复的会话'})).toBeTruthy();expect(screen.queryByText('列表正在后台更新，已显示的会话仍可使用。')).toBeNull();expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('目录慢时仍保留的草稿');expect(lists).toBe(3);expect(calls.every(request=>['list','detail'].includes(request.action))).toBe(true)
 })
 it('未创建原生会话也可以发指令，重开时读取持久结果',async()=>{
  const {WB,calls}=setup({id:'task:a'}),user=userEvent.setup();await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).disabled).toBe(false))
  await user.type(screen.getByRole('textbox',{name:'助手消息'}),'继续处理');await user.click(screen.getByRole('button',{name:'发送'}));await screen.findByText('继续处理已登记',{selector:'.wb-hub-markdown div'})
  expect(calls.find(c=>c.action==='send')).toMatchObject({conversationId:'task:a',text:'继续处理'})
  await leaveAssistant(user);await act(async()=>WB.assistant.openHub('task','a'));await screen.findByText('继续处理已登记',{selector:'.wb-hub-markdown div'});expect(calls.filter(c=>c.action==='send')).toHaveLength(1)
 })
 it('对话中标记完成写回同一待办，返回任务中心定位原事项',async()=>{
  const {WB,fixture}=setup({id:'task:a'}),user=userEvent.setup();await openMore(user);await waitFor(()=>expect(screen.getByRole('button',{name:'标记完成'}).disabled).toBe(false));await user.click(screen.getByRole('button',{name:'标记完成'}));await screen.findByText('已将甲的工作标记为已完成');expect(fixture.tasks[0].status).toBe('completed')
  await openMore(user);await user.click(screen.getByRole('button',{name:'查看待办'}));expect(WB.store.get()).toMatchObject({page:'tasks',assistantOpen:false});expect(screen.getAllByText('甲的工作').length).toBeGreaterThan(0)
 })
 it('删除知识先显示目标和内容，确认只执行一次并移除已消费确认卡',async()=>{
  const {calls}=setup({id:'knowledge:k'}),user=userEvent.setup();await waitFor(()=>expect(screen.getByRole('button',{name:'删除这条知识'}).disabled).toBe(false));await user.click(screen.getByRole('button',{name:'删除这条知识'}));await screen.findByLabelText('待确认操作');expect(screen.getByText('删除部署知识')).toBeTruthy();expect(calls.filter(c=>c.operation==='confirm')).toHaveLength(0)
  await user.dblClick(screen.getByRole('button',{name:'确认执行'}));await screen.findByText('知识已删除');expect(calls.filter(c=>c.operation==='confirm')).toHaveLength(1);expect(screen.queryByRole('button',{name:'确认执行'})).toBeNull()
 })
 it('切换事项丢弃迟到回答，下一条指令保持当前归属',async()=>{
  let release;const {calls}=setup({id:'task:a',hub:(request)=>request.action==='send'&&request.conversationId==='task:a'?{status:'ok',sessionId:'a-native',fromSeq:0}:request.action==='delta'?new Promise(resolve=>{release=resolve}):undefined}),user=userEvent.setup()
  await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).disabled).toBe(false));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'处理甲');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(release).toBeTypeOf('function'));await user.click(screen.getByRole('button',{name:'会话：乙的工作'}));await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).disabled).toBe(false))
  await act(async()=>release({status:'ok',entries:[{role:'assistant',text:'甲的过期回答'}],turnEnded:true,nextSeq:1}));expect(screen.queryByText('甲的过期回答')).toBeNull();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'处理乙');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(calls.filter(c=>c.action==='send')).toHaveLength(2));expect(calls.filter(c=>c.action==='send').map(c=>c.conversationId)).toEqual(['task:a','task:b'])
 })
 it('搜索可找到未聊过的事项，固定系统入口始终可见',async()=>{
  const {calls}=setup({hub:(request,{value})=>request.action==='list'&&request.query==='未聊过'?{status:'ok',conversations:[...fixed,{id:'reply:new',kind:'reply',entityId:'new',title:'未聊过的客户问题'}]}:undefined}),user=userEvent.setup();await screen.findByRole('textbox',{name:'搜索会话或事项'});await user.type(screen.getByRole('textbox',{name:'搜索会话或事项'}),'未聊过');await screen.findByRole('button',{name:'会话：未聊过的客户问题'});expect(screen.getByRole('button',{name:'系统能力：消息识别'})).toBeTruthy();expect(calls.some(c=>c.action==='list'&&c.query==='未聊过')).toBe(true)
 })
 it('原历史无法读取时明确提示，恢复历史选择后自动刷新保持该会话',async()=>{
  const {calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,sessionId:request.sessionId||'active',threads:[{id:'active',title:'当前会话'},{id:'old',title:'以前的会话'}],historyError:request.sessionId==='old'?'模型配置暂不可用':undefined,messages:request.sessionId==='old'?[]:[{role:'assistant',text:'当前历史'}]}:undefined}),user=userEvent.setup();await screen.findByText('当前历史');await openMore(user);await openMore(user);await user.selectOptions(screen.getByRole('combobox',{name:'事项历史会话'}),'old');await screen.findByText('历史记录暂不可读：模型配置暂不可用');await new Promise(r=>setTimeout(r,2700));expect(calls.filter(c=>c.action==='detail').at(-1).sessionId).toBe('old');expect(calls.filter(c=>c.action==='select')).toEqual([expect.objectContaining({conversationId:'task:a',sessionId:'old'})])
 },6000)
 it('知识范围改变后查询、详情和操作均携带同一项目范围',async()=>{
  const {WB,calls}=setup({id:'system:knowledge'}),user=userEvent.setup();await screen.findByRole('textbox',{name:'助手消息'});await act(async()=>WB.store.set({assistantHubThreadId:'old-scope',data:{...WB.store.get().data,projects:[{id:'project-a',name:'项目甲'}]}}))
  await openMore(user);await user.click(screen.getByRole('button',{name:'知识设置'}));await user.selectOptions(screen.getByRole('combobox',{name:'聊天知识项目'}),'project-a');await user.click(screen.getByRole('button',{name:'完成',exact:true}));await waitFor(()=>expect(calls.some(c=>c.action==='detail'&&c.knowledgeScope?.projectId==='project-a')).toBe(true))
  await user.type(screen.getByRole('textbox',{name:'助手消息'}),'查找知识：部署');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(calls.find(c=>c.action==='send')?.knowledgeScope).toEqual({projectId:'project-a',spaceId:'personal'}));expect(calls.find(c=>c.action==='send')?.projectId).toBe('project-a');expect(WB.store.get().assistantHubThreadId).toBeNull();expect(calls.filter(c=>c.action==='detail'&&c.knowledgeScope?.projectId==='project-a').every(c=>!c.sessionId)).toBe(true)
 })

 it('原生毫秒时间和业务ISO时间在同一时间线按真实顺序排列',async()=>{
  setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,messages:[{role:'user',text:'先发送的消息',at:'2026-11-01T09:59:00Z'},{role:'assistant',text:'后返回的回答',at:Date.parse('2026-11-01T10:02:00Z')}],events:[{id:'middle',text:'中间状态变更',at:'2026-11-01T10:00:00Z'}]}:undefined})
  await screen.findByText('后返回的回答');const text=document.querySelector('.wb-hub-body').textContent;expect(text.indexOf('先发送的消息')).toBeLessThan(text.indexOf('中间状态变更'));expect(text.indexOf('中间状态变更')).toBeLessThan(text.indexOf('后返回的回答'))
 })

 it.each([['system:analysis','识别已有消息'],['system:radar','整理已有资讯']])('打开%s就直接在固定对话看到后台提交、结果与失败',async(id,title)=>{
  const raw='{"request":"真实后台原始输入"}',{calls}=setup({id,hub:(request,{value})=>request.action==='detail'?{...value,background:{messages:[{id:'background:native:1',sessionId:'native',seq:1,at:1000,role:'user',origin:'background',text:raw,displayText:title},{id:'background:native:2',sessionId:'native',seq:2,at:2000,role:'assistant',origin:'background',text:'实际已识别结果'},{id:'background:native:3',sessionId:'native',seq:3,at:3000,role:'error',origin:'background',text:'该条原文读取失败'}],hasMore:false,before:null,turnActive:true,errors:[{sessionId:'old',note:'原历史文件暂不可读'}]}}:undefined}),user=userEvent.setup()
  await screen.findByText(title);expect(screen.getByLabelText('系统提交').querySelector('small').textContent.startsWith('系统提交')).toBe(true);expect(screen.getByLabelText('系统结果').textContent).toContain('实际已识别结果');expect(screen.getByLabelText('系统失败').textContent).toContain('该条原文读取失败');expect(screen.getByText('系统任务正在处理，结果会自动更新')).toBeTruthy();expect(screen.getByText('系统记录暂不可读：原历史文件暂不可读')).toBeTruthy()
  const original=screen.getByText(raw),fold=original.closest('details');expect(fold.open).toBe(false);await user.click(screen.getByText('查看原始内容'));expect(fold.open).toBe(true);expect(calls.every(call=>['list','detail'].includes(call.action))).toBe(true);expect(document.querySelector('[aria-label="本轮真实记录"]')).toBeNull()
 })
 it('自动轮询把新系统结果加入当前聊天，按原生session和序号去重',async()=>{
  let updated=false;setup({hub:(request,{value})=>request.action==='detail'?{...value,messages:[{role:'user',text:'我的追问',at:3000}],events:[{id:'event',text:'业务状态变更',at:2000}],background:{messages:[{id:'background:native:1',sessionId:'native',seq:1,role:'user',at:1000,text:'系统第一批提交'},...(updated?[{id:'background:native:2',sessionId:'native',seq:2,role:'assistant',at:4000,text:'自动到达的新结果'}]:[])],hasMore:false,before:null,turnActive:!updated,errors:[]}}:undefined})
  await screen.findByText('系统第一批提交');updated=true;await screen.findByText('自动到达的新结果',{}, {timeout:4000});expect(screen.getAllByText('系统第一批提交')).toHaveLength(1);expect(screen.queryByText('系统任务正在处理，结果会自动更新')).toBeNull();const text=document.querySelector('.wb-hub-body').textContent;expect(text.indexOf('系统第一批提交')).toBeLessThan(text.indexOf('业务状态变更'));expect(text.indexOf('业务状态变更')).toBeLessThan(text.indexOf('我的追问'));expect(text.indexOf('我的追问')).toBeLessThan(text.indexOf('自动到达的新结果'))
 },6000)
 it('后台分页独立携带游标，历史与新实时记录并存且不重复',async()=>{
  const cursor={at:3000,sessionId:'native',seq:3};let refreshed=false
  const {calls}=setup({hub:(request,{value})=>request.action==='detail'?{...value,background:request.backgroundBefore?{messages:[{id:'background:native:1',sessionId:'native',seq:1,role:'user',at:1000,text:'较早的系统提交'},{id:'background:native:3',sessionId:'native',seq:3,role:'assistant',at:3000,text:'已有的系统结果'}],hasMore:false,before:{at:1000,sessionId:'native',seq:1},errors:[]}:{messages:[{id:'background:native:3',sessionId:'native',seq:3,role:'assistant',at:3000,text:'已有的系统结果'},...(refreshed?[{id:'background:native:4',sessionId:'native',seq:4,role:'assistant',at:4000,text:'最新实时结果'}]:[])],hasMore:true,before:cursor,turnActive:false,errors:[]}}:undefined}),user=userEvent.setup()
  await screen.findByText('已有的系统结果');await user.click(screen.getByRole('button',{name:'加载更早的系统记录'}));await screen.findByText('较早的系统提交');expect(calls.find(c=>c.backgroundBefore)?.backgroundBefore).toEqual(cursor);expect(calls.find(c=>c.backgroundBefore)?.before).toBeUndefined();refreshed=true;await user.click(screen.getByRole('button',{name:'刷新进度'}));await screen.findByText('最新实时结果');expect(screen.getAllByText('已有的系统结果')).toHaveLength(1);expect(screen.getByText('较早的系统提交')).toBeTruthy();expect(screen.queryByRole('button',{name:'加载更早的系统记录'})).toBeNull()
 })
 it('切换固定会话清空旧系统分页并丢弃迟到的后台记录',async()=>{
  let release;const cursor={at:2000,sessionId:'analysis-native',seq:2};const {WB}=setup({hub:(request,{value})=>{
   if(request.action!=='detail')return
   if(request.backgroundBefore)return new Promise(resolve=>{release=()=>resolve({...value,background:{messages:[{id:'background:analysis-native:1',sessionId:'analysis-native',seq:1,role:'assistant',text:'迟到的识别历史',at:1000}],hasMore:false,before:null}})})
   return {...value,background:request.conversationId==='system:analysis'?{messages:[{id:'background:analysis-native:2',sessionId:'analysis-native',seq:2,role:'assistant',text:'识别会话已有结果',at:2000}],hasMore:true,before:cursor}:{messages:[{id:'background:radar-native:1',sessionId:'radar-native',seq:1,role:'assistant',text:'资讯会话自己的结果',at:2000}],hasMore:false,before:null}}
  }}),user=userEvent.setup()
  await screen.findByText('识别会话已有结果');await user.click(screen.getByRole('button',{name:'加载更早的系统记录'}));await waitFor(()=>expect(release).toBeTypeOf('function'));await user.click(screen.getByRole('button',{name:'系统能力：AI资讯'}));await screen.findByText('资讯会话自己的结果');await act(async()=>release());expect(screen.queryByText('迟到的识别历史')).toBeNull();expect(screen.queryByText('识别会话已有结果')).toBeNull();expect(screen.queryByRole('button',{name:'加载更早的系统记录'})).toBeNull();await act(async()=>WB.assistant.openHub('system:analysis'));await screen.findByText('识别会话已有结果');expect(screen.getByRole('button',{name:'加载更早的系统记录'}).disabled).toBe(false)
 })

 it('后台尚无模型消息时显示处理中，同一序号的新文本替换旧文本',async()=>{
  let phase=0;const user=userEvent.setup();setup({hub:(request,{value})=>request.action==='detail'?{...value,background:{messages:phase?[{id:'background:native:1',sessionId:'native',seq:1,role:'assistant',at:1000,text:phase===1?'尚未最终确认的结果':'已确认的最终结果'}]:[],hasMore:false,before:null,turnActive:phase<2,errors:[]}}:undefined})
  await screen.findByText('系统任务正在处理，结果会自动更新');expect(screen.queryByLabelText('系统结果')).toBeNull();phase=1;await user.click(screen.getByRole('button',{name:'刷新进度'}));await screen.findByText('尚未最终确认的结果');phase=2;await user.click(screen.getByRole('button',{name:'刷新进度'}));await screen.findByText('已确认的最终结果');expect(screen.queryByText('尚未最终确认的结果')).toBeNull();expect(screen.getAllByLabelText('系统结果')).toHaveLength(1);expect(screen.queryByText('系统任务正在处理，结果会自动更新')).toBeNull()
 })

 it('后台中间输出不展示思考或识别卡，只有完成后的最终正文显示结果',async()=>{
  let finished=false;setup({hub:(request,{value})=>request.action==='detail'?{...value,background:{messages:[{id:'background:draft:1',sessionId:'draft',seq:1,role:'assistant',at:1000,text:'中间草稿不应该识别',finalOutput:false,recognition:{items:[{sourceId:'draft-only',summary:'不应展示的识别建议',instructions:['需待办：中间任务'],status:'recognized'}]}},...(finished?[{id:'background:draft:2',sessionId:'draft',seq:2,role:'assistant',at:2000,text:'最终识别输出',finalOutput:true,recognition:{purpose:'analysis',items:[{sourceId:'final-only',summary:'最终确认无需处理',instructions:['无需处理'],status:'recognized'}]}}]:[])],turnActive:!finished,hasMore:false,errors:[]}}:undefined})
  await screen.findByText('系统任务正在处理，结果会自动更新');expect(screen.queryByText('中间草稿不应该识别')).toBeNull();expect(screen.queryByText(/逐条识别结果/)).toBeNull();finished=true;await userEvent.setup().click(screen.getByRole('button',{name:'刷新进度'}));await screen.findByText('最终识别输出');expect(screen.queryByText('中间草稿不应该识别')).toBeNull();const summary=screen.getByText('逐条识别结果 · 1 条');await userEvent.setup().click(summary);expect(screen.getByText('最终确认无需处理')).toBeTruthy();expect(screen.queryByText('需待办：中间任务')).toBeNull()
 })

 it('系统原文截取时清楚标明节选，纯文本和摘要折叠均提供完整历史入口说明',async()=>{
  setup({hub:(request,{value})=>request.action==='detail'?{...value,background:{messages:[{id:'background:native:1',sessionId:'native',seq:1,role:'user',at:1000,text:'结构化原文节选',displayText:'系统提交的简明说明',rawTruncated:true},{id:'background:native:2',sessionId:'native',seq:2,role:'assistant',at:2000,text:'没有摘要的原文节选',rawTruncated:true}],hasMore:false,before:null,turnActive:false,errors:[]}}:undefined})
  await screen.findByText('系统提交的简明说明');const notices=screen.getAllByText('原始内容（节选，完整内容见后台历史）');expect(notices).toHaveLength(2);expect(notices.some(node=>node.tagName==='SUMMARY'&&!node.closest('details').open)).toBe(true);expect(notices.some(node=>node.tagName==='P')).toBe(true);expect(screen.getByText('后台历史')).toBeTruthy()
 })

 it('消息识别主会话默认展开真实提取结果，待确认入口不创建对话',async()=>{
  const extraction={items:[{kind:'task',id:'a',title:'真正需要提交的材料',body:'整理并提交完整说明',status:'ready',dueAt:'2026-11-03T09:00:00Z',sourceId:'source-a',sourceText:'群消息要求下周提交材料',sourceAt:'2026-11-01T09:00:00Z',conversationId:'task:a'},{kind:'reply',id:'reply-a',title:'回复客户的问题',body:'回复客户的问题',status:'待回复',sourceText:'客户询问修复进度',conversationId:'reply:reply-a'}],total:2,counts:{tasks:1,replies:1,pendingReview:3},offset:0,hasMore:false}
  const {WB,calls}=setup({hub:(request,{value})=>request.action==='detail'?{...value,extraction}:undefined}),user=userEvent.setup()
  const region=await screen.findByRole('region',{name:'提取结果'});await within(region).findByText('真正需要提交的材料');expect(region.tagName).toBe('SECTION');expect(within(region).getByText('整理并提交完整说明')).toBeTruthy();expect(within(region).getByText(/截止/)).toBeTruthy();expect(within(region).getByText(/来源：群消息要求/).closest('details').open).toBe(false);expect(within(region).getAllByText('回复客户的问题')).toHaveLength(1);expect(within(region).getByRole('article',{name:'待回复：回复客户的问题'}).querySelectorAll('.wb-hub-extraction-meta span')).toHaveLength(1);expect(calls.filter(c=>['send','operate','reset'].includes(c.action))).toHaveLength(0)
  await user.click(screen.getByRole('button',{name:'查看提取结果'}));expect(calls.filter(c=>c.action==='send')).toHaveLength(0);await user.click(within(region).getByRole('button',{name:'待确认 3 项'}));expect(WB.store.get()).toMatchObject({page:'dashboard',assistantOpen:false});expect(calls.filter(c=>c.action==='reset')).toHaveLength(0)
 })
 it('在固定会话选择提取项保留草稿并只携带这一项，可清除后重新选择发送',async()=>{
  const item={kind:'task',id:'a',title:'真实提取待办',body:'原有事项内容',status:'ready',conversationId:'task:a'},extraction={items:[item],total:1,counts:{tasks:1,replies:0,pendingReview:0},offset:0,hasMore:false}
  const {WB,calls}=setup({hub:(request,{value})=>request.action==='detail'?{...value,extraction}:undefined}),user=userEvent.setup();await screen.findByText('真实提取待办');await user.type(screen.getByRole('textbox',{name:'助手消息'}),'先核实原始消息。');await act(async()=>WB.store.set({assistantRefs:[{kind:'knowledge',id:'old',title:'上次知识'}]}));await user.click(screen.getByRole('button',{name:'在对话中修改'}));expect(WB.store.get().assistantConversationId).toBe('system:analysis');expect(WB.store.get().assistantRefs).toEqual([{kind:'task',id:'a',title:'真实提取待办'}]);expect(screen.getByRole('textbox',{name:'助手消息'}).value).toContain('先核实原始消息。');expect(screen.getByRole('textbox',{name:'助手消息'}).value).toContain('请修改所选待办「真实提取待办」：')
  await user.click(screen.getByRole('button',{name:'移除上下文：真实提取待办'}));expect(WB.store.get().assistantRefs).toEqual([]);await user.click(screen.getByRole('button',{name:'在对话中修改'}));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'标记完成');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(calls.some(c=>c.action==='send')).toBe(true));expect(calls.find(c=>c.action==='send')).toMatchObject({conversationId:'system:analysis',refs:[{kind:'task',id:'a',title:'真实提取待办'}]});expect(calls.filter(c=>c.action==='reset')).toHaveLength(0)
 })
 it('提取结果按类型搜索与分页，自动刷新和重返固定会话保留筛选',async()=>{
  const source=Array.from({length:13},(_,i)=>({kind:i%2?'reply':'task',id:'extract-'+i,title:'实际结果 '+i,body:'事项内容 '+i,status:i%2?'待回复':'ready',conversationId:(i%2?'reply':'task')+':extract-'+i}))
  const {WB,calls}=setup({hub:(request,{value})=>{if(request.action!=='detail')return;const matched=source.filter(item=>(!request.extractionQuery||item.title.includes(request.extractionQuery))&&(!request.extractionKind||request.extractionKind==='all'||item.kind===request.extractionKind)),offset=request.extractionOffset||0;return {...value,extraction:{items:matched.slice(offset,offset+6),total:matched.length,counts:{tasks:7,replies:6,pendingReview:0},offset,hasMore:offset+6<matched.length}}}}),user=userEvent.setup()
  const region=await screen.findByRole('region',{name:'提取结果'});await within(region).findByText('实际结果 0');expect(within(region).getAllByRole('article')).toHaveLength(6);await user.click(within(region).getByRole('button',{name:'下一页'}));await within(region).findByText('实际结果 6');expect(within(region).queryByText('实际结果 0')).toBeNull();expect(calls.some(c=>c.extractionOffset===6&&c.extractionLimit===6)).toBe(true)
  await user.click(within(region).getByRole('button',{name:'待回复',exact:true}));await within(region).findByText('实际结果 1');expect(within(region).getAllByRole('article')).toHaveLength(6);await user.type(within(region).getByRole('textbox',{name:'搜索提取结果'}),'实际结果 11');await waitFor(()=>expect(within(region).getAllByRole('article')).toHaveLength(1));await user.click(screen.getByRole('button',{name:'刷新进度'}));expect(calls.filter(c=>c.action==='detail').at(-1)).toMatchObject({extractionKind:'reply',extractionQuery:'实际结果 11',extractionOffset:0})
  await act(async()=>WB.assistant.openHub('system:radar'));expect(screen.queryByRole('region',{name:'提取结果'})).toBeNull();await act(async()=>WB.assistant.openHub('system:analysis'));const reopened=await screen.findByRole('region',{name:'提取结果'});await within(reopened).findByText('实际结果 11');expect(within(reopened).getByRole('textbox',{name:'搜索提取结果'}).value).toBe('实际结果 11');expect(within(reopened).getByRole('button',{name:'待回复',exact:true}).getAttribute('aria-pressed')).toBe('true')
 })
 it('旧筛选的迟到提取结果不能覆盖当前筛选或串进资讯会话',async()=>{
  let release;const {WB}=setup({hub:(request,{value})=>{if(request.action!=='detail')return;const base={...value,extraction:{items:[],total:0,counts:{tasks:0,replies:0,pendingReview:0},offset:0,hasMore:false}};if(request.extractionQuery==='旧')return new Promise(resolve=>{release=()=>resolve({...base,extraction:{...base.extraction,items:[{kind:'task',id:'old',title:'迟到的旧提取项',status:'ready'}],total:1}})});return base}}),user=userEvent.setup()
  const region=await screen.findByRole('region',{name:'提取结果'}),input=within(region).getByRole('textbox',{name:'搜索提取结果'});await user.type(input,'旧');await waitFor(()=>expect(release).toBeTypeOf('function'));await user.clear(input);await user.type(input,'新');await waitFor(()=>expect(screen.queryByText('正在更新提取结果…')).toBeNull());await act(async()=>release());expect(screen.queryByText('迟到的旧提取项')).toBeNull();await act(async()=>WB.assistant.openHub('system:radar'));expect(screen.queryByRole('region',{name:'提取结果'})).toBeNull();expect(screen.queryByText('迟到的旧提取项')).toBeNull()
 })

 it('提取修改回执展示真实摘要前后和中文状态、优先级与负责人',async()=>{
  const user=userEvent.setup();setup({hub:(request,{value})=>request.action==='detail'?{...value,events:[{id:'update-result',at:1000,operation:'analysis.updateResult',text:'已更新提取项',before:{snippet:'之前的摘要',status:'ready',priority:'normal',assignee:'原负责人'},after:{snippet:'修改后的摘要',status:'running',priority:'high',assignee:'新负责人'}}]}:undefined})
  await screen.findByText('已更新提取项');const summary=screen.getByText('查看修改前后');await user.click(summary);const detail=summary.closest('details');expect(within(detail).getByText('之前的摘要')).toBeTruthy();expect(within(detail).getByText('修改后的摘要')).toBeTruthy();expect(within(detail).getByText('待处理')).toBeTruthy();expect(within(detail).getByText('进行中')).toBeTruthy();expect(within(detail).getByText('普通')).toBeTruthy();expect(within(detail).getByText('高')).toBeTruthy();expect(within(detail).getByText('新负责人')).toBeTruthy()
 })

 it('普通聊天不显示工具执行记录，保留回答并隐藏目录输出',async()=>{
  const stdout='total 40\nRAW_DIRECTORY_OUTPUT\n-rw-r--r-- SKILL.md',turn={id:'plain-tool',text:'当前目录有多少技能',at:1000,source:'ai',status:'completed',reply:'当前目录共有 36 个技能。',commands:[{id:'ls-call',operation:'execute_command',label:'execute_command',status:'completed',resultText:stdout}]}
  const{calls}=setup({id:'chat:plain',hub:(request,{value})=>request.action==='detail'?{...value,turns:[turn],messages:[]}:undefined});await screen.findByText(turn.reply)
  const reply=screen.getByRole('article',{name:'处理回复'})
  expect(within(reply).queryByLabelText('工具执行记录')).toBeNull();expect(within(reply).queryByLabelText('识别的命令')).toBeNull();expect(within(reply).queryByText('已识别的操作')).toBeNull();expect(within(reply).queryByText('指令',{exact:true})).toBeNull();expect(within(reply).getByLabelText('回复来源：AI')).toBeTruthy();expect(within(reply).queryByRole('status')).toBeNull();expect(within(reply).getByLabelText('消息标记').textContent).toBe('AI');expect(reply.querySelector('.wb-hub-office-artifacts')).toBeNull();expect(within(reply).queryByText(/RAW_DIRECTORY_OUTPUT/)).toBeNull();expect(calls.every(request=>['list','detail'].includes(request.action))).toBe(true)
 })
 it('普通聊天隐藏工具记录后仍保留失败原因和未完成状态',async()=>{
  const turn={id:'failed-native',text:'查看目录',source:'ai',status:'failed',reply:'目录查询失败，请核对访问权限。',commands:[{id:'read',kind:'tool',operation:'task.update',label:'内部工具',status:'failed',resultText:'<img src=x onerror=alert(1)> permission denied'}]}
  setup({id:'chat:failed',hub:(request,{value})=>request.action==='detail'?{...value,turns:[turn],messages:[]}:undefined});await screen.findByText(turn.reply);const reply=screen.getByRole('article',{name:'处理回复'});expect(within(reply).queryByLabelText('工具执行记录')).toBeNull();expect(reply.querySelector('img')).toBeNull();expect(within(reply).getByRole('status').textContent).toContain('未完成');expect(within(reply).queryByLabelText('识别的命令')).toBeNull()
 })
 it('事项已收到最终答复时单独标记网页工具失败',async()=>{
  const turn={id:'answered-with-fetch-error',text:'申报一次就可以了吗？',source:'ai',status:'failed',failurePhase:'execution',replySource:'assistant',reply:'请核对正式申报说明。',commands:[{id:'search',kind:'tool',operation:'web_search',status:'completed'},{id:'fetch',kind:'tool',operation:'web_fetch',status:'failed',resultText:'HTTP 422'}]}
  setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,turns:[turn],messages:[]}:undefined})
  await screen.findByText(turn.reply)
  const reply=screen.getByRole('article',{name:'处理回复'})
  expect(within(reply).getByRole('status').textContent).toContain('已回复 · 1 项工具失败')
  expect(within(reply).getByLabelText('工具执行记录').textContent).toContain('HTTP 422')
 })
 it('旧普通会话的真实业务操作保留确认卡，但不再显示工具执行记录',async()=>{
  const turn={id:'mixed-tools',text:'检查目录并登记待办',source:'ai',status:'needs_confirmation',reply:'已查询目录，请确认后再修改知识。',commands:[{id:'read',kind:'tool',operation:'read_file',label:'read_file',status:'completed',resultText:'INTERNAL_FILE_CONTENT'},{id:'business',kind:'business',operation:'knowledge.update',label:'预览修改知识',status:'needs_confirmation'}]}
  setup({id:'chat:mixed',hub:(request,{value})=>request.action==='detail'?{...value,turns:[turn],messages:[],confirmations:[{id:'confirmation',turnId:turn.id,state:'pending',title:'确认修改知识'}]}:undefined});await screen.findByText(turn.reply);const reply=screen.getByRole('article',{name:'处理回复'});expect(within(reply).getByLabelText('识别的命令').textContent).toContain('预览修改知识');expect(within(reply).queryByLabelText('工具执行记录')).toBeNull();expect(within(reply).getByRole('region',{name:'待确认操作'})).toBeTruthy();expect(within(reply).getByRole('button',{name:'确认执行'})).toBeTruthy()
 })
 it('普通对话生成中显示回复状态，不展示消息识别文案',async()=>{
  const turn={id:'chat-working',text:'解释一下这个目录',source:'ai',status:'recognizing',commands:[],recognition:{outcome:'unmatched'}}
  setup({id:'chat:working',hub:(request,{value})=>request.action==='detail'?{...value,turns:[turn],messages:[]}:undefined});await screen.findByText('正在处理你的问题…');const reply=screen.getByRole('article',{name:'处理回复'});expect(within(reply).getByRole('status').textContent).toContain('正在回复');expect(reply.textContent).not.toContain('识别');expect(reply.textContent).not.toContain('已转 AI')
 })
 it('只有工具结果而未返回文字答复时，不把工具执行结束说成已回复',async()=>{
  const turn={id:'tool-only',text:'查看目录',source:'ai',status:'completed',replySource:'tools',reply:'本轮未返回文字答复，可展开工具执行记录核对执行状态。',commands:[{id:'tool',kind:'tool',operation:'execute_command',status:'completed',resultText:'RAW_OUTPUT'}]}
  setup({id:'chat:tools-only',hub:(request,{value})=>request.action==='detail'?{...value,turns:[turn],messages:[]}:undefined});await screen.findByText('本轮未返回文字答复，请在原会话查看执行状态。');const reply=screen.getByRole('article',{name:'处理回复'});expect(within(reply).getByRole('status').textContent).toContain('已结束');expect(reply.textContent).not.toContain('已回复');expect(within(reply).queryByLabelText('工具执行记录')).toBeNull();expect(reply.textContent).not.toContain('可展开')
 })
 it('专用事项会话仍提供默认折叠的工具记录',async()=>{
  const turn={id:'task-tool-log',text:'查询事项资料',source:'ai',status:'completed',reply:'已查到对应资料。',commands:[{id:'tool',kind:'tool',operation:'read_file',status:'completed',resultText:'任务资料原文'}]}
  setup({hub:(request,{value})=>request.action==='detail'?{...value,turns:[turn],messages:[]}:undefined});await screen.findByText(turn.reply);const details=screen.getByLabelText('工具执行记录');expect(details.open).toBe(false);await userEvent.setup().click(details.querySelector('summary'));expect(details.open).toBe(true);expect(within(details).getByText('任务资料原文')).toBeTruthy()
 })
 it('持久提交把原话、规则命令和真实回执放在一起，原生重复消息不再重现',async()=>{
  const turn={id:'turn-rule',requestId:'request-rule',text:'把这个待办标记完成',at:1000,source:'rule',mode:'execute',status:'completed',reply:'已把这条待办标记为已完成。',commands:[{id:'command-rule',label:'标记待办完成',operation:'task.update',parameters:{patch:{status:'completed'}},status:'completed',resultText:'状态已保存'}]}
  const {WB,calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,reinterpretSupported:false,turns:[turn],messages:[{role:'assistant',text:'之前未关联的历史仍然可读',at:100},{role:'user',text:turn.text,at:1000,turnId:turn.id},{role:'assistant',text:turn.reply,at:2000,turnId:turn.id}],events:[{id:'receipt',turnId:turn.id,at:2000,operation:'analysis.updateResult',text:turn.reply,before:{status:'ready'},after:{status:'completed'}}]}:undefined}),user=userEvent.setup()
  const group=await screen.findByRole('region',{name:'提交与处理结果'});expect(within(group).getByText(turn.text)).toBeTruthy();expect(within(group).getByLabelText('识别来源：规则')).toBeTruthy();expect(within(group).getByRole('button',{name:'改用 AI 识别'}).disabled).toBe(true);expect(within(group).getByRole('button',{name:'改用 AI 识别'}).title).toBe('当前宿主暂不支持仅重新识别');expect(within(group).getByText('task.update')).toBeTruthy();expect(within(group).getByText('状态已保存')).toBeTruthy();expect(screen.getAllByText(turn.text)).toHaveLength(1);expect(screen.getAllByText(turn.reply)).toHaveLength(1);expect(screen.getByText('之前未关联的历史仍然可读')).toBeTruthy();await user.click(within(group).getByText('查看修改前后'));expect(within(group).getByText('修改前')).toBeTruthy();expect(within(group).getByText('修改后')).toBeTruthy()
  await leaveAssistant(user);await act(async()=>WB.assistant.openHub('task','a'));await screen.findByText(turn.reply);expect(screen.getAllByText(turn.text)).toHaveLength(1);expect(calls.filter(c=>['send','operate','reinterpret'].includes(c.action))).toHaveLength(0)
 })
 it('发送立即显示原话与识别中，返回持久记录后按requestId去重',async()=>{
  let finish,turn;const {calls}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='detail')return {...value,turns:turn?[turn]:[],messages:[]}
   if(request.action==='send')return new Promise(resolve=>{finish=()=>{turn={id:'server-turn',requestId:request.requestId,text:request.text,at:1000,source:'rule',mode:'execute',status:'completed',reply:'实际修改已保存',commands:[{id:'cmd',operation:'task.update',label:'修改待办',status:'completed'}]};resolve({status:'ok',handled:true,turn,turnId:turn.id,requestId:turn.requestId})}})
  }}),user=userEvent.setup();await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).disabled).toBe(false));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'标记这条为进行中');await user.click(screen.getByRole('button',{name:'发送'}));await screen.findByText('标记这条为进行中');expect(screen.getByText('正在识别指令')).toBeTruthy();expect(screen.getByText('已收到，正在识别要处理的内容。')).toBeTruthy();expect(calls.find(c=>c.action==='send').requestId).toMatch(/\S+/);await act(async()=>finish());await screen.findByText('实际修改已保存');expect(screen.getAllByText('标记这条为进行中')).toHaveLength(1);expect(screen.getAllByRole('region',{name:'提交与处理结果'})).toHaveLength(1);expect(screen.queryByText('正在识别指令')).toBeNull()
 })
 it('规则来源与指令标记在消息卡片底部，状态受阻不是识别失败，内部命令默认折叠',async()=>{
  const turn={id:'blocked-command',text:'继续处理研发任务',at:1000,source:'rule',mode:'execute',status:'failed',blocked:true,failurePhase:'execution',reply:'当前处于人工审查，请先填写审查意见。',commands:[{id:'continue-command',label:'继续研发任务',operation:'development.continue',parameters:{id:'dev-one'},status:'failed',blocked:true}]}
  setup({hub:(request,{value})=>request.action==='detail'?{...value,turns:[turn],messages:[]}:undefined});const user=userEvent.setup(),reply=await screen.findByRole('article',{name:'处理回复'}),markers=within(reply).getByLabelText('消息标记'),source=within(markers).getByLabelText('识别来源：规则')
  expect(source.textContent).toBe('规则');expect(source.closest('footer')).toBeTruthy();expect(reply.firstElementChild.tagName).not.toBe('FOOTER');expect(within(markers).getByText('指令')).toBeTruthy();expect(within(markers).getByRole('status').textContent).toContain('暂不能执行');expect(reply.textContent).not.toContain('规则识别失败');expect(reply.querySelector('strong')?.textContent).toBe('继续研发任务')
  const details=within(reply).getByText('指令详情').closest('details');expect(details.open).toBe(false);expect(within(reply).getByText('development.continue').closest('details')).toBe(details);await user.click(within(reply).getByText('指令详情'));expect(details.open).toBe(true);expect(details.textContent).toContain('dev-one')
 })
 it('未命中规则自动转AI时沿用同一卡片，先显示理解中，完成后标出真实指令',async()=>{
  let turn,finish;const {calls}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='detail')return {...value,turns:turn?[turn]:[],messages:[]}
   if(request.action==='send'){turn={id:'automatic-ai',requestId:request.requestId,text:request.text,at:1000,source:'ai',mode:'execute',status:'recognizing',recognition:{outcome:'ambiguous',reason:'当前表达需要结合上下文判断'},reply:'正在结合上下文理解你的请求。',commands:[]};return {status:'ok',sessionId:'native-fallback',fromSeq:0,turn,turnId:turn.id}}
   if(request.action==='delta')return new Promise(resolve=>{finish=()=>{turn={...turn,status:'completed',reply:'已根据补充信息将待办改为进行中。',commands:[{id:'fallback-cmd',label:'调整待办状态',operation:'task.update',parameters:{patch:{status:'running'}},status:'completed'}]};resolve({status:'ok',turns:[turn],entries:[],nextSeq:1,turnEnded:true})}})
  }}),user=userEvent.setup();await ready();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'按照刚才的讨论调整这个事项');await user.click(screen.getByRole('button',{name:'发送'}));await screen.findByText('正在结合上下文理解你的请求。');const pending=screen.getByRole('article',{name:'处理回复'});expect(within(pending).getByText('已转 AI').title).toContain('结合上下文');expect(within(pending).getByRole('status').textContent).toContain('AI 理解中');expect(pending.textContent).not.toContain('失败');expect(within(pending).queryByText('指令',{exact:true})).toBeNull()
  await waitFor(()=>expect(finish).toBeTypeOf('function'));await act(async()=>finish());await screen.findByText('已根据补充信息将待办改为进行中。');expect(screen.getAllByRole('article',{name:'处理回复'})).toHaveLength(1);const finished=screen.getByRole('article',{name:'处理回复'});expect(within(finished).getByLabelText('识别来源：AI')).toBeTruthy();expect(within(finished).getByText('指令',{exact:true})).toBeTruthy();expect(within(finished).getByText('task.update').closest('details').open).toBe(false);expect(calls.filter(c=>c.action==='send')).toHaveLength(1);expect(calls.filter(c=>c.action==='reinterpret')).toHaveLength(0)
 })
 it('旧失败记录保守显示未完成，AI澄清与重新理解不会伪装成执行指令',async()=>{
  const turns=[{id:'old-failed',text:'继续处理',at:1000,source:'rule',mode:'execute',status:'failed',reply:'提交后连接断开，完成情况尚未确认。',commands:[{id:'unknown-cmd',operation:'internal.custom',label:'internal.custom',status:'failed'}]},{id:'clarify-ai',text:'改成刚才那个',at:2000,source:'ai',mode:'execute',status:'completed',clarificationOnly:true,recognition:{outcome:'ambiguous'},reply:'请说明要修改哪一条。',commands:[]},{id:'suggestion-ai',text:'重新看这句话',at:3000,source:'ai',mode:'reinterpret',status:'completed',reply:'建议仅查询当前进度。',commands:[]}]
  setup({hub:(request,{value})=>request.action==='detail'?{...value,turns,messages:[]}:undefined});await screen.findByText('提交后连接断开，完成情况尚未确认。');const replies=screen.getAllByRole('article',{name:'处理回复'});expect(within(replies[0]).getByRole('status').textContent).toContain('未完成');expect(replies[0].textContent).not.toContain('未执行');expect(within(replies[0]).getByText('已识别的操作')).toBeTruthy();expect(within(replies[0]).getByText('internal.custom').closest('details').open).toBe(false);expect(within(replies[1]).queryByText('指令',{exact:true})).toBeNull();expect(within(replies[1]).getByRole('status').textContent).toContain('待你补充');expect(within(replies[2]).getByText('识别建议')).toBeTruthy();expect(within(replies[2]).queryByText('指令',{exact:true})).toBeNull()
 })
 it('规则因宿主无法安全澄清而要求补充时，卡片标记待你补充且不宣称完成或执行',async()=>{
  const turn={id:'rule-clarification',text:'修改那一条',at:1000,source:'rule',mode:'execute',status:'completed',clarificationOnly:true,recognition:{outcome:'ambiguous',reason:'宿主暂不支持仅澄清模式'},reply:'请明确要修改哪一项及目标状态，确认后再继续。',commands:[]}
  const {calls}=setup({hub:(request,{value})=>request.action==='detail'?{...value,turns:[turn],messages:[]}:undefined});const reply=await screen.findByRole('article',{name:'处理回复'});expect(within(reply).getByLabelText('识别来源：规则')).toBeTruthy();expect(within(reply).getByRole('status').textContent).toContain('待你补充');expect(within(reply).queryByText('指令',{exact:true})).toBeNull();expect(reply.textContent).not.toContain('已完成');expect(reply.textContent).not.toContain('已执行');expect(calls.every(request=>['list','detail'].includes(request.action))).toBe(true)
 })
 it('改用AI识别只提交原turnId，保留输入与上下文并明确原操作不会重复执行',async()=>{
  const original={id:'rule-one',requestId:'rule-request',text:'刷新识别',at:1000,source:'rule',mode:'execute',status:'completed',reply:'先前识别已经完成',commands:[{id:'rule-cmd',label:'继续消息识别',operation:'analysis.continue',status:'completed'}]},turns=[original]
  const {WB,calls}=setup({hub:(request,{value})=>{
   if(request.action==='detail')return {...value,turns:turns.slice(),messages:[]}
   if(request.action==='reinterpret'){const turn={id:'ai-explanation',requestId:request.requestId,text:original.text,at:3000,source:'ai',mode:'reinterpret',status:'completed',reply:'这句话还可能表示只刷新查看结果，需要你进一步确认意图。',commands:[],reinterpretsTurnId:original.id};turns.push(turn);return {status:'ok',handled:true,turn,turnId:turn.id,requestId:request.requestId}}
  }}),user=userEvent.setup();await screen.findByText('先前识别已经完成');await user.type(screen.getByRole('textbox',{name:'助手消息'}),'还没发送的补充说明');await act(async()=>WB.store.set({assistantRefs:[{kind:'task',id:'a',title:'甲的工作'}]}));await user.click(screen.getByRole('button',{name:'改用 AI 识别'}));await screen.findByText('仅重新理解，原操作不会重复执行。');expect(screen.getByLabelText('识别来源：AI')).toBeTruthy();expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('还没发送的补充说明');expect(WB.store.get().assistantRefs).toEqual([{kind:'task',id:'a',title:'甲的工作'}]);expect(calls.filter(c=>['send','operate'].includes(c.action))).toHaveLength(0);const request=calls.find(c=>c.action==='reinterpret');expect(request).toMatchObject({turnId:'rule-one',conversationId:'system:analysis'});expect(request.requestId).toMatch(/\S+/);expect(request.text).toBeUndefined();expect(request.refs).toBeUndefined();expect(screen.getAllByRole('region',{name:'提交与处理结果'})).toHaveLength(2)
 })
 it('连接失败挂在对应提交下，再次检查沿用同requestId且不丢已输入的新草稿',async()=>{
  let count=0,turn;const {calls}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='detail')return {...value,turns:turn?[turn]:[],messages:[]}
   if(request.action==='send'){if(count++===0)throw Error('暂时无法连接');turn={id:'retried-turn',requestId:request.requestId,text:request.text,at:1000,source:'rule',mode:'execute',status:'completed',reply:'已核对，原请求执行完成',commands:[]};return {status:'ok',handled:true,turn,turnId:turn.id}}
  }}),user=userEvent.setup();await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).disabled).toBe(false));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'完成待办');await user.click(screen.getByRole('button',{name:'发送'}));const failure=await screen.findByRole('alert');expect(failure.textContent).toContain('暂时无法连接');expect(failure.closest('[aria-label="提交与处理结果"]')).toBeTruthy();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'稍后要问的问题');await user.click(screen.getByRole('button',{name:'检查并重试提交'}));await screen.findByText('已核对，原请求执行完成');const sends=calls.filter(c=>c.action==='send');expect(sends).toHaveLength(2);expect(sends[0].requestId).toBe(sends[1].requestId);expect(screen.getAllByText('完成待办')).toHaveLength(1);expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('稍后要问的问题');expect(screen.queryByText('暂时无法连接')).toBeNull()
 })
 it('AI识别轮询回填真实命令与完成回复，原生流消息按turn去重',async()=>{
  let turn,deltaCount=0;const {calls}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='detail')return {...value,turns:turn?[turn]:[],messages:turn?[{role:'user',text:turn.text,turnId:turn.id,at:1000},{role:'assistant',text:turn.reply,turnId:turn.id,at:2000}]:[]}
   if(request.action==='send'){turn={id:'ai-work',requestId:request.requestId,text:request.text,at:1000,source:'ai',mode:'execute',status:'recognizing',commands:[]};return {status:'ok',sessionId:'native-ai',fromSeq:0,turn,turnId:turn.id}}
   if(request.action==='delta'){deltaCount++;turn={...turn,status:deltaCount>1?'completed':'executing',reply:deltaCount>1?'已核对并修改指定待办':'已识别目标，正在调用修改命令',commands:[{id:'ai-command',label:'修改所选提取结果',operation:'analysis.updateResult',parameters:{id:'a',patch:{status:'completed'}},status:deltaCount>1?'completed':'executing'}]};return {status:'ok',turns:[turn],entries:[{role:'assistant',text:turn.reply,turnId:turn.id,seq:deltaCount,at:2000}],nextSeq:deltaCount,turnEnded:deltaCount>1}}
  }}),user=userEvent.setup();await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).disabled).toBe(false));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'帮我看完内容后修改为完成');await user.click(screen.getByRole('button',{name:'发送'}));await screen.findByText('已核对并修改指定待办');expect(screen.getAllByText('帮我看完内容后修改为完成')).toHaveLength(1);expect(screen.getAllByText('已核对并修改指定待办')).toHaveLength(1);expect(screen.getByLabelText('识别来源：AI')).toBeTruthy();expect(screen.getByText('analysis.updateResult')).toBeTruthy();expect(calls.filter(c=>c.action==='delta').length).toBeGreaterThanOrEqual(2)
 })
 it('消息识别作业进度跟随原提交，需确认与失败在各自回复中显示',async()=>{
  const job={id:'tracked-job',kind:'analysis',status:'running',progress:{processed:50,remaining:30,failed:1}},turns=[{id:'running-turn',text:'开始识别全部消息',at:1000,source:'rule',mode:'execute',status:'executing',reply:'消息已提交，正在连续识别',commands:[{id:'run-cmd',operation:'analysis.continue',label:'继续识别',status:'executing'}],jobs:[job]},{id:'confirmation-turn',text:'删除这条知识',at:2000,source:'rule',mode:'execute',status:'needs_confirmation',reply:'请核对将要删除的知识',commands:[{id:'delete-cmd',operation:'knowledge.delete',label:'删除知识',status:'needs_confirmation'}]},{id:'failed-turn',text:'执行本次查询',at:3000,source:'ai',mode:'execute',status:'failed',reply:'查询失败：实际数据源暂不可用',commands:[]}]
  setup({hub:(request,{value})=>request.action==='detail'?{...value,turns,messages:[],runs:[job],confirmations:[{id:'turn-confirm',turnId:'confirmation-turn',title:'确认删除知识',state:'pending',before:{title:'要删除的知识'}}]}:undefined});await screen.findByText('消息已提交，正在连续识别');const groups=screen.getAllByRole('region',{name:'提交与处理结果'});expect(within(groups[0]).getByText('累计处理 50 条 · 剩余 30 条 · 失败 1 条')).toBeTruthy();expect(screen.getAllByLabelText('执行结果：消息识别')).toHaveLength(1);expect(within(groups[1]).getByRole('region',{name:'待确认操作'})).toBeTruthy();expect(screen.getAllByRole('region',{name:'待确认操作'})).toHaveLength(1);expect(within(groups[2]).getByText('查询失败：实际数据源暂不可用')).toBeTruthy();expect(within(groups[2]).getByRole('status').textContent).toContain('未完成')
 })
 it('切换事项隔离尚未确认的提交，迟到回包不能串入新会话',async()=>{
  let finish,turn;const {WB}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='detail')return {...value,messages:[],turns:request.conversationId==='task:a'&&turn?[turn]:[]}
   if(request.action==='send')return new Promise(resolve=>{finish=()=>{turn={id:'late-turn',requestId:request.requestId,text:request.text,at:1000,source:'rule',mode:'execute',status:'completed',reply:'甲的处理已经完成',commands:[]};resolve({status:'ok',handled:true,turn,turnId:turn.id})}})
  }}),user=userEvent.setup();await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).disabled).toBe(false));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'仅处理甲');await user.click(screen.getByRole('button',{name:'发送'}));await screen.findByText('仅处理甲');await user.click(screen.getByRole('button',{name:'会话：乙的工作'}));await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).disabled).toBe(false));await act(async()=>finish());expect(screen.queryByText('仅处理甲')).toBeNull();expect(screen.queryByText('甲的处理已经完成')).toBeNull();await act(async()=>WB.assistant.openHub('task','a'));await screen.findByText('甲的处理已经完成');expect(screen.getAllByText('仅处理甲')).toHaveLength(1)
 })

 it('后台识别逐条展开全部50条建议和无效原因，不把模型建议标成执行成功',async()=>{
  const items=Array.from({length:50},(_,index)=>({sourceId:'message-'+index,summary:'第 '+(index+1)+' 条消息的真实识别摘要',instructions:['指令建议 '+(index+1)],status:index===49?'invalid':'recognized',...(index===49?{reason:'该消息未返回完整的有效识别结果'}:{})}))
  setup({hub:(request,{value})=>request.action==='detail'?{...value,background:{messages:[{sessionId:'recognition-native',seq:2,at:2000,role:'assistant',text:'后台已返回一批识别结果',recognition:{batchId:'batch-one',note:'本批实际模型返回',items}}],hasMore:false,before:null,turnActive:false,errors:[]}}:undefined});const user=userEvent.setup(),summary=await screen.findByText('逐条识别结果 · 50 条 · 1 条未有效返回');expect(summary.closest('details').open).toBe(false);await user.click(summary);const result=summary.closest('details');expect(result.querySelectorAll(':scope > ol > li')).toHaveLength(50);expect(within(result).getByText('消息 message-49')).toBeTruthy();expect(within(result).getByText('第 50 条消息的真实识别摘要')).toBeTruthy();expect(within(result).getByText('指令建议 50')).toBeTruthy();expect(within(result).getByText('该消息未返回完整的有效识别结果')).toBeTruthy();expect(within(result).getByText('以下是 AI 识别建议，实际登记状态以提取结果为准。')).toBeTruthy();expect(result.textContent).not.toContain('已执行')
 })
 it('未关联turn的旧原生失败仍直接显示在聊天时间线',async()=>{
  setup({id:'system:radar',hub:(request,{value})=>request.action==='detail'?{...value,messages:[{role:'user',text:'以前的资讯查询',at:1000},{role:'error',text:'旧查询失败：数据源返回无效格式',at:2000}]}:undefined});const failure=await screen.findByText('旧查询失败：数据源返回无效格式');expect(failure.closest('details')).toBeNull();expect(failure.closest('[data-chat-author]').getAttribute('data-chat-author')).toBe('system');expect(failure.closest('[data-chat-author]').textContent).toContain('处理异常');expect(screen.queryByText('执行诊断')).toBeNull()
 })
 it('纯AI回答只保留AI标记，重新理解及后台实际说明仍准确显示',async()=>{
  setup({id:'system:radar',hub:(request,{value})=>request.action==='detail'?{...value,turns:[{id:'answer-only',text:'解释这个资讯的意义',at:1000,source:'ai',mode:'execute',status:'completed',reply:'这条资讯对当前项目的意义如下。',commands:[],executionNote:'当前没有触发后台处理作业。'},{id:'reinterpret-done',text:'重新理解原指令',at:2000,source:'ai',mode:'reinterpret',status:'completed',reply:'原指令可能是在查询已有结果。',commands:[]}]}:undefined});await screen.findByText('这条资讯对当前项目的意义如下。');const groups=screen.getAllByRole('region',{name:'提交与处理结果'});expect(within(groups[0]).getByLabelText('消息标记').textContent).toBe('AI');expect(within(groups[0]).queryByText('已回复')).toBeNull();expect(within(groups[0]).getByText('当前没有触发后台处理作业。')).toBeTruthy();expect(within(groups[1]).getByText('已重新识别')).toBeTruthy();expect(groups.every(group=>!group.textContent.includes('已完成'))).toBe(true)
 })

 it('加载更早的旧原生turn后刷新仍保留指令与回复，切换会话时清空',async()=>{
  const recent={id:'native:old-session:3',text:'最近的旧指令',at:3000,source:'ai',mode:'execute',status:'completed',reply:'最近的旧回复',commands:[]},earlier={id:'native:old-session:1',text:'更早的旧指令',at:1000,source:'ai',mode:'execute',status:'completed',reply:'更早的旧回复',commands:[{id:'old-tool',label:'查询事项',operation:'task.query',status:'completed'}]}
  const {WB,calls}=setup({id:'task:a',hub:(request,{value})=>{if(request.action!=='detail')return;if(request.conversationId!=='task:a')return {...value,messages:[],turns:[]};const turn=request.before?earlier:recent;return {...value,turns:[turn],messages:[{role:'user',text:turn.text,seq:request.before?1:3,at:turn.at,turnId:turn.id},{role:'assistant',text:turn.reply,seq:request.before?2:4,at:turn.at+1,turnId:turn.id}],hasMore:!request.before,before:{seq:3}}}}),user=userEvent.setup();await screen.findByText('最近的旧回复');await user.click(screen.getByRole('button',{name:'加载更早的对话'}));await screen.findByText('更早的旧回复');expect(screen.getAllByText('更早的旧指令')).toHaveLength(1);expect(screen.getAllByText('更早的旧回复')).toHaveLength(1);await user.click(screen.getByRole('button',{name:'刷新进度'}));await waitFor(()=>expect(calls.filter(c=>c.action==='detail'&&!c.before).length).toBeGreaterThan(1));expect(screen.getByText('更早的旧回复')).toBeTruthy();expect(screen.getByText('task.query')).toBeTruthy();await act(async()=>WB.assistant.openHub('system:radar'));await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).disabled).toBe(false));expect(screen.queryByText('更早的旧回复')).toBeNull();expect(screen.queryByText('最近的旧回复')).toBeNull()
 })

 it('资讯四段展示摘要反馈和段落名，保留缺失原因且不冒充指令建议',async()=>{
  const items=['技术变化','业务影响','行动建议','风险提示'].map((label,index)=>({sourceId:'section-'+index,label,summary:index===3?'':'实际段落内容 '+(index+1),status:index===3?'invalid':'recognized',instructions:[],reason:index===3?'本次未返回风险提示段落':undefined}));setup({id:'system:radar',hub:(request,{value})=>request.action==='detail'?{...value,background:{messages:[{sessionId:'summary-native',seq:2,at:1000,role:'assistant',text:'资讯摘要已返回',recognition:{purpose:'summary',items}}],hasMore:false,before:null,turnActive:false,errors:[]}}:undefined});const user=userEvent.setup(),title=await screen.findByText('摘要反馈 · 4段 · 1 段未有效返回');await user.click(title);const region=title.closest('details');expect(within(region).getByText('技术变化')).toBeTruthy();expect(within(region).getAllByText('已返回内容')).toHaveLength(3);expect(within(region).getByText('本次未返回风险提示段落')).toBeTruthy();expect(region.textContent).not.toContain('消息 section-');expect(region.textContent).not.toContain('指令建议');expect(region.textContent).not.toContain('提取结果')
 })

 it('报告工具只打开主题，明确生成后显示一次真实成果并保留原会话输入',async()=>{
  const turns={},job={id:'daily-job',kind:'work_report',title:'今日工作日报',status:'completed',createdAt:1000,steps:[{id:'report-step',label:'日报',status:'completed',artifact:{text:'真实日报正文：今天已经完成联调。',evidenceIds:['source-a']}}]}
  const {WB,calls}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='detail')return {...value,turns:turns[request.conversationId]||[],runs:turns[request.conversationId]?.length?[job]:[]}
   if(request.operation==='office.start'){const turn={id:'report-'+request.conversationId,text:request.input.period==='day'?'生成日报':'生成周报',requestId:request.requestId,at:1000,source:'rule',mode:'execute',status:'completed',reply:'报告已生成',commands:[],jobs:[job],artifacts:[{jobId:job.id,stepId:'report-step',title:'今日工作日报',kind:'work_report',text:'真实日报正文：今天已经完成联调。',evidenceIds:['source-a']}]};turns[request.conversationId]=[turn];return {status:'ok',turn,turnId:turn.id}}
  }}),user=userEvent.setup();await ready();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'还没发出的处理要求');await openReport(user,'日报');await ready();expect(WB.store.get().assistantConversationId).toBe('office:report-day');expect(calls.some(c=>c.operation==='office.start')).toBe(false);await user.click(screen.getByRole('button',{name:'生成日报',exact:true}));await screen.findByText('真实日报正文：今天已经完成联调。');expect(calls.find(c=>c.operation==='office.start')).toMatchObject({conversationId:'office:report-day',kind:'work_report',input:{period:'day'}});expect(screen.getAllByText('真实日报正文：今天已经完成联调。')).toHaveLength(1);expect(screen.queryByText('daily-job')).toBeNull();await openReport(user,'周报');await ready();expect(calls.filter(c=>c.operation==='office.start')).toHaveLength(1);await user.click(screen.getByRole('button',{name:'生成周报',exact:true}));await waitFor(()=>expect(calls.some(c=>c.operation==='office.start'&&c.input?.period==='week')).toBe(true));await user.click(screen.getByRole('button',{name:'会话：甲的工作'}));await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('还没发出的处理要求'))
 })
 it('批量草稿保留选择和筛选，最多20条且在主题内精确提交所选ID',async()=>{
  const {WB,calls}=setup({patchFixture:fixture=>{fixture.replies=Array.from({length:22},(_,index)=>({id:'batch-'+index,contact:'联系人'+index,snippet:'实际需要回复的内容'+index,stage:index===0?'已自动回复':'待回复'}))},hub:request=>request.operation==='office.start'?{status:'ok',note:'已提交所选草稿生成'}:undefined}),user=userEvent.setup();await ready();await user.click(screen.getByRole('button',{name:'＋工具'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:/批量回复草稿/}));for(let index=0;index<20;index++)await user.click(screen.getByRole('checkbox',{name:'选择待回复：联系人'+index}));expect(screen.getByRole('checkbox',{name:'选择待回复：联系人20'}).disabled).toBe(true);await user.type(screen.getByRole('textbox',{name:'搜索待回复'}),'联系人1');await user.click(screen.getByRole('button',{name:'取消',exact:true}));await act(async()=>WB.assistant.openHub('task','a'));await ready();await user.click(screen.getByRole('button',{name:'＋工具'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:/批量回复草稿/}));expect(screen.getByRole('textbox',{name:'搜索待回复'}).value).toBe('联系人1');expect(screen.getByText('已选 20/20 条')).toBeTruthy();await user.click(screen.getByRole('button',{name:'打开回复主题',exact:true}));await ready();expect(calls.some(c=>c.operation==='office.start')).toBe(false);expect(WB.store.get().assistantConversationId).toBe('office:batch');await user.click(screen.getByRole('button',{name:'生成回复草稿',exact:true}));await waitFor(()=>expect(calls.some(c=>c.operation==='office.start')).toBe(true));expect(calls.find(c=>c.operation==='office.start')).toMatchObject({conversationId:'office:batch',kind:'reply_batch',input:{replyIds:Array.from({length:20},(_,index)=>'batch-'+index)}});expect(calls.filter(c=>c.operation==='office.start')).toHaveLength(1)
 })
 it('单条草稿和待办方案打开对应事项，只有明确生成才开始处理',async()=>{
  const {WB,calls}=setup({patchFixture:fixture=>{fixture.replies=[{id:'only-reply',contact:'唯一联系人',snippet:'待核对的问题',stage:'待回复'}]},hub:request=>request.operation==='office.start'?{status:'ok',note:'已提交对应事项'}:undefined}),user=userEvent.setup();await ready();await user.click(screen.getByRole('button',{name:'＋工具'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:/批量回复草稿/}));await user.click(screen.getByRole('checkbox',{name:'选择待回复：唯一联系人'}));await user.click(screen.getByRole('button',{name:'打开回复主题',exact:true}));await ready();expect(calls.some(c=>c.operation==='office.start')).toBe(false);await user.click(screen.getByRole('button',{name:'生成回复草稿',exact:true}));await waitFor(()=>expect(calls.some(c=>c.operation==='office.start')).toBe(true));expect(calls.find(c=>c.operation==='office.start')).toMatchObject({conversationId:'reply:only-reply',kind:'reply_batch',input:{replyIds:['only-reply']}});await ready();await user.click(screen.getByRole('button',{name:'＋工具'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:/待办处理方案/}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:/甲的工作/}));await ready();expect(calls.filter(c=>c.operation==='office.start')).toHaveLength(1);await user.click(screen.getByRole('button',{name:'生成处理方案',exact:true}));await waitFor(()=>expect(calls.filter(c=>c.operation==='office.start')).toHaveLength(2));expect(calls.filter(c=>c.operation==='office.start')[1]).toMatchObject({conversationId:'task:a',kind:'task_assist'});expect(WB.store.get().assistantConversationId).toBe('task:a')
 })
 it('对话产物保留复制、存候选知识、采纳草稿并由主机状态禁用重复采纳',async()=>{
  const artifact={jobId:'reply-job',stepId:'reply-step',title:'给客户的回复草稿',kind:'reply_batch',text:'已经核实情况，请查看这份真实回复草稿。',evidenceIds:[]};let adopted=false,saved=false
  const {WB,calls}=setup({id:'system:office',hub:(request,{value})=>{
   if(request.action==='detail')return {...value,turns:[{id:'artifact-turn',text:'准备回复',source:'system',origin:'office-history',recordedStatus:'completed',status:'completed',reply:'以下是已生成的草稿',commands:[],artifacts:[{...artifact,adoptedAt:adopted?'2026-11-01':undefined,knowledgeId:saved?'knowledge-one':undefined}]}]}
   if(request.operation==='office.adoptReply'){adopted=true;return {status:'ok',note:'已采纳为草稿，尚未发送'}}
   if(request.operation==='office.saveKnowledge'){saved=true;return {status:'ok',note:'已存为候选知识'}}
  }}),user=userEvent.setup();let copied;WB.util.copy=async text=>{copied=text};await screen.findByText(artifact.text);expect(screen.getByText('历史办公记录')).toBeTruthy();expect(screen.queryByText('正在识别指令')).toBeNull();await user.click(screen.getByRole('button',{name:'复制内容'}));expect(copied).toBe(artifact.text);await user.click(screen.getByRole('button',{name:'存为候选知识'}));await waitFor(()=>expect(screen.getByRole('button',{name:'已存为候选知识'}).disabled).toBe(true));await user.click(screen.getByRole('button',{name:'采纳为回复草稿'}));await waitFor(()=>expect(screen.getByRole('button',{name:'已保存草稿'}).disabled).toBe(true));expect(calls.find(c=>c.operation==='office.adoptReply')).toMatchObject({jobId:'reply-job',stepId:'reply-step',conversationId:'system:office'});expect(calls.find(c=>c.operation==='office.saveKnowledge')).toMatchObject({jobId:'reply-job',stepId:'reply-step'});expect(calls.some(c=>c.operation==='reply.send')).toBe(false)
 })

 it('办公步骤失败显示真实原因和已完成产物，历史待审批不会被显示为完成',async()=>{
  setup({id:'system:office',hub:(request,{value})=>request.action==='detail'?{...value,turns:[{id:'partial-office',source:'system',origin:'office-history',recordedStatus:'waiting_approval',text:'',status:'completed',reply:'历史处理记录',commands:[],jobs:[{id:'partial-job',kind:'reply_batch',title:'批量回复',status:'failed',steps:[{id:'good',label:'客户甲',status:'completed'},{id:'bad',label:'客户乙',status:'failed',error:'原消息暂不可读，请重新同步'}]}],artifacts:[{jobId:'partial-job',stepId:'good',title:'客户甲的回复草稿',kind:'reply_batch',text:'已经成功生成的部分仍可采纳。',evidenceIds:[]}]}]}:undefined});await screen.findByText('客户乙：原消息暂不可读，请重新同步');expect(screen.getByText('已经成功生成的部分仍可采纳。')).toBeTruthy();const turn=screen.getByRole('region',{name:'提交与处理结果'});expect(within(turn).getByText('待确认')).toBeTruthy();expect(turn.querySelector('.is-user')).toBeNull();expect(screen.getByRole('button',{name:'继续未完成内容'})).toBeTruthy()
 })
 it('AI建议开启忙碌告知时确认卡清楚展示开关前后，查看不会配置或发送',async()=>{
  const {calls}=setup({id:'system:office',hub:(request,{value})=>request.action==='detail'?{...value,confirmations:[{id:'busy-confirm',state:'pending',title:'确认开启私聊忙碌告知',before:{enabled:false,startedAt:null,text:'固定忙碌告知'},after:{enabled:true,startedAt:'2026-11-01T01:00:00Z',text:'固定忙碌告知'}}]}:undefined});const card=await screen.findByRole('region',{name:'待确认操作'});expect(within(card).getByText('关闭')).toBeTruthy();expect(within(card).getByText('开启')).toBeTruthy();expect(within(card).getAllByText('开始时间')).toHaveLength(2);expect(calls.every(request=>['list','detail'].includes(request.action))).toBe(true)
 })
 it('同一报告已有原会话时保留持久跳转，重开主题不重复执行',async()=>{
  let existing=false;const {WB,calls}=setup({id:'system:office',hub:(request,{value})=>{
   if(request.action==='detail')return {...value,events:existing&&request.conversationId==='office:report-day'?[{id:'existing-report',text:'相同报告已在原会话中处理',result:{relatedConversationId:'chat:original'}}]:[]}
   if(request.operation==='office.start'){existing=true;return {status:'ok',existing:true,conversationId:'chat:original',note:'请打开原会话继续',jobs:[]}}
  }}),user=userEvent.setup();await ready();await openReport(user,'日报');await ready();await user.click(screen.getByRole('button',{name:'生成日报',exact:true}));await screen.findByRole('button',{name:'打开原会话'});await leaveAssistant(user);await act(async()=>WB.assistant.openHub('office:report-day'));await user.click(await screen.findByRole('button',{name:'打开原会话'}));expect(WB.store.get().assistantConversationId).toBe('chat:original');expect(calls.filter(request=>request.operation==='office.start')).toHaveLength(1)
 })

 it('其它会话忙碌或正在加载时，常用操作中的自动回复设置不可打开',async()=>{
  let load,finish,loaded=false;const {calls}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='detail'&&!loaded)return new Promise(resolve=>{load=()=>{loaded=true;resolve(value)}})
   if(request.action==='send')return new Promise(resolve=>{finish=()=>resolve({status:'ok',handled:true,note:'本轮已返回'})})
  }}),user=userEvent.setup();await screen.findByRole('button',{name:'＋工具'});await user.click(screen.getByRole('button',{name:'＋工具'}));let dialog=screen.getByRole('dialog');expect(within(dialog).getByRole('button',{name:/自动回复设置/}).disabled).toBe(true);await user.click(within(dialog).getByRole('button',{name:'关闭',exact:true}));await act(async()=>load());await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).disabled).toBe(false));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'先处理这个问题');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(finish).toBeTypeOf('function'));await user.click(screen.getByRole('button',{name:'＋工具'}));dialog=screen.getByRole('dialog');const settings=within(dialog).getByRole('button',{name:/自动回复设置/});expect(settings.disabled).toBe(true);await user.click(settings);expect(screen.queryByRole('region',{name:'忙碌告知设置'})).toBeNull();expect(calls.some(request=>request.operation==='busyReply.status')).toBe(false);await act(async()=>finish())
 })

 it.each(['切换会话','离开页面'])('报告主题加载期间%s后重开不会自动生成',async(exit)=>{
  let officeReady=false,release;const {WB,calls}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='detail'&&request.conversationId==='office:report-day'&&!officeReady)return new Promise(resolve=>{release=()=>resolve(value)})
   if(request.operation==='office.start')return {status:'ok',note:'新的明确操作已提交'}
  }}),user=userEvent.setup();await ready();await openReport(user,'日报');await waitFor(()=>expect(release).toBeTypeOf('function'));expect(calls.some(request=>request.operation==='office.start')).toBe(false);if(exit==='切换会话')await user.click(screen.getByRole('button',{name:'会话：乙的工作'}));else await leaveAssistant(user);officeReady=true;await act(async()=>release());await act(async()=>WB.assistant.openHub('office:report-day'));await ready();expect(calls.some(request=>request.operation==='office.start')).toBe(false);await user.click(screen.getByRole('button',{name:'生成日报',exact:true}));await waitFor(()=>expect(calls.filter(request=>request.operation==='office.start')).toHaveLength(1))
 })
 it('持久待提交操作在目标读取失败时取消，恢复后仍需明确发起',async()=>{
  let fail=true;const {WB,calls}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='detail'&&request.conversationId==='office:report-day'&&fail)return {status:'error',note:'目标记录暂不可读'}
   if(request.operation==='office.start')return {status:'ok',note:'已提交新的日报生成'}
  }}),user=userEvent.setup();await ready();await act(async()=>WB.store.set({assistantConversationId:'office:report-day',assistantOfficeTopics:{'office:report-day':{kind:'work_report',input:{period:'day'}}},assistantOfficeLaunch:{target:'office:report-day',operation:'office.start',text:'生成日报',extra:{kind:'work_report',input:{period:'day'}},requestId:'queued-before-reload'}}));await waitFor(()=>expect(WB.store.get().assistantOfficeLaunch).toBeNull());expect(WB.store.get().assistantOfficeNotice).toContain('目标会话读取失败');expect(screen.getByRole('button',{name:'生成日报',exact:true}).disabled).toBe(true);fail=false;await user.click(screen.getByRole('button',{name:'刷新进度'}));await ready();expect(calls.some(request=>request.operation==='office.start')).toBe(false);await user.click(screen.getByRole('button',{name:'生成日报',exact:true}));await waitFor(()=>expect(calls.filter(request=>request.operation==='office.start')).toHaveLength(1))
 })
 it('忙碌设置读取失败时说明错误，不把未知状态显示成关闭或永久读取',async()=>{
  const {WB,calls}=setup({id:'task:a',hub:(request,{value})=>request.operation==='busyReply.status'?{status:'error',note:'无法读取忙碌设置'}:request.action==='detail'?{...value,busyReply:undefined}:undefined}),user=userEvent.setup();await ready();await user.click(screen.getByRole('button',{name:'＋工具'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:/自动回复设置/}));const dialog=screen.getByRole('dialog');await within(dialog).findByRole('alert');expect(within(dialog).getByRole('alert').textContent).toContain('无法读取忙碌设置');expect(within(dialog).queryByRole('switch')).toBeNull();expect(within(dialog).queryByText('正在读取当前设置…')).toBeNull();expect(WB.store.get().assistantOfficeLaunch).toBeNull();expect(calls.find(request=>request.operation==='busyReply.status').conversationId).toBe('task:a');expect(calls.some(request=>request.operation==='busyReply.configure'||request.action==='reset')).toBe(false)
 })

 it('会话按类型筛选，置顶优先且需要处理的事项不会成为另一种会话类型',async()=>{
  const {calls}=setup({hub:(request,{value})=>request.action==='list'?{...value,conversations:value.conversations.map(row=>row.id==='task:a'?{...row,pinned:true,latestPreview:'联调方案已准备'}:row.id==='task:b'?{...row,needsAttention:true,latestPreview:'需要确认结果'}:row.id==='system:analysis'?{...row,activityStatus:'running'}:row).concat({id:'chat:empty',kind:'chat',title:'尚未发送的对话',latestPreview:''})}:undefined}),user=userEvent.setup();await ready()
  const capabilities=screen.getByRole('navigation',{name:'系统能力'}),sidebar=screen.getByRole('navigation',{name:'助手会话列表'}),filters=within(sidebar).getByRole('group',{name:'会话类型'})
  expect(within(capabilities).getAllByRole('button')).toHaveLength(3);expect(within(capabilities).getByText('处理中')).toBeTruthy();expect(within(sidebar).queryByText('消息识别')).toBeNull();expect(within(sidebar).getByRole('button',{name:'会话：办公历史'})).toBeTruthy();expect(screen.getByText('联调方案已准备')).toBeTruthy();expect(within(screen.getByRole('region',{name:'置顶会话'})).getByRole('button',{name:'会话：甲的工作'})).toBeTruthy()
  expect(within(filters).getByRole('button',{name:'全部'}).getAttribute('aria-pressed')).toBe('true');expect(within(filters).queryByRole('button',{name:'需要处理'})).toBeNull()
  await user.click(within(filters).getByRole('button',{name:'普通对话'}));expect(screen.getByRole('button',{name:'会话：尚未发送的对话'})).toBeTruthy();expect(screen.queryByRole('button',{name:'会话：乙的工作'})).toBeNull();expect(screen.queryByRole('button',{name:'会话：甲的工作'})).toBeNull();expect(screen.queryByRole('button',{name:'会话：办公历史'})).toBeNull()
  await user.click(within(filters).getByRole('button',{name:'关联事项'}));expect(screen.getByRole('button',{name:'会话：甲的工作'})).toBeTruthy();expect(screen.getByRole('button',{name:'会话：乙的工作'})).toBeTruthy();expect(screen.getByRole('button',{name:'会话：部署知识'})).toBeTruthy();expect(screen.getByRole('button',{name:'会话：办公历史'})).toBeTruthy();expect(screen.queryByRole('button',{name:'会话：尚未发送的对话'})).toBeNull()
  await user.click(within(filters).getByRole('button',{name:'全部'}));expect(screen.getByRole('button',{name:'会话：尚未发送的对话'})).toBeTruthy();expect(calls.every(request=>['list','detail'].includes(request.action))).toBe(true)
 })
 it('筛选和搜索只改变列表，当前会话、正文、附件与聊天节点保持不变',async()=>{
  const {WB,calls}=setup({id:'task:a'}),user=userEvent.setup();await ready();const input=screen.getByRole('textbox',{name:'助手消息'})
  await user.type(input,'正在编辑的正文');await user.upload(screen.getByLabelText('选择助手附件'),new File(['draft'],'筛选资料.txt',{type:'text/plain'}));const count=calls.filter(request=>request.action==='detail').length
  await user.click(within(screen.getByRole('group',{name:'会话类型'})).getByRole('button',{name:'普通对话'}));expect(screen.getByText('暂无普通对话，可新建对话')).toBeTruthy();expect(screen.queryByRole('button',{name:'会话：甲的工作'})).toBeNull()
  await user.type(screen.getByRole('textbox',{name:'搜索会话或事项'}),'不存在');expect(screen.getByText('没有匹配的会话')).toBeTruthy();await user.clear(screen.getByRole('textbox',{name:'搜索会话或事项'}));await user.click(within(screen.getByRole('group',{name:'会话类型'})).getByRole('button',{name:'全部'}))
  expect(screen.getByRole('textbox',{name:'助手消息'})).toBe(input);expect(input.value).toBe('正在编辑的正文');expect(screen.getByRole('region',{name:'本轮附件'}).textContent).toContain('筛选资料.txt');expect(WB.store.get().assistantConversationId).toBe('task:a');expect(calls.filter(request=>request.action==='detail')).toHaveLength(count);expect(calls.every(request=>['list','detail'].includes(request.action))).toBe(true)
 })
 it('不同类型的会话统一按更新时间排序，置顶项不重复出现',async()=>{
  setup({hub:(request,{value})=>request.action==='list'?{...value,conversations:[...fixed,{id:'chat:older',kind:'chat',title:'较早普通对话',updatedAt:'2026-10-30T00:00:00Z'},{id:'task:newer',kind:'task',title:'最新关联事项',updatedAt:'2026-11-02T00:00:00Z'},{id:'chat:pinned',kind:'chat',title:'置顶旧对话',updatedAt:'2026-10-01T00:00:00Z',pinned:true}]}:undefined});await ready();const sidebar=screen.getByRole('navigation',{name:'助手会话列表'})
  expect(within(sidebar).getAllByRole('button',{name:/^会话：/}).map(button=>button.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('最新关联事项'),expect.stringContaining('较早普通对话')]))
  const recent=screen.getByRole('region',{name:'最近更新会话'}),titles=within(recent).getAllByRole('button',{name:/^会话：/}).map(button=>button.getAttribute('aria-label'));expect(titles.indexOf('会话：最新关联事项')).toBeLessThan(titles.indexOf('会话：较早普通对话'));expect(within(recent).queryByRole('button',{name:'会话：置顶旧对话'})).toBeNull()
 })
 it('关联事项筛选或搜索后新建对话会进入普通对话分类并清除搜索',async()=>{
  const {WB}=setup({id:'task:a',hub:(request,{conversations})=>{if(request.action==='reset'){conversations.push({id:'chat:new',kind:'chat',title:'新工作对话'});return {status:'ok',conversationId:'chat:new'}}}}),user=userEvent.setup();await ready();await user.click(within(screen.getByRole('group',{name:'会话类型'})).getByRole('button',{name:'关联事项'}));await user.type(screen.getByRole('textbox',{name:'搜索会话或事项'}),'甲的工作');await user.click(screen.getByRole('button',{name:'新建对话',exact:true}));await ready();await screen.findByRole('button',{name:'会话：新工作对话'});expect(WB.store.get().assistantConversationId).toBe('chat:new');expect(screen.getByRole('textbox',{name:'搜索会话或事项'}).value).toBe('');expect(within(screen.getByRole('group',{name:'会话类型'})).getByRole('button',{name:'普通对话'}).getAttribute('aria-pressed')).toBe('true')
 })
 it('置顶请求中切换会话可以继续置顶，旧响应不能释放新请求的锁',async()=>{
  let releaseA,releaseB;const {calls}=setup({id:'task:a',hub:(request)=>request.action==='pin'?new Promise(resolve=>{if(request.conversationId==='task:a')releaseA=()=>resolve({status:'ok'});else releaseB=()=>resolve({status:'ok'})}):undefined}),user=userEvent.setup();await ready();await user.click(screen.getByRole('button',{name:'置顶会话：甲的工作'}));await waitFor(()=>expect(releaseA).toBeTypeOf('function'));await user.click(screen.getByRole('button',{name:'会话：乙的工作'}));await ready();expect(screen.getByRole('button',{name:'置顶会话：乙的工作'}).disabled).toBe(false);await user.click(screen.getByRole('button',{name:'置顶会话：乙的工作'}));await waitFor(()=>expect(releaseB).toBeTypeOf('function'));await act(async()=>releaseA());expect(screen.getByRole('button',{name:'取消置顶：乙的工作'}).disabled).toBe(true);await act(async()=>releaseB());await waitFor(()=>expect(screen.getByRole('button',{name:'取消置顶：乙的工作'}).disabled).toBe(false));expect(calls.filter(request=>request.action==='pin')).toHaveLength(2)
 })
 it.each([360,1280])('按面板宽度选择列表或抽屉，不读取旧折叠偏好（%ipx）',async(width)=>{
  const previous=window.innerWidth;Object.defineProperty(window,'innerWidth',{configurable:true,value:width});try{
   const values=new Map([['workbench.assistant.sidebarCollapsed.v1','true']]);vi.stubGlobal('localStorage',{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)});const {WB}=setup(),user=userEvent.setup();await ready()
   if(width<=640){expect(screen.queryByRole('navigation',{name:'助手会话列表'})).toBeNull();await user.click(screen.getByRole('button',{name:'展开会话列表'}))}
   expect(screen.getByRole('navigation',{name:'助手会话列表'})).toBeTruthy();await user.click(screen.getByRole('button',{name:'收起会话列表'}));expect(screen.queryByRole('navigation',{name:'助手会话列表'})).toBeNull()
   await leaveAssistant(user);await act(async()=>WB.assistant.openHub('system:analysis'));await ready();expect(!!screen.queryByRole('navigation',{name:'助手会话列表'})).toBe(width>640)
   cleanup();setup();await ready();expect(!!screen.queryByRole('navigation',{name:'助手会话列表'})).toBe(width>640)
  }finally{Object.defineProperty(window,'innerWidth',{configurable:true,value:previous})}
 })
 it('折叠按钮归属会话列表，窄栏保留展开/新建入口，会话草稿和附件不被重建',async()=>{
  const {WB,calls}=setup({id:'task:a'}),user=userEvent.setup();await ready();const toolbar=screen.getByRole('group',{name:'助手工具栏'}),settings=within(toolbar).getByRole('group',{name:'助手工具与设置'})
  expect(within(toolbar).queryByRole('button',{name:/会话列表/})).toBeNull();expect(within(settings).getByRole('button',{name:'＋工具'})).toBeTruthy();expect(within(settings).getByRole('button',{name:'刷新进度'})).toBeTruthy()
  const input=screen.getByRole('textbox',{name:'助手消息'});await user.type(input,'保留这段尚未发送的内容');await user.upload(screen.getByLabelText('选择助手附件'),[new File(['image'],'保留图片.png',{type:'image/png'}),new File(['text'],'保留说明.txt',{type:'text/plain'})]);const before=WB.store.get().assistantConversationId,session=WB.store.get().assistantHubThreadId
  await user.click(within(screen.getByRole('navigation',{name:'助手会话列表'})).getByRole('button',{name:'收起会话列表'}));const rail=screen.getByRole('navigation',{name:'会话列表快捷栏'});expect(within(rail).getByRole('button',{name:'展开会话列表'}).getAttribute('aria-expanded')).toBe('false');expect(within(rail).getByRole('button',{name:'新建对话'})).toBeTruthy()
  expect(screen.getByRole('textbox',{name:'助手消息'})).toBe(input);expect(input.value).toBe('保留这段尚未发送的内容');expect(screen.getByRole('region',{name:'本轮附件'}).textContent).toContain('保留图片.png');expect(screen.getByRole('region',{name:'本轮附件'}).textContent).toContain('保留说明.txt')
  await user.click(within(rail).getByRole('button',{name:'展开会话列表'}));expect(screen.getByRole('navigation',{name:'助手会话列表'})).toBeTruthy();expect(input.value).toBe('保留这段尚未发送的内容');expect(WB.store.get().assistantConversationId).toBe(before);expect(WB.store.get().assistantHubThreadId).toBe(session);expect(calls.some(c=>['send','reset','newChat','prepareAttachments'].includes(c.action))).toBe(false)
 })
 it('窄屏抽屉支持遮罩、Escape和键盘焦点，折叠不清除草稿，选择当前会话会关闭抽屉',async()=>{
  const previous=window.innerWidth;Object.defineProperty(window,'innerWidth',{configurable:true,value:360});try{
   const {WB,calls}=setup({id:'task:a'}),user=userEvent.setup();await ready();const input=screen.getByRole('textbox',{name:'助手消息'});await user.type(input,'窄屏草稿')
   const trigger=screen.getByRole('button',{name:'展开会话列表'});expect(trigger.closest('.wb-hub-context-head')).toBeTruthy();await user.click(trigger);const nav=screen.getByRole('navigation',{name:'助手会话列表'}),first=within(nav).getByRole('button',{name:'新建对话'}),last=within(nav).getAllByRole('button').at(-1)
   expect(document.activeElement).toBe(first);await user.tab({shift:true});expect(document.activeElement).toBe(last);await user.tab();expect(document.activeElement).toBe(first);expect(input.closest('.wb-assistant-conversation').hasAttribute('inert')).toBe(true)
   await user.keyboard('{Escape}');expect(document.activeElement).toBe(screen.getByRole('button',{name:'展开会话列表'}));expect(screen.getByRole('textbox',{name:'助手消息'})).toBe(input);expect(input.value).toBe('窄屏草稿')
   await user.click(screen.getByRole('button',{name:'展开会话列表'}));await user.click(screen.getByRole('button',{name:'关闭会话列表'}));expect(screen.queryByRole('navigation',{name:'助手会话列表'})).toBeNull()
   await user.click(screen.getByRole('button',{name:'展开会话列表'}));await user.click(screen.getByRole('button',{name:'会话：甲的工作'}));expect(screen.queryByRole('navigation',{name:'助手会话列表'})).toBeNull();expect(input.value).toBe('窄屏草稿');expect(WB.store.get().assistantConversationId).toBe('task:a');expect(calls.some(c=>['send','reset','newChat'].includes(c.action))).toBe(false)
  }finally{Object.defineProperty(window,'innerWidth',{configurable:true,value:previous})}
 })
 it('面板宽度变化只切换布局，恢复桌面折叠选择并保留附件和正在返回的回答',async()=>{
  let finish,completed=false;const previous=window.innerWidth;const {WB,calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='send'?{status:'ok',sessionId:'original-native',fromSeq:0}:request.action==='detail'&&completed?{...value,messages:[{role:'assistant',text:'折叠后原会话完整回答'}]}:request.action==='delta'?new Promise(resolve=>{finish=()=>{completed=true;resolve({status:'ok',entries:[{role:'assistant',text:'折叠后原会话完整回答'}],turnEnded:true,nextSeq:1})}}):undefined}),user=userEvent.setup();await ready();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'继续核对');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(finish).toBeTypeOf('function'))
  await user.click(screen.getByRole('button',{name:'收起会话列表'}));try{
   await act(async()=>{Object.defineProperty(window,'innerWidth',{configurable:true,value:360});window.dispatchEvent(new Event('resize'))});expect(screen.queryByRole('navigation',{name:'会话列表快捷栏'})).toBeNull();expect(screen.getByRole('button',{name:'展开会话列表'}).closest('.wb-hub-context-head')).toBeTruthy();await user.click(screen.getByRole('button',{name:'展开会话列表'}));expect(document.activeElement).toBe(screen.getByRole('button',{name:'收起会话列表'}));await user.keyboard('{Escape}')
   await act(async()=>{Object.defineProperty(window,'innerWidth',{configurable:true,value:1280});window.dispatchEvent(new Event('resize'))});expect(screen.getByRole('navigation',{name:'会话列表快捷栏'})).toBeTruthy();await user.click(screen.getByRole('button',{name:'展开会话列表'}));await act(async()=>finish());await screen.findByText('折叠后原会话完整回答');expect(calls.filter(c=>c.action==='send')).toHaveLength(1);expect(calls.some(c=>['reset','newChat'].includes(c.action))).toBe(false);expect(WB.store.get().assistantConversationId).toBe('task:a')
  }finally{Object.defineProperty(window,'innerWidth',{configurable:true,value:previous})}
 })
 it('重新打开保存的报告主题从真实detail恢复参数，不依赖本地临时选择',async()=>{
  const {WB,calls}=setup({id:'office:saved',hub:(request,{value})=>request.action==='detail'?{...value,conversation:{id:'office:saved',kind:'office',title:'今日工作日报',topic:{kind:'work_report',input:{period:'day'},date:'2026-11-01'}}}:request.operation==='office.start'?{status:'ok',note:'已提交当前报告'}:undefined}),user=userEvent.setup();await ready();expect(WB.store.get().assistantOfficeTopics).toBeUndefined();expect(calls.some(request=>request.operation==='office.start')).toBe(false);await user.click(screen.getByRole('button',{name:'生成日报',exact:true}));await waitFor(()=>expect(calls.find(request=>request.operation==='office.start')).toMatchObject({conversationId:'office:saved',kind:'work_report',input:{period:'day'}}));await openMore(user);expect(screen.queryByRole('button',{name:'为当前事项新建会话'})).toBeNull()
 })
 it('旧日期完成记录折叠但失败和待确认可见，手动展开在新结果刷新后保留',async()=>{
  let fresh=false;const user=userEvent.setup(),turn=(id,at,status,reply)=>({id,at,status,reply,text:'',source:'system',origin:'office-history',recordedStatus:status,commands:[]});setup({id:'system:office',hub:(request,{value})=>request.action==='detail'?{...value,turns:[turn('old','2026-10-30T08:00:00Z','completed','旧日已完成报告'),turn('failed','2026-10-29T08:00:00Z','failed','旧日失败仍需处理'),turn('confirm','2026-10-29T09:00:00Z','waiting_approval','旧日内容等待确认'),turn('new','2026-11-01T08:00:00Z','completed','最新完成报告'),...(fresh?[turn('newest','2026-11-02T08:00:00Z','completed','后来的新结果')]:[])]}:undefined});await screen.findByText('最新完成报告');const history=screen.getByLabelText('历史记录：2026-10-30');expect(history.open).toBe(false);expect(screen.getByText('旧日失败仍需处理').closest('details')).toBeNull();expect(screen.getByText('旧日内容等待确认').closest('details')).toBeNull();await user.click(history.querySelector('summary'));expect(history.open).toBe(true);fresh=true;await user.click(screen.getByRole('button',{name:'刷新进度'}));await screen.findByText('后来的新结果');expect(screen.getByLabelText('历史记录：2026-10-30').open).toBe(true)
 })
 it('长报告与历史原文默认摘要，可完整展开且复制保持原文',async()=>{
  const full='## 本周完整报告\n'+('完整报告段落，包含实际进度与后续计划。'.repeat(50)),historical='## 历史成果\n'+('既有历史正文内容。'.repeat(100));const {WB}=setup({id:'system:office',hub:(request,{value})=>request.action==='detail'?{...value,turns:[{id:'long',at:1000,status:'completed',source:'system',origin:'office-history',recordedStatus:'completed',reply:historical,commands:[],artifacts:[{jobId:'long-job',stepId:'report',title:'完整周报',kind:'work_report',text:full,evidenceIds:[]}]}]}:undefined}),user=userEvent.setup();let copied;WB.util.copy=async text=>{copied=text};await screen.findByText('完整周报');const previews=[...document.querySelectorAll('.wb-hub-artifact-preview')];expect(previews).toHaveLength(2);expect(previews.every(node=>node.textContent.length<370&&!node.textContent.includes('##'))).toBe(true);const artifactDetails=screen.getByText('展开完整内容').closest('details'),historyDetails=screen.getByText('展开历史原文').closest('details');expect(artifactDetails.open).toBe(false);expect(historyDetails.open).toBe(false);await user.click(screen.getByText('展开完整内容'));await user.click(screen.getByText('展开历史原文'));expect(artifactDetails.open).toBe(true);expect(historyDetails.open).toBe(true);expect(artifactDetails.textContent).toContain('完整报告段落');await user.click(screen.getByRole('button',{name:'复制内容'}));expect(copied).toBe(full)
 })
 it('主题解析回包晚到时不会把用户切回旧目标或隐式生成',async()=>{
  let release;const {WB,calls}=setup({id:'task:a',hub:request=>request.action==='officeTopic'?new Promise(resolve=>{release=()=>resolve({status:'ok',conversationId:'office:late',title:'晚到日报',kind:'work_report',input:{period:'day'}})}):undefined}),user=userEvent.setup();await ready();await openReport(user,'日报');await waitFor(()=>expect(release).toBeTypeOf('function'));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'关闭',exact:true}));await user.click(screen.getByRole('button',{name:'会话：乙的工作'}));await ready();await act(async()=>release());expect(WB.store.get().assistantConversationId).toBe('task:b');expect(calls.some(request=>request.operation==='office.start')).toBe(false)
 })

 it('工作会话来源与真实工作区同时可见，默认cwd不会冒充已绑定工作区',async()=>{
  const rows=[{id:'task:a',kind:'task',title:'甲的工作',nativeBinding:{sessionId:'native-a',workspaceState:'bound',workspaceId:'workspace-a',workspaceTitle:'项目甲',cwd:'/synthetic/projects/项目甲'}},{id:'reply:r',kind:'reply',title:'客户答复',nativeBinding:{workspaceState:'unbound',cwd:'/synthetic/default'}},{id:'development:d',kind:'development',title:'缺陷修复',nativeBinding:{workspaceState:'pending',workspaceTitle:'研发工程',cwd:'/work/dev'}},{id:'radar:r',kind:'radar',title:'资讯研读',nativeBinding:{workspaceState:'unbound'}},{id:'knowledge:k',kind:'knowledge',title:'知识调整',nativeBinding:{workspaceState:'unbound'}},{id:'office:report',kind:'office',title:'工作日报',topic:{kind:'work_report'},nativeBinding:{workspaceState:'unbound'}},{id:'chat:plain',kind:'chat',title:'普通工作问答',nativeBinding:{workspaceState:'unbound'}}]
  setup({id:'task:a',hub:(request,{value})=>request.action==='list'?{...value,conversations:[...fixed,...rows]}:request.action==='detail'?{...value,nativeBinding:rows[0].nativeBinding,sessionId:'native-a',threads:[{id:'native-a',title:'甲的原会话',role:'primary'}]}:undefined});await ready();expect(screen.getByLabelText('会话来源').textContent).toBe('待办');const sidebar=screen.getByRole('navigation',{name:'助手会话列表'});for(const [title,kind] of [['甲的工作','待办'],['客户答复','待回复'],['缺陷修复','研发'],['资讯研读','资讯'],['知识调整','知识'],['工作日报','报告'],['普通工作问答','普通对话']]){const row=within(sidebar).getByRole('button',{name:'会话：'+title}),badge=within(row).getByRole('img',{name:'会话类型：'+kind});expect(badge.title).toBe(kind);expect(badge.querySelector('svg')).toBeTruthy();expect(badge.textContent).toBe('')};expect(within(sidebar).getByRole('button',{name:'会话：客户答复'}).textContent).toContain('无工作区');expect(within(sidebar).getByLabelText('工作区：项目甲').title).toContain('/synthetic/projects/项目甲');expect(screen.queryByRole('region',{name:'会话与工作区'})).toBeNull();expect(screen.queryByText('当前 Harness 会话')).toBeNull()
 })
 it.each([{workspaceState:'unbound',cwd:'/default/path',label:'无工作区',tooltip:'未绑定'},{workspaceState:'pending',workspaceTitle:'准备中的工程',cwd:'/work/pending',label:'待绑定 · 准备中的工程',tooltip:'/work/pending'},{workspaceState:'unavailable',workspaceError:'工程目录已经移动',label:'工作区不可用',tooltip:'工程目录已经移动'}])('工作区状态$workspaceState准确展示，不自动修复或新建',async(binding)=>{
  const {calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,nativeBinding:binding}:request.action==='list'?{...value,conversations:value.conversations.map(row=>row.id==='task:a'?{...row,nativeBinding:binding}:row)}:undefined});await ready();const sidebar=screen.getByRole('navigation',{name:'助手会话列表'}),badge=within(sidebar).getByLabelText('工作区：'+binding.label);expect(badge.title).toContain(binding.tooltip);expect(screen.queryByRole('region',{name:'会话与工作区'})).toBeNull();expect(calls.every(request=>['list','detail'].includes(request.action))).toBe(true)
 })
 it('去掉原生会话信息和跳转图标后，发送仍沿用原会话ID',async()=>{
  const {WB,calls}=setup({id:'chat:original-native',hub:(request,{value})=>request.action==='detail'?{...value,sessionId:'original-native',nativeBinding:{sessionId:'original-native',workspaceState:'bound',workspaceTitle:'当前工程',workspaceId:'w'},threads:[{id:'original-native',title:'已有普通对话'}]}:undefined}),user=userEvent.setup(),navigation=[];WB.openSessionById=id=>{navigation.push(['session',id]);return true};WB.openConversation=()=>{navigation.push(['panel']);return true};await ready();expect(screen.queryByRole('button',{name:'在 Harness 中打开当前会话'})).toBeNull();expect(screen.queryByText('当前 Harness 会话')).toBeNull();expect(navigation).toEqual([]);expect(calls.some(request=>request.action==='reset')).toBe(false);await user.type(screen.getByRole('textbox',{name:'助手消息'}),'接着原来的问题讨论');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(calls.find(request=>request.action==='send')).toMatchObject({conversationId:'chat:original-native',sessionId:'original-native'}))
 })
 it('选择历史、切换事项和重开后继续发送仍使用所选真实会话，打开不reset',async()=>{
  let selected='native-current';const {WB,calls}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='select'){selected=request.sessionId;return {...value,sessionId:selected}}
   if(request.action==='detail'&&request.conversationId==='task:a')return {...value,sessionId:selected,nativeBinding:{sessionId:selected,canSend:true,workspaceState:'bound',workspaceTitle:'事项工程',workspaceId:'work'},threads:[{id:'native-current',title:'近期讨论',role:'primary'},{id:'native-history',title:'以前的讨论',role:'history'}]}
  }}),user=userEvent.setup();await ready();expect(document.querySelector('.wb-hub-more').open).toBe(false);await openMore(user);const selector=screen.getByRole('combobox',{name:'事项历史会话'});expect(selector.closest('.wb-hub-more')).not.toBeNull();await user.selectOptions(selector,'native-history');await ready();await user.click(screen.getByRole('button',{name:'会话：乙的工作'}));await ready();await user.click(screen.getByRole('button',{name:'会话：甲的工作'}));await ready();await openMore(user);expect(screen.getByRole('combobox',{name:'事项历史会话'}).value).toBe('native-history');await leaveAssistant(user);await act(async()=>WB.assistant.openHub('task','a'));await ready();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'继续以前的讨论');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(calls.find(request=>request.action==='send')).toMatchObject({conversationId:'task:a',sessionId:'native-history'}));expect(calls.some(request=>request.action==='reset')).toBe(false);expect(calls.filter(request=>request.action==='select')).toHaveLength(1)
 })
 it('只读审查会话保留草稿并说明原因，切回主会话后明确发送',async()=>{
  let selected='review-native';const {calls}=setup({id:'development:d',hub:(request,{value})=>{
   if(request.action==='select'){selected=request.sessionId;return {...value,sessionId:selected}}
   if(request.action==='detail')return {...value,conversation:{id:'development:d',kind:'development',title:'修复采购缺陷'},sessionId:selected,nativeBinding:{sessionId:selected,primarySessionId:'main-native',workspaceState:'bound',workspaceTitle:'ERP',workspaceId:'erp',canSend:selected==='main-native',reason:selected==='review-native'?'当前是只读审查记录，请切回开发主会话继续。':undefined},threads:[{id:'main-native',role:'development-main',title:'开发主记录'},{id:'review-native',role:'development-review',title:'审查记录',readOnly:true}]}
  }}),user=userEvent.setup();await ready();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'保持这段补充要求');expect(screen.getByRole('button',{name:'发送'}).disabled).toBe(true);expect(screen.getByText('当前是只读审查记录，请切回开发主会话继续。')).toBeTruthy();await user.keyboard('{Enter}');expect(calls.some(request=>request.action==='send')).toBe(false);await user.click(screen.getByRole('button',{name:'切回主会话'}));await ready();expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('保持这段补充要求');expect(screen.getByRole('button',{name:'发送'}).disabled).toBe(false);await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(calls.find(request=>request.action==='send')).toMatchObject({conversationId:'development:d',sessionId:'main-native'}));expect(calls.some(request=>request.action==='reset')).toBe(false)
 })

 it('研发工程尚未准备时明确未绑定原生会话，不暗示发送即创建',async()=>{
  const {calls}=setup({id:'development:unprepared',hub:(request,{value})=>request.action==='detail'?{...value,conversation:{id:'development:unprepared',kind:'development',title:'尚未准备的研发事项'},nativeBinding:{sessionId:null,canSend:false,workspaceState:'unbound',reason:'请先在研发任务中确认工程'}}:undefined});await ready();expect(screen.queryByRole('region',{name:'会话与工作区'})).toBeNull();expect(screen.queryByText('首次发送后创建会话')).toBeNull();expect(screen.getByRole('button',{name:'发送'}).disabled).toBe(true);expect(screen.getByText('请先在研发任务中确认工程')).toBeTruthy();expect(calls.some(request=>request.action==='reset')).toBe(false)
 })
 it('固定能力不重复显示来源与无工作区提示，已有原生历史仍可选择',async()=>{
  setup({id:'system:analysis',hub:(request,{value})=>request.action==='detail'?{...value,sessionId:'system-native',nativeBinding:{sessionId:'system-native',workspaceState:'unbound'},threads:[{id:'system-native',title:'识别讨论'},{id:'system-older',title:'旧识别讨论'}]}:undefined});const user=userEvent.setup();await ready();expect(screen.queryByLabelText('会话来源')).toBeNull();expect(screen.queryByRole('region',{name:'会话与工作区'})).toBeNull();await openMore(user);expect(screen.getByRole('combobox',{name:'事项历史会话'}).closest('.wb-hub-more')).not.toBeNull()
 })

})

describe('助手聊天身份与附件',()=>{
 it('手写消息显示本人头像并靠右，规则和AI回复保留各自身份',async()=>{
  const profile=vi.fn(async()=>({ok:true,value:{status:'ready',value:{name:'林同学',avatarUrl:'https://example.test/avatar.png'}}}))
  setup({id:'task:a',services:{'remote.account':{getProfile:profile}},patchFixture:fixture=>{fixture.settings.assistantName='小鲸'},hub:(request,{value})=>request.action==='detail'?{...value,turns:[{id:'manual',text:'把事项标记进行中',at:1000,source:'rule',trigger:'manual',status:'completed',reply:'已标记进行中',commands:[{operation:'task.update',label:'更新待办状态'}]},{id:'ai',text:'继续分析方案',at:2000,source:'ai',trigger:'manual',status:'completed',reply:'这里是详细方案',commands:[]}]}:undefined})
  await screen.findByText('这里是详细方案');await waitFor(()=>expect(document.querySelector('[data-chat-author="user"] img')?.getAttribute('src')).toBe('https://example.test/avatar.png'))
  expect(profile).toHaveBeenCalledTimes(1);const user=screen.getByText('把事项标记进行中').closest('[data-chat-author]');expect(user.classList.contains('is-outgoing')).toBe(true);expect(user.textContent).toContain('林同学');expect(screen.getByText('已标记进行中').closest('[data-chat-author]').getAttribute('data-chat-author')).toBe('rule');expect(screen.getByText('这里是详细方案').closest('[data-chat-author]').textContent).toContain('小鲸');expect(screen.getByLabelText('识别来源：规则')).toBeTruthy()
  fireEvent.error(user.querySelector('img'));expect(user.querySelector('img')).toBeNull();expect(user.querySelector('.wb-hub-avatar').textContent).toBe('林')
 })
 it('操作触发、系统提交及失败不会冒充本人，AI后台结果仍显示助手身份',async()=>{
  setup({hub:(request,{value})=>request.action==='detail'?{...value,turns:[{id:'operation',text:'获取最新并识别',trigger:'operation',at:1000,source:'rule',status:'completed',reply:'已开始识别',commands:[{operation:'analysis.fetch',label:'获取最新消息'}]},{id:'system-turn',text:'定时刷新消息',trigger:'system',source:'ai',at:2000,status:'completed',reply:'已检查最新消息',commands:[]}],background:{messages:[{sessionId:'s',seq:1,role:'user',text:'后台提交内容',at:3000},{sessionId:'s',seq:2,role:'assistant',text:'后台返回内容',at:4000},{sessionId:'s',seq:3,role:'error',text:'后台来源不可读',at:5000}],errors:[]}}:undefined})
  await screen.findByText('后台返回内容');for(const text of ['获取最新并识别','定时刷新消息','后台提交内容','后台来源不可读']){const row=screen.getByText(text,{selector:'.wb-hub-markdown div'}).closest('[data-chat-author]');expect(row.getAttribute('data-chat-author')).toBe('function');expect(row.textContent).toContain('消息识别');expect(row.classList.contains('is-incoming')).toBe(true)}expect(screen.getByText('后台返回内容').closest('[data-chat-author]').getAttribute('data-chat-author')).toBe('assistant');expect(document.querySelector('[data-chat-author="user"]')).toBeNull()
 })
 it('助手设置保存名称立即用于AI回复，取消不改名称且规则身份不变',async()=>{
  const {settingsPatches}=setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,turns:[{id:'r',source:'rule',at:1000,status:'completed',reply:'规则处理结果'},{id:'a',source:'ai',at:2000,status:'completed',reply:'AI处理结果'}]}:undefined}),user=userEvent.setup();await ready();await openMore(user);await user.click(screen.getByRole('button',{name:'助手设置'}));await user.clear(screen.getByRole('textbox',{name:'助手名称'}));await user.type(screen.getByRole('textbox',{name:'助手名称'}),'小鲸助手');await user.click(screen.getByRole('button',{name:'保存',exact:true}));await waitFor(()=>expect(screen.getByText('AI处理结果').closest('[data-chat-author]').textContent).toContain('小鲸助手'));expect(settingsPatches).toEqual([{assistantName:'小鲸助手'}]);expect(screen.getByText('规则处理结果').closest('[data-chat-author]').textContent).toContain('规则助手')
  await openMore(user);await user.click(screen.getByRole('button',{name:'助手设置'}));await user.clear(screen.getByRole('textbox',{name:'助手名称'}));await user.type(screen.getByRole('textbox',{name:'助手名称'}),'取消的名字');await user.click(screen.getByRole('button',{name:'取消',exact:true}));expect(settingsPatches).toHaveLength(1);expect(screen.getByText('AI处理结果').closest('[data-chat-author]').textContent).toContain('小鲸助手')
 })
 it('纯图片发送复用原会话，选取不准备会话，接收后清除草稿并在历史保留附件卡',async()=>{
  const {calls,WB}=setup({id:'task:a',hub:(request,{value,entries})=>{
   if(request.action==='detail')return {...value,sessionId:'original-native',nativeBinding:{sessionId:'original-native',canSend:true}}
   if(request.action==='prepareAttachments')return {status:'ok',sessionId:'original-native'}
   if(request.action==='send'){entries['task:a']=[{role:'user',text:'',attachments:request.attachments.map(({data,receiptId,file,...safe})=>safe)},{role:'assistant',text:'附件已分析'}];return {status:'ok',handled:true}}
  }}),user=userEvent.setup();await ready();await user.upload(screen.getByLabelText('选择助手附件'),new File(['picture'],'需求截图.png',{type:'image/png'}));expect(screen.getByRole('region',{name:'本轮附件'})).toBeTruthy();expect(calls.some(request=>['prepareAttachments','send','reset'].includes(request.action))).toBe(false);expect(screen.getByRole('button',{name:'发送'}).disabled).toBe(false)
  await user.click(screen.getByRole('button',{name:'发送'}));await screen.findByText('附件已分析');expect(calls.find(request=>request.action==='prepareAttachments')).toMatchObject({conversationId:'task:a',sessionId:'original-native'});expect(calls.find(request=>request.action==='send')).toMatchObject({conversationId:'task:a',sessionId:'original-native',text:'',attachments:[{type:'image',name:'需求截图.png',data:'cGljdHVyZQ=='}]});expect(screen.queryByRole('region',{name:'本轮附件'})).toBeNull();expect(screen.getByLabelText('消息附件').textContent).toContain('需求截图.png');expect(JSON.stringify(WB.store.get().assistantHubClientTurns)).not.toContain('cGljdHVyZQ==');expect(calls.some(request=>request.action==='reset')).toBe(false)
 })
 it('文件上传失败保留文字和附件，只重试明确提交且仍使用原会话',async()=>{
  let fail=true;const upload=vi.fn(async(session,file,name)=>{if(fail)throw Error('上传暂时失败');return {ok:true,value:{receiptId:'receipt-one',file:{attachmentId:'uploaded-one',name,bytes:file.size}}}})
  const {calls}=setup({id:'task:a',services:{fileUpload:{upload}},hub:(request,{value})=>request.action==='detail'?{...value,sessionId:'original-native'}:request.action==='prepareAttachments'?{status:'ok',sessionId:'original-native'}:undefined}),user=userEvent.setup();await ready();await user.upload(screen.getByLabelText('选择助手附件'),new File(['report'],'说明.txt',{type:'text/plain'}));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'请处理这份说明');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('请处理这份说明'));expect(screen.getByRole('region',{name:'本轮附件'}).textContent).toContain('上传暂时失败');expect(calls.some(request=>request.action==='send')).toBe(false)
  fail=false;await user.click(screen.getByRole('button',{name:'检查并重试提交'}));await screen.findByText('继续处理已登记',{selector:'.wb-hub-markdown div'});expect(upload).toHaveBeenCalledTimes(2);expect(upload.mock.calls.every(([session])=>session==='original-native')).toBe(true);expect(calls.find(request=>request.action==='send')).toMatchObject({sessionId:'original-native',attachments:[{type:'file',name:'说明.txt',receiptId:'receipt-one',file:{attachmentId:'uploaded-one'}}]});expect(screen.queryByRole('region',{name:'本轮附件'})).toBeNull()
 })
 it('准备附件时切换事项不会向旧会话发送，返回保留附件和文字',async()=>{
  let release;const {calls}=setup({id:'task:a',hub:request=>request.action==='prepareAttachments'?new Promise(resolve=>{release=resolve}):undefined}),user=userEvent.setup();await ready();await user.upload(screen.getByLabelText('选择助手附件'),new File(['one'],'原会话.png',{type:'image/png'}));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'保留这段要求');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(release).toBeTypeOf('function'));await user.click(screen.getByRole('button',{name:'会话：乙的工作'}));await ready();expect(screen.queryByRole('region',{name:'本轮附件'})).toBeNull();await act(async()=>release({status:'ok',sessionId:'native-a'}));expect(calls.some(request=>request.action==='send')).toBe(false);await user.click(screen.getByRole('button',{name:'会话：甲的工作'}));await ready();expect(screen.getByRole('region',{name:'本轮附件'}).textContent).toContain('原会话.png');expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('保留这段要求');expect(screen.getAllByText('已切换会话，本条消息尚未发送。附件与文字已保留，可回到原会话继续。').length).toBeGreaterThan(0)
 })
 it('添加资料菜单可引用事项，关闭和重开保留手写草稿',async()=>{
  setup({id:'task:a'});const user=userEvent.setup();await ready();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'保留输入');await user.click(screen.getByRole('button',{name:'添加资料'}));expect(screen.getByRole('menu',{name:'添加资料方式'})).toBeTruthy();await user.click(screen.getByRole('menuitem',{name:/引用事项/}));expect(screen.getByRole('dialog')).toBeTruthy();expect(screen.getByRole('textbox',{name:'搜索上下文'})).toBeTruthy();await user.click(screen.getByRole('button',{name:'取消',exact:true}));expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('保留输入');expect(screen.getByRole('button',{name:'添加资料'})).toBe(document.activeElement)
 })
})

describe('附件提交边界',()=>{
 it('附件回执未确认时再次发送同一内容复用请求ID，不创建重复请求',async()=>{
  let attempt=0;const {calls}=setup({id:'task:a',hub:request=>{
   if(request.action==='prepareAttachments')return {status:'ok',sessionId:'same-native'}
   if(request.action==='send'&&++attempt===1)throw Error('连接断开，未取得回执')
  }}),user=userEvent.setup();await ready();await user.upload(screen.getByLabelText('选择助手附件'),new File(['one'],'测试.png',{type:'image/png'}));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'检查图片');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('检查图片'));await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(calls.filter(request=>request.action==='send')).toHaveLength(2));const sends=calls.filter(request=>request.action==='send');expect(sends[0].requestId).toBe(sends[1].requestId);expect(sends[0].attachments[0].id).toBe(sends[1].attachments[0].id)
 })
 it('上传在切换事项之后失败仍保存旧会话正文，当前会话不会收到错误或附件',async()=>{
  let rejectUpload;const {calls}=setup({id:'task:a',services:{fileUpload:{upload:()=>new Promise((_,reject)=>{rejectUpload=reject})}},hub:request=>request.action==='prepareAttachments'?{status:'ok',sessionId:'old-native'}:undefined}),user=userEvent.setup();await ready();await user.upload(screen.getByLabelText('选择助手附件'),new File(['content'],'旧资料.txt',{type:'text/plain'}));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'旧会话的要求');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(rejectUpload).toBeTypeOf('function'));await user.click(screen.getByRole('button',{name:'会话：乙的工作'}));await ready();await act(async()=>rejectUpload(Error('上传网络中断')));expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('');expect(screen.queryByRole('region',{name:'本轮附件'})).toBeNull();expect(screen.queryByText('上传网络中断')).toBeNull();await user.click(screen.getByRole('button',{name:'会话：甲的工作'}));await ready();expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('旧会话的要求');expect(screen.getByRole('region',{name:'本轮附件'}).textContent).toContain('旧资料.txt');expect(calls.some(request=>request.action==='send')).toBe(false)
 })
 it('同一事项切换历史时正文和附件分别保留，切回主会话不串入历史草稿',async()=>{
  let selected='main';setup({id:'task:a',hub:(request,{value})=>{if(request.action==='select'){selected=request.sessionId;return {...value,sessionId:selected}}if(request.action==='detail')return {...value,sessionId:selected,nativeBinding:{sessionId:selected,canSend:true},threads:[{id:'main',title:'主会话'},{id:'old',title:'历史会话'}]}}});const user=userEvent.setup();await ready();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'主会话未发正文');await user.upload(screen.getByLabelText('选择助手附件'),new File(['main'],'主会话图片.png',{type:'image/png'}));await openMore(user);await user.selectOptions(screen.getByRole('combobox',{name:'事项历史会话'}),'old');await ready();expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('');await user.type(screen.getByRole('textbox',{name:'助手消息'}),'历史未发正文');await user.upload(screen.getByLabelText('选择助手附件'),new File(['old'],'历史图片.png',{type:'image/png'}));await openMore(user);await user.selectOptions(screen.getByRole('combobox',{name:'事项历史会话'}),'main');await ready();expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('主会话未发正文');expect(screen.getByRole('region',{name:'本轮附件'}).textContent).toContain('主会话图片.png');expect(screen.getByRole('region',{name:'本轮附件'}).textContent).not.toContain('历史图片.png');await openMore(user);await user.selectOptions(screen.getByRole('combobox',{name:'事项历史会话'}),'old');await ready();expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('历史未发正文');expect(screen.getByRole('region',{name:'本轮附件'}).textContent).toContain('历史图片.png')
 })
})

 it('后台先出现待接收轮次不会清丢重试关联，真实userSeq晚到后才清附件',async()=>{
  let phase=0,submitted;const {calls,WB}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='prepareAttachments')return {status:'ok',sessionId:'same-native'}
   if(request.action==='send'){submitted=request;throw Error('未取得回执')}
   if(request.action==='detail'&&phase)return {...value,turns:[{id:'server-turn',requestId:submitted.requestId,source:'ai',trigger:'manual',text:submitted.text,at:1000,status:phase===1?'recognizing':'completed',reply:phase===1?'等待接收':'已收到附件',...(phase===2?{userSeq:7}:{}),attachments:submitted.attachments.map(({data,...safe})=>safe)}]}
  }}),user=userEvent.setup();await ready();await user.upload(screen.getByLabelText('选择助手附件'),new File(['one'],'晚到.png',{type:'image/png'}));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'请检查');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('请检查'));phase=1;await user.click(screen.getByRole('button',{name:'刷新进度'}));await ready();expect(Object.values(WB.store.get().assistantHubClientTurns).flat().some(turn=>turn.requestId===submitted.requestId&&turn.retryRequest)).toBe(true);expect(screen.getByRole('region',{name:'本轮附件'})).toBeTruthy();phase=2;await user.click(screen.getByRole('button',{name:'刷新进度'}));await waitFor(()=>expect(screen.queryByRole('region',{name:'本轮附件'})).toBeNull());expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('');expect(calls.filter(request=>request.action==='send')).toHaveLength(1)
 })

 it('纯附件默认理解提示不冒充用户发言，宿主明确未接收时保留草稿直到接收确认',async()=>{
  let turn;const {WB,calls}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='prepareAttachments')return {status:'ok',sessionId:'same-native'}
   if(request.action==='send'){turn={id:'attachment-only',requestId:request.requestId,text:'请识别并概括本条消息中的附件，并根据附件内容继续处理。',attachmentOnly:true,source:'ai',trigger:'manual',status:'recognizing',at:1000,attachments:request.attachments.map(({data,...safe})=>safe)};return {status:'ok',accepted:false,handled:true,turn}}
   if(request.action==='detail'&&turn)return {...value,messages:[],turns:[turn]}
  }}),user=userEvent.setup();await ready();await user.upload(screen.getByLabelText('选择助手附件'),new File(['image'],'仅附件.png',{type:'image/png'}));await user.click(screen.getByRole('button',{name:'发送'}));await ready();expect(screen.queryByText('请识别并概括本条消息中的附件，并根据附件内容继续处理。')).toBeNull();expect(screen.getByRole('region',{name:'本轮附件'})).toBeTruthy();expect(Object.values(WB.store.get().assistantHubClientTurns).flat().some(row=>row.retryRequest?.requestId===turn.requestId)).toBe(true);await user.click(screen.getByRole('button',{name:'刷新进度'}));await ready();await user.click(screen.getByRole('button',{name:'发送'}));await ready();await user.click(screen.getByRole('button',{name:'发送'}));await ready();expect(calls.filter(row=>row.action==='send')).toHaveLength(3);expect(new Set(calls.filter(row=>row.action==='send').map(row=>row.requestId)).size).toBe(1);turn={...turn,attachmentAccepted:true,status:'completed',reply:'附件已收到'};await user.click(screen.getByRole('button',{name:'刷新进度'}));await waitFor(()=>expect(screen.queryByRole('region',{name:'本轮附件'})).toBeNull());expect(screen.getByLabelText('消息附件').textContent).toContain('仅附件.png')
 })

 it('助手名称保存失败保留输入，超长名称不提交，取消不改变已保存名称',async()=>{
  const {WB,settingsPatches}=setup({id:'task:a',settingsFailure:'设置暂不可保存',patchFixture:fixture=>{fixture.settings.assistantName='现有助手'}}),user=userEvent.setup();await ready();await openMore(user);await user.click(screen.getByRole('button',{name:'助手设置'}));const dialog=screen.getByRole('dialog',{name:'助手设置'}),input=within(dialog).getByRole('textbox',{name:'助手名称'});fireEvent.change(input,{target:{value:'新的助手'}});await user.click(within(dialog).getByRole('button',{name:'保存',exact:true}));await waitFor(()=>expect(within(dialog).getByRole('alert').textContent).toBe('设置暂不可保存'));expect(input.value).toBe('新的助手');expect(WB.store.get().data.settings.assistantName).toBe('现有助手');fireEvent.change(input,{target:{value:'鲸'.repeat(41)}});expect(within(dialog).getByRole('button',{name:'保存',exact:true}).disabled).toBe(true);await user.click(within(dialog).getByRole('button',{name:'取消',exact:true}));expect(settingsPatches).toHaveLength(0);expect(WB.store.get().data.settings.assistantName).toBe('现有助手')
 })

 it('模型明确拒绝附件的轮次保留原请求，切换模型后的继续提交仍沿用原ID',async()=>{
  let turn,attempt=0;const {calls}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='prepareAttachments')return {status:'ok',sessionId:'same-native'}
   if(request.action==='detail'&&turn)return {...value,messages:[],turns:[turn]}
   if(request.action==='send'){turn={id:'same-turn',requestId:request.requestId,text:request.text,source:'ai',trigger:'manual',at:1000,attachments:request.attachments.map(({data,...safe})=>safe),status:++attempt===1?'failed':'completed',reply:attempt===1?'当前模型不支持图片':'附件已接收',...(attempt===1?{attachmentRetryable:true}:{attachmentAccepted:true})};return attempt===1?{status:'error',note:turn.reply,turn}:{status:'ok',accepted:true,handled:true,turn}}
  }}),user=userEvent.setup();await ready();await user.upload(screen.getByLabelText('选择助手附件'),new File(['one'],'换模型.png',{type:'image/png'}));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'请读图');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('请读图'));await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(screen.queryByRole('region',{name:'本轮附件'})).toBeNull());const sends=calls.filter(row=>row.action==='send');expect(sends).toHaveLength(2);expect(sends[0].requestId).toBe(sends[1].requestId);expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('')
 })

 it('后台已确认接收后原发送才断开，不恢复已经发送的正文和附件',async()=>{
  let rejectSend,submitted,admitted=false;const {WB}=setup({id:'task:a',hub:(request,{value})=>{
   if(request.action==='prepareAttachments')return {status:'ok',sessionId:'same-native'}
   if(request.action==='send'){submitted=request;return new Promise((_,reject)=>{rejectSend=reject})}
   if(request.action==='detail'&&admitted)return {...value,messages:[],turns:[{id:'admitted',requestId:submitted.requestId,text:submitted.text,source:'ai',trigger:'manual',at:1000,status:'executing',attachmentAccepted:true,attachments:submitted.attachments.map(({data,...safe})=>safe)}]}
  }}),user=userEvent.setup();await ready();await user.upload(screen.getByLabelText('选择助手附件'),new File(['one'],'确认过.png',{type:'image/png'}));await user.type(screen.getByRole('textbox',{name:'助手消息'}),'已经接收的正文');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(rejectSend).toBeTypeOf('function'));admitted=true;await waitFor(()=>expect(screen.queryByRole('region',{name:'本轮附件'})).toBeNull(),{timeout:4000});await act(async()=>rejectSend(Error('原回执连接断开')));await ready();expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('');expect(screen.queryByRole('region',{name:'本轮附件'})).toBeNull();expect(Object.values(WB.store.get().assistantHubClientTurns||{}).flat().some(turn=>turn.retryRequest)).toBe(false)
 },6000)

it('研发会话区分 Linky 业务状态和本地执行状态，业务完成不冒充测试通过',async()=>{
 setup({id:'development:synthetic-dev',hub:(request,{value})=>['detail','select'].includes(request.action)?{...value,conversation:{id:'development:synthetic-dev',kind:'development',entityId:'synthetic-dev',title:'US-FIXTURE · 需求验收'},entity:{id:'synthetic-dev',status:'paused',stage:'test',issue:{title:'需求验收',status:'发布完成',description:'平台业务状态已变更，测试仍需核验。'}}}:undefined});await ready();expect(screen.getByText('Linky：发布完成 · 执行：已暂停')).toBeTruthy()
})

it('完成意图在原研发会话展示真实状态，选择后修改并回读，执行失败证据仍保留',async()=>{
 const at=new Date().toISOString();let businessStatus='待处理',savedEvents=[]
 const targets=[{key:'written',name:'需求编写完成',allowed:true,form:{fields:[],comment_mode:'optional'}},{key:'reviewed',name:'需求评审完成',allowed:true,form:{comment_mode:'required',fields:[{column_key:'reviewer',name:'评审人员',supported:true,required:true}]}}]
 const {calls}=setup({id:'development:synthetic-dev',hub:(request,{value})=>{
  if(['detail','select'].includes(request.action))return {...value,conversation:{id:'development:synthetic-dev',kind:'development',title:'US-FIXTURE · 需求验收'},sessionId:'main-session',nativeBinding:{sessionId:'main-session',primarySessionId:'main-session',canSend:true},entity:{id:'synthetic-dev',status:'paused',stage:'test',pauseReason:'测试失败，退出码 1',issue:{title:'需求验收',status:businessStatus}},messages:[],turns:[],events:savedEvents}
  if(request.action==='send'){savedEvents=[{id:'choices',at,operation:'development.issue.get',text:'请从下方选择具体流程状态；本次尚未修改。',result:{statusChoices:{current:businessStatus,targets}}}];return {status:'ok',handled:true,note:'可用状态已查询'}}
  if(request.action==='operate'&&request.operation==='development.issue.update'){businessStatus=targets.find(target=>target.key===request.patch.status).name;savedEvents.push({id:'updated',at:new Date().toISOString(),operation:request.operation,text:'已修改并回读 Linky：'+businessStatus});return {status:'ok',note:'已修改并回读 Linky：'+businessStatus}}
 }}),user=userEvent.setup();await ready();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'状态标记为完成');await user.click(screen.getByRole('button',{name:'发送'}));await screen.findByRole('region',{name:'Linky 可用状态'})
 expect(calls.filter(request=>request.operation==='development.issue.update')).toHaveLength(0)
 await user.click(screen.getByRole('button',{name:'需求编写完成',exact:true}));await user.click(screen.getByRole('button',{name:'修改为需求编写完成'}))
 await screen.findByText('Linky：需求编写完成 · 执行：已暂停');expect(calls.find(request=>request.operation==='development.issue.update')).toMatchObject({conversationId:'development:synthetic-dev',sessionId:'main-session',patch:{status:'written'}});expect(calls.some(request=>request.action==='reset')).toBe(false)
 await user.click(screen.getByRole('button',{name:'需求评审完成',exact:true}));expect(screen.getByRole('button',{name:'修改为需求评审完成'}).disabled).toBe(true)
 await user.type(screen.getByLabelText('评审人员（必填）'),'明确指定的评审人');expect(screen.getByRole('button',{name:'修改为需求评审完成'}).disabled).toBe(true)
 await user.type(screen.getByLabelText('流转说明（必填）'),'用户明确提供的评审说明');await user.click(screen.getByRole('button',{name:'修改为需求评审完成'}))
 await screen.findByText('Linky：需求评审完成 · 执行：已暂停');expect(calls.filter(request=>request.operation==='development.issue.update').at(-1)).toMatchObject({patch:{status:'reviewed'},fields:{reviewer:'明确指定的评审人'},comment:'用户明确提供的评审说明'})
})

function deletionFixture(options={}){
 let seeded=false
 const temporary={id:'chat:temporary',kind:'chat',title:'临时讨论',canDelete:true,nativeBinding:{workspaceState:'unbound'}}
 return setup({id:options.id||temporary.id,hub:(request,context)=>{
  const {conversations,value}=context
  if(!seeded){seeded=true;conversations.push(temporary,{id:'chat:project',kind:'chat',title:'工程对话',canDelete:false,nativeBinding:{workspaceState:'bound',workspaceTitle:'工程'}},{id:'chat:unknown',kind:'chat',title:'归属待确认',canDelete:false,nativeBinding:{workspaceState:'unavailable'}})}
  const override=options.hub?.(request,context);if(override!==undefined)return override
  if(request.action==='delete'){
   if(options.failure)return {status:'error',note:options.failure}
   conversations.splice(conversations.findIndex(row=>row.id===request.conversationId),1)
   return {status:'ok',conversationId:request.conversationId,archived:true}
  }
  return value
 }})
}
describe('只有临时会话支持确认后删除',()=>{
 it('系统、事项、工程和归属未知会话无删除入口，取消确认不提交删除',async()=>{
  const {calls}=deletionFixture(),user=userEvent.setup();await ready()
  expect(screen.getAllByRole('button',{name:/删除临时会话：/})).toHaveLength(1)
  await user.click(screen.getByRole('button',{name:'删除临时会话：临时讨论'}))
  const dialog=screen.getByRole('dialog',{name:'删除临时会话'});expect(dialog.textContent).toContain('已归档会话')
  expect(calls.some(request=>request.action==='delete')).toBe(false)
  await user.click(within(dialog).getByRole('button',{name:'取消'}));expect(screen.queryByRole('dialog',{name:'删除临时会话'})).toBeNull()
  expect(calls.some(request=>request.action==='delete')).toBe(false);expect(screen.getByRole('button',{name:'会话：临时讨论'})).toBeTruthy()
 })
 it('确认成功移除当前临时会话并回到固定入口，不新建原生会话',async()=>{
  const {WB,calls}=deletionFixture(),user=userEvent.setup();await ready();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'临时草稿')
  await user.click(screen.getByRole('button',{name:'删除临时会话：临时讨论'}));await user.click(within(screen.getByRole('dialog',{name:'删除临时会话'})).getByRole('button',{name:'确认删除'}))
  await waitFor(()=>expect(screen.queryByRole('button',{name:'会话：临时讨论'})).toBeNull())
  expect(WB.store.get().assistantConversationId).toBe('system:analysis');expect(calls.filter(request=>request.action==='delete')).toMatchObject([{conversationId:'chat:temporary',confirmed:true}])
  expect(calls.some(request=>request.action==='reset'||request.action==='send')).toBe(false)
 })
 it('删除失败保留列表、当前会话和未发送草稿，显示真实错误',async()=>{
  const {WB}=deletionFixture({failure:'会话已绑定研发任务，不能删除'}),user=userEvent.setup();await ready();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'需要保留的草稿')
  await user.click(screen.getByRole('button',{name:'删除临时会话：临时讨论'}));await user.click(within(screen.getByRole('dialog',{name:'删除临时会话'})).getByRole('button',{name:'确认删除'}))
  expect((await screen.findByRole('alert')).textContent).toContain('不能删除');expect(WB.store.get().assistantConversationId).toBe('chat:temporary')
  await user.click(within(screen.getByRole('dialog',{name:'删除临时会话'})).getByRole('button',{name:'取消'}));expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('需要保留的草稿');expect(screen.getByRole('button',{name:'会话：临时讨论'})).toBeTruthy()
 })
 it('删除非当前临时会话不影响事项草稿，删除前的迟到列表不能带回旧会话',async()=>{
  let release,requested=false;const {WB}=deletionFixture({id:'task:a',hub:(request,{conversations})=>{
   if(request.action==='list'&&request.query==='临时'&&!requested){requested=true;const old=conversations.map(row=>({...row}));return new Promise(resolve=>{release=()=>resolve({status:'ok',conversations:old})})}
  }}),user=userEvent.setup();await ready();await user.type(screen.getByRole('textbox',{name:'助手消息'}),'事项草稿不丢')
  await user.type(screen.getByRole('textbox',{name:'搜索会话或事项'}),'临时');await waitFor(()=>expect(requested).toBe(true))
  await user.click(screen.getByRole('button',{name:'删除临时会话：临时讨论'}));await user.click(within(screen.getByRole('dialog',{name:'删除临时会话'})).getByRole('button',{name:'确认删除'}))
  await waitFor(()=>expect(screen.queryByRole('button',{name:'会话：临时讨论'})).toBeNull());await act(async()=>release())
  expect(screen.queryByRole('button',{name:'会话：临时讨论'})).toBeNull();expect(WB.store.get().assistantConversationId).toBe('task:a');expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('事项草稿不丢')
 })
})

describe('停止当前会话',()=>{
 it('上一轮发送完成后，新建会话的加载过程不显示停止',async()=>{
  let release
  setup({id:'task:a',hub:request=>request.action==='reset'?new Promise(resolve=>release=resolve):undefined});await ready()
  fireEvent.change(screen.getByRole('textbox',{name:'助手消息'}),{target:{value:'已完成的问题'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));await screen.findByText('继续处理已登记');await waitFor(()=>expect(screen.getByRole('button',{name:'发送'}).disabled).toBe(true));expect(screen.queryByRole('button',{name:'停止当前会话'})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'新建对话'}));await waitFor(()=>expect(release).toBeTypeOf('function'));expect(screen.queryByRole('button',{name:'停止当前会话'})).toBeNull();await act(async()=>release({status:'ok',conversationId:'chat:new',sessionId:'native-new'}))
 })

 it.each(['idle','queued','paused','completed','failed'])('状态为 %s 时不显示停止，即使存在旧待处理记录',async status=>{
  setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,stop:{available:true,running:false,supported:true,token:'old-pending'},runs:status==='idle'?[]:[{id:'old-job',kind:'analysis',status}],turns:[{id:'old-turn',source:'ai',text:'历史提交',status:'recognizing',commands:[]}]}:undefined})
  await ready();expect(screen.queryByRole('button',{name:'停止当前会话'})).toBeNull()
 })
 it('关联作业真正运行才显示停止，结束后立即隐藏',async()=>{
  let running=false
  setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,stop:{available:true,running,supported:true,token:'job-state'},runs:[{id:'job-running',kind:'analysis',status:running?'running':'queued'}]}:undefined})
  await ready();expect(screen.queryByRole('button',{name:'停止当前会话'})).toBeNull();running=true;fireEvent.click(screen.getByRole('button',{name:'刷新进度'}));await screen.findByRole('button',{name:'停止当前会话'});running=false;fireEvent.click(screen.getByRole('button',{name:'刷新进度'}));await waitFor(()=>expect(screen.queryByRole('button',{name:'停止当前会话'})).toBeNull())
 })

 it('原生Harness运行显示停止，取消回执后继续核对真实状态并保留草稿历史',async()=>{
  let running=true
  const {calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,sessionId:'native-a',messages:[{role:'assistant',text:'已经生成的回答'}],stop:{available:running,running,supported:true,token:'native-turn-1'}}:request.action==='stop'?{status:'ok',stopping:true,note:'已请求停止，正在等待原生会话结束'}:undefined})
  await ready();fireEvent.change(screen.getByRole('textbox',{name:'助手消息'}),{target:{value:'未发送草稿'}})
  fireEvent.click(screen.getByRole('button',{name:'停止当前会话'}));await screen.findByText('已请求停止，正在等待原生会话结束')
  expect(screen.getByRole('button',{name:'停止当前会话'}).disabled).toBe(true);expect(screen.queryByText('已停止，历史与已完成进度保留')).toBeNull()
  running=false;fireEvent.click(screen.getByRole('button',{name:'刷新进度'}));await screen.findByText('已停止，历史与已完成进度保留')
  expect(screen.queryByRole('button',{name:'停止当前会话'})).toBeNull();expect(screen.getByText('已经生成的回答')).toBeTruthy();expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('未发送草稿')
  expect(calls.filter(r=>r.action==='stop')).toMatchObject([{action:'stop',conversationId:'task:a',sessionId:'native-a',token:'native-turn-1'}]);expect(calls.some(r=>r.action==='send')).toBe(false)
 })
 it('准备附件时停止，迟到的准备回包不发送，保留文字和附件',async()=>{
  let release
  const {calls}=setup({id:'task:a',hub:request=>request.action==='prepareAttachments'?new Promise(resolve=>release=resolve):undefined}),user=userEvent.setup();await ready()
  await user.upload(screen.getByLabelText('选择助手附件'),new File(['data'],'待发.png',{type:'image/png'}));fireEvent.change(screen.getByRole('textbox',{name:'助手消息'}),{target:{value:'请分析这个附件'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(release).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('button',{name:'停止当前会话'}));await screen.findByText('已停止，历史与已完成进度保留');await act(async()=>release({status:'ok',sessionId:'prepared-native'}))
  expect(calls.some(r=>['send','stop'].includes(r.action))).toBe(false);expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('请分析这个附件');expect(screen.getByRole('region',{name:'本轮附件'}).textContent).toContain('待发.png');expect(screen.queryByRole('button',{name:'继续本轮'})).toBeNull()
 })
 it('提交回执尚未返回也能用本轮请求ID停止，不重复提交',async()=>{
  let releaseSend;let ended=false
  const {calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,sessionId:'native-a',stop:{available:!ended,running:!ended,supported:true,token:'turn-one'}}:request.action==='send'?new Promise(resolve=>releaseSend=resolve):request.action==='stop'?(ended=true,{status:'ok',stopping:false}):undefined})
  await ready();fireEvent.change(screen.getByRole('textbox',{name:'助手消息'}),{target:{value:'一个正在发送的问题'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(releaseSend).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('button',{name:'停止当前会话'}));await screen.findByText('已停止，历史与已完成进度保留');const sent=calls.find(r=>r.action==='send'),stop=calls.find(r=>r.action==='stop');expect(stop.requestId).toBe(sent.requestId)
  await act(async()=>releaseSend({status:'stopped',sessionId:'native-a',requestId:sent.requestId}));expect(calls.filter(r=>r.action==='send')).toHaveLength(1);expect(calls.filter(r=>r.action==='stop')).toHaveLength(1);expect(screen.queryByRole('button',{name:'继续本轮'})).toBeNull()
 })
 it('停止后新一轮已经开始时，上一轮迟到回执不能释放新一轮的发送锁',async()=>{
  let oldReceipt,newReceipt;let stopped=false
  const {calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,sessionId:'native-a',stop:{available:false,supported:true,token:'turn'}}:request.action==='send'?new Promise(resolve=>{if(!oldReceipt)oldReceipt=resolve;else newReceipt=resolve}):request.action==='stop'?(stopped=true,{status:'ok',stopping:false}):undefined})
  await ready();const input=screen.getByRole('textbox',{name:'助手消息'});fireEvent.change(input,{target:{value:'第一轮'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(oldReceipt).toBeTypeOf('function'));fireEvent.click(screen.getByRole('button',{name:'停止当前会话'}));await screen.findByText('已停止，历史与已完成进度保留');expect(stopped).toBe(true)
  fireEvent.change(input,{target:{value:'第二轮'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(newReceipt).toBeTypeOf('function'));await act(async()=>oldReceipt({status:'stopped',note:'旧回包'}));expect(screen.getByRole('button',{name:'处理中'}).disabled).toBe(true);expect(screen.getByRole('button',{name:'停止当前会话'}).disabled).toBe(false);expect(calls.filter(r=>r.action==='send')).toHaveLength(2);await act(async()=>newReceipt({status:'ok',handled:true}))
 })
 it('停止回包迟到不能改变新会话的输入和状态',async()=>{
  let release
  setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,sessionId:request.conversationId==='task:a'?'native-a':'native-b',stop:{available:request.conversationId==='task:a',running:request.conversationId==='task:a',supported:true,token:'a'}}:request.action==='stop'?new Promise(resolve=>release=resolve):undefined})
  await ready();fireEvent.click(screen.getByRole('button',{name:'停止当前会话'}));await waitFor(()=>expect(release).toBeTypeOf('function'));fireEvent.click(screen.getByRole('button',{name:'会话：乙的工作'}));await ready();fireEvent.change(screen.getByRole('textbox',{name:'助手消息'}),{target:{value:'乙的独立草稿'}})
  await act(async()=>release({status:'ok',stopping:false}));expect(screen.getByRole('textbox',{name:'助手消息'}).value).toBe('乙的独立草稿');expect(screen.queryByText('已停止，历史与已完成进度保留')).toBeNull();expect(screen.queryByRole('button',{name:'停止当前会话'})).toBeNull()
 })
 it('原生取消失败允许重试，不伪造已停止',async()=>{
  let failed=true
  const {calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,stop:{available:true,running:true,supported:true,token:'fixture'}}:request.action==='stop'?failed?{status:'error',note:'原生取消失败'}:{status:'ok',stopping:true}:undefined})
  await ready();fireEvent.click(screen.getByRole('button',{name:'停止当前会话'}));await screen.findByText('原生取消失败');expect(screen.getByRole('button',{name:'停止当前会话'}).disabled).toBe(false);expect(screen.queryByText('已停止，历史与已完成进度保留')).toBeNull();failed=false;fireEvent.click(screen.getByRole('button',{name:'停止当前会话'}));await waitFor(()=>expect(calls.filter(r=>r.action==='stop')).toHaveLength(2))
 })
 it('已暂停办公作业提供继续未完成内容，沿用原作业ID',async()=>{
  const {calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='detail'?{...value,runs:[{id:'office-kept',kind:'task_assist',status:'paused',steps:[{id:'done',status:'completed',artifact:{text:'已完成产物'}}]}]}:request.action==='operate'?{status:'ok',handled:true}:undefined})
  await ready();fireEvent.click(screen.getByRole('button',{name:'继续未完成内容'}));await waitFor(()=>expect(calls.find(r=>r.operation==='office.retry')).toMatchObject({id:'office-kept'}))
 })
})

describe('从研发任务打开对应原会话',()=>{
 it('精确读取传入的审查或历史会话，普通打开仍沿用默认会话，不触发重跑',async()=>{
  const {WB,calls}=setup({id:'task:a',hub:(request,{value})=>request.action==='detail'&&request.conversationId==='development:dev-route'?{...value,conversation:{id:'development:dev-route',kind:'development',title:'研发原记录'},sessionId:request.sessionId||'main-session',nativeBinding:{sessionId:request.sessionId||'main-session',canSend:true},messages:[{role:'assistant',text:request.sessionId==='review-session'?'审查原会话记录':request.sessionId==='original-session'?'兼容前原历史记录':'当前主会话记录'}]}:undefined})
  await ready();act(()=>WB.assistant.openHub('development','dev-route','review-session'));await screen.findByText('审查原会话记录');expect(calls.some(r=>r.action==='detail'&&r.conversationId==='development:dev-route'&&r.sessionId==='review-session')).toBe(true)
  act(()=>WB.assistant.openHub('development:dev-route',undefined,'original-session'));await screen.findByText('兼容前原历史记录');expect(WB.store.get().assistantHubThreadId).toBe('original-session')
  act(()=>WB.assistant.openHub('development','dev-route'));await screen.findByText('当前主会话记录');expect(WB.store.get().assistantHubThreadId).toBeNull();expect(calls.some(r=>['send','reset','prepareAttachments','operate'].includes(r.action))).toBe(false)
 })
})
