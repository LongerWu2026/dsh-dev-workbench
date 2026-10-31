/** Browser check for visible recognition progress and long pause reasons. Synthetic data only. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const base=dirname(fileURLToPath(import.meta.url)),out=process.env.LAYOUT_OUTPUT||'/tmp/workbench-continuous-layout'
mkdirSync(out,{recursive:true})
const built=await build({entryPoints:[resolve(base,'fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync(resolve(base,'../../client.js'),'utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 for(const width of [800,360])for(const theme of ['light','dark'])for(const section of ['dashboard','replies','office'])for(const paused of [false,true]){
  await page.setViewportSize({width,height:600})
  await page.evaluate(({theme,section,paused})=>{document.documentElement.className=theme;const data=window.WB.store.get().data;window.WB.store.set({data:{...data,jobs:[{id:'continuous-layout-job',kind:'analysis',status:paused?'queued':'running',input:{continuous:true,limit:50},createdAt:'2026-10-30T06:00:00Z',updatedAt:'2026-10-30T06:01:00Z',nextRetryAt:paused?'2026-10-30T06:05:00Z':null,progress:{processed:100,remaining:23,failed:paused?2:0,batches:2,pauseReason:paused?'失败消息等待自动重试：模型服务临时不可用；'+('long-provider-error-detail-'.repeat(15)):null}}]}});window.WB.go(section)},{theme,section,paused})
  if(section==='office'){const summary=page.locator('summary').filter({hasText:'消息识别'}).first();if(!await summary.evaluate(el=>el.parentElement.open))await summary.click()}
  const progress=page.getByText(/累计处理 100 条 · 剩余 23 条/);await progress.waitFor();await progress.scrollIntoViewIfNeeded()
  if(paused){const reason=page.getByText(/暂停原因：失败消息等待自动重试/);await reason.waitFor();if(!(await reason.innerText()).includes('自动继续'))throw Error('Missing automatic retry time')}
  const metrics=await page.locator('.wb-scroll').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,height:el.clientHeight}));report.push({width,theme,section,paused,...metrics});if(metrics.overflow>2)throw Error('Recognition progress overflows: '+JSON.stringify(report.at(-1)))
  if(section!=='office')await page.screenshot({path:resolve(out,`analysis-${section}-${width}-${theme}-${paused?'paused':'running'}.png`)})
 }
 if(errors.length)throw Error(errors.join('\n'))
 writeFileSync(resolve(out,'continuous-analysis-report.json'),JSON.stringify(report,null,2));console.log(`continuous-analysis layout: ${report.length} checks passed; ${out}`)
}finally{await browser.close()}
