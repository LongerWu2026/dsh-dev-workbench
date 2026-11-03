import {NewsBrief} from '../news/NewsBrief.js'
import {WorkspaceRefresh} from '../../components/WorkspaceRefresh.js'
import {RemindersPanel} from '../operations/RemindersPanel.js'
import {BriefAgenda} from './BriefAgenda.js'
import {FocusedInbox} from '../inbox/FocusedInbox.js'
import { NewsFetchStatus } from '../news/NewsFetchStatus.js'
import { radarFetchOutcome } from '../../../shared/news-fetch.js'
import {MessageSelectionBadges} from '../../components/MessageSelectionBadges.js'
import { messageOrigin, messageSender, messageSentTime } from '../../../shared/message-display.js'
import * as React from 'react'
import { Badge, Btn, Chip, Empty, Icon, IconBtn, PageHead, Panel, Spinner, T, WB, h } from '../../core/runtime.js'
import { dashActionable, dashOpenTasks, dashAddedToday, dashDueValue, dashEarliestOverdue, dashEndOfToday, dashPriorityOf, dashProjectName, dashStaleInfo, dashStoreNavigate, dashTagPill, dashToneColor, replyStageTone } from './selectors.js'
import { isIgnoredNews, newsPriority } from '../../../shared/news.js'
import { DashRadarMenu, DashRadarModal, DashRadarRow, dashRadarTimeValue, dashSummaryParts } from '../news/news-presentation.js'
import { SyncStatus } from '../../components/SyncStatus.js'
import { DashTaskRow } from './task-preview.js'
import { CompactEmptyState } from '../../components/CompactEmptyState.js'
import { dashBriefMarkdown } from './brief-export.js'
import { DashConnectorCard, dashConnectorIcon } from './connector-card.js'
import { DashEmptyIllustration, DashEmptyStep } from './empty-state.js'

function DashboardPage(): any {
    const state = WB.useStore();
    const data = state.data;
    const [radarAll, setRadarAll] = React.useState<any>(false);
    const [radarShowAll, setRadarShowAll] = React.useState<any>(false);
    const [radarExpanded, setRadarExpanded] = React.useState<any>(null);
    const [radarFormOpen, setRadarFormOpen] = React.useState<any>(false);
    const [radarEditItem, setRadarEditItem] = React.useState<any>(null);
    const [radarFetching, setRadarFetching] = React.useState<any>(false);
    const [mentionsBusy, setMentionsBusy] = React.useState<any>(false);
    const [reminderToolsOpen,setReminderToolsOpen]=React.useState(false);
    const [taskScope,setTaskScope]=React.useState('today');
    const [allTasksShown,setAllTasksShown]=React.useState(false);
    const [taskClock,setTaskClock]=React.useState(Date.now);
    const taskColumn=React.useRef<HTMLDivElement>(null),[inlineTaskFilters,setInlineTaskFilters]=React.useState(false);
    React.useLayoutEffect(()=>{
        const column=taskColumn.current;if(!column)return;
        const measure=()=>setInlineTaskFilters(column.clientWidth>=500);measure();
        const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;observer?.observe(column);
        window.addEventListener('resize',measure);
        return()=>{observer?.disconnect();window.removeEventListener('resize',measure)};
    },[!!data]);
    React.useEffect(()=>{
        const tick=()=>{if(document.visibilityState!=='hidden')setTaskClock(Date.now())};
        const timer=setInterval(tick,60000);
        window.addEventListener('focus',tick);document.addEventListener?.('visibilitychange',tick);
        return ()=>{clearInterval(timer);window.removeEventListener('focus',tick);document.removeEventListener?.('visibilitychange',tick)};
    },[]);
    // TODO 22：AI 识别状态一块看全（待确认/失败/计数），上轮摘要状态也在这里
    const [analysis, setAnalysis] = React.useState<any>(null);
    React.useEffect(function (): any {
        let active = true;
        WB.actions
            .analysisStatus()
            .then(function (status?: any): any {
            if (active) setAnalysis(status);
        })
            .catch(function (): any { });
        return ()=>{active=false};
    }, [data?.revision]);
    if (!data) {
        return h('div', { className: 'wb-page' }, h('div', { className: 'wb-row', style: { gap: 9, color: T.text2, padding: '10px 0' } }, h(Spinner, { size: 16 }), h('span', null, '正在读取今日简报…')));
    }
    const tasks = Array.isArray(data.tasks) ? data.tasks.filter((row:any)=>!row.archivedAt) : [];
    const taskData={...data,tasks:tasks.filter((t:any)=>t.eventType!=='meeting')};
    const counts = WB.taskCounts({...data,tasks});
    counts.overdue=tasks.filter((t:any)=>!['completed','cancelled'].includes(t.status)&&dashDueValue(t)<taskClock).length;
    counts.today=tasks.filter((t:any)=>!['completed','cancelled'].includes(t.status)&&dashDueValue(t)>=taskClock&&dashDueValue(t)<=dashEndOfToday(taskClock)).length;
    const openTasks=dashOpenTasks(taskData).slice().sort((a:any,b:any)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0));
    const actionableAll = dashActionable(taskData,taskClock);
    const taskSelection=taskScope==='all'?openTasks:actionableAll;
    const shownTasks=allTasksShown?taskSelection:taskSelection.slice(0,8);
    const settings = data.settings || {};
    const topics = Array.isArray(settings.topics) ? settings.topics : [];
    const radarItems = Array.isArray(data.radar) ? data.radar : [];
    const connectors = Array.isArray(data.connectors) ? data.connectors : [];
    const stale = dashStaleInfo(data);
    const overdueSince = dashEarliestOverdue(data);
    const topicKeys = topics.map(function (topic?: any): any {
        return String(topic).toLowerCase();
    });
    const radarRestricted = !radarAll && topicKeys.length > 0;
    const radarSorted = radarItems.filter((item:any)=>!isIgnoredNews(item) && !/^(what is|introduction to|beginner.{0,10}guide)|入门教程|基础教程/i.test(item.title||''))
        .filter(function (item?: any): any {
        if (!radarRestricted || (item.topics||[]).some((topic:string)=>['AI','GitHub'].includes(topic)))
            return true;
        const itemTopics = Array.isArray(item.topics) ? item.topics : [];
        return itemTopics.some(function (topic?: any): any {
            return topicKeys.indexOf(String(topic).toLowerCase()) >= 0;
        });
    })
        .slice()
        .sort(function (a?: any, b?: any): any {
        const priority=newsPriority(b)-newsPriority(a);if(priority)return priority;
        const diff = dashRadarTimeValue(b) - dashRadarTimeValue(a);
        if (diff !== 0)
            return diff;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    const radarVisible = radarSorted.slice(0, 3);
    function goTasks(preset?: any): any {
        dashStoreNavigate({typeFilter:'all',...preset});
    }
    const lastMentions = data && data.lastMentionsFetch ? data.lastMentionsFetch : null;
    const newMentions = lastMentions && lastMentions.added > 0
        ? (data.sources || []).filter(function (row?: any): any {
            return row.provider === 'yunzhijia';
        }).slice(-lastMentions.added)
        : [];
    function runMentionsFetch(): any {
        if (mentionsBusy)
            return;
        setMentionsBusy(true);
        WB.actions
            .fetchMentions()
            .then(function (): any {
            setMentionsBusy(false);
        })
            .catch(function (): any {
            setMentionsBusy(false);
        });
    }
    const mentionsStrip = h(SyncStatus, { report: lastMentions, busy: mentionsBusy, onRetry: runMentionsFetch });
    const taskFilters=tasks.length>0?h('div',{className:'wb-brief-task-filters','aria-label':'待办范围'},
        h(Chip,{active:taskScope==='today',onClick:()=>{setTaskScope('today');setAllTasksShown(false)},children:'今日关注 '+actionableAll.length}),
        h(Chip,{active:taskScope==='all',onClick:()=>{setTaskScope('all');setAllTasksShown(false)},children:'全部未完成 '+openTasks.length})):null;
    const taskPanel = h(Panel, {
        className:'wb-brief-action-panel wb-brief-task-panel',
        headerExtra:inlineTaskFilters?taskFilters:null,
        icon: 'checkCircle',
        title: '待办',
        // 完全没有任务时隐藏副标题，空态保持干净（与右侧一致）
        sub: null,
        badge: taskSelection.length > 0 ? h(Badge, { tone: 'accent' }, String(taskSelection.length)) : null,
        actions: h('div',{className:'wb-row wb-row--wrap',style:{gap:6}},h(WorkspaceRefresh,{scope:'tasks'}),h(Btn, {size:'sm',kind:'subtle',onClick:()=>WB.go('tasks'),children:'任务中心'})),
        flush: true,
    }, !inlineTaskFilters&&taskFilters?h('div',{className:'wb-brief-task-filters-body'},taskFilters):null,shownTasks.length > 0
        ? h('div', { className: 'wb-list', style: { padding: '0 16px' } }, shownTasks.map((task:any)=>h('article',{key:task.id,style:{borderBottom:'1px solid '+T.border1}},h(DashTaskRow,{task,data}))))
        : tasks.length===0?h(CompactEmptyState, {empty:true,onCreate:()=>WB.openTaskForm(null),onBrowse:()=>WB.go('tasks')}):h('div',{className:'wb-stack',style:{padding:16,gap:8}},h('strong',null,taskScope==='all'?'没有未完成待办':'当前没有今日关注事项'),h('span',{className:'wb-tiny wb-muted'},'今日关注包含今日新增、逾期、今日到期和高优先级事项。'),taskScope!=='all'?h(Btn,{size:'sm',onClick:()=>{setTaskScope('all');setAllTasksShown(false)},children:'显示全部未完成'}):null), taskSelection.length > 8
        ? h('div', {
            style: {
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 16px',
                borderTop: '1px solid ' + T.border1,
            },
        }, h('span', { className: 'wb-tiny wb-muted' }, '已展示 '+shownTasks.length+' / '+taskSelection.length+' 条'), h('div', { className: 'wb-spacer' }), h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'arrowRight',
            onClick: function (): any {
                setAllTasksShown(!allTasksShown);
            },
            children: allTasksShown?'收起列表':'展开其余 '+(taskSelection.length-shownTasks.length)+' 条',
        }))
        : null);
    const lastFetch = data && data.lastRadarFetch ? data.lastRadarFetch : null;
    const feeds = (data && data.settings && data.settings.feeds) || [];
    const staleLimitMs = ((data && data.settings && data.settings.staleHours) || 24) * 3600 * 1000;
    const fetchStale = !lastFetch || (lastFetch.at && Date.now() - new Date(lastFetch.at).getTime() > staleLimitMs);
    function runRadarFetch(): any {
        if (radarFetching)
            return;
        setRadarFetching(true);
        WB.actions
            .fetchRadar()
            .then(function (): any {
            setRadarFetching(false);
        })
            .catch(function (): any {
            setRadarFetching(false);
        });
    }
    const radarEmpty = radarItems.length === 0;
    const radarStatusBase = lastFetch && lastFetch.at
        ? '上次抓取 ' + WB.fmt.relative(lastFetch.at) + ' · 新增 ' + (lastFetch.added || 0)
        : '还没有抓取过';
    // TODO 22：上轮摘要统计与失败原因一并展示（不隐藏失败）
    const lastSum = data && data.lastRadarSummarize ? data.lastRadarSummarize : null;
    const radarStatus = radarStatusBase;
    const radarPanel = h(Panel, {className:'wb-radar-panel',
        icon: 'radar',
        title: 'AI 动态',
        // 副标题承担全部状态信息（关注主题 + 抓取时间），不再塞进标题旁的徽章
        sub: radarEmpty
            ? null
            : '模型发布、技术实践与开源动态',
        badge: radarEmpty
            ? h(Badge, { tone: lastFetch && radarFetchOutcome(lastFetch).status === 'error' ? 'err' : 'idle' }, lastFetch ? radarFetchOutcome(lastFetch).status === 'error' ? '获取失败' : '暂无新增' : '尚未抓取')
            : lastFetch && lastFetch.at && fetchStale
                ? h(Badge, { tone: 'warn' }, '数据可能过期')
                : null,
        actions: h(React.Fragment, null, h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'refresh',
            disabled: radarFetching,
            onClick: runRadarFetch,
            title:'更新官方动态、订阅源与关注主题搜索',
            children: radarFetching ? '抓取中…' : '抓取资讯',
        }), h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'plus',
            onClick: function (): any {
                setRadarEditItem(null);
                setRadarFormOpen(true);
            },
            children: '添加资讯',
        })),
        flush: true,
    },
    // 「仅看关注主题」筛选从头部移到内容区：过滤属于内容操作，不再占用标题行
    h('div',{style:{padding:'0 16px'}},h(NewsBrief,{data,compact:true})),
    lastFetch ? h('div', {style:{padding:'0 16px'}}, h(NewsFetchStatus, {report:lastFetch})) : null,
    radarSorted.length > 0
        ? h('div', {
            style: {
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 16px',
                borderTop: '1px solid ' + T.border1,
            },
        }, h('span', { className: 'wb-tiny wb-muted' }, '更多内容在资讯页查看'), h('div', { className: 'wb-spacer' }), h(Btn, {
            size: 'sm',
            kind: 'subtle',
            onClick: function (): any {
                WB.go('radar');
            },
            children: '全部资讯',
        }))
        : null);
    // ---- 待回复面板（TODO 16 平行实体）：读 state.replies，与待办（处理义务）平行
    const replies = (data && data.replies) || [];
    const replyOpen = replies
        .filter(function (reply?: any): any {
        return !reply.archivedAt && (reply.stage === '待回复' || reply.stage === '已确认收到' || reply.stage === '已自动回复');
    })
        .sort(function (left?: any, right?: any): any {
        return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
    });
    const replyStageTone = function (stage?: any): any {
        if (stage === '已回复')
            return 'ok';
        return 'warn';
    };
    const replyPanel = h(Panel, {
        className: 'wb-panel--separated wb-brief-action-panel',
        icon: 'reply',
        title: '待回复',
        sub: null,
        badge: replyOpen.length > 0
            ? h(Badge, { tone: 'warn' }, String(replyOpen.length))
            : replies.length > 0
                ? h(Badge, { tone: 'ok' }, '已清')
                : null,
        actions: h('div',{className:'wb-row wb-row--wrap',style:{gap:6}},h(WorkspaceRefresh,{scope:'replies'}),h(Btn, {
            size: 'sm',
            kind: 'subtle',
            onClick: function (): any {
                WB.go('replies');
            },
            children: '查看全部回复',
        })),
    }, replies.length === 0
        ? h('div', { className: 'wb-tiny wb-muted', style: {padding:'4px 0',lineHeight:1.6} }, '没有待回复的沟通。AI 识别的回复义务在此跟踪，与待办独立处理。')
        : h('div', { className: 'wb-list' }, replyOpen.slice(0, 6).map(function (reply?: any): any {
            const source = (data.sources || []).find((source:any) => source.id === reply.sourceId);
            return h('div', { key: reply.id, className: 'wb-item','data-reply-id':reply.id }, h('button', { type:'button', className: 'wb-item-main wb-brief-reply-link', title:'在待回复页查看这条消息', 'aria-label':'查看待回复：'+messageSender(source || {locator:{groupId:reply.groupId}}, reply.contact)+'：'+(reply.snippet||'').slice(0,50), onClick:()=>WB.openReply(reply.id), style:{padding:0,border:0,background:'transparent',color:'inherit',font:'inherit',textAlign:'left',cursor:'pointer'} }, h('span', { className: 'wb-item-title', style: { display: 'flex', gap: 6, alignItems: 'center' } }, messageSender(source || {locator:{groupId:reply.groupId}}, reply.contact), h(MessageSelectionBadges,{source,inbox:data.messageInbox}), h(Badge, { tone: replyStageTone(reply.stage) }, reply.stage), reply.triage==='pending'?h(Badge,{tone:'idle'},'待AI识别'):null, reply.taskIds && reply.taskIds.length > 0 ? h(Badge, { tone: 'idle' }, '关联待办 ' + reply.taskIds.length) : null), h('span', { className: 'wb-item-sub', style:{overflowWrap:'anywhere',whiteSpace:'normal'} }, '来自：' + messageOrigin(source, reply)), h('span', { className: 'wb-item-sub wb-clamp2 wb-brief-reply-content' }, reply.snippet || ''), h('span', { className: 'wb-tiny wb-muted',style:{display:'block'} }, '发出时间：' + messageSentTime(source))), h('div', { className: 'wb-row', style: { gap: 5, flex: 'none' } }, [
                { id: '已回复', label: '标记已回复', hint: '确认本人已给出答复，结束这条待回复；此按钮不会发送消息' },
                { id: '不需回复', label: '无需回复', hint: '已查阅且无需本人回复：仅结束本条提醒，不发送消息，不改变云之家未读状态' },
            ].map(function (chip?: any): any {
                return h(Chip, {
                    key: chip.id,
                    title: chip.hint,
                    onClick: function (): any {
                        WB.actions.setReplyStage(reply.id, chip.id).catch(function (): any { });
                    },
                    children: chip.label || chip.id,
                });
            })));
        })));
    const analysisPanel = (analysis && (analysis.pending || analysis.awaitingHuman || analysis.failed || analysis.done || analysis.skipped || analysis.historical))
        ? h(Panel, {
            icon: 'sparkles',
            title: 'AI 识别',
            sub: analysis?.modelHealth?.note || (analysis?.lastBatch ? '最近一批：'+analysis.lastBatch.inputCount+' 条消息 · '+analysis.lastBatch.modelCalls+' 次模型请求 · '+(analysis.lastBatch.reusedBatches ? '复用规则' : '初始化规则')+'；失败逐条保留' : '同账号复用会话、批量识别；失败逐条保留重试'),
            badge: analysis
                ? h(Badge, { tone: analysis.awaitingHuman > 0 ? 'warn' : analysis.failed > 0 ? 'err' : 'ok' }, '待识别 ' + analysis.pending + ' · 待确认 ' + analysis.awaitingHuman + ' · 失败 ' + analysis.failed + ' · 完成 ' + analysis.done + ((analysis.skipped || analysis.historical) ? ' · 已跳过 '+(analysis.skipped || analysis.historical) : ''))
                : null,
            actions: h(Btn, {
                size: 'sm',
                kind: 'subtle',
                icon: 'play',
                disabled: (data.jobs || []).some((job:any)=>job.kind==='analysis'&&job.input?.continuous&&['queued','running'].includes(job.status)),
                onClick: function (): any {
                    WB.actions
                        .analyzeRun()
                        .then(function (result?: any): any {
                        return WB.actions.analysisStatus();
                    })
                        .then(function (status?: any): any {
                        setAnalysis(status);
                    })
                        .catch(function (): any { });
                },
                children: '运行分析',
            }),
        }, (analysis.awaitingHuman > 0 || analysis.failed > 0)
            ? h('div', { className: 'wb-stack', style: { gap: 8 } }, (analysis.entries || [])
                .filter(function (entry?: any): any {
                return entry.status === 'awaiting_human' || entry.status === 'failed';
            })
                .slice(0, 6)
                .map(function (entry?: any): any {
                const sourceRow = (data.sources || []).find(function (row?: any): any { return row.id === entry.sourceId; });
                const canConfirm=entry.status==='awaiting_human'&&entry.analysis&&entry.reviewKind!=='recognition';
                return h('div', { key: entry.id, className: 'wb-item' }, h(Badge, { tone: entry.status === 'failed' ? 'err' : 'warn' }, entry.status === 'failed' ? '失败' : '待确认'), h('div', { className: 'wb-item-main' }, h('div', { className: 'wb-item-title wb-ellipsis' }, WB.util.truncate((sourceRow && sourceRow.excerpt) || entry.msgId || entry.sourceId, 46)), entry.status === 'failed'
                    ? h('div', { className: 'wb-item-sub' }, '已失败 ' + (entry.attempts || 0) + ' 次' + ((entry.attempts || 0) >= 3 ? ' · 需手动重试' : '') + (entry.lastError ? ' · ' + entry.lastError : ''))
                    : h('div', { className: 'wb-item-sub' }, entry.reviewReason || (entry.analysis && entry.analysis.summary) || '需要核对原消息后重试')), ['awaiting_human','failed'].includes(entry.status)
                    ? h(Btn, {
                        size: 'sm',
                        kind: canConfirm?'primary':'subtle',
                        icon: canConfirm?'check':'refresh',
                        onClick: function (): any {
                            (canConfirm?WB.actions.analyzeConfirm(entry.id):WB.actions.analysisRetry(entry.id).then(()=>WB.actions.analyzeRun(1,[entry.id])))
                                .then(function (): any {
                                return WB.actions.analysisStatus();
                            })
                                .then(function (status?: any): any {
                                setAnalysis(status);
                                WB.actions.reload().catch(function (): any { });
                            })
                                .catch(function (error: any): any {if(!error?.workbenchAnalysisNotified)WB.toast(error?.message||String(error),'err')});
                        },
                        children: canConfirm?'确认建档':'重试本条',
                    })
                    : null);
            }))
            : h('p', { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.6 } }, data.settings?.aiExtract?.enabled ? (analysis.pending ? 'AI 已开启，待识别消息可运行分析，或在待回复页逐条处理。' : '本轮识别已完成，暂无待确认或失败条目。') : '开启「设置 → 自动化 → AI 识别」后，可处理已采集消息。'))
        : null;
    return h('div', null, h(PageHead, {
        icon: 'dashboard',
        title: '今日简报',
        sub: '北京时间 · '+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long'}).format(taskClock),
        actions: [
            h(Btn,{key:'copy',size:'sm',kind:'subtle',icon:'copy',onClick:()=>WB.util.copy(dashBriefMarkdown(data)).then(()=>WB.toast('今日简报已复制','ok')).catch((e:any)=>WB.toast(e.message,'err')),children:'复制今日简报'}),
            h(WorkspaceRefresh,{key:'refresh',scope:'all'}),
            // 「新建待办」主按钮只保留全局工具栏一处（用户反馈 #4：同屏三个主按钮互相打架）
        ],
    }), h('div',{className:'wb-stats-strip', 'aria-label':'今日行动概览'},
        h(Btn,{size:'sm',kind:'subtle',onClick:()=>goTasks({dueFilter:'overdue'}),children:'逾期事项 '+counts.overdue}),
        h(Btn,{size:'sm',kind:'subtle',onClick:()=>goTasks({dueFilter:'today'}),children:'今日到期 '+counts.today}),
        h(Btn,{size:'sm',kind:'subtle',onClick:()=>WB.go('replies'),children:'待回复 '+replyOpen.length}),
        h(Btn,{size:'sm',kind:'subtle',icon:'radar',onClick:()=>document.getElementById('wb-brief-news')?.scrollIntoView({block:'start',behavior:'smooth'}),children:'AI 资讯 '+radarSorted.length}),
        h(Btn,{size:'sm',kind:'subtle',disabled:!analysis?.awaitingHuman,onClick:()=>document.getElementById('wb-brief-analysis')?.scrollIntoView({block:'start'}),children:'待确认 '+(analysis?.awaitingHuman||0)})),
    h('div',{className:'wb-split',style:{gridTemplateColumns:'minmax(0,1.6fr) minmax(0,1fr)',marginBottom:16}},
        h('div',{ref:taskColumn,className:'wb-stack',style:{gap:16,minWidth:0}},taskPanel,replyOpen.length?replyPanel:null),
        h('div',{className:'wb-stack',style:{gap:16,minWidth:0}},h(BriefAgenda,{data:{...data,tasks},now:taskClock}),h('div',{id:'wb-brief-news'},radarPanel))),
    h('div',{id:'wb-brief-analysis'},analysis?.awaitingHuman>0?analysisPanel:null),
    h(FocusedInbox,{data,compact:true}),
    h('details',{className:'wb-compact-status'},h('summary',null,
        h('span',null,lastMentions?.status==='ok'?'消息同步正常':lastMentions?'消息尚未同步完整':'消息尚未同步'),
        h('span',{className:'wb-tiny wb-muted'},data.messageInbox?.at?'最近同步 '+WB.fmt.relative(data.messageInbox.at):'尚无消息快照'),
        analysis?.failed?h(Badge,{tone:'err'},'识别失败 '+analysis.failed):null,
        stale?h(Badge,{tone:'warn'},'快照可能过期'):null),
        mentionsStrip,analysis?.awaitingHuman>0?null:analysisPanel),
    h('details',{className:'wb-compact-status',onToggle:(event:any)=>setReminderToolsOpen(event.currentTarget.open)},h('summary',null,'提醒与日历导出'),reminderToolsOpen?h(RemindersPanel,{revision:data.revision}):null),
    h(DashRadarModal, {
        open: radarFormOpen,
        item: radarEditItem,
        onClose: function (): any {
            setRadarFormOpen(false);
            setRadarEditItem(null);
        },
    }));
}

WB.pages.dashboard = DashboardPage;


export { dashStoreNavigate, dashToneColor, dashPriorityOf, dashDueValue, dashEndOfToday, dashActionable, dashEarliestOverdue, dashStaleInfo, dashProjectName, dashRadarTimeValue, dashSummaryParts, dashConnectorIcon, dashTagPill, replyStageTone, DashTaskRow, DashRadarRow, DashConnectorCard, DashRadarMenu, DashRadarModal, DashEmptyIllustration, DashEmptyStep, dashBriefMarkdown, DashboardPage }
