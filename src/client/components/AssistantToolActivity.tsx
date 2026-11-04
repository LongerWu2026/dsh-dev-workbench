import * as React from 'react'

/** New hosts provide provenance; older records fall back to known workbench operations. */
export function isBusinessAssistantCommand(command:any,source:string){
 if(command.kind==='tool')return false
 if(command.kind==='business')return true
 const operation=String(command.operation||'')
 return source==='rule'||operation.startsWith('workbench_')||/^(?:task|reply|analysis|radar|knowledge|development|busyReply|office|messages)\./.test(operation)||['search','confirm','cancel'].includes(operation)
}
const status=(command:any)=>command.blocked?'暂不能执行':({completed:'已完成',executing:'执行中',failed:'失败',interrupted:'已中断',needs_confirmation:'需确认'} as Record<string,string>)[command.status]||'状态待确认'
export function AssistantToolActivity({commands}:{commands:any[]}){
 if(!commands.length)return null
 const failures=commands.filter(command=>['failed','interrupted'].includes(command.status)).length,active=commands.some(command=>command.status==='executing')
 return <details className="wb-hub-tools" aria-label="工具执行记录"><summary>工具执行记录 · {commands.length} 项{active?' · 执行中':failures?' · '+failures+' 项未完成':''}</summary><ol>{commands.map((command,index)=><li key={command.id||index}><div className="wb-hub-command-title"><strong>{command.label&&command.label!==command.operation?command.label:'工具调用'}</strong><span>{status(command)}</span></div>{command.operation&&<code>{command.operation}</code>}{command.resultText&&<pre className="wb-hub-tool-output">{command.resultText}</pre>}</li>)}</ol></details>
}
export const ASSISTANT_TOOL_ACTIVITY_CSS=`
.wb-hub-tools{min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary)}.wb-hub-tools>summary{cursor:pointer;width:fit-content;max-width:100%;line-height:1.7;padding:3px 0}.wb-hub-tools>ol{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}.wb-hub-tools li{min-width:0;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}.wb-hub-tools code{display:block;margin-top:5px;overflow-wrap:anywhere;font-size:11px}.wb-hub-tool-output{max-width:100%;max-height:280px;overflow:auto;margin:8px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.7 ui-monospace,monospace;color:var(--dsw-alias-label-primary)}
`
