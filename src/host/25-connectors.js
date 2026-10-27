/* ============================================================================
 * dev-workbench host — connector probe
 *
 * A Connector row is a claim about what this Host can actually do right now.
 * Everything reported here is measured: a binary resolves or it does not, a
 * service exists on the context or it does not. Enterprise systems the design
 * report wants (云之家 / 企业搜索) stay `unconfigured` with an explanation —
 * the report's §6.3 capability checklist has to be answered against the real
 * CLI before a row may claim otherwise.
 * ========================================================================== */

const CONNECTOR_TTL_MS = 60 * 1000

function probeExecutable(ctx, command) {
  const subprocess = ctx.get ? ctx.get('subprocess') : ctx.subprocess
  if (!subprocess || typeof subprocess.resolveExecutable !== 'function') {
    return Promise.resolve(null)
  }
  let signal
  try {
    signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined
  } catch (e) {
    signal = undefined
  }
  return Promise.resolve()
    .then(function () {
      return subprocess.resolveExecutable(command, undefined, signal)
    })
    .then(function (resolved) {
      return typeof resolved === 'string' && resolved.length > 0 ? resolved : null
    })
    .catch(function () {
      return null
    })
}

async function detectConnectors(ctx) {
  const at = hostNowIso()
  const rows = []

  rows.push({
    id: 'local-storage',
    type: 'storage',
    label: '本地持久化',
    capabilities: ['原子写入', '快照', 'schema v' + HOST_STATE_VERSION],
    authState: 'ok',
    updatedAt: at,
    note: workbenchStatePath(),
  })

  rows.push({
    id: 'host-runtime',
    type: 'runtime',
    label: 'Host 运行时',
    capabilities: [HOST_META.platform, HOST_META.arch, 'node ' + HOST_META.nodeVersion],
    authState: 'ok',
    updatedAt: at,
    note: '状态与 Remote 端点由 Host 持有，前端只读快照。',
  })

  const gitPath = await probeExecutable(ctx, 'git')
  rows.push({
    id: 'git',
    type: 'vcs',
    label: 'Git',
    capabilities: gitPath ? ['版本库读取（只读）'] : [],
    authState: gitPath ? 'ok' : 'unconfigured',
    updatedAt: at,
    note: gitPath ? gitPath : '未在 PATH 中找到 git；接入前不显示仓库状态。',
  })

  const dockerPath = await probeExecutable(ctx, 'docker')
  rows.push({
    id: 'docker',
    type: 'container',
    label: 'Docker',
    capabilities: dockerPath ? ['容器状态（只读）'] : [],
    authState: dockerPath ? 'ok' : 'unconfigured',
    updatedAt: at,
    note: dockerPath ? dockerPath : '未在 PATH 中找到 docker；只读诊断能力待接入。',
  })

  const web = ctx.get ? ctx.get('web') : ctx.web
  rows.push({
    id: 'web',
    type: 'network',
    label: '外网检索',
    capabilities: web ? ['search', 'fetch'] : [],
    authState: web ? 'ok' : 'unconfigured',
    updatedAt: at,
    note: web ? '经 Host 的 web 服务调用，结果需标注来源与时间。' : '当前 profile 未组合 web 服务。',
  })

  // 云之家：真实能力发现（§6.3）。whoami 通了才算「已连接」，
  // 能力列表是这里实际调过的命令；token 快过期时给「待授权」。
  const yzProbe = await probeYunzhijia(ctx)
  const yzCapabilities = []
  if (yzProbe.state === 'ok') {
    yzCapabilities.push('IM @我 检索', '跨群消息搜索', '知识库标题搜索')
    if (yzProbe.expiresAt) {
      const expires = new Date(yzProbe.expiresAt).getTime()
      if (Number.isFinite(expires) && expires - Date.now() < 60 * 60 * 1000) {
        yzCapabilities.push('token 1 小时内到期')
      }
    }
  }
  rows.push({
    id: 'yunzhijia',
    type: 'enterprise-im',
    label: '云之家',
    capabilities: yzCapabilities,
    authState:
      yzProbe.state === 'ok' ? 'ok' : yzProbe.state === 'unauthorized' ? 'unauthorized' : 'unconfigured',
    updatedAt: at,
    note:
      yzProbe.state === 'ok'
        ? '以 ' + yzProbe.name + ' 身份只读调用 yzj-cli（whoami 已验证）。能力=消息搜索 / 文档搜索 / @我 检索；发送/审批/删除等写操作不在插件内，留在会话里走逐次审批。' +
          (yzProbe.expiresAt ? ' token 至 ' + yzProbe.expiresAt.slice(0, 16).replace('T', ' ') + '。' : '')
        : yzProbe.state === 'unauthorized'
          ? 'yzj-cli 需要重新认证：运行 yzj-cli auth login 后再刷新。'
          : yzProbe.note || '未找到 yzj-cli，保持未配置。',
  })

  return rows
}

async function refreshConnectors(ctx, state) {
  const existing = ensureArray(state.connectors)
  const newest = existing.reduce(function (latest, item) {
    const stamp = item && item.updatedAt ? new Date(item.updatedAt).getTime() : 0
    return Number.isFinite(stamp) && stamp > latest ? stamp : latest
  }, 0)
  if (existing.length > 0 && Date.now() - newest < CONNECTOR_TTL_MS) {
    return state
  }
  const rows = await detectConnectors(ctx)
  return mutateWorkbenchState(function (current) {
    current.connectors = rows
    return current
  })
}
