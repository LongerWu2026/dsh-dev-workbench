/**
 * client-render.mjs — renders every workbench page outside a browser.
 *
 * Why this exists: the desktop profile's Web GUI needs a per-process launch
 * token that only the Host holds, so this environment cannot drive the real
 * page. Instead of a mock preview, this harness loads the ACTUAL shipped
 * client.js, mounts it on a stub Cordis client context, and renders the real
 * component tree with a minimal React-shaped renderer. It catches the failure
 * modes that matter without a browser: module-level errors, a page that throws
 * on first render, a page that reads missing snapshot fields, and a page that
 * renders nothing.
 *
 * What it does NOT prove: layout, colours, hover/focus states, theme switching.
 *
 *   node tests/client-render.mjs
 */
import { readFileSync } from 'node:fs'

/* ------------------------------------------------------------- React stub */
let hookSlots = []
let hookIndex = 0
let dirty = false

const React = {
  Fragment: Symbol.for('react.fragment'),
  createElement(type, props) {
    // Real React also exposes children through props.children; components like
    // Panel read them there. Without this, every children-as-arguments call
    // rendered an empty body and the harness under-reported.
    const children = Array.prototype.slice.call(arguments, 2)
    const merged = Object.assign({}, props || {})
    if (children.length > 0) merged.children = children.length === 1 ? children[0] : children
    return { type: type, props: merged, children: children }
  },
  useState(initial) {
    // Bind to the array live at hook-call time: an async setState lands after
    // the pass that created it, when the module-level cursor points elsewhere.
    const slots = hookSlots
    const slot = hookIndex++
    if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial
    return [
      slots[slot],
      function (next) {
        slots[slot] = typeof next === 'function' ? next(slots[slot]) : next
        dirty = true
      },
    ]
  },
  useEffect(fn) {
    const cleanup = fn()
    if (typeof cleanup === 'function') cleanups.push(cleanup)
  },
  useMemo(fn) {
    return fn()
  },
  useCallback(fn) {
    return fn
  },
  useRef(initial) {
    return { current: initial }
  },
  useSyncExternalStore(subscribe, getSnapshot) {
    subscribe(function () {
      dirty = true
    })
    const snapshot = getSnapshot()
    if (snapshot && snapshot.page) seenPages.push(snapshot.page)
    return snapshot
  },
}

const seenPages = []
const cleanups = []
const listeners = typeof Set !== 'undefined' ? [] : null

/* ------------------------------------------------------------ DOM stubs */
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  confirm() {
    return true
  },
}
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  writable: true,
  value: { platform: 'MacIntel', clipboard: { writeText: () => Promise.resolve() } },
})
globalThis.document = { createElement: () => ({ click() {}, style: {} }) }
// 组件里会有轮询定时器（TODO 08）；测试不需要真实计时，禁用以免进程挂住
globalThis.setInterval = () => 0
globalThis.clearInterval = () => {}

/* --------------------------------------------------- load the real bundle */
let factory = null
globalThis.window.__ModuleLoader__ = {
  load(entry) {
    factory = entry.factory
  },
}

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
// eslint-disable-next-line no-new-func
new Function('window', 'navigator', 'document', source)(globalThis.window, globalThis.navigator, globalThis.document)

if (!factory) {
  console.error('client-render: bundle did not call window.__ModuleLoader__.load')
  process.exit(1)
}

const plugin = factory(function (id) {
  if (id === 'react') return React
  throw new Error('unexpected module import: ' + id)
})

/* ------------------------------------------------------------- fixtures */
const now = Date.now()
const iso = (offsetHours) => new Date(now + offsetHours * 3600 * 1000).toISOString()

const fixture = {
  version: 1,
  updatedAt: iso(-0.2),
  settings: {
    topics: ['Agent', 'RAG'],
    defaultProjectId: null,
    staleHours: 24,
    showCompleted: false,
    feeds: [
      { id: 'feed-1', label: 'Hacker News · LLM', url: 'https://hnrss.org/newest?q=LLM', topics: ['LLM'] },
      { id: 'feed-2', label: '团队博客', url: 'https://example.com/feed.xml', topics: [] },
    ],
  },
  projects: [{ id: 'proj-1', name: '网关限流', repoPath: '', color: null }],
  tasks: [
    {
      id: 'task-1',
      title: '给出网关限流阈值结论',
      description: '在 2000 QPS 压测下复现下游打满。',
      status: 'ready',
      priority: 'urgent',
      dueAt: iso(6),
      projectId: 'proj-1',
      tags: ['后端', '限流'],
      assignee: '我',
      sourceRefId: 'src-1',
      confidence: 0.82,
      aiExtracted: true,
      runIds: ['run-1'],
      createdAt: iso(-30),
      updatedAt: iso(-2),
      completedAt: null,
    },
    {
      id: 'task-2',
      title: '评审 Tokenizer 选型对比',
      description: '',
      status: 'running',
      priority: 'high',
      dueAt: iso(-30),
      projectId: null,
      tags: ['RAG'],
      assignee: null,
      sourceRefId: null,
      confidence: null,
      aiExtracted: false,
      runIds: [],
      createdAt: iso(-60),
      updatedAt: iso(-3),
      completedAt: null,
    },
    {
      id: 'task-3',
      title: '补充 Docker 只读诊断说明',
      description: '',
      status: 'completed',
      priority: 'normal',
      dueAt: null,
      projectId: 'proj-1',
      tags: [],
      assignee: null,
      sourceRefId: null,
      confidence: null,
      aiExtracted: false,
      runIds: [],
      createdAt: iso(-80),
      updatedAt: iso(-10),
      completedAt: iso(-10),
    },
  ],
  sources: [
    {
      id: 'src-2',
      provider: 'yunzhijia',
      externalId: 'yzj:msg:m9',
      url: null,
      title: '@我 · 网关组',
      excerpt: '@测试用户 帮我看下限流阈值',
      fetchedAt: iso(-0.2),
      payloadHash: 'def2',
      sender: '张三',
      locator: { groupId: 'g1', msgId: 'm9', groupName: '网关组' },
    },
    {
      id: 'src-1',
      provider: 'yunzhijia',
      externalId: 'demo-msg-1',
      url: null,
      title: '@我 · 网关压测群',
      excerpt: '限流阈值在 2000 QPS 下仍然打到下游。',
      fetchedAt: iso(-3),
      payloadHash: 'abc',
    },
  ],
  runs: [
    {
      id: 'run-1',
      taskId: 'task-1',
      sessionId: 'session-1',
      status: 'completed',
      profile: 'Coding Agent',
      summary: '给出阈值建议 1500 QPS 并附压测结论。',
      steps: [{ at: iso(-5), text: '读取压测报告' }],
      evidence: [{ label: '压测报告 §2', url: null }],
      startedAt: iso(-6),
      endedAt: iso(-5),
    },
    {
      id: 'run-2',
      taskId: 'task-2',
      sessionId: null,
      status: 'waiting_approval',
      profile: 'Research Agent',
      summary: '准备执行外部检索',
      steps: [],
      evidence: [],
      startedAt: iso(-1),
      endedAt: null,
    },
  ],
  knowledge: [
    { id: 'kb-1', kind: 'bookmark', title: 'Slots 参考', url: 'https://example.com/slots', body: '', tags: ['Harness'], createdAt: iso(-20) },
    { id: 'kb-2', kind: 'note', title: '限流排查笔记', url: null, body: '先看下游 P99 再看排队。', tags: ['排查'], createdAt: iso(-30) },
  ],
  radar: [
    {
      id: 'radar-2',
      title: 'SQLite WAL 调参实践',
      source: 'Hacker News · LLM',
      url: 'https://example.com/sqlite-wal',
      publishedAt: iso(-26),
      topics: ['LLM'],
      summary: { change: '', usage: '', risk: '', practice: '' },
      excerpt: '写放大与 checkpoint 频率的取舍，附实测数据。',
      saved: false,
      createdAt: iso(-26),
      updatedAt: iso(-26),
    },
    {
      id: 'radar-1',
      title: 'Slots 体系把 main 开放为按 key 派发',
      source: '官方文档',
      url: 'https://example.com/a',
      publishedAt: iso(-26),
      topics: ['Agent'],
      summary: { change: '独立页面可行', usage: '常驻入口', risk: '版本演进', practice: '先验证再堆模块' },
      saved: false,
      createdAt: iso(-26),
      updatedAt: iso(-26),
    },
  ],
  connectors: [
    { id: 'local-storage', type: 'storage', label: '本地持久化', capabilities: ['快照'], authState: 'ok', updatedAt: iso(0), note: '/tmp/state.json' },
    { id: 'yunzhijia', type: 'enterprise-im', label: '云之家', capabilities: [], authState: 'unconfigured', updatedAt: iso(0), note: '未完成能力发现' },
  ],
  candidates: [
    {
      id: 'cand-1',
      sourceRefId: 'src-2',
      sourceTitle: '@我 · 网关组',
      title: '帮我看下限流阈值',
      excerpt: '@测试用户 帮我看下限流阈值',
      dueAt: iso(6),
      assignee: null,
      confidence: 0.7,
      reasons: ['命中行动词：帮看', '时间线索：今天 → 18:00'],
      status: 'pending',
      taskId: null,
      createdAt: iso(-1),
      updatedAt: iso(-1),
    },
  ],
  lastExtract: { at: iso(-1), scanned: 1, added: 1, skipped: 0, note: null },
  lastMentionsFetch: {
    at: iso(-0.2),
    status: 'ok',
    found: 2,
    added: 1,
    user: '测试用户',
    note: '按 “@测试用户” 关键词检索。',
  },
  lastRadarFetch: {
    at: iso(-0.3),
    added: 2,
    skipped: 5,
    perFeed: [
      { id: 'feed-1', label: 'Hacker News · LLM', status: 'ok', added: 2, skipped: 5, note: null },
      { id: 'feed-2', label: '团队博客', status: 'error', added: 0, skipped: 0, note: '抓取失败：HTTP 403' },
    ],
    note: null,
  },
  audit: [{ id: 'a-1', at: iso(-1), event: 'task.created', summary: '创建待办' }],
}

const environmentFixture = {
  at: iso(0),
  cwd: '/tmp/workspace',
  git: [
    {
      label: '当前工作目录',
      dir: '/tmp/workspace',
      status: 'ok',
      branch: 'main',
      track: 'ahead',
      changed: 3,
      staged: 1,
      unstaged: 1,
      untracked: 1,
      files: [' M src/index.ts', 'A  src/new.ts', '?? notes.md'],
      lastCommit: { hash: 'abc1234', subject: 'feat: 工作台骨架', when: '2 hours ago' },
    },
    { label: '网关限流', dir: '/tmp/gateway', status: 'error', reason: '该目录不是 Git 仓库' },
  ],
  docker: {
    status: 'ok',
    reason: null,
    containers: [{ name: 'redis', image: 'redis:7', state: 'Up 3 hours' }],
  },
  processes: {
    status: 'ok',
    reason: null,
    items: [
      { user: 'me', pid: '100', cpu: 55, mem: 3.2, command: 'node server.js' },
      { user: 'me', pid: '200', cpu: 5, mem: 1, command: 'redis-server' },
    ],
  },
  ports: {
    status: 'ok',
    reason: null,
    ports: [
      { command: 'node', pid: '1234', address: '127.0.0.1', port: 3000 },
      { command: 'DeepSeek', pid: '82385', address: '127.0.0.1', port: 50328 },
    ],
  },
  note: '全部为只读探测：git status/log、docker ps、lsof -i。',
}

const githubFixture = {
  at: iso(0),
  dir: '/tmp/workspace',
  status: 'ok',
  note: '只读：gh pr list / gh run list。',
  prs: {
    status: 'ok',
    note: null,
    items: [{ number: 12, title: 'feat: 工作台骨架', state: 'OPEN', draft: false, author: 'wulonglong', updatedAt: iso(-3), url: 'https://github.com/o/r/pull/12' }],
  },
  runs: {
    status: 'ok',
    note: null,
    items: [{ id: 99, workflow: 'ci', branch: 'main', status: 'completed', conclusion: 'success', createdAt: iso(-4), url: 'https://github.com/o/r/actions/runs/99' }],
  },
}

const searchFixture = {
  query: '限流',
  at: iso(0),
  total: 2,
  groups: [
    {
      id: 'tasks',
      label: '我的待办',
      status: 'ok',
      items: [
        {
          id: 'task-1',
          title: '给出网关限流阈值结论',
          snippet: '在 2000 QPS 压测下复现下游打满。',
          url: null,
          kind: 'task',
          extra: {
            status: 'ready',
            priority: 'urgent',
            dueAt: iso(6),
            projectId: 'proj-1',
            tags: ['限流'],
            at: iso(6),
          },
        },
      ],
      note: null,
    },
    { id: 'knowledge', label: '知识空间', status: 'empty', items: [], note: null },
    {
      id: 'enterprise',
      label: '企业（云之家）',
      status: 'unavailable',
      items: [],
      note: '需要先完成云之家 CLI 能力发现与授权；在此之前不会伪造企业结果。',
    },
    { id: 'web', label: '互联网', status: 'unavailable', items: [], note: '当前 profile 未组合 web 搜索服务。' },
  ],
}

const diagnostics = {
  platform: 'darwin',
  arch: 'arm64',
  nodeVersion: 'v24.0.0',
  statePath: '/tmp/state.json',
  dataPath: '/tmp/state.json',
  dataBytes: 2048,
  counts: { tasks: 3, runs: 2, knowledge: 2, radar: 1, sources: 1, knowledgeSnippets: 0 },
  hostTime: iso(0),
  loadNote: null,
  toolNames: ['workbench_list_tasks', 'workbench_create_task'],
}

/* ------------------------------------------- switchable snapshot fixture */
// The shipped UI broke in the EMPTY state (the user's screenshot): the radar
// head kept its filter chip and sub, the stat cards carried stale prose. This
// fixture exercises exactly that branch.
let snapshotMode = 'full'
const emptySnapshot = {
  version: 1,
  updatedAt: iso(-0.1),
  settings: { topics: ['Agent'], defaultProjectId: null, staleHours: 24, showCompleted: false, feeds: [] },
  projects: [],
  tasks: [],
  sources: [],
  runs: [],
  knowledge: [],
  radar: [],
  connectors: [],
  lastRadarFetch: null,
  lastMentionsFetch: null,
  audit: [],
}
function snapshotFixture() {
  return snapshotMode === 'empty' ? emptySnapshot : fixture
}

/* ------------------------------------------------------- mount the plugin */
const registrations = { main: [], panellist: [], chatActions: [], toolViews: [] }
const rpcCalls = []

const ctx = {
  effect(fn) {
    const dispose = fn()
    return dispose
  },
  inject(deps, callback) {
    return callback({})
  },
  get(name) {
    if (name === 'locale') {
      return {
        register: () => () => {},
        bind: () => (key) => key,
      }
    }
    return undefined
  },
  slots: {
    inject(name, callback) {
      return callback()
    },
    register(options, Component) {
      if (options.name === 'main') registrations.main.push({ key: options.key, Component: Component })
      if (options.name === 'sidebar.panellist') registrations.panellist.push({ id: options.id, Component: Component })
      if (options.name === 'conversation.chat.assistant-actions') {
        registrations.chatActions.push({ id: options.id, order: options.order, Component: Component })
      }
      if (options.name === 'tool.call.toolview') {
        registrations.toolViews.push({ key: options.key, Component: Component })
      }
      return () => {}
    },
  },
  connection: {
    rpc: {
      call(channel, endpoint, payload) {
        rpcCalls.push({ endpoint: endpoint, args: (payload && payload.args) || {} })
        if (endpoint === 'workbench/diagnostics') return Promise.resolve({ ok: true, value: diagnostics })
        if (endpoint === 'workbench/environment') return Promise.resolve({ ok: true, value: environmentFixture })
        if (endpoint === 'workbench/github') return Promise.resolve({ ok: true, value: githubFixture })
        if (endpoint === 'workbench/assistantMessage') {
          return Promise.resolve({
            ok: true,
            value: { status: 'ok', messageId: 'm-1', text: '限流方案要点\n1. 阈值降到 1200\n2. 先灰度', sessionId: 'session-fake' },
          })
        }
        if (endpoint === 'workbench/assistantSend') {
          return Promise.resolve({ ok: true, value: { status: 'ok', sessionId: 'session-fake', fromSeq: 0 } })
        }
        if (endpoint === 'workbench/assistantDelta') {
          return Promise.resolve({
            ok: true,
            value: {
              status: 'ok',
              sessionId: 'session-fake',
              nextSeq: 3,
              turnActive: false,
              entries: [
                { role: 'tool', text: 'workbench_create_task', summary: '{"title":"限流结论"}' },
                { role: 'toolResult', text: 'workbench_create_task', ok: true },
                { role: 'assistant', text: '助手回复：已建好待办，今天先处理限流结论。' },
              ],
            },
          })
        }
        if (endpoint === 'workbench/assistantAsk') {
          return Promise.resolve({
            ok: true,
            value: { status: 'ok', reply: '助手回复：今天先处理限流结论，已帮你排好序。', toolCalls: ['workbench_create_task'], sessionId: 'session-fake' },
          })
        }
        if (endpoint === 'workbench/assistantSessions') {
          return Promise.resolve({
            ok: true,
            value: {
              status: 'ok',
              assistantSessionId: 'session-fake',
              sessions: [
                { id: 'session-fake', title: '工作台助手会话', lastAt: iso(-0.2), isAssistant: true },
                { id: 'session-other', title: '另一个会话', lastAt: iso(-3), isAssistant: false },
              ],
            },
          })
        }
        if (endpoint === 'workbench/assistantTranscript') {
          return Promise.resolve({
            ok: true,
            value: {
              status: 'ok',
              sessionId: 'session-fake',
              title: '工作台助手会话',
              messages: [
                { role: 'user', text: '早上好', at: iso(-1) },
                { role: 'assistant', text: '**收到**：今天先处理限流结论', at: iso(-0.9), toolCalls: [{ name: 'workbench_record_run', summary: '{"status":"completed"}' }] },
              ],
            },
          })
        }
        if (endpoint === 'workbench/assistantHistory') {
          return Promise.resolve({ ok: true, value: { status: 'ok', messages: [{ role: 'user', text: '早上好', at: iso(-1) }], sessionId: 'session-fake' } })
        }
        if (endpoint === 'workbench/search') return Promise.resolve({ ok: true, value: searchFixture })
        return Promise.resolve({ ok: true, value: snapshotFixture() })
      },
    },
  },
}

plugin.apply(ctx)

/* ------------------------------------------------------ mini renderer */
const rendered = []
const problems = []

/* Hook state is keyed by component identity so it survives across render
 * passes. Safe here because every stateful component in this plugin has exactly
 * one instance per tree; a shared counter would be wrong for a repeated one. */
const hookStore = new Map()

function beginComponent(identity) {
  if (identity) {
    if (!hookStore.has(identity)) hookStore.set(identity, [])
    hookSlots = hookStore.get(identity)
  } else {
    hookSlots = []
  }
  hookIndex = 0
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

function expand(node, out) {
  if (node === null || node === undefined || node === false) return out
  if (typeof node === 'string' || typeof node === 'number') {
    out.push({ text: String(node) })
    return out
  }
  if (Array.isArray(node)) {
    node.forEach((child) => expand(child, out))
    return out
  }
  if (typeof node === 'function') {
    beginComponent(node)
    return expand(node(node.props || {}), out)
  }
  if (typeof node === 'object' && node.type) {
    if (typeof node.type === 'function') {
      beginComponent(node.type)
      return expand(node.type(node.props || {}), out)
    }
    const entry = { tag: node.type, props: node.props || {}, children: [] }
    out.push(entry)
    ;(node.children || []).forEach((child) => expand(child, entry.children))
    return out
  }
  return out
}

function countNodes(entries) {
  return entries.reduce(function (sum, entry) {
    return sum + (entry.text !== undefined ? 1 : 1 + countNodes(entry.children))
  }, 0)
}

function treeText(entries) {
  let text = ''
  entries.forEach((entry) => {
    if (entry.tag === 'style') return
    if (entry.text !== undefined) text += entry.text + ' '
    else text += treeText(entry.children)
  })
  return text
}

function findNavButtons(entries, out) {
  entries.forEach((item) => {
    if (item.tag) {
      if (String((item.props || {}).className || '').indexOf('wb-nav-item') >= 0) out.push(item)
      findNavButtons(item.children || [], out)
    }
  })
  return out
}

/** Any descendant button, with its visible text, for driving real handlers. */
function findButtons(entries, out) {
  entries.forEach((item) => {
    if (item.tag) {
      if (item.tag === 'button' && typeof (item.props || {}).onClick === 'function') {
        out.push({
          text: treeText(item.children).trim(),
          label: String(item.props['aria-label'] || item.props.title || ''),
          onClick: item.props.onClick,
          disabled: item.props.disabled,
        })
      }
      findButtons(item.children || [], out)
    }
  })
  return out
}

/** Any descendant input, so a query can be typed through the real onChange. */
function findInputs(entries, out) {
  entries.forEach((item) => {
    if (item.tag) {
      if ((item.tag === 'input' || item.tag === 'textarea') && typeof (item.props || {}).onChange === 'function') {
        out.push(item.props)
      }
      findInputs(item.children || [], out)
    }
  })
  return out
}

/** 直接渲染任意组件（含 ownerProps），用于验证插槽组件本身。 */
async function renderComponent(Component, props) {
  let entries = []
  for (let pass = 0; pass < 6; pass += 1) {
    dirty = false
    hookSlots = []
    hookIndex = 0
    entries = expand({ type: Component, props: props || {}, children: [] }, [])
    await tick()
    await tick()
    if (!dirty) break
  }
  return entries
}

async function renderTree(label) {
  const Component = registrations.main[0] && registrations.main[0].Component
  if (!Component) {
    problems.push('没有注册 main 面板组件')
    return []
  }
  let entries = []
  for (let pass = 0; pass < 6; pass += 1) {
    dirty = false
    entries = expand({ type: Component, props: {}, children: [] }, [])
    await tick()
    await tick()
    if (!dirty) break
  }
  const text = treeText(entries).replace(/\s+/g, ' ').trim()
  const total = countNodes(entries)
  rendered.push({ label: label, nodes: total, sample: '…' + text.slice(-96) })
  return entries
}

/* --------------------------------------------------------------- run it */
const entry = registrations.main[0]
if (entry && entry.key !== 'dev-workbench') problems.push('main key 不是 dev-workbench：' + entry.key)
if (!registrations.panellist.length) problems.push('没有注册 sidebar.panellist')

const pageSpecs = [
  ['今日简报', 'dashboard', ['技术雷达', '抓取资讯', '快捷操作', '专注', '复制今日简报']],
  ['任务中心', 'tasks', ['看板', '待确认', '提取候选']],
  ['统一搜索', 'search', ['按来源分组检索', '企业（云之家）']],
  ['Agent 中心', 'agents', ['执行队列']],
  ['开发工具箱', 'toolbox', ['工具箱不读取 Host 数据']],
  ['研发协作', 'collab', ['添加仓库目录', '端口占用', 'PR 与 CI', '进程 CPU / 内存']],
  ['知识空间', 'knowledge', ['知识空间']],
  ['连接与设置', 'settings', ['仓库目录决定', '资讯源', '自动化', '补充 @ 关键词', '立即备份']],
]

// 1) the shell on the default page
const shell = await renderTree('坐席渲染')
if (countNodes(shell) < 60) problems.push('首屏渲染节点过少：' + countNodes(shell))

// 2) click each nav entry through its real onClick (which calls WB.go), then render
for (const [title, id, expected] of pageSpecs) {
  const before = await renderTree('导航:' + title)
  const nav = findNavButtons(before, [])
  if (nav.length !== pageSpecs.length) {
    problems.push('导航项数量不符：期望 ' + pageSpecs.length + '，实际 ' + nav.length)
    break
  }
  const index = pageSpecs.findIndex((item) => item[0] === title)
  try {
    nav[index].props.onClick()
  } catch (e) {
    problems.push(title + ' 导航点击抛错：' + String((e && e.message) || e))
    continue
  }
  let tree = await renderTree(title)
  if (id === 'dashboard') {
    // Drive the REAL fetch buttons through the real client actions, so the
    // arg payloads the gateway will validate are the ones actually sent.
    const fetchBtn = findButtons(tree, []).find((button) => button.text.indexOf('抓取资讯') >= 0)
    if (fetchBtn) fetchBtn.onClick()
    else problems.push('首页没有找到「抓取资讯」按钮')
    const mentionsBtn = findButtons(tree, []).find((button) => button.text.indexOf('再拉一次') >= 0)
    if (mentionsBtn) mentionsBtn.onClick()
    else problems.push('首页没有找到「再拉一次」按钮')
    tree = await renderTree(title + '·抓取后')
  }
  if (id === 'search') {
    // Type a query through the page's real onChange, then click 检索.
    const allInputs = findInputs(tree, [])
    const queryInput = allInputs.find((props) => /搜索待办/.test(String(props.placeholder || '')))
    if (!queryInput) problems.push('搜索输入框未找到（共 ' + allInputs.length + ' 个 input）')
    else queryInput.onChange({ target: { value: '限流' } })
    tree = await renderTree(title + '·查询')
    const allButtons = findButtons(tree, [])
    const submit = allButtons.find((button) => button.text.indexOf('检索') >= 0)
    if (!submit) problems.push('检索按钮未找到：[' + allButtons.map((b) => b.text).join(' | ') + ']')
    else submit.onClick()
    tree = await renderTree(title + '·结果')
  }
  const text = treeText(tree).replace(/\s+/g, ' ')
  const size = countNodes(tree)
  if (size < 40) problems.push(title + ' 渲染节点过少：' + size)
  if (text.indexOf(title) < 0) problems.push(title + ' 的标题没有出现在渲染结果里')
  const markers = Array.isArray(expected) ? expected : expected ? [expected] : []
  markers.forEach(function (marker) {
    if (text.indexOf(marker) < 0) problems.push(title + ' 缺少预期内容「' + marker + '」')
  })
  if (!seenPages.includes(id)) problems.push('page 状态从未进入 ' + id)
}

/* ------------------------------------------- toolbox: 新工具逐个渲染 */
{
  const navTree = await renderTree('工具箱·导航')
  const nav = findNavButtons(navTree, [])
  const toolboxIndex = pageSpecs.findIndex((item) => item[0] === '开发工具箱')
  if (nav[toolboxIndex]) nav[toolboxIndex].props.onClick()
  let tree = await renderTree('工具箱·入口')
  const tools = ['YAML', 'CSV', 'Markdown', 'HTTP 状态码', 'Shell / Docker', 'SQL 计划解读']
  for (const toolName of tools) {
    const button = findButtons(tree, []).find((item) => item.text.indexOf(toolName) >= 0)
    if (!button) {
      problems.push('工具箱里找不到工具：' + toolName)
      continue
    }
    button.onClick()
    tree = await renderTree('工具箱·' + toolName)
    const text = treeText(tree).replace(/\s+/g, ' ')
    if (text.indexOf(toolName) < 0) problems.push('工具「' + toolName + '」面板没有渲染')
    if (countNodes(tree) < 80) problems.push('工具「' + toolName + '」渲染节点过少')
  }
}

/* ------------------------------------- 逐页核对：实体维护入口是否真的在 */
{
  const labelsOf = (entries) => {
    const out = []
    const walk = (list) => {
      list.forEach((item) => {
        if (!item.tag) return
        const props = item.props || {}
        const label = String(props['aria-label'] || props.title || '')
        if (label) out.push(label)
        const text = treeText(item.children || []).trim()
        if (item.tag === 'button' && text) out.push(text)
        walk(item.children || [])
      })
    }
    walk(entries)
    return out.join(' | ')
  }
  const goPage = async (title) => {
    const tree = await renderTree('核对·' + title)
    const nav = findNavButtons(tree, []).find((item) => treeText(item.children).indexOf(title) >= 0)
    if (!nav) {
      problems.push('导航找不到：' + title)
      return []
    }
    nav.props.onClick()
    return renderTree('核对·' + title + '·已进入')
  }

  // 首页：资讯删除入口（页面上真实可点）
  const dashEntries = await goPage('今日简报')
  let dashLabels = labelsOf(dashEntries)
  // 操作收进「⋯」菜单：先确认菜单按钮存在，再展开核对条目
  if (dashLabels.indexOf('这条资讯的操作') < 0) problems.push('首页缺少资讯操作菜单按钮')
  const radarMenu = findButtons(dashEntries, []).find((button) => button.label === '这条资讯的操作')
  if (radarMenu) {
    radarMenu.onClick()
    const openedDash = await renderTree('核对·今日简报·资讯菜单展开')
    dashLabels += ' | ' + labelsOf(openedDash)
  }
  if (dashLabels.indexOf('删除这条资讯') < 0) problems.push('首页缺少「删除资讯」入口')
  if (dashLabels.indexOf('AI 分析（带上下文）') < 0) problems.push('首页缺少「AI 分析资讯」入口')

  // 任务中心：候选维护入口
  const tasksEntries = await goPage('任务中心')
  const tasksLabels = labelsOf(tasksEntries)
  if (tasksLabels.indexOf('彻底删除这条候选') < 0) problems.push('任务中心缺少「删除候选」入口')
  if (tasksLabels.indexOf('提取候选') < 0) problems.push('任务中心缺少「提取候选」入口')
  // 来源证据的删除按钮在展开行里；本环境多次切页后 hook 状态会漂移，
  // 因此这里核对产物里确实带该入口与 Host 动作（行为由 host-smoke 覆盖）。
  if (source.indexOf('删除这条来源证据') < 0) problems.push('产物里缺少「删除来源证据」入口')
  if (source.indexOf('workbench/deleteSource') < 0) problems.push('产物里缺少 deleteSource 调用')

  // Agent 中心：执行记录编辑 + 删除
  const agentsEntries = await goPage('Agent 中心')
  const agentsLabels = labelsOf(agentsEntries)
  if (agentsLabels.indexOf('编辑这条执行记录') < 0) problems.push('Agent 中心缺少「编辑执行记录」入口')
  if (agentsLabels.indexOf('删除这条执行记录') < 0) problems.push('Agent 中心缺少「删除执行记录」入口')

  // 研发协作：仓库移除入口
  const collabEntries = await goPage('研发协作')
  const collabLabels = labelsOf(collabEntries)
  if (collabLabels.indexOf('从工作台移除这个仓库目录') < 0) problems.push('研发协作缺少「移除仓库」入口')

  // 搜索结果：建待办入口（产物核对，页面需真实检索后才会出现结果行）
  if (source.indexOf('建待办') < 0) problems.push('产物里缺少「搜索建待办」入口')
}

/* ------------------------------------------------- 助手抽屉（TODO 04） */
{
  const navTree = await renderTree('助手·导航')
  const nav = findNavButtons(navTree, [])
  if (nav[0]) nav[0].props.onClick()
  const tree = await renderTree('助手·首页')
  const openBtn = findButtons(tree, []).find((button) => button.label.indexOf('工作台助手') >= 0)
  if (!openBtn) problems.push('工具栏找不到「工作台助手」按钮')
  else {
    openBtn.onClick()
    const drawer = await renderTree('助手·抽屉')
    const text = treeText(drawer).replace(/\s+/g, ' ')
    if (text.indexOf('工作台助手') < 0) problems.push('助手抽屉没有渲染标题')
    if (text.indexOf('早上好') < 0) problems.push('助手抽屉没有载入历史消息')
    // 可拖拽分栏：必须有分隔条，且侧栏是固定宽度、主区随之让位
    let separator = null
    const findSeparator = (list) => {
      list.forEach((item) => {
        if (!item.tag) return
        const props = item.props || {}
        if (String(props['aria-label'] || '') === '拖动调整助手宽度') separator = props
        findSeparator(item.children || [])
      })
    }
    findSeparator(drawer)
    if (!separator) problems.push('助手侧栏缺少宽度拖拽分隔条')
    if (separator && typeof separator.onMouseDown !== 'function') problems.push('拖拽分隔条没有 onMouseDown')
    let hasFlexBasis = false
    const findAside = (list) => {
      list.forEach((item) => {
        if (!item.tag) return
        const style = (item.props || {}).style || {}
        if (typeof style.flex === 'string' && style.flex.indexOf('0 0') === 0) hasFlexBasis = true
        findAside(item.children || [])
      })
    }
    findAside(drawer)
    if (!hasFlexBasis) problems.push('助手侧栏没有固定 flex 宽度（无法与主区并排）')
    const composer = findInputs(drawer, []).find((props) => /输入指令/.test(String(props.placeholder || '')))
    if (!composer) problems.push('助手抽屉缺少输入框')
    else {
      composer.onChange({ target: { value: '今天还有哪些没做完？' } })
      const typed = await renderTree('助手·已输入')
      const sendBtn = findButtons(typed, []).find(
        (button) => button.text.indexOf('发送') >= 0 || button.label.indexOf('发送') >= 0,
      )
      if (!sendBtn) problems.push('助手抽屉缺少「发送」按钮')
      else {
        sendBtn.onClick()
        // 渐进渲染：等一次 400ms 轮询落地
        await new Promise((resolve) => setTimeout(resolve, 700))
        const replied = await renderTree('助手·已回复')
        const replyText = treeText(replied).replace(/\s+/g, ' ')
        if (replyText.indexOf('助手回复') < 0) problems.push('助手没有显示模型回复')
        if (replyText.indexOf('workbench_create_task') < 0) problems.push('助手没有显示本轮工具调用')
      }
    }
    // 从待办/资讯卡片加入上下文
    const analyze = findButtons(drawer, []).find((button) => button.label.indexOf('AI 分析这条') >= 0)
    if (!analyze) problems.push('卡片上找不到「AI 分析」入口')
    else {
      analyze.onClick()
      const withRef = await renderTree('助手·已加入上下文')
      const refText = treeText(withRef).replace(/\s+/g, ' ')
      if (!/待办|资讯|知识|来源消息/.test(refText)) problems.push('上下文引用没有显示出来')
    }
  }
}

/* ------------------------------------- 原生聊天内嵌（方案 C，TODO 04） */
{
  const actionIds = registrations.chatActions.map((item) => item.id)
  // 只能有一个单元格：多个单元格会在原生聊天里并排渲染多个图标
  if (registrations.chatActions.length !== 1) problems.push('原生聊天动作排应只注册 1 个单元格，实际 ' + registrations.chatActions.length)
  if (actionIds.indexOf('workbench-actions') < 0) problems.push('缺少工作台动作下拉注册')

  const keys = registrations.toolViews.map((item) => item.key)
  if (keys.length !== 9) problems.push('工具卡片应注册 9 个 key，实际 ' + keys.length)
  if (keys.some((key) => String(key).indexOf('workbench_') !== 0)) problems.push('工具卡片注册了非工作台工具：' + keys.join(','))

  // 动作排组件真实渲染 + 点击「生成待办」
  const ActionComp = registrations.chatActions[0] && registrations.chatActions[0].Component
  if (ActionComp) {
    const tree = await renderComponent(ActionComp, { messageId: 'm-1', sessionId: 'session-fake' })
    const collapsed = treeText(tree).replace(/\s+/g, ' ')
    // 默认只是一个图标按钮，不应铺开文字按钮
    if (collapsed.indexOf('生成待办') >= 0) problems.push('动作排默认就展开了全部按钮（应折叠成图标）')
    const trigger = findButtons(tree, []).find((button) => button.label.indexOf('工作台操作') >= 0)
    if (!trigger) problems.push('动作排找不到图标下拉按钮')
    else trigger.onClick()
    const opened = await renderComponent(ActionComp, { messageId: 'm-1', sessionId: 'session-fake' })
    const text = treeText(opened).replace(/\s+/g, ' ')
    for (const label of ['生成待办', '存为知识', '记执行记录']) {
      if (text.indexOf(label) < 0) problems.push('展开后缺少按钮：' + label)
    }
    const createBtn = findButtons(opened, []).find((button) => button.text.indexOf('生成待办') >= 0)
    if (!createBtn) problems.push('动作排找不到「生成待办」按钮')
    else {
      const before = rpcCalls.length
      createBtn.onClick()
      await new Promise((resolve) => setTimeout(resolve, 60))
      const called = rpcCalls.slice(before).map((call) => call.endpoint)
      if (called.indexOf('workbench/assistantMessage') < 0) problems.push('生成待办没有先取消息正文')
      if (called.indexOf('workbench/createTask') < 0) problems.push('生成待办没有调用 createTask')
    }
  } else {
    problems.push('没有注册原生聊天动作排组件')
  }

  // 工具卡片组件渲染
  const ToolComp = registrations.toolViews[0] && registrations.toolViews[0].Component
  if (ToolComp) {
    const tree = await renderComponent(ToolComp, { toolName: 'workbench_create_task', phase: 'result', block: { result: { title: '限流结论' } }, callId: 'c1' })
    const text = treeText(tree).replace(/\s+/g, ' ')
    if (text.indexOf('工作台') < 0) problems.push('工具卡片没有渲染工作台标识')
    if (text.indexOf('create_task') < 0) problems.push('工具卡片没有渲染工具名')
  }
}

/* ------------------------------------------------ empty-state rendering */
snapshotMode = 'empty'
{
  // 通过真实导航按钮回到首页（今日简报是第 1 项），再点「刷新」让 Host 返回空快照
  const navTree = await renderTree('空态·导航')
  const nav = findNavButtons(navTree, [])
  if (nav.length > 0) nav[0].props.onClick()
  await renderTree('空态·回到首页')
  const refresh = findButtons(await renderTree('空态·找刷新'), []).find((button) => button.text.indexOf('刷新') >= 0)
  if (refresh) refresh.onClick()
  else problems.push('空态场景没有找到「刷新」按钮')
  const tree = await renderTree('空态·今日简报')
  const text = treeText(tree).replace(/\s+/g, ' ')
  const size = countNodes(tree)
  if (size < 60) problems.push('空态首页渲染节点过少：' + size)
  for (const marker of ['还没有待办', '技术雷达还没有内容', '抓取资讯', '手动添加资讯', '新建第一条待办']) {
    if (text.indexOf(marker) < 0) problems.push('空态首页缺少「' + marker + '」')
  }
  // 空态下雷达头部不应再渲染筛选 Chip（用户反馈 #2：头部信息在空态是冗余）
  if (text.indexOf('仅看关注主题') >= 0) problems.push('空态雷达头部不应出现「仅看关注主题」筛选')
  // 空态下不应出现上次抓取副标题
  if (text.indexOf('上次抓取') >= 0) problems.push('空态雷达头部不应出现「上次抓取」')
  // 空态且无 @我 记录时不应渲染横幅（toast 与连接器提示都可能合法含「云之家/@我」，用横幅专属按钮断言）
  if (text.indexOf('再拉一次') >= 0) problems.push('无 @我 记录时不应出现云之家横幅')
}
snapshotMode = 'full'
{
  const navTree = await renderTree('空态后·导航')
  const nav = findNavButtons(navTree, [])
  if (nav.length > 0) nav[0].props.onClick()
  await renderTree('空态后·恢复')
}

/* ------------------------------------------------- descriptor cross-check */
// The gateway STRICTLY validates arg fields against the descriptor: an extra
// field fails with `args fields do not match the descriptor: unexpected "x"`.
// That is how `workbench/fetchRadar` broke in the shipped UI — the client sent
// {request:{}} against a zero-param descriptor. Parse the host's signature
// table (single source of truth) and verify every recorded call matches.
const remoteSource = readFileSync(new URL('../src/host/40-remote.js', import.meta.url), 'utf8')
const descriptorParams = new Map()
for (const match of remoteSource.matchAll(/\{ method: '(\w+)', params: \[([^\]]*)\] \}/g)) {
  descriptorParams.set(match[1], [...match[2].matchAll(/'(\w+)'/g)].map((p) => p[1]).sort())
}
for (const call of rpcCalls) {
  const method = call.endpoint.replace(/^workbench\//, '')
  const expected = descriptorParams.get(method)
  if (!expected) {
    problems.push('RPC 调用了未声明的端点：' + call.endpoint)
    continue
  }
  const keys = Object.keys(call.args).sort()
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    problems.push(call.endpoint + ' 参数不匹配：客户端发送 ' + JSON.stringify(keys) + '，描述符声明 ' + JSON.stringify(expected))
  }
}
if (!rpcCalls.some((call) => call.endpoint === 'workbench/fetchRadar')) {
  problems.push('没有真实驱动 workbench/fetchRadar（抓取资讯）')
}
if (!rpcCalls.some((call) => call.endpoint === 'workbench/fetchMentions')) {
  problems.push('没有真实驱动 workbench/fetchMentions（再拉一次）')
}

/* ------------------------------------------------------------- report */
console.log('client-render 结果')
rendered.forEach(function (item) {
  console.log('  · ' + item.label + ' → ' + item.nodes + ' 节点  | ' + item.sample)
})
console.log('  注册：main=' + registrations.main.length + ' panellist=' + registrations.panellist.length)
console.log('  RPC 调用：' + Array.from(new Set(rpcCalls.map((c) => c.endpoint))).join(', '))
console.log('  渲染到的页面状态：' + Array.from(new Set(seenPages)).join(', '))

if (problems.length) {
  console.error('\n失败 ' + problems.length + ' 项：')
  problems.forEach(function (item) {
    console.error('  - ' + item)
  })
  process.exit(1)
}
console.log('\nclient-render: 全部页面首屏渲染通过')
