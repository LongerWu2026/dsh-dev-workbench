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
