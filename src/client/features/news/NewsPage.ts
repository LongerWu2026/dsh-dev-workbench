import {newsCategory} from '../../../shared/news-brief.js'
import {NewsBrief} from './NewsBrief.js'
import {Pagination,PAGE_SIZE,pageIndex} from '../../components/Pagination.js'
import { NewsFetchStatus } from './NewsFetchStatus.js'
import {isIgnoredNews, newsDateGroup, newsPublishedAt, newsRelevance, newsWindowDays} from '../../../shared/news.js'
import { Btn, Empty, Input, PageHead, Panel, Select, WB, h, useStore } from '../../core/runtime.js'
import * as React from 'react'
import { DashRadarModal, DashRadarRow } from '../news/news-presentation.js'
const NEWS_DATE_GROUPS = ['recent', 'unknown', 'history'] as const;
function RadarPage(): any {
    const state = useStore();
    const data = state.data || {};
    const [page,setPage]=React.useState(0);
    const resultsRef=React.useRef<HTMLDivElement>(null),[focusResult,setFocusResult]=React.useState(false);
    const [query, setQuery] = React.useState<any>('');
    const [category,setCategory]=React.useState('all');
    const [dateGroup,setDateGroup]=React.useState<(typeof NEWS_DATE_GROUPS)[number]>('recent');
    const [topic, setTopic] = React.useState<any>('all');
    const [editing, setEditing] = React.useState<any>(false);
    const [editingItem, setEditingItem] = React.useState<any>(null);
    const [expandedIds, setExpandedIds] = React.useState<Record<string,boolean>>({});
    React.useEffect(()=>{setPage(0)},[data.radarBrief?.at]);
    const days = newsWindowDays(data.settings?.newsDays);
    const now = Date.now();
    React.useEffect(()=>{
        const target=state.radarFocusId;
        if(!target||!state.data)return;
        const item=(data.radar||[]).find((row:any)=>row.id===target);
        if(item){
            setFocusResult(true);setPage(0);setQuery(item.title||'');setTopic('all');setCategory('all');
            setDateGroup(newsDateGroup(newsPublishedAt(item),days));
            setExpandedIds(previous=>({...previous,[target]:true}));
        }
        WB.store.set({radarFocusId:null});
    },[state.radarFocusId,state.data,days]);
    React.useEffect(()=>{if(focusResult){resultsRef.current?.scrollIntoView?.({block:'start',behavior:'smooth'});setFocusResult(false)}},[focusResult,query,topic,category,dateGroup]);
    const groups: Record<(typeof NEWS_DATE_GROUPS)[number], {item:any; time:number}[]> = {recent:[],unknown:[],history:[]};
    for(const item of data.radar||[]){
        if(isIgnoredNews(item)||(category!=='all'&&newsCategory(item)!==category))continue;
        if(topic!=='all'&&!(item.topics||[]).includes(topic))continue;
        if(query&&![item.title,item.excerpt].join(' ').toLowerCase().includes(query.toLowerCase()))continue;
        const publishedAt=newsPublishedAt(item);
        const group=newsDateGroup(publishedAt,days,now);
        const sortDate=group==='unknown'?item.fetchedAt||item.createdAt:publishedAt;
        groups[group].push({item,time:Date.parse(sortDate||'')||0});
    }
    const topics=data.settings?.topics||[],projects=data.projects||[];
    const rows=groups[dateGroup].sort((a,b)=>b.time-a.time||newsRelevance(b.item,topics,projects)-newsRelevance(a.item,topics,projects)).map(row=>row.item);
    const dateLabels={recent:'近期资讯（最近 '+days+' 天）',unknown:'日期待确认',history:'历史资讯'};
    const dateControls=h('div',{className:'wb-row wb-row--wrap',role:'group','aria-label':'按发布日期查看',style:{marginBottom:12}},
        NEWS_DATE_GROUPS.map(group=>h('button',{key:group,type:'button',className:'wb-btn wb-btn--sm '+(group===dateGroup?'wb-btn--primary':'wb-btn--ghost'),
            'aria-pressed':group===dateGroup,onClick:()=>{setDateGroup(group);setPage(0)}},dateLabels[group]+' · '+groups[group].length)));
    return h(React.Fragment, null, h('style',null,NEWS_HEADER_CSS), h('div',{className:'wb-news-heading'},h(PageHead, { title: '资讯', primaryAction:h(Btn,{size:'sm',icon:'refresh',disabled:state.busy,onClick:()=>WB.actions.fetchRadar().catch(()=>{}),children:'获取资讯'}), actions: h('div', { className: 'wb-news-actions' }, h(Btn,{size:'sm',icon:'messages',onClick:()=>WB.assistant.openHub('system','radar'),children:'资讯对话'}), h(Btn, { size:'sm', icon: 'plus', onClick: function (): any { setEditingItem(null); setEditing(true); }, children: '添加资讯' }), h('a',{className:'wb-btn wb-btn--sm',href:'https://github.com/search?type=repositories&s=stars&o=desc&q='+encodeURIComponent('topic:artificial-intelligence stars:>100 created:>'+new Date(Date.now()-90*86400000).toISOString().slice(0,10)),target:'_blank',rel:'noopener noreferrer'},'GitHub 新项目榜')) })), h(NewsBrief,{data}), h('div', { className: 'wb-row wb-row--wrap', style: { marginBottom: 16 } }, h(Input, { 'aria-label': '搜索资讯', placeholder: '搜索资讯', value: query, onChange: function (e?: any): any { setQuery(e.target.value); } }), h(Select,{'aria-label':'资讯类别',value:category,options:[{value:'all',label:'全部类别'},...['模型与研究','技术实践','开源项目'].map(value=>({value,label:value}))],onChange:(event:any)=>{setCategory(event.target.value);setPage(0)}}), h(Select, { value: topic, options: [{ value: 'all', label: '全部主题' }].concat((data.settings && data.settings.topics || []).map(function (value?: any): any { return { value, label: value }; })), onChange: function (e?: any): any { setTopic(e.target.value); } })), h(NewsFetchStatus, {report:data.lastRadarFetch}), dateControls, rows.length ? h('div', { className: 'wb-news-grid', role:'region', 'aria-label':dateLabels[dateGroup], ref:resultsRef }, rows.slice(pageIndex(page,rows.length)*PAGE_SIZE,(pageIndex(page,rows.length)+1)*PAGE_SIZE).map(function (item?: any): any { return h(Panel, { key: item.id, bodyStyle:{padding:'10px 14px'} }, h(DashRadarRow, { item, expanded:expandedIds[item.id]===true, onToggle:()=>setExpandedIds(previous=>({...previous,[item.id]:!previous[item.id]})), onEdit:()=>{setEditingItem(item);setEditing(true)} })); })) : h(Empty, { icon: 'radar', title: dateGroup==='recent'?'没有匹配的近期资讯':dateGroup==='unknown'?'没有匹配的日期待确认资讯':'没有匹配的历史资讯', hint: dateGroup==='recent'?'按发布日期筛选。可切换日期范围或获取资讯。':undefined }), h(Pagination,{page,total:rows.length,onChange:setPage}), h(DashRadarModal, { open: editing, item: editingItem, onClose: function (): any { setEditing(false); } }));
}

export {RadarPage}

const NEWS_HEADER_CSS=`.wb-news-heading{padding:0 17px}.wb-news-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0;max-width:100%}.wb-news-heading .wb-btn{height:28px;box-sizing:border-box;text-decoration:none;white-space:nowrap}@media(max-width:480px){.wb-news-heading{padding:0 13px}}`
