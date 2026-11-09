import * as React from 'react'
import {Btn,Field,Input,Textarea,WB} from '../../../core/runtime.js'
import {toolErrorBlock as ErrorBlock} from '../shared-controls.js'
import type {HttpAssertion,HttpCheck,HttpRequest} from '../../../../shared/http-workspace.js'

export type AssertionField = {kind:HttpAssertion['kind']; path:string; expected:string}
export function assertionFields(rules:HttpAssertion[]):AssertionField[] {
    return rules.map(rule=>({kind:rule.kind,path:rule.kind === 'json' ? rule.path : '',expected:JSON.stringify(rule.expected)}))
}

const assertionLabels = {status:'HTTP 状态码等于',json:'JSON 字段等于',duration:'耗时不超过（ms）'}

export function HttpAssertionEditor({rows,onChange,disabled}:{
    rows:AssertionField[]; onChange:(rows:AssertionField[])=>void; disabled:boolean
}) {
    return <div className="wb-stack">
        {!rows.length && <p className="wb-tiny wb-muted">还没有断言。可手动添加，也可以让 AI 根据接口契约生成。</p>}
        {rows.map((row,index)=>{
            const change = (next:Partial<AssertionField>)=>onChange(rows.map((item,i)=>i === index ? {...item,...next} : item))
            return <div className="wb-http-assertion" key={index}>
                <select className="wb-select" aria-label={'断言类型 '+(index+1)} value={row.kind} disabled={disabled}
                    onChange={event=>change({kind:event.target.value as AssertionField['kind'],expected:event.target.value === 'status' ? '200' : event.target.value === 'duration' ? '500' : 'null'})}>
                    {Object.entries(assertionLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
                </select>
                {row.kind === 'json' && <Input aria-label={'JSON 路径 '+(index+1)} value={row.path} placeholder="$.data[0].code" disabled={disabled} onChange={(event:React.ChangeEvent<HTMLInputElement>)=>change({path:event.target.value})}/>}
                <Input aria-label={'期望值 '+(index+1)} value={row.expected} disabled={disabled} placeholder={row.kind === 'json' ? '"OK" / 0 / true / null' : '200'}
                    onChange={(event:React.ChangeEvent<HTMLInputElement>)=>change({expected:event.target.value})}/>
                <Btn size="sm" aria-label={'移除断言 '+(index+1)} disabled={disabled} onClick={()=>onChange(rows.filter((_,i)=>i !== index))}>移除</Btn>
            </div>
        })}
        {rows.some(row=>row.kind === 'json') && <p className="wb-tiny wb-muted">字符串期望值加双引号，例如 <code>"OK"</code> 或 <code>{'"{{code}}"'}</code>。</p>}
        <div><Btn size="sm" disabled={disabled || rows.length >= 24} onClick={()=>onChange([...rows,{kind:'status',path:'',expected:'200'}])}>添加断言</Btn></div>
    </div>
}

export function HttpChecks({checks}:{checks:HttpCheck[]}) {
    if (!checks.length) return <p className="wb-tiny wb-muted">未配置断言</p>
    return <ul className="wb-http-checks" aria-label="断言核对">
        {checks.map((check,index)=><li key={index} className={check.passed ? 'is-passed' : 'is-failed'}>
            <strong>{check.passed ? '通过' : '失败'} · {check.label}</strong>
            <span>期望 <code>{JSON.stringify(check.expected)}</code></span>
            <span>实际 <code>{check.actual}</code></span>
        </li>)}
    </ul>
}

type AiMode = 'request'|'assertions'
type AiDraft = {request?:HttpRequest; assertions?:HttpAssertion[]; basis?:string; clarification?:string}
export function HttpAiPanel({mode,method,disabled,onClose,onApply}:{
    mode:AiMode; method:string; disabled:boolean; onClose:()=>void; onApply:(draft:AiDraft)=>void
}) {
    const [instruction,setInstruction] = React.useState('')
    const [source,setSource] = React.useState('')
    const [draft,setDraft] = React.useState<AiDraft|null>(null)
    const [busy,setBusy] = React.useState(false)
    const [error,setError] = React.useState('')
    const pending = React.useRef(false)
    const live = React.useRef(true)
    React.useEffect(()=>{live.current=true;return ()=>{live.current=false}},[])
    async function generate() {
        if (pending.current || !instruction.trim()) return
        pending.current=true;setBusy(true);setError('');setDraft(null)
        try {
            const result = await WB.rpc('workbench/httpDebugGenerate',{request:{mode,instruction:instruction.trim(),source,...(mode === 'assertions' ? {method} : {})}})
            if (live.current) setDraft(result)
        } catch (error) {
            if (live.current) setError(error.message)
        } finally {
            pending.current=false
            if (live.current) setBusy(false)
        }
    }
    const rules = draft?.request?.assertions ?? draft?.assertions
    return <aside className="wb-http-ai wb-stack" aria-label="AI 草稿面板">
        <div className="wb-row wb-row--wrap"><strong>{mode === 'request' ? 'AI 请求草稿' : 'AI 断言草稿'}</strong><span className="wb-spacer"/><Btn size="sm" onClick={onClose}>收起 AI</Btn></div>
        <Field label="生成要求"><Textarea aria-label="接口 AI 生成要求" value={instruction} maxLength={2000} rows={3} disabled={busy}
            placeholder={mode === 'request' ? '例如：按对账编码查询明细，并核对返回编码' : '例如：预期 HTTP 200，且 $.data.total 等于 1280'}
            onChange={(event:React.ChangeEvent<HTMLTextAreaElement>)=>{setInstruction(event.target.value);setDraft(null)}}/></Field>
        <Field label="接口依据（可选）"><Textarea aria-label="接口依据" value={source} maxLength={8000} rows={4} disabled={busy}
            placeholder="粘贴脱敏的 OpenAPI、接口文档或代码片段"
            onChange={(event:React.ChangeEvent<HTMLTextAreaElement>)=>{setSource(event.target.value);setDraft(null)}}/></Field>
        <p className="wb-tiny wb-muted">模型只接收这里填写的内容和断言模式下的 HTTP 方法。请先移除凭据和敏感业务数据。</p>
        <div><Btn kind="primary" disabled={busy || disabled || !instruction.trim()} onClick={generate}>{busy ? '生成中…' : '生成草稿'}</Btn></div>
        <ErrorBlock text={error}/>
        {draft?.clarification && <p className="wb-tiny" role="status">{draft.clarification}</p>}
        {rules && <section className="wb-http-draft wb-stack" aria-label="待采用草稿">
            <strong>待采用草稿</strong>
            {draft?.request && <>
                <div>{draft.request.name} · <code>{draft.request.method} {draft.request.url}</code></div>
                {draft.request.headers !== '{}' && <pre className="wb-code" aria-label="草稿请求头">{draft.request.headers}</pre>}
                {draft.request.body && <pre className="wb-code" aria-label="草稿正文">{draft.request.body}</pre>}
            </>}
            {draft?.basis && <p className="wb-tiny wb-muted">依据 · {draft.basis}</p>}
            {mode === 'assertions' && <p className="wb-tiny wb-muted">采用后追加到当前请求的断言。</p>}
            {rules.length > 0 && <ul className="wb-http-draft-rules">{rules.map((rule,index)=>
                <li key={index}>{assertionLabels[rule.kind]} {rule.kind === 'json' && <code>{rule.path} </code>}<code>{JSON.stringify(rule.expected)}</code></li>
            )}</ul>}
            <div><Btn disabled={disabled} onClick={()=>onApply(draft!)}>{draft?.request ? '填入编辑器' : '采用断言草稿'}</Btn></div>
        </section>}
    </aside>
}
