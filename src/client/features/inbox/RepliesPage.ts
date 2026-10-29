import {MessageSelectionBadges} from '../../components/MessageSelectionBadges.js'
import {Pagination,PAGE_SIZE,pageIndex} from '../../components/Pagination.js'
import { ReplyDraft } from './ReplyDraft.js'
import { messageOrigin, messageSender, messageSentTime } from '../../../shared/message-display.js'
import {isIgnoredNews} from '../../../shared/news.js'
import { newsRelevance } from '../../../shared/news.js'
import { WorkflowJobs } from '../../components/WorkflowJobs.js'
import { AnalysisQueuePanel } from '../../components/AnalysisQueuePanel.js'
import { Badge, Btn, Empty, Icon, Input, PageHead, Panel, Select, WB, h, useStore } from '../../core/runtime.js'
import * as React from 'react'
import { DashRadarModal, DashRadarRow } from '../news/news-presentation.js'
function RepliesPage(): any {
    const state = useStore();
    const data = state.data || {};
    const [filter, setFilter] = React.useState<any>('open');
    const [page,setPage]=React.useState(0);
    const [query, setQuery] = React.useState<any>('');
    const replies = (data.replies || []).filter((row:any)=>!row.archivedAt).map((row:any) => ({...row, groupName: messageOrigin((data.sources || []).find((source:any) => source.id === row.sourceId), row), contact: messageSender((data.sources || []).find((source:any) => source.id === row.sourceId) || {locator:{groupId:row.groupId}}, row.contact)})).filter(function (row?: any): any {
        return (filter === 'all' || filter === 'open' ? filter === 'all' || row.stage === '待回复' || row.stage === '已确认收到' : row.stage === filter)
            && (!query || [row.snippet, row.contact, row.groupName].join(' ').toLowerCase().includes(query.toLowerCase()));
    }).sort(function (a?: any, b?: any): any { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
    return h('div', { className: 'wb-inbox' },
        h(PageHead, {
            icon: 'chat', title: '待回复',
            sub: '私聊未读先待识别；具体事项转入待办，需答复的消息按实际回复更新。',
            actions: h(Btn, { icon: 'refresh', onClick: () => WB.actions.fetchMentions().catch(() => {}), disabled: state.busy, children: '同步消息' }),
        }),
        h('div', { className: 'wb-inbox-filters' },
            h('div', { className: 'wb-inbox-search' },
                h(Icon, { name: 'search', size: 15 }),
                h(Input, {
                    'aria-label': '搜索待回复', value: query, placeholder: '搜索内容、联系人或会话',
                    onChange: (event: any) => { setQuery(event.target.value); setPage(0); },
                })),
            h('label', { className: 'wb-inbox-filter' }, h('span', null, '状态'), h(Select, {
                title: '回复阶段', value: filter,
                options: [{ value: 'open', label: '待处理' }, { value: 'all', label: '全部' }].concat(
                    ['待回复', '已确认收到', '已回复', '不需回复'].map(value => ({ value, label: value }))),
                onChange: (event: any) => { setFilter(event.target.value); setPage(0); },
            })),
            h('span', { className: 'wb-inbox-count' }, '共 ' + replies.length + ' 条')),
        replies.length ? h('div', { className: 'wb-reply-list' },
            replies.slice(pageIndex(page, replies.length) * PAGE_SIZE, (pageIndex(page, replies.length) + 1) * PAGE_SIZE).map(function (reply: any): any {
                const source = (data.sources || []).find((row: any) => row.id === reply.sourceId);
                const statusActions = h('div', { className: 'wb-inbox-stage-actions', role: 'group', 'aria-label': '修改回复阶段' },
                    h('span', { className: 'wb-tiny wb-muted' }, '标记为'),
                    ['待回复', '已确认收到', '已回复', '不需回复'].filter(stage => stage !== reply.stage).map(stage =>
                        h(Btn, { key: stage, size: 'sm', disabled: state.busy, onClick: () => WB.actions.setReplyStage(reply.id, stage).catch(() => {}), children: stage })),
                    h(Btn, { icon: 'sparkles', size: 'sm', onClick: () => WB.assistant.add({ kind: 'source', id: reply.sourceId || reply.id, title: reply.contact || '待回复消息', body: reply.snippet, meta: '回复 ID：' + reply.id + '；阶段：' + reply.stage }), children: 'AI 协助' }));
                return h('article', { key: reply.id, className: 'wb-reply-item wb-inbox-card' },
                    h('header', { className: 'wb-inbox-card-head' },
                        h('div', { className: 'wb-row wb-row--wrap' },
                            h('strong', null, reply.contact || reply.groupName || '消息'),
                            h(Badge, { tone: reply.stage === '已回复' ? 'ok' : reply.stage === '不需回复' ? 'idle' : 'warn' }, reply.stage),
                            reply.triage==='pending'&&['待回复','已确认收到'].includes(reply.stage)?h(Badge,{tone:'idle'},'待AI识别'):reply.triage==='task'?h(Badge,{tone:'idle'},reply.taskIds?.length?'已转待办':'待办待确认'):reply.triage==='noise'?h(Badge,{tone:'idle'},'无需处理'):null,
                            reply.humanGuard ? h('span', { className: 'wb-tiny wb-muted' }, '人工标记已保护') : null),
                        h('div', { className: 'wb-inbox-meta' },
                            h(MessageSelectionBadges,{source,inbox:data.messageInbox}),h('span', null, '来自：' + messageOrigin(source, reply)),
                            h('span', null, '发出时间：' + messageSentTime(source)))),
                    h('p', { className: 'wb-inbox-message' }, reply.snippet || '无文本摘录'),
                    h('div', { className: 'wb-inbox-footer' },
                        h(ReplyDraft, { reply, data, actions: statusActions }),
                        source ? h('details', { className: 'wb-inbox-evidence' },
                            h('summary', null, '查看原消息依据'),
                            h('p', null, source.excerpt),
                            h('div', { className: 'wb-tiny wb-muted' }, '发出时间：' + messageSentTime(source))) : null,
                        (reply.taskIds || []).length ? h('div', { className: 'wb-reply-actions' }, (reply.taskIds || []).map(function (id: any): any {
                            const task = (data.tasks || []).find((row: any) => row.id === id);
                            return task ? h(Btn, { key: id, size: 'sm', onClick: () => WB.openTaskForm(task), children: '待办：' + task.title }) : null;
                        })) : null));
            })) : h(Empty, { icon: 'chat', title: '当前没有需要处理的回复', hint: '同步后私聊未读先显示在这里；AI将具体事项转入待办，其余按回复义务分类。' }),
        h(Pagination, { page, total: replies.length, onChange: setPage }),
        h(WorkflowJobs, { jobs: data.jobs || [], kind: 'analysis' }),
        h(AnalysisQueuePanel, { entries: data.analysisQueue || [], sources: data.sources || [] }));
}

export {RepliesPage}
