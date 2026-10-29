import { Empty, Icon, Kbd, T, WB, h, useStore } from '../core/runtime.js'
import * as React from 'react'
/* ============================================================================
 * dev-workbench command palette
 *
 * Cmd/Ctrl+K. One entry point for navigation and the two host mutations a
 * keyboard user needs most (new task, refresh). Task hits are real data from
 * the current snapshot, never a fabricated suggestion list.
 * ========================================================================== */
function paletteCommands(context?: any): any {
    const commands: any = [];
    WB.ORDER.forEach(function (id?: any, index?: any): any {
        const meta = WB.PAGE_META[id];
        if (!meta)
            return;
        commands.push({
            id: 'nav:' + id,
            label: '转到 ' + meta.title,
            hint: meta.hint,
            icon: meta.icon,
            keys: '⌘' + (index + 1),
            group: '导航',
            run: function (): any {
                WB.go(id);
            },
        });
    });
    commands.push({
        id: 'task:new',
        label: '新建待办',
        hint: '打开任务表单，记录标题、优先级与截止时间',
        icon: 'plus',
        group: '操作',
        run: function (): any {
            WB.openTaskForm(null);
        },
    });
    commands.push({
        id: 'data:refresh',
        label: '重新读取 Host 数据',
        hint: '重新拉取 workbench 快照',
        icon: 'refresh',
        group: '操作',
        run: function (): any {
            WB.actions.reload().catch(function (): any { });
        },
    });
    if (context && context.counts && context.counts.overdue > 0) {
        commands.push({
            id: 'task:overdue',
            label: '查看 ' + context.counts.overdue + ' 项逾期任务',
            hint: '跳到任务中心',
            icon: 'alert',
            group: '操作',
            run: function (): any {
                WB.go('tasks');
            },
        });
    }
    if (context && context.runs && context.runs.length > 0) {
        commands.push({
            id: 'nav:agents',
            label: '查看执行记录（' + context.runs.length + '）',
            hint: 'Agent 中心：队列、审批与结果',
            icon: 'agent',
            group: '操作',
            run: function (): any {
                WB.go('agents');
            },
        });
    }
    // 搜索页结果（命令面板内联检索，只走本地路）
    const searchGroups = (context && context.searchResults && context.searchResults.groups) || [];
    const SEARCH_ICON: any = {
        tasks: 'tasks',
        knowledge: 'book',
        radar: 'sparkles',
        sources: 'layers',
        files: 'folder',
        enterprise: 'building',
        contacts: 'users',
        rooms: 'users',
        attendance: 'clock',
        events: 'calendar',
        github: 'git',
        web: 'globe',
    };
    searchGroups.forEach(function (group?: any): any {
        if (group.status !== 'ok')
            return;
        group.items.slice(0, 5).forEach(function (item?: any, index?: any): any {
            commands.push({
                id: 'search:' + group.id + ':' + (item.id || index) + ':' + index,
                label: item.title,
                hint: group.label + (item.snippet ? ' · ' + WB.util.truncate(String(item.snippet), 56) : ''),
                icon: SEARCH_ICON[group.id] || 'search',
                group: '搜索 · ' + group.label,
                run: function (): any {
                    WB.setSearchPreset({ query: context.searchQuery, groups: [group.id] });
                    WB.go('search');
                },
            });
        });
    });
    const tasks = (context && context.tasks) || [];
    tasks.slice(0, 40).forEach(function (task?: any): any {
        commands.push({
            id: 'task:' + task.id,
            label: task.title,
            hint: '待办 · ' + (WB.TASK_STATUS[task.status] || {}).label + (task.dueAt ? ' · 截止 ' + WB.fmt.day(task.dueAt) : ''),
            icon: 'tasks',
            group: '待办',
            run: function (): any {
                WB.openTaskForm(task);
            },
        });
    });
    return commands;
}
function paletteMatch(command?: any, query?: any): any {
    if (!query)
        return true;
    const haystack = (command.label + ' ' + (command.hint || '') + ' ' + (command.group || '')).toLowerCase();
    const needle = query.toLowerCase().trim();
    if (!needle)
        return true;
    let index = 0;
    for (let i = 0; i < haystack.length && index < needle.length; i += 1) {
        if (haystack[i] === needle[index])
            index += 1;
    }
    return index === needle.length;
}
function Palette(props?: any): any {
    const state = useStore();
    const [query, setQuery] = React.useState<any>('');
    const [active, setActive] = React.useState<any>(0);
    const [searchResults, setSearchResults] = React.useState<any>(null);
    const inputRef = React.useRef<any>(null);
    const data = state.data || {};
    // 内联检索：输入 ≥2 字时防抖查本地路（不联网），结果并入命令列表
    React.useEffect(function (): any {
        if (!props.open)
            return undefined;
        const text = query.trim();
        if (text.length < 2) {
            setSearchResults(null);
            return undefined;
        }
        const timer = setTimeout(function (): any {
            WB.actions
                .search(text, { includeWeb: false })
                .then(function (result?: any): any {
                setSearchResults(result);
            })
                .catch(function (): any {
                setSearchResults(null);
            });
        }, 260);
        return function (): any {
            clearTimeout(timer);
        };
    }, [query, props.open]);
    const commands = paletteCommands({
        tasks: data.tasks,
        runs: data.runs,
        counts: WB.taskCounts(data),
        searchResults: searchResults,
        searchQuery: query.trim(),
    });
    const results = commands.filter(function (command?: any): any {
        return paletteMatch(command, query);
    });
    const shown = results.slice(0, 40);
    React.useEffect(function (): any {
        if (!props.open)
            return;
        setQuery('');
        setActive(0);
        const timer = setTimeout(function (): any {
            if (inputRef.current && inputRef.current.focus)
                inputRef.current.focus();
        }, 10);
        return function (): any {
            clearTimeout(timer);
        };
    }, [props.open]);
    React.useEffect(function (): any {
        setActive(0);
    }, [query]);
    if (!props.open)
        return null;
    function runAt(index?: any): any {
        const command = shown[index];
        if (!command)
            return;
        props.onClose();
        command.run();
    }
    function onKeyDown(event?: any): any {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive(function (index?: any): any {
                return Math.min(shown.length - 1, index + 1);
            });
        }
        else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(function (index?: any): any {
                return Math.max(0, index - 1);
            });
        }
        else if (event.key === 'Enter') {
            event.preventDefault();
            runAt(active);
        }
        else if (event.key === 'Escape') {
            event.preventDefault();
            props.onClose();
        }
    }
    let lastGroup: any = null;
    return h('div', {
        className: 'wb-modal-mask',
        style: { paddingTop: '14vh' },
        onMouseDown: function (event?: any): any {
            if (event.target === event.currentTarget)
                props.onClose();
        },
    }, h('div', {
        className: 'wb-modal',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': '命令面板',
        style: { width: 'min(600px, 100%)', maxHeight: '62vh' },
    }, h('div', {
        style: {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 14px',
            borderBottom: '1px solid ' + T.border1,
        },
    }, h(Icon, { name: 'search', size: 15 }), h('input', {
        ref: inputRef,
        value: query,
        placeholder: '搜索待办、知识、资讯，或输入命令…',
        onChange: function (event?: any): any {
            setQuery(event.target.value);
        },
        onKeyDown: onKeyDown,
        style: {
            flex: '1 1 auto',
            minWidth: 0,
            border: 0,
            outline: 'none',
            background: 'transparent',
            color: T.text,
            font: 'inherit',
            fontSize: 13,
        },
    }), h(Kbd, null, 'esc')), h('div', { style: { overflow: 'auto', padding: '5px 6px 7px' } }, shown.length === 0
        ? h(Empty, {
            icon: 'search',
            title: '没有匹配的命令或待办',
            hint: '试试页面名称，或直接新建一条待办。',
        })
        : shown.map(function (command?: any, index?: any): any {
            const header = command.group !== lastGroup
                ? (lastGroup = command.group,
                    h('div', {
                        key: 'group:' + command.group,
                        style: {
                            padding: '7px 9px 3px',
                            fontSize: 10,
                            letterSpacing: '.08em',
                            textTransform: 'uppercase',
                            color: T.text2,
                        },
                    }, command.group))
                : null;
            return h(React.Fragment, { key: command.id }, header, h('button', {
                type: 'button',
                onMouseEnter: function (): any {
                    setActive(index);
                },
                onClick: function (): any {
                    runAt(index);
                },
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    padding: '7px 9px',
                    border: 0,
                    borderRadius: 9,
                    background: index === active ? T.layer2 : 'transparent',
                    color: T.text,
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                },
            }, h('span', { style: { display: 'inline-flex', color: index === active ? T.accent : T.text2 } }, h(Icon, { name: command.icon, size: 14 })), h('span', { style: { flex: '1 1 auto', minWidth: 0 } }, h('span', { className: 'wb-ellipsis', style: { display: 'block', fontSize: 12.5 } }, command.label), command.hint ? h('span', { className: 'wb-ellipsis wb-tiny wb-muted', style: { display: 'block' } }, command.hint) : null), command.keys ? h(Kbd, null, command.keys) : null));
        })), h('div', {
        className: 'wb-row wb-tiny wb-muted',
        style: { padding: '7px 14px', borderTop: '1px solid ' + T.border1, gap: 12 },
    }, h('span', { className: 'wb-row', style: { gap: 4 } }, h(Kbd, null, '↑'), h(Kbd, null, '↓'), '选择'), h('span', { className: 'wb-row', style: { gap: 4 } }, h(Kbd, null, '↵'), '执行'), query.trim().length >= 2 ? h('span', { className: 'wb-muted' }, '本地检索 · 不联网') : null, h('span', { className: 'wb-spacer' }), h('span', null, shown.length + ' 项结果'))));
}
WB.Palette = Palette;

export { paletteCommands, paletteMatch, Palette }
