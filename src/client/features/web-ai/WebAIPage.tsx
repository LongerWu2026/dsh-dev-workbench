import {HistoryManager} from './HistoryManager.js'
import {QuestionEditor} from './QuestionEditor.js'
import {localQuestion} from './history.js'
import * as React from 'react'
import {WB,Btn,Field,Input,Textarea,Modal,PageHead,Spinner,useStore} from '../../core/runtime.js'
import {PAGE_SIZE} from '../../components/Pagination.js'
import {ConversationSidebar} from './ConversationSidebar.js'
import {ConversationThread} from './ConversationThread.js'
import {answerPresentation} from './answer-presentation.js'
import {WEB_AI_PROVIDERS,WEB_AI_ACTIVE,normalizeWebAI,webAIProvider,type WebAIState,type WebAIRound,type WebAIAnswer} from '../../../shared/web-ai.js'
import {NativeWebsite,nativeWebAIBridge,type WebsiteController} from './NativeWebsite.js'
import {collectWebsiteAnswer,runWebsiteQuestion} from './runner.js'
import {runWebsiteBatch,persistWebAIState} from './batch.js'
import {restoreWebAITopic,rememberWebAITopic} from './preferences.js'
import {WEB_AI_CSS} from './styles.js'
import {browserSessionMode,browserSessionMessage} from './browser-session.js'
import type {WebAIAuthentication} from '../../../shared/web-ai-auth.js'
import {authenticationSummary,AUTHENTICATION_LABEL} from './authentication.js'

import {WebAIAttachments,selectWebAIFiles,readWebAIFiles,type SelectedWebAIFile} from './attachments.js'

export function WebAIPage(){
 const surface=React.useRef<HTMLDivElement|null>(null)
 const store=useStore(),[state,setState]=React.useState<WebAIState>(()=>normalizeWebAI(store.data?.webAI)),[topicId,setTopicId]=React.useState(''),[active,setActive]=React.useState('kimi'),[selected,setSelected]=React.useState<string[]>(['kimi','glm']),[drafts,setDrafts]=React.useState<Record<string,string>>({}),[batch,setBatch]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[caps,setCaps]=React.useState<any>(null),[showWeb,setShowWeb]=React.useState(false),[answerFilter,setAnswerFilter]=React.useState('all'),[page,setPage]=React.useState(0)
 const [opened,setOpened]=React.useState<Record<string,{topicId:string;url:string}>>({}),[editing,setEditing]=React.useState<{round:WebAIRound;answer:WebAIAnswer;text:string;url:string}|null>(null)
 const [showHistory,setShowHistory]=React.useState(false),[questionEdit,setQuestionEdit]=React.useState<WebAIRound|null>(null)
 const [fileDrafts,setFileDrafts]=React.useState<Record<string,SelectedWebAIFile[]>>({})
 const [compatibility,setCompatibility]=React.useState('')
 const [diagnostics,setDiagnostics]=React.useState<any>(null)
 const [authentication,setAuthentication]=React.useState<Record<string,WebAIAuthentication>>({})
 const [checkingLogin,setCheckingLogin]=React.useState<Record<string,boolean>>({}),loginChecks=React.useRef(new Set<string>())
 const roundFiles=React.useRef(new Map<string,SelectedWebAIFile[]>()),[resend,setResend]=React.useState<{round:WebAIRound;answer:WebAIAnswer}|null>(null),[retryFiles,setRetryFiles]=React.useState<SelectedWebAIFile[]>([])
 const ownedRequest=React.useRef<string|null>(null),processing=React.useRef(false)
 const selection=React.useRef({touched:false,id:''})
 React.useEffect(()=>{
  const dismiss=(event:Event)=>{for(const menu of surface.current?.querySelectorAll<HTMLDetailsElement>('details[data-chat-menu][open]')||[])if(event.type==='keydown'?(event as KeyboardEvent).key==='Escape':!menu.contains(event.target as Node))menu.open=false}
  document.addEventListener('pointerdown',dismiss,true);document.addEventListener('keydown',dismiss,true)
  return()=>{document.removeEventListener('pointerdown',dismiss,true);document.removeEventListener('keydown',dismiss,true)}
 },[])
 React.useEffect(()=>{if(!showWeb)return;const previous=document.activeElement as HTMLElement;surface.current?.querySelector<HTMLButtonElement>('.wb-login-close')?.focus();const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setShowWeb(false)};document.addEventListener('keydown',escape);return()=>{document.removeEventListener('keydown',escape);previous?.focus?.()}},[showWeb])
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
 const topic=state.topics.find(t=>t.id===topicId&&!t.deletedAt),draft=drafts[topicId]||'',providers=WEB_AI_PROVIDERS.filter(p=>p.id!=='chatgpt'||state.chatgptEnabled),files=fileDrafts[topicId]||[],rows=state.rounds.filter(r=>r.topicId===topicId)
 function newConversation(){chooseTopic('');setPage(0);setShowWeb(false);setAnswerFilter('all')}
 async function getController(providerId:string){const until=Date.now()+16000;while(alive.current&&Date.now()<until){const c=controllers.current.get(providerId);if(c)return c;await new Promise(r=>setTimeout(r,100))}throw new Error('内嵌官网未就绪，请在网页检查加载或登录状态')}
 async function openProvider(providerId:string,id=topicId,workspace=state,reveal=true,question=''){
  for(const menu of surface.current?.querySelectorAll<HTMLDetailsElement>('details[data-chat-menu][open]')||[])menu.open=false
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
 async function checkProviderLogins(){
  if(busy||!nativeWebAIBridge())return
  const pending=providers.filter(p=>!loginChecks.current.has(p.id))
  if(!pending.length)return
  const next={...openRef.current}
  for(const p of pending){loginChecks.current.add(p.id);if(!next[p.id])next[p.id]={topicId:'',url:p.url}}
  openRef.current=next;setOpened(next)
  setCheckingLogin(old=>({...old,...Object.fromEntries(pending.map(p=>[p.id,true]))}))
  await Promise.allSettled(pending.map(async p=>{
   try{const controller=await getController(p.id);let result=authenticationSummary(null);const until=Date.now()+8000;do{result=authenticationSummary(await controller.authentication?.());if(result.status!=='unknown'||!alive.current)break;await new Promise(resolve=>setTimeout(resolve,1000))}while(Date.now()<until)}
   catch{if(alive.current)setAuthentication(old=>({...old,[p.id]:authenticationSummary(null)}))}
   finally{loginChecks.current.delete(p.id);if(alive.current)setCheckingLogin(old=>({...old,[p.id]:false}))}
  }))
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
   const rounds=next.rounds.filter(r=>r.requestId===requestId);if(files.length&&rounds[0])roundFiles.current.set(rounds[0].id,files);let latestState=next,acknowledged=false
   await runWebsiteBatch(rounds,selected,{
    attachments:payloads,
    claim:(round,providerId)=>rpc('webAIClaim',{roundId:round.id,providerId}),
    update:async(round,providerId,executionId,patch)=>{const saved=await persistWebAIState<WebAIState>(()=>rpc('webAIUpdate',{roundId:round.id,providerId,executionId,...patch}),controller.signal);if(Number(saved.revision||0)>=Number(latestState.revision||0))latestState=saved;if(alive.current){acceptState(saved);if(!prepareOnly&&!acknowledged&&patch.status==='generating'){acknowledged=true;setDrafts(old=>old[effectiveTopic]===draft?{...old,[effectiveTopic]:''}:old)}}},
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
 async function sendUnsent(round:WebAIRound,answer:WebAIAnswer,picked?:SelectedWebAIFile[]){
  if(busy||processing.current)return
  if(authentication[answer.providerId]?.status!=='authenticated'){await openProvider(answer.providerId,round.topicId);return}
  const source=picked||roundFiles.current.get(round.id)||[]
  if(round.attachments?.length&&(!source.length||round.attachments.some((f,i)=>f.name!==source[i]?.name||f.size!==source[i]?.size||f.type!==source[i]?.type)||source.length!==round.attachments.length)){
   if(picked)throw new Error('附件名称、大小或格式与本轮记录不一致，请选择原文件')
   setRetryFiles([]);setResend({round,answer});return
  }
  const original=(round.attachments||[]).map((metadata,i)=>({...metadata,file:source[i].file}))
  const payloads=await readWebAIFiles(original)
  processing.current=true;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;ownedRequest.current=round.requestId
  try{
   const claim=await rpc('webAIClaim',{roundId:round.id,providerId:answer.providerId,retryUnsent:true,expectedUpdatedAt:answer.updatedAt,attachments:round.attachments||[]})
   if(!claim.executionId)throw new Error('该厂商当前不能发送，请核对官网')
   setResend(null);roundFiles.current.set(round.id,original)
   const update=async(patch:Partial<WebAIAnswer>)=>{acceptState(await persistWebAIState<WebAIState>(()=>rpc('webAIUpdate',{roundId:round.id,providerId:answer.providerId,executionId:claim.executionId,...patch}),controller.signal))}
   try{const foreground=answer.providerId==='glm'||payloads.length>0,website=await openProvider(answer.providerId,round.topicId,state,foreground,round.question);let waiting=false,baseline:any=null
    const execution=foreground?{...website,execute:async(action:any,question?:string,request?:string)=>{const result=await website.execute(action,question,request);if(action==='observe'&&!waiting)baseline=result;if(action==='submit'&&result.status==='generating')waiting=true;if(action==='observe'&&waiting&&(result.busy||result.answerCount>(baseline?.answerCount||0)||result.userCount>(baseline?.userCount||0)||baseline?.url&&result.url!==baseline.url)){waiting=false;website.releaseInputFocus?.();if(alive.current)setShowWeb(false)}return result}}:website
    await runWebsiteQuestion(execution,round.question,round.id+':'+answer.providerId,update,controller.signal,false,undefined,undefined,payloads)}
   catch(e){if(!controller.signal.aborted)await update({status:'uncertain',note:e instanceof Error?e.message:'请核对官网'})}
  }finally{setBusy(false);processing.current=false;abort.current=null;ownedRequest.current=null}
 }
 function addFiles(picked:File[],clipboard=false){if(busy||!picked.length)return;try{const next=selectWebAIFiles(files,picked,clipboard);setFileDrafts(old=>({...old,[topicId]:next}));setError('')}catch(e){setError(e instanceof Error?e.message:'附件添加失败')}}
 function exportComparison(){const content=['# '+(topic?.title||'多 AI 对话'),...rows.flatMap(r=>['\n## '+localQuestion(r),...r.answers.map(a=>'\n### '+webAIProvider(a.providerId).name+' · '+answerPresentation(a).label+'\n'+(a.text||answerPresentation(a).note)+(a.url?'\n\n来源：'+a.url:''))])].join('\n');WB.util.copy(content).then(()=>WB.toast('对比内容已复制，可保存为 Markdown','ok')).catch((e:Error)=>setError(e.message))}
 const hasActive=state.rounds.some(r=>r.topicId===topicId&&r.answers.some(a=>WEB_AI_ACTIVE.has(a.status)||a.status==='prepared'))
 return <div ref={surface} className="wb-web-ai"><style>{WEB_AI_CSS}</style>

  <div className="wb-chat-layout" {...(showWeb?{inert:''}:{})}>
   <ConversationSidebar state={state} selected={topicId} disabled={busy} onNew={newConversation} onSelect={id=>{chooseTopic(id);setPage(0);setShowWeb(false);setAnswerFilter('all');setShowHistory(false)}} onManage={()=>setShowHistory(true)}/>
   <main className="wb-chat-main" aria-label="聚合聊天">
    <header className="wb-chat-head"><h2 title={topic?.title||'新对话'}>{topic?.title||'新对话'}</h2><Btn size="sm" onClick={()=>safe(()=>openProvider(active||selected[0]||'kimi'))}>登录 / 官网</Btn></header>
    {showHistory&&<div className="wb-chat-history-overlay">  {showHistory&&<HistoryManager state={state} selected={topicId} disabled={busy||caps?.historyProtocol!==1} onClose={()=>setShowHistory(false)} onSelect={id=>{chooseTopic(id);setPage(0);setShowWeb(false);setAnswerFilter('all');setShowHistory(false)}} onManage={async request=>{const next=await rpc('webAIManageTopic',request);acceptState(next);if(request.topicId===topicId&&['trash','purge'].includes(request.action)){newConversation();setEditing(null);setQuestionEdit(null)}}}/>}
  {showHistory&&caps&&caps.historyProtocol!==1&&<p className="wb-web-error" role="status">历史管理后端尚未加载，请在插件管理中重新启用智能工作台组件。</p>}
</div>}
    {error&&<p role="alert" className="wb-web-error wb-chat-alert">{error}</p>}
    <div className="wb-chat-thread-shell">
     <div className="wb-chat-thread-pane"><ConversationThread topicId={topicId} visible={true} rounds={rows.slice(Math.max(0,rows.length-(page+1)*PAGE_SIZE))} total={rows.length} filter={answerFilter} authentication={authentication} busy={busy} canEdit={caps?.historyProtocol===1} onUnsent={(round,answer)=>safe(()=>sendUnsent(round,answer))} onEarlier={()=>setPage(value=>value+1)} onOpen={(round,answer)=>safe(()=>openProvider(answer.providerId,round.topicId))} onCapture={(round,answer)=>safe(()=>resumeCapture(round,answer))} onEditQuestion={round=>setQuestionEdit(round)} onEditAnswer={(round,answer)=>setEditing({round,answer,text:answer.text,url:answer.url||''})} onKnowledge={(round,answer)=>safe(()=>WB.actions.createKnowledge({title:round.question.slice(0,160)+' · '+webAIProvider(answer.providerId).name,body:answer.text,url:answer.url,kind:'note',reviewState:'candidate',sourceLabel:'多 AI 对话'}))}/></div>

    </div>
  <section className="wb-chat-composer" aria-label="聊天输入">
   <div onDragOver={e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault()}} onDrop={e=>{if(e.dataTransfer.files.length){e.preventDefault();addFiles(Array.from(e.dataTransfer.files))}}} onPaste={e=>{const picked=Array.from(e.clipboardData.files);if(picked.length){e.preventDefault();addFiles(picked,true)}}}>
    <Textarea disabled={busy} aria-label="多 AI 对话问题" placeholder="发消息…" value={draft} onChange={(e:any)=>setDrafts(old=>({...old,[topicId]:e.target.value}))} rows={2} onKeyDown={(event:any)=>{if(event.key==='Enter'&&!event.nativeEvent?.isComposing&&event.keyCode!==229&&!event.shiftKey&&!busy&&(draft.trim()||files.length)&&selected.length){event.preventDefault();safe(()=>start(false))}}}/>
    <div className="wb-chat-input-bar"><WebAIAttachments compact files={files} disabled={busy} onAdd={addFiles} onRemove={id=>setFileDrafts(old=>({...old,[topicId]:files.filter(f=>f.id!==id)}))}/>
     <details data-chat-menu className="wb-chat-provider-picker" onToggle={event=>{if(event.currentTarget.open)void checkProviderLogins()}}><summary>{selected.map(id=>webAIProvider(id).name).join('、')||'选择厂商'}⌄</summary><div className="wb-chat-provider-menu" role="group" aria-label="本次发送厂商">{providers.map(p=><div key={p.id} className="wb-row"><label><input type="checkbox" checked={selected.includes(p.id)} disabled={busy} onChange={e=>setSelected(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/>{p.name}</label><span className={'wb-chat-login-state is-'+(authentication[p.id]?.status||'unknown')} role="status" aria-label={p.name+' 登录检查'}>{checkingLogin[p.id]?'检查中…':authentication[p.id]?.status==='authenticated'?'已登录':authentication[p.id]?.status==='needs_login'?'需要登录':authentication[p.id]?.status==='verification'?'需要验证':'未确认'}</span><Btn size="sm" aria-label={p.name+' '+(authentication[p.id]?.status==='needs_login'?'去登录':'查看官网')} onClick={()=>safe(()=>openProvider(p.id))}>{authentication[p.id]?.status==='needs_login'?'去登录':'官网'}</Btn></div>)}<label className="wb-tiny"><input type="checkbox" checked={state.chatgptEnabled} disabled={busy} onChange={event=>safe(async()=>{const enabled=event.target.checked;acceptState(await rpc('webAIConfigure',{chatgptEnabled:enabled}));if(!enabled)setSelected(old=>old.filter(id=>id!=='chatgpt'))})}/>启用 ChatGPT</label></div></details>
     {busy||hasActive?<Btn aria-label="停止采集" onClick={()=>safe(async()=>{abort.current?.abort();acceptState(await cancelRequest({topicId}))})}>■</Btn>:<Btn kind="primary" aria-label="发送消息" disabled={!draft.trim()&&!files.length||!selected.length} onClick={()=>safe(()=>start(false))}>↑</Btn>}
    </div>
   </div>
  </section>
   </main>
  </div>
  {showWeb&&<div className="wb-login-backdrop" onClick={()=>setShowWeb(false)} aria-hidden="true"/>}
  <section role="dialog" aria-modal={showWeb?true:undefined} aria-label="登录与原对话" aria-hidden={!showWeb} {...(!showWeb?{inert:''}:{})} className={'wb-web-native-region wb-chat-web-pane wb-login-dialog'+(!showWeb?' is-background':'')}>
   <div className="wb-row wb-row--wrap wb-web-notice wb-web-tabs"><strong>{webAIProvider(active).name} 官网</strong><span className="wb-tiny wb-muted">登录和验证码在官网完成，关闭后继续在工作台看回答。</span>
    <Btn className="wb-login-close" size="sm" onClick={()=>setShowWeb(false)}>返回聊天</Btn>
    {providers.map(p=><Btn key={p.id} size="sm" kind={active===p.id?'primary':'ghost'} onClick={()=>safe(()=>openProvider(p.id))}>{p.name}</Btn>)}
   </div>
   <div className="wb-web-auth wb-row wb-row--wrap"><span role="status" aria-label={webAIProvider(active).name+' 登录状态'}><strong>{AUTHENTICATION_LABEL[(authentication[active]||authenticationSummary(null)).status]}</strong> · {(authentication[active]||authenticationSummary(null)).note}</span><Btn size="sm" disabled={!opened[active]} onClick={()=>safe(async()=>{const result=await (await getController(active)).authentication?.();setAuthentication(old=>({...old,[active]:authenticationSummary(result)}))})}>重新检查登录</Btn></div>
   <details className="wb-web-connection"><summary>登录保留与兼容性</summary><p className="wb-tiny wb-muted" role="status" aria-label="登录保留状态">{browserSessionMessage(browserSessionMode(nativeWebAIBridge()))}</p>
    {!!authentication[active]?.evidence.length&&<p className="wb-tiny" aria-label="登录检查依据">{authentication[active].evidence.join('；')}</p>}
    <div className="wb-row wb-row--wrap" style={{gap:8}}><Btn size="sm" disabled={!opened[active]} onClick={()=>safe(async()=>{const result=await (await getController(active)).execute('inspect');setDiagnostics(result.diagnostics);setCompatibility(webAIProvider(active).name+'：'+(result.status==='needs_login'?'请先登录':result.status==='ready'?'输入框已识别':result.status==='generating'?'正在生成':'需官网操作')+(result.note?' · '+result.note:'')+'；'+(result.answerSupported?'回答容器已识别':'暂无可识别的回答'))})}>检查网页兼容</Btn>
    </div>
    {compatibility&&<p className="wb-tiny" role="status">{compatibility}</p>}
    {diagnostics&&<details><summary>兼容性诊断详情</summary><div className="wb-web-diagnostics"><p>输入框数量：{diagnostics.editorCount}</p><p>输入框：{JSON.stringify(diagnostics.editor)}</p><p>附件范围：{JSON.stringify(diagnostics.composer)}</p>{(diagnostics.filePreviews||[]).map((item:any,i:number)=><p key={"preview"+i}>附件预览 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.fileInputs||[]).map((item:any,i:number)=><p key={"file"+i}>上传输入 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.uploadControls||[]).map((item:any,i:number)=><p key={"upload"+i}>上传控件 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.uploadMenuItems||[]).map((item:any,i:number)=><p key={"uploadMenu"+i}>附件菜单 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.attachmentShapes||[]).map((item:any,i:number)=><p key={"attachmentShape"+i}>图片结构 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.parents||[]).map((item:any,i:number)=><p key={"parent"+i}>容器 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.controls||[]).map((item:any,i:number)=><p key={"control"+i}>控件 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.messages||[]).map((item:any,i:number)=><p key={"message"+i}>消息结构 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.userStructure||[]).map((item:any,i:number)=><p key={"user"+i}>提问结构 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.inputVariants||[]).map((item:any,i:number)=><p key={"input"+i}>编辑器候选 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.finalControls||[]).map((item:any,i:number)=><p key={"final"+i}>完成控件 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.turnSummary||[]).map((item:any,i:number)=><p key={"turn"+i}>轮次 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.answerWidgets||[]).map((item:any,i:number)=><p key={"widget"+i}>回答控件 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.contentFrames||[]).map((item:any,i:number)=><p key={"frame"+i}>正文结构 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.endAncestors||[]).map((item:any,i:number)=><p key={"end"+i}>结束容器 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.bodyParts||[]).map((item:any,i:number)=><p key={"part"+i}>正文片段 {i+1}：{JSON.stringify(item)}</p>)}{(diagnostics.codeShapes||[]).map((item:any,i:number)=><p key={"code"+i}>代码结构 {i+1}：{JSON.stringify(item)}</p>)}</div></details>}
   </details>
   {Object.entries(opened).map(([id,tab])=><NativeWebsite key={id} providerId={id} scope={caps?.storageScope||'workbench-web-ai'} url={tab.url} visible={showWeb&&active===id} onNavigate={url=>saveNavigation(id,url)} onAuthentication={result=>setAuthentication(old=>({...old,[id]:result}))} onController={c=>{if(c)controllers.current.set(id,c);else controllers.current.delete(id)}}/>)}
   {opened[active]&&opened[active].topicId!==topicId&&<p className="wb-web-error">原页面有草稿或正在生成时会保留，请先在官网处理后再切换问答。</p>}
  </section>
  {resend&&<Modal open title="重新选择本轮附件" onClose={()=>setResend(null)}><p>本轮需要：{resend.round.attachments?.map(f=>f.name).join('、')}。请选择原文件后，仅发送给{webAIProvider(resend.answer.providerId).name}。</p><WebAIAttachments files={retryFiles} disabled={busy} onAdd={picked=>{try{setRetryFiles(selectWebAIFiles(retryFiles,picked))}catch(e){setError(String(e))}}} onRemove={id=>setRetryFiles(old=>old.filter(f=>f.id!==id))}/><Btn disabled={busy||!retryFiles.length} onClick={()=>safe(()=>sendUnsent(resend.round,resend.answer,retryFiles))}>发送本厂商</Btn></Modal>}
  {questionEdit&&topic&&<QuestionEditor key={questionEdit.id} round={questionEdit} onClose={()=>setQuestionEdit(null)} onSave={async text=>{acceptState(await rpc('webAIEditQuestion',{topicId:topic.id,roundId:questionEdit.id,text,expectedVersion:topic.version||0}))}}/>}
  {editing&&<Modal open title={'保存 '+webAIProvider(editing.answer.providerId).name+' 官网回答'} width={680} onClose={()=>setEditing(null)}><div className="wb-stack"><Field label="回答正文"><Textarea aria-label="粘贴官网回答" rows={8} value={editing.text} onChange={(e:any)=>setEditing({...editing,text:e.target.value})}/></Field><Field label="官网会话链接（可选）"><Input aria-label="官网回答来源链接" value={editing.url} onChange={(e:any)=>setEditing({...editing,url:e.target.value})}/></Field><div className="wb-row" style={{gap:8}}><Btn kind="primary" disabled={!editing.text.trim()} onClick={()=>safe(async()=>{acceptState(await rpc('webAIRecord',{roundId:editing.round.id,providerId:editing.answer.providerId,text:editing.text,url:editing.url,expectedUpdatedAt:editing.answer.updatedAt}));setEditing(null)})}>保存官网回答</Btn><Btn onClick={()=>setEditing(null)}>取消编辑</Btn></div></div></Modal>}
 </div>
}
WB.pages['web-ai']=WebAIPage
