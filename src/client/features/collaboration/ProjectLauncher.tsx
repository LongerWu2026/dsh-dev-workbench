import * as React from 'react'
import {WB,Panel,Btn,Textarea,useStore} from '../../core/runtime.js'
export function ProjectLauncher(){
    const store=useStore(),projects=store.data?.projects||[]
    const [projectId,setProjectId]=React.useState(''),[runtime,setRuntime]=React.useState<any>(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[config,setConfig]=React.useState('[]'),[editing,setEditing]=React.useState(false)
    const selected=projects.find((p:any)=>p.id===projectId)
    const rpc=(name:string,request:any)=>WB.rpc('workbench/'+name,{request})
    React.useEffect(()=>{if(!projects.some((p:any)=>p.id===projectId))setProjectId(projects[0]?.id||'')},[projects,projectId])
    React.useEffect(()=>{
        let live=true
        setRuntime(null);setError('');setEditing(false);setConfig(JSON.stringify(selected?.launchCommands||[],null,2))
        const refresh=async()=>{
            if(!projectId)return
            try{const value=await rpc('projectRuntime',{projectId});if(live){setRuntime(value);setError('')}}catch(e){if(live)setError(String((e as Error).message))}
        }
        void refresh();return()=>{live=false}
    },[projectId,selected?.repoPath])
    async function action(method:string,request:any){
        setBusy(true);setError('')
        try{const result=await rpc(method,request);if(method==='projectOpen')WB.toast('已请求打开应用','ok');else setRuntime(method==='projectRuntime'?result:await rpc('projectRuntime',{projectId}))}catch(e){setError((e as Error).message)}finally{setBusy(false)}
    }
    // Start polling after an explicit launch, and stop as soon as all owned runs finish.
    const active=runtime?.runs?.some((r:any)=>['running','stopping'].includes(r.status))
    React.useEffect(()=>{
        if(!active)return
        let live=true,timer:ReturnType<typeof setTimeout>
        const poll=async()=>{try{const value=await rpc('projectRuntime',{projectId});if(live)setRuntime(value)}catch(e){if(live)setError((e as Error).message)}finally{if(live)timer=setTimeout(poll,1500)}}
        timer=setTimeout(poll,1500)
        return()=>{live=false;clearTimeout(timer)}
    },[active,projectId])
    return <Panel title="项目启动与运行" icon="play" sub="按项目打开开发软件、执行启动配置并查看运行日志。">
        <div className="wb-stack">
            {!projects.length?<p className="wb-tiny wb-muted">先用“添加仓库目录”登记项目。</p>:<>
                <label className="wb-label">运行项目 <select className="wb-select" aria-label="运行项目" value={projectId} disabled={busy} onChange={e=>setProjectId(e.target.value)}>{projects.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                <p className="wb-tiny wb-muted" style={{overflowWrap:'anywhere'}}>{runtime?.cwd||selected?.repoPath}</p>
                <div className="wb-row wb-row--wrap" style={{gap:8}}>
                    {([['vscode','打开 VS Code'],['idea','打开 IDEA'],['terminal','打开终端']] as const).map(([target,title])=><Btn key={target} disabled={busy||!projectId} onClick={()=>action('projectOpen',{projectId,target})}>{title}</Btn>)}
                    <Btn disabled={busy} onClick={()=>setEditing(!editing)}>启动配置</Btn>
                    <Btn disabled={busy} onClick={()=>action('projectRuntime',{projectId})}>刷新运行状态</Btn>
                </div>
                {editing&&<div className="wb-stack"><p className="wb-tiny wb-muted">自动发现 package.json scripts、Maven 和 Gradle。额外命令使用 JSON 数组，例如 {JSON.stringify([{id:'backend',name:'后端服务',argv:['./mvnw','spring-boot:run']}])}。命令在项目目录执行。</p><Textarea aria-label="项目启动配置" rows={6} value={config} onChange={(e:any)=>setConfig(e.target.value)}/><Btn disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await WB.actions.saveProject({...selected,launchCommands:JSON.parse(config)});setRuntime(await rpc('projectRuntime',{projectId}));setEditing(false)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>保存启动配置</Btn></div>}
                <div className="wb-row wb-row--wrap" style={{gap:8}}>{(runtime?.commands||[]).map((command:any)=><Btn key={command.id} disabled={busy||runtime?.runs?.some((r:any)=>['running','stopping'].includes(r.status)&&JSON.stringify(r.argv)===JSON.stringify(command.argv))} title={JSON.stringify(command.argv)} onClick={()=>action('projectStart',{projectId,commandId:command.id})}>启动 {command.name}</Btn>)}</div>
                {runtime&&!(runtime.commands||[]).length&&<p className="wb-tiny wb-muted">未发现可用脚本，可在“启动配置”中添加。</p>}
                {(runtime?.runs||[]).map((run:any)=><details key={run.id} open={['running','stopping','failed'].includes(run.status)} className="wb-reply-item"><summary>{run.name} · {({running:'运行中',stopping:'停止中',completed:'已完成',failed:'失败',stopped:'已停止'} as any)[run.status]||run.status}{run.exitCode!==undefined?' · 退出码 '+run.exitCode:''}</summary><p className="wb-tiny wb-mono" style={{overflowWrap:'anywhere'}}>{JSON.stringify(run.argv)} · {run.startedAt}</p>{run.status==='running'&&<Btn disabled={busy} onClick={()=>action('projectStop',{runId:run.id})}>停止本次运行</Btn>}{run.error&&<p role="alert">{run.error}</p>}<strong className="wb-tiny">标准输出</strong><pre className="wb-code" style={{maxHeight:240,overflow:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{run.stdout||'暂无输出'}</pre>{run.stderr&&<><strong className="wb-tiny">标准错误</strong><pre className="wb-code" style={{maxHeight:180,overflow:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{run.stderr}</pre></>}{run.truncated&&<p className="wb-tiny wb-muted">日志缓冲已截断，仅展示保留的部分。</p>}</details>)}
            </>}
            {error&&<p role="alert" className="wb-tiny">{error}</p>}
        </div>
    </Panel>
}
