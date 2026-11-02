/** Browser layout against the shipped client. Synthetic data; all network requests blocked. */
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const output=process.env.LAYOUT_OUTPUT||'/tmp/workbench-assistant-hub';mkdirSync(output,{recursive:true})
const fixture=await build({entryPoints:[resolve('plugin-tests/layout/fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
// A synthetic origin lets the sidebar preference exercise real browser localStorage.
await page.route('http://assistant-layout.invalid/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html></html>'}))
try{
 await page.goto('http://assistant-layout.invalid/')
 await page.setViewportSize({width:1280,height:800})
 await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee}html.dark{--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-bg-layer-2:#333;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-border-l1:#444}</style></head><body><div id="app"></div></body></html>')
 await page.addScriptTag({content:fixture.outputFiles[0].text});await page.addScriptTag({content:readFileSync('client.js','utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
 await page.evaluate(()=>{
  const WB=window.WB,at=new Date().toISOString(),olderAt=new Date(Date.now()-2*24*60*60*1000).toISOString()
  const conversations=[
   {id:'system:analysis',kind:'system',fixed:true,title:'消息识别',activityStatus:'running',latestPreview:'累计识别150条，剩余80条',needsAttention:true},
   {id:'system:radar',kind:'system',fixed:true,title:'AI 资讯',latestPreview:'已整理4段摘要'},
   {id:'system:knowledge',kind:'system',fixed:true,title:'知识助手'},
   {id:'system:office',kind:'system',fixed:false,title:'办公历史',latestPreview:'之前生成的报告与回复草稿',updatedAt:olderAt},
   {id:'task:task',kind:'task',entityId:'task',title:'合成事项：继续处理并核对最终结果',status:'doing',latestPreview:'已核对方案，等待补充验收结果',updatedAt:at,needsAttention:true},
   {id:'office:layout-report',kind:'office',title:'周报 · 10/26–11/01',topic:{kind:'work_report',input:{period:'week'},date:'2026-11-01',from:'2026-10-26',to:'2026-11-01'},latestPreview:'报告已生成，可以继续补充',updatedAt:at,needsAttention:false},
   {id:'chat:empty-layout',kind:'chat',title:'尚未发送的新对话',latestPreview:'',updatedAt:at,needsAttention:false}
  ]
  window.hubCalls=[];window.hubConfirmation=null;window.hubTurns={};WB.store.set({data:{...WB.store.get().data,replies:Array.from({length:22},(_,index)=>({id:'office-reply-'+index,contact:'合成联系人 '+(index+1),snippet:'需要确认的回复内容与上下文。'+('长内容'.repeat(index===0?20:1)),stage:index===0?'已自动回复':'待回复'}))}})
  const extractionItems=Array.from({length:8},(_,index)=>({kind:index%2?'reply':'task',id:'layout-extract-'+index,title:(index%2?'回复客户提出的联调问题':'核对并提交本周处理说明')+' · 合成事项 '+(index+1),body:'这里是真实业务字段的合成验收数据，支持直接在当前对话中修改。'+(index===0?'长内容'.repeat(80):''),status:index%2?'待回复':'ready',dueAt:at,sourceId:'source-'+index,sourceText:'合成来源消息：请核对本次处理进度，并说明实际结果。'+('原消息内容'.repeat(40)),sourceAt:at,conversationId:(index%2?'reply':'task')+':layout-extract-'+index}))
  WB.actions.assistantHub=async request=>{
   window.hubCalls.push(request)
   const conversation=conversations.find(row=>row.id===request.conversationId)||conversations[0]
   if(request.action==='list')return {status:'ok',conversations:[...conversations]}
   if(request.action==='pin'){const row=conversations.find(item=>item.id===request.conversationId);if(!row)throw Error('未知置顶会话');row.pinned=request.pinned===true;return {status:'ok',conversation:row,pinned:row.pinned}}
   if(request.action==='officeTopic'){
    const replyIds=[...new Set(request.input?.replyIds||[])].sort(),single=request.kind==='reply_batch'&&replyIds.length===1
    const conversationId=single?'reply:'+replyIds[0]:request.kind==='work_report'?'office:layout-'+(request.input?.period||'day'):'office:layout-batch'
    const input=request.kind==='work_report'?{period:request.input?.period==='week'?'week':'day'}:{replyIds}
    const title=single?'合成联系人回复':request.kind==='work_report'?(input.period==='week'?'周报 · 10/26–11/01':'日报 · 11/01'):'回复草稿 · '+replyIds.length+'项'
    const topic={kind:request.kind,input,...(request.kind==='work_report'?{date:new Date(Date.now()+8*3600000).toISOString().slice(0,10)}:{})}
    if(!conversations.some(row=>row.id===conversationId))conversations.push({id:conversationId,kind:single?'reply':'office',title,topic,updatedAt:at,latestPreview:'准备生成',needsAttention:false})
    return {status:'ok',conversationId,title,operation:'office.start',kind:request.kind,input,topic}
   }
   if(request.action==='detail'){if(conversation.topic)conversation.officeTopic=conversation.topic;const filtered=extractionItems.filter(item=>(!request.extractionKind||request.extractionKind==='all'||item.kind===request.extractionKind)&&(!request.extractionQuery||item.title.includes(request.extractionQuery))),offset=request.extractionOffset||0;return {status:'ok',conversation,sessionId:null,retrievals:conversation.id==='system:radar'?[{id:'layout-knowledge-empty',sessionId:'radar-foreground',fromSeq:7,status:'empty',hits:[],note:'当前范围没有匹配的已确认有效知识'}]:[],busyReply:{config:{enabled:false,text:'我现在正在紧急处理客户问题，稍后答复。紧急问题可以电话联系。'},pending:22,uncertain:1},turns:window.hubTurns[conversation.id]||[],extraction:conversation.id==='system:analysis'?{items:filtered.slice(offset,offset+6),total:filtered.length,counts:{tasks:4,replies:4,pendingReview:2},offset,hasMore:offset+6<filtered.length}:undefined,background:{messages:conversation.id==='system:analysis'?[{id:'background:layout:1',sessionId:'layout',seq:1,origin:'background',role:'user',text:'原始消息协议'.repeat(300),displayText:'已提交 50 条消息进行识别。\n1. 合成消息：核对这轮的处理结果。',at},{id:'background:layout:2',sessionId:'layout',seq:2,origin:'background',role:'assistant',text:'{\"results\":[]}',recognition:{note:'实际登记状态请查看提取结果。',items:Array.from({length:50},(_,index)=>({sourceId:'recognition-'+index,summary:'第 '+(index+1)+' 条合成消息的识别说明',instructions:['根据该消息核对对应事项与需要处理的内容'],status:index===49?'invalid':'recognized',reason:index===49?'未返回完整有效内容，请核对原消息。':undefined}))},displayText:'识别返回 50 条结果。\n1. 合成事项已识别，可在这里继续处理。',at}]:conversation.id==='system:radar'?[{id:'background:summary-layout:1',sessionId:'summary-layout',seq:1,origin:'background',role:'assistant',text:'合成资讯摘要已返回',at,recognition:{purpose:'summary',items:['技术变化','业务影响','行动建议','风险提示'].map((label,index)=>({sourceId:'section-'+index,label,summary:index===3?'':'这段合成摘要用于核对资讯内容的展示。',instructions:[],status:index===3?'invalid':'recognized',reason:index===3?'本次未返回风险提示内容，请查看原始记录。':undefined}))}}]:[],hasMore:false,turnActive:false,errors:[]},messages:conversation.id==='system:office'||['office','chat'].includes(conversation.kind)?[]:[{role:'user',text:'请继续处理这轮识别，并保留实际结果。',at},{role:'assistant',text:'已处理 150 条，剩余 80 条。识别结果会同步到待办和待回复。',at}],events:[],runs:conversation.id==='system:analysis'?[{id:'job-layout',kind:'analysis',title:'消息识别',status:'running',createdAt:at,updatedAt:at,progress:{processed:150,remaining:80,failed:2,batches:3,pauseReason:'服务限流后会按实际重试时间继续；这段合成说明用于检查窄屏的长文本换行。'},result:{processed:150,failures:2}}]:[],items:[],entity:conversation.kind==='task'?{id:'task',title:conversation.title,status:'doing'}:null,threads:[],confirmations:conversation.id==='system:knowledge'&&window.hubConfirmation?[window.hubConfirmation]:[]}}
   if(request.action==='send'){window.hubConfirmation={turnId:'layout-confirm-turn',id:'confirm-layout',title:'删除知识：合成接口说明',operation:'knowledge.delete',state:'pending',before:{title:'合成接口说明',body:'此内容仅供布局验收。'+('长说明'.repeat(70))},after:null};const turn={id:'layout-confirm-turn',requestId:request.requestId,text:request.text,at,source:'rule',mode:'execute',status:'needs_confirmation',reply:'请核对知识内容，确认后执行删除。',commands:[{id:'layout-delete-command',label:'删除指定知识',operation:'knowledge.delete',parameters:{id:'synthetic-knowledge'},status:'needs_confirmation'}]};window.hubTurns[request.conversationId]=[turn];return {status:'confirmation_required',handled:true,turn,turnId:turn.id,note:'请确认删除这条合成知识',confirmation:window.hubConfirmation}}
   if(request.action==='operate'&&request.operation==='busyReply.status')return {status:'ok',note:'已读取当前忙碌告知设置'}
   if(request.action==='history')return {status:'ok',messages:[{role:'assistant',text:'合成后台执行的原始结果',at}]}
   throw Error('布局验收不应执行操作：'+request.action)
  }
  window.hubTurns['system:radar']=[{id:'layout-turn',requestId:'layout-request',text:'请把这条资讯的关联内容整理出来，再告诉我还需要补充什么。'+('较长的原话说明'.repeat(20)),at,source:'ai',mode:'execute',status:'executing',reply:'已经识别到资讯查询命令，正在等待实际结果。',commands:[{id:'layout-command',label:'查询关联资讯',operation:'radar.search',parameters:{query:'本次关联的资讯主题'+('关键词'.repeat(20))},status:'executing'}]},{id:'layout-reinterpretation',sessionId:'radar-foreground',fromSeq:7,requestId:'layout-reinterpret-request',text:'刷新资讯',at,source:'ai',mode:'reinterpret',status:'completed',reply:'这里可能表示刷新已有列表或抓取最新资讯；请明确你想要的操作。',commands:[]}];
  window.hubTurns['office:layout-report']=[{id:'office-artifacts',source:'system',origin:'office-history',recordedStatus:'completed',status:'completed',text:'',at,reply:'以下是之前生成的工作成果，可继续处理。',commands:[],jobs:[{id:'office-report-job',kind:'work_report',title:'本周工作报告',status:'completed',steps:[{id:'report',status:'completed'}]}],artifacts:[{jobId:'office-report-job',stepId:'report',kind:'work_report',title:'本周工作报告',text:'## 本周完成\n完成了当前项目的联调核对，并保留实际问题与处理结果。\n\n## 后续计划\n继续核对待处理事项，确认验收结果。'+('报告中的完整内容。'.repeat(90)),evidenceIds:['合成任务与消息来源']},{jobId:'office-reply-job',stepId:'reply-one',kind:'reply_batch',title:'合成客户的回复草稿',text:'已收到你的问题，我会核对实际处理情况后回复。',evidenceIds:[]}]}];
  window.hubTurns['system:office']=window.hubTurns['office:layout-report'].map(turn=>({...turn,id:'office-history-artifacts',at:olderAt}));
  window.hubTurns['system:analysis']=[{id:'older-analysis-turn',requestId:'older-analysis-request',at:olderAt,source:'rule',mode:'execute',status:'completed',text:'查询之前的识别结果',reply:'两天前已识别20条，当前结果以最新消息为准。',commands:[{id:'older-analysis-command',label:'查看识别结果',operation:'analysis.status',status:'completed'}]}];
  WB.assistant.openHub('system:analysis')
 })
 await page.getByRole('navigation',{name:'助手会话列表'}).waitFor()
 const workNavigation=page.getByRole('navigation',{name:'助手会话列表'})
 const systemNavigation=page.getByRole('navigation',{name:'系统能力'})
 await systemNavigation.waitFor()
 const toolbar=page.getByRole('group',{name:'助手工具栏'}),toolbarActions=toolbar.getByRole('group',{name:'助手工具与设置'})
 async function checkToolbar(){
  if(await page.getByRole('button',{name:'关闭助手',exact:true}).count())throw Error('助手页面仍显示多余关闭按钮')
  const bar=await toolbar.boundingBox(),tabs=await systemNavigation.boundingBox(),tools=await toolbarActions.getByRole('button',{name:'＋工具',exact:true}).boundingBox()
  if(await toolbar.getByRole('button',{name:/^(展开|收起)会话列表$/}).count())throw Error('会话列表折叠仍混入系统工具栏')
  if(!bar||!tabs||!tools||Math.abs(tabs.y+tabs.height/2-tools.y-tools.height/2)>3||tools.x+tools.width>bar.x+bar.width+1)throw Error('系统能力和工具没有保持水平 '+JSON.stringify({bar,tabs,tools}))
  if(await page.locator('.wb-hub-context-head').getByRole('button',{name:'＋工具',exact:true}).count())throw Error('工具配置仍占用聊天标题栏')
 }
 await checkToolbar()
 if(await systemNavigation.getByRole('button').count()!==3)throw Error('系统能力条必须只包含三个固定入口')
 await systemNavigation.getByRole('button',{name:'系统能力：消息识别',exact:true}).getByText('处理中',{exact:true}).waitFor()
 if(await workNavigation.getByRole('button',{name:/^会话：(消息识别|AI 资讯|知识助手)$/}).count())throw Error('固定能力仍重复占用工作会话列表')
 await workNavigation.getByRole('button',{name:'会话：尚未发送的新对话',exact:true}).waitFor()
 const conversationSearch=workNavigation.getByRole('textbox',{name:'搜索会话或事项'})
 await conversationSearch.fill('办公历史');await workNavigation.getByRole('button',{name:'会话：办公历史',exact:true}).waitFor()
 if(await systemNavigation.getByRole('button').count()!==3)throw Error('搜索工作历史影响系统入口')
 await conversationSearch.fill('')
 const taskTitle='合成事项：继续处理并核对最终结果'
 const taskRow=workNavigation.locator('.wb-hub-session-row').filter({has:page.getByRole('button',{name:'会话：'+taskTitle,exact:true})})
 const pin=taskRow.locator('.wb-hub-pin')
 const pinState=locator=>locator.evaluate(el=>({opacity:Number(getComputedStyle(el).opacity),pointerEvents:getComputedStyle(el).pointerEvents}))
 await page.mouse.move(1200,750)
 if((await pinState(pin)).opacity!==0)throw Error('未移入会话时固定按钮仍显示')
 await taskRow.hover()
 if((await pinState(pin)).opacity<=0)throw Error('移入会话后没有显示固定按钮')
 const otherPins=await workNavigation.locator('.wb-hub-session-row').filter({hasNot:page.getByRole('button',{name:'会话：'+taskTitle,exact:true})}).locator('.wb-hub-pin').evaluateAll(els=>els.map(el=>Number(getComputedStyle(el).opacity)))
 if(otherPins.some(opacity=>opacity!==0))throw Error('移入一条会话时其他会话的固定按钮也显示')
 await workNavigation.getByRole('button',{name:'置顶会话：'+taskTitle,exact:true}).click()
 await workNavigation.getByRole('button',{name:'取消置顶：'+taskTitle,exact:true}).waitFor()
 await page.mouse.move(1200,750)
 if((await pinState(pin)).opacity!==0)throw Error('移出已固定会话后按钮没有隐藏')
 await taskRow.getByRole('button',{name:'会话：'+taskTitle,exact:true}).focus();await page.keyboard.press('Tab')
 if((await pinState(pin)).opacity<=0||!await pin.evaluate(el=>el===document.activeElement))throw Error('键盘聚焦会话固定按钮后不可见或不可操作')
 await page.getByRole('textbox',{name:'助手消息'}).focus()
 if((await pinState(pin)).opacity!==0)throw Error('键盘焦点离开会话后固定按钮没有隐藏')
 const chatWidth=await page.locator('.wb-assistant-conversation').evaluate(el=>el.getBoundingClientRect().width)
 await page.getByRole('navigation',{name:'助手会话列表'}).getByRole('button',{name:'收起会话列表'}).click()
 const expandedChatWidth=await page.locator('.wb-assistant-conversation').evaluate(el=>el.getBoundingClientRect().width)
 if(expandedChatWidth<chatWidth+150)throw Error('折叠会话列表后聊天区域没有扩展')
 await page.getByLabel('更多助手操作',{exact:true}).click()
 await page.getByRole('navigation',{name:'工作台导航'}).locator('[data-page="dashboard"]').click()
 await page.evaluate(()=>window.WB.assistant.openHub('system:analysis'))
 await page.getByRole('button',{name:'收起会话列表'}).waitFor()
 await workNavigation.waitFor()
 await workNavigation.getByRole('button',{name:'取消置顶：'+taskTitle,exact:true}).waitFor()
 for(let attempt=0;attempt<2;attempt++){
  await page.getByRole('button',{name:'＋工具',exact:true}).click()
  await page.getByRole('dialog').getByRole('button',{name:/^日报/}).click()
  await page.getByRole('button',{name:'生成日报',exact:true}).waitFor()
  const prepared=await page.evaluate(()=>({id:window.WB.store.get().assistantConversationId,starts:window.hubCalls.filter(call=>call.operation==='office.start').length}))
  if(prepared.id!=='office:layout-day'||prepared.starts!==0)throw Error('打开报告主题时意外执行，或重复选择未恢复同主题')
 }
 for(const [width,height] of [[1280,800],[800,700],[360,700],[360,360]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.className=theme,theme)
  await checkToolbar()
  await page.evaluate(()=>window.WB.assistant.openHub('system:analysis'))
  await page.locator('.wb-hub-run').first().waitFor()
  if(width<640){
   const collapse=page.getByRole('button',{name:'收起会话列表'});if(await collapse.count())await collapse.click()
   await workNavigation.waitFor({state:'hidden'})
   await page.getByRole('button',{name:'展开会话列表'}).click();await workNavigation.waitFor()
   await page.getByRole('button',{name:'收起会话列表'}).click();await workNavigation.waitFor({state:'hidden'})
  }else {
   const expand=page.getByRole('button',{name:'展开会话列表'});if(await expand.count())await expand.click()
   await page.getByRole('button',{name:'收起会话列表'}).click();await workNavigation.waitFor({state:'hidden'});await page.getByRole('button',{name:'展开会话列表'}).click()
  }
  async function measure(stage){
   const editor=page.getByRole('textbox',{name:'助手消息'});await editor.scrollIntoViewIfNeeded()
   const send=page.getByRole('button',{name:'发送',exact:true});await send.scrollIntoViewIfNeeded()
   const metrics=await page.locator('.wb-assistant').evaluate(el=>{const input=el.querySelector('.wb-assistant-input').getBoundingClientRect();return {overflow:el.scrollWidth-el.clientWidth,inputBottom:input.bottom,viewportHeight:innerHeight,bodyHeight:el.querySelector('.wb-assistant-body').clientHeight}})
   report.push({width,height,theme,stage,...metrics});if(metrics.overflow>2||metrics.inputBottom>height+2||metrics.bodyHeight<30)throw Error(JSON.stringify(report.at(-1)))
   await page.screenshot({path:resolve(output,`${width}-${height}-${theme}-${stage}.png`),animations:'disabled'})
  }
  const systemMetrics=await systemNavigation.evaluate(el=>({height:el.getBoundingClientRect().height,overflow:el.scrollWidth-el.clientWidth,buttons:[...el.children].map(button=>({width:button.getBoundingClientRect().width,children:[...button.children].map(child=>({tag:child.tagName,display:getComputedStyle(child).display}))}))}))
  if(systemMetrics.overflow>2||systemMetrics.height>88)throw Error('固定系统入口仍占用过大面积 '+JSON.stringify({width,height,theme,...systemMetrics}))
  const extraction=page.getByRole('region',{name:'提取结果'});await extraction.waitFor();await extraction.getByRole('article').first().waitFor()
  await page.waitForFunction(()=>{const body=document.querySelector('.wb-hub-body');return body.scrollHeight-body.scrollTop-body.clientHeight<2})
  await measure('results')
  const history=page.locator('.wb-hub-history-day').filter({hasText:'两天前已识别20条'})
  await history.waitFor();if(await history.getAttribute('open')!==null)throw Error('旧日期的已完成记录没有默认收起')
  await history.locator('summary').first().click();await history.getByText('两天前已识别20条，当前结果以最新消息为准。',{exact:true}).waitFor();await measure('history-expanded');await history.locator('summary').first().click()
  await extraction.getByRole('button',{name:'在对话中修改',exact:true}).first().click();await page.getByRole('region',{name:'已选择的上下文'}).waitFor();const selected=await page.evaluate(()=>({id:window.WB.store.get().assistantConversationId,refs:window.WB.store.get().assistantRefs}));if(selected.id!=='system:analysis'||selected.refs.length!==1)throw Error('修改提取项离开固定会话或混入多项上下文');await measure('editing-result')
  const recognition=page.locator('.wb-hub-recognition');await recognition.locator('summary').click();await recognition.getByText('消息 recognition-49',{exact:true}).scrollIntoViewIfNeeded();await measure('recognition-details')
  await page.evaluate(()=>window.WB.assistant.openHub('system:radar'));await page.getByRole('region',{name:'提交与处理结果'}).first().waitFor();const summaryFeedback=page.locator('.wb-hub-recognition');await summaryFeedback.locator('summary').click();if(!await summaryFeedback.getByText('技术变化',{exact:true}).count()||(await summaryFeedback.textContent()).includes('指令建议'))throw Error('资讯摘要仍被当成消息指令建议');await summaryFeedback.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(output,`${width}-${height}-${theme}-summary-feedback.png`),animations:'disabled'});await page.locator('.wb-hub-command-details').getByText('指令详情',{exact:true}).click();await page.getByText('radar.search',{exact:true}).scrollIntoViewIfNeeded();await measure('turn-response')
  const knowledgeNote=page.getByText('本轮未命中知识库资料',{exact:true});await knowledgeNote.waitFor()
  const knowledgePlacement=await knowledgeNote.evaluate(el=>{const card=el.closest('article'),turn=el.closest('[data-turn-id]'),note=el.getBoundingClientRect(),bounds=card?.getBoundingClientRect();return {turnId:turn?.dataset.turnId,inside:!!bounds&&note.left>=bounds.left-1&&note.right<=bounds.right+1&&note.top>=bounds.top-1&&note.bottom<=bounds.bottom+1}})
  if(knowledgePlacement.turnId!=='layout-reinterpretation'||!knowledgePlacement.inside)throw Error('知识提示没有放入对应回复卡片 '+JSON.stringify({width,height,theme,...knowledgePlacement}))
  await knowledgeNote.scrollIntoViewIfNeeded();await measure('knowledge-in-reply')
  await page.evaluate(()=>window.WB.assistant.openHub('system:knowledge'))
  const editor=page.getByRole('textbox',{name:'助手消息'});await editor.fill('删除合成知识');await page.getByRole('button',{name:'发送',exact:true}).click()
  await page.getByRole('region',{name:'待确认操作'}).waitFor();await measure('confirmation')
  await page.evaluate(()=>window.WB.assistant.openHub('office:layout-report'))
  const artifact=page.getByRole('region',{name:'办公成果：本周工作报告'});await artifact.waitFor();await artifact.scrollIntoViewIfNeeded()
  const fullReport=artifact.locator('.wb-hub-office-full');await fullReport.waitFor();if(await fullReport.getAttribute('open')!==null)throw Error('长报告没有默认摘要显示')
  const preview=await artifact.locator('.wb-hub-artifact-preview').evaluate(el=>({height:el.getBoundingClientRect().height,text:el.textContent}))
  if(preview.height>110||/^\s*#{1,6}\s/.test(preview.text))throw Error('报告摘要过长或直接泄露Markdown标记 '+JSON.stringify({width,height,previewHeight:preview.height}))
  await measure('office-artifacts');await fullReport.locator('summary').click();await measure('office-expanded');await fullReport.locator('summary').click()
  if(width<640){
   const more=page.getByLabel('更多助手操作',{exact:true});await more.click()
   await page.getByRole('button',{name:'生成周报',exact:true}).waitFor()
   const menuBounds=await page.locator('.wb-hub-more-menu').evaluate(el=>{const rect=el.getBoundingClientRect();return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,overflow:el.scrollWidth-el.clientWidth}})
   if(menuBounds.left< -2||menuBounds.right>width+2||menuBounds.bottom>height+2||menuBounds.overflow>2)throw Error('窄屏更多操作菜单溢出 '+JSON.stringify({width,height,...menuBounds}))
   await page.screenshot({path:resolve(output,`${width}-${height}-${theme}-office-menu.png`),animations:'disabled'});await more.click()
  }
  async function measureModal(stage){const dialog=page.getByRole('dialog');await dialog.waitFor();const metrics=await dialog.evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,viewportHeight:innerHeight}));report.push({width,height,theme,stage,...metrics});if(metrics.overflow>2||metrics.top< -2||metrics.bottom>height+2)throw Error(JSON.stringify(report.at(-1)));await page.screenshot({path:resolve(output,`${width}-${height}-${theme}-${stage}.png`),animations:'disabled'})}
  async function openTool(name){await page.getByRole('button',{name:'＋工具',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:new RegExp('^'+name)}).click()}
  await page.evaluate(()=>window.WB.store.set({data:{...window.WB.store.get().data,replies:Array.from({length:22},(_,index)=>({id:'office-reply-'+index,contact:'合成联系人 '+(index+1),snippet:'待核对的回复内容与上下文。',stage:'待回复'}))}}))
  await openTool('批量回复草稿');await page.getByRole('checkbox',{name:'选择待回复：合成联系人 1',exact:true}).check();await measureModal('office-batch');await page.getByRole('button',{name:'取消',exact:true}).click()
  await openTool('自动回复设置');await page.getByRole('switch',{name:'忙碌自动回复'}).waitFor();await measureModal('office-busy');await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click()
 }
 const mutations=await page.evaluate(()=>window.hubCalls.filter(row=>['operate','reset'].includes(row.action)&&row.operation!=='busyReply.status'))
 if(mutations.length)throw Error('布局检查意外执行了业务操作')
 writeFileSync(resolve(output,'report.json'),JSON.stringify({cases:report.length,report,errors},null,2));console.log(JSON.stringify({cases:report.length,errors,output}));if(errors.length)process.exitCode=1
}catch(error){
 await page.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{})
 writeFileSync(resolve(output,'failure.json'),JSON.stringify({completedCases:report.length,report,errors,error:String(error.stack||error)},null,2))
 throw error
}finally{await browser.close()}
