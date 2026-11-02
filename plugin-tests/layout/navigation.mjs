/** Fits navigation to the plugin element, independently of the browser viewport. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const out='/tmp/workbench-navigation';mkdirSync(out,{recursive:true});const built=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'}),browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage(),errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
try{
 await page.setViewportSize({width:1700,height:850});await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>');await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.getByRole('navigation',{name:'工作台导航'}).waitFor();
 async function settle(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))}
 async function resize(width){await page.locator('.wb-root').evaluate((el,width)=>{el.style.width=width+'px';el.style.maxWidth='none'},width);await settle()}
 for(const theme of ['light','dark'])for(const width of [1600,1280,1000,800,560,360,280,800,1600]){
  await page.evaluate(t=>document.documentElement.className=t,theme);await resize(width);
  const m=await page.locator('.wb-topnav').evaluate(nav=>{const buttons=[...nav.querySelectorAll(':scope > button')],more=nav.querySelector(':scope > details'),rect=nav.getBoundingClientRect();return {width:rect.width,overflow:nav.scrollWidth-nav.clientWidth,visible:buttons.map(el=>el.dataset.page),hidden:more?[...more.querySelectorAll('button')].map(el=>el.dataset.page):[],more:!!more,lines:[...new Set([...buttons,...(more?[more]:[])].map(el=>Math.round(el.getBoundingClientRect().top)))].length}});
  if(m.overflow>1||m.lines!==1)throw Error('导航溢出或换行 '+JSON.stringify(m));if(new Set([...m.visible,...m.hidden]).size!==await page.evaluate(()=>window.WB.ORDER.length))throw Error('入口丢失或重复');if(width===1600&&m.more)throw Error('宽窗口不应保留更多');if(width===360&&!m.more)throw Error('窄插件应收纳溢出目录');report.push({theme,requestedWidth:width,...m});await page.screenshot({path:resolve(out,`${theme}-${width}.png`)});
 }
 // Hit-test the real popup against page content, including menus with their own z-index.
 for(const theme of ['light','dark'])for(const width of [1280,800,560,360])for(const height of [700,320]){
  await page.setViewportSize({width:1700,height});await page.evaluate(theme=>{document.documentElement.className=theme;window.WB.go('toolbox')},theme);await resize(width);
  const nav=page.getByRole('navigation',{name:'工作台导航'}),summary=nav.locator('summary');if(!await summary.count())continue;
  await page.locator('.wb-tools-page .wb-page-head').evaluate(el=>{el.style.position='relative';el.style.zIndex='45'});
  await summary.click();const menu=nav.locator('.wb-more-menu');await menu.waitFor();
  const items=menu.getByRole('button');for(let i=0;i<await items.count();i++){
   const item=items.nth(i);await item.scrollIntoViewIfNeeded();const hit=await item.evaluate(el=>{const r=el.getBoundingClientRect(),root=el.closest('.wb-root').getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return{title:el.textContent,covered:!el.contains(hit),hit:hit?.className,left:r.left,right:r.right,top:r.top,bottom:r.bottom,rootLeft:root.left,rootRight:root.right}});
   if(hit.covered||hit.left<hit.rootLeft-1||hit.right>hit.rootRight+1||hit.top<0||hit.bottom>height+1)throw Error('更多菜单被页面遮挡或裁切 '+JSON.stringify({theme,width,height,...hit}));
  }
  report.push({case:'menu-hit-testing',theme,width,height,items:await items.count()});await page.screenshot({path:resolve(out,`menu-${theme}-${width}-${height}.png`)});await page.keyboard.press('Escape');
 }
 for(const theme of ['light','dark']){
  await page.setViewportSize({width:1700,height:700});await page.evaluate(theme=>document.documentElement.className=theme,theme);await resize(360);
  const summary=page.getByRole('navigation',{name:'工作台导航'}).locator('summary');await summary.click();await page.evaluate(()=>window.WB.openTaskForm(window.WB.store.get().data.tasks[0],null,{presentation:'modal'}));await page.getByRole('dialog',{name:'编辑待办',exact:true}).waitFor();
  const modalAbove=await summary.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return!!hit?.closest('.wb-modal-mask')});if(!modalAbove)throw Error('导航覆盖了确认/编辑弹窗');
  report.push({case:'modal-above-navigation',theme,passed:true});await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:1700,height:850});
 await resize(360);const nav=page.getByRole('navigation',{name:'工作台导航'}),summary=nav.locator('summary');await summary.click();await nav.getByRole('button',{name:'连接与设置',exact:true}).click();await settle();if(await nav.locator('details').evaluate(el=>el.open))throw Error('切换后菜单未关闭');if(!await summary.evaluate(el=>document.activeElement===el))throw Error('菜单切换后焦点未回到更多');await summary.click();if(await nav.getByRole('button',{name:'连接与设置',exact:true}).getAttribute('aria-current')!=='page')throw Error('收纳项未保留当前页');await page.keyboard.press('Escape');if(!await summary.evaluate(el=>document.activeElement===el))throw Error('Escape未恢复焦点');await summary.click();await page.locator('.wb-toolbar-brand').click();if(await nav.locator('details').evaluate(el=>el.open))throw Error('点击外部未关闭');
 await resize(1600);await nav.getByRole('button',{name:'连接与设置',exact:true}).focus();await resize(280);if(!await nav.locator('summary').evaluate(el=>document.activeElement===el))throw Error('缩窄后焦点未转到更多');await resize(1600);if(!await nav.getByRole('button',{name:'连接与设置',exact:true}).evaluate(el=>document.activeElement===el))throw Error('展开全部后焦点未恢复');report.push({case:'overflow-navigation-keyboard-and-focus',passed:true});
 await page.evaluate(()=>document.documentElement.style.zoom='1.5');await resize(700);const zoomOverflow=await nav.evaluate(el=>el.scrollWidth-el.clientWidth);if(zoomOverflow>1)throw Error('缩放导航溢出');report.push({case:'zoom',overflow:zoomOverflow});
 writeFileSync(resolve(out,'report.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out},null,2));if(errors.length)process.exitCode=1;
}finally{await browser.close()}
