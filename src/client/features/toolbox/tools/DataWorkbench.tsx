import * as React from 'react'
import {WB,Btn,Field,Input,Textarea,Modal,Icon,IconBtn} from '../../../core/runtime.js'
import {DataAiConversation,type DataDraft,type DataTurn} from './DataAiConversation.js'
import {toolCopyButton as Copy} from '../shared-controls.js'
import {dataWorkspaceClient,dataWorkspacePatch} from './data-workspace-client.js'
import {DataQueryResults} from './DataQueryResults.js'
import {DataWorkspaceMenu,DataSideDrawer,DataEditorSplitter} from './DataWorkspaceChrome.js'
const defaults:any={kind:'mysql',name:'',host:'127.0.0.1',port:3306,database:'',username:'',password:'',rememberPassword:false,tls:false,ca:'',url:'http://127.0.0.1:9200'}
const initialQuery:any={mysql:'SELECT 1 AS value',postgres:'SELECT 1 AS value',es:'{\n  "query": {"match_all": {}},\n  "size": 20\n}',redis:'["TYPE", "example:key"]'}
const connectionKinds:Record<string,string>={mysql:'MySQL',postgres:'PostgreSQL',es:'Elasticsearch',redis:'Redis'}
type ConnectionField = 'name' | 'host' | 'port' | 'url' | 'database' | 'password'

function connectionScope(connection:any){
    return JSON.stringify([connection?.id,connection?.kind,connection?.host,connection?.port,connection?.url,connection?.database,connection?.username]);
}

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
export function DataWorkbench({value:v,patch:patchValue,toolPicker}:any){
    const client=React.useMemo(()=>dataWorkspaceClient(WB.rpc),[]);
    const [memorySupport,setMemorySupport]=React.useState<boolean|null>(null),[pagination,setPagination]=React.useState(false);
    const [hydrating,setHydrating]=React.useState(false),[memoryError,setMemoryError]=React.useState(''),[memoryKey,setMemoryKey]=React.useState('');
    const [historical,setHistorical]=React.useState(false),[clearOpen,setClearOpen]=React.useState(false);
    const recoveryEdits=React.useRef<Record<string,any>>({});
    const [,memoryChanged]=React.useReducer(n=>n+1,0);
    const memoryEnabled=React.useRef(false),targetVersion=React.useRef(0),queryVersion=React.useRef(0),keyRef=React.useRef(''),hydration=React.useRef(false);
    const [connections,setConnections]=React.useState<any[]>([]),[operation,setBusy]=React.useState(''),[error,setError]=React.useState(''),[note,setNote]=React.useState('');
    const [disconnecting,setDisconnecting]=React.useState(false);
    const [aiError,setAiError]=React.useState(''),[pendingInstruction,setPendingInstruction]=React.useState('');
    const busy=disconnecting?'断开连接':hydrating?'恢复连接记忆':operation;
    const [autoTableSelection,setAutoTableSelection]=React.useState<boolean|null>(null);
    const [canRememberPassword,setCanRememberPassword]=React.useState(false);
    const catalogVersion=React.useRef(0),connectionListVersion=React.useRef(0);
    const live=React.useRef(true),lock=React.useRef(false),current=React.useRef(v);current.current=v;const form={...defaults,...v.form},selected=v.selected||[];
    const rpc=(method:string,request?:any)=>WB.rpc('workbench/'+method,method==='dataConnections'?{}:{request});
    function patch(change:any){
        if(Object.prototype.hasOwnProperty.call(change,'query')&&change.query!==current.current.query){
            queryVersion.current++;setHistorical(false);
            change={pageOffsets:[0],pageIndex:0,queriedAt:null,...change};
        }
        current.current={...current.current,...change};patchValue(change);
        if(memoryEnabled.current&&!hydration.current){
            if(keyRef.current)client.patch(keyRef.current,change);
            else if(memoryError)recoveryEdits.current={...recoveryEdits.current,...dataWorkspacePatch(change)};
        }
    }
    React.useEffect(()=>client.subscribe(memoryKey,memoryChanged),[client,memoryKey]);
    const memoryStatus=client.status(memoryKey);
    async function refresh(){
        const version=connectionListVersion.current;
        const result=await rpc('dataConnections');
        if(!live.current||version!==connectionListVersion.current)return;
        const items=result.connections||[];
        setConnections(items);
        setAutoTableSelection(result.capabilities?.autoTableSelection===true);
        setCanRememberPassword(result.capabilities?.rememberPassword===true);
        memoryEnabled.current=result.capabilities?.workspaceMemory===true;
        setMemorySupport(memoryEnabled.current);
        setPagination(result.capabilities?.queryPagination===true);
        return items;
    }
    React.useEffect(()=>{
        live.current=true;
        void refresh().then(items=>{
            if(!live.current||!items||lock.current)return;
            const {id,objects,pattern}=current.current;
            if(memoryEnabled.current)void choose(id,items,id===''?current.current:{});
            else if(id===undefined&&items.length)void choose(items[0].id,items);
            else if(objects===null&&items.some((c:any)=>c.id===id&&c.unlocked))void refreshObjects(id,pattern);
        }).catch((e:Error)=>{if(live.current)setError(e.message)});
        return()=>{live.current=false;catalogVersion.current++;targetVersion.current++;queryVersion.current++};
    },[]);
    async function run(label:string,fn:()=>Promise<any>){if(lock.current)return;lock.current=true;setBusy(label);setError('');setNote('');try{const result=await fn();if(live.current&&result!==null)setNote(result?.note||'操作成功')}catch(e){if(live.current)setError((e as Error).message)}finally{lock.current=false;if(live.current)setBusy('')}}
    async function loadObjects(id:string,pattern:string,cursor='0',savedNote?:string){
        const version=catalogVersion.current;
        const isCurrent=()=>live.current&&version===catalogVersion.current;
        try{
            const r=await rpc('dataObjects',{id,pattern:pattern||'*',cursor});
            if(!isCurrent())return null;
            patch({objects:r.objects,cursor:r.cursor,...(cursor==='0'?{selected:(current.current.selected||[]).filter((selected:any)=>r.objects.some((object:any)=>objectKey(object)===objectKey(selected))),structure:null}:{})});
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
    function resetWorkspace(id:string,items:any[],workspace:any={}){
        const c=items.find(c=>c.id===id);
        const next={id,aiTurns:[],instruction:'',mode:'query',form:c?{...c,password:''}:{...defaults},selected:[],objects:null,cursor:null,structure:null,result:null,generated:null,query:initialQuery[c?.kind||'mysql'],pattern:'*',connectionsOpen:true,aiOpen:true,pageSize:50,pageOffsets:[0],pageIndex:0,queriedAt:null,...workspace};
        current.current=next;patchValue(next);
        setHistorical(!!workspace.result);
        return c;
    }
    const choose=async(id?:string,items=connections,overlay:any={})=>{
        const version=++targetVersion.current;++catalogVersion.current;++queryVersion.current;
        const isCurrent=()=>live.current&&version===targetVersion.current;
        setObjectFilter('');clearFeedback();setAiError('');setPendingInstruction('');setMemoryError('');
        if(!memoryEnabled.current){
            const c=resetWorkspace(id||'',items);
            if(c?.unlocked)void refreshObjects(c.id,current.current.pattern);
            return;
        }
        hydration.current=true;setHydrating(true);
        try{
            const envelope=await client.load(id);
            if(!isCurrent())return;
            keyRef.current=envelope.key;setMemoryKey(envelope.key);
            const c=resetWorkspace(envelope.id,items,{...envelope.workspace,...overlay});
            recoveryEdits.current={};
            if(envelope.key)client.patch(envelope.key,overlay);
            hydration.current=false;setHydrating(false);
            if(c?.unlocked)void refreshObjects(c.id,current.current.pattern);
        }catch(error){
            if(!isCurrent())return;
            keyRef.current='';setMemoryKey('');
            // Allow manual work after a failed restore, but never save an empty replacement.
            resetWorkspace(id??items[0]?.id??'',items);
            recoveryEdits.current=overlay;setMemoryError((error as Error).message);
        }finally{if(isCurrent()){hydration.current=false;setHydrating(false)}}
    };
    const needsConnection=!v.id||!connections.some(c=>c.id===v.id&&c.unlocked);
    const objectKey=(o:any)=>JSON.stringify([o.schemaName||'',o.name]);
    const result=v.result;
    const isSql=form.kind==='mysql'||form.kind==='postgres';
    const generationMode=isSql&&v.mode==='script'?'script':'query';
    const generationScopeHint=memoryError?'连接记忆恢复失败，请重试后再使用 AI。':!v.id?'请先选择连接。':needsConnection?'请先在连接配置中解锁当前连接。':selected.length?`基于所选 ${selected.length} 个对象生成`
        :!isSql?'请勾选需要的索引或 Key。'
        :autoTableSelection===null?'正在检查自动选表支持…'
        :autoTableSelection?'未勾选表，将根据需求从当前库自动找表。':'当前宿主尚未加载自动选表，请退出并重新打开 DeepSeek Harness。';
    const [configOpen,setConfigOpen]=React.useState(false),[objectFilter,setObjectFilter]=React.useState('');
    const surface=React.useRef<HTMLDivElement>(null),output=React.useRef<HTMLDivElement>(null),revealEditor=React.useRef(false);
    const [layout,setLayout]=React.useState({connections:false,compact:false}),[drawer,setDrawer]=React.useState('');
    const [sidebarTab,setSidebarTab]=React.useState('connections'),[editorShare,setEditorShare]=React.useState(34),[mobileView,setMobileView]=React.useState('ai');
    React.useLayoutEffect(()=>{
        const node=surface.current;if(!node)return;
        const measure=()=>{
            const width=node.clientWidth;if(width<=0)return;
            const compact=width<980;
            setLayout(previous=>{const next={connections:width<760,compact};return previous.connections===next.connections&&previous.compact===next.compact?previous:next});
        };
        measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);observer?.observe(node);
        return()=>observer?.disconnect();
    },[]);
    React.useEffect(()=>setDrawer(''),[layout.connections,layout.compact]);
    React.useEffect(()=>{setSidebarTab(v.id?'objects':'connections')},[v.id]);
    const connectionsOpen=layout.connections?drawer==='connections':v.connectionsOpen!==false;
    const aiOpen=v.aiOpen!==false;
    React.useLayoutEffect(()=>{
        if(revealEditor.current&&output.current&&!output.current.hidden){output.current.scrollTop=0;revealEditor.current=false}
    });
    function toggleConnections(){if(layout.connections)setDrawer(connectionsOpen?'':'connections');else patch({connectionsOpen:!connectionsOpen})}
    function toggleAi(){patch({aiOpen:!aiOpen});setMobileView(aiOpen?'sql':'ai')}
    const turns:DataTurn[]=v.aiTurns||[];
    const instruction=String(v.instruction||'');
    const canSend=!!v.id&&!needsConnection&&!memoryError&&!busy&&!!instruction.trim()&&(selected.length>0||isSql&&autoTableSelection===true);
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
        // Finish the old target's writes before this ID can point at a new target.
        if(memoryEnabled.current&&keyRef.current)await client.flush(keyRef.current);
        const response=await rpc('dataSave',connectionInput());
        if(!live.current)return null;
        const config=response?.config;
        if(!config?.id)throw Error('保存未返回连接编号，请重新打开连接列表核对');
        const savedNote=config.rememberPassword?'连接配置已保存，已记住密码':'连接配置已保存，密码不落盘';
        const scopeChanged=connectionScope(connections.find(item=>item.id===v.id))!==connectionScope(config);
        if(scopeChanged)setAiError('');
        connectionListVersion.current++;
        setConnections(items=>[...items.filter(item=>item.id!==config.id),{...config,unlocked:response.unlocked!==false}]);
        if(memoryEnabled.current)await choose(config.id,[...connections.filter(item=>item.id!==config.id),{...config,unlocked:response.unlocked!==false}]);
        else patch({id:config.id,...(scopeChanged?{aiTurns:[],instruction:'',mode:'query'}:{}),form:{...config,password:''},objects:null,cursor:null,selected:[],structure:null,generated:null,result:null,query:v.query||initialQuery[form.kind]});
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
        catalogVersion.current++;queryVersion.current++;
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
    const pageSize=[50,100,200].includes(v.pageSize)?v.pageSize:50;
    const pageIndex=v.pageIndex||0,pageOffsets=v.pageOffsets||[0];
    const executeQuery=(index=0)=>run('查询',async()=>{
        const target=targetVersion.current,version=++queryVersion.current;
        const offset=index===0?0:pageOffsets[index]??result?.nextOffset;
        const r=await rpc('dataQuery',{id:v.id,query:v.query,...(isSql&&pagination?{pageSize,offset}:{}),...(v.generated?{schemaHash:v.generated.schemaHash,selected:v.generated.selected}:{}),index:selected[0]?.name});
        if(!live.current||target!==targetVersion.current||version!==queryVersion.current)return null;
        const offsets=index===0?[0]:[...pageOffsets.slice(0,index),r.offset??offset];
        setHistorical(false);patch({result:r,queriedAt:r.queriedAt||new Date().toISOString(),pageIndex:index,pageOffsets:offsets});
        requestAnimationFrame(()=>{
            if(!live.current||target!==targetVersion.current||version!==queryVersion.current||!output.current)return;
            const pane=output.current,section=pane.querySelector('.wb-data-results'),viewport=pane.querySelector('.wb-data-result-viewport');
            const headerHeight=pane.querySelector('.wb-data-query-head')?.getBoundingClientRect().height||48;
            if(section)pane.scrollTop+=section.getBoundingClientRect().top-pane.getBoundingClientRect().top-headerHeight-12;
            if(viewport)viewport.scrollTop=0;
        });
        return {note:r.note||'查询完成'};
    });
    function sendInstruction(){
        if(!canSend||lock.current)return;
        const version=catalogVersion.current;
        const question=instruction.trim();
        const history=turns.slice(-4).map(turn=>({instruction:turn.instruction,query:turn.draft?.query,explanation:turn.clarification||turn.draft?.explanation}));
        const isCurrent=()=>live.current&&version===catalogVersion.current;
        setAiError('');
        setPendingInstruction(question);
        void run('AI生成',async()=>{
            try{
                const key=keyRef.current;
                const request={id:v.id,selected,instruction:question,mode:generationMode,conversation:true,history};
                let accepted:any=null;
                const response=memoryEnabled.current&&key?await client.perform(key,async(envelope)=>{
                    const response=await rpc('dataGenerate',{...request,workspace:{key,baseRevision:envelope.revision,turnId:globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random()}});
                    if(response.workspace)accepted=client.accept(response.workspace);
                    return response;
                }):await rpc('dataGenerate',request);
                if(!isCurrent())return null;
                const turn:DataTurn=response.clarification?{instruction:question,clarification:response.clarification}:
                    {instruction:question,draft:{...response,mode:generationMode,selected:response.selected||selected}};
                // Only consume the instruction this request started from; keep a newer local or cross-window draft.
                const localInstruction=String(current.current.instruction??'');
                const hostInstruction=String(accepted?.workspace?.instruction??response.workspace?.workspace?.instruction??'');
                const nextInstruction=localInstruction!==question?localInstruction:hostInstruction&&hostInstruction!==question?hostInstruction:'';
                patch({aiTurns:response.workspace?.workspace?.aiTurns||[...turns,turn].slice(-20),instruction:nextInstruction});
            }catch(error){
                if(isCurrent())setAiError((error as Error).message);
            }finally{
                if(live.current)setPendingInstruction('');
            }
            return null;
        });
    }
    function applyDraft(draft:DataDraft){
        revealEditor.current=true;
        if(lock.current||disconnecting)return;
        clearFeedback();
        queryVersion.current++;patch({query:draft.query,generated:draft,result:null,pageIndex:0,pageOffsets:[0],queriedAt:null});
        setNote(draft.mode==='script'?'已填入脚本预览':'已填入编辑器，可检查后执行');setMobileView('sql');
    }
    async function clearMemory(){
        const target=targetVersion.current;
        try{
            const envelope=await client.clear(keyRef.current);
            if(!live.current||target!==targetVersion.current)return;
            resetWorkspace(envelope.id,connections,envelope.workspace);setClearOpen(false);setMemoryError('');
            setNote('当前连接记忆已清除；相同目标的连接共享此记忆');
        }catch(error){if(live.current&&target===targetVersion.current)setMemoryError((error as Error).message)}
    }
    const sidebar=<aside className="wb-data-sidebar" id="wb-data-connections" aria-label="连接与对象">
            <div className="wb-data-sidebar-head"><div className="wb-data-sidebar-tabs" role="tablist" aria-label="连接侧栏内容">
                <button type="button" role="tab" aria-selected={sidebarTab==='connections'} aria-controls="wb-data-connection-panel" onClick={()=>setSidebarTab('connections')}>连接</button>
                <button type="button" role="tab" aria-selected={sidebarTab==='objects'} aria-controls="wb-data-object-panel" onClick={()=>setSidebarTab('objects')}>对象</button>
            </div><IconBtn name="plus" label="新建连接" disabled={!!busy} onClick={()=>{void choose('');setConfigOpen(true)}}/>
            {layout.connections&&<IconBtn name="close" label="关闭连接面板" onClick={()=>setDrawer('')}/>}</div>
            <div role="tabpanel" id="wb-data-connection-panel" aria-label="已保存连接面板" hidden={sidebarTab!=='connections'}>
{connections.length>0?<ul className="wb-data-connections" role="list" aria-label="已保存连接">
            {connections.map(connection=>{
                const active=connection.id===v.id;
                const description=[connectionKinds[connection.kind],!connection.unlocked&&'需输入密码',connection.database].filter(Boolean).join(' · ');
                return <li key={connection.id}>
                    <button type="button" className="wb-data-connection" aria-pressed={active} disabled={!!operation||disconnecting} onClick={()=>{
                        setSidebarTab('objects');if(layout.connections)setDrawer('');
                        if(!active||hydrating)void choose(connection.id);
                        else if(connection.unlocked&&v.objects==null)void refreshObjects(connection.id,v.pattern);
                    }}>
                        <Icon name="database" size={14}/>
                        <span><strong title={connection.name}>{connection.name}</strong><small className="wb-muted" title={description}>{description}</small></span>
                    </button>
                </li>
            })}
        </ul>:<p className="wb-tiny wb-muted">暂无已保存的连接</p>}
</div>
<div role="tabpanel" id="wb-data-object-panel" aria-label="对象面板" hidden={sidebarTab!=='objects'}><section className="wb-stack wb-data-catalog" aria-label={objectLabel+'列表'}>
<div className="wb-data-sidebar-head"><strong>{objectLabel}列表</strong><Btn size="sm" disabled={!!busy||needsConnection} onClick={()=>refreshObjects(v.id,v.pattern)}>刷新{objectLabel}列表</Btn></div>
{isSql&&v.generated?.selected?.length>0&&<p className="wb-tiny wb-muted wb-data-used-objects" title={v.generated.selected.map((table:any)=>[table.schemaName,table.name].filter(Boolean).join('、'))}>本次使用的表 · {v.generated.selected.map((table:any)=>[table.schemaName,table.name].filter(Boolean).join('.')).join('、')}</p>}
{form.kind==='redis'&&<Field label="Key匹配模式"><Input aria-label="Redis Key模式" disabled={!!busy} value={v.pattern||'*'} onChange={(e:any)=>patch({pattern:e.target.value})}/></Field>}
<Input aria-label="筛选表、索引或Key" placeholder="搜索表、索引或 Key…" value={objectFilter} onChange={(e:any)=>setObjectFilter(e.target.value)}/>
<div className="wb-stack" style={{minWidth:0}}><strong className="wb-tiny">对象与结构 · 已选 {selected.length}/12</strong><div className="wb-data-object-list" style={{overflow:'auto',border:'1px solid var(--dsw-alias-border-l1)',borderRadius:8,padding:8}}>{objects.length?objects.map((o:any)=><label key={objectKey(o)} style={{display:'flex',gap:6,padding:'5px 0',overflowWrap:'anywhere',fontSize:12}}><input type="checkbox" disabled={!!busy} checked={selected.some((s:any)=>objectKey(s)===objectKey(o))} onChange={e=>{const next=e.target.checked?[...selected,o]:selected.filter((s:any)=>objectKey(s)!==objectKey(o));if(next.length>12){setError('最多选择12个对象');return}patch({selected:next,structure:null,...(form.kind==='redis'&&e.target.checked?{query:JSON.stringify(['TYPE',o.name]),generated:null,result:null}:{})})}}/><span style={{minWidth:0}} title={[o.schemaName,o.name].filter(Boolean).join('.')}>{o.schemaName?o.schemaName+'.':''}{o.name}{o.comment&&<small className="wb-muted" style={{display:'block'}}>{o.comment}</small>}</span></label>):<p className="wb-tiny wb-muted">{emptyCatalogHint}</p>}</div>
        {form.kind==='redis'&&v.cursor&&v.cursor!=='0'&&<Btn disabled={!!busy} onClick={()=>run('扫描下一页',()=>loadObjects(v.id,v.pattern,v.cursor))}>扫描下一页</Btn>}
        <Btn disabled={!!busy||!selected.length} onClick={()=>run('刷新结构',async()=>{const r=await rpc('dataStructure',{id:v.id,selected});if(live.current)patch({structure:r});return {note:'结构已更新'}})}>读取 / 刷新所选结构</Btn><Btn disabled={!!busy||!selected.length} onClick={()=>{const o=selected[0];const quote=(name:string)=>form.kind==='mysql'?'`'+name.replace(/`/g,'``')+'`':'"'+name.replace(/"/g,'""')+'"';const query=form.kind==='redis'?JSON.stringify(['TYPE',o.name]):form.kind==='es'?initialQuery.es:'SELECT * FROM '+(o.schemaName?quote(o.schemaName)+'.':'')+quote(o.name)+' LIMIT 100';patch({query,generated:null,result:null})}}>生成所选对象查询</Btn></div></section></div></aside>;
    const conversation=<DataAiConversation turns={turns} pending={pendingInstruction} instruction={instruction}
            mode={generationMode} isSql={isSql} canSend={canSend} busy={!!busy||memorySupport===null} scopeHint={generationScopeHint}
            error={aiError} setInstruction={value=>patch({instruction:value})} setMode={mode=>patch({mode})}
            send={sendInstruction} apply={applyDraft} databaseLabel={form.database||form.name} onClose={()=>{patch({aiOpen:false});setMobileView('sql')}}/>;
    const memoryText=memorySupport===null?'正在检查连接记忆支持…':hydrating?'正在恢复连接记忆…':memoryError?'连接记忆恢复失败：'+memoryError:memoryStatus.error?'连接记忆保存失败：'+memoryStatus.error:memorySupport===false?'当前宿主不支持持久记忆，仅保留本页输入':!memoryKey?'连接记忆仅适用于已保存连接':memoryStatus.saving?'连接记忆保存中…':'连接记忆已保存到本机';
    return <div className="wb-data-surface" ref={surface}>
        <header className="wb-data-toolbar" role="group" aria-label="数据连接布局">
            <h1 className="wb-page-title-a11y">开发工具箱</h1>{toolPicker}
            <span className="wb-data-toolbar-connection" title={v.id?[form.name,form.database].filter(Boolean).join(' / '):'未选择连接'}>{v.id?[form.name,form.database].filter(Boolean).join(' / '):'未选择连接'}</span>
            <span className={'wb-data-connection-state wb-tiny'+(!needsConnection?' is-connected':'')}>{!v.id?'未配置':needsConnection?'待连接':'已连接'}</span>
            <div className="wb-data-layout-actions">
                <button type="button" className="wb-iconbtn" aria-label={connectionsOpen?'收起连接':'展开连接'} title={connectionsOpen?'收起连接':'展开连接'} aria-expanded={connectionsOpen} aria-controls="wb-data-connections" disabled={hydrating||memorySupport===null} onClick={toggleConnections}><Icon name="database" size={16}/></button>
                <button type="button" className="wb-iconbtn" aria-label={aiOpen?'收起 AI 会话':'展开 AI 会话'} title={aiOpen?'收起 AI 会话':'展开 AI 会话'} aria-expanded={aiOpen} aria-controls="wb-data-ai-conversation" disabled={hydrating||memorySupport===null} onClick={toggleAi}><Icon name="messages" size={16}/></button>
                <DataWorkspaceMenu busy={!!busy} disconnecting={disconnecting} hasConnection={!!v.id} canClear={!!memoryKey&&!memoryStatus.saving} onConfig={openConfig} onDisconnect={disconnect} onClear={()=>setClearOpen(true)}/>
            </div>
        </header>
        {layout.compact&&<div className="wb-data-mobile-views" role="tablist" aria-label="数据工作区视图">
            <button type="button" role="tab" aria-selected={aiOpen&&mobileView==='ai'} onClick={()=>{patch({aiOpen:true});setMobileView('ai')}}>AI 查询</button>
            <button type="button" role="tab" aria-selected={!aiOpen||mobileView==='sql'} onClick={()=>setMobileView('sql')}>{isSql?'SQL 与结果':'查询与结果'}</button>
        </div>}
        <div className={'wb-data-workspace'+(connectionsOpen&&!layout.connections?' is-connections-open':'')+(aiOpen?' is-ai-open':'')+(layout.compact?' is-compact':'')}>
        {connectionsOpen&&!layout.connections&&sidebar}
        {aiOpen&&(!layout.compact||mobileView==='ai')&&conversation}
        <div className="wb-data-main" ref={output} hidden={layout.compact&&aiOpen&&mobileView!=='sql'}><div className="wb-data-query-head"><strong>{form.kind==='es'?'DSL 查询':form.kind==='redis'?'Redis 命令':'SQL 查询'}<span className="wb-tiny wb-muted"> · {form.database||form.name||'未选择连接'}</span></strong><span className="wb-data-readonly wb-tiny wb-muted">{v.generated?.mode==='script'?'仅预览':'只读'}</span>{busy&&<span role="status" className="wb-tiny">{busy}中…</span>}        <div className="wb-row wb-row--wrap" style={{gap:8}}><Copy text={v.query} label={['mysql','postgres'].includes(form.kind)?'复制 SQL':'复制脚本'}/><Btn kind="primary" disabled={!!busy||memorySupport===null||!v.id||!v.query||v.generated?.mode==='script'} onClick={()=>void executeQuery()} title="执行（⌘ / Ctrl + Enter）">执行只读查询</Btn></div>
</div>{!v.id&&<div className="wb-data-empty"><strong>选择或新建一个连接</strong><Btn onClick={()=>setConfigOpen(true)}>配置数据库</Btn></div>}
        {v.generated?.explanation&&<details className="wb-data-draft-info"><summary>查询说明</summary><p className="wb-tiny" style={{whiteSpace:'pre-wrap'}}>{v.generated.explanation}</p></details>}
        <div className="wb-data-editor" style={{flexBasis:editorShare+'%'}}><Textarea aria-label="数据查询编辑器" placeholder={form.kind==='es'?'粘贴 DSL，或从 AI 会话填入':form.kind==='redis'?'粘贴 Redis 命令，或从 AI 会话填入':'粘贴 SQL，或从 AI 会话填入'} onKeyDown={(e:any)=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();if(!busy&&v.id&&v.query&&v.generated?.mode!=='script')void executeQuery()}}} rows={8} spellCheck={false} style={{fontFamily:'monospace',height:'100%'}} value={v.query||''} disabled={!!busy||memorySupport===null} onChange={(e:any)=>patch({query:e.target.value,result:null})}/></div>
        <DataEditorSplitter share={editorShare} onChange={setEditorShare}/>

        {v.generated?.rollback&&<details><summary>回滚建议（仅预览）</summary><pre className="wb-code" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{v.generated.rollback}</pre><Copy text={v.generated.rollback}/></details>}
        {error&&!configOpen&&<p role="alert" className="wb-tiny" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',color:'var(--dsw-alias-state-error-primary)'}}>{error}</p>}
        <DataQueryResults result={result} isSql={isSql} pagination={pagination} pageSize={pageSize} pageIndex={pageIndex} busy={!!busy} historical={historical} queriedAt={v.queriedAt}
            onPage={(index:number)=>void executeQuery(index)} onPageSize={(size:number)=>{queryVersion.current++;patch({pageSize:size,pageOffsets:[0],pageIndex:0,result:null,queriedAt:null})}}/>
        {v.structure&&<details className="wb-data-structure" open><summary>所选结构 · {v.structure.at}</summary>{v.structure.tables.map((table:any)=><section key={objectKey(table)}><h4>{table.schemaName?table.schemaName+'.':''}{table.name}</h4>{table.columns?<div className="wb-data-table-scroll"><table className="wb-table"><thead><tr><th>字段</th><th>类型</th><th>约束</th><th>注释</th></tr></thead><tbody>{table.columns.map((col:any)=><tr key={col.name}><td>{col.name}</td><td>{col.type}</td><td>{col.notNull?'NOT NULL':''}</td><td>{col.comment||'—'}</td></tr>)}</tbody></table></div>:null}<details><summary>{table.definition?'建表语句':'原始结构'}</summary><pre className="wb-code">{table.definition||JSON.stringify(table,null,2)}</pre></details></section>)}</details>}</div>
        </div>
        <footer className={'wb-data-memory'+(memoryError||memoryStatus.error?' has-error':'')} aria-label="连接记忆状态">{note&&!configOpen&&<span role="status" className="wb-data-note wb-tiny" title={note}>{note}</span>}<span role="status" className="wb-tiny wb-muted" title={memoryText}>{memoryText}</span>
            {(memoryError||memoryStatus.error)&&<Btn size="sm" onClick={()=>{if(memoryError)void choose(v.id,connections,recoveryEdits.current);else void client.retry(memoryKey).catch(()=>{})}}>重试连接记忆</Btn>}
        </footer>
        {connectionsOpen&&layout.connections&&<DataSideDrawer label="连接与对象面板" side="left" onClose={()=>setDrawer('')}>{sidebar}</DataSideDrawer>}
        <Modal open={clearOpen} title="清除当前连接记忆" onClose={()=>setClearOpen(false)} footer={<><Btn onClick={()=>setClearOpen(false)}>取消</Btn><Btn kind="primary" disabled={memoryStatus.saving} onClick={()=>void clearMemory()}>确认清除记忆</Btn></>}>
            <p>将删除当前目标的 SQL、AI 会话和最近一页结果。相同目标的重复连接共享此记忆，删除不会执行 SQL。</p>
        </Modal>
        <Modal open={configOpen} title={v.id?'连接配置':'新建连接'} sub={canRememberPassword?'可使用 macOS 钥匙串保护记住的密码':'密码仅在本次宿主进程内保留'}
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
