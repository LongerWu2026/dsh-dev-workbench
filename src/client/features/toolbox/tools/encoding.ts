import { Btn, Field, Segmented, Textarea, h } from '../../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolMonoStyle, toolOutputBlock } from '../shared-controls.js'

/* ----------------------------------------------------------------- Base64 */
function toolBase64Encode(input?: any): any {
    const text = String(input === undefined || input === null ? '' : input);
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary);
}

function toolBase64Decode(input?: any): any {
    const compact = String(input === undefined || input === null ? '' : input).replace(/\s+/g, '');
    if (!compact)
        throw new Error('请输入要解码的 Base64 文本');
    if (!/^[A-Za-z0-9+/=_-]+$/.test(compact)) {
        throw new Error('不是合法的 Base64：包含字母、数字、+ / - _ = 之外的字符');
    }
    let normalized = compact.replace(/-/g, '+').replace(/_/g, '/');
    const remainder = normalized.length % 4;
    if (remainder === 2)
        normalized += '==';
    else if (remainder === 3)
        normalized += '=';
    else if (remainder === 1)
        throw new Error('不是合法的 Base64：长度不合法');
    let binary;
    try {
        binary = atob(normalized);
    }
    catch (error) {
        throw new Error('不是合法的 Base64：' + String((error && error.message) || error));
    }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    catch (error) {
        return new TextDecoder('utf-8').decode(bytes) + '\n\n（提示：这段字节不是合法 UTF-8，已用替换字符显示）';
    }
}

function toolBase64UrlDecode(segment?: any): any {
    const text = String(segment === undefined || segment === null ? '' : segment)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const padded = text + '='.repeat((4 - (text.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function toolBase64Pane(props?: any): any {
    const value = props.value || {};
    function run(): any {
        const input = String(value.input || '');
        if (!input.trim()) {
            props.patch({ output: '', error: '请输入文本' });
            return;
        }
        try {
            if (value.mode === 'decode')
                props.patch({ output: toolBase64Decode(input), error: '' });
            else
                props.patch({ output: toolBase64Encode(input), error: '' });
        }
        catch (error) {
            props.patch({ output: '', error: String((error && error.message) || error) });
        }
    }
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-row wb-row--wrap', style: { gap: 8 } }, h(Segmented, {
        items: [
            { value: 'encode', label: '编码' },
            { value: 'decode', label: '解码' },
        ],
        value: value.mode || 'encode',
        onChange: function (mode?: any): any {
            props.patch({ mode: mode, output: '', error: '' });
        },
    }), h('span', { className: 'wb-tiny wb-muted' }, '编码与解码都按 UTF-8 处理，中文不会乱码')), h('div', { className: 'wb-split' }, h(Field, { label: value.mode === 'decode' ? '输入 Base64' : '输入原文' }, h(Textarea, {
        value: value.input || '',
        rows: 8,
        spellCheck: false,
        style: toolMonoStyle(150),
        placeholder: value.mode === 'decode' ? '粘贴 Base64 字符串' : '输入要编码的文本',
        onChange: function (event?: any): any {
            props.patch({ input: event.target.value });
        },
    })), h('div', { className: 'wb-stack', style: { gap: 8 } }, h('div', { className: 'wb-row', style: { gap: 6 } }, h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'lock',
        onClick: run,
        children: value.mode === 'decode' ? '解码' : '编码',
    }), h('div', { className: 'wb-spacer' }), h(toolCopyButton, { text: value.output })), h(toolErrorBlock, { text: value.error }), h(toolOutputBlock, {
        text: value.output,
        placeholder: value.mode === 'decode' ? 'UTF-8 解码后的文本' : 'Base64 结果',
    }))));
}
export { toolBase64Encode, toolBase64Decode, toolBase64UrlDecode, toolBase64Pane }
