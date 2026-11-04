import {hubSessionOwner,hubSessionNativeTitle,rememberHubNativeTitle,hubIndex} from './hub-store.js'
import {sessionTitleOf} from './transcript.js'

const names:Record<string,string>={'system:office':'办公历史 · 助手','system:analysis':'消息识别 · 助手','system:radar':'AI 资讯 · 助手','system:knowledge':'知识库 · 助手'}
const pending=new Map<string,Promise<any>>()
interface NativeMetadata {nativeTitle?:string;title:string;lastAt?:any;firstText:string;turnActive:boolean}
const metadata=new WeakMap<object,{seq:number;headerTitle:any;title:any;value:NativeMetadata}>()
/** Directory readers share metadata at an immutable native event cut. They do
 * not project assistant bodies, tool output or attachment transcripts. */
export function readHubNativeMetadata(session:any):NativeMetadata{
 if(!session)return {title:'历史工作会话',firstText:'',turnActive:false}
 const seq=Number(session.seq),prior=metadata.get(session)
 if(Number.isFinite(seq)&&prior?.seq===seq&&prior.headerTitle===session.header?.title&&prior.title===session.title)return prior.value
 const events=typeof session.snapshotEvents==='function'?session.snapshotEvents():[]
 let title=session.header?.title||session.title,firstText='',foundUser=false,turnActive=false
 for(const event of events){
  if(event.type==='session/title'&&typeof event.data?.title==='string')title=event.data.title
  if(event.type==='turn/start')turnActive=true
  else if(event.type==='turn/end')turnActive=false
  if(!foundUser&&event.type==='user/message'){foundUser=true;firstText=(event.data?.content||[]).filter((part:any)=>part.type==='text').map((part:any)=>part.text).join('\n').slice(0,120)}
 }
 const nativeTitle=typeof title==='string'&&title.trim()&&!title.startsWith('【工作台上下文')?title.trim():undefined
 const value={nativeTitle,title:nativeTitle||sessionTitleOf({id:session.id,snapshotEvents:()=>events}),lastAt:events.at(-1)?.time||session.header?.createdAt||null,firstText,turnActive}
 if(Number.isFinite(seq))metadata.set(session,{seq,headerTitle:session.header?.title,title:session.title,value})
 return value
}
export function readHubNativeTitle(session:any):string|undefined{
    return readHubNativeMetadata(session).nativeTitle
}

/** Give the interactive session its own stable identity before the first prompt.
 * The native title generator would otherwise choose the injected context header.
 * Naming is best-effort and must never allocate a replacement session. Call only
 * on explicit send, after ownership is persisted; reading history remains read-only. */
export async function ensureHubNativeIdentity(ctx:any,conversationId:string,sessionId:string,userText?:string,restoredSession?:any):Promise<{title?:string;renamed:boolean;note?:string}>{
    const get=(name:string)=>typeof ctx?.get==='function'?ctx.get(name):ctx?.[name],session=restoredSession||get('sessions')?.get?.(sessionId),saved=hubIndex().conversations.find(row=>row.id===conversationId),current=readHubNativeTitle(session)
    const preserved=conversationId.startsWith('development:')||current&&!names[conversationId]
    if(preserved){if(current&&hubSessionOwner(sessionId)===conversationId&&hubSessionNativeTitle(sessionId)!==current)rememberHubNativeTitle(sessionId,current);return {title:current,renamed:false}}
    const candidate=saved?.title&&!/^(?:新对话|历史工作会话|会话 )/.test(saved.title)&&!saved.title.startsWith('【工作台上下文')?saved.title:userText?.trim().replace(/\s+/g,' ').slice(0,60)
    const title=names[conversationId]||candidate
    if(!title)return {renamed:false}
    if(hubSessionOwner(sessionId)!==conversationId)throw Error('助手会话归属不匹配，未修改原生会话名称')
    if(hubSessionNativeTitle(sessionId)===title)return {title,renamed:false}
    if(pending.has(sessionId))return pending.get(sessionId)
    const operation=(async()=>{
        const controller=get('sessionController')
        if(typeof controller?.rename!=='function')return {title,renamed:false,note:'当前宿主未提供会话命名接口'}
        try{
            await controller.rename({sessionId,title})
            // A failed rename only retries the name on the next explicit send.
            // Retain the original persisted session and never create another one.
            rememberHubNativeTitle(sessionId,title)
            return {title,renamed:true}
        }catch(error){return {title,renamed:false,note:String(error?.message||error)}}
    })()
    pending.set(sessionId,operation)
    try{return await operation}finally{pending.delete(sessionId)}
}
