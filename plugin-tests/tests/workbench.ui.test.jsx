/**
 * 真实 React 下的组件测试（Testing Library）。
 * 与 node tests/client-render.mjs 的差别：真实 React 语义（effect 依赖、commit 后执行、
 * act() 边界、真实 DOM 事件）由 RTL/jsdom 提供，不再依赖手写 stub。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import React from 'react'
import { render, screen, within, waitFor, act } from '@testing-library/react'
import { loadClientBundle } from './load-plugin.mjs'

let plugin
let WB

beforeAll(() => {
  plugin = loadClientBundle()
  WB = plugin.WB
  // 与插件运行时一致的连接 stub：RPC 全部返回夹具
  const fixture = {
    version: 1,
    updatedAt: new Date().toISOString(),
    revision: 3,
    settings: { topics: ['Agent', 'RAG'], feeds: [], staleHours: 24, automation: { enabled: false, intervalMinutes: 60, radar: true, mentions: true }, assistantWidth: 384 },
    projects: [{ id: 'proj-1', name: '网关限流', repoPath: '/tmp/gateway' }],
    tasks: [
      { id: 'task-1', title: '给出网关限流阈值结论', description: '', status: 'ready', priority: 'urgent', dueAt: new Date(Date.now() + 6 * 3600e3).toISOString(), projectId: 'proj-1', tags: [], assignee: null, sourceRefId: null, runIds: [], confidence: 0.8, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ],
    sources: [
      { id: 'src-1', provider: 'yunzhijia', externalId: 'yzj:msg:m1', title: '@我 · 压测群', excerpt: '明天下班前给结论', fetchedAt: new Date().toISOString(), url: null, sender: 'wf', locator: null },
    ],
    runs: [{ id: 'run-1', taskId: 'task-1', status: 'completed', profile: '', summary: '压测验证', sessionId: null, startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), steps: [], evidence: [] }],
    knowledge: [
      { id: 'k-1', kind: 'bookmark', title: '限流笔记', body: '', url: '', tags: [], projectId: null, createdAt: new Date().toISOString() },
    ],
    radar: [
      { id: 'radar-1', title: 'SQLite WAL 调参实践', source: 'Engineer', url: 'https://example.com/wal', publishedAt: new Date().toISOString(), topics: ['Agent'], summary: { change: '', usage: '', risk: '', practice: '' }, excerpt: '', saved: false, createdAt: new Date().toISOString() },
    ],
    candidates: [],
    connectors: [],
    projectsTodo: [],
    syncCursors: {},
    lastRadarFetch: null,
    lastMentionsFetch: null,
    lastAutomation: null,
    operations: [],
    audit: [],
  }
  const rpc = (endpoint, args) => {
    if (endpoint === 'workbench/snapshot') return Promise.resolve({ ok: true, value: fixture })
    if (endpoint === 'workbench/search' && args.request.includeWeb === false) {
      return Promise.resolve({
        ok: true,
        value: {
          query: args.request.query,
          total: 1,
          groups: [
            {
              id: 'tasks',
              label: '我的待办',
              status: 'ok',
              items: [{ id: 'task-1', title: '给出网关限流阈值结论', snippet: 'q', url: null, kind: 'task', extra: {} }],
            },
          ],
        },
      })
    }
    return Promise.reject(new Error('未预期的端点：' + endpoint))
  }
  WB.apply({
    provide: () => {},
    inject: () => {},
    effect: (fn) => fn(),
    get: () => undefined,
    logger: { info() {}, warn() {}, error() {} },
    connection: { rpc: { call: (_c, endpoint, payload) => rpc(endpoint, payload) } },
    slots: { inject() {}, register() { return () => {} } },
    locale: { register: () => () => {}, bind: () => (k) => k },
    uiWorkspace: {},
  })
})

const PAGES = ['dashboard', 'tasks', 'search', 'agents', 'toolbox', 'collab', 'knowledge', 'settings']

describe('页面渲染（真实 React）', () => {
  PAGES.forEach((page) => {
    it(`打开 ${page} 页面不抛错且有内容`, () => {
      const Page = WB.pages[page]
      expect(Page, `页面 ${page} 未注册`).toBeTruthy()
      const { container } = render(React.createElement(Page, null))
      expect(container.textContent.length).toBeGreaterThan(0)
      expect(container.querySelector('[data-test-empty]') === null).toBe(true)
    })
  })
})
