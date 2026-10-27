/* ============================================================================
 * dev-workbench host — unified search orchestration
 *
 * Design report §3.3: several providers, each with its own capability and its
 * own failure mode; a single source failing must return partial results, and an
 * answer without sources must not be presented as fact.
 *
 * This module therefore returns GROUPS, not a flat list: every group carries
 * its own `status` (`ok` / `empty` / `unavailable` / `error`) and the reason, so
 * the UI can say "互联网这一路没查成" instead of silently showing fewer rows.
 * The plugin never summarises with a model here — that stays an Agent job, so
 * no search result is ever turned into an unsourced claim.
 * ========================================================================== */

const SEARCH_GROUP_LIMIT = 20

function searchNeedle(value) {
  return asString(value, 200).toLowerCase()
}

function matchesText(haystack, needle) {
  if (!needle) return false
  return String(haystack || '').toLowerCase().indexOf(needle) >= 0
}

function searchSnippet(text, needle, fallback) {
  const source = String(text || fallback || '')
  if (!source) return ''
  if (!needle) return source.slice(0, 160)
  const index = source.toLowerCase().indexOf(needle)
  if (index < 0) return source.slice(0, 160)
  const start = Math.max(0, index - 50)
  return (start > 0 ? '…' : '') + source.slice(start, start + 160)
}

function searchLocalGroups(state, query) {
  const needle = searchNeedle(query)
  const groups = []

  const tasks = ensureArray(state.tasks)
    .filter(function (task) {
      return (
        matchesText(task.title, needle) ||
        matchesText(task.description, needle) ||
        asTags(task.tags).some(function (tag) {
          return matchesText(tag, needle)
        })
      )
    })
    .slice(0, SEARCH_GROUP_LIMIT)
    .map(function (task) {
      return {
        id: task.id,
        title: task.title,
        snippet: searchSnippet(task.description, needle, task.title),
        url: null,
        kind: 'task',
        extra: {
          status: task.status,
          priority: task.priority,
          dueAt: task.dueAt,
          projectId: task.projectId,
          tags: task.tags,
          at: task.dueAt || task.updatedAt || task.createdAt,
        },
      }
    })

  const knowledge = ensureArray(state.knowledge)
    .filter(function (item) {
      return (
        matchesText(item.title, needle) ||
        matchesText(item.body, needle) ||
        asTags(item.tags).some(function (tag) {
          return matchesText(tag, needle)
        })
      )
    })
    .slice(0, SEARCH_GROUP_LIMIT)
    .map(function (item) {
      return {
        id: item.id,
        title: item.title,
        snippet: searchSnippet(item.body, needle, item.title),
        url: item.url || null,
        kind: 'knowledge',
        extra: { kind: item.kind, tags: item.tags, at: item.createdAt },
      }
    })

  const radar = ensureArray(state.radar)
    .filter(function (item) {
      const summary = item.summary || {}
      return (
        matchesText(item.title, needle) ||
        matchesText(item.source, needle) ||
        matchesText(summary.change, needle) ||
        matchesText(summary.usage, needle) ||
        matchesText(summary.risk, needle) ||
        matchesText(summary.practice, needle)
      )
    })
    .slice(0, SEARCH_GROUP_LIMIT)
    .map(function (item) {
      const summary = item.summary || {}
      return {
        id: item.id,
        title: item.title,
        snippet: searchSnippet([summary.change, summary.usage].filter(Boolean).join(' '), needle, item.title),
        url: item.url || null,
        kind: 'radar',
        extra: {
          source: item.source,
          topics: item.topics,
          publishedAt: item.publishedAt,
          at: item.publishedAt || item.updatedAt || item.createdAt,
        },
      }
    })

  const sources = ensureArray(state.sources)
    .filter(function (item) {
      return matchesText(item.title, needle) || matchesText(item.excerpt, needle) || matchesText(item.provider, needle)
    })
    .slice(0, SEARCH_GROUP_LIMIT)
    .map(function (item) {
      return {
        id: item.id,
        title: item.title,
        snippet: searchSnippet(item.excerpt, needle, item.title),
        url: item.url || null,
        kind: 'source',
        extra: { provider: item.provider, fetchedAt: item.fetchedAt, hash: item.payloadHash, at: item.fetchedAt },
      }
    })

  groups.push({ id: 'tasks', label: '我的待办', status: tasks.length ? 'ok' : 'empty', items: tasks, note: null })
  groups.push({ id: 'knowledge', label: '知识空间', status: knowledge.length ? 'ok' : 'empty', items: knowledge, note: null })
  groups.push({ id: 'radar', label: '技术雷达', status: radar.length ? 'ok' : 'empty', items: radar, note: null })
  groups.push({ id: 'sources', label: '来源证据', status: sources.length ? 'ok' : 'empty', items: sources, note: null })
  return groups
}

async function searchWebGroup(ctx, query) {
  const web = ctx && ctx.get ? ctx.get('web') : null
  if (!web || typeof web.search !== 'function') {
    return {
      id: 'web',
      label: '互联网',
      status: 'unavailable',
      items: [],
      note: '当前 profile 未组合 web 搜索服务；企业外部事实因此不会出现在结果里。',
    }
  }
  let signal
  try {
    signal = AbortSignal.timeout(9000)
  } catch (e) {
    signal = undefined
  }
  try {
    const result = await web.search({ query: query, maxResults: 8 }, signal)
    const items = (result && Array.isArray(result.sources) ? result.sources : []).map(function (source, index) {
      return {
        id: 'web-' + index,
        title: source.title || source.url,
        snippet: source.snippet || '',
        url: source.url,
        kind: 'web',
        extra: { publishedAt: source.publishedAt || null },
      }
    })
    return {
      id: 'web',
      label: '互联网',
      status: items.length ? 'ok' : 'empty',
      items: items,
      note: result && result.truncated ? '结果已按 maxResults 截断' : '外部事实，请以来源链接与发布时间为准。',
    }
  } catch (e) {
    return {
      id: 'web',
      label: '互联网',
      status: 'error',
      items: [],
      note: '检索失败：' + String((e && e.message) || e),
    }
  }
}

async function runUnifiedSearch(ctx, request) {
  const query = asString(request && request.query, 200)
  if (!query) throw new Error('搜索关键词不能为空')
  const state = loadWorkbenchState()
  const groups = searchLocalGroups(state, query)
  if (!request || request.includeEnterprise !== false) {
    groups.push(await searchEnterpriseGroup(ctx, query))
    // 三路按意图触发：联系人（像人名/找人）、会议室（会议类）、考勤（考勤类）。
    // 返回 null 表示这次查询不适用，不显示空分组。
    for (const provider of [searchContactsGroup, searchRoomsGroup, searchAttendanceGroup]) {
      const group = await provider(ctx, query)
      if (group) groups.push(group)
    }
  }
  if (!request || request.includeWeb !== false) {
    groups.push(await searchWebGroup(ctx, query))
  }
  const total = groups.reduce(function (sum, group) {
    return sum + group.items.length
  }, 0)
  return {
    query: query,
    at: hostNowIso(),
    total: total,
    groups: groups,
  }
}
