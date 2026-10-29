import { Btn, Field, Textarea, WB, h } from '../../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolMonoStyle, toolOutputBlock } from '../shared-controls.js'

function toolTimestampPane(props?: any): any {
    const value = props.value || {};
    function parseText(raw?: any): any {
        const text = String(raw === undefined || raw === null ? '' : raw).trim();
        if (!text) {
            return { output: '', error: '请输入时间戳或日期字符串（例如 1730000000 或 2026-10-27 14:00）' };
        }
        let date: any = null;
        let info = '';
        if (/^-?\d+$/.test(text)) {
            const number = Number(text);
            const millis = Math.abs(number) >= 1e12 ? number : number * 1000;
            date = new Date(millis);
            info = '输入视为时间戳（' + (Math.abs(number) >= 1e12 ? '毫秒' : '秒') + '）';
        }
        else {
            date = new Date(text);
            info = '输入视为日期字符串';
        }
        if (!date || Number.isNaN(date.getTime()))
            return { output: '', error: '无法解析：' + text };
        const lines: any = [
            info,
            '',
            'Unix 秒：' + Math.floor(date.getTime() / 1000),
            'Unix 毫秒：' + date.getTime(),
            '本地时间：' + WB.fmt.datetime(date.toISOString()),
            'ISO 8601：' + date.toISOString(),
            '相对现在：' + WB.fmt.relative(date.toISOString()),
        ];
        return { output: lines.join('\n'), error: '' };
    }
    function run(): any {
        props.patch(parseText(value.input));
    }
    function fillCurrent(unit?: any): any {
        const stamp = unit === 'ms' ? Date.now() : Math.floor(Date.now() / 1000);
        const result = parseText(String(stamp));
        props.patch({ input: String(stamp), output: result.output, error: result.error });
    }
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-split' }, h(Field, {
        label: '输入时间戳或日期',
        hint: '纯数字按位数自动识别秒 / 毫秒；其它按 Date 解析',
    }, h(Textarea, {
        value: value.input || '',
        rows: 4,
        spellCheck: false,
        style: toolMonoStyle(100),
        placeholder: '1730000000 或 2026-10-27 14:00',
        onChange: function (event?: any): any {
            props.patch({ input: event.target.value });
        },
    })), h('div', { className: 'wb-stack', style: { gap: 8 } }, h('div', { className: 'wb-row wb-row--wrap', style: { gap: 6 } }, h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'clock',
        onClick: run,
        children: '转换',
    }), h(Btn, {
        size: 'sm',
        onClick: function (): any {
            fillCurrent('s');
        },
        children: '填入当前秒',
    }), h(Btn, {
        size: 'sm',
        onClick: function (): any {
            fillCurrent('ms');
        },
        children: '填入当前毫秒',
    }), h('div', { className: 'wb-spacer' }), h(toolCopyButton, { text: value.output })), h(toolErrorBlock, { text: value.error }), h(toolOutputBlock, { text: value.output, placeholder: '两种单位与本地时间会一起显示' }))));
}
export { toolTimestampPane }
