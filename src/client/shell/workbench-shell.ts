import {WorkspaceRefresh,WorkspaceRefreshMonitor} from '../components/WorkspaceRefresh.js'
import {AnalysisMonitor} from '../components/AnalysisActivity.js'
import {KnowledgeSources} from '../components/KnowledgeSources.js'
import {AssistantSessionsNav} from '../components/AssistantSessionsNav.js'
import {AssistantHubEntry} from '../components/AssistantHub.js'
import {AssistantKnowledgeSettings} from '../components/AssistantKnowledgeSettings.js'
import {installAssistantNative} from '../core/assistant-native.js'
import { AssistantContextPicker } from '../components/AssistantContextPicker.js'
import { Btn, Chip, Empty, Icon, IconBtn, Panel, Select, Spinner, T, Textarea, WB, WB_CSS, WB_DICT, h, setShared_wbConnection, setShared_wbTranslate, useStore, wbConnection, wbTranslate } from '../core/runtime.js'
import * as React from 'react'
import { mdInline, mdParse } from '../features/toolbox/tools-extra.js'
import { TopNavigation, WB_LAYOUT_CSS } from './layout.js'
import { TaskFormHost } from '../features/tasks/task-form.js'
import {SearchResultPreview} from '../features/search/SearchResultPreview.js'
/* ============================================================================
 * dev-workbench shell
 *
 * Owns the page frame: the secondary navigation rail, the toolbar, page
 * routing, the toast outlet and the two slot registrations that place the
 * workbench in the Harness frame:
 *
 *   main              keyed slot, key = 'dev-workbench'
 *                     -> the panel the sidebar entry dispatches to
 *   sidebar.panellist id  = 'dev-workbench'
 *                     -> the global panel icon; its id is the main panel key
 *
 * `WB.apply` is the plugin entry point the built client artifact returns.
 * ========================================================================== */
WB.PAGE_META = {
    dashboard: { title: '今日简报', icon: 'dashboard', hint: '今天要处理的事、资讯与连接状态' },
    assistant: { title: 'AI 助手', icon: 'messages', hint: '处理日常工作、继续事项对话并查看结果' },
    tasks: { title: '任务中心', icon: 'tasks', hint: '查看待办、来源和处理进展' },
    replies: { title: '待回复', icon: 'reply', hint: '独立跟踪需要回复的消息与来源' },
    radar: { title: '资讯', icon: 'radar', hint: '联网发现、原文摘要与收藏' },
    search: { title: '搜索结果', icon: 'search', hint: '查看完整结果并筛选工作内容' },
    agents: { title: '研发任务', icon: 'agent', hint: 'Linky 工作项、独立工作区、Harness 开发与审查' },
    'web-ai': { title: '多 AI 对话', icon: 'messages', hint: '统一提问、连续追问与多家 AI 回答对比' },
    toolbox: { title: '开发工具箱', icon: 'toolbox', hint: '本地执行、数据不出浏览器的高频工具' },
    collab: { title: '研发协作', icon: 'git', hint: '项目启动、开发软件联动、运行日志与仓库环境' },
    knowledge: { title: '知识空间', icon: 'book', hint: '收藏、笔记与排障记录' },
    settings: { title: '连接与设置', icon: 'settings', hint: '连接器状态、关注主题与数据管理' },
};
WB.ORDER = ['dashboard', 'assistant', 'agents', 'tasks', 'replies', 'radar', 'knowledge', 'web-ai', 'search', 'toolbox', 'collab', 'settings'];
WB.NAV_GROUPS = [
    { label: '工作', items: ['dashboard', 'assistant', 'agents', 'tasks'] },
    { label: '工具', items: ['toolbox', 'collab'] },
    { label: '沉淀', items: ['knowledge'] },
    { label: '系统', items: ['settings'] },
];
WB.go = function (page?: any): any {
    if(page==='office'){WB.store.set({page:'office'});return;}
    if (WB.ORDER.indexOf(page) < 0)
        return;
    WB.store.set({ page: page, ...(page==='assistant'?{assistantOpen:true,contextHidden:true}:{}), ...(page==='agents'?{developmentOpenSeq:(WB.store.get().developmentOpenSeq||0)+1}:{}) });
};
function WorkbenchIcon(props?: any): any {
    const size = (props && typeof props.size === 'number' && props.size) || 18;
    return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': 'true',
        style: { display: 'block' },
    }, h('rect', {
        x: 3.2, y: 3.2, width: 7.4, height: 7.4, rx: 2.1,
        fill: 'currentColor', opacity: props && props.active ? 1 : 0.72,
    }), h('rect', {
        x: 13.4, y: 3.2, width: 7.4, height: 7.4, rx: 2.1,
        fill: 'currentColor', opacity: props && props.active ? 0.66 : 0.34,
    }), h('rect', {
        x: 3.2, y: 13.4, width: 7.4, height: 7.4, rx: 2.1,
        fill: 'currentColor', opacity: props && props.active ? 0.66 : 0.34,
    }), h('path', {
        d: 'M13.6 17.1h7.2M17.2 13.5v7.2',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        opacity: props && props.active ? 1 : 0.72,
    }));
}
/* ------------------------------------------------------------------ Toaster */
function Toaster(): any {
    const state = useStore();
    if (!state.toasts.length)
        return null;
    return h('div', { className: 'wb-toasts', 'aria-live': 'polite' }, state.toasts.map(function (item?: any): any {
        return h('div', { key: item.id, role:item.kind==='err'?'alert':'status', className: 'wb-toast wb-toast--' + (item.kind || 'info') }, h(Icon, { name: item.kind === 'err' ? 'alert' : item.kind === 'ok' ? 'checkCircle' : 'info', size: 14 }), h('span', {title:item.text, style: { minWidth: 0, overflowWrap: 'anywhere' } }, item.text));
    }));
}
/* -------------------------------------------------------------- 工作台助手 */
const ASSISTANT_KIND_LABEL: any = {
    task: '待办',
    source: '来源消息',
    radar: '资讯',
    knowledge: '知识',
    search: '检索结果',
};
/**
 * 侧栏助手：真正可对话的聊天窗口。
 * 走 Host 的原生会话与模型（workbench/assistantAsk），因此 Agent 能直接调用
 * workbench_* 工具写回同一份数据；插件内不自建模型调用。
 */
function AssistantDrawer(): any {
    const state = useStore();
    const [messages, setMessages] = React.useState<any>([]);
    const [draft, setDraft] = React.useState<any>('');
    const [sending, setSending] = React.useState<any>(false);
    const [error, setError] = React.useState<any>(null);
    const [sessions, setSessions] = React.useState<any>([]);
    const [activeId, setActiveId] = React.useState<any>(null);
    const [resolving,setResolving]=React.useState(true);
    const [historyCollapsed,setHistoryCollapsed]=React.useState(()=>typeof window!=='undefined'&&window.innerWidth<640);
    const taskId=state.assistantTaskId||'',scopeKey=taskId+':'+(state.assistantOpenSeq||0)+':'+(state.assistantSessionTarget||'');
    const renderedScope=React.useRef(scopeKey),resolvedScope=React.useRef<string|null>(null),drafts=React.useRef<Record<string,string>>({}),draftRef=React.useRef(''),activeRef=React.useRef<string|null>(null);draftRef.current=draft;activeRef.current=activeId;
    const [retrieval,setRetrieval]=React.useState<any>(null);
    const [citationAudit,setCitationAudit]=React.useState<any>(null);
    const [knowledgeMode,setKnowledgeMode]=React.useState('auto');
    const [knowledgeScope,setKnowledgeScope]=React.useState<any>({});
    const [knowledgeOpen,setKnowledgeOpen]=React.useState(false);
    const knowledgeButton=React.useRef<any>(null);
    const closeKnowledge=()=>{setKnowledgeOpen(false);knowledgeButton.current?.focus()};
    const [steerMode, setSteerMode] = React.useState<any>(false);
    const bodyRef = React.useRef<any>(null);
    const requestGeneration = React.useRef(0);
    const transcriptGeneration = React.useRef(0);
    if(renderedScope.current!==scopeKey){renderedScope.current=scopeKey;requestGeneration.current++;transcriptGeneration.current++;resolvedScope.current=null}
    React.useEffect(() => () => { requestGeneration.current += 1; transcriptGeneration.current += 1; }, []);
    React.useEffect(()=>{const resize=()=>{if(window.innerWidth<640)setHistoryCollapsed(true)};window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[]);
    React.useEffect(()=>{if(state.page==='assistant'&&window.innerWidth>=640)setHistoryCollapsed(false)},[state.page]);
    const open = !!state.assistantOpen;
    const refs = Array.isArray(state.assistantRefs) ? state.assistantRefs : [];
    const settings = (state.data && state.data.settings) || {};
    const savedWidth = Number(settings.assistantWidth);
    const [width, setWidth] = React.useState<any>(Number.isFinite(savedWidth) ? Math.max(640,savedWidth) : 800);
    const widthRef = React.useRef<any>(width);
    React.useEffect(function (): any {
        widthRef.current = width;
    }, [width]);
    function startResize(event?: any): any {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = widthRef.current;
        function onMove(moveEvent?: any): any {
            const next = Math.max(240, Math.min(760, Math.round(startWidth + (startX - moveEvent.clientX))));
            widthRef.current = next;
            setWidth(next);
        }
        function onUp(): any {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('mouseleave', onUp);
            if (widthRef.current)
                WB.actions.saveSettings({ assistantWidth: widthRef.current }).catch(function (): any { });
        }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('mouseleave', onUp);
    }
    function loadTranscript(sessionId?:any,scope=taskId):any {
        const generation=++transcriptGeneration.current
        return WB.actions.assistantTranscript(sessionId,80,scope).then((result:any)=>{
            if(generation!==transcriptGeneration.current)return
            if(result?.status&&result.status!=='ok')throw new Error(result.note||'无法读取助手会话')
            if(!result?.sessionId)throw new Error('宿主未返回助手会话，请重新打开')
            setMessages(result.messages||[]);setActiveId(result.sessionId);resolvedScope.current=scopeKey
            setDraft(drafts.current[result.sessionId]||'');setResolving(false)
            const taskTitle=state.data?.tasks?.find((task:any)=>task.id===scope)?.title
            setSessions((previous:any[])=>previous.some(row=>row.id===result.sessionId)?previous:[{id:result.sessionId,title:scope&&result.title?.startsWith('会话 ')?taskTitle||'新会话':result.title||'新会话',taskId:scope||null,taskTitle,isAssistant:true},...previous])
            WB.actions.knowledgeTraces({sessionId:result.sessionId}).then((history:any)=>{if(generation===transcriptGeneration.current){setRetrieval(history?.items?.[0]||null);setCitationAudit(null)}}).catch(()=>{})
        }).catch((failure:any)=>{if(generation===transcriptGeneration.current){setActiveId(null);setResolving(false);setError(failure.message||'无法读取助手会话')}})
    }
    React.useEffect(()=>{
        if(!open)return
        if(activeRef.current)drafts.current[activeRef.current]=draftRef.current
        requestGeneration.current++;const generation=++transcriptGeneration.current
        setSending(false);setResolving(true);setActiveId(null);setMessages([]);setDraft('');setError(null);setRetrieval(null);setCitationAudit(null)
        WB.actions.assistantSessions(100,taskId).then((result:any)=>{
            if(generation!==transcriptGeneration.current)return
            setSessions(result?.sessions||[])
            return loadTranscript(state.assistantSessionTarget||result?.assistantSessionId||undefined,taskId)
        }).catch((failure:any)=>{if(generation===transcriptGeneration.current){setResolving(false);setError(failure.message||'会话列表读取失败')}})
        return()=>{requestGeneration.current++;transcriptGeneration.current++;resolvedScope.current=null}
    },[open,scopeKey]);
    React.useEffect(function (): any {
        const node = bodyRef.current;
        if (node)
            node.scrollTop = node.scrollHeight;
    }, [messages, sending]);
    if (!open)
        return null;
    function switchSession(row:any):any {
        const task=state.data?.tasks?.find((task:any)=>task.id===row.taskId)
        WB.store.set((value:any)=>({assistantTaskId:row.taskId||null,assistantSessionTarget:row.id,assistantOpenSeq:(value.assistantOpenSeq||0)+1,assistantRefs:task?[{kind:'task',id:task.id,title:task.title,body:task.description||''}]:[]}))
    }
    function send(): any {
        const text = draft.trim();
        if (!text || resolving || !activeId || resolvedScope.current!==scopeKey || sending && !steerMode)
            return;
        setError(null);
        setDraft('');
        setSending(true);
        const generation = ++requestGeneration.current;
        transcriptGeneration.current+=1;
        setMessages(function (previous?: any): any {
            return previous.concat([{ role: 'user', text: text }]);
        });
        WB.actions
            .assistantSend(text, refs, activeId, steerMode, knowledgeMode, knowledgeScope, taskId)
            .then(function (result?: any): any {
            if (generation !== requestGeneration.current) return;
            setRetrieval(result?.retrieval||null);setCitationAudit(null);
            if (!result || result.status !== 'ok') {
                setSending(false);
                const note = (result && result.note) || ('状态：' + (result && result.status));
                setError(/resume failed|SessionPersistenceNotFound/i.test(note) ? '助手会话已失效，点右上「新会话」重开一个即可继续。' : note);
                return;
            }
            let cursor = Number(result.fromSeq) || 0;
            const sid = result.sessionId;
            if (sid && String(sid) !== String(activeId)) {
                setActiveId(String(sid));
                if (result.recovered) WB.toast('原助手会话已失效，已自动切换到新会话', 'info');
            }
            const startedAt = Date.now();
            function tick(): any {
                if (generation !== requestGeneration.current) return;
                WB.actions
                    .assistantDelta(sid, cursor, result.retrieval?.id, taskId)
                    .then(function (delta?: any): any {
                    if (generation !== requestGeneration.current) return;
                    if (delta && delta.status === 'ok') {
                        if(delta.citationAudit)setCitationAudit(delta.citationAudit);
                        cursor = Number(delta.nextSeq) || cursor;
                        const fresh = (delta.entries || []).filter(function (entry?: any): any {
                            return entry.role !== 'user';
                        });
                        if (fresh.length > 0) {
                            setMessages(function (previous?: any): any {
                                return previous.concat(fresh);
                            });
                        }
                        const timeout = Date.now() - startedAt > 180000;
                        // 增量区间可能没有 turn/start，也可能暂时没有新事件。
                        // 只在收到真实 turn/end 后结束，不能把空回包当成执行完成。
                        if (delta.turnEnded === true || timeout) {
                            setSending(false);
                            if (timeout)
                                setError('本轮超过 3 分钟仍未结束，可稍后在主面板查看。');
                            WB.actions.reload().catch(function (): any { });
                            WB.actions
                                .assistantSessions(100,taskId)
                                .then(function (next?: any): any {
                                if(generation===requestGeneration.current)setSessions((next && next.sessions) || []);
                            })
                                .catch(function (): any { });
                            return;
                        }
                        setTimeout(tick, 400);
                        return;
                    }
                    setSending(false);
                    setError((delta && delta.note) || '读取会话增量失败');
                })
                    .catch(function (failure?: any): any {
                    if (generation !== requestGeneration.current) return;
                    setSending(false);
                    setError(String((failure && failure.message) || failure));
                });
            }
            setTimeout(tick, 400);
        })
            .catch(function (failure?: any): any {
            if (generation !== requestGeneration.current) return;
            setSending(false);
            setError(String((failure && failure.message) || failure));
        });
    }
    function newSession(general=false):any {
        if(resolving)return
        if(activeId)drafts.current[activeId]=draft
        const generation=++requestGeneration.current;transcriptGeneration.current++;setSending(false);setResolving(true);setError(null)
        WB.actions.assistantReset(general?'':taskId).then(async(result:any)=>{
            if(generation!==requestGeneration.current)return
            if(result?.status!=='ok'||!result.sessionId)throw new Error(result?.note||'无法新建会话')
            if(general){WB.store.set((value:any)=>({page:'assistant',assistantTaskId:null,assistantRefs:[],assistantSessionTarget:result.sessionId,assistantOpenSeq:(value.assistantOpenSeq||0)+1}));return}
            await loadTranscript(result.sessionId,taskId)
            const next=await WB.actions.assistantSessions(100,taskId)
            if(generation===requestGeneration.current)setSessions(next?.sessions||[])
        }).catch((failure:any)=>{if(generation===requestGeneration.current){setResolving(false);setError(failure.message||'无法新建会话')}})
    }
    const activeSession=sessions.find((row:any)=>row.id===activeId),currentTask=state.data?.tasks?.find((task:any)=>task.id===taskId)
    const hasHistory = messages.length > 0;
    return h('aside', {
        className: 'wb-assistant',
        style: {
            flex: '0 0 ' + width + 'px',
            width: width,
            minWidth: 240,
            maxWidth: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            borderLeft: '1px solid ' + T.border1,
            background: T.layer1,
        },
    }, h('div', {
        role: 'separator',
        'aria-orientation': 'vertical',
        'aria-label': '拖动调整助手宽度',
        title: '拖动调整宽度',
        onMouseDown: startResize,
        style: { position: 'absolute', left: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 5 },
    }),
    /* ---- 会话切换与按需设置 ---- */
    h('div', {
        className:'wb-assistant-head',
        style: {
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 8px 7px 10px',
            borderBottom: '1px solid ' + T.border1,
            flex: 'none',
        },
    }, h(Btn,{size:'sm',icon:'messages','aria-label':historyCollapsed?'展开会话列表':'收起会话列表',onClick:()=>setHistoryCollapsed(!historyCollapsed),children:'会话'}),h('div',{className:'wb-assistant-current','aria-live':'polite'},h('strong',null,resolving?'正在恢复会话…':activeSession?.title||'AI 助手'),currentTask?h('small',null,currentTask.title):null), h('button',{ref:knowledgeButton,type:'button',className:'wb-iconbtn'+(knowledgeMode!=='auto'||knowledgeScope.projectId!==undefined||knowledgeScope.accountId!==undefined?' is-active':''),'aria-label':'知识设置','aria-haspopup':'dialog',title:'知识设置：'+(knowledgeMode==='only'?'仅知识库':knowledgeMode==='off'?'关闭':'自动检索'),onClick:()=>setKnowledgeOpen(true)},h(Icon,{name:'settings',size:15})), h(IconBtn, { name: 'plus', label: '新会话', disabled:resolving, onClick:()=>newSession() }), h(IconBtn, {
        name: 'external',
        label: '在主面板打开该会话',
        onClick: function (): any {
            const opened = activeId && WB.openSessionById
                ? WB.openSessionById(activeId)
                : WB.openConversation && WB.openConversation();
            if (!opened) WB.toast('当前宿主未提供会话导航，可从左侧会话列表打开该会话', 'warn');
        },
    }), state.page!=='assistant'?h(IconBtn, { name: 'close', label: '关闭助手', onClick: function (): any { WB.assistant.close(); } }):null),
    h('div',{className:'wb-assistant-chat-layout'},!historyCollapsed?h(AssistantSessionsNav,{sessions,activeId,disabled:resolving,onNew:()=>newSession(true),onSelect:(row:any)=>{switchSession(row);if(typeof window!=='undefined'&&window.innerWidth<640)setHistoryCollapsed(true)}}):null,h('div',{className:'wb-assistant-conversation','aria-busy':resolving},
    /* ---- 消息区 ---- */
    h('div', {
        ref: bodyRef,
        className:'wb-assistant-body',
        style: { flex: '1 1 auto', minHeight: 0, overflow: 'auto', padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 12 },
    }, resolving?h('div',{className:'wb-row wb-muted'},h(Spinner,{size:14}),'正在恢复会话…'):!hasHistory && !sending
        ? h('div', {
            style: {
                margin: 'auto 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                padding: '8px 4px 14px',
                textAlign: 'center',
            },
        }, h('div', {
            style: {
                display: 'grid',
                placeItems: 'center',
                width: 46,
                height: 46,
                borderRadius: 14,
                background: 'color-mix(in srgb, ' + T.accent + ' 14%, transparent)',
                color: T.accent,
            },
        }, h(Icon, { name: 'sparkles', size: 22 })), h('div', { style: { display: 'flex', flexDirection: 'column', gap: 3 } }, h('strong', { style: { fontSize: 13.5, color: T.text } }, '想让我做点什么？'), h('span', { className: 'wb-tiny wb-muted', style: { lineHeight: 1.6 } }, '我能读写工作台里的待办、资讯与知识')), h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 268 } }, ['今天还有哪些没做完？帮我把逾期的排一下', '把这条消息整理成待办，截止放到明天', '这些资讯里哪条和限流有关？'].map(function (prompt?: any): any {
            return h('button', {
                key: prompt,
                type: 'button',
                className: 'wb-assistant-suggest',
                onClick: function (): any {
                    setDraft(prompt);
                },
            }, h(Icon, { name: 'arrowRight', size: 11 }), h('span', null, prompt));
        })))
        : (function (): any {
            // 把连续的工具调用/结果/错误事件折叠成一条「调用了 N 个工具」，避免中间出现大量白块
            const groups: any = [];
            messages.forEach(function (message?: any): any {
                const isService = message.role === 'tool' || message.role === 'toolResult' || message.role === 'error';
                const last = groups[groups.length - 1];
                if (isService) {
                    if (last && last.kind === 'service') {
                        last.items.push(message);
                    }
                    else {
                        groups.push({ kind: 'service', items: [message] });
                    }
                    return;
                }
                groups.push({ kind: 'message', item: message });
            });
            return groups.map(function (group?: any, groupIndex?: any): any {
                if (group.kind === 'service') {
                    const toolNames: any = [];
                    group.items.forEach(function (item?: any): any {
                        if (item.role === 'tool' && toolNames.indexOf(item.text) < 0)
                            toolNames.push(item.text);
                    });
                    const failed = group.items.some(function (item?: any): any {
                        return item.role === 'error' || (item.role === 'toolResult' && item.ok === false);
                    });
                    const detail = group.items
                        .map(function (item?: any): any {
                        const label = item.role === 'tool' ? item.text : item.role === 'toolResult' ? item.text + ' → ' + (item.ok === false ? '失败' : '完成') : String(item.text || '');
                        return label + (item.summary ? '(' + String(item.summary) + ')' : '');
                    })
                        .join('\n');
                    return h('div', {
                        key: 'g' + groupIndex,
                        title: detail,
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 11,
                            color: T.text2,
                            padding: '4px 10px',
                            border: '1px dashed ' + T.border2,
                            borderRadius: 9,
                            opacity: 0.85,
                        },
                    }, h(Icon, { name: 'command', size: 11 }), h('span', null, failed ? '调用了 ' + toolNames.length + ' 个工具（含失败）' : '调用了 ' + toolNames.length + ' 个工具'), h('span', { className: 'wb-mono wb-ellipsis', style: { opacity: 0.8, flex: '1 1 auto', minWidth: 0 } }, WB.util.truncate(toolNames.join(' · '), 60)));
                }
                const message = group.item;
                const index = messages.indexOf(message);
                const mine = message.role === 'user';
                const markdown = !mine;
                return h('div', { key: 'm' + index, className:'wb-assistant-message', style: { display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' } }, h('div', {
                    style: {
                        maxWidth: '94%',
                        padding: '8px 10px',
                        borderRadius: 10,
                        fontSize: 12,
                        lineHeight: 1.7,
                        overflowWrap: 'anywhere',
                        background: mine ? 'color-mix(in srgb, '+T.text+' 6%, '+T.layer1+')' : T.layer1,
                        color: T.text,
                        border: '1px solid '+T.border1,
                    },
                }, markdown && typeof mdParse === 'function'
                    ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } }, mdParse(message.text || '').slice(0, 40).map(function (block?: any, blockIndex?: any): any {
                        const key = 'b' + index + '-' + blockIndex;
                        if (block.type === 'heading') {
                            return h('div', { key: key, style: { fontWeight: 600, margin: '6px 0 2px' } }, mdInline(block.text, key));
                        }
                        if (block.type === 'code') {
                            return h('pre', { key: key, className: 'wb-code', style: { margin: '4px 0' } }, block.text);
                        }
                        if (block.type === 'list') {
                            return h(block.ordered ? 'ol' : 'ul', { key: key, style: { margin: '2px 0', paddingLeft: 18 } }, block.items.map(function (item?: any, itemIndex?: any): any {
                                return h('li', { key: key + '-' + itemIndex }, mdInline(item, key + '-' + itemIndex));
                            }));
                        }
                        if (block.type === 'hr')
                            return h('hr', { key: key, className: 'wb-divider', style: { margin: '6px 0' } });
                        if (block.type === 'quote') {
                            return h('div', { key: key, style: { borderLeft: '2px solid ' + T.border2, paddingLeft: 8, color: T.text2 } }, mdInline(block.text, key));
                        }
                        return h('div', { key: key, style: { whiteSpace: 'pre-wrap' } }, mdInline(block.text || '', key));
                    }))
                    : h('div', { style: { whiteSpace: 'pre-wrap' } }, message.text), message.toolCalls && message.toolCalls.length > 0
                    ? h('div', { style: { marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 } }, message.toolCalls.map(function (tool?: any, toolIndex?: any): any {
                        const name = typeof tool === 'string' ? tool : tool.name;
                        return h(Chip, { key: 't' + toolIndex, icon: 'command', title: (tool && tool.summary) || name, children: name });
                    }))
                    : null));
            });
        })(), h(KnowledgeSources,{result:retrieval,audit:citationAudit,provided:true,compact:true}), sending ? h('div', { className: 'wb-row wb-tiny wb-muted', style: { gap: 6 } }, h(Spinner, { size: 12 }), h('span', null, '思考中…')) : null, error ? h('div', { role: 'alert', className: 'wb-tiny', style: { color: T.err, lineHeight: 1.6 } }, error) : null),
    /* ---- 输入区 ---- */
    h('div', { className: 'wb-assistant-composer' }, h('div',{className:'wb-assistant-input'}, refs.length > 0
        ? h('div', { className: 'wb-assistant-contexts', tabIndex: 0, role: 'region', 'aria-label': '已选择的上下文', style: { display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' } }, refs.map(function (ref?: any): any {
            return h(Chip, {
                key: ref.kind + ':' + ref.id,
                active: true,
                title: ref.title,
                children: WB.util.truncate(ref.title || ref.id, 14),
                onRemove: function (): any {
                    WB.assistant.remove(ref.kind, ref.id);
                },
            });
        }))
        : null, h(Textarea, {
        value: draft,
        disabled: resolving,
        rows: 3,
        'aria-label':'助手消息',
        placeholder: '输入指令，或让我帮你整理待办…',
        onChange: function (event?: any): any {
            setDraft(event.target.value);
        },
        onKeyDown: function (event?: any): any {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
            }
        },
    }), h('div', { className: 'wb-row wb-assistant-input-actions', style: { gap: 6 } }, h(AssistantContextPicker,{data:state.data,refs,compact:true}), h(Chip, {
        active: steerMode,
        onClick: function (): any {
            setSteerMode(!steerMode);
        },
        title: steerMode ? '打断当前轮并立即处理' : '排队等当前轮结束再处理',
        children: steerMode ? '打断' : '排队',
    }), h('div',{className:'wb-spacer'}), h('span',{title:'Enter 发送 / Shift+Enter 换行'},h(IconBtn, {
        name: 'arrowRight',
        label: sending && !steerMode ? '正在执行' : steerMode ? '打断并发送' : '发送',
        disabled: resolving || !activeId || sending && !steerMode || !draft.trim(),
        active: (!sending || steerMode) && !!draft.trim(),
        onClick: send,
    }))))))), h(AssistantKnowledgeSettings,{open:knowledgeOpen,onClose:closeKnowledge,data:state.data,mode:knowledgeMode,onMode:setKnowledgeMode,scope:knowledgeScope,onScope:setKnowledgeScope}));
}
/* --------------------------------------------------------------- error gate */ /* --------------------------------------------------------------- error gate */ /* --------------------------------------------------------------- error gate */
function LoadingScreen(): any {
    return h('div', {
        style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: T.text2,
            fontSize: 12,
        },
    }, h(Spinner, { size: 18 }), h('span', null, '正在读取工作台数据…'));
}
function ErrorScreen(props?: any): any {
    return h('div', { style: { padding: 28, maxWidth: 620 } }, h(Panel, {
        title: '无法读取工作台数据',
        icon: 'alert',
        sub: 'Host 端的 workbench 服务没有返回数据。',
        actions: h(Btn, { icon: 'refresh', onClick: props.onRetry, kind: 'primary', size: 'sm', children: '重试' }),
    }, h('div', { className: 'wb-stack' }, h('pre', { className: 'wb-code' }, String(props.error || '未知错误')), h('p', { className: 'wb-hint', style: { margin: 0 } }, '排查顺序：确认插件已在“设置 → 插件”中启用 → 查看 Host 日志中的 workbench 行 → 重新安装 bundle。'))));
}
/* ---------------------------------------------------------------- nav rail */
function NavRail(props?: any): any { return h(TopNavigation, props); }
/* ----------------------------------------------------------------- toolbar */
function Toolbar(props?: any): any {
    const state = useStore();
    const counts = WB.taskCounts(props.data);
    return h('div', { className: 'wb-toolbar' }, h('div', { className: 'wb-toolbar-brand' }, h(WorkbenchIcon, { size: 18 }), '智能工作台'), h('div', { className: 'wb-spacer' }), state.taskForm && state.contextHidden ? h(Btn,{size:'sm',onClick:()=>WB.store.set({contextHidden:false,assistantOpen:false}),children:'继续编辑'}) : null, counts.overdue > 0
        ? h('button', {
            type: 'button',
            className: 'wb-chip',
            onClick: function (): any {
                WB.go('tasks');
            },
            title: '查看逾期任务',
            style: { color: T.err, borderColor: 'color-mix(in srgb, ' + T.err + ' 45%, transparent)' },
        }, h(Icon, { name: 'alert', size: 12 }), counts.overdue + ' 项逾期')
        : null, h(IconBtn,{name:'search',label:'搜索工作内容（⌘K / Ctrl+K）',active:state.searchOpen,onClick:()=>WB.openSearch()}), h(Btn, {
        icon: 'plus',
        size: 'sm',
        kind: 'primary',
        onClick: function (): any { WB.openTaskForm(null); },
        children: '新建待办',
    }), h(WorkspaceRefresh,{scope:'all',iconOnly:true}), h(IconBtn, {
        name: 'sparkles',
        label: '工作台助手（携带上下文进入会话）',
        active: !!props.assistantOpen,
        onClick: function (): any {
            WB.assistant.toggle();
        },
    }), h(IconBtn, {
        name: 'settings',
        label: '连接与设置',
        active: props.page === 'settings',
        onClick: function (): any {
            WB.go('settings');
        },
    }));
}
/* --------------------------------------------------------------- page frame */
function MissingPage(props?: any): any {
    return h('div', { className: 'wb-page' }, h(Empty, {
        icon: 'layers',
        title: '页面 “' + props.page + '” 还没有注册',
        hint: '对应模块未随本次构建一起生成；其余页面不受影响。',
    }));
}
function WorkbenchApp(): any {
    const [webAIVisited,setWebAIVisited]=React.useState(false);
    const state = useStore();
    React.useEffect(function (): any {
        if (!WB.store.get().data)
            WB.actions.reload().catch(function (): any { });
    }, []);
    // TODO 08：修订号轮询，后台/聊天改动几秒内自动体现；正在填表单时跳过
    React.useEffect(function (): any {
        const sync = ()=>{if(document.visibilityState!=='hidden')WB.actions.syncCheck().catch(function (): any { });};
        const timer = setInterval(function (): any {
            sync();
        }, 12000);
        const onVisible=()=>{if(document.visibilityState!=='hidden')sync()};
        window.addEventListener('focus',sync);
        document.addEventListener?.('visibilitychange',onVisible);
        sync();
        return function (): any {
            clearInterval(timer);
            window.removeEventListener('focus',sync);
            document.removeEventListener?.('visibilitychange',onVisible);
        };
    }, []);
    React.useEffect(function (): any {
        function onKey(event?: any): any {
            const meta = event.metaKey || event.ctrlKey;
            if (!meta)
                return;
            const key = event.key.toLowerCase();
            if (key === 'k') {
                event.preventDefault();
                if(WB.store.get().searchOpen)WB.closeSearch();else WB.openSearch();
                return;
            }
            const navigation=WB.ORDER.filter((id:string)=>id!=='search');
            if (key >= '1' && key <= '9') {
                const index = Number(key) - 1;
                const page = navigation[index];
                if (page) {
                    event.preventDefault();
                    WB.go(page);
                }
            }
        }
        window.addEventListener('keydown', onKey);
        return function (): any {
            window.removeEventListener('keydown', onKey);
        };
    }, []);
    const page = state.page;
    const Page = WB.pages[page];
    React.useEffect(()=>{if(page==='assistant'&&!state.assistantOpen&&!state.taskForm?.open)WB.assistant.open()},[page,state.assistantOpen,state.taskForm?.open]);
    const loading = state.status === 'loading' && !state.data;
    const failed = state.status === 'error' && !state.data;
    const WebAIPage = WB.pages['web-ai'];
    React.useEffect(()=>{if(page==='web-ai')setWebAIVisited(true)},[page]);
    return h('div', {className:'wb-root'+(page==='web-ai'?' is-web-ai':'')},
      h('style',null,WB_CSS+WB_LAYOUT_CSS),
      h('header',{className:'wb-head'},h(Toolbar,{data:state.data,page,assistantOpen:state.assistantOpen}),h(TopNavigation,{page,data:state.data})),
      h('div',{className:'wb-workarea'+(page==='assistant'?' wb-assistant-page':'')+(state.assistantOpen||state.taskForm&&state.taskForm.presentation!=='modal'&&!state.contextHidden?' is-context-open':'')},
        h('div',{className:'wb-main'},h('div',{className:'wb-scroll'},
          page!=='web-ai'&&page!=='assistant'?h('div',{key:'business-page',className:'wb-page'},loading?h(LoadingScreen):failed?h(ErrorScreen,{error:state.error,onRetry:()=>WB.actions.reload().catch(()=>{})}):Page?h(Page):h(MissingPage,{page})):null,
          (webAIVisited||page==='web-ai')&&WebAIPage?h('div',{key:'web-ai-surface',className:'wb-page wb-chat-page',hidden:page!=='web-ai'},h(WebAIPage)):null)),
        h(AssistantHubEntry,{Legacy:AssistantDrawer}),h(TaskFormHost,{embedded:true})),
      WB.Palette?h(WB.Palette,{open:state.searchOpen,initialQuery:state.searchInitialQuery,onClose:()=>WB.closeSearch()}):null,h(SearchResultPreview),h(AnalysisMonitor),h(WorkspaceRefreshMonitor),h(Toaster));
}
/* -------------------------------------------------------------------- apply */
WB.apply = function apply(ctx?: any): any {
    ctx.effect(()=>installAssistantNative(WB,ctx));
    if (ctx.connection)
        setShared_wbConnection(ctx.connection);
    if (typeof WB.setLayout === 'function') {
        WB.setLayout(ctx.get ? ctx.get('layout') : ctx.layout);
    }
    WB.setNativeSessions((ctx.get ? ctx.get('sessions') : null) || ctx.sessions);
    if (typeof WB.setUiWorkspace === 'function') {
        WB.setUiWorkspace(ctx.get ? ctx.get('uiWorkspace') : ctx.uiWorkspace);
    }
    const locale = ctx.get ? ctx.get('locale') : ctx.locale;
    if (locale && typeof locale.register === 'function') {
        ctx.effect(function (): any {
            const disposers: any = [];
            ['zh', 'en'].forEach(function (language?: any): any {
                try {
                    disposers.push(locale.register('dev-workbench', language, WB_DICT.zh));
                }
                catch (e) {
                    /* a duplicate namespace owner is not fatal: literals still render */
                }
            });
            try {
                setShared_wbTranslate(locale.bind('dev-workbench'));
            }
            catch (e) {
                /* keep the identity translator */
            }
            return function (): any {
                disposers.forEach(function (dispose?: any): any {
                    try {
                        dispose();
                    }
                    catch (e) {
                        /* already gone */
                    }
                });
            };
        });
    }
    ctx.effect(function (): any {
        const disposers: any = [];
        disposers.push(ctx.slots.inject('main', function (): any {
            return ctx.slots.register({ name: 'main', key: WB.PANEL_KEY }, WorkbenchApp);
        }));
        if (typeof WB.registerChatEmbed === 'function') {
            try {
                disposers.push(WB.registerChatEmbed(ctx));
            }
            catch (e) {
                /* 原生聊天内嵌是增强项，失败不影响工作台 */
            }
        }
        disposers.push(ctx.slots.inject('sidebar.panellist', function (): any {
            return ctx.slots.register({
                name: 'sidebar.panellist',
                id: WB.PANEL_KEY,
                order: 30,
                label: function (): any {
                    return WB.t('app.title', '智能工作台');
                },
            }, WorkbenchIcon);
        }));
        return function (): any {
            disposers.forEach(function (dispose?: any): any {
                try {
                    dispose();
                }
                catch (e) {
                    /* already disposed by the slot owner */
                }
            });
        };
    });
};

export { WorkbenchIcon, Toaster, ASSISTANT_KIND_LABEL, AssistantDrawer, LoadingScreen, ErrorScreen, NavRail, Toolbar, MissingPage, WorkbenchApp }
