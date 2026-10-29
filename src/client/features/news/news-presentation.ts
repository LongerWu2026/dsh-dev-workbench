import * as React from 'react'
import { Badge, Btn, Divider, Field, Icon, IconBtn, Input, Modal, T, Textarea, WB, h } from '../../core/runtime.js'
import { dashTagPill } from '../dashboard/selectors.js'

function dashRadarTimeValue(item?: any): any {
    const value = item.publishedAt || item.fetchedAt || item.createdAt;
    if (!value)
        return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
}

function dashSummaryParts(summary?: any): any {
    const defs: any = [
        { key: 'change', label: '技术变化' },
        { key: 'usage', label: '应用场景' },
        { key: 'risk', label: '采用风险' },
        { key: 'practice', label: '推荐实践' },
    ];
    if (!summary || typeof summary !== 'object')
        return [];
    return defs
        .map(function (def?: any): any {
        const text = typeof summary[def.key] === 'string' ? summary[def.key].trim() : '';
        return { key: def.key, label: def.label, text: text };
    })
        .filter(function (part?: any): any {
        return part.text.length > 0;
    });
}

function DashRadarRow(props?: any): any {
    const item = props.item;
    const rawParts = dashSummaryParts(item.summary);
    // Fetched items keep the raw excerpt; the four-part summary stays empty until
    // an agent digests it, so the row never shows an invented summary.
    const summaryParts = rawParts.length > 0
        ? rawParts
        : item.excerpt
            ? [{ key: 'excerpt', label: '原文摘录', text: item.excerpt }]
            : [];
    const needsDigest = rawParts.length === 0 && !!item.excerpt;
    const published = item.dateKind !== 'unknown' ? item.publishedAt : null;
    const topics = Array.isArray(item.topics) ? item.topics : [];
    const [saving, setSaving] = React.useState<any>(false);
    const [makingTask, setMakingTask] = React.useState<any>(false);
    const [confirmTask,setConfirmTask]=React.useState(false);
    function makePracticeTask(): any {
        if (makingTask)
            return;
        setMakingTask(true);
        WB.actions
            .createTaskFromRadar(item.id)
            .then(function (): any {
            setMakingTask(false);
            setConfirmTask(false);
        })
            .catch(function (): any {
            setMakingTask(false);
        });
    }
    function saveToKnowledge(): any {
        if (saving)
            return;
        setSaving(true);
        const body = summaryParts
            .map(function (part?: any): any {
            return part.label + '：' + part.text;
        })
            .join('\n');
        WB.actions
            .createKnowledge({
            kind: 'bookmark',
            title: item.title,
            url: item.url || null,
            body: body || item.title,
            tags: topics.slice(0, 8),
        })
            .then(function (): any {
            setSaving(false);
        })
            .catch(function (): any {
            setSaving(false);
        });
    }
    return h('div', {
        className: 'wb-item',
        style: { flexDirection: 'column', alignItems: 'stretch', gap: 2, padding: '10px 4px' },
    }, h(Modal,{open:confirmTask,title:'将资讯添加为我的待办',onClose:()=>{if(!makingTask)setConfirmTask(false)},footer:h('div',{className:'wb-row',style:{gap:8}},h(Btn,{disabled:makingTask,onClick:()=>setConfirmTask(false),children:'取消'}),h(Btn,{kind:'primary',disabled:makingTask,onClick:makePracticeTask,children:makingTask?'正在添加…':'确认添加待办'}))},h('p',null,'将创建「实践：'+item.title+'」并保留原文来源。'),h('p',{className:'wb-tiny wb-muted'},'仅在你计划实际处理时添加。抓取资讯和生成摘要不会自动创建待办。')), h('div', { className: 'wb-row', style: { alignItems: 'flex-start', gap: 8 } }, h('div', { className: 'wb-item-main' }, h('div', { className: 'wb-item-title', style: { display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' } }, item.url
        ? h('a', {
            className: 'wb-link',
            href: item.url,
            target: '_blank',
            rel: 'noreferrer noopener',
            style: { fontSize: 12.5, fontWeight: 500 },
            title: '打开原文',
        }, item.title, h(Icon, { name: 'external', size: 10 }))
        : h('span', null, item.title), item.saved ? h(Badge, { tone: 'ok' }, '已收藏') : null, item.github ? h('span',{className:'wb-tiny wb-muted'},item.github.status==='verified'?'GitHub 已核验 · ★ '+item.github.stars+' · 最近提交 '+WB.fmt.date(item.github.pushedAt)+(item.github.starGrowth==null?' · 增长待观察':' · 观察期增长 '+item.github.starGrowth)+(item.github.archived?' · 已归档':'')+(item.github.release?' · '+item.github.release:''): 'GitHub 热度未核验') : null), h('div', { className: 'wb-item-sub', style: { gap: 5 } }, h('span', { className: 'wb-muted' }, item.source || '未知来源'), h('span', { className: 'wb-muted' }, '·'), published
        ? h('span', { className: 'wb-muted' }, WB.fmt.date(published))
        : h('span', { className: 'wb-muted', title: '原文未注明发布时间；抓取于 ' + (item.fetchedAt ? WB.fmt.datetime(item.fetchedAt) : '') + '，不以抓取时间冒充' }, '日期未注明（抓取于 ' + (item.fetchedAt ? WB.fmt.relative(item.fetchedAt) : '最近') + '）'), topics.map(function (topic?: any, index?: any): any {
        return dashTagPill(topic, 'topic:' + topic + ':' + index);
    }))), h('div', { className: 'wb-item-actions', style: { opacity: 1 } }, h(DashRadarMenu, {
        item: item,
        saving: saving,
        makingTask: makingTask,
        onSave: saveToKnowledge,
        onMakeTask: ()=>setConfirmTask(true),
        onEdit: props.onEdit,
    }), summaryParts.length > 0
        ? h(IconBtn, {
            name: props.expanded ? 'chevronDown' : 'chevronRight',
            label: props.expanded ? '收起摘要' : '展开摘要',
            onClick: props.onToggle,
        })
        : null)), item.summaryStatus === 'failed' ? h('p', {className:'wb-tiny wb-muted'}, '摘要暂不可用') : null, props.expanded && summaryParts.length > 0
        ? h('div', {
            style: {
                display: 'grid',
                gap: 5,
                marginTop: 4,
                padding: '9px 10px',
                border: '1px solid ' + T.border1,
                borderRadius: 10,
                background: T.layer2,
            },
        }, summaryParts.map(function (part?: any): any {
            return h('div', { key: part.key, style: { display: 'flex', alignItems: 'flex-start', gap: 8 } }, h('span', { style: { flex: 'none', width: 56, fontSize: 11, color: T.text2 } }, part.label), h('span', { style: { fontSize: 11.5, lineHeight: 1.6, color: T.text } }, part.text));
        }), needsDigest
            ? h('div', { style: { marginTop: 4, fontSize: 11, color: T.text2 } }, '当前为原文摘录；在操作菜单选择「生成四段摘要」，使用宿主模型归纳。')
            : null)
        : null);
}

/** 雷达行的操作收进单个「⋯」向上菜单，窄列里不再把标题挤成竖字。 */
function DashRadarMenu(props?: any): any {
    const item = props.item;
    const [open, setOpen] = React.useState<any>(false);
    const entries: any = [
        {
            key: 'save',
            icon: 'book',
            label: props.saving ? '收藏中…' : '收藏到知识空间',
            disabled: props.saving,
            run: props.onSave,
        },
        {
            key: 'task',
            icon: 'play',
            label: props.makingTask ? '生成中…' : '添加为我的待办',
            disabled: props.makingTask,
            run: props.onMakeTask,
        },
        {
            key: 'summarize',
            icon: 'book',
            label: '生成四段摘要',
            run: function (): any {
                WB.actions.radarSummarize([item.id], item.summaryStatus === 'failed').then(function (result?: any): any {
                    WB.toast(result.jobId ? '摘要已进入后台队列：' + result.jobId : result.failed > 0 ? '摘要：成功 ' + result.done + ' / 失败 ' + result.failed : result.done > 0 ? '已生成四段摘要' : (result.note || '无需生成'), result.failed > 0 ? 'warn' : 'ok');
                    return WB.actions.reload();
                }).catch(function (): any { });
            },
        },
        { key: 'edit', icon: 'edit', label: '编辑四段摘要', run: props.onEdit },
        {
            key: 'delete',
            icon: 'trash',
            label: '删除这条资讯',
            run: function (): any {
                if (!window.confirm('删除这条资讯？'))
                    return;
                WB.actions.deleteRadarItem(item.id).catch(function (): any { });
            },
        },
        {
            key: 'ai',
            icon: 'sparkles',
            label: 'AI 分析（带上下文）',
            run: function (): any {
                WB.assistant.add({
                    kind: 'radar',
                    id: item.id,
                    title: item.title,
                    url: item.url || null,
                    body: item.excerpt || '',
                });
            },
        },
    ];
    return h('div', { style: { position: 'relative', flex: 'none', zIndex: open ? 30 : undefined } }, open
        ? h('div', {
            style: {
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                minWidth: 152,
                padding: 4,
                border: '1px solid ' + T.border1,
                borderRadius: 9,
                background: T.layer1,
                boxShadow: '0 8px 22px rgba(0,0,0,.32)',
            },
        }, entries.map(function (entry?: any): any {
            return h('button', {
                key: entry.key,
                type: 'button',
                disabled: !!entry.disabled,
                onClick: function (): any {
                    setOpen(false);
                    entry.run();
                },
                style: {
                    appearance: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    width: '100%',
                    textAlign: 'left',
                    border: 0,
                    borderRadius: 6,
                    background: 'transparent',
                    color: T.text,
                    font: 'inherit',
                    fontSize: 11.5,
                    lineHeight: 1.7,
                    padding: '3px 7px',
                    cursor: entry.disabled ? 'default' : 'pointer',
                    opacity: entry.disabled ? 0.55 : 1,
                },
            }, h(Icon, { name: entry.icon, size: 11 }), entry.label);
        }))
        : null, h(IconBtn, {
        name: 'more',
        label: '这条资讯的操作',
        active: open,
        onClick: function (): any {
            setOpen(!open);
        },
    }));
}

function DashRadarModal(props?: any): any {
    const editing = props.item || null;
    const [title, setTitle] = React.useState<any>('');
    const [source, setSource] = React.useState<any>('');
    const [url, setUrl] = React.useState<any>('');
    const [publishedAt, setPublishedAt] = React.useState<any>('');
    const [topics, setTopics] = React.useState<any>('');
    const [change, setChange] = React.useState<any>('');
    const [usage, setUsage] = React.useState<any>('');
    const [risk, setRisk] = React.useState<any>('');
    const [practice, setPractice] = React.useState<any>('');
    const [busy, setBusy] = React.useState<any>(false);
    const [error, setError] = React.useState<any>(null);
    React.useEffect(function (): any {
        if (!props.open)
            return;
        const item = props.item || null;
        const summary = (item && item.summary) || {};
        setTitle(item ? item.title || '' : '');
        setSource(item ? item.source || '' : '');
        setUrl(item ? item.url || '' : '');
        setPublishedAt(item && item.publishedAt ? String(item.publishedAt).slice(0, 10) : '');
        setTopics(item && Array.isArray(item.topics) ? item.topics.join(', ') : '');
        setChange(summary.change || '');
        setUsage(summary.usage || '');
        setRisk(summary.risk || '');
        setPractice(summary.practice || '');
        setBusy(false);
        setError(null);
    }, [props.open, props.item]);
    if (!props.open)
        return null;
    function submit(event?: any): any {
        if (event)
            event.preventDefault();
        if (busy)
            return;
        const trimmedTitle = title.trim();
        const trimmedUrl = url.trim();
        if (!trimmedTitle) {
            setError('标题不能为空');
            return;
        }
        if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
            setError('链接需以 http:// 或 https:// 开头');
            return;
        }
        let publishedIso: any = null;
        if (publishedAt) {
            const parsed = new Date(publishedAt + 'T00:00:00');
            publishedIso = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
        }
        setBusy(true);
        setError(null);
        const payload: any = {
            title: trimmedTitle,
            source: source.trim() || (editing ? editing.source : 'manual'),
            url: trimmedUrl || null,
            publishedAt: publishedIso,
            topics: topics
                .split(/[,，\s]+/)
                .map(function (topic?: any): any {
                return topic.trim();
            })
                .filter(Boolean),
            summary: {
                change: change.trim(),
                usage: usage.trim(),
                risk: risk.trim(),
                practice: practice.trim(),
            },
        };
        if (editing)
            payload.id = editing.id;
        WB.actions
            .saveRadarItem(payload)
            .then(function (): any {
            setBusy(false);
            WB.toast(editing ? '资讯已更新' : '资讯已添加到技术雷达', 'ok');
            props.onClose();
        })
            .catch(function (e?: any): any {
            setBusy(false);
            setError(String((e && e.message) || e));
        });
    }
    return h(Modal, {
        open: true,
        title: editing ? '编辑资讯' : '手动添加资讯',
        sub: editing
            ? '补全四段摘要后，雷达卡片会展示结构化结论；摘要内容仍由你或 Agent 负责事实准确性'
            : '登记的资讯会和采集来源一起进入技术雷达',
        onClose: props.onClose,
        width: 580,
        footer: h(React.Fragment, null, h(Btn, { onClick: props.onClose, disabled: busy, children: '取消' }), h('div', { className: 'wb-spacer' }), h(Btn, {
            kind: 'primary',
            icon: 'check',
            disabled: busy,
            onClick: submit,
            children: busy ? '保存中…' : editing ? '保存修改' : '添加资讯',
        })),
    }, h('form', { onSubmit: submit, className: 'wb-stack', style: { gap: 11 } }, h(Field, { label: '标题' }, h(Input, {
        value: title,
        autoFocus: true,
        placeholder: '例如：Harness 新增 Slots 整页扩展点',
        onChange: function (event?: any): any {
            setTitle(event.target.value);
        },
    })), h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } }, h(Field, { label: '来源' }, h(Input, {
        value: source,
        placeholder: '官方博客 / GitHub Trending',
        onChange: function (event?: any): any {
            setSource(event.target.value);
        },
    })), h(Field, { label: '发布日期' }, h(Input, {
        type: 'date',
        value: publishedAt,
        onChange: function (event?: any): any {
            setPublishedAt(event.target.value);
        },
    }))), h(Field, { label: '链接' }, h(Input, {
        type: 'url',
        value: url,
        placeholder: 'https://',
        onChange: function (event?: any): any {
            setUrl(event.target.value);
        },
    })), h(Field, { label: '主题', hint: '逗号或空格分隔，会参与关注主题过滤' }, h(Input, {
        value: topics,
        placeholder: 'Agent, RAG',
        onChange: function (event?: any): any {
            setTopics(event.target.value);
        },
    })), h(Divider), h('div', { className: 'wb-label', style: { marginBottom: -2 } }, '四段摘要（可留空；抓取来的资讯只有原文摘录）'), h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } }, h(Field, { label: '技术变化' }, h(Textarea, {
        value: change,
        rows: 2,
        placeholder: '这次变化的关键事实是什么？',
        onChange: function (event?: any): any {
            setChange(event.target.value);
        },
    })), h(Field, { label: '应用场景' }, h(Textarea, {
        value: usage,
        rows: 2,
        placeholder: '适合在什么场景使用？',
        onChange: function (event?: any): any {
            setUsage(event.target.value);
        },
    })), h(Field, { label: '采用风险' }, h(Textarea, {
        value: risk,
        rows: 2,
        placeholder: '引入后可能踩什么坑？',
        onChange: function (event?: any): any {
            setRisk(event.target.value);
        },
    })), h(Field, { label: '推荐实践' }, h(Textarea, {
        value: practice,
        rows: 2,
        placeholder: '建议怎么落地？',
        onChange: function (event?: any): any {
            setPractice(event.target.value);
        },
    }))), error ? h('div', { role: 'alert', style: { color: T.err, fontSize: 12 } }, error) : null, h('button', { type: 'submit', style: { display: 'none' } })));
}
export { dashRadarTimeValue, dashSummaryParts, DashRadarRow, DashRadarMenu, DashRadarModal }
