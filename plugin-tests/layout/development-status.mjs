/** Native conversation/workspace layout using synthetic data and blocked network. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output=process.env.LAYOUT_OUTPUT||'/tmp/workbench-development-status';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setViewportSize({width:1280,height:800})
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const WB=window.WB,at=new Date().toISOString(),conversation={id:'development:synthetic',kind:'development',title:'US-SYNTHETIC · 状态修改验证'}
  WB.actions.assistantHub=async request=>{
   if(request.action==='list')return {status:'ok',conversations:[conversation]}
   if(['detail','select'].includes(request.action))return {status:'ok',conversation,sessionId:'native-main',nativeBinding:{sessionId:'native-main',primarySessionId:'native-main',canSend:true},entity:{issue:{title:'状态修改验证',status:'待处理'},status:'paused',stage:'test'},messages:[],turns:[],events:[{id:'states',at,text:'当前状态为待处理；请从下方选择具体流程状态，本次尚未修改。',operation:'development.issue.get',result:{statusChoices:{current:'待处理',targets:[{key:'written',name:'需求编写完成',form:{fields:[],comment_mode:'optional'}},{key:'reviewed',name:'需求评审完成',form:{fields:[{column_key:'reviewer',name:'评审人员',required:true,supported:true}],comment_mode:'required'}},{key:'invalid',name:'已失效',form:{fields:[]}}]}}}],confirmations:[],runs:[],items:[]}
   if(request.action==='delta')return {status:'ok',entries:[],nextSeq:0,turnEnded:false}
   throw Error('布局验证不执行写入：'+request.action)
  };WB.assistant.openHub(conversation.id)
 })
 await page.getByRole('region',{name:'Linky 可用状态'}).waitFor()
 for(const [width,height] of [[1280,800],[800,700],[360,700],[360,360]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  if(width<640)await page.getByRole('button',{name:'展开会话列表'}).waitFor({state:'visible'})
  await page.getByRole('button',{name:'需求评审完成',exact:true}).click()
  const submit=page.getByRole('button',{name:'修改为需求评审完成'});await submit.scrollIntoViewIfNeeded()
  const metrics=await page.evaluate(()=>{const root=document.querySelector('.wb-hub'),form=document.querySelector('form[aria-label="修改状态为需求评审完成"]'),rect=form.getBoundingClientRect(),inputs=[...form.querySelectorAll('input,textarea,select,button')];return {overflow:root.scrollWidth-root.clientWidth,formWidth:rect.width,fieldsOutside:inputs.some(el=>{const r=el.getBoundingClientRect();return r.left<rect.left-2||r.right>rect.right+2})}})
  report.push({width,height,theme,...metrics});await page.screenshot({path:resolve(output,`${width}-${height}-${theme}.png`),animations:'disabled'})
  if(metrics.overflow>2||metrics.fieldsOutside||!await submit.isDisabled())throw Error(JSON.stringify(report.at(-1)))
 }
 writeFileSync(resolve(output,'report.json'),JSON.stringify({cases:report.length,report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output}));if(errors.length)process.exitCode=1
}catch(error){writeFileSync(resolve(output,'failure.json'),JSON.stringify({report,errors,error:String(error.stack||error)},null,2));throw error}finally{await browser.close()}
