import {normalizeWebAIAttachments,type WebAIAttachment} from './web-ai-attachments.js'
/** Only these consumer websites belong to the comparison feature. No API keys. */
export const WEB_AI_PROVIDERS = [
 {id:'kimi',name:'Kimi',url:'https://www.kimi.com/',hosts:['www.kimi.com','kimi.com']},
 {id:'glm',name:'智谱清言',url:'https://chatglm.cn/',hosts:['chatglm.cn']},
 {id:'doubao',name:'豆包',url:'https://www.doubao.com/chat/',hosts:['www.doubao.com']},
 {id:'yuanbao',name:'元宝',url:'https://yuanbao.tencent.com/',hosts:['yuanbao.tencent.com']},
 {id:'qianwen',name:'千问',url:'https://www.qianwen.com/',hosts:['www.qianwen.com','qianwen.com']},
 {id:'chatgpt',name:'ChatGPT',url:'https://chatgpt.com/',hosts:['chatgpt.com']},
] as const
export type WebAIProviderId = typeof WEB_AI_PROVIDERS[number]['id']
export type WebAIStatus = 'queued'|'preparing'|'prepared'|'generating'|'completed'|'needs_login'|'unsupported'|'uncertain'|'cancelled'
export interface WebAICapture {answerCount:number;userCount:number|null;lastAnswerId?:string;lastAnswerHash?:string;conversationKey?:string}
export interface WebAIAnswer {providerId:WebAIProviderId;status:WebAIStatus;text:string;url:string|null;note:string;updatedAt:string;capture?:WebAICapture;submission?:'not_sent'|'attempting'|'accepted'}
export interface WebAIRound {id:string;requestId:string;topicId:string;question:string;displayQuestion?:string;createdAt:string;answers:WebAIAnswer[];attachments?:WebAIAttachment[]}
export interface WebAITopic {id:string;title:string;createdAt:string;version?:number;updatedAt?:string;deletedAt?:string;conversations:Partial<Record<WebAIProviderId,string>>}
export interface WebAIState {topics:WebAITopic[];rounds:WebAIRound[];chatgptEnabled:boolean;revision?:number}
export const WEB_AI_ACTIVE = new Set<WebAIStatus>(['queued','preparing','generating'])
export function webAIProvider(id:string){const p=WEB_AI_PROVIDERS.find(p=>p.id===id);if(!p)throw new Error('不支持的网页 AI 厂商');return p}
/** Preserve only conversation identifiers; never auth callbacks or arbitrary query data. */
export function webAIConversationUrl(id:string,value:unknown):string|null {
 try {const p=webAIProvider(id),u=new URL(String(value));if(u.protocol!=='https:'||u.username||u.password||u.port||!p.hosts.some(h=>h===u.hostname)||/login|oauth|callback|authorize|sign[-_]?in/i.test(u.pathname))return null;const query=new URLSearchParams();for(const key of ['chatId','conversationId','conversation_id','sessionId','dialogueId','cid']){const v=u.searchParams.get(key);if(v&&/^[\w-]{1,160}$/.test(v))query.set(key,v)}const hash=/^#\/(chat|conversation|c)\/[\w/-]{1,200}$/.test(u.hash)?u.hash:'';return u.origin+u.pathname+(query.size?'?'+query:'')+hash}catch{return null}
}
const clean=(v:unknown,max:number)=>typeof v==='string'?v.slice(0,max):''
const stamp=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():new Date().toISOString()
export function normalizeWebAICapture(raw:any):WebAICapture|undefined {
 if(!Number.isInteger(raw?.answerCount)||raw.answerCount<0||raw.answerCount>1000000)return undefined
 return {answerCount:raw.answerCount,userCount:Number.isInteger(raw.userCount)&&raw.userCount>=0?raw.userCount:null,...(typeof raw.lastAnswerId==='string'&&/^[\w-]{1,100}$/.test(raw.lastAnswerId)?{lastAnswerId:raw.lastAnswerId}:{}),...(typeof raw.lastAnswerHash==='string'&&/^[a-f0-9]{8}$/.test(raw.lastAnswerHash)?{lastAnswerHash:raw.lastAnswerHash}:{}),...(typeof raw.conversationKey==='string'&&/^[a-f0-9]{8}$/.test(raw.conversationKey)?{conversationKey:raw.conversationKey}:{})}
}
export function normalizeWebAI(raw:any,recover=false):WebAIState {
 const topics:WebAITopic[]=(Array.isArray(raw?.topics)?raw.topics:[]).slice(-100).filter((t:any)=>typeof t?.id==='string'&&t.id.length<=120).map((t:any)=>({id:t.id,title:clean(t.title,120)||'未命名问题',createdAt:stamp(t.createdAt),version:Number.isSafeInteger(t.version)&&t.version>=0?t.version:0,...(t.updatedAt?{updatedAt:stamp(t.updatedAt)}:{}),...(t.deletedAt?{deletedAt:stamp(t.deletedAt)}:{}),conversations:Object.fromEntries(WEB_AI_PROVIDERS.flatMap(p=>{const u=webAIConversationUrl(p.id,t.conversations?.[p.id]);return u?[[p.id,u]]:[]}))}))
 const ids=new Set(topics.map(t=>t.id)),roundIds=new Set<string>()
 const rounds:WebAIRound[]=(Array.isArray(raw?.rounds)?raw.rounds:[]).slice(-300).filter((r:any)=>typeof r?.id==='string'&&r.id.length<=120&&ids.has(r.topicId)&&!roundIds.has(r.id)&&!!roundIds.add(r.id)).map((r:any)=>({id:r.id,requestId:clean(r.requestId,120),topicId:r.topicId,question:clean(r.question,12000),...(typeof r.displayQuestion==='string'&&r.displayQuestion.trim()?{displayQuestion:clean(r.displayQuestion,12000)}:{}),...(Array.isArray(r.attachments)&&r.attachments.length?{attachments:(()=>{try{return normalizeWebAIAttachments(r.attachments)}catch{return[]}})()}:{}),createdAt:stamp(r.createdAt),answers:WEB_AI_PROVIDERS.flatMap(p=>{const a=(Array.isArray(r.answers)?r.answers:[]).find((a:any)=>a?.providerId===p.id);if(!a)return[];let status:WebAIStatus=['queued','preparing','prepared','generating','completed','needs_login','unsupported','uncertain','cancelled'].includes(a.status)?a.status:'uncertain';const draftNeedsReview=recover&&status==='prepared',interrupted=recover&&WEB_AI_ACTIVE.has(status);if(interrupted||draftNeedsReview)status='uncertain';return[{providerId:p.id,status,...(['not_sent','attempting','accepted'].includes(a.submission)?{submission:a.submission}:{}),text:clean(a.text,60000),url:webAIConversationUrl(p.id,a.url),...(normalizeWebAICapture(a.capture)?{capture:normalizeWebAICapture(a.capture)}:{}),note:draftNeedsReview?'应用已重启，请核对官网草稿和发送状态；不会自动重新填入或发送。':interrupted?'运行曾中断，请在官网核对；不会自动重复发送。':clean(a.note,300),updatedAt:stamp(a.updatedAt)}]})}))
 return {topics,rounds,chatgptEnabled:raw?.chatgptEnabled===true}
}
