/**
 * 命令面板端到端（真实 React）：输入 → 防抖本地检索 → 分组结果 → 回车 → searchPreset。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadClientBundle } from './load-plugin.mjs'

let WB
const fixture = {
  version: 1,
  updatedAt: new Date().toISOString(),
  revision: 9,
  settings: { topics: ['Agent'], feeds: [], automation: { enabled: false, intervalMinutes: 60, radar: true, mentions: true } },
  projects: [],
  tasks: [
    { id: 'task-1', title: '给出网关限流阈值结论', status: 'ready', priority: 'urgent', dueAt: null, runIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  sources: [],
  runs: [],
  knowledge: [],
  radar: [{ id: 'radar-1', title: 'SQLite WAL 调参实践', topics: [], summary: {}, excerpt: '', createdAt: new Date().toISOString() }],
  candidates: [],
  connectors: [],
  syncCursors: {},
  audit: [],
}

beforeAll(async () => {
  const plugin = loadClientBundle()
  WB = plugin.WB
  WB.apply({
    provide: () => {},
    inject: () => {},
    effect: (fn) => fn(),
    get: () => undefined,
    logger: { info() {}, warn() {}, error() {} },
    connection: {
      rpc: {
        call: (_channel, endpoint, payload) => {
          if (endpoint === 'workbench/snapshot') return Promise.resolve({ ok: true, value: fixture })
          if (endpoint === 'workbench/search') {
            return Promise.resolve({
              ok: true,
              value: {
                query: payload.args.request.query,
                total: 1,
                groups: [{
                  id: 'tasks',
                  label: '我的待办',
                  status: 'ok',
                  items: [{ id: 'task-1', title: '给出网关限流阈值结论（来自检索）', snippet: '', url: null, kind: 'task', extra: {} }],
                }],
              },
            })
          }
          return Promise.reject(new Error('未预期的端点：' + endpoint))
        },
      },
    },
    slots: { inject() {}, register() { return () => {} } },
    locale: { register: () => () => {}, bind: () => (k) => k },
    uiWorkspace: {},
  })
  await WB.actions.reload()
})

describe('命令面板（真实 React + userEvent）', () => {
  it('输入 → 本地检索分组出现 → 回车写入 searchPreset 并跳搜索页', async () => {
    const user = userEvent.setup()
    render(React.createElement(WB.Palette, { open: true, onClose: () => {} }))

    await screen.findByPlaceholderText('搜索待办、知识、资讯，或输入命令…')
    await user.type(screen.getByPlaceholderText('搜索待办、知识、资讯，或输入命令…'), '限流')

    // 防抖 260ms + RPC；内联分组出现
    await waitFor(() => {
      expect(screen.getByText('搜索 · 我的待办')).toBeTruthy()
    })
    expect(screen.getByText(/给出网关限流阈值结论（来自检索）/)).toBeTruthy()
    expect(screen.getByText('本地检索 · 不联网')).toBeTruthy()

    // 回车执行第一条（搜索入口）
    const input = screen.getByPlaceholderText('搜索待办、知识、资讯，或输入命令…')
    await user.type(input, '{Enter}')

    await waitFor(() => {
      const preset = WB.store.get().searchPreset
      expect(preset).toBeTruthy()
      expect(preset.query).toBe('限流')
      expect(preset.groups).toEqual(['tasks'])
    })
    expect(WB.store.get().status).toBe('ready')
  })
})
