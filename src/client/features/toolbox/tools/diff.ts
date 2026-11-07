import { useMemo } from 'react'
import { jsonChanges } from './developer-utils.js'
import { toolDiffInline, toolDiffLines, toolDiffPairs } from './diff-model.js'
import { Badge, Btn, Field, Textarea, h } from '../../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolMonoStyle, toolOutputBlock } from '../shared-controls.js'

function toolDiffPane(props?: any): any {
    const value = props.value || {};
    function run(): void {
        try {
            let result: any;
            if (value.jsonMode) {
                const changes = jsonChanges(JSON.parse(value.left), JSON.parse(value.right));
                result = {
                    rows: changes.map((change: any) => ({
                        type: change.type,
                        text: change.path + ': ' + (change.type === 'add' ? JSON.stringify(change.after) : JSON.stringify(change.before) + (change.type === 'change' ? ' → ' + JSON.stringify(change.after) : '')),
                        leftText: change.path + ': ' + JSON.stringify(change.before),
                        rightText: change.path + ': ' + JSON.stringify(change.after),
                    })),
                    stats: {added: changes.filter((c: any) => c.type === 'add').length, removed: changes.filter((c: any) => c.type === 'del').length, same: 0, changed: changes.filter((c: any) => c.type === 'change').length},
                };
            } else result = toolDiffLines(value.left, value.right, !!value.ignoreWhitespace);
            props.patch({...result, error: '', ran: true});
        } catch (error) {
            props.patch({rows: [], stats: null, error: String((error && error.message) || error), ran: true});
        }
    }
    const rows = Array.isArray(value.rows) ? value.rows : [];
    const stats = value.stats;
    const pairs = useMemo(() => toolDiffPairs(rows, !!value.jsonMode).map(pair => ({...pair,
        parts: pair.type === 'change' ? toolDiffInline(pair.left.text, pair.right.text) : {left: [{text: pair.left?.text || ' ', changed: false}], right: [{text: pair.right?.text || ' ', changed: false}]},
    })), [value.rows, value.jsonMode]);
    const copyText = rows.map((row: any) => (row.type === 'add' ? '+ ' : row.type === 'del' ? '- ' : row.type === 'change' ? '~ ' : '  ') + row.text).join('\n');
    function cell(pair: any, side: 'left' | 'right', parts: any[]): any {
        const entry = pair[side];
        const tone = !entry ? 'empty' : pair.type === 'same' ? 'same' : side === 'left' ? 'del' : 'add';
        return h('div', {className: 'wb-diff-cell wb-diff-cell--' + tone, 'data-side': side},
            h('span', {className: 'wb-diff-line', 'aria-label': entry && !value.jsonMode ? (side === 'left' ? '原文第 ' : '修改后第 ') + entry.line + ' 行' : undefined}, entry && !value.jsonMode ? entry.line : ''),
            h('span', {className: 'wb-diff-sign', 'aria-hidden': true}, tone === 'del' ? '−' : tone === 'add' ? '+' : ''),
            h('span', {className: 'wb-diff-text'}, entry ? parts.map((part, index) => h(part.changed ? 'mark' : 'span', {key: index}, part.text)) : h('span', {className: 'wb-diff-gap', 'aria-label': '此侧无对应行'}, ' ')));
    }
    return h('div', {className: 'wb-stack wb-tool-diff'},
        h('div', {className: 'wb-diff-inputs'}, ...(['left', 'right'] as const).map(side => h(Field, {key: side, label: side === 'left' ? '原始文本' : '修改后文本'}, h(Textarea, {
            'aria-label': side === 'left' ? '原始文本' : '修改后文本',
            value: value[side] || '', rows: 7, spellCheck: false, style: toolMonoStyle(120),
            onChange: (event: any) => props.patch({[side]: event.target.value}),
        })))),
        h('div', {className: 'wb-row wb-row--wrap wb-diff-actions', style: {gap: 8}},
            h('label', null, h('input', {type: 'checkbox', checked: !!value.jsonMode, onChange: (e: any) => props.patch({jsonMode: e.target.checked, rows: [], stats: null, ran: false})}), 'JSON 结构对比（忽略键顺序）'),
            h('label', null, h('input', {type: 'checkbox', checked: !!value.ignoreWhitespace, disabled: !!value.jsonMode, onChange: (e: any) => props.patch({ignoreWhitespace: e.target.checked})}), '忽略行首尾空白'),
            h(Btn, {size: 'sm', kind: 'primary', icon: 'git', onClick: run, children: '对比'}),
            stats ? h('div', {className: 'wb-row wb-row--wrap', style: {gap: 6}}, h(Badge, {tone: 'ok'}, '+' + stats.added), h(Badge, {tone: 'err'}, '-' + stats.removed), h(Badge, {tone: 'idle'}, stats.changed !== undefined ? '修改 ' + stats.changed : '=' + stats.same)) : null,
            h('div', {className: 'wb-spacer'}), h(toolCopyButton, {text: copyText})),
        h(toolErrorBlock, {text: value.error}),
        rows.length ? h('div', {className: 'wb-tool-output wb-diff-result', tabIndex: 0, role: 'region', 'aria-label': '左右逐行对比结果，可滚动'},
            h('div', {className: 'wb-diff-head'}, h('span', null, '原始文本'), h('span', null, '修改后文本')),
            pairs.map((pair, index) => h('div', {key: index, className: 'wb-diff-pair', 'data-change': pair.type}, cell(pair, 'left', pair.parts.left), cell(pair, 'right', pair.parts.right))))
            : h(toolOutputBlock, {text: '', placeholder: value.ran ? '两段文本没有差异' : '点击对比，左右逐行查看差异'}));
}
export { toolDiffLines, toolDiffPane }
