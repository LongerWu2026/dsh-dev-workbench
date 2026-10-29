import {HistoryManager} from './HistoryManager.js'
import {QuestionEditor} from './QuestionEditor.js'
import {localQuestion} from './history.js'
import * as React from 'react'
import {WB,Btn,Field,Input,Textarea,Select,Panel,PageHead,Spinner,useStore} from '../../core/runtime.js'
import {Pagination,PAGE_SIZE} from '../../components/Pagination.js'
import {WEB_AI_PROVIDERS,WEB_AI_ACTIVE,normalizeWebAI,webAIProvider,type WebAIState,type WebAIRound,type WebAIAnswer} from '../../../shared/web-ai.js'
import {NativeWebsite,nativeWebAIBridge,type WebsiteController} from './NativeWebsite.js'
import {collectWebsiteAnswer} from './runner.js'
import {runWebsiteBatch,persistWebAIState} from './batch.js'
import {restoreWebAITopic,rememberWebAITopic} from './preferences.js'
import {WEB_AI_CSS} from './styles.js'
import {browserSessionMode,browserSessionMessage} from './browser-session.js'

import {WebAIAttachments,selectWebAIFiles,readWebAIFiles,type SelectedWebAIFile} from './attachments.js'

const LABEL:Record<string,string>={queued:'待处理',preparing:'准备中',prepared:'已填入官网',generating:'生成中',completed:'已保存',needs_login:'需要登录',unsupported:'需官网操作',uncertain:'需要核对',cancelled:'已停止'}
export function WebAIPage(){
 const store=useStore(),[state,setState]=React.useState<WebAIState>(()=>normalizeWebAI(store.data?.webAI)),[topicId,setTopicId]=React.useState(''),[active,setActive]=React.useState('kimi'),[selected,setSelected]=React.useState<string[]>(['kimi','glm']),[drafts,setDrafts]=React.useState<Record<string,string>>({}),[batch,setBatch]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[caps,setCaps]=React.useState<any>(null),[showWeb,setShowWeb]=React.useState(false),[answerFilter,setAnswerFilter]=React.useState('all'),[page,setPage]=React.useState(0)
 const [opened,setOpened]=React.useState<Record<string,{topicId:string;url:string}>>({}),[editing,setEditing]=React.useState<{round:WebAIRound;answer:WebAIAnswer;text:string;url:string}|null>(null)
 const [showHistory,setShowHistory]=React.useState(false),[questionEdit,setQuestionEdit]=React.useState<WebAIRound|null>(null)
 const [fileDrafts,setFileDrafts]=React.useState<Record<string,SelectedWebAIFile[]>>({})
 const [compatibility,setCompatibility]=React.useState('')
 const [diagnostics,setDiagnostics]=React.useState<any>(null)
 const ownedRequest=React.useRef<string|null>(null),processing=React.useRef(false)
 const selection=React.useRef({touched:false,id:''})
 function chooseTopic(id:string){selection.current={touched:true,id};setTopicId(id);rememberWebAITopic(caps?.storageScope,id)}
 const openRef=React.useRef(opened),controllers=React.useRef(new Map<string,WebsiteController>()),abort=React.useRef<AbortController|null>(null),alive=React.useRef(true)
 function acceptState(next:WebAIState){setState(old=>Number(next.revision||0)<Number(old.revision||0)?old:next)}
 function saveNavigation(providerId:string,url:string){
  const current=openRef.current[providerId];if(!current||current.url===url)return
  openRef.current={...openRef.current,[providerId]:{...current,url}}
  if(!current.topicId)return
  void rpc('webAISaveConversation',{topicId:current.topicId,providerId,url}).then((next:WebAIState)=>{if(alive.current)acceptState(next)}).catch(()=>{})
 }
 const rpc=React.useCallback((method:string,request?:any)=>WB.rpc('workbench/'+method,request===undefined?{}:{request}),[])
 function cancelRequest(request:any){return persistWebAIState<WebAIState>(()=>rpc('webAICancel',request))}
 React.useEffect(()=>{alive.current=true;rpc('webAIState').then((r:any)=>{if(!alive.current)return;if(!r?.state||!Array.isArray(r.state.topics))throw new Error('Host 多 AI 对话接口版本不匹配，请完整重启 Harness');acceptState(r.state);setCaps(r.capabilities);if(selection.current.touched)rememberWebAITopic(r.capabilities.storageScope,selection.current.id);else setTopicId(restoreWebAITopic(r.capabilities.storageScope,r.state.topics))}).catch((e:Error)=>{if(alive.current)setError(/404/.test(e.message)?'Host 尚未加载多 AI 对话接口，请完整退出并重开 Harness。':e.message)});return()=>{alive.current=false;abort.current?.abort();if(ownedRequest.current)void cancelRequest({requestId:ownedRequest.current}).catch(()=>{})}},[rpc])
 React.useEffect(()=>{if(store.data?.webAI)acceptState({...store.data.webAI,revision:store.data.revision})},[store.data?.webAI])
 React.useEffect(()=>{if(topicId&&!state.topics.some(t=>t.id===topicId&&!t.deletedAt)){chooseTopic('');setShowWeb(false);setPage(0);setEditing(null);setQuestionEdit(null)}},[state.topics,topicId])
 const safe=(fn:()=>Promise<any>)=>{setError('');void fn().catch((e:Error)=>{if(alive.current)setError(e.message)})}
 const topic=state.topics.find(t=>t.id===topicId&&!t.deletedAt),draft=drafts[topicId]||'',providers=WEB_AI_PROVIDERS.filter(p=>p.id!=='chatgpt'||state.chatgptEnabled),files=fileDrafts[topicId]||[],rows=state.rounds.filter(r=>r.topicId===topicId).slice().reverse()
 function newConversation(){chooseTopic('');setPage(0);setShowWeb(false);setAnswerFilter('all')}
 async function getController(providerId:string){const until=Date.now()+16000;while(alive.current&&Date.now()<until){const c=controllers.current.get(providerId);if(c)return c;await new Promise(r=>setTimeout(r,100))}throw new Error('内嵌官网未就绪，请在网页检查加载或登录状态')}
 async function openProvider(providerId:string,id=topicId,workspace=state,reveal=true,question=''){
  const t=workspace.topics.find(t=>t.id===id);if(id&&(!t||t.deletedAt))throw new Error('历史问答不存在')
  if(!nativeWebAIBridge())throw new Error('当前环境无法内嵌官网，请在 Harness 桌面端使用或粘贴官网回答')
  const old=openRef.current[providerId],url=t?.conversations[webAIProvider(providerId).id]||webAIProvider(providerId).url
  if(reveal){setActive(providerId);setShowWeb(true)}setCompatibility('');setDiagnostics(null)
  if(old?.topicId===id)return getController(providerId)
  let existing:WebsiteController|undefined,adoptUrl:string|undefined
  if(old){existing=await getController(providerId);const status=await existing.execute('observe',question)
   const adopt=!!id&&!old.topicId&&!!question&&(!status.hasDraft||status.draftMatchesQuestion===true)
   if(status.busy||status.hasAttachmentDraft&&!status.attachmentsOwned||status.hasDraft&&!adopt)throw new Error(webAIProvider(providerId).name+' 的另一主题仍有草稿或正在生成，请先在官网处理')
   if(adopt)adoptUrl=status.url||old.url
  }
  const next={...openRef.current,[providerId]:{topicId:id,url:adoptUrl||url}};openRef.current=next;setOpened(next)
  if(existing&&!adoptUrl)await existing.navigate(url)
  if(adoptUrl)void rpc('webAISaveConversation',{topicId:id,providerId,url:adoptUrl}).then(acceptState).catch(()=>{})
  return getController(providerId)
 }
 async function start(prepareOnly=false){
  if(processing.current)return
  processing.current=true;setBusy(true);setError('')
  const controller=new AbortController(),requestId=WB.util.uid('web-request');abort.current=controller;ownedRequest.current=requestId
  try{
   if(files.length&&caps?.attachmentsProtocol!==1)throw new Error('附件后端尚未加载，请在插件管理中重载智能工作台后再发送；本轮未传输文件')
   const prompt=draft.trim()||(files.length?'请分析所附附件，并说明关键内容。':'')
   const questions=batch?prompt.split(/\n---\s*\n/).map(t=>t.trim()).filter(Boolean):[prompt]
   const payloads=await readWebAIFiles(files);if(controller.signal.aborted||!alive.current)return
   const create={topicId,questions,providers:selected,requestId,attachments:files.map(({file,...metadata})=>metadata)}
   const next=await persistWebAIState<WebAIState>(()=>rpc('webAIStart',create),controller.signal);acceptState(next)
   if(controller.signal.aborted||!alive.current){await cancelRequest({requestId});return}
   const effectiveTopic=next.rounds.find(r=>r.requestId===requestId)?.topicId;if(!effectiveTopic)throw new Error('本轮问答未能创建')
   setFileDrafts(old=>({...old,[effectiveTopic]:files,...(!topicId?{'':[]}:{})}));chooseTopic(effectiveTopic);setDrafts(old=>({...old,[effectiveTopic]:draft,...(!topicId?{'':''}:{})}));setShowWeb(false);setAnswerFilter('all');setPage(0)
   const rounds=next.rounds.filter(r=>r.requestId===requestId);let latestState=next
   await runWebsiteBatch(rounds,selected,{
    attachments:payloads,
    claim:(round,providerId)=>rpc('webAIClaim',{roundId:round.id,providerId}),
    update:async(round,providerId,executionId,patch)=>{const saved=await persistWebAIState<WebAIState>(()=>rpc('webAIUpdate',{roundId:round.id,providerId,executionId,...patch}),controller.signal);if(Number(saved.revision||0)>=Number(latestState.revision||0))latestState=saved;if(alive.current)acceptState(saved)},
    open:async(round,providerId)=>{
     const foreground=providerId==='glm'||payloads.length>0&&round.id===rounds[0]?.id
     const website=await openProvider(providerId,effectiveTopic,next,foreground,round.question)
     if(!foreground)return website
     let waiting=false,baseline:any=null
     return {...website,execute:async(action,question,request)=>{const result=await website.execute(action,question,request);if(action==='observe'&&!waiting)baseline=result;if(action==='submit'&&result.status==='generating')waiting=true;if(action==='observe'&&waiting&&(result.busy||result.answerCount>(baseline?.answerCount||0)||result.userCount>(baseline?.userCount||0)||baseline?.url&&result.url!==baseline.url)){waiting=false;website.releaseInputFocus?.();if(alive.current)setShowWeb(false)}return result}}
    },
   },controller.signal,prepareOnly)
   const first=latestState.rounds.find(r=>r.id===rounds[0]?.id);if(files.length&&first?.answers.every(a=>a.status==='completed'))setFileDrafts(old=>({...old,[effectiveTopic]:[]}))
  }catch(e){await cancelRequest({requestId}).catch(()=>{});throw e}finally{if(alive.current)setBusy(false);abort.current=null;ownedRequest.current=null;processing.current=false}
 }
 async function resumeCapture(round:WebAIRound,answer:WebAIAnswer){
  if(processing.current)return
  processing.current=true;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;ownedRequest.current=round.requestId
  let executionId:string|null=null
  try{
   const claim=await rpc('webAIResumeCapture',{roundId:round.id,providerId:answer.providerId});executionId=claim.executionId
   if(controller.signal.aborted||!alive.current){await cancelRequest({requestId:round.requestId});return}
   const update=async(patch:Partial<WebAIAnswer>)=>{const next=await persistWebAIState<WebAIState>(()=>rpc('webAIUpdate',{roundId:round.id,providerId:answer.providerId,executionId,...patch}),controller.signal);if(alive.current)acceptState(next)}
   try{const website=await openProvider(answer.providerId,round.topicId,state,false);await collectWebsiteAnswer(website,round.question,{...answer.capture},update,controller.signal)}
   catch(e){if(!controller.signal.aborted)await update({status:'uncertain',note:e instanceof Error?e.message:'采集未成功，请核对官网'})}
  }finally{if(alive.current)setBusy(false);abort.current=null;ownedRequest.current=null;processing.current=false}
 }
 function addFiles(picked:File[],clipboard=false){if(busy||!picked.length)return;try{const next=selectWebAIFiles(files,picked,clipboard);setFileDrafts(old=>({...old,[topicId]:next}));setError('')}catch(e){setError(e instanceof Error?e.message:'附件添加失败')}}
 function exportComparison(){const content=['# '+(topic?.title||'多 AI 对话'),...rows.slice().reverse().flatMap(r=>['\n## '+localQuestion(r),...r.answers.map(a=>'\n### '+webAIProvider(a.providerId).name+' · '+LABEL[a.status]+'\n'+(a.text||a.note)+(a.url?'\n\n来源：'+a.url:''))])].join('\n');WB.util.copy(content).then(()=>WB.toast('对比内容已复制，可保存为 Markdown','ok')).catch((e:Error)=>setError(e.message))}
 const hasActive=state.rounds.some(r=>r.topicId===topicId&&r.answers.some(a=>WEB_AI_ACTIVE.has(a.status)||a.status==='prepared'))
 return <div className="wb-web-ai"><style>{WEB_AI_CSS}</style>
  <PageHead icon="messages" title="多 AI 对话" hint="使用厂商官网账号；追问沿用各站会话，切换厂商不会重新提问。"/>
  <div className="wb-row wb-row--wrap wb-web-toolbar">
   <div className="wb-web-topic"><Btn aria-label="历史问答" disabled={busy} onClick={()=>setShowHistory(!showHistory)}>历史问答：<span>{topic?.title||'新问题'}</span></Btn></div>
   <Btn disabled={busy} onClick={newConversation}>新对话</Btn><Btn disabled={!rows.length} onClick={exportComparison}>复制对比报告</Btn>
   <label className="wb-tiny"><input type="checkbox" checked={state.chatgptEnabled} disabled={busy} onChange={e=>safe(async()=>{const enabled=e.target.checked;acceptState(await rpc('webAIConfigure',{chatgptEnabled:enabled}));if(!enabled)setSelected(old=>old.filter(id=>id!=='chatgpt'))})}/> 启用 ChatGPT（可选）</label>
  </div>
  {showHistory&&<HistoryManager state={state} selected={topicId} disabled={busy||caps?.historyProtocol!==1} onClose={()=>setShowHistory(false)} onSelect={id=>{chooseTopic(id);setPage(0);setShowWeb(false);setAnswerFilter('all');setShowHistory(false)}} onManage={async request=>{const next=await rpc('webAIManageTopic',request);acceptState(next);if(request.topicId===topicId&&['trash','purge'].includes(request.action)){newConversation();setEditing(null);setQuestionEdit(null)}}}/>}
  {showHistory&&caps&&caps.historyProtocol!==1&&<p className="wb-web-error" role="status">历史管理后端尚未加载，请在插件管理中重新启用智能工作台组件。</p>}
  {error&&<p role="alert" className="wb-web-error">{error}</p>}
  <Panel title="提问" icon="messages"><div className="wb-stack">
   <fieldset className="wb-web-providers"><legend>发送范围</legend>{providers.map(p=><label key={p.id}><input type="checkbox" checked={selected.includes(p.id)} disabled={busy} onChange={e=>setSelected(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/>{p.name}</label>)}</fieldset>
   <div onDragOver={e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault()}} onDrop={e=>{if(e.dataTransfer.files.length){e.preventDefault();addFiles(Array.from(e.dataTransfer.files))}}} onPaste={e=>{const picked=Array.from(e.clipboardData.files);if(picked.length){e.preventDefault();addFiles(picked,true)}}}><Textarea disabled={busy} aria-label="多 AI 对话问题" placeholder="输入问题，可粘贴图片或添加文件，发送给勾选厂商。" value={draft} onChange={(e:any)=>setDrafts(old=>({...old,[topicId]:e.target.value}))} rows={3}/>{!!files.length&&!draft.trim()&&<p className="wb-tiny wb-muted">未填写问题时，将提问：请分析所附附件，并说明关键内容。</p>}<WebAIAttachments files={files} disabled={busy} onAdd={addFiles} onRemove={id=>setFileDrafts(old=>({...old,[topicId]:files.filter(f=>f.id!==id)}))}/></div>
   <div className="wb-row wb-row--wrap" style={{gap:8}}><label className="wb-tiny"><input type="checkbox" checked={batch} disabled={busy} onChange={e=>setBatch(e.target.checked)}/> 批量问题（最多5个，用单独一行 --- 分隔）</label>
    <Btn kind="primary" disabled={busy||!draft.trim()&&!files.length||!selected.length} onClick={()=>safe(()=>start(false))}>{busy?<><Spinner size={12}/>处理中…</>:'发送到勾选厂商'}</Btn>
    <Btn disabled={busy||!draft.trim()&&!files.length||!selected.length} onClick={()=>safe(()=>start(true))}>{files.length?'上传附件并填入':'仅填入官网'}</Btn>
    {(busy||hasActive)&&<Btn onClick={()=>safe(async()=>{abort.current?.abort();acceptState(await cancelRequest({topicId}))})}>停止采集</Btn>}
   </div><p className="wb-tiny wb-muted">首次请在各官网完成登录。自动发送与采集取决于网页兼容性；无法识别时保留官网操作，不重复发送。未发送草稿会保留在输入框。{selected.includes('glm')?' 智谱提交时会短暂显示内嵌页面。':''}</p>
  </div></Panel>
  <div className="wb-row wb-row--wrap wb-web-tabs" role="group" aria-label="回答显示范围">
   <Btn kind={answerFilter==='all'?'primary':'ghost'} onClick={()=>setAnswerFilter('all')}>全部回答（{rows.length}轮）</Btn>
   {providers.map(p=><Btn key={p.id} kind={answerFilter===p.id?'primary':'ghost'} onClick={()=>setAnswerFilter(p.id)}>{p.name}</Btn>)}
   <Btn onClick={()=>{if(showWeb)setShowWeb(false);else safe(()=>openProvider(selected[0]||'kimi'))}}>{showWeb?'收起官网':'登录 / 查看原对话'}</Btn>
  </div>
  <section aria-label="登录与原对话" aria-hidden={!showWeb} {...(!showWeb?{inert:''}:{})} className={'wb-web-native-region'+(!showWeb?' is-background':'')}>
   <div className="wb-row wb-row--wrap wb-web-notice"><strong>{webAIProvider(active).name} 官网</strong><span className="wb-tiny wb-muted">登录和验证码在官网完成，关闭后继续在工作台看回答。</span>
    <Btn size="sm" onClick={()=>setShowWeb(false)}>收起官网</Btn>
    {providers.map(p=><Btn key={p.id} size="sm" kind={active===p.id?'primary':'ghost'} onClick={()=>safe(()=>openProvider(p.id))}>{p.name}</Btn>)}
   </div>
   <details className="wb-web-connection"><summary>登录保留与兼容性</summary><p className="wb-tiny wb-muted" role="status" aria-label="登录保留状态">{browserSessionMessage(browserSessionMode(nativeWebAIBridge()))}</p>
    <div className="wb-row wb-row--wrap" style={{gap:8}}><Btn size="sm" disabled={!opened[active]} onClick={()=>safe(async()=>{const result=await (await getController(active)).execute('inspect');setDiagnostics(result.diagnostics);setCompatibility(webAIProvider(active).name+'：'+(result.status==='needs_login'?'请先登录':result.status==='ready'?'输入框已识别':result.status==='generating'?'正在生成':'需官网操作')+(result.note?' · '+result.note:'')+'；'+(result.answerSupported?'回答容器已识别':'暂无可识别的回答'))})}>检查网页兼容</Btn>
    </div>
    {compatibility&&<p className="wb-tiny" role="status">{compatibility}</p>}
    {diagnostics&&<details><summary>兼容性诊断详情</summary><div className="wb-web-diagnostics"><p>输入框数量：{diagnostics.editorCount}</p><p>输入框：{JSON.stringify(diagnostics.editor)}</p><p>附件范围：{JSON.stringify(diagnostics.composer)}</p>{(diagnostics.filePreviews||[]).map((item:any,i:number)=><p key={"preview"+i}>附件预览 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.fileInputs||[]).map((item:any,i:number)=><p key={"file"+i}>上传输入 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.uploadControls||[]).map((item:any,i:number)=><p key={"upload"+i}>上传控件 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.uploadMenuItems||[]).map((item:any,i:number)=><p key={"uploadMenu"+i}>附件菜单 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.attachmentShapes||[]).map((item:any,i:number)=><p key={"attachmentShape"+i}>图片结构 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.parents||[]).map((item:any,i:number)=><p key={"parent"+i}>容器 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.controls||[]).map((item:any,i:number)=><p key={"control"+i}>控件 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.messages||[]).map((item:any,i:number)=><p key={"message"+i}>消息结构 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.userStructure||[]).map((item:any,i:number)=><p key={"user"+i}>提问结构 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.inputVariants||[]).map((item:any,i:number)=><p key={"input"+i}>编辑器候选 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.finalControls||[]).map((item:any,i:number)=><p key={"final"+i}>完成控件 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.turnSummary||[]).map((item:any,i:number)=><p key={"turn"+i}>轮次 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.answerWidgets||[]).map((item:any,i:number)=><p key={"widget"+i}>回答控件 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.contentFrames||[]).map((item:any,i:number)=><p key={"frame"+i}>正文结构 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.endAncestors||[]).map((item:any,i:number)=><p key={"end"+i}>结束容器 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.bodyParts||[]).map((item:any,i:number)=><p key={"part"+i}>正文片段 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.codeShapes||[]).map((item:any,i:number)=><p key={"code"+i}>代码结构 {i+1}：{JSON.stringify(item)}</p>)}</div></details>}
   </details>
   {Object.entries(opened).map(([id,tab])=><NativeWebsite key={id} providerId={id} scope={caps?.storageScope||'workbench-web-ai'} url={tab.url} visible={active===id} onNavigate={url=>saveNavigation(id,url)} onController={c=>{if(c)controllers.current.set(id,c);else controllers.current.delete(id)}}/>)}
   {opened[active]&&opened[active].topicId!==topicId&&<p className="wb-web-error">原页面有草稿或正在生成时会保留，请先在官网处理后再切换问答。</p>}
  </section>
  <section aria-label="回答对比">
   {!rows.length&&<div className="wb-web-empty"><strong>一个问题，对比多家回答</strong><p>输入问题并勾选厂商即可开始，无需创建主题。官网按需在工作台内展开。</p></div>}
   {rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(round=><details key={round.id} open className="wb-web-round"><summary>{localQuestion(round)}</summary><div className="wb-row wb-row--wrap" style={{gap:8,marginBottom:8}}><Btn size="sm" disabled={busy||caps?.historyProtocol!==1||round.answers.some(a=>WEB_AI_ACTIVE.has(a.status)||a.status==='prepared')} onClick={()=>setQuestionEdit(round)}>编辑本地问题</Btn>{round.displayQuestion&&<span className="wb-tiny wb-muted">已作本地编辑，官网原问题保留</span>}</div>{!!round.attachments?.length&&<p className="wb-tiny wb-muted">附件：{round.attachments.map(f=>f.name+'（'+Math.ceil(f.size/1024)+' KB）').join('、')}</p>}<div className="wb-comparison-grid">{round.answers.filter(a=>answerFilter==='all'||a.providerId===answerFilter).map(a=><article key={a.providerId} className="wb-web-answer"><div className="wb-row wb-row--wrap"><strong>{webAIProvider(a.providerId).name}</strong><span className="wb-tiny">{LABEL[a.status]}</span></div><pre>{a.text||a.note||'等待处理'}</pre>{a.text&&a.note&&<p className="wb-tiny wb-muted">{a.note}</p>}<div className="wb-row wb-row--wrap" style={{gap:6}}><Btn size="sm" onClick={()=>safe(()=>openProvider(a.providerId,round.topicId))}>登录 / 查看原对话</Btn>{a.capture&&<Btn size="sm" disabled={busy||WEB_AI_ACTIVE.has(a.status)} onClick={()=>safe(()=>resumeCapture(round,a))}>{a.status==='completed'?'重新采集本轮':'采集本轮回答'}</Btn>}<Btn size="sm" disabled={WEB_AI_ACTIVE.has(a.status)} onClick={()=>setEditing({round,answer:a,text:a.text,url:a.url||''})}>粘贴 / 编辑回答</Btn>{a.text&&<Btn size="sm" onClick={()=>safe(()=>WB.actions.createKnowledge({title:round.question.slice(0,160)+' · '+webAIProvider(a.providerId).name,body:a.text,url:a.url,kind:'note',reviewState:'candidate',sourceLabel:'多 AI 对话'}))}>存为候选知识</Btn>}</div></article>)}</div></details>)}
   <Pagination page={page} total={rows.length} onChange={setPage}/>
  </section>
  {questionEdit&&topic&&<QuestionEditor key={questionEdit.id} round={questionEdit} onClose={()=>setQuestionEdit(null)} onSave={async text=>{acceptState(await rpc('webAIEditQuestion',{topicId:topic.id,roundId:questionEdit.id,text,expectedVersion:topic.version||0}))}}/>}
  {editing&&<Panel title={'保存 '+webAIProvider(editing.answer.providerId).name+' 官网回答'} icon="edit"><div className="wb-stack"><Field label="回答正文"><Textarea aria-label="粘贴官网回答" rows={8} value={editing.text} onChange={(e:any)=>setEditing({...editing,text:e.target.value})}/></Field><Field label="官网会话链接（可选）"><Input aria-label="官网回答来源链接" value={editing.url} onChange={(e:any)=>setEditing({...editing,url:e.target.value})}/></Field><div className="wb-row" style={{gap:8}}><Btn kind="primary" disabled={!editing.text.trim()} onClick={()=>safe(async()=>{acceptState(await rpc('webAIRecord',{roundId:editing.round.id,providerId:editing.answer.providerId,text:editing.text,url:editing.url,expectedUpdatedAt:editing.answer.updatedAt}));setEditing(null)})}>保存官网回答</Btn><Btn onClick={()=>setEditing(null)}>取消编辑</Btn></div></div></Panel>}
 </div>
}
WB.pages['web-ai']=WebAIPage
