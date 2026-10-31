import {TOOLBOX_CSS} from './toolbox-styles.js'
import {DataWorkbench} from './tools/DataWorkbench.js'
import {importCurl} from './tools/developer-utils.js'
import {ToolAI,TypeGenerator,LogAnalyzer} from './tools/DeveloperExtras.js'
import {ToolPomodoro} from './tools/pomodoro.js'
import {HttpDebugger,McpDebugger} from './tools/NetworkDebugger.js'
import * as React from 'react'
import { toolJsonError, toolJsonPane, toolJsonSummary } from './tools/json.js'
import { toolTimestampPane } from './tools/timestamp.js'
import { toolBase64Decode, toolBase64Encode, toolBase64Pane, toolBase64UrlDecode } from './tools/encoding.js'
import { toolParseQuery, toolSafeDecode, toolUrlPane } from './tools/url.js'
import { toolUuidPane, toolUuidV4 } from './tools/uuid.js'
import { toolJwtClaims, toolJwtPane, toolJwtParse } from './tools/jwt.js'
import { toolRegexMatches, toolRegexPane } from './tools/regex.js'
import { toolDiffLines, toolDiffPane } from './tools/diff.js'
import { toolCronDescribeField, toolCronFieldDefs, toolCronNextTimes, toolCronPane, toolCronParse, toolCronParseField, toolCronValue, toolCronValueText, toolCronWeekday } from './tools/cron.js'
import { toolSqlClauseWords, toolSqlContinuationWords, toolSqlFormat, toolSqlKeywordText, toolSqlKeywords, toolSqlMerge, toolSqlPane, toolSqlPhrases, toolSqlTokenize } from './tools/sql-format.js'
import { toolYamlPane } from './tools/yaml.js'
import { toolCsvPane } from './tools/csv.js'
import { toolMarkdownPane } from './tools/markdown.js'
import { toolStatusPane } from './tools/http-status.js'
import { toolShellPane } from './tools/shell.js'
import { toolSqlExplainPane } from './tools/sql-plan.js'
import { toolDefs, toolInitialState } from './catalog.js'
import { Badge, Icon, PageHead, Panel, Input, Btn, T, WB, h } from '../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolLocalNote, toolMonoStyle, toolOutputBlock } from './shared-controls.js'

const toolPanes: any = {
    data:DataWorkbench,
    'http-debug':HttpDebugger,
    'mcp-debug':McpDebugger,
    pomodoro:ToolPomodoro,
    types:TypeGenerator, logs:LogAnalyzer,
    json: toolJsonPane,
    timestamp: toolTimestampPane,
    base64: toolBase64Pane,
    url: toolUrlPane,
    uuid: toolUuidPane,
    jwt: toolJwtPane,
    regex: toolRegexPane,
    diff: toolDiffPane,
    cron: toolCronPane,
    sql: toolSqlPane,
    yaml: toolYamlPane,
    csv: toolCsvPane,
    markdown: toolMarkdownPane,
    status: toolStatusPane,
    shell: toolShellPane,
    sqlexplain: toolSqlExplainPane,
};

/* --------------------------------------------------------------------- page */
function toolPage(): any {
    const [state, setState] = React.useState<any>(toolInitialState);
    const [paste,setPaste]=React.useState<any>(null);
    const [query,setQuery]=React.useState('');
    const [category,setCategory]=React.useState('常用');
    const [recent,setRecent]=React.useState<string[]>([]);
    const [pickerOpen,setPickerOpen]=React.useState(false);
    const pickerRef=React.useRef<any>(null),pickerDismissed=React.useRef(false);
    React.useEffect(()=>{if(!pickerOpen)return;const close=(e:any)=>{if(!pickerRef.current?.contains(e.target))setPickerOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[pickerOpen]);
    const common=['data','json','diff','http-debug','logs','regex','sql'];
    const categories:any={数据:['json','yaml','csv','types'],文本:['diff','markdown','regex'],网络:['data','http-debug','mcp-debug','url','status'],时间编码:['timestamp','cron','base64','jwt'],开发:['sql','sqlexplain','shell','uuid']};
    const visible=toolDefs.filter((item:any)=>item.group!=='focus'&&(!query?category==='全部'||(category==='常用'?common:categories[category]||[]).includes(item.id):[item.name,item.desc,item.id].join(' ').toLowerCase().includes(query.toLowerCase())));
    const selected = state.selected || 'data';
    const def = toolDefs.filter(function (item?: any): any {
        return item.id === selected;
    })[0] || toolDefs[0];
    const Pane = toolPanes[selected] || toolJsonPane;
    function patchFor(key?: any): any {
        return function (patch?: any): any {
            setState(function (previous?: any): any {
                const next = Object.assign({}, previous);
                next[key] = Object.assign({}, previous[key], patch);
                return next;
            });
        };
    }
    function selectTool(toolId?: any): any {
        pickerDismissed.current=true;setPickerOpen(false);pickerRef.current?.querySelector('.wb-tool-trigger')?.focus();
        setRecent(old=>[toolId,...old.filter(id=>id!==toolId)].slice(0,5));
        setState(function (previous?: any): any {
            return Object.assign({}, previous, { selected: toolId });
        });
    }
    const renderTool = function (item?: any): any {
        const active = selected === item.id;
        return h('button', {
            key: item.id,
            type: 'button',
            className: 'wb-tool' + (active ? ' is-active' : ''),
            'aria-pressed': active ? 'true' : 'false',
            onClick: function (): any {
                selectTool(item.id);
            },
        }, h('span', {
            className: 'wb-row',
            style: {
                gap: 6,
                alignItems: 'center',
                color: active ? T.accent : T.text2,
                fontSize: 12.5,
                fontWeight: 600,
            },
        }, h(Icon, { name: item.icon, size: 14 }), h('span', null, item.name)), h('span', null, item.desc));
    };
    return h('div', { className: 'wb-page wb-tools-page',onPasteCapture:(event:any)=>{const text=event.clipboardData?.getData('text/plain')||'';if(text.length>100000)return;let id='';if(/^curl\s/.test(text.trim()))id='http-debug';else if(/^\d{10}(\d{3})?$/.test(text.trim()))id='timestamp';else if(/^[\[{]/.test(text.trim())){try{JSON.parse(text);id='json'}catch{}}setPaste(id&&id!==selected?{id,text}:null)} }, h('style',null,TOOLBOX_CSS), h(PageHead, {
        icon: 'toolbox',
        title: '开发工具箱',
        actions: h('div',{className:'wb-tool-picker',ref:pickerRef,onMouseEnter:()=>{if(!pickerDismissed.current)setPickerOpen(true)},onMouseLeave:()=>{pickerDismissed.current=false;if(!pickerRef.current?.querySelector('.wb-tool-menu')?.contains(document.activeElement))setPickerOpen(false)},onBlur:(e:any)=>{if(!e.currentTarget.contains(e.relatedTarget))setPickerOpen(false)},onKeyDown:(e:any)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();pickerDismissed.current=true;setPickerOpen(false);pickerRef.current?.querySelector('.wb-tool-trigger')?.focus()}}},h('button',{type:'button',className:'wb-btn wb-tool-trigger','aria-label':'切换工具','aria-expanded':pickerOpen,'aria-controls':'wb-tool-options',onClick:()=>setPickerOpen(!pickerOpen)},'切换工具',h(Icon,{name:'chevronDown',size:12})),h('div',{id:'wb-tool-options',className:'wb-tool-menu',hidden:!pickerOpen},h(Panel, { title: '工具', icon: 'toolbox', flush: true }, h('div', { style: { padding: '0 12px 12px' } }, h(Input,{'aria-label':'搜索工具',placeholder:'搜索工具…',value:query,onChange:(e:any)=>setQuery(e.target.value)}),h('div',{className:'wb-row wb-row--wrap',style:{gap:4,margin:'8px 0'}},['常用','全部',...Object.keys(categories)].map(name=>h(Btn,{key:name,size:'sm',kind:category===name?'primary':'default',onClick:()=>{setCategory(name);setQuery('')}},name))),recent.length>0&&h('div',{className:'wb-row wb-row--wrap',style:{gap:4,marginBottom:8}},h('span',{className:'wb-tiny wb-muted'},'最近：'),recent.map(id=>h(Btn,{key:id,size:'sm',onClick:()=>selectTool(id)},toolDefs.find((d:any)=>d.id===id)?.name))), h('div', { className: 'wb-toolgrid', style: { gridTemplateColumns: 'minmax(0, 1fr)' } }, [...visible.map(renderTool),!visible.length&&h('p',{key:'empty',className:'wb-tiny wb-muted'},'没有匹配工具'), h('details',{key:'focus',className:'wb-tool-focus-group',style:{gridColumn:'1 / -1'}},h('summary',{style:{cursor:'pointer',padding:'10px 8px',fontSize:12,color:T.text2}},'专注与休息'),h('div',{className:'wb-toolgrid',style:{gridTemplateColumns:'minmax(0,1fr)'}},toolDefs.filter((item:any)=>item.group==='focus').map(renderTool)))]))))),
    }), paste&&h('div',{className:'wb-row wb-row--wrap',style:{marginBottom:10,gap:8}},h('span',{className:'wb-tiny'},'检测到 '+toolDefs.find((d:any)=>d.id===paste.id)?.name+' 内容'),h(Btn,{size:'sm',onClick:()=>{try{const data=paste.id==='http-debug'?{...importCurl(paste.text),curl:paste.text,result:null}:{input:paste.text};setState((old:any)=>({...old,[paste.id]:{...old[paste.id],...data},selected:paste.id}));setPaste(null)}catch(e){WB.toast((e as Error).message,'err')}}},'用对应工具打开'),h(Btn,{size:'sm',onClick:()=>setPaste(null)},'忽略')), h('div', {className:'wb-toolbox-layout'}, h(Panel, {
        className:'wb-tool-surface wb-tool-surface--'+selected,
        title: def.name,
        sub: def.desc,
        icon: def.icon,
        actions: h(Badge, { tone: 'ok' }, def.network?'宿主联网调试':'本地执行'),
    }, !def.network&&selected!=='pomodoro'&&h(toolLocalNote, null), selected!=='pomodoro'&&h('div',{className:'wb-tool-pane', 'data-tool':selected},h(Pane, {key:selected, value: state[selected] || {}, patch: patchFor(selected),onTransfer:(target:string,input:string)=>{setState((old:any)=>({...old,[target]:{...old[target],...(target==='diff'?{left:input,right:'',rows:[],stats:null}:{input})},selected:target}));setRecent(old=>[target,...old.filter(id=>id!==target)].slice(0,5))} })), h(ToolAI,{key:'ai-'+selected,id:selected,value:state[selected]||{},patch:patchFor(selected),onApply:patchFor(selected)}), h('div',{hidden:selected!=='pomodoro'},h(ToolPomodoro)))), h('p', { className: 'wb-tiny wb-muted', style: { marginTop: 14, lineHeight: 1.7 } }, '工具箱不读取 Host 数据；本地转换不联网。接口、MCP 与 AI 辅助仅在点击操作后访问对应服务；AI 问答会进入宿主助手历史。页面输入刷新后清空。'));
}

WB.pages.toolbox = toolPage;


export { toolDefs, toolInitialState, toolJsonError, toolJsonSummary, toolBase64Encode, toolBase64Decode, toolBase64UrlDecode, toolSafeDecode, toolParseQuery, toolUuidV4, toolJwtParse, toolJwtClaims, toolRegexMatches, toolDiffLines, toolCronFieldDefs, toolCronWeekday, toolCronValue, toolCronParseField, toolCronParse, toolCronValueText, toolCronDescribeField, toolCronNextTimes, toolSqlKeywords, toolSqlPhrases, toolSqlClauseWords, toolSqlContinuationWords, toolSqlTokenize, toolSqlMerge, toolSqlKeywordText, toolSqlFormat, toolErrorBlock, toolOutputBlock, toolCopyButton, toolLocalNote, toolMonoStyle, toolJsonPane, toolTimestampPane, toolBase64Pane, toolUrlPane, toolUuidPane, toolJwtPane, toolRegexPane, toolDiffPane, toolCronPane, toolSqlPane, toolPanes, toolPage }
