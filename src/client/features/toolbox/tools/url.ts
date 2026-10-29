import { Btn, Field, Segmented, Textarea, h } from '../../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolMonoStyle, toolOutputBlock } from '../shared-controls.js'

/* --------------------------------------------------------------------- URL */
function toolSafeDecode(value?: any): any {
    try {
        return decodeURIComponent(String(value).replace(/\+/g, ' '));
    }
    catch (error) {
        return String(value);
    }
}

function toolParseQuery(text?: any): any {
    const source = String(text === undefined || text === null ? '' : text);
    const mark = source.indexOf('?');
    let query = mark >= 0 ? source.slice(mark + 1) : source;
    const hash = query.indexOf('#');
    if (hash >= 0)
        query = query.slice(0, hash);
    if (!query)
        return [];
    return query
        .split('&')
        .filter(function (pair?: any): any {
        return pair.length > 0;
    })
        .map(function (pair?: any, index?: any): any {
        const eq = pair.indexOf('=');
        const rawKey = eq >= 0 ? pair.slice(0, eq) : pair;
        const rawValue = eq >= 0 ? pair.slice(eq + 1) : '';
        return {
            index: index,
            key: toolSafeDecode(rawKey),
            value: toolSafeDecode(rawValue),
            raw: pair,
        };
    });
}

function toolUrlPane(props?: any): any {
    const value = props.value || {};
    function run(): any {
        const input = String(value.input || '');
        if (!input.trim()) {
            props.patch({ output: '', error: '请输入要编解码的文本', rows: [] });
            return;
        }
        try {
            const output = value.mode === 'decode' ? decodeURIComponent(input) : encodeURIComponent(input);
            props.patch({ output: output, error: '', rows: toolParseQuery(input) });
        }
        catch (error) {
            props.patch({
                output: '',
                error: '不是合法的 URL 编码：' + String((error && error.message) || error),
                rows: [],
            });
        }
    }
    const rows = Array.isArray(value.rows) ? value.rows : [];
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-row wb-row--wrap', style: { gap: 8 } }, h(Segmented, {
        items: [
            { value: 'encode', label: 'encodeURIComponent' },
            { value: 'decode', label: 'decodeURIComponent' },
        ],
        value: value.mode || 'encode',
        onChange: function (mode?: any): any {
            props.patch({ mode: mode, output: '', error: '', rows: [] });
        },
    })), h('div', { className: 'wb-split' }, h(Field, { label: '输入 URL 或文本' }, h(Textarea, {
        value: value.input || '',
        rows: 6,
        spellCheck: false,
        style: toolMonoStyle(120),
        placeholder: 'https://example.com/search?q=开发 工具&page=2',
        onChange: function (event?: any): any {
            props.patch({ input: event.target.value });
        },
    })), h('div', { className: 'wb-stack', style: { gap: 8 } }, h('div', { className: 'wb-row', style: { gap: 6 } }, h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'link',
        onClick: run,
        children: value.mode === 'decode' ? '解码' : '编码',
    }), h('div', { className: 'wb-spacer' }), h(toolCopyButton, { text: value.output })), h(toolErrorBlock, { text: value.error }), h(toolOutputBlock, { text: value.output, placeholder: '编码 / 解码结果' }))), rows.length
        ? h('div', null, h('div', { className: 'wb-tiny wb-muted', style: { marginBottom: 4 } }, 'Query 参数拆解'), h('table', { className: 'wb-table' }, h('thead', null, h('tr', null, h('th', null, '参数'), h('th', null, '解码后的值'), h('th', null, '原始片段'))), h('tbody', null, rows.map(function (row?: any): any {
            return h('tr', { key: 'query-' + row.index }, h('td', { className: 'wb-mono' }, row.key), h('td', { className: 'wb-mono', style: { overflowWrap: 'anywhere' } }, row.value), h('td', { className: 'wb-mono wb-muted' }, row.raw));
        }))))
        : null);
}
export { toolSafeDecode, toolParseQuery, toolUrlPane }
