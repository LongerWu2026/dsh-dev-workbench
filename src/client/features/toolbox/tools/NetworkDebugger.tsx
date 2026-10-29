import * as React from 'react'
import {WB,Btn,Field,Input,Textarea} from '../../../core/runtime.js'
import {toolCopyButton as Copy} from '../shared-controls.js'
function NetworkDebugger({value:v,patch,mode}:{value:any;patch:(value:any)=>void;mode:'http'|'mcp'}) {
    const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('')
    const live=React.useRef(true),request=React.useRef(''),connection=React.useRef(''),pending=React.useRef<Promise<any>|null>(null)
    const rpc=(method:string,data:any)=>WB.rpc('workbench/'+method,{request:data})
    React.useEffect(()=>{live.current=true;return()=>{
        live.current=false
        void (async()=>{if(request.current)await rpc('debugCancel',{requestId:request.current}).catch(()=>{});await pending.current?.catch(()=>{});if(connection.current)await rpc('mcpDisconnect',{connectionId:connection.current}).catch(()=>{})})()
    }},[])
    async function send(method:string,data:any) {
        if(busy)return
        const id='debug-'+Date.now()+'-'+Math.random().toString(36).slice(2)
        request.current=id;setBusy(true);setError('');patch({result:null})
        try{
            const operation=rpc(method,{...data,requestId:id,timeoutMs:Number(v.timeoutMs)||30000});pending.current=operation
            const result=await operation
            if(result.connectionId){connection.current=result.connectionId}
            if(live.current)patch({result,...(result.connectionId?{connectionId:result.connectionId,tools:result.tools||[],toolName:result.tools?.[0]?.name||''}:{})})
        }catch(e){if(live.current)setError((e as Error).message)}finally{request.current='';pending.current=null;if(live.current)setBusy(false)}
    }
    const locked=busy||!!connection.current
    const tools=v.tools||[],selected=tools.find((t:any)=>t.name===v.toolName)
    const formatted=v.result?JSON.stringify(v.result,null,2):''
    return <div className="wb-stack">
        <p className="wb-tiny wb-muted">请求由宿主发送到你填写的地址。请求头、正文和响应不写入工作台数据文件；刷新会清空页面输入。{mode==='mcp'?'支持 Streamable HTTP；工具调用会真实执行服务端工具。':''}</p>
        <Field label={mode==='http'?'请求地址':'MCP 服务地址'}><Input aria-label={mode==='http'?'接口请求地址':'MCP 服务地址'} value={v.url||''} disabled={locked} placeholder={mode==='http'?'http://localhost:8080/api/health':'http://localhost:3000/mcp'} onChange={(e:any)=>patch({url:e.target.value})}/></Field>
        {mode==='http'?<label className="wb-label">HTTP 方法 <select className="wb-select" aria-label="HTTP 方法" value={v.method||'GET'} disabled={busy} onChange={e=>patch({method:e.target.value})}>{['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map(m=><option key={m}>{m}</option>)}</select></label>:<label className="wb-label">MCP 协议版本 <select className="wb-select" aria-label="MCP 协议版本" disabled={locked} value={v.version||'2025-11-25'} onChange={e=>patch({version:e.target.value})}>{['2025-11-25','2025-06-18','2025-03-26','2026-07-28'].map(version=><option key={version}>{version}</option>)}</select></label>}
        <Field label="请求头（JSON）"><Textarea aria-label="调试请求头" rows={3} value={v.headers??'{}'} disabled={locked} onChange={(e:any)=>patch({headers:e.target.value})}/></Field>
        <label className="wb-label">超时（毫秒，1000–60000）<Input type="number" aria-label="调试超时" min={1000} max={60000} disabled={busy} value={v.timeoutMs??30000} onChange={(e:any)=>patch({timeoutMs:e.target.value})}/></label>
        {mode==='http'&&<Field label="请求正文"><Textarea aria-label="接口请求正文" rows={5} disabled={busy} value={v.body||''} onChange={(e:any)=>patch({body:e.target.value})}/></Field>}
        <div className="wb-row wb-row--wrap" style={{gap:8}}>
            {mode==='http'?<Btn kind="primary" disabled={busy||!v.url} onClick={()=>send('httpDebug',{url:v.url,method:v.method||'GET',headers:v.headers,body:v.body})}>{busy?'请求中…':'发送请求'}</Btn>:<>
                <Btn kind="primary" disabled={locked||!v.url} onClick={()=>send('mcpConnect',{url:v.url,headers:v.headers,version:v.version||'2025-11-25'})}>{busy&&!connection.current?'连接中…':'连接并发现工具'}</Btn>
                <Btn disabled={busy||!connection.current} onClick={async()=>{setBusy(true);setError('');try{const r=await rpc('mcpDisconnect',{connectionId:connection.current});connection.current='';patch({connectionId:null,tools:[],toolName:''});if(r.note)setError(r.note)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>断开连接</Btn>
            </>}
            {busy&&<Btn onClick={()=>rpc('debugCancel',{requestId:request.current}).catch((e:Error)=>setError(e.message))}>停止请求</Btn>}
        </div>
        {mode==='mcp'&&connection.current&&<>
            <label className="wb-label">服务端工具 <select className="wb-select" aria-label="MCP 工具" value={v.toolName||''} disabled={busy} onChange={e=>patch({toolName:e.target.value,arguments:'{}'})}>{!tools.length&&<option value="">服务端未提供工具</option>}{tools.map((t:any)=><option key={t.name} value={t.name}>{t.name}</option>)}</select></label>
            {selected&&<><p className="wb-tiny">{selected.description}</p><details><summary>工具参数定义</summary><pre className="wb-code" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(selected.inputSchema,null,2)}</pre></details></>}
            <Field label="工具参数（JSON 对象）"><Textarea aria-label="MCP 工具参数" rows={5} disabled={busy} value={v.arguments??'{}'} onChange={(e:any)=>patch({arguments:e.target.value})}/></Field>
            <Btn kind="primary" disabled={busy||!selected} onClick={()=>send('mcpCall',{connectionId:connection.current,name:v.toolName,arguments:v.arguments||'{}'})}>调用所选工具</Btn>
        </>}
        {error&&<p className="wb-tiny" role="alert" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{error}</p>}
        {v.result&&<><div className="wb-row wb-row--wrap" style={{gap:8}}><strong className="wb-tiny">{mode==='http'?'HTTP '+v.result.status:'MCP 返回'} · {v.result.durationMs} ms {v.result.result?.isError?' · 工具返回错误':''}</strong><Copy text={formatted}/></div><pre className="wb-code" aria-label="调试响应" style={{maxHeight:480,overflow:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{formatted}</pre>{v.result.truncated&&<p className="wb-tiny wb-muted">响应超过1MB，展示已截断。</p>}</>}
    </div>
}
export function HttpDebugger(props:any){return <NetworkDebugger {...props} mode="http"/>}
export function McpDebugger(props:any){return <NetworkDebugger {...props} mode="mcp"/>}
