import {isIgnoredNews, newsDateGroup, newsPublishedAt, newsWindowDays} from './news.js'
export const OFFICIAL_NEWS_FEEDS=[
 {id:'official:openai',label:'OpenAI 官方动态',url:'https://openai.com/news/rss.xml',topics:['AI','LLM']},
 {id:'official:deepmind',label:'Google DeepMind 官方动态',url:'https://deepmind.google/blog/rss.xml',topics:['AI','LLM']},
 {id:'official:huggingface',label:'Hugging Face 博客',url:'https://huggingface.co/blog/feed.xml',topics:['AI','开源']},
]
export const OFFICIAL_NEWS_SITES=[{domain:'anthropic.com',label:'Anthropic 官方动态'},{domain:'api-docs.deepseek.com',label:'DeepSeek 官方更新'}]
export function isNewsBriefCandidate(item:any,requireTopic=false):boolean {
 if(/workdayjobs|\/(?:jobs?|careers?|recruitment)(?:\/|\b)|招聘|职位|\bhiring\b/i.test((item.url||'')+' '+(item.title||'')))return false
 return !requireTopic||/\bAI\b|LLM|agent|RAG|harness|model|multimodal|research|engineering|benchmark|inference|reasoning|Java|Python|SQL|database|模型|人工智能|智能体|多模态|推理|数据库|技术|开源/i.test(item.title||'')
}
export function newsCategory(item:any):string {
 if(/github\.com\//i.test(item.url||''))return '开源项目'
 if(/model|模型/i.test(item.title||'')&&/release|announcement|发布/i.test(item.title||''))return '模型与研究'
 if(/engineering|技术|实践|harness|agent|工具调用|rag/i.test(item.title||''))return '技术实践'
 return '模型与研究'
}
/** Project from live source records: edits/deletions/failed reads cannot leave stale summaries. */
export function newsBriefItems(data:any,limit=5,now=Date.now()):any[]{
 const ids=data.radarBrief?.ids
 const days=newsWindowDays(data.settings?.newsDays)
 const rows=(data.radar||[]).filter((item:any)=>!isIgnoredNews(item)&&item.url&&isNewsBriefCandidate(item,!ids)&&(!ids||ids.includes(item.id)))
  .map((item:any)=>({...item,publishedAt:newsPublishedAt(item)}))
  .filter((item:any)=>newsDateGroup(item.publishedAt,days,now)==='recent')
 return rows.sort((a:any,b:any)=>Number(/官方/.test(b.source))-Number(/官方/.test(a.source))||(!ids?Number(!!b.summary?.change)-Number(!!a.summary?.change):0)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,Math.max(0,Math.min(60,limit)))
}

export function newsBriefOverview(data:any,items:any[]):string {
 const batch=data.radarBrief, sourceIds=batch?.overviewIds??batch?.ids;
 if(typeof batch?.overview!=='string'||!sourceIds?.length)return '';
 const recentIds=new Set(items.map(item=>item.id));
 return sourceIds.every((id:string)=>recentIds.has(id))?batch.overview:'';
}
