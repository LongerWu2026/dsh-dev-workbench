import * as React from 'react'
import {Btn,Field,Input,Textarea,WB} from '../../../core/runtime.js'
import {toolCopyButton as Copy,toolErrorBlock as ErrorBlock} from '../shared-controls.js'
import {checkHttpResponse,emptyHttpWorkspace,HTTP_METHODS,normalizeHttpAssertions,normalizeHttpRequest,normalizeHttpVariables,resolveHttpRequest,type HttpOutcome,type HttpRequest,type HttpResponse,type HttpWorkspace as Workspace,type SavedHttpRequest} from '../../../../shared/http-workspace.js'
import {exportCurl,importCurl} from './developer-utils.js'
import {ToolAI} from './DeveloperExtras.js'
import {assertionFields,HttpAiPanel,HttpAssertionEditor,HttpChecks,type AssertionField} from './HttpWorkspacePanels.js'

type Editor = Omit<HttpRequest,'assertions'|'timeoutMs'> & {
    timeoutMs:number|string; rules?:AssertionField[]; savedId?:string; curl?:string; result?:HttpResponse|null; outcome?:HttpOutcome|null;
}
type VariableRow = {id:string; name:string; value:string}
type Execution = {cancelled:boolean; requestId?:string}
type RunState = HttpOutcome['state']|'waiting'|'running'|'error'|'skipped'
type RunRow = {id:string; name:string; state:RunState; checks?:HttpOutcome['checks']; status?:number; durationMs?:number; error?:string}
const stateLabels:Record<RunState,string> = {
    waiting:'待运行',running:'运行中',passed:'通过',failed:'断言失败',unchecked:'未配置断言',error:'运行错误',skipped:'已跳过',
}
const emptyEditor:Editor = {name:'',url:'',method:'GET',headers:'{}',body:'',timeoutMs:30000,rules:[],savedId:'',curl:'',result:null}
const nextId = (prefix:string)=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)
const rpc = (method:string,request:unknown)=>WB.rpc('workbench/'+method,{request})
const fieldValue = (event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>event.target.value
const sections = {params:'Params',headers:'Headers',body:'Body',assertions:'断言'}
type Section = keyof typeof sections

function requestFromEditor(value:Editor,persist=false) {
    const assertions = normalizeHttpAssertions((value.rules || []).map((rule,index)=>{
        try {return {kind:rule.kind,path:rule.path,expected:JSON.parse(rule.expected)}}
        catch {throw Error('第 '+(index+1)+' 条断言的期望值须为有效的 JSON 值')}
    }))
    return normalizeHttpRequest({...value,name:value.name?.trim() || value.method+' 请求',timeoutMs:Number(value.timeoutMs),assertions},persist)
}

export function HttpDebugger({value,patch,onTransfer}:{
    value:Editor; patch:(value:Partial<Editor>&{aiOutput?:string})=>void; onTransfer?:(id:string,text:string)=>void
}) {
    const [workspace,setWorkspace] = React.useState(emptyHttpWorkspace)
    const [loaded,setLoaded] = React.useState(false)
    const [loadAttempt,setLoadAttempt] = React.useState(0)
    const [saving,setSaving] = React.useState(false)
    const [storageError,setStorageError] = React.useState('')
    const [collectionId,setCollectionId] = React.useState('default')
    const [collectionName,setCollectionName] = React.useState<string|null>(null)
    const [variablesOpen,setVariablesOpen] = React.useState(false)
    const [variableDrafts,setVariableDrafts] = React.useState<Record<string,VariableRow[]>>({})
    const [variableError,setVariableError] = React.useState('')
    const [section,setSection] = React.useState<Section>('params')
    const [ai,setAi] = React.useState<'request'|'assertions'|null>(null)
    const [error,setError] = React.useState('')
    const [runner,setRunner] = React.useState(false)
    const [latestReport,setReport] = React.useState<{collectionId:string;environment:string;rows:RunRow[]}|null>(null)
    const [detailId,setDetailId] = React.useState('')
    const [operation,setOperation] = React.useState<'single'|'batch'|null>(null)
    const [stopping,setStopping] = React.useState(false)
    const live = React.useRef(true)
    const active = React.useRef<Execution|null>(null)
    const savingRef = React.useRef(false)
    const collection = workspace.collections.find(item=>item.id === collectionId) ?? workspace.collections[0]
    const runtimeValues = JSON.stringify(collection.variables ?? {})
    const variableRows = variableDrafts[collection.id] ?? Object.entries(collection.variables ?? {}).map(([name,value])=>({id:'saved-'+name,name,value}))

    function editVariables(rows:VariableRow[]) {
        setVariableError('')
        setVariableDrafts(previous=>({...previous,[collection.id]:rows}))
    }
    const locked = !!operation || saving
    const {outcome,result:response} = value
    const allowedMethods = response && Object.entries(response.headers).find(([key])=>key.toLowerCase() === 'allow')?.[1]
    const report = latestReport?.collectionId === collection.id ? latestReport : null

    React.useEffect(()=>{
        live.current=true
        return ()=>{
            live.current=false
            const job = active.current
            if (!job) return
            job.cancelled=true
            if (job.requestId) void rpc('debugCancel',{requestId:job.requestId}).catch(()=>{})
        }
    },[])

    React.useEffect(()=>{
        let current = true
        rpc('httpWorkspace',{action:'load'}).then((data:Workspace)=>{
            if (!current) return
            if (!data?.collections?.length) throw Error('宿主尚未加载接口工作区，请重新加载工作台')
            setWorkspace({...data,collections:data.collections.map(item=>item.id === 'default' && item.name === '默认 Collection' ? {...item,name:'默认集合'} : item)});setLoaded(true);setStorageError('')
        }).catch((error:Error)=>{if(current)setStorageError(error.message)})
        return ()=>{current=false}
    },[loadAttempt])

    function resetResponse() {
        setError('');patch({result:null,outcome:null,aiOutput:''})
    }

    async function saveWorkspace(next:Workspace,done:()=>void) {
        if (!loaded || savingRef.current || active.current) return
        savingRef.current=true;setSaving(true);setStorageError('')
        try {
            const saved:Workspace = await rpc('httpWorkspace',{action:'save',workspace:next})
            if (!Array.isArray(saved?.collections) || saved.revision !== next.revision+1) {
                throw Error('未收到有效的保存确认，请重新加载集合后重试。')
            }
            for (const item of next.collections) {
                const stored = saved.collections.find(row=>row.id === item.id)
                const expected = Object.entries(item.variables ?? {})
                const actual = stored?.variables ?? {}
                if (!stored || Object.keys(actual).length !== expected.length || expected.some(([name,value])=>!Object.hasOwn(actual,name) || actual[name] !== value)) {
                    throw Error('宿主未确认保存集合变量。请重载插件或重启 Harness，再重新加载集合后保存。')
                }
            }
            if (live.current) {setWorkspace(saved);done()}
        } catch (error) {
            if (live.current) setStorageError(error.message)
        } finally {
            savingRef.current=false
            if (live.current) setSaving(false)
        }
    }

    function saveRequest() {
        try {
            const request = requestFromEditor(value,true)
            const existing = collection.requests.some(item=>item.id === value.savedId)
            const id = existing ? value.savedId! : nextId('request')
            const saved = {...request,id}
            const requests = existing ? collection.requests.map(item=>item.id === id ? saved : item) : [...collection.requests,saved]
            setError('')
            void saveWorkspace({...workspace,collections:workspace.collections.map(item=>item.id === collection.id ? {...item,requests} : item)},
                ()=>patch({name:request.name,savedId:id}))
        } catch (error) {setError(error.message)}
    }

    function openRequest(request?:SavedHttpRequest) {
        setRunner(false);setAi(null);setSection('params');resetResponse()
        patch(request ? {...request,rules:assertionFields(request.assertions),savedId:request.id,curl:''} : emptyEditor)
    }

    function startOperation(kind:'single'|'batch'):Execution|null {
        if (active.current || savingRef.current) return null
        const job:Execution = {cancelled:false}
        active.current=job;setOperation(kind);setStopping(false)
        return job
    }

    async function execute(job:Execution,request:HttpRequest):Promise<HttpOutcome> {
        const {payload,assertions} = resolveHttpRequest(request,runtimeValues)
        const requestId = nextId('http')
        job.requestId=requestId
        try {
            const result:HttpResponse = await rpc('httpDebug',{...payload,requestId})
            return checkHttpResponse(result,assertions)
        } finally {job.requestId=undefined}
    }

    function finish(job:Execution) {
        if (active.current !== job) return
        active.current=null
        if (live.current) {setOperation(null);setStopping(false)}
    }

    async function stop() {
        const job = active.current
        if (!job || job.cancelled) return
        job.cancelled=true;setStopping(true)
        if (job.requestId) {
            try {await rpc('debugCancel',{requestId:job.requestId})}
            catch (error) {if(live.current && active.current === job)setError('停止请求失败：'+error.message)}
        }
    }

    async function send() {
        const job = startOperation('single')
        if (!job) return
        resetResponse()
        try {
            const result = await execute(job,requestFromEditor(value))
            if (live.current && !job.cancelled) patch({outcome:result,result:result.response})
        } catch (error) {
            if (live.current && !job.cancelled) setError(error.message)
        } finally {
            if (live.current && job.cancelled) setError('请求已停止，目标端可能已执行，请核对结果')
            finish(job)
        }
    }

    function openRunner() {
        setRunner(true);setAi(null);setError('')
    }

    async function run() {
        const requests = collection.requests
        if (!requests.length) return
        const job = startOperation('batch')
        if (!job) return
        setError('');setDetailId('')
        const target = collection.name+(collection.variables?.baseUrl ? ' · '+collection.variables.baseUrl : '')
        const rows:RunRow[] = requests.map(item=>({id:item.id,name:item.name,state:'waiting'}))
        const publish = ()=>{if(live.current)setReport({collectionId:collection.id,environment:target,rows:rows.slice()})}
        publish()
        try {
            for (const [index,request] of requests.entries()) {
                if (job.cancelled) {
                    rows[index]={...rows[index],state:'skipped'}
                    continue
                }
                rows[index]={...rows[index],state:'running'};publish()
                try {
                    const result = await execute(job,request)
                    rows[index]={...rows[index],state:result.state,status:result.response.status,durationMs:result.response.durationMs,checks:result.checks}
                } catch (error) {
                    rows[index]={...rows[index],state:'error',error:job.cancelled ? '请求已停止，目标端可能已执行，请核对结果' : error.message}
                }
                publish()
            }
        } finally {
            publish()
            if (live.current) setDetailId((rows.find(item=>item.state === 'failed' || item.state === 'error') ?? rows[0]).id)
            finish(job)
        }
    }

    const detail = report?.rows.find(item=>item.id === detailId)
    const savedHere = collection.requests.some(item=>item.id === value.savedId)
    const [address,query=''] = (value.url || '').split(/\?(.*)/s,2)
    return <div className="wb-http-workspace">
        {variablesOpen && <section className="wb-http-variables wb-stack" aria-label="变量配置">
            <div className="wb-row wb-row--wrap"><strong>{collection.name} · 变量</strong></div>
            {variableRows.length === 0 && <p className="wb-tiny wb-muted">暂无变量。可添加 baseUrl、token 或其他变量。</p>}
            {variableRows.map((row,index)=><div className="wb-http-variable-row" key={row.id}>
                <Field label="名称"><Input aria-label={'变量名称 '+(index+1)} value={row.name} placeholder="如 baseUrl" disabled={locked}
                    onChange={(event:React.ChangeEvent<HTMLInputElement>)=>editVariables(variableRows.map(item=>item.id === row.id ? {...item,name:fieldValue(event)} : item))}/></Field>
                <Field label="值"><Textarea aria-label={'变量值 '+(index+1)} rows={1} value={row.value} placeholder={row.name === 'baseUrl' ? 'https://api.example.com' : '输入变量值'} disabled={locked}
                    onChange={(event:React.ChangeEvent<HTMLTextAreaElement>)=>editVariables(variableRows.map(item=>item.id === row.id ? {...item,value:fieldValue(event)} : item))}/></Field>
                <Btn size="sm" aria-label={'删除变量 '+(index+1)} disabled={locked} onClick={()=>editVariables(variableRows.filter(item=>item.id !== row.id))}>删除</Btn>
            </div>)}
            <ErrorBlock text={variableError}/>
            <div className="wb-row wb-row--wrap wb-http-variable-actions">
                <Btn size="sm" disabled={locked} onClick={()=>editVariables([...variableRows,{id:nextId('variable'),name:'',value:''}])}>添加</Btn>
                <Btn size="sm" kind="primary" disabled={!loaded || locked} onClick={()=>{
                    try {
                        const entries = new Map<string,string>()
                        for (const [index,row] of variableRows.entries()) {
                            const name = row.name.trim()
                            if (!name) throw Error('请填写第 '+(index+1)+' 行的变量名称')
                            if (entries.has(name)) throw Error('变量名称重复：'+name)
                            entries.set(name,row.value)
                        }
                        const variables = normalizeHttpVariables(Object.fromEntries(entries))
                        setVariableError('')
                        void saveWorkspace({...workspace,collections:workspace.collections.map(item=>item.id === collection.id ? {...item,variables} : item)},()=>{
                            setVariableDrafts(previous=>{const next={...previous};delete next[collection.id];return next})
                            resetResponse()
                        })
                    } catch(error) {setVariableError(error.message)}
                }}>{saving ? '保存中…' : '保存'}</Btn>
                <span className="wb-tiny wb-muted" role="status">{Object.hasOwn(variableDrafts,collection.id) ? '有未保存的修改，请保存后发送请求' : '使用已保存的变量'}</span>
            </div>
        </section>}
        {storageError && <div className="wb-row wb-row--wrap"><ErrorBlock text={storageError}/><Btn size="sm" disabled={locked} onClick={()=>{setLoaded(false);setLoadAttempt(value=>value+1)}}>重新加载集合</Btn></div>}
        <div className={'wb-http-layout'+(ai ? ' has-ai' : '')}>
            <aside className="wb-http-collections wb-stack" aria-label="集合">
                <div className="wb-row wb-row--wrap"><strong>集合</strong><span className="wb-spacer"/><Btn size="sm" aria-label="新建集合" disabled={!loaded || locked} onClick={()=>setCollectionName(collectionName === null ? '' : null)}>＋</Btn></div>
                {collectionName !== null && <div className="wb-stack">
                    <Input aria-label="集合名称" value={collectionName} maxLength={100} disabled={locked} onChange={(event:React.ChangeEvent<HTMLInputElement>)=>setCollectionName(fieldValue(event))}/>
                    <div><Btn size="sm" disabled={locked || !collectionName.trim()} onClick={()=>{
                        const item={id:nextId('collection'),name:collectionName.trim(),requests:[],variables:{}}
                        void saveWorkspace({...workspace,collections:[...workspace.collections,item]},()=>{setCollectionId(item.id);setCollectionName(null);setVariableError('');openRequest()})
                    }}>创建集合</Btn></div>
                </div>}
                <select className="wb-select" aria-label="选择集合" value={collection.id} disabled={locked} onChange={event=>{setCollectionId(event.target.value);setVariableError('');openRequest()}}>
                    {workspace.collections.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <div className="wb-http-collection-actions" role="group" aria-label="当前集合操作">
                    <Btn size="sm" disabled={!loaded || locked} aria-expanded={variablesOpen} onClick={()=>setVariablesOpen(!variablesOpen)}>变量</Btn>
                    <Btn size="sm" disabled={!collection.requests.length || locked || runner} onClick={openRunner}>运行</Btn>
                    <Btn kind="primary" size="sm" disabled={locked} onClick={()=>{setRunner(false);setAi(ai === 'request' ? null : 'request')}}>AI 生成请求</Btn>
                    {operation && <Btn size="sm" disabled={stopping} onClick={stop}>{stopping ? '停止中…' : operation === 'batch' ? '停止运行' : '停止请求'}</Btn>}
                </div>
                <Btn size="sm" disabled={locked} onClick={()=>openRequest()}>新建请求</Btn>
                {!collection.requests.length && <p className="wb-tiny wb-muted">{loaded ? '还没有保存的请求' : '集合尚未加载'}</p>}
                {collection.requests.map(item=><button key={item.id} type="button" className="wb-http-request-item" disabled={locked} aria-current={!runner && item.id === value.savedId}
                    onClick={()=>openRequest(item)}><code>{item.method}</code><span>{item.name}</span></button>)}
            </aside>
            {runner ? <section className="wb-http-main wb-stack" aria-label="集合运行">
                <div className="wb-row wb-row--wrap"><strong>运行 {collection.name}</strong><span className="wb-spacer"/><Btn size="sm" disabled={locked} onClick={()=>{setRunner(false);setError('')}}>返回请求</Btn></div>
                <p className="wb-tiny wb-muted">{'按列表顺序运行全部 '+collection.requests.length+' 个已保存请求，使用 '+collection.name+' 已保存的变量'+(collection.variables?.baseUrl ? ' · '+collection.variables.baseUrl : '')}</p>
                <ol className="wb-http-run-plan">
                    {collection.requests.map(item=><li key={item.id}>{item.name} <code>{item.method} {item.url}</code></li>)}
                </ol>
                <div><Btn kind="primary" disabled={locked || !collection.requests.length} onClick={run}>运行全部请求</Btn></div>
                <ErrorBlock text={error}/>
                {report && <section className="wb-http-response wb-stack" aria-label="批跑结果">
                    <div className="wb-row wb-row--wrap"><strong>运行结果</strong><span className="wb-tiny wb-muted">{report.environment}</span></div>
                    <p className="wb-tiny" aria-live="polite">{(['passed','failed','error','unchecked','skipped'] as const).map(state=>stateLabels[state]+' '+report.rows.filter(row=>row.state === state).length).join(' · ')}</p>
                    {report.rows.map(row=><button className={'wb-http-result-item is-'+row.state} key={row.id} type="button" aria-pressed={row.id === detailId} onClick={()=>setDetailId(row.id)}>
                        <span>{row.name} {row.status !== undefined && <small>· HTTP {row.status} · {row.durationMs} ms</small>}</span><strong>{stateLabels[row.state]}</strong>
                    </button>)}
                    {detail && <div className="wb-http-detail wb-stack">
                        <strong>{detail.name} · 逐项核对</strong>
                        {detail.error ? <ErrorBlock text={detail.error}/> : detail.checks ? <HttpChecks checks={detail.checks}/> : <p className="wb-tiny">{stateLabels[detail.state]}</p>}
                    </div>}
                </section>}
            </section> : <section className="wb-http-main wb-stack" aria-label="请求编辑">
                <div className="wb-row wb-row--wrap">
                    <Input className="wb-http-name wb-input" aria-label="请求名称" value={value.name || ''} maxLength={100} placeholder="未命名请求" disabled={locked} onChange={(event:React.ChangeEvent<HTMLInputElement>)=>patch({name:fieldValue(event)})}/>
                    <Btn size="sm" disabled={!loaded || locked || !value.url} onClick={saveRequest}>{savedHere ? '保存请求' : '加入集合'}</Btn>
                </div>
                <div className="wb-http-request-bar">
                    <select className="wb-select" aria-label="HTTP 方法" value={value.method || 'GET'} disabled={locked} onChange={event=>{resetResponse();patch({method:event.target.value})}}>
                        {HTTP_METHODS.map(method=><option key={method}>{method}</option>)}
                    </select>
                    <Input aria-label="接口请求地址" value={value.url || ''} maxLength={4000} disabled={locked} placeholder="https://example.com/api 或 {{baseUrl}}/api" onChange={(event:React.ChangeEvent<HTMLInputElement>)=>{resetResponse();patch({url:fieldValue(event)})}}/>
                    <Btn kind="primary" disabled={locked || !value.url} onClick={send}>{operation === 'single' ? '请求中…' : '发送请求'}</Btn>
                </div>
                <div className="wb-http-tabs" role="group" aria-label="请求设置">{Object.entries(sections).map(([key,label])=>
                    <button key={key} type="button" aria-pressed={section === key} onClick={()=>setSection(key as Section)}>{label}{key === 'assertions' && value.rules?.length ? ' '+value.rules.length : ''}</button>
                )}</div>
                {section === 'params' && <Field label="查询参数"><Input aria-label="查询参数" value={query} disabled={locked} placeholder="period=2026-10"
                    onChange={(event:React.ChangeEvent<HTMLInputElement>)=>{resetResponse();patch({url:address+(event.target.value ? '?'+event.target.value : '')})}}/></Field>}
                {section === 'headers' && <Field label="请求头（JSON）"><Textarea aria-label="调试请求头" rows={4} disabled={locked} value={value.headers ?? '{}'}
                    onChange={(event:React.ChangeEvent<HTMLTextAreaElement>)=>{resetResponse();patch({headers:fieldValue(event)})}}/></Field>}
                {section === 'body' && <Field label="请求正文"><Textarea aria-label="接口请求正文" rows={5} disabled={locked} value={value.body || ''}
                    onChange={(event:React.ChangeEvent<HTMLTextAreaElement>)=>{resetResponse();patch({body:fieldValue(event)})}}/></Field>}
                {section === 'assertions' && <>
                    <HttpAssertionEditor rows={value.rules || []} disabled={locked} onChange={rules=>{resetResponse();patch({rules})}}/>
                    <div><Btn size="sm" disabled={locked} onClick={()=>setAi(ai === 'assertions' ? null : 'assertions')}>AI 生成断言</Btn></div>
                </>}
                <div className="wb-row wb-row--wrap wb-http-utilities">
                    <details><summary>导入 cURL</summary>
                        <Textarea aria-label="cURL 命令" rows={3} value={value.curl || ''} disabled={locked} onChange={(event:React.ChangeEvent<HTMLTextAreaElement>)=>patch({curl:fieldValue(event)})}/>
                        <Btn size="sm" disabled={locked} onClick={()=>{try{const request=importCurl(value.curl || '');resetResponse();setSection(request.body ? 'body' : 'params');patch({...request,savedId:'',name:'',rules:[]})}catch(error){setError(error.message)}}}>导入请求（不发送）</Btn>
                    </details>
                    <details><summary>超时设置</summary><Field label="超时（毫秒）"><Input aria-label="调试超时" type="number" min={1000} max={60000} value={value.timeoutMs ?? 30000} disabled={locked}
                        onChange={(event:React.ChangeEvent<HTMLInputElement>)=>patch({timeoutMs:fieldValue(event)})}/></Field></details>
                    <Btn size="sm" disabled={!value.url || locked} onClick={()=>{try{void WB.util.copy(exportCurl(value)).catch((error:Error)=>setError(error.message))}catch(error){setError(error.message)}}}>复制 cURL</Btn>
                </div>
                <section className="wb-http-response wb-stack" aria-label="响应">
                    <div className="wb-row wb-row--wrap"><strong>响应</strong><span className="wb-spacer"/>
                        {response && <span className="wb-tiny" role="status">HTTP {response.status}{response.statusText ? ' '+response.statusText : ''} · {response.durationMs} ms{outcome && ' · '+stateLabels[outcome.state]}</span>}
                    </div>
                    <ErrorBlock text={error}/>
                    {!response && !error && <div className="wb-data-empty"><span className="wb-http-empty-mark" aria-hidden="true">⌁</span><strong>等待发送请求</strong><span className="wb-tiny wb-muted">发送请求后查看响应和断言结果</span></div>}
                    {response && <>
                        {response.status >= 400 && <p className="wb-tiny" role="alert" style={{color:'var(--wb-err)',margin:0}}>
                            {response.status === 405
                                ? 'HTTP 405：服务端不允许当前请求方法，请核对接口文档中的方法和路径。'+(allowedMethods ? ' 服务端允许的方法：'+allowedMethods+'。' : ' 服务端未提供 Allow 响应头，无法自动确定应使用的方法。')
                                : '服务端返回 HTTP '+response.status+'，请结合响应正文、响应头或服务端日志排查。'}
                        </p>}
                        <div className="wb-row wb-row--wrap">
                            <Copy text={response.text}/>
                            {response.text && [['json','JSON'],['diff','Diff'],['types','类型生成']].map(([id,label])=><Btn key={id} size="sm" onClick={()=>onTransfer?.(id,response.text)}>响应 → {label}</Btn>)}
                        </div>
                        {response.text ? <pre className="wb-code" tabIndex={0} aria-label="调试响应">{response.text}</pre>
                            : <div className="wb-data-empty" role="status"><strong>已收到响应，但响应正文为空</strong><span className="wb-tiny wb-muted">{value.method === 'HEAD' ? 'HEAD 请求只返回响应头，不包含正文。' : response.status === 204 ? 'HTTP 204 表示请求成功，无响应正文。' : '服务端没有返回正文，请查看 HTTP 状态和下方响应头。'}</span></div>}
                        {response.truncated && <p className="wb-tiny wb-muted">响应超过 1 MB，已截断。</p>}
                        <details><summary>响应头</summary><pre className="wb-code">{JSON.stringify(response.headers,null,2)}</pre></details>
                        {outcome && <HttpChecks checks={outcome.checks}/>}
                        <ToolAI id="http-debug" value={value} patch={patch}/>
                    </>}
                </section>
            </section>}
            {ai && <HttpAiPanel key={ai} mode={ai} method={value.method} disabled={locked} onClose={()=>setAi(null)} onApply={draft=>{
                const added = draft.assertions ? [...(value.rules || []),...assertionFields(draft.assertions)] : null
                if (added && added.length > 24) {setError('当前请求最多可保存 24 条断言，请先移除部分断言');return}
                resetResponse()
                if (draft.request) patch({...draft.request,rules:assertionFields(draft.request.assertions),savedId:'',curl:''})
                else if (added) patch({rules:added})
                setSection('assertions');setAi(null)
            }}/>}
        </div>
    </div>
}
