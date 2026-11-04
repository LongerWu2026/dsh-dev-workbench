import {knowledgeScopeKey} from '../knowledge/scope.js'
import {existsSync,mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {workbenchDir} from '../platform/runtime.js'
import {describeAssistantTool} from './command-display.js'
import {stripAssistantBoilerplate,isSystemInjectedText} from './transcript.js'
import {hubSessionKnowledgeScope} from './hub-store.js'
import {nativeAssistantAttachments,type AssistantAttachment} from '../../shared/assistant-attachments.js'
import {assistantOutputText,finalAssistantOutput} from './final-output.js'
import {isPlainAssistantChat} from './conversation-policy.js'
import type {KnowledgeMode} from '../../shared/knowledge.js'

export type HubTurnStatus='recognizing'|'executing'|'completed'|'needs_confirmation'|'failed'|'interrupted'
export interface HubCommand {id:string;label:string;operation:string;kind?:'business'|'tool';parameters?:any;status:string;resultText?:string;jobIds?:string[];blocked?:boolean;failurePhase?:'execution'}
export interface HubTurn {
 id:string;conversationId:string;text:string;at:string;source:'rule'|'ai'|'system';mode:'execute'|'reinterpret';status:HubTurnStatus
 sessionId?:string;requestId?:string;fromSeq?:number;toSeq?:number;reply?:string;replySource?:'assistant'|'tools';commands:HubCommand[];refs?:any[];knowledgeMode?:KnowledgeMode;knowledgeRetrievalId?:string
 knowledgeScope?:{projectId?:string|null;accountId?:string|null;spaceId?:string|null};reinterpretsTurnId?:string;jobIds?:string[];operationSignature?:string
 /** Native user boundary, never inferred from prompt text or model-provided IDs. */
 userSeq?:number;nativeTurn?:number;legacy?:boolean;trigger?:'manual'|'operation'|'system'
 attachments?:AssistantAttachment[];attachmentSignature?:string;attachmentOnly?:boolean;attachmentAccepted?:boolean;attachmentRetryable?:boolean
 recognition?:{outcome:'matched'|'unmatched'|'ambiguous'|'error'|'attachment';reason?:string};clarificationOnly?:boolean
 blocked?:boolean;failurePhase?:'recognition'|'execution'|'model'
 stopRequestedAt?:string
}
export interface HubTurnQuery {sessionId?:string;knowledgeScope?:HubTurn['knowledgeScope']}
export interface HubReconcileOptions extends HubTurnQuery {running?:boolean;settled?:boolean}
interface TurnStore {version:1;turns:HubTurn[]}
const path=()=>join(workbenchDir(),'assistant-turns.json')
const guards=new WeakSet<object>()
export function setHubReinterpretGuardAvailable(ctx:object,available:boolean){if(available)guards.add(ctx);else guards.delete(ctx)}
export function hubReinterpretSupported(ctx:object):boolean{return !!ctx&&guards.has(ctx)}
function read():TurnStore {
 if(!existsSync(path()))return {version:1,turns:[]}
 const store=JSON.parse(readFileSync(path(),'utf8'))
 if(store.version!==1||!Array.isArray(store.turns))throw Error('助手轮次记录无法读取，原文件已保留')
 return store
}
function write(store:TurnStore){mkdirSync(workbenchDir(),{recursive:true});const temp=path()+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(store),{mode:0o600});renameSync(temp,path())}
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
const scopeKey=(scope:HubTurn['knowledgeScope'])=>knowledgeScopeKey(scope)
function matches(row:HubTurn,conversationId:string,query:HubTurnQuery={}){
 return row.conversationId===conversationId&&(!query.sessionId||!row.sessionId||row.sessionId===query.sessionId)&&
  (!(conversationId==='system:knowledge'||Object.hasOwn(query,'knowledgeScope'))||scopeKey(row.knowledgeScope)===scopeKey(query.knowledgeScope))
}
export function hubTurns(conversationId:string,query:HubTurnQuery={}):HubTurn[]{return read().turns.filter(row=>matches(row,conversationId,query))}
export function hubTurnSnapshot(){return read().turns}
export function hubTurnsFromSnapshot(turns:HubTurn[],conversationId:string,query:HubTurnQuery={}){return turns.filter(row=>matches(row,conversationId,query))}
export function getHubTurn(id:string):HubTurn|undefined{return read().turns.find(row=>row.id===id)}
const identity=(row:Partial<HubTurn>)=>JSON.stringify({conversationId:row.conversationId,text:row.text,mode:row.mode||'execute',refs:row.refs||[],knowledgeScope:scopeKey(row.knowledgeScope),knowledgeMode:row.knowledgeMode||'auto',reinterpretsTurnId:row.reinterpretsTurnId||null,operationSignature:row.operationSignature||null,attachmentSignature:row.attachmentSignature||null})
/** Persist before controller.prompt. A retried request cannot silently change its payload. */
export function beginHubTurn(input:Omit<HubTurn,'id'|'at'|'status'|'commands'> & Partial<Pick<HubTurn,'id'|'at'|'status'|'commands'>>):HubTurn {
 if(!input.conversationId||!input.text?.trim())throw Error('助手轮次需要会话与消息内容')
 const store=read(),existing=input.requestId&&store.turns.find(row=>row.conversationId===input.conversationId&&row.requestId===input.requestId)
 if(existing){if(identity(existing)!==identity(input))throw Error('相同请求编号不能用于不同消息或上下文');return existing}
 const row:HubTurn=clone({...input,id:input.id||'assistant-turn-'+randomUUID(),at:input.at||new Date().toISOString(),status:input.status||'recognizing',commands:input.commands||[]})
 if(store.turns.some(turn=>turn.id===row.id))throw Error('助手轮次编号已存在')
 store.turns.push(row);write(store);return clone(row)
}
export function updateHubTurn(id:string,patch:Partial<HubTurn>):HubTurn {
 const store=read(),row=store.turns.find(turn=>turn.id===id)
 if(!row)throw Error('助手轮次不存在')
 for(const key of ['id','conversationId','requestId','sessionId'] as const)if(patch[key]!==undefined&&row[key]!==undefined&&patch[key]!==row[key])throw Error('不能改变助手轮次归属')
 Object.assign(row,clone(patch));write(store);return clone(row)
}
function rpcId(event:any):string|undefined {const source=event?.data?.source;return event?.type==='user/message'&&source?.kind==='user'&&typeof source.rpcId==='string'?source.rpcId:undefined}
function eventsOf(session:any):any[]{return typeof session?.snapshotEvents==='function'?session.snapshotEvents().slice().sort((a:any,b:any)=>Number(a.seq)-Number(b.seq)):[]}
function isHuman(event:any):boolean {
 if(event?.type!=='user/message')return false
 const source=event.data?.source
 if(source)return source.kind==='user'
 const text=stripAssistantBoilerplate(textBlocks(event.data));return (!!text&&!isSystemInjectedText(text))||nativeAssistantAttachments(event.data?.content).length>0
}
function requestRange(events:any[],row:HubTurn){
 const index=events.findIndex(event=>row.legacy?event.type==='user/message'&&Number(event.seq)===row.userSeq:!!row.requestId&&rpcId(event)===row.requestId&&Number(event.seq)>(row.fromSeq??0))
 if(index<0)return null
 let start:any;for(let i=index-1;i>=0;i--)if(events[i].type==='turn/start'){start=events[i];break}
 const selected:any[]=[];let end:any,superseded=false
 for(let i=index;i<events.length;i++){
  const event=events[i]
  if(i>index&&(event.type==='turn/start'||isHuman(event)&&(!rpcId(event)||rpcId(event)!==row.requestId))){superseded=true;break}
  selected.push(event)
  if(event.type==='turn/end'&&(start?.data?.turn==null||event.data?.turn==null||event.data.turn===start.data.turn)){end=event;break}
 }
 return {events:selected,user:events[index],start,end,superseded}
}
/** Only actual currently entered user requests may control tool execution. */
export function activeHubTurns(session:any,query:HubTurnQuery & {conversationId?:string}={}):HubTurn[]{
 if(query.sessionId&&query.sessionId!==session?.id)return []
 const events=eventsOf(session);let start=-1
 for(let i=events.length-1;i>=0;i--)if(events[i].type==='turn/start'){start=i;break}
 if(start<0||events.slice(start+1).some(event=>event.type==='turn/end'&&(event.data?.turn==null||events[start].data?.turn==null||event.data.turn===events[start].data.turn)))return []
 const requests=new Set(events.slice(start+1).map(rpcId).filter(Boolean))
 return read().turns.filter(row=>row.sessionId===session.id&&row.requestId&&requests.has(row.requestId)&&
  (!query.conversationId||row.conversationId===query.conversationId)&&
  (!Object.hasOwn(query,'knowledgeScope')||scopeKey(row.knowledgeScope)===scopeKey(query.knowledgeScope)))
}
export function identifyActiveHubTurn(session:any,query:HubTurnQuery & {conversationId?:string}={}):HubTurn|undefined {
 const rows=activeHubTurns(session,query);return rows.find(row=>row.mode==='reinterpret'||row.clarificationOnly)||rows.find(row=>row.attachmentOnly)||rows.at(-1)
}
function excerpt(text:string,limit=24000){return text.length<=limit?text:text.slice(0,limit)+'\n（内容较长，以上为节选）'}
function textBlocks(message:any):string {return (Array.isArray(message?.content)?message.content:[]).filter((block:any)=>block?.type==='text'&&typeof block.text==='string').map((block:any)=>block.text).join('\n').trim()}
function errorText(value:any,depth=0):string {
 if(depth>6)return ''
 if(typeof value==='string'){try{return errorText(JSON.parse(value),depth+1)||value}catch{return value}}
 if(!value||typeof value!=='object')return ''
 return errorText(value.error,depth+1)||errorText(value.cause,depth+1)||errorText(value.message,depth+1)||errorText(value.reason,depth+1)
}
function safeValue(value:any):any {
 if(Array.isArray(value))return value.filter(item=>!['reasoning','thinking','redacted_thinking'].includes(item?.type)).map(safeValue)
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/^reasoning(?:_content)?$|^thinking$|^replayState$|^providerMetadata$/i.test(key)).map(([key,item])=>[key,safeValue(item)]))
 return value
}
function decodedResult(text:string):any {try{return safeValue(JSON.parse(text))}catch{return null}}
function jobIds(value:any):string[]{if(!value||typeof value!=='object')return [];return [...new Set([value.jobId,value.job?.id,value.job?.jobId,...(Array.isArray(value.jobs)?value.jobs.map((job:any)=>job?.id):[])].filter((id):id is string=>typeof id==='string'&&id.length>0))]}
const jobOperations=new Set(['analysis.continue','analysis.retry','analysis.fetch','radar.fetch','radar.summary','office.start','office.retry','workbench_analyze_messages','workbench_summarize_radar','workbench_fetch_radar'])
const statusLabel:Record<string,string>={queued:'已排队',running:'进行中',completed:'已完成',failed:'失败',cancelled:'已取消',ready:'待处理',pending:'待处理',deferred:'等待重试',awaiting_human:'待人工确认'}
function resultSummary(value:any,depth=0):string {
 if(value==null||depth>3)return ''
 if(typeof value==='string'){const nested=decodedResult(value);return nested!==null?resultSummary(nested,depth+1):value}
 if(Array.isArray(value))return '返回 '+value.length+' 条记录。'+(value.length?'\n'+value.slice(0,8).map(row=>[row?.title||row?.snippet||row?.label||row?.id,row?.stage||statusLabel[row?.status]||row?.status].filter(Boolean).join(' · ')).filter(Boolean).join('\n'):'')
 if(typeof value!=='object')return String(value)
 if(typeof value.note==='string'&&value.note.trim())return value.note
 if(typeof value.text==='string'&&value.text.trim()){const text=resultSummary(value.text,depth+1);if(text)return text}
 if(typeof value.draft==='string'&&value.draft.trim())return value.draft
 if(value.error)return errorText(value.error)||'操作失败'
 for(const key of ['items','tasks','replies','jobs','results'])if(Array.isArray(value[key]))return resultSummary(value[key],depth+1)
 if(value.progress){const progress=value.progress;return ['已处理 '+(Number(progress.processed)||0)+' 条','剩余 '+(Number(progress.remaining)||0)+' 条',progress.failed?'失败 '+progress.failed+' 条':'',progress.pauseReason].filter(Boolean).join('，')}
 if(value.job)return '后台作业'+(statusLabel[value.job.status]||'已返回回执')+'。'+(value.job.error?String(value.job.error):'')
 if(value.task||value.reply||value.item){const item=value.task||value.reply||value.item;return [item.title||item.snippet||item.id,item.stage||statusLabel[item.status]||item.status].filter(Boolean).join(' · ')||'已返回事项信息。'}
 if(typeof value.count==='number')return '返回 '+value.count+' 条记录。'
 if(typeof value.processed==='number')return ['已处理 '+value.processed+' 条',typeof value.failures==='number'?'失败 '+value.failures+' 条':''].filter(Boolean).join('，')
 return '工具已返回结构化结果。'
}
function resultOf(event:any,command:HubCommand){
 const message=event.data?.message||{},raw=textBlocks(message),parsed=decodedResult(raw)
 const failed=message.isError===true||!!event.data?.error||parsed?.status==='error'||parsed?.status==='failed'
 const confirmation=parsed?.status==='confirmation_required'||parsed?.status==='needs_confirmation'||parsed?.confirmation?.state==='pending'
 const readable=parsed!==null?resultSummary(parsed):raw
 return {status:failed?'failed':confirmation?'needs_confirmation':'completed',text:excerpt(errorText(event.data?.error)||readable||'工具已返回，但未提供可展示内容'),jobIds:jobOperations.has(command.operation)?jobIds(parsed):[],hasContent:!!readable,blocked:failed&&parsed?.blocked===true,failurePhase:failed?'execution' as const:undefined}
}
function toolOperation(name:string,args:any):string {
 if(name==='workbench_assistant_action'&&typeof args.operation==='string')return args.operation
 if(name==='workbench_office_workflow'&&['start','status','retry','cancel'].includes(args.action))return 'office.'+args.action
 return name
}
function project(row:HubTurn,session:any,events:any[],options:HubReconcileOptions):HubTurn {
 const range=requestRange(events,row)
 if(!range){
  // Empty cold logs or a prompt still being admitted are not evidence of failure.
  if(options.settled===true&&['recognizing','executing'].includes(row.status))return {...row,status:'interrupted',reply:row.reply||'本轮提交未找到对应的原生消息记录，尚未确认执行完成。'}
  return row
 }
 const commands:HubCommand[]=[],byCall=new Map<string,HubCommand>(),texts:string[]=[],errors:string[]=[]
 for(const event of range.events){
  if(event.type==='tool/call'){
   const data=event.data||{},callId=String(data.callId||'');if(!callId||byCall.has(callId))continue
   let args:any={};try{args=JSON.parse(data.arguments)}catch{}
   const name=String(data.name||'tool'),display=isPlainAssistantChat(row.conversationId)?null:describeAssistantTool(name,args)
   const command:HubCommand={id:callId,label:display?.label||name,operation:toolOperation(name,args),kind:display?'business':'tool',parameters:display?.parameters||{},status:'executing'}
   commands.push(command);byCall.set(callId,command)
  }else if(event.type==='tool/result'){
   const command=byCall.get(String(event.data?.message?.toolCallId||''));if(!command)continue
   const result=resultOf(event,command);command.status=result.status;command.resultText=result.text;if(result.jobIds.length)command.jobIds=result.jobIds;if(result.blocked)command.blocked=true;if(result.failurePhase)command.failurePhase=result.failurePhase
  }else if(event.type==='assistant/message'){
   const text=assistantOutputText(event.data?.message);if(text)texts.push(text)
  }else if(event.type==='turn/error'){const text=errorText(event.data);if(text)errors.push(text)}
 }
 const reason=range.end?.data?.reason,ended=!!range.end||range.superseded||options.running===false||options.settled===true
 if(reason?.kind==='error')errors.push(errorText(reason.error)||'模型轮次失败')
 const final=ended?finalAssistantOutput(range.events):null
 let status:HubTurnStatus=commands.length?'executing':'recognizing'
 if(ended){
  for(const command of commands)if(command.status==='executing'){command.status='interrupted';command.resultText='未收到该指令的执行结果，尚未确认完成。'}
  status=errors.length||commands.some(command=>command.status==='failed')?'failed':commands.some(command=>command.status==='needs_confirmation')?'needs_confirmation':
   range.superseded||!range.end||['aborted','interrupted','forked','blocked','max-tokens'].includes(reason?.kind)||commands.some(command=>command.status==='interrupted')?'interrupted':
   final?.text||commands.length?'completed':'failed'
 }
 if(row.stopRequestedAt&&ended&&reason?.kind!=='completed'&&status!=='needs_confirmation'&&!errors.length&&!commands.some(command=>command.status==='failed'))status='interrupted'
 let reply=ended?final?.text||(row.stopRequestedAt&&status==='interrupted'?texts.at(-1)||'':''):texts.at(-1)||''
 if(errors.length)reply=[reply,'执行失败：'+errors.join('\n')].filter(Boolean).join('\n\n')
 if(ended&&!reply){
  reply=commands.length?commands.every(command=>command.kind==='tool')?isPlainAssistantChat(row.conversationId)?'本轮未返回文字答复，请在原会话查看执行状态。':'本轮未返回文字答复，可展开工具执行记录核对执行状态。':commands.map(command=>command.label+'：'+(command.resultText||'未返回执行结果')).join('\n'):'本轮未返回可展示结果，尚未确认执行完成'
  if(status==='interrupted'&&!commands.length)reply+='；本轮已中断。'
 }
 const failedCommands=commands.filter(command=>command.status==='failed'),blocked=!errors.length&&failedCommands.length>0&&failedCommands.every(command=>command.blocked)
 const attachments=nativeAssistantAttachments(range.user?.data?.content,row.attachments)
 return {...row,...(attachments.length?{attachments}:{}),...(attachments.length||row.attachments?.length?{attachmentAccepted:true}:{}),commands,status,replySource:(ended?!!final?.text:texts.length>0)?'assistant':commands.length?'tools':undefined,...(status==='failed'?{blocked,failurePhase:errors.length||!commands.length?'model' as const:'execution' as const}:{}),...(reply?{reply:excerpt(reply)}:{}),userSeq:Number(range.user.seq),nativeTurn:range.start?.data?.turn,toSeq:Number(range.events.at(-1)?.seq)||row.fromSeq||0,jobIds:[...new Set(commands.flatMap(command=>command.jobIds||[]))]}
}
/** Projection only: never submits, retries, or executes any operation. */
export function reconcileHubTurns(conversationId:string,session:any,options:HubReconcileOptions={}):HubTurn[]{
 const store=read(),events=eventsOf(session);let changed=false
 for(let i=0;i<store.turns.length;i++){
  const row=store.turns[i]
  if(row.source!=='ai'||row.sessionId!==session?.id||!row.requestId||!matches(row,conversationId,options))continue
  const projected=project(row,session,events,options)
  if(JSON.stringify(projected)!==JSON.stringify(row)){store.turns[i]=projected;changed=true}
 }
 if(changed)write(store)
 return store.turns.filter(row=>matches(row,conversationId,options))
}
/** Old native history stays readable without manufacturing durable requests or executing anything. */
export function projectLegacyHubTurns(conversationId:string,session:any,query:HubTurnQuery={}):HubTurn[]{
 if(!session?.id||query.sessionId&&query.sessionId!==session.id)return []
 if(conversationId==='system:knowledge'&&scopeKey(hubSessionKnowledgeScope(session.id))!==scopeKey(query.knowledgeScope))return []
 const events=eventsOf(session),tracked=read().turns.filter(row=>row.sessionId===session.id),rows:HubTurn[]=[]
 for(const event of events){
  if(!isHuman(event)||tracked.some(row=>row.userSeq===Number(event.seq)||row.requestId&&row.requestId===rpcId(event)))continue
  const attachments=nativeAssistantAttachments(event.data?.content),text=stripAssistantBoilerplate(textBlocks(event.data))|| (attachments.length?'发送了 '+attachments.length+' 个附件':'');if(!text||isSystemInjectedText(text))continue
  const time=new Date(event.time||0),row:HubTurn={id:'native:'+session.id+':'+event.seq,conversationId,text,at:Number.isNaN(time.getTime())?new Date(0).toISOString():time.toISOString(),source:'ai',mode:'execute',status:'recognizing',sessionId:session.id,requestId:rpcId(event),fromSeq:Math.max(0,Number(event.seq)-1),userSeq:Number(event.seq),commands:[],legacy:true,trigger:'manual',...(attachments.length?{attachments}:{}),...(conversationId==='system:knowledge'?{knowledgeScope:query.knowledgeScope||{}}:{})}
  rows.push(project(row,session,events,{}))
 }
 return rows
}
export function hubMessageTurnId(sessionId:string,seq:number,legacyTurns:HubTurn[]=[]):string|undefined {
 return [...read().turns,...legacyTurns].find(row=>row.sessionId===sessionId&&row.userSeq!==undefined&&seq>=row.userSeq&&seq<=(row.toSeq??row.userSeq))?.id
}
export function markHubMessages<T extends {seq?:number}>(sessionId:string,entries:T[],legacyTurns:HubTurn[]=[]):Array<T & {turnId?:string}>{
 const rows=[...read().turns,...legacyTurns].filter(row=>row.sessionId===sessionId&&row.userSeq!==undefined)
 return entries.map(entry=>{const row=typeof entry.seq==='number'?rows.find(row=>entry.seq!>=row.userSeq!&&entry.seq!<=(row.toSeq??row.userSeq!)):undefined;return row?{...entry,turnId:row.id}:entry})
}
