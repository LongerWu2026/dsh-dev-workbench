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
    workbenchLoadNote = 'state.json 无法解析，已回退为空状态：' + result.corrupt
    workbenchCachedState = result.state
    saveWorkbenchState(workbenchCachedState)
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

function saveWorkbenchState(state) {
  state.version = HOST_STATE_VERSION
  state.updatedAt = hostNowIso()
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
