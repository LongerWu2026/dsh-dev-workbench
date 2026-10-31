import {taskSource} from '../../../shared/message-display.js'
import {MessageSelectionBadges} from '../../components/MessageSelectionBadges.js'
import { Badge, Icon, IconBtn, T, WB, h } from '../../core/runtime.js'
import { dashPriorityOf, dashProjectName, dashToneColor } from './selectors.js'
import {TaskMessageMetadata} from '../../components/TaskMessageMetadata.js'

function DashTaskRow(props?: any): any {
    const task = props.task;
    const data = props.data;
    const ended=['completed','cancelled'].includes(task.status);
    const due = WB.fmt.due(task.dueAt);
    const priority = dashPriorityOf(task);
    const project = dashProjectName(data, task.projectId);
    function complete(): any {
        WB.actions.updateTask(task.id, { status: 'completed' }).catch(function (): any { });
    }
    return h('div', { className: 'wb-item', style: { alignItems: 'flex-start' } }, h('button', {
        type: 'button',
        className: 'wb-check',
        title: '标记完成',
        'aria-label': ended?'待办状态：'+(WB.TASK_STATUS[task.status]?.label||task.status):'标记“' + task.title + '”为完成',
        disabled:ended,
        onClick: complete,
    }, h(Icon, { name: 'check', size: 11 })), h('div', { className: 'wb-item-main' }, h('button', {
        type: 'button',
        className: 'wb-item-title',
        style: {
            display: 'block',
            width: '100%',
            padding: 0,
            border: 0,
            background: 'transparent',
            color: T.text,
            font: 'inherit',
            fontSize: 12.5,
            fontWeight: 500,
            textAlign: 'left',
            cursor: 'pointer',
            overflowWrap: 'anywhere',
        },
        title: '编辑这条待办',
        onClick: function (): any {
            WB.openTaskForm(task);
        },
    }, task.title), h('div', { className: 'wb-item-sub' }, props.linked?h(Badge,{tone:ended?'ok':'idle'},'待办：'+(WB.TASK_STATUS[task.status]?.label||task.status)):null,h(Badge, { tone: priority.tone }, priority.label), task.dueAt
        ? h('span', { style: { color: dashToneColor(due.tone), fontWeight: 600 } }, due.text)
        : task.meetingStart ? h('span', {className:'wb-muted'}, '会议 ' + WB.fmt.datetime(task.meetingStart) + (task.meetingLocation ? ' · ' + task.meetingLocation : '')) : h('span', { className: 'wb-muted' }, '无截止'), project ? h('span', { className: 'wb-muted' }, project) : null, task.aiExtracted ? h(Badge, { tone: 'accent' }, 'AI 提取') : null),h(MessageSelectionBadges,{source:(data.sources||[]).find((s:any)=>s.id===task.sourceRefId),inbox:data.messageInbox}),taskSource(task,data.sources||[])?.provider==='yunzhijia'?h('details',null,h('summary',{className:'wb-tiny wb-muted',style:{cursor:'pointer'}},'消息来源'),h(TaskMessageMetadata,{task,data})):null), h('details', { className: 'wb-brief-more',style:{flex:'none'} }, h('summary',{'aria-label':'更多操作：'+task.title,style:{cursor:'pointer',fontSize:12,color:T.text2,whiteSpace:'nowrap'}},'更多'), h('div',{className:'wb-row wb-row--wrap',style:{gap:5}}, h(IconBtn, {
        name: 'edit',
        label: '编辑',
        onClick: function (): any {
            WB.openTaskForm(task);
        },
    }), h(IconBtn, {
        name: 'arrowRight',
        label: '在任务中心定位',
        onClick: function (): any {
            WB.focusTask(task.id);
        },
    }), h(IconBtn, {
        name: 'sparkles',
        label: 'AI 分析这条待办（带上下文进入会话）',
        onClick: function (): any {
            WB.assistant.add({
                kind: 'task',
                id: task.id,
                title: task.title,
                body: [task.description, '状态：' + task.status + ' · 优先级：' + task.priority].filter(Boolean).join('\n'),
            });
        },
    }))));
}
export { DashTaskRow }
