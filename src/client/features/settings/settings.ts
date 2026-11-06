import {YunzhijiaConnection} from './YunzhijiaConnection.js'
import {LinkyConnection} from './LinkyConnection.js'
import {KnowledgeEnginePanel} from '../knowledge/KnowledgeEnginePanel.js'
import {NewsFeedDialog,NewsSources} from './NewsSources.js'
import {DataManagement} from './DataManagement.js'
import {BackgroundModels} from './BackgroundModels.js'
import {SETTINGS_CSS} from './styles.js'
import { Badge, Btn, Chip, Empty, Field, Icon, IconBtn, Input, Modal, PageHead, Panel, Select, Toggle, WB, h, useStore } from '../../core/runtime.js'
import * as React from 'react'

declare const __WORKBENCH_VERSION__: string
/* ============================================================================
 * dev-workbench settings & connections
 *
 * Shows connector health from the Host, automation and news settings,
 * display preferences, and local data management.
 * ========================================================================== */
function SettingsRow(props?: any): any {
    return h('div', {
        className: 'wb-item',
        style: { alignItems: props.alignTop ? 'flex-start' : 'center' },
    }, h('div', { className: 'wb-item-main' }, h('div', { className: 'wb-item-title' }, props.title, props.badge || null), props.hint ? h('div', { className: 'wb-item-sub' }, props.hint) : null), props.control ? h('div', { style: { flex: 'none' } }, props.control) : null);
}
function SettingsPage(): any {
    const state = useStore();
    const data = state.data;
    const [topicDraft, setTopicDraft] = React.useState<any>('');
    const [confirmReset, setConfirmReset] = React.useState<any>(null);
    const [projectName, setProjectName] = React.useState<any>('');
    const [projectPath, setProjectPath] = React.useState<any>('');
    const [picking, setPicking] = React.useState<any>(false);
    const [projectEdit, setProjectEdit] = React.useState<any>(null);
    const [migrationJson, setMigrationJson] = React.useState<any>('');
    const [migrationMode, setMigrationMode] = React.useState<any>('replace');
    const [automation, setAutomation] = React.useState<any>(null);
    const [automationRunning, setAutomationRunning] = React.useState(false);
    const [mentionDraft, setMentionDraft] = React.useState<any>('');
    const [addFeedOpen, setAddFeedOpen] = React.useState(false);
    const addFeedTrigger = React.useRef<HTMLButtonElement|null>(null);
    const connectorList = React.useRef<HTMLDivElement|null>(null);
    const settings = (data && data.settings) || { topics: [], staleHours: 24, showCompleted: false, defaultProjectId: null };
    const connectors = (data && data.connectors) || [];
    const projects = (data && data.projects) || [];
    const feeds = (settings && settings.feeds) || [];
    React.useLayoutEffect(()=>{
        const list=connectorList.current;
        if(!list)return;
        const items=list.querySelectorAll<HTMLElement>(':scope > .wb-item');
        if(items.length<=3){
            list.style.removeProperty('--wb-connector-preview-height');
            return;
        }
        const rows=Array.from(items).slice(0,3);
        const measure=()=>{
            const height=rows.reduce((total,row)=>total+parseFloat(getComputedStyle(row).height),0);
            if(height>0)list.style.setProperty('--wb-connector-preview-height',`${height}px`);
        };
        measure();
        const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;
        rows.forEach(row=>observer?.observe(row,{box:'border-box'}));
        return ()=>observer?.disconnect();
    },[connectors]);
    React.useEffect(function (): any {
        WB.actions.automationStatus()
            .then(function (status?: any): any {
            setAutomation(status);
        })
            .catch(function (): any { });
    }, []);
    React.useEffect(()=>{if(data?.lastAutomation)setAutomation((current:any)=>current?{...current,lastAutomation:data.lastAutomation}:current)},[data?.lastAutomation]);
    function patchSettings(patch?: any): any {
        WB.actions.saveSettings(patch).catch(function (): any { });
    }
    function addTopic(): any {
        const value = topicDraft.trim();
        if (!value)
            return;
        if (settings.topics.indexOf(value) >= 0) {
            setTopicDraft('');
            return;
        }
        patchSettings({ topics: settings.topics.concat([value]) });
        setTopicDraft('');
    }
    function removeTopic(topic?: any): any {
        patchSettings({
            topics: settings.topics.filter(function (item?: any): any {
                return item !== topic;
            }),
        });
    }
    function pickProjectPath(): any {
        setPicking(true);
        WB.pickDirectory().then(function (dir?: any): any {
            setPicking(false);
            if (!dir) {
                WB.toast('没有选择目录（或当前环境不提供目录选择器）', 'info');
                return;
            }
            setProjectPath(dir);
            setProjectName(function (previous?: any): any {
                if (previous.trim())
                    return previous;
                const parts = String(dir).split(/[\\/]/).filter(Boolean);
                return parts.length > 0 ? parts[parts.length - 1] : '项目';
            });
        });
    }
    function addProject(): any {
        const name = projectName.trim();
        const repoPath = projectPath.trim();
        if (!repoPath) {
            WB.toast('请先选择或填写仓库目录', 'err');
            return;
        }
        WB.actions
            .saveProject({ name: name || repoPath, repoPath: repoPath })
            .then(function (): any {
            setProjectName('');
            setProjectPath('');
        })
            .catch(function (): any {
            /* settle() already toasted */
        });
    }
    function exportJson(): any {
        try {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'dev-workbench-' + WB.fmt.date(new Date().toISOString()) + '.json';
            anchor.click();
            setTimeout(function (): any {
                URL.revokeObjectURL(url);
            }, 2000);
            WB.toast('已导出快照 JSON', 'ok');
        }
        catch (e) {
            WB.toast('导出失败：' + String((e && e.message) || e), 'err');
        }
    }
    return h('div', {className:'wb-settings-page'}, h('style',null,SETTINGS_CSS), h(PageHead, {
        icon: 'plug',
        title: WB.t('settings.title', '连接与设置'),
        sub: '连接器状态、关注主题与数据落盘位置；改动的都是 Host 侧持久化配置。',
        actions: h(Btn, {
            icon: 'refresh',
            size: 'sm',
            onClick: function (): any {
                WB.actions.reload().catch(function (): any { });
            },
            children: '重新读取',
        }),
    }), h('div', {className:'wb-settings-flow'}, h(Panel, {
        title: '连接器',
        sub: '一个 Provider 一种能力；未接入的能力保持“未配置”而不是假装可用',
        icon: 'plug',
    }, h('div', {ref:connectorList, className:'wb-settings-connector-list', role:'region', 'aria-label':'连接器列表', tabIndex:0},
    h(YunzhijiaConnection, {initial:connectors.find((row:any)=>row.id === 'yunzhijia')}), h(LinkyConnection), h(KnowledgeEnginePanel,{connector:true}),
        connectors.filter((row:any)=>!['yunzhijia','linky'].includes(row.id)).map(function (connector?: any): any {
            const meta = WB.connectorState(connector.authState);
            return h('div', { key: connector.id, className: 'wb-item', style: { alignItems: 'flex-start' } }, h('div', { className: 'wb-item-main' }, h('div', { className: 'wb-item-title' }, connector.label || connector.type, h(Badge, { tone: meta.tone }, meta.label)), h('div', { className: 'wb-item-sub' }, (connector.capabilities || []).length > 0
                ? connector.capabilities.map(function (capability?: any): any {
                    return h(Chip, { key: capability, children: capability });
                })
                : h('span', null, '无已声明能力')), connector.note ? h('div', { className: 'wb-item-sub' }, connector.note) : null), h('div', { className: 'wb-tiny wb-muted', style: { flex: 'none' } }, connector.updatedAt ? WB.fmt.relative(connector.updatedAt) : '—'));
        }))), h(Panel, {
        title: '项目',
        sub: '仓库目录决定「研发协作」探测哪些 Git 仓库',
        icon: 'folder',
        badge: projects.length ? h(Badge, { tone: 'idle' }, projects.length + ' 个') : null,
    }, projects.length === 0
        ? h(Empty, {
            icon: 'folder',
            title: '还没有项目',
            hint: '添加一个仓库目录后，研发协作会自动显示它的分支与改动；不添加则只探测 Host 的默认工作目录。',
        })
        : h('div', null, projects.map(function (project?: any): any {
            const count = ((data && data.tasks) || []).filter(function (task?: any): any {
                return task.projectId === project.id;
            }).length;
            return h('div', { key: project.id, className: 'wb-item', style: { alignItems: 'flex-start' } }, h(Icon, { name: 'folder', size: 14 }), h('div', { className: 'wb-item-main' }, h('div', { className: 'wb-item-title' }, project.name), h('div', { className: 'wb-item-sub wb-mono wb-ellipsis' }, project.repoPath || '未配置仓库目录'), h('div', { className: 'wb-item-sub' }, count + ' 项待办')), h(IconBtn, {
                name: 'edit',
                label: '编辑项目名称与目录',
                onClick: function (): any {
                    setProjectEdit({ id: project.id, name: project.name, repoPath: project.repoPath || '' });
                },
            }), h(IconBtn, {
                name: 'trash',
                label: '删除项目',
                onClick: function (): any {
                    if (!window.confirm('删除项目「' + project.name + '」？关联任务会解除项目归属，任务本身保留。'))
                        return;
                    WB.actions.deleteProject(project.id).catch(function (): any { });
                },
            }));
        })), h('div', { className: 'wb-stack', style: { gap: 8, marginTop: projects.length ? 10 : 0 } }, h('div', { className: 'wb-row' }, h(Input, {
        value: projectName,
        placeholder: '项目名称',
        onChange: function (event?: any): any {
            setProjectName(event.target.value);
        },
    }), h(Btn, {
        size: 'sm',
        icon: 'folder',
        disabled: picking,
        onClick: pickProjectPath,
        children: picking ? '选择中…' : '选择目录',
    })), h(Input, {
        value: projectPath,
        placeholder: '仓库绝对路径，如 /Users/me/code/gateway',
        onChange: function (event?: any): any {
            setProjectPath(event.target.value);
        },
    }), h('div', { className: 'wb-row' }, h('div', { className: 'wb-spacer' }), h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'plus',
        disabled: !projectPath.trim(),
        onClick: addProject,
        children: '添加项目',
    })))), h(NewsSources, {feeds,onAdd:(event:React.MouseEvent<HTMLButtonElement>)=>{
        addFeedTrigger.current=event.currentTarget;
        setAddFeedOpen(true);
    }}), h(Panel, { title: '关注主题', sub: '技术雷达按这些主题过滤与推荐', icon: 'radar' }, h('div', { className: 'wb-row wb-row--wrap', style: { marginBottom: 10 } }, settings.topics.length === 0
        ? h('span', { className: 'wb-tiny wb-muted' }, '还没有关注主题')
        : settings.topics.map(function (topic?: any): any {
            return h(Chip, {
                key: topic,
                active: true,
                children: topic,
                onRemove: function (): any {
                    removeTopic(topic);
                },
            });
        })), h('div', { className: 'wb-row' }, h(Input, {
        value: topicDraft,
        placeholder: '新增主题，如 RAG / 数据库',
        onChange: function (event?: any): any {
            setTopicDraft(event.target.value);
        },
        onKeyDown: function (event?: any): any {
            if (event.key === 'Enter') {
                event.preventDefault();
                addTopic();
            }
        },
    }), h(Btn, {
        icon: 'plus',
        size: 'sm',
        onClick: addTopic,
        disabled: !topicDraft.trim(),
        children: '添加',
    }))), h(Panel, {
        title: '自动化',
        className:'wb-settings-wide',
        sub: '按配置采集消息、联网发现资讯；开启 AI 后进行识别和摘要',
        icon: 'zap',
        badge: automation ? h(Badge, { tone: automation.enabled ? 'ok' : 'idle' }, automation.enabled ? '已开启' : '已关闭') : null,
        actions: h(Btn, {
            size: 'sm',
            kind: 'subtle',
            icon: 'play',
            disabled: !automation || !automation.enabled || automationRunning,
            onClick: function (): any {
                setAutomationRunning(true);
                WB.actions
                    .automationRun()
                    .then(function (result?: any): any {
                    WB.toast(result.ran ? (result.status==='ok'?'本轮完成：':'本轮部分失败：') + (result.note || '') : (result.note || '未执行'), result.ran && result.status==='ok' ? 'ok' : 'info');
                    return WB.actions.reload();
                })
                    .then(function (): any {
                    return WB.actions.automationStatus();
                })
                    .then(function (status?: any): any {
                    setAutomation(status);
                })
                    .catch(function (error:any): any { WB.toast('自动化失败：'+String(error?.message || error),'err') })
                    .finally(()=>setAutomationRunning(false));
            },
            children: automationRunning ? '正在执行…' : '立即执行',
        }),
    }, h('div', {className:'wb-settings-controls'}, h(SettingsRow, {
        title: '开启后台自动化',
        hint: automation && automation.lastAutomation
            ? '上次运行 ' + WB.fmt.relative(automation.lastAutomation.at) + '（' + automation.lastAutomation.status + '）：' + (automation.lastAutomation.note || '')
            : '仅在 DSH 进程运行期间生效；退出/休眠后恢复会按到期补跑一次',
        control: h(Toggle, {
            checked: !!(automation && automation.enabled),
            onChange: function (next?: any): any {
                patchSettings({ automation: { enabled: next } });
                setAutomation(Object.assign({}, automation, { enabled: next }));
            },
        }),
    }), h(SettingsRow, {
        title: '资讯等自动化间隔',
        hint: '用于资讯等完整采集；云之家独立按北京时间09:00–21:00每5分钟同步，页面每12秒读取本地状态。',
        control: h(Select, {
            value: String((automation && automation.intervalMinutes) || 60),
            options: [
                { value: '5', label: '5 分钟' },
                { value: '15', label: '15 分钟' },
                { value: '30', label: '30 分钟' },
                { value: '60', label: '1 小时' },
                { value: '180', label: '3 小时' },
                { value: '720', label: '12 小时' },
            ],
            onChange: function (event?: any): any {
                patchSettings({ automation: { intervalMinutes: Number(event.target.value) } });
                setAutomation(Object.assign({}, automation, { intervalMinutes: Number(event.target.value) }));
            },
        }),
    }), h(SettingsRow, {
        title: '资讯采集',
        hint: '采集内置来源和 RSS 订阅，并按关注主题联网发现',
        control: h(Toggle, {
            checked: !(automation && automation.radar === false),
            onChange: function (next?: any): any {
                patchSettings({ automation: { radar: next } });
                setAutomation(Object.assign({}, automation, { radar: next }));
            },
        }),
    }), h(SettingsRow, {
        title: 'AI 识别新消息（结构化提炼）',
        hint: '同账号复用后台会话，多条消息一次识别；固定规则首次发送，后续发送增量，仍消耗宿主模型用量。',
        control: h(Toggle, {
            checked: !!(settings.aiExtract && settings.aiExtract.enabled),
            onChange: function (next?: any): any {
                patchSettings({ aiExtract: { enabled: next } });
            },
        }),
    }), h(SettingsRow, {
        title: '每批识别消息数',
        hint: '后台定时识别使用此批量。点击「运行分析」固定每批 50 条，自动连续处理至队列结束；超长内容会拆包，失败自动等待重试并展示暂停原因。',
        control: h(Select, {value:String(settings.aiExtract?.batchSize || 50),options:[{value:'5',label:'5 条'},{value:'10',label:'10 条'},{value:'20',label:'20 条'},{value:'50',label:'50 条'}],onChange:(event:any)=>patchSettings({aiExtract:{batchSize:Number(event.target.value)}})}),
    }), h(SettingsRow, {
        title: '识别后自动登记待办',
        hint: '开启后安装日期起的明确交办直接建档；关闭则待确认。安装日期之前的消息和历史暂存不再识别。',
        control: h(Toggle, {
            checked: !!(settings.aiExtract && settings.aiExtract.autoRegister),
            onChange: function (next?: any): any {
                patchSettings({ aiExtract: { autoRegister: next } });
            },
        }),
    }), h(SettingsRow, {
        title: '消息处理起始日期',
        hint: '按插件安装日期（北京时间）固定；更早消息不再采集或识别，已有历史暂存标记为已跳过。',
        control: h('span', {className:'wb-tiny'}, data?.installedAt ? new Date(data.installedAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'})+' 起' : '首次启用时记录'),
    }), h(SettingsRow, {
        title: '同步私聊与 @我 消息',
        hint: '每天北京时间09:00–21:00，每5分钟同步一次，21:00最后一轮；其余时段仅手动同步。限流时保留进度并退避。',
        control: h(Toggle, {
            checked: !(automation && automation.mentions === false),
            onChange: function (next?: any): any {
                patchSettings({ automation: { mentions: next } });
                setAutomation(Object.assign({}, automation, { mentions: next }));
            },
        }),
    }))), h(Panel, {
        title: '补充 @ 关键词',
        sub: '增量游标不可用时，用这些关键词兜底检索昵称/别名 @',
        icon: 'search',
    }, h('div', { className: 'wb-row wb-row--wrap', style: { marginBottom: 10 } }, (settings.mentionKeywords || []).length === 0
        ? h('span', { className: 'wb-tiny wb-muted' }, '还没有补充关键词（默认用当前账号显示名检索）')
        : (settings.mentionKeywords || []).map(function (word?: any): any {
            return h(Chip, {
                key: word,
                active: true,
                children: word,
                onRemove: function (): any {
                    patchSettings({
                        mentionKeywords: (settings.mentionKeywords || []).filter(function (item?: any): any {
                            return item !== word;
                        }),
                    });
                },
            });
        })), h('div', { className: 'wb-row' }, h(Input, {
        value: mentionDraft,
        placeholder: '如：小龙 / 珑珑',
        onChange: function (event?: any): any {
            setMentionDraft(event.target.value);
        },
        onKeyDown: function (event?: any): any {
            if (event.key === 'Enter') {
                event.preventDefault();
                const word = mentionDraft.trim();
                if (!word)
                    return;
                patchSettings({ mentionKeywords: (settings.mentionKeywords || []).concat([word]).slice(0, 6) });
                setMentionDraft('');
            }
        },
    }), h(Btn, {
        size: 'sm',
        icon: 'plus',
        disabled: !mentionDraft.trim(),
        onClick: function (): any {
            const word = mentionDraft.trim();
            if (!word)
                return;
            patchSettings({ mentionKeywords: (settings.mentionKeywords || []).concat([word]).slice(0, 6) });
            setMentionDraft('');
        },
        children: '添加',
    }))), h(BackgroundModels), h(Panel, { title: '偏好', sub: '仅影响本工作台的展示', icon: 'settings' }, h('div', null, h(SettingsRow, {
        title: '显示已完成任务',
        hint: '关闭时任务中心默认只看未完成',
        control: h(Toggle, {
            checked: !!settings.showCompleted,
            onChange: function (next?: any): any {
                patchSettings({ showCompleted: next });
            },
        }),
    }), h(SettingsRow, {
        title: '数据陈旧阈值',
        hint: '超过这个时长未写入时，首页提示数据可能过期',
        control: h(Select, {
            value: String(settings.staleHours || 24),
            options: [
                { value: '6', label: '6 小时' },
                { value: '12', label: '12 小时' },
                { value: '24', label: '24 小时' },
                { value: '72', label: '3 天' },
            ],
            onChange: function (event?: any): any {
                patchSettings({ staleHours: Number(event.target.value) });
            },
        }),
    }), h(SettingsRow, {title:'资讯时效',hint:'按发布日期筛选近期资讯，日期待确认的单独显示',control:h(Select,{value:String(settings.newsDays||7),options:[1,3,7,14,30].map((value:number)=>({value:String(value),label:'最近 '+value+' 天'})),onChange:(event:any)=>patchSettings({newsDays:Number(event.target.value)})})}), h(SettingsRow, {
        title: '默认项目',
        hint: '新建待办时预选的项目',
        control: h(Select, {
            value: settings.defaultProjectId || '',
            options: [{ value: '', label: '未设置' }].concat(projects.map(function (project?: any): any {
                return { value: project.id, label: project.name };
            })),
            onChange: function (event?: any): any {
                patchSettings({ defaultProjectId: event.target.value || null });
            },
        }),
    }))), h(DataManagement,{onExportJson:exportJson,onReset:()=>setConfirmReset(true)})),
    h('footer',{className:'wb-settings-version'},'版本 v'+__WORKBENCH_VERSION__),
    addFeedOpen ? h(NewsFeedDialog,{feeds,onClose:()=>{
        setAddFeedOpen(false);
        addFeedTrigger.current?.focus();
    }}) : null, h(Modal, {
        open: !!projectEdit,
        title: '编辑项目',
        sub: projectEdit ? projectEdit.name : '',
        onClose: function (): any {
            setProjectEdit(null);
        },
        footer: h(React.Fragment, null, h(Btn, {
            onClick: function (): any {
                setProjectEdit(null);
            },
            children: '取消',
        }), h(Btn, {
            kind: 'primary',
            disabled: !projectEdit || !String(projectEdit.name || '').trim(),
            onClick: function (): any {
                if (!projectEdit)
                    return;
                const name = String(projectEdit.name || '').trim();
                if (!name)
                    return;
                WB.actions
                    .saveProject({ id: projectEdit.id, name: name, repoPath: String(projectEdit.repoPath || '').trim() })
                    .then(function (): any {
                    setProjectEdit(null);
                })
                    .catch(function (): any { });
            },
            children: '保存',
        })),
    }, projectEdit
        ? h('div', { className: 'wb-stack', style: { gap: 10 } }, h(Field, { label: '项目名称' }, h(Input, {
            value: projectEdit.name,
            autoFocus: true,
            onChange: function (event?: any): any {
                setProjectEdit(Object.assign({}, projectEdit, { name: event.target.value }));
            },
        })), h(Field, { label: '仓库目录', hint: '留空表示不关联仓库；改动后研发协作会重新探测' }, h(Input, {
            value: projectEdit.repoPath,
            placeholder: '/Users/me/code/项目',
            onChange: function (event?: any): any {
                setProjectEdit(Object.assign({}, projectEdit, { repoPath: event.target.value }));
            },
        })))
        : null), h(Modal, {
        open: !!confirmReset,
        title: '重置确认',
        sub: '此操作不可撤销',
        onClose: function (): any {
            setConfirmReset(null);
        },
        footer: h(React.Fragment, null, h(Btn, {
            onClick: function (): any {
                setConfirmReset(null);
            },
            children: '取消',
        }), h('div', { className: 'wb-spacer' }), h(Btn, {
            kind: 'danger',
            icon: 'trash',
            onClick: function (): any {
                setConfirmReset(null);
                WB.actions.reset('all').catch(function (): any { });
            },
            children: '确认重置',
        })),
    }, h('p', { style: { margin: 0, fontSize: 12.5 } }, '将清空所有待办、执行记录、知识与雷达条目，并保留关注主题与偏好设置。')));
}
WB.pages.settings = SettingsPage;

export { SettingsRow, SettingsPage }
