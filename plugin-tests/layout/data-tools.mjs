/** Browser layout against synthetic DB metadata/results; no database access. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const out='/tmp/workbench-data-layout';mkdirSync(out,{recursive:true})
// Focused source mode never writes generated root artifacts. Default still tests the shipped bundle.
const source=process.env.WORKBENCH_DATA_SOURCE==='1';
const client=source?await build({entryPoints:[resolve('src/client.ts')],bundle:true,write:false,target:'es2022',platform:'browser',format:'cjs',external:['react','react/*'],loader:{'.svg':'dataurl'},define:{__WORKBENCH_VERSION__:'"layout-source"'},logLevel:'silent'}):null;
const clientCode=client?'window.__ModuleLoader__.load({id:"data-source-layout",factory(require){const module={exports:{}};const exports=module.exports;'+client.outputFiles[0].text+';return module.exports}});':readFileSync('client.js','utf8');
const built=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'}),browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage(),errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee;--dsw-alias-state-error-primary:#d22}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>');await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:clientCode});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor();
 await page.evaluate(()=>{
  let saved,memory={},revision=0;
  const envelope=()=>({id:saved?.id||'',key:saved?'fixture-target':'',revision,workspace:memory,updatedAt:'2026-11-07T02:00:00Z'});
  window.resetDataFixture=()=>{memory={};revision++;window.fixtureEmpty=false;window.fixtureQueries=[]};
  window.WB.rpc=async(method,payload)=>{
   const request=payload?.request||{};
   if(method.endsWith('dataConnections'))return {connections:saved?[saved]:[],capabilities:{autoTableSelection:true,rememberPassword:true,workspaceMemory:true,queryPagination:true}};
   if(method.endsWith('dataWorkspaceLoad'))return request.id===''?{id:'',key:'',revision:0,workspace:{}}:envelope();
   if(method.endsWith('dataWorkspaceSave')){if(request.revision!==revision)throw Error('合成工作区修订冲突');memory={...memory,...request.patch};revision++;return envelope()}
   if(method.endsWith('dataWorkspaceClear')){memory={};revision++;return envelope()}
   if(method.endsWith('dataTest'))return {note:'连接成功'};
   if(method.endsWith('dataSave')){saved={...request,id:'fixture',password:undefined,unlocked:true};return {config:saved}}
   if(method.endsWith('dataObjects'))return {objects:[{schemaName:'public',name:'orders_long_name_'.repeat(8),comment:'合成订单表'}]};
   if(method.endsWith('dataGenerate')){
    const draft={query:'SELECT id FROM orders ORDER BY id',explanation:'已按所选结构生成',mode:'query',schemaHash:'fixture-schema',selected:request.selected};
    memory={...memory,aiTurns:[{instruction:request.instruction,draft}]};revision++;
    return {...draft,workspace:envelope()};
   }
   if(method.endsWith('dataQuery')){
    window.fixtureQueries.push(request);
    const columns=['id',...Array.from({length:7},(_,index)=>'long_column_'+index+'_'.repeat(30))],offset=request.offset||0,pageSize=request.pageSize||50;
    const rows=window.fixtureEmpty?[]:Array.from({length:pageSize},(_,index)=>Object.fromEntries(columns.map((column,col)=>[column,col===0?offset+index+1:'长文本'+col+' · '+('完整值 '.repeat(120))])));
    return {columns,rows,pageSize,offset,hasMore:!window.fixtureEmpty&&offset<200,nextOffset:offset+rows.length,queriedAt:'2026-11-07T02:00:00Z',truncation:{rowLimit:false,byteLimit:false,cellLimit:false},durationMs:2};
   }
   return {note:'fixture'};
  };
 });
 for(const width of [1280,980,800,560,360])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:700});await page.evaluate(theme=>{document.documentElement.className=theme;document.documentElement.style.zoom='1';window.WB.go('dashboard')},theme);await page.evaluate(()=>window.resetDataFixture());await page.evaluate(()=>window.WB.go('toolbox'));await page.getByRole('textbox',{name:'数据库AI需求'}).waitFor();
  const viewport=page.locator('.wb-data-result-viewport');
  async function measure(stage){
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   if(await page.locator('.wb-root').count()!==1)throw Error('工作台重复渲染');
   await page.evaluate(()=>{for(const animation of document.getAnimations()){if(animation.effect?.getComputedTiming().iterations!==Infinity)animation.finish()}});
   const m=await page.locator('.wb-scroll').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,dialogOverflow:[...document.querySelectorAll('.wb-modal')].reduce((max,dialog)=>Math.max(max,dialog.scrollWidth-dialog.clientWidth,dialog.getBoundingClientRect().right-innerWidth,-dialog.getBoundingClientRect().left),0)}));
   const result=await viewport.evaluate(el=>({height:el.clientHeight,width:el.clientWidth,horizontal:el.scrollWidth-el.clientWidth,vertical:el.scrollHeight-el.clientHeight}));
   if(await viewport.isVisible()&&(result.height<32||result.height>700))throw Error(stage+': 结果视口未在工具内部自适应: '+JSON.stringify(result));
   report.push({width,theme,stage,...m,result});await page.screenshot({path:resolve(out,`${width}-${theme}-${stage}.png`),animations:'disabled'});
  }
  const editor=page.locator('textarea[aria-label="数据查询编辑器"]'),conversation=page.getByRole('complementary',{name:'数据库 AI 会话'});
  const compact=await page.getByRole('tab',{name:'SQL 与结果',exact:true}).count()>0;
  if(!await conversation.isVisible()||!await page.getByRole('button',{name:'生成 SQL',exact:true}).isVisible())throw Error('AI 不是默认主入口');
  await measure('ai-entry');
  const composer=await conversation.locator('.wb-data-ai-composer').boundingBox();if(!composer||composer.y+composer.height>700)throw Error('AI输入区域超出可见窗口');
  if(compact){if(await editor.isVisible())throw Error('窄屏默认应优先显示 AI');await page.getByRole('tab',{name:'SQL 与结果',exact:true}).click()}
  await measure('connection');
  if(await page.locator('.wb-tool-surface--data > .wb-card-head').count()||await page.getByRole('button',{name:'切换工具',exact:true}).count()!==1)throw Error('数据工作区仍有重复头部')
  const separator=page.getByRole('separator',{name:'调整查询编辑器高度'}),initialHeight=await editor.evaluate(el=>el.getBoundingClientRect().height)
  await separator.press('ArrowDown');if(Number(await separator.getAttribute('aria-valuenow'))!==39)throw Error('编辑器键盘调高失败');await separator.press('ArrowUp')
  await separator.scrollIntoViewIfNeeded();const handle=await separator.boundingBox(),originalQuery=await editor.inputValue();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2+30);await page.mouse.up()
  if(Number(await separator.getAttribute('aria-valuenow'))<=34||await editor.inputValue()!==originalQuery)throw Error('拖动编辑器分隔线失败或改动了SQL')
  await separator.press('Home');for(let step=0;step<3;step++)await separator.press('ArrowDown');report.push({width,theme,stage:'editor-pointer-resize',height:await editor.evaluate(el=>el.getBoundingClientRect().height)})
  if(compact){
   const original=await editor.inputValue();await page.getByRole('tab',{name:'AI 查询',exact:true}).click();if(await editor.isVisible()||!await conversation.isVisible())throw Error('窄屏 AI 页签切换失败');
   await page.getByRole('tab',{name:'SQL 与结果',exact:true}).click();if(await editor.inputValue()!==original)throw Error('切换页签丢失SQL');report.push({width,theme,stage:'ai-primary-tabs',passed:true});
  }
  if(width===1280){
   const [sql,ai]=await Promise.all([editor.boundingBox(),conversation.boundingBox()]);
   if(!sql||!ai||ai.x+ai.width>sql.x+1)throw Error('宽窗口下 AI 会话应位于 SQL 左侧');
   await page.getByRole('button',{name:'收起连接'}).click();
   if(await page.getByRole('complementary',{name:'连接与对象'}).count())throw Error('连接列没有收起');
   const withoutConnections=(await editor.boundingBox()).width;
   if(withoutConnections<=sql.width||!await conversation.count())throw Error('收起连接列后应扩大编辑器并保留会话');
   await page.getByRole('button',{name:'收起 AI 会话'}).click();
   if(await conversation.count())throw Error('AI 会话没有收起');
   const fullWidth=(await editor.boundingBox()).width;
   if(fullWidth<=withoutConnections)throw Error('收起 AI 后编辑器没有扩展');
   report.push({width,theme,stage:'collapsed-widths',open:sql.width,withoutConnections,fullWidth});
   await page.getByRole('button',{name:'展开连接'}).click();await page.getByRole('button',{name:'展开 AI 会话'}).click();
  }
  await page.getByLabel('数据连接更多操作').click();
  await page.getByRole('button',{name:'连接配置',exact:true}).click();const config=page.getByRole('dialog',{name:/^(连接配置|新建连接)$/});
  await config.getByRole('textbox',{name:'连接名称'}).fill('Fixture database');
  await config.getByRole('textbox',{name:'数据库名称'}).fill('fixture');await config.getByRole('button',{name:'测试连接'}).click();await config.getByText('连接成功').waitFor();await measure('connection-config');await config.getByRole('button',{name:'保存'}).click();await page.getByText('连接配置已保存，密码不落盘').waitFor();if(!await page.getByRole('tab',{name:'对象',exact:true}).isVisible())await page.getByRole('button',{name:'展开连接',exact:true}).click();await page.getByRole('tab',{name:'对象',exact:true}).click();await page.getByRole('checkbox',{name:/public.orders_long/}).check();await measure('structure');if(await page.getByRole('button',{name:'关闭连接面板'}).isVisible())await page.getByRole('button',{name:'关闭连接面板'}).click();
  if(compact)await page.getByRole('tab',{name:'AI 查询',exact:true}).click();else if(!await conversation.isVisible())await page.getByRole('button',{name:'展开 AI 会话',exact:true}).click();
  const previous=await editor.inputValue();await conversation.getByRole('textbox',{name:'数据库AI需求'}).fill('查询订单编号');await measure('ai-generate');
  await conversation.getByRole('button',{name:/^生成(?: SQL|查询|脚本)$/,exact:true}).click();await conversation.getByText('已按所选结构生成',{exact:true}).waitFor();
  if(await editor.inputValue()!==previous)throw Error('会话回复覆盖了编辑器');if(await page.locator('.wb-modal').count())throw Error('会话生成使用了弹窗');
  await conversation.getByRole('button',{name:'填入 SQL 编辑器'}).click();if(await editor.inputValue()!=='SELECT id FROM orders ORDER BY id')throw Error('生成结果没有填入编辑器');
  if(compact&&!await editor.isVisible())throw Error('采用生成SQL后应切到SQL工作区');
  await page.getByRole('button',{name:'执行只读查询'}).click();await page.getByText('当前第 1–50 行').waitFor();await measure('result');
  const scroll=await viewport.evaluate(el=>{
   const head=el.querySelector('th'),before=head.getBoundingClientRect().top;el.scrollTop=200;el.scrollLeft=100;
   return {horizontal:el.scrollWidth>el.clientWidth,vertical:el.scrollHeight>el.clientHeight,sticky:Math.abs(head.getBoundingClientRect().top-before)<2,scrollTop:el.scrollTop,scrollLeft:el.scrollLeft,title:el.querySelector('td:nth-child(2)').title};
  });
  if(!scroll.horizontal||!scroll.vertical||!scroll.sticky||!scroll.scrollTop||!scroll.scrollLeft||!scroll.title.includes('完整值'))throw Error('结果内部滚动/吸顶/完整值提示失败: '+JSON.stringify(scroll));
  report.push({width,theme,stage:'scroll',...scroll});
  for(const start of [51,101,151,201]){await page.getByRole('button',{name:'下一页',exact:true}).click();await page.getByText('当前第 '+start+'–'+(start+49)+' 行').waitFor()}
  if(!await page.getByRole('button',{name:'下一页',exact:true}).isDisabled())throw Error('最后一页不应有下一页');
  await page.getByRole('button',{name:'上一页',exact:true}).click();await page.getByText('当前第 151–200 行').waitFor();await measure('paged');
  await page.getByRole('combobox',{name:'每页行数'}).selectOption('100');await measure('page-size-reset');
  if(!await page.getByRole('button',{name:'下一页',exact:true}).isDisabled())throw Error('修改页大小后不能继续旧分页');
  await page.evaluate(()=>{window.fixtureEmpty=true});await page.getByRole('button',{name:'执行只读查询'}).click();await page.getByText('查询成功，无返回记录').waitFor();await measure('zero-rows');
  const beforeAdopt=await page.evaluate(()=>window.fixtureQueries.length);if(compact)await page.getByRole('tab',{name:'AI 查询',exact:true}).click();await conversation.getByRole('button',{name:'填入 SQL 编辑器'}).click();if(!await editor.isVisible()||await page.locator('.wb-data-main').evaluate(el=>el.scrollTop)!==0)throw Error('采用SQL后没有回到编辑器 '+JSON.stringify({width,theme,visible:await editor.isVisible(),position:await page.locator('.wb-data-main').evaluate(el=>({top:el.scrollTop,height:el.clientHeight,scroll:el.scrollHeight}))}));if(await page.evaluate(()=>window.fixtureQueries.length)!==beforeAdopt)throw Error('采用SQL触发了执行');report.push({width,theme,stage:'adopt-after-results',passed:true});
  if(width===980&&theme==='dark'){await page.evaluate(()=>{document.documentElement.style.zoom='1.25'});await measure('zoom125')}
 }
 const failures=report.filter(r=>r.overflow>2||r.dialogOverflow>2);writeFileSync(resolve(out,'report.json'),JSON.stringify({source,report,errors,failures},null,2));console.log(JSON.stringify({source,cases:report.length,errors,failures,output:out},null,2));if(errors.length||failures.length)process.exitCode=1;
}finally{await browser.close()}
