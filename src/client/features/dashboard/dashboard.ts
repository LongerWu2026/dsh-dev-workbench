import {FocusedInbox} from '../inbox/FocusedInbox.js'
import {MessageSelectionBadges} from '../../components/MessageSelectionBadges.js'
import { messageOrigin, messageSender, messageSentTime } from '../../../shared/message-display.js'
import * as React from 'react'
import { Badge, Btn, Chip, Empty, Icon, IconBtn, PageHead, Panel, Spinner, T, WB, h } from '../../core/runtime.js'
import { dashActionable, dashDueValue, dashEarliestOverdue, dashEndOfToday, dashPriorityOf, dashProjectName, dashStaleInfo, dashStoreNavigate, dashTagPill, dashToneColor, replyStageTone } from './selectors.js'
import { isIgnoredNews, newsPriority } from '../../../shared/news.js'
import { DashRadarMenu, DashRadarModal, DashRadarRow, dashRadarTimeValue, dashSummaryParts } from '../news/news-presentation.js'
import { SyncStatus } from '../../components/SyncStatus.js'
import { StatsStrip } from '../../components/StatsStrip.js'
import { DashTaskRow } from './task-preview.js'
import { CompactEmptyState } from '../../components/CompactEmptyState.js'
import { dashBriefMarkdown } from './brief-export.js'
import { DashPomodoro } from './pomodoro.js'
import { DashConnectorCard, dashConnectorIcon } from './connector-card.js'
import { RemindersPanel } from '../operations/RemindersPanel.js'
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
    const [quickMore, setQuickMore] = React.useState<any>(false);
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
    const counts = WB.taskCounts(data);
    const tasks = Array.isArray(data.tasks) ? data.tasks.filter((row:any)=>!row.archivedAt) : [];
    const actionableAll = dashActionable(data);
    const shownTasks = actionableAll.slice(0, 8);
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
        dashStoreNavigate(preset);
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
    // 指标条：四个数字合并成一行紧凑标签，把纵向空间留给待办列表
    const statStrip = h(StatsStrip, { counts, onFilter: goTasks });
    const taskPanel = h(Panel, {
        icon: 'checkCircle',
        title: '今日待办',
        // 完全没有任务时隐藏副标题，空态保持干净（与右侧一致）
        sub: tasks.length === 0 ? null : actionableAll.length > 0
            ? '逾期、今日到期与高优先级，共 ' + actionableAll.length + ' 条'
            : '按逾期、今日到期与高优先级筛选后没有待办',
        badge: actionableAll.length > 0 ? h(Badge, { tone: 'accent' }, String(actionableAll.length)) : null,
        actions: h(React.Fragment, null, h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'tasks',
            style: { border: '1px solid ' + T.border1 },
            onClick: function (): any {
                WB.go('tasks');
            },
            children: '任务中心',
        }), h(Btn, {
            size: 'sm',
            icon: 'plus',
            onClick: function (): any {
                WB.openTaskForm(null);
            },
            children: '新建待办',
        })),
        flush: true,
    }, shownTasks.length > 0
        ? h('div', { className: 'wb-list', style: { padding: '0 16px' } }, shownTasks.map(function (task?: any): any {
            return h(DashTaskRow, { key: task.id, task: task, data: data });
        }))
        : h(CompactEmptyState, {empty:tasks.length===0,onCreate:()=>WB.openTaskForm(null),onBrowse:()=>WB.go('tasks')}), actionableAll.length > shownTasks.length
        ? h('div', {
            style: {
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 16px',
                borderTop: '1px solid ' + T.border1,
            },
        }, h('span', { className: 'wb-tiny wb-muted' }, '还有 ' + (actionableAll.length - shownTasks.length) + ' 条紧急待办未展示'), h('div', { className: 'wb-spacer' }), h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'arrowRight',
            onClick: function (): any {
                goTasks({ status: 'open' });
            },
            children: '去任务中心',
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
            : 'AI 进展与开源项目 · '+radarStatus,
        badge: radarEmpty
            ? h(Badge, { tone: 'idle' }, '尚未抓取')
            : lastFetch && lastFetch.at && fetchStale
                ? h(Badge, { tone: 'warn' }, '数据可能过期')
                : null,
        actions: h(React.Fragment, null, h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'refresh',
            disabled: radarFetching,
            onClick: runRadarFetch,
            title: feeds.length
                ? '抓取 ' + feeds.length + ' 个已配置的 RSS/Atom 资讯源'
                : '使用宿主联网搜索，按关注主题发现资讯；RSS 为可选来源',
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
    !radarEmpty && topics.length > 0
        ? h('div', { className: 'wb-row', style: { padding: '0 16px 8px' } }, h(Chip, {
            active: !radarAll,
            onClick: function (): any {
                setRadarAll(!radarAll);
            },
            title: radarAll ? '只显示关注主题的资讯' : '暂时显示全部资讯',
            children: '仅看关注主题',
        }), h('div', { className: 'wb-spacer' }), h('span', { className: 'wb-tiny wb-muted' }, radarSorted.length + ' 条'))
        : null, radarVisible.length > 0
        ? h('div', { className: 'wb-list', style: { padding: '0 16px' } }, radarVisible.map(function (item?: any): any {
            return h(DashRadarRow, {
                key: item.id,
                item: item,
                expanded: radarExpanded === item.id,
                onToggle: function (): any {
                    setRadarExpanded(radarExpanded === item.id ? null : item.id);
                },
                onEdit: function (): any {
                    setRadarEditItem(item);
                },
            });
        }))
        : h(Empty, {
            style: { flex: '1 1 auto', justifyContent: 'center' },
            icon: 'radar',
            title: radarEmpty ? '暂无 AI 动态' : '关注主题下暂无资讯',
            hint: radarEmpty
                ? '设置关注主题后点「抓取资讯」，使用宿主联网搜索自动发现；也可手动登记。'
                : topics.join('、') + ' 下暂无资讯。可以查看全部资讯，或在“连接与设置”里调整关注主题。',
            action: h('div', { className: 'wb-row', style: { gap: 8, marginTop: 2 } }, radarEmpty
                ? h(Btn, {
                    size: 'sm',
                    kind: 'primary',
                    icon: 'refresh',
                    disabled: radarFetching,
                    onClick: runRadarFetch,
                    children: radarFetching ? '抓取中…' : '抓取资讯',
                })
                : h(Btn, {
                    size: 'sm',
                    icon: 'eye',
                    onClick: function (): any {
                        setRadarAll(true);
                    },
                    children: '查看全部资讯',
                }), h(Btn, {
                size: 'sm',
                icon: 'plus',
                onClick: function (): any {
                    setRadarEditItem(null);
                    setRadarFormOpen(true);
                },
                children: '手动添加资讯',
            })),
        }), radarSorted.length > 3
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
        return reply.stage === '待回复' || reply.stage === '已确认收到';
    })
        .sort(function (left?: any, right?: any): any {
        return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
    });
    const replyDone = replies.filter(function (reply?: any): any {
        return reply.stage === '已回复' || reply.stage === '不需回复';
    }).length;
    const replyStageTone = function (stage?: any): any {
        if (stage === '已回复')
            return 'ok';
        return 'warn';
    };
    const replyPanel = h(Panel, {
        className: 'wb-panel--separated',
        icon: 'link',
        title: '待回复',
        sub: replies.length > 0 ? '点击阶段 chip 推进；关联的待办在任务中心跟踪' : null,
        badge: replyOpen.length > 0
            ? h(Badge, { tone: 'warn' }, String(replyOpen.length))
            : replies.length > 0
                ? h(Badge, { tone: 'ok' }, '已清')
                : null,
        actions: h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'tasks',
            onClick: function (): any {
                WB.go('replies');
            },
            children: '查看全部回复',
        }),
    }, replies.length === 0
        ? h('div', { className: 'wb-tiny wb-muted', style: {padding:'4px 0',lineHeight:1.6} }, '没有待回复的沟通。AI 识别的回复义务在此跟踪，与待办独立处理。')
        : h('div', { className: 'wb-list' }, replyOpen.slice(0, 6).map(function (reply?: any): any {
            const source = (data.sources || []).find((source:any) => source.id === reply.sourceId);
            return h('div', { key: reply.id, className: 'wb-item' }, h('div', { className: 'wb-item-main' }, h('div', { className: 'wb-item-title', style: { display: 'flex', gap: 6, alignItems: 'center' } }, messageSender(source || {locator:{groupId:reply.groupId}}, reply.contact), h(MessageSelectionBadges,{source,inbox:data.messageInbox}), h(Badge, { tone: replyStageTone(reply.stage) }, reply.stage), reply.triage==='pending'?h(Badge,{tone:'idle'},'待AI识别'):null, reply.taskIds && reply.taskIds.length > 0 ? h(Badge, { tone: 'idle' }, '关联待办 ' + reply.taskIds.length) : null), h('div', { className: 'wb-item-sub', style:{overflowWrap:'anywhere',whiteSpace:'normal'} }, '来自：' + messageOrigin(source, reply)), h('div', { className: 'wb-item-sub wb-clamp2' }, reply.snippet || ''), h('div', { className: 'wb-tiny wb-muted' }, '发出时间：' + messageSentTime(source))), h('div', { className: 'wb-row', style: { gap: 5, flex: 'none' } }, [
                { id: '已回复', hint: '已给出答复' },
                { id: '不需回复', hint: '无需回复' },
            ].map(function (chip?: any): any {
                return h(Chip, {
                    key: chip.id,
                    title: chip.hint,
                    onClick: function (): any {
                        WB.actions.setReplyStage(reply.id, chip.id).catch(function (): any { });
                    },
                    children: chip.id,
                });
            })));
        }), replyDone > 0
            ? h('div', { className: 'wb-tiny wb-muted', style: { padding: '2px 4px 0' } }, '另有 ' + replyDone + ' 条已处理（已回复 / 不需回复）')
            : null));
    // ---- 快捷操作：把高频入口与本地小工具收在一张卡里（§2.1 首页应有快捷操作）
    const quickActionsPanel = h(Panel, {
        icon: 'zap',
        title: '快捷操作',
        sub: '高频入口；番茄钟与日报都在本地完成，不联网',
        actions: h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'copy',
            onClick: function (): any {
                WB.util
                    .copy(dashBriefMarkdown(data))
                    .then(function (): any {
                    WB.toast('今日简报已复制为 Markdown', 'ok');
                })
                    .catch(function (error?: any): any {
                    WB.toast(String((error && error.message) || error), 'err');
                });
            },
            children: '复制今日简报',
        }),
    }, h('div', { className: 'wb-stack', style: { gap: 10 } },
    // 一个图标按钮，菜单向上展开（不并排堆按钮）
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 } }, quickMore
        ? h('div', {
            style: {
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                minWidth: 168,
                padding: 4,
                border: '1px solid ' + T.border1,
                borderRadius: 10,
                background: T.layer1,
            },
        }, [
            { key: 'new', icon: 'plus', label: '新建待办', run: function (): any { WB.openTaskForm(null); } },
            { key: 'search', icon: 'search', label: '搜索', run: function (): any { WB.go('search'); } },
            { key: 'toolbox', icon: 'toolbox', label: '开发工具箱', run: function (): any { WB.go('toolbox'); } },
            { key: 'agents', icon: 'agent', label: 'Agent 中心', run: function (): any { WB.go('agents'); } },
            { key: 'mentions', icon: 'sparkles', label: mentionsBusy ? '拉取 @我…' : '拉取 @我', run: runMentionsFetch, disabled: mentionsBusy },
            { key: 'radar', icon: 'refresh', label: radarFetching ? '抓取中…' : '抓取资讯', run: runRadarFetch, disabled: radarFetching },
            { key: 'aiextract', icon: 'sparkles', label: '运行 AI 分析', run: function (): any { WB.actions.analyzeRun(); } },
            { key: 'radarsum', icon: 'book', label: '生成资讯摘要', run: function (): any { WB.actions.radarSummarize([]); } },
        ].map(function (item?: any): any {
            return h('button', {
                key: item.key,
                type: 'button',
                disabled: !!item.disabled,
                onClick: function (): any {
                    setQuickMore(false);
                    item.run();
                },
                style: {
                    appearance: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    width: '100%',
                    textAlign: 'left',
                    border: 0,
                    borderRadius: 7,
                    background: 'transparent',
                    color: T.text,
                    font: 'inherit',
                    fontSize: 12,
                    lineHeight: 1.7,
                    padding: '4px 8px',
                    cursor: item.disabled ? 'default' : 'pointer',
                    opacity: item.disabled ? 0.55 : 1,
                },
            }, h(Icon, { name: item.icon, size: 12 }), item.label);
        }))
        : null, h(IconBtn, {
        name: 'zap',
        label: '快捷操作',
        active: quickMore,
        onClick: function (): any {
            setQuickMore(!quickMore);
        },
    })), h(DashPomodoro, null)));
    const connectorsPanel = h(Panel, {
        icon: 'plug',
        title: '连接状态',
        sub: '来自 Host 的连接器快照；未配置不会影响本地待办与工具',
        actions: h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'settings',
            onClick: function (): any {
                WB.go('settings');
            },
            children: '连接与设置',
        }),
    }, connectors.length > 0
        ? h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 } }, connectors.map(function (connector?: any): any {
            return h(DashConnectorCard, { key: connector.id, connector: connector });
        }))
        : h(Empty, {
            icon: 'plug',
            title: '还没有连接器',
            hint: '在“连接与设置”里记录云之家 CLI、Git / GitHub、Docker 等接入方式，这里会显示授权状态与能力。',
            action: h(Btn, {
                size: 'sm',
                onClick: function (): any {
                    WB.go('settings');
                },
                children: '去配置',
            }),
        }));
    return h('div', null, h(PageHead, {
        icon: 'dashboard',
        title: '今日简报',
        sub: '需要处理 ' +
            counts.open +
            ' 项 · 逾期 ' +
            counts.overdue +
            ' 项 · 今日到期 ' +
            counts.today +
            ' 项 · 数据更新于 ' +
            (data.updatedAt ? WB.fmt.relative(data.updatedAt) : '尚未写入'),
        actions: [
            h(Btn, {
                key: 'refresh',
                size: 'sm',
                icon: 'refresh',
                disabled: state.busy || mentionsBusy,
                onClick: runMentionsFetch,
                children: state.busy || mentionsBusy ? '刷新中…' : '刷新',
            }),
            // 「新建待办」主按钮只保留全局工具栏一处（用户反馈 #4：同屏三个主按钮互相打架）
        ],
    }), h(FocusedInbox,{data}), stale
        ? h('div', { className: 'wb-banner wb-banner--warn', style: { marginBottom: 16 } }, h('span', { className: 'wb-banner-icon' }, h(Icon, { name: 'clock', size: 15 })), h('div', { className: 'wb-banner-main' }, h('div', { className: 'wb-banner-title' }, '数据可能过期'), h('div', { className: 'wb-banner-sub' }, 'Host 快照已 ' + WB.fmt.relative(stale.updatedAt) + ' 未刷新（陈旧阈值 ' + stale.staleHours + ' 小时），任务与资讯可能不是最新。')), h('div', { className: 'wb-banner-actions' }, h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'refresh',
            disabled: state.busy || mentionsBusy,
            onClick: runMentionsFetch,
            children: '立即刷新',
        })))
        : null, mentionsStrip, h(RemindersPanel,{revision:data.revision}),
    /** TODO 22：AI 识别状态面板（与自动化开关共用配置语义，展示即真实） */
    (analysis && (analysis.pending || analysis.awaitingHuman || analysis.failed || analysis.done || analysis.skipped || analysis.historical))
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
                onClick: function (): any {
                    WB.actions
                        .analyzeRun()
                        .then(function (result?: any): any {
                        WB.toast(result.jobId ? 'AI 分析已进入后台队列：' + result.jobId : 'AI 分析：处理 ' + (result.processed || 0) + ' / 失败 ' + (result.failures || 0), 'ok');
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
                return h('div', { key: entry.id, className: 'wb-item' }, h(Badge, { tone: entry.status === 'failed' ? 'err' : 'warn' }, entry.status === 'failed' ? '失败' : '待确认'), h('div', { className: 'wb-item-main' }, h('div', { className: 'wb-item-title wb-ellipsis' }, WB.util.truncate((sourceRow && sourceRow.excerpt) || entry.msgId || entry.sourceId, 46)), entry.status === 'failed'
                    ? h('div', { className: 'wb-item-sub' }, '已失败 ' + (entry.attempts || 0) + ' 次' + ((entry.attempts || 0) >= 3 ? ' · 需手动重试' : '') + (entry.lastError ? ' · ' + entry.lastError : ''))
                    : h('div', { className: 'wb-item-sub' }, (entry.analysis && entry.analysis.summary) || '已识别，待确认建档')), entry.status === 'awaiting_human'
                    ? h(Btn, {
                        size: 'sm',
                        kind: 'primary',
                        icon: 'check',
                        onClick: function (): any {
                            WB.actions
                                .analyzeConfirm(entry.id)
                                .then(function (): any {
                                return WB.actions.analysisStatus();
                            })
                                .then(function (status?: any): any {
                                setAnalysis(status);
                                WB.actions.reload().catch(function (): any { });
                            })
                                .catch(function (): any { });
                        },
                        children: '确认建档',
                    })
                    : null);
            }))
            : h('p', { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.6 } }, data.settings?.aiExtract?.enabled ? (analysis.pending ? 'AI 已开启，待识别消息可运行分析，或在待回复页逐条处理。' : '本轮识别已完成，暂无待确认或失败条目。') : '开启「设置 → 自动化 → AI 识别」后，可处理已采集消息。'))
        : null, statStrip, replyPanel, h('div', { className: 'wb-split', style: { gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', marginBottom: 16 } }, taskPanel, radarPanel), h('div', { style: { marginBottom: 16 } }, quickActionsPanel), connectorsPanel, h(DashRadarModal, {
        open: radarFormOpen,
        item: radarEditItem,
        onClose: function (): any {
            setRadarFormOpen(false);
            setRadarEditItem(null);
        },
    }));
}

WB.pages.dashboard = DashboardPage;


export { dashStoreNavigate, dashToneColor, dashPriorityOf, dashDueValue, dashEndOfToday, dashActionable, dashEarliestOverdue, dashStaleInfo, dashProjectName, dashRadarTimeValue, dashSummaryParts, dashConnectorIcon, dashTagPill, replyStageTone, DashTaskRow, DashRadarRow, DashConnectorCard, DashRadarMenu, DashRadarModal, DashEmptyIllustration, DashEmptyStep, DashPomodoro, dashBriefMarkdown, DashboardPage }
