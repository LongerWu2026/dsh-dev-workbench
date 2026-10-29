import * as React from 'react'
import {WB,Btn,acceptSnapshot} from '../../core/runtime.js'
import {taskReplyTarget} from '../../../shared/task-reply.js'
import {ReplyDraft} from '../inbox/ReplyDraft.js'

/** Reuse the same draft and delivery reservation as the reply inbox. */
export function TaskReplyPanel({task,data,initialOpen=false}:{task:any;data:any;initialOpen?:boolean}) {
 const [replyId,setReplyId]=React.useState<string|null>(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('')
 const preparing=React.useRef(false)
 async function prepare(){
  if(preparing.current)return
  preparing.current=true;setBusy(true);setError('')
  try{const result=await WB.rpc('workbench/prepareTaskReply',{taskId:task.id});acceptSnapshot(result.snapshot);setReplyId(result.replyId)}
  catch(e){setError(String((e as Error).message))}finally{preparing.current=false;setBusy(false)}
 }
 React.useEffect(()=>{if(initialOpen)void prepare()},[])
 if(!taskReplyTarget(data,task.id))return null
 const reply=(data.replies||[]).find((row:any)=>row.id===replyId)
 return <section aria-label={'待办原会话回复 '+task.title} style={{minWidth:0,overflowWrap:'anywhere'}} onClick={e=>e.stopPropagation()}>
  {!reply&&<Btn size="sm" disabled={busy} onClick={prepare}>{busy?'载入回复…':'回复原会话'}</Btn>}
  {error&&<p role="alert">{error}</p>}
  {reply&&<ReplyDraft key={reply.id} reply={reply} data={data} taskId={task.id} initialOpen/>}
 </section>
}
