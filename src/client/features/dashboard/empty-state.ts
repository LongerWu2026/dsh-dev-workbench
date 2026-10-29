import { h } from '../../core/runtime.js'

/* ---------------------------------------------------------------- 番茄钟 */
/** 今日待办空态插画：清单 + 勾选 + 时钟，纯 SVG 跟随主题变量。 */
function DashEmptyIllustration(): any {
    return h('svg', {
        width: 132,
        height: 96,
        viewBox: '0 0 132 96',
        fill: 'none',
        'aria-hidden': 'true',
        style: { opacity: 0.9 },
    },
    // 清单卡片
    h('rect', { x: 26, y: 10, width: 62, height: 74, rx: 9, fill: 'var(--dsw-alias-bg-layer-2)' }), h('rect', { x: 26, y: 10, width: 62, height: 74, rx: 9, stroke: 'var(--dsw-alias-border-l1)' }),
    // 三条待办行
    [0, 1, 2].map(function (row?: any): any {
        const y = 26 + row * 18;
        return h('g', { key: 'row' + row }, h('rect', { x: 34, y: y, width: 10, height: 10, rx: 3, stroke: row === 0 ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l2)', strokeWidth: 1.4 }), row === 0
            ? h('path', { d: 'M36.5 ' + (y + 5.2) + ' l2.4 2.6 l4.4 -5', stroke: 'var(--dsw-alias-brand-primary)', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' })
            : null, h('rect', { x: 50, y: y + 2.5, width: row === 2 ? 24 : 30, height: 5, rx: 2.5, fill: 'var(--dsw-alias-border-l2)' }));
    }),
    // 右下角时钟
    h('circle', { cx: 100, cy: 66, r: 20, fill: 'var(--dsw-alias-bg-layer-1)', stroke: 'var(--dsw-alias-border-l1)' }), h('circle', { cx: 100, cy: 66, r: 20, stroke: 'var(--dsw-alias-brand-primary)', strokeOpacity: 0.35 }), h('path', { d: 'M100 55 v11 l8 5', stroke: 'var(--dsw-alias-label-secondary)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    // 左上角星点
    h('path', { d: 'M14 22 l2.2 4.6 l4.8 0.7 l-3.5 3.4 l0.8 4.8 l-4.3 -2.3 l-4.3 2.3 l0.8 -4.8 l-3.5 -3.4 l4.8 -0.7 z', fill: 'var(--dsw-alias-brand-primary)', fillOpacity: 0.5 }), h('circle', { cx: 112, cy: 18, r: 3, fill: 'var(--dsw-alias-brand-primary)', fillOpacity: 0.35 }));
}

/** 空态里的三步引导行。 */
function DashEmptyStep(props?: any): any {
    return h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 9, textAlign: 'left', maxWidth: 300 } }, h('span', {
        style: {
            flex: 'none',
            display: 'grid',
            placeItems: 'center',
            width: 22,
            height: 22,
            borderRadius: 999,
            background: 'var(--dsw-alias-bg-layer-2)',
            color: 'var(--dsw-alias-brand-primary)',
            fontSize: 11,
            fontWeight: 700,
        },
    }, String(props.index)), h('div', { style: { fontSize: 11.5, lineHeight: 1.65, color: 'var(--dsw-alias-label-secondary)' } }, h('div', { style: { color: 'var(--dsw-alias-label-primary)', fontWeight: 600 } }, props.title), props.hint));
}
export { DashEmptyIllustration, DashEmptyStep }
