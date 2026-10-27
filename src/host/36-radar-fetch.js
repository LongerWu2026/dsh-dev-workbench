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

const RADAR_FETCH_TIMEOUT_MS = 12000
const RADAR_FETCH_PER_FEED_LIMIT = 10
const RADAR_FETCH_TOTAL_LIMIT = 30

function radarDecodeEntities(text) {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function radarStripHtml(text) {
  return radarDecodeEntities(String(text || ''))
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\r\f]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

/** Extract one inner text of `tag` from a single item block, CDATA-aware. */
function radarTagValue(block, tag) {
  const re = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i')
  const match = re.exec(block)
  if (!match) return ''
  let value = match[1].trim()
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/i.exec(value)
  if (cdata) value = cdata[1]
  return radarDecodeEntities(value).trim()
}

/** Atom links are attribute-carrying; prefer rel="alternate" (the permalink). */
function radarAtomLink(block) {
  const links = []
  const re = /<link\b([^>]*)\/?>/gi
  let match
  while ((match = re.exec(block)) !== null) {
    const attrs = match[1] || ''
    const href = /href\s*=\s*"([^"]*)"/i.exec(attrs) || /href\s*=\s*'([^']*)'/i.exec(attrs)
    if (!href) continue
    const rel = /rel\s*=\s*"([^"]*)"/i.exec(attrs) || /rel\s*=\s*'([^']*)'/i.exec(attrs)
    links.push({ href: radarDecodeEntities(href[1]).trim(), rel: rel ? rel[1] : '' })
  }
  const alternate = links.find(function (link) {
    return link.rel === 'alternate' || link.rel === ''
  })
  return (alternate || links[0] || {}).href || ''
}

/** Parse RSS 2.0 `<item>` or Atom `<entry>` blocks into plain candidates. */
function radarParseFeed(xml) {
  const source = String(xml || '')
  if (!source) return []
  const isAtom = /<feed\b/i.test(source) && /<entry\b/i.test(source)
  const blockRe = isAtom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi
  const out = []
  let match
  while ((match = blockRe.exec(source)) !== null) {
    const block = match[0]
    const title = radarTagValue(block, 'title')
    let url = ''
    if (isAtom) {
      url = radarAtomLink(block)
    } else {
      url = radarTagValue(block, 'link')
    }
    if (!url) url = radarTagValue(block, 'guid') || ''
    const dateRaw =
      radarTagValue(block, 'pubDate') ||
      radarTagValue(block, 'published') ||
      radarTagValue(block, 'updated') ||
      radarTagValue(block, 'dc:date')
    const parsed = dateRaw ? new Date(dateRaw) : null
    const publishedAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null
    const excerpt = radarStripHtml(
      radarTagValue(block, 'description') ||
        radarTagValue(block, 'summary') ||
        radarTagValue(block, 'content:encoded') ||
        radarTagValue(block, 'content'),
    ).slice(0, 400)
    if (!title || !url) continue
    out.push({ title: title.slice(0, 300), url: url, publishedAt: publishedAt, excerpt: excerpt })
  }
  return out
}

async function fetchOneFeed(web, feed) {
  let signal
  try {
    signal = AbortSignal.timeout(RADAR_FETCH_TIMEOUT_MS)
  } catch (e) {
    signal = undefined
  }
  try {
    const response = await web.fetch({ url: feed.url }, signal)
    const status = response && Number(response.statusCode) >= 400 ? Number(response.statusCode) : null
    if (status) {
      return { status: 'error', note: 'HTTP ' + status, items: [] }
    }
    const content = response && response.body && response.body.content ? String(response.body.content) : ''
    const items = radarParseFeed(content)
    if (items.length === 0) {
      return { status: 'empty', note: '没有解析到条目（不是 RSS/Atom 或内容为空）', items: [] }
    }
    return { status: 'ok', note: null, items: items }
  } catch (e) {
    return { status: 'error', note: '抓取失败：' + String((e && e.message) || e).slice(0, 160), items: [] }
  }
}

/**
 * Fetch every configured feed once, append new items, and persist a per-source
 * report in `state.lastRadarFetch` so the UI can show what the last run did.
 * Returns the new snapshot (the same contract as every other mutation).
 */
async function runRadarFetch(ctx) {
  const state = loadWorkbenchState()
  const feeds = ensureArray(state.settings && state.settings.feeds).slice(0, RADAR_FETCH_TOTAL_LIMIT)
  const at = hostNowIso()

  if (feeds.length === 0) {
    return mutateWorkbenchState(function (current) {
      current.lastRadarFetch = {
        at: at,
        added: 0,
        skipped: 0,
        perFeed: [],
        note: '还没有配置资讯源：到「连接与设置 → 资讯源」添加 RSS/Atom 地址。',
      }
      auditEntry(current, 'radar.fetch', '没有配置资讯源')
      return current
    })
  }

  const web = ctx && ctx.get ? ctx.get('web') : null
  const perFeed = []
  const candidates = []
  const seenInBatch = new Set()
  const knownUrls = new Set(
    ensureArray(state.radar)
      .map(function (item) {
        return item.url ? String(item.url).toLowerCase() : null
      })
      .filter(Boolean),
  )

  let added = 0
  let skipped = 0

  for (const feed of feeds) {
    if (!web || typeof web.fetch !== 'function') {
      perFeed.push({
        id: feed.id,
        label: feed.label,
        status: 'unavailable',
        added: 0,
        skipped: 0,
        note: '当前 profile 未组合 web 服务，插件不会自己发起网络请求。',
      })
      continue
    }
    const result = await fetchOneFeed(web, feed)
    let feedAdded = 0
    let feedSkipped = 0
    if (result.status === 'ok') {
      for (const entry of result.items.slice(0, RADAR_FETCH_PER_FEED_LIMIT)) {
        const key = String(entry.url).toLowerCase()
        if (knownUrls.has(key) || seenInBatch.has(key)) {
          feedSkipped += 1
          continue
        }
        seenInBatch.add(key)
        candidates.push(
          normalizeRadarItem(
            {
              title: entry.title,
              source: feed.label,
              url: entry.url,
              publishedAt: entry.publishedAt,
              topics: feed.topics,
              summary: { change: '', usage: '', risk: '', practice: '' },
              excerpt: entry.excerpt,
            },
            null,
          ),
        )
        feedAdded += 1
        if (candidates.length >= RADAR_FETCH_TOTAL_LIMIT) break
      }
    }
    added += feedAdded
    skipped += feedSkipped
    perFeed.push({
      id: feed.id,
      label: feed.label,
      status: result.status,
      added: feedAdded,
      skipped: feedSkipped,
      note: result.note,
    })
    if (candidates.length >= RADAR_FETCH_TOTAL_LIMIT) break
  }

  return mutateWorkbenchState(function (current) {
    if (candidates.length > 0) {
      current.radar = ensureArray(current.radar).concat(candidates).slice(-500)
    }
    current.lastRadarFetch = { at: at, added: added, skipped: skipped, perFeed: perFeed, note: null }
    auditEntry(current, 'radar.fetch', '新增 ' + added + ' 条，跳过 ' + skipped + ' 条')
    return current
  })
}
