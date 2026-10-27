/* ============================================================================
 * dev-workbench host — persistence
 *
 * One in-memory authoritative document, flushed atomically on every mutation.
 * Reads are lazy (first use wins), so a profile that never opens the workbench
 * never touches the disk.
 * ========================================================================== */

let workbenchCachedState = null
let workbenchLoadNote = null

function loadWorkbenchState() {
  if (workbenchCachedState) return workbenchCachedState
  const path = workbenchStatePath()
  const raw = readJsonFile(path)
  const result = normalizeState(raw)
  if (result.corrupt) {
    // 损坏保护（TODO 11）：先把原文件原样改名留存，**绝不**用空状态直接覆盖它。
    // 内存里从空状态起步；只有在用户后续真正写入时才落新文件，原损坏文件仍可人工恢复。
    let preserved = null
    try {
      preserved = path + '.corrupt-' + hostNowIso().replace(/[:.]/g, '-') + '.json'
      renameSync(path, preserved)
    } catch (e) {
      preserved = null
    }
    workbenchLoadNote =
      'state.json 无法解析，已从空状态启动' + (preserved ? '；原文件已保留为 ' + preserved : '') + '：' + result.corrupt
    workbenchCachedState = result.state
    return workbenchCachedState
  }
  if (!raw) {
    workbenchLoadNote = '首次运行，已创建空状态：' + path
  } else if (result.migrated) {
    workbenchLoadNote = '已将 state.json 迁移到 schema v' + HOST_STATE_VERSION
  }
  workbenchCachedState = result.state
  if (!raw || result.migrated) saveWorkbenchState(workbenchCachedState)
  return workbenchCachedState
}

/* ---------------------------------------------------------------------------
 * 备份与恢复（TODO 11）：每天首次写入前留一份快照，保留最近 5 份；
 * 支持手动备份/列出/恢复。恢复后清空内存缓存，下一次读取重新从文件加载。
 * ------------------------------------------------------------------------- */
const BACKUP_KEEP = 5

function backupDir() {
  return join(workbenchDir(), 'backups')
}

function listBackups() {
  const dir = backupDir()
  try {
    return readdirSync(dir)
      .filter(function (name) {
        return name.endsWith('.json')
      })
      .sort()
      .reverse()
      .map(function (name) {
        return { id: name, path: join(dir, name), bytes: fileSizeOf(join(dir, name)) }
      })
  } catch (e) {
    return []
  }
}

function createBackup(reason) {
  const source = workbenchStatePath()
  if (!existsSync(source)) return null
  const stamp = hostNowIso().replace(/[:.]/g, '-')
  const target = join(backupDir(), 'state-' + stamp + (reason ? '-' + reason : '') + '.json')
  try {
    mkdirSync(backupDir(), { recursive: true })
    writeFileSync(target, readFileSync(source), 'utf8')
  } catch (e) {
    return null
  }
  // 只保留最近 N 份
  const all = listBackups()
  all.slice(BACKUP_KEEP).forEach(function (item) {
    try {
      renameSync(item.path, item.path + '.trash')
    } catch (e) {
      /* 尽力而为 */
    }
  })
  listBackups().forEach(function (item) {
    if (item.id.endsWith('.trash')) return
  })
  return target
}

/** 恢复某份备份：先备份当前文件，再用备份覆盖，最后清空缓存。 */
function restoreBackup(id) {
  const safeId = asString(id, 120)
  const candidate = listBackups().find(function (item) {
    return item.id === safeId
  })
  if (!candidate) throw new Error('找不到该备份：' + safeId)
  createBackup('pre-restore')
  writeFileSync(workbenchStatePath(), readFileSync(candidate.path), 'utf8')
  workbenchCachedState = null
  workbenchLoadNote = '已从备份恢复：' + safeId
  return loadWorkbenchState()
}

let lastAutoBackupDay = null

function saveWorkbenchState(state, options) {
  const opts = options || {}
  if (!opts.skipBackup && existsSync(workbenchStatePath())) {
    const today = hostNowIso().slice(0, 10)
    if (lastAutoBackupDay !== today) {
      lastAutoBackupDay = today
      createBackup('auto-' + today)
    }
  }
  state.version = HOST_STATE_VERSION
  state.updatedAt = hostNowIso()
  // 业务修订号（与 schema version 区分）：单调递增，Client 用它判断快照新旧，
  // 避免旧快照覆盖新数据（AI-COMMAND-EXECUTION §4）。schema 版本不能当并发号用。
  state.revision = (Number(state.revision) || 0) + 1
  writeJsonAtomic(workbenchStatePath(), state)
  workbenchCachedState = state
  return state
}

async function mutateWorkbenchState(mutator) {
  const state = loadWorkbenchState()
  const replacement = await mutator(state)
  const next = replacement && typeof replacement === 'object' && replacement.version ? replacement : state
  return saveWorkbenchState(next)
}

/** 查幂等键对应的历史操作（工具重试时直接返回原结果）。 */
function findOperation(state, key) {
  if (!key) return null
  return ensureArray(state.operations).find(function (operation) {
    return operation.key === key
  }) || null
}

/** 记一条操作账本（cap 200，按时间淘汰）。 */
function recordOperation(state, entry) {
  state.operations = ensureArray(state.operations)
    .concat([
      {
        key: asString(entry.key, 160),
        tool: asString(entry.tool, 60),
        at: hostNowIso(),
        entityIds: ensureArray(entry.entityIds).slice(0, 10),
        status: asString(entry.status, 20) || 'succeeded',
      },
    ])
    .slice(-OPERATION_LIMIT)
  return state
}

function workbenchAudit(event, summary) {
  mutateWorkbenchState(function (state) {
    auditEntry(state, event, summary)
    return state
  })
}

function workbenchCounts(state) {
  return {
    tasks: ensureArray(state.tasks).length,
    runs: ensureArray(state.runs).length,
    knowledge: ensureArray(state.knowledge).length,
    radar: ensureArray(state.radar).length,
    sources: ensureArray(state.sources).length,
    knowledgeSnippets: ensureArray(state.knowledge).filter(function (item) {
      return item.kind === 'snippet'
    }).length,
  }
}
