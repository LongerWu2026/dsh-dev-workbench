import {jsonChanges} from './developer-utils.js'
import { Badge, Btn, Field, T, Textarea, h } from '../../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolMonoStyle, toolOutputBlock } from '../shared-controls.js'

/* -------------------------------------------------------------------- diff */
function toolDiffLines(leftText?: any, rightText?: any): any {
    const left = String(leftText === undefined || leftText === null ? '' : leftText).split('\n');
    const right = String(rightText === undefined || rightText === null ? '' : rightText).split('\n');
    if (left.length > 400 || right.length > 400) {
        throw new Error('行数过多（上限 400 行）：当前 ' + left.length + ' / ' + right.length + ' 行，请缩小对比范围');
    }
    const rows: any = [];
    const stats: any = { added: 0, removed: 0, same: 0 };
    const matrix: any = [];
    for (let row = 0; row <= left.length; row += 1)
        matrix.push(new Uint16Array(right.length + 1));
    for (let i = left.length - 1; i >= 0; i -= 1) {
        for (let j = right.length - 1; j >= 0; j -= 1) {
            matrix[i][j] =
                left[i] === right[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
        }
    }
    let i = 0;
    let j = 0;
    while (i < left.length && j < right.length) {
        if (left[i] === right[j]) {
            rows.push({ type: 'same', text: left[i] });
            stats.same += 1;
            i += 1;
            j += 1;
        }
        else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
            rows.push({ type: 'del', text: left[i] });
            stats.removed += 1;
            i += 1;
        }
        else {
            rows.push({ type: 'add', text: right[j] });
            stats.added += 1;
            j += 1;
        }
    }
    while (i < left.length) {
        rows.push({ type: 'del', text: left[i] });
        stats.removed += 1;
        i += 1;
    }
    while (j < right.length) {
        rows.push({ type: 'add', text: right[j] });
        stats.added += 1;
        j += 1;
    }
    return { rows: rows, stats: stats };
}

function toolDiffPane(props?: any): any {
    const value = props.value || {};
    function run(): any {
        try {
            let left=value.left,right=value.right;
            if(value.jsonMode){const changes=jsonChanges(JSON.parse(left),JSON.parse(right));const rows=changes.map((c:any)=>({type:c.type==='add'?'add':'del',text:c.path+': '+(c.type==='add'?JSON.stringify(c.after):JSON.stringify(c.before)+(c.type==='change'?' → '+JSON.stringify(c.after):''))}));props.patch({rows,stats:{added:changes.filter((c:any)=>c.type==='add').length,removed:changes.filter((c:any)=>c.type==='del').length,same:0,changed:changes.filter((c:any)=>c.type==='change').length},error:'',ran:true});return}
            if(value.ignoreWhitespace){left=left.split('\n').map((line:string)=>line.trim()).join('\n');right=right.split('\n').map((line:string)=>line.trim()).join('\n')}
            const result = toolDiffLines(left, right);
            props.patch({ rows: result.rows, stats: result.stats, error: '', ran: true });
        }
        catch (error) {
            props.patch({ rows: [], stats: null, error: String((error && error.message) || error), ran: true });
        }
    }
    const rows = Array.isArray(value.rows) ? value.rows : [];
    const stats = value.stats;
    const copyText = rows
        .map(function (row?: any): any {
        return (row.type === 'add' ? '+ ' : row.type === 'del' ? '- ' : '  ') + row.text;
    })
        .join('\n');
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-split' }, h(Field, { label: '原始文本' }, h(Textarea, {
        value: value.left || '',
        rows: 7,
        spellCheck: false,
        style: toolMonoStyle(120),
        onChange: function (event?: any): any {
            props.patch({ left: event.target.value });
        },
    })), h(Field, { label: '修改后文本' }, h(Textarea, {
        value: value.right || '',
        rows: 7,
        spellCheck: false,
        style: toolMonoStyle(120),
        onChange: function (event?: any): any {
            props.patch({ right: event.target.value });
        },
    }))), h('div', { className: 'wb-row wb-row--wrap', style: { gap: 8 } }, h('label',null,h('input',{type:'checkbox',checked:!!value.jsonMode,onChange:(e:any)=>props.patch({jsonMode:e.target.checked,rows:[],stats:null})}),'JSON 结构对比（忽略键顺序）'),h('label',null,h('input',{type:'checkbox',checked:!!value.ignoreWhitespace,disabled:!!value.jsonMode,onChange:(e:any)=>props.patch({ignoreWhitespace:e.target.checked})}),'忽略行首尾空白'),h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'git',
        onClick: run,
        children: '对比',
    }), stats
        ? h('div', { className: 'wb-row wb-row--wrap', style: { gap: 6 } }, h(Badge, { tone: 'ok' }, '+' + stats.added), h(Badge, { tone: 'err' }, '-' + stats.removed), h(Badge, { tone: 'idle' }, stats.changed!==undefined?'修改 '+stats.changed:'=' + stats.same))
        : null, h('div', { className: 'wb-spacer' }), h(toolCopyButton, { text: copyText })), h(toolErrorBlock, { text: value.error }), rows.length
        ? h('div', { className: 'wb-code', style: { padding: '4px 0', maxHeight: 360, overflow: 'auto' } }, rows.map(function (row?: any, index?: any): any {
            const isAdd = row.type === 'add';
            const isDel = row.type === 'del';
            const color = isAdd ? T.ok : isDel ? T.err : T.text2;
            return h('div', {
                key: 'diff-' + index,
                style: {
                    display: 'flex',
                    gap: 8,
                    padding: '1px 10px',
                    color: color,
                    background: isAdd
                        ? 'color-mix(in srgb, ' + T.ok + ' 12%, transparent)'
                        : isDel
                            ? 'color-mix(in srgb, ' + T.err + ' 12%, transparent)'
                            : 'transparent',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                },
            }, h('span', { className: 'wb-mono', style: { flex: '0 0 40px', textAlign: 'right', opacity: 0.55 } }, String(index + 1)), h('span', { className: 'wb-mono', style: { flex: '0 0 10px' } }, isAdd ? '+' : isDel ? '-' : ' '), h('span', { className: 'wb-mono', style: { minWidth: 0 } }, row.text === '' ? ' ' : row.text));
        }))
        : h(toolOutputBlock, {
            text: '',
            placeholder: value.ran ? '两段文本没有差异' : '逐行 LCS 对比结果会显示在这里',
        }));
}
export { toolDiffLines, toolDiffPane }
