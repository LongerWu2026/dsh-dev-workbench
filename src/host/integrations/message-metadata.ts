import {createHash, asIso, asString} from '../platform/runtime.js'

export function linkedMessageSources(state:any):any[] {
    const sources=new Map<string,any>((state.sources || []).map((row:any)=>[row.id,row]));
    const ids=[...(state.replies || []).filter((row:any)=>!row.archivedAt && ['待回复','已确认收到','已自动回复'].includes(row.stage)).map((row:any)=>row.sourceId),
        ...(state.tasks || []).filter((row:any)=>!row.archivedAt && !['completed','cancelled'].includes(row.status)).flatMap((row:any)=>[row.sourceRefId,...(row.sourceRefs || []).map((ref:any)=>ref.sourceId)])];
    return [...new Set(ids)].map(id=>sources.get(id)).filter(source=>source?.provider==='yunzhijia');
}

/** Repair existing linked evidence only; never collect or requeue historical work. */
export async function repairLinkedMessageMetadata(ctx:any, state:any, probe:any, run:(ctx:any,args:string[])=>Promise<any>):Promise<any> {
    const report={repaired:0,failed:0,rateLimited:false};
    const accountId=probe.accountId || probe.openId;
    state.syncCursors ||= {};
    const globalKey='__messageMetadata:'+accountId;
    if(Date.parse(state.syncCursors[globalKey]?.retryAt)>Date.now())return report;
    const candidates=linkedMessageSources(state).filter(source=>{
        const loc=source?.locator;
        return source?.provider==='yunzhijia' && loc?.groupId && loc.msgId && (!loc.accountId || [accountId,probe.openId].includes(loc.accountId)) && (!loc.sentAt || !loc.senderId || !loc.accountId);
    });
    let calls=0;
    for(const source of candidates){
        const loc=source.locator;
        const key='__messageMetadata:v2:'+createHash('sha256').update(JSON.stringify([accountId,loc.groupId,loc.msgId])).digest('hex');
        if(Date.parse(state.syncCursors[key]?.retryAt)>Date.now())continue;
        if(calls>=12)break;
        const text=String(source.excerpt || '').replace(/@\S+/g,' ').trim();
        const keyword=(text.match(/[A-Za-z]{2,}/)?.[0] || text.match(/[\u4e00-\u9fff]{2,}/)?.[0] || text).slice(0,16);
        if(keyword.length<2)continue;
        const args=['im','message','search','--group-id',loc.groupId,'--keyword',keyword,'--limit','1','--page','1'];
        // The legacy timestamp narrows the query; only the exact returned message
        // supplies the authoritative sentAt. No intake/createdAt fallback is saved.
        const hint=asIso(loc.sentAt || source.fetchedAt);
        if(hint){const day=new Date(Date.parse(hint)+8*3600000).toISOString().slice(0,10);args.push('--start',day,'--end',day)}
        calls++;
        async function request(query:string[]):Promise<any>{
            const result=await run(ctx,query);
            if(result.status==='rate_limited'){
                const retryAt=new Date(Date.now()+120000).toISOString();
                report.rateLimited=true;state.syncCursors[globalKey]={accountId,retryAt};
                state.syncCursors['__pending:'+accountId]={...state.syncCursors['__pending:'+accountId],accountId,retryAt};
            }
            return result;
        }
        const result=await request(args);
        let matches=result.status==='ok' ? (result.json?.data?.list || []).filter((group:any)=>group.group?.groupId===loc.groupId).flatMap((group:any)=>(group.messages || []).map((row:any)=>({message:row.message || row,group:group.group}))).filter((row:any)=>row.message.msgId===loc.msgId) : [];
        // Search may truncate a common keyword (for example "AI"). Walk from
        // the known message ID to a neighbour and back to include that exact ID.
        if(result.status==='ok' && !matches.length){
            for(const direction of ['new','old']){
                const neighbour=await request(['im','message','list','--group-id',loc.groupId,'--msg-id',loc.msgId,'--type',direction,'--limit','1']);
                if(neighbour.status!=='ok')break;
                const rows=(neighbour.json?.data?.list || []).map((row:any)=>row.message || row);
                const exact=rows.filter((row:any)=>row.msgId===loc.msgId);
                if(exact.length){matches=exact.map((message:any)=>({message,group:{groupName:loc.groupName}}));break}
                if(!rows.length)continue;
                const anchor=rows[0]?.msgId;
                if(typeof anchor!=='string' || !anchor)break;
                const around=await request(['im','message','list','--group-id',loc.groupId,'--msg-id',anchor,'--type',direction==='new'?'old':'new','--limit','2']);
                if(around.status!=='ok')break;
                matches=(around.json?.data?.list || []).map((row:any)=>row.message || row).filter((message:any)=>message.msgId===loc.msgId).map((message:any)=>({message,group:{groupName:loc.groupName}}));
                break;
            }
        }
        if(report.rateLimited)break;
        if(matches.length!==1){report.failed++;state.syncCursors[key]={accountId,retryAt:new Date(Date.now()+3600000).toISOString()};continue}
        const {message,group}=matches[0];
        const value=message.sendTime;
        const sentAt=asIso(typeof value==='string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? value.replace(' ','T')+'+08:00' : value);
        const senderId=asString(message.fromOpenId,120);
        if(!sentAt || !senderId){report.failed++;state.syncCursors[key]={accountId,retryAt:new Date(Date.now()+3600000).toISOString()};continue}
        if(!loc.sentAt)loc.sentAt=sentAt;
        if(!loc.senderId)loc.senderId=senderId;
        if(!loc.accountId)loc.accountId=accountId;
        if(!loc.groupName || loc.groupName===loc.groupId)loc.groupName=asString(group.groupName,120) || loc.groupName;
        report.repaired++;
    }
    return report;
}
