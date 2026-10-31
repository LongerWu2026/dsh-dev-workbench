import * as React from 'react'
import {Badge,Btn,Icon,Input,WB} from '../../core/runtime.js'
import type {DevelopmentTask} from '../../../shared/development.js'
import {WorkItemsBrowser} from './WorkItemsBrowser.js'
import {DevelopmentSettings} from './DevelopmentSettings.js'
import {DevelopmentTaskDetail} from './DevelopmentTaskDetail.js'
import {developmentCall as call,developmentCSS,workItemsCSS,statusLabels,tone} from './development-ui.js'
const attention=['paused','waiting_review','approved','rejected','failed','interrupted']
const finished=['delivered','completed']
export function DevelopmentPage(){
    const store=WB.useStore(),projects=(store.data?.projects||[]).filter((p:any)=>p.repoPath)
    const [snapshot,setSnapshot]=React.useState<any>(null),[connection,setConnection]=React.useState<any>(null),[detecting,setDetecting]=React.useState(false)
    const [busy,setBusy]=React.useState(''),[error,setError]=React.useState(''),[selected,setSelected]=React.useState(''),[detail,setDetail]=React.useState<any>(null)
    const [filter,setFilter]=React.useState('all'),[query,setQuery]=React.useState(''),[settings,setSettings]=React.useState(false),[refreshKey,setRefreshKey]=React.useState(0)
    const root=React.useRef<HTMLDivElement>(null),refreshing=React.useRef(false),lastRefresh=React.useRef(0),refreshRef=React.useRef<()=>void>(()=>{}),openSeq=React.useRef(store.developmentOpenSeq),mounted=React.useRef(true),selection=React.useRef(''),lock=React.useRef(false),loadVersion=React.useRef(0);selection.current=selected
    async function load(){const version=++loadVersion.current,result=await call({action:'state'});if(!result?.config||!Array.isArray(result.tasks))throw new Error('研发接口版本不匹配，请重新加载工作台插件');if(mounted.current&&version===loadVersion.current)setSnapshot(result);return result}
    async function detect(){setDetecting(true);try{const value=await call({action:'detect'});if(mounted.current)setConnection(value)}catch(e:any){if(mounted.current)setError(e.message||String(e))}finally{if(mounted.current)setDetecting(false)}}
    React.useEffect(()=>{mounted.current=true;void load().then(()=>{if(mounted.current)void detect()}).catch(e=>mounted.current&&setError(e.message));return()=>{mounted.current=false}},[])
    async function perform(label:string,fn:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(label);setError('');try{await fn()}catch(e:any){if(mounted.current)setError(e.message||String(e))}finally{lock.current=false;if(mounted.current)setBusy('')}}
    React.useEffect(()=>{
        let alive=true,inFlight=false
        const refresh=async()=>{if(inFlight)return;inFlight=true;try{if(selected){const value=await call({action:'detail',id:selected});if(alive&&selection.current===selected)setDetail(value)}if(alive)await load()}catch(e:any){if(alive)setError(e.message||String(e))}finally{inFlight=false}}
        if(selected)void refresh()
        const timer=setInterval(()=>{if(selected||snapshot?.tasks?.some((t:any)=>t.status==='running'))void refresh()},3000)
        return()=>{alive=false;clearInterval(timer)}
    },[selected,!!snapshot?.tasks?.some((t:any)=>t.status==='running')])
    refreshRef.current=()=>{
        if(!snapshot||refreshing.current||Date.now()-lastRefresh.current<500||document.visibilityState==='hidden')return
        refreshing.current=true;lastRefresh.current=Date.now();setRefreshKey(value=>value+1)
        void (async()=>{try{await load();if(connection?.status!=='ready')await detect();if(selection.current){const id=selection.current,value=await call({action:'detail',id});if(mounted.current&&selection.current===id)setDetail(value)}}catch(e:any){if(mounted.current)setError(e.message||String(e))}finally{refreshing.current=false}})()
    }
    React.useEffect(()=>{
        const refresh=()=>refreshRef.current(),visible=()=>{if(document.visibilityState!=='hidden')refresh()}
        window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visible)
        let observer:IntersectionObserver|undefined,wasVisible:boolean|undefined
        if(typeof IntersectionObserver!=='undefined'&&root.current){observer=new IntersectionObserver(entries=>{const next=entries.some(entry=>entry.isIntersecting);if(next&&wasVisible===false)refresh();wasVisible=next});observer.observe(root.current)}
        return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);observer?.disconnect()}
    },[])
    React.useEffect(()=>{if(openSeq.current!==store.developmentOpenSeq){openSeq.current=store.developmentOpenSeq;refreshRef.current()}},[store.developmentOpenSeq])
    function choose(row:DevelopmentTask){selection.current=row.id;setSelected(row.id);setDetail(null);requestAnimationFrame(()=>document.querySelector('.wb-dev [aria-label="任务详情"]')?.scrollIntoView?.({block:'start',behavior:'smooth'}))}
    async function taskAction(action:string,note?:string){if(!selected)return;await call({action,id:selected,note});await load();const value=await call({action:'detail',id:selected});if(selection.current===selected)setDetail(value)}
    const all:DevelopmentTask[]=snapshot?.tasks||[],current:DevelopmentTask|undefined=detail?.task||all.find(row=>row.id===selected)
    const counts={all:all.length,active:all.filter(t=>['running','ready','preparing'].includes(t.status)).length,attention:all.filter(t=>attention.includes(t.status)).length,done:all.filter(t=>finished.includes(t.status)).length}
    const tasks=all.filter(row=>(filter==='all'||(filter==='active'?['running','ready','preparing'].includes(row.status):filter==='attention'?attention.includes(row.status):finished.includes(row.status)))&&(!query||[row.issue.code,row.issue.title,row.sessionId].some(v=>v?.toLowerCase().includes(query.toLowerCase()))))
    const unavailable=!snapshot||error.startsWith('当前宿主尚未加载研发接口'),disabled=!!busy||unavailable
    const connected=connection?.status==='ready'
    const setConfig=(config:any)=>setSnapshot((old:any)=>({...old,config}))
    return <div ref={root} className="wb-page wb-dev"><style>{developmentCSS+workItemsCSS}</style>
        <header className="wb-dev-header"><div><h1>研发任务</h1></div><div className="wb-dev-actions"><Btn disabled={disabled||detecting} onClick={()=>setSettings(true)} icon="settings">研发设置</Btn></div></header>
        {error&&<div role="alert" className="wb-dev-banner" data-kind="error"><p>{error}</p><Btn disabled={!!busy} onClick={()=>void perform('重新连接',async()=>{await load();await detect()})}>重新连接研发服务</Btn></div>}
        {detecting?<div className="wb-dev-banner"><p>正在检测本机 Linky 与登录状态…</p></div>:connection&&!connected?<div className="wb-dev-banner"><div><strong>{connection.status==='missing_cli'?'连接 Linky，开始处理需求与缺陷':connection.status==='needs_login'?'请先登录 Linky':'Linky 暂时无法连接'}</strong><p>{connection.message}</p>{connection.status==='needs_login'&&<p>在 Linky 客户端完成登录，然后点击重新检测。</p>}{connection.status==='missing_cli'&&<p>安装客户端并登录；若已安装，可在“个人设置 → 命令行工具”完成 CLI 安装。</p>}</div><div className="wb-dev-actions">{connection.status==='missing_cli'&&<a className="wb-link" href="https://linky.kingdee.com/home/" target="_blank" rel="noreferrer">打开 Linky 安装入口 ↗</a>}<Btn disabled={disabled} onClick={()=>void perform('检测连接',detect)}>重新检测</Btn></div></div>:null}
        {connected&&snapshot&&<div style={{marginBottom:20}}><WorkItemsBrowser refreshKey={refreshKey} disabled={disabled} key={snapshot.config.profile} config={snapshot.config} connection={connection} projects={projects} tasks={all} onExisting={choose} onInspect={()=>{selection.current='';setSelected('');setDetail(null)}} onConfig={setConfig} onCreated={(row:DevelopmentTask)=>{choose(row);void perform('刷新',async()=>{await load()})}}/></div>}
        <div className="wb-dev-toolbar">{all.length>0&&<Input aria-label="搜索研发会话" placeholder="搜索需求号、缺陷号或任务标题" value={query} onChange={(e:any)=>setQuery(e.target.value)}/>}<div className="wb-dev-actions"><span className="wb-dev-meta">{connected?'Linky 已连接 · '+(connection.user?.name||connection.profile):'Linky 未连接'}</span><Btn size="sm" disabled={!!busy} onClick={()=>void perform('刷新',async()=>{await load();if(!connected)await detect();setRefreshKey(value=>value+1)})}>刷新任务</Btn></div></div>
        {all.length>0&&<details className="wb-dev-records" open={!!current||!connected}><summary>研发执行记录</summary>
        {all.length>0&&<div className="wb-dev-overview" aria-label="研发任务概览">{[{id:'all',label:'全部任务'},{id:'active',label:'进行中'},{id:'attention',label:'需要处理'},{id:'done',label:'已回写 / 结束'}].map(({id,label})=><button type="button" key={id} className="wb-dev-stat" aria-pressed={filter===id} onClick={()=>setFilter(id)}><span>{label}</span><strong>{counts[id as keyof typeof counts]}</strong></button>)}</div>}

        {!snapshot&&!error?<div className="wb-dev-empty"><p>正在读取研发任务…</p></div>:!all.length?null:<div className="wb-dev-layout"><section className="wb-dev-list" aria-label="研发任务列表">{tasks.length?tasks.map(row=><button type="button" key={row.id} className="wb-dev-task" aria-pressed={selected===row.id} onClick={()=>choose(row)}><div className="wb-dev-actions"><Badge>{row.issue.code}</Badge><Badge tone={tone(row.status)}>{statusLabels[row.status]||row.status}</Badge></div><h3>{row.issue.title}</h3><div className="wb-dev-meta">{projects.find((p:any)=>p.id===row.projectId)?.name||'本地工程'} · {row.agentName||'Harness'}{row.updatedAt?' · '+WB.fmt.datetime(row.updatedAt):''}</div>{row.pauseReason&&attention.includes(row.status)&&<p className="wb-dev-meta" style={{marginTop:8}}>{row.pauseReason}</p>}</button>):<div className="wb-dev-empty"><p>没有符合条件的任务</p><Btn onClick={()=>{setQuery('');setFilter('all')}}>清除筛选</Btn></div>}</section>
            {current?<DevelopmentTaskDetail key={current.id} task={current} messages={detail?.messages||[]} workspace={detail?.workspace} workspaceError={detail?.workspaceError} disabled={disabled} onConfigure={()=>setSettings(true)} onAction={(action,note)=>void perform('更新任务',()=>taskAction(action,note))} onGuidance={text=>void perform('补充要求',async()=>{await call({action:'guidance',id:current.id,text});await load();const value=await call({action:'detail',id:current.id});if(selection.current===current.id)setDetail(value)})}/>:<div className="wb-dev-card wb-dev-empty"><Icon name="agent" size={28}/><h2>选择任务，查看下一步</h2><p className="wb-dev-meta">进度、暂停原因、测试结果和审查操作都在这里。</p>{counts.attention>0&&<div className="wb-dev-actions"><Btn onClick={()=>{setFilter('attention');choose(all.find(t=>attention.includes(t.status))!)}}>查看需要处理的任务</Btn></div>}</div>}
        </div>}
        </details>}
        {(snapshot?.nativeRuns||[]).length>0&&<section className="wb-dev-card" style={{marginTop:20}}><h2>从 Linky 发起的执行</h2><p className="wb-dev-meta">按来源保留执行记录，审查状态以对应工作项为准。</p>{snapshot.nativeRuns.filter((r:any)=>!query||[r.issueCode,r.issueId,r.sessionId].some(v=>v?.toLowerCase().includes(query.toLowerCase()))).map((r:any)=><details key={r.id} className="wb-dev-evidence"><summary>{r.issueCode||r.issueId||'未关联工作项'} · {statusLabels[r.status]||r.status}</summary><p className="wb-dev-meta">Harness 会话：{r.sessionId} · 工作区：{r.cwd}</p>{r.error&&<p>{r.error}</p>}{r.output&&<pre>{r.output}</pre>}</details>)}</section>}
        {settings&&snapshot&&<DevelopmentSettings key={current?.projectId||'settings'} config={snapshot.config} connection={connection} adapter={snapshot.adapter} projects={projects} projectId={current?.projectId||''} disabled={!!busy} onClose={()=>setSettings(false)} onSave={async patch=>{if(lock.current)throw new Error('请等待当前操作完成');lock.current=true;setBusy('保存设置');try{await call({action:'configure',config:patch});await load();setConnection(null);await detect()}finally{lock.current=false;setBusy('')}}}/>}
    </div>
}
