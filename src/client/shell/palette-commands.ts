import {WB} from '../core/runtime.js'
import {openSearchResult} from '../features/search/search-navigation.js'
function paletteCommands(context?: any): any {
    const commands: any = [];
    WB.ORDER.filter((id:string)=>id!=='search').forEach(function (id?: any, index?: any): any {
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
    commands.push({
        id: 'nav:office-history',
        label: '查看办公历史',
        hint: '在 AI 助手中恢复以前的报告、草稿与处理记录',
        icon: 'messages',
        group: '操作',
        run: function (): any { WB.assistant.openHub('system','office'); },
    });
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
                    openSearchResult(item,group.label);
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

export {paletteCommands,paletteMatch}
