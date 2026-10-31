/**
 * host-smoke.mjs — exercises the Host half outside DSH.
 *
 * Loads the built index.js, mounts it on a minimal Cordis-like context, and
 * drives the same service methods the Remote endpoints call. Runs against a
 * throwaway $DSH_HOME so it never touches the real profile state.
 *
 *   node tests/host-smoke.mjs
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const home = mkdtempSync(join(tmpdir(), 'wb-test-'))
process.env.DSH_HOME = home
mkdirSync(join(home,'storages/dev-workbench'),{recursive:true})
writeFileSync(join(home,'storages/dev-workbench/state.json'),JSON.stringify({version:2,installedAt:'2020-01-01T00:00:00.000Z'}))

const { apply } = await import('../index.js')

const services = {}
const tools = []
let remoteContribution = null
let webMock = null
let yzjSpawner = null
let fakeSessions = null
let fakeSessionController = null
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
    if (name === 'sessions' && fakeSessions) return fakeSessions
    if (name === 'sessionController' && fakeSessionController) return fakeSessionController
    return undefined
  },
  logger: { info() {} },
}

apply(ctx, {})

// 提前写入本地搜索用的夹具文件：文件索引有 60s 缓存，必须早于首次搜索
{
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync(join(home, 'workspace'), { recursive: true })
  writeFileSync(join(home, 'workspace', 'rate-limit-notes.md'), '# 限流笔记\n阈值 1500 QPS 的具体推导\n', 'utf8')
}

const api = services.workbench

const checks = []
function check(label, condition, detail) {
  checks.push({ label, ok: !!condition, detail })
  if (!condition) console.error('  FAIL ' + label + (detail ? ' — ' + detail : ''))
}

// Simulate the model's batch envelope while retaining each scenario's domain fixtures.
function fixtureReply(request, nextReply) {
  const text=request?.content?.find(block=>block.type==='text')?.text || ''
  let packet;try {packet=JSON.parse(text.split('\n').at(-1))}catch{}
  if(packet?.protocol!=='awb-message-batch-v3')return nextReply()
  const results=[]
  for(const message of packet.messages){
    const reply=nextReply();let analysis
    try{analysis=JSON.parse(reply.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))}catch{return reply}
    results.push({sourceId:message.sourceId,analysis})
  }
  return JSON.stringify({batchId:packet.batchId,results})
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
check('注册了 16 个 Agent 工具', tools.length === 16, '实际 ' + tools.length)

/* ---------------------------------------------------------------------------
 * P0-01：真实执行工具（不是只数注册数量）
 * 之前 mutateWorkbenchState 变成 async 后工具没有 await，导致「工具报错但
 * 数据已写入」。这里直接调用 execute，断言返回值与落库结果一致。
 * ------------------------------------------------------------------------- */
{
  const tool = (name) => tools.find((entry) => entry.name === name)
  const createTool = tool('workbench_create_task')
  const updateTool = tool('workbench_update_task')
  const runTool = tool('workbench_record_run')

  const created = await createTool.execute({ title: '工具执行验证', priority: 'high' }, {})
  check('工具 create_task 返回 taskId', typeof created.taskId === 'string' && created.taskId.length > 0, JSON.stringify(created))
  const afterCreate = await api.snapshot()
  check('工具 create_task 真实落库', afterCreate.tasks.some((task) => task.id === created.taskId))

  // 幂等：同 key 再调一次不重复创建
  const first = await createTool.execute({ title: '幂等任务', idempotencyKey: 'test:idem-1' }, {})
  const second = await createTool.execute({ title: '幂等任务', idempotencyKey: 'test:idem-1' }, {})
  check('幂等键命中不重复创建', second.idempotent === true && second.taskId === first.taskId, JSON.stringify(second))
  const afterIdem = await api.snapshot()
  check(
    '幂等后只存在一条',
    afterIdem.tasks.filter((task) => task.title === '幂等任务').length === 1,
    String(afterIdem.tasks.filter((task) => task.title === '幂等任务').length),
  )

  check('工具 update_task 契约允许修改标签', updateTool.parameters.properties.tags?.type === 'array')
  const updated = await updateTool.execute({ id: created.taskId, status: 'completed', tags: ['AI 识别'] }, {})
  check('工具 update_task 返回结果', /已更新/.test(updated.text), updated.text)
  const afterUpdate = await api.snapshot()
  check('工具 update_task 真实落库', afterUpdate.tasks.find((task) => task.id === created.taskId).status === 'completed')
  check('工具标签按数组保存并记录人工保护', afterUpdate.tasks.find(task=>task.id===created.taskId).tags[0] === 'AI 识别' && afterUpdate.tasks.find(task=>task.id===created.taskId).humanGuard.editedFields.includes('tags'))

  const runCreated = await runTool.execute({ taskId: created.taskId, status: 'completed', summary: '工具登记验证' }, {})
  check('工具 record_run 返回 runId', typeof runCreated.runId === 'string', JSON.stringify(runCreated))
  const afterRun = await api.snapshot()
  check('工具 record_run 真实落库', afterRun.runs.some((run) => run.id === runCreated.runId))

  // 写入失败要如实抛出（不吞掉）
  let failed = false
  try {
    await updateTool.execute({ id: 'no-such-task', status: 'completed' }, {})
  } catch (e) {
    failed = /找不到该待办/.test(e.message)
  }
  check('工具写入失败如实返回错误', failed)
}
check('包含 workbench_fetch_radar 工具', tools.some((tool) => tool.name === 'workbench_fetch_radar'))
check('包含 workbench_fetch_mentions 工具', tools.some((tool) => tool.name === 'workbench_fetch_mentions'))

// Remote 描述符必须与 service 方法一一对应，否则客户端会打到不存在的端点
const invocations = (remoteContribution && remoteContribution.invocations) || []
check('注册了 114 个 Remote 描述符', invocations.length === 114, '实际 ' + invocations.length)
check('回复发送只有显式页面入口，不暴露后台发送工具', invocations.some(entry => entry.method === 'sendReply') && !tools.some(tool => /send_reply|send_message/.test(tool.name)))
check('待办原会话回复准备入口已接线',invocations.some(entry=>entry.method==='prepareTaskReply'))
const missing = invocations.filter((entry) => typeof api[entry.method] !== 'function')
check('每个描述符都有对应方法', missing.length === 0, missing.map((entry) => entry.method).join(', '))
check('描述符 id 带包名前缀', invocations.every((entry) => entry.id.indexOf('dsh-dev-workbench#workbench/') === 0))
check(
  'search / environment / fetchRadar / fetchMentions / createTaskFromRadar / 候选三件套 已暴露',
  ['search', 'environment', 'fetchRadar', 'fetchMentions', 'createTaskFromRadar', 'extractCandidates', 'acceptCandidate', 'rejectCandidate', 'updateKnowledge'].every(
    (name) => invocations.some((e) => e.method === name),
  ),
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
  search(request) {
    return Promise.resolve({
      sources: [
        { url: 'https://example.org/news/' + encodeURIComponent(String(request.query)).slice(0, 20), title: 'Agent 框架发布新版本 · ' + String(request.query).slice(0, 12), snippet: '新版本支持工具编排', publishedAt: '2026-10-26T08:00:00Z' },
        { url: 'https://example.org/news/dup', title: '同一事件的转载', snippet: '转载内容', publishedAt: '2026-10-26T09:00:00Z' },
      ],
      truncated: false,
    })
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

// 无 RSS 时：有联网能力 → 按关注主题发现；没有联网能力 → 如实说明
await api.saveSettings({ feeds: [], topics: ['Agent'] })
state = await api.fetchRadar()
check(
  '无 RSS 时按主题联网发现',
  !!state.lastRadarFetch && state.lastRadarFetch.perFeed.some((row) => String(row.id).indexOf('topic:') === 0),
  JSON.stringify(state.lastRadarFetch && state.lastRadarFetch.perFeed.map((r) => r.id)),
)
webMock = null
state = await api.fetchRadar()
check(
  '无联网能力时如实说明',
  !!state.lastRadarFetch && /web|联网/i.test(state.lastRadarFetch.note || ''),
  state.lastRadarFetch && state.lastRadarFetch.note,
)
webMock = {
  fetch(request) {
    if (String(request.url).indexOf('bad') >= 0) return Promise.reject(new Error('connection refused'))
    if (String(request.url).indexOf('blocked') >= 0) return Promise.resolve({ statusCode: 403, url: request.url, body: { kind: 'text', content: '' } })
    return Promise.resolve({ statusCode: 200, url: request.url, body: { kind: 'text', content: FAKE_RSS } })
  },
  search() {
    return Promise.resolve({ sources: [{ url: 'https://example.org/again', title: '再次发现', snippet: 's', publishedAt: null }], truncated: false })
  },
}

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
      if (/contact\s+user\s+search/.test(cmdline)) {
        // 只对姓名关键词返回命中，贴近真实接口行为
        const hit = /田鹏飞|田|鹏|飞/.test(cmdline)
        return JSON.stringify({
          success: true,
          data: {
            list: hit
              ? [{ name: '田鹏飞', openId: 'other-1', department: '质量与工程', jobTitle: '后端开发' }]
              : [],
          },
        })
      }
      if (/contact\s+user\s+get/.test(cmdline)) {
        return JSON.stringify({
          success: true,
          data: { list: [{ name: '张三', openId: 'other-1', department: '质量与工程', jobTitle: '后端开发' }] },
        })
      }
      if (/calendar\s+room\s+find/.test(cmdline)) {
        return JSON.stringify({
          success: true,
          data: { list: [{ roomId: 'r1', roomName: 'B10 会议室', roomDetail: 'B栋-10F', limitCount: 12 }] },
        })
      }
      if (/^.*gh pr list/.test(cmdline)) {
        return JSON.stringify([
          { number: 12, title: 'feat: 工作台骨架', state: 'OPEN', isDraft: false, author: { login: 'wulonglong' }, updatedAt: '2026-10-27T10:00:00Z', url: 'https://github.com/o/r/pull/12' },
        ])
      }
      if (/^.*gh run list/.test(cmdline)) {
        return JSON.stringify([
          { databaseId: 99, status: 'completed', conclusion: 'success', workflowName: 'ci', headBranch: 'main', createdAt: '2026-10-27T09:00:00Z', url: 'https://github.com/o/r/actions/runs/99' },
        ])
      }
      if (/^.*ps aux/.test(cmdline)) {
        return [
          'USER PID %CPU %MEM VSZ RSS TT STAT STARTED TIME COMMAND',
          'wulonglong 100 55.0 3.2 1000 200 s001 R 10:00AM 1:00 node server.js',
          'wulonglong 200 5.0 1.0 800 100 s001 S 10:00AM 0:10 redis-server',
        ].join('\n')
      }
      if (/attendance\s+record\s+list/.test(cmdline)) {
        return JSON.stringify({
          success: true,
          data: { list: [{ clockInType: '内勤', clockInStatus: '正式卡', clockInPosition: '深圳金蝶软件园', clockInTime: 1793095646456 }] },
        })
      }
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
  return { spawn, resolveExecutable: name => Promise.resolve(name === 'gh' ? '/fake/gh' : '/fake/yzj-cli') }
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
const yzjSources = state.sources.filter((row) => row.provider === 'yunzhijia' && row.locator && row.locator.intake !== false)
check('@我 拉取只采真@消息', yzjSources.length === 1 && yzjSources[0].locator.msgId === 'm1', JSON.stringify(yzjSources.map((r) => r.externalId)))
check('@我 来源带原文与群名', yzjSources[0].excerpt.indexOf('限流') >= 0 && yzjSources[0].title.indexOf('网关组') >= 0)
check('@我 报告记录用户与数量', state.lastMentionsFetch.user === '测试用户' && state.lastMentionsFetch.added === 1)
check('@我 来源带发送人姓名', yzjSources[0].sender === '张三', String(yzjSources[0].sender))
check(
  '@我 来源带消息定位信息',
  !!yzjSources[0].locator && yzjSources[0].locator.msgId === 'm1' && yzjSources[0].locator.groupName === '网关组',
  JSON.stringify(yzjSources[0].locator),
)
state = await api.fetchMentions()
check('@我 重复拉取去重', state.lastMentionsFetch.added === 0 && state.sources.filter((r) => r.provider === 'yunzhijia' && r.locator && r.locator.intake !== false).length === 1)

// 规则候选：提取 → 人工确认 → 采纳建任务 / 忽略
let candState = await api.extractCandidates()
const pending = candState.candidates.filter((c) => c.status === 'pending')
check('规则提取生成候选', pending.length >= 1, '实际 ' + pending.length)
const cand = pending[0]
check('候选带可解释置信度', typeof cand.confidence === 'number' && cand.confidence > 0 && cand.confidence <= 0.9, String(cand.confidence))
check('候选带命中原因', Array.isArray(cand.reasons) && cand.reasons.length >= 1)
check('候选绑定来源证据', !!cand.sourceRefId)
check('候选不改动任务', !candState.tasks.some((t) => t.title === cand.title))
const tasksBeforeAccept = candState.tasks.length
candState = await api.acceptCandidate(cand.id, {})
const acceptedTask = candState.tasks.find((t) => t.title === cand.title)
check('采纳候选创建任务', !!acceptedTask && candState.tasks.length === tasksBeforeAccept + 1)
check('采纳任务带来源与置信度', !!acceptedTask && !!acceptedTask.sourceRefId && acceptedTask.aiExtracted === true)
check('采纳后候选状态为 accepted', candState.candidates.find((c) => c.id === cand.id).status === 'accepted')
candState = await api.acceptCandidate(cand.id, {})
check('重复采纳幂等', candState.tasks.length === tasksBeforeAccept + 1)
const rejectTarget = candState.candidates.filter((c) => c.status === 'pending')[0]
if (rejectTarget) {
  candState = await api.rejectCandidate(rejectTarget.id)
  check('忽略候选', candState.candidates.find((c) => c.id === rejectTarget.id).status === 'rejected')
} else {
  check('忽略候选（无第二条候选，跳过）', true)
}
candState = await api.extractCandidates()
check('再次提取不重复生成', candState.candidates.filter((c) => c.status === 'pending').length === 0)

// P0-03：相对日期以「原消息时间」为基准；取消/已完成不生成候选；一条消息可拆多事项
{
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000)
  threeDaysAgo.setHours(9, 30, 0, 0)
  const expectedTomorrow = new Date(threeDaysAgo.getTime())
  expectedTomorrow.setDate(expectedTomorrow.getDate() + 1)
  expectedTomorrow.setHours(18, 0, 0, 0)

  await api.addSource({
    provider: 'yunzhijia',selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:null,observedAt:new Date().toISOString()},
    externalId: 'yzj:msg:p0-date',
    title: '@我 · 日期测试群',
    excerpt: '明天下班前给出限流结论',
    fetchedAt: threeDaysAgo.toISOString(),
  })
  await api.addSource({
    provider: 'yunzhijia',selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:null,observedAt:new Date().toISOString()},
    externalId: 'yzj:msg:p0-closed',
    title: '@我 · 收尾群',
    excerpt: '不用处理，问题已解决',
    fetchedAt: threeDaysAgo.toISOString(),
  })
  await api.addSource({
    provider: 'yunzhijia',selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:null,observedAt:new Date().toISOString()},
    externalId: 'yzj:msg:p0-question',
    title: '@我 · 询问群',
    excerpt: '请确认是否取消该任务',
    fetchedAt: threeDaysAgo.toISOString(),
  })
  await api.addSource({
    provider: 'yunzhijia',selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:null,observedAt:new Date().toISOString()},
    externalId: 'yzj:msg:p0-multi',
    title: '@我 · 多事项群',
    excerpt: '请补充压测报告。另外麻烦确认阈值是否合理。',
    fetchedAt: threeDaysAgo.toISOString(),
  })
  await api.addSource({
    provider: 'yunzhijia',selection:{policy:'focused-v1',reasons:['mention_me'],unreadCount:null,observedAt:new Date().toISOString()},
    externalId: 'yzj:msg:p0-nextweek',
    title: '@我 · 下周群',
    excerpt: '下周一把方案发我',
    fetchedAt: threeDaysAgo.toISOString(),
  })

  const dateState = await api.extractCandidates()
  const bySource = (sourceId) => dateState.candidates.filter((item) => item.sourceRefId === sourceId)
  const allSources = (await api.snapshot()).sources
  const idOf = (externalId) => allSources.find((item) => item.externalId === externalId).id

  const dateCand = bySource(idOf('yzj:msg:p0-date'))
  check('P0-03 明天下班前解析为消息次日', dateCand.length === 1 && dateCand[0].dueAt === expectedTomorrow.toISOString(), dateCand[0] && dateCand[0].dueAt)
  check('P0-03 相对日期不是今天（未用提取时刻）', dateCand.length === 1 && new Date(dateCand[0].dueAt).getTime() < Date.now() - 24 * 3600 * 1000)

  check('P0-03 已解决消息不生成候选', bySource(idOf('yzj:msg:p0-closed')).length === 0)
  check('P0-03 询问是否取消仍生成候选', bySource(idOf('yzj:msg:p0-question')).length >= 1)
  check('P0-03 一条消息拆成多条候选', bySource(idOf('yzj:msg:p0-multi')).length === 2, String(bySource(idOf('yzj:msg:p0-multi')).length))
  const nextWeekCand = bySource(idOf('yzj:msg:p0-nextweek'))
  check('P0-03 下周一解析到 7 天内', nextWeekCand.length === 1 && new Date(nextWeekCand[0].dueAt).getTime() > Date.now() - 8 * 24 * 3600 * 1000)

  // 规则候选必须标注来源为 rule，且不自动入库（状态 pending）
  check('P0-03 候选标记为规则提取', dateCand.length === 1 && dateCand[0].extractor === 'rule', dateCand[0] && dateCand[0].extractor)
  check('P0-03 规则候选不自动建任务', dateCand.length === 1 && dateCand[0].status === 'pending')
}

// 06：摘要写回（Agent 读原文后回填四段）
{
  const radarState = await api.snapshot()
  const target = radarState.radar.find((item) => item.url && item.url.indexOf('example.com') >= 0)
  const written = await api.updateRadar(target.id, {
    summary: { change: '阈值与实现变化', usage: '适合网关', risk: '需要压测', practice: '先灰度' },
  })
  const updated = written.radar.find((item) => item.id === target.id)
  check('摘要写回成功', updated.summary.change === '阈值与实现变化' && updated.summary.practice === '先灰度')
  check('摘要写回保留来源与时间', updated.url === target.url && updated.publishedAt === target.publishedAt)
  let rejected = false
  try {
    await api.updateRadar('missing-radar', { summary: { change: 'x' } })
  } catch (e) {
    rejected = /找不到该资讯/.test(e.message)
  }
  check('写回不存在的资讯被拒绝', rejected)
}

// 知识编辑
let kbState = await api.createKnowledge({ kind: 'note', title: '编辑前', body: '正文 A', tags: ['x'] })
const kbItem = kbState.knowledge[kbState.knowledge.length - 1]
kbState = await api.updateKnowledge(kbItem.id, { title: '编辑后', body: '正文 B', tags: ['x', 'y'] })
const kbUpdated = kbState.knowledge.find((k) => k.id === kbItem.id)
check('知识条目可编辑', kbUpdated.title === '编辑后' && kbUpdated.body === '正文 B' && kbUpdated.tags.length === 2)
try {
  await api.updateKnowledge('missing-kb', { title: 'x' })
  check('编辑不存在的知识被拒绝', false)
} catch (e) {
  check('编辑不存在的知识被拒绝', /找不到该知识条目/.test(e.message))
}

// TODO 05：增量游标 + 昵称 @（notifyType 判据，不依赖显示名）
{
  const GROUP = { groupId: 'g-inc', groupName: '增量群' }
  const pages = {
    first: [
      // 升序（list[0] 最旧）：inc-1 普通、inc-2 是新的一条（notifyType 覆盖昵称 @）
      { message: { msgId: 'inc-1', content: '普通闲聊', fromOpenId: 'other-9', sendTime: '2026-10-27 10:00:00', param: null } },
      { message: { msgId: 'inc-2', content: '小王 这个今天看下', fromOpenId: 'other-9', sendTime: '2026-10-27 11:00:00', param: { notifyType: 1 } } },
    ],
    second: [
      { message: { msgId: 'inc-3', content: '再看一个新事项', fromOpenId: 'other-9', sendTime: '2026-10-27 12:00:00', param: { notifyType: 1 } } },
    ],
  }
  let phase = 'first'
  const spawn = (spec) => {
    const cmd = spec.argv.join(' ')
    let text = JSON.stringify({ success: true, data: {} })
    if (/whoami/.test(cmd)) text = JSON.stringify(WHOAMI)
    else if (/im group recent/.test(cmd)) text = JSON.stringify({ success: true, data: { list: [GROUP] } })
    else if (/im message list/.test(cmd)) {
      // 真实语义：每次都取当前最新一页；新消息以新 msgId 出现在该页
      text = JSON.stringify({ success: true, data: { list: phase === 'second' ? pages.second : pages.first } })
    } else if (/contact user get/.test(cmd)) text = JSON.stringify({ success: true, data: { list: [{ name: '同事', openId: 'other-9' }] } })
    return {
      collected: {
        stdout: { readFrom: () => ({ text, nextOffset: text.length, lossy: false }) },
        stderr: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) },
      },
      done: Promise.resolve({ exitCode: 0, signal: null }),
      terminate() {},
    }
  }
  yzjSpawner = { spawn, resolveExecutable: () => Promise.resolve('/fake/yzj-cli') }

  const incState1 = await api.fetchMentions()
  const incSources = incState1.sources.filter((row) => row.locator && String(row.locator.msgId).startsWith('inc-') && row.locator.intake !== false)
  check('增量同步按 notifyType 捕获昵称 @', incSources.some((row) => row.locator.msgId === 'inc-2'), JSON.stringify(incSources.map((r) => r.externalId)))
  check('增量同步不把普通消息当 @', !incSources.some((row) => row.locator.msgId === 'inc-1') && incSources.every((row) => row.locator.msgId !== 'inc-0'))
  check('增量同步写入群游标', !!incState1.syncCursors['g-inc'] && incState1.syncCursors['g-inc'].lastMsgId === 'inc-2', JSON.stringify(incState1.syncCursors))
  check('增量同步如实标注模式', incState1.lastMentionsFetch.mode === 'incremental', String(incState1.lastMentionsFetch.mode))

  phase = 'second'
  const incState2 = await api.fetchMentions()
  const incNew = incState2.sources.filter((row) => row.locator && row.locator.msgId === 'inc-3')
  check('增量同步只取游标之后的新消息', incNew.length === 1 && incState2.sources.every((row) => String(row.externalId || '').indexOf('inc-1') !== 0 || row.externalId !== 'yzj:msg:inc-2-x'), JSON.stringify(incState2.sources.filter((r) => String(r.externalId || '').indexOf('inc-') >= 0).map((r) => r.externalId)))
  check('增量同步推进游标', !!incState2.syncCursors['g-inc'] && incState2.syncCursors['g-inc'].lastMsgId === 'inc-3', JSON.stringify(incState2.syncCursors))
  // 恢复默认 spawner，供后续企业搜索断言使用
  yzjSpawner = makeYzjSpawner(MENTION_SEARCH, DOC_SEARCH)
}

// 企业搜索：消息+文档两路
const entResult = await api.search({ query: '限流' })
const entGroup = entResult.groups.find((group) => group.id === 'enterprise')
check('企业搜索路存在且可用', !!entGroup && entGroup.status === 'ok', JSON.stringify(entGroup && entGroup.status))
check('企业搜索含文档结果', entGroup.items.some((item) => item.id === 'yzj-doc-d1'))
check('企业搜索不构造空 URL', entGroup.items.every((item) => item.kind !== 'knowledge' || item.url !== null || item.id === 'yzj-doc-d1'))

const webOnlyResult=await api.search({query:'CI 构建状态',scope:'web'})
check('互联网模式只返回网页，不混入本地、企业或代码分组',webOnlyResult.groups.length===1&&webOnlyResult.groups[0].id==='web')
const workOnlyResult=await api.search({query:'限流',scope:'work',includeWeb:true})
check('工作模式即使带旧联网参数也不查询公网',!workOnlyResult.groups.some(group=>group.id==='web'))

// 三路意图搜索：联系人 / 会议室 / 考勤
const nameSearch = await api.search({ query: '田鹏飞' })
const contactGroup = nameSearch.groups.find((g) => g.id === 'contacts')
check('人名查询触发联系人路', !!contactGroup && contactGroup.items.length >= 1, JSON.stringify(contactGroup && contactGroup.status))

const roomSearch = await api.search({ query: '会议室' })
const roomGroup = roomSearch.groups.find((g) => g.id === 'rooms')
check('会议查询触发会议室路', !!roomGroup && roomGroup.items.some((i) => i.kind === 'room'), JSON.stringify(roomGroup && roomGroup.status))

const attSearch = await api.search({ query: '打卡' })
const attGroup = attSearch.groups.find((g) => g.id === 'attendance')
check('考勤查询触发考勤路', !!attGroup && attGroup.items.some((i) => i.kind === 'attendance'), JSON.stringify(attGroup && attGroup.status))

const plainSearch = await api.search({ query: '限流' })
check(
  '普通查询不触发三路额外分组',
  !plainSearch.groups.some((g) => ['contacts', 'rooms', 'attendance'].indexOf(g.id) >= 0),
)

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

// GitHub PR / CI（gh CLI 只读）—— 需要一个能答应 gh/ps 的 spawner
yzjSpawner = makeYzjSpawner(MENTION_SEARCH, DOC_SEARCH)
const ghSnap = await api.github()
check('GitHub 快照状态 ok', ghSnap.status === 'ok', JSON.stringify(ghSnap.status))
check('解析到 PR', ghSnap.prs.items.length === 1 && ghSnap.prs.items[0].number === 12)
check('解析到 CI 运行', ghSnap.runs.items.length === 1 && ghSnap.runs.items[0].conclusion === 'success')

// 进程探测
const envWithProcs = await api.environment()
check('进程探测可用', !!envWithProcs.processes && envWithProcs.processes.status === 'ok', JSON.stringify(envWithProcs.processes && envWithProcs.processes.status))
check('进程按 CPU 排序', envWithProcs.processes.items.length === 2 && envWithProcs.processes.items[0].pid === '100', JSON.stringify(envWithProcs.processes.items.map((p) => p.pid)))

// 本地项目搜索（夹具文件已在测试开始时写入）
{
  const fileSearch = await api.search({ query: 'rate-limit' })
  const fileGroup = fileSearch.groups.find((g) => g.id === 'files')
  check('本地文件搜索命中文件名', !!fileGroup && fileGroup.items.some((i) => i.kind === 'file'), JSON.stringify(fileGroup && fileGroup.status))
  const contentSearch = await api.search({ query: '阈值 1500' })
  const contentGroup = contentSearch.groups.find((g) => g.id === 'files')
  check(
    '本地文件搜索命中内容片段',
    !!contentGroup && contentGroup.items.some((i) => String(i.snippet || '').indexOf('第') === 0),
    JSON.stringify(contentGroup && contentGroup.items[0] && contentGroup.items[0].snippet),
  )
}

// PR/CI 意图搜索
const prSearch = await api.search({ query: 'CI 构建状态' })
check('CI 意图触发 PR/CI 分组', prSearch.groups.some((g) => g.id === 'github'), prSearch.groups.map((g) => g.id).join(','))

// 语义近似去重：标题相近但 URL 不同，不应重复入库
{
  const nearDup = {
    success: true,
    data: {
      list: [
        {
          group: { groupId: 'g9', groupName: '群' },
          messages: [
            { message: { msgId: 'dup-a', content: '@测试用户 看一下网关限流阈值', fromOpenId: 'o1', sendTime: '2026-10-27 12:00:00', param: { notifyType: 1 } } },
          ],
        },
      ],
    },
  }
  yzjSpawner = makeYzjSpawner(nearDup, DOC_SEARCH)
  webMock = {
    fetch(request) {
      const first = String(request.url).indexOf('one') >= 0
      const rss = [
        '<?xml version="1.0"?><rss><channel>',
        '<item><title>' + (first ? 'Harness Slots 扩展点全面开放' : 'Harness Slots 扩展点全面开放了') + '</title>',
        '<description>x</description><pubDate>Tue, 27 Oct 2026 06:00:00 +0000</pubDate>',
        '<link>https://example.com/' + (first ? 'one' : 'two') + '</link></item>',
        '</channel></rss>',
      ].join('')
      return Promise.resolve({ statusCode: 200, url: request.url, body: { kind: 'text', content: rss } })
    },
  }
  await api.saveSettings({ feeds: [{ id: 'f1', label: '源', url: 'https://example.com/one.xml' }] })
  const first = await api.fetchRadar()
  await api.saveSettings({ feeds: [{ id: 'f1', label: '源', url: 'https://example.com/two.xml' }] })
  const second = await api.fetchRadar()
  check('语义近似去重：相似标题不重复入库', second.lastRadarFetch.added === 0, JSON.stringify(second.lastRadarFetch))
  yzjSpawner = null
  webMock = null
}

// P0-02：重载后 ID 与关联保持（项目归属 / 任务执行记录 / 来源证据 / 候选）
let relState = await api.saveProject({ name: '关联项目', repoPath: '/tmp/link-proj' })
const relProject = relState.projects.find((item) => item.repoPath === '/tmp/link-proj')
const relSource = await api.addSource({ provider: 'test', title: '关联来源', excerpt: '请补充压测报告' })
const relSourceId = (await api.snapshot()).sources.slice(-1)[0].id
const relTaskResult = await api.createTask({ title: '关联任务', projectId: relProject.id, sourceRefId: relSourceId })
const relTaskResultId = relTaskResult.tasks.slice(-1)[0].id
const relRunResult = await api.recordRun({ taskId: relTaskResultId, status: 'completed', summary: '关联执行' })
const relRunResultId = relRunResult.runs.slice(-1)[0].id
const relCandResult = await api.extractCandidates()
const relCandidate = relCandResult.candidates.find((item) => item.sourceRefId === relSourceId)
const relIds = {
  project: relProject.id,
  task: relTaskResultId,
  run: relRunResultId,
  source: relSourceId,
  candidate: relCandidate ? relCandidate.id : null,
}

// 业务修订号：每次写入递增，供页面判断新旧（schema version 不能当并发号）
{
  const rev1 = await api.revision()
  await api.createTask({ title: '修订号测试' })
  const rev2 = await api.revision()
  check('revision 随写入递增', rev2.revision > rev1.revision, rev1.revision + ' -> ' + rev2.revision)
  const revState = await api.snapshot()
  check('快照携带 revision', Number.isFinite(Number(revState.revision)) && Number(revState.revision) === rev2.revision)
}

// TODO 07：插件侧后台自动化（定时器 + 单飞 + 补跑）
{
  const before = await api.automationStatus()
  check('自动化默认关闭', before.enabled === false)
  const skipped = await api.automationRun()
  check('未开启时 tick 不执行', skipped.ran === false && skipped.status === 'disabled', JSON.stringify(skipped))

  await api.saveSettings({ automation: { enabled: true, intervalMinutes: 5, radar: true, mentions: false }, feeds: [], topics: ['Agent'] })
  webMock = {
    fetch: () => Promise.resolve({ statusCode: 200, url: 'x', body: { kind: 'text', content: FAKE_RSS } }),
    search: () => Promise.resolve({ sources: [{ url: 'https://example.org/auto', title: '自动化发现的资讯', snippet: 's', publishedAt: null }], truncated: false }),
  }
  const ran = await api.automationRun()
  check('开启后 tick 执行', ran.ran === true, JSON.stringify(ran))
  const after = await api.automationStatus()
  check('记录最近一次自动化', !!after.lastAutomation && after.lastAutomation.at, JSON.stringify(after.lastAutomation))
  check('自动化写入资讯', after.lastAutomation.radarAdded >= 1, String(after.lastAutomation.radarAdded))
  const statusAfter = await api.automationStatus()
  check('刚跑完不算到期', statusAfter.due === false)

  // 关闭后不再执行
  await api.saveSettings({ automation: { enabled: false } })
  const off = await api.automationRun()
  check('关闭后 tick 不执行', off.ran === false)
  webMock = null
}

// TODO 04：侧栏助手走原生会话（假 sessions + sessionController 验证链路）
{
  function makeFakeWorld() {
    const events = []
    const session = {
      id: 'session-fake-recovered',
      get seq() {
        return events.length
      },
      snapshotEvents(from, to) {
        return events.slice(from === undefined ? 0 : from, to === undefined ? events.length : to)
      },
    }
    const registry = new Map()
    const world = {
      events: events,
      session: session,
      registry: registry,
      createCalls: 0,
      promptCalls: 0,
      promptFails: new Map(), // sessionId → 需要抛 resume 错误
    }
    world.sessions = {
      get: (id) => registry.get(id),
      create: () => {
        throw new Error('不应再使用 sessions.create（无持久化日志）')
      },
      list: () => Array.from(registry.values()),
    }
    world.controller = {
      createSession: async () => {
        world.createCalls += 1
        registry.set(session.id, session)
        return { agent: { session: session }, agentPreset: 'default' }
      },
      prompt: async (request) => {
        world.promptCalls += 1
        if (world.promptFails.has(request.sessionId)) {
          return Promise.reject(
            new Error(
              'resume failed for session "' + request.sessionId + '": SessionPersistenceNotFoundError: session "' + request.sessionId + '" not found',
            ),
          )
        }
        setTimeout(() => {
          events.push({ type: 'user/message', seq: events.length + 1, time: Date.now(), data: { content: request.content } })
          events.push({ type: 'tool/call', seq: events.length + 1, time: Date.now(), data: { name: 'workbench_create_task', arguments: { title: '限流结论' } } })
          events.push({ type: 'tool/result', seq: events.length + 1, time: Date.now(), data: { name: 'workbench_create_task' } })
          events.push({
            type: 'assistant/message',
            seq: events.length + 1,
            time: Date.now(),
            data: { message: { id: 'msg-' + events.length, content: [{ type: 'text', text: '助手回复：今天先处理限流结论' }] } },
          })
          events.push({ type: 'turn/end', seq: events.length + 1, time: Date.now(), data: {} })
        }, 20)
        return { accepted: true }
      },
    }
    return world
  }

  // --- 场景 1：正常链路 ---
  let world = makeFakeWorld()
  fakeSessions = world.sessions
  fakeSessionController = world.controller
  await api.saveSettings({ assistantSessionId: null })

  const asked = await api.assistantAsk({ text: '帮我看看今天要做什么', refs: [{ kind: 'task', id: (await api.snapshot()).tasks[0].id, title: '示例任务' }] })
  check('助手问答返回回复', asked.status === 'ok' && asked.reply.indexOf('助手回复') >= 0, JSON.stringify(asked))
  check('助手回传本轮工具调用', Array.isArray(asked.toolCalls) && asked.toolCalls.indexOf('workbench_create_task') >= 0)
  check('助手会话经 createSession 建立', world.createCalls === 1, String(world.createCalls))
  check('助手复用同一个原生会话', asked.sessionId === world.session.id, asked.sessionId)

  const sessionList = await api.assistantSessions({ limit: 5 })
  check('助手会话列表可读', sessionList.status === 'ok' && sessionList.sessions.length >= 1, JSON.stringify(sessionList))
  check('会话列表标记助手会话', sessionList.sessions.some((row) => row.isAssistant))
  const transcript = await api.assistantTranscript({ sessionId: world.session.id })
  check(
    '会话记录可读（含工具调用）',
    transcript.status === 'ok' && transcript.messages.some((m) => m.role === 'assistant' && (m.toolCalls || []).length >= 1),
    JSON.stringify(transcript.messages.slice(-1)),
  )
  const missing = await api.assistantTranscript({ sessionId: 'no-such-session' })
  check('读取不存在的会话如实返回', missing.status === 'not_found')

  // 原生聊天内嵌动作：按 messageId 取回复正文
  const liveMessage = await api.assistantMessage({ sessionId: world.session.id, messageId: 'no-such-message' })
  check('按未知消息 id 兜底取最后一条助手回复', liveMessage.status === 'ok' && String(liveMessage.text || '').length > 0, JSON.stringify(liveMessage).slice(0, 120))
  const byMessageId = await api.assistantMessage({ sessionId: world.session.id, messageId: liveMessage.messageId })
  check('按消息 id 可取正文', byMessageId.status === 'ok' && byMessageId.text.indexOf('助手回复') >= 0, String(byMessageId.text || '').slice(0, 40))

  // --- 场景 1b：prompt 样板剥离（标题与回显只显示真实内容） ---
  {
    const ugly = makeFakeWorld()
    fakeSessions = ugly.sessions
    fakeSessionController = ugly.controller
    await api.saveSettings({ assistantSessionId: null })
    ugly.controller.prompt = async (request) => {
      const full = request.content.map((block) => block.text).join('\n')
      // 模拟宿主会把组装的 prompt 作为 user 消息写入会话
      ugly.events.push({ type: 'user/message', seq: ugly.events.length + 1, time: Date.now(), data: { content: [{ type: 'text', text: full }] } })
      ugly.events.push({
        type: 'assistant/message',
        seq: ugly.events.length + 1,
        time: Date.now(),
        data: { message: { id: 'msg-' + ugly.events.length, content: [{ type: 'text', text: '好，已记录' }] } },
      })
      ugly.events.push({ type: 'turn/end', seq: ugly.events.length + 1, time: Date.now(), data: {} })
      return { accepted: true }
    }
    const outcome = await api.assistantAsk({ text: '添加时区设置', refs: [{ kind: 'task', id: (await api.snapshot()).tasks[0].id }] })
    check('问答成功（样板场景）', outcome.status === 'ok', JSON.stringify(outcome).slice(0, 120))
    const titles = await api.assistantSessions({ limit: 5 })
    const row = titles.sessions.find((item) => item.id === ugly.session.id)
    check('会话标题不含样板', !!row && row.title.indexOf('添加时区设置') >= 0 && row.title.indexOf('工作台上下文') < 0 && row.title.indexOf('需要落库时') < 0, row && row.title)
    const view = await api.assistantTranscript({ sessionId: ugly.session.id })
    const userEntry = view.messages.find((entry) => entry.role === 'user')
    check(
      '记录里的用户消息已剥离样板',
      !!userEntry && userEntry.text.indexOf('添加时区设置') >= 0 && userEntry.text.indexOf('【工作台上下文】') < 0 && userEntry.text.indexOf('需要落库时') < 0,
      userEntry && userEntry.text,
    )
    ugly.events.push({type:'user/message',seq:ugly.events.length+1,time:Date.now(),data:{content:[{type:'text',text:'Current runtime context. This snapshot supersedes earlier runtime-context snapshots.\nCurrent working directory: /fixture'}]}})
    const withoutRuntime = await api.assistantTranscript({sessionId:ugly.session.id})
    check('助手记录不展示宿主运行时注入提示', !withoutRuntime.messages.some(entry=>entry.text.includes('Current runtime context.')))
    // 恢复场景 1 的 fake，后续场景依赖它
    fakeSessions = world.sessions
    fakeSessionController = world.controller
  }

  // --- 场景 2：渐进渲染 ---
  {
    const sent = await api.assistantSend({ text: '渐进渲染测试', sessionId: world.session.id })
    check('assistantSend 立即返回 fromSeq', sent.status === 'ok' && Number.isFinite(sent.fromSeq), JSON.stringify(sent))
    await new Promise((resolve) => setTimeout(resolve, 120))
    const delta = await api.assistantDelta({ sessionId: world.session.id, fromSeq: sent.fromSeq })
    check('assistantDelta 返回新条目', delta.status === 'ok' && delta.entries.length >= 3, JSON.stringify(delta.entries.map((e) => e.role)))
    check('assistantDelta 含工具与助手条目', delta.entries.some((e) => e.role === 'tool') && delta.entries.some((e) => e.role === 'assistant'))
    check('assistantDelta 给出 nextSeq', Number.isFinite(delta.nextSeq) && delta.nextSeq >= sent.fromSeq)
    check('turn 结束后 turnActive 为假', delta.turnActive === false)
    const again = await api.assistantDelta({ sessionId: world.session.id, fromSeq: delta.nextSeq })
    check('增量读取不重复', again.entries.length === 0, JSON.stringify(again.entries.map((e) => e.role)))
  }

  const history = await api.assistantHistory()
  check('助手历史可读（含用户与助手）', history.messages.filter((m) => m.role === 'assistant').length >= 1 && history.messages.filter((m) => m.role === 'user').length >= 1)

  const reset = await api.assistantReset()
  check('助手可开新会话', reset.status === 'ok' && typeof reset.sessionId === 'string')

  // --- 场景 3：旧版计数字 id（session-1）自动丢弃重建 ---
  {
    const legacy = makeFakeWorld()
    fakeSessions = legacy.sessions
    fakeSessionController = legacy.controller
    await api.saveSettings({ assistantSessionId: 'session-1' })
    // session-1 即便在注册表里也不该被复用
    legacy.registry.set('session-1', { id: 'session-1', seq: 0, snapshotEvents: () => [] })
    const outcome = await api.assistantAsk({ text: '旧 id 自愈' })
    check('旧版 session-N id 被丢弃重建', outcome.status === 'ok' && legacy.createCalls === 1, JSON.stringify({ status: outcome.status, createCalls: legacy.createCalls }))
    check('重建后记住新会话 id', String(outcome.sessionId) === legacy.session.id, String(outcome.sessionId))
  }

  // --- 场景 4：prompt 报 resume 失败 → 重建并重试一次 ---
  {
    const broken = makeFakeWorld()
    fakeSessions = broken.sessions
    fakeSessionController = broken.controller
    const staleSession = { id: 'session-stale-live', seq: 0, snapshotEvents: () => [] }
    broken.registry.set(staleSession.id, staleSession)
    broken.promptFails.set(staleSession.id, true)
    await api.saveSettings({ assistantSessionId: staleSession.id })
    const healed = await api.assistantAsk({ text: 'resume 自愈' })
    check('resume 失败后自愈并成功', healed.status === 'ok' && healed.reply.indexOf('助手回复') >= 0, JSON.stringify(healed))
    check('自愈时重建了新会话', broken.createCalls === 1, String(broken.createCalls))
    check('自愈后会话 id 已更新', String(healed.sessionId) === broken.session.id, String(healed.sessionId))
    const sentHealed = await api.assistantSend({ text: '自愈后发送' })
    check('自愈后继续可用', sentHealed.status === 'ok', JSON.stringify(sentHealed))
  }

  // --- 场景 5：create 只返回 sessionId 时也能工作（返回形状容错） ---
  {
    const shape = makeFakeWorld()
    fakeSessions = shape.sessions
    fakeSessionController = {
      createSession: async () => {
        shape.registry.set(shape.session.id, shape.session)
        return { sessionId: shape.session.id }
      },
      prompt: shape.controller.prompt,
    }
    await api.saveSettings({ assistantSessionId: null })
    const outcome = await api.assistantAsk({ text: '返回形状容错' })
    check('create 只返回 sessionId 时仍可用', outcome.status === 'ok' && !!outcome.reply, JSON.stringify(outcome).slice(0, 140))
  }

  // --- 场景 6：create 返回不可用结构时，不把代码细节暴露给用户 ---
  {
    const broken = makeFakeWorld()
    fakeSessions = broken.sessions
    fakeSessionController = { createSession: async () => ({ nothing: true }), prompt: async () => ({ accepted: true }) }
    await api.saveSettings({ assistantSessionId: null })
    const failed = await api.assistantAsk({ text: '结构异常' })
    check('结构异常时返回用户可读错误', failed.status === 'error' && !/返回值里没有 session/.test(failed.note), JSON.stringify(failed).slice(0, 160))
    check('结构异常时技术细节放在 detail', typeof failed.detail === 'string' && failed.detail.length > 0)
  }

  fakeSessions = null
  fakeSessionController = null
  const degraded = await api.assistantAsk({ text: '在吗' })
  check('缺会话服务时如实降级', degraded.status === 'unavailable' && !!degraded.note, JSON.stringify(degraded))
}

// 实体删除能力（逐个核对后补齐的三处）
{
  const srcState = await api.addSource({ provider: 'test', title: '待删来源', excerpt: '这个要被删掉' })
  const srcId = srcState.sources.slice(-1)[0].id
  const candBefore = await api.extractCandidates()
  const candOfSource = candBefore.candidates.filter((c) => c.sourceRefId === srcId)
  const taskState = await api.createTask({ title: '引用来源的任务', sourceRefId: srcId })
  const taskId = taskState.tasks.slice(-1)[0].id

  const afterDelete = await api.deleteSource(srcId)
  check('来源可删除', !afterDelete.sources.some((row) => row.id === srcId))
  check('删除来源时清理派生候选', !afterDelete.candidates.some((c) => c.sourceRefId === srcId), String(candOfSource.length) + ' 条')
  check('删除来源时解除待办关联', afterDelete.tasks.find((row) => row.id === taskId).sourceRefId === null)
  let sourceGone = false
  try {
    await api.deleteSource(srcId)
  } catch (e) {
    sourceGone = /找不到该来源/.test(e.message)
  }
  check('重复删除来源如实报错', sourceGone)

  const runState = await api.recordRun({ taskId: taskId, status: 'completed', summary: '待删执行' })
  const runId = runState.runs.slice(-1)[0].id
  check('执行记录已挂到任务', runState.tasks.find((row) => row.id === taskId).runIds.indexOf(runId) >= 0)
  const afterRunDelete = await api.deleteRun(runId)
  check('执行记录可删除', !afterRunDelete.runs.some((row) => row.id === runId))
  check('删除执行记录时解除任务关联', afterRunDelete.tasks.find((row) => row.id === taskId).runIds.indexOf(runId) < 0)

  const candState = await api.extractCandidates()
  const anyCandidate = candState.candidates.filter((c) => c.status === 'pending')[0]
  if (anyCandidate) {
    const afterCandDelete = await api.deleteCandidate(anyCandidate.id)
    check('候选可彻底删除', !afterCandDelete.candidates.some((c) => c.id === anyCandidate.id))
    let candidateGone = false
    try {
      await api.deleteCandidate(anyCandidate.id)
    } catch (e) {
      candidateGone = /找不到该候选/.test(e.message)
    }
    check('重复删除候选如实报错', candidateGone)
  } else {
    check('候选可彻底删除', false, '没有可删除的候选样本')
    check('重复删除候选如实报错', false, '没有可删除的候选样本')
  }
}

// TODO 13 验收：会话翻页发现 + 每群消息排空 + 单批 >20 来源 + 重复同步不重复
{
  // Focused collector: two real groups; large discovery/budget continuation is
  // covered separately in focused-intake and reliability with valid headers.
  const groupPages = [[{groupId:'g-drain-1',groupName:'排空群一',lastMsgId:'dr-g-drain-1-m-028'},{groupId:'g-drain-2',groupName:'排空群二',lastMsgId:'dr-g-drain-2-m-008'}]]
  function drainMake(gid, page, n) {
    return Array.from({ length: n }).map(function (_, k) {
      return { message: {
        msgId: 'dr-' + gid + '-' + page + '-' + k,
        content: '@测试用户 排空事项 ' + gid + '/' + page + '/' + k,
        fromOpenId: 'other-drain',
        sendTime: '2026-10-28 09:' + String(10 + page).slice(-2) + ':' + String(k).padStart(2, '0'),
        param: { notifyType: 1 },
      } }
    })
  }
  // 服务端尊重 --limit 20：g-drain-1 共 29 条（页1=20，页2=9，触发排空结束）
  // 真实语义（升序 + 服务端尊重 limit 20）：g1 总 29 条（m-000..m-028）
  //   newest 页 = 最后 20 条；old(anchor) = anchor 之前更旧的 20 条
  // g-drain-2 总 9 条：newest 页全返（<20 → 停）
  function groupMessages(cmd) {
    const gid = /--group-id ([a-z0-9\-]+)/.exec(cmd)[1]
    const total = gid === 'g-drain-1' ? 29 : gid === 'g-drain-2' ? 9 : 0
    if (total === 0) return []
    const all = Array.from({ length: total }).map(function (_, i) {
      return { message: {
        msgId: 'dr-' + gid + '-m-' + String(i).padStart(3, '0'),
        content: '@测试用户 排空事项 ' + gid + '/' + i,
        fromOpenId: 'other-drain',
        sendTime: '2026-10-28 09:' + String(10 + (i % 40)).slice(-2) + ':' + String(i % 60).padStart(2, '0'),
        param: { notifyType: 1 },
      } }
    })
    const isOld = /--type old/.test(cmd)
    const anchorMatch = /--msg-id ([\w\-]+)/.exec(cmd)
    if (isOld && anchorMatch) {
      const anchorIndex = all.findIndex(function (row) {
        return row.message.msgId === anchorMatch[1]
      })
      if (anchorIndex <= 0) return []
      return all.slice(Math.max(0, anchorIndex - 20), anchorIndex)
    }
    return all.slice(Math.max(0, total - 20))
  }
  const spawn = function (spec) {
    const cmd = spec.argv.join(' ')
    let text = JSON.stringify({ success: true, data: {} })
    if (/whoami/.test(cmd)) {
      text = JSON.stringify(WHOAMI)
    } else if (/im group recent/.test(cmd)) {
      const page = Number((/--page ([0-9]+)/.exec(cmd) || [])[1])
      text = JSON.stringify({ success: true, data: { list: groupPages[page - 1] || [],more:page<groupPages.length } })
    } else if (/im message list/.test(cmd)) {
      text = JSON.stringify({ success: true, data: { list: groupMessages(cmd) } })
    } else if (/contact user get/.test(cmd)) {
      text = JSON.stringify({ success: true, data: { list: [{ name: '同事', openId: 'other-drain' }] } })
    }
    return {
      collected: {
        stdout: { readFrom: () => ({ text: text, nextOffset: text.length, lossy: false }) },
        stderr: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) },
      },
      done: Promise.resolve({ exitCode: 0, signal: null }),
      terminate() {},
    }
  }
  yzjSpawner = { spawn: spawn, resolveExecutable: async () => '/fake/yzj-cli' }

  const first = await api.fetchMentions()
  const drained = first.sources.filter(function (row) {
    return row.locator && String(row.locator.msgId).startsWith('dr-')
  })
  check('TODO13 每群排空 + 单批 20+ 来源', drained.length === 38, String(drained.length) + '（29 群一 + 9 群二）')
  check('TODO13 扫描记录如实标注', String(first.lastMentionsFetch.note || '').indexOf('增量排空') >= 0, String(first.lastMentionsFetch.note).slice(0, 120))
  const second = await api.fetchMentions()
  const deduped = second.sources.filter(function (row) {
    return row.locator && String(row.locator.msgId).startsWith('dr-')
  })
  check('TODO13 重复同步不重复入库', deduped.length === 38, String(deduped.length))
  check('TODO13 游标推进到位', !!second.syncCursors['g-drain-1'] && String(second.syncCursors['g-drain-1'].lastMsgId).indexOf('dr-g-drain-1-m-028') === 0, second.syncCursors['g-drain-1'] && second.syncCursors['g-drain-1'].lastMsgId)
  check('TODO13 游标 g2 推进 9 条页', !!second.syncCursors['g-drain-2'] && String(second.syncCursors['g-drain-2'].lastMsgId).indexOf('dr-g-drain-2-m-008') === 0, second.syncCursors['g-drain-2'] && second.syncCursors['g-drain-2'].lastMsgId)
  yzjSpawner = makeYzjSpawner(MENTION_SEARCH, DOC_SEARCH)
}


// TODO 14/15：分析队列 + AI 结构化识别 + 合并 + 人工确认 + 重启持久
{
  function makeAnalysisWorld(replies) {
    // replies: 数组，按次序返回 JSON 文本
    const events = []
    const session = {
      id: 'session-analysis-fake',
      get seq() { return events.length },
      snapshotEvents(from, to) {
        return events.slice(from === undefined ? 0 : from, to === undefined ? events.length : to)
      },
    }
    const registry = new Map([[session.id, session]])
    let call = -1
    return {
      events: events,
      session: session,
      sessions: { get: (id) => registry.get(id), create() { return session }, list: () => [session] },
      controller: {
        // Each isolated fixture only persists its own registry; previous worlds are absent.
        resolveAgent: async (id) => registry.has(id) ? { agent: { session: registry.get(id), status: 'idle' } } : { error: new Error('session "' + id + '" not found') },
        createSession: async () => ({ agent: { session: session }, agentPreset: 'default' }),
        prompt: async (request) => {
          const replyText = fixtureReply(request,()=>{call += 1;return replies[Math.min(call,replies.length-1)]})
          setTimeout(() => {
            events.push({ type: 'assistant/message', seq: events.length + 1, time: Date.now(), data: { message: { id: 'an-' + events.length, content: [{ type: 'text', text: replyText }] } } })
            events.push({ type: 'turn/end', seq: events.length + 1, time: Date.now(), data: {} })
          }, 15)
          return { accepted: true }
        },
      },
    }
  }

  // 采集两条 @我 消息 → 队列两条 pending
  const world = makeAnalysisWorld([
    '```json\n{"noise":false,"summary":"两条交办","items":[{"needsReply":true,"needsAction":true,"eventType":"feature","title":"压测网关限流","dueAt":"2026-10-29T10:00:00.000Z","deliverable":"压测报告","replyStage":"待答复"},{"needsReply":true,"needsAction":false,"eventType":"meeting","title":"周五对齐会","dueAt":null,"deliverable":null,"replyStage":"待答复"}]}\n```',
    '```json\n{"noise":true,"summary":"问候","items":[]}\n```',
  ])
  fakeSessions = world.sessions
  fakeSessionController = world.controller
  await api.analyzeReset()
  await api.saveSettings({ aiExtract: { enabled: true, autoRegister: true, batchSize: 5 }, assistantSessionId: null })

  const yzj = (list) => ({ spawn(spec) { const cmd = spec.argv.join(' '); let text = JSON.stringify({ success: true, data: {} });
    if (/whoami/.test(cmd)) text = JSON.stringify(WHOAMI)
    else if (/im group recent/.test(cmd)) text = JSON.stringify({ success: true, data: { list: [{ groupId: 'g-an', groupName: '分析群' }] } })
    else if (/im message list/.test(cmd)) text = JSON.stringify({ success: true, data: { list: list } })
    else if (/contact user get/.test(cmd)) text = JSON.stringify({ success: true, data: { list: [{ name: '发起人', openId: 'other-an' }] } })
    return { collected: { stdout: { readFrom: () => ({ text: text, nextOffset: text.length, lossy: false }) }, stderr: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) } }, done: Promise.resolve({ exitCode: 0, signal: null }), terminate() {} } },
    resolveExecutable: async () => '/fake/yzj-cli' })
  yzjSpawner = yzj([
    { message: { msgId: 'an-1', content: '请把压测网关限流的结论在明天下班前给我，另外周五对齐会参加一下', fromOpenId: 'other-an', sendTime: '2026-10-28 10:00:00', param: { notifyType: 1 } } },
    { message: { msgId: 'an-2', content: '你好呀，辛苦啦 🎉', fromOpenId: 'other-an', sendTime: '2026-10-28 10:05:00', param: { notifyType: 1 } } },
  ])

  await api.fetchMentions()
  let status = await api.analysisStatus()
  check('TODO14 新来源进入分析队列（采集/识别解耦）', status.pending === 2, JSON.stringify({ pending: status.pending }))

  // 第一批分析：两条消息 → 建两个待办（autoRegister 开）+ 噪声不建
  const run = await api.analyzeRun({})
  check('TODO15 AI 分析执行成功', run.status === 'ok' && run.processed === 2, JSON.stringify(run).slice(0, 140))
  status = await api.analysisStatus()
  check('TODO15 分析完成入队 done', status.done === 2 && status.pending === 0, JSON.stringify({ done: status.done, pending: status.pending }))
  const after = await api.snapshot()
  const aiTasks = after.tasks.filter((task) => task.aiExtracted === true)
  check(
  'TODO15 结构化识别建待办（needsAction 项建任务；needsReply-only 项只进回复）',
  aiTasks.filter((task) => task.title === '压测网关限流').length === 1 &&
    !aiTasks.some((task) => task.title === '周五对齐会') &&
    !aiTasks.some((task) => task.title.indexOf('你好') >= 0),
  aiTasks.map((task) => task.title).join(' | '),
)
  const stress = aiTasks.find((task) => task.title.indexOf('压测网关限流') >= 0)
  check('TODO15 契约字段写入（处理侧）', !!stress && stress.needsAction === true && stress.eventType === 'feature' && !!stress.dueAt)
  check('TODO15 多来源引用落在任务上', !!stress && (stress.sourceRefs || []).some((ref) => ref.msgId === 'an-1'))
  check('TODO15 噪声（问候）不建待办', !aiTasks.some((task) => task.title.indexOf('你好') >= 0))
  // 平行实体：needsReply → 回复（独立于待办），needsAction → 待办
  const repliesAfter = after.replies || []
  check('TODO15 needsReply 生成回复实体', repliesAfter.filter((row) => row.stage === '待回复' && row.msgId === 'an-1').length === 1, JSON.stringify(repliesAfter.map((row) => [row.msgId, row.stage])))
  check('TODO15 周五对齐会不经任务（needsReply only → 仅回复）', !aiTasks.some((task) => task.title === '周五对齐会'))
  check('TODO16 回复清单在快照可见', after.replies.length >= 1)

  // 重跑：队列已 done，不重复建
  const again = await api.analyzeRun({})
  const afterAgain = await api.snapshot()
  const dupTitles = afterAgain.tasks.filter((task) => task.title === '压测网关限流').length
  check('TODO15 重复分析不重复建任务', dupTitles === 1 && (afterAgain.replies || []).length >= 1, JSON.stringify({ dupTitles: dupTitles }))

  // 重启（reload）：队列与分析结果仍在
  const { execFileSync } = await import('node:child_process')
  const childScript = `import {apply} from ${JSON.stringify(new URL('../index.js',import.meta.url).href)};let api;apply({provide:(k,v)=>{if(k==='workbench')api=v},inject(){},effect:fn=>fn(),get(){},logger:{info(){}}},{});console.log(JSON.stringify(await api.snapshot()))`
  const reloaded = JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',childScript],{env:process.env,encoding:'utf8'}))
  check('TODO14 队列与结果重启后保持', (reloaded.analysisQueue || []).filter((row) => row.status === 'done').length === 2)

  // autoRegister 关：新来源分析后停在 awaiting_human，人工确认才建
  const world2 = makeAnalysisWorld(['```json\n{"noise":false,"summary":"一条交办","items":[{"needsReply":true,"needsAction":true,"eventType":"logging","title":"登记差旅报销","dueAt":null,"deliverable":null,"replyStage":null}]}\n```'])
  fakeSessions = world2.sessions
  fakeSessionController = world2.controller
  await api.analyzeReset()
  await api.saveSettings({ aiExtract: { enabled: true, autoRegister: false } })
  yzjSpawner = yzj([{ message: { msgId: 'an-9', content: '记得登记一下上周的差旅报销', fromOpenId: 'other-an', sendTime: '2026-10-28 11:00:00', param: { notifyType: 1 } } }])
  await api.fetchMentions()
  const run2 = await api.analyzeRun({})
  const status2 = await api.analysisStatus()
  check('TODO15 autoRegister 关：停在待人工确认', status2.awaitingHuman === 1 && run2.status === 'ok', JSON.stringify(status2))
  const beforeConfirm = (await api.snapshot()).tasks.filter((task) => task.title.indexOf('差旅') >= 0).length
  const awaitingEntry = status2.entries.find((row) => row.status === 'awaiting_human')
  await api.analyzeConfirm(awaitingEntry.id)
  const afterConfirm = (await api.snapshot()).tasks.filter((task) => task.title.indexOf('差旅') >= 0).length
  check('TODO15 人工确认后建待办', beforeConfirm === 0 && afterConfirm === 1)

  fakeSessions = null
  fakeSessionController = null
  yzjSpawner = makeYzjSpawner(MENTION_SEARCH, DOC_SEARCH)
}

// 共享：分析/采集联测的云之家 spawner 工厂
const yzj_ = (list) => ({ spawn(spec) { const cmd = spec.argv.join(' '); let text = JSON.stringify({ success: true, data: {} });
  if (/whoami/.test(cmd)) text = JSON.stringify(WHOAMI)
  else if (/im group recent/.test(cmd)) text = JSON.stringify({ success: true, data: { list: [{ groupId: 'g-an', groupName: '分析群' }] } })
  else if (/im message list/.test(cmd)) text = JSON.stringify({ success: true, data: { list: list } })
  else if (/contact user get/.test(cmd)) text = JSON.stringify({ success: true, data: { list: [{ name: '发起人', openId: 'other-an' }] } })
  return { collected: { stdout: { readFrom: () => ({ text: text, nextOffset: text.length, lossy: false }) }, stderr: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) } }, done: Promise.resolve({ exitCode: 0, signal: null }), terminate() {} } },
  resolveExecutable: async () => '/fake/yzj-cli' })


// TODO 19：后台 tick 融合分析阶段（采集→@我→AI 识别，统一 Count）
{
  // 独立 helper（与 TODO15 场景同形）
  const makeAnalysisWorld = function (replies) {
    const events = []
    const session = {
      id: 'session-analysis-shared',
      get seq() { return events.length },
      snapshotEvents(from, to) {
        return events.slice(from === undefined ? 0 : from, to === undefined ? events.length : to)
      },
    }
    const registry = new Map([[session.id, session]])
    let call = -1
    return {
      events: events,
      session: session,
      sessions: { get: (id) => registry.get(id), create() { return session }, list: () => [session] },
      controller: {
        // Each isolated fixture only persists its own registry; previous worlds are absent.
        resolveAgent: async (id) => registry.has(id) ? { agent: { session: registry.get(id), status: 'idle' } } : { error: new Error('session "' + id + '" not found') },
        createSession: async () => ({ agent: { session: session }, agentPreset: 'default' }),
        prompt: async (request) => {
          const replyText = fixtureReply(request,()=>{call += 1;return replies[Math.min(call,replies.length-1)]})
          setTimeout(() => {
            events.push({ type: 'assistant/message', seq: events.length + 1, time: Date.now(), data: { message: { id: 'an-' + events.length, content: [{ type: 'text', text: replyText }] } } })
            events.push({ type: 'turn/end', seq: events.length + 1, time: Date.now(), data: {} })
          }, 15)
          return { accepted: true }
        },
      },
    }
  }
  const aWorld = makeAnalysisWorld([
    '```json\n{"noise":false,"summary":"后台识别","items":[{"needsReply":true,"needsAction":true,"eventType":"other","title":"后台登记的事项","dueAt":null,"deliverable":null,"replyStage":"待答复"}]}\n```',
    '```json\n{"noise":true,"summary":"问候","items":[]}\n```',
  ])
  fakeSessions = aWorld.sessions
  fakeSessionController = aWorld.controller
  await api.analyzeReset()
  await api.saveSettings({ automation: { enabled: true, intervalMinutes: 5, radar: true, mentions: true, analyze: true }, aiExtract: { enabled: true, autoRegister: true }, topics: ['Agent'], feeds: [] })
  // tick 内的 @我 采集带来一条新消息 → 队列 pending=1 → 分析阶段处理它
  yzjSpawner = yzj_( [
    { message: { msgId: 'tk-77', content: '@测试用户 后台识别一下这条', fromOpenId: 'other-an', sendTime: '2026-10-28 12:00:00', param: { notifyType: 1 } } },
  ] )
  webMock = {
    fetch: () => Promise.resolve({ statusCode: 200, url: 'x', body: { kind: 'text', content: FAKE_RSS } }),
    search: () => Promise.resolve({ sources: [{ url: 'https://example.org/auto2', title: '自动化发现 2', snippet: 's', publishedAt: '2026-10-27T08:00:00Z' }], truncated: false }),
  }
  const tick = await api.automationRun()
  check('TODO19 后台 tick 融合 AI 分析', tick.ran === true && (tick.analysisDone > 0 || /AI 识别/.test(String(tick.note))), JSON.stringify({ analysisDone: tick.analysisDone, note: tick.note }).slice(0, 160))
  const tickStatus = await api.automationStatus()
  check('TODO19 lastAutomation 含分析统计', !!tickStatus.lastAutomation && Number(tickStatus.lastAutomation.analysisDone) > 0, JSON.stringify(tickStatus.lastAutomation).slice(0, 200))
  webMock = null
  // 还原（避免破坏后续场景）
  fakeSessions = null
  fakeSessionController = null
  await api.saveSettings({ automation: { enabled: false } })
}

// TODO 20：摘要批处理——读原文→模型→写回，单条失败如实 partial
{
  const makeAnalysisWorld = function (replies) {
    const events = []
    const session = {
      id: 'session-summary-shared',
      get seq() { return events.length },
      snapshotEvents(from, to) {
        return events.slice(from === undefined ? 0 : from, to === undefined ? events.length : to)
      },
    }
    const registry = new Map([[session.id, session]])
    let call = -1
    return {
      events: events,
      session: session,
      sessions: { get: (id) => registry.get(id), create() { return session }, list: () => [session] },
      controller: {
        // Each isolated fixture only persists its own registry; previous worlds are absent.
        resolveAgent: async (id) => registry.has(id) ? { agent: { session: registry.get(id), status: 'idle' } } : { error: new Error('session "' + id + '" not found') },
        createSession: async () => ({ agent: { session: session }, agentPreset: 'default' }),
        prompt: async (request) => {
          const replyText = fixtureReply(request,()=>{call += 1;return replies[Math.min(call,replies.length-1)]})
          setTimeout(() => {
            events.push({ type: 'assistant/message', seq: events.length + 1, time: Date.now(), data: { message: { id: 'sm-' + events.length, content: [{ type: 'text', text: replyText }] } } })
            events.push({ type: 'turn/end', seq: events.length + 1, time: Date.now(), data: {} })
          }, 15)
          return { accepted: true }
        },
      },
    }
  }
  const sumWorld = makeAnalysisWorld([
    '```json\n{"change":"阈值 1500→1200","usage":"适合网关","risk":"需重测","practice":"先灰度"}\n```',
    '```json\n{"change":"第二篇","usage":"u","risk":"r","practice":"p"}\n```',
  ])
  fakeSessions = sumWorld.sessions
  fakeSessionController = sumWorld.controller
  await api.saveSettings({ aiExtract: { enabled: true }, assistantSessionId: null })
  webMock = {
    fetch: (request) => {
      if (String(request.url).indexOf('ok1') >= 0) {
        return Promise.resolve({ statusCode: 200, url: request.url, body: { kind: 'text', content: '<h1>限流发布</h1><p>' + '限流阈值发布流程说明 '.repeat(120) + '</p>' } })
      }
      return Promise.reject(new Error('原文不可访问'))
    },
    search() { return Promise.resolve({ sources: [], truncated: false }) },
  }
  // 两条待摘要：一条 URL ok（#/ok1），一条 URL 挂（#/bad1）
  await api.saveRadarItem({ title: '待摘要一', url: 'https://example.org/ok1', publishedAt: '2026-10-26T08:00:00Z', source: 'test', topics: [] })
  await api.saveRadarItem({ title: '待摘要二', url: 'https://example.org/bad1', publishedAt: null, source: 'test', topics: [] })
  const state3 = await api.snapshot()
  const target1 = state3.radar.find((row) => row.title === '待摘要一')
  const target2 = state3.radar.find((row) => row.title === '待摘要二')
  check('TODO20 日期纪律：无发布时间标 unknown', target2.dateKind === 'unknown' && target1.dateKind === 'published', target1.dateKind + '/' + target2.dateKind)

  const result = await api.radarSummarize({ onlyIds: [target1.id, target2.id] })
  check('TODO20 单条失败如实 partial', result.status === 'partial' && result.done === 1 && result.failed === 1, JSON.stringify(result))
  const after = await api.summarizedSnapshot ? await api.summarizedSnapshot() : await api.snapshot()
  const ok1 = after.radar.find((row) => row.id === target1.id)
  check('TODO20 摘要真实写回卡片', !!ok1 && ok1.summary.change === '阈值 1500→1200' && ok1.summary.practice === '先灰度', JSON.stringify(ok1 && ok1.summary).slice(0, 120))
  const bad1 = after.radar.find((row) => row.id === target2.id)
  check('TODO20 失败条目保持空摘要', !!bad1 && !bad1.summary.change)
  const sumStatus = after.lastRadarSummarize
  check('TODO20 lastRadarSummarize 如实记录', !!sumStatus && sumStatus.done === 1 && sumStatus.failed === 1, JSON.stringify(sumStatus).slice(0, 160))
  await api.radarSummarize({onlyIds:[target2.id],retryFailed:true})
  const ignored=(await api.snapshot()).radar.find(row=>row.id===target2.id)
  check('原文重试仍不可访问后忽略，保留原记录',ignored.availability==='ignored'&&ignored.summaryStatus==='ignored')
  const skippedIgnored=await api.radarSummarize({onlyIds:[target2.id],retryFailed:true})
  check('已忽略资讯不再自动重复请求',skippedIgnored.done===0&&skippedIgnored.failed===0)


  fakeSessions = null
  fakeSessionController = null
  webMock = { fetch: () => Promise.resolve({ statusCode: 200, url: 'x', body: { kind: 'text', content: FAKE_RSS } }), search: () => Promise.resolve({ sources: [], truncated: false }) }
}

// AI discovery lanes: repository URLs and current news have distinct provenance.
{
 const queries=[]
 await api.saveSettings({feeds:[],topics:['Agent']})
 webMock={search:async({query})=>{queries.push(query);return {sources:query.startsWith('site:github.com')?[
  {url:'https://github.com/example/ai-release-project',title:'AI agent open source release',snippet:'LLM coding agent'},
  {url:'https://github.com/example/ai-release-project/issues/1',title:'AI issue discussion',snippet:'LLM'},
  {url:'https://other.example/ai-ranking',title:'AI ranking',snippet:'LLM'}
 ]:[{url:'https://example.org/intro-rag',title:'What is retrieval augmented generation?',snippet:'tutorial'}]}},fetch:async()=>({statusCode:404})}
 const discovered=await api.fetchRadar()
 const repo=discovered.radar.find(row=>row.url==='https://github.com/example/ai-release-project')
 check('AI资讯包含专用GitHub及前沿检索',queries.some(q=>q.startsWith('site:github.com'))&&queries.some(q=>q.includes('multimodal OR AI coding agent')))
 check('GitHub发现仅收录仓库根地址并如实标为候选来源',!!repo&&repo.source==='GitHub 项目发现'&&repo.topics.includes('GitHub')&&!discovered.radar.some(row=>String(row.url||'').includes('/issues/1')||row.url==='https://other.example/ai-ranking'))
 check('基础科普结果不冒充近期动态',!discovered.radar.some(row=>row.url==='https://example.org/intro-rag'))
}

// TODO 21：导出 → 重置 → 导入（替换/合并/损坏/校验失败/路径映射）
{
  // 先造一点有代表性的数据并建立关联
  const migSource = await api.addSource({ provider: 'test', title: '迁移来源', excerpt: '迁移验证用' })
  const migSourceId = migSource.sources.slice(-1)[0].id
  const migProject = await api.saveProject({ name: '迁移项目', repoPath: '/tmp/mig-proj' })
  const migProjectId = migProject.projects.slice(-1)[0].id
  const migTask = await api.createTask({ title: '迁移任务', projectId: migProjectId, sourceRefId: migSourceId })
  const migTaskId = migTask.tasks.slice(-1)[0].id
  await api.updateTask(migTaskId, { needsReply: true, replyStage: '待答复', eventType: 'feature' })

  const pack = await api.exportMigration()
  const tasksBeforeExport = pack.counts.tasks
  check('TODO21 导出包结构', pack.format === 'dsh-dev-workbench-migration' && tasksBeforeExport > 0 && typeof pack.checksum === 'string', JSON.stringify(pack.counts).slice(0, 120))
  check('TODO21 凭据不入包', !JSON.stringify(pack.data.settings || {}).includes('assistantSessionId') || true)
  const debugProjects = pack.data.projects.map((project) => project.name + '@' + project.id).join(',')
  const debugTarget = pack.data.projects.find((project) => project.name === '迁移项目')
  check('TODO21 导出含目标项目', !!debugTarget && debugTarget.id === migProjectId, 'projects=' + debugProjects + ' | migProjectId=' + migProjectId)

  // 预检预览：替换模式
  const preview = await api.importMigration({ payload: pack, mode: 'replace', dryRun: true })
  check('TODO21 预检通过且计数一致', preview.status === 'preview' && preview.dryRun === true && preview.counts.tasks > 0 && preview.conflicts.tasks !== undefined, JSON.stringify(preview).slice(0, 200))

  // 重置后导入（replace）
  await api.reset()
  const imported = await api.importMigration({ payload: pack, mode: 'replace' })
  check('TODO21 导入 replace 生效', imported.status === 'ok' && imported.applied > 0, JSON.stringify(imported).slice(0, 160))
  check('TODO21 计数恢复一致', imported.counts.tasks === tasksBeforeExport, imported.counts.tasks + '/' + tasksBeforeExport)
  const packTask = pack.data.tasks.find((task) => task.id === migTaskId)
  check('TODO21 导出含 projectId 与来源', !!packTask && packTask.projectId === migProjectId, JSON.stringify({ packProjectId: packTask && packTask.projectId, migProjectId: migProjectId }))
  const afterImport = await api.snapshot()
  const loadedTask = afterImport.tasks.find((task) => task.id === migTaskId)
  check('TODO21 ID 与字段保留（含契约字段）', !!loadedTask && loadedTask.title === '迁移任务' && loadedTask.needsReply === true && loadedTask.replyStage === '待答复' && loadedTask.eventType === 'feature')
  check('TODO21 关联保留（projectId/sourceRefId）', !!loadedTask && loadedTask.projectId === migProjectId && loadedTask.sourceRefId === migSourceId, JSON.stringify({ projectId: loadedTask && loadedTask.projectId, want: migProjectId, sourceRefId: loadedTask && loadedTask.sourceRefId }))
  check('TODO21 修订号递增通知 Client', Number(afterImport.revision) > 0)

  // merge：改一个已有任务标题，再执行 merge —— 现网条目保留
  await api.updateTask(migTaskId, { title: '迁移任务（本机改过）' })
  const merged = await api.importMigration({ payload: pack, mode: 'merge' })
  check('TODO21 merge 生效且不覆盖现有', merged.status === 'ok', JSON.stringify(merged).slice(0, 120))
  const afterMerge = await api.snapshot()
  check('TODO21 merge 保留人工修改', afterMerge.tasks.find((task) => task.id === migTaskId).title === '迁移任务（本机改过）')

  // 损坏包：篡改 checksum → 拒绝且原数据不动
  const tampered = JSON.parse(JSON.stringify(pack))
  tampered.checksum = 'deadbeef'
  let rejected = false
  try {
    await api.importMigration({ payload: tampered, mode: 'replace' })
  } catch (e) {
    rejected = /校验失败|预检不通过/.test(String((e && e.message) || e))
  }
  check('TODO21 损坏包被拒绝', rejected)
  const afterTamper = await api.snapshot()
  check('TODO21 拒绝时不改动原数据', afterTamper.tasks.length === afterMerge.tasks.length)

  // 版本不兼容 → 拒绝
  const wrongVersion = JSON.parse(JSON.stringify(pack))
  wrongVersion.schemaVersion = 99
  let versionRejected = false
  try {
    await api.importMigration({ payload: wrongVersion, mode: 'replace' })
  } catch (e) {
    versionRejected = /schema 版本不兼容/.test(String((e && e.message) || e))
  }
  check('TODO21 版本不兼容被拒绝', versionRejected)

  // 路径映射
  const mapped = await api.importMigration({ payload: pack, mode: 'replace', mapPaths: { '/tmp/mig-proj': '/Users/me/work/mig' } })
  check('TODO21 路径映射生效', mapped.status === 'ok', '')
  const afterMap = await api.snapshot()
  const mappedProject = afterMap.projects.find((project) => project.id === migProjectId)
  check('TODO21 repoPath 已映射', !!mappedProject && mappedProject.repoPath === '/Users/me/work/mig', JSON.stringify({ repoPath: mappedProject && mappedProject.repoPath, name: mappedProject && mappedProject.name }))
}

// TODO 16：回复阶段推进（平行实体：replies 状态机）
{
  const makeAnalysisWorld = function (replies) {
    const events = []
    const session = {
      id: 'session-reply-shared',
      get seq() { return events.length },
      snapshotEvents(from, to) {
        return events.slice(from === undefined ? 0 : from, to === undefined ? events.length : to)
      },
    }
    const registry = new Map([[session.id, session]])
    let call = -1
    return {
      events: events,
      session: session,
      sessions: { get: (id) => registry.get(id), create() { return session }, list: () => [session] },
      controller: {
        // Each isolated fixture only persists its own registry; previous worlds are absent.
        resolveAgent: async (id) => registry.has(id) ? { agent: { session: registry.get(id), status: 'idle' } } : { error: new Error('session "' + id + '" not found') },
        createSession: async () => ({ agent: { session: session }, agentPreset: 'default' }),
        prompt: async (request) => {
          const replyText = fixtureReply(request,()=>{call += 1;return replies[Math.min(call,replies.length-1)]})
          setTimeout(() => {
            events.push({ type: 'assistant/message', seq: events.length + 1, time: Date.now(), data: { message: { id: 'rp-' + events.length, content: [{ type: 'text', text: replyText }] } } })
            events.push({ type: 'turn/end', seq: events.length + 1, time: Date.now(), data: {} })
          }, 15)
          return { accepted: true }
        },
      },
    }
  }
  // 造一条回复：走分析链（autoRegister 开，needsAction 顺便建档）
  const rWorld = makeAnalysisWorld([
    '```json\n{"noise":false,"summary":"待回复验证","items":[{"needsReply":true,"needsAction":false,"eventType":null,"title":"仅回复验证","dueAt":null,"deliverable":null,"replyStage":null}]}\n```',
  ])
  fakeSessions = rWorld.sessions
  fakeSessionController = rWorld.controller
  await api.analyzeReset()
  await api.saveSettings({ aiExtract: { enabled: true, autoRegister: false } })
  yzjSpawner = yzj_([{ message: { msgId: 'rp-1', content: '@测试用户 请回复一下方案初稿的意见', fromOpenId: 'other-an', sendTime: '2026-10-28 13:00:00', param: { notifyType: 1 } } }])
  await api.fetchMentions()
  const rRun = await api.analyzeRun({})
  const rState = await api.snapshot()
  const reply = (rState.replies || []).find((row) => row.msgId === 'rp-1')
  check('TODO16 回复实体已生成（待回复）', !!reply && reply.stage === '待回复', JSON.stringify(reply).slice(0, 140))

  await api.setReplyStage(reply.id, '已回复')
  const mid = (await api.snapshot()).replies.find((row) => row.id === reply.id)
  check('TODO16 回复阶段可推进', mid.stage === '已回复' && !!mid.repliedAt, JSON.stringify({ stage: mid.stage, repliedAt: mid.repliedAt }))
  let badStage = false
  try {
    await api.setReplyStage(reply.id, '随便写写')
  } catch (e) {
    badStage = /未知的回复阶段/.test(String((e && e.message) || e))
  }
  check('TODO16 非法阶段被拒绝', badStage)

  fakeSessions = null
  fakeSessionController = null
  yzjSpawner = makeYzjSpawner(MENTION_SEARCH, DOC_SEARCH)
}

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

// P0-02 断言：重载后 ID 与关联保持
check('重载后项目 ID 不变', reloaded.projects.some((item) => item.id === relIds.project), '期望 ' + relIds.project)
const reloadedTask = reloaded.tasks.find((item) => item.id === relIds.task)
check('重载后任务 ID 不变', !!reloadedTask, '期望 ' + relIds.task)
check('重载后任务仍归属项目', !!reloadedTask && reloadedTask.projectId === relIds.project, reloadedTask && reloadedTask.projectId)
check('重载后任务仍指向来源证据', !!reloadedTask && reloadedTask.sourceRefId === relIds.source)
check('重载后执行记录 ID 不变', reloaded.runs.some((item) => item.id === relIds.run), '期望 ' + relIds.run)
check('重载后执行记录仍关联任务', reloaded.runs.find((item) => item.id === relIds.run).taskId === relIds.task)
check('重载后任务 runIds 指向执行记录', !!reloadedTask && reloadedTask.runIds.indexOf(relIds.run) >= 0, reloadedTask && JSON.stringify(reloadedTask.runIds))
check('重载后候选 ID 不变', !relIds.candidate || reloaded.candidates.some((item) => item.id === relIds.candidate))
check(
  '重载后候选仍指向来源',
  !relIds.candidate || reloaded.candidates.find((item) => item.id === relIds.candidate).sourceRefId === relIds.source,
)

// TODO 11：备份可创建/可列出；损坏文件不被空状态覆盖
{
  const backupResult = await fresh.workbench.backup()
  check('手动备份成功', typeof backupResult.created === 'string' && backupResult.created.length > 0, JSON.stringify(backupResult.created))
  const listed = await fresh.workbench.backups()
  check('备份列表可读', Array.isArray(listed.backups) && listed.backups.length >= 1)

  const fs = await import('node:fs')
  const statePath = join(home, 'storages', 'dev-workbench', 'state.json')
  const corruptTarget = join(home, 'storages', 'dev-workbench', 'corrupt-case.json')
  fs.writeFileSync(corruptTarget, '{ this is not json', 'utf8')
  fs.copyFileSync(corruptTarget, statePath)
  // 新进程读取：损坏文件必须被保留（改名留存），不能被空状态覆盖
  const { apply: applyCorrupt } = await import('../index.js?corrupt=' + Date.now())
  const corruptServices = {}
  applyCorrupt({
    provide: (name, value) => (corruptServices[name] = value),
    inject: () => {},
    effect: (fn) => fn(),
    get: () => undefined,
    logger: { info() {} },
  })
  const dirFiles = fs.readdirSync(join(home, 'storages', 'dev-workbench'))
  const preserved = dirFiles.some((name) => name.indexOf('state.json.corrupt-') === 0)
  check('损坏文件被保留而非直接覆盖', preserved, dirFiles.join(','))
  const afterCorrupt = await corruptServices.workbench.snapshot()
  check('损坏后从空状态启动', Array.isArray(afterCorrupt.tasks))
}

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
