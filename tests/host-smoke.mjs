/**
 * host-smoke.mjs — exercises the Host half outside DSH.
 *
 * Loads the built index.js, mounts it on a minimal Cordis-like context, and
 * drives the same service methods the Remote endpoints call. Runs against a
 * throwaway $DSH_HOME so it never touches the real profile state.
 *
 *   node tests/host-smoke.mjs
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const home = mkdtempSync(join(tmpdir(), 'wb-test-'))
process.env.DSH_HOME = home

const { apply } = await import('../index.js')

const services = {}
const tools = []
let remoteContribution = null
let webMock = null
let yzjSpawner = null
const ctx = {
  provide(name, value) {
    services[name] = value
  },
  inject(deps, callback) {
    if (deps.includes('typert')) {
      callback({
        typert: {
          register: (contribution) => {
            remoteContribution = contribution
            return () => {}
          },
        },
      })
    }
    if (deps.includes('tools')) {
      callback({ tools: { register: (definition) => (tools.push(definition), () => tools.splice(tools.indexOf(definition), 1)) } })
    }
  },
  effect(fn) {
    return fn()
  },
  get(name) {
    if (name === 'web' && webMock) return webMock
    if (name === 'subprocess' && yzjSpawner) return yzjSpawner
    return undefined
  },
  logger: { info() {} },
}

apply(ctx, {})

const api = services.workbench

const checks = []
function check(label, condition, detail) {
  checks.push({ label, ok: !!condition, detail })
  if (!condition) console.error('  FAIL ' + label + (detail ? ' — ' + detail : ''))
}

/* ---------------------------------------------------------------------------
 * Gateway binding replication — the exact checks typertGateway performs when
 * the Client calls workbench/<method>. Before the typertRemote property
 * existed this failed in the shipped UI with
 *   gateway/binding-invalid: Service "workbench" has no visible typertRemote
 *   binding
 * while the smoke test stayed green, because it asserted the descriptor table
 * but never the binding the gateway actually reads.
 * ------------------------------------------------------------------------- */
const original = api // ctx.get('workbench') returns this object (no Context view in a stub)
const binding = Reflect.get(original, 'typertRemote')
check('网关绑定存在：typertRemote', binding !== undefined, '缺少 typertRemote 属性——网关将抛 gateway/binding-invalid')
if (binding !== undefined) {
  const isObject = (v) => v !== null && typeof v === 'object'
  check(
    '网关绑定一致（service 恒等 / serviceKey / namespace）',
    isObject(binding) &&
      Reflect.get(binding, 'service') === original &&
      Reflect.get(binding, 'serviceKey') === 'workbench' &&
      typeof Reflect.get(binding, 'namespace') === 'string' &&
      Reflect.get(binding, 'namespace') === 'workbench',
    JSON.stringify({ serviceKey: Reflect.get(binding, 'serviceKey'), namespace: Reflect.get(binding, 'namespace') }),
  )
}

let state = await api.snapshot()
check('首次快照为空任务', state.tasks.length === 0)
check('默认关注主题存在', state.settings.topics.length > 0)

state = await api.createTask({ title: '验证 Host 链路', priority: 'high', tags: ['test'] })
check('创建待办', state.tasks.length === 1 && state.tasks[0].title === '验证 Host 链路')
const taskId = state.tasks[0].id
check('优先级写入', state.tasks[0].priority === 'high')

state = await api.updateTask(taskId, { status: 'completed' })
check('状态更新为完成', state.tasks[0].status === 'completed')
check('完成时间写入', !!state.tasks[0].completedAt)

state = await api.updateTask(taskId, { status: 'ready' })
check('重开清空完成时间', state.tasks[0].completedAt === null)

try {
  await api.createTask({})
  check('空标题被拒绝', false)
} catch (e) {
  check('空标题被拒绝', /标题/.test(e.message))
}

state = await api.addSource({ provider: 'test', title: '来源 A', excerpt: '原文' })
check('新增来源', state.sources.length === 1)
const firstSourceId = state.sources[0].id
state = await api.addSource({ provider: 'test', title: '来源 A', excerpt: '原文' })
check('来源按指纹去重', state.sources.length === 1 && state.sources[0].id === firstSourceId)

state = await api.saveRadarItem({ title: '资讯 A', url: 'https://example.com/a', topics: ['RAG'] })
check('新增雷达条目', state.radar.length === 1)
state = await api.saveRadarItem({ title: '资讯 A 改名', url: 'https://example.com/a' })
check('雷达按 URL 幂等更新', state.radar.length === 1 && state.radar[0].title === '资讯 A 改名')

state = await api.createKnowledge({ kind: 'note', title: '笔记 A', body: '正文', tags: ['x'] })
check('新增知识', state.knowledge.length === 1)

state = await api.recordRun({ taskId, status: 'completed', summary: '跑通了', profile: 'Coding Agent' })
check('登记执行记录', state.runs.length === 1)
check('执行记录写回任务', state.tasks.find((t) => t.id === taskId).runIds.length === 1)

try {
  await api.recordRun({ taskId: 'missing', status: 'completed', summary: 'x' })
  check('关联不存在的待办被拒绝', false)
} catch (e) {
  check('关联不存在的待办被拒绝', /不存在/.test(e.message))
}

state = await api.reset('all')
check('重置清空业务数据', state.tasks.length === 0 && state.runs.length === 0 && state.knowledge.length === 0)
check('重置保留设置', state.settings.topics.length > 0)

state = await api.seedDemo()
check('示例数据包含待办', state.tasks.length >= 3)
check('示例数据带来源证据', state.sources.length >= 1)
state = await api.seedDemo()
check('示例数据不重复叠加', state.tasks.length === 3, '实际 ' + state.tasks.length)

const diag = await api.diagnostics()
check('诊断返回数据路径', typeof diag.dataPath === 'string' && diag.dataPath.indexOf('dev-workbench') >= 0)
check('诊断统计到任务', diag.counts.tasks === 3)
check('注册了 7 个 Agent 工具', tools.length === 7, '实际 ' + tools.length)
check('包含 workbench_fetch_radar 工具', tools.some((tool) => tool.name === 'workbench_fetch_radar'))
check('包含 workbench_fetch_mentions 工具', tools.some((tool) => tool.name === 'workbench_fetch_mentions'))

// Remote 描述符必须与 service 方法一一对应，否则客户端会打到不存在的端点
const invocations = (remoteContribution && remoteContribution.invocations) || []
check('注册了 22 个 Remote 描述符', invocations.length === 22, '实际 ' + invocations.length)
const missing = invocations.filter((entry) => typeof api[entry.method] !== 'function')
check('每个描述符都有对应方法', missing.length === 0, missing.map((entry) => entry.method).join(', '))
check('描述符 id 带包名前缀', invocations.every((entry) => entry.id.indexOf('dsh-dev-workbench#workbench/') === 0))
check(
  'search / environment / fetchRadar / fetchMentions / createTaskFromRadar 已暴露',
  ['search', 'environment', 'fetchRadar', 'fetchMentions', 'createTaskFromRadar'].every((name) => invocations.some((e) => e.method === name)),
)

// 统一搜索：本地分组命中，web 缺席时降级为 unavailable
const found = await api.search({ query: '限流' })
check('搜索返回分组', Array.isArray(found.groups) && found.groups.length >= 4)
const taskGroup = found.groups.find((group) => group.id === 'tasks')
check('搜索命中待办', !!taskGroup && taskGroup.status === 'ok' && taskGroup.items.length >= 1, JSON.stringify(taskGroup && taskGroup.status))
const webGroup = found.groups.find((group) => group.id === 'web')
check('无 web 服务时降级', !!webGroup && webGroup.status === 'unavailable', webGroup && webGroup.status)
let searchRejected = false
try {
  await api.search({ query: '' })
} catch (e) {
  searchRejected = /关键词/.test(e.message)
}
check('空关键词被拒绝', searchRejected)

// 研发协作：没有 subprocess 时如实报告 unavailable，而不是空表格
const env = await api.environment()
check('环境探测返回 git 列表', Array.isArray(env.git) && env.git.length >= 1)
check('无 git 时状态为 unavailable', env.git.every((repo) => repo.status === 'unavailable'), JSON.stringify(env.git.map((r) => r.status)))
check('docker 状态如实报告', !!env.docker && (env.docker.status === 'unavailable' || env.docker.status === 'ok'))
check('环境探测标明只读', typeof env.note === 'string' && env.note.indexOf('只读') >= 0)

// 项目 CRUD：让「研发协作」有目录可探测
let projState = await api.saveProject({ name: '网关限流', repoPath: '/tmp/wb-gateway' })
const project = projState.projects.find((item) => item.repoPath === '/tmp/wb-gateway')
check('新增项目', !!project && project.name === '网关限流')
projState = await api.saveProject({ repoPath: '/tmp/wb-gateway' })
check('按仓库目录幂等', projState.projects.filter((item) => item.repoPath === '/tmp/wb-gateway').length === 1)
let projectRejected = false
try {
  await api.saveProject({ name: '没有目录' })
} catch (e) {
  projectRejected = /仓库目录/.test(e.message)
}
check('缺少仓库目录被拒绝', projectRejected)
const linkedTask = projState.tasks[0]
await api.updateTask(linkedTask.id, { projectId: project.id })
projState = await api.deleteProject(project.id)
check('删除项目', !projState.projects.some((item) => item.id === project.id))
check('删除项目后任务解绑', projState.tasks.find((item) => item.id === linkedTask.id).projectId === null)

// 技术雷达抓取：逐源降级、按 URL 去重、报告落库
const FAKE_RSS = [
  '<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>',
  '<item><title><![CDATA[Pratt parsing 写作]]></title>',
  '<description><![CDATA[<p>关于 pratt parsing 的长文。</p>]]></description>',
  '<pubDate>Tue, 27 Oct 2026 06:02:23 +0000</pubDate>',
  '<link>https://example.com/pratt</link></item>',
  '<item><title>SQLite WAL 实践</title>',
  '<description>如何调参。</description>',
  '<pubDate>Mon, 26 Oct 2026 10:00:00 +0000</pubDate>',
  '<link>https://example.com/sqlite-wal</link></item>',
  '</channel></rss>',
].join('')

webMock = {
  fetch(request) {
    if (String(request.url).indexOf('bad') >= 0) {
      return Promise.reject(new Error('connection refused'))
    }
    if (String(request.url).indexOf('blocked') >= 0) {
      return Promise.resolve({ statusCode: 403, url: request.url, body: { kind: 'text', content: '' } })
    }
    return Promise.resolve({ statusCode: 200, url: request.url, body: { kind: 'text', content: FAKE_RSS } })
  },
}

await api.saveSettings({
  feeds: [
    { id: 'feed-good', label: '好源', url: 'https://example.com/good.xml', topics: ['LLM'] },
    { id: 'feed-bad', label: '坏源', url: 'https://example.com/bad.xml' },
    { id: 'feed-blocked', label: '被拦源', url: 'https://example.com/blocked.xml' },
  ],
})
const radarBefore = (await api.snapshot()).radar.length
state = await api.fetchRadar()
check('抓取写入雷达', state.radar.length === radarBefore + 2, '实际新增 ' + (state.radar.length - radarBefore))
const goodRow = state.lastRadarFetch.perFeed.find((row) => row.id === 'feed-good')
const badRow = state.lastRadarFetch.perFeed.find((row) => row.id === 'feed-bad')
const blockedRow = state.lastRadarFetch.perFeed.find((row) => row.id === 'feed-blocked')
check('好源状态 ok 且新增 2', !!goodRow && goodRow.status === 'ok' && goodRow.added === 2, JSON.stringify(goodRow))
check('网络失败降级为 error', !!badRow && badRow.status === 'error' && /connection refused/.test(badRow.note || ''), JSON.stringify(badRow))
check('HTTP 403 降级为 error', !!blockedRow && blockedRow.status === 'error' && /403/.test(blockedRow.note || ''), JSON.stringify(blockedRow))
check('抓取条目保留原文摘录', state.radar.some((item) => item.url === 'https://example.com/pratt' && item.excerpt.indexOf('pratt parsing') >= 0))
const fetchedItems = state.radar.filter((item) => String(item.url || '').indexOf('https://example.com/') === 0)
check('抓取条目四段摘要留空（不伪装 AI 摘要）', fetchedItems.length === 2 && fetchedItems.every((item) => !item.summary.change && !item.summary.usage && !item.summary.risk && !item.summary.practice))

state = await api.fetchRadar()
check('重复抓取按 URL 去重', state.lastRadarFetch.added === 0 && state.radar.length === radarBefore + 2)

// 从资讯生成实践任务：原子地建来源 + 任务，重复生成幂等
const practiceSource = state.radar.find((item) => item.url === 'https://example.com/pratt')
const tasksBeforePractice = state.tasks.length
const sourcesBeforePractice = state.sources.length
state = await api.createTaskFromRadar(practiceSource.id)
const practiceTask = state.tasks.find((task) => task.title === '实践：Pratt parsing 写作')
check('生成实践任务', !!practiceTask && state.tasks.length === tasksBeforePractice + 1)
check('实践任务带来源证据', !!practiceTask && !!practiceTask.sourceRefId)
check('来源证据落库', state.sources.length === sourcesBeforePractice + 1)
state = await api.createTaskFromRadar(practiceSource.id)
check('重复生成幂等', state.tasks.length === tasksBeforePractice + 1 && state.sources.length === sourcesBeforePractice + 1)
try {
  await api.createTaskFromRadar('missing-id')
  check('不存在的资讯被拒绝', false)
} catch (e) {
  check('不存在的资讯被拒绝', /找不到该资讯/.test(e.message))
}

// 空资讯源：如实报告而不是假抓取
await api.saveSettings({ feeds: [] })
state = await api.fetchRadar()
check('空资讯源如实报告', !!(state.lastRadarFetch && state.lastRadarFetch.note && state.lastRadarFetch.note.indexOf('资讯源') >= 0))

// ---- 云之家 @我 拉取：模拟 whoami + im message search ----
const WHOAMI = {
  success: true,
  data: {
    name: '测试用户',
    openId: 'open-me-0001',
    expiresAt: '2099-01-01T00:00:00+08:00',
    status: 1,
  },
}
const MENTION_SEARCH = {
  success: true,
  data: {
    list: [
      {
        group: { groupId: 'g1', groupName: '网关组' },
        messages: [
          {
            message: {
              msgId: 'm1',
              content: '@测试用户 帮我看下限流阈值',
              fromOpenId: 'other-1',
              sendTime: '2026-10-27 10:00:00',
              param: { notifyType: 1, desc: [{ type: 'at', data: 'open-me-0001', start: 0, length: 4 }] },
            },
          },
          {
            message: {
              msgId: 'm2',
              content: '普通消息，没有@',
              fromOpenId: 'other-1',
              sendTime: '2026-10-27 10:05:00',
              param: null,
            },
          },
          {
            message: {
              msgId: 'm3',
              content: '@测试用户 我自己发的',
              fromOpenId: 'open-me-0001',
              sendTime: '2026-10-27 10:06:00',
              param: { notifyType: 1 },
            },
          },
        ],
      },
    ],
  },
}
const DOC_SEARCH = {
  success: true,
  data: {
    list: [
      { id: 'd1', fileName: '限流方案.otl', kbName: '研发知识库', creatorName: '张三', openWebUrl: null },
      { id: 'd2', fileName: '压测报告.docx', kbName: '研发知识库', creatorName: '李四', openWebUrl: 'https://yunzhijia.com/doc/d2' },
    ],
  },
}

function makeYzjSpawner(mentionJson, docJson) {
  const spawn = (spec) => {
    const cmdline = spec.argv.join(' ')
    const stdoutOf = () => {
      if (/whoami/.test(cmdline)) return JSON.stringify(WHOAMI)
      if (/im\s+message\s+search/.test(cmdline)) return JSON.stringify(mentionJson)
      if (/doc\s+search/.test(cmdline)) return JSON.stringify(docJson)
      return JSON.stringify({ success: true, data: {} })
    }
    const text = stdoutOf()
    return {
      collected: {
        stdout: { readFrom: () => ({ text, nextOffset: text.length, lossy: false }) },
        stderr: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) },
      },
      done: Promise.resolve({ exitCode: 0, signal: null }),
      terminate() {},
    }
  }
  return { spawn, resolveExecutable: () => Promise.resolve('/fake/yzj-cli') }
}

// 未配置 CLI：provider 存在但解析与执行都失败（也阻断文件扫描），如实降级
yzjSpawner = {
  spawn() { throw new Error('no binary') },
  resolveExecutable() { throw new Error('not found') },
}
state = await api.fetchMentions()
check('无 yzj-cli 时 @我 如实降级', state.lastMentionsFetch && state.lastMentionsFetch.status !== 'ok' && !!state.lastMentionsFetch.note, JSON.stringify(state.lastMentionsFetch))

// 有 CLI：只采 notifyType/desc 命中且非自己发的
yzjSpawner = makeYzjSpawner(MENTION_SEARCH, DOC_SEARCH)
state = await api.fetchMentions()
const yzjSources = state.sources.filter((row) => String(row.externalId || '').indexOf('yzj:msg:') === 0)
check('@我 拉取只采真@消息', yzjSources.length === 1 && yzjSources[0].externalId === 'yzj:msg:m1', JSON.stringify(yzjSources.map((r) => r.externalId)))
check('@我 来源带原文与群名', yzjSources[0].excerpt.indexOf('限流') >= 0 && yzjSources[0].title.indexOf('网关组') >= 0)
check('@我 报告记录用户与数量', state.lastMentionsFetch.user === '测试用户' && state.lastMentionsFetch.added === 1)
state = await api.fetchMentions()
check('@我 重复拉取去重', state.lastMentionsFetch.added === 0 && state.sources.filter((r) => String(r.externalId || '').indexOf('yzj:msg:') === 0).length === 1)

// 企业搜索：消息+文档两路
const entResult = await api.search({ query: '限流' })
const entGroup = entResult.groups.find((group) => group.id === 'enterprise')
check('企业搜索路存在且可用', !!entGroup && entGroup.status === 'ok', JSON.stringify(entGroup && entGroup.status))
check('企业搜索含文档结果', entGroup.items.some((item) => item.id === 'yzj-doc-d1'))
check('企业搜索不构造空 URL', entGroup.items.every((item) => item.kind !== 'knowledge' || item.url !== null || item.id === 'yzj-doc-d1'))

// CLI 未认证：企业路如实降级
yzjSpawner = makeYzjSpawner({ success: false, errorCode: 10000400 }, DOC_SEARCH)
state = await api.fetchMentions()
check('token 失效时 @我 报告 unauthorized', state.lastMentionsFetch.status === 'unauthorized')
const entFail = await api.search({ query: '限流' })
const entFailGroup = entFail.groups.find((group) => group.id === 'enterprise')
// whoami 失败但文档路仍可用：企业组照常返回文档结果，note 里如实记下消息路失败
check(
  'token 失效时企业路如实分路报告',
  entFailGroup.items.every((item) => item.id.indexOf('yzj-doc-') === 0) && /消息一路失败/.test(entFailGroup.note || ''),
  JSON.stringify({ status: entFailGroup.status, note: entFailGroup.note }),
)

yzjSpawner = null

// 落盘后重新读取：验证持久化（对比重载前后的记录数，不写死数字）
const preReload = await api.snapshot()
const tasksBeforeReload = preReload.tasks.length
const radarBeforeReload = preReload.radar.length
const { apply: applyAgain } = await import('../index.js?reload=' + Date.now())
services.workbench = null
const fresh = {}
applyAgain({
  provide: (name, value) => (fresh[name] = value),
  inject: () => {},
  effect: (fn) => fn(),
  get: () => undefined,
  logger: { info() {} },
})
const reloaded = await fresh.workbench.snapshot()
check('重启后数据仍在', reloaded.tasks.length === tasksBeforeReload && reloaded.radar.length === radarBeforeReload, '任务 ' + reloaded.tasks.length + '/' + tasksBeforeReload + '，雷达 ' + reloaded.radar.length + '/' + radarBeforeReload)

const failed = checks.filter((item) => !item.ok)
console.log(
  'host-smoke: ' +
    (checks.length - failed.length) +
    '/' +
    checks.length +
    ' 通过' +
    (failed.length ? '（' + failed.length + ' 失败）' : ''),
)
rmSync(home, { recursive: true, force: true })
process.exit(failed.length ? 1 : 0)
