import { Btn, Field, Textarea, Toggle, h } from '../../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolMonoStyle, toolOutputBlock } from '../shared-controls.js'

/* ------------------------------------------------------------------- CSV */
function csvParse(text?: any): any {
    const source = String(text).replace(/\r\n?/g, '\n');
    const rows: any = [];
    let row: any = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        if (quoted) {
            if (char === '"') {
                if (source[i + 1] === '"') {
                    field += '"';
                    i += 1;
                }
                else {
                    quoted = false;
                }
            }
            else {
                field += char;
            }
            continue;
        }
        if (char === '"') {
            quoted = true;
            continue;
        }
        if (char === ',') {
            row.push(field);
            field = '';
            continue;
        }
        if (char === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            continue;
        }
        field += char;
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter(function (cells?: any): any {
        return cells.length > 1 || (cells[0] || '').trim().length > 0;
    });
}

function csvCell(value?: any): any {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function csvInfer(text?: any): any {
    const raw = String(text).trim();
    if (/^(true|false)$/i.test(raw))
        return raw.toLowerCase() === 'true';
    if (/^-?\d+(?:\.\d+)?$/.test(raw))
        return Number(raw);
    if (raw.length === 0)
        return '';
    return text;
}

function toolCsvPane(props?: any): any {
    const value = props.value || {};
    const hasHeader = value.header !== false;
    function toJson(): any {
        const text = String(value.input || '');
        if (!text.trim()) {
            props.patch({ output: '', error: '请先输入 CSV 文本' });
            return;
        }
        try {
            const rows = csvParse(text);
            if (rows.length === 0) {
                props.patch({ output: '', error: '没有解析到任何数据行' });
                return;
            }
            const width = rows.reduce(function (max?: any, cells?: any): any {
                return Math.max(max, cells.length);
            }, 0);
            const start = hasHeader ? 1 : 0;
            const headers = hasHeader
                ? rows[0].map(function (cell?: any, index?: any): any {
                    const name = String(cell || '').trim();
                    return name || 'c' + (index + 1);
                })
                : new Array(width).fill(0).map(function (_?: any, index?: any): any {
                    return 'c' + (index + 1);
                });
            const output = rows.slice(start).map(function (cells?: any): any {
                const item: any = {};
                headers.forEach(function (header?: any, index?: any): any {
                    item[header] = csvInfer(cells[index] === undefined ? '' : cells[index]);
                });
                return item;
            });
            props.patch({
                output: JSON.stringify(output, null, 2),
                error: '',
                note: (hasHeader ? '含表头' : '无表头') + ' · ' + output.length + ' 行 × ' + headers.length + ' 列',
            });
        }
        catch (error) {
            props.patch({ output: '', error: String((error && error.message) || error) });
        }
    }
    function toCsv(): any {
        const text = String(value.input || '');
        if (!text.trim()) {
            props.patch({ output: '', error: '请先输入 JSON 数组' });
            return;
        }
        try {
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed))
                throw new Error('顶层必须是数组（形如 [{...}, {...}]）');
            const keys: any = [];
            parsed.forEach(function (item?: any): any {
                if (item && typeof item === 'object' && !Array.isArray(item)) {
                    Object.keys(item).forEach(function (key?: any): any {
                        if (keys.indexOf(key) < 0)
                            keys.push(key);
                    });
                }
            });
            if (keys.length === 0)
                throw new Error('数组里没有可导出的对象字段');
            const lines: any = [];
            if (hasHeader)
                lines.push(keys.map(csvCell).join(','));
            parsed.forEach(function (item?: any): any {
                lines.push(keys
                    .map(function (key?: any): any {
                    const cell = item && typeof item === 'object' ? item[key] : '';
                    return csvCell(cell === null || cell === undefined ? '' : cell);
                })
                    .join(','));
            });
            props.patch({ output: lines.join('\n'), error: '', note: parsed.length + ' 行 × ' + keys.length + ' 列' });
        }
        catch (error) {
            props.patch({ output: '', error: 'JSON 解析失败：' + String((error && error.message) || error) });
        }
    }
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-split' }, h(Field, { label: '输入（CSV 或 JSON 数组）' }, h(Textarea, {
        value: value.input || '',
        style: toolMonoStyle(210),
        placeholder: 'name,qps\n网关,2000\n报表,800',
        onChange: function (event?: any): any {
            props.patch({ input: event.target.value });
        },
    })), h('div', { className: 'wb-stack', style: { gap: 8 } }, h('div', { className: 'wb-row wb-row--wrap', style: { gap: 6 } }, h(Btn, { size: 'sm', kind: 'primary', icon: 'arrowRight', onClick: toJson, children: 'CSV → JSON' }), h(Btn, { size: 'sm', icon: 'arrowRight', onClick: toCsv, children: 'JSON → CSV' }), h('div', { className: 'wb-spacer' }), h(toolCopyButton, { text: value.output })), h(Toggle, {
        checked: hasHeader,
        label: '首行是表头',
        onChange: function (next?: any): any {
            props.patch({ header: next });
        },
    }), h(toolErrorBlock, { text: value.error }), value.note ? h('div', { className: 'wb-tiny wb-muted' }, value.note) : null, h(toolOutputBlock, { text: value.output, placeholder: '转换结果' }))));
}
export { csvParse, csvCell, csvInfer, toolCsvPane }
