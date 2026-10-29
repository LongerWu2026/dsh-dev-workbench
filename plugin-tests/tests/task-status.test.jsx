import React from 'react'
import { beforeEach, afterEach, it, expect } from 'vitest'
import { render, screen, within, act, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadClientBundle } from './load-plugin.mjs'
import {taskMessageTime,matchesTaskMessageDates,sortTasksByMessageTime} from '../../src/client/features/tasks/message-time.ts'

let WB, fixture, updates, pendingUpdate
beforeEach(() => {
  WB = loadClientBundle().WB
  updates = []
  pendingUpdate = null
  fixture = {
    version: 2, revision: 10, settings: {}, projects: [], sources: [], candidates: [],
    tasks: [{ id: 'status-task', title: '核对任务状态', status: 'ready', priority: 'normal', tags: ['验收'], description: '保留任务内容' }],
  }
  WB.store.set({ data: fixture, status: 'ready', page: 'tasks' })
  WB.apply({
    effect: fn => fn(), get: () => undefined,
    connection: { rpc: { call: async (_channel, endpoint, payload) => {
      if (endpoint === 'workbench/updateTask') {
        updates.push(payload.args)
        if (pendingUpdate) return pendingUpdate
        fixture = { ...fixture, revision: fixture.revision + 1, tasks: fixture.tasks.map(task => task.id === payload.args.id ? { ...task, ...payload.args.patch } : task) }
      }
      return { ok: true, value: fixture }
    } } },
    slots: { inject: () => () => {}, register: () => () => {} },
    locale: { register: () => () => {}, bind: () => () => '' },
  })
})
afterEach(cleanup)

it('列表在状态后显示完成，七种状态可直接保存且保留任务内容，完成后可以重开', async () => {
  const user = userEvent.setup()
  render(<WB.pages.tasks />)
  expect(screen.getAllByRole('columnheader').map(cell => cell.textContent.replace(/[↕↑↓]/g,''))).toEqual(['任务', '优先级', '状态', '完成', '消息发出时间', '截止 / 会议开始', '项目', '操作'])
  const select = screen.getByRole('combobox', { name: '状态 核对任务状态' })
  expect(within(select).getAllByRole('option').map(option => option.value)).toEqual(Object.keys(WB.TASK_STATUS))
  for (const status of ['draft', 'ready', 'running', 'waiting_approval', 'failed', 'cancelled', 'completed']) {
    await user.selectOptions(select, status)
    expect(updates.at(-1)).toEqual({ id: 'status-task', patch: { status } })
    expect(select.value).toBe(status)
    expect(WB.store.get().data.tasks[0]).toMatchObject({ description: '保留任务内容', tags: ['验收'] })
  }
  const reopen = screen.getByRole('button', { name: '重开 核对任务状态' })
  expect(select.closest('td').nextElementSibling).toBe(reopen.closest('td'))
  await user.click(reopen)
  expect(select.value).toBe('ready')
  await user.click(screen.getByRole('button', { name: '完成 核对任务状态' }))
  expect(select.value).toBe('completed')
})

it('保存期间锁定状态和完成操作，失败保留原状态、显示错误并允许重试', async () => {
  let resolveUpdate
  pendingUpdate = new Promise(resolve => { resolveUpdate = resolve })
  const user = userEvent.setup()
  render(<WB.pages.tasks />)
  const select = screen.getByRole('combobox', { name: '状态 核对任务状态' })
  await user.selectOptions(select, 'running')
  expect(select.disabled).toBe(true)
  expect(screen.getByRole('button', { name: '完成 核对任务状态' }).disabled).toBe(true)
  await user.click(screen.getByRole('button', { name: '完成 核对任务状态' }))
  expect(updates).toHaveLength(1)
  await act(async () => resolveUpdate({ ok: false, error: '保存状态失败' }))
  expect(select.disabled).toBe(false)
  expect(select.value).toBe('ready')
  expect(WB.store.get().toasts).toEqual(expect.arrayContaining([expect.objectContaining({ text: '保存状态失败', kind: 'err' })]))
  pendingUpdate = null
  await user.selectOptions(select, 'running')
  expect(select.value).toBe('running')
})

it('看板下拉和完成操作不打开编辑表单，状态保存后移入对应列', async () => {
  const user = userEvent.setup()
  render(<WB.pages.tasks />)
  await user.click(screen.getByRole('button', { name: '看板' }))
  let select = screen.getByRole('combobox', { name: '状态 核对任务状态' })
  await user.click(select)
  await user.keyboard(' ')
  expect(WB.store.get().taskForm).toBeNull()
  await user.selectOptions(select, 'running')
  select = screen.getByRole('combobox', { name: '状态 核对任务状态' })
  expect(select.closest('.wb-card').firstElementChild.textContent).toBe('执行中1')
  expect(WB.store.get().taskForm).toBeNull()
  await user.click(screen.getByRole('button', { name: '完成 核对任务状态' }))
  expect(screen.getByRole('combobox', { name: '状态 核对任务状态' }).value).toBe('completed')
  expect(WB.store.get().taskForm).toBeNull()
})

function messageTasks(){
  const rows=[['early','2026-10-28T15:59:59.999Z'],['start','2026-10-28T16:00:00Z'],['end','2026-10-29T15:59:59.999Z'],['late','2026-10-29T16:00:00Z']]
  fixture.sources=rows.map(([id,sentAt])=>({id:'source-'+id,provider:'yunzhijia',fetchedAt:'2026-11-01T00:00:00Z',locator:{sentAt}}))
  fixture.tasks=rows.map(([id])=>({id,title:id,status:'ready',priority:'normal',tags:[],createdAt:'2026-11-02T00:00:00Z',sourceRefId:'source-'+id}))
  fixture.tasks.push({id:'manual',title:'manual',status:'ready',priority:'normal',tags:[],createdAt:'2026-11-02T00:00:00Z'})
  WB.store.set({data:fixture})
}
const visibleTaskTitles=()=>screen.getAllByRole('row').slice(1).filter(row=>row.querySelector('.wb-item-title')).map(row=>row.querySelector('.wb-item-title').textContent)

it('原消息时间独立成列，列头和选择器切换升降序，无时间置后且不写业务数据',async()=>{
  messageTasks();const before=JSON.stringify(fixture),user=userEvent.setup();render(<WB.pages.tasks/>);
  const row=screen.getByRole('button',{name:'start',exact:true}).closest('tr')
  expect(within(row).getByText('2026-10-29 00:00:00').getAttribute('datetime')).toBe('2026-10-28T16:00:00Z')
  expect(row.querySelectorAll('td')).toHaveLength(8)
  expect(screen.getByRole('button',{name:'manual',exact:true}).closest('tr').children[4].textContent).toBe('—')
  await user.click(screen.getByRole('button',{name:'按消息发出时间排序'}))
  expect(visibleTaskTitles()).toEqual(['late','end','start','early','manual'])
  expect(screen.getByRole('columnheader',{name:'消息发出时间'}).getAttribute('aria-sort')).toBe('descending')
  expect(screen.getByRole('combobox',{name:'待办排序'}).value).toBe('message-newest')
  await user.click(screen.getByRole('button',{name:'按消息发出时间排序'}))
  expect(visibleTaskTitles()).toEqual(['early','start','end','late','manual'])
  expect(screen.getByRole('columnheader',{name:'消息发出时间'}).getAttribute('aria-sort')).toBe('ascending')
  await user.selectOptions(screen.getByRole('combobox',{name:'待办排序'}),'default')
  expect(screen.getByRole('columnheader',{name:'消息发出时间'}).getAttribute('aria-sort')).toBe('none')
  expect(JSON.stringify(fixture)).toBe(before);expect(updates).toHaveLength(0)
})

it('日期范围包含北京时间整日，组合状态筛选且看板共用，重置可恢复无时间待办',async()=>{
  messageTasks();fixture.tasks.find(t=>t.id==='end').status='completed';WB.store.set({data:fixture});const user=userEvent.setup();render(<WB.pages.tasks/>);
  fireEvent.change(screen.getByLabelText('消息发出日期起始'),{target:{value:'2026-10-29'}})
  fireEvent.change(screen.getByLabelText('消息发出日期截止'),{target:{value:'2026-10-29'}})
  expect(visibleTaskTitles()).toEqual(['start','end'])
  await user.click(screen.getByRole('button',{name:'已完成 1'}));expect(visibleTaskTitles()).toEqual(['end'])
  await user.click(screen.getByRole('button',{name:'看板'}));expect(screen.getByRole('combobox',{name:'状态 end'})).toBeTruthy();expect(screen.queryByRole('combobox',{name:'状态 early'})).toBeNull()
  await user.click(screen.getByRole('button',{name:'重置筛选'}));expect(screen.getByLabelText('消息发出日期起始').value).toBe('');expect(screen.getByRole('combobox',{name:'状态 manual'})).toBeTruthy()
  expect(updates).toHaveLength(0)
})

it('筛选和排序跨全量待办后再分页，切换条件回到第一页',async()=>{
  messageTasks();fixture.tasks=Array.from({length:35},(_,i)=>({id:'task-'+i,title:'分页'+i,status:'ready',priority:'normal',tags:[],sourceRefId:'source-start'}));WB.store.set({data:fixture});const user=userEvent.setup();render(<WB.pages.tasks/>);
  await user.click(screen.getByRole('button',{name:'下一页'}));expect(visibleTaskTitles()).toHaveLength(5)
  await user.selectOptions(screen.getByRole('combobox',{name:'待办排序'}),'message-newest');expect(visibleTaskTitles()).toHaveLength(30)
  await user.click(screen.getByRole('button',{name:'下一页'}));fireEvent.change(screen.getByLabelText('消息发出日期起始'),{target:{value:'2026-10-29'}});expect(visibleTaskTitles()).toHaveLength(30)
})

it('时间缺失或非法不回退采集/建档时间，后续关联消息不会更改原任务时间，相同时间保持稳定顺序',()=>{
  messageTasks();const primary=fixture.tasks[0],later=fixture.sources[3];primary.sourceRefs=[{sourceId:later.id}]
  expect(taskMessageTime(primary,fixture.sources)).toBe(Date.parse('2026-10-28T15:59:59.999Z'))
  expect(taskMessageTime({...primary,sourceRefId:'missing'},fixture.sources)).toBe(Date.parse(later.locator.sentAt))
  const sources=[{id:'bad',provider:'yunzhijia',fetchedAt:'2026-10-29T00:00:00Z',locator:{sentAt:'invalid'}},{id:'calendar',provider:'yunzhijia-calendar',locator:{sentAt:'2026-10-29T00:00:00Z'}}]
  for(const sourceRefId of ['bad','calendar','missing'])expect(taskMessageTime({sourceRefId,createdAt:'2026-10-29T00:00:00Z'},sources)).toBeNull()
  expect(matchesTaskMessageDates(null,'2026-10-29','')).toBe(false);expect(matchesTaskMessageDates(null,'','')).toBe(true)
  expect(matchesTaskMessageDates(Date.parse('2026-10-29T00:00:00Z'),'2026-10-30','2026-10-29')).toBe(false)
  const ties=[{sourceRefId:'source-start',id:'b'},{sourceRefId:'source-start',id:'a'},{id:'none'}]
  for(const order of ['message-newest','message-oldest'])expect(sortTasksByMessageTime(ties,fixture.sources,order).map(t=>t.id)).toEqual(['b','a','none'])
})
