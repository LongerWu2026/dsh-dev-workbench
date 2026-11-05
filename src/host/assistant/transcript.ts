import {isWorkbenchContextEvent} from '../../shared/assistant-context.js'
import { asString } from '../platform/runtime.js'
import {nativeAssistantAttachments} from '../../shared/assistant-attachments.js'
import {assistantOutputText} from './final-output.js'
function stripAssistantBoilerplate(text?: any): any {
    const lines = String(text || '').split('\n');
    const kept: any = [];
    let inContext = false;
    let inKnowledge = false;
    for (const line of lines) {
        if(line.indexOf('【本轮知识设置】')===0||line.indexOf('（普通对话：')===0)continue;
        if(line.indexOf('【本轮知识检索')===0){inKnowledge=true;continue}
        if(inKnowledge){if(line.trim()==='【知识片段结束】')inKnowledge=false;continue}
        if (line.indexOf('【工作台上下文') === 0) {
            inContext = true;
            continue;
        }
        if (inContext) {
            if (line.trim() === '') {
                inContext = false;
            }
            continue;
        }
        if (line.indexOf('（需要落库时') === 0)
            continue;
        kept.push(line);
    }
    const cleaned = kept.join('\n').replace(/^\n+|\n+$/g, '').trim();
    return cleaned;
}
/** Native snapshots identify clean user payloads; legacy combined prompts still
 * use the old cleanup only when no separately logged snapshot is present. */
function nativeContextRequests(events:any[]):Set<string>{return new Set(events.filter(isWorkbenchContextEvent).map(event=>event.data.source.requestId))}
function displayedUser(event:any,requests:Set<string>){
 const raw=(Array.isArray(event.data?.content)?event.data.content:[]).filter((part:any)=>part.type==='text').map((part:any)=>part.text).join('\n')
 const clean=event.data?.source?.kind==='user'&&requests.has(event.data.source.rpcId)
 const text=clean?raw:stripAssistantBoilerplate(raw)
 return {text,visible:!!text&&(clean||!isSystemInjectedText(text))}
}
function isSystemInjectedText(text?: any): any {
    const source = String(text || '');
    if (source.indexOf('<system-reminder>') >= 0)
        return true;
    if (source.indexOf('</system-reminder>') >= 0)
        return true;
    if (/Time sampled while preparing turn/i.test(source))
        return true;
    if (/Browser time zone for this request/i.test(source))
        return true;
    if (/Elapsed since the preceding/i.test(source))
        return true;
    if (/model-visible message/i.test(source))
        return true;
    if (/^\[system\]/i.test(source.trim()))
        return true;
    if (/^Current runtime context\.\s*This snapshot supersedes earlier runtime-context snapshots\./i.test(source.trim()))
        return true;
    return false;
}
/** 从 assistant/message 事件里抽出纯文本（content 是 ContentBlock[]）。 */
function assistantTextOf(message?: any): any {
    return assistantOutputText(message);
}
/** 本会话里最近 N 轮问答，供侧栏恢复历史。 */
function assistantHistoryFrom(session?: any, limit?: any): any {
    if (!session || typeof session.snapshotEvents !== 'function')
        return [];
    const events = session.snapshotEvents();
    const contextRequests=nativeContextRequests(events);
    const out: any = [];
    for (const event of events) {
        if (isWorkbenchContextEvent(event)) continue;
        if (event.type === 'user/message') {
            const content = Array.isArray(event.data.content) ? event.data.content : [];
            const displayed=displayedUser(event,contextRequests),historyText=displayed.text,attachments=nativeAssistantAttachments(content);
            if (displayed.visible||attachments.length)
                out.push({ role: 'user', text: historyText, at: event.time,...(attachments.length?{attachments}:{}) });
        }
        else if (event.type === 'assistant/message') {
            const text = assistantTextOf(event.data.message);
            if (text)
                out.push({ role: 'assistant', text: text, at: event.time });
        }
    }
    return out.slice(-(limit || 20));
}
/** 会话的展示标题：优先取首条用户消息，其次给短 id。 */
function sessionTitleOf(session?: any): any {
    try {
        const events = session.snapshotEvents();
        const contextRequests=nativeContextRequests(events);
        for (const event of events) {
            if (isWorkbenchContextEvent(event) || event.type !== 'user/message')
                continue;
            const content = Array.isArray(event.data.content) ? event.data.content : [];
            const displayed=displayedUser(event,contextRequests);
            const titleText=displayed.text.replace(/\s+/g,' ').trim();
            if (titleText && displayed.visible)
                return titleText.slice(0, 40);
            const attachments=nativeAssistantAttachments(content);if(attachments.length)return attachments[0].name.slice(0,40);
        }
    }
    catch (e) {
        /* 读不到就给短 id */
    }
    return '会话 ' + String(session.id).slice(-6);
}
function sessionLastAt(session?: any): any {
    try {
        const events = session.snapshotEvents();
        const last = events[events.length - 1];
        return last && last.time ? last.time : session.header && session.header.createdAt ? session.header.createdAt : null;
    }
    catch (e) {
        return null;
    }
}
/** 把会话事件转成侧栏可渲染的记录条目。 */
function transcriptOf(session?: any, limit?: any): any {
    if (!session || typeof session.snapshotEvents !== 'function')
        return [];
    const events = session.snapshotEvents();
    const contextRequests=nativeContextRequests(events);
    const entries: any = [];
    let pendingCalls: any = [];
    for (const event of events) {
        if (isWorkbenchContextEvent(event)) continue;
        if (event.type === 'user/message') {
            const content = Array.isArray(event.data.content) ? event.data.content : [];
            const displayed=displayedUser(event,contextRequests),transcriptText=displayed.text,attachments=nativeAssistantAttachments(content);
            if (displayed.visible||attachments.length)
                entries.push({ role: 'user', text: transcriptText, at: event.time,...(attachments.length?{attachments}:{}) });
        }
        else if (event.type === 'tool/call') {
            const name = event.data && event.data.name ? String(event.data.name) : 'tool';
            const args = event.data && event.data.arguments ? event.data.arguments : null;
            let summary = '';
            try {
                summary = args ? JSON.stringify(args).slice(0, 160) : '';
            }
            catch (e) {
                summary = '';
            }
            pendingCalls.push({ name: name, summary: summary });
        }
        else if (event.type === 'assistant/message') {
            const text = assistantTextOf(event.data.message);
            if (text || pendingCalls.length > 0) {
                entries.push({ role: 'assistant', text: text, at: event.time, toolCalls: pendingCalls.slice(0, 8) });
            }
            pendingCalls = [];
        }
    }
    return entries.slice(-(limit || 40));
}
/** Read known error fields only; host versions wrap provider errors differently. */
function modelErrorText(value:any,depth=0):string {
    if(typeof value==='string')return value;
    if(!value||typeof value!=='object'||depth>=8)return '';
    return modelErrorText(value.error,depth+1)||modelErrorText(value.cause,depth+1)||modelErrorText(value.message,depth+1);
}
function transcriptDelta(session?: any, fromSeq?: any, options:{includeTools?:boolean}={}): any {
    const start = Number(fromSeq);
    const events = session.snapshotEvents(Number.isFinite(start) && start >= 0 ? start : 0);
    const contextRequests=nativeContextRequests(session.snapshotEvents());
    const entries: any = [];
    let turnActive = false;
    let turnEnded = false;
    for (const event of events) {
        if (event.type === 'turn/start') {
            turnActive = true;
            continue;
        }
        if (event.type === 'turn/end') {
            turnActive = false;
            turnEnded = true;
            const reason = event.data && event.data.reason;
            if (reason && reason.kind === 'error') entries.push({role:'error',text:modelErrorText(reason.error) || '模型轮次失败',at:event.time,seq:event.seq});
            continue;
        }
        if (isWorkbenchContextEvent(event)) continue;
        if (event.type === 'user/message') {
            const content = Array.isArray(event.data.content) ? event.data.content : [];
            const displayed=displayedUser(event,contextRequests),entryText=displayed.text,attachments=nativeAssistantAttachments(content);
            if (displayed.visible||attachments.length)
                entries.push({ role: 'user', text: entryText, at: event.time, seq: event.seq,...(attachments.length?{attachments}:{}) });
        }
        else if (event.type === 'assistant/message') {
            const text = assistantTextOf(event.data.message);
            if (text)
                entries.push({ role: 'assistant', text: text, at: event.time, seq: event.seq });
        }
        else if (event.type === 'tool/call' && options.includeTools!==false) {
            const name = event.data && event.data.name ? String(event.data.name) : 'tool';
            let summary = '';
            try {
                summary = event.data && event.data.arguments ? JSON.stringify(event.data.arguments).slice(0, 200) : '';
            }
            catch (e) {
                summary = '';
            }
            entries.push({ role: 'tool', text: name, summary: summary, at: event.time, seq: event.seq });
        }
        else if (event.type === 'tool/result' && options.includeTools!==false) {
            const name = event.data && event.data.name ? String(event.data.name) : 'tool';
            const ok = !(event.data && (event.data.isError === true || event.data.error));
            entries.push({ role: 'toolResult', text: name, ok: ok, at: event.time, seq: event.seq });
        }
        else if (event.type === 'turn/error') {
            const note = modelErrorText(event.data) || '本轮执行出错';
            entries.push({ role: 'error', text: note, at: event.time, seq: event.seq });
        }
    }
    return { entries: entries, nextSeq: session.seq, turnActive: turnActive, turnEnded };
}
/**
 * 把内部错误翻译成用户能看懂的一句话；技术细节只放进 detail（不主动展示）。
 * 代码级异常（例如「返回值里没有 session」）绝不能原样抛给界面。
 */

export { stripAssistantBoilerplate, isSystemInjectedText, assistantTextOf, assistantHistoryFrom, sessionTitleOf, sessionLastAt, transcriptOf, transcriptDelta }
