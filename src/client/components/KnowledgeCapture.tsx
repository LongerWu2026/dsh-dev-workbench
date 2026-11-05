import * as React from 'react'
import {WB,Btn,IconBtn,Modal,Field,Input,Textarea,Spinner} from '../core/runtime.js'
import {KnowledgeScopeFields} from './KnowledgeScopeFields.js'
import {MessageContent} from '../features/web-ai/MessageContent.js'

export function NoteMarkdown({text}:{text:string}){return <div className="wb-note-markdown"><style>{NOTE_CSS}</style><MessageContent text={text}/></div>}
export function openSavedNote(id:string){WB.store.set({page:'knowledge',knowledgeFocusId:id})}
export function useKnowledgeCapture(){
 const state=WB.useStore(),[draft,setDraft]=React.useState<any>(null),[loading,setLoading]=React.useState(false),[saving,setSaving]=React.useState(false),[error,setError]=React.useState(''),[savedId,setSavedId]=React.useState(''),[retrySource,setRetrySource]=React.useState<any>(null)
 const generation=React.useRef(0)
 React.useEffect(()=>()=>{generation.current++},[])
 async function open(request:any){
  const g=++generation.current;setLoading(true);setError('');setSavedId('');setDraft(null);setRetrySource(request)
  try{const result=await WB.actions.knowledgeCapture({action:'prepare',...request});if(g===generation.current)setDraft({...result,tags:'',useForAnswers:false})}
  catch(failure:any){if(g===generation.current)setError(failure.message||'无法准备笔记')}
  finally{if(g===generation.current)setLoading(false)}
 }
 function close(){if(saving)return;generation.current++;setDraft(null);setLoading(false);setError('')}
 async function save(){
  if(saving||!draft)return;setSaving(true);setError('')
  try{const result=await WB.actions.knowledgeCapture({action:'save',draftId:draft.draftId,title:draft.title,body:draft.body,scope:draft.scope,tags:draft.tags.split(/[,，]/).map((s:string)=>s.trim()).filter(Boolean),useForAnswers:draft.useForAnswers});setSavedId(result.itemId);setDraft(null);WB.toast(result.duplicate?'这份内容已保存，未重复添加':draft.useForAnswers?'已保存，可用于 AI 回答':'已保存笔记','ok')}
  catch(failure:any){setError(failure.message||'保存失败，请重试')}
  finally{setSaving(false)}
 }
 const dialog=<Modal open={!!draft||loading||!!error} title="保存笔记" width={760} onClose={close} footer={draft?<><Btn disabled={saving} onClick={close}>取消</Btn><Btn kind="primary" disabled={saving||!draft.title.trim()} onClick={save}>{saving?'保存中…':'保存'}</Btn></>:undefined}>
  {loading&&<p role="status"><Spinner size={14}/>正在读取原始内容…</p>}
  {error&&<p role="alert">{error}</p>}
  {error&&!draft&&retrySource?.kind==='radar'&&<Btn onClick={()=>open({...retrySource,linkOnly:true})}>仅收藏链接</Btn>}
  {draft&&<div className="wb-stack"><p className="wb-tiny wb-muted">来源：{draft.source.label}{draft.source.question?' · 问题：'+draft.source.question:''}</p><Field label="标题"><Input aria-label="笔记标题" disabled={saving} value={draft.title} onChange={(e:any)=>setDraft({...draft,title:e.target.value})}/></Field><div className="wb-note-scope"><KnowledgeScopeFields data={state.data} scope={draft.scope} disabled={saving||draft.scopeLocked} onChange={(scope:any)=>setDraft({...draft,scope})} prefix="笔记"/></div>{draft.source.linkOnly?<p className="wb-tiny wb-muted">仅保存原文链接，不作为正文参与 AI 回答。</p>:<Field label="内容"><Textarea aria-label="笔记内容" disabled={saving} value={draft.body} rows={12} onChange={(e:any)=>setDraft({...draft,body:e.target.value})}/></Field>}<Field label="标签"><Input aria-label="笔记标签" disabled={saving} placeholder="多个标签用逗号分隔" value={draft.tags} onChange={(e:any)=>setDraft({...draft,tags:e.target.value})}/></Field>{!draft.source.linkOnly&&<label className="wb-row" style={{gap:8}}><input type="checkbox" disabled={saving} checked={draft.useForAnswers} onChange={e=>setDraft({...draft,useForAnswers:e.target.checked})}/>用于 AI 回答</label>}<style>{NOTE_CSS}</style></div>}
 </Modal>
 return {open,dialog,savedId,loading}
}
export function KnowledgeCaptureButton({request,label='保存笔记'}:{request:any;label?:string}){
 const capture=useKnowledgeCapture(),state=WB.useStore(),projectId=request.scope?.projectId!==undefined?request.scope.projectId:state.data?.settings?.defaultProjectId||null
 const spaceId=request.scope?.spaceId||(state.data?.projects||[]).find((row:any)=>row.id===projectId)?.knowledgeSpaceId||'personal'
 const existing=(state.data?.knowledge||[]).find((row:any)=>{const source=row.capture?.source;return !row.archivedAt&&(row.projectId||null)===projectId&&row.spaceId===spaceId&&source?.kind===request.kind&&(request.kind==='assistant'?source.turnId===request.turnId:request.kind==='radar'?source.radarId===request.id:request.kind==='native'?source.sessionId===request.sessionId&&source.messageId===request.messageId:false)})
 const savedId=capture.savedId||existing?.id
 return <>{savedId?<Btn size="sm" onClick={()=>openSavedNote(savedId)}>查看笔记</Btn>:<Btn size="sm" disabled={capture.loading} onClick={()=>capture.open(request)}>{label}</Btn>}{capture.dialog}</>
}
/** Native chat actions hand off to the workbench root, where modal tokens and layout are owned. */
export function KnowledgeCaptureHost(){
 const state=WB.useStore(),capture=useKnowledgeCapture(),request=state.knowledgeCaptureRequest
 React.useEffect(()=>{if(!request)return;WB.store.set({knowledgeCaptureRequest:null});void capture.open(request)},[request])
 return capture.dialog
}
export function KnowledgeDocumentButton({item,scope}:{item:any;scope:any}){
 const [open,setOpen]=React.useState(false),[doc,setDoc]=React.useState<any>(null),[error,setError]=React.useState(''),[original,setOriginal]=React.useState(false)
 React.useEffect(()=>{if(!open)return;let active=true;setError('');setDoc(null);WB.actions.knowledgeCapture({action:'read',id:item.id,scope,original}).then((result:any)=>{if(active)setDoc(result.item)}).catch((failure:any)=>{if(active)setError(failure.message)});return()=>{active=false}},[open,original,item.id,scope.spaceId,scope.projectId])
 return <><button type="button" className="wb-link" style={{padding:0,border:0,background:'none',font:'inherit',fontSize:13,fontWeight:600,textAlign:'left',overflowWrap:'anywhere'}} aria-label={'查看笔记：'+item.title} onClick={()=>{setOriginal(false);setOpen(true)}}>{item.title}</button><Modal open={open} title={item.title} width={860} onClose={()=>setOpen(false)}>{error?<p role="alert">{error}</p>:!doc?<p role="status">正在读取笔记…</p>:<><p className="wb-tiny wb-muted">{doc.sourceLabel||'手动笔记'}{doc.capture?.source?.messageIds?' · '+doc.capture.source.messageIds.length+' 条消息':''}</p>{doc.capture?.originalRef&&<Btn size="sm" onClick={()=>setOriginal(!original)}>{original?'返回笔记':'查看采集原文'}</Btn>}<NoteMarkdown text={doc.body}/></>}</Modal></>
}
export function AnswerActions({text,request}:{text:string;request:any}){
 const [copied,setCopied]=React.useState(false)
 async function copy(){try{await WB.util.copy(text);setCopied(true)}catch(failure:any){WB.toast(failure.message||'复制失败','warn')}}
 return <div className="wb-row wb-row--wrap wb-note-answer-actions" role="group" aria-label="AI 回复操作" style={{gap:6}}><IconBtn name="copy" label={copied?'已复制':'复制回答'} onClick={copy}/><KnowledgeCaptureButton request={request}/></div>
}
const NOTE_CSS=`.wb-note-markdown .wb-chat-table{overflow-x:auto;max-width:100%}.wb-note-markdown table{border-collapse:collapse;width:100%}.wb-note-markdown th,.wb-note-markdown td{padding:6px 8px;border:1px solid var(--dsw-alias-border-l1)}.wb-note-markdown .wb-chat-code{white-space:pre;max-width:100%;overflow:auto}.wb-note-markdown .wb-chat-code-language{font-size:11px;color:var(--dsw-alias-label-secondary)}.wb-note-scope{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:12px}.wb-note-answer-actions{font-size:11px}.wb-note-markdown{line-height:1.75;overflow-wrap:anywhere;min-width:0}.wb-note-markdown pre{white-space:pre-wrap;overflow-wrap:anywhere}.wb-note-markdown p{margin:8px 0}.wb-note-markdown img{max-width:100%}`
