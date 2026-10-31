import * as React from 'react'
import {Btn, Textarea} from '../../core/runtime.js'
import {normalizeLaunchCommands, type LaunchCommand} from '../../../shared/developer-tools.js'

const executables=['npm','pnpm','yarn','bun','node','python','python3','java','mvn','./mvnw','mvnw','gradle','./gradlew','gradlew','dotnet','go','cargo']
export function LaunchConfigEditor({commands,configured,onSave,onCancel,busy}:{commands:LaunchCommand[];configured:LaunchCommand[];onSave:(rows:LaunchCommand[])=>Promise<void>;onCancel:()=>void;busy:boolean}) {
    const [rows,setRows]=React.useState(()=>configured.map(row=>({...row,common:row.common!==false,args:row.argv.slice(1).join('\n')})))
    const [error,setError]=React.useState('')
    function update(index:number,patch:any){setRows(previous=>previous.map((row,i)=>i===index?{...row,...patch}:row))}
    function add(command?:LaunchCommand){setRows(previous=>previous.concat({...command,id:command?.id||'custom-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),name:command?.name||'',argv:command?.argv||['npm'],args:command?.argv.slice(1).join('\n')||'',common:command?.common!==false}))}
    return <form className="wb-stack" aria-label="项目启动配置" onSubmit={async event=>{
        event.preventDefault();setError('')
        try{await onSave(normalizeLaunchCommands(rows.map(row=>({...row,argv:[row.argv[0],...(row.args===row.argv.slice(1).join('\n')?row.argv.slice(1):row.args.split('\n').filter(arg=>arg.trim().length>0))]}))))}catch(e){setError(e.message)}
    }}>
        {rows.map((row,index)=><fieldset key={row.id} disabled={busy} style={{minWidth:0,border:'1px solid var(--dsw-alias-border-l1)',borderRadius:8,padding:12}}>
            <legend>启动项 {index+1}</legend>
            <div className="wb-stack" style={{gap:8}}>
                <label className="wb-label">名称<input className="wb-input" aria-label={'启动项名称 '+(index+1)} required maxLength={100} value={row.name} onChange={e=>update(index,{name:e.target.value})}/></label>
                <label className="wb-label">执行程序<select className="wb-select" aria-label={'执行程序 '+(index+1)} value={row.argv[0]} onChange={e=>update(index,{argv:[e.target.value,...row.argv.slice(1)]})}>{executables.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
                <label className="wb-label">参数<Textarea aria-label={'启动参数 '+(index+1)} rows={3} value={row.args} onChange={(e:any)=>update(index,{args:e.target.value})}/></label>
                <span className="wb-tiny wb-muted">每行一个参数；带空格的参数无需加引号。</span>
                <label className="wb-label">本机服务地址（可选）<input className="wb-input" aria-label={'服务地址 '+(index+1)} placeholder="http://localhost:3000/" value={row.serviceUrl||''} onChange={e=>update(index,{serviceUrl:e.target.value})}/></label>
                <div className="wb-row wb-row--wrap" style={{gap:12}}><label><input type="checkbox" checked={row.common!==false} onChange={e=>update(index,{common:e.target.checked})}/> 常用启动项</label><Btn size="sm" onClick={()=>setRows(previous=>previous.filter((_,i)=>i!==index))}>移除启动项 {index+1}</Btn></div>
            </div>
        </fieldset>)}
        <div className="wb-row wb-row--wrap" style={{gap:8}}>
            <Btn disabled={busy||rows.length>=20} onClick={()=>add()}>添加启动项</Btn>
            <select className="wb-select" style={{width:'auto',maxWidth:'100%'}} aria-label="从项目脚本添加" value="" disabled={busy||rows.length>=20} onChange={e=>{const command=commands.find(row=>row.id===e.target.value);if(command)add(command)}}><option value="">从项目脚本添加…</option>{commands.filter(command=>!rows.some(row=>row.id===command.id)).map(command=><option key={command.id} value={command.id}>{command.name}</option>)}</select>
        </div>
        {error&&<p role="alert" className="wb-tiny">{error}</p>}
        <div className="wb-row" style={{justifyContent:'flex-end',gap:8}}><Btn disabled={busy} onClick={onCancel}>取消</Btn><button type="submit" className="wb-btn wb-btn--primary" disabled={busy}>保存启动配置</button></div>
    </form>
}
