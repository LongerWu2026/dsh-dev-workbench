import { knowledgeAllowed, defaultKnowledgeScope } from '../knowledge/retrieval.js'
import { asString, asTags, hostNowIso } from '../platform/runtime.js'
import { ensureArray } from '../domain/model.js'
import { SEARCH_GROUP_LIMIT } from './search-policy.js'
import { loadWorkbenchState } from '../storage/state-store.js'
import { searchLocalFiles } from './local-files.js'
import { searchAttendanceGroup, searchContactsGroup, searchEnterpriseGroup, searchEventsGroup, searchRoomsGroup } from '../integrations/yunzhijia.js'
import { buildGithubSnapshot } from '../integrations/github.js'

function searchNeedle(value?: any): any {
    return asString(value, 200).toLowerCase();
}

function matchesText(haystack?: any, needle?: any): any {
    if (!needle)
        return false;
    return String(haystack || '').toLowerCase().indexOf(needle) >= 0;
}

function searchSnippet(text?: any, needle?: any, fallback?: any): any {
    const source = String(text || fallback || '');
    if (!source)
        return '';
    if (!needle)
        return source.slice(0, 160);
    const index = source.toLowerCase().indexOf(needle);
    if (index < 0)
        return source.slice(0, 160);
    const start = Math.max(0, index - 50);
    return (start > 0 ? '…' : '') + source.slice(start, start + 160);
}

function searchLocalGroups(state?: any, query?: any): any {
    const needle = searchNeedle(query);
    const groups: any = [];
    const tasks = ensureArray(state.tasks)
        .filter(function (task?: any): any {
        return (matchesText(task.title, needle) ||
            matchesText(task.description, needle) ||
            asTags(task.tags).some(function (tag?: any): any {
                return matchesText(tag, needle);
            }));
    })
        .slice(0, SEARCH_GROUP_LIMIT)
        .map(function (task?: any): any {
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
        };
    });
    const knowledge = ensureArray(state.knowledge)
        .filter(function (item?: any): any {
        return knowledgeAllowed(item,defaultKnowledgeScope(state),true) && (matchesText(item.title, needle) ||
            matchesText(item.body, needle) ||
            asTags(item.tags).some(function (tag?: any): any {
                return matchesText(tag, needle);
            }));
    })
        .slice(0, SEARCH_GROUP_LIMIT)
        .map(function (item?: any): any {
        return {
            id: item.id,
            title: item.title,
            snippet: searchSnippet(item.body, needle, item.title),
            url: item.url || null,
            kind: 'knowledge',
            extra: { kind: item.kind, reviewState:item.reviewState||'candidate',tags: item.tags, at: item.createdAt },
        };
    });
    const radar = ensureArray(state.radar)
        .filter(function (item?: any): any {
        const summary = item.summary || {};
        return knowledgeAllowed(item,defaultKnowledgeScope(state),true) && (matchesText(item.title, needle) ||
            matchesText(item.source, needle) ||
            matchesText(summary.change, needle) ||
            matchesText(summary.usage, needle) ||
            matchesText(summary.risk, needle) ||
            matchesText(summary.practice, needle));
    })
        .slice(0, SEARCH_GROUP_LIMIT)
        .map(function (item?: any): any {
        const summary = item.summary || {};
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
        };
    });
    const sources = ensureArray(state.sources)
        .filter(function (item?: any): any {
        return matchesText(item.title, needle) || matchesText(item.excerpt, needle) || matchesText(item.provider, needle);
    })
        .slice(0, SEARCH_GROUP_LIMIT)
        .map(function (item?: any): any {
        return {
            id: item.id,
            title: item.title,
            snippet: searchSnippet(item.excerpt, needle, item.title),
            url: item.url || null,
            kind: 'source',
            extra: { provider: item.provider, fetchedAt: item.fetchedAt, hash: item.payloadHash, at: item.fetchedAt },
        };
    });
    groups.push({ id: 'tasks', label: '我的待办', status: tasks.length ? 'ok' : 'empty', items: tasks, note: null });
    groups.push({ id: 'knowledge', label: '知识空间', status: knowledge.length ? 'ok' : 'empty', items: knowledge, note: null });
    groups.push({ id: 'radar', label: '技术雷达', status: radar.length ? 'ok' : 'empty', items: radar, note: null });
    groups.push({ id: 'sources', label: '来源证据', status: sources.length ? 'ok' : 'empty', items: sources, note: null });
    return groups;
}

async function searchWebGroup(ctx?: any, query?: any): Promise<any> {
    const web = ctx && ctx.get ? ctx.get('web') : null;
    if (!web || typeof web.search !== 'function') {
        return {
            id: 'web',
            label: '互联网',
            status: 'unavailable',
            items: [],
            note: '当前 profile 未组合 web 搜索服务；企业外部事实因此不会出现在结果里。',
        };
    }
    let signal;
    try {
        signal = AbortSignal.timeout(9000);
    }
    catch (e) {
        signal = undefined;
    }
    try {
        const result = await web.search({ query: query, maxResults: 8 }, signal);
        const items = (result && Array.isArray(result.sources) ? result.sources : []).map(function (source?: any, index?: any): any {
            return {
                id: 'web-' + index,
                title: source.title || source.url,
                snippet: source.snippet || '',
                url: source.url,
                kind: 'web',
                extra: { publishedAt: source.publishedAt || null },
            };
        });
        return {
            id: 'web',
            label: '互联网',
            status: items.length ? 'ok' : 'empty',
            items: items,
            note: result && result.truncated ? '结果已按 maxResults 截断' : '外部事实，请以来源链接与发布时间为准。',
        };
    }
    catch (e) {
        return {
            id: 'web',
            label: '互联网',
            status: 'error',
            items: [],
            note: '检索失败：' + String((e && e.message) || e),
        };
    }
}

async function runUnifiedSearch(ctx?: any, request?: any): Promise<any> {
    const query = asString(request && request.query, 200);
    if (!query)
        throw new Error('搜索关键词不能为空');
    const state = loadWorkbenchState();
    const groups = searchLocalGroups(state, query);
    // 本地项目（文件名 + 文本片段）：不受联网与凭据影响，始终可用
    groups.push(await searchLocalFiles(ctx, query));
    if (!request || request.includeEnterprise !== false) {
        groups.push(await searchEnterpriseGroup(ctx, query));
        // 三路按意图触发：联系人（像人名/找人）、会议室（会议类）、考勤（考勤类）。
        // 返回 null 表示这次查询不适用，不显示空分组。
        for (const provider of [searchContactsGroup, searchRoomsGroup, searchAttendanceGroup, searchEventsGroup]) {
            const group = await provider(ctx, query);
            if (group)
                groups.push(group);
        }
    }
    // PR / CI：只在代码协作类意图下触发（每次都会打 gh，按需调用）
    if (/\bpr\b|拉取请求|评审|review|合并|merge|\bci\b|构建|流水线|github/i.test(query)) {
        const gh = await buildGithubSnapshot(ctx);
        const items: any = [];
        if (gh.status === 'ok') {
            gh.prs.items.slice(0, 5).forEach(function (pr?: any): any {
                items.push({
                    id: 'pr-' + pr.number,
                    title: '#' + pr.number + ' ' + pr.title,
                    snippet: [pr.author, pr.state, pr.draft ? '草稿' : ''].filter(Boolean).join(' · '),
                    url: pr.url,
                    kind: 'pr',
                    extra: { at: pr.updatedAt },
                });
            });
            gh.runs.items.slice(0, 5).forEach(function (run?: any): any {
                items.push({
                    id: 'run-' + run.id,
                    title: (run.workflow || 'CI') + ' · ' + (run.conclusion || run.status || '未知'),
                    snippet: [run.branch, run.status].filter(Boolean).join(' · '),
                    url: run.url,
                    kind: 'ci',
                    extra: { at: run.createdAt },
                });
            });
        }
        groups.push({
            id: 'github',
            label: 'PR / CI',
            status: gh.status === 'ok' ? (items.length ? 'ok' : 'empty') : 'unavailable',
            items: items,
            note: gh.status === 'ok' ? gh.note : gh.note,
        });
    }
    if (!request || request.includeWeb !== false) {
        groups.push(await searchWebGroup(ctx, query));
    }
    const total = groups.reduce(function (sum?: any, group?: any): any {
        return sum + group.items.length;
    }, 0);
    return {
        query: query,
        at: hostNowIso(),
        total: total,
        groups: groups,
    };
}


export { SEARCH_GROUP_LIMIT, searchNeedle, matchesText, searchSnippet, searchLocalGroups, searchWebGroup, runUnifiedSearch }
