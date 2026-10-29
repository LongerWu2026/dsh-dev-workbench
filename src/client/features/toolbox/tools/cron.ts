import { Badge, Btn, Field, Textarea, WB, h } from '../../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolMonoStyle } from '../shared-controls.js'

/* -------------------------------------------------------------------- cron */
const toolCronFieldDefs: any = [
    { key: 'minute', label: '分钟', min: 0, max: 59, names: null },
    { key: 'hour', label: '小时', min: 0, max: 23, names: null },
    { key: 'dom', label: '日', min: 1, max: 31, names: null },
    {
        key: 'month',
        label: '月',
        min: 1,
        max: 12,
        names: { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 },
    },
    {
        key: 'dow',
        label: '星期',
        min: 0,
        max: 7,
        names: { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 },
    },
];

function toolCronWeekday(value?: any): any {
    const names: any = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return names[value] === undefined ? '星期 ' + value : names[value];
}

function toolCronValue(token?: any, def?: any): any {
    const text = String(token === undefined || token === null ? '' : token).trim().toLowerCase();
    if (def.names && Object.prototype.hasOwnProperty.call(def.names, text))
        return def.names[text];
    if (!/^\d+$/.test(text)) {
        throw new Error(def.label +
            '字段无法识别：' +
            text +
            '（仅解释，不执行：只支持数字、*、,、-、/ 与标准月份/星期英文缩写）');
    }
    const value = Number(text);
    if (value < def.min || value > def.max) {
        throw new Error(def.label + '字段超出范围 ' + def.min + '–' + def.max + '：' + value);
    }
    return value;
}

function toolCronParseField(spec?: any, def?: any): any {
    const raw = String(spec === undefined || spec === null ? '' : spec).trim().toLowerCase();
    if (!raw)
        throw new Error(def.label + '字段为空');
    if (/[lw#]/.test(raw)) {
        throw new Error(def.label + '字段包含扩展语法（L / W / #）：本工具仅解释，不执行，也不会推算下次触发时间');
    }
    const wildcard = raw === '*' || raw === '?';
    const values: any = {};
    const parts = raw.split(',');
    for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index].trim();
        if (!part)
            throw new Error(def.label + '字段含空片段：' + raw);
        if (part === '*' || part === '?') {
            for (let value = def.min; value <= def.max; value += 1)
                values[value] = true;
            continue;
        }
        let base = part;
        let step = 1;
        const slash = part.indexOf('/');
        if (slash >= 0) {
            base = part.slice(0, slash);
            const stepText = part.slice(slash + 1);
            if (!/^\d+$/.test(stepText) || Number(stepText) <= 0) {
                throw new Error(def.label + '字段步长不合法：' + stepText);
            }
            step = Number(stepText);
        }
        let start;
        let end;
        if (base === '*') {
            start = def.min;
            end = def.max;
        }
        else if (base.indexOf('-') > 0) {
            const pair = base.split('-');
            if (pair.length !== 2)
                throw new Error(def.label + '字段范围不合法：' + base);
            start = toolCronValue(pair[0], def);
            end = toolCronValue(pair[1], def);
            if (start > end)
                throw new Error(def.label + '字段范围顺序不合法：' + base);
        }
        else {
            start = toolCronValue(base, def);
            end = step > 1 ? def.max : start;
        }
        for (let value = start; value <= end; value += step)
            values[value] = true;
    }
    if (def.key === 'dow' && values[7]) {
        values[0] = true;
        delete values[7];
    }
    const list = Object.keys(values)
        .map(Number)
        .sort(function (a?: any, b?: any): any {
        return a - b;
    });
    if (!list.length)
        throw new Error(def.label + '字段没有有效取值：' + raw);
    return {
        key: def.key,
        label: def.label,
        raw: raw,
        wildcard: wildcard,
        values: list,
        set: values,
    };
}

function toolCronParse(expression?: any): any {
    const parts = String(expression === undefined || expression === null ? '' : expression)
        .trim()
        .split(/\s+/);
    if (parts.length !== 5) {
        throw new Error('仅支持标准 5 段表达式（分 时 日 月 周），当前 ' + parts.length + ' 段');
    }
    const fields: any = [];
    for (let index = 0; index < toolCronFieldDefs.length; index += 1) {
        fields.push(toolCronParseField(parts[index], toolCronFieldDefs[index]));
    }
    return {
        fields: fields,
        minute: fields[0],
        hour: fields[1],
        dom: fields[2],
        month: fields[3],
        dow: fields[4],
    };
}

function toolCronValueText(field?: any, value?: any): any {
    if (field.key === 'hour')
        return value + ' 点';
    if (field.key === 'dom')
        return value + ' 日';
    if (field.key === 'month')
        return value + ' 月';
    if (field.key === 'dow')
        return toolCronWeekday(value);
    return String(value);
}

function toolCronDescribeField(field?: any): any {
    if (field.wildcard) {
        if (field.key === 'minute')
            return '每分钟';
        if (field.key === 'hour')
            return '每小时';
        if (field.key === 'dom')
            return '每天';
        if (field.key === 'month')
            return '每月';
        return '每天（星期不限）';
    }
    const shown = field.values.slice(0, 12);
    let text = shown
        .map(function (value?: any): any {
        return toolCronValueText(field, value);
    })
        .join('、');
    if (field.values.length > shown.length)
        text += ' …（共 ' + field.values.length + ' 个值）';
    if (field.key === 'minute')
        return '第 ' + text + ' 分钟';
    return text;
}

/* Next trigger instants in local time; returns at most `count` dates. */
function toolCronNextTimes(parsed?: any, count?: any): any {
    const results: any = [];
    const cursor = new Date();
    cursor.setSeconds(0, 0);
    cursor.setMinutes(cursor.getMinutes() + 1);
    const limit = 366 * 24 * 60;
    for (let step = 0; step < limit && results.length < count; step += 1) {
        const minute = cursor.getMinutes();
        const hour = cursor.getHours();
        const day = cursor.getDate();
        const month = cursor.getMonth() + 1;
        const weekday = cursor.getDay();
        let matched = !!(parsed.minute.set[minute] && parsed.hour.set[hour] && parsed.month.set[month]);
        if (matched) {
            const domMatch = !!parsed.dom.set[day];
            const dowMatch = !!parsed.dow.set[weekday];
            if (parsed.dom.wildcard && parsed.dow.wildcard)
                matched = true;
            else if (parsed.dom.wildcard)
                matched = dowMatch;
            else if (parsed.dow.wildcard)
                matched = domMatch;
            else
                matched = domMatch || dowMatch;
        }
        if (matched)
            results.push(new Date(cursor.getTime()));
        cursor.setMinutes(cursor.getMinutes() + 1);
    }
    return results;
}

function toolCronPane(props?: any): any {
    const value = props.value || {};
    function run(): any {
        const expression = String(value.expr || '').trim();
        if (!expression) {
            props.patch({ error: '请输入 5 段 Cron 表达式（分 时 日 月 周）', rows: [], times: [], ran: true });
            return;
        }
        try {
            const parsed = toolCronParse(expression);
            const rows = parsed.fields.map(function (field?: any): any {
                return {
                    key: field.key,
                    label: field.label,
                    raw: field.raw,
                    description: toolCronDescribeField(field),
                };
            });
            const times = toolCronNextTimes(parsed, 3);
            props.patch({ error: '', rows: rows, times: times, ran: true });
        }
        catch (error) {
            props.patch({ error: String((error && error.message) || error), rows: [], times: [], ran: true });
        }
    }
    const rows = Array.isArray(value.rows) ? value.rows : [];
    const times = Array.isArray(value.times) ? value.times : [];
    const copyText = rows
        .map(function (row?: any): any {
        return row.label + '  ' + row.raw + '  ' + row.description;
    })
        .join('\n');
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-row wb-row--wrap', style: { gap: 6 } }, h(Badge, { tone: 'warn' }, '仅解释，不执行'), h('span', { className: 'wb-tiny wb-muted' }, '标准 5 段（分 时 日 月 周）；秒字段、年份与 L / W / # 扩展不执行')), h(Field, { label: '表达式', hint: '例如 */15 9-18 * * 1-5' }, h(Textarea, {
        value: value.expr || '',
        rows: 2,
        spellCheck: false,
        style: toolMonoStyle(56),
        placeholder: '*/15 9-18 * * 1-5',
        onChange: function (event?: any): any {
            props.patch({ expr: event.target.value });
        },
    })), h('div', { className: 'wb-row', style: { gap: 6 } }, h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'calendar',
        onClick: run,
        children: '解释',
    }), h('div', { className: 'wb-spacer' }), h(toolCopyButton, { text: copyText })), h(toolErrorBlock, { text: value.error }), rows.length
        ? h('table', { className: 'wb-table' }, h('thead', null, h('tr', null, h('th', null, '字段'), h('th', null, '表达式'), h('th', null, '解释'))), h('tbody', null, rows.map(function (row?: any): any {
            return h('tr', { key: 'cron-' + row.key }, h('td', null, row.label), h('td', { className: 'wb-mono' }, row.raw), h('td', null, row.description));
        })))
        : null, times.length
        ? h('div', { className: 'wb-stack', style: { gap: 4 } }, h('div', { className: 'wb-tiny wb-muted' }, '下次触发估算（本机时区，最多向后推算 366 天）'), times.map(function (time?: any, index?: any): any {
            return h('div', { key: 'cron-time-' + index, className: 'wb-mono wb-tiny' }, '· ' + WB.fmt.datetime(time.toISOString()));
        }))
        : value.ran && !value.error
            ? h('div', { className: 'wb-tiny wb-muted' }, '未来 366 天内没有匹配时间：这个表达式可能永远不会触发。')
            : null, h('p', { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.6 } }, '日与星期同时限定时按标准 cron 的「或」语义匹配；本工具只解释与估算，不会注册任何定时任务。'));
}
export { toolCronFieldDefs, toolCronWeekday, toolCronValue, toolCronParseField, toolCronParse, toolCronValueText, toolCronDescribeField, toolCronNextTimes, toolCronPane }
