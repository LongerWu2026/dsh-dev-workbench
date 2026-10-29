import {loadWorkbenchState,mutateWorkbenchState} from '../storage/state-store.js'
const strictSessions=new Map<string,number>()
const message='本轮为仅知识库回答，不允许调用工具；请仅根据本轮知识片段回答'
export async function setKnowledgeOnlySession(id:string,enabled:boolean){
 if(enabled){strictSessions.set(id,Date.now()+180000);return}
 strictSessions.set(id,0)
 const traces=loadWorkbenchState().retrievalTraces||[],last=traces.filter((t:any)=>t.sessionId===id).at(-1)
 if(last?.mode==='only'&&!last.finishedAt)await mutateWorkbenchState((s:any)=>{const row=(s.retrievalTraces||[]).find((t:any)=>t.id===last.id);if(row)row.finishedAt=new Date().toISOString();return s})
}
export function knowledgeToolGuard(id:string){
 if(strictSessions.has(id)){const deadline=strictSessions.get(id)!;if(deadline>Date.now())return message;return undefined}
 const last=(loadWorkbenchState().retrievalTraces||[]).filter((t:any)=>t.sessionId===id).at(-1)
 if(last?.mode==='only'&&!last.finishedAt&&Date.parse(last.at)+180000>Date.now())return message
 return undefined
}
