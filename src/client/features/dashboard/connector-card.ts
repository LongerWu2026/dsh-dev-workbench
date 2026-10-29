import { Badge, Icon, T, WB, h } from '../../core/runtime.js'
import { dashTagPill } from './selectors.js'

function dashConnectorIcon(type?: any): any {
    const key = String(type || '').toLowerCase();
    if (key.indexOf('git') >= 0)
        return 'git';
    if (key.indexOf('docker') >= 0)
        return 'docker';
    if (key.indexOf('db') >= 0 || key.indexOf('sql') >= 0)
        return 'database';
    if (key.indexOf('web') >= 0 || key.indexOf('rss') >= 0 || key.indexOf('http') >= 0)
        return 'link';
    return 'plug';
}

function DashConnectorCard(props?: any): any {
    const connector = props.connector;
    const stateMeta = WB.CONNECTOR_STATE[connector.authState] || {
        label: connector.authState || '状态未知',
        tone: 'idle',
    };
    const capabilities = Array.isArray(connector.capabilities) ? connector.capabilities : [];
    return h('div', {
        style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 0,
            padding: '11px 12px',
            border: '1px solid ' + T.border1,
            borderRadius: 12,
            background: T.layer2,
        },
    }, h('div', { className: 'wb-row', style: { gap: 7, minWidth: 0 } }, h('span', { style: { display: 'inline-flex', color: T.text2 } }, h(Icon, { name: dashConnectorIcon(connector.type), size: 14 })), h('span', { className: 'wb-ellipsis', style: { fontSize: 12.5, fontWeight: 600, color: T.text } }, connector.label || connector.type || '未命名连接'), h('span', { className: 'wb-spacer' }), h(Badge, { tone: stateMeta.tone }, stateMeta.label)), capabilities.length > 0
        ? h('div', { className: 'wb-row wb-row--wrap', style: { gap: 4 } }, capabilities.map(function (capability?: any, index?: any): any {
            return dashTagPill(capability, 'cap:' + capability + ':' + index);
        }))
        : h('span', { className: 'wb-tiny wb-muted' }, '未声明能力'), connector.note ? h('div', { className: 'wb-tiny wb-muted', style: { lineHeight: 1.55 } }, connector.note) : null, h('div', { className: 'wb-row wb-tiny wb-muted', style: { gap: 6 } }, connector.updatedAt ? h('span', null, '更新于 ' + WB.fmt.relative(connector.updatedAt)) : h('span', null, '尚无同步记录'), h('span', { className: 'wb-spacer' }), h('span', { className: 'wb-mono' }, String(connector.type || 'connector'))));
}
export { dashConnectorIcon, DashConnectorCard }
