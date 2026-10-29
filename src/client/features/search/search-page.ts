import { Badge, Btn, Chip, Divider, Empty, Icon, Input, PageHead, Panel, Select, Spinner, Toggle, WB, h, useStore } from '../../core/runtime.js'
import * as React from 'react'
/* ============================================================================
 * dev-workbench — 搜索 (search)
 *
 * Design report §3.3: multiple providers, source-attributed results, and the
 * hard rule "无命中时不得编造企业事实". So this page renders GROUPS, never a
 * merged list: each group keeps its own status and reason, an unavailable or
 * failing provider stays visible as a row with its explanation, and there is no
 * model summary anywhere on this page — a summary would need citations this
 * plugin cannot verify.
 *
 * Query execution is explicit (Enter / button), not per-keystroke, because one
 * of the providers leaves the machine.
 * ========================================================================== */
function searchKindMeta(kind?: any): any {
    if (kind === 'task')
        return { label: '待办', icon: 'tasks', tone: 'accent' };
    if (kind === 'knowledge')
        return { label: '知识', icon: 'book', tone: 'ok' };
    if (kind === 'radar')
        return { label: '雷达', icon: 'radar', tone: 'idle' };
    if (kind === 'source')
        return { label: '来源', icon: 'link', tone: 'idle' };
    if (kind === 'web')
        return { label: '外网', icon: 'external', tone: 'warn' };
    if (kind === 'contact')
        return { label: '联系人', icon: 'agent', tone: 'accent' };
    if (kind === 'room')
        return { label: '会议室', icon: 'calendar', tone: 'ok' };
    if (kind === 'attendance')
        return { label: '考勤', icon: 'clock', tone: 'idle' };
    return { label: kind, icon: 'layers', tone: 'idle' };
}
function searchStatusMeta(status?: any): any {
    if (status === 'ok')
        return { label: '已返回', tone: 'ok' };
    if (status === 'empty')
        return { label: '无命中', tone: 'idle' };
    if (status === 'unavailable')
        return { label: '不可用', tone: 'warn' };
    if (status === 'error')
        return { label: '失败', tone: 'err' };
    return { label: status, tone: 'idle' };
}
function SearchResultRow(props?: any): any {
    const item = props.item;
    const meta = searchKindMeta(item.kind);
    const extra = item.extra || {};
    function collect(): any {
        WB.actions
            .createKnowledge({
            kind: 'bookmark',
            title: item.title,
            url: item.url || null,
            body: item.snippet || '',
            tags: ['搜索', meta.label],
        })
            .catch(function (): any { });
    }
    return h('div', { className: 'wb-item', style: { alignItems: 'flex-start' } }, h('div', { className: 'wb-item-main' }, h('div', { className: 'wb-item-title', style: { display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' } }, h(Badge, { tone: meta.tone }, meta.label), item.url
        ? h('a', {
            href: item.url,
            target: '_blank',
            rel: 'noreferrer',
            className: 'wb-link',
            style: { fontWeight: 500 },
        }, item.title)
        : h('span', null, item.title)), item.snippet ? h('div', { className: 'wb-item-sub wb-clamp2' }, item.snippet) : null, h('div', { className: 'wb-item-sub' }, item.kind === 'task' && extra.status ? h('span', null, (WB.TASK_STATUS[extra.status] || {}).label || extra.status) : null, item.kind === 'task' && extra.dueAt ? h('span', null, '截止 ' + WB.fmt.day(extra.dueAt)) : null, item.kind === 'source' && extra.provider ? h('span', null, extra.provider) : null, item.kind === 'radar' && extra.source ? h('span', null, extra.source) : null, item.kind === 'web' && extra.publishedAt ? h('span', null, WB.fmt.date(extra.publishedAt)) : null, item.kind === 'knowledge' && extra.tags && extra.tags.length
        ? extra.tags.map(function (tag?: any): any {
            return h(Chip, { key: tag, children: tag });
        })
        : null)), h('div', { className: 'wb-item-actions', style: { opacity: 1 } }, item.kind === 'task'
        ? h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'arrowRight',
            children: '定位',
            onClick: function (): any {
                WB.focusTask(item.id);
            },
        })
        : null, item.kind === 'radar' || item.kind === 'knowledge'
        ? h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'copy',
            children: '复制',
            onClick: function (): any {
                WB.util
                    .copy([item.title, item.snippet, item.url].filter(Boolean).join('\n'))
                    .then(function (): any {
                    WB.toast('已复制', 'ok');
                })
                    .catch(function (e?: any): any {
                    WB.toast(String((e && e.message) || e), 'err');
                });
            },
        })
        : null, h(Btn, {
        size: 'sm',
        kind: 'subtle',
        icon: 'book',
        children: '收藏',
        onClick: collect,
    }), h(Btn, {
        size: 'sm',
        kind: 'subtle',
        icon: 'plus',
        children: '建待办',
        onClick: function (): any {
            WB.openTaskForm({
                title: WB.util.truncate(item.title || '来自检索结果', 80),
                description: String((item.snippet || '') + (item.url ? '\n来源：' + item.url : '')).slice(0, 2000),
                projectId: null,
                taskId: null,
            });
        },
    }), h(Btn, {
        size: 'sm',
        kind: 'subtle',
        icon: 'sparkles',
        children: 'AI 分析',
        onClick: function (): any {
            WB.assistant.add({
                kind: 'source',
                id: item.id,
                title: item.title,
                url: item.url || null,
                body: item.snippet || '',
                meta: '来源分组：' + props.groupLabel,
            });
        },
    })));
}
function SearchPage(): any {
    const state = useStore();
    const data = state.data;
    const [draft, setDraft] = React.useState<any>('');
    const [query, setQuery] = React.useState<any>('');
    // 默认只搜本地与已有来源（不联网）；需要外网时再打开开关
    const [includeWeb, setIncludeWeb] = React.useState<any>(false);
    const [busy, setBusy] = React.useState<any>(false);
    const [error, setError] = React.useState<any>(null);
    const [result, setResult] = React.useState<any>(null);
    const [hidden, setHidden] = React.useState<any>([]);
    const [history, setHistory] = React.useState<any>([]);
    const [dateFilter, setDateFilter] = React.useState<any>('all');
    const [projectFilter, setProjectFilter] = React.useState<any>('');
    /** 分类筛选（本地 / 企业 / 代码 / 互联网），与逐路开关叠加 */
    const [category, setCategory] = React.useState<any>('all');
    // 命令面板选「去搜索页」时通过 searchPreset 交接查询词
    const preset = state.searchPreset;
    const presetConsumed = React.useRef<any>(null);
    React.useEffect(function (): any {
        if (!preset || presetConsumed.current === preset)
            return;
        presetConsumed.current = preset;
        const text = String(preset.query || '').trim();
        if (text) {
            setDraft(text);
            run(text);
        }
        if (preset.groups && preset.groups.length > 0) {
            // 命令面板选中的具体结果：把该结果所在的分组映射到分类
            const groupId = preset.groups[0];
            const matched = SEARCH_CATEGORIES.find(function (item?: any): any {
                return item.groups && item.groups.indexOf(groupId) >= 0;
            });
            if (matched)
                setCategory(matched.id);
        }
        else if (preset.category) {
            setCategory(preset.category);
        }
        WB.clearSearchPreset();
    }, [preset]);
    const SEARCH_DATE_WINDOWS: any = { all: 0, day: 24 * 3600 * 1000, week: 7 * 24 * 3600 * 1000, month: 30 * 24 * 3600 * 1000 };
    function itemPasses(item?: any): any {
        const extra = item.extra || {};
        if (projectFilter && item.kind === 'task' && (extra.projectId || null) !== projectFilter)
            return false;
        if (dateFilter !== 'all') {
            const at = extra.at;
            if (at) {
                const stamp = new Date(at).getTime();
                if (!Number.isNaN(stamp) && Date.now() - stamp > SEARCH_DATE_WINDOWS[dateFilter])
                    return false;
            }
        }
        return true;
    }
    function run(nextQuery?: any): any {
        const text = String(nextQuery === undefined ? draft : nextQuery).trim();
        if (!text)
            return;
        setDraft(text);
        setQuery(text);
        setBusy(true);
        setError(null);
        WB.actions
            .search(text, { includeWeb: includeWeb })
            .then(function (value?: any): any {
            setResult(value);
            setBusy(false);
            setHistory(function (previous?: any): any {
                return [text]
                    .concat(previous.filter(function (item?: any): any {
                    return item !== text;
                }))
                    .slice(0, 6);
            });
        })
            .catch(function (e?: any): any {
            setBusy(false);
            setError(String((e && e.message) || e));
            setResult(null);
        });
    }
    const SEARCH_CATEGORIES: any = [
        { id: 'all', label: '全部', groups: null },
        { id: 'local', label: '本地', groups: ['tasks', 'knowledge', 'radar', 'sources', 'files'] },
        { id: 'enterprise', label: '企业', groups: ['enterprise', 'contacts', 'rooms', 'attendance', 'events'] },
        { id: 'code', label: '代码', groups: ['github', 'files'] },
        { id: 'web', label: '互联网', groups: ['web'] },
    ];
    const activeCategory = preset && preset.category && SEARCH_CATEGORIES.some(function (item?: any): any { return item.id === preset.category; })
        ? preset.category
        : category;
    const categoryGroups = (function (): any {
        const found = SEARCH_CATEGORIES.find(function (item?: any): any {
            return item.id === activeCategory;
        });
        return found && found.groups ? found.groups : null;
    })();
    const groups = (result && result.groups) || [];
    const visible = groups
        .filter(function (group?: any): any {
        if (hidden.indexOf(group.id) >= 0)
            return false;
        if (!categoryGroups)
            return true;
        return categoryGroups.indexOf(group.id) >= 0;
    })
        .map(function (group?: any): any {
        if (group.status !== 'ok' && group.items.length === 0)
            return group;
        return Object.assign({}, group, { items: group.items.filter(itemPasses) });
    });
    const totalVisible = visible.reduce(function (sum?: any, group?: any): any {
        return sum + group.items.length;
    }, 0);
    return h('div', null, h(PageHead, {
        icon: 'search',
        title: WB.t('nav.search', '搜索'),
        sub: '一个入口搜全部：本地、企业、代码与外网各算一路，某一路失败不影响其它来源。',
        actions: h(React.Fragment, null, h(Toggle, {
            checked: includeWeb,
            onChange: setIncludeWeb,
            label: '含互联网',
        }), h(Btn, {
            icon: 'search',
            size: 'sm',
            kind: 'primary',
            disabled: busy || !draft.trim(),
            onClick: function (): any {
                run();
            },
            children: busy ? '检索中…' : '搜索',
        })),
    }), h(Panel, { title: '关键词', icon: 'filter', sub: '本地三路立即返回；互联网一路可能较慢' }, h('div', { className: 'wb-row' }, h(Icon, { name: 'search', size: 15 }), h(Input, {
        value: draft,
        autoFocus: true,
        placeholder: '搜索待办、知识、技术雷达，或输入一串外部问题…',
        onChange: function (event?: any): any {
            setDraft(event.target.value);
        },
        onKeyDown: function (event?: any): any {
            if (event.key === 'Enter') {
                event.preventDefault();
                run();
            }
        },
    }), h(Btn, {
        icon: 'arrowRight',
        kind: 'primary',
        disabled: busy || !draft.trim(),
        onClick: function (): any {
            run();
        },
        children: '检索',
    })), history.length === 0
        ? null
        : h('div', { className: 'wb-row wb-row--wrap', style: { marginTop: 10, gap: 6 } }, h('span', { className: 'wb-tiny wb-muted' }, '最近：'), history.map(function (item?: any): any {
            return h(Chip, {
                key: item,
                children: item,
                onClick: function (): any {
                    run(item);
                },
            });
        }))), h('div', { style: { height: 14 } }), busy
        ? h('div', { className: 'wb-row', style: { padding: '26px 0', justifyContent: 'center', gap: 8 } }, h(Spinner, { size: 17 }), h('span', { className: 'wb-tiny wb-muted' }, '正在按来源分组检索「' + query + '」…'))
        : null, error
        ? h(Panel, { title: '检索失败', icon: 'alert', sub: 'Host 没有完成这次检索' }, h('div', { role: 'alert', className: 'wb-code' }, error), h('p', { className: 'wb-hint', style: { marginTop: 8 } }, '如果刚刚更新过插件，说明 Host 还没有加载新的 Remote 端点：重启 DSH 后再试。'))
        : null, !busy && !error && !result
        ? h('div', { className: 'wb-grid', style: { gridTemplateColumns: 'minmax(0, 1fr) 260px' } }, h(Panel, { title: '怎么查', icon: 'info' }, h('div', { className: 'wb-stack', style: { gap: 7 } }, h('span', { className: 'wb-tiny' }, '· 待办：标题、描述、标签'), h('span', { className: 'wb-tiny' }, '· 知识空间：收藏与笔记正文'), h('span', { className: 'wb-tiny' }, '· 技术雷达：标题与四段摘要'), h('span', { className: 'wb-tiny' }, '· 来源证据：消息与文件摘录'), h('span', { className: 'wb-tiny' }, '· 企业（云之家）：经 Host 调 yzj-cli 消息与文档搜索（需已认证）'), h('span', { className: 'wb-tiny' }, '· 互联网：经 Host 的 web 服务，结果带 URL 与时间'), h(Divider, null), h('span', { className: 'wb-tiny wb-muted' }, '本页不会把多路结果合并成一段没有引用的结论。要看归纳，请把任务简报交给会话里的 Agent。'))), h(Panel, { title: '当前可检索范围', icon: 'database', sub: '来自 Host 快照' }, h('div', { className: 'wb-stack', style: { gap: 6 } }, h('span', { className: 'wb-tiny' }, '待办 ' + ((data && data.tasks) || []).length + ' 条'), h('span', { className: 'wb-tiny' }, '知识 ' + ((data && data.knowledge) || []).length + ' 条'), h('span', { className: 'wb-tiny' }, '雷达 ' + ((data && data.radar) || []).length + ' 条'), h('span', { className: 'wb-tiny' }, '来源 ' + ((data && data.sources) || []).length + ' 条'))))
        : null, result
        ? h('div', null, h('div', { className: 'wb-row wb-row--wrap', style: { marginBottom: 6, gap: 6 } }, h('span', { className: 'wb-tiny wb-muted' }, '日期：'), [
            { value: 'all', label: '全部' },
            { value: 'day', label: '24 小时' },
            { value: 'week', label: '7 天' },
            { value: 'month', label: '30 天' },
        ].map(function (option?: any): any {
            return h(Chip, {
                key: option.value,
                active: dateFilter === option.value,
                onClick: function (): any {
                    setDateFilter(option.value);
                },
                children: option.label,
            });
        }), h('span', { className: 'wb-tiny wb-muted', style: { marginLeft: 12 } }, '项目：'), h(Select, {
            value: projectFilter,
            options: [{ value: '', label: '全部项目' }].concat((((data && data.projects) || []).map(function (project?: any): any {
                return { value: project.id, label: project.name };
            }))),
            onChange: function (event?: any): any {
                setProjectFilter(event.target.value);
            },
        }), h('span', { className: 'wb-tiny wb-muted' }, '仅作用于「我的待办」一路')), h('div', { className: 'wb-row wb-row--wrap', style: { marginBottom: 8, gap: 6 } }, h('span', { className: 'wb-tiny wb-muted' }, '分类：'), SEARCH_CATEGORIES.map(function (option?: any): any {
            return h(Chip, {
                key: option.id,
                active: activeCategory === option.id,
                onClick: function (): any {
                    setCategory(option.id);
                },
                children: option.label,
                title: option.groups ? '只看：' + option.groups.join(' / ') : '显示所有来源分组',
            });
        }), h('span', { className: 'wb-tiny wb-muted', style: { marginLeft: 8 } }, '分类叠加来源筛选')), h('div', { className: 'wb-row wb-row--wrap', style: { marginBottom: 12, gap: 6 } }, h('span', { className: 'wb-tiny wb-muted' }, '来源筛选：'), groups.map(function (group?: any): any {
            const meta = searchStatusMeta(group.status);
            const active = hidden.indexOf(group.id) < 0;
            return h(Chip, {
                key: group.id,
                active: active,
                onClick: function (): any {
                    setHidden(function (previous?: any): any {
                        return active
                            ? previous.concat([group.id])
                            : previous.filter(function (id?: any): any {
                                return id !== group.id;
                            });
                    });
                },
                children: group.label + ' ' + group.items.length,
                title: meta.label,
            });
        }), h('div', { className: 'wb-spacer' }), h('span', { className: 'wb-tiny wb-muted' }, '共 ' + totalVisible + ' 条 · ' + WB.fmt.relative(result.at, Date.now()))), totalVisible === 0
            ? h(Empty, {
                icon: 'search',
                title: '「' + result.query + '」在已启用的来源里没有命中',
                hint: '本页不会为了凑结果而编造企业事实。可以换一个关键词、扩大时间范围，或到知识空间先补充资料。',
                action: h(Btn, {
                    size: 'sm',
                    icon: 'refresh',
                    children: '再查一次',
                    onClick: function (): any {
                        run();
                    },
                }),
            })
            : null, visible.map(function (group?: any): any {
            const meta = searchStatusMeta(group.status);
            const bad = group.status === 'error' || group.status === 'unavailable';
            return h('div', { key: group.id, style: { marginBottom: 14 } }, h(Panel, {
                title: group.label,
                icon: group.id === 'web'
                    ? 'external'
                    : group.id === 'enterprise'
                        ? 'lock'
                        : group.id === 'contacts'
                            ? 'agent'
                            : group.id === 'rooms'
                                ? 'calendar'
                                : group.id === 'attendance'
                                    ? 'clock'
                                    : group.id === 'tasks'
                                        ? 'tasks'
                                        : group.id === 'knowledge'
                                            ? 'book'
                                            : group.id === 'radar'
                                                ? 'radar'
                                                : 'link',
                badge: h(Badge, { tone: meta.tone }, meta.label),
                sub: group.note || undefined,
                actions: h('span', { className: 'wb-tiny wb-muted' }, group.items.length + ' 条'),
            }, bad && group.items.length === 0
                ? h(Empty, {
                    icon: 'alert',
                    title: group.status === 'unavailable' ? '这一路当前不可用' : '这一路检索失败',
                    hint: group.note || '没有拿到结果。其余来源不受影响。',
                })
                : group.items.length === 0
                    ? h(Empty, { icon: 'search', title: '这一路没有命中', hint: '换个关键词可能更好。' })
                    : h('div', null, group.items.map(function (item?: any): any {
                        return h(SearchResultRow, { key: item.id, item: item });
                    }))));
        }))
        : null);
}
WB.pages.search = SearchPage;

export { searchKindMeta, searchStatusMeta, SearchResultRow, SearchPage }

