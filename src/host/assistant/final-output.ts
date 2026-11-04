/** Only visible assistant text can become a structured result; never reasoning. */
export function assistantOutputText(message:any):string{
 if(['analysis','reasoning','thinking','commentary'].includes(message?.channel)||['analysis','reasoning','thinking','commentary'].includes(message?.phase))return ''
 const text=(Array.isArray(message?.content)?message.content:[]).filter((block:any)=>block?.type==='text'&&typeof block.text==='string').map((block:any)=>block.text).join('\n')
 return text.replace(/^(?:\s*<(?:think|thinking|analysis)\b[^>]*>[\s\S]*?(?:<\/(?:think|thinking|analysis)\s*>|$))+/i,'').trim()
}
/** A completed turn's last assistant message after its last tool is the result.
 * No fallback to an earlier draft when the final message is invalid or absent. */
export function finalAssistantOutput(events:any[]):{event:any;text:string}|null{
 let candidate:any=null,ended=false
 for(const event of events){
  if(event.type==='turn/start'||event.type==='user/message'&&event.data?.source?.kind!=='context'){candidate=null;ended=false}
  else if(event.type==='tool/call'||event.type==='tool/result'){candidate=null}
  else if(event.type==='assistant/message')candidate={event,text:assistantOutputText(event.data?.message)}
  else if(event.type==='turn/end'){ended=true;if(event.data?.reason?.kind&&event.data.reason.kind!=='completed')candidate=null}
 }
 return ended?candidate:null
}
