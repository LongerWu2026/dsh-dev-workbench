import * as React from 'react'
import {Btn,Icon,IconBtn,Textarea} from '../../../core/runtime.js'
import {toolCopyButton as Copy} from '../shared-controls.js'

export type DataDraft = {
    query: string;
    explanation?: string;
    rollback?: string;
    mode: 'query' | 'script';
    schemaHash?: string;
    selected: {name:string;schemaName?:string}[];
};
export type DataTurn = {instruction:string; draft?:DataDraft; clarification?:string};
type Props = {
    turns: DataTurn[];
    pending: string;
    instruction: string;
    mode: 'query' | 'script';
    isSql: boolean;
    canSend: boolean;
    busy: boolean;
    scopeHint: string;
    error: string;
    setInstruction: (value:string)=>void;
    setMode: (value:string)=>void;
    send: ()=>void;
    apply: (draft:DataDraft)=>void;
    onClose?: ()=>void;
    databaseLabel?: string;
};

export function DataAiConversation(props:Props){
    const {turns,pending,instruction,mode,isSql,canSend,busy,scopeHint,error}=props;
    const log=React.useRef<HTMLDivElement>(null),composer=React.useRef<HTMLFormElement>(null);
    React.useEffect(()=>{
        if(log.current)log.current.scrollTop=turns.length||pending||error?log.current.scrollHeight:0;
    },[turns,pending,error]);

    return <aside className="wb-data-ai" id="wb-data-ai-conversation" aria-label="数据库 AI 会话">
        <header className="wb-data-ai-header">
            <span className="wb-data-ai-icon"><Icon name="sparkles" size={16}/></span>
            <strong>{isSql?'AI SQL 助手':'AI 查询助手'}</strong>
            {props.databaseLabel&&<span className="wb-data-ai-context" title={props.databaseLabel}>{props.databaseLabel}</span>}
            {props.onClose&&<IconBtn name="close" label="关闭 AI 会话" onClick={props.onClose}/>}
        </header>
        <div className="wb-data-ai-log" ref={log} role="log" aria-label="AI 会话记录" tabIndex={0}>
            {!turns.length&&!pending&&!error&&<div className="wb-data-ai-empty">
                <span className="wb-data-ai-hero-icon"><Icon name="sparkles" size={26}/></span>
                <strong>{isSql?'描述需求，让 AI 生成 SQL':'描述需求，让 AI 生成查询'}</strong>
                <p className="wb-muted">说明要查询的数据、筛选条件和统计方式，也可以继续追问调整。</p>
                <div className="wb-data-ai-starters" aria-label="查询需求示例">
                    {['统计最近七天每天的记录数量','按分类汇总并按数量排序','查找重复记录'].map(text=><button key={text} type="button" disabled={busy} onClick={()=>{props.setInstruction(text);composer.current?.querySelector('textarea')?.focus()}}>{text}<Icon name="arrowRight" size={13}/></button>)}
                </div>
            </div>}
            {turns.map(({instruction,draft,clarification},index)=><div className="wb-data-ai-turn" key={index}>
                <p className="wb-data-ai-question">{instruction}</p>
                <div className="wb-data-ai-answer">
                    <strong className="wb-tiny">{draft?(draft.mode==='script'?'变更脚本 · 仅预览':'查询建议'):'需要补充'}</strong>
                    {clarification&&<p>{clarification}</p>}
                    {draft?.explanation&&<p>{draft.explanation}</p>}
                    {draft&&<>
                        <pre className="wb-code">{draft.query}</pre>
                        {draft.selected.length>0&&<p className="wb-tiny wb-muted wb-data-used-objects" title={draft.selected.map(item=>[item.schemaName,item.name].filter(Boolean).join('.')).join('、')}>使用对象 · {draft.selected.map(item=>[item.schemaName,item.name].filter(Boolean).join('.')).join('、')}</p>}
                        {draft.rollback&&<details><summary>回滚建议（仅预览）</summary><pre className="wb-code">{draft.rollback}</pre></details>}
                        <div className="wb-row wb-row--wrap">
                            <Btn kind="primary" size="sm" disabled={busy} onClick={()=>props.apply(draft)}>{draft.mode==='script'?'在编辑器预览脚本':isSql?'填入 SQL 编辑器':'填入查询编辑器'}</Btn>
                            <Copy text={draft.query} label="复制建议"/>
                        </div>
                    </>}
                </div>
            </div>)}
            {pending&&<div className="wb-data-ai-turn"><p className="wb-data-ai-question">{pending}</p><p role="status" className="wb-tiny wb-muted">正在生成…</p></div>}
            {error&&<p role="alert" className="wb-data-ai-error">{error}</p>}
        </div>
        <form className="wb-data-ai-composer" ref={composer} onSubmit={event=>{event.preventDefault();if(canSend)props.send()}}>
            <p className="wb-tiny wb-muted">{scopeHint}</p>
            <div className="wb-data-ai-input">
                <Textarea aria-label="数据库AI需求" rows={4} maxLength={2000} value={instruction} disabled={busy}
                    placeholder={turns.length?'继续描述筛选条件，或修改上面的查询…':'描述你想查询的数据，例如：统计最近七天每天的订单金额'}
                    onChange={(event:React.ChangeEvent<HTMLTextAreaElement>)=>props.setInstruction(event.target.value)}
                    onKeyDown={(event:React.KeyboardEvent<HTMLTextAreaElement>)=>{
                        if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)&&!event.nativeEvent.isComposing){
                            event.preventDefault();
                            if(canSend)props.send();
                        }
                    }}/>
                <div className="wb-data-ai-controls">
                    <select aria-label="数据库生成模式" className="wb-select" disabled={busy} value={mode} onChange={event=>props.setMode(event.target.value)}>
                        <option value="query">只读查询</option>
                        {isSql&&<option value="script">变更脚本（仅预览）</option>}
                    </select>
                    <Btn kind="primary" size="sm" disabled={!canSend} onClick={props.send}>{mode==='script'?'生成脚本':isSql?'生成 SQL':'生成查询'}</Btn>
                </div>
            </div>
        </form>
    </aside>;
}
