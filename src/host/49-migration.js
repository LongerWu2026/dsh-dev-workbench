/* ============================================================================
 * dev-workbench host — 数据迁移（TODO 21）
 *
 * 导出：一致性快照（内存数据 + 计数）+ format/schema/pluginVersion + sha256 校验。
 *  凭据与原生会话历史不入包；settings 属机器配置，默认不在 data 内。
 *
 * 导入：先预检（dryRun）——checksum / 版本 / 计数 / ID 冲突 / 路径映射，
 *  然后 createBackup('pre-import') 再原子 mutate 提交；提交失败不改动原数据，
 *  事务抛错由 mutate 的「先校验后写入」语义保证不落半截修改。
 *
 * 两种模式：
 *   replace —— 整体替换记录集合（项目/任务/来源/执行/知识/雷达/候选），
 *              记录以自身为 base 归一化，ID 与关联保留；项目 repoPath 可映射。
 *   merge   —— 按 ID 去重并入：已存在 = 保留现网数据；不存在 = 引入。
 *
 * 提交后业务修订号递增，Client 靠 revision 轮询自动对齐。
 * ========================================================================== */

const MIGRATION_FORMAT = 'dsh-dev-workbench-migration'
const MIGRATION_FORMAT_VERSION = 1
const MIGRATION_COLUMNS = ['projects', 'tasks', 'sources', 'runs', 'knowledge', 'radar', 'candidates']
const PLUGIN_EXPORT_VERSION = '0.1.0'

/** 键序稳定的字符串化（校验和以此为基）。 */
function migrationStableStringify(value) {
  return JSON.stringify(value, function (key, inner) {
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      return Object.keys(inner)
        .sort()
        .reduce(function (acc, sortedKey) {
          acc[sortedKey] = inner[sortedKey]
          return acc
        }, {})
    }
    return inner
  })
}

function migrationChecksum(data) {
  return createHash('sha256').update(migrationStableStringify(data)).digest('hex')
}

/** 一致性快照导出。settings 需要时可显式 includeSettings=true（仍不含会话/凭据类）。 */
function buildMigrationPackage(includeSettings) {
  const state = loadWorkbenchState()
  const data = {}
  const counts = {}
  for (const column of MIGRATION_COLUMNS) {
    const rows = ensureArray(state[column])
    data[column] = rows
    counts[column] = rows.length
  }
  if (includeSettings) {
    const clone = Object.assign({}, state.settings)
    // 凭据/机器绑定类不入包
    delete clone.assistantSessionId
    data.settings = clone
  }
  return {
    format: MIGRATION_FORMAT,
    version: MIGRATION_FORMAT_VERSION,
    schemaVersion: HOST_STATE_VERSION,
    pluginVersion: PLUGIN_EXPORT_VERSION,
    exportedAt: hostNowIso(),
    counts: counts,
    data: data,
    checksum: migrationChecksum(data),
  }
}

/** 预检一个迁移包：结构、校验、版本、ID 冲突预览与路径映射预览。 */
function migrationPrecheck(payload, request, currentState) {
  const issues = []
  if (!payload || typeof payload !== 'object') issues.push('迁移包不是对象')
  if (payload && payload.format !== MIGRATION_FORMAT) issues.push('格式不识别：' + String(payload.format))
  if (payload && Number(payload.version) !== MIGRATION_FORMAT_VERSION) {
    issues.push('迁移包版本不支持：' + String(payload.version))
  }
  if (payload && Number(payload.schemaVersion) !== HOST_STATE_VERSION) {
    issues.push('schema 版本不兼容（包 ' + String(payload.schemaVersion) + '，当前 ' + HOST_STATE_VERSION + '）')
  }
  const data = payload && payload.data
  const counts = {}
  if (data && typeof data === 'object') {
    if (migrationChecksum(data) !== payload.checksum) issues.push('校验失败：内容与 checksum 不一致（可能损坏或被改动）')
    for (const column of MIGRATION_COLUMNS) {
      const rows = ensureArray(data[column])
      counts[column] = rows.length
      if (column === 'tasks') {
        const ids = rows.map(function (row) { return String((row && row.id) || '') })
        if (new Set(ids).size !== ids.length) issues.push('迁移包内任务存在重复 ID')
      }
    }
  } else if (payload && !issues.some(function (issue) { return issue.indexOf('格式不识别') >= 0 })) {
    issues.push('缺少 data 数据块')
  }

  const mapPaths = request && request.mapPaths && typeof request.mapPaths === 'object' ? request.mapPaths : {}
  const mappedProjects = []
  if (data && Array.isArray(data.projects)) {
    for (const project of data.projects) {
      const from = String((project && project.repoPath) || '')
      mappedProjects.push({
        id: String((project && project.id) || ''),
        name: String((project && project.name) || ''),
        from: from,
        to: mapPaths[from] || from,
        mapped: Boolean(mapPaths[from]),
      })
    }
  }

  const existingIds = {}
  for (const column of MIGRATION_COLUMNS) {
    existingIds[column] = new Set(
      ensureArray(currentState[column]).map(function (row) { return String((row && row.id) || '') }),
    )
  }
  const conflicts = {}
  let incomingNew = 0
  if (data && typeof data === 'object' && issues.length === 0) {
    for (const column of MIGRATION_COLUMNS) {
      const rows = ensureArray(data[column])
      const clash = rows.filter(function (row) {
        return existingIds[column].has(String((row && row.id) || ''))
      }).length
      conflicts[column] = clash
      incomingNew += rows.length
    }
  }

  return {
    issues: issues,
    countsByColumn: counts,
    conflictsByColumn: mode(request) === 'merge' ? conflicts : counts,
    mappedProjects: mappedProjects,
    incomingTotal: incomingNew,
  }

  function mode(request) {
    return request && request.mode === 'merge' ? 'merge' : 'replace'
  }
}

/**
 * 从记录行重建（保留 ID 与关联）：以记录自身为 base 归一化。
 */
function migrationNormalizeRow(column, raw) {
  if (!raw || typeof raw !== 'object') return raw
  if (column === 'projects') return normalizeProject(raw, raw)
  if (column === 'tasks') return normalizeTask(raw, raw)
  if (column === 'runs') return normalizeRun(raw, raw)
  if (column === 'knowledge') return normalizeKnowledge(raw, raw)
  if (column === 'candidates') return normalizeCandidate(raw, raw)
  return raw
}

/** 应用导入（dryRun 只预览；成功后修订号自动递增、Client 自动同步）。 */
function applyMigration(request) {
  const payload = request && typeof request === 'object' ? request.payload : null
  const mode = request && request.mode === 'merge' ? 'merge' : 'replace'
  const mapPaths = request && request.mapPaths && typeof request.mapPaths === 'object' ? request.mapPaths : {}
  const includeSettings = request && request.includeSettings === true

  const state0 = loadWorkbenchState()
  const precheck = migrationPrecheck(payload, request, state0)
  if (precheck.issues.length > 0) {
    const error = new Error('迁移包预检不通过：' + precheck.issues.join('；'))
    error.userFacing = true
    throw error
  }

  mutateWorkbenchState(function (state) {
    // 备份总是先做（提交前的最后一道保护）
    createBackup('pre-import')
    const data = payload.data || {}
    for (const column of MIGRATION_COLUMNS) {
      const incoming = ensureArray(data[column]).map(function (row) {
        const mapped = migrationNormalizeRow(column, row)
        if (mode === 'merge') {
          const exists = ensureArray(state[column]).some(function (row2) {
            return String(row2.id) === String(mapped.id)
          })
          if (exists) return null
        }
        return mapped
      })
      const rows = incoming.filter(function (row) { return row !== null })
      if (column === 'projects' && rows.length > 0) {
        // 项目路径映射
        for (const project of rows) {
          const from = String(project.repoPath || '')
          if (from && mapPaths[from]) project.repoPath = mapPaths[from]
        }
      }
      if (mode === 'replace') {
        state[column] = rows
      } else {
        state[column] = ensureArray(state[column]).concat(rows)
      }
    }
    if (includeSettings && data.settings) {
      state.settings = normalizeSettings(Object.assign({}, state.settings, data.settings))
    }
    auditEntry(state, 'migration.applied', '导入 ' + mode + '：' + precheck.incomingTotal + ' 条')
    return state
  })

  const fresh = loadWorkbenchState()
  return {
    status: 'ok',
    mode: mode,
    applied: precheck.incomingTotal,
    counts: precheck.countsByColumn,
    conflicts: precheck.conflictsByColumn,
    mappedProjects: precheck.mappedProjects,
    revision: Number(fresh.revision) || 0,
  }
}
