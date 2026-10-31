import {Pagination,PAGE_SIZE,pageIndex} from '../../components/Pagination.js'
import { NewsFetchStatus } from './NewsFetchStatus.js'
import { ReplyDraft } from '../inbox/ReplyDraft.js'
import {isIgnoredNews} from '../../../shared/news.js'
import { newsRelevance } from '../../../shared/news.js'
import { WorkflowJobs } from '../../components/WorkflowJobs.js'
import { AnalysisQueuePanel } from '../../components/AnalysisQueuePanel.js'
import { Badge, Btn, Empty, Input, PageHead, Panel, Select, WB, h, useStore } from '../../core/runtime.js'
import * as React from 'react'
import { DashRadarModal, DashRadarRow } from '../news/news-presentation.js'
function RadarPage(): any {
    const state = useStore();
    const data = state.data || {};
    const [page,setPage]=React.useState(0);
    const [query, setQuery] = React.useState<any>('');
    const [topic, setTopic] = React.useState<any>('all');
    const [working, setWorking] = React.useState<any>(false);
    const [editing, setEditing] = React.useState<any>(false);
    const [editingItem, setEditingItem] = React.useState<any>(null);
    const [expandedIds, setExpandedIds] = React.useState<Record<string,boolean>>({});
    const rows = (data.radar || []).filter((item:any)=>!item.archivedAt&&!isIgnoredNews(item)).filter(function (row?: any): any { return (topic === 'all' || (row.topics || []).includes(topic)) && (!query || [row.title, row.excerpt].join(' ').toLowerCase().includes(query.toLowerCase())); })
        .sort(function (a?: any, b?: any): any { const relevance = newsRelevance(b,data.settings?.topics || [],data.projects || [])-newsRelevance(a,data.settings?.topics || [],data.projects || []); if(relevance)return relevance; return new Date(b.publishedAt || b.fetchedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.fetchedAt || a.createdAt).getTime(); });
    function summarize(): any { setWorking(true); WB.actions.radarSummarize([]).then(function (result?: any): any { if (result.jobId) { WB.toast('摘要已进入后台队列：' + result.jobId, 'ok'); return WB.actions.reload() }
            WB.toast('摘要成功 ' + (result.done || 0) + ' 条，失败 ' + (result.failed || 0) + ' 条' + (result.note ? '：' + result.note : ''), result.status === 'ok' ? 'ok' : 'err'); return WB.actions.reload(); }).catch(function (e?: any): any { WB.toast(String(e.message || e), 'err'); }).finally(function (): any { setWorking(false); }); }
    return h(React.Fragment, null, h(WorkflowJobs, {jobs:data.jobs || [],kind:'summary'}), h(PageHead, { icon: 'radar', title: '资讯', sub: '近期 AI 进展、模型与智能体工具、GitHub 项目发现；失效内容自动退出推荐。', actions: h('div', { className: 'wb-row wb-row--wrap' }, h(Btn, { icon: 'refresh', disabled: state.busy, onClick: function (): any { WB.actions.fetchRadar().catch(function (): any { }); }, children: '获取资讯' }), h(Btn, { icon: 'sparkles', disabled: working, onClick: summarize, children: working ? '摘要中…' : '生成摘要' }), h(Btn, { icon: 'plus', onClick: function (): any { setEditingItem(null); setEditing(true); }, children: '添加资讯' }), h('a',{className:'wb-btn',href:'https://github.com/search?type=repositories&s=stars&o=desc&q='+encodeURIComponent('topic:artificial-intelligence stars:>100 created:>'+new Date(Date.now()-90*86400000).toISOString().slice(0,10)),target:'_blank',rel:'noopener noreferrer'},'GitHub 新项目榜')) }), h('div', { className: 'wb-row wb-row--wrap', style: { marginBottom: 16 } }, h(Input, { 'aria-label': '搜索资讯', placeholder: '搜索资讯', value: query, onChange: function (e?: any): any { setQuery(e.target.value); } }), h(Select, { value: topic, options: [{ value: 'all', label: '全部主题' }].concat((data.settings && data.settings.topics || []).map(function (value?: any): any { return { value, label: value }; })), onChange: function (e?: any): any { setTopic(e.target.value); } })), h(NewsFetchStatus, {report:data.lastRadarFetch}), rows.length ? h('div', { className: 'wb-news-grid' }, rows.slice(pageIndex(page,rows.length)*PAGE_SIZE,(pageIndex(page,rows.length)+1)*PAGE_SIZE).map(function (item?: any): any { return h(Panel, { key: item.id, bodyStyle:{padding:'10px 14px'} }, h(DashRadarRow, { item, expanded:expandedIds[item.id]===true, onToggle:()=>setExpandedIds(previous=>({...previous,[item.id]:!previous[item.id]})), onEdit:()=>{setEditingItem(item);setEditing(true)} })); })) : h(Empty, { icon: 'radar', title: '没有匹配的资讯', hint: '设置关注主题并配置宿主联网搜索后获取资讯，也可添加 RSS 资讯源。' }), h(Pagination,{page,total:rows.length,onChange:setPage}), h(DashRadarModal, { open: editing, item: editingItem, onClose: function (): any { setEditing(false); } }));
}

export {RadarPage}
