import { Btn, Field, Input, Segmented, h } from '../../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolOutputBlock } from '../shared-controls.js'

/* -------------------------------------------------------------------- UUID */
function toolUuidV4(): any {
    const cryptoApi = typeof crypto === 'undefined' ? null : crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
        try {
            return cryptoApi.randomUUID();
        }
        catch (error) {
            /* fall through to getRandomValues */
        }
    }
    const bytes = new Uint8Array(16);
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
        cryptoApi.getRandomValues(bytes);
    }
    else {
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Math.floor(Math.random() * 256);
        }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex = '';
    for (let index = 0; index < bytes.length; index += 1) {
        const part = bytes[index].toString(16);
        hex += part.length === 1 ? '0' + part : part;
    }
    return (hex.slice(0, 8) +
        '-' +
        hex.slice(8, 12) +
        '-' +
        hex.slice(12, 16) +
        '-' +
        hex.slice(16, 20) +
        '-' +
        hex.slice(20));
}

function toolUuidPane(props?: any): any {
    const value = props.value || {};
    function run(): any {
        const count = Number(String(value.count === undefined ? '' : value.count).trim());
        if (!Number.isInteger(count) || count < 1 || count > 50) {
            props.patch({ output: '', error: '数量需要是 1–50 之间的整数' });
            return;
        }
        const list: any = [];
        for (let index = 0; index < count; index += 1) {
            const id = toolUuidV4();
            list.push(value.upper ? id.toUpperCase() : id);
        }
        props.patch({ output: list.join('\n'), error: '' });
    }
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-row wb-row--wrap', style: { gap: 8, alignItems: 'flex-end' } }, h('div', { style: { width: 130 } }, h(Field, { label: '数量' }, h(Input, {
        value: value.count || '',
        inputMode: 'numeric',
        onChange: function (event?: any): any {
            props.patch({ count: event.target.value });
        },
    }))), h(Field, { label: '大小写' }, h(Segmented, {
        items: [
            { value: 'lower', label: '小写' },
            { value: 'upper', label: '大写' },
        ],
        value: value.upper ? 'upper' : 'lower',
        onChange: function (mode?: any): any {
            props.patch({ upper: mode === 'upper' });
        },
    })), h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'zap',
        onClick: run,
        children: '生成 UUID v4',
    }), h('div', { className: 'wb-spacer' }), h(toolCopyButton, { text: value.output })), h(toolErrorBlock, { text: value.error }), h(toolOutputBlock, {
        text: value.output,
        placeholder: '点击生成；每行一个 UUID v4',
        style: { maxHeight: 300 },
    }), h('div', { className: 'wb-tiny wb-muted' }, '优先使用 crypto.randomUUID；不可用时回退到 crypto.getRandomValues，仍不可用才用 Math.random 兜底。'));
}
export { toolUuidV4, toolUuidPane }
