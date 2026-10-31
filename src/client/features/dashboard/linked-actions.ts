export interface BriefActionGroup {id:string;tasks:any[];replies:any[]}
export function briefReplyOpen(reply:any):boolean {
 return !reply.archivedAt&&['待回复','已确认收到','已自动回复'].includes(reply.stage)
}

/** Display grouping only: explicit task IDs, never similar titles or conversation names. */
export function briefLinkedActions(data:any,selected:any[]):{groups:BriefActionGroup[];standalone:any[]} {
 const tasks=(data.tasks||[]).filter((t:any)=>!t.archivedAt)
 const byId=new Map<string,any>(tasks.map((t:any)=>[t.id,t])),parent=new Map<string,string>(tasks.map((t:any)=>[t.id,t.id]))
 const root=(id:string):string=>{let key=id;while(parent.get(key)!==key)key=parent.get(key)!;return key}
 const sources=new Map<string,any>((data.sources||[]).map((s:any)=>[s.id,s]))
 const accounts=new Map<string,string|undefined>(tasks.map((t:any)=>[t.id,[t.sourceRefId,...(t.sourceRefs||[]).map((r:any)=>r.sourceId)].map(id=>sources.get(id)?.locator?.accountId).find(Boolean)]))
 const links=new Map<string,string[]>()
 for(const r of data.replies||[]){
  if(r.archivedAt)continue
  const account=r.accountId||sources.get(r.sourceId)?.locator?.accountId
  const ids=[...new Set<string>((r.taskIds||[]).filter((id:string)=>byId.has(id)&&(!account||!accounts.get(id)||accounts.get(id)===account)))]
  links.set(r.id,ids)
  for(const id of ids.slice(1))parent.set(root(id),root(ids[0]))
 }
 const groups=new Map<string,BriefActionGroup>()
 for(const t of tasks){const id=root(t.id);if(!groups.has(id))groups.set(id,{id,tasks:[],replies:[]});groups.get(id)!.tasks.push(t)}
 const standalone:any[]=[]
 for(const r of data.replies||[]){if(r.archivedAt)continue;const ids=links.get(r.id)||[];if(ids.length)groups.get(root(ids[0]))!.replies.push(r);else if(briefReplyOpen(r))standalone.push(r)}
 const rank=new Map<string,number>(selected.map((t:any,i:number)=>[t.id,i]))
 return {groups:[...groups.values()].filter(g=>g.tasks.some(t=>rank.has(t.id))||g.replies.some(briefReplyOpen)).sort((a,b)=>Math.min(...a.tasks.map(t=>rank.get(t.id)??Infinity))-Math.min(...b.tasks.map(t=>rank.get(t.id)??Infinity))),standalone}
}
