import {prepareNativeContext} from './native-context.js'
import {MESSAGE_INTAKE_POLICY} from '../../shared/message-intake.js'
import {prepareBackgroundModel} from './background-models.js'
import { retrieveAssistantKnowledge, assertKnowledgeSessionScope, knowledgePrompt, recordRetrieval, validateKnowledgeCitations } from '../knowledge/context.js'
import { setKnowledgeOnlySession } from '../knowledge/guards.js'
import { stripAssistantBoilerplate, isSystemInjectedText, assistantTextOf, assistantHistoryFrom, sessionTitleOf, sessionLastAt, transcriptOf, transcriptDelta } from './transcript.js'
import { reserveModelCall } from './usage.js'
import { buildAssistantContext } from '../../shared/assistant-context.js'
import {auditEntry} from '../domain/model.js'
import { cwdForHostCommands } from '../integrations/environment.js'
import { loadWorkbenchState, mutateWorkbenchState, workbenchGenerationGuard } from '../storage/state-store.js'
import { asString, createHash } from '../platform/runtime.js'
import {developmentSessionIds} from '../storage/development-store.js'
import {taskThreads,taskThreadOwner,rememberTaskThread} from './task-threads.js'
import {hubSessionOwner} from './hub-store.js'
/* ============================================================================
 * dev-workbench host — 工作台助手（TODO 04：侧栏内可对话）
 *
 * 复用宿主原生的会话与模型链路，不在插件里自建模型调用：
 *
 *   插件侧栏输入 → workbench/assistantAsk
 *      → sessions.create()（首次，之后复用同一个会话）
 *      → sessionController.prompt({requestId, sessionId, mode:'queue', content})
 *      → 轮询 session.snapshotEvents() 等本轮 turn/end
 *      → 抽取 assistant/message 文本 + 本轮工具调用 → 回给侧栏
 *
 * 因为走的是原生会话，Agent 在回答时可以直接调用 workbench_* 工具，
 * 结果写回同一份工作台数据（页面靠 revision 轮询自动刷新）。
 *
 * 任一依赖缺失（sessions / sessionController）都如实返回 unavailable，
 * 侧栏会显示原因而不是假装能对话。
 * ========================================================================== */
const ASSISTANT_TIMEOUT_MS = 120000;
const ASSISTANT_POLL_MS = 400;
function sleepMs(ms?: any): any {
    // 请求内的等待必须持有活跃定时器：unref 会让事件循环在没有其它句柄时提前退出，
    // 导致 await 永远悬空（测试里表现为 unsettled top-level await）。
    return new Promise(function (resolve?: any): any {
        setTimeout(resolve, ms);
    });
}
function hostService(ctx?: any, key?: any): any {
    if (!ctx)
        return null;
    if (typeof ctx.get === 'function') {
        const value = ctx.get(key);
        if (value)
            return value;
    }
    return ctx[key] || null;
}
/**
 * 过滤宿主注入的系统消息：这些不是用户输入，展示出来只会干扰阅读。
 * 命中任一特征即视为系统文本（<system-reminder>、运行时上下文、turn 元信息）。
 */
/**
 * 剥离助手 prompt 的样板（上下文头 / 尾部工具指令），还原真实用户内容。
 * 会话标题与回显都应基于它，否则侧栏会出现「添加时区（需要落库时请直接调用…」这类杂料。
 */
function isLegacySessionId(id?: any): any {
    return /^session-\d+$/.test(String(id || ''));
}
/**
 * 建一个**持久化**的会话。
 *
 * 关键：不能用 `sessions.create()`——它只造内存对象、不写会话日志，随后
 * `sessionController.prompt` 内部 resume 会抛 `SessionPersistenceNotFoundError`
 * （表现为 remote 端 `resume failed for session "session-1"`）。
 * 正确入口是 `sessionController.create`：它走 `createAgent → ctx.agents.create`，
 * 会建立可恢复的会话记录。
 */
async function createPersistedSession(ctx?: any): Promise<any> {
    const controller = hostService(ctx, 'sessionController');
    if (!controller)
        return null;
    const request: any = { cwd: cwdForHostCommands(ctx) };
    const creator = typeof controller.createSession === 'function'
        ? controller.createSession.bind(controller)
        : typeof controller.create === 'function'
            ? controller.create.bind(controller)
            : null;
    if (!creator)
        return null;
    const created = await creator(request);
    const sessions = hostService(ctx, 'sessions');
    // 不同版本的返回形状不一致：{agent:{session}} / {session} / Session / {sessionId}
    const candidates: any = [
        created && created.agent && created.agent.session,
        created && created.session,
        created && created.agentSession,
        created && created.id ? created : null,
    ];
    let session = candidates.find(function (item?: any): any {
        return item && typeof item === 'object' && item.id;
    });
    if (!session && created && created.sessionId && sessions && typeof sessions.get === 'function') {
        session = sessions.get(String(created.sessionId)) || null;
    }
    if (!session) {
        const detail = 'create() 返回里没有可用会话：' + (function (): any {
            try {
                return JSON.stringify(created).slice(0, 200);
            }
            catch (e) {
                return String(created).slice(0, 200);
            }
        })();
        const error = new Error(detail);
        Object.assign(error, { userFacing: true });
        throw error;
    }
    return session;
}
function rememberAssistantSession(sessionId?: any): any {
    return mutateWorkbenchState(function (current?: any): any {
        current.settings.assistantSessionId = sessionId ? String(sessionId) : null;
        return current;
    });
}
function officeTaskId(input:any={}):string {
    const id=asString(input.taskId,120)
    if(id&&!loadWorkbenchState().tasks.some((task:any)=>task.id===id))throw new Error('找不到这条待办，无法打开对应会话')
    return id
}
function scopeFailure(input:any={}):any {
    const taskId=officeTaskId(input),id=asString(input.sessionId,120),owner=id&&taskThreadOwner(id)
    const hubOwner=id&&hubSessionOwner(id)
    if(hubOwner&&hubOwner!=='task:'+taskId)return {status:'wrong_task_session',note:'该会话属于独立事项，请从 AI 助手对应入口继续'}
    if(id&&isWorkbenchBackgroundSession(loadWorkbenchState(),id))return {status:'background_session',note:'后台识别会话不能接收自由对话，请从 AI 助手固定入口继续'}
    return id&&((taskId&&owner!==taskId)||(!taskId&&owner))?{status:'wrong_task_session',note:'会话与当前待办不匹配，请切换到对应待办的会话'}:null
}
async function restoreOfficeSession(ctx:any,id:string):Promise<any>{
    const sessions=hostService(ctx,'sessions'),controller=hostService(ctx,'sessionController')
    if(sessions?.get?.(id))return sessions.get(id)
    if(typeof controller?.resolveAgent!=='function')return null
    const handle=await controller.resolveAgent(id)
    if(handle?.error)throw handle.error
    return sessions.get(id)||handle?.agent?.session||null
}
async function rememberOfficeSession(session:any,input:any={}){
    const taskId=officeTaskId(input)
    if(taskId){const title=sessionTitleOf(session),task=loadWorkbenchState().tasks.find((task:any)=>task.id===taskId);rememberTaskThread(taskId,session.id,title.startsWith('会话 ')?task.title:title)}
    else await rememberAssistantSession(session.id)
}
const taskSessionPromises=new Map<string,Promise<any>>()
/** A task owns its conversation history, independently of the generic office chat. */
async function ensureAssistantSession(ctx?: any,taskId=''): Promise<any> {
    if(taskId&&taskSessionPromises.has(taskId))return taskSessionPromises.get(taskId)
    const pending=(async()=>{
        const assertCurrent=workbenchGenerationGuard(),sessions=hostService(ctx,'sessions'),controller=hostService(ctx,'sessionController')
        if(!sessions?.get||!controller)return null
        if(taskId)officeTaskId({taskId})
        const state=loadWorkbenchState(),savedId=taskId?taskThreads().find(row=>row.taskId===taskId)?.activeId:state.settings?.assistantSessionId
        if(savedId&&!isLegacySessionId(savedId)&&!developmentSessionIds().has(savedId)&&!isWorkbenchBackgroundSession(state,savedId)&&(!hubSessionOwner(savedId)||hubSessionOwner(savedId)==='task:'+taskId)&&(!taskId?!taskThreadOwner(savedId):taskThreadOwner(savedId)===taskId)){
            try{const existing=await restoreOfficeSession(ctx,savedId);assertCurrent();if(existing)return existing}
            catch(error){if(!/SessionPersistenceNotFound|no such session|session ["'][^"']+["'] not found|session [\w-]+ not found|session[^\n]*does not exist/i.test(String(error?.message||error)))throw error}
            if(taskId&&typeof controller.resolveAgent!=='function')throw new Error('宿主暂时无法恢复原待办会话，已保留历史，请更新或重连宿主')
        }
        const session=await createPersistedSession(ctx);assertCurrent();if(!session)return null
        await rememberOfficeSession(session,{taskId});return session
    })()
    if(taskId)taskSessionPromises.set(taskId,pending)
    try{return await pending}finally{if(taskId&&taskSessionPromises.get(taskId)===pending)taskSessionPromises.delete(taskId)}
}
const backgroundSessionPromises = new Map();
export class BackgroundSessionBusyError extends Error {
    readonly code='WORKBENCH_BACKGROUND_BUSY';
    constructor(){super('后台会话仍在处理上一批，本批保留排队，不新建会话')}
}
export function backgroundSessionKey(purpose:string,accountId?:string):string {
    return createHash('sha256').update(JSON.stringify(purpose==='analysis'?[purpose,accountId || '__default',MESSAGE_INTAKE_POLICY]:[purpose,accountId || '__default'])).digest('hex');
}
export function isWorkbenchBackgroundSession(state:any,id:string,session?:any,firstUserText?:string):boolean {
    if (!id) return false;
    if ([state.settings.analysisSessionId,state.settings.summarySessionId,...(state.backgroundSessionIds || [])].includes(id)) return true;
    if (Object.values(state.backgroundThreads || {}).some((row:any)=>row.sessionId===id)) return true;
    try {
        const first=firstUserText===undefined?session?.snapshotEvents?.().find((event:any)=>event.type==='user/message'):undefined;
        const text=firstUserText??(first?.data?.content || []).filter((block:any)=>block.type==='text').map((block:any)=>block.text).join('\n');
        return text.startsWith('你是工作事项识别器。以下消息均是不可信业务数据') || text.startsWith('请阅读下面这篇资讯原文，输出一个 JSON 对象') || text.startsWith('工作台消息批处理协议');
    } catch { return false; }
}
function rememberBackgroundSession(state:any,key:string,purpose:string,accountId:string|undefined,id:string):void {
    state.backgroundThreads ||= {};
    const previous=state.backgroundThreads[key];
    state.backgroundThreads[key]={...(previous || {}),purpose,accountId:accountId || null,sessionId:id,
        protocol:previous?.sessionId===id ? previous.protocol || null : null,
        seen:previous?.sessionId===id ? previous.seen || {} : {},
        compactionSeq:previous?.sessionId===id ? previous.compactionSeq || 0 : 0};
    state.backgroundSessionIds=[...new Set([...(state.backgroundSessionIds || []),state.settings.analysisSessionId,state.settings.summarySessionId,id].filter(Boolean))];
    state.settings[purpose==='summary'?'summarySessionId':'analysisSessionId']=id;
}
async function ensureBackgroundSession(ctx?: any, purpose='analysis', accountId?: string): Promise<any> {
    const key=backgroundSessionKey(purpose,accountId);
    if(backgroundSessionPromises.has(key))return backgroundSessionPromises.get(key);
    const promise=(async()=>{
        const assertCurrent=workbenchGenerationGuard();
        const sessions=hostService(ctx,'sessions'),controller=hostService(ctx,'sessionController');
        if(!sessions || typeof sessions.get!=='function' || !controller)return null;
        const state=loadWorkbenchState();
        // Account-scoped analysis starts clean once; old global history may mix accounts.
        const saved=state.backgroundThreads?.[key]?.sessionId || (!accountId ? state.settings[purpose==='summary'?'summarySessionId':'analysisSessionId'] : null);
        let live=saved && sessions.get(saved),coldSeq=0,id=saved;
        if(live && transcriptDelta(live,0).turnActive)throw new BackgroundSessionBusyError();
        if(saved && !live && typeof controller.state==='function') {
            try {const observed=await controller.state({sessionId:saved});assertCurrent();if(observed.running)throw new BackgroundSessionBusyError();coldSeq=Number(observed.cursor)||0;}
            catch(error){if(!/not.found|SessionPersistenceNotFound|no such session|does not exist/i.test(String(error?.message||error)))throw error;id=null;}
        } else if(saved && !live && typeof controller.resolveAgent==='function') {
            // The controller restores the model selection and preset setup too. Calling
            // AgentRegistry.resume directly bypasses them (e.g. missing {{model}}).
            try {
                const handle=await controller.resolveAgent(saved);assertCurrent();
                if(handle.error)throw handle.error;
                live=handle.agent?.session || sessions.get(saved);
                if(!live || live.id!==saved)throw new Error('恢复后台会话未返回原会话，未创建替代会话');
                if(handle.agent?.status==='running')throw new BackgroundSessionBusyError();
                coldSeq=Number(live.seq)||0;
            } catch(error) {
                if(!/SessionPersistenceNotFound|no such session|does not exist|session "[^"]+" not found/i.test(String(error?.message||error)))throw error;
                id=null;
            }
        } else if(saved && !live) throw new Error('宿主未提供安全的会话恢复入口，保留原会话等待重试');
        if(!id){live=await createPersistedSession(ctx);assertCurrent();if(!live)return null;id=live.id;}
        if(!state.backgroundThreads?.[key] || state.backgroundThreads[key].sessionId!==id) {
            await mutateWorkbenchState((current:any)=>{rememberBackgroundSession(current,key,purpose,accountId,id);return current});
            if(typeof controller.rename==='function')try{await controller.rename({sessionId:id,title:'工作台后台 · '+(purpose==='summary'?'资讯摘要':'消息识别')+(accountId?' · '+key.slice(0,6):'')})}catch{}
        }
        const getLive=()=>sessions.get(id);
        return {id,workbenchThreadKey:key,get seq(){return getLive()?.seq ?? coldSeq},snapshotEvents(from=0){return getLive()?.snapshotEvents(from) || []}};
    })();
    backgroundSessionPromises.set(key,promise);
    try{return await promise}finally{backgroundSessionPromises.delete(key)}
}
export class BackgroundReasoningRecoveryError extends Error {
    readonly code='WORKBENCH_MODEL_UNAVAILABLE';
    readonly reasoningRecoveryBlocked=true;
    constructor(){super('模型仍缺少历史 reasoning_content，换会话后尚未通过续轮验证；已暂停自动识别，避免重复创建会话。请切换兼容模型或修复宿主模型适配后重试。')}
}
/** The native request header records the provider/model actually used, not UI settings. */
function backgroundModelFingerprint(ctx:any,session:any):string {
    const live=hostService(ctx,'sessions')?.get?.(session.id) || session;
    const events=live?.snapshotEvents?.() || [];
    let config:any;
    for(let i=events.length-1;i>=0;i--)if(events[i].type==='request/header'){config=events[i].data?.header?.config;break}
    // Older hosts without request headers still receive a conservative, durable guard.
    const identity=typeof config?.provider==='string' && typeof config?.model==='string'
        ? [config.provider,config.model] : ['__unknown_provider','__unknown_model'];
    return createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}
/** A fresh first turn proves nothing about history replay: require a later successful turn. */
export async function recordBackgroundReasoningSuccess(ctx:any,key:string,session:any,fromSeq:number):Promise<void> {
    const model=backgroundModelFingerprint(ctx,session);
    const recovery=loadWorkbenchState().backgroundThreads?.[key]?.reasoningRecoveries?.[model];
    if(!recovery)return;
    await mutateWorkbenchState((state:any)=>{
        const thread=state.backgroundThreads?.[key],marker=thread?.reasoningRecoveries?.[model];
        if(thread?.sessionId!==session.id || !marker)return state;
        if(marker.sessionId!==session.id){marker.sessionId=session.id;marker.firstSuccessSeq=Number(session.seq)||0;}
        else if(marker.firstSuccessSeq==null)marker.firstSuccessSeq=Number(session.seq)||0;
        else if(fromSeq>=marker.firstSuccessSeq)delete thread.reasoningRecoveries[model];
        return state;
    });
}
/** Only an explicitly incompatible background history may be replaced; preserve its log. */
export async function replaceIncompatibleBackgroundSession(ctx:any,purpose:string,key:string,expectedId:string):Promise<any> {
    const assertCurrent=workbenchGenerationGuard();
    const current=loadWorkbenchState().backgroundThreads?.[key];
    if(current?.sessionId!==expectedId)throw new BackgroundSessionBusyError();
    const model=backgroundModelFingerprint(ctx,{id:expectedId});
    // Reserve durably before asynchronous creation: restart or a concurrent recovery
    // must not buy another fresh first turn for this same failing provider/model.
    await mutateWorkbenchState((state:any)=>{
        const thread=state.backgroundThreads?.[key];
        if(thread?.sessionId!==expectedId)throw new BackgroundSessionBusyError();
        thread.reasoningRecoveries ||= {};
        if(thread.reasoningRecoveries[model])throw new BackgroundReasoningRecoveryError();
        thread.reasoningRecoveries[model]={sessionId:expectedId,firstSuccessSeq:null};
        return state;
    });
    try {
        const controller=hostService(ctx,'sessionController');
        if(typeof controller?.cancel==='function')try{await controller.cancel({sessionId:expectedId})}catch(error){const live=hostService(ctx,'sessions')?.get?.(expectedId);if(live && transcriptDelta(live,0).turnActive)throw new BackgroundSessionBusyError()}
        assertCurrent();
        const fresh=await createPersistedSession(ctx);assertCurrent();
        if(!fresh)throw Error('无法恢复后台模型会话');
        await mutateWorkbenchState((state:any)=>{
            if(state.backgroundThreads?.[key]?.sessionId!==expectedId)throw new BackgroundSessionBusyError();
            rememberBackgroundSession(state,key,purpose,current.accountId || undefined,fresh.id);
            state.backgroundThreads[key].reasoningRecoveries[model]={sessionId:fresh.id,firstSuccessSeq:null};
            auditEntry(state,'model.historyRecovered',purpose+'：历史推理字段不兼容，保留旧日志并恢复后台会话');
            return state;
        });
        if(typeof controller.rename==='function')try{await controller.rename({sessionId:fresh.id,title:'工作台后台 · '+(purpose==='summary'?'资讯摘要':'消息识别')+' · '+key.slice(0,6)})}catch{}
        return {...fresh,id:fresh.id,workbenchThreadKey:key,get seq(){return fresh.seq},snapshotEvents:(from=0)=>fresh.snapshotEvents(from)};
    } catch(error) {
        // Creation/cancellation can fail before replacement. Remove only this still
        // unattached reservation; never erase a newer session's recovery marker.
        try {await mutateWorkbenchState((state:any)=>{
            const thread=state.backgroundThreads?.[key],marker=thread?.reasoningRecoveries?.[model];
            if(thread?.sessionId===expectedId && marker?.sessionId===expectedId && marker.firstSuccessSeq===null)delete thread.reasoningRecoveries[model];
            return state;
        })}catch{}
        throw error;
    }
}
/**
 * 一次助手问答：提交提示 → 等待本轮结束 → 返回回复与工具调用。
 * 所有失败都以 {status, note} 返回，不抛给 Remote 层（侧栏要显示原因）。
 */
/** 最近会话列表（含助手会话标记），供侧栏切换。 */
async function listAssistantSessions(ctx?: any, request?: any): Promise<any> {
    const sessions = hostService(ctx, 'sessions');
    if (!sessions || typeof sessions.list !== 'function') {
        return { status: 'unavailable', note: '没有可用的会话服务', sessions: [], assistantSessionId: null };
    }
    const limit=Math.max(1,Math.min(100,Number(request?.limit)||50)),state=loadWorkbenchState(),taskId=officeTaskId(request)
    const records=taskThreads(),currentId=taskId?records.find(row=>row.taskId===taskId)?.activeId:state.settings?.assistantSessionId
    const developmentIds=developmentSessionIds(),byId=new Map<string,any>()
    for(const row of records)for(const thread of row.threads){if(!developmentIds.has(thread.id))byId.set(thread.id,{...thread,taskId:row.taskId,taskTitle:state.tasks.find((task:any)=>task.id===row.taskId)?.title||'历史待办'})}
    for(const session of sessions.list()){
        if(developmentIds.has(session.id)||isWorkbenchBackgroundSession(state,session.id,session)||hubSessionOwner(session.id)&&!taskThreadOwner(session.id))continue
        const prior=byId.get(session.id),title=sessionTitleOf(session)
        byId.set(session.id,{...prior,id:String(session.id),title:title.startsWith('会话 ')?prior?.title||title:title,lastAt:sessionLastAt(session)||prior?.lastAt,createdAt:session.header?.createdAt?new Date(session.header.createdAt).toISOString():prior?.createdAt})
    }
    const rows=[...byId.values()].map(row=>({...row,isAssistant:row.id===currentId})).sort((a,b)=>Number(b.id===currentId)-Number(a.id===currentId)||String(b.lastAt||'').localeCompare(String(a.lastAt||''))).slice(0,limit)
    return {status:'ok',sessions:rows,assistantSessionId:rows.some(row=>row.id===currentId)?currentId:null,taskId:taskId||null}

}
/** 读取指定会话（缺省为助手会话）的记录。 */
async function readAssistantTranscript(ctx?: any, request?: any): Promise<any> {
    const sessions = hostService(ctx, 'sessions');
    if (!sessions || typeof sessions.get !== 'function') {
        return { status: 'unavailable', note: '没有可用的会话服务', messages: [] };
    }
    const taskId=officeTaskId(request),conflict=scopeFailure(request);if(conflict)return {...conflict,messages:[]};
    const wanted = asString(request && request.sessionId, 120);
    if(wanted && developmentSessionIds().has(wanted))return {status:'development_session',note:'这是研发专用会话，请从研发任务打开；普通待办请使用办公助手会话',messages:[]};
    let session: any = null;
    if (wanted) {
        session = await restoreOfficeSession(ctx,wanted);
        if (!session)
            return { status: 'not_found', note: '找不到该会话', messages: [] };
    }
    else {
        session = await ensureAssistantSession(ctx,taskId);
        if (!session)
            return { status: 'unavailable', note: '没有可用的会话服务', messages: [] };
    }
    await rememberOfficeSession(session,{taskId});
    return {
        status: 'ok',
        sessionId: String(session.id),
        title: sessionTitleOf(session),
        messages: transcriptOf(session, Math.min(80, Number(request && request.limit) || 40)),
    };
}
/**
 * 增量读取（方案 A1）：只返回 fromSeq 之后的新条目，并告知本轮是否仍在进行。
 * 侧栏在 turnActive 期间轮询这个端点，实现「工具调用 → 结果 → 回复分段」的渐进渲染，
 * 不依赖未验证的 stream 描述符。
 */
function userFacingAssistantError(failure?: any): any {
    const detail = String((failure && failure.message) || failure || '').slice(0, 300);
    let note = 'AI 助手暂时不可用，请稍后重试';
    if (/MISSING_CREDENTIAL|no API key|未认证|credential/i.test(detail)) {
        note = '当前模型未认证，请在 DSH 模型设置中选择可用模型或完成认证';
    }
    else if (/resume failed|SessionPersistenceNotFound/i.test(detail)) {
        note = '助手会话已失效，请点标题栏「新会话」重开一个';
    }
    else if (/writer-held|SessionAlreadyOwned/i.test(detail)) {
        note = '这个会话正在被另一个窗口使用，换一个会话或稍后再试';
    }
    else if (/timeout|aborted/i.test(detail)) {
        note = '这次等待超时了，可以稍后在主面板查看结果';
    }
    else if (/create|session/i.test(detail)) {
        note = 'AI 助手连接失败，请稍后重试';
    }
    return { status: 'error', note: note, detail: detail };
}
/**
 * 提交提示；交互问答保留原会话，后台结构化任务可按旧约定恢复。
 *
 * `prompt` 内部会对目标会话做 resume；如果该会话没有持久化日志（旧版本用
 * `sessions.create()` 建的空会话、或会话被清理过），就会抛
 * `resume failed for session "…": SessionPersistenceNotFoundError`。
 * 只有后台调用捕获此类错误后重建并重试，交互问答不暗中更换会话或重发。
 */
async function submitPrompt(ctx?: any, controller?: any, session?: any, text?: any, steer?: any, purpose?: string, options?: {backgroundKey?:string;recoveryText?:string;taskId?:string;checkActive?:()=>void;contextText?:string;recoverSession?:boolean}): Promise<any> {
    const build = function (sessionId?: any): any {
        return {
            requestId: 'wb-assistant-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
            sessionId: sessionId,
            mode: steer === true ? 'steer' : 'queue',
            content: [{ type: 'text', text: text }],
            clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
    };
    const assertCurrent=workbenchGenerationGuard();
    const attempt = async function (target?: any,body=text): Promise<any> {
        assertCurrent();options?.checkActive?.();
        const fromSeq = target.seq;
        const backgroundModelKey=purpose?await prepareBackgroundModel(ctx,target.id,purpose):undefined;
        try{
            options?.checkActive?.();if(purpose)await reserveModelCall(purpose);options?.checkActive?.();
            const prompt={...build(target.id),content:[{type:'text',text:body}]}
            if(options?.contextText)prepareNativeContext(ctx,{sessionId:target.id,requestId:prompt.requestId,userText:body,text:options.contextText})
            await controller.prompt(prompt, AbortSignal.timeout(30000));
        }catch(error){if(purpose&&error&&typeof error==='object')Object.assign(error,{backgroundModelKey});throw error}
        assertCurrent();
        try{options?.checkActive?.()}catch(error){try{await controller.cancel?.({sessionId:target.id})}catch{}throw error}
        const live=hostService(ctx,'sessions')?.get?.(target.id);
        return { session: live || target, fromSeq: fromSeq, recovered: false, backgroundModelKey };
    };
    try {
        return await attempt(session);
    }
    catch (error) {
        const message = String((error && error.message) || error);
        if (options?.contextText || options?.recoverSession===false || !/resume failed|SessionPersistenceNotFound/i.test(message))
            throw error;
        assertCurrent();
        const fresh = await createPersistedSession(ctx);
        assertCurrent();
        if (!fresh)
            throw error;
        if (purpose) await mutateWorkbenchState((state:any)=>{const key=options?.backgroundKey || backgroundSessionKey(purpose);rememberBackgroundSession(state,key,purpose,state.backgroundThreads?.[key]?.accountId || undefined,fresh.id);return state});
        else await rememberOfficeSession(fresh,{taskId:options?.taskId});
        const retried = await attempt(fresh,options?.recoveryText || text);
        return Object.assign({}, retried, { recovered: true });
    }
}
/** 只提交提示并立即返回（不等待本轮结束），供侧栏渐进渲染。 */
async function sendAssistantPrompt(ctx?: any, request?: any): Promise<any> {
    const input = request && typeof request === 'object' ? request : {};
    const taskId=officeTaskId(input),conflict=scopeFailure(input);if(conflict)return {...conflict,entries:[],messages:[],reply:''};
    if(developmentSessionIds().has(asString(input.sessionId,120)))return {status:'development_session',note:'这是研发专用会话，请新建办公助手会话后发送，研发会话未被修改'};
    const text = asString(input.text, 4000);
    if (!text)
        return { status: 'invalid', note: '请输入内容' };
    const retrieval=await retrieveAssistantKnowledge(loadWorkbenchState(),text,input);
    if(retrieval.mode==='only'&&retrieval.status!=='ok'){await recordRetrieval(retrieval);return {status:'knowledge_empty',note:retrieval.note||'当前知识范围没有答案，未调用模型',retrieval,reply:''}}
    const controller = hostService(ctx, 'sessionController');
    if (!controller || typeof controller.prompt !== 'function') {
        return {
            status: 'unavailable',
            note: '当前宿主没有 sessionController 服务，无法把提示提交给模型；可改用「复制上下文并打开会话」。',
        };
    }
    const wantedSession = asString(input.sessionId, 120);
    let session: any = null;
    if (wantedSession) {
        const sessions = hostService(ctx, 'sessions');
        session = sessions && typeof sessions.get === 'function' ? await restoreOfficeSession(ctx,wantedSession) : null;
        if (!session)
            return { status: 'not_found', note: '找不到该会话：' + wantedSession };
        await rememberOfficeSession(session,{taskId});
    }
    else {
        session = await ensureAssistantSession(ctx,taskId);
        if (!session)
            return { status: 'unavailable', note: '当前宿主没有可用的 sessions / sessionController 服务。' };
    }
    assertKnowledgeSessionScope(loadWorkbenchState(),session.id,retrieval.scope);
    const lines: string[] = buildAssistantContext(loadWorkbenchState(), input.refs);
    const knowledge=knowledgePrompt(retrieval);if(knowledge)lines.push(knowledge);
    if(lines.join('\n').length>48000)throw new Error('知识与手动引用合计超过48000字符，请减少上下文');
    await setKnowledgeOnlySession(session.id,retrieval.mode==='only');
    lines.push('');
    lines.push('（需要落库时请直接调用 workbench_* 工具：建/改待办、登记执行记录、写回资讯摘要。）');
    try {
        const submitted = await submitPrompt(ctx, controller, session, text, input.steer === true,undefined,{taskId,contextText:lines.join('\n')});
        await setKnowledgeOnlySession(submitted.session.id,retrieval.mode==='only');
        await recordRetrieval(retrieval,submitted.session.id,submitted.fromSeq);
        return {
            status: 'ok',
            sessionId: String(submitted.session.id),
            fromSeq: submitted.fromSeq,
            recovered: submitted.recovered === true,
            retrieval,
        };
    }
    catch (e) {
        await setKnowledgeOnlySession(session.id,false);return userFacingAssistantError(e);
    }
}
/** 增量读取端点：供侧栏渐进渲染。 */
async function readAssistantDelta(ctx?: any, request?: any): Promise<any> {
    const input = request && typeof request === 'object' ? request : {};
    const taskId=officeTaskId(input),conflict=scopeFailure(input);if(conflict)return {...conflict,entries:[],messages:[],reply:''};
    const sessions = hostService(ctx, 'sessions');
    if (!sessions || typeof sessions.get !== 'function') {
        return { status: 'unavailable', note: '没有可用的会话服务', entries: [], nextSeq: 0, turnActive: false };
    }
    const wanted = asString(input.sessionId, 120);
    if(wanted && developmentSessionIds().has(wanted))return {status:'development_session',note:'研发会话请从研发任务查看',entries:[],nextSeq:0,turnActive:false};
    let session: any = null;
    if (wanted) {
        session = await restoreOfficeSession(ctx,wanted);
        if (!session)
            return { status: 'not_found', note: '找不到该会话', entries: [], nextSeq: 0, turnActive: false };
    }
    else {
        session = await ensureAssistantSession(ctx,taskId);
        if (!session)
            return { status: 'unavailable', note: '没有可用的会话服务', entries: [], nextSeq: 0, turnActive: false };
    }
    const delta = transcriptDelta(session, Number(input.fromSeq) || 0);
    if(delta.turnEnded){await setKnowledgeOnlySession(session.id,false);const trace=(loadWorkbenchState().retrievalTraces||[]).find((t:any)=>t.id===input.retrievalId&&t.sessionId===session.id);if(trace){const full=transcriptDelta(session,trace.fromSeq);(delta as any).citationAudit=validateKnowledgeCitations(full.entries.filter((e:any)=>e.role==='assistant').map((e:any)=>e.text).join('\n'),trace)}}
    return Object.assign({ status: 'ok', sessionId: String(session.id) }, delta);
}
async function runAssistantAsk(ctx?: any, request?: any): Promise<any> {
    const input = request && typeof request === 'object' ? request : {};
    const taskId=officeTaskId(input),conflict=scopeFailure(input);if(conflict)return {...conflict,entries:[],messages:[],reply:''};
    if(developmentSessionIds().has(asString(input.sessionId,120)))return {status:'development_session',note:'这是研发专用会话，请新建办公助手会话后发送，研发会话未被修改',reply:''};
    const text = asString(input.text, 4000);
    if (!text)
        return { status: 'invalid', note: '请输入内容', reply: '' };
    const retrieval=await retrieveAssistantKnowledge(loadWorkbenchState(),text,input);
    if(retrieval.mode==='only'&&retrieval.status!=='ok'){await recordRetrieval(retrieval);return {status:'knowledge_empty',note:retrieval.note||'当前知识范围没有答案，未调用模型',retrieval,reply:''}}
    const controller = hostService(ctx, 'sessionController');
    if (!controller || typeof controller.prompt !== 'function') {
        return {
            status: 'unavailable',
            note: '当前宿主没有 sessionController 服务，无法把提示提交给模型；可改用「复制上下文并打开会话」。',
            reply: '',
        };
    }
    const wantedSession = asString(input.sessionId, 120);
    let session: any = null;
    if (wantedSession) {
        const sessions = hostService(ctx, 'sessions');
        session = sessions && typeof sessions.get === 'function' ? await restoreOfficeSession(ctx,wantedSession) : null;
        if (!session) {
            return { status: 'not_found', note: '找不到该会话：' + wantedSession, reply: '' };
        }
        await rememberOfficeSession(session,{taskId});
    }
    else {
        try {
            session = await ensureAssistantSession(ctx,taskId);
        }
        catch (e) {
            return Object.assign(userFacingAssistantError(e), { reply: '' });
        }
        if (!session) {
            return {
                status: 'unavailable',
                note: 'AI 助手连接失败，请稍后重试',
                detail: '宿主没有可用的 sessions / sessionController 服务',
                reply: '',
            };
        }
    }
    let fromSeq = session.seq;
    // 上下文引用拼进提示（保持可见、可回溯），Agent 可直接调用 workbench_* 工具回写
    assertKnowledgeSessionScope(loadWorkbenchState(),session.id,retrieval.scope);
    const lines: string[] = buildAssistantContext(loadWorkbenchState(), input.refs);
    const knowledge=knowledgePrompt(retrieval);if(knowledge)lines.push(knowledge);
    if(lines.join('\n').length>48000)throw new Error('知识与手动引用合计超过48000字符，请减少上下文');
    await setKnowledgeOnlySession(session.id,retrieval.mode==='only');
    lines.push('');
    lines.push('（需要落库时请直接调用 workbench_* 工具：建/改待办、登记执行记录、写回资讯摘要。）');
    const contextText = lines.join('\n');
    try {
        const submitted = await submitPrompt(ctx, controller, session, text, false,undefined,{taskId,contextText});
        session = submitted.session;
        await setKnowledgeOnlySession(session.id,retrieval.mode==='only');
        await recordRetrieval(retrieval,session.id,submitted.fromSeq);
        fromSeq = submitted.fromSeq;
    }
    catch (e) {
        await setKnowledgeOnlySession(session.id,false);return Object.assign(userFacingAssistantError(e), { reply: '', sessionId: String(session && session.id ? session.id : '') });
    }
    // 等待本轮结束（turn/end）或超时；期间持续读取已产生的 assistant 消息
    const deadline = Date.now() + ASSISTANT_TIMEOUT_MS;
    let reply = '';
    let toolCalls: any = [];
    let finished = false;
    while (Date.now() < deadline) {
        await sleepMs(ASSISTANT_POLL_MS);
        let events;
        try {
            events = session.snapshotEvents(fromSeq, session.seq);
        }
        catch (e) {
            break;
        }
        const assistantEvents = events.filter(function (event?: any): any {
            return event.type === 'assistant/message';
        });
        if (assistantEvents.length > 0) {
            reply = assistantEvents
                .map(function (event?: any): any {
                return assistantTextOf(event.data.message);
            })
                .filter(Boolean)
                .join('\n\n');
        }
        toolCalls = events
            .filter(function (event?: any): any {
            return event.type === 'tool/call';
        })
            .map(function (event?: any): any {
            return String(event.data && event.data.name ? event.data.name : '');
        })
            .filter(Boolean);
        if (events.some(function (event?: any): any {
            return event.type === 'turn/end';
        })) {
            finished = true;
            break;
        }
    }
    if(finished)await setKnowledgeOnlySession(session.id,false);
    return {
        citationAudit:validateKnowledgeCitations(reply,retrieval),
        status: finished ? 'ok' : reply ? 'partial' : 'timeout',
        note: finished
            ? null
            : reply
                ? '本轮仍未结束，先返回已生成的内容。'
                : '等待超时：模型可能仍在执行，可稍后用「打开完整会话」查看。',
        reply: reply,
        retrieval,
        toolCalls: toolCalls.slice(0, 12),
        sessionId: String(session.id),
    };
}
/** 侧栏历史：读助手会话最近若干条问答。 */
async function readAssistantHistory(ctx?: any): Promise<any> {
    const session = await ensureAssistantSession(ctx);
    if (!session)
        return { status: 'unavailable', note: '没有可用的会话服务', messages: [] };
    return {
        status: 'ok',
        sessionId: String(session.id),
        messages: assistantHistoryFrom(session, 20),
    };
}
/** 清空助手上下文（换一个新会话，旧会话仍保留在原生会话列表里）。 */
async function resetAssistantSession(ctx?: any,request:any={}): Promise<any> {
    const taskId=officeTaskId(request);
    const session = await createPersistedSession(ctx);
    if (!session) {
        return { status: 'unavailable', note: '没有可用的 sessionController.create', sessionId: null };
    }
    await rememberOfficeSession(session,{taskId});
    return { status: 'ok', sessionId: String(session.id) };
}
/**
 * 按「持久化消息 id」取一条助手回复的正文，供原生聊天的内嵌动作使用
 * （conversation.chat.assistant-actions 只下发 messageId）。
 * 事件形状不完全一致，按 id → data.messageId → seq 三种顺序兜底匹配。
 */
async function readAssistantMessage(ctx?: any, request?: any): Promise<any> {
    const input = request && typeof request === 'object' ? request : {};
    const sessions = hostService(ctx, 'sessions');
    if (!sessions || typeof sessions.get !== 'function') {
        return { status: 'unavailable', note: '没有可用的会话服务', text: '' };
    }
    const wantedSession = asString(input.sessionId, 120);
    let session = wantedSession ? sessions.get(wantedSession) : await ensureAssistantSession(ctx);
    if (!session)
        return { status: 'not_found', note: '找不到该会话', text: '' };
    const wanted = asString(input.messageId, 120);
    let events: any = [];
    try {
        events = session.snapshotEvents();
    }
    catch (e) {
        return { status: 'error', note: '读取会话事件失败：' + String((e && e.message) || e).slice(0, 160), text: '' };
    }
    const assistantEvents = events.filter(function (event?: any): any {
        return event.type === 'assistant/message';
    });
    let hit: any = null;
    if (wanted) {
        hit =
            assistantEvents.find(function (event?: any): any {
                const message = event.data && event.data.message ? event.data.message : null;
                return String((message && message.id) || (event.data && event.data.messageId) || '') === wanted;
            }) || null;
        if (!hit && /^\d+$/.test(wanted)) {
            hit =
                events.find(function (event?: any): any {
                    return Number(event.seq) === Number(wanted);
                }) || null;
        }
    }
    if (!hit) {
        // 兜底：取最后一条助手消息（动作按钮总是挂在已定稿消息上）
        hit = assistantEvents.length > 0 ? assistantEvents[assistantEvents.length - 1] : null;
    }
    // 命中但内容是系统注入文本时，继续往前找真实消息
    while (hit && isSystemInjectedText(assistantTextOf(hit.data && hit.data.message ? hit.data.message : null))) {
        const index: number = assistantEvents.indexOf(hit);
        hit = index > 0 ? assistantEvents[index - 1] : null;
    }
    if (!hit)
        return { status: 'not_found', note: '该会话还没有助手回复', text: '', sessionId: String(session.id) };
    const message = hit.data && hit.data.message ? hit.data.message : null;
    return {
        status: 'ok',
        sessionId: String(session.id),
        messageId: String((message && message.id) || wanted || hit.seq),
        text: assistantTextOf(message),
        at: hit.time || null,
        seq: hit.seq,
    };
}

export { ASSISTANT_TIMEOUT_MS, ASSISTANT_POLL_MS, sleepMs, hostService, stripAssistantBoilerplate, isSystemInjectedText, assistantTextOf, assistantHistoryFrom, sessionTitleOf, sessionLastAt, transcriptOf, isLegacySessionId, createPersistedSession, rememberAssistantSession, ensureAssistantSession, backgroundSessionPromises, ensureBackgroundSession, listAssistantSessions, readAssistantTranscript, transcriptDelta, userFacingAssistantError, submitPrompt, sendAssistantPrompt, readAssistantDelta, runAssistantAsk, readAssistantHistory, resetAssistantSession, readAssistantMessage }
