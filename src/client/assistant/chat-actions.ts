import { Icon, WB, h } from '../core/runtime.js'
import * as React from 'react'
/* ============================================================================
 * dev-workbench client — 把工作台嵌进 DSH 原生聊天
 *
 * 方向与「工作台助手侧栏」相反：不改原生会话的渲染，只在两个官方插槽上挂东西。
 *
 *   1. conversation.chat.assistant-actions（list，replaceRisk: none）
 *      每条定稿的助手回复下面加一排动作：生成待办 / 存为知识 / 记执行记录。
 *      ownerProps 只给 { messageId }，消息正文通过 workbench/assistantMessage 取。
 *
 *   2. tool.call.toolview（keyed by 工具名，replaceRisk: shadows-shipped-ui）
 *      只接管我们自己的 workbench_* 工具，把它们渲染成工作台卡片。
 *      未占用的 key 走通用行，所以我们注册自己的名字不会影响其它工具。
 *
 * 两个插槽都在 session scope，standardProps 带 useChat/useConversation/useSession
 * 等原生会话 hook；这里只用 messageId + 我们的 RPC，避免依赖未公开的 hook 形状。
 * ========================================================================== */
const CHAT_EMBED_ACTIONS: any = [
    {
        id: 'workbench-task',
        label: '生成待办',
        icon: 'plus',
        run: function (text?: any, meta?: any): any {
            return WB.actions.createTask({
                title: chatEmbedTitle(text),
                description: text.slice(0, 2000),
                priority: 'normal',
                tags: ['来自会话'],
            }).then(function (): any {
                WB.toast('已生成待办（可在工作台查看）', 'ok');
            });
        },
    },
    {
        id: 'workbench-knowledge',
        label: '存为知识',
        icon: 'book',
        run: function (text?: any): any {
            return WB.actions.createKnowledge({
                title: chatEmbedTitle(text),
                body: text.slice(0, 4000),
                tags: ['来自会话'],
                url: null,
            }).then(function (): any {
                WB.toast('已存入知识库', 'ok');
            });
        },
    },
    {
        id: 'workbench-run',
        label: '记执行记录',
        icon: 'agent',
        run: function (text?: any): any {
            return WB.actions.recordRun({
                status: 'completed',
                summary: text.slice(0, 300),
                steps: [{ text: '来源：原生会话中的助手回复' }],
            }).then(function (): any {
                WB.toast('已登记执行记录', 'ok');
            });
        },
    },
];
/** 取第一行/第一句当标题，去掉 Markdown 记号，控制长度。 */
function chatEmbedTitle(text?: any): any {
    const line = String(text || '')
        .replace(/^#+\s*/gm, '')
        .replace(/[*_`>]/g, '')
        .split('\n')
        .map(function (part?: any): any {
        return part.trim();
    })
        .filter(Boolean)[0];
    const title = (line || '会话记录').slice(0, 60);
    return title || '会话记录';
}
/**
 * 原生聊天里每条助手回复下方的动作排。
 * 只在消息正文可用时启用，失败就静默降级（不打断原生聊天）。
 */
const WB_CHAT_ACTIONS_CSS = `
.wb-chat-actions { position:relative; display:inline-flex; align-items:center; gap:6px; font:inherit; color:var(--dsw-alias-label-secondary,#6b7280); }
.wb-chat-actions *, .wb-chat-actions *::before, .wb-chat-actions *::after { box-sizing:border-box; }
.wb-chat-actions.is-open { z-index:71; }
.wb-chat-actions__trigger { appearance:none; display:inline-flex; align-items:center; justify-content:center; gap:3px; min-width:32px; height:26px; padding:4px; border:1px solid transparent; border-radius:6px; background:transparent; color:inherit; font:inherit; cursor:pointer; }
.wb-chat-actions__trigger:hover:not(:disabled), .wb-chat-actions__trigger[aria-expanded="true"] { color:var(--dsw-alias-label-primary,#20242b); background:color-mix(in srgb,var(--dsw-alias-label-primary,#20242b) 6%,transparent); }
.wb-chat-actions__chevron { display:flex; transform:rotate(180deg); }
.wb-chat-actions.is-open .wb-chat-actions__chevron { transform:none; }
.wb-chat-actions__menu { position:absolute; bottom:calc(100% + 8px); left:0; z-index:1; display:flex; flex-direction:column; gap:2px; width:176px; max-width:calc(100vw - 24px); max-height:220px; overflow-y:auto; padding:6px; border:1px solid var(--dsw-alias-border-l1,#e4e7ed); border-radius:10px; background:var(--dsw-alias-bg-layer-1,#fff); color:var(--dsw-alias-label-primary,#20242b); box-shadow:0 6px 24px rgba(0,0,0,.14); }
.wb-chat-actions__item { appearance:none; display:flex; align-items:center; gap:10px; flex:none; width:100%; min-height:36px; padding:8px 10px; border:0; border-radius:6px; background:transparent; color:inherit; font:inherit; font-size:13px; line-height:20px; text-align:left; white-space:nowrap; cursor:pointer; }
.wb-chat-actions__item svg { color:var(--dsw-alias-label-secondary,#6b7280); }
.wb-chat-actions__item:hover:not(:disabled), .wb-chat-actions__item:focus-visible { background:color-mix(in srgb,var(--dsw-alias-label-primary,#20242b) 6%,transparent); }
.wb-chat-actions__trigger:focus-visible, .wb-chat-actions__item:focus-visible { outline:2px solid var(--dsw-alias-brand-primary,#687386); outline-offset:2px; }
.wb-chat-actions button:disabled { opacity:.45; cursor:default; }
.wb-chat-actions__status { font-size:12px; color:var(--dsw-alias-label-secondary,#6b7280); }
.wb-chat-actions__error { font-size:12px; color:var(--dsw-alias-state-error-primary,#d14343); }
@media (prefers-color-scheme:dark) {
 .wb-chat-actions__menu { background:var(--dsw-alias-bg-layer-1,#242528); color:var(--dsw-alias-label-primary,#f0f0f2); border-color:var(--dsw-alias-border-l1,#414247); }
 .wb-chat-actions__trigger:hover:not(:disabled), .wb-chat-actions__trigger[aria-expanded="true"], .wb-chat-actions__item:hover:not(:disabled), .wb-chat-actions__item:focus-visible { background:color-mix(in srgb,var(--dsw-alias-label-primary,#f0f0f2) 6%,transparent); color:var(--dsw-alias-label-primary,#f0f0f2); }
}
`;
function ChatAssistantActions(props?: any): any {
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<any>(null);
    const [open, setOpen] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const returnFocusRef = React.useRef(false);
    const messageId = props && props.messageId ? String(props.messageId) : '';
    const sessionId = props && props.sessionId ? String(props.sessionId) : null;
    function closeMenu(): void { returnFocusRef.current=true; setOpen(false); triggerRef.current?.focus(); }
    React.useEffect(() => {
        // The trigger cannot take focus until React has removed disabled after a request.
        if (!open && !busy && returnFocusRef.current) { returnFocusRef.current=false; triggerRef.current?.focus(); }
    }, [open,busy]);
    React.useEffect(() => {
        if (!open) return;
        menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
        const outside = (event: Event) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); closeMenu(); } };
        document.addEventListener?.('pointerdown', outside);
        document.addEventListener?.('keydown', escape);
        return () => { document.removeEventListener?.('pointerdown', outside); document.removeEventListener?.('keydown', escape); };
    }, [open]);
    if (!messageId) return null;
    function trigger(action?: any): void {
        if (busy) return;
        setBusy(true);
        setError(null);
        WB.actions.assistantMessage(sessionId, messageId)
            .then((result: any) => {
                if (!result || result.status !== 'ok' || !result.text) throw new Error((result && (result.detail || result.note)) || '没有取到该条回复的内容');
                return action.run(result.text, result);
            })
            .then(() => {
                setBusy(false);
                if (document.activeElement === document.body || rootRef.current?.contains(document.activeElement)) closeMenu();
                else setOpen(false); // Preserve focus when the user has moved on to another control.
            })
            .catch((failure: any) => { setError({text:'操作没成功，请重试',detail:String(failure?.message || failure)}); setBusy(false); });
    }
    function onMenuKey(event: React.KeyboardEvent): void {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); closeMenu(); return; }
        if (event.key === 'Tab' && open) { closeMenu(); return; }
        if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
        if (!open) { if (!busy && event.key.startsWith('Arrow')) { event.preventDefault(); setOpen(true); } return; }
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        if (!items.length) return;
        event.preventDefault(); event.stopPropagation();
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length-1 : current < 0 ? (event.key === 'ArrowUp' ? items.length-1 : 0) : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next].focus();
    }
    return h('div', {ref:rootRef,className:'wb-chat-actions' + (open ? ' is-open' : ''),onKeyDown:onMenuKey},
        open ? h('div', {ref:menuRef,className:'wb-chat-actions__menu',role:'menu','aria-label':'工作台操作'}, CHAT_EMBED_ACTIONS.map((action: any) => h('button', {
            key:action.id,type:'button',role:'menuitem',className:'wb-chat-actions__item',disabled:busy,onClick:()=>trigger(action),
        }, h(Icon, {name:action.icon || 'plus',size:15}),h('span',null,action.label)))) : null,
        h('button', {ref:triggerRef,type:'button',className:'wb-chat-actions__trigger',disabled:busy,title:'工作台操作（生成待办 / 存为知识 / 记执行记录）','aria-label':'工作台操作','aria-haspopup':'menu','aria-expanded':open ? 'true' : 'false',onClick:()=>setOpen(!open)}, h(Icon,{name:'sparkles',size:14}),h('span',{className:'wb-chat-actions__chevron'},h(Icon,{name:'chevronDown',size:10}))),
        busy ? h('span',{className:'wb-chat-actions__status',role:'status'},'处理中…') : null,
        error ? h('span',{className:'wb-chat-actions__error',role:'alert',title:error.detail},error.text) : null);
}
/** 从工具调用的分阶段 block 里尽力取出参数/结果摘要。 */
function chatEmbedBlockSummary(block?: any): any {
    if (!block || typeof block !== 'object')
        return '';
    const candidates: any = [block.args, block.arguments, block.input, block.result, block.output, block.content, block.text];
    for (const value of candidates) {
        if (value === undefined || value === null)
            continue;
        if (typeof value === 'string')
            return value.slice(0, 200);
        try {
            return JSON.stringify(value).slice(0, 200);
        }
        catch (e) {
            /* 继续找下一个候选 */
        }
    }
    return '';
}
/** workbench_* 工具调用的卡片（原生聊天里替代通用行）。 */
function WorkbenchToolView(props?: any): any {
    const toolName = String((props && props.toolName) || 'workbench');
    const phase = props && props.phase ? String(props.phase) : 'start';
    const summary = chatEmbedBlockSummary(props && props.block);
    const failed = !!(props && props.block && (props.block.isError === true || props.block.error));
    return h('div', {
        style: {
            border: '1px solid currentColor',
            borderRadius: 8,
            padding: '6px 9px',
            fontSize: 11.5,
            lineHeight: 1.6,
            opacity: 0.92,
            maxWidth: 620,
        },
    }, h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } }, h('span', { style: { fontWeight: 600 } }, '工作台'), h('span', { style: { opacity: 0.75 } }, toolName.replace(/^workbench_/, '')), h('span', { style: { marginLeft: 'auto', opacity: 0.6 } }, failed ? '失败' : phase === 'result' ? '完成' : phase === 'start' ? '执行中' : '准备中')), summary ? h('div', { style: { marginTop: 3, opacity: 0.8, overflowWrap: 'anywhere' } }, summary) : null);
}
/** 注册两个原生聊天插槽；宿主没提供插槽时静默跳过。 */
WB.registerChatEmbed = function (ctx?: any): any {
    if (!ctx || !ctx.slots || typeof ctx.slots.inject !== 'function')
        return function (): any { };
    const disposers: any = [];
    // Native chat lives outside .wb-root and must not depend on opening the panel.
    // Each registration owns its own node so an old hot-reload cleanup cannot remove the new stylesheet.
    if (document.head?.appendChild) {
        const style = document.createElement('style');
        style.dataset.workbenchChatActions = '';
        style.textContent = WB_CHAT_ACTIONS_CSS;
        document.head.appendChild(style);
        disposers.push(() => style.remove());
    }
    try {
        disposers.push(
        // 只注册**一个**单元格：三个动作收在同一个图标下拉里。
        // 之前按动作注册了三个单元格，于是同一排出现三个图标按钮。
        ctx.slots.inject('conversation.chat.assistant-actions', function (): any {
            return ctx.slots.register({
                name: 'conversation.chat.assistant-actions',
                id: 'workbench-actions',
                order: 30,
                label: '工作台',
            }, ChatAssistantActions);
        }));
    }
    catch (e) {
        /* 插槽不存在或版本不同：不影响工作台本体 */
    }
    try {
        disposers.push(ctx.slots.inject('tool.call.toolview', function (): any {
            return WB.WORKBENCH_TOOL_NAMES.map(function (name?: any): any {
                return ctx.slots.register({ name: 'tool.call.toolview', key: name }, WorkbenchToolView);
            });
        }));
    }
    catch (e) {
        /* 同上 */
    }
    return function (): any {
        disposers.forEach(function (dispose?: any): any {
            try {
                dispose();
            }
            catch (e) {
                /* already gone */
            }
        });
    };
};

export { WB_CHAT_ACTIONS_CSS, CHAT_EMBED_ACTIONS, chatEmbedTitle, ChatAssistantActions, chatEmbedBlockSummary, WorkbenchToolView }
