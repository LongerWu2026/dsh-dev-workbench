import {randomUUID,createHash} from 'node:crypto'
import {readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs'
import {join} from 'node:path'
import {workbenchDir} from '../platform/runtime.js'
import {canRememberDataPasswords,openDataPassword,sealDataPassword,type PasswordSeal} from './data-passwords.js'

export type DataConfig={id:string;name:string;kind:'mysql'|'postgres'|'es'|'redis';host:string;port:number;database:string;username:string;tls:boolean;ca:string;url:string}
type Entry={config:DataConfig;password:string;client?:any;busy:boolean;timer?:ReturnType<typeof setTimeout>;abort?:AbortController;cancelled:boolean;epoch:number}
const entries=new Map<string,Entry>();const probes=new Set<Entry>();let epoch=0
const restoring=new Map<string,Promise<Entry>>()
const saving=new Set<string>()
type SavedConnection=DataConfig&{passwordSeal?:PasswordSeal}
const ROWS=200,BYTES=1024*1024
const configPath=()=>join(workbenchDir(),'data-connections.json')
function text(v:any,max=200){return String(v??'').trim().slice(0,max)}
function configOf(input:any):DataConfig{
    if(!['mysql','postgres','es','redis'].includes(input?.kind))throw Error('请选择数据库类型');
    const kind=input.kind,port=(input.port===undefined||input.port==='')?Number(({mysql:3306,postgres:5432,redis:6379,es:9200} as any)[kind]):Number(input.port);
    if(!Number.isInteger(port)||port<1||port>65535)throw Error('端口无效');
    const host=text(input.host||'127.0.0.1');if(!host||/[\s/@?#]/.test(host))throw Error('主机名无效');
    const database=text(input.database);if(['mysql','postgres'].includes(kind)&&!database)throw Error('请填写数据库名称');
    if(kind==='redis'&&!/^\d{1,3}$/.test(database||'0'))throw Error('Redis DB 必须为整数');
    let url='';if(kind==='es'){const u=new URL(text(input.url||'http://127.0.0.1:9200',2000));if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('ES 地址仅支持不含凭据和参数的 HTTP/HTTPS 地址');url=u.href.replace(/\/$/,'')}
    return {id:/^[\w-]{1,80}$/.test(input.id||'')?input.id:randomUUID(),name:text(input.name)||kind,kind,host,port,database,username:text(input.username),tls:input.tls===true,ca:text(input.ca,20000),url};
}
function savedConnections():SavedConnection[]{
    let saved:any[]=[];try{saved=JSON.parse(readFileSync(configPath(),'utf8'));if(!Array.isArray(saved))saved=[]}catch(e:any){if(e.code!=='ENOENT')throw Error('连接配置读取失败，请检查本地配置文件')}
    return saved.slice(0,30).map(c=>({...configOf(c),...(c.passwordSeal?{passwordSeal:c.passwordSeal}:{})}));
}
export function dataConnections(){
    return savedConnections().map(({passwordSeal,...config})=>({
        ...config,rememberPassword:!!passwordSeal,connected:!!entries.get(config.id)?.client,
        unlocked:entries.has(config.id)||(canRememberDataPasswords()&&!!passwordSeal),
    }));
}
function passwordTarget(config:DataConfig){
    return JSON.stringify([config.id,config.kind,config.host,config.port,config.url,config.username,config.tls,config.ca]);
}
async function connectionPassword(input:any,config:DataConfig,remembered?:SavedConnection){
    let password=input.password;
    if(typeof password!=='string'){
        const previous=entries.get(config.id),target=passwordTarget(config);
        if(previous&&passwordTarget(previous.config)===target)password=previous.password;
        else if(remembered?.passwordSeal&&passwordTarget(remembered)===target)password=await openDataPassword(remembered.passwordSeal,target);
        else password='';
    }
    if(password.length>4000)throw Error('密码过长');
    return password;
}
export async function saveDataConnection(input:any){
    const config=configOf(input),id=config.id,generation=epoch;
    if(saving.has(id)||entries.get(id)?.busy)throw Error('连接正忙，请先停止操作');
    saving.add(id);
    restoring.delete(id);
    try{
        const saved=savedConnections().find(row=>row.id===id);
        const remember=input.rememberPassword===true||(input.rememberPassword===undefined&&!!saved?.passwordSeal);
        const password=await connectionPassword(input,config,canRememberDataPasswords()?saved:undefined);
        if(remember&&!password)throw Error('请输入要记住的连接密码');
        const passwordSeal=remember?await sealDataPassword(password,passwordTarget(config)):undefined;
        if(generation!==epoch)throw Error('连接服务已重载，请重新保存');
        const configs=savedConnections().filter(row=>row.id!==id);
        if(configs.length>=30)throw Error('最多保存30个连接');
        configs.push({...config,...(passwordSeal?{passwordSeal}:{})});
        mkdirSync(workbenchDir(),{recursive:true});const temp=configPath()+'.tmp';writeFileSync(temp,JSON.stringify(configs,null,2),{mode:0o600});renameSync(temp,configPath());
        const previous=entries.get(id);
        entries.set(id,{config,password,busy:false,cancelled:false,epoch});
        if(previous)await closeEntry(previous);
        return {config:{...config,rememberPassword:remember},unlocked:true};
    }finally{saving.delete(id)}
}
async function entry(value:any):Promise<Entry>{
    const id=String(value);
    if(saving.has(id))throw Error('连接配置正在保存，请稍后重试');
    const current=entries.get(id);
    if(current)return current;
    const pending=restoring.get(id);
    if(pending)return pending;
    const saved=savedConnections().find(row=>row.id===id);
    if(!saved?.passwordSeal)throw Error('连接尚未解锁，请填写密码并保存连接');
    const {passwordSeal,...config}=saved;
    const restore=openDataPassword(passwordSeal,passwordTarget(config)).then(password=>{
        if(restoring.get(id)!==restore)throw Error('连接已变更，请重试');
        const restored={config,password,busy:false,cancelled:false,epoch};
        entries.set(id,restored);
        return restored;
    }).finally(()=>{if(restoring.get(id)===restore)restoring.delete(id)});
    restoring.set(id,restore);
    return restore;
}
async function closeEntry(e:Entry){clearTimeout(e.timer);e.abort?.abort();const client=e.client;e.client=undefined;if(client){try{if(e.config.kind==='redis')client.disconnect();else if(e.config.kind==='mysql')client.destroy();else await client.end()}catch{}}}
export async function disconnectData(id:any){restoring.delete(String(id));const e=entries.get(String(id));if(e){e.cancelled=true;await closeEntry(e);if(entries.get(String(id))===e)entries.delete(String(id))}return {status:'disconnected',note:'已关闭本地连接；正在执行的服务端操作是否结束需以数据库结果为准'};}
export function disposeDataTools(){epoch++;restoring.clear();for(const e of [...entries.values(),...probes]){e.cancelled=true;void closeEntry(e)}entries.clear();probes.clear()}
async function connect(e:Entry){
    if(e.cancelled||e.epoch!==epoch)throw Error('操作已停止');
    if(e.client)return e.client;const c=e.config,ssl=c.tls?{rejectUnauthorized:true,...(c.ca?{ca:c.ca}:{})}:undefined;
    let client:any;
    if(c.kind==='mysql')client=await (await import('mysql2/promise')).default.createConnection({host:c.host,port:c.port,user:c.username,password:e.password,database:c.database,ssl,connectTimeout:10000,multipleStatements:false,supportBigNumbers:true,bigNumberStrings:true,dateStrings:true});
    else if(c.kind==='postgres'){const {Client}=await import('pg');client=new Client({host:c.host,port:c.port,user:c.username,password:e.password,database:c.database,ssl,connectionTimeoutMillis:10000,statement_timeout:30000,query_timeout:32000,application_name:'AIWorkBench-data'});try{await client.connect()}catch(err){await client.end().catch(()=>{});throw err}}
    else if(c.kind==='redis'){const {default:Redis}=await import('ioredis');client=new Redis({host:c.host,port:c.port,username:c.username||undefined,password:e.password||undefined,db:Number(c.database||0),tls:ssl,lazyConnect:true,connectTimeout:10000,commandTimeout:30000,retryStrategy:()=>null,enableOfflineQueue:false,maxRetriesPerRequest:0});client.on('error',()=>{});try{await client.connect()}catch(err){client.disconnect();throw err}}
    else return null;
    client.on('error',()=>{if(e.client===client)e.client=undefined});
    if(e.cancelled||e.epoch!==epoch){if(c.kind==='mysql')client.destroy();else if(c.kind==='redis')client.disconnect();else await client.end();throw Error('操作已停止')}
    e.client=client;return client;
}
async function operation(id:any,fn:(e:Entry)=>Promise<any>){return runOperation(await entry(id),fn)}
async function runOperation(e:Entry,fn:(e:Entry)=>Promise<any>){
    if(entries.get(e.config.id)===e&&saving.has(e.config.id))throw Error('连接配置正在保存，请稍后重试');
    if(e.busy)throw Error('该连接已有操作执行中');
    if([...entries.values(),...probes].filter(x=>x.busy).length>=4)throw Error('同时最多执行4个数据操作');
    e.busy=true;e.cancelled=false;clearTimeout(e.timer);e.abort=new AbortController();let timeout:any;
    try{return await Promise.race([fn(e),new Promise((_,reject)=>{timeout=setTimeout(()=>{e.cancelled=true;void closeEntry(e);reject(Error('操作超时；未自动重试，请核对服务端状态'))},35000)})])}
    catch(err:any){await closeEntry(e);const message=String(err.message||err);throw Error(e.password?message.split(e.password).join('[凭据已隐藏]').slice(0,700):message.slice(0,700))}
    finally{clearTimeout(timeout);e.busy=false;if(entries.get(e.config.id)===e)e.timer=setTimeout(()=>{void closeEntry(e)},120000);e.timer?.unref?.()}
}
async function esRequest(e:Entry,path:string,body?:any){
    const headers:Record<string,string>={'Content-Type':'application/json'};if(e.config.username||e.password)headers.Authorization='Basic '+Buffer.from(e.config.username+':'+e.password).toString('base64');
    const response=await fetch(e.config.url+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:e.abort!.signal});
    const reader=response.body?.getReader();let result='',size=0;const decoder=new TextDecoder();try{while(reader){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>BYTES)throw Error('ES响应超过1MB，请缩小查询范围');result+=decoder.decode(part.value,{stream:true})}}finally{await reader?.cancel().catch(()=>{})}
    result+=decoder.decode();if(!response.ok)throw Error('ES HTTP '+response.status+'：'+result.slice(0,400));return JSON.parse(result);
}
export async function testDataConnection(id:any,draft?:any){
    const probe=async(e:Entry)=>{
        const client=await connect(e);
        if(e.config.kind==='es')await esRequest(e,'/');
        else if(e.config.kind==='redis')await client.ping();
        else await client.query('SELECT 1');
        return {status:'ok',note:'连接成功'};
    };
    if(draft===undefined)return operation(id,probe);

    const config=configOf(draft);
    const saved=savedConnections().find(row=>row.id===config.id);
    const temporary:Entry={config,password:await connectionPassword(draft,config,saved),busy:false,cancelled:false,epoch};
    probes.add(temporary);
    try{return await runOperation(temporary,probe)}
    finally{
        temporary.cancelled=true;
        await closeEntry(temporary);
        probes.delete(temporary);
    }
}
function identifier(s:string,kind:string){return kind==='mysql'?'`'+s.replace(/`/g,'``')+'`':'"'+s.replace(/"/g,'""')+'"'}
type SqlTable = {schemaName:string;name:string;comment?:string}
async function listSqlTables(e:Entry, terms:string[]=[]):Promise<{objects:SqlTable[];truncated:boolean}>{
    const client=await connect(e);
    let rows:SqlTable[];
    if(e.config.kind==='mysql'){
        const match=terms.map(()=>"LOCATE(?, LOWER(CONCAT_WS(' ', TABLE_NAME, TABLE_COMMENT))) > 0").join(' OR ');
        [rows]=await client.query('SELECT TABLE_SCHEMA AS schemaName,TABLE_NAME AS name,TABLE_COMMENT AS comment FROM information_schema.TABLES WHERE TABLE_SCHEMA=?'+(match?' AND ('+match+')':'')+' ORDER BY TABLE_NAME LIMIT 501',[e.config.database,...terms]);
    }else{
        const match=terms.map((_,index)=>`strpos(lower(concat_ws(' ', t.table_name, obj_description(c.oid, 'pg_class'))), $${index+2}) > 0`).join(' OR ');
        ({rows}=await client.query(`SELECT t.table_schema AS "schemaName", t.table_name AS name, obj_description(c.oid, 'pg_class') AS comment
            FROM information_schema.tables t
            JOIN pg_namespace n ON n.nspname=t.table_schema
            JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=t.table_name
            WHERE t.table_catalog=$1 AND t.table_schema NOT IN ('pg_catalog','information_schema')${match?' AND ('+match+')':''}
            ORDER BY t.table_schema,t.table_name LIMIT 501`,[e.config.database,...terms]));
    }
    return {objects:rows.slice(0,500),truncated:rows.length>500};
}
export async function dataObjects(request:any){return operation(request.id,async e=>{
    const kind=e.config.kind;
    if(kind==='mysql'||kind==='postgres')return listSqlTables(e);
    const c=await connect(e);
    if(kind==='es'){const rows=await esRequest(e,'/_cat/indices?format=json&h=index,docs.count,health');return {objects:rows.slice(0,500).map((r:any)=>({name:r.index,comment:r['docs.count']+' 文档 · '+r.health})),truncated:rows.length>500}}
    const cursor=text(request.cursor||'0',30);if(!/^\d+$/.test(cursor))throw Error('游标无效');const [next,keys]=await c.scan(cursor,'MATCH',text(request.pattern||'*',500),'COUNT',100);return {objects:keys.slice(0,500).map((name:string)=>({name})),cursor:next,truncated:keys.length>500};
})}
async function readStructure(e:Entry,selected:any[]){
    if(!Array.isArray(selected)||!selected.length||selected.length>12)throw Error('请选择1至12个表、索引或Key');
    const client=await connect(e),tables=[];
    for(const ref of selected){const name=text(ref.name,300),schemaName=text(ref.schemaName||e.config.database,300);if(!name)throw Error('对象名称为空');
        if(e.config.kind==='mysql'){
            if(schemaName!==e.config.database)throw Error('只能读取当前数据库的表');const [rows]=await client.query('SHOW CREATE TABLE '+identifier(schemaName,'mysql')+'.'+identifier(name,'mysql'));if(!rows[0]?.['Create Table']&&!rows[0]?.['Create View'])throw Error('无法读取表结构');tables.push({name,schemaName,definition:rows[0]['Create Table']||rows[0]['Create View']});
        }else if(e.config.kind==='postgres'){
            const {rows}=await client.query(`SELECT a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS "notNull",col_description(a.attrelid,a.attnum) AS comment FROM pg_attribute a JOIN pg_class t ON t.oid=a.attrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1 AND t.relname=$2 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum LIMIT 1001`,[schemaName,name]);
            if(!rows.length)throw Error('表不存在或没有可见字段');if(rows.length>1000)throw Error('表字段超过1000，请缩小范围');
            const constraints=await client.query('SELECT conname AS name,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1 AND t.relname=$2',[schemaName,name]);
            const indexes=await client.query('SELECT indexname,indexdef FROM pg_indexes WHERE schemaname=$1 AND tablename=$2',[schemaName,name]);tables.push({name,schemaName,columns:rows,constraints:constraints.rows,indexes:indexes.rows});
        }else if(e.config.kind==='es')tables.push({name,mapping:await esRequest(e,'/'+encodeURIComponent(name)+'/_mapping')});
        else tables.push({name,type:await client.type(name),ttl:await client.ttl(name)});
    }
    const encoded=JSON.stringify(tables);if(encoded.length>60000)throw Error('所选结构超过60000字符，请减少对象数量');
    return {tables,hash:createHash('sha256').update(JSON.stringify([e.config.kind,e.config.host,e.config.port,e.config.database,e.config.url,encoded])).digest('hex'),at:new Date().toISOString()};
}
export async function dataStructure(request:any){return operation(request.id,e=>readStructure(e,request.selected))}
export async function checkReadQuery(sql:string,kind:string){
    if(!sql?.trim()||sql.length>50000)throw Error('请输入不超过50000字符的查询');
    const {default:sqlParser}=kind==='mysql'?await import('node-sql-parser/build/mysql.js'):await import('node-sql-parser/build/postgresql.js');const parser=new sqlParser.Parser();let ast:any;try{ast=parser.astify(sql,{database:kind==='mysql'?'MySQL':'Postgresql'})}catch{throw Error('无法解析查询；首版仅支持可解析的单条 SELECT / WITH 查询')}
    const list=Array.isArray(ast)?ast:[ast];if(list.length!==1||list[0]?.type!=='select')throw Error('仅允许单条只读 SELECT / WITH 查询；变更脚本仅可生成预览');
    function visit(node:any){if(!node||typeof node!=='object')return;if(['insert','update','delete','drop','alter','create','call','set','copy'].includes(node.type)||(node.into&&(node.into.type||node.into.position||node.into.expr))||node.locking_read||node.for_update)throw Error('查询包含写入或锁定操作');for(const v of Object.values(node))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(visit):visit(v)}visit(list[0]);
    if(/\b(?:sleep|benchmark|load_file|pg_sleep|pg_read_file|pg_write_file|dblink_exec|lo_export|lo_import|set_config|pg_advisory_lock)\s*\(/i.test(sql))throw Error('不支持该函数');
    return sql.trim().replace(/;\s*$/,'');
}
function sqlPage(request:any){
    const pageSize=request.pageSize===undefined?ROWS:request.pageSize,offset=request.offset===undefined?0:request.offset;
    if(![50,100,200].includes(pageSize))throw Error('每页行数仅支持50、100或200');
    if(!Number.isSafeInteger(offset)||offset<0)throw Error('查询偏移必须为非负安全整数');
    return {pageSize,offset};
}
// MySQL has no text-protocol cursor. Stream the exact original SELECT so ORDER BY,
// CTE/UNION and existing LIMIT/OFFSET retain their database-defined semantics.
// Closing an unfinished read-only transaction rolls it back; never reuse that socket.
async function mysqlPage(e:Entry,client:any,sql:string,pageSize:number,offset:number){
    await client.query('SET SESSION MAX_EXECUTION_TIME=30000');
    await client.query('START TRANSACTION READ ONLY');
    try{return await new Promise<{rows:any[];columns:string[]}>((resolve,reject)=>{
        const rows:any[]=[],signal=e.abort!.signal;let columns:string[]=[],skipped=0,settled=false,timeout:ReturnType<typeof setTimeout>|undefined;
        const finish=(error?:Error,early=false)=>{
            if(settled)return;settled=true;clearTimeout(timeout);signal.removeEventListener('abort',abort);
            if(early)void closeEntry(e);
            if(error)reject(error);else resolve({rows,columns});
        };
        const abort=()=>finish(Error('操作已停止'));
        const stream=client.connection.query(sql);
        stream.on('fields',(fields:any[])=>{columns=fields.map(field=>field.name)});
        stream.on('result',(row:any)=>{
            if(settled)return;
            if(skipped<offset){skipped++;return}
            rows.push(row);if(rows.length>pageSize)finish(undefined,true);
        });
        stream.on('error',(error:Error)=>finish(error,true));
        stream.on('end',()=>finish());
        timeout=setTimeout(()=>finish(Error('查询超时；未自动重试，请核对服务端状态'),true),30000);
        signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
    })}finally{if(e.client===client)await client.query('ROLLBACK').catch(()=>{})}
}
function rowResult(rows:any[],columns:string[],extra:any){
    const truncation={rowLimit:rows.length>extra.pageSize,byteLimit:false,cellLimit:false};
    let bytes=0;const kept=[];
    for(const row of rows.slice(0,extra.pageSize)){
        const next:any={};let cellLimit=false;
        for(const [key,value] of Object.entries(row)){
            let cell:any=Buffer.isBuffer(value)?'[binary] '+value.subarray(0,8192).toString('hex'):typeof value==='bigint'?String(value):value;
            const raw=typeof cell==='string'?cell:JSON.stringify(cell);
            if(raw?.length>16000){cell=raw.slice(0,16000)+'…[单元格已截断]';cellLimit=true}
            next[key]=cell;
        }
        const size=Buffer.byteLength(JSON.stringify(next));
        if(bytes+size>BYTES){if(!kept.length)throw Error('单行结果超过1MB，请减少查询字段或缩小单元格');truncation.byteLimit=true;break}
        bytes+=size;kept.push(next);truncation.cellLimit ||= cellLimit;
    }
    const hasMore=rows.length>kept.length,nextOffset=hasMore?extra.offset+kept.length:null;
    if(nextOffset!==null&&!Number.isSafeInteger(nextOffset))throw Error('后续分页偏移超过安全整数范围');
    return {rows:kept,columns,truncated:Object.values(truncation).some(Boolean),truncation,...extra,hasMore,nextOffset};
}
export async function executeDataQuery(request:any){return operation(request.id,async e=>{
    const start=Date.now(),kind=e.config.kind,client=await connect(e);
    if(request.schemaHash){const current=await readStructure(e,request.selected);if(current.hash!==request.schemaHash)throw Error('结构已变化，请重新生成查询')}
    if(kind==='es'){
        const index=text(request.index,300);if(!index||index.includes('/')||index==='_all')throw Error('请选择一个索引');const body=JSON.parse(String(request.query));if(!body||Array.isArray(body)||typeof body!=='object')throw Error('DSL必须为对象');if(body.scroll||body.pit)throw Error('首版不支持scroll或PIT');
        const result=await esRequest(e,'/'+encodeURIComponent(index)+'/_search',{...body,size:Math.min(ROWS,Math.max(0,Number(body.size??ROWS)||0)),timeout:'15s'});return {kind,result,note:result.timed_out?'ES查询超时，返回部分结果':undefined,durationMs:Date.now()-start};
    }
    if(kind==='redis'){
        const args=JSON.parse(String(request.query));if(!Array.isArray(args)||args.some(v=>typeof v!=='string')||args.length>10)throw Error('命令请使用JSON字符串数组');const command=args[0]?.toUpperCase();
        const arity:any={TYPE:2,TTL:2,PTTL:2,EXISTS:2,STRLEN:2,LLEN:2,HLEN:2,SCARD:2,ZCARD:2};let result:any;
        if(command==='GET'&&args.length===2){const type=await client.type(args[1]);if(type==='none')result=null;else{if(type!=='string')throw Error('GET仅适用于字符串Key');const length=await client.strlen(args[1]);if(length>65536)throw Error('值超过64KB，请缩小读取范围');result=await client.getrange(args[1],0,65535)}}
        else if(command==='LRANGE'&&args.length===4){const from=Number(args[2]),to=Number(args[3]);if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<from||to-from>=200)throw Error('LRANGE仅支持最多200项的非负区间');result=await client.lrange(args[1],from,to)}
        else if(['HSCAN','SSCAN','ZSCAN'].includes(command)&&args.length===3&&/^\d+$/.test(args[2]))result=await client.call(command,args[1],args[2],'COUNT',100);
        else if(arity[command]===args.length)result=await client.call(command,...args.slice(1));else throw Error('仅支持GET/TYPE/TTL/PTTL/EXISTS/STRLEN/LLEN/HLEN/SCARD/ZCARD/LRANGE/HSCAN/SSCAN/ZSCAN只读命令');
        if(Buffer.byteLength(JSON.stringify(result))>BYTES)throw Error('Redis结果超过1MB，请缩小范围');return {kind,result,durationMs:Date.now()-start};
    }
    const page=sqlPage(request),sql=await checkReadQuery(String(request.query||''),kind);let rows:any[]=[],columns:string[]=[];
    if(kind==='postgres'){
        const {default:Cursor}=await import('pg-cursor');await client.query('BEGIN READ ONLY');
        try{
            await client.query("SET LOCAL statement_timeout = '30s'");
            const cursor=client.query(new Cursor(sql));
            try{
                let remaining=page.offset;
                while(remaining>0){
                    if(e.cancelled)throw Error('操作已停止');
                    const count=Math.min(ROWS,remaining),skipped=await cursor.read(count);
                    remaining-=skipped.length;if(skipped.length<count)break;
                }
                rows=remaining>0?[]:await cursor.read(page.pageSize+1);
                columns=cursor._result?.fields?.map((f:any)=>f.name)||Object.keys(rows[0]||{});
            }finally{await cursor.close()}
        }finally{await client.query('ROLLBACK').catch(()=>{})}
    }else({rows,columns}=await mysqlPage(e,client,sql,page.pageSize,page.offset));
    if(e.cancelled)throw Error('操作已停止');return rowResult(rows,columns,{kind,...page,queriedAt:new Date().toISOString(),durationMs:Date.now()-start});
})}
export async function readDataGenerationContext(
    request:any,
    chooseTables:(catalog:SqlTable[])=>Promise<SqlTable[]>,
){
    const connection=await entry(request.id);
    let selected=request.selected;
    if(selected===undefined||(Array.isArray(selected)&&selected.length===0)){
        if(!['mysql','postgres'].includes(connection.config.kind))throw Error('请先选择索引或 Key');
        const catalog=await operation(request.id,async e=>{
            const initial=await listSqlTables(e);
            const compact=(rows:SqlTable[])=>rows.map(({schemaName,name,comment})=>({schemaName,name,comment:comment?.slice(0,160)}));
            let rows=compact(initial.objects);
            if(initial.truncated||JSON.stringify(rows).length>24000){
                const generic=new Set(['查询','统计','生成','脚本','最近','每天','表','select','from','sql','query']);
                const words=new Intl.Segmenter('zh',{granularity:'word'}).segment(String(request.instruction).toLowerCase());
                const terms=[...new Set([...words].filter(word=>word.isWordLike&&word.segment.length>=2&&!generic.has(word.segment)).map(word=>word.segment))].slice(0,12);
                if(!terms.length)throw Error('表较多，请补充具体业务关键词或表名，也可以手动选表');
                const matched=await listSqlTables(e,terms);
                rows=compact(matched.objects);
                if(matched.truncated||JSON.stringify(rows).length>24000)throw Error('匹配到的表较多，请补充更具体的业务关键词或表名');
            }
            if(!rows.length)throw Error('当前连接未找到匹配的表，请核对库名或补充表名');
            return rows;
        });
        selected=await chooseTables(catalog);
    }
    return operation(request.id,async e=>{
        if(e!==connection)throw Error('连接配置已变化，请重新生成');
        if(request.mode==='script'&&!['mysql','postgres'].includes(e.config.kind))throw Error('变更脚本生成仅用于 SQL 数据库');
        const structure=await readStructure(e,selected);
        const resolved=structure.tables.map(({name,schemaName})=>({name,...(schemaName?{schemaName}:{})}));
        return {context:{kind:e.config.kind,database:e.config.database,...structure},selected:resolved};
    });
}
