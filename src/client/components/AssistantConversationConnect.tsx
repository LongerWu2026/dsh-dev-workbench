import * as React from 'react'
import {Btn,Input,Modal,Spinner,WB} from '../core/runtime.js'
import {readAssistantHub} from '../core/assistant-hub-read.js'

export function AssistantConversationConnect({onClose,onConnected}:{onClose:()=>void;onConnected:(row:any)=>void}){
 const [rows,setRows]=React.useState<any[]>([]),[query,setQuery]=React.useState(''),[selected,setSelected]=React.useState(''),[loading,setLoading]=React.useState(true),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[retry,setRetry]=React.useState(0)
 const current=React.useRef(true),pending=React.useRef(false)
 React.useEffect(()=>{current.current=true;return()=>{current.current=false}},[])
 React.useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');setSelected('')
  readAssistantHub({action:'availableSessions'},controller.signal).then(result=>{if(controller.signal.aborted)return;if(result?.status!=='ok')throw Error(result?.note||'无法读取可接入会话');setRows(result.sessions||[])}).catch(failure=>{if(!controller.signal.aborted)setError(failure.message||'无法读取可接入会话')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[retry])
 const visible=rows.filter(row=>[row.title,row.workspaceTitle,row.cwd].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase())),selectedRow=visible.find(row=>row.sessionId===selected)
 async function connect(){if(pending.current||!selectedRow)return;pending.current=true;setBusy(true);setError('')
  try{const result=await WB.actions.assistantHub({action:'adopt',sessionId:selectedRow.sessionId,confirmed:true});if(!current.current)return;if(result?.status!=='ok'||result.conversationId!=='chat:'+selectedRow.sessionId)throw Error(result?.note||'接入未确认，请刷新后重试');onConnected({id:result.conversationId,kind:'chat',title:result.title||selectedRow.title})}
  catch(failure:any){if(current.current)setError(failure.message||'接入失败，原会话仍保留')}
  finally{pending.current=false;if(current.current)setBusy(false)}
 }
 return <Modal open title="接入已有会话" sub="选择一条 Harness 会话，在 AI 助手中继续处理。" width={560} onClose={busy?()=>{}:onClose} footer={<><Btn size="sm" disabled={busy||loading} onClick={()=>setRetry(value=>value+1)}>刷新列表</Btn><span style={{flex:1}}/><Btn disabled={busy} onClick={onClose}>取消</Btn><Btn kind="primary" disabled={busy||loading||!selectedRow} onClick={()=>void connect()}>{busy?'正在接入…':'接入并打开'}</Btn></>}>
  <div className="wb-hub-connect"><Input aria-label="搜索可接入会话" placeholder="搜索会话或工作区" value={query} onChange={(event:any)=>setQuery(event.target.value)}/>
   <p className="wb-tiny wb-muted">仅列出当前 Harness 已加载、尚未关联事项的会话。接入会保留原历史和工作区。</p>
   {loading?<p role="status" className="wb-row wb-muted"><Spinner size={14}/>正在读取会话…</p>:<div className="wb-hub-connect-list" role="group" aria-label="可接入的原生会话">{visible.map(row=><button type="button" key={row.sessionId} aria-pressed={row.sessionId===selected} className="wb-hub-connect-item" disabled={busy} onClick={()=>setSelected(row.sessionId)}><strong>{row.title}</strong><small>{row.workspaceTitle||'未归入工作区'}{row.cwd?' · '+row.cwd:''}</small></button>)}{!visible.length&&<p className="wb-muted">{query?'没有匹配的会话':'暂无可接入会话。可先在 Harness 打开需要的会话，再刷新列表。'}</p>}</div>}
   {error&&<p role="alert" className="wb-hub-error">{error}</p>}
  </div><style>{`.wb-hub-connect{min-width:0}.wb-hub-connect>.wb-input{width:100%;box-sizing:border-box}.wb-hub-connect-list{display:flex;flex-direction:column;gap:6px;max-height:320px;overflow:auto}.wb-hub-connect-item{appearance:none;text-align:left;display:flex;flex-direction:column;gap:5px;min-width:0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}.wb-hub-connect-item[aria-pressed=true]{border-color:var(--dsw-alias-brand-primary,var(--dsw-alias-border-l2));background:var(--dsw-alias-bg-layer-2)}.wb-hub-connect-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.wb-hub-connect-item strong,.wb-hub-connect-item small{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.wb-hub-connect-item small{font-size:11px;color:var(--dsw-alias-label-secondary)}`}</style>
 </Modal>
}
