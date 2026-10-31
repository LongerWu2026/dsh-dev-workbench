import * as React from 'react'
import {Badge,Btn,Field,Segmented,Textarea,WB} from '../../core/runtime.js'
import {DEVELOPMENT_STAGES,type DevelopmentTask} from '../../../shared/development.js'
import {statusLabels,tone,developmentCall as call} from './development-ui.js'
export function DevelopmentTaskDetail({task:current,messages=[],workspace,workspaceError,disabled,onAction,onGuidance,onConfigure}:{task:DevelopmentTask;messages?:any[];workspace?:{id:string;title:string;path:string};workspaceError?:string;disabled:boolean;onAction:(action:string,note?:string)=>void;onGuidance:(text:string)=>void;onConfigure:()=>void}){
    const [tab,setTab]=React.useState('evidence'),[note,setNote]=React.useState(''),[guidance,setGuidance]=React.useState(current.guidance||'')
    const [runs,setRuns]=React.useState<any[]|null>(null),[runsBusy,setRunsBusy]=React.useState(false),[runsError,setRunsError]=React.useState('')
    async function readRuns(){setRunsBusy(true);setRunsError('');try{const result=await call({action:'runs',code:current.issue.id});setRuns(result.items)}catch(e:any){setRunsError(e.message||String(e))}finally{setRunsBusy(false)}}
    const cursor=DEVELOPMENT_STAGES.findIndex(s=>s.id===current.stage)
    const stepOf=(stage:string)=>{const index=DEVELOPMENT_STAGES.findIndex(s=>s.id===stage);if(index>cursor||(index===cursor&&['paused','rejected'].includes(current.status)))return;return current.steps.filter(s=>s.stage===stage).at(-1)}
    const done=DEVELOPMENT_STAGES.filter(s=>stepOf(s.id)?.status==='completed').length
    const openSession=(id:string)=>{if(WB.openSessionById(id))WB.openConversation();else WB.toast('当前宿主未提供会话跳转，请按会话 ID 在 Harness 中查找','warn')}
    const next:Record<string,string>={ready:'工作区已就绪，可以开始开发',running:'Harness 正在执行，完成后进入人工审查',waiting_review:'轮到你审查本次变更',approved:'审查已通过，确认后同步结果',delivered:'结果已回写至 Linky',paused:'任务已暂停，需要处理后继续',rejected:'变更已退回，可以继续修复'}
    return <article className="wb-dev-card" aria-label="任务详情">
        <div className="wb-dev-actions"><Badge>{current.issue.code}</Badge><Badge tone={tone(current.status)}>{statusLabels[current.status]||current.status}</Badge></div>
        <h2>{current.issue.title}</h2>
        <div className="wb-dev-meta">累计 {done} / {DEVELOPMENT_STAGES.length} 阶段 · 剩余 {DEVELOPMENT_STAGES.length-done}</div>
        <progress aria-label="研发流程进度" max={DEVELOPMENT_STAGES.length} value={done} style={{width:'100%',height:4,accentColor:'var(--wb-accent)'}}/>
        <ol className="wb-dev-timeline" aria-label="研发阶段">{DEVELOPMENT_STAGES.map((s,i)=>{const finished=stepOf(s.id)?.status==='completed';return <li key={s.id} data-state={finished?'done':current.stage===s.id?'current':'pending'} aria-current={current.stage===s.id?'step':undefined}><span>{i+1}. {s.label} · {finished?'完成':current.stage===s.id?'当前':'待处理'}</span></li>})}</ol>
        <section className="wb-dev-next">
            <strong>{next[current.status]||statusLabels[current.status]||current.status}</strong>
            {current.pauseReason&&<p role="status" className="wb-dev-meta" style={{marginTop:6,whiteSpace:'pre-wrap'}}>{current.pauseReason}</p>}
            {workspaceError&&<p role="alert" className="wb-dev-meta">工作区关联失败：{workspaceError}</p>}
            {current.status==='ready'&&<p className="wb-dev-meta">分析、开发、测试和自动审查将连续执行，人工批准后才能回写结果。</p>}
            <div className="wb-dev-actions">{['ready','paused','rejected'].includes(current.status)&&<Btn kind="primary" disabled={disabled} onClick={()=>onAction('start')}>{current.status==='ready'?'开始开发流程':'继续执行'}</Btn>}{current.status==='running'&&<Btn disabled={disabled} onClick={()=>onAction('pause')}>暂停执行</Btn>}{current.status==='paused'&&<Btn disabled={disabled} onClick={onConfigure}>检查工程设置</Btn>}{current.sessionId&&<Btn onClick={()=>openSession(current.sessionId)}>打开 Harness 开发会话</Btn>}</div>
            {current.status==='waiting_review'&&<section aria-label="人工审查" className="wb-dev-form">
                <Field label="审查意见"><Textarea aria-label="人工审查意见" placeholder="检查差异、测试结果和自动审查意见，填写结论" value={note} onChange={(e:any)=>setNote(e.target.value)} rows={3}/></Field>
                <div className="wb-dev-actions"><Btn kind="primary" disabled={disabled||!note.trim()} onClick={()=>onAction('approve',note)}>批准本次变更</Btn><Btn disabled={disabled||!note.trim()} onClick={()=>onAction('reject',note)}>退回修复</Btn></div>
            </section>}
            {current.status==='approved'&&<div className="wb-dev-form"><p className="wb-dev-meta">将审查意见、测试结果和会话编号写入此工作项评论。代码提交、发布与业务状态流转按实际流程确认。</p><Btn kind="primary" disabled={disabled} onClick={()=>onAction('writeback')}>确认回写 Linky 评论</Btn></div>}
        </section>
        <div className="wb-dev-detail-tabs"><Segmented value={tab} onChange={setTab} items={[{value:'evidence',label:'变更与验证'},{value:'conversation',label:'会话过程'},{value:'context',label:'任务信息'}]}/></div>
        {tab==='evidence'&&<div>
            {current.diff&&<details className="wb-dev-evidence" open><summary>实际代码差异</summary><pre>{current.diff}</pre></details>}
            {current.steps.length?current.steps.map((step,i)=><details key={i} className="wb-dev-evidence" open={step.stage==='test'||step.stage==='review'}><summary>{DEVELOPMENT_STAGES.find(s=>s.id===step.stage)?.label} · {step.status==='completed'?'完成':step.status==='failed'?'失败':'执行中'}{step.exitCode!=null&&<span> · 退出码 {step.exitCode}</span>}</summary><pre>{step.output||'正在处理，请查看会话过程。'}</pre></details>):<p className="wb-dev-meta">启动后将在这里呈现实际差异、测试输出和审查结论。</p>}
            {!['running','delivered'].includes(current.status)&&<details className="wb-dev-advanced"><summary>补充要求或重新修复</summary><div className="wb-dev-form"><Field label="补充开发要求"><Textarea aria-label="补充开发要求" rows={3} value={guidance} onChange={(e:any)=>setGuidance(e.target.value)}/></Field><Btn disabled={disabled||!guidance.trim()} onClick={()=>onGuidance(guidance)}>保存要求，重新修复</Btn></div></details>}
        </div>}
        {tab==='conversation'&&<div className="wb-stack">{current.reviewSessionId&&<Btn onClick={()=>openSession(current.reviewSessionId!)}>打开审查会话</Btn>}{messages.some(g=>g.entries?.length)?messages.map(group=><section key={group.sessionId}><div className="wb-dev-meta">会话 {group.sessionId}</div>{(group.entries||[]).slice(-30).map((entry:any,i:number)=><div key={i} className="wb-dev-evidence"><Badge>{entry.role}</Badge><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{entry.text}</p></div>)}</section>):<p className="wb-dev-meta">暂未读取到会话内容，可打开原生 Harness 会话查看。</p>}</div>}
        {tab==='context'&&<div className="wb-stack wb-dev-meta"><p>Linky 状态：{current.issue.status||'未提供'}</p>{workspace&&<p>Harness 工作区：{workspace.title}</p>}<p>开发目录：{current.cwd}</p><p>工作方式：{current.workspaceMode==='directory'?'直接目录开发（未要求 Git）':'Git 独立工作区'}</p>{current.branch&&<p>分支：{current.branch}</p>}<p>开发会话：{current.sessionId||'未创建'}</p>{current.reviewSessionId&&<p>审查会话：{current.reviewSessionId}</p>}<p>执行角色：{current.agentName||'Harness 默认研发助手'}</p>{current.contextNote&&<p>{current.contextNote}</p>}<details><summary>工作项原始描述</summary><p style={{whiteSpace:'pre-wrap'}}>{current.issue.description||'未提供描述'}</p></details><div><Btn disabled={disabled||runsBusy} onClick={()=>void readRuns()}>{runsBusy?'正在读取…':'读取 Linky 执行记录'}</Btn></div>{runsError&&<p role="alert">{runsError}</p>}{runs&&<section aria-label="Linky 执行记录">{runs.length?runs.map((r:any,i:number)=><div key={r.id||i} className="wb-dev-evidence"><strong>{r.name||r.title||r.id||'执行记录'}</strong><p>{statusLabels[r.status]||r.status||'未提供状态'}{r.started_at?' · '+r.started_at:''}</p>{(r.summary||r.error)&&<p>{String(r.summary||r.error)}</p>}</div>):<p>此工作项暂无 Linky 执行记录。</p>}</section>}</div>}
    </article>
}
