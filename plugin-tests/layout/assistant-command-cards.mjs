/** Message card layout: synthetic replies only; all network and business execution blocked. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output=process.env.LAYOUT_OUTPUT||'/tmp/workbench-assistant-command-cards';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
 await page.setViewportSize({width:1280,height:800})
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const WB=window.WB,at=new Date().toISOString()
  const command={id:'synthetic-command',label:'继续研发任务',operation:'development.continue',parameters:{'事项编号':'SYNTHETIC-ONLY','说明':'用于布局检查的长说明。'.repeat(25)},status:'completed'}
  window.cardScenarios={
   'rule-success':{source:'rule',status:'completed',reply:'已更新该待办为进行中，之前的处理记录仍然保留。',commands:[{...command,label:'修改待办',operation:'task.update'}],recognition:{outcome:'matched'}},
   'execution-blocked':{source:'rule',status:'failed',blocked:true,failurePhase:'execution',reply:'任务正在等待人工审查，暂不能继续开发。请先查看审查意见，再决定通过或退回修改。',commands:[{...command,status:'failed',blocked:true}],recognition:{outcome:'matched'}},
   'ai-fallback':{source:'ai',status:'completed',clarificationOnly:true,reply:'你希望查看现有识别结果，还是拉取新消息后重新识别？请明确这次要处理的范围。',commands:[],recognition:{outcome:'ambiguous',reason:'规则无法确定操作对象'}},
   'rule-clarification':{source:'rule',status:'completed',clarificationOnly:true,reply:'有多个待确认操作，请点击具体确认卡片。本次没有执行修改。',commands:[],recognition:{outcome:'ambiguous',reason:'确认对象尚未明确'}},
   'ai-command':{source:'ai',status:'completed',reply:'已读取本轮的真实结果：共 12 项待办、3 项待回复。你可以指定其中一项继续修改。',commands:[{...command,label:'查看提取结果',operation:'analysis.results'}],recognition:{outcome:'unmatched'}},
   'plain-reply':{source:'ai',status:'completed',reply:'可以先核对已有材料，再整理下一步计划。这里是对问题的说明，没有执行修改。',commands:[],recognition:{outcome:'unmatched'}},
   'ai-recognizing':{source:'ai',status:'recognizing',reply:'正在由 AI 理解消息。',commands:[],recognition:{outcome:'error',reason:'规则暂时无法解析，已转 AI'}},
   'confirmation':{source:'rule',status:'needs_confirmation',reply:'已准备修改预览，请核对内容后确认。确认之前不会修改知识。',commands:[{...command,label:'预览修改知识',operation:'knowledge.update',status:'needs_confirmation'}],recognition:{outcome:'matched'}}
  }
  const rows=[{id:'system:analysis',kind:'system',fixed:true,title:'消息识别'},{id:'system:radar',kind:'system',fixed:true,title:'AI资讯'},{id:'system:knowledge',kind:'system',fixed:true,title:'知识助手'},...Object.keys(window.cardScenarios).map(key=>({id:'chat:'+key,kind:'chat',title:'合成消息 · '+key}))]
  window.cardCalls=[]
  WB.actions.assistantHub=async request=>{
   window.cardCalls.push(request)
   if(request.action==='list')return {status:'ok',conversations:rows}
   if(request.action==='delta')return {status:'ok',entries:[],nextSeq:0,turnActive:false,turnEnded:false}
   if(request.action==='detail'){
    const key=request.conversationId.slice(5),conversation=rows.find(row=>row.id===request.conversationId),scenario=window.cardScenarios[key]
    return {status:'ok',conversation,nativeBinding:{sessionId:null,workspaceState:'unbound',canSend:true},sessionId:null,turns:[{id:'card-'+key,requestId:'layout-'+key,text:key==='execution-blocked'?'继续开发':'请帮我处理当前事项',at,mode:'execute',...scenario}],messages:[],events:[],runs:[],items:[],threads:[],confirmations:[],reinterpretSupported:true,busyReply:{config:{enabled:false}}}
   }
   throw Error('布局检查禁止业务调用：'+request.action)
  }
  WB.assistant.openHub('chat:rule-success')
 })
 await page.getByRole('region',{name:'提交与处理结果'}).waitFor()
 for(const [width,height] of [[1280,800],[800,700],[360,700],[360,360]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  const collapse=page.getByRole('button',{name:'收起会话列表'});if(width<640&&await collapse.count())await collapse.click()
  for(const scenario of ['rule-success','execution-blocked','ai-fallback','rule-clarification','ai-command','plain-reply','ai-recognizing','confirmation']){
   await page.evaluate(key=>window.WB.assistant.openHub('chat:'+key),scenario)
   const turn=page.locator('[data-turn-id="card-'+scenario+'"]');await turn.waitFor()
   const card=turn.locator('.wb-hub-turn-response');await card.waitFor()
   const footer=card.locator('.wb-hub-turn-footer');await footer.waitFor()
   const tags=card.getByLabel('消息标记',{exact:true});await tags.waitFor()
   const commandScenario=['rule-success','execution-blocked','ai-command','confirmation'].includes(scenario)
   if(commandScenario)await tags.getByText('指令',{exact:true}).waitFor()
   else if(await tags.getByText('指令',{exact:true}).count())throw Error('普通回复被误标为指令：'+scenario)
   if(await card.locator('.wb-hub-turn-meta>strong').count())throw Error('识别来源仍然作为卡片大标题')
   const details=card.locator('.wb-hub-command-details')
   if(commandScenario){
    if(await details.getAttribute('open')!==null)throw Error('技术详情没有默认收起')
    if(await details.locator('code').first().isVisible())throw Error('内部操作代码仍直接展示')
   }
   if(scenario==='execution-blocked')await card.getByRole('status').filter({hasText:'暂不能执行'}).waitFor()
   if(['ai-fallback','rule-clarification'].includes(scenario))await card.getByRole('status').filter({hasText:'待你补充'}).waitFor()
   if(scenario==='ai-recognizing'&&/失败/.test(await card.innerText()))throw Error('AI 接续之前展示失败状态')
   await page.getByRole('textbox',{name:'助手消息'}).scrollIntoViewIfNeeded()
   const metrics=await card.evaluate(el=>{
    const root=document.querySelector('.wb-hub'),composer=document.querySelector('.wb-assistant-composer').getBoundingClientRect(),footer=el.querySelector('.wb-hub-turn-footer').getBoundingClientRect(),r=el.getBoundingClientRect()
    return {rootOverflow:root.scrollWidth-root.clientWidth,cardOverflow:el.scrollWidth-el.clientWidth,composerBottom:composer.bottom,composerTop:composer.top,footerInside:footer.left>=r.left-2&&footer.right<=r.right+2&&footer.bottom<=r.bottom+2,viewportHeight:innerHeight}
   })
   report.push({width,height,theme,scenario,...metrics});await page.screenshot({path:resolve(output,`${width}-${height}-${theme}-${scenario}.png`),animations:'disabled'})
   if(metrics.rootOverflow>2||metrics.cardOverflow>2||metrics.composerBottom>height+2||metrics.composerTop<0||!metrics.footerInside)throw Error(JSON.stringify(report.at(-1)))
   if(commandScenario){await details.locator('summary').click();await details.locator('code').first().waitFor();if(await details.evaluate(el=>el.scrollWidth-el.clientWidth)>2)throw Error('展开指令详情横向溢出');await details.locator('summary').click()}
  }
 }
 const calls=await page.evaluate(()=>window.cardCalls);if(calls.some(row=>!['list','detail','delta'].includes(row.action)))throw Error('布局检查意外执行了操作')
 writeFileSync(resolve(output,'report.json'),JSON.stringify({cases:report.length,report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output}));if(errors.length)process.exitCode=1
}catch(error){await page.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({report,errors,error:String(error.stack||error)},null,2));throw error}finally{await browser.close()}
