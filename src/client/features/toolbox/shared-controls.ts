import { Btn, Icon, T, WB, h } from '../../core/runtime.js'

/* ------------------------------------------------------------ shared pieces */
function toolErrorBlock(props?: any): any {
    if (!props.text)
        return null;
    return h('div', {
        role: 'alert',
        className: 'wb-tiny',
        style: {
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            padding: '7px 9px',
            borderRadius: 8,
            border: '1px solid color-mix(in srgb, ' + T.err + ' 45%, transparent)',
            background: 'color-mix(in srgb, ' + T.err + ' 10%, transparent)',
            color: T.err,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            lineHeight: 1.6,
        },
    }, h(Icon, { name: 'alert', size: 13 }), h('span', { style: { minWidth: 0 } }, String(props.text)));
}

function toolOutputBlock(props?: any): any {
    if (props.text) {
        return h('pre', { className: 'wb-code', style: props.style }, String(props.text));
    }
    return h('div', {
        className: 'wb-tiny wb-muted',
        style: {
            padding: '10px 12px',
            border: '1px dashed ' + T.border1,
            borderRadius: 10,
            lineHeight: 1.6,
        },
    }, props.placeholder || '结果会显示在这里');
}

function toolCopyButton(props?: any): any {
    const text = props.text ? String(props.text) : '';
    return h(Btn, {
        size: 'sm',
        icon: 'copy',
        disabled: !text,
        title: props.title || '复制结果',
        onClick: function (): any {
            if (!text)
                return;
            WB.util.copy(text)
                .then(function (): any {
                WB.toast('已复制结果到剪贴板', 'ok');
            })
                .catch(function (error?: any): any {
                WB.toast(String((error && error.message) || error), 'err');
            });
        },
        children: props.label || '复制',
    });
}

function toolLocalNote(): any {
    return h('div', {
        className: 'wb-row wb-tiny wb-muted',
        style: {
            gap: 6,
            alignItems: 'center',
            marginBottom: 10,
            paddingBottom: 8,
            borderBottom: '1px solid ' + T.border1,
        },
    }, h(Icon, { name: 'lock', size: 12 }), h('span', null, '本地执行 · 全部计算在浏览器内完成，数据不离开浏览器'));
}

function toolMonoStyle(minHeight?: any): any {
    return { minHeight: minHeight || 150, fontFamily: T.font.mono, fontSize: 11.5 };
}
export { toolErrorBlock, toolOutputBlock, toolCopyButton, toolLocalNote, toolMonoStyle }
