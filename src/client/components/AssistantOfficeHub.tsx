import * as React from 'react'
import {WB,Btn,Input,Modal} from '../core/runtime.js'
import {BUSY_REPLY_TEXT,OPEN_REPLY_STAGES} from '../../shared/busy-reply.js'

export const OFFICE_KINDS=['work_report','reply_batch','task_assist']
export function officePreview(text:string){return text.replace(/^\s{0,3}#{1,6}\s+/gm,'').replace(/\*\*([^*]+)\*\*/g,'$1').slice(0,360)+'…'}
export function OfficeArtifacts({artifacts=[],disabled,onAction,onOpen,renderText}:any){
 const copy=async(text:string)=>{try{await WB.util.copy(text);WB.toast('内容已复制','ok')}catch{WB.toast('复制失败，请重试','err')}}
 return <div className="wb-hub-office-artifacts">{artifacts.map((artifact:any)=><section className="wb-hub-office-artifact" aria-label={'办公成果：'+artifact.title} key={artifact.jobId+':'+artifact.stepId}>
  <strong>{artifact.title}</strong>{String(artifact.text||'').length>600?<><p className="wb-hub-artifact-preview">{officePreview(String(artifact.text))}</p><details className="wb-hub-office-full"><summary>展开完整内容</summary><div className="wb-hub-office-document">{renderText(artifact.text)}</div></details></>:<div className="wb-hub-office-document">{renderText(artifact.text)}</div>}
  <div className="wb-row wb-row--wrap"><Btn size="sm" onClick={()=>copy(artifact.text)}>复制内容</Btn><Btn size="sm" disabled={disabled||!!artifact.knowledgeId} onClick={()=>onAction('office.saveKnowledge',{jobId:artifact.jobId,stepId:artifact.stepId})}>{artifact.knowledgeId?'已存为候选知识':'存为候选知识'}</Btn>{artifact.kind==='reply_batch'&&<Btn size="sm" disabled={disabled||!!artifact.adoptedAt} onClick={()=>onAction('office.adoptReply',{jobId:artifact.jobId,stepId:artifact.stepId})}>{artifact.adoptedAt?'已保存草稿':'采纳为回复草稿'}</Btn>}</div>
  {artifact.kind==='reply_batch'&&<p className="wb-tiny wb-muted">{artifact.adoptedAt?'草稿已保存，可在对应待回复中核对后发送。':'采纳只保存草稿，核对后再发送。'}</p>}
  {!!artifact.evidenceIds?.length&&<details className="wb-hub-artifact"><summary>参考依据 · {artifact.evidenceIds.length} 项</summary>{artifact.evidenceIds.map((id:string)=><p className="wb-tiny wb-hub-text" key={id}>{id}</p>)}</details>}
 </section>)}</div>
}

export function OfficeTools({view,onClose,onTool,onLaunch,onTask,onConfigure,data,busyReply,disabled,error}:any){
 const [queries,setQueries]=React.useState<Record<string,string>>({}),[selected,setSelected]=React.useState<string[]>([]),query=queries[view]||''
 const replies=(data?.replies||[]).filter((row:any)=>!row.archivedAt&&OPEN_REPLY_STAGES.includes(row.stage)),tasks=(data?.tasks||[]).filter((row:any)=>!row.archivedAt&&!['completed','cancelled'].includes(row.status))
 const visible=(view==='task'?tasks:replies).filter((row:any)=>[row.title,row.contact,row.groupName,row.snippet,row.id].join(' ').toLowerCase().includes(query.toLowerCase()))
 React.useEffect(()=>{const ids=new Set(replies.map((row:any)=>row.id));setSelected(previous=>previous.filter(id=>ids.has(id)))},[data?.replies])
 if(!view)return null
 const title=({common:'助手工具',batch:'选择待回复',task:'选择待办',busy:'自动回复设置'} as any)[view]||'日常工作',config=busyReply?.config
 const batchFooter=view==='batch'?<div className="wb-row wb-row--wrap"><span className="wb-tiny wb-muted">已选 {selected.length}/20 条</span><span className="wb-spacer"/><Btn onClick={onClose}>取消</Btn><Btn kind="primary" disabled={disabled||!selected.length} onClick={()=>onLaunch('batch',selected)}>打开回复主题</Btn></div>:undefined
 return <Modal open title={title} onClose={onClose} footer={batchFooter}>
  {view==='common'?<div className="wb-hub-common-grid"><button onClick={()=>onLaunch('report','day')} disabled={disabled}><strong>日报</strong><span>整理今天的工作进展</span></button><button onClick={()=>onLaunch('report','week')} disabled={disabled}><strong>周报</strong><span>汇总近七日的完成与计划</span></button><button onClick={()=>onTool('batch')}><strong>批量回复草稿</strong><span>选择消息，统一准备回复内容</span></button><button onClick={()=>onTool('task')}><strong>待办处理方案</strong><span>进入对应事项整理步骤与验收清单</span></button><button onClick={()=>onTool('busy')} disabled={disabled}><strong>自动回复设置</strong><span>私聊忙碌告知，保留人工答复</span></button></div>:view==='busy'?<section className="wb-hub-busy-settings" aria-label="忙碌告知设置">
   <div className="wb-hub-card-title"><strong>私聊忙碌告知</strong>{config&&<button type="button" role="switch" aria-label="忙碌自动回复" aria-checked={!!config?.enabled} disabled={disabled||!config} className={'wb-btn wb-btn--sm wb-btn--'+(config?.enabled?'primary':'ghost')} onClick={()=>onConfigure(!config.enabled)}>{config.enabled?'已开启':'已关闭'}</button>}</div>
   <p>仅对新收到的私聊发送固定忙碌告知，群聊不回复；本次忙碌每个会话仅告知一次。</p><blockquote>{config?.text||BUSY_REPLY_TEXT}</blockquote><p className="wb-tiny wb-muted">这不是 AI 自由回复。自动告知后仍需人工答复，关闭后停止新的告知。</p>
   {!config&&!error&&<p role="status">正在读取当前设置…</p>}{busyReply?.pending>0&&<p>当前有 {busyReply.pending} 条消息待人工答复。</p>}{busyReply?.uncertain>0&&<p>{busyReply.uncertain} 个会话正在处理或结果待核实，不会重复告知。</p>}{(error||busyReply?.error)&&<p role="alert" className="wb-hub-error">{error||busyReply.error}</p>}
  </section>:<div className="wb-hub-office-picker"><p className="wb-tiny wb-muted">{view==='batch'?'最多选择20条，先打开处理主题，再明确生成草稿。':'进入对应待办会话后，可生成方案或继续补充处理。'}</p><Input aria-label={view==='task'?'搜索待办':'搜索待回复'} placeholder="搜索标题、联系人或内容" value={query} onChange={(event:any)=>setQueries(previous=>({...previous,[view]:event.target.value}))}/><div className="wb-hub-office-choices">{visible.map((row:any)=>view==='task'?<button type="button" className="wb-hub-item" key={row.id} onClick={()=>onTask(row)}><span><strong>{row.title}</strong><small>{row.description||'生成处理步骤与验收清单'}</small></span></button>:<label key={row.id}><input type="checkbox" aria-label={'选择待回复：'+(row.contact||row.groupName||row.id)} checked={selected.includes(row.id)} disabled={disabled||!selected.includes(row.id)&&selected.length>=20} onChange={event=>setSelected(previous=>event.target.checked?[...previous,row.id]:previous.filter(id=>id!==row.id))}/><span><strong>{row.contact||row.groupName||'待回复'}<small>{row.stage}</small></strong><span>{row.snippet||row.id}</span></span></label>)}{!visible.length&&<p className="wb-tiny wb-muted">{query?'没有匹配的事项。':view==='task'?'暂无未完成待办。':'暂无需要准备草稿的待回复。'}</p>}</div></div>}
 </Modal>
}
