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
import { Badge, Icon, PageHead, Panel, T, WB, h } from '../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolLocalNote, toolMonoStyle, toolOutputBlock } from './shared-controls.js'

const toolPanes: any = {
    'http-debug':HttpDebugger,
    'mcp-debug':McpDebugger,
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
    const selected = state.selected || 'json';
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
        setState(function (previous?: any): any {
            return Object.assign({}, previous, { selected: toolId });
        });
    }
    return h('div', { className: 'wb-page' }, h(PageHead, {
        icon: 'toolbox',
        title: '开发工具箱',
        sub: toolDefs.length+' 项开发工具：离线处理与显式联网调试分开标注。',
    }), h('div', {
        className: 'wb-toolbox-layout',
        style: {
            display: 'grid',
            gridTemplateColumns: 'minmax(190px, 236px) minmax(0, 1fr)',
            gap: 14,
            alignItems: 'start',
        },
    }, h(Panel, { title: '工具', sub: '切换工具会保留各自输入', icon: 'toolbox', flush: true }, h('div', { style: { padding: '0 12px 12px' } }, h('div', { className: 'wb-toolgrid', style: { gridTemplateColumns: 'minmax(0, 1fr)' } }, toolDefs.map(function (item?: any): any {
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
    })))), h(Panel, {
        title: def.name,
        sub: def.desc,
        icon: def.icon,
        actions: h(Badge, { tone: 'ok' }, def.network?'宿主联网调试':'本地执行'),
    }, !def.network&&h(toolLocalNote, null), h(Pane, { value: state[selected] || {}, patch: patchFor(selected) }))), h('p', { className: 'wb-tiny wb-muted', style: { marginTop: 14, lineHeight: 1.7 } }, '离线工具箱不读取 Host 数据或发起网络请求；接口和 MCP 调试仅在点击发送后访问目标。输入不写入工作台，刷新后清空。'));
}

WB.pages.toolbox = toolPage;


export { toolDefs, toolInitialState, toolJsonError, toolJsonSummary, toolBase64Encode, toolBase64Decode, toolBase64UrlDecode, toolSafeDecode, toolParseQuery, toolUuidV4, toolJwtParse, toolJwtClaims, toolRegexMatches, toolDiffLines, toolCronFieldDefs, toolCronWeekday, toolCronValue, toolCronParseField, toolCronParse, toolCronValueText, toolCronDescribeField, toolCronNextTimes, toolSqlKeywords, toolSqlPhrases, toolSqlClauseWords, toolSqlContinuationWords, toolSqlTokenize, toolSqlMerge, toolSqlKeywordText, toolSqlFormat, toolErrorBlock, toolOutputBlock, toolCopyButton, toolLocalNote, toolMonoStyle, toolJsonPane, toolTimestampPane, toolBase64Pane, toolUrlPane, toolUuidPane, toolJwtPane, toolRegexPane, toolDiffPane, toolCronPane, toolSqlPane, toolPanes, toolPage }
