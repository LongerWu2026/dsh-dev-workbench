const DAY_MS = 86400000;

export function newsWindowDays(value: unknown): number {
  return Math.max(1, Math.min(90, Number(value) || 7));
}

export function newsPublishedAt(item: { publishedAt?: unknown; dateKind?: string; url?: unknown }): string | null {
  if (item.dateKind !== 'unknown' && typeof item.publishedAt === 'string') {
    const timestamp = Date.parse(item.publishedAt);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }

  // DeepSeek's official news slugs encode the release date as YYMMDD.
  if (typeof item.url !== 'string') return null;
  const match = /^https:\/\/api-docs\.deepseek\.com\/(?:zh-cn\/)?news\/news(\d{2})(\d{2})(\d{2})\/?(?:[?#]|$)/i.exec(item.url);
  if (!match) return null;
  const day = '20' + match.slice(1).join('-');
  const timestamp = Date.parse(day + 'T00:00:00+08:00');
  return Number.isFinite(timestamp) && new Date(timestamp + 8 * 3600000).toISOString().slice(0, 10) === day
    ? new Date(timestamp).toISOString() : null;
}

export function newsDateGroup(publishedAt: string | null, days: number, now = Date.now()): 'recent' | 'unknown' | 'history' {
  if (!publishedAt) return 'unknown';
  const published = Date.parse(publishedAt);
  if (!Number.isFinite(published) || published > now) return 'unknown';
  return published >= now - days * DAY_MS ? 'recent' : 'history';
}

export function newsRelevance(item:any, topics:string[], projects:any[]) {
  const text = [item.title, item.excerpt, ...Object.values(item.summary || {})].join(" ").toLowerCase();
  const topicMatches = topics.filter((topic:string) => (item.topics || []).includes(topic) || text.includes(topic.toLowerCase())).length;
  const projectMatches = projects.filter((project:any) => project.name && project.name.length > 1 && text.includes(project.name.toLowerCase())).length;
  return topicMatches * 2 + projectMatches * 4;
}

/** Availability is separate from model/summary health. No business records are deleted. */
export function isUnreadableNewsError(error:unknown):boolean {
 return /HTTP (?:404|410|422)|Unable to extract content|原文不可访问|原文内容不足|原文读取失败：HTTP (?:404|410|422)/i.test(String(error))
}
export function isIgnoredNews(item:any):boolean {
 return !!item.archivedAt || item.availability==='ignored' || item.summaryAttempts>=2 && isUnreadableNewsError(item.summaryError)
}
export function newsPriority(item:any):number {
 return (/github\.com\//i.test(item.url||'')?4:0)+(/AI|LLM|Agent|RAG|大模型|人工智能|模型|智能体|多模态|推理/i.test([item.title,...(item.topics||[])].join(' '))?3:0)
}
