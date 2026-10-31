/** Browser check for visible recognition progress and long pause reasons. Synthetic data only. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const base=dirname(fileURLToPath(import.meta.url)),out=process.env.LAYOUT_OUTPUT||'/tmp/workbench-extraction-feedback'
mkdirSync(out,{recursive:true})
const built=await build({entryPoints:[resolve(base,'fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync(resolve(base,'../../client.js'),'utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 for(const width of [800,360])for(const height of [600,320])for(const theme of ['light','dark'])for(const mode of ['rejected','running','failed','completed']){
  await page.setViewportSize({width,height});const id=`extract-${width}-${height}-${theme}-${mode}`;
  await page.evaluate(({theme,mode,id})=>{document.documentElement.className=theme;window.fixtureExtractionStartError=mode==='rejected'?'模型拒绝启动：'+('长错误说明'.repeat(25)):null;window.fixtureExtractionJob={id,kind:'analysis',status:'running',progress:{processed:3,remaining:7,failed:0,batches:1,pauseReason:null}};const data=window.WB.store.get().data;window.WB.store.set({analysisActivity:null,analysisLive:null,analysisStatusError:null,toasts:[],data:{...data,jobs:[]}});window.WB.go('dashboard');document.querySelector('.wb-scroll').scrollTo({top:0,behavior:'instant'})},{theme,mode,id});
  await page.getByRole('button',{name:'提取消息',exact:true}).click();
  if(mode==='rejected')await page.waitForFunction(()=>window.WB.store.get().analysisActivity?.phase==='failed');
  else{
   await page.getByLabel('提取进行中',{exact:true}).waitFor();await page.waitForFunction(()=>window.WB.store.get().analysisActivity?.phase==='running');
   if(mode==='failed'||mode==='completed'){
    await page.evaluate(mode=>{const data=window.WB.store.get().data;window.WB.store.set({data:{...data,jobs:data.jobs.map(job=>({...job,status:mode,error:mode==='failed'?'模型历史不兼容：'+('缺少推理字段'.repeat(20)):undefined,progress:{...job.progress,processed:mode==='completed'?10:3,remaining:mode==='completed'?0:7}}))}})},mode);
    await page.waitForFunction(mode=>window.WB.store.get().analysisActivity?.phase===mode,mode);
   }
  }
  const toast=page.locator('.wb-toasts');if(mode!=='running')await toast.waitFor();
  const metrics=await page.evaluate(()=>{const root=document.querySelector('.wb-root').getBoundingClientRect(),scroll=document.querySelector('.wb-scroll'),toast=document.querySelector('.wb-toasts')?.getBoundingClientRect();return{overflow:scroll.scrollWidth-scroll.clientWidth,toastInside:!toast||(toast.left>=root.left&&toast.right<=root.right+1&&toast.bottom<=root.bottom+1),spinner:!!document.querySelector('[aria-label="提取进行中"]')}});
  if(metrics.overflow>2||!metrics.toastInside||metrics.spinner!==(mode==='running'))throw Error(JSON.stringify({width,height,theme,mode,...metrics}));
  report.push({width,height,theme,mode,...metrics});await page.screenshot({path:resolve(out,`${width}-${height}-${theme}-${mode}.png`),animations:'disabled'});
 }
 if(errors.length)throw Error(errors.join('\n'));
 writeFileSync(resolve(out,'report.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output:out}));
}finally{await browser.close()}
