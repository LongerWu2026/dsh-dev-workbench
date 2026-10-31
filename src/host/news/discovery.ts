import { newsSearchError } from '../../shared/news-fetch.js'
import { githubQuality } from './github-quality.js'
import { loadWorkbenchState, mutateWorkbenchState } from '../storage/state-store.js'
import { auditEntry, ensureArray, normalizeRadarItem } from '../domain/model.js'
import { asIso, asString, asUrl, hostNowIso } from '../platform/runtime.js'
/* ============================================================================
 * dev-workbench host — radar feed fetch (design report §3.1 内容源)
 *
 * Fetches the RSS/Atom sources configured in settings.feeds through the Host's
 * `web` service and turns new entries into radar items. Three rules from the
 * report are enforced structurally:
 *
 *   - 来源 URL、发布日期可打开：every fetched item keeps its original link and
 *     pubDate; the feed label becomes `source`.
 *   - 去重与缓存：dedupe is by URL against what is already stored (and within
 *     the batch), so a repeated fetch adds nothing.
 *   - 智能摘要：NOT generated here. A plugin has no model; the raw description
 *     is kept as `excerpt` and the four-part summary stays empty until an
 *     agent digests it. No field ever pretends to be an AI summary.
 *
 * Per-source failures degrade independently: one Cloudflare-blocked feed shows
 * as `error` in the persisted report while the others still land.
 * ========================================================================== */
const RADAR_FETCH_TIMEOUT_MS = 12000;
const RADAR_FETCH_PER_FEED_LIMIT = 10;
const RADAR_FETCH_TOTAL_LIMIT = 30;
/** 标题三元组集合，用于语义近似去重（不依赖模型）。 */
function radarTrigrams(text?: any): any {
    const clean = String(text || '')
        .toLowerCase()
        .replace(/[\s\p{P}\p{S}]+/gu, ' ')
        .trim();
    const set = new Set();
    for (let i = 0; i < clean.length - 2; i += 1)
        set.add(clean.slice(i, i + 3));
    if (set.size === 0 && clean.length > 0)
        set.add(clean);
    return set;
}
function radarSimilarity(left?: any, right?: any): any {
    const a = radarTrigrams(left);
    const b = radarTrigrams(right);
    if (a.size === 0 || b.size === 0)
        return 0;
    let shared = 0;
    a.forEach(function (gram?: any): any {
        if (b.has(gram))
            shared += 1;
    });
    return shared / (a.size + b.size - shared);
}
function radarDecodeEntities(text?: any): any {
    return String(text)
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;|&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&');
}
function radarStripHtml(text?: any): any {
    return radarDecodeEntities(String(text || ''))
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[ \t\r\f]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n')
        .trim();
}
/** Extract one inner text of `tag` from a single item block, CDATA-aware. */
function radarTagValue(block?: any, tag?: any): any {
    const re = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i');
    const match = re.exec(block);
    if (!match)
        return '';
    let value = match[1].trim();
    const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/i.exec(value);
    if (cdata)
        value = cdata[1];
    return radarDecodeEntities(value).trim();
}
/** Atom links are attribute-carrying; prefer rel="alternate" (the permalink). */
function radarAtomLink(block?: any): any {
    const links: any = [];
    const re = /<link\b([^>]*)\/?>/gi;
    let match;
    while ((match = re.exec(block)) !== null) {
        const attrs = match[1] || '';
        const href = /href\s*=\s*"([^"]*)"/i.exec(attrs) || /href\s*=\s*'([^']*)'/i.exec(attrs);
        if (!href)
            continue;
        const rel = /rel\s*=\s*"([^"]*)"/i.exec(attrs) || /rel\s*=\s*'([^']*)'/i.exec(attrs);
        links.push({ href: radarDecodeEntities(href[1]).trim(), rel: rel ? rel[1] : '' });
    }
    const alternate = links.find(function (link?: any): any {
        return link.rel === 'alternate' || link.rel === '';
    });
    return (alternate || links[0] || {}).href || '';
}
/** Parse RSS 2.0 `<item>` or Atom `<entry>` blocks into plain candidates. */
function radarParseFeed(xml?: any): any {
    const source = String(xml || '');
    if (!source)
        return [];
    const isAtom = /<feed\b/i.test(source) && /<entry\b/i.test(source);
    const blockRe = isAtom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi;
    const out: any = [];
    let match;
    while ((match = blockRe.exec(source)) !== null) {
        const block = match[0];
        const title = radarTagValue(block, 'title');
        let url = '';
        if (isAtom) {
            url = radarAtomLink(block);
        }
        else {
            url = radarTagValue(block, 'link');
        }
        if (!url)
            url = radarTagValue(block, 'guid') || '';
        const dateRaw = radarTagValue(block, 'pubDate') ||
            radarTagValue(block, 'published') ||
            radarTagValue(block, 'updated') ||
            radarTagValue(block, 'dc:date');
        const parsed = dateRaw ? new Date(dateRaw) : null;
        const publishedAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null;
        const excerpt = radarStripHtml(radarTagValue(block, 'description') ||
            radarTagValue(block, 'summary') ||
            radarTagValue(block, 'content:encoded') ||
            radarTagValue(block, 'content')).slice(0, 400);
        if (!title || !url)
            continue;
        out.push({ title: title.slice(0, 300), url: url, publishedAt: publishedAt, excerpt: excerpt });
    }
    return out;
}
async function fetchOneFeed(web?: any, feed?: any): Promise<any> {
    let signal;
    try {
        signal = AbortSignal.timeout(RADAR_FETCH_TIMEOUT_MS);
    }
    catch (e) {
        signal = undefined;
    }
    try {
        const response = await web.fetch({ url: feed.url }, signal);
        const status = response && Number(response.statusCode) >= 400 ? Number(response.statusCode) : null;
        if (status) {
            return { status: 'error', note: 'HTTP ' + status, items: [] };
        }
        const content = response && response.body && response.body.content ? String(response.body.content) : '';
        const items = radarParseFeed(content);
        if (items.length === 0) {
            return { status: 'empty', note: '没有解析到条目（不是 RSS/Atom 或内容为空）', items: [] };
        }
        return { status: 'ok', note: null, items: items };
    }
    catch (e) {
        return { status: 'error', note: '抓取失败：' + String((e && e.message) || e).slice(0, 160), items: [] };
    }
}
/**
 * Fetch every configured feed once, append new items, and persist a per-source
 * report in `state.lastRadarFetch` so the UI can show what the last run did.
 * Returns the new snapshot (the same contract as every other mutation).
 */
async function runRadarFetch(ctx?: any): Promise<any> {
    const state = loadWorkbenchState();
    const feeds = ensureArray(state.settings && state.settings.feeds).slice(0, RADAR_FETCH_TOTAL_LIMIT);
    const at = hostNowIso();
    if (feeds.length === 0) {
        return mutateWorkbenchState(function (current?: any): any {
            current.lastRadarFetch = {
                at: at,
                added: 0,
                skipped: 0,
                perFeed: [],
                note: '还没有配置资讯源：到「连接与设置 → 资讯源」添加 RSS/Atom 地址。',
            };
            auditEntry(current, 'radar.fetch', '没有配置资讯源');
            return current;
        });
    }
    const web = ctx && ctx.get ? ctx.get('web') : null;
    const perFeed: any = [];
    const candidates: any = [];
    const seenInBatch = new Set();
    const knownUrls = new Set(ensureArray(state.radar)
        .map(function (item?: any): any {
        return item.url ? String(item.url).toLowerCase() : null;
    })
        .filter(Boolean));
    // 语义近似去重：标题三元组相似度超过阈值视为同一事件（转载/微改写）
    const knownTitles = ensureArray(state.radar).map(function (item?: any): any {
        return String(item.title || '');
    });
    const SIMILARITY_THRESHOLD = 0.82;
    let added = 0;
    let skipped = 0;
    for (const feed of feeds) {
        if (!web || typeof web.fetch !== 'function') {
            perFeed.push({
                id: feed.id,
                label: feed.label,
                status: 'unavailable',
                added: 0,
                skipped: 0,
                note: '当前 profile 未组合 web 服务，插件不会自己发起网络请求。',
            });
            continue;
        }
        const result = await fetchOneFeed(web, feed);
        let feedAdded = 0;
        let feedSkipped = 0;
        if (result.status === 'ok') {
            for (const entry of result.items.slice(0, RADAR_FETCH_PER_FEED_LIMIT)) {
                const key = String(entry.url).toLowerCase();
                if (knownUrls.has(key) || seenInBatch.has(key)) {
                    feedSkipped += 1;
                    continue;
                }
                const similar = knownTitles.some(function (title?: any): any {
                    return radarSimilarity(title, entry.title) >= SIMILARITY_THRESHOLD;
                });
                if (similar) {
                    feedSkipped += 1;
                    continue;
                }
                seenInBatch.add(key);
                knownTitles.push(entry.title);
                candidates.push(normalizeRadarItem({
                    title: entry.title,
                    source: feed.label,
                    url: entry.url,
                    publishedAt: entry.publishedAt,
                    topics: feed.topics,
                    summary: { change: '', usage: '', risk: '', practice: '' },
                    excerpt: entry.excerpt,
                }, null));
                feedAdded += 1;
                if (candidates.length >= RADAR_FETCH_TOTAL_LIMIT)
                    break;
            }
        }
        added += feedAdded;
        skipped += feedSkipped;
        perFeed.push({
            id: feed.id,
            label: feed.label,
            status: result.status,
            added: feedAdded,
            skipped: feedSkipped,
            note: result.note,
        });
        if (candidates.length >= RADAR_FETCH_TOTAL_LIMIT)
            break;
    }
    return mutateWorkbenchState(function (current?: any): any {
        if (candidates.length > 0) {
            const known = new Set(ensureArray(current.radar).map(function (row?: any): any { return row.url; }));
            current.radar = ensureArray(current.radar).concat(candidates.filter(function (row?: any): any { return !known.has(row.url); }));
        }
        current.lastRadarFetch = { at: at, added: added, skipped: skipped, perFeed: perFeed, note: null };
        auditEntry(current, 'radar.fetch', '新增 ' + added + ' 条，跳过 ' + skipped + ' 条');
        return current;
    });
}
/* ---------------------------------------------------------------- 联网发现 */
/*
 * 设计报告 §3.1 / TODO 06：未配置 RSS 时，用宿主已有的联网能力按关注主题
 * 发现资讯。查询词由主题确定性拼装（不调模型），原文标题/时间/摘要来自
 * 搜索结果本身；四段摘要留空，由 Agent 读原文后写回（见 workbench_update_radar）。
 */
const NEWS_QUERY_SUFFIX = ' (release OR blog OR announcement OR research)';
async function discoverRadarByTopics(ctx?: any): Promise<any> {
    const state = loadWorkbenchState();
    const web = ctx && ctx.get ? ctx.get('web') : null;
    const allTopics = ensureArray(state.settings && state.settings.topics);
    const topicOffset = Math.max(0, Number(state.lastRadarFetch?.nextTopicIndex) || 0) % Math.max(1, allTopics.length);
    const topics = Array.from({length:Math.min(3,allTopics.length)},(_,index)=>allTopics[(topicOffset+index)%allTopics.length]);
    const at = hostNowIso();
    if (!web || typeof web.search !== 'function') {
        return mutateWorkbenchState(function (current?: any): any {
            current.lastRadarFetch = {
                at: at,
                added: 0,
                skipped: 0,
                perFeed: [],
                note: '未配置 RSS 且宿主没有 web 联网搜索服务：请在宿主设置中启用搜索服务，或在工作台设置中添加 RSS 资讯源。',
            };
            auditEntry(current, 'radar.discover', '没有可用的联网能力');
            return current;
        });
    }
    if (topics.length === 0) {
        return mutateWorkbenchState(function (current?: any): any {
            current.lastRadarFetch = {
                at: at,
                added: 0,
                skipped: 0,
                perFeed: [],
                note: '没有关注主题：先到「连接与设置 → 关注主题」添加主题，才能按主题发现资讯。',
            };
            auditEntry(current, 'radar.discover', '没有关注主题');
            return current;
        });
    }
    const perFeed: any = [];
    const candidates: any = [];
    const knownUrls = new Set(ensureArray(state.radar)
        .map(function (item?: any): any {
        return item.url ? String(item.url).toLowerCase() : null;
    })
        .filter(Boolean));
    const knownTitles = ensureArray(state.radar).map(function (item?: any): any {
        return String(item.title || '');
    });
    let added = 0;
    let skipped = 0;
    const lanes=[...topics.map((topic:any)=>({topic,kind:'news'})),{topic:'AI 开源',kind:'github'},{topic:'AI 前沿',kind:'ai'}];
    for (const {topic,kind} of lanes) {
        const since = new Date(Date.now() - (state.settings.newsDays || 7) * 86400000).toISOString().slice(0, 10);
        const searchTopic = /^agents?$/i.test(topic) ? '"AI Agent"' : /^rag$/i.test(topic) ? '"retrieval augmented generation"' : topic;
        const query = kind==='github' ? 'site:github.com (AI OR LLM OR agent OR multimodal) (trending OR new release OR stars) after:'+since : kind==='ai' ? '(AI model OR reasoning OR multimodal OR AI coding agent) (release OR announcement OR benchmark) after:'+since : searchTopic + ( /^(Java|Python|数据库)$/i.test(topic)?' AI engineering':'' ) + NEWS_QUERY_SUFFIX + ' after:' + since;
        let result;
        try {
            result = await web.search({ query: query, maxResults: 5 }, AbortSignal.timeout(12000));
        }
        catch (e) {
            perFeed.push({
                id: 'topic:' + topic,
                label: '话题 ' + topic,
                status: 'error',
                added: 0,
                skipped: 0,
                note: newsSearchError(e),
            });
            continue;
        }
        if (!Array.isArray(result?.sources)) {
            perFeed.push({ id: 'topic:' + topic, label: '话题 ' + topic, status: 'error', added: 0, skipped: 0, note: '联网搜索未返回有效的资讯来源，请检查宿主搜索服务。' });
            continue;
        }
        let topicAdded = 0;
        let topicSkipped = 0;
        for (const source of (result && result.sources) || []) {
            const url = asUrl(source.url);
            if (!url) {
                topicSkipped += 1;
                continue;
            }
            const key = String(url).toLowerCase();
            if (knownUrls.has(key)) {
                topicSkipped += 1;
                continue;
            }
            const title = asString(source.title, 300) || url;
            // 搜索 Provider 可能忽略 after:，并且不返回 publishedAt。
            // 明确的历史日期路径只用于排除旧文，不作为发布日期写回。
            const pathDate = /\/(20\d{2})[\/-](\d{2})[\/-](\d{2})(?:[\/-]|$)/.exec(new URL(url).pathname);
            if (pathDate) {
                const pathTimestamp = Date.parse(pathDate.slice(1).join('-') + 'T00:00:00Z');
                if (Number.isFinite(pathTimestamp) && pathTimestamp < Date.now() - (state.settings.newsDays || 7) * 86400000) { topicSkipped += 1; continue; }
            }
            const topicText = title + ' ' + (source.snippet || '');
            if(kind==='github' && (new URL(url).hostname!=='github.com' || !/^\/[^/]+\/[^/]+\/?$/.test(new URL(url).pathname) || !/AI|LLM|agent|人工智能|模型|智能体/i.test(topicText))){topicSkipped++;continue;}
            if(kind!=='github' && /^(what is|introduction to|beginner.{0,10}guide)|入门教程|基础教程/i.test(title) && !/release|发布|announcement|更新/i.test(title)){topicSkipped++;continue;}
            if (/^agents?$/i.test(topic) && /valorant|riot games|game agent|无畏契约/i.test(topicText) && !/\bAI\b|artificial intelligence|agentic|人工智能|大模型/i.test(topicText)) { topicSkipped += 1; continue; }
            const similar = knownTitles.some(function (existing?: any): any {
                return radarSimilarity(existing, title) >= 0.82;
            });
            if (similar) {
                topicSkipped += 1;
                continue;
            }
            knownUrls.add(key);
            knownTitles.push(title);
            const parsedPublished = asIso(source.publishedAt);
            if (parsedPublished && (new Date(parsedPublished).getTime() < Date.now() - (state.settings.newsDays || 7) * 86400000 || new Date(parsedPublished).getTime() > Date.now() + 86400000)) {
                topicSkipped += 1;
                continue;
            }
            candidates.push(normalizeRadarItem({
                title: title,
                source: kind==='github'?'GitHub 项目发现':'联网检索 · ' + topic,
                url: url,
                publishedAt: parsedPublished,
                // TODO 20 日期纪律：publishedAt 可核实才标 published，否则 unknown（显示时注明抓取时间）
                dateKind: parsedPublished ? 'published' : 'unknown',
                fetchedAt: hostNowIso(),
                topics: kind==='github'?['AI','GitHub']:kind==='ai'?['AI', 'LLM']:[topic],
                summary: { change: '', usage: '', risk: '', practice: '' },
                excerpt: asString(source.snippet, 800),
            }, null));
            topicAdded += 1;
        }
        added += topicAdded;
        skipped += topicSkipped;
        perFeed.push({
            id: 'topic:' + topic,
            label: '话题 ' + topic,
            status: topicAdded > 0 ? 'ok' : 'empty',
            added: topicAdded,
            skipped: topicSkipped,
            note: result.sources.length ? '检索返回 ' + result.sources.length + ' 条，新增 ' + topicAdded + ' 条，重复或不符合筛选条件 ' + topicSkipped + ' 条。' : '搜索服务未返回资讯来源，可调整关注主题后重试。',
        });
        if (candidates.length >= RADAR_FETCH_TOTAL_LIMIT)
            break;
    }
    return mutateWorkbenchState(function (current?: any): any {
        if (candidates.length > 0) {
            const known = new Set(ensureArray(current.radar).map(function (row?: any): any { return row.url; }));
            current.radar = ensureArray(current.radar).concat(candidates.filter(function (row?: any): any { return !known.has(row.url); }));
        }
        current.lastRadarFetch = {
            at: at,
            added: added,
            skipped: skipped,
            perFeed: perFeed,
            nextTopicIndex: (topicOffset + topics.length) % Math.max(1, allTopics.length),
            note: '轮换关注主题，并发现近期AI进展与GitHub项目候选；搜索结果不代表已验证热榜或新增星数。',
        };
        auditEntry(current, 'radar.discover', '联网发现新增 ' + added + ' 条');
        return current;
    });
}
/** fetchRadar：优先抓取已配置的 RSS；没有配置时改走联网发现。 */
async function runRadarFetchOrDiscover(ctx?: any): Promise<any> {
    const state = loadWorkbenchState();
    const feeds = ensureArray(state.settings && state.settings.feeds);
    if (feeds.length > 0)
        return runRadarFetch(ctx);
    return discoverRadarByTopics(ctx);
}

export { RADAR_FETCH_TIMEOUT_MS, RADAR_FETCH_PER_FEED_LIMIT, RADAR_FETCH_TOTAL_LIMIT, radarTrigrams, radarSimilarity, radarDecodeEntities, radarStripHtml, radarTagValue, radarAtomLink, radarParseFeed, fetchOneFeed, runRadarFetch, NEWS_QUERY_SUFFIX, discoverRadarByTopics, runRadarFetchOrDiscover }


export async function refreshGithubQuality(ctx:any):Promise<void>{
 const state=loadWorkbenchState();const rows=state.radar.filter((row:any)=>/^https:\/\/github.com\//.test(row.url||'')&&!row.archivedAt&&(!row.github?.attemptedAt||Date.now()-Date.parse(row.github.attemptedAt)>6*3600000)&&(!row.github?.checkedAt||Date.now()-Date.parse(row.github.checkedAt)>6*3600000)).slice(0,5);
 for(const row of rows){const quality=await githubQuality(ctx,row);if(quality)await mutateWorkbenchState((s:any)=>{const live=s.radar.find((item:any)=>item.id===row.id);if(live&&live.url===row.url)live.github=quality;return s})}
}
