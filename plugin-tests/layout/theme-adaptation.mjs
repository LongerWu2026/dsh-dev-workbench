/** Synthetic search results only; all network requests are blocked. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const base=dirname(fileURLToPath(import.meta.url)),out='/tmp/workbench-theme-adaptation';mkdirSync(out,{recursive:true})
const built=await build({entryPoints:[resolve(base,'fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{height:100%;margin:0;font-family:system-ui}html{--dsw-alias-brand-primary:#111111;--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa}html.dark{--dsw-alias-brand-primary:#eeeeee;--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync(resolve(base,'../../client.js'),'utf8')});await page.evaluate(()=>window.mountWorkbench());
 for(const width of [1000,360])for(const theme of ['light','dark'])for(const section of ['dashboard','tasks','replies','radar','knowledge','toolbox']){
  await page.setViewportSize({width,height:800});await page.evaluate(({theme,section})=>{document.documentElement.className=theme;window.WB.go(section)}, {theme,section});await page.locator('.wb-page').first().waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const metrics=await page.locator('.wb-scroll').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth}));assert.ok(metrics.overflow<=2);report.push({width,theme,section,...metrics});await page.screenshot({path:resolve(out,`${section}-${theme}-${width}.png`)});
  if(section==='tasks'){
   assert.equal(await page.getByLabel('消息发出日期起始').isVisible(),false);await page.getByRole('button',{name:'筛选',exact:true}).click();await page.getByLabel('消息发出日期起始').fill('2026-10-01');await page.getByRole('button',{name:/^筛选/}).click();await page.getByRole('button',{name:'移除筛选：消息日期：2026-10-01 至 不限'}).click();assert.equal(await page.getByLabel('消息发出日期起始').inputValue(),'');
  }
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'report.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out}));
}finally{await browser.close()}
