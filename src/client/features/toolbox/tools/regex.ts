import { Btn, Field, Input, T, Textarea, h } from '../../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolMonoStyle, toolOutputBlock } from '../shared-controls.js'

/* ------------------------------------------------------------------- regex */
function toolRegexMatches(pattern?: any, flags?: any, text?: any): any {
    if (!pattern)
        throw new Error('请输入正则表达式');
    const rawFlags = String(flags === undefined || flags === null ? '' : flags).trim();
    const allowed = 'dgimsuvy';
    const invalid = rawFlags.split('').filter(function (flag?: any): any {
        return allowed.indexOf(flag) < 0;
    });
    if (invalid.length)
        throw new Error('不支持的 flag：' + invalid.join('、') + '（可用 ' + allowed + '）');
    let withGlobal = rawFlags;
    if (withGlobal.indexOf('g') < 0 && withGlobal.indexOf('y') < 0)
        withGlobal += 'g';
    let regex;
    try {
        regex = new RegExp(pattern, withGlobal);
    }
    catch (error) {
        throw new Error('正则不合法：' + String((error && error.message) || error));
    }
    const source = String(text === undefined || text === null ? '' : text);
    const matches: any = [];
    let current: any;
    let guard = 0;
    while ((current = regex.exec(source)) !== null) {
        const groups: any = [];
        for (let index = 1; index < current.length; index += 1) {
            groups.push(current[index] === undefined ? '' : String(current[index]));
        }
        const named = current.groups
            ? Object.keys(current.groups).map(function (key?: any): any {
                return { key: key, value: current.groups[key] === undefined ? '' : String(current.groups[key]) };
            })
            : [];
        matches.push({
            index: current.index,
            end: current.index + current[0].length,
            text: current[0],
            groups: groups,
            named: named,
        });
        if (current[0] === '')
            regex.lastIndex += 1;
        guard += 1;
        if (guard >= 500)
            break;
        if (regex.lastIndex > source.length)
            break;
    }
    return matches;
}

function toolRegexPane(props?: any): any {
    const value = props.value || {};
    function run(): any {
        try {
            const matches = toolRegexMatches(value.pattern, value.flags, value.text);
            props.patch({ matches: matches, error: '', ran: true });
        }
        catch (error) {
            props.patch({ matches: [], error: String((error && error.message) || error), ran: true });
        }
    }
    const matches = Array.isArray(value.matches) ? value.matches : [];
    const copyText = matches
        .map(function (match?: any, index?: any): any {
        const groups = match.groups.length ? '  组：' + match.groups.join(' | ') : '';
        return '#' + (index + 1) + ' @' + match.index + ' ' + JSON.stringify(match.text) + groups;
    })
        .join('\n');
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-split' }, h(Field, { label: '模式' }, h(Input, {
        value: value.pattern || '',
        spellCheck: false,
        style: { fontFamily: T.font.mono, fontSize: 12 },
        placeholder: '(\\w+)@(\\w+\\.\\w+)',
        onChange: function (event?: any): any {
            props.patch({ pattern: event.target.value });
        },
    })), h(Field, { label: 'Flags', hint: '可用 d g i m s u v y；缺少 g 时自动补齐' }, h(Input, {
        value: value.flags || '',
        spellCheck: false,
        style: { fontFamily: T.font.mono, fontSize: 12 },
        placeholder: 'gi',
        onChange: function (event?: any): any {
            props.patch({ flags: event.target.value });
        },
    }))), h(Field, { label: '测试文本' }, h(Textarea, {
        value: value.text || '',
        rows: 5,
        spellCheck: false,
        style: toolMonoStyle(110),
        placeholder: '粘贴要匹配的文本',
        onChange: function (event?: any): any {
            props.patch({ text: event.target.value });
        },
    })), h('div', { className: 'wb-row', style: { gap: 6 } }, h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'filter',
        onClick: run,
        children: '匹配',
    }), h('div', { className: 'wb-spacer' }), h(toolCopyButton, { text: copyText })), h(toolErrorBlock, { text: value.error }), matches.length
        ? h('div', { className: 'wb-stack', style: { gap: 6 } }, h('div', { className: 'wb-tiny wb-muted' }, '共 ' + matches.length + ' 处匹配'), h('table', { className: 'wb-table' }, h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, '位置'), h('th', null, '匹配'), h('th', null, '捕获组'))), h('tbody', null, matches.map(function (match?: any, index?: any): any {
            const groups = match.groups.length
                ? match.groups
                    .map(function (group?: any, groupIndex?: any): any {
                    return '$' + (groupIndex + 1) + ' ' + (group === '' ? '（空）' : group);
                })
                    .join('  ')
                : '—';
            const named = match.named.length
                ? '  ' +
                    match.named
                        .map(function (entry?: any): any {
                        return entry.key + '=' + entry.value;
                    })
                        .join('  ')
                : '';
            return h('tr', { key: 'match-' + index }, h('td', { className: 'wb-mono' }, String(index + 1)), h('td', { className: 'wb-mono' }, match.index + '–' + match.end), h('td', { className: 'wb-mono', style: { overflowWrap: 'anywhere' } }, match.text), h('td', { className: 'wb-mono wb-muted', style: { overflowWrap: 'anywhere' } }, groups + named));
        }))))
        : value.ran
            ? h(toolOutputBlock, { text: '', placeholder: '没有匹配（0 处）' })
            : h(toolOutputBlock, { text: '', placeholder: '匹配结果会显示在这里' }));
}
export { toolRegexMatches, toolRegexPane }
