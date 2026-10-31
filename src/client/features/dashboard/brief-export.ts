import { WB } from '../../core/runtime.js'
import {dashActionable} from './selectors.js'

/** 今日简报 → Markdown，复制到剪贴板（不落盘、不联网）。 */
function dashBriefMarkdown(data?: any): any {
    const counts = WB.taskCounts(data);
    const lines: any = [];
    lines.push('# 今日简报 · ' + WB.fmt.date(new Date().toISOString()));
    lines.push('');
    lines.push('## 概览');
    lines.push('- 待处理 ' + counts.open + ' · 今日到期 ' + counts.today + ' · 已逾期 ' + counts.overdue + ' · 执行中 ' + counts.running);
    const mentions = (data.sources || []).filter(function (row?: any): any {
        return String(row.externalId || '').indexOf('yzj:msg:') === 0;
    });
    if (mentions.length > 0) {
        lines.push('');
        lines.push('## 云之家 @我（' + mentions.length + '）');
        mentions.slice(-5).forEach(function (row?: any): any {
            lines.push('- ' + WB.util.truncate(row.excerpt || row.title, 100) + (row.sender ? ' —— ' + row.sender : ''));
        });
    }
    const selected=dashActionable(data);
    const tasks = selected.slice(0, 8);
    if (tasks.length > 0) {
        lines.push('');
        lines.push('## 待办（' + tasks.length + '）');
        tasks.forEach(function (task?: any): any {
            const due = task.dueAt ? '（截止 ' + WB.fmt.day(task.dueAt) + '）' : '';
            lines.push('- [' + (WB.TASK_STATUS[task.status] || {}).label + '] ' + task.title + due);
        });
        if(selected.length>tasks.length)lines.push('- 其余 '+(selected.length-tasks.length)+' 条可在工作台展开查看。');
    }
    const radar = (data.radar || []).slice(-5).reverse();
    if (radar.length > 0) {
        lines.push('');
        lines.push('## 技术雷达（最近 ' + radar.length + ' 条）');
        radar.forEach(function (item?: any): any {
            lines.push('- ' + item.title + (item.url ? ' — ' + item.url : ''));
        });
    }
    const pending = (data.candidates || []).filter(function (c?: any): any {
        return c && c.status === 'pending';
    });
    if (pending.length > 0) {
        lines.push('');
        lines.push('## 待确认候选（' + pending.length + '）');
        pending.slice(0, 5).forEach(function (c?: any): any {
            lines.push('- ' + c.title + '（置信度 ' + Math.round((c.confidence || 0) * 100) + '%）');
        });
    }
    return lines.join('\n');
}
export { dashBriefMarkdown }
