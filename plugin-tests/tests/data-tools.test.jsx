import {toolButton,openTools} from './tool-picker.mjs'
import React from 'react'
import {describe,it,expect,vi,afterEach} from 'vitest'
import {render,screen,fireEvent,waitFor,cleanup,within} from '@testing-library/react'
import {loadClientBundle} from './load-plugin.mjs'
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
 fireEvent.click(screen.getByRole('button',{name:'连接配置',exact:true}));
 fireEvent.change(screen.getByRole('combobox',{name:'数据库类型'}),{target:{value:'postgres'}});
 fireEvent.change(screen.getByRole('textbox',{name:'连接名称'}),{target:{value:'开发库'}});
 fireEvent.change(screen.getByRole('textbox',{name:'数据库名称'}),{target:{value:'fixture'}});
 fireEvent.change(screen.getByLabelText('数据库密码'),{target:{value:'fixture-secret'}});
 fireEvent.click(screen.getByRole('button',{name:'保存'}));
 await screen.findByRole('checkbox',{name:'public.orders'});
}
async function selectTable(){const check=await screen.findByRole('checkbox',{name:'public.orders'});fireEvent.click(check)}
describe('数据连接工具',()=>{
 it('默认选中首个已保存连接，不执行查询；手动新建后切换工具保留输入',async()=>{const {calls}=setup([{id:'first',name:'第一个库',kind:'postgres',host:'db.local',port:5432,database:'firstdb',unlocked:false},{id:'second',name:'第二个库',kind:'mysql'}]);await screen.findByRole('button',{name:/第一个库/,pressed:true});fireEvent.click(screen.getByRole('button',{name:'连接配置',exact:true}));expect(screen.getByRole('textbox',{name:'数据库名称'}).value).toBe('firstdb');fireEvent.click(screen.getByRole('button',{name:'关闭',exact:true}));expect(calls.map(c=>c.method)).toEqual(['workbench/dataConnections']);expect(screen.queryByText('切换工具会保留各自输入')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'新建连接',exact:true}));fireEvent.change(screen.getByRole('textbox',{name:'连接名称'}),{target:{value:'正在编辑'}});fireEvent.click(screen.getByRole('button',{name:'关闭',exact:true}));fireEvent.click(toolButton(/JSON 格式化/));fireEvent.click(toolButton(/数据连接 SQL/));await screen.findByRole('list',{name:'已保存连接'});expect(calls.length).toBe(2);expect(savedConnections().queryByRole('button',{pressed:true})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'连接配置',exact:true}));expect(screen.getByRole('textbox',{name:'连接名称'}).value).toBe('正在编辑')})

 it('直接显示已保存连接，点击后高亮当前连接并在下方自动换表',async()=>{
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
  const catalog=within(screen.getByRole('region',{name:'表列表'}));
  await catalog.findByRole('checkbox',{name:'pg_orders'});
  expect(savedConnections().getAllByRole('button')).toHaveLength(3);
  const current=savedConnections().getByRole('button',{name:/订单库 PostgreSQL/,pressed:true});
  fireEvent.click(current);
  fireEvent.click(savedConnections().getByRole('button',{name:/库存库 MySQL/,pressed:false}));
  await catalog.findByRole('checkbox',{name:'mysql_orders'});
  expect(savedConnections().getByRole('button',{name:/库存库 MySQL/,pressed:true})).toBeTruthy();
  expect(catalog.queryByRole('checkbox',{name:'pg_orders'})).toBeNull();
  fireEvent.click(savedConnections().getByRole('button',{name:/需输入密码/}));
  expect(catalog.getByText('请在连接配置中输入密码并保存。')).toBeTruthy();
  expect(catalog.queryByRole('checkbox',{name:'mysql_orders'})).toBeNull();
  expect(calls.filter(c=>c.method.endsWith('dataObjects')).map(c=>c.request.id)).toEqual(['pg','mysql']);
  expect(calls.some(c=>c.method.endsWith('dataQuery'))).toBe(false);
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
  fireEvent.click(await screen.findByRole('button',{name:'停止并断开'}));
  await screen.findByText(/本地连接已关闭/);
  finish({objects:[{name:'stale_orders'}]});
  await waitFor(()=>expect(screen.getByRole('button',{name:'刷新表列表'}).disabled).toBe(false));
  expect(screen.queryByRole('checkbox',{name:'stale_orders'})).toBeNull();
 })

 it('配置弹窗用草稿测试，保存后自动列出表并清空密码',async()=>{
  const {calls}=setup();await screen.findByText('暂无已保存的连接');
  expect(calls.map(call=>call.method)).toEqual(['workbench/dataConnections']);
  expect(screen.queryByRole('button',{name:'测试连接'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'连接配置',exact:true}));
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
  fireEvent.click(screen.getByRole('button',{name:'连接配置',exact:true}));
  expect(screen.getByLabelText('数据库密码').value).toBe('');
 })
 it('必填项缺失时定位输入框，保存和测试均不发送请求',async()=>{
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
  fireEvent.click(screen.getByRole('button',{name:'连接配置',exact:true}));
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
  fireEvent.click(screen.getByRole('button',{name:'连接配置',exact:true}));
  expect(screen.getByRole('checkbox',{name:'记住密码'}).checked).toBe(true);
  expect(screen.getByLabelText('数据库密码').value).toBe('');
 })
 it('根据勾选结构生成查询，生成不执行，执行携带结构版本',async()=>{const {WB,calls}=setup();const copy=vi.spyOn(WB.util,'copy').mockResolvedValue();await save();await selectTable();fireEvent.click(screen.getByRole('button',{name:'AI 生成',exact:true}));fireEvent.change(screen.getByRole('textbox',{name:'数据库AI需求'}),{target:{value:'查询订单'}});fireEvent.click(screen.getByRole('button',{name:'生成并填入'}));await screen.findByText('根据订单结构生成');expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toBe('SELECT id FROM public.orders');fireEvent.click(screen.getByRole('button',{name:'复制 SQL'}));expect(copy).toHaveBeenCalledWith('SELECT id FROM public.orders');expect(calls.some(c=>c.method.endsWith('dataQuery'))).toBe(false);const gen=calls.find(c=>c.method.endsWith('dataGenerate')).request;expect(gen.selected).toEqual([{schemaName:'public',name:'orders'}]);expect(JSON.stringify(gen)).not.toContain('fixture-secret');fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));await screen.findByText('9007199254740993');expect(calls.find(c=>c.method.endsWith('dataQuery')).request).toMatchObject({schemaHash:'schema-v1',query:'SELECT id FROM public.orders',id:'fixture'})})
 it('变更脚本有回滚预览，执行按钮禁用',async()=>{setup();await save();await selectTable();fireEvent.click(screen.getByRole('button',{name:'AI 生成',exact:true}));fireEvent.change(screen.getByRole('textbox',{name:'数据库AI需求'}),{target:{value:'增加code字段'}});fireEvent.change(screen.getByRole('combobox',{name:'数据库生成模式'}),{target:{value:'script'}});fireEvent.click(screen.getByRole('button',{name:'生成并填入'}));await screen.findByText('回滚建议（仅预览）');expect(screen.getByRole('button',{name:'执行只读查询'}).disabled).toBe(true)})
 it('SQL 留空选表时可生成，执行时按实际选中的表校验结构',async()=>{
  const {WB,calls}=setup();await save();
  const selected=[{schemaName:'public',name:'orders'},{schemaName:'public',name:'order_items'}];
  const rpc=WB.rpc;
  WB.rpc=async(method,payload)=>{
   const response=await rpc(method,payload);
   return method.endsWith('dataGenerate')?{...response,selected}:response;
  };
  fireEvent.click(screen.getByRole('button',{name:'AI 生成',exact:true}));
  fireEvent.change(screen.getByRole('textbox',{name:'数据库AI需求'}),{target:{value:'统计订单金额'}});
  fireEvent.click(screen.getByRole('button',{name:'生成并填入'}));
  await within(screen.getByRole('region',{name:'表列表'})).findByText(/本次使用的表 · public.orders、public.order_items/);
  expect(calls.find(call=>call.method.endsWith('dataGenerate')).request.selected).toEqual([]);
  expect(calls.some(call=>call.method.endsWith('dataQuery'))).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));
  await screen.findByText('9007199254740993');
  expect(calls.find(call=>call.method.endsWith('dataQuery')).request).toMatchObject({selected,schemaHash:'schema-v1'});
 })
 it('宿主未加载自动选表时提示重启，避免发送空表请求',async()=>{
  const {calls}=setup([],false);await save();
  fireEvent.click(screen.getByRole('button',{name:'AI 生成',exact:true}));
  fireEvent.change(screen.getByRole('textbox',{name:'数据库AI需求'}),{target:{value:'查询用户'}});
  expect(screen.getByText(/当前宿主尚未加载自动选表/)).toBeTruthy();
  const generate=screen.getByRole('button',{name:'生成并填入'});
  expect(generate.disabled).toBe(true);fireEvent.click(generate);
  expect(calls.some(call=>call.method.endsWith('dataGenerate'))).toBe(false);
 })
 it('顶部AI入口按需打开，未选结构不能生成；粘贴SQL可直接查询',async()=>{const {calls}=setup();expect(screen.queryByRole('textbox',{name:'数据库AI需求'})).toBeNull();const entry=screen.getByRole('button',{name:'AI 生成',exact:true});expect(entry.closest('.wb-data-query-head')).toBeTruthy();fireEvent.click(entry);expect(screen.getByRole('button',{name:'生成并填入'}).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'关闭',exact:true}));await save();fireEvent.change(screen.getByRole('textbox',{name:'数据查询编辑器'}),{target:{value:'SELECT 42 AS answer'}});fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));await screen.findByText('9007199254740993');expect(calls.find(c=>c.method.endsWith('dataQuery')).request.query).toBe('SELECT 42 AS answer');expect(calls.some(c=>c.method.endsWith('dataGenerate'))).toBe(false)})
 it('结构错误不冒充成功且保留编辑内容',async()=>{const {WB}=setup();await save();const original=WB.rpc;WB.rpc=vi.fn((method,payload)=>method.endsWith('dataQuery')?Promise.reject(Error('结构已变化，请重新生成查询')):original(method,payload));fireEvent.change(screen.getByRole('textbox',{name:'数据查询编辑器'}),{target:{value:'SELECT 42'}});fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));await screen.findByRole('alert');expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toBe('SELECT 42');expect(screen.queryByText('查询完成')).toBeNull()})
 it('查询中阻止重复提交，停止只发送当前连接ID',async()=>{const {WB,calls}=setup();await save();let reject;const original=WB.rpc;WB.rpc=vi.fn((method,payload)=>method.endsWith('dataQuery')?new Promise((_,r)=>reject=r):original(method,payload));fireEvent.click(screen.getByRole('button',{name:'执行只读查询'}));expect(screen.getByRole('button',{name:'执行只读查询'}).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'停止并断开'}));await waitFor(()=>expect(calls.some(c=>c.method.endsWith('dataDisconnect'))).toBe(true));reject(Error('操作已停止'));await screen.findByRole('alert');expect(calls.find(c=>c.method.endsWith('dataDisconnect')).request).toEqual({id:'fixture'})})
 it('ES和Redis直接使用各自的编辑输入，不展示SQL变更模式',async()=>{setup();fireEvent.click(screen.getByRole('button',{name:'连接配置',exact:true}));fireEvent.change(screen.getByRole('combobox',{name:'数据库类型'}),{target:{value:'es'}});expect(screen.getByRole('textbox',{name:'ES URL'})).toBeTruthy();expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toContain('match_all');expect(screen.queryByRole('option',{name:'变更脚本（仅预览）'})).toBeNull();fireEvent.change(screen.getByRole('combobox',{name:'数据库类型'}),{target:{value:'redis'}});expect(screen.getByRole('textbox',{name:'数据查询编辑器'}).value).toContain('TYPE');expect(screen.getByRole('textbox',{name:'Redis Key模式'})).toBeTruthy()})
})
