import * as React from 'react'
import { T, h } from '../core/theme.js'

/* ------------------------------------------------------------------- icons */
const WB_ICON_PATHS: any = {
    dashboard: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
    tasks: ['M9 11l3 3 8-8', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
    agent: ['M12 8V5H9', 'M5 8h14v12H5z', 'M9.5 13h.01', 'M14.5 13h.01', 'M9 17h6'],
    messages: ['M7 14l-4 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7z', 'M17 7h2a2 2 0 0 1 2 2v12l-4-4h-6a2 2 0 0 1-2-2v-1'],
    radar: ['M12 12l5-5', 'M12 3a9 9 0 1 1-9 9', 'M12 7a5 5 0 1 0 5 5', 'M12 12h.01'],
    toolbox: ['M3 8h18v11H3z', 'M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M3 13h18'],
    book: ['M12 6c-2-1.4-4.2-2-8-2v14c3.8 0 6 .6 8 2', 'M12 6c2-1.4 4.2-2 8-2v14c-3.8 0-6 .6-8 2', 'M12 6v14'],
    settings: ['M4 6h9', 'M17 6h3', 'M4 12h3', 'M11 12h9', 'M4 18h9', 'M17 18h3', 'M15 6h.01', 'M9 12h.01', 'M15 18h.01'],
    search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-4.2-4.2'],
    plus: ['M12 5v14', 'M5 12h14'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    check: ['M20 6L9 17l-5-5'],
    chevronDown: ['M6 9l6 6 6-6'],
    chevronRight: ['M9 6l6 6-6 6'],
    refresh: ['M20.5 12a8.5 8.5 0 1 1-2.8-6.3', 'M21 3.5V9h-5.5'],
    external: ['M14 4h6v6', 'M20 4l-8.5 8.5', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
    play: ['M8 5l11 7-11 7z'],
    trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
    edit: ['M4 20h4L20 8l-4-4L4 16z'],
    clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7.5V12l3 2'],
    flag: ['M5 21V4h9l-1 3h6l-2 5 2 5h-6l1 3'],
    save: ['M5 3h11l3 3v15H5z', 'M8 3v6h8', 'M8 14h8v7H8z'],
    copy: ['M9 9h11v11H9z', 'M15 5H5v10'],
    sparkles: ['M12 3.5l1.7 4 4 1.7-4 1.7L12 15l-1.7-4.1-4-1.7 4-1.7z', 'M18.5 15l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z'],
    alert: ['M12 4l9 16H3z', 'M12 10v4', 'M12 17h.01'],
    info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5', 'M12 8h.01'],
    folder: ['M3 6h6l2 2h10v11H3z'],
    git: ['M7 4v10', 'M7 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M7 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M17 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M7 10a4 4 0 0 0 4 4h4'],
    docker: ['M4 11h13a4 4 0 0 1-4 4H9a5 5 0 0 1-5-4z', 'M7 8h2v2H7z', 'M10 8h2v2h-2z', 'M13 8h2v2h-2z'],
    link: ['M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7L11.4 6', 'M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.2-1.2'],
    filter: ['M3 5h18l-7 8.5V20l-4 1.5v-8z'],
    download: ['M12 3v12', 'M7 10.5l5 5 5-5', 'M4 20h16'],
    upload: ['M12 16V4', 'M7 8.5l5-5 5 5', 'M4 20h16'],
    command: ['M9 9h6v6H9z', 'M9 9V6.5A2.5 2.5 0 1 0 6.5 9H9', 'M15 9V6.5A2.5 2.5 0 1 1 17.5 9H15', 'M9 15v2.5A2.5 2.5 0 1 1 6.5 15H9', 'M15 15v2.5a2.5 2.5 0 1 0 2.5-2.5H15'],
    layers: ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5'],
    database: ['M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'],
    calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
    eye: ['M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
    more: ['M6 12h.01', 'M12 12h.01', 'M18 12h.01'],
    arrowRight: ['M4 12h15', 'M13 6l6 6-6 6'],
    xCircle: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M9 9l6 6', 'M15 9l-6 6'],
    checkCircle: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M8 12.5l2.5 2.5L16 9.5'],
    zap: ['M13 2L5 13h6l-1 9 8-11h-6z'],
    lock: ['M6 11h12v9H6z', 'M9 11V8a3 3 0 0 1 6 0v3'],
    plug: ['M9 3v6', 'M15 3v6', 'M7 9h10v3a5 5 0 0 1-10 0z', 'M12 17v4'],
};

function Icon(props?: any): any {
    const name = props && props.name;
    const paths = WB_ICON_PATHS[name] || WB_ICON_PATHS.info;
    const size = (props && props.size) || 16;
    const children = paths.map(function (d?: any, index?: any): any {
        return h('path', { key: index, d: d });
    });
    return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: props && props.strokeWidth ? props.strokeWidth : 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
        style: { display: 'block', flex: 'none' },
    }, children);
}

/* --------------------------------------------------------------- primitives */
function Divider(): any {
    return h('hr', { className: 'wb-divider' });
}

function Spinner(props?: any): any {
    const size = (props && props.size) || 15;
    return h('span', { className: 'wb-spin', style: { width: size, height: size } });
}

function Btn(props?: any): any {
    const kind = props.kind || 'ghost';
    const classes: any = ['wb-btn', 'wb-btn--' + kind];
    if (props.size === 'sm')
        classes.push('wb-btn--sm');
    if (props.className)
        classes.push(props.className);
    return h('button', {
        type: 'button',
        className: classes.join(' '),
        onClick: props.onClick,
        'aria-label': props['aria-label'],
        disabled: props.disabled,
        title: props.title || (typeof props.children === 'string' ? props.children : undefined),
    }, props.icon ? h(Icon, { name: props.icon, size: props.size === 'sm' ? 13 : 14 }) : null, typeof props.children === 'string' ? h('span', null, props.children) : props.children || null);
}

function IconBtn(props?: any): any {
    return h('button', {
        type: 'button',
        className: 'wb-iconbtn' + (props.active ? ' is-active' : ''),
        onClick: props.onClick,
        title: props.label,
        'aria-label': props.label,
        disabled: props.disabled,
    }, h(Icon, { name: props.name, size: props.size || 15 }));
}

function Badge(props?: any): any {
    return h('span', { className: 'wb-badge wb-badge--' + (props.tone || 'idle') }, props.children);
}

function Chip(props?: any): any {
    if (props.onClick) {
        return h('button', {
            type: 'button',
            className: 'wb-chip' + (props.active ? ' is-active' : ''),
            onClick: props.onClick,
            title: props.title,
        }, props.icon ? h(Icon, { name: props.icon, size: 12 }) : null, props.children, props.onRemove
            ? h('span', {
                className: 'wb-chip-x',
                role: 'button',
                tabIndex: 0,
                onClick: function (event?: any): any {
                    event.stopPropagation();
                    props.onRemove();
                },
            }, h(Icon, { name: 'close', size: 10 }))
            : null);
    }
    return h('span', { className: 'wb-chip wb-chip--static' + (props.active ? ' is-active' : ''), title: props.title }, props.icon ? h(Icon, { name: props.icon, size: 12 }) : null, props.children, props.onRemove ? h('button',{type:'button',className:'wb-chip-x','aria-label':'移除上下文：'+(props.title || props.children || ''),onClick:props.onRemove,style:{border:0,background:'transparent',color:'inherit',cursor:'pointer',padding:2}},h(Icon,{name:'close',size:12})):null);
}

function Panel(props?: any): any {
    const bodyClass = 'wb-card-body' + (props.flush ? ' wb-card-body--flush' : '');
    const head = props.title || props.sub || props.actions
        ? h('div', { className: 'wb-card-head' }, props.icon ? h('span', { className: 'wb-card-icon' }, h(Icon, { name: props.icon, size: 15 })) : null, h('div', { className: 'wb-card-titles' }, props.title
            ? h('h3', { className: 'wb-card-title' }, props.title, props.badge || null)
            : null, props.sub ? h('p', { className: 'wb-card-sub' }, props.sub) : null), props.actions ? h('div', { className: 'wb-card-actions' }, props.actions) : null)
        : null;
    return h('section', {
        className: 'wb-card' + (props.className ? ' ' + props.className : ''),
        style: props.style,
    }, head, h('div', { className: bodyClass, style: props.bodyStyle }, props.children));
}

function PageHead(props?: any): any {
    return h('header', { className: 'wb-page-head' }, props.icon ? h('div', { className: 'wb-ph-icon' }, h(Icon, { name: props.icon, size: 18 })) : null, h('div', { style: { minWidth: 0 } }, h('h1', null, props.title), props.sub ? h('p', null, props.sub) : null), props.actions ? h('div', { className: 'wb-ph-actions' }, props.actions) : null);
}

function Stat(props?: any): any {
    const tag = props.onClick ? 'button' : 'div';
    return h(tag, {
        className: 'wb-stat',
        onClick: props.onClick,
        type: props.onClick ? 'button' : undefined,
        style: props.style,
    }, h('div', { className: 'wb-stat-top' }, props.icon ? h(Icon, { name: props.icon, size: 13 }) : null, h('span', null, props.label)), h('div', {
        className: 'wb-stat-value',
        style: props.tone ? { color: props.tone === 'ok' ? T.ok : props.tone === 'warn' ? T.warn : props.tone === 'err' ? T.err : props.tone === 'accent' ? T.accent : undefined } : undefined,
    }, props.value), props.sub ? h('div', { className: 'wb-stat-sub' }, props.sub) : null);
}

function Field(props?: any): any {
    return h('label', { className: 'wb-field', style: props.style }, props.label ? h('span', { className: 'wb-label' }, props.label) : null, props.children, props.hint ? h('span', { className: 'wb-hint' }, props.hint) : null);
}

function Input(props?: any): any {
    const clean = Object.assign({}, props);
    delete clean.invalid;
    return h('input', Object.assign({ className: 'wb-input' + (props.className ? ' ' + props.className : '') }, clean));
}

function Textarea(props?: any): any {
    return h('textarea', Object.assign({ className: 'wb-textarea' }, props));
}

function Select(props?: any): any {
    const children = (props.options || []).map(function (option?: any): any {
        return h('option', { key: option.value, value: option.value }, option.label);
    });
    return h('span', { className: 'wb-select-wrap' }, h('select', {
        className: 'wb-select',
        value: props.value,
        onChange: props.onChange,
        disabled: props.disabled,
        title: props.title,
        'aria-label': props['aria-label'],
    }, children));
}

function Toggle(props?: any): any {
    return h('div', { className: 'wb-row', style: { gap: 8, cursor: props.disabled ? 'not-allowed' : 'pointer' } }, h('span', {
        className: 'wb-switch' + (props.checked ? ' is-on' : ''),
        role: 'switch',
        tabIndex: props.disabled ? -1 : 0,
        'aria-checked': props.checked ? 'true' : 'false',
        onClick: function (): any {
            if (!props.disabled)
                props.onChange(!props.checked);
        },
        onKeyDown: function (event?: any): any {
            if (props.disabled)
                return;
            if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                props.onChange(!props.checked);
            }
        },
    }, h('i', null)), props.label ? h('span', { className: 'wb-tiny' }, props.label) : null);
}

function Segmented(props?: any): any {
    return h('div', { className: 'wb-tabs' }, (props.items || []).map(function (item?: any): any {
        return h('button', {
            key: item.value,
            type: 'button',
            className: 'wb-tab' + (props.value === item.value ? ' is-active' : ''),
            onClick: function (): any {
                props.onChange(item.value);
            },
        }, item.label);
    }));
}

function Tabs(props?: any): any {
    return h('div', { className: 'wb-tabs', style: props.style }, (props.items || []).map(function (item?: any): any {
        return h('button', {
            key: item.value,
            type: 'button',
            className: 'wb-tab' + (props.value === item.value ? ' is-active' : ''),
            onClick: function (): any {
                props.onChange(item.value);
            },
        }, item.label, item.count === undefined || item.count === null
            ? null
            : h('span', { className: 'wb-tab-count' }, String(item.count)));
    }));
}

function Empty(props?: any): any {
    return h('div', { className: 'wb-empty' + (props.className ? ' ' + props.className : ''), style: props.style }, h('div', { className: 'wb-empty-icon' }, h(Icon, { name: props.icon || 'layers', size: 18 })), h('strong', null, props.title || '暂无内容'), props.hint ? h('p', null, props.hint) : null, props.action || null);
}

function Progress(props?: any): any {
    const max = props.max || 100;
    const value = Math.max(0, Math.min(max, props.value || 0));
    return h('div', { className: 'wb-progress' }, h('i', { style: { width: (value / max) * 100 + '%' } }));
}

function Kbd(props?: any): any {
    return h('kbd', { className: 'wb-kbd' }, props.children);
}

function Modal(props?: any): any {
    const maskRef=React.useRef<any>(null);
    React.useEffect(function (): any {
        if (!props.open)
            return undefined;
        function onKey(event?: any): any {
            if (event.key === 'Escape') {
                const masks=document.querySelectorAll('.wb-modal-mask');
                if(masks[masks.length-1]!==maskRef.current)return;
                event.stopPropagation();
                props.onClose();
            }
        }
        window.addEventListener('keydown', onKey, true);
        return function (): any {
            window.removeEventListener('keydown', onKey, true);
        };
    }, [props.open, props.onClose]);
    if (!props.open)
        return null;
    return h('div', {
        ref:maskRef,
        className: 'wb-modal-mask',
        onMouseDown: function (event?: any): any {
            if (event.target === event.currentTarget)
                props.onClose();
        },
    }, h('div', {
        className: 'wb-modal',
        role: 'dialog',
        'aria-modal': 'true',
        style: props.width ? { width: 'min(' + props.width + 'px, 100%)' } : undefined,
    }, h('div', { className: 'wb-modal-head' }, h('div', { style: { flex: '1 1 auto', minWidth: 0 } }, props.title ? h('h2', null, props.title) : null, props.sub ? h('strong', null, props.sub) : null), h(IconBtn, { name: 'close', label: '关闭', onClick: props.onClose })), h('div', { className: 'wb-modal-body' }, props.children), props.footer ? h('div', { className: 'wb-modal-foot' }, props.footer) : null));
}
export { WB_ICON_PATHS, Icon, Divider, Spinner, Btn, IconBtn, Badge, Chip, Panel, PageHead, Stat, Field, Input, Textarea, Select, Toggle, Segmented, Tabs, Empty, Progress, Kbd, Modal }
