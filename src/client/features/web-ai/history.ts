import {webAIProvider,type WebAIState,type WebAIRound,type WebAITopic} from '../../../shared/web-ai.js'
export const localQuestion=(round:WebAIRound)=>round.displayQuestion||round.question
export interface HistoryEntry {topic:WebAITopic;count:number;updatedAt:string;preview:string}
/** Search stays entirely in the workbench; no model calls or provider requests. */
export function searchWebAIHistory(state:WebAIState,query:string,deleted=false):HistoryEntry[]{
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
 return state.topics.filter(t=>!!t.deletedAt===deleted).flatMap(topic=>{
  const rounds=state.rounds.filter(r=>r.topicId===topic.id)
  const segments=[topic.title,...rounds.flatMap(r=>[localQuestion(r),r.question,...(r.attachments||[]).map(f=>f.name),...r.answers.flatMap(a=>[webAIProvider(a.providerId).name,a.text])])]
  const text=segments.join('\n').toLocaleLowerCase();if(!terms.every(term=>text.includes(term)))return[]
  const match=segments.find(s=>terms.length&&terms.some(term=>s.toLocaleLowerCase().includes(term)))||rounds.at(-1)?.displayQuestion||rounds.at(-1)?.question||'暂无问题'
  const start=terms.length?Math.max(0,match.toLocaleLowerCase().indexOf(terms[0])-24):0
  const updatedAt=[topic.updatedAt||topic.createdAt,...rounds.flatMap(r=>[r.createdAt,...r.answers.map(a=>a.updatedAt)])].sort().at(-1)!
  return [{topic,count:rounds.length,updatedAt,preview:(start?'…':'')+match.slice(start,start+130)}]
 }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.topic.id.localeCompare(b.topic.id))
}
