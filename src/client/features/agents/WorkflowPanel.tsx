import {KnowledgeSources} from '../../components/KnowledgeSources.js'
import {AnalysisJobProgress} from '../../components/WorkflowJobs.js'
import {Pagination,PAGE_SIZE,pageIndex} from '../../components/Pagination.js'
import * as React from 'react'
import {WB,Btn,Panel,Select,Field,Modal,Badge} from '../../core/runtime.js'
import {OFFICE_WORKFLOW_LABELS,isOfficeWorkflow} from '../../../shared/office-workflow.js'
const STATUS:Record<string,string>={queued:'排队中',running:'执行中',completed:'已交付',failed:'需处理',cancelled:'已取消',pending:'待处理'}
export function WorkflowPanel(){
 const data=WB.useStore().data||{},[open,setOpen]=React.useState(false),[kind,setKind]=React.useState('reply_batch'),[period,setPeriod]=React.useState('day'),[taskId,setTaskId]=React.useState(''),[selected,setSelected]=React.useState<string[]>([]),[filter,setFilter]=React.useState('all'),[page,setPage]=React.useState(0)
 const replies=(data.replies||[]).filter((r:any)=>!r.archivedAt&&['待回复','已确认收到','已自动回复'].includes(r.stage)), tasks=(data.tasks||[]).filter((t:any)=>!t.archivedAt&&!['completed','cancelled'].includes(t.status))
 const jobs=(data.jobs||[]).slice().reverse(), visible=jobs.filter((j:any)=>filter==='all'||filter==='active'&&['queued','running'].includes(j.status)||filter==='review'&&['failed','cancelled'].includes(j.status)||filter==='done'&&j.status==='completed')
 const safe=(promise:Promise<any>)=>promise.catch(()=>{})
 async function start(){try{await WB.actions.officeWorkflowStart(kind,kind==='reply_batch'?{replyIds:selected}:kind==='task_assist'?{taskId}:{period});setOpen(false)}catch{}}
 return <Panel title="办公执行" sub="复用已有模型，按步骤保存产物；回复草稿需采纳后保存，企业消息尚未发送。" actions={<Btn kind="primary" icon="plus" onClick={()=>setOpen(true)}>新建办公流程</Btn>}>
  <div className="wb-row wb-row--wrap" role="group" aria-label="工作流状态筛选" style={{gap:6,marginBottom:12}}>{[['all','全部'],['active','进行中'],['review','需处理'],['done','已交付']].map(([value,label])=><Btn key={value} size="sm" kind={filter===value?'primary':undefined} onClick={()=>{setFilter(value);setPage(0)}}>{label} {value==='all'?jobs.length:jobs.filter((j:any)=>value==='active'?['queued','running'].includes(j.status):value==='review'?['failed','cancelled'].includes(j.status):j.status==='completed').length}</Btn>)}</div>
  {!visible.length&&<p className="wb-muted wb-tiny">当前没有符合筛选条件的后台作业。</p>}
  <div className="wb-stack">{visible.slice(pageIndex(page,visible.length)*PAGE_SIZE,(pageIndex(page,visible.length)+1)*PAGE_SIZE).map((job:any)=><details key={job.id} className="wb-item" style={{display:'block',minWidth:0}}>
   <summary style={{cursor:'pointer',overflowWrap:'anywhere'}}>{job.title||({analysis:'消息识别',summary:'资讯摘要'} as any)[job.kind]||job.kind} · {STATUS[job.status]||job.status} {job.steps&&`· ${job.steps.filter((s:any)=>s.status==='completed').length}/${job.steps.length}`}</summary>
   <div className="wb-stack" style={{paddingTop:12,minWidth:0}}>
    <div className="wb-tiny wb-muted">创建：{WB.fmt.datetime(job.createdAt)} · 更新：{WB.fmt.datetime(job.updatedAt)}</div>
    {job.kind==='task_assist'&&<p className="wb-tiny">产物为处理方案与验收清单；尚未执行项目命令或标记业务完成。</p>}
    {job.error&&<p role="status" className="wb-tiny" style={{overflowWrap:'anywhere'}}>{job.error}{job.nextRetryAt&&` · 下次尝试 ${WB.fmt.datetime(job.nextRetryAt)}`}</p>}
    {job.note&&<p className="wb-tiny">{job.note}</p>}
    {job.kind==='analysis'&&<AnalysisJobProgress job={job}/>}
    {isOfficeWorkflow(job.kind)&&<div className="wb-row wb-row--wrap" style={{gap:8}}>
     {['queued','running'].includes(job.status)&&<Btn size="sm" onClick={()=>safe(WB.actions.officeWorkflowControl(job.id,'cancel'))}>取消后续步骤</Btn>}
     {['failed','cancelled'].includes(job.status)&&<Btn size="sm" onClick={()=>safe(WB.actions.officeWorkflowControl(job.id,'retry'))}>继续未完成步骤</Btn>}
    </div>}
    {(job.steps||[]).map((step:any)=><section key={step.id} aria-label={step.label} style={{borderTop:'1px solid var(--wb-border)',paddingTop:10,minWidth:0}}>
     <div className="wb-row wb-row--wrap"><strong style={{overflowWrap:'anywhere'}}>{step.label}</strong><Badge>{STATUS[step.status]||step.status}</Badge></div>
     {step.error&&<p role="status" className="wb-tiny" style={{overflowWrap:'anywhere'}}>{step.error}</p>}
     {step.input?.knowledge&&<KnowledgeSources result={step.input.knowledge} provided={step.status==='completed'}/>}
     {step.artifact&&<><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:'inherit',fontSize:13,maxHeight:360,overflow:'auto'}}>{step.artifact.text}</pre>
      <p className="wb-tiny wb-muted" style={{overflowWrap:'anywhere'}}>依据：{step.artifact.evidenceIds.join('、')} · {WB.fmt.datetime(step.artifact.at)}</p>
      <div className="wb-row wb-row--wrap" style={{gap:8}}><Btn size="sm" onClick={()=>safe(WB.util.copy(step.artifact.text).then(()=>WB.toast('产物已复制','ok')))}>复制产物</Btn>
       <Btn size="sm" onClick={()=>safe(WB.actions.createKnowledge({title:job.title+' · '+step.label,body:step.artifact.text,kind:'note',reviewState:'candidate',projectId:step.input?.task?.projectId||null,accountId:step.input?.source?.locator?.accountId||null,sourceLabel:'办公作业 '+job.id}))}>存为候选知识</Btn>
       {job.kind==='reply_batch'&&<Btn size="sm" disabled={!!step.adoptedAt} onClick={()=>safe(WB.actions.adoptReplyArtifact(job.id,step.id))}>{step.adoptedAt?'已保存草稿':'采纳为回复草稿'}</Btn>}
       {job.kind==='task_assist'&&<Btn size="sm" onClick={()=>WB.focusTask(job.input.taskId)}>查看待办</Btn>}
      </div></>}
    </section>)}
    {!job.steps&&job.result&&<pre className="wb-tiny" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(job.result,null,2)}</pre>}
   </div>
  </details>)}</div>
  <Pagination page={page} total={visible.length} onChange={setPage}/>
  {open&&<Modal open={open} title="新建办公流程" onClose={()=>setOpen(false)} footer={<div className="wb-row" style={{justifyContent:'flex-end',gap:8}}><Btn onClick={()=>setOpen(false)}>取消</Btn><Btn kind="primary" disabled={kind==='reply_batch'&&!selected.length||kind==='task_assist'&&!taskId} onClick={start}>加入执行队列</Btn></div>}>
   <div className="wb-stack"><Field label="流程类型"><Select value={kind} options={Object.entries(OFFICE_WORKFLOW_LABELS).map(([value,label])=>({value,label}))} onChange={(e:any)=>setKind(e.target.value)}/></Field>
    {kind==='reply_batch'&&<fieldset style={{border:0,padding:0,minWidth:0}}><legend>选择待回复（最多20条）</legend><div style={{maxHeight:280,overflow:'auto'}}>{replies.map((r:any)=><label key={r.id} style={{display:'flex',gap:8,padding:6,overflowWrap:'anywhere'}}><input type="checkbox" checked={selected.includes(r.id)} disabled={!selected.includes(r.id)&&selected.length>=20} onChange={e=>setSelected(old=>e.target.checked?[...old,r.id]:old.filter(id=>id!==r.id))}/>{r.contact||r.groupName||'待回复'}：{r.snippet||r.id}</label>)}</div>{!replies.length&&<p>当前没有待回复。</p>}</fieldset>}
    {kind==='task_assist'&&<><Field label="关联待办"><Select value={taskId} options={[{value:'',label:'请选择待办'},...tasks.map((t:any)=>({value:t.id,label:t.title}))]} onChange={(e:any)=>setTaskId(e.target.value)}/></Field><p className="wb-tiny wb-muted">整理已有消息和任务资料，生成处理步骤及验收清单。</p></>}
    {kind==='work_report'&&<Field label="报告范围"><Select value={period} options={[{value:'day',label:'今日 · Asia/Shanghai'},{value:'week',label:'近七日 · Asia/Shanghai'}]} onChange={(e:any)=>setPeriod(e.target.value)}/></Field>}
   </div>
  </Modal>}
 </Panel>
}
