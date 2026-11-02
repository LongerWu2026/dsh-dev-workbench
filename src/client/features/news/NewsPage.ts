import {newsCategory} from '../../../shared/news-brief.js'
import {NewsBrief} from './NewsBrief.js'
import {Pagination,PAGE_SIZE,pageIndex} from '../../components/Pagination.js'
import { NewsFetchStatus } from './NewsFetchStatus.js'
import {isIgnoredNews} from '../../../shared/news.js'
import { newsRelevance } from '../../../shared/news.js'
import { Badge, Btn, Empty, Input, PageHead, Panel, Select, WB, h, useStore } from '../../core/runtime.js'
import * as React from 'react'
import { DashRadarModal, DashRadarRow } from '../news/news-presentation.js'
function RadarPage(): any {
    const state = useStore();
    const data = state.data || {};
    const [page,setPage]=React.useState(0);
    const resultsRef=React.useRef<HTMLDivElement>(null),[focusResult,setFocusResult]=React.useState(false);
    const [query, setQuery] = React.useState<any>('');
    const [category,setCategory]=React.useState('all');
    const [topic, setTopic] = React.useState<any>('all');
    const [editing, setEditing] = React.useState<any>(false);
    const [editingItem, setEditingItem] = React.useState<any>(null);
    const [expandedIds, setExpandedIds] = React.useState<Record<string,boolean>>({});
    React.useEffect(()=>{setPage(0)},[data.radarBrief?.at]);
    React.useEffect(()=>{const target=state.radarFocusId;if(!target||!state.data)return;const item=(data.radar||[]).find((row:any)=>row.id===target);if(item){setFocusResult(true);setPage(0);setQuery(item.title||'');setTopic('all');setCategory('all');setExpandedIds(previous=>({...previous,[target]:true}))}WB.store.set({radarFocusId:null})},[state.radarFocusId,state.data]);
    React.useEffect(()=>{if(focusResult){resultsRef.current?.scrollIntoView?.({block:'start',behavior:'smooth'});setFocusResult(false)}},[focusResult,query,topic,category]);
    const latestOrder=new Map<string,number>((data.radarBrief?.ids||data.lastRadarFetch?.itemIds||[]).map((id:string,index:number)=>[id,index]));
    const rows = (data.radar || []).filter((item:any)=>!item.archivedAt&&!isIgnoredNews(item)&&(category==='all'||newsCategory(item)===category)).filter(function (row?: any): any { return (topic === 'all' || (row.topics || []).includes(topic)) && (!query || [row.title, row.excerpt].join(' ').toLowerCase().includes(query.toLowerCase())); })
        .sort(function (a?: any, b?: any): any { const aLatest=latestOrder.get(a.id),bLatest=latestOrder.get(b.id);if(aLatest!==undefined||bLatest!==undefined)return aLatest===undefined?1:bLatest===undefined?-1:aLatest-bLatest; const relevance = newsRelevance(b,data.settings?.topics || [],data.projects || [])-newsRelevance(a,data.settings?.topics || [],data.projects || []); if(relevance)return relevance; return new Date(b.publishedAt || b.fetchedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.fetchedAt || a.createdAt).getTime(); });
    return h(React.Fragment, null, h('style',null,NEWS_HEADER_CSS), h('div',{className:'wb-news-heading'},h(PageHead, { title: '资讯', sub: '模型动态、技术实践与开源项目', actions: h('div', { className: 'wb-news-actions' }, h(Btn,{size:'sm',icon:'messages',onClick:()=>WB.assistant.openHub('system','radar'),children:'资讯对话'}), h(Btn, { size:'sm', icon: 'refresh', disabled: state.busy, onClick: function (): any { WB.actions.fetchRadar().catch(function (): any { }); }, children: '获取资讯' }), h(Btn, { size:'sm', icon: 'plus', onClick: function (): any { setEditingItem(null); setEditing(true); }, children: '添加资讯' }), h('a',{className:'wb-btn wb-btn--sm',href:'https://github.com/search?type=repositories&s=stars&o=desc&q='+encodeURIComponent('topic:artificial-intelligence stars:>100 created:>'+new Date(Date.now()-90*86400000).toISOString().slice(0,10)),target:'_blank',rel:'noopener noreferrer'},'GitHub 新项目榜')) })), h(NewsBrief,{data}), h('div', { className: 'wb-row wb-row--wrap', style: { marginBottom: 16 } }, h(Input, { 'aria-label': '搜索资讯', placeholder: '搜索资讯', value: query, onChange: function (e?: any): any { setQuery(e.target.value); } }), h(Select,{'aria-label':'资讯类别',value:category,options:[{value:'all',label:'全部类别'},...['模型与研究','技术实践','开源项目'].map(value=>({value,label:value}))],onChange:(event:any)=>{setCategory(event.target.value);setPage(0)}}), h(Select, { value: topic, options: [{ value: 'all', label: '全部主题' }].concat((data.settings && data.settings.topics || []).map(function (value?: any): any { return { value, label: value }; })), onChange: function (e?: any): any { setTopic(e.target.value); } })), h(NewsFetchStatus, {report:data.lastRadarFetch}), rows.length ? h('div', { className: 'wb-news-grid', ref:resultsRef }, rows.slice(pageIndex(page,rows.length)*PAGE_SIZE,(pageIndex(page,rows.length)+1)*PAGE_SIZE).map(function (item?: any): any { return h(Panel, { key: item.id, bodyStyle:{padding:'10px 14px'} }, h(DashRadarRow, { item, expanded:expandedIds[item.id]===true, onToggle:()=>setExpandedIds(previous=>({...previous,[item.id]:!previous[item.id]})), onEdit:()=>{setEditingItem(item);setEditing(true)} })); })) : h(Empty, { icon: 'radar', title: '没有匹配的资讯', hint: '设置关注主题并配置宿主联网搜索后获取资讯，也可添加 RSS 资讯源。' }), h(Pagination,{page,total:rows.length,onChange:setPage}), h(DashRadarModal, { open: editing, item: editingItem, onClose: function (): any { setEditing(false); } }));
}

export {RadarPage}

const NEWS_HEADER_CSS=`.wb-news-heading{padding:0 17px}.wb-news-heading .wb-page-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px 20px;margin-bottom:16px;align-items:flex-start}.wb-news-heading .wb-page-head>div:first-child{flex:1 1 220px;min-width:0}.wb-news-heading .wb-page-head h1{line-height:28px}.wb-news-heading .wb-page-head p{line-height:1.7;margin-top:4px}.wb-news-heading .wb-ph-actions{margin:0;max-width:100%;min-width:0}.wb-news-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0;max-width:100%}.wb-news-heading .wb-btn{height:28px;box-sizing:border-box;text-decoration:none;white-space:nowrap}@media(max-width:480px){.wb-news-heading{padding:0 13px}.wb-news-heading .wb-page-head{gap:8px}.wb-news-heading .wb-page-head>div:first-child{flex-basis:100%}.wb-news-heading .wb-ph-actions{width:100%}}`
