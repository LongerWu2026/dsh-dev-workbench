import {seedUnreadPrivateReplies} from '../domain/reply-routing.js'
import {skipHistoricalMessages} from '../domain/message-policy.js'
import {fetchCalendarPlan,applyCalendarPlan} from './calendar-sync.js'
import {fetchFocusedMessages} from './message-intake.js'
import {normalizeMessageSelection,normalizeMessageInbox,mentionSignals} from '../../shared/message-intake.js'
import { messageProcessingStart } from '../domain/message-policy.js'
import { createHash } from '../platform/runtime.js'
import { asIso, asString, asUrl, existsSync, homedir, hostNowIso, join, newId, readdirSync } from '../platform/runtime.js'
import { auditEntry, ensureArray, normalizeSource } from '../domain/model.js'
import { SEARCH_GROUP_LIMIT } from '../search/search-policy.js'
import { loadWorkbenchState, mutateWorkbenchState, workbenchGenerationGuard } from '../storage/state-store.js'
import { messageConversation, messageSender } from '../../shared/message-display.js'
import { linkedMessageSources, repairLinkedMessageMetadata } from './message-metadata.js'
import { messageReplyId, reconcileYunzhijiaReplies, replyStatusSnapshot, mergeReconciledReplies } from './reply-reconciliation.js'
/* ============================================================================
 * dev-workbench host — 云之家 yzj-cli integration (design report §3.2, §6.3)
 *
 * The enterprise connector, at last, against the real CLI. Design report §6.3
 * demanded measured facts, not claims, so every capability listed here is
 * something this module actually exercised:
 *
 *   - `yzj-cli whoami`        → authenticated user (name, openId, token expiry)
 *   - `im message search`     → cross-group keyword search; @mentions carry
 *                               param.notifyType === 1 and param.desc[]
 *                               entries {type:'at', data:<openId>}
 *   - `doc search`            → knowledge-base title search (openWebUrl may be
 *                               null; never fabricate a link)
 *
 * Background commands remain read-only. An explicit user-confirmed reply has
 * a separate text-only entry point; it does not extend the read allowlist.
 *
 * The binary is resolved through ctx.subprocess.resolveExecutable when the
 * provider can see it, with an nvm-path fallback because GUI-launched hosts
 * often lack shell-profile PATH entries.
 * ========================================================================== */
const YZJ_TIMEOUT_MS = 15000;
const YZJ_MAX_BYTES = 512 * 1024;
const MENTIONS_FETCH_LIMIT = 80;
/** Read-only command prefixes; anything else is refused before spawn. */
const YZJ_READ_ONLY: any = [
    'whoami',
    'im group recent',
    'im group search',
    'im group.members list',
    'im message list',
    'im message search',
    'contact user search',
    'contact user get',
    'contact dept get',
    'approval flow list',
    'approval flow get',
    'calendar event list',
    'calendar event get',
    'calendar event participants',
    'calendar room find',
    'doc workspace list',
    'doc workspace get',
    'doc list',
    'doc get',
    'doc recent',
    'doc search',
    'doc block list',
    'doc download',
    'sheet get',
    'sheet table get',
    'sheet record list',
    'attendance record list',
];
let yzjPathCache: any = undefined;
function yzjCommandAllowed(argv?: any): any {
    if (!Array.isArray(argv) || argv.length < 1)
        return false;
    const parts = argv.map(String);
    // Drop a leading binary name if present: callers pass either the bare
    // subcommand argv ('whoami') or the full argv including the resolved path.
    if (parts.length > 1 && /yzj-cli$/i.test(parts[0]))
        parts.shift();
    const candidate = parts.join(' ');
    if (candidate.length === 0)
        return false;
    return YZJ_READ_ONLY.some(function (prefix?: any): any {
        return candidate === prefix || candidate.startsWith(prefix + ' ');
    });
}
async function resolveYzjPath(ctx?: any): Promise<any> {
    if (yzjPathCache !== undefined)
        return yzjPathCache;
    const subprocess = ctx && ctx.get ? ctx.get('subprocess') : null;
    if (subprocess && typeof subprocess.resolveExecutable === 'function') {
        let signal;
        try {
            signal = AbortSignal.timeout(2500);
        }
        catch (e) {
            signal = undefined;
        }
        try {
            const resolved = await subprocess.resolveExecutable('yzj-cli', undefined, signal);
            if (typeof resolved === 'string' && resolved.length > 0) {
                yzjPathCache = resolved;
                return resolved;
            }
        }
        catch (e) {
            /* fall through to the filesystem scan */
        }
    }
    // Filesystem scan ONLY when no subprocess provider exists AND the host
    // process itself shows an nvm-style environment; a scan that silently
    // executes a discovered binary is a real capability gain, so it must be
    // observable (the connector row reports the resolved path). The scan is
    // skipped entirely when a provider is present but resolution failed — that
    // provider owns the truth about its execution world.
    const home = homedir();
    const nvmDir = process.env.NVM_DIR || join(home, '.nvm');
    const candidates: any = [
        join(nvmDir, 'versions', 'node'),
        '/usr/local/bin',
        join(home, '.local', 'bin'),
        join(home, '.cargo', 'bin'),
        join(home, 'bin'),
    ];
    const sawProvider = !!subprocess;
    for (const dir of candidates) {
        const direct = join(dir, 'yzj-cli');
        if (existsSync(direct)) {
            // A provider that failed to resolve while the file exists is suspicious;
            // trust the provider only when it did resolve. Otherwise fall back.
            if (sawProvider)
                continue;
            yzjPathCache = direct;
            return direct;
        }
        try {
            const versions = readdirSync(dir);
            for (const version of versions) {
                const nested = join(dir, version, 'bin', 'yzj-cli');
                if (existsSync(nested)) {
                    if (sawProvider)
                        continue;
                    yzjPathCache = nested;
                    return nested;
                }
            }
        }
        catch (e) {
            /* not an nvm directory */
        }
    }
    // Misses are NOT cached: a yzj-cli installed later (or a subprocess provider
    // appearing in a later test pass) must be picked up without a restart, and a
    // failed probe is cheap compared to a stale "unconfigured" verdict.
    return null;
}
/** Invalidate the resolved-binary cache (used by tests and manual reprobe). */
function invalidateYzjPathCache(): any {
    yzjPathCache = undefined;
}
/**
 * Run one read-only yzj-cli command and parse its JSON envelope.
 * Never throws: every failure is data, so callers degrade instead of break.
 */
async function runYzj(ctx?: any, args?: any): Promise<any> {
    if (!yzjCommandAllowed(['yzj-cli'].concat(args))) {
        return { status: 'refused', note: '命令不在云之家只读 allowlist 内：yzj-cli ' + args.join(' ') };
    }
    return executeYzj(ctx, args);
}
/** Only the reply use case calls this; IDs and account are checked there. */
async function sendYzjTextReply(ctx: any, groupId: string, msgId: string|null, text: string): Promise<any> {
    const args=['im','message','send','--group-id',groupId,'--msg-type','text','--content',text];
    if(msgId)args.push('--reply-msg-id',msgId);
    return executeYzj(ctx,args);
}
async function executeYzj(ctx: any, args: string[]): Promise<any> {
    const path = await resolveYzjPath(ctx);
    if (!path) {
        return { status: 'unavailable', note: '未找到 yzj-cli（PATH 与常见安装位置都没有）' };
    }
    const subprocess = ctx && ctx.get ? ctx.get('subprocess') : null;
    if (!subprocess || typeof subprocess.spawn !== 'function') {
        return { status: 'unavailable', note: '当前 profile 未组合 subprocess 服务' };
    }
    let signal;
    try {
        signal = AbortSignal.timeout(YZJ_TIMEOUT_MS);
    }
    catch (e) {
        signal = undefined;
    }
    let handle;
    try {
        handle = subprocess.spawn({
            argv: [path].concat(args.map(String)),
            cwd: homedir(),
            stdio: {
                stdin: 'ignore',
                stdout: { maxBytes: YZJ_MAX_BYTES },
                stderr: { maxBytes: 16 * 1024 },
            },
            graceMs: 2500,
            signal: signal,
        });
    }
    catch (e) {
        return { status: 'error', note: '无法启动 yzj-cli：' + String((e && e.message) || e) };
    }
    try {
        const outcome = await handle.done;
        const read = function (reader?: any): any {
            if (!reader || typeof reader.readFrom !== 'function')
                return '';
            try {
                return String(reader.readFrom(0).text || '');
            }
            catch (e) {
                return '';
            }
        };
        const stdout = read(handle.collected && handle.collected.stdout);
        const stderr = read(handle.collected && handle.collected.stderr);
        if (outcome && outcome.exitCode !== 0) {
            if (/10000429|请求过于频繁|too many requests/i.test(stderr + stdout)) return {status:'rate_limited',note:'云之家请求过于频繁（10000429），暂停采集 2 分钟后续采'};
            return {
                status: 'error',
                exitCode: outcome.exitCode,
                uncertain: !!outcome.signal || outcome.exitCode == null,
                note: (stderr.trim() || stdout.trim() || '退出码 ' + outcome.exitCode).slice(0, 300),
            };
        }
        let json: any = null;
        try {
            json = JSON.parse(stdout);
        }
        catch (e) {
            json = null;
        }
        if (!json || typeof json !== 'object') {
            return { status: 'error', exitCode: 0, uncertain: true, note: 'yzj-cli 输出不是 JSON（可能要求重新登录）' };
        }
        if (json.success !== true) {
            const errorCode = json.errorCode || (json.error && (json.error.errorCode || json.error.code));
            if (Number(errorCode)===10000429) return {status:'rate_limited',note:'云之家请求过于频繁（10000429），暂停采集 2 分钟后续采'};
            return {
                status: 'unauthorized',
                note: '云之家返回失败' + (errorCode ? '（errorCode ' + errorCode + '，可能需要重新 auth login）' : ''),
                json: json,
            };
        }
        return { status: 'ok', json: json };
    }
    catch (e) {
        return { status: 'error', uncertain: true, note: String((e && e.message) || e).slice(0, 300) };
    }
}
/** Who is logged in, and is the token usable. Cached briefly per call site. */
async function probeYunzhijia(ctx?: any): Promise<any> {
    const result = await runYzj(ctx, ['whoami']);
    if (result.status === 'unavailable') {
        return { state: 'unconfigured', note: result.note, name: null, openId: null, expiresAt: null };
    }
    if (result.status === 'refused' || result.status === 'error' || result.status === 'rate_limited') {
        return { state: 'error', note: result.note || 'whoami 执行失败', name: null, openId: null, expiresAt: null };
    }
    if (result.status === 'unauthorized') {
        return { state: 'unauthorized', note: result.note, name: null, openId: null, expiresAt: null };
    }
    const data = result.json && result.json.data;
    if (!data || typeof data.openId !== 'string') {
        return { state: 'error', note: 'whoami 返回缺少 openId', name: null, openId: null, expiresAt: null };
    }
    return {
        state: 'ok',
        note: null,
        name: asString(data.name, 80) || null,
        openId: data.openId,
        accountId: data.orgId ? String(data.orgId) + ":" + data.openId : data.openId,
        expiresAt: asIso(data.expiresAt) || null,
    };
}
/* ------------------------------------------------------------- @mentions */
function yzjMessageTime(value: unknown): string | null {
    const text=typeof value==='string'?value.trim():value
    return asIso(typeof text==='string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text) ? text.replace(' ','T')+'+08:00' : text)
}
function yzjMentionTargetsMe(message?: any, myOpenId?: any): any {
    if (!message || typeof message !== 'object')
        return false;
    const param = message.param;
    if (param && typeof param === 'object') {
        if ([true, 1, '1'].includes(param.notifyToAll)) return true;
        const targets = Array.isArray(param.desc) ? param.desc.filter((entry:any) => entry?.type === 'at') : [];
        // Explicit targets take precedence: @another person is not @me.
        if (targets.length) return targets.some((entry:any) => entry.data === 'all' || !!myOpenId && entry.data === myOpenId);
        // Older CLI payloads expose only notifyType for a notification to me.
        return Number(param.notifyType) === 1;
    }
    return false;
}
/** 通讯录单次最多 50 人，分批补全全部发送人。失败时留待下次同步。 */
async function resolveSenderNames(ctx?: any, openIds?: any, report: any = {}): Promise<any> {
    const unique = Array.from(new Set((openIds || []).filter(function (id?: any): any {
        return typeof id === 'string' && id.length > 0;
    })));
    const map = new Map();
    Object.assign(report, {status:'ok', requested:unique.length, resolved:0, invalidIds:[], calls:0, note:null});
    let stopped = false;
    const maxCalls = Math.max(16, Math.ceil(unique.length / 50) * 16);
    async function lookup(ids:any[]):Promise<void> {
        if (stopped || !ids.length) return;
        if (report.calls >= maxCalls) {
            stopped = true; report.status = 'partial'; report.note = '本轮姓名查询达到上限，剩余发送人后续补全'; return;
        }
        const args: any = ['contact', 'user', 'get'];
        ids.forEach(id => args.push('--open-id', id));
        report.calls++;
        const result = await runYzj(ctx, args);
        if (result.status === 'ok' && result.json?.data) {
            const list = Array.isArray(result.json.data.list) ? result.json.data.list : [result.json.data];
            for (const user of list) {
                const name = asString(user?.name || user?.userName, 80);
                if (ids.includes(user?.openId) && name) map.set(user.openId, name);
            }
            return;
        }
        // The real API rejects the whole batch if even one openId is invalid.
        // Split only this explicit error; never fan out on permissions or rate limits.
        if (/\b1001001\b|Invalid openIds/i.test(result.note || '')) {
            report.status = 'partial';
            if (ids.length === 1) { report.invalidIds.push(ids[0]); return; }
            const middle = Math.ceil(ids.length / 2);
            await lookup(ids.slice(0, middle));
            await lookup(ids.slice(middle));
        } else {
            stopped = true; report.status = result.status; report.note = result.note || '姓名查询不可用';
        }
    }
    for (let offset = 0; offset < unique.length && !stopped; offset += 50) await lookup(unique.slice(offset, offset + 50));
    report.resolved = map.size;
    return map;
}
function enrichSenderNames(state:any, sources:any[], names:Map<string,string>):void {
    const previousSenders = new Map(sources.map((row:any) => [row.id, row.sender]));
    const sourceById = new Map(sources.map((row:any) => [row.id, row]));
    for (const source of sources) {
        const previousName = messageSender(source);
        if (names.has(source.locator?.senderId)) source.sender = names.get(source.locator.senderId);
        const prefix = source.locator?.intake === false ? '上下文 · ' : '消息 · ';
        const suffix = messageConversation(source.locator?.groupName, source.locator?.groupId) === '原会话' ? '' : ' · ' + source.locator.groupName;
        if ([prefix + source.locator?.groupName, prefix + source.locator?.groupId, prefix + previousName + suffix].includes(source.title)) source.title = prefix + messageSender(source) + suffix;
    }
    for (const reply of ensureArray(state.replies)) {
        const source = sourceById.get(reply.sourceId);
        if (source && !['未知发件人','机器人'].includes(messageSender(source)) && (!reply.contact || reply.contact === previousSenders.get(source.id) || ['未知发件人','机器人'].includes(messageSender({sender:reply.contact,locator:source.locator})))) reply.contact = source.sender;
    }
}
function yzjParseMentionSearch(json?: any, myOpenId?: any): any {
    const out: any = [];
    const groups = json && json.data && Array.isArray(json.data.list) ? json.data.list : [];
    for (const group of groups) {
        const groupName = asString(group && group.group && group.group.groupName, 120) || '未知会话';
        const groupId = asString(group && group.group && group.group.groupId, 60) || null;
        const messages = group && Array.isArray(group.messages) ? group.messages : [];
        for (const wrapper of messages) {
            const message = wrapper && wrapper.message ? wrapper.message : wrapper;
            if (!message || typeof message !== 'object')
                continue;
            if (!yzjMentionTargetsMe(message, myOpenId))
                continue;
            if (message.fromOpenId === myOpenId)
                continue;
            out.push({
                selection:{policy:'focused-v1',reasons:mentionSignals(message,myOpenId),unreadCount:null,observedAt:hostNowIso()},
                msgId: asString(message.msgId, 60),
                groupId: groupId,
                groupName: groupName,
                content: asString(message.content, 2000),
                fromOpenId: asString(message.fromOpenId, 60) || null,
                sendTime: yzjMessageTime(message.sendTime) || null,
            });
        }
    }
    return out;
}
/**
 * 增量游标同步（TODO 05）：
 *   1. im group recent 取最近会话；
 *   2. 每个群用 cursor.lastMsgId 拉「新消息」（--type new），没有游标时取最新一页；
 *   3. 用 param.notifyType / desc[].type==='at' 判定「有人在群里 @我」——
 *      这条判据不依赖显示名，因此**昵称 @ 也能覆盖**（关键词检索会漏）；
 *   4. 把每群最新 msgId 存回游标，下次只取增量。
 * 返回 null 表示这条路不可用，调用方回退到关键词检索。
 */
async function fetchMentionsIncremental(ctx?:any,probe?:any,cursors?:any,installedAt?:string,state?:any):Promise<any>{
    return fetchFocusedMessages(ctx,probe,cursors,installedAt||'',runYzj,state);
}

/**
 * Design report §3.2: pull @-mention messages as source evidence. Deterministic
 * part only — creating tasks with AI-extracted fields stays an agent job.
 * Keyword search matches "@<display name>"; a custom remark name would be
 * missed, and the persisted report says so honestly.
 */
async function fetchYunzhijiaMentionsInto(ctx?: any, state?: any): Promise<any> {
    const probe = await probeYunzhijia(ctx);
    const at = hostNowIso();
    if (probe.state !== 'ok') {
        state.lastMentionsFetch = {
            at: at,
            status: probe.state,
            found: 0,
            added: 0,
            note: probe.note || '云之家不可用',
        };
        auditEntry(state, 'mentions.fetch', '云之家不可用：' + (probe.note || probe.state));
        return state;
    }
    // Read reply evidence before historical metadata and name lookups.
    state.syncCursors ||= {};
    const incrementalResult = await fetchMentionsIncremental(ctx, probe, state.syncCursors, state.installedAt,state);
    const incremental = incrementalResult && incrementalResult.error ? null : incrementalResult;
    const incrementalError = incrementalResult && incrementalResult.error ? incrementalResult.error : null;
    if (incremental?.cursors) state.syncCursors=incremental.cursors;
    const replyReport=await reconcileYunzhijiaReplies(ctx,state,probe,runYzj,incremental?.replyObservations || []);
    state.__calendarPlan=await fetchCalendarPlan(ctx,state,probe,runYzj);
    const metadataReport=incremental?.rateLimited || replyReport.rateLimited ? {repaired:0,failed:0} : await repairLinkedMessageMetadata(ctx,state,probe,runYzj);
    const accountId = probe.accountId || probe.openId;
    const nameCursorKey = '__senderNames:' + accountId;
    const unavailable = new Map<string,string>(ensureArray(state.syncCursors[nameCursorKey]?.unavailableSenders).filter((row:any) => Date.parse(row.retryAt) > Date.now()).map((row:any) => [row.id,row.retryAt]));
    function rememberNameFailures(report:any):void {
        for (const id of report.invalidIds || []) unavailable.set(id,new Date(Date.now()+3600000).toISOString());
        state.syncCursors[nameCursorKey] = {accountId,retryAt:report.status === 'rate_limited' ? new Date(Date.now()+120000).toISOString() : null,unavailableSenders:[...unavailable].map(([id,retryAt])=>({id,retryAt}))};
    }
    const accountSources = ensureArray(state.sources).filter((row:any) => row.provider === 'yunzhijia' && [accountId, probe.openId].includes(row.locator?.accountId));
    const senderNames = new Map<string, string>();
    for (const source of accountSources) if (source.locator?.senderId && !['未知发件人','机器人'].includes(messageSender(source))) senderNames.set(source.locator.senderId, source.sender);
    const prioritySources = new Set(ensureArray(state.replies).filter((row:any) => ['待回复','已确认收到'].includes(row.stage)).map((row:any) => row.sourceId).concat(ensureArray(state.tasks).filter((row:any) => !['completed','cancelled'].includes(row.status)).map((row:any) => row.sourceRefId)));
    const unresolved = accountSources.slice().reverse().filter((row:any) => row.locator?.senderId && !senderNames.has(row.locator.senderId) && !unavailable.has(row.locator.senderId));
    const pendingIds = [...new Set(unresolved.filter((row:any) => prioritySources.has(row.id)).concat(unresolved).map((row:any) => row.locator.senderId))].slice(0, 100);
    const nameReport:any = {};
    if (Date.parse(state.syncCursors?.[nameCursorKey]?.retryAt) > Date.now()) Object.assign(nameReport,{status:'rate_limited',resolved:0,note:'姓名查询冷却中，稍后重试'});
    else {
        for (const [id, name] of await resolveSenderNames(ctx, pendingIds, nameReport)) senderNames.set(id, name);
        rememberNameFailures(nameReport);
    }
    enrichSenderNames(state, accountSources, senderNames);
    // 优先走增量游标（可覆盖昵称 @）；不可用时回退关键词检索
    let keywords = [...new Set(['@' + probe.name, '@all'].concat(ensureArray(state.settings && state.settings.mentionKeywords).map(function (word?: any): any {
        return String(word).indexOf('@') === 0 ? String(word) : '@' + String(word);
    })))];
    const keywordMentions: any = [];
    let searchFailure = incrementalError;
    if (!incremental) {
        for (const keyword of keywords.slice(0, 3)) {
            const searched = await runYzj(ctx, ['im', 'message', 'search', '--keyword', keyword]);
            if (searched.status !== 'ok') {
                // 如实记录失败：不要把「接口不可用」当成「没有 @我」
                if (!searchFailure)
                    searchFailure = { status: searched.status, note: searched.note };
                continue;
            }
            for (const mention of yzjParseMentionSearch(searched.json, probe.openId))
                keywordMentions.push(mention);
        }
    }
    if (!incremental && keywordMentions.length === 0 && searchFailure) {
        state.lastMentionsFetch = {
            at: at,
            status: searchFailure.status === 'refused' ? 'error' : searchFailure.status,
            found: 0,
            added: 0,
            note: '消息接口不可用：' + (searchFailure.note || searchFailure.status),
        };
        auditEntry(state, 'mentions.fetch', '消息接口不可用：' + (searchFailure.note || searchFailure.status));
        return state;
    }
    if(incremental?.inbox){const old=state.messageInbox?.accountId===accountId?state.messageInbox:null;state.messageInbox=normalizeMessageInbox({...incremental.inbox,conversations:[...(old?.conversations||[]).filter((x:any)=>!incremental.inbox.conversations.some((n:any)=>n.groupId===x.groupId)),...incremental.inbox.conversations],calendar:state.__calendarPlan?.report||old?.calendar});}
    if(!state.messageInbox||state.messageInbox.accountId!==accountId)state.messageInbox=normalizeMessageInbox({accountId,at,unreadTotal:null,conversations:[],calendar:state.__calendarPlan?.report});
    else state.messageInbox.calendar=state.__calendarPlan?.report||state.messageInbox.calendar;
    const rawMentions = incremental
        ? incremental.mentions
        : keywordMentions;
    const start = messageProcessingStart(state.installedAt);
    const mentions = rawMentions.map((m:any)=>({...m,selection:normalizeMessageSelection(m.selection)})).filter((m:any)=>m.selection)
        .filter((mention:any)=>!start || Date.parse(mention.sendTime || '') >= Date.parse(start))
        .filter(function (mention?: any): any {
        return !!mention.msgId;
    });
    if(state.messageInbox)for(const source of state.sources){if(source.provider!=='yunzhijia'||source.locator?.accountId!==accountId||!source.selection)continue;const conv=state.messageInbox.conversations.find((c:any)=>c.groupId===source.locator.groupId);if(conv)source.selection={...source.selection,unreadCount:conv.unreadCount,observedAt:conv.at};}
    const missingIds = [...new Set(mentions.map((row:any) => row.fromOpenId).filter((id:string) => id && !senderNames.has(id) && !pendingIds.includes(id) && !unavailable.has(id)))].slice(0, 100);
    if (!incremental?.rateLimited && nameReport.status !== 'rate_limited' && missingIds.length) {
        const extra:any = {};
        for (const [id, name] of await resolveSenderNames(ctx, missingIds, extra)) senderNames.set(id, name);
        nameReport.resolved = (nameReport.resolved || 0) + extra.resolved;
        nameReport.invalidIds = (nameReport.invalidIds || []).concat(extra.invalidIds || []);
        if (extra.status !== 'ok') Object.assign(nameReport,{status:extra.status,note:extra.note});
        rememberNameFailures(extra);
    }
    enrichSenderNames(state, accountSources, senderNames);

    let added = 0;
    for (const mention of mentions) {
        const externalId = 'yzj:' + createHash('sha256').update(JSON.stringify([mention.accountId || probe.accountId || probe.openId, mention.groupId, mention.msgId])).digest('hex');
        const prior=ensureArray(state.sources).find((row:any)=>row.provider==='yunzhijia'&&(row.externalId===externalId||row.locator?.groupId===mention.groupId&&row.locator?.msgId===mention.msgId&&row.locator.accountId===accountId));
        if(prior){
            prior.selection=normalizeMessageSelection(mention.selection);
            prior.locator={...prior.locator,groupType:mention.groupType??prior.locator?.groupType,intake:mention.intake!==false,direction:mention.direction||'inbound',replyToMsgId:mention.replyToMsgId||null};
            const q=ensureArray(state.analysisQueue).find((q:any)=>q.sourceId===prior.id);
            if(q?.status==='skipped'&&String(q.reviewReason).includes('旧全量消息队列'))Object.assign(q,{status:'pending',reviewReason:null,attempts:0});
            if(!q)state.analysisQueue.push({id:newId('aq'),sourceId:prior.id,msgId:mention.msgId,groupId:mention.groupId,accountId, status:'pending',attempts:0,at});
            continue;
        }
        const createdSource = normalizeSource({
            provider: 'yunzhijia',
            selection:mention.selection,
            projectId: state.settings.defaultProjectId || null,
            externalId: externalId,
            url: null,
            title: (mention.intake === false ? '上下文 · ' : '消息 · ') + (senderNames.get(mention.fromOpenId) || '未知发件人') + (messageConversation(mention.groupName, mention.groupId) === '原会话' ? '' : ' · ' + mention.groupName),
            excerpt: mention.content,
            fetchedAt: mention.sendTime || at,
            sender: (mention.fromOpenId && senderNames.get(mention.fromOpenId)) || null,
            locator: {
                groupId: mention.groupId,
                msgId: mention.msgId,
                groupName: mention.groupName,
                groupType: mention.groupType,
                accountId: mention.accountId || probe.accountId || probe.openId,
                direction: mention.direction || 'inbound',
                intake: mention.intake !== false,
                replyToMsgId: mention.replyToMsgId || null,
                senderId: mention.fromOpenId || null,
                sentAt: mention.sendTime || at,
            },
        });
        state.sources = ensureArray(state.sources).concat([createdSource]);
        added += 1;
        // TODO 14：新来源进入分析队列（AI 识别）；采集游标照常推进，互不阻塞
        if (normalizeMessageSelection(mention.selection) && !ensureArray(state.analysisQueue).some(function (row?: any): any { return row.sourceId === createdSource.id; })) {
            state.analysisQueue = ensureArray(state.analysisQueue).concat([
                {
                    id: newId('aq'),
                    sourceId: createdSource.id,
                    msgId: mention.msgId,
                    groupId: mention.groupId,
                    accountId: mention.accountId || probe.accountId || probe.openId,
                    status: 'pending',
                    attempts: 0,
                    at: hostNowIso(),
                },
            ]);
        }
    }
    const mode = incremental
        ? '增量排空（最近 ' +
            incremental.scannedGroups +
            ' 个群 / ' +
            incremental.scannedMessages +
            ' 条扫描消息，仅入选未读/@本人/@全员/关联事项' +
            (incremental.pageFailures && incremental.pageFailures.length
                ? '；' + incremental.pageFailures.length + ' 个群待补采'
                : '') +
            (incremental.sessionPageErrors && incremental.sessionPageErrors.length
                ? '；会话翻页失败 ' + incremental.sessionPageErrors.length
                : '') +
            '）'
        : '关键词检索（' + keywords.slice(0, 3).join(' / ') + '）';
    const failureNote = incremental
        ? [
            incremental.pageFailures && incremental.pageFailures.length
                ? '失败保留补采位：' + incremental.pageFailures.map(function (row?: any): any { return String(row.group).slice(0, 6) + '…(' + (row.note || row.status) + ')'; }).slice(0, 4).join('、')
                : null,
            incremental.sessionPageErrors && incremental.sessionPageErrors.length
                ? '会话翻页失败：' + incremental.sessionPageErrors[0].note
                : null,
        ]
            .filter(Boolean)
            .join('；')
        : null;
    state.lastMentionsFetch = {
        at: at,
        found: mentions.length,
        added: added,
        user: probe.name,
        mode: incremental ? 'incremental' : 'keyword',
        status: incremental?.deferred || state.__calendarPlan?.report?.status!=='ok' || incremental && failureNote || nameReport.status !== 'ok' || replyReport.failed || replyReport.rateLimited || replyReport.deferred ? 'partial' : 'ok',
        note: mode +
            (start ? '；仅采集安装日期 '+new Date(Date.parse(start)+8*3600000).toISOString().slice(0,10)+'（北京时间）起的消息' : '') +
            (failureNote ? '。' + failureNote : '') + (incremental?.deferred?'；本轮达到采集预算，已保存补采位置':'') +
            '。发件人姓名本轮补全 ' + (nameReport.resolved || 0) + ' 人' + (nameReport.invalidIds?.length ? '，'+nameReport.invalidIds.length+' 个失效账号已跳过' : '') + (nameReport.note ? '；'+nameReport.note : '') +
            (metadataReport.repaired ? '；旧消息信息补全 '+metadataReport.repaired+' 条' : '') + (metadataReport.failed ? '；'+metadataReport.failed+' 条旧消息未精确匹配，稍后重试' : '') +
            '；日历会议 '+(state.__calendarPlan?.report?.found||0)+' 个（'+(state.__calendarPlan?.report?.status||'unknown')+'）'+
            '；实际回复同步 '+replyReport.replied+' 条；已读只更新标记，不关闭待回复' + (replyReport.failed ? '，'+replyReport.failed+' 次回复状态查询失败，后续重试' : '') + (replyReport.rateLimited ? '，回复状态查询限流，冷却后续查' : '') + (replyReport.deferred ? '，剩余会话后续续查' : '') +
            (incremental ? '。' : '。昵称 @ 可能漏采，可在「连接与设置」补充关键词。'),
    };
    auditEntry(state, 'mentions.fetch', '发现 ' + mentions.length + ' 条重点消息，新增来源 ' + added + ' 条（' + (incremental ? '增量' : '关键词') + '）');
    return state;
}
/* ------------------------------------------------------- enterprise search */
/** The 企业（云之家） search group — real results when yzj-cli is usable. */
async function searchEnterpriseGroup(ctx?: any, query?: any): Promise<any> {
    const probe = await probeYunzhijia(ctx);
    if (probe.state !== 'ok') {
        return {
            id: 'enterprise',
            label: '企业（云之家）',
            status: 'unavailable',
            items: [],
            note: probe.note || '云之家 CLI 不可用：' + probe.state,
        };
    }
    const items: any = [];
    const messageResult = await runYzj(ctx, ['im', 'message', 'search', '--keyword', query]);
    if (messageResult.status === 'ok') {
        const groups = messageResult.json && messageResult.json.data && messageResult.json.data.list;
        if (Array.isArray(groups)) {
            for (const group of groups) {
                const groupName = asString(group && group.group && group.group.groupName, 120) || '未知会话';
                const messages = group && Array.isArray(group.messages) ? group.messages : [];
                for (const wrapper of messages.slice(0, 3)) {
                    const message = wrapper && wrapper.message ? wrapper.message : wrapper;
                    if (!message || typeof message !== 'object')
                        continue;
                    items.push({
                        id: 'yzj-msg-' + asString(message.msgId, 60),
                        title: asString(message.content, 120) || '(空消息)',
                        snippet: asString(message.content, 400),
                        url: null,
                        kind: 'source',
                        extra: { provider: 'yunzhijia', at: yzjMessageTime(message.sendTime), group: groupName },
                    });
                }
            }
        }
    }
    const docResult = await runYzj(ctx, ['doc', 'search', '--keyword', query]);
    if (docResult.status === 'ok') {
        const docs = docResult.json && docResult.json.data && docResult.json.data.list;
        if (Array.isArray(docs)) {
            for (const doc of docs.slice(0, 5)) {
                if (!doc || typeof doc !== 'object')
                    continue;
                items.push({
                    id: 'yzj-doc-' + asString(doc.id, 60),
                    title: asString(doc.fileName || doc.title, 200) || '未命名文档',
                    snippet: [asString(doc.kbName, 80), asString(doc.creatorName, 40) + ' 创建']
                        .filter(Boolean)
                        .join(' · '),
                    url: asUrl(doc.openWebUrl),
                    kind: 'knowledge',
                    extra: { provider: 'yunzhijia', at: asIso(doc.updateTime || doc.createTime), group: asString(doc.kbName, 80) },
                });
            }
        }
    }
    const imFailed = messageResult.status !== 'ok';
    const docFailed = docResult.status !== 'ok';
    const status = items.length > 0 ? 'ok' : imFailed && docFailed ? 'error' : 'empty';
    const notes: any = [];
    if (imFailed)
        notes.push('消息一路失败：' + (messageResult.note || messageResult.status));
    if (docFailed)
        notes.push('文档一路失败：' + (docResult.note || docResult.status));
    return {
        id: 'enterprise',
        label: '企业（云之家）',
        status: status,
        items: items.slice(0, SEARCH_GROUP_LIMIT),
        note: notes.length > 0 ? notes.join('；') : '来自云之家消息与知识库；文档链接以 openWebUrl 为准，为空时不构造地址。',
    };
}
/* --------------------------------------------------- §3.3 其余企业 Provider */
/**
 * 联系人：只在「像人名的查询」或明确的找人意图下触发，避免每次搜索都多打
 * 一次企业通讯录（也对隐私更克制）。
 */
async function searchContactsGroup(ctx?: any, query?: any): Promise<any> {
    const looksLikeName = /^[\u4e00-\u9fa5]{2,4}$/.test(query);
    const explicitIntent = /找人|联系|同事|部门|谁是|联系人|通讯录/.test(query);
    if (!looksLikeName && !explicitIntent)
        return null;
    const result = await runYzj(ctx, ['contact', 'user', 'search', '--keyword', query]);
    if (result.status !== 'ok') {
        return {
            id: 'contacts',
            label: '企业联系人',
            status: 'error',
            items: [],
            note: '通讯录查询失败：' + (result.note || result.status),
        };
    }
    const list = (result.json && result.json.data && Array.isArray(result.json.data.list) ? result.json.data.list : []).slice(0, 6);
    const items = list.map(function (user?: any): any {
        if (!user || typeof user !== 'object')
            return null;
        const name = asString(user.name || user.userName, 80);
        if (!name)
            return null;
        return {
            id: 'yzj-user-' + (asString(user.openId, 80) || name),
            title: name,
            snippet: [asString(user.department || user.orgName, 80), asString(user.jobTitle, 60)]
                .filter(Boolean)
                .join(' · '),
            url: null,
            kind: 'contact',
            extra: { openId: asString(user.openId, 80), department: asString(user.department || user.orgName, 80) },
        };
    }).filter(Boolean);
    if (items.length === 0)
        return null;
    return {
        id: 'contacts',
        label: '企业联系人',
        status: 'ok',
        items: items,
        note: '按姓名/关键词匹配企业通讯录，仅返回展示所需字段（姓名、部门、职位）。',
    };
}
/** 会议室：只在会议/场地类查询下触发，按当天可用会议室过滤名称。 */
async function searchRoomsGroup(ctx?: any, query?: any): Promise<any> {
    if (!/会议室|会议|场地|room|预定|有空/.test(query))
        return null;
    const today = new Date();
    const pad = function (value?: any): any {
        return value < 10 ? '0' + value : String(value);
    };
    const day = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
    const result = await runYzj(ctx, ['calendar', 'room', 'find', '--start', day, '--end', day]);
    if (result.status !== 'ok') {
        return {
            id: 'rooms',
            label: '会议室',
            status: 'error',
            items: [],
            note: '会议室查询失败：' + (result.note || result.status),
        };
    }
    const rooms = result.json && result.json.data && Array.isArray(result.json.data.list) ? result.json.data.list : [];
    const needle = String(query)
        .replace(/会议室|会议|场地|room|预定|有空/g, '')
        .trim();
    const matched = rooms.filter(function (room?: any): any {
        if (!room || typeof room.roomName !== 'string')
            return false;
        return needle.length === 0 ? true : room.roomName.indexOf(needle) >= 0;
    }).slice(0, 8);
    const items = matched.map(function (room?: any): any {
        return {
            id: 'yzj-room-' + (asString(room.roomId, 80) || room.roomName),
            title: asString(room.roomName, 120),
            snippet: [asString(room.roomDetail, 80), room.limitCount ? '可容纳 ' + room.limitCount + ' 人' : '']
                .filter(Boolean)
                .join(' · '),
            url: null,
            kind: 'room',
            extra: { roomId: asString(room.roomId, 80), at: null },
        };
    });
    if (items.length === 0)
        return null;
    return {
        id: 'rooms',
        label: '会议室',
        status: 'ok',
        items: items,
        note: '查的是今天可预约的会议室（calendar room find）；会议室预订属于写操作，不在插件内。',
    };
}
/** 考勤：只在考勤意图下触发，只返回本人打卡流水。 */
async function searchAttendanceGroup(ctx?: any, query?: any): Promise<any> {
    if (!/打卡|考勤|出勤|clock|迟到|早退/.test(query))
        return null;
    const result = await runYzj(ctx, ['attendance', 'record', 'list']);
    if (result.status !== 'ok') {
        return {
            id: 'attendance',
            label: '考勤',
            status: 'error',
            items: [],
            note: '考勤查询失败：' + (result.note || result.status),
        };
    }
    const list = (result.json && result.json.data && Array.isArray(result.json.data.list) ? result.json.data.list : []).slice(0, 6);
    const items = list.map(function (record?: any, index?: any): any {
        if (!record || typeof record !== 'object')
            return null;
        const stamp = Number(record.clockInTime || record.clockTime);
        const at = Number.isFinite(stamp) && stamp > 0 ? new Date(stamp).toISOString() : null;
        return {
            id: 'yzj-att-' + index,
            title: (record.clockInType ? record.clockInType + '·' : '') + (record.clockInStatus || '打卡记录'),
            snippet: [asString(record.clockInPosition, 80), at ? new Date(stamp).toLocaleString('zh-CN') : '']
                .filter(Boolean)
                .join(' · '),
            url: null,
            kind: 'attendance',
            extra: { at: at },
        };
    }).filter(Boolean);
    if (items.length === 0)
        return null;
    return {
        id: 'attendance',
        label: '考勤',
        status: 'ok',
        items: items,
        note: '只查询本人当日打卡流水（attendance record list 的能力边界）。',
    };
}
/** 日程与会议（§3.5）：只在日程类意图下触发，查今天到未来 3 天。 */
async function searchEventsGroup(ctx?: any, query?: any): Promise<any> {
    if (!/日程|会议|开会|calendar|安排|纪要/.test(query))
        return null;
    const pad = function (value?: any): any {
        return value < 10 ? '0' + value : String(value);
    };
    const day = function (offset?: any): any {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    };
    const result = await runYzj(ctx, ['calendar', 'event', 'list', '--start', day(0), '--end', day(3)]);
    if (result.status !== 'ok') {
        return { id: 'events', label: '日程与会议', status: 'error', items: [], note: '日程查询失败：' + (result.note || result.status) };
    }
    const list = result.json && result.json.data && Array.isArray(result.json.data.list) ? result.json.data.list : [];
    const needle = String(query).replace(/日程|会议|开会|calendar|安排|纪要/g, '').trim();
    const matched = list.filter(function (event?: any): any {
        if (!event || typeof event !== 'object')
            return false;
        const title = asString(event.title || event.subject, 160);
        if (needle.length === 0)
            return true;
        return title.indexOf(needle) >= 0;
    }).slice(0, 8);
    const items = matched.map(function (event?: any): any {
        const start = event.startTime || event.start || event.beginTime;
        const at = typeof start === 'number' ? new Date(start).toISOString() : asIso(start);
        return {
            id: 'yzj-event-' + (asString(event.id || event.eventId, 80) || String(Math.random()).slice(2, 8)),
            title: asString(event.title || event.subject, 160) || '未命名日程',
            snippet: [
                at ? new Date(at).toLocaleString('zh-CN') : '',
                asString(event.location || event.roomName, 80),
                asString(event.organizer || event.creatorName, 40),
            ]
                .filter(Boolean)
                .join(' · '),
            url: null,
            kind: 'event',
            extra: { at: at },
        };
    });
    if (items.length === 0)
        return null;
    return {
        id: 'events',
        label: '日程与会议',
        status: 'ok',
        items: items,
        note: '查的是今天起 3 天内的日程（calendar event list）；创建/取消日程属于写操作，不在插件内。',
    };
}
let mentionsSyncPromise: any = null;
function captureMessageMetadata(state:any):any {
    return {sources:new Map(ensureArray(state.sources).map((row:any)=>[row.id,{sender:row.sender,title:row.title,locator:{...row.locator}}])),contacts:new Map(ensureArray(state.replies).map((row:any)=>[row.id,row.contact]))};
}
function mergeMessageMetadata(current:any,fetched:any,before:any):void {
    const sources=new Map<string,any>(ensureArray(fetched.sources).map((row:any)=>[row.id,row]));
    const replies=new Map<string,any>(ensureArray(fetched.replies).map((row:any)=>[row.id,row]));
    for(const source of ensureArray(current.sources)){
        const old=before.sources.get(source.id),next=sources.get(source.id);
        if(!old || !next)continue;
        if(source.sender===old.sender)source.sender=next.sender;
        if(source.title===old.title)source.title=next.title;
        if(source.locator && next.locator)for(const key of ['sentAt','senderId','accountId','groupName'])if((source.locator[key] ?? null)===(old.locator[key] ?? null) && next.locator[key]!=null)source.locator[key]=next.locator[key];
    }
    for(const reply of ensureArray(current.replies))if(before.contacts.has(reply.id) && replies.has(reply.id) && reply.contact===before.contacts.get(reply.id))reply.contact=replies.get(reply.id).contact;
}
let metadataRepairPromise:Promise<any>|null=null;
/** One startup pass repairs old linked metadata without collecting or analyzing messages. */
export function repairYunzhijiaMetadata(ctx:any):Promise<any> {
    if(metadataRepairPromise)return metadataRepairPromise;
    const state=loadWorkbenchState();
    if(!linkedMessageSources(state).some(source=>!source.locator?.sentAt || !source.locator?.senderId || !source.locator?.accountId))return Promise.resolve(state);
    metadataRepairPromise=(async()=>{
        const assertCurrent=workbenchGenerationGuard();
        const baseline=JSON.parse(JSON.stringify(loadWorkbenchState())),before=captureMessageMetadata(baseline);
        const probe=await probeYunzhijia(ctx);
        if(probe.state!=='ok')return loadWorkbenchState();
        const report=await repairLinkedMessageMetadata(ctx,baseline,probe,runYzj),accountId=probe.accountId || probe.openId;
        const accountSources=ensureArray(baseline.sources).filter((source:any)=>source.provider==='yunzhijia' && [accountId,probe.openId].includes(source.locator?.accountId));
        const names=new Map<string,string>();
        for(const source of accountSources)if(source.locator?.senderId && !['未知发件人','机器人'].includes(messageSender(source)))names.set(source.locator.senderId,source.sender);
        const missing=[...new Set(linkedMessageSources(baseline).filter(source=>[accountId,probe.openId].includes(source.locator?.accountId)).map(source=>source.locator?.senderId).filter(id=>id && !String(id).startsWith('BOT-') && !names.has(id)))].slice(0,50);
        for(const [id,name] of await resolveSenderNames(ctx,missing))names.set(id,name);
        enrichSenderNames(baseline,accountSources,names);
        return mutateWorkbenchState((current:any)=>{
            assertCurrent();
            mergeMessageMetadata(current,baseline,before);
            for(const [key,value] of Object.entries(baseline.syncCursors || {}))if(key.startsWith('__messageMetadata:'))current.syncCursors[key]=value;
            if(report.rateLimited)current.syncCursors['__pending:'+accountId]={...current.syncCursors['__pending:'+accountId],accountId,retryAt:baseline.syncCursors['__pending:'+accountId]?.retryAt};
            auditEntry(current,'messages.metadata','补全旧消息信息 '+report.repaired+' 条');
            return current;
        });
    })().finally(()=>{metadataRepairPromise=null});
    return metadataRepairPromise;
}
function syncYunzhijiaMessages(ctx?: any): any {
    if (mentionsSyncPromise)
        return mentionsSyncPromise;
    mentionsSyncPromise = (async function (): Promise<any> {
        const baseline = JSON.parse(JSON.stringify(loadWorkbenchState()));
        const before=captureMessageMetadata(baseline);
        const replyStates=new Map<string,string>(ensureArray(baseline.replies).map((reply:any)=>[reply.id,replyStatusSnapshot(reply)]));
        const replyCursors=new Map<string,string>(Object.entries(baseline.syncCursors || {}).filter(([key])=>key.startsWith('__replyStatus:')).map(([key,value])=>[key,JSON.stringify(value)]));
        const assertCurrent=workbenchGenerationGuard();
        const oldSources = new Set(ensureArray(baseline.sources).map(function (row?: any): any { return row.id; }));
        const fetched = await fetchYunzhijiaMentionsInto(ctx, baseline);
        return mutateWorkbenchState(function (current?: any): any {
            assertCurrent();
            const known = new Set(ensureArray(current.sources).map(function (row?: any): any { return row.externalId; }));
            const fresh = ensureArray(fetched.sources).filter(function (row?: any): any { return !oldSources.has(row.id) && !known.has(row.externalId); });
                        current.sources = ensureArray(current.sources).concat(fresh);
            // Merge only enrichment fields. Never replace edits made while CLI calls ran.
            mergeMessageMetadata(current,fetched,before);
            const fetchedSources=new Map(ensureArray(fetched.sources).map((s:any)=>[s.id,s]));
            for(const source of current.sources){const selected:any=fetchedSources.get(source.id);if(selected?.selection){source.selection=normalizeMessageSelection(selected.selection);source.locator={...source.locator,groupType:selected.locator?.groupType??source.locator?.groupType,intake:selected.locator?.intake,direction:selected.locator?.direction,replyToMsgId:selected.locator?.replyToMsgId||null};}}
            current.messageInbox=fetched.messageInbox;
            applyCalendarPlan(current,fetched.__calendarPlan);
            mergeReconciledReplies(current,fetched,replyStates);
            for(const q of current.analysisQueue||[]){const fq=(fetched.analysisQueue||[]).find((x:any)=>x.id===q.id);if(q.status==='skipped'&&String(q.reviewReason).includes('旧全量消息队列')&&fq?.status==='pending')Object.assign(q,{status:'pending',reviewReason:null,attempts:0});}
            current.analysisQueue = ensureArray(current.analysisQueue).concat(ensureArray(fetched.analysisQueue).filter((row:any)=>!current.analysisQueue.some((q:any)=>q.sourceId===row.sourceId)&&current.sources.some((s:any)=>s.id===row.sourceId&&normalizeMessageSelection(s.selection))));
            for(const [key,value] of replyCursors)if(!(key in fetched.syncCursors) && JSON.stringify(current.syncCursors?.[key])===value)delete current.syncCursors[key];
            skipHistoricalMessages(current);
            if(current.messageInbox?.accountId)seedUnreadPrivateReplies(current,current.messageInbox.accountId);
            current.syncCursors = Object.assign({}, current.syncCursors, fetched.syncCursors);
            current.lastMentionsFetch = fetched.lastMentionsFetch;
            auditEntry(current, 'messages.sync', '采集来源 ' + fresh.length + ' 条');
            return current;
        });
    })().finally(function (): any { mentionsSyncPromise = null; });
    return mentionsSyncPromise;
}

export { YZJ_TIMEOUT_MS, YZJ_MAX_BYTES, MENTIONS_FETCH_LIMIT, YZJ_READ_ONLY, yzjPathCache, yzjCommandAllowed, resolveYzjPath, invalidateYzjPathCache, runYzj, sendYzjTextReply, probeYunzhijia, yzjMentionTargetsMe, resolveSenderNames, yzjParseMentionSearch, fetchMentionsIncremental, fetchYunzhijiaMentionsInto, searchEnterpriseGroup, searchContactsGroup, searchRoomsGroup, searchAttendanceGroup, searchEventsGroup, mentionsSyncPromise, syncYunzhijiaMessages }
