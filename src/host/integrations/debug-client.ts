import {randomUUID} from 'node:crypto'
import {debugHeaders,debugUrl} from '../../shared/developer-tools.js'
const active=new Map<string,AbortController>()
type Session={url:string;headers:Record<string,string>;version:string;sessionId?:string;busy:boolean;at:number;tools:any[]}
const sessions=new Map<string,Session>()
const LIMIT=1024*1024
function headerValue(value:string){return /^[\x20-\x7e]*$/.test(value)&&value.trim()===value&&!(value.startsWith('=?base64?')&&value.endsWith('?='))?value:'=?base64?'+Buffer.from(value).toString('base64')+'?='}
function parameterHeaders(schema:any,args:any):Record<string,string>{
    const headers:Record<string,string>={},seen=new Set<string>()
    function visit(node:any,value:any,property=false){
        if(!node||typeof node!=='object')return
        if(node['x-mcp-header']!==undefined){
            const name=node['x-mcp-header']
            if(!property||typeof name!=='string'||!name||!/^[!#$%&'*+.^_`|~\w-]+$/.test(name)||seen.has(name.toLowerCase())||!['integer','string','boolean'].includes(node.type))throw new Error('工具包含无效x-mcp-header定义')
            seen.add(name.toLowerCase())
            if(value!==null&&value!==undefined){if(typeof value!==node.type&&!(node.type==='integer'&&Number.isSafeInteger(value)))throw new Error('工具头参数类型无效：'+name);headers['Mcp-Param-'+name]=headerValue(String(value))}
        }
        for(const [key,child] of Object.entries(node)){
            if(key==='properties'&&child&&typeof child==='object')for(const [name,part] of Object.entries(child))visit(part,value?.[name],property||node===schema)
            else if(child&&typeof child==='object'){
                // An annotation under arrays, composition or references cannot be mirrored reliably.
                if(JSON.stringify(child).includes('"x-mcp-header"'))throw new Error('工具头参数必须位于静态properties路径')
            }
        }
    }
    visit(schema,args)
    return headers
}
async function responseBody(response:Response,id?:number):Promise<{text:string;message?:any;events?:any[];truncated:boolean}> {
    const reader=response.body?.getReader(),decoder=new TextDecoder(),sse=response.headers.get('content-type')?.includes('text/event-stream')&&id!==undefined
    let text='',buffer='',bytes=0;const events:any[]=[]
    if(!reader)return {text,truncated:false}
    try {while(true){
        const next=await reader.read();if(next.done)break
        bytes+=next.value.length
        if(bytes>LIMIT){if(id!==undefined)throw new Error('MCP响应超过1MB');text+=decoder.decode(next.value.subarray(0,Math.max(0,LIMIT-(bytes-next.value.length))),{stream:true});return {text,truncated:true}}
        const part=decoder.decode(next.value,{stream:true});text+=part
        if(sse){
            buffer=(buffer+part).replace(/\r\n/g,'\n')
            let boundary:number
            while((boundary=buffer.indexOf('\n\n'))>=0){
                const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2)
                const data=frame.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n')
                if(!data)continue
                const message=JSON.parse(data);if(events.length<100)events.push(message)
                if(message.id===id)return {text,message,events,truncated:false}
                if(message.method&&message.id!==undefined)throw new Error('服务端请求交互尚不支持：'+message.method)
            }
        }
    }}finally{await reader.cancel().catch(()=>{})}
    text+=decoder.decode()
    if(sse)throw new Error('SSE已结束，但未收到匹配的MCP响应')
    return {text,truncated:false}
}
async function operation(request:any,callback:(signal:AbortSignal)=>Promise<any>) {
    const id=String(request?.requestId||'')
    if(!/^[\w-]{1,100}$/.test(id))throw new Error('调试请求ID无效')
    if(active.has(id)||active.size>=6)throw new Error('已有请求执行中，请等待或停止')
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(1000,Math.min(60000,Number(request.timeoutMs)||30000)))
    active.set(id,controller)
    try{return await callback(controller.signal)}catch(error){if(controller.signal.aborted)throw new Error('请求已停止或超时；目标端可能已执行，请核对结果');throw error}finally{clearTimeout(timer);if(active.get(id)===controller)active.delete(id)}
}
export function cancelDebugRequest(requestId:string){active.get(requestId)?.abort();return {status:'cancelled'}}
export async function sendHttpRequest(request:any) {
    const url=debugUrl(request.url),method=String(request.method||'GET').toUpperCase(),headers=debugHeaders(request.headers)
    if(!['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(method))throw new Error('不支持的HTTP方法')
    const body=String(request.body||'')
    if(Buffer.byteLength(body)>512*1024)throw new Error('请求正文超过512KB')
    if(['GET','HEAD'].includes(method)&&body)throw new Error('GET/HEAD请求不能带正文')
    return operation(request,async signal=>{
        const start=Date.now(),response=await fetch(url,{method,headers,body:body||undefined,signal,redirect:'manual'})
        const result=await responseBody(response)
        return {...result,status:response.status,statusText:response.statusText,headers:Object.fromEntries(response.headers),durationMs:Date.now()-start}
    })
}
let sequence=0
async function mcpRpc(session:Session,method:string,params:any,signal:AbortSignal,notification=false) {
    const id=++sequence,modern=session.version==='2026-07-28'
    if(modern)params={...params,_meta:{'io.modelcontextprotocol/protocolVersion':session.version,'io.modelcontextprotocol/clientInfo':{name:'dsh-dev-workbench-debugger',version:'0.2.0'},'io.modelcontextprotocol/clientCapabilities':{}}}
    const headers=new Headers(session.headers)
    headers.set('Content-Type','application/json');headers.set('Accept','application/json, text/event-stream')
    headers.set('MCP-Protocol-Version',session.version)
    if(modern){
        headers.set('Mcp-Method',method)
        if(params.name)headers.set('Mcp-Name',headerValue(params.name))
        if(method==='tools/call')for(const [name,value] of Object.entries(parameterHeaders(session.tools.find(tool=>tool.name===params.name)?.inputSchema,params.arguments)))headers.set(name,value)
    }
    if(session.sessionId&&!modern)headers.set('Mcp-Session-Id',session.sessionId)
    try {
    const response=await fetch(session.url,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',...(!notification?{id}:{}),method,params}),signal,redirect:'manual'})
    if(notification){await response.body?.cancel();if(!response.ok)throw new Error('MCP通知失败：HTTP '+response.status);return null}
    const result=await responseBody(response,id)
    let packet:any
    try{packet=result.message||JSON.parse(result.text)}catch{throw new Error('MCP响应不是有效JSON，HTTP '+response.status+'：'+result.text.slice(0,300))}
    if(!response.ok)throw new Error('MCP HTTP '+response.status+'：'+String(packet.error?.message||packet.message||result.text).slice(0,500))
    if(packet.id!==id||packet.jsonrpc!=='2.0')throw new Error('MCP响应ID或协议不匹配')
    if(packet.error)throw new Error('MCP '+packet.error.code+'：'+packet.error.message)
    if(!response.ok)throw new Error('MCP HTTP '+response.status)
    if(!('result' in packet))throw new Error('MCP响应缺少result')
    if(method==='initialize'){
        if(!['2025-03-26','2025-06-18','2025-11-25'].includes(packet.result?.protocolVersion))throw new Error('服务端返回未支持的协议版本')
        session.version=packet.result.protocolVersion
        session.sessionId=response.headers.get('mcp-session-id')||undefined
    }
    return {result:packet.result,raw:packet,events:result.events||[]}
    }catch(error){
        if(signal.aborted&&!modern&&method==='tools/call')await mcpRpc(session,'notifications/cancelled',{requestId:id,reason:'用户停止或超时'},AbortSignal.timeout(2000),true).catch(()=>{})
        throw error
    }
}
export async function connectMcp(request:any) {
    for(const [key,row] of sessions)if(Date.now()-row.at>30*60000&&!row.busy)sessions.delete(key)
    if(sessions.size>=12)throw new Error('连接数已满，请先断开不用的连接')
    const version=request.version||'2025-11-25'
    if(!['2025-03-26','2025-06-18','2025-11-25','2026-07-28'].includes(version))throw new Error('不支持的MCP版本')
    const session:Session={url:debugUrl(request.url),headers:debugHeaders(request.headers),version,busy:false,at:Date.now(),tools:[]}
    return operation(request,async signal=>{
        const start=Date.now(),modern=version==='2026-07-28'
        const hello=await mcpRpc(session,modern?'server/discover':'initialize',modern?{}:{protocolVersion:version,capabilities:{},clientInfo:{name:'dsh-dev-workbench-debugger',version:'0.2.0'}},signal)
        if(!hello)throw new Error('MCP连接未返回结果')
        if(!modern)await mcpRpc(session,'notifications/initialized',{},signal,true)
        let cursor:string|undefined;const seen=new Set<string>();let listed:any
        for(let page=0;page<20;page++){
            listed=await mcpRpc(session,'tools/list',cursor?{cursor}:{},signal)
            if(!Array.isArray(listed.result?.tools))throw new Error('tools/list返回格式无效')
            for(const tool of listed.result.tools){
                if(typeof tool?.name!=='string'||!tool.name||tool.name.length>256||!tool.inputSchema||tool.inputSchema.type!=='object'||tool.description!==undefined&&typeof tool.description!=='string')throw new Error('服务端工具定义无效')
                if(modern)parameterHeaders(tool.inputSchema,{})
                if(session.tools.some(t=>t.name===tool.name))throw new Error('服务端工具名称重复')
                session.tools.push(tool)
            }
            if(session.tools.length>500)throw new Error('工具列表超过500项，请使用范围更小的服务入口')
            cursor=listed.result.nextCursor
            if(!cursor)break
            if(seen.has(cursor)||page===19)throw new Error('工具分页未结束或游标重复')
            seen.add(cursor)
        }
        signal.throwIfAborted();if(sessions.size>=12)throw new Error('连接数已满，请先断开不用的连接');const connectionId=randomUUID();sessions.set(connectionId,session)
        return {connectionId,version:session.version,server:hello.result,tools:session.tools,durationMs:Date.now()-start,raw:hello.raw}
    }).catch(async error=>{await releaseSession(session);throw error})
}
export async function callMcp(request:any) {
    const session=sessions.get(request.connectionId)
    if(!session)throw new Error('MCP连接已失效，请重新连接')
    if(session.busy)throw new Error('本连接已有调用在运行')
    if(!session.tools.some(tool=>tool.name===request.name))throw new Error('请选择服务端列出的工具')
    const args=typeof request.arguments==='string'?JSON.parse(request.arguments||'{}'):request.arguments
    if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('工具参数须为JSON对象')
    if(JSON.stringify(args).length>512*1024)throw new Error('工具参数过大')
    session.busy=true;session.at=Date.now()
    try{return await operation(request,async signal=>{const start=Date.now();const result=await mcpRpc(session,'tools/call',{name:request.name,arguments:args},signal);return {...result,durationMs:Date.now()-start}})}finally{session.busy=false}
}
export async function disconnectMcp(connectionId:string) {
    const session=sessions.get(connectionId);if(!session)return {status:'closed'}
    if(session.busy)throw new Error('请先停止当前工具调用再断开')
    sessions.delete(connectionId)
    return releaseSession(session)
}
async function releaseSession(session:Session){
    if(session.sessionId) {
        const headers=new Headers(session.headers);headers.set('Mcp-Session-Id',session.sessionId);headers.set('MCP-Protocol-Version',session.version)
        try{const response=await fetch(session.url,{method:'DELETE',headers,signal:AbortSignal.timeout(5000),redirect:'manual'});await response.body?.cancel();return {status:'closed',remoteStatus:response.status,...(!response.ok&&response.status!==404?{note:'本地已断开，远端会话释放未确认：HTTP '+response.status}:{})}}catch{return {status:'closed',note:'本地已断开，远端会话释放未确认'}}
    }
    return {status:'closed'}
}

export function disposeDebugClients(){for(const controller of active.values())controller.abort();active.clear();for(const session of sessions.values())void releaseSession(session);sessions.clear()}
