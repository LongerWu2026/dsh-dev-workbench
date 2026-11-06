import * as React from 'react'
import {WB,Btn,Field,Input,Textarea,Modal,Icon} from '../../../core/runtime.js'
import {toolCopyButton as Copy} from '../shared-controls.js'
const defaults:any={kind:'mysql',name:'',host:'127.0.0.1',port:3306,database:'',username:'',password:'',rememberPassword:false,tls:false,ca:'',url:'http://127.0.0.1:9200'}
const initialQuery:any={mysql:'SELECT 1 AS value',postgres:'SELECT 1 AS value',es:'{\n  "query": {"match_all": {}},\n  "size": 20\n}',redis:'["TYPE", "example:key"]'}
const connectionKinds:Record<string,string>={mysql:'MySQL',postgres:'PostgreSQL',es:'Elasticsearch',redis:'Redis'}
type ConnectionField = 'name' | 'host' | 'port' | 'url' | 'database' | 'password'

function validateConnection(form:any, isSql:boolean, passwordRequired:boolean): [ConnectionField, string] | undefined {
    if(!String(form.name??'').trim())return ['name','请填写连接名称'];
    if(form.kind==='es'){
        let valid=false;
        try {
            const url=new URL(form.url.trim());
            valid=['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash;
        } catch { /* Show the same error for malformed and unsupported addresses. */ }
        if(!valid)return ['url','请填写不含凭据和参数的 HTTP/HTTPS 地址'];
    }else{
        const host=String(form.host??'').trim(),port=Number(form.port),database=String(form.database??'').trim();
        if(!host||/[\s/@?#]/.test(host))return ['host','请填写有效的数据库主机'];
        if(!Number.isInteger(port)||port<1||port>65535)return ['port','请填写 1–65535 之间的整数端口'];
        if(isSql&&!database)return ['database','请填写数据库名称'];
        if(form.kind==='redis'&&!/^\d{1,3}$/.test(database||'0'))return ['database','Redis DB 必须为 0–999 之间的整数'];
    }
    if(passwordRequired&&!form.password)return ['password','请输入要记住的连接密码'];
}
export function DataWorkbench({value:v,patch}:any){
    const [connections,setConnections]=React.useState<any[]>([]),[operation,setBusy]=React.useState(''),[error,setError]=React.useState(''),[note,setNote]=React.useState('');
    const [disconnecting,setDisconnecting]=React.useState(false);
    const busy=disconnecting?'断开连接':operation;
    const [autoTableSelection,setAutoTableSelection]=React.useState<boolean|null>(null);
    const [canRememberPassword,setCanRememberPassword]=React.useState(false);
    const catalogVersion=React.useRef(0),connectionListVersion=React.useRef(0);
    const live=React.useRef(true),lock=React.useRef(false),current=React.useRef(v);current.current=v;const form={...defaults,...v.form},selected=v.selected||[];
    const rpc=(method:string,request?:any)=>WB.rpc('workbench/'+method,method==='dataConnections'?{}:{request});
    async function refresh(){
        const version=connectionListVersion.current;
        const result=await rpc('dataConnections');
        if(!live.current||version!==connectionListVersion.current)return;
        const items=result.connections||[];
        setConnections(items);
        setAutoTableSelection(result.capabilities?.autoTableSelection===true);
        setCanRememberPassword(result.capabilities?.rememberPassword===true);
        return items;
    }
    React.useEffect(()=>{
        live.current=true;
        void refresh().then(items=>{
            if(!live.current||!items?.length||lock.current)return;
            const {id,objects,pattern}=current.current;
            if(id===undefined)choose(items[0].id,items);
            else if(objects===null&&items.some((c:any)=>c.id===id&&c.unlocked))refreshObjects(id,pattern);
        }).catch((e:Error)=>{if(live.current)setError(e.message)});
        return()=>{live.current=false;catalogVersion.current++};
    },[]);
    async function run(label:string,fn:()=>Promise<any>){if(lock.current)return;lock.current=true;setBusy(label);setError('');setNote('');try{const result=await fn();if(live.current&&result!==null)setNote(result?.note||'操作成功')}catch(e){if(live.current)setError((e as Error).message)}finally{lock.current=false;if(live.current)setBusy('')}}
    async function loadObjects(id:string,pattern:string,cursor='0',savedNote?:string){
        const version=catalogVersion.current;
        const isCurrent=()=>live.current&&version===catalogVersion.current;
        try{
            const r=await rpc('dataObjects',{id,pattern:pattern||'*',cursor});
            if(!isCurrent())return null;
            patch({objects:r.objects,cursor:r.cursor,...(cursor==='0'?{selected:[],structure:null}:{})});
            const note=r.truncated?'对象较多，仅展示前500项':cursor==='0'?'已读取对象':'已扫描下一页，空页也可继续';
            return {note:savedNote?(r.truncated?savedNote+'。'+note:savedNote):note};
        }catch(e){
            if(isCurrent())throw e;
            return null;
        }
    }
    const refreshObjects=(id:string,pattern:string)=>run('读取对象',()=>loadObjects(id,pattern));
    const [invalidField,setInvalidField]=React.useState<ConnectionField|null>(null);
    const configFields=React.useRef<HTMLDivElement>(null);
    function clearFeedback(){setError('');setNote('');setInvalidField(null)}
    const edit=(key:string,value:any)=>{clearFeedback();patch({id:v.id??'',form:{...form,[key]:value}})};
    const choose=(id:string,items=connections)=>{
        const c=items.find(c=>c.id===id);
        setObjectFilter('');
        clearFeedback();
        patch({id,form:c?{...c,password:''}:{...defaults},selected:[],objects:null,cursor:null,structure:null,result:null,generated:null,query:initialQuery[c?.kind||'mysql']});
        if(c?.unlocked)void refreshObjects(id,v.pattern);
    };
    const needsConnection=!v.id||!connections.some(c=>c.id===v.id&&c.unlocked);
    const objectKey=(o:any)=>JSON.stringify([o.schemaName||'',o.name]);
    const result=v.result;
    const isSql=form.kind==='mysql'||form.kind==='postgres';
    const generationMode=isSql&&v.mode==='script'?'script':'query';
    const generationScopeHint=!v.id?'请先选择连接。':selected.length?`基于所选 ${selected.length} 个对象生成`
        :!isSql?'请勾选需要的索引或 Key。'
        :autoTableSelection===null?'正在检查自动选表支持…'
        :autoTableSelection?'未勾选表，将根据需求从当前库自动找表。':'当前宿主尚未加载自动选表，请退出并重新打开 DeepSeek Harness。';
    const [configOpen,setConfigOpen]=React.useState(false),[aiOpen,setAiOpen]=React.useState(false),[objectFilter,setObjectFilter]=React.useState('');
    const openConfig=()=>{clearFeedback();setConfigOpen(true)};
    const connectionInput=()=>({...form,...(v.id?{id:v.id}:{}),password:form.password||undefined});
    const passwordRequired=form.rememberPassword&&!connections.some(c=>c.id===v.id&&(c.unlocked||c.rememberPassword));
    function submitConnection(label:string,action:()=>Promise<any>){
        if(lock.current)return;
        clearFeedback();
        const invalid=validateConnection(form,isSql,label==='保存'&&passwordRequired);
        if(!invalid)return run(label,action);
        const [field,message]=invalid;
        setError(message);
        setInvalidField(field);
        configFields.current?.querySelector<HTMLInputElement>('input[name="'+field+'"]')?.focus();
    }
    function fieldState(name:ConnectionField,required:boolean){
        return {name,required,'aria-invalid':invalidField===name||undefined,'aria-describedby':invalidField===name?'wb-data-config-error':undefined};
    }
    const testConnection=()=>submitConnection('测试连接',()=>rpc('dataTest',{draft:connectionInput()}));
    const saveConnection=()=>submitConnection('保存',async()=>{
        const response=await rpc('dataSave',connectionInput());
        if(!live.current)return null;
        const config=response?.config;
        if(!config?.id)throw Error('保存未返回连接编号，请重新打开连接列表核对');
        const savedNote=config.rememberPassword?'连接配置已保存，已记住密码':'连接配置已保存，密码不落盘';
        connectionListVersion.current++;
        setConnections(items=>[...items.filter(item=>item.id!==config.id),{...config,unlocked:response.unlocked!==false}]);
        patch({id:config.id,form:{...config,password:''},objects:null,cursor:null,selected:[],structure:null,generated:null,result:null,query:v.query||initialQuery[form.kind]});
        setObjectFilter('');
        setConfigOpen(false);
        setBusy('读取对象');
        setNote(savedNote);
        if(response.unlocked===false)return null;
        try {
            return await loadObjects(config.id,v.pattern,'0',savedNote);
        } catch(error) {
            if(live.current)setError('读取'+objectLabel+'列表失败，可刷新重试。'+(error instanceof Error?error.message:''));
            return null;
        }
    });
    async function disconnect(){
        setDisconnecting(true);
        catalogVersion.current++;
        try{
            await rpc('dataDisconnect',{id:v.id});
            if(!live.current)return;
            patch({objects:undefined,cursor:null,selected:[],structure:null,result:null});
            await refresh();
            if(live.current)setNote('本地连接已关闭；服务端执行状态请核对数据库');
        }catch(e){if(live.current)setError((e as Error).message)}
        finally{if(live.current)setDisconnecting(false)}
    }
    const objects=(v.objects||[]).filter((o:any)=>[o.schemaName,o.name,o.comment].join(' ').toLowerCase().includes(objectFilter.toLowerCase()));
    const objectLabel=isSql?'表':form.kind==='es'?'索引':'Key';
    const emptyCatalogHint=busy==='读取对象'?'正在读取'+objectLabel+'列表…'
        :!v.id?'选择或新建连接后会显示'+objectLabel+'列表。'
        :needsConnection?'请在连接配置中输入密码并保存。'
        :v.objects?.length?'没有匹配的'+objectLabel+'。'
        :v.objects?'当前目录没有可显示的'+objectLabel+'。':'可刷新'+objectLabel+'列表。';
    const executeQuery=()=>run('查询',async()=>{const r=await rpc('dataQuery',{id:v.id,query:v.query,...(v.generated?{schemaHash:v.generated.schemaHash,selected:v.generated.selected}:{}),index:selected[0]?.name});if(live.current)patch({result:r});return {note:r.note||'查询完成'}});
    return <div className="wb-data-workspace">
        <aside className="wb-data-sidebar" aria-label="连接与对象"><div className="wb-data-sidebar-head"><strong>数据库连接</strong><Btn size="sm" disabled={!!busy} onClick={()=>{choose('');setConfigOpen(true)}}>新建连接</Btn></div>
        {connections.length>0?<ul className="wb-data-connections" role="list" aria-label="已保存连接">
            {connections.map(connection=>{
                const active=connection.id===v.id;
                const description=[connectionKinds[connection.kind],!connection.unlocked&&'需输入密码',connection.database].filter(Boolean).join(' · ');
                return <li key={connection.id}>
                    <button type="button" className="wb-data-connection" aria-pressed={active} disabled={!!busy} onClick={()=>{
                        if(!active)choose(connection.id);
                        else if(connection.unlocked&&v.objects==null)void refreshObjects(connection.id,v.pattern);
                    }}>
                        <Icon name="database" size={14}/>
                        <span><strong>{connection.name}</strong><small className="wb-muted" title={description}>{description}</small></span>
                    </button>
                </li>
            })}
        </ul>:<p className="wb-tiny wb-muted">暂无已保存的连接</p>}
<div className="wb-row wb-row--wrap"><Btn size="sm" disabled={!!busy} onClick={openConfig}>连接配置</Btn>{v.id&&<Btn size="sm" disabled={disconnecting} onClick={disconnect}>{operation?'停止并断开':'断开连接'}</Btn>}</div>
<section className="wb-stack wb-data-catalog" aria-label={objectLabel+'列表'}>
<div className="wb-data-sidebar-head"><strong>{objectLabel}列表</strong><Btn size="sm" disabled={!!busy||needsConnection} onClick={()=>refreshObjects(v.id,v.pattern)}>刷新{objectLabel}列表</Btn></div>
{isSql&&v.generated?.selected?.length>0&&<p className="wb-tiny wb-muted" style={{overflowWrap:'anywhere'}}>本次使用的表 · {v.generated.selected.map((table:any)=>[table.schemaName,table.name].filter(Boolean).join('.')).join('、')}</p>}
{form.kind==='redis'&&<Field label="Key匹配模式"><Input aria-label="Redis Key模式" disabled={!!busy} value={v.pattern||'*'} onChange={(e:any)=>patch({pattern:e.target.value})}/></Field>}
<Input aria-label="筛选表、索引或Key" placeholder="搜索表、索引或 Key…" value={objectFilter} onChange={(e:any)=>setObjectFilter(e.target.value)}/>
<div className="wb-stack" style={{minWidth:0}}><strong className="wb-tiny">对象与结构 · 已选 {selected.length}/12</strong><div style={{maxHeight:250,overflow:'auto',border:'1px solid var(--dsw-alias-border-l1)',borderRadius:8,padding:8}}>{objects.length?objects.map((o:any)=><label key={objectKey(o)} style={{display:'flex',gap:6,padding:'5px 0',overflowWrap:'anywhere',fontSize:12}}><input type="checkbox" disabled={!!busy} checked={selected.some((s:any)=>objectKey(s)===objectKey(o))} onChange={e=>{const next=e.target.checked?[...selected,o]:selected.filter((s:any)=>objectKey(s)!==objectKey(o));if(next.length>12){setError('最多选择12个对象');return}patch({selected:next,structure:null,generated:null,...(form.kind==='redis'&&e.target.checked?{query:JSON.stringify(['TYPE',o.name])}:{})})}}/><span style={{minWidth:0}}>{o.schemaName?o.schemaName+'.':''}{o.name}{o.comment&&<small className="wb-muted" style={{display:'block'}}>{o.comment}</small>}</span></label>):<p className="wb-tiny wb-muted">{emptyCatalogHint}</p>}</div>
        {form.kind==='redis'&&v.cursor&&v.cursor!=='0'&&<Btn disabled={!!busy} onClick={()=>run('扫描下一页',()=>loadObjects(v.id,v.pattern,v.cursor))}>扫描下一页</Btn>}
        <Btn disabled={!!busy||!selected.length} onClick={()=>run('刷新结构',async()=>{const r=await rpc('dataStructure',{id:v.id,selected});if(live.current)patch({structure:r});return {note:'结构已更新'}})}>读取 / 刷新所选结构</Btn><Btn disabled={!!busy||!selected.length} onClick={()=>{const o=selected[0];const quote=(name:string)=>form.kind==='mysql'?'`'+name.replace(/`/g,'``')+'`':'"'+name.replace(/"/g,'""')+'"';const query=form.kind==='redis'?JSON.stringify(['TYPE',o.name]):form.kind==='es'?initialQuery.es:'SELECT * FROM '+(o.schemaName?quote(o.schemaName)+'.':'')+quote(o.name)+' LIMIT 100';patch({query,generated:null,result:null})}}>生成所选对象查询</Btn></div></section></aside>
        <div className="wb-data-main">{busy&&<span role="status" className="wb-tiny">{busy}中…</span>}<div className="wb-data-query-head"><strong>{form.kind==='es'?'DSL 查询':form.kind==='redis'?'Redis 命令':'SQL 查询'}<span className="wb-tiny wb-muted"> · {form.database||form.name||'未选择连接'}</span></strong>        <div className="wb-row wb-row--wrap" style={{gap:8}}><Btn icon="sparkles" disabled={!!busy} onClick={()=>{setError('');setAiOpen(true)}}>AI 生成</Btn><Btn kind="primary" disabled={!!busy||!v.id||!v.query||v.generated?.mode==='script'} onClick={executeQuery} title="执行（⌘ / Ctrl + Enter）">执行只读查询</Btn><Copy text={v.query} label={['mysql','postgres'].includes(form.kind)?'复制 SQL':'复制脚本'}/></div>
</div>{!v.id&&<div className="wb-data-empty"><strong>选择或新建一个连接</strong><Btn onClick={()=>setConfigOpen(true)}>配置数据库</Btn></div>}
        {v.generated?.explanation&&<p className="wb-tiny" style={{whiteSpace:'pre-wrap'}}>{v.generated.explanation}</p>}
        <Field label={form.kind==='redis'?'读取命令（JSON字符串数组）':form.kind==='es'?'查询 DSL':'SQL 编辑器'}><Textarea aria-label="数据查询编辑器" placeholder={form.kind==='es'?'粘贴 DSL，或使用右上角 AI 生成':form.kind==='redis'?'粘贴 Redis 命令，或使用右上角 AI 生成':'粘贴 SQL，或使用右上角 AI 生成'} onKeyDown={(e:any)=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();if(!busy&&v.id&&v.query&&v.generated?.mode!=='script')void executeQuery()}}} rows={8} spellCheck={false} style={{fontFamily:'monospace'}} value={v.query||''} disabled={!!busy} onChange={(e:any)=>patch({query:e.target.value,result:null})}/></Field>
        {v.generated?.rollback&&<details><summary>回滚建议（仅预览）</summary><pre className="wb-code" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{v.generated.rollback}</pre><Copy text={v.generated.rollback}/></details>}
        {error&&!configOpen&&!aiOpen&&<p role="alert" className="wb-tiny" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',color:'var(--dsw-alias-state-error-primary)'}}>{error}</p>}{note&&!configOpen&&<p role="status" className="wb-tiny">{note}</p>}
        {result&&<div className="wb-stack"><strong className="wb-tiny">结果 · {result.durationMs} ms {result.rows?' · '+result.rows.length+' 行':''}{result.truncated?' · 已截断（最多200行/1MB）':''}</strong><Copy text={JSON.stringify(result.rows||result.result,null,2)} label="复制结果"/>{result.rows?<div role="region" aria-label="数据库查询结果，可横向滚动" tabIndex={0} style={{overflow:'auto',maxHeight:400,maxWidth:'100%'}}><table className="wb-table"><thead><tr>{result.columns.map((c:string)=><th key={c}>{c}</th>)}</tr></thead><tbody>{result.rows.map((row:any,i:number)=><tr key={i}>{result.columns.map((c:string)=><td key={c} style={{maxWidth:300,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{row[c]===null?'NULL':typeof row[c]==='object'?JSON.stringify(row[c]):String(row[c]??'')}</td>)}</tr>)}</tbody></table>{!result.rows.length&&<p className="wb-tiny">查询成功，无返回记录</p>}</div>:<pre className="wb-code" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:400,overflow:'auto'}}>{JSON.stringify(result.result,null,2)}</pre>}</div>}
{!result&&<div className="wb-data-empty"><Icon name="database" size={22}/><strong>查询结果</strong><span>执行只读查询后在此查看结果</span></div>}{v.structure&&<details className="wb-data-structure" open><summary>所选结构 · {v.structure.at}</summary>{v.structure.tables.map((table:any)=><section key={objectKey(table)}><h4>{table.schemaName?table.schemaName+'.':''}{table.name}</h4>{table.columns?<div className="wb-data-table-scroll"><table className="wb-table"><thead><tr><th>字段</th><th>类型</th><th>约束</th><th>注释</th></tr></thead><tbody>{table.columns.map((col:any)=><tr key={col.name}><td>{col.name}</td><td>{col.type}</td><td>{col.notNull?'NOT NULL':''}</td><td>{col.comment||'—'}</td></tr>)}</tbody></table></div>:null}<details><summary>{table.definition?'建表语句':'原始结构'}</summary><pre className="wb-code">{table.definition||JSON.stringify(table,null,2)}</pre></details></section>)}</details>}<Modal open={aiOpen} title="AI 生成" sub="描述需求，生成后直接填入查询编辑器" onClose={()=>setAiOpen(false)}>
<div className="wb-stack" style={{paddingTop:10,minWidth:0}}>
<p className="wb-tiny wb-muted">{generationScopeHint}</p>
<Field label="描述你要完成的查询或脚本"><Textarea aria-label="数据库AI需求" autoFocus rows={4} value={v.instruction||''} disabled={!!busy} placeholder="例如统计最近七天每天的订单金额" onChange={(e:any)=>patch({instruction:e.target.value})}/></Field>
<div className="wb-row wb-row--wrap" style={{gap:8}}><select aria-label="数据库生成模式" className="wb-select" disabled={!!busy} value={generationMode} onChange={e=>patch({mode:e.target.value})}><option value="query">只读查询</option>{isSql&&<option value="script">变更脚本（仅预览）</option>}</select>
<Btn kind="primary" disabled={!!busy||!v.id||(!selected.length&&(!isSql||autoTableSelection!==true))||!String(v.instruction||'').trim()} onClick={()=>run('AI生成',async()=>{
    const response=await rpc('dataGenerate',{id:v.id,selected,instruction:v.instruction,mode:generationMode});
    if(live.current){
        patch({query:response.query,generated:{...response,selected:response.selected||selected},result:null});
        setAiOpen(false);
    }
    return {note:generationMode==='script'?'已填入编辑器，可预览或复制脚本':'已填入编辑器，可复制或检查后执行'};
})}>{busy==='AI生成'?'生成中…':'生成并填入'}</Btn></div>
{error&&<p role="alert" className="wb-tiny" style={{color:'var(--dsw-alias-state-error-primary)',whiteSpace:'pre-wrap'}}>{error}</p>}
<p className="wb-tiny wb-muted" title="模型使用需求和表目录或对象结构。">{generationMode==='script'?'生成的变更脚本仅供预览和复制。':'生成后可检查脚本，再手动执行。'}</p>
</div></Modal>
</div>        <Modal open={configOpen} title={v.id?'连接配置':'新建连接'} sub={canRememberPassword?'可使用 macOS 钥匙串保护记住的密码':'密码仅在本次宿主进程内保留'}
    onClose={()=>{if(!lock.current){clearFeedback();setConfigOpen(false)}}}
    footer={<><Btn disabled={!!busy} onClick={testConnection}>{busy==='测试连接'?'测试中…':'测试连接'}</Btn><Btn kind="primary" disabled={!!busy} onClick={saveConnection}>{busy==='保存'?'保存中…':'保存'}</Btn></>}>
<div ref={configFields} className="wb-stack" style={{paddingTop:10}}>
{error&&<p id="wb-data-config-error" role="alert" className="wb-tiny" style={{color:'var(--dsw-alias-state-error-primary)'}}>{error}</p>}
{note&&<p role="status" className="wb-tiny">{note}</p>}
            <div className="wb-split"><Field label="连接名称（必填）"><Input aria-label="连接名称" {...fieldState('name',true)} value={form.name} disabled={!!busy} onChange={(e:any)=>edit('name',e.target.value)}/></Field><label className="wb-label">类型<select aria-label="数据库类型" className="wb-select" value={form.kind} disabled={!!busy||!!v.id} onChange={e=>{clearFeedback();patch({id:v.id??'',form:{...defaults,name:form.name,kind:e.target.value,port:({mysql:3306,postgres:5432,es:9200,redis:6379} as any)[e.target.value]},query:initialQuery[e.target.value]})}}>{Object.entries(connectionKinds).map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}</select></label></div>
            {form.kind==='es'?<Field label="ES URL（必填）"><Input aria-label="ES URL" {...fieldState('url',true)} value={form.url} disabled={!!busy} onChange={(e:any)=>edit('url',e.target.value)}/></Field>:<div className="wb-split"><Field label="主机（必填）"><Input aria-label="数据库主机" {...fieldState('host',true)} value={form.host} disabled={!!busy} onChange={(e:any)=>edit('host',e.target.value)}/></Field><Field label="端口（必填）"><Input aria-label="数据库端口" {...fieldState('port',true)} type="number" min={1} max={65535} value={form.port} disabled={!!busy} onChange={(e:any)=>edit('port',e.target.value)}/></Field></div>}
            {form.kind!=='es'&&<Field label={form.kind==='redis'?'Redis DB（默认0）':'数据库名称（必填）'}><Input aria-label="数据库名称" {...fieldState('database',isSql)} value={form.database} disabled={!!busy} onChange={(e:any)=>edit('database',e.target.value)}/></Field>}
            <div className="wb-split"><Field label="用户名"><Input aria-label="数据库用户名" autoComplete="off" value={form.username} disabled={!!busy} onChange={(e:any)=>edit('username',e.target.value)}/></Field><Field label={passwordRequired?'密码（必填）':'密码'}><Input aria-label="数据库密码" {...fieldState('password',passwordRequired)} type="password" autoComplete="new-password" value={form.password} disabled={!!busy} placeholder={needsConnection?'输入密码':'留空沿用原连接密码'} onChange={(e:any)=>edit('password',e.target.value)}/></Field></div>
            {(canRememberPassword||form.rememberPassword)&&<label className="wb-row" style={{gap:8}}><input type="checkbox" checked={!!form.rememberPassword} disabled={!!busy} onChange={e=>edit('rememberPassword',e.target.checked)}/>记住密码</label>}
            {form.kind!=='es'&&<><label className="wb-label"><input type="checkbox" checked={form.tls} disabled={!!busy} onChange={e=>edit('tls',e.target.checked)}/> 使用 TLS（校验证书）</label>{form.tls&&<Field label="CA证书（PEM，可选）"><Textarea aria-label="数据库CA证书" rows={3} value={form.ca} disabled={!!busy} onChange={(e:any)=>edit('ca',e.target.value)}/></Field>}</>}
        </div></Modal>
</div>
}
