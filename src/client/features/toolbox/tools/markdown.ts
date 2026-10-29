import * as React from 'react'
import { Field, T, Textarea, h } from '../../../core/runtime.js'
import { toolMonoStyle } from '../shared-controls.js'

/* -------------------------------------------------------------- Markdown */
function mdInline(text?: any, keyPrefix?: any): any {
    const nodes: any = [];
    let rest = String(text);
    let key = 0;
    const push = function (node?: any): any {
        nodes.push(h(React.Fragment, { key: keyPrefix + '-' + key++ }, node));
    };
    while (rest.length > 0) {
        let match = /^\*\*([^*]+)\*\*/.exec(rest);
        if (match) {
            push(h('strong', null, match[1]));
            rest = rest.slice(match[0].length);
            continue;
        }
        match = /^`([^`]+)`/.exec(rest);
        if (match) {
            push(h('code', { style: { background: T.layer2, borderRadius: 4, padding: '1px 4px', fontFamily: T.font.mono, fontSize: 11.5 } }, match[1]));
            rest = rest.slice(match[0].length);
            continue;
        }
        match = /^\*([^*]+)\*/.exec(rest);
        if (match) {
            push(h('em', null, match[1]));
            rest = rest.slice(match[0].length);
            continue;
        }
        match = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
        if (match) {
            push(h('a', { href: /^https?:\/\//i.test(match[2]) ? match[2] : '#', target: '_blank', rel: 'noreferrer noopener', className: 'wb-link' }, match[1]));
            rest = rest.slice(match[0].length);
            continue;
        }
        // 普通字符：吃到下一个可能的标记
        const nextMark = rest.slice(1).search(/[\*`\[]/);
        const take = nextMark < 0 ? rest.length : nextMark + 1;
        push(rest.slice(0, take));
        rest = rest.slice(take);
    }
    return nodes;
}

function mdParse(text?: any): any {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    const blocks: any = [];
    let index = 0;
    while (index < lines.length) {
        const line = lines[index];
        if (/^\s*$/.test(line)) {
            index += 1;
            continue;
        }
        const fence = /^```(\w*)\s*$/.exec(line);
        if (fence) {
            const code: any = [];
            index += 1;
            while (index < lines.length && !/^```\s*$/.test(lines[index])) {
                code.push(lines[index]);
                index += 1;
            }
            index += 1;
            blocks.push({ type: 'code', lang: fence[1], text: code.join('\n') });
            continue;
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
            blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
            index += 1;
            continue;
        }
        if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
            blocks.push({ type: 'hr' });
            index += 1;
            continue;
        }
        if (/^>\s?/.test(line)) {
            const quote: any = [];
            while (index < lines.length && /^>\s?/.test(lines[index])) {
                quote.push(lines[index].replace(/^>\s?/, ''));
                index += 1;
            }
            blocks.push({ type: 'quote', text: quote.join(' ') });
            continue;
        }
        if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
            const ordered = /^\s*\d+\.\s+/.test(line);
            const items: any = [];
            while (index < lines.length && (/^\s*[-*+]\s+/.test(lines[index]) || /^\s*\d+\.\s+/.test(lines[index]))) {
                items.push(lines[index].replace(/^\s*(?:[-*+]|\d+\.)\s+/, ''));
                index += 1;
            }
            blocks.push({ type: 'list', ordered: ordered, items: items });
            continue;
        }
        const paragraph: any = [];
        while (index < lines.length &&
            !/^\s*$/.test(lines[index]) &&
            !/^(#{1,6})\s+/.test(lines[index]) &&
            !/^```/.test(lines[index]) &&
            !/^>\s?/.test(lines[index]) &&
            !/^\s*[-*+]\s+/.test(lines[index]) &&
            !/^\s*\d+\.\s+/.test(lines[index])) {
            paragraph.push(lines[index]);
            index += 1;
        }
        blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    }
    return blocks;
}

function toolMarkdownPane(props?: any): any {
    const value = props.value || {};
    const blocks = mdParse(String(value.input || ''));
    const headingSize = function (level?: any): any {
        return [22, 19, 17, 15, 14, 13.5][Math.min(5, level - 1)];
    };
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-split' }, h(Field, { label: 'Markdown 输入' }, h(Textarea, {
        value: value.input || '',
        style: toolMonoStyle(240),
        placeholder: '# 标题\n\n**加粗** 与 `代码`\n\n- 列表项',
        onChange: function (event?: any): any {
            props.patch({ input: event.target.value });
        },
    })), h(Field, { label: '预览' }, h('div', {
        style: {
            minHeight: 240,
            maxHeight: 420,
            overflow: 'auto',
            padding: '12px 14px',
            border: '1px solid ' + T.border1,
            borderRadius: 10,
            background: T.bg,
            fontSize: 12.5,
            lineHeight: 1.7,
        },
    }, blocks.length === 0
        ? h('span', { className: 'wb-tiny wb-muted' }, '输入 Markdown 后这里显示渲染结果')
        : blocks.map(function (block?: any, blockIndex?: any): any {
            const key = 'b' + blockIndex;
            if (block.type === 'heading') {
                return h('div', {
                    key: key,
                    style: {
                        fontSize: headingSize(block.level),
                        fontWeight: 600,
                        margin: blockIndex === 0 ? '0 0 8px' : '14px 0 6px',
                        color: T.text,
                    },
                }, mdInline(block.text, key));
            }
            if (block.type === 'code') {
                return h('pre', { key: key, className: 'wb-code', style: { margin: '8px 0' } }, block.text);
            }
            if (block.type === 'hr') {
                return h('hr', { key: key, className: 'wb-divider', style: { margin: '12px 0' } });
            }
            if (block.type === 'quote') {
                return h('blockquote', {
                    key: key,
                    style: {
                        margin: '8px 0',
                        padding: '2px 0 2px 10px',
                        borderLeft: '3px solid ' + T.border2,
                        color: T.text2,
                    },
                }, mdInline(block.text, key));
            }
            if (block.type === 'list') {
                const listTag = block.ordered ? 'ol' : 'ul';
                return h(listTag, { key: key, style: { margin: '8px 0', paddingLeft: 22 } }, block.items.map(function (item?: any, itemIndex?: any): any {
                    return h('li', { key: key + '-' + itemIndex, style: { margin: '2px 0' } }, mdInline(item, key + '-' + itemIndex));
                }));
            }
            return h('p', { key: key, style: { margin: '8px 0' } }, mdInline(block.text, key));
        })))), h('p', { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.7 } }, '支持标题、粗体/斜体、行内代码、代码块、列表、引用、链接、分割线。' +
        '预览用 React 元素构造而非 innerHTML，输入里的 HTML 标签会当作纯文本显示。'));
}
export { mdInline, mdParse, toolMarkdownPane }
