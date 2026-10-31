import type { Task, Reply } from '../../shared/contracts.js';
export interface Reminder {
    id: string;
    entityId: string;
    kind: 'meeting' | 'due' | 'reply';
    title: string;
    at: string;
    overdue: boolean;
}
export function collectReminders(state: {
    tasks: Task[];
    replies: Reply[];
    reminderSnoozes?: Record<string, string>;
}, now = Date.now()): Reminder[] {
    const reminders: Reminder[] = [];
    for (const task of state.tasks) {
        if (task.archivedAt || ['completed', 'cancelled'].includes(task.status) || task.humanGuard?.ignored || Date.parse(task.humanGuard?.snoozeUntil || '') > now)
            continue;
        if(task.eventType==='meeting'&&task.meetingEnd&&Date.parse(task.meetingEnd)<=now)continue;
        const at = task.eventType === 'meeting' ? task.meetingStart : task.dueAt;
        if (!at || !Number.isFinite(Date.parse(at)))
            continue;
        const kind = task.eventType === 'meeting' ? 'meeting' : 'due';
        const delta = Date.parse(at) - now;
        if (delta <= (kind === 'meeting' ? 30 * 60000 : 24 * 3600000))
            reminders.push({ id: kind + ':' + task.id + ':' + at, entityId: task.id, kind, title: task.title, at, overdue: delta < 0 });
    }
    for (const reply of state.replies) {
        if (['待回复', '已确认收到', '已自动回复'].includes(reply.stage) && now - Date.parse(reply.createdAt) >= 24 * 3600000)
            reminders.push({ id: 'reply:' + reply.id, entityId: reply.id, kind: 'reply', title: reply.snippet || '待回复', at: reply.createdAt, overdue: true });
    }
    return reminders.filter(row => !(Date.parse(state.reminderSnoozes?.[row.id] || '') > now)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
const escape = (value: unknown) => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
export function calendarExport(task: Task, now = Date.now()): string {
    const start = task.meetingStart || task.dueAt;
    if (!start || !Number.isFinite(Date.parse(start)))
        throw new Error('请先填写会议开始或截止时间');
    const stamp = (at: string) => new Date(at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AIWorkBench//Office//ZH', 'BEGIN:VEVENT', 'UID:' + escape(task.id) + '@aiworkbench.local', 'DTSTAMP:' + stamp(new Date(now).toISOString()), 'DTSTART:' + stamp(start), 'SUMMARY:' + escape(task.title), 'DESCRIPTION:' + escape(task.description), 'LOCATION:' + escape(task.meetingLocation)];
    if (task.meetingEnd && Date.parse(task.meetingEnd) > Date.parse(start))
        lines.push('DTEND:' + stamp(task.meetingEnd));
    lines.push('BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:' + escape(task.title), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
    // RFC 5545: fold at 75 octets without splitting a Unicode code point.
    return lines.map(line => { const parts: string[] = []; let part = '', bytes = 0; for (const char of line) {
        const size = Buffer.byteLength(char);
        if (bytes + size > 75) {
            parts.push(part);
            part = ' ';
            bytes = 1;
        }
        part += char;
        bytes += size;
    } parts.push(part); return parts.join('\r\n'); }).join('\r\n') + '\r\n';
}
