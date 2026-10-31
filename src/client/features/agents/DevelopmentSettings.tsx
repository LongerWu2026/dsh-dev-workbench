import * as React from 'react'
import {Btn,Field,Input,Modal,Select,Textarea} from '../../core/runtime.js'
import {commandArgs,commandText} from './development-ui.js'
export function DevelopmentSettings({config,connection,adapter,projects,projectId:initialProject,onClose,onSave,disabled}:{config:any;connection:any;adapter:any;projects:any[];projectId:string;onClose:()=>void;onSave:(patch:any)=>Promise<void>;disabled:boolean}){
    const [draft,setDraft]=React.useState({...config}),[projectId,setProjectId]=React.useState(initialProject),[checks,setChecks]=React.useState<string>((config.checks?.[initialProject]||[]).map(commandText).join('\n'))
    const [command,setCommand]=React.useState(commandText(config.harnessCommand||[])),[roots,setRoots]=React.useState<string>((config.adapterRoots||[]).join('\n')),[error,setError]=React.useState('')
    async function save(){setError('');try{const nextChecks={...draft.checks};if(projectId)nextChecks[projectId]=checks.split('\n').filter(s=>s.trim()).map(commandArgs);await onSave({...draft,checks:nextChecks,harnessCommand:commandArgs(command),adapterRoots:roots.split('\n').map(s=>s.trim()).filter(Boolean)});onClose()}catch(e:any){setError(e.message||String(e))}}
    return <Modal open title="研发设置" sub="常用配置自动识别；工程验证命令只在对应工作区运行。" onClose={disabled?()=>{}:onClose} footer={<><Btn disabled={disabled} onClick={onClose}>取消</Btn><Btn kind="primary" disabled={disabled} onClick={()=>void save()}>保存设置</Btn></>}>
        <div className="wb-dev-form">{error&&<p role="alert">{error}</p>}
            <div><strong>Linky · {connection?.status==='ready'?'已连接 '+(connection.user?.name||''):'待连接'}</strong><p className="wb-dev-meta">自动复用本机安装和客户端登录。更换账号后可重新检测。</p></div>
            <Field label="本地工程"><Select aria-label="验证工程" value={projectId} options={[{value:'',label:'选择工程'},...projects.map(p=>({value:p.id,label:p.name}))]} onChange={(e:any)=>{setProjectId(e.target.value);setChecks((draft.checks?.[e.target.value]||[]).map(commandText).join('\n'))}}/></Field>
            <Field label="测试命令" hint="每行一个命令，例如 pnpm test；支持带引号的参数。"><Textarea aria-label="工程测试命令" disabled={!projectId} value={checks} onChange={(e:any)=>setChecks(e.target.value)} rows={3}/></Field>
            <Field label="独立工作区位置"><Input aria-label="独立工作区根目录" value={draft.worktreeRoot||''} onChange={(e:any)=>setDraft({...draft,worktreeRoot:e.target.value})}/></Field>
            <details className="wb-dev-advanced"><summary>高级连接设置</summary><div className="wb-dev-form">
                <Field label="Linky CLI 路径"><Input aria-label="Linky CLI 路径" value={draft.cliPath||''} onChange={(e:any)=>setDraft({...draft,cliPath:e.target.value})}/></Field>
                {connection?.cliPaths?.filter((p:string)=>p!==draft.cliPath).map((p:string)=><div key={p} className="wb-stack"><span className="wb-dev-meta">{p}</span><Btn onClick={()=>setDraft({...draft,cliPath:p})}>使用此安装</Btn></div>)}
                <Field label="登录配置（Profile）"><Input aria-label="登录 Profile" list="dev-linky-profiles" value={draft.profile||''} onChange={(e:any)=>setDraft({...draft,profile:e.target.value,workspaceId:'',agentId:''})}/><datalist id="dev-linky-profiles">{connection?.profiles?.map((p:string)=><option key={p} value={p}/>)}</datalist></Field>
            </div></details>
            <details className="wb-dev-advanced"><summary>从 Linky 发起任务（CLI 适配）</summary><div className="wb-dev-form"><p className="wb-dev-meta">实际由 Harness 执行，无需安装 Codex。此处用于 Linky 端发起任务；本页创建任务无需配置。</p>
                <Field label="Harness 启动命令"><Input aria-label="Harness 启动参数" value={command} onChange={(e:any)=>setCommand(e.target.value)}/></Field>
                <Field label="模型"><Input aria-label="适配模型" value={draft.model} onChange={(e:any)=>setDraft({...draft,model:e.target.value})}/></Field>
                <Field label="允许的工作区根目录" hint="每行一个绝对路径。"><Textarea aria-label="允许的 Linky 工作区根目录" rows={2} value={roots} onChange={(e:any)=>setRoots(e.target.value)}/></Field>
                <Field label="任务权限"><Select aria-label="Linky 任务权限" value={draft.adapterPermissionMode||'read-only'} options={[{value:'read-only',label:'只读验证'},{value:'workspace-write',label:'允许在工作区开发'}]} onChange={(e:any)=>setDraft({...draft,adapterPermissionMode:e.target.value})}/></Field>
                <p className="wb-dev-meta">{adapter?.installed?'适配器已就绪':'适配器尚未构建'}。保存后在启动 Linky 的终端设置以下变量。工作台不会自动订阅全部工作空间。</p>
                {adapter&&<pre>{`export LINKY_CODEX_PATH='${String(adapter.path).replace(/'/g,"'\\''")}'\nexport HARNESS_LINKY_CONFIG='${String(adapter.configPath).replace(/'/g,"'\\''")}'`}</pre>}
            </div></details>
        </div>
    </Modal>
}
