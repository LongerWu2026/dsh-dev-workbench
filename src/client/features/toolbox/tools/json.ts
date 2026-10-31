import {JsonTree} from './DeveloperExtras.js'
import {jsonType} from './developer-utils.js'
import { Btn, Field, Textarea, h } from '../../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolMonoStyle, toolOutputBlock } from '../shared-controls.js'

/* ------------------------------------------------------------------- JSON */
function toolJsonError(error?: any, text?: any): any {
    const source = String(text === undefined || text === null ? '' : text);
    const message = String((error && error.message) || error || 'JSON 解析失败');
    const lineCol = /line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
    const position = /position\s+(\d+)/i.exec(message);
    let line = 0;
    let column = 0;
    if (lineCol) {
        line = Number(lineCol[1]);
        column = Number(lineCol[2]);
    }
    else if (position) {
        const index = Math.max(0, Math.min(source.length, Number(position[1])));
        const head = source.slice(0, index);
        const parts = head.split('\n');
        line = parts.length;
        column = parts[parts.length - 1].length + 1;
    }
    else if (/end of json|unexpected end/i.test(message)) {
        const parts = source.split('\n');
        line = parts.length;
        column = parts[parts.length - 1].length + 1;
    }
    if (line > 0) {
        const lines = source.split('\n');
        const raw = lines[line - 1] === undefined ? '' : lines[line - 1];
        const clipped = raw.length > 120 ? raw.slice(0, 120) + '…' : raw;
        const caret = Math.max(0, Math.min(clipped.length, column - 1));
        const gutter = '  ' + line + ' | ';
        const pointer = ' '.repeat(gutter.length + caret) + '^';
        return ('JSON 不合法（第 ' + line + ' 行，第 ' + column + ' 列附近）\n' +
            message +
            '\n\n' +
            gutter +
            clipped +
            '\n' +
            pointer);
    }
    return 'JSON 不合法\n' + message;
}

function toolJsonSummary(value?: any): any {
    if (value === null)
        return '根类型 null（合法）';
    if (Array.isArray(value))
        return '根类型 数组 · ' + value.length + ' 项';
    if (typeof value === 'object')
        return '根类型 对象 · ' + Object.keys(value).length + ' 个键';
    return '根类型 ' + typeof value + '（标量，合法）';
}

/* ------------------------------------------------------------------- panes */
function toolJsonPane(props?: any): any {
    const value = props.value || {};
    function run(mode?: any): any {
        const text = String(value.input || '');
        if (!text.trim()) {
            props.patch({ output: '', error: '请先输入 JSON 文本' });
            return;
        }
        try {
            const parsed = JSON.parse(text);
            if(mode==='types'){props.patch({output:'export type Root = '+jsonType(parsed)+';',error:'',tree:false});return}
            if(mode==='tree'){props.patch({tree:true,treeValue:parsed,error:''});return}
            props.patch({tree:false});
            if (mode === 'validate') {
                props.patch({
                    output: '✓ JSON 合法 · ' +
                        toolJsonSummary(parsed) +
                        '\n字符数 ' +
                        text.length +
                        ' · 行数 ' +
                        text.split('\n').length,
                    error: '',
                });
            }
            else {
                props.patch({
                    output: mode === 'minify' ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2),
                    error: '',
                });
            }
        }
        catch (error) {
            props.patch({ output: '', error: toolJsonError(error, text) });
        }
    }
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-split' }, h(Field, { label: '输入 JSON' }, h(Textarea, {
        value: value.input || '',
        rows: 12,
        spellCheck: false,
        style: toolMonoStyle(220),
        placeholder: '粘贴 JSON 文本',
        onChange: function (event?: any): any {
            props.patch({ input: event.target.value });
        },
    })), h('div', { className: 'wb-stack', style: { gap: 8 } }, h('div', { className: 'wb-row wb-row--wrap', style: { gap: 6 } }, h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'sparkles',
        onClick: function (): any {
            run('format');
        },
        children: '格式化',
    }), h(Btn, {
        size: 'sm',
        icon: 'layers',
        onClick: function (): any {
            run('minify');
        },
        children: '压缩',
    }), h(Btn, {
        size: 'sm',
        icon: 'checkCircle',
        onClick: function (): any {
            run('validate');
        },
        children: '校验',
    }), h(Btn,{size:'sm',onClick:()=>run('tree')},'树形查看'),h(Btn,{size:'sm',onClick:()=>run('types')},'转 TypeScript'), h('div', { className: 'wb-spacer' }), h(toolCopyButton, { text: value.output })), h(toolErrorBlock, { text: value.error }), value.tree?h(JsonTree,{value:value.treeValue}):h(toolOutputBlock, { text: value.output, placeholder: '格式化 / 压缩 / 校验的结果' }))));
}
export { toolJsonError, toolJsonSummary, toolJsonPane }
