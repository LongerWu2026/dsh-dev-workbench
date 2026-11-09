import {dataAction} from './data-workspace-ui.mjs'
import {toolButton,openTools} from './tool-picker.mjs'
import React from 'react'
import {describe,it,expect,vi,afterEach} from 'vitest'
import {render,screen,fireEvent,waitFor,cleanup,within,act} from '@testing-library/react'
// Exercise the public page from source so focused RED/GREEN never rebuilds root bundles.
import {toolPage} from '../../src/client/features/toolbox/toolbox.ts'
import {WB as sourceWB} from '../../src/client/core/runtime.ts'
const loadClientBundle=()=>({WB:Object.assign(sourceWB,{pages:{...sourceWB.pages,toolbox:toolPage}})})
afterEach(cleanup)
const savedConnections=()=>within(screen.getByRole('list',{name:'已保存连接'}))
function setup(initialConnections=[],supportsAutoSelection=true){const {WB}=loadClientBundle();const calls=[];let saved=false;WB.rpc=vi.fn(async(method,payload)=>{calls.push({method,request:payload?.request});switch(method.split('/').at(-1)){
 case 'dataConnections':return {capabilities:supportsAutoSelection?{autoTableSelection:true,rememberPassword:true}:undefined,connections:saved?[{id:'fixture',name:'开发库',kind:'postgres',host:'127.0.0.1',port:5432,database:'fixture',username:'user',unlocked:true}]:initialConnections};
 case 'dataSave':saved=true;return {config:{id:'fixture',name:'开发库',kind:'postgres',host:'127.0.0.1',port:5432,database:'fixture',username:'user',rememberPassword:payload.request.rememberPassword}};
 case 'dataObjects':return {objects:[{schemaName:'public',name:'orders'}]};
 case 'dataStructure':return {tables:[{name:'orders',columns:[{name:'id',type:'bigint'}]}],hash:'schema-v1',at:'2026-10-31T00:00:00Z'};
 case 'dataGenerate':return {query:payload.request.mode==='script'?'ALTER TABLE orders ADD COLUMN code text':'SELECT id FROM public.orders',explanation:'根据订单结构生成',rollback:payload.request.mode==='script'?'ALTER TABLE orders DROP COLUMN code':'',mode:payload.request.mode,schemaHash:'schema-v1'};
 case 'dataQuery':return {columns:['id'],rows:[{id:'9007199254740993'}],durationMs:2,truncated:false};
 case 'dataTest':return {note:'连接成功'};default:return {status:'ok'}
 }});render(<WB.pages.toolbox/>);fireEvent.click(toolButton(/数据连接 SQL/));return {WB,calls}}
async function save(){
 fireEvent.click(dataAction('连接配置'));
 fireEvent.change(screen.getByRole('combobox',{name:'数据库类型'}),{target:{value:'postgres'}});
 fireEvent.change(screen.getByRole('textbox',{name:'连接名称'}),{target:{value:'开发库'}});
 fireEvent.change(screen.getByRole('textbox',{name:'数据库名称'}),{target:{value:'fixture'}});
 fireEvent.change(screen.getByLabelText('数据库密码'),{target:{value:'fixture-secret'}});
 fireEvent.click(screen.getByRole('button',{name:'保存'}));
 await screen.findByRole('checkbox',{name:'public.orders'});
}
async function selectTable(){const check=await screen.findByRole('checkbox',{name:'public.orders'});fireEvent.click(check)}
function memoryHost(WB,calls,{loadDelay,saveDelay,generateDelay,queryResponse}={}){
 const fallback=WB.rpc,records=new Map();let active='orders';
 const connections=[{id:'orders',name:'订单库',kind:'postgres',unlocked:true},{id:'inventory',name:'库存库',kind:'postgres',unlocked:true}];
 const envelope=id=>({id,key:id?'target-'+id:'',revision:records.get(id)?.revision||0,workspace:records.get(id)?.workspace||{},updatedAt:'2026-11-07T01:00:00Z'});
 WB.rpc=vi.fn(async(method,payload)=>{
  const name=method.split('/').at(-1),request=payload?.request;
  if(name==='dataConnections')return {connections,capabilities:{workspaceMemory:true,queryPagination:true,autoTableSelection:true}};
  if(name==='dataWorkspaceLoad'){
   calls.push({method,request});const id=request.id===undefined?active:request.id;
   if(loadDelay)await loadDelay(id);if(id)active=id;return envelope(id);
  }
  if(name==='dataWorkspaceSave'){
   calls.push({method,request});if(saveDelay)await saveDelay(request);const previous=envelope(request.id);
   if(request.revision!==previous.revision)throw Error('工作区已被其他窗口修改');
   records.set(request.id,{revision:previous.revision+1,workspace:{...previous.workspace,...request.patch}});return envelope(request.id);
  }
  if(name==='dataWorkspaceClear'){
   calls.push({method,request});const previous=envelope(request.id);records.set(request.id,{revision:previous.revision+1,workspace:{}});return envelope(request.id);
  }
  if(name==='dataGenerate'){
   calls.push({method,request});if(generateDelay)await generateDelay(request);const previous=envelope(request.id);
   const draft={query:'SELECT id FROM orders ORDER BY id',explanation:'服务端保存的建议',mode:'query',selected:[]};
   records.set(request.id,{revision:previous.revision+1,workspace:{...previous.workspace,aiTurns:[...(previous.workspace.aiTurns||[]),{instruction:request.instruction,draft}]}});
   return {...draft,workspace:envelope(request.id)};
  }
  if(name==='dataQuery'&&queryResponse){calls.push({method,request});return queryResponse(request)}
  return fallback(method,payload);
 });return {records,envelope};
}

describe('数据连接工具',()=>{
 it('AI 为主入口，示例只预填需求；生成后仍需主动采用且不执行 SQL',async()=>{
  const {calls}=setup([{id:'fixture',name:'开发库',kind:'postgres',unlocked:true}]);await screen.findByRole('checkbox',{name:'public.orders'})
  expect(screen.getByText('描述需求，让 AI 生成 SQL')).toBeTruthy()
  const ai=screen.getByRole('complementary',{name:'数据库 AI 会话'}),sql=document.querySelector('.wb-data-main')
  expect(ai.compareDocumentPosition(sql)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const editor=screen.getByRole('textbox',{name:'数据查询编辑器'});fireEvent.change(editor,{target:{value:'SELECT 42 AS manual'}})
  const examples=screen.getByRole('group',{name:'试试这样问'});
  fireEvent.click(within(examples).getByRole('button',{name:'查找重复记录'}))
  expect(screen.getByRole('textbox',{name:'数据库AI需求'}).value).toBe('查找重复记录');expect(document.activeElement).toBe(screen.getByRole('textbox',{name:'数据库AI需求'}))
  expect(calls.some(call=>call.method.endsWith('dataGenerate')||call.method.endsWith('dataQuery'))).toBe(false)
  fireEvent.click(screen.getByRole('button',{name:'生成 SQL',exact:true}));await screen.findByRole('button',{name:'填入 SQL 编辑器'})
  expect(calls.find(call=>call.method.endsWith('dataGenerate')).request.mode).toBe('query')
  expect(editor.value).toBe('SELECT 42 AS manual');expect(calls.some(call=>call.method.endsWith('dataQuery'))).toBe(false)
  sql.scrollTop=245;fireEvent.click(screen.getByRole('button',{name:'填入 SQL 编辑器'}));expect(sql.scrollTop).toBe(0);expect(editor.value).toBe('SELECT id FROM public.orders');expect(calls.some(call=>call.method.endsWith('dataQuery'))).toBe(false)
 })
 it.each([
  ['postgres','查找重复记录','在表「public.orders」中，查找重复记录'],
  ['es','统计当前索引的文档总数','统计索引“orders”的文档总数'],
  ['redis','查看 Key 的剩余过期时间','查看Key「orders」的剩余过期时间'],
 ])('%s 的首问建议使用当前选中的对象，点击只填入需求',async(kind,label,instruction)=>{
  const {calls}=setup([{id:kind,name:'测试连接',kind,unlocked:true}]);
  await selectTable();
  const examples=within(screen.getByRole('group',{name:'试试这样问'}));
  expect(examples.getAllByRole('button')).toHaveLength(3);
  fireEvent.click(examples.getByRole('button',{name:label}));
  expect(screen.getByRole('textbox',{name:'数据库AI需求'}).value).toBe(instruction);
  expect(calls.some(call=>call.method.endsWith('dataGenerate')||call.method.endsWith('dataQuery'))).toBe(false);
 });
 it('工作区只有一条顶部工具栏，配置按需打开且编辑器分隔线不执行查询',async()=>{
  const {calls}=setup([{id:'fixture',name:'开发库',kind:'postgres',unlocked:true}]);await screen.findByRole('checkbox',{name:'public.orders'})
  expect(document.querySelector('.wb-tool-surface--data > .wb-card-head')).toBeNull()
  expect(screen.getAllByRole('button',{name:'切换工具'})).toHaveLength(1)
  expect(screen.getByRole('button',{name:'开发库的更多操作'}).getAttribute('aria-expanded')).toBe('false')
  expect(within(document.querySelector('.wb-data-toolbar')).getAllByRole('button').map(button=>button.getAttribute('aria-label'))).toEqual(['切换工具'])
  const editor=screen.getByRole('textbox',{name:'数据查询编辑器'}),splitter=screen.getByRole('separator',{name:'调整查询编辑器高度'})
  fireEvent.change(editor,{target:{value:'SELECT 42 AS preserved'}});fireEvent.keyDown(splitter,{key:'ArrowDown'})
  expect(splitter.getAttribute('aria-valuenow')).toBe('39');fireEvent.keyDown(splitter,{key:'Home'});expect(splitter.getAttribute('aria-valuenow')).toBe('18');fireEvent.keyDown(splitter,{key:'End'});expect(splitter.getAttribute('aria-valuenow')).toBe('60')
  expect(editor.value).toBe('SELECT 42 AS preserved');expect(calls.some(call=>call.method.endsWith('dataQuery'))).toBe(false)
  fireEvent.click(dataAction('连接配置'));expect(screen.getByRole('dialog',{name:'连接配置'})).toBeTruthy()
 })
 it('连接行默认展开对象，折叠与恢复保留选表和手动 SQL',async()=>{
  const {calls}=setup([{id:'fixture',name:'开发库',kind:'postgres',unlocked:true}]);await selectTable()
  const editor=screen.getByRole('textbox',{name:'数据查询编辑器'});fireEvent.change(editor,{target:{value:'SELECT 7'}})
  const row=savedConnections().getByRole('button',{name:/开发库 PostgreSQL/,pressed:true})
  expect(row.getAttribute('aria-expanded')).toBe('true')
  expect(within(row).getByText('已连接')).toBeTruthy()
  expect(screen.queryByRole('tab',{name:'对象'})).toBeNull()
  fireEvent.click(row);expect(screen.queryByRole('checkbox',{name:'public.orders'})).toBeNull()
  fireEvent.click(row);expect(screen.getByRole('checkbox',{name:'public.orders'}).checked).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:'收起连接'}));fireEvent.click(screen.getByRole('button',{name:'展开连接'}))
  expect(screen.getByRole('checkbox',{name:'public.orders'}).checked).toBe(true);expect(editor.value).toBe('SELECT 7');expect(calls.some(call=>call.method.endsWith('dataQuery'))).toBe(false)
 })
 it('表目录截断后按库搜索，清空筛选或刷新目录仍保留搜到的选表',async()=>{
  const {WB,calls}=setup([{id:'fixture',name:'开发库',kind:'postgres',unlocked:true}]);
  const fallback=WB.rpc;
  const target={schemaName:'bcm_fixture',name:'t_bcm_model'};
  WB.rpc=async(method,payload)=>{
   const response=await fallback(method,payload);
   if(method.endsWith('dataConnections'))return {...response,capabilities:{...response.capabilities,tableSearch:true}};
   if(method.endsWith('dataObjects'))return payload.request.query?{objects:[target]}:{...response,truncated:true};
   return response;
  };
  cleanup();render(<WB.pages.toolbox/>);await selectTable();
  const filter=screen.getByRole('textbox',{name:'筛选表、索引或Key'});
  fireEvent.change(filter,{target:{value:' BCM_fixture.T_BCM_MODEL '}});
  fireEvent.click(await screen.findByRole('checkbox',{name:'bcm_fixture.t_bcm_model'}));
  expect(calls.some(call=>call.method.endsWith('dataObjects')&&call.request.query==='bcm_fixture.t_bcm_model')).toBe(true);
  fireEvent.change(filter,{target:{value:''}});
  expect(screen.getByRole('checkbox',{name:'public.orders'}).checked).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'刷新表列表'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'刷新表列表'}).disabled).toBe(false));
  expect(calls.some(call=>call.method.endsWith('dataObjects')&&call.request.refresh===true)).toBe(true);
  expect(screen.getByText('对象与结构 · 已选 2/12')).toBeTruthy();
  expect(calls.some(call=>call.method.endsWith('dataQuery'))).toBe(false);
 });
 it.each(['es','redis'])('%s 仍显示有界原始JSON，不添加SQL分页参数或伪造分页控件',async(kind)=>{
  const {WB,calls}=setup([{id:kind,name:'原始JSON来源',kind,unlocked:true}]);const fallback=WB.rpc;
  WB.rpc=async(method,payload)=>{
   const response=await fallback(method,payload);
   if(method.endsWith('dataConnections'))return {...response,capabilities:{queryPagination:true}};
   if(method.endsWith('dataQuery'))return {result:{raw:{items:['保留原始结构']}},durationMs:1};
   return response;
  };
  cleanup();render(<WB.pages.toolbox/>);await screen.findByRole('checkbox',{name:'public.orders'});
  fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));await screen.findByText(/保留原始结构/);
  expect(screen.queryByRole('group',{name:'SQL 结果分页'})).toBeNull();
  expect(calls.find(call=>call.method.endsWith('dataQuery')).request.pageSize).toBeUndefined();
  expect(screen.getByRole('region',{name:'数据库查询结果，可横向滚动'}).textContent).toContain('"raw"');
 });
 it('ES 无需勾选可生成查询，填入后执行携带生成时识别的索引',async()=>{
  const {WB,calls}=setup([{id:'es',name:'搜索库',kind:'es',unlocked:true}]);
  const fallback=WB.rpc,index='1001444809426077696_index_epic_bizmodel';
  WB.rpc=async(method,payload)=>{
   const response=await fallback(method,payload);
   if(method.endsWith('dataConnections'))return {...response,capabilities:{autoIndexSelection:true}};
   if(method.endsWith('dataGenerate'))return {query:'{"size":0,"track_total_hits":true}',selected:[{name:index}],schemaHash:'mapping-v1'};
   return response;
  };
  cleanup();render(<WB.pages.toolbox/>);
  await screen.findByText('可在问题中写完整索引名，系统会自动定位。');
  fireEvent.click(screen.getByRole('button',{name:'统计指定索引的文档总数'}));
  const input=screen.getByRole('textbox',{name:'数据库AI需求'});
  expect(input.value).toBe('统计索引“完整索引名”的文档总数');
  expect(calls.some(call=>call.method.endsWith('dataGenerate'))).toBe(false);
  fireEvent.change(input,{target:{value:input.value.replace('完整索引名',index)}});
  fireEvent.click(screen.getByRole('button',{name:'生成查询',exact:true}));
  await screen.findByText('使用对象 · '+index);
  expect(calls.find(call=>call.method.endsWith('dataGenerate')).request.selected).toEqual([]);
  expect(calls.some(call=>call.method.endsWith('dataQuery'))).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'填入查询编辑器'}));
  fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));
  await waitFor(()=>expect(calls.find(call=>call.method.endsWith('dataQuery')).request).toMatchObject({index,selected:[{name:index}],schemaHash:'mapping-v1'}));
 });
 it('新建未保存连接明确使用空ID，密码表单不进入记忆，切换工具仍保留临时草稿',async()=>{
  const {WB,calls}=setup();memoryHost(WB,calls);cleanup();render(<WB.pages.toolbox/>);
  await screen.findByRole('checkbox',{name:'public.orders'});
  fireEvent.click(screen.getByRole('button',{name:'新建连接',exact:true}));
  const dialog=within(screen.getByRole('dialog',{name:/连接配置|新建连接/}));
  await waitFor(()=>expect(dialog.getByRole('textbox',{name:'连接名称'}).disabled).toBe(false));
  fireEvent.change(dialog.getByRole('textbox',{name:'连接名称'}),{target:{value:'临时未保存连接'}});
  fireEvent.change(dialog.getByLabelText('数据库密码'),{target:{value:'never-save-this-secret'}});
  fireEvent.click(dialog.getByRole('button',{name:'关闭',exact:true}));
  fireEvent.click(toolButton(/JSON 格式化/));fireEvent.click(toolButton(/数据连接 SQL/));
  await waitFor(()=>expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).disabled).toBe(false));
  fireEvent.click(dataAction('连接配置'));
  expect(screen.getByRole('textbox',{name:'连接名称'}).value).toBe('临时未保存连接');
  expect(calls.filter(call=>call.method.endsWith('dataWorkspaceLoad')).some(call=>call.request.id==='')).toBe(true);
  expect(JSON.stringify(calls.filter(call=>call.method.endsWith('dataWorkspaceSave')))).not.toContain('never-save-this-secret');
  expect(screen.queryByText('连接记忆已保存到本机')).toBeNull();
 });
 it('页面离开后到达的旧查询不能覆盖重挂载后的新查询',async()=>{
  let finish;const {WB,calls}=setup();memoryHost(WB,calls,{queryResponse:request=>request.query==='SELECT old'?new Promise(resolve=>{finish=resolve}):{columns:['value'],rows:[{value:'new-result'}],pageSize:50,offset:0,hasMore:false,nextOffset:null,durationMs:1}});
  cleanup();const mounted=render(<WB.pages.toolbox/>);await screen.findByRole('checkbox',{name:'public.orders'});
  fireEvent.change(screen.getByRole('textbox',{name:'数据查询编辑器'}),{target:{value:'SELECT old'}});
  fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));await waitFor(()=>expect(finish).toBeTypeOf('function'));
  mounted.unmount();render(<WB.pages.toolbox/>);await screen.findByRole('checkbox',{name:'public.orders'});
  fireEvent.change(screen.getByRole('textbox',{name:'数据查询编辑器'}),{target:{value:'SELECT new'}});
  fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));await screen.findByText('new-result');
  await act(async()=>finish({columns:['value'],rows:[{value:'stale-result'}],durationMs:20}));
  expect(screen.queryByText('stale-result')).toBeNull();expect(screen.getByText('new-result')).toBeTruthy();
  expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toBe('SELECT new');
 });
 it('AI在页面卸载后完成仍由宿主保存，返回页面不会自动应用或执行',async()=>{
  let finish;const {WB,calls}=setup();memoryHost(WB,calls,{generateDelay:()=>new Promise(resolve=>{finish=resolve})});
  cleanup();const mounted=render(<WB.pages.toolbox/>);await screen.findByRole('checkbox',{name:'public.orders'});
  fireEvent.change(screen.getByRole('textbox',{name:'数据查询编辑器'}),{target:{value:'SELECT 31 AS manual'}});
  fireEvent.change(screen.getByRole('textbox',{name:'数据库AI需求'}),{target:{value:'订单建议'}});
  fireEvent.click(screen.getByRole('button',{name:/^生成(?: SQL|查询|脚本)$/}));await waitFor(()=>expect(finish).toBeTypeOf('function'));
  const generation=calls.find(call=>call.method.endsWith('dataGenerate')).request;
  expect(generation.workspace).toMatchObject({key:'target-orders',baseRevision:expect.any(Number),turnId:expect.any(String)});
  mounted.unmount();await act(async()=>finish());render(<WB.pages.toolbox/>);
  await screen.findByText('服务端保存的建议');
  expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toBe('SELECT 31 AS manual');
  expect(calls.some(call=>call.method.endsWith('dataQuery'))).toBe(false);
 });
 it('AI完成保留另一窗口在生成期间保存的新需求，不清空当前输入',async()=>{
  let finish,host;const {WB,calls}=setup();
  host=memoryHost(WB,calls,{generateDelay:()=>new Promise(resolve=>{finish=resolve})});
  cleanup();render(<WB.pages.toolbox/>);await screen.findByRole('checkbox',{name:'public.orders'});
  fireEvent.click(screen.getByRole('checkbox',{name:'public.orders'}));
  fireEvent.change(screen.getByRole('textbox',{name:'数据库AI需求'}),{target:{value:'窗口A正在生成的需求'}});
  fireEvent.click(screen.getByRole('button',{name:/^生成(?: SQL|查询|脚本)$/}));await waitFor(()=>expect(finish).toBeTypeOf('function'));
  const previous=host.records.get('orders')||{revision:0,workspace:{}};
  host.records.set('orders',{revision:previous.revision+1,workspace:{...previous.workspace,instruction:'窗口B刚保存的新需求'}});
  await act(async()=>finish());
  await screen.findByText('服务端保存的建议');
  expect(screen.getByRole('textbox',{name:'数据库AI需求'}).value).toBe('窗口B刚保存的新需求');
  await waitFor(()=>expect(host.records.get('orders').workspace.instruction).toBe('窗口B刚保存的新需求'));
  expect(calls.filter(call=>call.method.endsWith('dataWorkspaceSave')).at(-1).request.patch.instruction).not.toBe('');
 });
 it('内容截断不假装有下一页，完整当前页复制保留长单元格，零行保留列',async()=>{
  const full='完整长单元格 '.repeat(100);let empty=false;
  const {WB,calls}=setup();memoryHost(WB,calls,{queryResponse:()=>({columns:['description'],rows:empty?[]:[{description:full}],pageSize:50,offset:0,hasMore:false,nextOffset:null,durationMs:1,truncated:true,truncation:{cellLimit:true,byteLimit:false,rowLimit:false}})});
  cleanup();render(<WB.pages.toolbox/>);await screen.findByRole('checkbox',{name:'public.orders'});
  const copy=vi.spyOn(WB.util,'copy').mockResolvedValue();
  fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));await screen.findByRole('cell',{name:full.trim()});
  expect(screen.getByRole('cell').title).toBe(full);
  expect(screen.getByRole('button',{name:'下一页',exact:true}).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'复制当前页结果'}));expect(copy).toHaveBeenCalledWith(JSON.stringify([{description:full}],null,2));
  empty=true;fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));await screen.findByText('查询成功，无返回记录');
  expect(screen.getByRole('columnheader',{name:'description'})).toBeTruthy();
 });

 it('恢复读取失败允许手动编辑，重试只合并较新的编辑而不覆盖存储中的其他内容',async()=>{
  let failed=false;const {WB,calls}=setup();const host=memoryHost(WB,calls,{loadDelay:()=>{if(!failed){failed=true;throw Error('读取记忆暂不可用')}}});
  host.records.set('orders',{revision:4,workspace:{query:'SELECT 5',instruction:'以前未发送的需求'}});
  cleanup();render(<WB.pages.toolbox/>);await screen.findByText(/读取记忆暂不可用/);
  const editor=screen.getByRole('textbox',{name:'数据查询编辑器'});expect(editor.disabled).toBe(false);
  fireEvent.change(editor,{target:{value:'SELECT 81 AS newer_edit'}});
  fireEvent.click(screen.getByRole('button',{name:'重试连接记忆'}));
  await screen.findByRole('checkbox',{name:'public.orders'});
  expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toBe('SELECT 81 AS newer_edit');
  expect(screen.getByRole('textbox',{name:'数据库AI需求'}).value).toBe('以前未发送的需求');
  expect(calls.some(call=>call.method.endsWith('dataQuery'))).toBe(false);
 });
 it('保存队列在卸载后继续串行，重挂载等待并恢复最后输入',async()=>{
  let finish;const {WB,calls}=setup();memoryHost(WB,calls,{saveDelay:request=>request.patch.query==='SELECT 11'?new Promise(resolve=>{finish=resolve}):undefined});
  cleanup();const mounted=render(<WB.pages.toolbox/>);await screen.findByRole('checkbox',{name:'public.orders'});
  const editor=screen.getByRole('textbox',{name:'数据查询编辑器'});
  fireEvent.change(editor,{target:{value:'SELECT 11'}});await waitFor(()=>expect(finish).toBeTypeOf('function'));
  fireEvent.change(editor,{target:{value:'SELECT 12'}});
  expect(screen.getByText('连接记忆保存中…')).toBeTruthy();mounted.unmount();render(<WB.pages.toolbox/>);
  await waitFor(()=>expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).disabled).toBe(true));
  await act(async()=>finish());
  await waitFor(()=>expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toBe('SELECT 12'));
  await screen.findByText('连接记忆已保存到本机');
  const writes=calls.filter(call=>call.method.endsWith('dataWorkspaceSave')&&call.request.patch.query);
  expect(writes.map(call=>call.request.patch.query)).toEqual(['SELECT 11','SELECT 12']);
  expect(writes[1].request.revision).toBe(writes[0].request.revision+1);
 });
 it('保存失败不冒充成功，手动重试后恢复；清除记忆须先确认',async()=>{
  let failed=false;const {WB,calls}=setup();memoryHost(WB,calls,{saveDelay:request=>{if(request.patch.query&&!failed){failed=true;throw Error('磁盘暂不可写')}}});
  cleanup();render(<WB.pages.toolbox/>);await screen.findByRole('checkbox',{name:'public.orders'});
  fireEvent.change(screen.getByRole('textbox',{name:'数据查询编辑器'}),{target:{value:'SELECT 99'}});
  await screen.findByText(/连接记忆保存失败：磁盘暂不可写/);
  expect(screen.queryByText('连接记忆已保存到本机')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'重试连接记忆'}));await screen.findByText('连接记忆已保存到本机');
  fireEvent.click(dataAction('清除当前连接记忆'));
  expect(calls.some(call=>call.method.endsWith('dataWorkspaceClear'))).toBe(false);
  fireEvent.click(within(screen.getByRole('dialog',{name:'清除当前连接记忆'})).getByRole('button',{name:'取消'}));
  expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toBe('SELECT 99');
  fireEvent.click(dataAction('清除当前连接记忆'));
  fireEvent.click(screen.getByRole('button',{name:'确认清除记忆'}));
  await waitFor(()=>expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toBe('SELECT 1 AS value'));
  expect(calls.filter(call=>call.method.endsWith('dataWorkspaceClear'))).toHaveLength(1);
  expect(calls.some(call=>call.method.endsWith('dataQuery'))).toBe(false);
 });
 it('多窗口保存冲突后重试重新读取修订并保留未保存编辑',async()=>{
  let host,conflicted=false;const {WB,calls}=setup();
  host=memoryHost(WB,calls,{saveDelay:request=>{
   if(request.patch.query==='SELECT 71 AS conflicted'&&!conflicted){
    conflicted=true;const previous=host.records.get('orders')||{revision:0,workspace:{}};
    host.records.set('orders',{revision:previous.revision+3,workspace:{...previous.workspace,instruction:'其他窗口保存的需求'}});
    throw Error('工作区已被其他窗口修改');
   }
  }});
  cleanup();render(<WB.pages.toolbox/>);await screen.findByRole('checkbox',{name:'public.orders'});
  fireEvent.change(screen.getByRole('textbox',{name:'数据查询编辑器'}),{target:{value:'SELECT 71 AS conflicted'}});
  fireEvent.change(screen.getByRole('textbox',{name:'数据库AI需求'}),{target:{value:'保留这条未发送需求'}});
  await screen.findByText(/连接记忆保存失败：工作区已被其他窗口修改/);
  const conflictRevision=host.records.get('orders').revision;
  fireEvent.click(screen.getByRole('button',{name:'重试连接记忆'}));
  await screen.findByText('连接记忆已保存到本机');
  await waitFor(()=>expect(host.records.get('orders').workspace.query).toBe('SELECT 71 AS conflicted'));
  expect(host.records.get('orders').workspace.instruction).toBe('保留这条未发送需求');
  const saveIndex=calls.findIndex(call=>call.method.endsWith('dataWorkspaceSave')&&call.request.patch.query==='SELECT 71 AS conflicted');
  expect(calls.slice(saveIndex+1).some(call=>call.method.endsWith('dataWorkspaceLoad'))).toBe(true);
  const lastSave=calls.filter(call=>call.method.endsWith('dataWorkspaceSave')).at(-1);
  expect(lastSave.request.revision).toBe(conflictRevision);
 });
 it('修改连接目标前等待旧目标自动保存完成',async()=>{
  let release,configSaved=false;const events=[];const {WB,calls}=setup();
  memoryHost(WB,calls,{saveDelay:request=>request.patch.query==='SELECT 17 AS old_target'?new Promise(resolve=>{release=()=>{events.push('workspace-finished');resolve()}}):undefined});
  const rpc=WB.rpc;WB.rpc=vi.fn(async(method,payload)=>{
   if(method.endsWith('dataSave')){events.push('config-save');configSaved=true;return {config:{...payload.request,id:'orders',password:undefined,unlocked:true}}}
   return rpc(method,payload);
  });
  cleanup();render(<WB.pages.toolbox/>);await screen.findByRole('checkbox',{name:'public.orders'});
  fireEvent.change(screen.getByRole('textbox',{name:'数据查询编辑器'}),{target:{value:'SELECT 17 AS old_target'}});
  await waitFor(()=>expect(release).toBeTypeOf('function'));
  fireEvent.click(dataAction('连接配置'));
  const dialog=within(screen.getByRole('dialog',{name:'连接配置'}));
  fireEvent.change(dialog.getByRole('textbox',{name:'数据库名称'}),{target:{value:'new_target'}});
  fireEvent.click(dialog.getByRole('button',{name:'保存'}));
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20))});
  expect(configSaved).toBe(false);expect(events).not.toContain('config-save');
  await act(async()=>release());
  await waitFor(()=>expect(configSaved).toBe(true));
  expect(events.indexOf('workspace-finished')).toBeLessThan(events.indexOf('config-save'));
 });
 it('旧宿主降级只保留本页输入，不调用记忆RPC也不伪装分页',async()=>{
  const {calls}=setup([{id:'legacy',name:'旧宿主',kind:'postgres',unlocked:true}],false);
  await screen.findByRole('checkbox',{name:'public.orders'});
  expect(screen.getByText('当前宿主不支持持久记忆，仅保留本页输入')).toBeTruthy();
  expect(screen.queryByRole('button',{name:'下一页',exact:true})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));await screen.findByText('9007199254740993');
  expect(calls.find(call=>call.method.endsWith('dataQuery')).request.pageSize).toBeUndefined();
  expect(calls.some(call=>call.method.includes('dataWorkspace'))).toBe(false);
 });

 it('加载期间阻止编辑，晚到的 B 记忆不能覆盖重新选择的 A',async()=>{
  let finish;const {WB,calls}=setup();memoryHost(WB,calls,{loadDelay:id=>id==='inventory'?new Promise(resolve=>{finish=resolve}):undefined});
  cleanup();render(<WB.pages.toolbox/>);await screen.findByRole('checkbox',{name:'public.orders'});
  fireEvent.change(screen.getByRole('textbox',{name:'数据查询编辑器'}),{target:{value:'SELECT 71 AS from_a'}});
  fireEvent.click(savedConnections().getByRole('button',{name:/库存库 PostgreSQL/}));
  await waitFor(()=>expect(finish).toBeTypeOf('function'));
  expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).disabled).toBe(true);
  fireEvent.click(savedConnections().getByRole('button',{name:/订单库 PostgreSQL/}));
  await waitFor(()=>expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).disabled).toBe(false));
  await act(async()=>finish());await waitFor(()=>expect(calls.filter(call=>call.method.endsWith('dataWorkspaceLoad'))).toHaveLength(3));
  expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toBe('SELECT 71 AS from_a');
  expect(savedConnections().getByRole('button',{name:/订单库/,pressed:true})).toBeTruthy();
  expect(calls.some(call=>call.method.endsWith('dataQuery'))).toBe(false);
 });
 it('真实分页读取第201行以后，按服务端实际偏移前进和返回，改变页大小不自动执行',async()=>{
  const {WB,calls}=setup();memoryHost(WB,calls,{queryResponse:({pageSize,offset})=>{
   const count=offset===0?37:pageSize;
   return {columns:['id'],rows:Array.from({length:count},(_,index)=>({id:offset+index+1})),pageSize,offset,hasMore:offset<250,nextOffset:offset+count,durationMs:2,queriedAt:'2026-11-07T02:00:00Z',truncation:{byteLimit:offset===0,cellLimit:false,rowLimit:false}};
  }});
  cleanup();render(<WB.pages.toolbox/>);await screen.findByRole('checkbox',{name:'public.orders'});
  expect(screen.getByRole('region',{name:'数据库查询结果，可横向滚动'})).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox',{name:'数据查询编辑器'}),{target:{value:'SELECT id FROM orders ORDER BY id'}});
  fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));await screen.findByText('当前第 1–37 行');
  for(const start of [38,88,138,188]){
   fireEvent.click(screen.getByRole('button',{name:'下一页',exact:true}));
   await screen.findByText('当前第 '+start+'–'+(start+49)+' 行');
  }
  expect(within(screen.getByRole('region',{name:'数据库查询结果，可横向滚动'})).getByText('201')).toBeTruthy();
  expect(calls.filter(call=>call.method.endsWith('dataQuery')).map(call=>call.request.offset)).toEqual([0,37,87,137,187]);
  expect(screen.queryByText(/共.*页/)).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'上一页',exact:true}));await screen.findByText('当前第 138–187 行');
  expect(calls.filter(call=>call.method.endsWith('dataQuery')).at(-1).request.offset).toBe(137);
  fireEvent.change(screen.getByRole('combobox',{name:'每页行数'}),{target:{value:'100'}});
  expect(screen.getByRole('button',{name:'上一页',exact:true}).disabled).toBe(true);
  expect(screen.getByRole('button',{name:'下一页',exact:true}).disabled).toBe(true);
  expect(calls.filter(call=>call.method.endsWith('dataQuery'))).toHaveLength(6);
  fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));await screen.findByText('当前第 1–37 行');
  expect(calls.filter(call=>call.method.endsWith('dataQuery')).at(-1).request).toMatchObject({pageSize:100,offset:0});
  expect(screen.getByRole('button',{name:'复制当前页结果'})).toBeTruthy();
 });
 it('连接 A→B→A 恢复已保存的需求、AI回复、手动SQL、选择与历史结果，重挂载不自动查询',async()=>{
  const {WB,calls}=setup();memoryHost(WB,calls);
  // Remount starts with host capability discovery, as entering the real toolbox page does.
  cleanup();const mounted=render(<WB.pages.toolbox/>);
  await screen.findByRole('checkbox',{name:'public.orders'});
  fireEvent.click(screen.getByRole('checkbox',{name:'public.orders'}));
  fireEvent.change(screen.getByRole('textbox',{name:'数据库AI需求'}),{target:{value:'统计订单'}});
  fireEvent.click(screen.getByRole('button',{name:/^生成(?: SQL|查询|脚本)$/}));
  await screen.findByText('服务端保存的建议');
  fireEvent.change(screen.getByRole('textbox',{name:'数据库AI需求'}),{target:{value:'尚未发送的需求'}});
  fireEvent.change(screen.getByRole('textbox',{name:'数据查询编辑器'}),{target:{value:'SELECT 42 AS manual'}});
  fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));await screen.findByText('9007199254740993');
  fireEvent.click(savedConnections().getByRole('button',{name:/库存库 PostgreSQL/}));
  await waitFor(()=>expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toBe('SELECT 1 AS value'));
  expect(screen.queryByText('服务端保存的建议')).toBeNull();
  fireEvent.click(savedConnections().getByRole('button',{name:/订单库 PostgreSQL/}));
  await waitFor(()=>expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toBe('SELECT 42 AS manual'));
  expect(screen.getByRole('textbox',{name:'数据库AI需求'}).value).toBe('尚未发送的需求');
  expect(screen.getByRole('checkbox',{name:'public.orders'}).checked).toBe(true);
  expect(screen.getByText('服务端保存的建议')).toBeTruthy();
  expect(screen.getByText(/上次查询结果/)).toBeTruthy();
  mounted.unmount();render(<WB.pages.toolbox/>);
  await waitFor(()=>expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toBe('SELECT 42 AS manual'));
  expect(calls.filter(call=>call.method.endsWith('dataQuery'))).toHaveLength(1);
  expect(calls.filter(call=>call.method.endsWith('dataWorkspaceSave')).every(call=>!('aiTurns' in call.request.patch)&&!('form' in call.request.patch))).toBe(true);
 });
 it('默认选中首个已保存连接，不执行查询；手动新建后切换工具保留输入',async()=>{const {calls}=setup([{id:'first',name:'第一个库',kind:'postgres',host:'db.local',port:5432,database:'firstdb',unlocked:false},{id:'second',name:'第二个库',kind:'mysql'}]);await screen.findByRole('button',{name:/第一个库/,pressed:true});fireEvent.click(dataAction('连接配置'));expect(screen.getByRole('textbox',{name:'数据库名称'}).value).toBe('firstdb');fireEvent.click(screen.getByRole('button',{name:'关闭',exact:true}));expect(calls.map(c=>c.method)).toEqual(['workbench/dataConnections']);expect(screen.queryByText('切换工具会保留各自输入')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'新建连接',exact:true}));fireEvent.change(screen.getByRole('textbox',{name:'连接名称'}),{target:{value:'正在编辑'}});fireEvent.click(screen.getByRole('button',{name:'关闭',exact:true}));fireEvent.click(toolButton(/JSON 格式化/));fireEvent.click(toolButton(/数据连接 SQL/));await screen.findByRole('list',{name:'已保存连接'});expect(calls.length).toBe(2);expect(savedConnections().queryByRole('button',{pressed:true})).toBeNull();fireEvent.click(dataAction('连接配置'));expect(screen.getByRole('textbox',{name:'连接名称'}).value).toBe('正在编辑')})

 it('选择连接后只在该行下展开对应的对象',async()=>{
  const {WB,calls}=setup([
   {id:'pg',name:'订单库',kind:'postgres',unlocked:true},
   {id:'mysql',name:'库存库',kind:'mysql',unlocked:true},
   {id:'locked',name:'需要密码',kind:'postgres',unlocked:false},
  ]);
  const rpc=WB.rpc;
  WB.rpc=async(method,payload)=>{
   const response=await rpc(method,payload);
   return method.endsWith('dataObjects')?{objects:[{name:payload.request.id+'_orders'}]}:response;
  };
  const catalog=()=>within(screen.getByRole('region',{name:'表列表'}));
  await screen.findByRole('checkbox',{name:'pg_orders'});
  expect(savedConnections().getAllByRole('button',{name:/的更多操作$/})).toHaveLength(3);
  const current=savedConnections().getByRole('button',{name:/订单库 PostgreSQL/,pressed:true});
  fireEvent.click(current);
  fireEvent.click(savedConnections().getByRole('button',{name:/库存库 MySQL/,pressed:false}));
  await screen.findByRole('checkbox',{name:'mysql_orders'});
  expect(savedConnections().getByRole('button',{name:/库存库 MySQL/,pressed:true})).toBeTruthy();
  expect(catalog().queryByRole('checkbox',{name:'pg_orders'})).toBeNull();
  fireEvent.click(savedConnections().getByRole('button',{name:/需输入密码/}));
  expect(catalog().getByText('请在连接配置中输入密码并保存。')).toBeTruthy();
  expect(catalog().queryByRole('checkbox',{name:'mysql_orders'})).toBeNull();
  expect(calls.filter(c=>c.method.endsWith('dataObjects')).map(c=>c.request.id)).toEqual(['pg','mysql']);
  expect(calls.some(c=>c.method.endsWith('dataQuery'))).toBe(false);
 })

 it('从非当前行编辑连接，保存到该连接并保留当前 SQL 和对象',async()=>{
  const {WB,calls}=setup([
   {id:'orders',name:'订单库',kind:'postgres',database:'orders',unlocked:true},
   {id:'inventory',name:'库存库',kind:'postgres',database:'inventory',unlocked:false},
  ]);
  const rpc=WB.rpc;
  WB.rpc=async(method,payload)=>{
   if(!method.endsWith('dataSave'))return rpc(method,payload);
   calls.push({method,request:payload.request});
   return {config:payload.request,unlocked:true};
  };
  await screen.findByRole('checkbox',{name:'public.orders'});
  const editor=screen.getByRole('textbox',{name:'数据查询编辑器'});
  fireEvent.change(editor,{target:{value:'SELECT 42'}});
  fireEvent.click(dataAction('连接配置','库存库'));
  const dialog=within(screen.getByRole('dialog',{name:'连接配置'}));
  expect(dialog.getByRole('textbox',{name:'数据库名称'}).value).toBe('inventory');
  fireEvent.change(dialog.getByRole('textbox',{name:'连接名称'}),{target:{value:'库存备用库'}});
  fireEvent.click(dialog.getByRole('button',{name:'保存',exact:true}));
  await screen.findByRole('button',{name:/库存备用库 PostgreSQL/,pressed:false});
  expect(screen.getByRole('button',{name:/订单库 PostgreSQL/,pressed:true}).getAttribute('aria-expanded')).toBe('true');
  expect(editor.value).toBe('SELECT 42');
  expect(calls.find(call=>call.method.endsWith('dataSave')).request.id).toBe('inventory');
  expect(calls.filter(call=>call.method.endsWith('dataObjects')).map(call=>call.request.id)).toEqual(['orders']);
 })

 it('自动读取失败时可用刷新重试',async()=>{
  const {WB}=setup([{id:'fixture',name:'开发库',kind:'postgres',unlocked:true}]);
  const rpc=WB.rpc;
  WB.rpc=vi.fn().mockImplementationOnce(async(method,payload)=>{
   expect(method).toBe('workbench/dataObjects');
   expect(payload.request.id).toBe('fixture');
   throw Error('读取表列表超时');
  }).mockImplementation(rpc);
  await screen.findByRole('alert',{name:''});
  expect(screen.getByText('读取表列表超时')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'刷新表列表'}));
  await screen.findByRole('checkbox',{name:'public.orders'});
  expect(screen.queryByRole('alert')).toBeNull();
 })

 it('断开后丢弃仍在返回的表列表',async()=>{
  const {WB}=setup([{id:'fixture',name:'开发库',kind:'postgres',unlocked:true,rememberPassword:true}]);
  let finish;
  const rpc=WB.rpc;
  WB.rpc=(method,payload)=>method.endsWith('dataObjects')?new Promise(resolve=>{finish=resolve}):rpc(method,payload);
  await waitFor(()=>expect(finish).toBeTypeOf('function'));
  fireEvent.click(dataAction('停止并断开'));
  await screen.findByText(/本地连接已关闭/);
  finish({objects:[{name:'stale_orders'}]});
  await waitFor(()=>expect(screen.getByRole('button',{name:'刷新表列表'}).disabled).toBe(false));
  expect(screen.queryByRole('checkbox',{name:'stale_orders'})).toBeNull();
 })

 it('已保存连接须确认才删除，失败保留连接，成功后回到可重新选择的状态',async()=>{
  const {WB,calls}=setup();
  const fallback=WB.rpc;
  const connections=[
   {id:'orders',name:'订单连接',kind:'postgres',database:'orders',unlocked:false},
   {id:'inventory',name:'库存连接',kind:'mysql',database:'inventory',unlocked:false},
  ];
  let failOnce=true;
  WB.rpc=async(method,payload)=>{
   if(method.endsWith('dataConnections'))return {connections,capabilities:{deleteConnection:true}};
   if(method.endsWith('dataDelete')){
    calls.push({method,request:payload.request});
    if(failOnce){failOnce=false;throw Error('连接配置暂不可写')}
    return {deleted:payload.request.id};
   }
   return fallback(method,payload);
  };
  cleanup();render(<WB.pages.toolbox/>);
  await screen.findByRole('button',{name:/订单连接 PostgreSQL/,pressed:true});
  const open=()=>{
   fireEvent.click(dataAction('删除连接'));
   return within(screen.getByRole('dialog',{name:'删除连接'}));
  };
  const deletes=()=>calls.filter(call=>call.method.endsWith('dataDelete')).map(call=>call.request);
  const cancelled=open();
  expect(cancelled.getByText('订单连接 · orders')).toBeTruthy();
  fireEvent.click(cancelled.getByRole('button',{name:'取消'}));
  expect(deletes()).toEqual([]);
  const dialog=open();
  fireEvent.click(dialog.getByRole('button',{name:'确认删除'}));
  expect((await dialog.findByRole('alert')).textContent).toBe('连接配置暂不可写');
  expect(screen.getByRole('button',{name:/订单连接 PostgreSQL/,pressed:true})).toBeTruthy();
  fireEvent.click(dialog.getByRole('button',{name:'确认删除'}));
  await screen.findByText('连接已删除');
  expect(savedConnections().queryByRole('button',{name:/订单连接/})).toBeNull();
  expect(screen.getByRole('button',{name:'执行只读查询'}).disabled).toBe(true);
  fireEvent.click(savedConnections().getByRole('button',{name:/库存连接 MySQL/,pressed:false}));
  await screen.findByRole('button',{name:/库存连接 MySQL/,pressed:true});
  fireEvent.click(open().getByRole('button',{name:'确认删除'}));
  await screen.findByText('暂无已保存的连接');
  expect(deletes()).toEqual([{id:'orders',confirmed:true},{id:'orders',confirmed:true},{id:'inventory',confirmed:true}]);
  expect(calls.some(call=>/dataObjects|dataWorkspaceClear|dataQuery/.test(call.method))).toBe(false);
 })

 it('配置弹窗用草稿测试，保存后自动列出表并清空密码',async()=>{
  const {calls}=setup();await screen.findByText('暂无已保存的连接');
  expect(calls.map(call=>call.method)).toEqual(['workbench/dataConnections']);
  expect(screen.queryByRole('button',{name:'测试连接'})).toBeNull();
  fireEvent.click(dataAction('连接配置'));
  const dialog=within(screen.getByRole('dialog',{name:'新建连接'}));
  fireEvent.change(dialog.getByRole('textbox',{name:'连接名称'}),{target:{value:'草稿库'}});
  fireEvent.change(dialog.getByRole('textbox',{name:'数据库主机'}),{target:{value:'draft.local'}});
  fireEvent.change(dialog.getByRole('textbox',{name:'数据库名称'}),{target:{value:'draft_db'}});
  fireEvent.change(dialog.getByLabelText('数据库密码'),{target:{value:'draft-secret'}});
  fireEvent.click(dialog.getByRole('button',{name:'测试连接'}));
  await dialog.findByText('连接成功');
  expect(calls.find(call=>call.method.endsWith('dataTest')).request).toMatchObject({draft:{host:'draft.local',database:'draft_db',password:'draft-secret'}});
  expect(calls.some(call=>call.method.endsWith('dataSave'))).toBe(false);
  expect(calls.some(call=>call.method.endsWith('dataObjects'))).toBe(false);
  expect(dialog.getByLabelText('数据库密码').value).toBe('draft-secret');
  fireEvent.change(dialog.getByRole('textbox',{name:'数据库名称'}),{target:{value:'changed_db'}});
  expect(dialog.queryByText('连接成功')).toBeNull();
  fireEvent.click(dialog.getByRole('button',{name:'保存'}));
  await screen.findByRole('checkbox',{name:'public.orders'});
  expect(savedConnections().getByRole('button',{name:/开发库 PostgreSQL/,pressed:true})).toBeTruthy();
  await screen.findByText('连接配置已保存，密码不落盘');
  expect(calls.filter(call=>call.method.endsWith('dataObjects')).map(call=>call.request.id)).toEqual(['fixture']);
  fireEvent.click(dataAction('连接配置'));
  expect(screen.getByLabelText('数据库密码').value).toBe('');
 })
 it('PostgreSQL 用当前账号切换目标，失败时保留原工作区，切回后恢复 SQL',async()=>{
  const {WB,calls}=setup();
  const {records}=memoryHost(WB,calls);
  const fallback=WB.rpc;
  WB.rpc=async(method,payload)=>{
   const response=()=>fallback(method,payload);
   if(method.endsWith('dataConnections')){
    const value=await response();
    return {...value,capabilities:{...value.capabilities,postgresDatabases:true},connections:value.connections.map(item=>({...item,database:item.id}))};
   }
   if(method.endsWith('dataDatabases')){calls.push({method,request:payload.request});return {databases:['orders','inventory','restricted']}}
   if(method.endsWith('dataSwitchDatabase')){
    const {database}=payload.request;calls.push({method,request:payload.request});
    if(database==='restricted')throw Error('目标数据库拒绝连接');
    return {config:{id:database,name:database==='orders'?'订单库':'库存库',kind:'postgres',database},unlocked:true};
   }
   if(method.endsWith('dataObjects'))return {objects:[{schemaName:'public',name:payload.request.id+'_table'}]};
   return response();
  };
  cleanup();render(<WB.pages.toolbox/>);
  await screen.findByRole('checkbox',{name:'public.orders_table'});
  const editor=()=>screen.getByRole('textbox',{name:'数据查询编辑器'});
  fireEvent.change(editor(),{target:{value:'SELECT 101'}});
  const open=async()=>{
   fireEvent.click(dataAction('切换数据库'));
   const dialog=within(screen.getByRole('dialog',{name:'切换 PostgreSQL 数据库'}));
   await dialog.findByRole('radiogroup',{name:'目标数据库'});
   return dialog;
  };
  const dialog=await open();
  expect(dialog.getByRole('radio',{name:'orders'}).checked).toBe(true);
  const search=dialog.getByRole('searchbox',{name:'搜索数据库'});
  fireEvent.change(search,{target:{value:'RESTR'}});
  expect(dialog.queryByRole('radio',{name:'orders'})).toBeNull();
  expect(dialog.getByRole('button',{name:'切换'}).disabled).toBe(true);
  fireEvent.click(dialog.getByRole('radio',{name:'restricted'}));
  fireEvent.click(dialog.getByRole('button',{name:'切换'}));
  await dialog.findByText('目标数据库拒绝连接');
  expect(editor().value).toBe('SELECT 101');
  fireEvent.change(search,{target:{value:'invent'}});
  fireEvent.click(dialog.getByRole('radio',{name:'inventory'}));
  fireEvent.click(dialog.getByRole('button',{name:'切换'}));
  await screen.findByRole('checkbox',{name:'public.inventory_table'});
  expect(editor().value).toBe('SELECT 1 AS value');
  fireEvent.change(editor(),{target:{value:'SELECT 202'}});
  const back=await open();
  expect(back.getByRole('searchbox',{name:'搜索数据库'}).value).toBe('');
  fireEvent.click(back.getByRole('radio',{name:'orders'}));
  fireEvent.click(back.getByRole('button',{name:'切换'}));
  await screen.findByRole('checkbox',{name:'public.orders_table'});
  expect(editor().value).toBe('SELECT 101');
  expect(records.get('inventory').workspace.query).toBe('SELECT 202');
  expect(calls.filter(call=>call.method.endsWith('dataDatabases')).map(call=>call.request)).toEqual([{id:'orders'},{id:'inventory'}]);
  expect(calls.filter(call=>call.method.endsWith('dataSwitchDatabase')).map(call=>call.request)).toEqual([
   {id:'orders',database:'restricted'},{id:'orders',database:'inventory'},{id:'inventory',database:'orders'},
  ]);
  expect(calls.some(call=>call.method.endsWith('dataQuery'))).toBe(false);
 })
 it('库列表截断时可搜索全部数据库，库名匹配结果可直接选择',async()=>{
  const {WB,calls}=setup();
  const fallback=WB.rpc;
  WB.rpc=async(method,payload)=>{
   if(method.endsWith('dataConnections'))return {
    capabilities:{optionalSqlDatabase:true,databaseSearch:true},
    connections:[{id:'orders',name:'连接',kind:'mysql',database:'orders',unlocked:true}],
   };
   if(method.endsWith('dataDatabases')){
    calls.push({method,request:payload.request});
    return payload.request.query?{databases:['archive_2025']}:{databases:['orders','inventory'],truncated:true};
   }
   return fallback(method,payload);
  };
  cleanup();render(<WB.pages.toolbox/>);
  await screen.findByRole('checkbox',{name:'public.orders'});
  fireEvent.click(dataAction('切换数据库'));
  const dialog=within(await screen.findByRole('dialog',{name:'切换 MySQL 数据库'}));
  const search=await dialog.findByRole('searchbox',{name:'搜索数据库'});
  fireEvent.change(search,{target:{value:'ARCHIVE'}});
  expect(dialog.getByText('没有匹配的数据库。')).toBeTruthy();
  fireEvent.click(dialog.getByRole('button',{name:'搜索全部'}));
  fireEvent.click(await dialog.findByRole('radio',{name:'archive_2025'}));
  expect(dialog.getByRole('button',{name:'切换'}).disabled).toBe(false);
  expect(calls.filter(call=>call.method.endsWith('dataDatabases')).map(call=>call.request)).toEqual([{id:'orders'},{id:'orders',query:'ARCHIVE'}]);
 })
 it.each([['mysql','MySQL'],['postgres','PostgreSQL']])('%s 留空库名可测试并保存，选库前无法运行 SQL',async(kind,label)=>{
  const {WB,calls}=setup();
  const fallback=WB.rpc;
  WB.rpc=async(method,payload)=>{
   if(method.endsWith('dataConnections'))return {connections:[],capabilities:{optionalSqlDatabase:true}};
   if(method.endsWith('dataSave')||method.endsWith('dataDatabases')||method.endsWith('dataSwitchDatabase')){
    const request=payload.request;
    calls.push({method,request});
    if(method.endsWith('dataSave'))return {config:{...request,id:'account',kind,database:''},unlocked:true};
    if(method.endsWith('dataDatabases'))return {databases:['fixture']};
    return {config:{id:'target',kind,name:'账号',database:request.database},unlocked:true};
   }
   return fallback(method,payload);
  };
  cleanup();render(<WB.pages.toolbox/>);
  await screen.findByText('暂无已保存的连接');
  fireEvent.click(dataAction('连接配置'));
  const config=within(screen.getByRole('dialog',{name:'新建连接'}));
  fireEvent.change(config.getByRole('combobox',{name:'数据库类型'}),{target:{value:kind}});
  fireEvent.change(config.getByRole('textbox',{name:'连接名称'}),{target:{value:'账号'}});
  const database=config.getByRole('textbox',{name:'数据库名称'});
  expect(database.required).toBe(false);
  expect(database.value).toBe('');
  fireEvent.click(config.getByRole('button',{name:'测试连接'}));
  await config.findByText('连接成功');
  expect(calls.find(call=>call.method.endsWith('dataTest')).request.draft.database).toBe('');
  fireEvent.click(config.getByRole('button',{name:'保存'}));
  const dialogName='选择 '+label+' 数据库';
  const first=within(await screen.findByRole('dialog',{name:dialogName}));
  await first.findByRole('radio',{name:'fixture'});
  fireEvent.click(first.getByRole('button',{name:'关闭'}));
  expect(screen.getByRole('button',{name:'执行只读查询'}).disabled).toBe(true);
  fireEvent.keyDown(screen.getByRole('textbox',{name:'数据查询编辑器'}),{key:'Enter',ctrlKey:true});
  expect(calls.some(call=>/dataObjects|dataQuery/.test(call.method))).toBe(false);
  fireEvent.click(dataAction('选择数据库'));
  const dialog=within(await screen.findByRole('dialog',{name:dialogName}));
  fireEvent.click(await dialog.findByRole('radio',{name:'fixture'}));
  fireEvent.click(dialog.getByRole('button',{name:'连接'}));
  await screen.findByRole('checkbox',{name:'public.orders'});
  expect(calls.find(call=>call.method.endsWith('dataSwitchDatabase')).request).toEqual({id:'account',database:'fixture'});
  expect(calls.filter(call=>call.method.endsWith('dataObjects')).map(call=>call.request.id)).toEqual(['target']);
  expect(screen.getByRole('button',{name:'执行只读查询'}).disabled).toBe(false);
 })
 it('旧宿主仍校验必填字段，失败时定位输入框且不发送请求',async()=>{
  const {calls}=setup();await screen.findByText('暂无已保存的连接');
  fireEvent.click(screen.getByRole('button',{name:'新建连接',exact:true}));
  const dialog=within(screen.getByRole('dialog',{name:'新建连接'}));
  const name=dialog.getByRole('textbox',{name:'连接名称'});
  const database=dialog.getByRole('textbox',{name:'数据库名称'});
  fireEvent.change(name,{target:{value:'   '}});
  fireEvent.click(dialog.getByRole('button',{name:'保存'}));
  expect(dialog.getByRole('alert').textContent).toBe('请填写连接名称');
  expect(name.getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(name);
  fireEvent.change(name,{target:{value:'测试库'}});
  fireEvent.click(dialog.getByRole('button',{name:'测试连接'}));
  expect(dialog.getByRole('alert').textContent).toBe('请填写数据库名称');
  expect(document.activeElement).toBe(database);
  expect(calls.map(call=>call.method)).toEqual(['workbench/dataConnections']);
 })
 it('配置已保存时立即显示连接，读取表失败有独立反馈',async()=>{
  const {WB,calls}=setup();await screen.findByText('暂无已保存的连接');
  const rpc=WB.rpc;
  WB.rpc=vi.fn(async(method,payload)=>{
   if(method.endsWith('dataObjects'))throw Error('无法连接到数据库');
   return rpc(method,payload);
  });
  fireEvent.click(screen.getByRole('button',{name:'新建连接',exact:true}));
  fireEvent.change(screen.getByRole('textbox',{name:'连接名称'}),{target:{value:'开发库'}});
  fireEvent.change(screen.getByRole('textbox',{name:'数据库名称'}),{target:{value:'fixture'}});
  fireEvent.click(screen.getByRole('button',{name:'保存'}));
  await screen.findByText(/读取表列表失败.*无法连接到数据库/);
  expect(screen.getByText('连接配置已保存，密码不落盘')).toBeTruthy();
  expect(savedConnections().getByRole('button',{name:/开发库 PostgreSQL/,pressed:true})).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(calls.filter(call=>call.method.endsWith('dataSave'))).toHaveLength(1);
 })
 it('记住密码默认关闭，勾选保存后密码输入框仍为空',async()=>{
  const {calls}=setup();
  fireEvent.click(dataAction('连接配置'));
  const checkbox=await screen.findByRole('checkbox',{name:'记住密码'});
  expect(checkbox.checked).toBe(false);
  fireEvent.change(screen.getByRole('textbox',{name:'连接名称'}),{target:{value:'开发库'}});
  fireEvent.change(screen.getByRole('textbox',{name:'数据库名称'}),{target:{value:'fixture'}});
  fireEvent.change(screen.getByLabelText('数据库密码'),{target:{value:'fixture-secret'}});
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole('button',{name:'保存'}));
  await screen.findByRole('checkbox',{name:'public.orders'});
  await screen.findByText('连接配置已保存，已记住密码');
  expect(calls.find(call=>call.method.endsWith('dataSave')).request.rememberPassword).toBe(true);
  fireEvent.click(dataAction('连接配置'));
  expect(screen.getByRole('checkbox',{name:'记住密码'}).checked).toBe(true);
  expect(screen.getByLabelText('数据库密码').value).toBe('');
 })
 it('会话生成保留原 SQL，选择填入后才更新编辑器，执行携带结构版本',async()=>{
  const {WB,calls}=setup();
  const copy=vi.spyOn(WB.util,'copy').mockResolvedValue();
  await save();await selectTable();
  const editor=screen.getByRole('textbox',{name:'数据查询编辑器'});
  fireEvent.change(editor,{target:{value:'SELECT 42'}});
  fireEvent.change(screen.getByRole('textbox',{name:'数据库AI需求'}),{target:{value:'查询订单'}});
  fireEvent.click(screen.getByRole('button',{name:/^生成(?: SQL|查询|脚本)$/}));
  await screen.findByText('根据订单结构生成');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(editor.value).toBe('SELECT 42');
  expect(calls.some(c=>c.method.endsWith('dataQuery'))).toBe(false);
  const generation=calls.find(c=>c.method.endsWith('dataGenerate')).request;
  expect(generation).toMatchObject({selected:[{schemaName:'public',name:'orders'}],conversation:true,history:[]});
  expect(JSON.stringify(generation)).not.toContain('fixture-secret');
  fireEvent.click(screen.getByRole('button',{name:'填入 SQL 编辑器'}));
  expect(editor.value).toBe('SELECT id FROM public.orders');
  fireEvent.click(screen.getByRole('button',{name:'复制 SQL'}));
  expect(copy).toHaveBeenCalledWith('SELECT id FROM public.orders');
  fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));
  await screen.findByText('9007199254740993');
  expect(calls.find(c=>c.method.endsWith('dataQuery')).request).toMatchObject({schemaHash:'schema-v1',query:'SELECT id FROM public.orders',id:'fixture'});
 })
 it('变更脚本在会话中保留回滚预览，填入编辑器后禁止执行',async()=>{
  const {calls}=setup();await save();await selectTable();
  const input=screen.getByRole('textbox',{name:'数据库AI需求'});
  fireEvent.change(input,{target:{value:'增加code字段'}});
  fireEvent.click(screen.getByRole('button',{name:'变更脚本',exact:true}));
  expect(input.value).toBe('增加code字段');
  expect(screen.getByText('仅预览，不能执行')).toBeTruthy();
  expect(screen.queryByRole('group',{name:'试试这样问'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'返回查询',exact:true}));
  expect(screen.getByRole('group',{name:'试试这样问'})).toBeTruthy();
  expect(calls.some(call=>call.method.endsWith('dataGenerate'))).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'变更脚本',exact:true}));
  fireEvent.click(screen.getByRole('button',{name:'生成脚本',exact:true}));
  await screen.findByText('回滚建议（仅预览）');
  expect(calls.find(call=>call.method.endsWith('dataGenerate')).request.mode).toBe('script');
  fireEvent.click(screen.getByRole('button',{name:'在编辑器预览脚本'}));
  expect(screen.getByRole('button',{name:'执行只读查询'}).disabled).toBe(true);
 })
 it('SQL 留空选表时可生成，执行时按实际选中的表校验结构',async()=>{
  const {WB,calls}=setup();await save();
  const selected=[{schemaName:'public',name:'orders'},{schemaName:'public',name:'order_items'}];
  const rpc=WB.rpc;
  WB.rpc=async(method,payload)=>{
   const response=await rpc(method,payload);
   return method.endsWith('dataGenerate')?{...response,selected}:response;
  };
  fireEvent.change(screen.getByRole('textbox',{name:'数据库AI需求'}),{target:{value:'统计订单金额'}});
  fireEvent.click(screen.getByRole('button',{name:/^生成(?: SQL|查询|脚本)$/}));
  fireEvent.click(await screen.findByRole('button',{name:'填入 SQL 编辑器'}));
  expect(within(screen.getByRole('region',{name:'表列表'})).queryByText(/本次使用的表/)).toBeNull();
  expect(within(screen.getByRole('complementary',{name:'数据库 AI 会话'})).getByText(/使用对象 · public.orders、public.order_items/)).toBeTruthy();
  expect(calls.find(call=>call.method.endsWith('dataGenerate')).request.selected).toEqual([]);
  expect(calls.some(call=>call.method.endsWith('dataQuery'))).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));
  await screen.findByText('9007199254740993');
  expect(calls.find(call=>call.method.endsWith('dataQuery')).request).toMatchObject({selected,schemaHash:'schema-v1'});
 })
 it('宿主未加载自动选表时提示重启，避免发送空表请求',async()=>{
  const {calls}=setup([],false);await save();
  fireEvent.change(screen.getByRole('textbox',{name:'数据库AI需求'}),{target:{value:'查询用户'}});
  expect(screen.getByText(/当前宿主尚未加载自动选表/)).toBeTruthy();
  const send=screen.getByRole('button',{name:/^生成(?: SQL|查询|脚本)$/});
  expect(send.disabled).toBe(true);fireEvent.click(send);
  expect(calls.some(call=>call.method.endsWith('dataGenerate'))).toBe(false);
 })
 it('左右两栏独立收起，保留选表和草稿，手动 SQL 查询仍可用',async()=>{
  const {calls}=setup();await save();await selectTable();
  expect(screen.queryByText('宿主联网调试')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'收起连接'}));
  expect(screen.queryByRole('complementary',{name:'连接与对象'})).toBeNull();
  expect(screen.getByRole('complementary',{name:'数据库 AI 会话'})).toBeTruthy();
  const input=screen.getByRole('textbox',{name:'数据库AI需求'});
  fireEvent.change(input,{target:{value:'还在输入的需求'}});
  fireEvent.click(screen.getByRole('button',{name:'收起 AI 会话'}));
  expect(screen.queryByRole('textbox',{name:'数据库AI需求'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'展开 AI 会话'}));
  expect(screen.getByRole('textbox',{name:'数据库AI需求'}).value).toBe('还在输入的需求');
  fireEvent.click(screen.getByRole('button',{name:'展开连接'}));
  expect(screen.getByRole('checkbox',{name:'public.orders'}).checked).toBe(true);
  fireEvent.change(screen.getByRole('textbox',{name:'数据查询编辑器'}),{target:{value:'SELECT 42 AS answer'}});
  fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));
  await screen.findByText('9007199254740993');
  expect(calls.find(c=>c.method.endsWith('dataQuery')).request.query).toBe('SELECT 42 AS answer');
  expect(calls.some(c=>c.method.endsWith('dataGenerate'))).toBe(false);
 })
 it('AI 可追问澄清，同一连接带上前文，切换连接时清空对话上下文',async()=>{
  const {WB,calls}=setup([
   {id:'orders',name:'订单库',kind:'postgres',unlocked:true},
   {id:'inventory',name:'库存库',kind:'postgres',unlocked:true},
  ]);
  await screen.findByRole('checkbox',{name:'public.orders'});
  const rpc=WB.rpc;
  WB.rpc=async(method,payload)=>{
   const result=await rpc(method,payload);
   if(method.endsWith('dataGenerate')&&payload.request.instruction==='统计订单')return {clarification:'需要哪段时间？'};
   return result;
  };
  const input=screen.getByRole('textbox',{name:'数据库AI需求'});
  fireEvent.change(input,{target:{value:'统计订单'}});
  fireEvent.click(screen.getByRole('button',{name:/^生成(?: SQL|查询|脚本)$/}));
  await screen.findByText('需要哪段时间？');
  fireEvent.change(input,{target:{value:'最近七天'}});
  fireEvent.click(screen.getByRole('button',{name:/^生成(?: SQL|查询|脚本)$/}));
  await screen.findByRole('button',{name:'填入 SQL 编辑器'});
  expect(calls.filter(call=>call.method.endsWith('dataGenerate')).at(-1).request.history).toEqual([{instruction:'统计订单',explanation:'需要哪段时间？'}]);
  fireEvent.click(savedConnections().getByRole('button',{name:/库存库 PostgreSQL/}));
  await waitFor(()=>expect(screen.queryByText('需要哪段时间？')).toBeNull());
  expect(screen.queryByRole('button',{name:'填入 SQL 编辑器'})).toBeNull();
 })
 it('结构错误不冒充成功且保留编辑内容',async()=>{const {WB}=setup();await save();const original=WB.rpc;WB.rpc=vi.fn((method,payload)=>method.endsWith('dataQuery')?Promise.reject(Error('结构已变化，请重新生成查询')):original(method,payload));fireEvent.change(screen.getByRole('textbox',{name:'数据查询编辑器'}),{target:{value:'SELECT 42'}});fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));await screen.findByRole('alert');expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toBe('SELECT 42');expect(screen.queryByText('查询完成')).toBeNull()})
 it('查询中阻止重复提交，停止只发送当前连接ID',async()=>{const {WB,calls}=setup();await save();let reject;const original=WB.rpc;WB.rpc=vi.fn((method,payload)=>method.endsWith('dataQuery')?new Promise((_,r)=>reject=r):original(method,payload));fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));expect(screen.getByRole('button',{name:'执行只读查询'}).disabled).toBe(true);fireEvent.click(dataAction('停止并断开'));await waitFor(()=>expect(calls.some(c=>c.method.endsWith('dataDisconnect'))).toBe(true));reject(Error('操作已停止'));await screen.findByRole('alert');expect(calls.find(c=>c.method.endsWith('dataDisconnect')).request).toEqual({id:'fixture'})})
 it('ES和Redis直接使用各自的编辑输入，不展示SQL变更模式',async()=>{setup();fireEvent.click(dataAction('连接配置'));fireEvent.change(screen.getByRole('combobox',{name:'数据库类型'}),{target:{value:'es'}});expect(screen.getByRole('textbox',{name:'ES URL'})).toBeTruthy();expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toContain('match_all');expect(screen.queryByRole('button',{name:'变更脚本',exact:true})).toBeNull();fireEvent.change(screen.getByRole('combobox',{name:'数据库类型'}),{target:{value:'redis'}});expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toContain('TYPE');expect(screen.queryByRole('button',{name:'变更脚本',exact:true})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'关闭',exact:true}));expect(screen.queryByRole('tab',{name:'对象'})).toBeNull()})
})
