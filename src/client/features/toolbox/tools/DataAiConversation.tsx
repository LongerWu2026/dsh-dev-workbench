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
type DataSource = 'sql' | 'es' | 'redis';
type Props = {
    turns: DataTurn[];
    pending: string;
    instruction: string;
    mode: 'query' | 'script';
    source: DataSource;
    selected: DataDraft['selected'];
    canSend: boolean;
    busy: boolean;
    scopeHint: string;
    error: string;
    setInstruction: (value:string)=>void;
    setMode: (value:DataDraft['mode'])=>void;
    send: ()=>void;
    apply: (draft:DataDraft)=>void;
    onClose?: ()=>void;
    databaseLabel?: string;
};

function starterQuestions(source:DataSource,selected:DataDraft['selected']){
    const first=selected[0];
    if(source==='es'){
        const index=`索引“${first?.name??'完整索引名'}”`;
        return [
            {label:first?'统计当前索引的文档总数':'统计指定索引的文档总数',instruction:`统计${index}的文档总数`},
            {label:'统计最近七天每天的新增文档数',instruction:`按创建时间统计${index}最近七天每天的新增文档数`},
            {label:'按字段汇总文档数量',instruction:`按${index}中的分类字段汇总文档数量，并按数量降序排列`},
        ];
    }
    if(source==='redis'){
        const key=first?`Key「${first.name}」`:'所选 Key';
        return [
            {label:'查看 Key 的数据类型',instruction:`查看${key}的数据类型`},
            {label:'查看 Key 的剩余过期时间',instruction:`查看${key}的剩余过期时间`},
            {label:'统计 Key 的长度或元素数',instruction:`根据数据类型查询${key}的长度或元素数量`},
        ];
    }
    const scope=selected.length>1?'在所选表中，':first?`在表「${[first.schemaName,first.name].filter(Boolean).join('.')}」中，`:'';
    return ['统计最近七天每天的记录数量','按分类汇总并按数量排序','查找重复记录']
        .map(label=>({label,instruction:scope+label}));
}

export function DataAiConversation(props:Props){
    const {turns,pending,instruction,mode,source,selected,canSend,busy,scopeHint,error}=props;
    const isSql=source==='sql';
    const scriptMode=mode==='script';
    const showIntro=!turns.length&&!pending&&!error;
    const starters=starterQuestions(source,selected);
    const example=isSql?'统计最近七天每天的订单金额':starters[0].label;
    const placeholder=scriptMode
        ?(turns.length?'继续补充要调整的数据或字段…':'例如，为订单表新增备注字段')
        :(turns.length?'继续描述筛选条件，或修改上面的查询…':`例如，${example}`);
    const log=React.useRef<HTMLDivElement>(null),composer=React.useRef<HTMLFormElement>(null);
    React.useEffect(()=>{
        if(log.current)log.current.scrollTop=turns.length||pending||error?log.current.scrollHeight:0;
    },[turns,pending,error]);

    return <aside className="wb-data-ai" id="wb-data-ai-conversation" aria-label="数据库 AI 会话">
        <header className="wb-data-ai-header">
            <span className="wb-data-ai-icon"><Icon name="sparkles" size={16}/></span>
            <strong>{isSql?'AI SQL 助手':'AI 查询助手'}</strong>
            {props.databaseLabel&&<span className="wb-data-ai-context" title={props.databaseLabel}>{props.databaseLabel}</span>}
            {props.onClose&&<IconBtn name="chevronRight" label="收起 AI 会话" onClick={props.onClose}/>}
        </header>
        <div className={'wb-data-ai-log'+(showIntro?' is-empty':'')} ref={log} role="log" aria-label="AI 会话记录" tabIndex={0}>
            {showIntro&&<div className={'wb-data-ai-empty'+(scriptMode?' is-script':'')}>
                <strong>{scriptMode?'生成 SQL 变更脚本':isSql?'描述需求，让 AI 生成 SQL':'描述需求，让 AI 生成查询'}</strong>
                <p className="wb-muted">{scriptMode?'描述要调整的数据或表结构，AI 会生成脚本和回滚建议。':'告诉 AI 想查什么，可以带上筛选条件和统计口径。'}</p>
                {!scriptMode&&<div className="wb-data-ai-starters" role="group" aria-labelledby="wb-data-ai-starters-label">
                    <p id="wb-data-ai-starters-label" className="wb-tiny wb-muted">试试这样问</p>
                    {starters.map(({label,instruction})=><button key={label} type="button" disabled={busy}
                        onClick={()=>{props.setInstruction(instruction);composer.current?.querySelector('textarea')?.focus()}}>
                        <Icon name="plus" size={14}/><span>{label}</span>
                    </button>)}
                </div>}
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
                    placeholder={placeholder}
                    onChange={(event:React.ChangeEvent<HTMLTextAreaElement>)=>props.setInstruction(event.target.value)}
                    onKeyDown={(event:React.KeyboardEvent<HTMLTextAreaElement>)=>{
                        if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)&&!event.nativeEvent.isComposing){
                            event.preventDefault();
                            if(canSend)props.send();
                        }
                    }}/>
                <div className="wb-data-ai-controls">
                    {isSql&&<div className="wb-data-ai-mode">
                        <Btn kind="subtle" size="sm" icon={scriptMode?'reply':'edit'} disabled={busy}
                            title={scriptMode?'返回查询':'生成变更脚本和回滚建议，仅供预览'}
                            onClick={()=>props.setMode(scriptMode?'query':'script')}>{scriptMode?'返回查询':'变更脚本'}</Btn>
                        {scriptMode&&<span className="wb-tiny wb-muted">仅预览，不能执行</span>}
                    </div>}
                    <Btn kind="primary" size="sm" disabled={!canSend} onClick={props.send}>{scriptMode?'生成脚本':isSql?'生成 SQL':'生成查询'}</Btn>
                </div>
            </div>
        </form>
    </aside>;
}
