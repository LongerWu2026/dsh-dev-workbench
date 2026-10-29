import * as React from 'react';
import { WB, Btn, Modal, acceptSnapshot } from '../../core/runtime.js';
import { messageOrigin, messageSender, messageSentTime } from '../../../shared/message-display.js';
import {taskReplyMatches} from '../../../shared/task-reply.js';
export function ReplyDraft({ reply, data, actions,taskId,initialOpen=false }: {
    reply: any;
    data: any;
    actions?: React.ReactNode;
    taskId?:string;
    initialOpen?:boolean;
}) {
    const [text, setText] = React.useState(data.replyDrafts?.[reply.id]?.text || ''), [busy, setBusy] = React.useState(false), [error, setError] = React.useState(''), [open, setOpen] = React.useState(initialOpen);
    const [preview, setPreview] = React.useState<any>(null), [blocked, setBlocked] = React.useState(false);
    const sending = React.useRef(false);
    const source = (data.sources || []).find((row:any) => row.id === reply.sourceId), loc = source?.locator;
    const conversation=data.messageInbox?.accountId===loc?.accountId?data.messageInbox?.conversations?.find((c:any)=>c.groupId===loc?.groupId):null;
    const privateChat=Number(loc?.groupType||conversation?.groupType||data.syncCursors?.[loc?.accountId+':'+loc?.groupId]?.groupType)===1;
    const delivery = data.replyDrafts?.[reply.id]?.delivery;
    const taskAllowed=!!taskId&&taskReplyMatches(data,taskId,reply);
    const canSend = source?.provider === 'yunzhijia' && loc?.groupId && loc.msgId && loc.accountId && loc.direction !== 'outbound' && (!taskId||taskAllowed) && (['待回复', '已确认收到'].includes(reply.stage)||taskAllowed&&reply.triage==='task'&&reply.stage==='不需回复');
    const deliveryBlocked = blocked || ['sending', 'uncertain', 'sent'].includes(delivery?.status);
    function review() {
        setError('');
        setPreview({ request: { id: reply.id, text, groupId: loc.groupId, msgId: loc.msgId, accountId: loc.accountId, confirmed: true,...(taskId?{taskId}:{}) }, sender: messageSender(source, reply.contact), conversation: messageOrigin(source, reply), excerpt: source.excerpt, sentTime: messageSentTime(source) });
    }
    async function send() {
        if (sending.current || !preview) return;
        sending.current = true; setBusy(true); setError('');
        try {
            const snapshot = await WB.rpc('workbench/sendReply', { request: preview.request });
            setBlocked(true); setPreview(null); acceptSnapshot(snapshot);
            WB.toast(taskId?'回复已发送，待办状态保持不变':'回复已发送，已标记为已回复', 'ok');
        } catch (e) {
            const message = String((e as Error).message);
            setError(message); setPreview(null);
            if (/未确认|已有发送记录/.test(message)) setBlocked(true);
            void WB.actions.reload().catch(() => {});
        } finally { sending.current = false; setBusy(false); }
    }
    async function generate() { setBusy(true); setError(''); setOpen(true); try {
        const r = await WB.rpc('workbench/generateReplyDraft', { id: reply.id });
        setText(r.text);
        // The draft is already persisted. A slow snapshot must not lock editing.
        void WB.actions.reload().catch((e: Error) => setError(e.message));
    }
    catch (e) {
        setError(String((e as Error).message));
    }
    finally {
        setBusy(false);
    } }
    return <div className="wb-reply-draft">
        {taskId&&<p className="wb-tiny wb-muted">回复原会话：{messageOrigin(source,reply)} · {messageSender(source,reply.contact)}。回复与待办完成状态分别维护。</p>}
        {delivery?.status==='sent'&&<p className="wb-tiny">已发送：{delivery.text||data.replyDrafts?.[reply.id]?.text} {delivery.at&&<time dateTime={delivery.at}>（{messageSentTime({locator:{sentAt:delivery.at}})}）</time>}</p>}
        <div className="wb-reply-draft-toolbar"><div className="wb-row wb-row--wrap"><Btn size="sm" kind="primary" disabled={busy} onClick={() => setOpen(!open)}>{open ? '收起回复' : '回复'}</Btn><Btn size="sm" disabled={busy} onClick={generate}>生成回复草稿</Btn></div>{actions}</div>
        {open && <div className="wb-reply-editor">
            {error && <p role="alert">{error}</p>}
            <textarea className="wb-input" aria-label="回复草稿" placeholder="输入要回复的内容" disabled={busy || !!preview} value={text} maxLength={8000} rows={4} onChange={e => setText(e.target.value)}/>
            <div className="wb-row wb-row--wrap">
                <Btn size="sm" kind="primary" disabled={busy || !text.trim() || !canSend || deliveryBlocked} onClick={review}>发送回复</Btn>
                <Btn size="sm" disabled={busy} onClick={() => WB.rpc('workbench/saveReplyDraft', { id: reply.id, text }).then(() => WB.toast('草稿已保存', 'ok')).catch((e: Error) => setError(e.message))}>保存草稿</Btn>
                <Btn size="sm" disabled={busy || !text} onClick={() => navigator.clipboard.writeText(text).then(() => WB.toast('已复制，请在云之家检查收件人后发送', 'ok')).catch((e: Error) => setError(e.message))}>复制草稿</Btn>
                <Btn size="sm" disabled={busy} onClick={() => WB.actions.setReplyStage(reply.id, '已回复').catch((e: Error) => setError(e.message))}>我已在云之家回复</Btn>
            </div>
            {!canSend && <p className="wb-tiny wb-muted">{taskId?'原消息已回复或关联已变化，请先核实记录；待办内容和状态不受影响。':'仅未处理且具有原消息定位的云之家消息支持直接回复，其他消息可复制后发送。'}</p>}
            {deliveryBlocked && <p className="wb-tiny wb-muted">已有发送记录，请到云之家核实结果，避免重复发送。</p>}
            <p className="wb-tiny wb-muted">{privateChat?'私聊将直接发送正文，不自动@对方或引用原消息。':'群聊将以纯文本引用原消息，发送到原会话。'}生成、保存或复制草稿不会发送。</p>
        </div>}
        <Modal open={!!preview} title="确认发送回复" onClose={() => { if (!sending.current) setPreview(null); }} footer={<div className="wb-row"><Btn disabled={busy} onClick={() => setPreview(null)}>取消</Btn><Btn kind="primary" disabled={busy} onClick={send}>{busy ? '发送中…' : '确认发送'}</Btn></div>}>
            {preview && <div style={{overflowWrap:'anywhere'}}><p>会话：{preview.conversation}</p><p>发件人：{preview.sender}</p><p className="wb-tiny wb-muted">原消息发出时间：{preview.sentTime}</p><p className="wb-tiny wb-muted">原消息：{preview.excerpt}</p><p style={{whiteSpace:'pre-wrap'}}>{preview.request.text}</p><details><summary>查看发送定位</summary><p>会话 ID：{preview.request.groupId}<br/>原消息 ID：{preview.request.msgId}<br/>账号：{preview.request.accountId}</p></details></div>}
        </Modal>
    </div>;
}
