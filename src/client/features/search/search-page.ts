import { Badge, Btn, Chip, Empty, Icon, Input, PageHead, Panel, Select, Spinner, WB, h, useStore } from '../../core/runtime.js'
import * as React from 'react'
/* ============================================================================
 * dev-workbench — 搜索 (search)
 *
 * Design report §3.3: multiple providers, source-attributed results, and the
 * hard rule "无命中时不得编造企业事实". So this page renders GROUPS, never a
 * merged list: each group keeps its own status and reason, an unavailable or
 * failing provider stays visible as a row with its explanation, and there is no
 * model summary anywhere on this page — a summary would need citations this
 * plugin cannot verify.
 *
 * Query execution is explicit (Enter / button), not per-keystroke, because one
 * of the providers leaves the machine.
 * ========================================================================== */
function searchKindMeta(kind?: any): any {
    if (kind === 'task')
        return { label: '待办', icon: 'tasks', tone: 'accent' };
    if (kind === 'knowledge')
        return { label: '知识', icon: 'book', tone: 'ok' };
    if (kind === 'radar')
        return { label: '资讯', icon: 'radar', tone: 'idle' };
    if (kind === 'source')
        return { label: '来源', icon: 'link', tone: 'idle' };
    if (kind === 'web')
        return { label: '网页', icon: 'external', tone: 'warn' };
    if (kind === 'contact')
        return { label: '联系人', icon: 'agent', tone: 'accent' };
    if (kind === 'room')
        return { label: '会议室', icon: 'calendar', tone: 'ok' };
    if (kind === 'attendance')
        return { label: '考勤', icon: 'clock', tone: 'idle' };
    return { label: kind, icon: 'layers', tone: 'idle' };
}
function searchStatusMeta(status?: any): any {
    if (status === 'ok')
        return { label: '已返回', tone: 'ok' };
    if (status === 'empty')
        return { label: '无命中', tone: 'idle' };
    if (status === 'unavailable')
        return { label: '不可用', tone: 'warn' };
    if (status === 'error')
        return { label: '失败', tone: 'err' };
    return { label: status, tone: 'idle' };
}
function SearchResultRow(props?: any): any {
    const item = props.item;
    const meta = searchKindMeta(item.kind);
    const extra = item.extra || {};
    function collect(): any {
        WB.actions
            .createKnowledge({
            kind: 'bookmark',
            title: item.title,
            url: item.url || null,
            body: item.snippet || '',
            tags: ['搜索', meta.label],
        })
            .catch(function (): any { });
    }
    return h('div', { className: 'wb-item', style: { alignItems: 'flex-start' } }, h('div', { className: 'wb-item-main' }, h('div', { className: 'wb-item-title', style: { display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' } }, h(Badge, { tone: meta.tone }, meta.label), item.url
        ? h('a', {
            href: item.url,
            target: '_blank',
            rel: 'noreferrer',
            className: 'wb-link',
            style: { fontWeight: 500 },
        }, item.title)
        : h('span', null, item.title)), item.snippet ? h('div', { className: 'wb-item-sub wb-clamp2' }, item.snippet) : null, h('div', { className: 'wb-item-sub' }, item.kind === 'task' && extra.status ? h('span', null, (WB.TASK_STATUS[extra.status] || {}).label || extra.status) : null, item.kind === 'task' && extra.dueAt ? h('span', null, '截止 ' + WB.fmt.day(extra.dueAt)) : null, item.kind === 'source' && extra.provider ? h('span', null, extra.provider) : null, item.kind === 'radar' && extra.source ? h('span', null, extra.source) : null, item.kind === 'web' && extra.publishedAt ? h('span', null, WB.fmt.date(extra.publishedAt)) : null, item.kind === 'knowledge' && extra.tags && extra.tags.length
        ? extra.tags.map(function (tag?: any): any {
            return h(Chip, { key: tag, children: tag });
        })
        : null)), h('div', { className: 'wb-item-actions', style: { opacity: 1 } }, item.kind === 'task'
        ? h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'arrowRight',
            children: '定位',
            onClick: function (): any {
                WB.focusTask(item.id);
            },
        })
        : null, item.kind === 'radar' || item.kind === 'knowledge'
        ? h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'copy',
            children: '复制',
            onClick: function (): any {
                WB.util
                    .copy([item.title, item.snippet, item.url].filter(Boolean).join('\n'))
                    .then(function (): any {
                    WB.toast('已复制', 'ok');
                })
                    .catch(function (e?: any): any {
                    WB.toast(String((e && e.message) || e), 'err');
                });
            },
        })
        : null, h(Btn, {
        size: 'sm',
        kind: 'subtle',
        icon: 'book',
        children: '收藏',
        onClick: collect,
    }), h(Btn, {
        size: 'sm',
        kind: 'subtle',
        icon: 'plus',
        children: '建待办',
        onClick: function (): any {
            WB.openTaskForm({
                title: WB.util.truncate(item.title || '来自检索结果', 80),
                description: String((item.snippet || '') + (item.url ? '\n来源：' + item.url : '')).slice(0, 2000),
                projectId: null,
                taskId: null,
            });
        },
    }), h(Btn, {
        size: 'sm',
        kind: 'subtle',
        icon: 'sparkles',
        children: 'AI 分析',
        onClick: function (): any {
            WB.assistant.add({
                kind: 'source',
                id: item.id,
                title: item.title,
                url: item.url || null,
                body: item.snippet || '',
                meta: '来源分组：' + props.groupLabel,
            });
        },
    })));
}
const WORK_TYPES = [
 {id:'all',label:'全部',groups:null},
 {id:'tasks',label:'待办',groups:['tasks']},
 {id:'knowledge',label:'知识',groups:['knowledge','enterprise']},
 {id:'radar',label:'资讯',groups:['radar']},
 {id:'messages',label:'消息',groups:['sources','enterprise']},
];
function SearchPage(): any {
 const state=useStore(),data=state.data;
 const [mode,setMode]=React.useState('work'),[draft,setDraft]=React.useState(''),[query,setQuery]=React.useState('');
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[result,setResult]=React.useState<any>(null);
 const [history,setHistory]=React.useState<Record<string,string[]>>({work:[],web:[]}),[category,setCategory]=React.useState('all');
 const [dateFilter,setDateFilter]=React.useState('all'),[projectFilter,setProjectFilter]=React.useState('');
 const [limits,setLimits]=React.useState<Record<string,number>>({});
 const version=React.useRef(0),consumed=React.useRef<any>(null);
 React.useEffect(()=>()=>{version.current++},[]);
 function changeMode(next:string){
  if(next===mode)return;
  version.current++;setMode(next);setResult(null);setError('');setBusy(false);setCategory('all');setDateFilter('all');setProjectFilter('');setLimits({});
 }
 async function run(nextQuery=draft,scope=mode){
  const text=String(nextQuery).trim();if(!text)return;
  const requestVersion=++version.current;
  setDraft(text);setQuery(text);setBusy(true);setError('');setResult(null);setLimits({});
  try{
   const value=await WB.actions.search(text,{scope,includeWeb:scope==='web'});
   if(requestVersion!==version.current)return;
   setResult(value);setHistory(old=>({...old,[scope]:[text,...old[scope].filter(item=>item!==text)].slice(0,6)}));
  }catch(e){if(requestVersion===version.current)setError(e instanceof Error?e.message:String(e))}
  finally{if(requestVersion===version.current)setBusy(false)}
 }
 const preset=state.searchPreset;
 React.useEffect(()=>{
  if(!preset||consumed.current===preset)return;consumed.current=preset;
  const group=preset.groups?.[0],scope=group==='web'||preset.category==='web'?'web':'work';
  version.current++;setMode(scope);setResult(null);setDateFilter('all');setProjectFilter('');
  setCategory(WORK_TYPES.find(type=>type.groups?.includes(group))?.id||'all');
  WB.clearSearchPreset();if(preset.query)void run(preset.query,scope);
 },[preset]);
 const categoryGroups=WORK_TYPES.find(type=>type.id===category)?.groups;
 function itemPasses(item:any){
  const kind=({tasks:'task',knowledge:'knowledge',radar:'radar',messages:'source'} as Record<string,string>)[category];
  if(mode==='work'&&kind&&item.kind!==kind)return false;
  const extra=item.extra||{};
  if(projectFilter&&item.kind==='task'&&(extra.projectId||'')!==projectFilter)return false;
  const days=({day:1,week:7,month:30} as Record<string,number>)[dateFilter];
  const at=extra.at||extra.publishedAt;
  if(days&&at){const stamp=Date.parse(at);if(Number.isFinite(stamp)&&Date.now()-stamp>days*86400000)return false}
  return true;
 }
 const groups=(result?.groups||[]).filter((group:any)=>mode==='web'?group.id==='web':group.id!=='web');
 const visible=groups.filter((group:any)=>mode==='web'||!categoryGroups||categoryGroups.includes(group.id)).map((group:any)=>({...group,items:group.items.filter(itemPasses)}));
 const total=visible.reduce((sum:number,group:any)=>sum+group.items.length,0);
 const filterCount=Number(dateFilter!=='all')+Number(!!projectFilter);
 const groupLabel=(group:any)=>({tasks:'待办',knowledge:'知识',radar:'资讯',sources:'消息来源',web:'网页'} as Record<string,string>)[group.id]||group.label;
 return h('div',{className:'wb-work-search'},h(PageHead,{icon:'search',title:'工作搜索',sub:mode==='work'?'查找待办、知识、资讯和工作消息':'搜索互联网，查看网页来源'}),
  h('div',{className:'wb-row',role:'tablist','aria-label':'搜索范围',style:{gap:6,marginBottom:16}},['work','web'].map(scope=>h('button',{key:scope,type:'button',role:'tab','aria-selected':mode===scope,className:'wb-tab'+(mode===scope?' is-active':''),onClick:()=>changeMode(scope)},scope==='work'?'工作内容':'互联网'))),
  h('form',{onSubmit:(event:any)=>{event.preventDefault();void run()},className:'wb-row',style:{gap:8,marginBottom:12}},h(Input,{'aria-label':'工作搜索关键词',autoFocus:true,value:draft,placeholder:mode==='work'?'搜索待办、知识、资讯或消息…':'输入互联网搜索关键词…',onChange:(event:any)=>setDraft(event.target.value)}),h('button',{type:'submit',className:'wb-btn wb-btn--primary',onClick:(event:any)=>{event?.preventDefault();void run()},disabled:busy||!draft.trim()},busy?'搜索中…':'搜索')),
  h('div',{className:'wb-row wb-row--wrap',style:{gap:6,marginBottom:14}},mode==='work'&&WORK_TYPES.map(type=>h(Chip,{key:type.id,active:category===type.id,onClick:()=>{setCategory(type.id);setLimits({})},children:type.label})),
   h('details',{className:'wb-search-filters'},h('summary',{style:{cursor:'pointer',fontSize:12,padding:'5px 10px'}},'筛选'+(filterCount?' · '+filterCount:'')),h('div',{className:'wb-row wb-row--wrap',style:{gap:12,padding:10}},
    h('label',{className:'wb-tiny'},'时间 ',h(Select,{'aria-label':'搜索时间',value:dateFilter,onChange:(e:any)=>setDateFilter(e.target.value),options:[{value:'all',label:'全部时间'},{value:'day',label:'24 小时内'},{value:'week',label:'7 天内'},{value:'month',label:'30 天内'}]})),
    mode==='work'&&h('label',{className:'wb-tiny'},'待办项目 ',h(Select,{'aria-label':'待办项目筛选',value:projectFilter,onChange:(e:any)=>setProjectFilter(e.target.value),options:[{value:'',label:'全部项目'},...(data?.projects||[]).map((project:any)=>({value:project.id,label:project.name}))]})),
    filterCount>0&&h(Btn,{size:'sm',onClick:()=>{setDateFilter('all');setProjectFilter('')},children:'重置筛选'})))),
  !result&&!busy&&!error&&h('div',{className:'wb-row wb-row--wrap',style:{gap:6,marginBottom:16}},history[mode].length>0&&h('span',{className:'wb-tiny wb-muted'},'最近搜索'),history[mode].map(text=>h(Chip,{key:text,onClick:()=>void run(text),children:text}))),
  busy&&h('div',{className:'wb-row',role:'status',style:{gap:8,padding:'24px 0'}},h(Spinner,{size:17}),'正在搜索「'+query+'」…'),
  error&&h('div',{role:'alert',className:'wb-web-error'},error),
  !result&&!busy&&!error&&h(Empty,{icon:'search',title:mode==='work'?'查找工作内容':'查找互联网资料',hint:mode==='work'?'输入关键词，按类型查看结果。':'输入关键词，点击搜索查看网页结果。'}),
  result&&h('div',null,h('p',{className:'wb-tiny wb-muted'},'共 '+total+' 条结果'),
   total===0&&h(Empty,{icon:'search',title:'没有匹配的结果',hint:'可以换个关键词，或调整筛选条件。'}),
   visible.filter((group:any)=>group.items.length||group.status==='error'||group.status==='unavailable').map((group:any)=>{
    const meta=searchStatusMeta(group.status),limit=limits[group.id]||5;
    return h('section',{key:group.id,'aria-label':groupLabel(group)+'搜索结果',style:{marginBottom:16}},h(Panel,{title:groupLabel(group),icon:group.id==='web'?'external':'search',sub:group.note||undefined,badge:h(Badge,{tone:meta.tone},group.items.length?group.items.length+' 条':meta.label)},
     group.items.length?group.items.slice(0,limit).map((item:any)=>h(SearchResultRow,{key:item.id,item,groupLabel:groupLabel(group)})):h('p',{className:'wb-tiny wb-muted'},group.note||'当前来源不可用，请稍后重试。'),
     group.items.length>limit&&h(Btn,{size:'sm',onClick:()=>setLimits(old=>({...old,[group.id]:limit+10})),children:'查看更多（剩余 '+(group.items.length-limit)+' 条）'})));
   })));
}
WB.pages.search = SearchPage;
export { searchKindMeta, searchStatusMeta, SearchResultRow, SearchPage }
