import {isBusyReplyMessage} from '../../shared/busy-reply.js'
import {createHash, asIso, asString, hostNowIso} from '../platform/runtime.js'

export function messageSentAt(value:any):string|null {
    return asIso(typeof value==='string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? value.replace(' ','T')+'+08:00' : value);
}
export function messageReplyId(message:any):string|null {
    return asString(message?.replyMsgId || message?.replyToMsgId || message?.param?.replyMsgId || message?.param?.replyToMsgId,80) || null;
}
const open=(row:any)=>!row.archivedAt && ['待回复','已确认收到','已自动回复'].includes(row.stage);
const rows=(result:any):any[]=>Array.isArray(result?.json?.data?.list) ? result.json.data.list.map((row:any)=>row?.message || row).filter(Boolean) : [];

/** Read evidence only: no message sending, AI dependency, or task-state changes. */
export async function reconcileYunzhijiaReplies(ctx:any,state:any,probe:any,run:any,observations:any[]=[]):Promise<any> {
    const report={replied:0,read:0,failed:0,rateLimited:false,deferred:0};
    const accountId=probe.accountId || probe.openId;
    const sources=new Map<string,any>((state.sources || []).map((source:any)=>[source.id,source]));
    state.syncCursors ||= {};
    report.rateLimited=state.syncCursors['__pending:'+accountId]?.reason!=='budget'&&Date.parse(state.syncCursors['__pending:'+accountId]?.retryAt)>Date.now();
    const observed=new Map<string,any>(observations.map(row=>[row.groupId,row]));
    const candidates=(state.replies || []).filter((reply:any)=>{
        const source=sources.get(reply.sourceId),loc=source?.locator;
        return open(reply) && source?.provider==='yunzhijia' && loc?.groupId && loc.msgId===reply.msgId &&
            (!reply.groupId || reply.groupId===loc.groupId) && [accountId,probe.openId].includes(loc.accountId) &&
            (!reply.accountId || [accountId,probe.openId].includes(reply.accountId)) && loc.direction!=='outbound';
    }).map((reply:any)=>{
        const key='__replyStatus:'+createHash('sha256').update(JSON.stringify([accountId,reply.id,reply.msgId])).digest('hex');
        return {reply,loc:sources.get(reply.sourceId).locator,key};
    }).sort((a:any,b:any)=>(Date.parse(state.syncCursors[a.key]?.at)||0)-(Date.parse(state.syncCursors[b.key]?.at)||0));
    let calls=0;
    async function request(args:string[]):Promise<any>{
        calls++;
        const result=await run(ctx,args);
        if(result.status==='rate_limited'){
            report.rateLimited=true;
            state.syncCursors['__pending:'+accountId]={...state.syncCursors['__pending:'+accountId],accountId,reason:'rate_limit',retryAt:new Date(Date.now()+120000).toISOString()};
        }else if(result.status!=='ok')report.failed++;
        return result;
    }
    for(const {reply,loc,key} of candidates){
        if(Date.parse(state.syncCursors[key]?.retryAt)>Date.now()){report.deferred++;continue}
        let view=observed.get(loc.groupId);
        const groupType=Number(view?.groupType || loc.groupType || state.syncCursors[accountId+':'+loc.groupId]?.groupType);
        if(!view){
            if(report.rateLimited){report.deferred++;continue}
            if(calls>=12){report.deferred++;continue}
            const result=await request(['im','message','list','--group-id',loc.groupId,'--type','newest','--limit','20']);
            if(result.status!=='ok'){
                state.syncCursors[key]={accountId,lastMsgId:state.syncCursors[key]?.lastMsgId || loc.msgId,at:hostNowIso(),retryAt:new Date(Date.now()+60000).toISOString()};
                continue;
            }
            const messages=rows(result);
            view={groupId:loc.groupId,groupType,messages,latest:messages.at(-1)};
            observed.set(loc.groupId,view);
        }
        function validOwn(message:any):boolean {
            const sentAt=messageSentAt(message?.sendTime);
            return !isBusyReplyMessage(state,loc.accountId,loc.groupId,message)&&message?.fromOpenId===probe.openId && !!message.msgId && message.msgId!==loc.msgId && !!sentAt &&
                (!loc.sentAt || Date.parse(sentAt)>=Date.parse(loc.sentAt));
        }
        const quoted=(message:any)=>validOwn(message) && messageReplyId(message)===loc.msgId;
        let evidence=(view.messages || []).find(quoted);
        // Only a verified private conversation can use the latest-sender rule.
        if(groupType===1 && loc.sentAt && validOwn(view.latest))evidence=view.latest;
        if(!evidence && groupType!==1 && !report.rateLimited){
            // A quiet/old group may no longer be in recent sessions. Scan forward
            // from the original ID, retaining progress across bounded refreshes.
            let anchor=state.syncCursors[key]?.lastMsgId || loc.msgId;
            for(let page=0;page<2 && calls<12;page++){
                const result=await request(['im','message','list','--group-id',loc.groupId,'--msg-id',anchor,'--type','new','--limit','20']);
                if(result.status!=='ok'){
                    state.syncCursors[key]={accountId,lastMsgId:anchor,at:hostNowIso(),retryAt:new Date(Date.now()+60000).toISOString()};
                    break;
                }
                const messages=rows(result);
                evidence=messages.find(quoted);
                const next=messages.at(-1)?.msgId;
                state.syncCursors[key]={accountId,lastMsgId:typeof next==='string' && next!==anchor ? next:anchor,at:hostNowIso()};
                if(evidence || messages.length<20 || !next || next===anchor)break;
                anchor=next;
            }
        }
        if(evidence){
            Object.assign(reply,{stage:'已回复',evidenceMsgId:evidence.msgId,repliedAt:messageSentAt(evidence.sendTime),updatedAt:hostNowIso()});
            delete state.syncCursors[key];
            report.replied++;
        }else if(!state.syncCursors[key])state.syncCursors[key]={accountId,lastMsgId:loc.msgId,at:hostNowIso()};
    }
    return report;
}

/** Prevent asynchronous sync from replacing a user's newer stage/target edits. */
export function replyStatusSnapshot(reply:any):string {
    return JSON.stringify(['stage','updatedAt','humanGuard','archivedAt','sourceId','msgId','groupId','accountId','repliedAt','evidenceMsgId'].map(key=>reply[key] ?? null));
}
export function mergeReconciledReplies(current:any,fetched:any,before:Map<string,string>):void {
    const replies=new Map<string,any>((fetched.replies || []).map((reply:any)=>[reply.id,reply]));
    const currentSources=new Map<string,any>((current.sources || []).map((source:any)=>[source.id,source]));
    const fetchedSources=new Map<string,any>((fetched.sources || []).map((source:any)=>[source.id,source]));
    for(const reply of current.replies || []){
        const next=replies.get(reply.id);
        const source=currentSources.get(reply.sourceId),expected=fetchedSources.get(next?.sourceId);
        if(!next || !open(reply) || !['已回复','不需回复'].includes(next.stage) || !next.evidenceMsgId || (next.stage==='已回复' && !next.repliedAt) ||
            source?.provider!=='yunzhijia' || ['groupId','msgId','accountId'].some(key=>source?.locator?.[key]!==expected?.locator?.[key]) ||
            replyStatusSnapshot(reply)!==before.get(reply.id) || current.replyDrafts?.[reply.id]?.delivery?.status==='sending')continue;
        Object.assign(reply,{stage:next.stage,evidenceMsgId:next.evidenceMsgId,repliedAt:next.repliedAt,updatedAt:next.updatedAt});
    }
}
