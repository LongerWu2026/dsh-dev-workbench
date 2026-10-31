import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-web-ai-'));process.env.DSH_HOME=home
await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export * from './src/shared/web-ai.ts';export * from './src/client/features/web-ai/runner.ts';export {normalizeState} from './src/host/domain/model.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const h=await import(join(home,'host.mjs'));let api;const disposers=[]
h.apply({provide:(n,v)=>{if(n==='workbench')api=v},inject(){},get(){},effect:fn=>{const d=fn();if(typeof d==='function')disposers.push(d)},logger:{info(){}}})
let checks=0;const check=(label,fn)=>{fn();checks++;console.log('✓ '+label)},state=()=>h.loadWorkbenchState().webAI
try{
 check('限定5家国内厂商及可选ChatGPT，不增加其他厂商',()=>{assert.deepEqual(h.WEB_AI_PROVIDERS.map(p=>p.id),['kimi','glm','doubao','yuanbao','qianwen','chatgpt']);assert.equal(state().chatgptEnabled,false)})
 const capabilities=(await api.webAIState()).capabilities
 await assert.rejects(()=>api.webAIOpenExternal({providerId:'kimi'}),/仅使用工作台内嵌/)
 check('旧版外部窗口接口也明确拒绝，不探测或启动Chrome',()=>assert.equal(capabilities.chromeAvailable,false))
 check('会话地址剔除查询授权，拒绝跨域、端口、凭据和登录回调',()=>{assert.equal(h.webAIConversationUrl('kimi','https://www.kimi.com/chat/one?token=secret#abc'),'https://www.kimi.com/chat/one');for(const u of ['http://www.kimi.com/chat','https://www.kimi.com.evil.com/chat','https://a:b@www.kimi.com/chat','https://www.kimi.com:444/chat','https://www.kimi.com/oauth/callback'])assert.equal(h.webAIConversationUrl('kimi',u),null)})
 const {topicId}=await api.webAICreateTopic({title:'功能评审'}),request={topicId,requestId:'batch-request-0001',questions:['同一问题','继续追问'],providers:['kimi','glm']}
 await api.webAISaveConversation({topicId,providerId:'glm',url:'https://chatglm.cn/main/alltoolsdetail?cid=conversation_123&token=discard'});
 check('官网导航保存允许的会话ID，登录参数不进入记录',()=>assert.equal(state().topics[0].conversations.glm,'https://chatglm.cn/main/alltoolsdetail?cid=conversation_123'))
 await assert.rejects(()=>api.webAISaveConversation({topicId,providerId:'glm',url:'https://example.org/'}),/无效/);checks++
 await assert.rejects(()=>api.webAIStart({...request,providers:['claude']}),/不支持/);checks++
 await assert.rejects(()=>api.webAIStart({...request,providers:['chatgpt']}),/启用/);checks++
 await Promise.all(Array.from({length:5},()=>api.webAIStart(request)))
 check('重复和并发提交只创建两轮，批量问题沿用一个主题',()=>{assert.equal(state().rounds.length,2);assert.equal(new Set(state().rounds.map(r=>r.topicId)).size,1)})
 const round=state().rounds[0],claims=await Promise.all(Array.from({length:5},()=>api.webAIClaim({roundId:round.id,providerId:'kimi'}))),claim=claims.find(c=>c.executionId)
 check('一个发送意图只能被领取一次',()=>assert.equal(claims.filter(c=>c.executionId).length,1))
 await api.webAIUpdate({roundId:round.id,providerId:'kimi',executionId:'fake',status:'completed',text:'错误结果'})
 check('拒绝过期/伪造执行栅栏，不采纳其他轮结果',()=>assert.equal(state().rounds[0].answers[0].status,'preparing'))
 await api.webAIUpdate({roundId:round.id,providerId:'kimi',executionId:claim.executionId,status:'generating',url:'https://www.kimi.com/chat/topic?secret=omit'})
 await assert.rejects(()=>api.webAIStart({...request,requestId:'another-request-002'}),/正在/);checks++
 await api.webAICancel({topicId});await api.webAIUpdate({roundId:round.id,providerId:'kimi',executionId:claim.executionId,status:'completed',text:'迟到结果'})
 check('取消后不采纳迟到结果，原会话地址仍保留',()=>{assert.equal(state().rounds[0].answers[0].text,'');assert.equal(state().topics[0].conversations.kimi,'https://www.kimi.com/chat/topic')})
 const answer=state().rounds[0].answers[0];await api.webAIRecord({roundId:round.id,providerId:'kimi',expectedUpdatedAt:answer.updatedAt,text:'人工从官网保存的回答',url:'https://www.kimi.com/chat/topic'})
 await assert.rejects(()=>api.webAIRecord({roundId:round.id,providerId:'kimi',expectedUpdatedAt:'outdated',text:'不应覆盖'}),/已更新/);checks++
 const pack=await api.exportMigration();check('对比记录进入业务迁移包，浏览器资料和执行栅栏不进入迁移包',()=>{assert.equal(pack.data.webAI.rounds[0].answers[0].text,'人工从官网保存的回答');assert.equal(JSON.stringify(pack.data.webAI).includes('executionId'),false);assert.equal(JSON.stringify(pack.data.webAI).includes('chrome-profile'),false)})
 check('重启时在途状态改为需核对，禁止自动重发',()=>{const normalized=h.normalizeWebAI({...state(),rounds:[{...round,answers:[{providerId:'kimi',status:'generating',text:'部分内容'}]}]},true);assert.equal(normalized.rounds[0].answers[0].status,'uncertain');assert.equal(normalized.rounds[0].answers[0].text,'部分内容')})
 check('重启不将历史已填入误报为当前草稿已恢复，保留只读采集基线',()=>{const normalized=h.normalizeWebAI({...state(),rounds:[{...round,answers:[{providerId:'kimi',status:'prepared',text:'',capture:{answerCount:2,userCount:1}}]}]},true);const answer=normalized.rounds[0].answers[0];assert.equal(answer.status,'uncertain');assert.match(answer.note,/不会自动重新填入或发送/);assert.deepEqual(answer.capture,{answerCount:2,userCount:1})})
 // Runner is exercised against temporal website observations, not a mirror of its implementation.
 let submissions=0,now=0,observations=0,updates=[];const signal=new AbortController().signal,pause=async ms=>{now+=ms}
 const website={execute:async action=>{if(action==='prepare')return{status:'prepared'};if(action==='submit'){submissions++;return{status:'generating'}};observations++;return observations===1?{status:'ready',answers:['旧回答']}:observations===2?{status:'generating',busy:true,answers:['旧回答','新回答']}:{status:'ready',busy:false,answers:['旧回答','新回答']}}}
 await h.runWebsiteQuestion(website,'问题','unique',async p=>updates.push(p),signal,false,()=>now,pause)
 check('等待本轮新回答并确认结束，旧回答不误配，发送一次',()=>{assert.equal(submissions,1);assert.equal(updates.at(-1).status,'completed');assert.equal(updates.at(-1).text,'新回答')})
 observations=0;updates=[];submissions=0;await h.runWebsiteQuestion(website,'问题','prepare',async p=>updates.push(p),signal,true,()=>now,pause)
 check('仅填入模式不提交官网消息',()=>{assert.equal(submissions,0);assert.equal(updates.at(-1).status,'prepared')})
 const login={execute:async()=>({status:'needs_login',note:'请登录'})};updates=[];await h.runWebsiteQuestion(login,'问题','login',async p=>updates.push(p),signal,false,()=>now,pause)
 check('登录失效在发送前阻断',()=>assert.equal(updates.at(-1).status,'needs_login'))
 observations=0;now=0;await assert.rejects(()=>h.runWebsiteQuestion(website,'问题','sleep',async()=>{},signal,false,()=>now,async()=>{now+=60000}),/休眠/);checks++
 const noEnd={execute:async action=>action==='prepare'?{status:'prepared'}:action==='submit'?{status:'generating'}:{status:'ready',answers:observations++===0?[]:['新内容'],busy:false}};observations=0;now=0;updates=[]
 await h.runWebsiteQuestion(noEnd,'问题','no-end',async p=>updates.push(p),signal,false,()=>now,pause)
 check('稳定文本不冒充官网结束证据',()=>{assert.equal(updates.at(-1).status,'uncertain');assert.equal(updates.at(-1).text,'新内容')})
 const aborted=new AbortController();aborted.abort();await assert.rejects(()=>h.runWebsiteQuestion(website,'问题','cancel',async()=>{},aborted.signal),/停止/);checks++
 check('状态文件已落盘并可读取',()=>{const file=join(home,'storages/dev-workbench/state.json');assert.equal(JSON.parse(readFileSync(file,'utf8')).webAI.topics[0].id,topicId)})
 const auto={requestId:'auto-first-question-001',questions:['无需创建主题的第一问'],providers:['doubao']},oldTopicCount=state().topics.length
 await Promise.all(Array.from({length:8},()=>api.webAIStart(auto)))
 check('首次提问原子创建历史问答；并发重放不产生空主题或重复问题',()=>{assert.equal(state().topics.length,oldTopicCount+1);assert.equal(state().rounds.filter(r=>r.requestId===auto.requestId).length,1)})
 const autoRound=state().rounds.find(r=>r.requestId===auto.requestId),autoClaim=await api.webAIClaim({roundId:autoRound.id,providerId:'doubao'})
 await api.webAIUpdate({roundId:autoRound.id,providerId:'doubao',executionId:autoClaim.executionId,status:'prepared',capture:{answerCount:2,userCount:2}})
 const resume=await api.webAIResumeCapture({roundId:autoRound.id,providerId:'doubao'})
 await api.webAIUpdate({roundId:autoRound.id,providerId:'doubao',executionId:autoClaim.executionId,status:'completed',text:'旧请求应被忽略'})
 check('人工发送后恢复采集换新栅栏，保留基线且不采纳旧回包',()=>{const row=state().rounds.at(-1).answers[0];assert.deepEqual(row.capture,{answerCount:2,userCount:2});assert.notEqual(resume.executionId,autoClaim.executionId);assert.equal(row.text,'');assert.deepEqual(h.normalizeWebAI(state(),true).rounds.at(-1).answers[0].capture,row.capture)})
 await api.webAIUpdate({roundId:autoRound.id,providerId:'doubao',executionId:resume.executionId,status:'completed',text:'恢复采集所得回答'})
 observations=0;now=0;submissions=0;updates=[]
 const silent={execute:async action=>{if(action==='prepare')return{status:'prepared'};if(action==='submit'){submissions++;return{status:'generating'}}return{status:'ready',answers:[],answerCount:0,userCount:0}}}
 await h.runWebsiteQuestion(silent,'问题','no-ack',async p=>updates.push(p),signal,false,()=>now,pause)
 check('点击后无官网接收证据，及时停留人工处理且不反复发送',()=>{assert.equal(submissions,1);assert.equal(updates.at(-1).status,'prepared');assert.ok(now<20000)})
 now=0;updates=[];let actions=[]
 const identical={execute:async action=>{actions.push(action);assert.equal(action,'observe');return{status:'ready',answerCount:9,answers:Array(8).fill('相同回答'),complete:true,userCount:9,lastQuestion:'问题'}}}
 await h.collectWebsiteAnswer(identical,'问题',{answerCount:8,userCount:8},async p=>updates.push(p),signal,()=>now,pause)
 check('只读恢复不提交问题；第9条内容相同的回答仍可正确归属',()=>{assert.ok(actions.length>0);assert.equal(updates.at(-1).status,'completed');assert.equal(updates.at(-1).text,'相同回答')})
 now=0;updates=[];await h.collectWebsiteAnswer({execute:async()=>({status:'ready',answerCount:3,answers:['别的问题的回答'],userCount:3,lastQuestion:'别人新增的问题'})},'原问题',{answerCount:2,userCount:2},async p=>updates.push(p),signal,()=>now,pause)
 check('官网出现不同提问时停止，不把其他回答写到本轮',()=>{assert.equal(updates.at(-1).status,'uncertain');assert.equal(updates.at(-1).text,undefined)})
 let reads=0,preparedCount=0;now=0;updates=[]
 const hydrating={execute:async action=>{if(action==='prepare'){preparedCount++;return{status:'prepared'}}if(action==='observe')return ++reads<3?{status:'unsupported',editorCount:0,answers:[]}:{status:'ready',editorCount:1,answers:[]};throw new Error('仅填入测试不应提交')}}
 await h.runWebsiteQuestion(hydrating,'页面延迟挂载的提问','hydrate',async p=>updates.push(p),signal,true,()=>now,pause)
 check('等待官网输入组件挂载后只填入一次，不因DOM初始为空误判失败',()=>{assert.equal(reads,3);assert.equal(preparedCount,1);assert.equal(updates.at(-1).status,'prepared')})
 now=0;updates=[];let probes=0,clicks=0,seen=0
 const settling={execute:async action=>{if(action==='prepare')return{status:'prepared'};if(action==='submit'){probes++;if(probes<3)return{status:'prepared',retryableBeforeSend:true};clicks++;return{status:'generating'}}return ++seen===1?{status:'ready',answers:[],answerCount:0,userCount:0}:{status:'ready',answers:['完成'],answerCount:1,userCount:1,lastQuestion:'问题',complete:true}}}
 await h.runWebsiteQuestion(settling,'问题','settling',async p=>updates.push(p),signal,false,()=>now,pause)
 check('官网受控输入等待就绪只发生在点击前，启用后只发一次',()=>{assert.equal(probes,3);assert.equal(clicks,1);assert.equal(updates.at(-1).status,'completed')})
 now=0;updates=[];probes=0
 const disabled={execute:async action=>action==='prepare'?{status:'prepared'}:action==='submit'?(probes++,{status:'prepared',retryableBeforeSend:true,note:'按钮未启用'}):{status:'ready',answers:[],editorCount:1}}
 await h.runWebsiteQuestion(disabled,'问题','disabled',async p=>updates.push(p),signal,false,()=>now,pause)
 check('始终禁用的发送按钮有限等待后停止，不绕过禁用或无限重试',()=>{assert.equal(probes,5);assert.equal(updates.at(-1).status,'prepared');assert.ok(now<2000)})
 const ordered=await api.webAIStart({requestId:'ordered-batch-guard-001',questions:['顺序第一问','顺序第二问','顺序第三问'],providers:['glm']})
 const orderedRounds=ordered.rounds.filter(r=>r.requestId==='ordered-batch-guard-001')
 const firstLease=await api.webAIClaim({roundId:orderedRounds[0].id,providerId:'glm'})
 const premature=await api.webAIClaim({roundId:orderedRounds[1].id,providerId:'glm'})
 check('Host也拒绝提前领取后续问题，重复客户端不能并行发送同一厂商的两问',()=>assert.equal(premature.executionId,null))
 await api.webAIUpdate({roundId:orderedRounds[0].id,providerId:'glm',executionId:firstLease.executionId,status:'completed',text:'第一答完整结束'})
 const secondLease=await api.webAIClaim({roundId:orderedRounds[1].id,providerId:'glm'})
 check('前一答完成后才可领取下一问',()=>assert.ok(secondLease.executionId))
 await api.webAIUpdate({roundId:orderedRounds[1].id,providerId:'glm',executionId:secondLease.executionId,status:'uncertain',text:'第二答有待确认'})
 const blocked=await api.webAIClaim({roundId:orderedRounds[2].id,providerId:'glm'})
 check('前一答不确定时Host将后续标记未发送，不遗留假运行或自动重发',()=>{assert.equal(blocked.executionId,null);assert.equal(state().rounds.find(r=>r.id===orderedRounds[2].id).answers[0].status,'unsupported')})
 const normalizedCapture=h.normalizeWebAICapture({answerCount:4,userCount:4,lastAnswerId:'page-4',lastAnswerHash:'abcdef12',cookie:'not-allowed'})
 check('重启所需的基线身份和摘要经严格白名单保存，不保存认证字段',()=>{assert.deepEqual(normalizedCapture,{answerCount:4,userCount:4,lastAnswerId:'page-4',lastAnswerHash:'abcdef12'});assert.equal(h.normalizeWebAICapture({answerCount:-1}),undefined)})
 await api.webAICancel({})
 const attachmentStart=await api.webAIStart({requestId:'attachment-metadata-test-001',questions:['附件问题','附件后续'],providers:['kimi'],attachments:[{id:'file-synthetic',name:'synthetic.txt',size:6,type:'text/plain',base64:'NEVER-PERSIST',path:'/never/read'}]})
 const attachmentRounds=attachmentStart.rounds.filter(r=>r.requestId==='attachment-metadata-test-001')
 const repeatedAttachment=await api.webAIStart({requestId:'attachment-metadata-test-001',questions:['附件问题','附件后续'],providers:['kimi'],attachments:[{id:'file-synthetic',name:'synthetic.txt',size:6,type:'text/plain'}]})
 check('传输失败后用同一请求标识重建仍只保留原两轮，不重复创建附件问答',()=>assert.deepEqual(repeatedAttachment.rounds.filter(r=>r.requestId==='attachment-metadata-test-001').map(r=>r.id),attachmentRounds.map(r=>r.id)))
 check('附件仅首问保存元数据，不持久化原文、编码或本机路径',()=>{assert.deepEqual(attachmentRounds[0].attachments,[{id:'file-synthetic',name:'synthetic.txt',size:6,type:'text/plain'}]);assert.equal(attachmentRounds[1].attachments,undefined);assert.ok(!JSON.stringify(attachmentStart).includes('NEVER-PERSIST'));assert.ok(!JSON.stringify(attachmentStart).includes('/never/read'))})
 const attachmentClaim=await api.webAIClaim({roundId:attachmentRounds[0].id,providerId:'kimi'})
 for(const answerCount of [2,4])await api.webAIUpdate({roundId:attachmentRounds[0].id,providerId:'kimi',executionId:attachmentClaim.executionId,status:'preparing',capture:{answerCount,userCount:answerCount,conversationKey:'abcdef12'}})
 check('上传期间旧会话延迟恢复时，可在发送前刷新采集基线',()=>assert.equal(state().rounds.find(r=>r.id===attachmentRounds[0].id).answers[0].capture.answerCount,4))
 await api.webAIUpdate({roundId:attachmentRounds[0].id,providerId:'kimi',executionId:attachmentClaim.executionId,status:'generating',capture:{answerCount:100,userCount:100}})
 check('提交后的迟到回写不能覆盖采集基线',()=>assert.equal(state().rounds.find(r=>r.id===attachmentRounds[0].id).answers[0].capture.answerCount,4))
 await api.webAICancel({requestId:'attachment-metadata-test-001'})
 await assert.rejects(()=>api.webAIStart({requestId:'attachment-invalid-test-001',questions:['问题'],providers:['kimi'],attachments:[{id:'bad',name:'bad.exe',size:6,type:''}]}),/格式/);checks++
 check('宿主声明本地历史管理协议',()=>assert.equal(capabilities.historyProtocol,1))
 const managed=await api.webAIStart({requestId:'local-history-fixture-001',questions:['官网原问题'],providers:['kimi']}),mr=managed.rounds.find(r=>r.requestId==='local-history-fixture-001'),mid=mr.topicId
 const topicVersion=()=>state().topics.find(t=>t.id===mid)?.version||0
 await assert.rejects(()=>api.webAIManageTopic({topicId:mid,expectedVersion:topicVersion(),action:'trash',confirm:true}),/停止/);checks++
 await api.webAICancel({topicId:mid})
 await h.mutateWorkbenchState(s=>{s.webAI.rounds.find(r=>r.id===mr.id).answers[0].status='prepared';return s})
 await assert.rejects(()=>api.webAIManageTopic({topicId:mid,expectedVersion:topicVersion(),action:'trash',confirm:true}),/停止/);checks++
 await api.webAICancel({topicId:mid})
 await assert.rejects(()=>api.webAIManageTopic({topicId:mid,expectedVersion:topicVersion(),action:'trash'}),/确认/);checks++
 const versionBefore=topicVersion()
 const edits=await Promise.allSettled(['本地名称A','本地名称B'].map(title=>api.webAIManageTopic({topicId:mid,expectedVersion:versionBefore,action:'rename',title})))
 check('同版本并发重命名仅一次成功，拒绝覆盖另一客户端修改',()=>assert.equal(edits.filter(r=>r.status==='fulfilled').length,1))
 await api.webAIEditQuestion({topicId:mid,roundId:mr.id,text:'本地修订问题',expectedVersion:topicVersion()})
 check('本地问题修订保留官网原问题，正常化后仍保留修订与版本',()=>{const r=state().rounds.find(r=>r.id===mr.id);assert.equal(r.question,'官网原问题');assert.equal(r.displayQuestion,'本地修订问题');const normalized=h.normalizeWebAI(state());assert.equal(normalized.rounds.find(x=>x.id===mr.id).displayQuestion,'本地修订问题');assert.equal(normalized.topics.find(t=>t.id===mid).version,topicVersion())})
 await api.webAIEditQuestion({topicId:mid,roundId:mr.id,text:'官网原问题',expectedVersion:topicVersion()})
 check('恢复原问题可清除本地显示覆盖',()=>assert.equal(state().rounds.find(r=>r.id===mr.id).displayQuestion,undefined))
 await api.webAIManageTopic({topicId:mid,expectedVersion:topicVersion(),action:'trash',confirm:true})
 check('移入回收站保留问答与附件记录，不影响其他主题',()=>{assert.ok(state().topics.find(t=>t.id===mid).deletedAt);assert.ok(state().rounds.some(r=>r.id===mr.id));assert.ok(state().topics.some(t=>t.id===topicId));assert.ok(h.normalizeWebAI(state()).topics.find(t=>t.id===mid).deletedAt)})
 await assert.rejects(()=>api.webAIStart({topicId:mid,requestId:'deleted-start-guard-001',questions:['不应提交'],providers:['kimi']}),/不存在/);checks++
 await assert.rejects(()=>api.webAISaveConversation({topicId:mid,providerId:'kimi',url:'https://kimi.com/chat/fixture'}),/回收站/);checks++
 await api.webAIManageTopic({topicId:mid,expectedVersion:topicVersion(),action:'restore'})
 check('回收站恢复保留原ID和所有问答，不建立官网会话',()=>{assert.equal(state().topics.find(t=>t.id===mid).deletedAt,undefined);assert.equal(state().rounds.find(r=>r.id===mr.id).question,'官网原问题')})
 await assert.rejects(()=>api.webAIManageTopic({topicId:mid,expectedVersion:topicVersion(),action:'purge',confirm:true}),/先将/);checks++
 await api.webAIManageTopic({topicId:mid,expectedVersion:topicVersion(),action:'trash',confirm:true})
 await assert.rejects(()=>api.webAIManageTopic({topicId:mid,expectedVersion:topicVersion(),action:'purge'}),/确认/);checks++
 await api.webAIManageTopic({topicId:mid,expectedVersion:topicVersion(),action:'purge',confirm:true})
 check('永久删除只清理确认的本地主题及其轮次',()=>{assert.ok(!state().topics.some(t=>t.id===mid));assert.ok(!state().rounds.some(r=>r.topicId===mid));assert.ok(state().topics.some(t=>t.id===topicId))})
 const bulkA=(await api.webAICreateTopic({title:'批量删除甲'})).topicId,bulkB=(await api.webAICreateTopic({title:'批量删除乙'})).topicId
 await h.mutateWorkbenchState(s=>{for(const id of [bulkA,bulkB])s.webAI.rounds.push({...structuredClone(mr),id:'bulk-round-'+id,topicId:id,answers:mr.answers.map(a=>({...a,status:'completed',text:'本地保留证据'}))});return s})
 const targets=()=>[bulkA,bulkB].map(topicId=>({topicId,expectedVersion:state().topics.find(t=>t.id===topicId).version||0}))
 const unchanged=()=>JSON.stringify(h.loadWorkbenchState())
 let before=unchanged()
 await assert.rejects(()=>api.webAIManageTopic({action:'trash',topics:targets()}),/确认/)
 await assert.rejects(()=>api.webAIManageTopic({action:'trash',confirm:true,topics:[targets()[0],{...targets()[1],expectedVersion:999}]}),/已更新/)
 check('批量删除缺少确认或任一版本冲突时整批不写入',()=>assert.equal(unchanged(),before))
 await h.mutateWorkbenchState(s=>{s.webAI.rounds.find(r=>r.topicId===bulkB).answers[0].status='generating';return s});before=unchanged()
 await assert.rejects(()=>api.webAIManageTopic({action:'trash',confirm:true,topics:targets()}),/停止/)
 check('任一选中问答仍在采集时，其他选中项也不会先被删除',()=>assert.equal(unchanged(),before))
 await api.webAICancel({topicId:bulkB});before=unchanged()
 for(const topics of [[],[targets()[0],targets()[0]],[targets()[0],{topicId:'not-found',expectedVersion:0}]])await assert.rejects(()=>api.webAIManageTopic({action:'trash',confirm:true,topics}))
 await assert.rejects(()=>api.webAIManageTopic({action:'purge',confirm:true,topics:targets()}),/先将/)
 check('空选择、重复ID、不存在的问答及未进回收站的永久删除均拒绝',()=>assert.equal(unchanged(),before))
 const roundsBefore=state().rounds.length
 await api.webAIManageTopic({action:'trash',confirm:true,topics:targets()})
 check('确认后批量移入回收站，保留每组问答及其他主题',()=>{assert.ok([bulkA,bulkB].every(id=>state().topics.find(t=>t.id===id).deletedAt));assert.equal(state().rounds.length,roundsBefore);assert.ok(state().topics.some(t=>t.id===topicId&&!t.deletedAt))})
 before=unchanged()
 await assert.rejects(()=>api.webAIManageTopic({action:'purge',confirm:true,topics:[targets()[0],{...targets()[1],expectedVersion:0}]}),/已更新/)
 check('永久删除也先校验全部版本，不发生部分删除',()=>assert.equal(unchanged(),before))
 await api.webAIManageTopic({action:'purge',confirm:true,topics:targets()})
 check('批量永久删除仅移除确认的本地主题和轮次',()=>{assert.ok(!state().topics.some(t=>[bulkA,bulkB].includes(t.id)));assert.ok(!state().rounds.some(r=>[bulkA,bulkB].includes(r.topicId)));assert.ok(state().topics.some(t=>t.id===topicId))})
 console.log('web-ai: '+checks+' checks passed')
}finally{disposers.reverse().forEach(d=>d());rmSync(home,{recursive:true,force:true})}
