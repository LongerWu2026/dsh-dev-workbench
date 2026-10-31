import { Btn, Field, Textarea, h } from '../../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolMonoStyle, toolOutputBlock } from '../shared-controls.js'

/* --------------------------------------------------------------------- SQL */
const toolSqlKeywords: any = {
    select: 1, from: 1, where: 1, and: 1, or: 1, not: 1, insert: 1, into: 1, values: 1,
    update: 1, set: 1, delete: 1, join: 1, left: 1, right: 1, inner: 1, outer: 1, full: 1,
    cross: 1, on: 1, group: 1, by: 1, order: 1, having: 1, limit: 1, offset: 1, union: 1,
    all: 1, distinct: 1, as: 1, case: 1, when: 1, then: 1, else: 1, end: 1, like: 1, in: 1,
    is: 1, null: 1, create: 1, table: 1, view: 1, index: 1, drop: 1, alter: 1, add: 1,
    column: 1, primary: 1, key: 1, foreign: 1, references: 1, default: 1, constraint: 1,
    unique: 1, check: 1, returning: 1, with: 1, asc: 1, desc: 1, exists: 1, between: 1,
    cast: 1, using: 1, replace: 1, truncate: 1, explain: 1, analyze: 1, begin: 1, commit: 1,
    rollback: 1, transaction: 1, grant: 1, revoke: 1, to: 1, if: 1, over: 1, partition: 1,
};

const toolSqlPhrases: any = [
    ['left', 'outer', 'join', 'LEFT OUTER JOIN'],
    ['right', 'outer', 'join', 'RIGHT OUTER JOIN'],
    ['full', 'outer', 'join', 'FULL OUTER JOIN'],
    ['left', 'join', 'LEFT JOIN'],
    ['right', 'join', 'RIGHT JOIN'],
    ['inner', 'join', 'INNER JOIN'],
    ['full', 'join', 'FULL JOIN'],
    ['cross', 'join', 'CROSS JOIN'],
    ['group', 'by', 'GROUP BY'],
    ['order', 'by', 'ORDER BY'],
    ['union', 'all', 'UNION ALL'],
    ['insert', 'into', 'INSERT INTO'],
    ['delete', 'from', 'DELETE FROM'],
    ['is', 'not', 'IS NOT'],
    ['not', 'in', 'NOT IN'],
    ['not', 'like', 'NOT LIKE'],
];

const toolSqlClauseWords: any = {
    select: 1, from: 1, where: 1, 'group by': 1, 'order by': 1, having: 1, limit: 1, offset: 1,
    union: 1, 'union all': 1, 'insert into': 1, values: 1, update: 1, set: 1, 'delete from': 1,
    returning: 1, join: 1, 'left join': 1, 'right join': 1, 'inner join': 1, 'full join': 1,
    'cross join': 1, 'left outer join': 1, 'right outer join': 1, 'full outer join': 1,
    with: 1, create: 1, alter: 1, drop: 1, truncate: 1,
};

const toolSqlContinuationWords: any = { and: 1, or: 1, on: 1 };

function toolSqlTokenize(sql?: any): any {
    const text = String(sql === undefined || sql === null ? '' : sql);
    const tokens: any = [];
    let index = 0;
    while (index < text.length) {
        const char = text[index];
        if (char === "'" || char === '"' || char === '`') {
            let end = index + 1;
            while (end < text.length) {
                if (text[end] === char) {
                    if (text[end + 1] === char) {
                        end += 2;
                        continue;
                    }
                    end += 1;
                    break;
                }
                end += 1;
            }
            tokens.push({ type: 'literal', value: text.slice(index, end) });
            index = end;
            continue;
        }
        if (char === '-' && text[index + 1] === '-') {
            let end = text.indexOf('\n', index);
            if (end < 0)
                end = text.length;
            tokens.push({ type: 'comment', value: text.slice(index, end) });
            index = end;
            continue;
        }
        if (char === '/' && text[index + 1] === '*') {
            let end = text.indexOf('*/', index + 2);
            end = end < 0 ? text.length : end + 2;
            tokens.push({ type: 'comment', value: text.slice(index, end) });
            index = end;
            continue;
        }
        if (/\s/.test(char)) {
            index += 1;
            continue;
        }
        if (/[A-Za-z_@$\u4e00-\u9fff]/.test(char)) {
            let end = index;
            while (end < text.length && /[A-Za-z0-9_@$#\u4e00-\u9fff]/.test(text[end]))
                end += 1;
            tokens.push({ type: 'word', value: text.slice(index, end) });
            index = end;
            continue;
        }
        if (/[0-9]/.test(char)) {
            let end = index;
            while (end < text.length && /[0-9.]/.test(text[end]))
                end += 1;
            tokens.push({ type: 'number', value: text.slice(index, end) });
            index = end;
            continue;
        }
        const two = text.slice(index, index + 2);
        if (['<=', '>=', '<>', '!=', '||', '::', '->', '=>'].indexOf(two) >= 0) {
            tokens.push({ type: 'punct', value: two });
            index += 2;
            continue;
        }
        tokens.push({ type: 'punct', value: char });
        index += 1;
    }
    return tokens;
}

function toolSqlMerge(tokens?: any): any {
    const output: any = [];
    let index = 0;
    while (index < tokens.length) {
        const token = tokens[index];
        if (token.type === 'word') {
            let matched: any = null;
            for (let phraseIndex = 0; phraseIndex < toolSqlPhrases.length; phraseIndex += 1) {
                const phrase = toolSqlPhrases[phraseIndex];
                const words = phrase.slice(0, phrase.length - 1);
                const value = phrase[phrase.length - 1];
                let ok = true;
                for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
                    const candidate = tokens[index + wordIndex];
                    if (!candidate || candidate.type !== 'word' || candidate.value.toLowerCase() !== words[wordIndex]) {
                        ok = false;
                        break;
                    }
                }
                if (ok) {
                    matched = { value: value, length: words.length };
                    break;
                }
            }
            if (matched) {
                output.push({ type: 'word', value: matched.value });
                index += matched.length;
                continue;
            }
        }
        output.push(token);
        index += 1;
    }
    return output;
}

function toolSqlKeywordText(token?: any): any {
    const value = String(token.value);
    if (token.type !== 'word')
        return value;
    if (/^[A-Z][A-Z ]+$/.test(value))
        return value;
    const lower = value.toLowerCase();
    if (toolSqlKeywords[lower] !== undefined)
        return value.toUpperCase();
    return value;
}

function toolSqlFormat(sql?: any): any {
    const tokens = toolSqlTokenize(sql);
    if (!tokens.length)
        throw new Error('请输入要美化的 SQL');
    const merged = toolSqlMerge(tokens);
    const lines: any = [''];
    let depth = 0;
    let inSelect = false;
    function append(text?: any, noSpace?: any): any {
        const lineIndex = lines.length - 1;
        const line = lines[lineIndex];
        const trimmed = line.trim();
        let separator = '';
        if (!noSpace && trimmed !== '' && !/[(.[]$/.test(trimmed) && !/^[,.;:)\]]/.test(text))
            separator = ' ';
        lines[lineIndex] = line + separator + text;
    }
    function newLine(level?: any): any {
        if (lines[lines.length - 1].trim() === '')
            return;
        lines.push('  '.repeat(Math.max(0, level)));
    }
    for (let index = 0; index < merged.length; index += 1) {
        const token = merged[index];
        if (token.type === 'comment') {
            newLine(depth);
            append(String(token.value), true);
            if (index < merged.length - 1)
                newLine(depth);
            continue;
        }
        if (token.type === 'punct') {
            const value = String(token.value);
            if (value === '(') {
                const lastLine = lines[lines.length - 1];
                const trimmed = lastLine.trim();
                const lastWordMatch = /([A-Za-z_][\w$]*)$/.exec(trimmed);
                const lastWord = lastWordMatch ? lastWordMatch[1].toLowerCase() : '';
                const spaced = toolSqlKeywords[lastWord] !== undefined ||
                    toolSqlContinuationWords[lastWord] !== undefined ||
                    /[=<>+\-*/|]$/.test(trimmed);
                append(value, !spaced);
                depth += 1;
                continue;
            }
            if (value === ')') {
                depth = Math.max(0, depth - 1);
                append(value, true);
                continue;
            }
            if (value === ',') {
                append(value, true);
                if (inSelect && depth === 0)
                    newLine(1);
                continue;
            }
            if (value === ';') {
                append(value, true);
                if (index < merged.length - 1)
                    newLine(0);
                continue;
            }
            append(value, value === '::');
            continue;
        }
        const lower = String(token.value).toLowerCase();
        if (token.type === 'word' && toolSqlClauseWords[lower] !== undefined) {
            const last = lines[lines.length - 1];
            if (last.trim() !== '' && !/\($/.test(last.trim()))
                newLine(depth);
            inSelect = lower === 'select';
            append(toolSqlKeywordText(token), false);
            continue;
        }
        if (token.type === 'word' && toolSqlContinuationWords[lower] !== undefined) {
            newLine(depth + 1);
            append(toolSqlKeywordText(token), false);
            continue;
        }
        append(toolSqlKeywordText(token), false);
    }
    const result: any = [];
    lines.forEach(function (line?: any): any {
        const text = line.replace(/\s+$/, '');
        if (text === '' && (result.length === 0 || result[result.length - 1] === ''))
            return;
        result.push(text);
    });
    while (result.length && result[result.length - 1] === '')
        result.pop();
    return result.join('\n');
}

function toolSqlPane(props?: any): any {
    const value = props.value || {};
    function run(): any {
        try {
            const output = toolSqlFormat(value.input);
            props.patch({ output: output, error: '' });
        }
        catch (error) {
            props.patch({ output: '', error: String((error && error.message) || error) });
        }
    }
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-split' }, h(Field, { label: '输入 SQL', hint: '只做文本美化，不连接数据库、不执行语句' }, h(Textarea, {
        value: value.input || '',
        rows: 12,
        spellCheck: false,
        style: toolMonoStyle(220),
        placeholder: '粘贴 SQL',
        onChange: function (event?: any): any {
            props.patch({ input: event.target.value });
        },
    })), h('div', { className: 'wb-stack', style: { gap: 8 } }, h('div', { className: 'wb-row', style: { gap: 6 } }, h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'database',
        onClick: run,
        children: '美化',
    }), h('div', { className: 'wb-spacer' }), h(Btn,{size:'sm',onClick:()=>props.onTransfer?.('sqlexplain',value.input||'')},'解读执行计划'),h(toolCopyButton, { text: value.output })), h(toolErrorBlock, { text: value.error }), h(toolOutputBlock, { text: value.output, placeholder: '关键字大写 + 子句换行后的 SQL' }))));
}
export { toolSqlKeywords, toolSqlPhrases, toolSqlClauseWords, toolSqlContinuationWords, toolSqlTokenize, toolSqlMerge, toolSqlKeywordText, toolSqlFormat, toolSqlPane }
