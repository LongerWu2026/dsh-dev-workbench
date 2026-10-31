export interface WebsiteTurn {
 id:string;ordinal:number;question:string|null;userIndex:number|null;text:string;truncated:boolean;complete:boolean;completionEvidence:string|null
}
export const normalizeCapturedQuestion=(value:string)=>value.normalize('NFKC').replace(/\s+/g,' ').replace(/\s*([,。.!?:;“”"、])\s*/g,'$1').trim()
const normalized=normalizeCapturedQuestion
/** Bind a reply to the requested turn, including when later questions already exist. */
export function selectCapturedTurn(snapshot:any,question:string,before:any):{turn:WebsiteTurn|null;foreign:boolean;ambiguous:boolean}{
 const turns:WebsiteTurn[]=(Array.isArray(snapshot.turns)?snapshot.turns:[]).filter((t:any)=>Number.isInteger(t?.ordinal)&&typeof t?.text==='string')
 const count=Number.isFinite(before.answerCount)?before.answerCount:(before.answers?.length||0)
 const anchor=before.lastAnswerId?turns.find(t=>t.id===before.lastAnswerId):null
 const target=normalized(question)
 const after=(t:WebsiteTurn)=>anchor?t.ordinal>anchor.ordinal:t.ordinal>=count
 const relevant=turns.filter(after)
 let turn=relevant.find(t=>t.question!==null&&normalized(t.question)===target)||null
 // Some official pages expose assistant bodies without user roles. Only the next ordinal is eligible.
 if(!turn)turn=relevant.find(t=>t.question===null&&t.ordinal===(anchor?anchor.ordinal+1:count))||null
 if(!turn&&Number.isFinite(before.userCount))turn=turns.find(t=>t.question!==null&&normalized(t.question)===target&&t.userIndex!==null&&t.userIndex>=before.userCount)||null
 if(!turn&&!anchor&&before.conversationKey&&snapshot.conversationKey&&before.conversationKey!==snapshot.conversationKey)turn=turns.find(t=>t.id!==before.lastAnswerId&&t.question!==null&&normalized(t.question)===target)||null
 const newUser=Number.isFinite(snapshot.userCount)&&Number.isFinite(before.userCount)&&snapshot.userCount>before.userCount
 const foreign=!turn&&(relevant.some(t=>!!t.question&&normalized(t.question)!==target)||newUser&&!!snapshot.lastQuestion&&normalized(snapshot.lastQuestion)!==target)
 const ambiguous=!turn&&!foreign&&count>0&&snapshot.answerCount<count&&!anchor
 return {turn,foreign,ambiguous}
}
