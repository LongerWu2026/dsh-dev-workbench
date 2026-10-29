import { toolBase64UrlDecode } from './encoding.js'
import { Btn, Field, T, Textarea, WB, h } from '../../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolMonoStyle, toolOutputBlock } from '../shared-controls.js'

/* --------------------------------------------------------------------- JWT */
function toolJwtParse(token?: any): any {
    const parts = String(token === undefined || token === null ? '' : token).trim().split('.');
    if (parts.length !== 3) {
        throw new Error('JWT 应由 header.payload.signature 三段组成，当前为 ' + parts.length + ' 段');
    }
    function decodeSegment(segment?: any, label?: any): any {
        try {
            return JSON.parse(toolBase64UrlDecode(segment));
        }
        catch (error) {
            throw new Error(label + ' 段无法解析为 JSON：' + String((error && error.message) || error));
        }
    }
    return {
        header: decodeSegment(parts[0], 'header'),
        payload: decodeSegment(parts[1], 'payload'),
        signatureLength: parts[2].length,
    };
}

function toolJwtClaims(payload?: any): any {
    const claims: any = [];
    const now = Date.now();
    function add(name?: any, value?: any): any {
        if (value === undefined || value === null || value === '')
            return;
        claims.push({ name: name, value: String(value) });
    }
    add('iss', payload.iss);
    add('sub', payload.sub);
    add('aud', Array.isArray(payload.aud) ? payload.aud.join(', ') : payload.aud);
    add('jti', payload.jti);
    add('scope', Array.isArray(payload.scope) ? payload.scope.join(' ') : payload.scope);
    if (payload.exp !== undefined && payload.exp !== null) {
        const exp = Number(payload.exp) * 1000;
        if (Number.isFinite(exp)) {
            claims.push({
                name: 'exp',
                value: WB.fmt.datetime(new Date(exp).toISOString()) + (exp < now ? ' · 已过期' : ' · 未过期'),
            });
        }
        else {
            add('exp', payload.exp);
        }
    }
    if (payload.iat !== undefined && payload.iat !== null) {
        const iat = Number(payload.iat) * 1000;
        if (Number.isFinite(iat))
            claims.push({ name: 'iat', value: WB.fmt.datetime(new Date(iat).toISOString()) });
        else
            add('iat', payload.iat);
    }
    if (payload.nbf !== undefined && payload.nbf !== null) {
        const nbf = Number(payload.nbf) * 1000;
        if (Number.isFinite(nbf))
            claims.push({ name: 'nbf', value: WB.fmt.datetime(new Date(nbf).toISOString()) });
        else
            add('nbf', payload.nbf);
    }
    return claims;
}

function toolJwtPane(props?: any): any {
    const value = props.value || {};
    function run(): any {
        const token = String(value.input || '').trim();
        if (!token) {
            props.patch({ error: '请粘贴 JWT', headerText: '', payloadText: '', claims: [], ran: true });
            return;
        }
        try {
            const parsed = toolJwtParse(token);
            props.patch({
                error: '',
                headerText: JSON.stringify(parsed.header, null, 2),
                payloadText: JSON.stringify(parsed.payload, null, 2),
                claims: toolJwtClaims(parsed.payload),
                signatureLength: parsed.signatureLength,
                ran: true,
            });
        }
        catch (error) {
            props.patch({
                error: String((error && error.message) || error),
                headerText: '',
                payloadText: '',
                claims: [],
                ran: true,
            });
        }
    }
    const claims = Array.isArray(value.claims) ? value.claims : [];
    const parsed = !!(value.headerText || value.payloadText);
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', {
        className: 'wb-tiny',
        style: {
            padding: '7px 9px',
            borderRadius: 8,
            border: '1px solid color-mix(in srgb, ' + T.warn + ' 45%, transparent)',
            background: 'color-mix(in srgb, ' + T.warn + ' 10%, transparent)',
            color: T.warn,
            lineHeight: 1.6,
        },
    }, '只解码不校验签名：任何人都能伪造内容，不要把解析结果当作身份或权限依据。'), h(Field, { label: 'JWT' }, h(Textarea, {
        value: value.input || '',
        rows: 4,
        spellCheck: false,
        style: toolMonoStyle(100),
        placeholder: '粘贴 header.payload.signature',
        onChange: function (event?: any): any {
            props.patch({ input: event.target.value });
        },
    })), h('div', { className: 'wb-row', style: { gap: 6 } }, h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'eye',
        onClick: run,
        children: '解析',
    }), h('div', { className: 'wb-spacer' }), h(toolCopyButton, {
        text: parsed ? 'HEADER\n' + value.headerText + '\n\nPAYLOAD\n' + value.payloadText : '',
        label: '复制解析结果',
    })), h(toolErrorBlock, { text: value.error }), parsed
        ? h('div', { className: 'wb-split' }, h('div', { className: 'wb-stack', style: { gap: 4 } }, h('div', { className: 'wb-tiny wb-muted' }, 'Header'), h('pre', { className: 'wb-code', style: { maxHeight: 220 } }, value.headerText || '')), h('div', { className: 'wb-stack', style: { gap: 4 } }, h('div', { className: 'wb-tiny wb-muted' }, 'Payload'), h('pre', { className: 'wb-code', style: { maxHeight: 220 } }, value.payloadText || '')))
        : h(toolOutputBlock, { text: '', placeholder: '解析后显示 header 与 payload' }), claims.length
        ? h('table', { className: 'wb-table' }, h('thead', null, h('tr', null, h('th', null, '声明'), h('th', null, '值'))), h('tbody', null, claims.map(function (claim?: any): any {
            return h('tr', { key: 'claim-' + claim.name }, h('td', { className: 'wb-mono' }, claim.name), h('td', { style: { overflowWrap: 'anywhere' } }, claim.value));
        })))
        : null, value.ran && parsed
        ? h('div', { className: 'wb-tiny wb-muted' }, '签名段长度 ' + String(value.signatureLength || 0) + ' 字符（未校验）。')
        : null);
}
export { toolJwtParse, toolJwtClaims, toolJwtPane }
