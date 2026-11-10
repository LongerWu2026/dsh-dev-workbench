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
type DatabaseList={databases:string[];truncated?:boolean}
type DatabaseTarget={id:string;kind:string;database:string}
type TableSearch={id:string;keyword:string;objects:{schemaName:string;name:string;comment?:string}[];truncated?:boolean;error?:string}

function connectionScope(connection:any){
    return JSON.stringify([connection?.id,connection?.kind,connection?.host,connection?.port,connection?.url,connection?.database,connection?.username]);
}

function needsSqlDatabase(connection:any){
    return connection?.database===''&&(connection.kind==='mysql'||connection.kind==='postgres');
}

function validateConnection(form:any, databaseRequired:boolean, passwordRequired:boolean): [ConnectionField, string] | undefined {
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
        if(databaseRequired&&!database)return ['database','请填写数据库名称'];
        if(form.kind==='redis'&&!/^\d{1,3}$/.test(database||'0'))return ['database','Redis DB 必须为 0–999 之间的整数'];
    }
    if(passwordRequired&&!form.password)return ['password','请输入要记住的连接密码'];
}
export function DataWorkbench({value:v,patch:patchValue,toolPicker}:any){
    const client=React.useMemo(()=>dataWorkspaceClient(WB.rpc),[]);
    const [memorySupport,setMemorySupport]=React.useState<boolean|null>(null),[pagination,setPagination]=React.useState(false);
    const [hydrating,setHydrating]=React.useState(false),[memoryError,setMemoryError]=React.useState(''),[memoryKey,setMemoryKey]=React.useState('');
    const [historical,setHistorical]=React.useState(false),[clearOpen,setClearOpen]=React.useState(false);
    const [deleteTarget,setDeleteTarget]=React.useState<{id:string;name:string;database?:string}|null>(null);
    const recoveryEdits=React.useRef<Record<string,any>>({});
    const [,memoryChanged]=React.useReducer(n=>n+1,0);
    const memoryEnabled=React.useRef(false),targetVersion=React.useRef(0),queryVersion=React.useRef(0),keyRef=React.useRef(''),hydration=React.useRef(false);
    const [connections,setConnections]=React.useState<any[]>([]),[operation,setBusy]=React.useState(''),[error,setError]=React.useState(''),[note,setNote]=React.useState('');
    const [disconnecting,setDisconnecting]=React.useState(false);
    const [aiError,setAiError]=React.useState(''),[pendingInstruction,setPendingInstruction]=React.useState('');
    const busy=disconnecting?'断开连接':hydrating?'恢复连接记忆':operation;
    const [autoTableSelection,setAutoTableSelection]=React.useState<boolean|null>(null);
    const [autoIndexSelection,setAutoIndexSelection]=React.useState(false);
    const [canRememberPassword,setCanRememberPassword]=React.useState(false);
    const [canDeleteConnection,setCanDeleteConnection]=React.useState(false);
    const [canSwitchDatabase,setCanSwitchDatabase]=React.useState(false);
    const [canSearchDatabases,setCanSearchDatabases]=React.useState(false);
    const [canSearchTables,setCanSearchTables]=React.useState(false);
    const [tableSearch,setTableSearch]=React.useState<TableSearch|null>(null);
    const [optionalSqlDatabase,setOptionalSqlDatabase]=React.useState(false);
    const [databaseTarget,setDatabaseTarget]=React.useState<DatabaseTarget|null>(null);
    const [databaseList,setDatabaseList]=React.useState<DatabaseList|null>(null);
    const [databaseMatches,setDatabaseMatches]=React.useState<DatabaseList|null>(null);
    const [databaseQuery,setDatabaseQuery]=React.useState('');
    const [databaseChoice,setDatabaseChoice]=React.useState('');
    const databaseChoiceGroup=React.useId();
    const [testSuccess,setTestSuccess]=React.useState(false);
    const testSuccessTimer=React.useRef<ReturnType<typeof setTimeout>>();
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
        setAutoIndexSelection(result.capabilities?.autoIndexSelection===true);
        setCanRememberPassword(result.capabilities?.rememberPassword===true);
        setCanDeleteConnection(result.capabilities?.deleteConnection===true);
        setCanSwitchDatabase(result.capabilities?.postgresDatabases===true);
        setCanSearchDatabases(result.capabilities?.databaseSearch===true);
        setCanSearchTables(result.capabilities?.tableSearch===true);
        setOptionalSqlDatabase(result.capabilities?.optionalSqlDatabase===true);
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
            else if(objects===null&&items.some((c:any)=>c.id===id&&c.unlocked&&!needsSqlDatabase(c)))void refreshObjects(id,pattern);
        }).catch((e:Error)=>{if(live.current)setError(e.message)});
        return()=>{live.current=false;clearTimeout(testSuccessTimer.current);catalogVersion.current++;targetVersion.current++;queryVersion.current++};
    },[]);
    async function run(label:string,fn:()=>Promise<any>){if(lock.current)return;lock.current=true;setBusy(label);setError('');setNote('');try{const result=await fn();if(live.current&&result!==null)setNote(result?.note||'操作成功')}catch(e){if(live.current)setError((e as Error).message)}finally{lock.current=false;if(live.current)setBusy('')}}
    async function loadObjects(id:string,pattern:string,cursor='0',savedNote?:string,refresh=false){
        const version=catalogVersion.current;
        const isCurrent=()=>live.current&&version===catalogVersion.current;
        try{
            const r=await rpc('dataObjects',{id,pattern:pattern||'*',cursor,...(refresh&&{refresh:true})});
            if(!isCurrent())return null;
            const kind=current.current.form?.kind;
            const partialSqlCatalog=r.truncated===true&&(kind==='mysql'||kind==='postgres');
            setTableSearch(null);
            patch({objects:r.objects,objectsTruncated:partialSqlCatalog,cursor:r.cursor,...(cursor==='0'?{
                ...(!partialSqlCatalog&&{selected:(current.current.selected||[]).filter((selected:any)=>r.objects.some((object:any)=>objectKey(object)===objectKey(selected)))}),
                structure:null,
            }:{})});
            const note=r.truncated?'对象较多，仅展示前500项':cursor==='0'?'已读取对象':'已扫描下一页，空页也可继续';
            return {note:savedNote?(r.truncated?savedNote+'。'+note:savedNote):note};
        }catch(e){
            if(isCurrent())throw e;
            return null;
        }
    }
    const refreshObjects=(id:string,pattern:string,refresh=false)=>run('读取对象',()=>loadObjects(id,pattern,'0',undefined,refresh));
    const [invalidField,setInvalidField]=React.useState<ConnectionField|null>(null);
    const configFields=React.useRef<HTMLDivElement>(null);
    function clearFeedback(){
        clearTimeout(testSuccessTimer.current);
        setTestSuccess(false);setError('');setNote('');setInvalidField(null);
    }
    const [configDraft,setConfigDraft]=React.useState<{id:string;fields:any}|null>(null);
    const configForm=configDraft?.fields??form;
    const configId=configDraft?.id??v.id;
    const edit=(key:string,value:any)=>{
        clearFeedback();
        if(configDraft)setConfigDraft({...configDraft,fields:{...configForm,[key]:value}});
        else patch({id:v.id??'',form:{...form,[key]:value}});
    };
    function resetWorkspace(id:string,items:any[],workspace:any={}){
        const c=items.find(c=>c.id===id);
        const next={id,aiTurns:[],instruction:'',form:c?{...c,password:''}:{...defaults},selected:[],objects:null,objectsTruncated:false,cursor:null,structure:null,result:null,generated:null,query:initialQuery[c?.kind||'mysql'],pattern:'*',connectionsOpen:true,aiOpen:true,pageSize:50,pageOffsets:[0],pageIndex:0,queriedAt:null,...workspace};
        current.current=next;patchValue(next);
        setHistorical(!!workspace.result);
        return c;
    }
    const choose=async(id?:string,items=connections,overlay:any={})=>{
        const version=++targetVersion.current;++catalogVersion.current;++queryVersion.current;
        const isCurrent=()=>live.current&&version===targetVersion.current;
        setCollapsedConnection('');setObjectFilter('');setTableSearch(null);clearFeedback();setAiError('');setPendingInstruction('');setMemoryError('');
        if(!memoryEnabled.current){
            const c=resetWorkspace(id||'',items);
            if(c?.unlocked&&!needsSqlDatabase(c))void refreshObjects(c.id,current.current.pattern);
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
            if(c?.unlocked&&!needsSqlDatabase(c))void refreshObjects(c.id,current.current.pattern);
        }catch(error){
            if(!isCurrent())return;
            keyRef.current='';setMemoryKey('');
            // Allow manual work after a failed restore, but never save an empty replacement.
            resetWorkspace(id??items[0]?.id??'',items);
            recoveryEdits.current=overlay;setMemoryError((error as Error).message);
        }finally{if(isCurrent()){hydration.current=false;setHydrating(false)}}
    };
    const activeConnection=connections.find(c=>c.id===v.id);
    const needsConnection=!activeConnection?.unlocked;
    const needsDatabase=needsSqlDatabase(activeConnection);
    const pickerNeedsDatabase=needsSqlDatabase(databaseTarget);
    const databaseKeyword=databaseQuery.trim();
    const visibleDatabaseList=databaseMatches||databaseList;
    const visibleDatabases=visibleDatabaseList?.databases.filter(name=>name.toLowerCase().includes(databaseKeyword.toLowerCase()))||[];
    const canSearchAll=canSearchDatabases&&databaseList?.truncated===true;
    const objectKey=(o:any)=>JSON.stringify([o.schemaName||'',o.name]);
    const result=v.result;
    const isSql=form.kind==='mysql'||form.kind==='postgres';
    const configIsSql=configForm.kind==='mysql'||configForm.kind==='postgres';
    const databaseRequired=configIsSql&&!optionalSqlDatabase;
    const [configOpen,setConfigOpen]=React.useState(false),[objectFilter,setObjectFilter]=React.useState('');
    const surface=React.useRef<HTMLDivElement>(null),output=React.useRef<HTMLDivElement>(null),revealEditor=React.useRef(false);
    const [layout,setLayout]=React.useState({connections:false,compact:false}),[drawer,setDrawer]=React.useState('');
    const [collapsedConnection,setCollapsedConnection]=React.useState(''),[editorShare,setEditorShare]=React.useState(34),[mobileView,setMobileView]=React.useState('ai');
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
    const connectionsOpen=layout.connections?drawer==='connections':v.connectionsOpen!==false;
    const aiOpen=v.aiOpen!==false;
    React.useLayoutEffect(()=>{
        if(revealEditor.current&&output.current&&!output.current.hidden){output.current.scrollTop=0;revealEditor.current=false}
    });
    function toggleConnections(){if(layout.connections)setDrawer(connectionsOpen?'':'connections');else patch({connectionsOpen:!connectionsOpen})}
    function setAiVisible(open:boolean){patch({aiOpen:open});setMobileView(open?'ai':'sql')}
    const turns:DataTurn[]=v.aiTurns||[];
    const instruction=String(v.instruction||'');
    const canAutoSelect=isSql&&autoTableSelection===true||form.kind==='es'&&autoIndexSelection;
    const canSend=!!v.id&&!needsConnection&&!needsDatabase&&!memoryError&&!busy&&!!instruction.trim()&&(selected.length>0||canAutoSelect);
    function openConfig(connection?:any){
        clearFeedback();
        setConfigDraft(connection?{id:connection.id,fields:{...defaults,...connection,password:''}}:null);
        setConfigOpen(true);
    }
    function newConnection(){
        if(v.id)void choose('');
        openConfig();
    }
    const connectionInput=()=>({...configForm,...(configId?{id:configId}:{}),password:configForm.password||undefined});
    const configConnection=connections.find(c=>c.id===configId);
    const passwordRequired=configForm.rememberPassword&&!(configConnection?.unlocked||configConnection?.rememberPassword);
    function submitConnection(label:string,action:()=>Promise<any>){
        if(lock.current)return;
        clearFeedback();
        const invalid=validateConnection(configForm,databaseRequired,label==='保存'&&passwordRequired);
        if(!invalid)return run(label,action);
        const [field,message]=invalid;
        setError(message);
        setInvalidField(field);
        configFields.current?.querySelector<HTMLInputElement>('input[name="'+field+'"]')?.focus();
    }
    function fieldState(name:ConnectionField,required:boolean){
        return {name,required,'aria-invalid':invalidField===name||undefined,'aria-describedby':invalidField===name?'wb-data-config-error':undefined};
    }
    const testConnection=()=>submitConnection('测试连接',async()=>{
        await rpc('dataTest',{draft:connectionInput()});
        if(live.current){
            setTestSuccess(true);
            testSuccessTimer.current=setTimeout(()=>setTestSuccess(false),3000);
        }
        return null;
    });
    function updateSavedConnection(config:any,unlocked:boolean){
        const saved={...config,unlocked};
        const update=(items:any[])=>items.some(item=>item.id===config.id)?items.map(item=>item.id===config.id?saved:item):[...items,saved];
        connectionListVersion.current++;
        setConnections(update);
        return update(connections);
    }
    const saveConnection=()=>submitConnection('保存',async()=>{
        const editingOther=!!configId&&configId!==v.id;
        // Finish the old target's writes before this ID can point at a new target.
        if(!editingOther&&memoryEnabled.current&&keyRef.current)await client.flush(keyRef.current);
        const response=await rpc('dataSave',connectionInput());
        if(!live.current)return null;
        const config=response?.config;
        if(!config?.id)throw Error('保存未返回连接编号，请重新打开连接列表核对');
        const savedNote=config.rememberPassword?'连接配置已保存，已记住密码':'连接配置已保存，密码不落盘';
        const items=updateSavedConnection(config,response.unlocked!==false);
        setConfigDraft(null);
        setConfigOpen(false);
        if(editingOther)return {note:savedNote};
        const scopeChanged=connectionScope(connections.find(item=>item.id===v.id))!==connectionScope(config);
        if(scopeChanged)setAiError('');
        setCollapsedConnection('');
        if(memoryEnabled.current)await choose(config.id,items);
        else patch({id:config.id,...(scopeChanged?{aiTurns:[],instruction:''}:{}),form:{...config,password:''},objects:null,objectsTruncated:false,cursor:null,selected:[],structure:null,generated:null,result:null,query:v.query||initialQuery[form.kind]});
        setObjectFilter('');
        setNote(savedNote);
        if(response.unlocked===false)return null;
        if(needsSqlDatabase(config)){
            setBusy('读取数据库');
            await loadDatabasePicker(config);
            return null;
        }
        setBusy('读取对象');
        try {
            return await loadObjects(config.id,v.pattern,'0',savedNote);
        } catch(error) {
            if(live.current)setError('读取'+objectLabel+'列表失败，可刷新重试。'+(error instanceof Error?error.message:''));
            return null;
        }
    });
    async function readDatabaseList(id:string,query?:string):Promise<DatabaseList>{
        const response=await rpc('dataDatabases',{id,...(query?{query}:{})});
        if(!Array.isArray(response?.databases)||response.databases.some((name:unknown)=>typeof name!=='string'))throw Error('未能读取数据库列表，请重新打开后重试');
        return response;
    }
    async function loadDatabasePicker(connection:DatabaseTarget){
        setDatabaseList(null);
        setDatabaseMatches(null);
        setDatabaseQuery('');
        setDatabaseChoice('');
        setDatabaseTarget({id:connection.id,kind:connection.kind,database:connection.database});
        const response=await readDatabaseList(connection.id);
        if(!live.current)return null;
        setDatabaseList(response);
        if(response.databases.includes(connection.database))setDatabaseChoice(connection.database);
        return null;
    }
    function openDatabasePicker(connection:DatabaseTarget&{unlocked?:boolean}){
        if(!connection.unlocked)return;
        void run('读取数据库',()=>loadDatabasePicker(connection));
    }
    function searchAllDatabases(){
        if(!databaseTarget||!canSearchAll||!databaseKeyword)return;
        void run('搜索数据库',async()=>{
            const response=await readDatabaseList(databaseTarget.id,databaseKeyword);
            if(live.current){
                setDatabaseMatches(response);
                setDatabaseChoice('');
            }
            return null;
        });
    }
    function switchDatabase(){
        if(!databaseTarget||!databaseChoice||databaseChoice===databaseTarget.database)return;
        void run('切换数据库',async()=>{
            if(memoryEnabled.current&&keyRef.current)await client.flush(keyRef.current);
            const response=await rpc('dataSwitchDatabase',{id:databaseTarget.id,database:databaseChoice});
            if(!live.current)return null;
            const config=response?.config;
            if(!config?.id||config.kind!==databaseTarget.kind||config.database!==databaseChoice)throw Error('未能确认切换结果，请重新打开连接列表');
            const items=updateSavedConnection(config,true);
            setDatabaseTarget(null);
            await choose(config.id,items);
            if(!live.current||current.current.id!==config.id)return null;
            const note='已切换到 '+config.database;
            setNote(note);
            setBusy('读取对象');
            return loadObjects(config.id,current.current.pattern,'0',note);
        });
    }
    async function disconnect(id:string){
        const active=current.current.id===id;
        setDisconnecting(true);
        if(active){catalogVersion.current++;queryVersion.current++}
        try{
            await rpc('dataDisconnect',{id});
            if(!live.current)return;
            if(active&&current.current.id===id)patch({objects:undefined,objectsTruncated:false,cursor:null,selected:[],structure:null,result:null});
            await refresh();
            if(live.current)setNote('本地连接已关闭；服务端执行状态请核对数据库');
        }catch(e){if(live.current)setError((e as Error).message)}
        finally{if(live.current)setDisconnecting(false)}
    }
    const objectKeyword=objectFilter.trim().toLowerCase();
    const searchTables=!!(canSearchTables&&isSql&&v.id&&v.objectsTruncated&&objectKeyword&&!needsConnection&&!needsDatabase);
    const tableMatches=searchTables&&tableSearch?.id===v.id&&tableSearch?.keyword===objectKeyword?tableSearch:null;
    React.useEffect(()=>{
        if(!searchTables||tableMatches||busy||!connectionsOpen||collapsedConnection===v.id||configOpen||databaseTarget)return;
        const id=v.id,version=catalogVersion.current;
        const isCurrent=()=>live.current&&catalogVersion.current===version&&current.current.id===id;
        const timer=setTimeout(()=>{
            if(!isCurrent())return;
            void run('搜索表',async()=>{
                try{
                    const {objects,truncated}=await rpc('dataObjects',{id,query:objectKeyword});
                    if(isCurrent())setTableSearch({id,keyword:objectKeyword,objects,truncated});
                }catch(error){
                    if(isCurrent())setTableSearch({id,keyword:objectKeyword,objects:[],error:(error as Error).message});
                }
                return null;
            });
        },250);
        return()=>clearTimeout(timer);
    },[searchTables,tableMatches,busy,connectionsOpen,collapsedConnection,configOpen,databaseTarget,v.id,objectKeyword]);
    const objects=searchTables?(tableMatches?.objects||[]):(v.objects||[]).filter((o:any)=>
        [o.schemaName,o.name,o.comment,o.schemaName&&`${o.schemaName}.${o.name}`].join(' ').toLowerCase().includes(objectKeyword));
    const generationScopeHint=memoryError?'连接记忆恢复失败，请重试后再使用 AI。':!v.id?'请先选择连接。':needsConnection?'请先在连接配置中解锁当前连接。':needsDatabase?'请从连接的更多操作中选择数据库。':selected.length?`基于所选 ${selected.length} 个对象生成`
        :form.kind==='es'&&autoIndexSelection?'文档查询可填写完整索引名；查询版本或插件无需勾选索引。'
        :!isSql?'请勾选需要的索引或 Key。'
        :autoTableSelection===null?'正在检查自动选表支持…'
        :!autoTableSelection?'当前宿主尚未加载自动选表，请退出并重新打开 DeepSeek Harness。'
        :'未勾选表，AI 将在当前库自动找表。';
    const objectLabel=isSql?'表':form.kind==='es'?'索引':'Key';
    const emptyCatalogHint=busy==='读取对象'?'正在读取'+objectLabel+'列表…'
        :!v.id?'选择或新建连接后会显示'+objectLabel+'列表。'
        :needsConnection?'请在连接配置中输入密码并保存。'
        :needsDatabase?'请从连接的更多操作中选择数据库。'
        :searchTables&&!tableMatches?'正在搜索当前库的表…'
        :tableMatches?.error?`搜索表失败，可刷新列表重试。${tableMatches.error}`
        :v.objects?.length?'没有匹配的'+objectLabel+'。'
        :v.objects?'当前目录没有可显示的'+objectLabel+'。':'可刷新'+objectLabel+'列表。';
    const pageSize=[50,100,200].includes(v.pageSize)?v.pageSize:50;
    const pageIndex=v.pageIndex||0,pageOffsets=v.pageOffsets||[0];
    const generatedIndex=form.kind==='es'?v.generated?.selected[0]?.name:undefined;
    const queryIndex=generatedIndex??selected[0]?.name;
    const isScriptPreview=v.generated?.mode==='script';
    const canExecuteQuery=!!v.id&&!!v.query&&!busy&&memorySupport!==null&&!needsDatabase&&!isScriptPreview;
    const executeQuery=(index=0)=>run('查询',async()=>{
        const target=targetVersion.current,version=++queryVersion.current;
        const offset=index===0?0:pageOffsets[index]??result?.nextOffset;
        const r=await rpc('dataQuery',{id:v.id,query:v.query,...(isSql&&pagination?{pageSize,offset}:{}),...(v.generated?{schemaHash:v.generated.schemaHash,selected:v.generated.selected}:{}),index:queryIndex});
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
        const version=catalogVersion.current,editorVersion=queryVersion.current;
        const question=instruction.trim();
        const history=turns.slice(-4).map(turn=>({instruction:turn.instruction,query:turn.draft?.query,explanation:turn.clarification||turn.draft?.explanation}));
        const isCurrent=()=>live.current&&version===catalogVersion.current;
        setAiError('');
        setPendingInstruction(question);
        void run('AI生成',async()=>{
            try{
                const key=keyRef.current;
                const request={id:v.id,selected,instruction:question,mode:isSql?'auto':'query',conversation:true,history};
                let accepted:any=null,editorChangedElsewhere=false;
                const response=memoryEnabled.current&&key?await client.perform(key,async(envelope)=>{
                    const response=await rpc('dataGenerate',{...request,workspace:{key,baseRevision:envelope.revision,turnId:globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random()}});
                    if(response.workspace){
                        accepted=client.accept(response.workspace);
                        editorChangedElsewhere=accepted.workspace.query!==envelope.workspace.query||
                            JSON.stringify(accepted.workspace.generated)!==JSON.stringify(envelope.workspace.generated);
                    }
                    return response;
                }):await rpc('dataGenerate',request);
                if(!isCurrent())return null;
                const {workspace,...generated}=response;
                const mode=generated.mode==='script'||(isSql&&generated.mode!=='query')?'script':'query';
                const turn:DataTurn=generated.clarification?{instruction:question,clarification:generated.clarification}:
                    {instruction:question,draft:{...generated,mode,selected:generated.selected||selected}};
                // Only consume the instruction this request started from; keep a newer local or cross-window draft.
                const localInstruction=String(current.current.instruction??'');
                const hostInstruction=String(accepted?.workspace?.instruction??workspace?.workspace?.instruction??'');
                const nextInstruction=localInstruction!==question?localInstruction:hostInstruction&&hostInstruction!==question?hostInstruction:'';
                const changes={aiTurns:workspace?.workspace?.aiTurns||[...turns,turn].slice(-20),instruction:nextInstruction};
                if(isSql&&turn.draft&&editorVersion===queryVersion.current&&!editorChangedElsewhere)fillEditor(turn.draft,changes);
                else{
                    patch(changes);
                    if(isSql&&turn.draft)setNote('SQL 已生成，已保留较新的草稿');
                }
            }catch(error){
                if(isCurrent())setAiError((error as Error).message);
            }finally{
                if(live.current)setPendingInstruction('');
            }
            return null;
        });
    }
    function fillEditor(draft:DataDraft,changes:Record<string,unknown>={}){
        revealEditor.current=true;
        clearFeedback();
        queryVersion.current++;patch({...changes,query:draft.query,generated:draft,result:null,pageIndex:0,pageOffsets:[0],queriedAt:null});
        setNote(draft.mode==='script'?'SQL 已填入编辑器，仅供预览':'SQL 已填入编辑器，可检查后执行');setMobileView('sql');
    }
    function applyDraft(draft:DataDraft){
        if(!lock.current&&!disconnecting)fillEditor(draft);
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
    function openDeleteConnection(connection:{id:string;name:string;database?:string}){
        clearFeedback();
        const {id,name,database}=connection;
        setDeleteTarget({id,name,database});
    }
    function closeDeleteConnection(){
        if(lock.current)return;
        setDeleteTarget(null);
        clearFeedback();
    }
    function confirmDeleteConnection(){
        if(!deleteTarget||busy)return;
        const {id}=deleteTarget;
        void run('删除连接',async()=>{
            if(current.current.id===id&&keyRef.current)await client.flush(keyRef.current);
            const response=await rpc('dataDelete',{id,confirmed:true});
            if(!live.current)return null;
            if(response?.deleted!==id)throw Error('未能确认删除，请刷新连接列表后重试');
            connectionListVersion.current++;
            setConnections(items=>items.filter(item=>item.id!==id));
            setDeleteTarget(null);
            if(current.current.id===id)await choose('');
            return {note:'连接已删除'};
        });
    }
    const catalog=<section id="wb-data-connection-objects" className="wb-stack wb-data-catalog" aria-label={objectLabel+'列表'}>
<div className="wb-data-sidebar-head"><strong>{objectLabel}列表</strong><Btn size="sm" disabled={!!busy||needsConnection||needsDatabase} onClick={()=>refreshObjects(v.id,v.pattern,true)}>刷新{objectLabel}列表</Btn></div>
{form.kind==='redis'&&<Field label="Key匹配模式"><Input aria-label="Redis Key模式" disabled={!!busy} value={v.pattern||'*'} onChange={(e:any)=>patch({pattern:e.target.value})}/></Field>}
<Input aria-label="筛选表、索引或Key" placeholder={isSql?'搜索表名或 schema…':'搜索索引或 Key…'} value={objectFilter} onChange={(e:any)=>setObjectFilter(e.target.value)}/>
{tableMatches?.truncated&&<p className="wb-tiny wb-muted">仅显示前 500 个匹配项，请缩小搜索范围。</p>}
<div className="wb-stack" style={{minWidth:0}}><strong className="wb-tiny">对象与结构 · 已选 {selected.length}/12</strong><div className="wb-data-object-list" style={{overflow:'auto',border:'1px solid var(--dsw-alias-border-l1)',borderRadius:8,padding:8}}>{objects.length?objects.map((o:any)=><label key={objectKey(o)} style={{display:'flex',gap:6,padding:'5px 0',overflowWrap:'anywhere',fontSize:12}}><input type="checkbox" disabled={!!busy} checked={selected.some((s:any)=>objectKey(s)===objectKey(o))} onChange={e=>{const next=e.target.checked?[...selected,o]:selected.filter((s:any)=>objectKey(s)!==objectKey(o));if(next.length>12){setError('最多选择12个对象');return}patch({selected:next,structure:null,...(form.kind==='redis'&&e.target.checked?{query:JSON.stringify(['TYPE',o.name]),generated:null,result:null}:{})})}}/><span style={{minWidth:0}} title={[o.schemaName,o.name].filter(Boolean).join('.')}>{o.schemaName?o.schemaName+'.':''}{o.name}{o.comment&&<small className="wb-muted" style={{display:'block'}}>{o.comment}</small>}</span></label>):<p className="wb-tiny wb-muted">{emptyCatalogHint}</p>}</div>
        {form.kind==='redis'&&v.cursor&&v.cursor!=='0'&&<Btn disabled={!!busy} onClick={()=>run('扫描下一页',()=>loadObjects(v.id,v.pattern,v.cursor))}>扫描下一页</Btn>}
        <Btn disabled={!!busy||!selected.length} onClick={()=>run('刷新结构',async()=>{const r=await rpc('dataStructure',{id:v.id,selected});if(live.current)patch({structure:r});return {note:'结构已更新'}})}>读取 / 刷新所选结构</Btn><Btn disabled={!!busy||!selected.length} onClick={()=>{const o=selected[0];const quote=(name:string)=>form.kind==='mysql'?'`'+name.replace(/`/g,'``')+'`':'"'+name.replace(/"/g,'""')+'"';const query=form.kind==='redis'?JSON.stringify(['TYPE',o.name]):form.kind==='es'?initialQuery.es:'SELECT * FROM '+(o.schemaName?quote(o.schemaName)+'.':'')+quote(o.name)+' LIMIT 100';patch({query,generated:null,result:null})}}>生成所选对象查询</Btn></div></section>;
    const sidebar=<aside className="wb-data-sidebar" id="wb-data-connections" aria-label="连接与对象">
        <header className="wb-data-sidebar-head">
            <strong>连接</strong>
            <div className="wb-data-sidebar-actions">
                <IconBtn name="plus" label="新建连接" disabled={!!busy} onClick={newConnection}/>
                <button type="button" className="wb-iconbtn wb-data-sidebar-collapse"
                    aria-label={layout.connections?'关闭连接面板':'收起连接'} title={layout.connections?'关闭连接面板':'收起连接'}
                    aria-expanded={true} aria-controls="wb-data-connections" onClick={toggleConnections}>
                    <Icon name={layout.connections?'close':'chevronRight'} size={15}/>
                </button>
            </div>
        </header>
        <div className="wb-data-connection-scroll">
            {connections.length?<ul className="wb-data-connections" aria-label="已保存连接">
                {connections.map(connection=>{
                    const active=connection.id===v.id,expanded=active&&collapsedConnection!==connection.id;
                    const hasDatabasePicker=connection.kind==='postgres'?(canSwitchDatabase||optionalSqlDatabase):connection.kind==='mysql'&&optionalSqlDatabase;
                    const chooseDatabase=needsSqlDatabase(connection);
                    const connected=connection.unlocked&&!chooseDatabase&&(connection.connected||active&&Array.isArray(v.objects));
                    const status=connected?'已连接':!connection.unlocked?'待连接':chooseDatabase?'待选库':'可连接';
                    const description=[connectionKinds[connection.kind],connection.database,!connection.unlocked&&'需输入密码'].filter(Boolean).join(' · ');
                    const select=()=>{
                        if(!active||hydrating){void choose(connection.id);return}
                        setCollapsedConnection(expanded?connection.id:'');
                        if(!expanded&&connection.unlocked&&v.objects==null&&!chooseDatabase)void refreshObjects(connection.id,v.pattern);
                    };
                    const items=[
                        {label:'连接配置',icon:'edit',disabled:!!busy,action:()=>openConfig(connection)},
                        ...(hasDatabasePicker?[{label:chooseDatabase?'选择数据库':'切换数据库',icon:'database',disabled:!!busy||!connection.unlocked,
                            title:!connection.unlocked?'请先在连接配置中解锁':undefined,action:()=>openDatabasePicker(connection)}]:[]),
                        {label:active&&operation?'停止并断开':'断开连接',icon:'plug',
                            disabled:disconnecting||hydrating||(!active&&!!operation)||(!connection.unlocked&&!connection.connected),action:()=>void disconnect(connection.id)},
                        ...(active&&memoryKey?[{label:'清除当前连接记忆',icon:'trash',disabled:!!busy||memoryStatus.saving,action:()=>setClearOpen(true)}]:[]),
                        ...(canDeleteConnection?[{label:'删除连接',icon:'trash',danger:true,disabled:!!busy,action:()=>openDeleteConnection(connection)}]:[]),
                    ];
                    return <li key={connection.id}>
                        <div className="wb-data-connection-row" data-active={active||undefined}>
                            <button type="button" className="wb-data-connection" aria-pressed={active} aria-expanded={expanded}
                                aria-controls={expanded?'wb-data-connection-objects':undefined} disabled={!!operation||disconnecting} onClick={select}>
                                <Icon name={expanded?'chevronDown':'chevronRight'} size={12}/>
                                <span className="wb-data-connection-name">
                                    <strong title={connection.name}>{connection.name}</strong>
                                    <span className="wb-data-connection-meta">
                                        <small className="wb-muted" title={description}>{description}</small>
                                        <small className={'wb-data-connection-state'+(connected?' is-connected':'')}>{status}</small>
                                    </span>
                                </span>
                            </button>
                            <DataWorkspaceMenu label={connection.name+'的更多操作'} items={items}/>
                        </div>
                        {expanded&&catalog}
                    </li>;
                })}
            </ul>:<p className="wb-tiny wb-muted">暂无已保存的连接</p>}
        </div>
    </aside>;

    const conversation=<DataAiConversation turns={turns} pending={pendingInstruction} instruction={instruction}
            source={isSql?'sql':form.kind==='redis'?'redis':'es'} selected={selected}
            editorDraft={isSql&&v.generated?.query===v.query?v.generated:undefined}
            canSend={canSend} busy={!!busy||memorySupport===null} scopeHint={generationScopeHint}
            error={aiError} setInstruction={value=>patch({instruction:value})}
            send={sendInstruction} apply={applyDraft} databaseLabel={form.database||form.name} onClose={()=>setAiVisible(false)}/>;
    const memoryText=memorySupport===null?'正在检查连接记忆支持…':hydrating?'正在恢复连接记忆…':memoryError?'连接记忆恢复失败：'+memoryError:memoryStatus.error?'连接记忆保存失败：'+memoryStatus.error:memorySupport===false?'当前宿主不支持持久记忆，仅保留本页输入':!memoryKey?'连接记忆仅适用于已保存连接':memoryStatus.saving?'连接记忆保存中…':'连接记忆已保存到本机';
    const queryTitle=form.kind==='es'?'DSL 查询':form.kind==='redis'?'Redis 命令':isScriptPreview?'SQL 脚本':'SQL 查询';
    const queryTarget=(form.kind==='es'?queryIndex:undefined)||form.database||form.name||'未选择连接';
    return <div className="wb-data-surface" ref={surface}>
        <header className="wb-data-toolbar" aria-label="开发工具箱">
            <h1 className="wb-data-toolbox-label">工具箱</h1>
            {toolPicker}
            {!connectionsOpen&&<button type="button" className="wb-btn wb-data-open-connections" aria-label="展开连接"
                aria-expanded={false} aria-controls="wb-data-connections" onClick={toggleConnections}>
                <Icon name="database" size={14}/>连接
            </button>}
        </header>
        {layout.compact&&<div className="wb-data-mobile-views" role="tablist" aria-label="数据工作区视图">
            <button type="button" role="tab" aria-selected={aiOpen&&mobileView==='ai'} onClick={()=>{patch({aiOpen:true});setMobileView('ai')}}>AI 查询</button>
            <button type="button" role="tab" aria-selected={!aiOpen||mobileView==='sql'} onClick={()=>setMobileView('sql')}>{isSql?'SQL 与结果':'查询与结果'}</button>
        </div>}
        <div className={'wb-data-workspace'+(connectionsOpen&&!layout.connections?' is-connections-open':'')+(aiOpen?' is-ai-open':'')+(layout.compact?' is-compact':'')}>
        {connectionsOpen&&!layout.connections&&sidebar}
        {aiOpen&&(!layout.compact||mobileView==='ai')&&conversation}
        <div className="wb-data-main" ref={output} hidden={layout.compact&&aiOpen&&mobileView!=='sql'}>
            <header className="wb-data-query-head" aria-label="查询工具栏">
                <div className="wb-data-query-context">
                    <div className="wb-data-query-title">
                        <h2>{queryTitle}</h2>
                        <span className="wb-data-readonly">{isScriptPreview?'仅预览':'只读'}</span>
                    </div>
                    <div className="wb-data-query-meta">
                        <span className="wb-data-query-target" title={queryTarget}>
                            <Icon name="database" size={12}/><span>{queryTarget}</span>
                        </span>
                        {busy&&<span role="status">{busy}中…</span>}
                    </div>
                </div>
                <div className="wb-data-query-actions">
                    {!aiOpen&&<Btn icon="messages" kind="subtle" aria-label="展开 AI 会话" onClick={()=>setAiVisible(true)}>AI 会话</Btn>}
                    <Copy text={v.query} label={isSql?'复制 SQL':'复制脚本'}/>
                    <Btn kind="primary" disabled={!canExecuteQuery} onClick={()=>void executeQuery()} title="执行（⌘ / Ctrl + Enter）">执行只读查询</Btn>
                </div>
            </header>
        {!v.id&&<div className="wb-data-empty"><strong>选择或新建一个连接</strong><Btn onClick={newConnection}>配置数据库</Btn></div>}
        {v.generated?.explanation&&<details className="wb-data-draft-info">
            <summary><Icon name="info" size={13}/>{isScriptPreview?'脚本说明':'查询说明'}</summary>
            <p>{v.generated.explanation}</p>
        </details>}
        <div className="wb-data-editor" style={{flexBasis:editorShare+'%'}}><Textarea aria-label="数据查询编辑器" placeholder={form.kind==='es'?'粘贴 DSL，或从 AI 会话填入':form.kind==='redis'?'粘贴 Redis 命令，或从 AI 会话填入':'粘贴 SQL，或从 AI 会话填入'} onKeyDown={(e:any)=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();if(canExecuteQuery)void executeQuery()}}} rows={8} spellCheck={false} style={{fontFamily:'monospace',height:'100%'}} value={v.query||''} disabled={!!busy||memorySupport===null} onChange={(e:any)=>patch({query:e.target.value,result:null})}/></div>
        <DataEditorSplitter share={editorShare} onChange={setEditorShare}/>

        {v.generated?.rollback&&<details><summary>回滚建议（仅预览）</summary><pre className="wb-code" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{v.generated.rollback}</pre><Copy text={v.generated.rollback}/></details>}
        {error&&!configOpen&&!databaseTarget&&!deleteTarget&&<p role="alert" className="wb-tiny" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',color:'var(--dsw-alias-state-error-primary)'}}>{error}</p>}
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
        <Modal open={!!deleteTarget} title="删除连接" sub={[deleteTarget?.name,deleteTarget?.database].filter(Boolean).join(' · ')} width={440}
            onClose={closeDeleteConnection}
            footer={<><Btn disabled={operation==='删除连接'} onClick={closeDeleteConnection}>取消</Btn><Btn kind="danger" disabled={!!busy} onClick={confirmDeleteConnection}>{operation==='删除连接'?'删除中…':'确认删除'}</Btn></>}>
            <p>将移除这条本地连接配置和已记住的密码。SQL 草稿、AI 会话和最近查询结果会保留。</p>
            {error&&<p role="alert" className="wb-data-connection-error">{error}</p>}
        </Modal>
        <Modal open={!!databaseTarget} title={(pickerNeedsDatabase?'选择 ':'切换 ')+(connectionKinds[databaseTarget?.kind||'']||'')+' 数据库'}
            sub={pickerNeedsDatabase?'选择当前账号可连接的数据库':'当前数据库 · '+(databaseTarget?.database||'')} width={440}
            onClose={()=>{if(!lock.current){clearFeedback();setDatabaseTarget(null)}}}
            footer={<Btn kind="primary" disabled={!!busy||!databaseChoice||databaseChoice===databaseTarget?.database} onClick={switchDatabase}>{operation==='切换数据库'?'连接中…':pickerNeedsDatabase?'连接':'切换'}</Btn>}>
            {operation==='读取数据库'&&<p role="status" className="wb-tiny">正在读取数据库列表…</p>}
            {error&&<p role="alert" className="wb-data-connection-error">{error}</p>}
            {databaseList&&<>
                <form className="wb-data-database-search" onSubmit={event=>{event.preventDefault();searchAllDatabases()}}>
                    <Field label="搜索数据库">
                        <Input type="search" aria-label="搜索数据库" placeholder="输入库名关键词" autoFocus maxLength={200}
                            value={databaseQuery} disabled={!!busy} onChange={(event:React.ChangeEvent<HTMLInputElement>)=>{
                                setDatabaseQuery(event.target.value);
                                setDatabaseMatches(null);
                                setDatabaseChoice('');
                                setError('');
                            }}/>
                    </Field>
                    {canSearchAll&&<Btn disabled={!!busy||!databaseKeyword} onClick={searchAllDatabases}>{operation==='搜索数据库'?'搜索中…':'搜索全部'}</Btn>}
                </form>
                {visibleDatabases.length>0?<div className="wb-data-database-list" role="radiogroup" aria-label="目标数据库">
                    {visibleDatabases.map(database=><label className="wb-data-database-option" key={database}>
                        <input type="radio" name={databaseChoiceGroup} checked={databaseChoice===database} disabled={!!busy}
                            onChange={()=>{setError('');setDatabaseChoice(database)}}/>
                        <span title={database}>{database}</span>
                        {database===databaseTarget?.database&&<small aria-hidden="true" className="wb-muted">当前</small>}
                    </label>)}
                </div>:<p role="status" className="wb-tiny wb-muted">{databaseKeyword?'没有匹配的数据库。':'当前账号没有可选数据库。'}</p>}
                {visibleDatabaseList?.truncated&&<p className="wb-tiny wb-muted">{canSearchAll&&!databaseMatches?'已加载前 500 个库，输入库名后可搜索全部。':'仅显示前 500 项，请缩小搜索范围。'}</p>}
            </>}
        </Modal>
        <Modal open={configOpen} title={configId?'连接配置':'新建连接'} sub={canRememberPassword?'可使用 macOS 钥匙串保护记住的密码':'密码仅在本次宿主进程内保留'}
    onClose={()=>{if(!lock.current){clearFeedback();setConfigDraft(null);setConfigOpen(false)}}}
    footer={<><span role="status" className="wb-data-test-status wb-tiny">{testSuccess?'连接成功':''}</span><Btn className="wb-data-test-button" disabled={!!busy} onClick={testConnection}>{busy==='测试连接'?'测试中…':'测试连接'}</Btn><Btn kind="primary" disabled={!!busy} onClick={saveConnection}>{busy==='保存'?'保存中…':'保存'}</Btn></>}>
<div ref={configFields} className="wb-stack" style={{paddingTop:10}}>
{error&&<p id="wb-data-config-error" role="alert" className="wb-data-connection-error">{error}</p>}
            <div className="wb-split"><Field label="连接名称（必填）"><Input aria-label="连接名称" {...fieldState('name',true)} value={configForm.name} disabled={!!busy} onChange={(e:any)=>edit('name',e.target.value)}/></Field><label className="wb-label">类型<select aria-label="数据库类型" className="wb-select" value={configForm.kind} disabled={!!busy||!!configId} onChange={e=>{clearFeedback();patch({id:v.id??'',form:{...defaults,name:configForm.name,kind:e.target.value,port:({mysql:3306,postgres:5432,es:9200,redis:6379} as any)[e.target.value]},query:initialQuery[e.target.value]})}}>{Object.entries(connectionKinds).map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}</select></label></div>
            {configForm.kind==='es'?<Field label="ES URL（必填）"><Input aria-label="ES URL" {...fieldState('url',true)} value={configForm.url} disabled={!!busy} onChange={(e:any)=>edit('url',e.target.value)}/></Field>:<div className="wb-split"><Field label="主机（必填）"><Input aria-label="数据库主机" {...fieldState('host',true)} value={configForm.host} disabled={!!busy} onChange={(e:any)=>edit('host',e.target.value)}/></Field><Field label="端口（必填）"><Input aria-label="数据库端口" {...fieldState('port',true)} type="number" min={1} max={65535} value={configForm.port} disabled={!!busy} onChange={(e:any)=>edit('port',e.target.value)}/></Field></div>}
            {configForm.kind!=='es'&&<Field label={configForm.kind==='redis'?'Redis DB（默认 0）':databaseRequired?'数据库名称（必填）':'数据库名称（选填）'}>
                <Input aria-label="数据库名称" {...fieldState('database',databaseRequired)} value={configForm.database} disabled={!!busy}
                    placeholder={optionalSqlDatabase&&configIsSql?'留空可在保存后选择数据库':undefined} onChange={(e:any)=>edit('database',e.target.value)}/>
            </Field>}
            <div className="wb-split"><Field label="用户名"><Input aria-label="数据库用户名" autoComplete="off" value={configForm.username} disabled={!!busy} onChange={(e:any)=>edit('username',e.target.value)}/></Field><Field label={passwordRequired?'密码（必填）':'密码'}><Input aria-label="数据库密码" {...fieldState('password',passwordRequired)} type="password" autoComplete="new-password" value={configForm.password} disabled={!!busy} placeholder={!configConnection?.unlocked?'输入密码':'留空沿用原连接密码'} onChange={(e:any)=>edit('password',e.target.value)}/></Field></div>
            {(canRememberPassword||configForm.rememberPassword)&&<label className="wb-row" style={{gap:8}}><input type="checkbox" checked={!!configForm.rememberPassword} disabled={!!busy} onChange={e=>edit('rememberPassword',e.target.checked)}/>记住密码</label>}
            {configForm.kind!=='es'&&<><label className="wb-label"><input type="checkbox" checked={configForm.tls} disabled={!!busy} onChange={e=>edit('tls',e.target.checked)}/> 使用 TLS（校验证书）</label>{configForm.tls&&<Field label="CA证书（PEM，可选）"><Textarea aria-label="数据库CA证书" rows={3} value={configForm.ca} disabled={!!busy} onChange={(e:any)=>edit('ca',e.target.value)}/></Field>}</>}
        </div></Modal>
</div>
}
