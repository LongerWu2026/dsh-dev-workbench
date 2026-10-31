import * as React from 'react'
import {WB,Panel,Btn,useStore} from '../../core/runtime.js'
import {LaunchConfigEditor} from './LaunchConfigEditor.js'
import type {LaunchCommand} from '../../../shared/developer-tools.js'

export function ProjectLauncher({projectId='',refreshVersion=0}:{projectId?:string;refreshVersion?:number}){
    const store=useStore(),selected=store.data?.projects?.find((p:any)=>p.id===projectId)
    const [runtime,setRuntime]=React.useState<any>(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[editing,setEditing]=React.useState(false)
    const request=React.useRef(0),mounted=React.useRef(true),acting=React.useRef(false)
    const rpc=(name:string,args:any)=>WB.rpc('workbench/'+name,{request:args})
    React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current++}},[])
    async function refresh(force=false){
        const version=++request.current
        try{const value=await rpc('projectRuntime',{projectId,...(force?{force:true}:{})});if(mounted.current&&version===request.current){setRuntime(value);setError('')}}catch(e){if(mounted.current&&version===request.current)setError(e.message)}
    }
    React.useEffect(()=>{if(projectId)void refresh(refreshVersion>0)},[projectId,refreshVersion])
    async function action(method:string,args:any){
        if(acting.current)return
        acting.current=true;setBusy(true);setError('');if(method!=='projectOpen')++request.current
        try{
            await rpc(method,args)
            if(!mounted.current)return
            if(method==='projectOpen')WB.toast('已请求打开应用','ok');else await refresh(true)
        }catch(e){if(mounted.current)setError(e.message)}finally{acting.current=false;if(mounted.current)setBusy(false)}
    }
    const active=runtime?.runs?.some((r:any)=>['running','stopping'].includes(r.status))
    React.useEffect(()=>{
        if(!active)return
        let live=true,timer:ReturnType<typeof setTimeout>
        const poll=async()=>{if(!acting.current&&document.visibilityState!=='hidden')await refresh();if(live)timer=setTimeout(poll,1500)}
        timer=setTimeout(poll,1500)
        return()=>{live=false;clearTimeout(timer)}
    },[active,projectId])
    async function save(commands:LaunchCommand[]){
        if(acting.current)return
        acting.current=true;setBusy(true)
        try{
            const latest=WB.store.get().data?.projects?.find((p:any)=>p.id===projectId)
            if(!latest)throw Error('项目已不存在，请重新选择')
            await WB.actions.saveProject({id:latest.id,repoPath:latest.repoPath,launchCommands:commands})
            if(mounted.current){setEditing(false);await refresh(true)}
        }finally{acting.current=false;if(mounted.current)setBusy(false)}
    }
    const commands:LaunchCommand[]=runtime?.commands||[]
    const marked=commands.filter(c=>c.common===true)
    const common=marked.length?marked:commands.filter(c=>c.common!==false&&/^(dev|start|serve)$/.test(c.argv[c.argv.length-1]||'')).slice(0,3)
    const primary=common.length?common:commands.filter(c=>c.common!==false).slice(0,3)
    function startButton(command:LaunchCommand){return <Btn key={command.id} disabled={busy||runtime?.runs?.some((r:any)=>['running','stopping'].includes(r.status)&&JSON.stringify(r.argv)===JSON.stringify(command.argv))} title={JSON.stringify(command.argv)} onClick={()=>action('projectStart',{projectId,commandId:command.id})}>启动 {command.name}</Btn>}
    return <Panel title="项目启动与运行" icon="play" sub={runtime?.at?'更新于 '+WB.fmt.relative(runtime.at):undefined}>
        <div className="wb-stack">
            {!selected?<p className="wb-tiny wb-muted">先用“添加仓库目录”登记项目。</p>:<>
                <div className="wb-row wb-row--wrap" style={{gap:8}}>
                    {([['vscode','打开 VS Code'],['idea','打开 IDEA'],['terminal','打开终端']] as const).map(([target,title])=><Btn key={target} disabled={busy} onClick={()=>action('projectOpen',{projectId,target})}>{title}</Btn>)}
                    <Btn disabled={busy} onClick={()=>setEditing(!editing)}>启动配置</Btn>
                    <Btn disabled={busy} onClick={()=>refresh(true)}>刷新运行状态</Btn>
                </div>
                {editing&&<LaunchConfigEditor configured={selected.launchCommands||[]} commands={commands} busy={busy} onSave={save} onCancel={()=>setEditing(false)}/>}
                <div className="wb-row wb-row--wrap" style={{gap:8}}>{primary.map(startButton)}</div>
                {commands.length>primary.length&&<details><summary className="wb-tiny" style={{cursor:'pointer'}}>其他启动项（{commands.length-primary.length}）</summary><div className="wb-row wb-row--wrap" style={{gap:8,paddingTop:8}}>{commands.filter(c=>!primary.includes(c)).map(startButton)}</div></details>}
                {runtime&&!commands.length&&<p className="wb-tiny wb-muted">未发现可用脚本，可在“启动配置”中添加。</p>}
                {(runtime?.runs||[]).map((run:any)=>{
                    const service=run.service,status=run.status==='running'&&service?.status==='checking'?'启动中':({running:'进程运行',stopping:'停止中',completed:'已完成',failed:'启动或运行失败',stopped:'已停止'} as any)[run.status]||run.status
                    return <details key={run.id} open={['running','stopping','failed'].includes(run.status)} className="wb-reply-item">
                        <summary>{run.name} · {status}{run.exitCode!==undefined?' · 退出码 '+run.exitCode:''}</summary>
                        {run.status==='running'&&<p className="wb-tiny" role="status">{service?.status==='reachable'?'服务地址可访问':service?.status==='unreachable'?'服务未就绪，进程仍在运行':service?.status==='checking'?'正在检测服务地址…':'未配置服务地址，尚未检测就绪状态'}{service?.httpStatus?' · HTTP '+service.httpStatus:''}</p>}
                        <div className="wb-row wb-row--wrap" style={{gap:8}}>{run.status==='running'&&<Btn disabled={busy} onClick={()=>action('projectStop',{runId:run.id})}>停止本次运行</Btn>}{run.status==='running'&&service?.status==='reachable'&&<a className="wb-btn wb-btn--ghost" href={service.url} target="_blank" rel="noreferrer">打开服务</a>}</div>
                        <p className="wb-tiny wb-mono" style={{overflowWrap:'anywhere'}}>{JSON.stringify(run.argv)} · {WB.fmt.datetime(run.startedAt)}</p>
                        {run.error&&<p role="alert">{run.error}</p>}
                        <strong className="wb-tiny">标准输出</strong><pre className="wb-code" style={{maxHeight:240,overflow:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{run.stdout||'暂无输出'}</pre>
                        {run.stderr&&<><strong className="wb-tiny">标准错误</strong><pre className="wb-code" style={{maxHeight:180,overflow:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{run.stderr}</pre></>}
                        {run.truncated&&<p className="wb-tiny wb-muted">日志缓冲已截断，仅展示保留的部分。</p>}
                    </details>
                })}
            </>}
            {error&&<p role="alert" className="wb-tiny">{error}</p>}
        </div>
    </Panel>
}
