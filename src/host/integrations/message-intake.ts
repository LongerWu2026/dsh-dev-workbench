import {asString,hostNowIso} from '../platform/runtime.js'
import {messageProcessingStart} from '../domain/message-policy.js'
import {messageReplyId,messageSentAt as yzjMessageTime} from './reply-reconciliation.js'
import {mentionSignals,MESSAGE_INTAKE_POLICY} from '../../shared/message-intake.js'
const ensureArray=(x:any):any[]=>Array.isArray(x)?x:[]
export async function fetchFocusedMessages(ctx:any,probe:any,cursors:any,installedAt:string,runYzj:any,state:any={}):Promise<any> {
    let calls=0,deferred=false;const request=async(args:string[])=>{calls++;return runYzj(ctx,args)};
    const start = messageProcessingStart(installedAt);
    const cutoff = start ? Date.parse(start) : null;
    const pendingKey = '__pending:' + (probe.accountId || probe.openId);
    const pending = cursors?.[pendingKey];
    if (pending?.retryAt && Date.parse(pending.retryAt)>Date.now()) return {mentions:[],cursors,scannedGroups:0,scannedMessages:0,pageFailures:[],sessionPageErrors:[{status:pending.reason==='budget'?'deferred':'rate_limited',note:(pending.reason==='budget'?'分批采集等待下一轮':'限流冷却中')+'，保留补采位；下次重试 '+pending.retryAt}],rateLimited:pending.reason!=='budget',deferred:pending.reason==='budget'};
    const groups: any = ensureArray(pending?.intakePolicy===MESSAGE_INTAKE_POLICY?pending.pendingGroups:[]).slice();
    const replyObservations:any[]=[];
    const freshGroups=new Set<string>();
    const pageErrors: any = [];
    const nextCursors = Object.assign({}, cursors || {});
    const discoveryKey='__focusedDiscovery:'+(probe.accountId || probe.openId);
    const discovery = cursors && cursors[discoveryKey];
    let unreadTotal:number|null=null;const conversations:any[]=[];
    let page = discovery && discovery.discoveryPage || 1;
    // Always refresh page one, then continue a bounded discovery sweep on later ticks.
    const pages = groups.length ? [1] : Array.from(new Set([1, page, page + 1, page + 2])).slice(0, 3);
    let rateLimited = false;
    for (const pageIndex of pages) {
        const listed = await request(['im', 'group', 'recent', '--limit', '20', '--page', String(pageIndex)]);
        if (listed.status !== 'ok') {
            pageErrors.push({ status: listed.status, note: listed.note });
            nextCursors[discoveryKey] = { discoveryPage: pageIndex };
            if (listed.status==='rate_limited') { rateLimited=true; nextCursors[pendingKey]={accountId:probe.accountId || probe.openId,intakePolicy:MESSAGE_INTAKE_POLICY,pendingGroups:groups,reason:'rate_limit',retryAt:new Date(Date.now()+120000).toISOString()} }
            break;
        }
        const data = listed.json && listed.json.data || {};
        const batch = ensureArray(data.list);
        if(pageIndex===1&&typeof data.unreadTotal==='number')unreadTotal=data.unreadTotal;
        for(const group of ensureArray(data.list))conversations.push({groupId:group.groupId,name:group.groupName,groupType:group.groupType,latestDirection:group.lastMsg?.fromOpenId?(group.lastMsg.fromOpenId===probe.openId?'outbound':'inbound'):null,latestMsgId:group.lastMsg?.msgId||group.lastMsgId||null,latestSentAt:yzjMessageTime(group.lastMsg?.sendTime),unreadCount:typeof group.unreadCount==='number'?group.unreadCount:null,at:hostNowIso()});
        for (const group of batch) {
            if (!group?.groupId) continue;
            freshGroups.add(group.groupId);
            replyObservations.push({groupId:group.groupId,groupType:group.groupType,unreadCount:typeof group.unreadCount==='number'?group.unreadCount:null,messages:group.lastMsg?[group.lastMsg]:[],latest:group.lastMsg});
            const existingGroup=groups.find((row:any)=>row.groupId===group.groupId);
            if (existingGroup) Object.assign(existingGroup,group);
            else groups.push(group);
        }
        nextCursors[discoveryKey] = { discoveryPage: pageIndex + 1 };
        if (data.more === false || (data.more !== true && batch.length < 20)) {
            nextCursors[discoveryKey] = { discoveryPage: 1 };
            break;
        }
    }
    if (!groups.length && !pageErrors.length)
        return null;
    // New unread conversations take precedence over historical mention sweeps.
    const priority=(g:any)=>Number(g.groupType)===1&&g.unreadCount>0?4:mentionSignals(g.lastMsg,probe.openId).includes('mention_me')?3:g.unreadCount>0?2:mentionSignals(g.lastMsg,probe.openId).includes('mention_all')?1:0;
    groups.sort((a:any,b:any)=>priority(b)-priority(a));
    const mentions: any = [];
    // A fresh unread private head is sufficient evidence; do not wait for older pages.
    for(const group of groups){
        const m=group.lastMsg,sentAt=yzjMessageTime(m?.sendTime);
        if(!freshGroups.has(group.groupId)||Number(group.groupType)!==1||!(group.unreadCount>0)||!m?.msgId||!m.fromOpenId||m.fromOpenId===probe.openId||group.lastMsgId&&group.lastMsgId!==m.msgId||!sentAt||cutoff!==null&&Date.parse(sentAt)<cutoff||!m.content)continue;
        mentions.push({msgId:asString(m.msgId,80),groupId:asString(group.groupId,120),groupName:asString(group.groupName,120)||'未知会话',accountId:probe.accountId||probe.openId,content:asString(m.content,4000),fromOpenId:m.fromOpenId,sendTime:sentAt,direction:'inbound',intake:true,groupType:1,replyToMsgId:messageReplyId(m),selection:{policy:MESSAGE_INTAKE_POLICY,reasons:['unread'],unreadCount:group.unreadCount,observedAt:hostNowIso()}});
    }
    const failures: any = [];
    let scannedMessages = 0;
    for (const [groupIndex, group] of groups.entries()) {
        if (rateLimited) break;
        const groupId = asString(group.groupId, 120);
        const key = (probe.accountId || probe.openId) + ':' + groupId;
        const legacy = nextCursors[groupId];
        const stored=nextCursors[key] || (legacy && (!legacy.accountId || legacy.accountId === (probe.accountId || probe.openId)) ? legacy : {});
        const cursor=stored.intakePolicy==='focused-v1'?stored:{};
        if(freshGroups.has(groupId) && nextCursors[key])nextCursors[key]={...nextCursors[key],groupType:group.groupType,unreadCount:typeof group.unreadCount==='number'?group.unreadCount:null};
        const unreadRaised=freshGroups.has(groupId)&&group.unreadCount>0&&(cursor.unreadCount==null||cursor.lastMsgId===group.lastMsgId&&(group.unreadCount>cursor.unreadCount||!cursor.unreadHeadId));
        if(cursor.lastMsgId&&group.lastMsgId&&cursor.lastMsgId===group.lastMsgId && !cursor.resumeBefore&&!unreadRaised)continue;
        const fetched: any = [];
        const unreadIds=new Set<string>(cursor.resumeBefore && freshGroups.has(groupId) && cursor.unreadHeadId===group.lastMsgId && cursor.unreadCount===group.unreadCount ? ensureArray(cursor.unreadMsgIds) : []);
        let unreadRemaining:number|null=anchorlessUnread(cursor,group,freshGroups.has(groupId));
        let unreadHeadId=cursor.unreadHeadId || group.lastMsgId || null;
        const observedMessages: any[] = [];
        let latestMessage = group.lastMsg || null;
        let anchor = cursor.resumeBefore || null;
        let newest = cursor.pendingNewest || null;
        let complete = false;
        let failed = false;
        for (let turn = 0; turn < 4; turn += 1) {
            if(calls>=12){deferred=true;failed=true;break;}
            const args: any = ['im', 'message', 'list', '--group-id', groupId, '--limit', '20', '--type', anchor ? 'old' : 'newest'];
            if (anchor)
                args.push('--msg-id', anchor);
            const listed = await request(args);
            if (listed.status !== 'ok') {
                failures.push({ group: groupId, status: listed.status, note: listed.note });
                failed = true;
                if (listed.status==='rate_limited') rateLimited=true;
                break;
            }
            const rows = ensureArray(listed.json && listed.json.data && listed.json.data.list).map(function (row?: any): any { return row && row.message || row; }).filter(Boolean);
            observedMessages.push(...rows);
            if(!anchor){
                const actualHead=rows.at(-1)?.msgId;
                unreadRemaining=freshGroups.has(groupId)&&typeof group.unreadCount==='number'&&group.unreadCount>=0&&(!group.lastMsgId||actualHead===group.lastMsgId)?group.unreadCount:null;
                unreadHeadId=actualHead||group.lastMsgId||null;
            }
            if(unreadRemaining!==null){for(const row of rows.slice(-Math.min(unreadRemaining,rows.length)))if(unreadRemaining>0)unreadIds.add(row.msgId);unreadRemaining=Math.max(0,unreadRemaining-rows.length);}
            if (!anchor && rows.length) latestMessage=rows[rows.length-1];
            scannedMessages += rows.length;
            if (!newest && rows.length)
                newest = asString(rows[rows.length - 1].msgId, 80);
            const boundary = cursor.lastMsgId&&!unreadRaised ? rows.findIndex(function (row?: any): any { return row.msgId === cursor.lastMsgId; }) : -1;
            // Persist the new part of the boundary page before stopping.
            const fresh = boundary >= 0 ? rows.slice(boundary + 1) : rows;
            fetched.push(...fresh.filter((row:any)=>cutoff === null || Date.parse(yzjMessageTime(row.sendTime) || '') >= cutoff));
            const reachedInstallDate = cutoff !== null && rows.some((row:any)=>Date.parse(yzjMessageTime(row.sendTime) || '') < cutoff);
            if (boundary >= 0 || reachedInstallDate || rows.length < 20) {
                complete = true;
                break;
            }
            const nextAnchor = rows[0] && rows[0].msgId;
            if (!nextAnchor || nextAnchor === anchor) {
                failures.push({ group: groupId, status: 'error', note: '消息分页没有前进，保留补采位' });
                failed = true;
                break;
            }
            anchor = nextAnchor;
        }
        const unreadCount=freshGroups.has(groupId)&&unreadRemaining!==null&&typeof group.unreadCount==='number' && group.unreadCount>=0 &&
            (!group.lastMsgId || !latestMessage?.msgId || group.lastMsgId===latestMessage.msgId) ? group.unreadCount : null;
        replyObservations.push({groupId,groupType:group.groupType,unreadCount:freshGroups.has(groupId)?unreadCount:null,messages:observedMessages,latest:latestMessage});
        const allowedGroup=group.groupType===undefined || [1,2,3,8].includes(Number(group.groupType));
        const linkedIds=new Set((state.sources||[]).filter((source:any)=>source.provider==='yunzhijia'&&source.locator?.groupId===groupId&&[probe.accountId,probe.openId].includes(source.locator?.accountId)&&((state.replies||[]).some((r:any)=>r.sourceId===source.id&&!['已回复','不需回复'].includes(r.stage))||(state.tasks||[]).some((t:any)=>!['completed','cancelled'].includes(t.status)&&(t.sourceRefId===source.id||(t.sourceRefs||[]).some((ref:any)=>ref.sourceId===source.id))))).map((source:any)=>source.locator.msgId));
        for(const message of fetched){
            if(!message.msgId||!allowedGroup)continue;
            const own=message.fromOpenId===probe.openId,replyToMsgId=messageReplyId(message);
            const reasons=mentionSignals(message,probe.openId);
            if(!own&&unreadIds.has(message.msgId))reasons.push('unread');
            if(replyToMsgId&&linkedIds.has(replyToMsgId))reasons.push('followup');
            if(!reasons.length||own&&!reasons.includes('followup'))continue;
            const intake=!own&&reasons.some((r:string)=>r!=='followup');
            mentions.push({msgId:asString(message.msgId,80),groupId,groupName:asString(group.groupName,120)||'未知会话',accountId:probe.accountId||probe.openId,content:asString(message.content,4000),fromOpenId:message.fromOpenId||null,sendTime:yzjMessageTime(message.sendTime),direction:own?'outbound':'inbound',intake,groupType:group.groupType,replyToMsgId,selection:{policy:MESSAGE_INTAKE_POLICY,reasons:[...new Set(reasons)],unreadCount,observedAt:hostNowIso()}});
        }
        // The caller commits these cursors together with every fetched source, without truncating the batch.
        nextCursors[key] = complete && !failed
            ? { intakePolicy:MESSAGE_INTAKE_POLICY,lastMsgId: newest || cursor.lastMsgId || '', unreadHeadId, unreadMsgIds:[...unreadIds].slice(-2000), accountId:probe.accountId || probe.openId, groupType:group.groupType, unreadCount, lastSendTime: null, groupName: group.groupName, at: hostNowIso() }
            : Object.assign({}, cursor, { intakePolicy:MESSAGE_INTAKE_POLICY,resumeBefore: anchor, pendingNewest: newest, unreadRemaining, unreadHeadId, unreadMsgIds:[...unreadIds].slice(-2000), accountId:probe.accountId || probe.openId, groupType:group.groupType, unreadCount, groupName: group.groupName, at: hostNowIso() });
        // Legacy key remains readable for existing profiles and is kept synchronized during upgrade.
        nextCursors[groupId] = nextCursors[key];
        if (rateLimited||deferred) {
            nextCursors[pendingKey]={accountId:probe.accountId || probe.openId,intakePolicy:MESSAGE_INTAKE_POLICY,pendingGroups:groups.slice(groupIndex),reason:rateLimited?'rate_limit':'budget',retryAt:new Date(Date.now()+(rateLimited?120000:30000)).toISOString()};
            break;
        }
    }
    if (!rateLimited&&!deferred) nextCursors[pendingKey]={accountId:probe.accountId || probe.openId,intakePolicy:MESSAGE_INTAKE_POLICY,discoveryPage:1,pendingGroups:[],retryAt:null};
    const distinct=[...new Map(mentions.map((m:any)=>[JSON.stringify([m.groupId,m.msgId]),m])).values()];
    distinct.sort((a:any,b:any)=>new Date(a.sendTime || 0).getTime()-new Date(b.sendTime || 0).getTime());
    return { mentions:distinct,inbox:{accountId:probe.accountId||probe.openId,at:hostNowIso(),unreadTotal,conversations,complete:!pageErrors.length&&!rateLimited&&!deferred},cursors: nextCursors, replyObservations, scannedGroups: groups.length, scannedMessages, pageFailures: failures, sessionPageErrors: pageErrors, rateLimited,deferred };
}

/** Resume unread tail only against a freshly verified, unchanged conversation header. */
function anchorlessUnread(cursor:any,group:any,fresh:boolean):number|null {
 return cursor.resumeBefore&&fresh&&group.unreadCount>0&&cursor.unreadHeadId&&cursor.unreadHeadId===group.lastMsgId&&typeof cursor.unreadRemaining==='number'?Math.min(cursor.unreadRemaining,group.unreadCount):null;
}
