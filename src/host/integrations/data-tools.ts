import {randomUUID,createHash} from 'node:crypto'
import {readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs'
import {join} from 'node:path'
import {workbenchDir} from '../platform/runtime.js'
import {findCatalogTables,invalidateCatalog,type CatalogTable as SqlTable} from '../storage/data-catalog-cache.js'
import {canRememberDataPasswords,openDataPassword,sealDataPassword,type PasswordSeal} from './data-passwords.js'

export type DataConfig={id:string;name:string;kind:'mysql'|'postgres'|'es'|'redis';host:string;port:number;database:string;username:string;tls:boolean;ca:string;url:string}
type Entry={config:DataConfig;password:string;client?:any;busy:boolean;timer?:ReturnType<typeof setTimeout>;abort?:AbortController;cancelled:boolean;epoch:number}
const entries=new Map<string,Entry>();const probes=new Set<Entry>();let epoch=0
const restoring=new Map<string,Promise<Entry>>()
const saving=new Set<string>()
const switchingDatabases=new Set<string>()
type SavedConnection=DataConfig&{passwordSeal?:PasswordSeal}
const ROWS=200,BYTES=1024*1024
const configPath=()=>join(workbenchDir(),'data-connections.json')
function text(v:any,max=200){return String(v??'').trim().slice(0,max)}
function configOf(input:any):DataConfig{
    if(!['mysql','postgres','es','redis'].includes(input?.kind))throw Error('请选择数据库类型');
    const kind=input.kind,port=(input.port===undefined||input.port==='')?Number(({mysql:3306,postgres:5432,redis:6379,es:9200} as any)[kind]):Number(input.port);
    if(!Number.isInteger(port)||port<1||port>65535)throw Error('端口无效');
    const host=text(input.host||'127.0.0.1');if(!host||/[\s/@?#]/.test(host))throw Error('主机名无效');
    const database=text(input.database);
    if(kind==='redis'&&!/^\d{1,3}$/.test(database||'0'))throw Error('Redis DB 必须为整数');
    let url='';if(kind==='es'){const u=new URL(text(input.url||'http://127.0.0.1:9200',2000));if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('ES 地址仅支持不含凭据和参数的 HTTP/HTTPS 地址');url=u.href.replace(/\/$/,'')}
    return {id:/^[\w-]{1,80}$/.test(input.id||'')?input.id:randomUUID(),name:text(input.name)||kind,kind,host,port,database,username:text(input.username),tls:input.tls===true,ca:text(input.ca,20000),url};
}
function savedConnections():SavedConnection[]{
    let saved:any[]=[];try{saved=JSON.parse(readFileSync(configPath(),'utf8'));if(!Array.isArray(saved))saved=[]}catch(e:any){if(e.code!=='ENOENT')throw Error('连接配置读取失败，请检查本地配置文件')}
    return saved.slice(0,30).map(c=>({...configOf(c),...(c.passwordSeal?{passwordSeal:c.passwordSeal}:{})}));
}
function writeConnections(configs:SavedConnection[]){
    mkdirSync(workbenchDir(),{recursive:true});
    const temporary=configPath()+'.tmp';
    writeFileSync(temporary,JSON.stringify(configs,null,2),{mode:0o600});
    renameSync(temporary,configPath());
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
async function activateDataConnection(config:DataConfig,password:string,rememberPassword:boolean){
    const previous=entries.get(config.id);
    restoring.delete(config.id);
    entries.set(config.id,{config,password,busy:false,cancelled:false,epoch});
    if(previous)await closeEntry(previous);
    return {config:{...config,rememberPassword},unlocked:true};
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
        writeConnections(configs);
        return await activateDataConnection(config,password,remember);
    }finally{saving.delete(id)}
}
export async function deleteDataConnection(id:unknown){
    if(typeof id!=='string'||!(/^[\w-]{1,80}$/).test(id))throw Error('连接编号无效');
    if(saving.has(id)||entries.get(id)?.busy)throw Error('连接正忙，请先停止操作');
    saving.add(id);
    try{
        const configs=savedConnections(),remaining=configs.filter(config=>config.id!==id);
        if(remaining.length!==configs.length)writeConnections(remaining);
        await disconnectData(id);
        return {deleted:id};
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
function isSqlConnection(config:DataConfig){
    return config.kind==='mysql'||config.kind==='postgres';
}
function requireSqlDatabase(config:DataConfig){
    if(isSqlConnection(config)&&!config.database)throw Error('请先选择要查询的数据库');
}
async function connectPostgres(e:Entry,ssl:{rejectUnauthorized:boolean;ca?:string}|undefined){
    const {Client}=await import('pg'),c=e.config;
    const candidates=c.database?[c.database]:[...new Set(['postgres',c.username].filter(Boolean))];
    let lastError:unknown;
    for(const database of candidates){
        if(e.cancelled||e.epoch!==epoch)throw Error('操作已停止');
        const client=new Client({host:c.host,port:c.port,user:c.username,password:e.password,database,ssl,
            connectionTimeoutMillis:10000,statement_timeout:30000,query_timeout:32000,application_name:'AIWorkBench-data'});
        try{
            await client.connect();
            return client;
        }catch(error:any){
            await client.end().catch(()=>{});
            const databaseRejected=['3D000','42501'].includes(error.code)||error.code==='28000'&&/pg_hba\.conf/.test(error.message);
            if(c.database||!databaseRejected)throw error;
            lastError=error;
        }
    }
    throw Error('默认库不可连接，请填写一个账号有权连接的数据库名称。',{cause:lastError});
}
async function connect(e:Entry){
    if(e.cancelled||e.epoch!==epoch)throw Error('操作已停止');
    if(e.client)return e.client;const c=e.config,ssl=c.tls?{rejectUnauthorized:true,...(c.ca?{ca:c.ca}:{})}:undefined;
    let client:any;
    if(c.kind==='mysql')client=await (await import('mysql2/promise')).default.createConnection({host:c.host,port:c.port,user:c.username,password:e.password,database:c.database||undefined,ssl,connectTimeout:10000,multipleStatements:false,supportBigNumbers:true,bigNumberStrings:true,dateStrings:true});
    else if(c.kind==='postgres')client=await connectPostgres(e,ssl);
    else if(c.kind==='redis'){const {default:Redis}=await import('ioredis');client=new Redis({host:c.host,port:c.port,username:c.username||undefined,password:e.password||undefined,db:Number(c.database||0),tls:ssl,lazyConnect:true,connectTimeout:10000,commandTimeout:30000,retryStrategy:()=>null,enableOfflineQueue:false,maxRetriesPerRequest:0});client.on('error',()=>{});try{await client.connect()}catch(err){client.disconnect();throw err}}
    else return null;
    client.on('error',()=>{if(e.client===client)e.client=undefined});
    if(e.cancelled||e.epoch!==epoch){if(c.kind==='mysql')client.destroy();else if(c.kind==='redis')client.disconnect();else await client.end();throw Error('操作已停止')}
    e.client=client;return client;
}
async function operation(id:any,fn:(e:Entry)=>Promise<any>){return runOperation(await entry(id),fn)}
async function runOperation(e:Entry,fn:(e:Entry)=>Promise<any>){
    if(!probes.has(e)&&entries.get(e.config.id)!==e)throw Error('连接已变更，请重新选择');
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
const DATABASE_LIST_LIMIT=500;
export function listDataDatabases(id:unknown,query?:unknown){
    const keyword=text(query);
    return operation(id,async source=>{
        if(!isSqlConnection(source.config))throw Error('只有 PostgreSQL 和 MySQL 支持此处切换数据库');
        const client=await connect(source);
        const rows:{name:string}[]=source.config.kind==='postgres'
            ?(await client.query(`SELECT datname AS name FROM pg_catalog.pg_database
                WHERE datallowconn AND NOT datistemplate AND pg_catalog.has_database_privilege(oid, 'CONNECT')
                  AND strpos(lower(datname::text), lower($1)) > 0
                ORDER BY datname LIMIT ${DATABASE_LIST_LIMIT+1}`,[keyword])).rows
            :(await client.query(`SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA
                WHERE LOCATE(LOWER(?), LOWER(SCHEMA_NAME)) > 0
                ORDER BY SCHEMA_NAME LIMIT ${DATABASE_LIST_LIMIT+1}`,[keyword]))[0];
        return {databases:rows.slice(0,DATABASE_LIST_LIMIT).map(row=>row.name),truncated:rows.length>DATABASE_LIST_LIMIT};
    });
}
export async function switchDataDatabase(id:unknown,database:unknown){
    const source=await entry(id);
    if(!isSqlConnection(source.config))throw Error('只有 PostgreSQL 和 MySQL 支持此处切换数据库');
    if(typeof database!=='string'||!database||database!==text(database)||database.includes('\0'))throw Error('数据库名称无效');
    const account=passwordTarget({...source.config,id:''});
    const key=JSON.stringify([account,database]);
    if(switchingDatabases.has(key))throw Error('正在连接该数据库，请稍后重试');
    switchingDatabases.add(key);
    try{
        const target={...source.config,database};
        // Verify the new database with a temporary client before changing any saved connection.
        await testDataConnection(undefined,{...target,id:undefined,password:source.password});
        if(entries.get(source.config.id)!==source||source.cancelled||source.epoch!==epoch)throw Error('原连接已变更，请重新切换数据库');
        const configs=savedConnections();
        const existing=configs.find(config=>config.database===database&&passwordTarget({...config,id:''})===account);
        if(existing){
            if(saving.has(existing.id)||entries.get(existing.id)?.busy)throw Error('目标连接正忙，请稍后重试');
            const {passwordSeal,...config}=existing;
            return await activateDataConnection(config,source.password,!!passwordSeal);
        }
        const rememberPassword=canRememberDataPasswords()&&!!configs.find(config=>config.id===source.config.id)?.passwordSeal;
        return await saveDataConnection({...target,id:undefined,password:source.password,rememberPassword});
    }finally{
        switchingDatabases.delete(key);
    }
}
function identifier(s:string,kind:string){return kind==='mysql'?'`'+s.replace(/`/g,'``')+'`':'"'+s.replace(/"/g,'""')+'"'}
type SqlTableList = {objects:SqlTable[];truncated:boolean}
const SQL_CATALOG_SCAN_LIMIT=10000;
async function listSqlTables(e:Entry, {terms=[],keyword='',limit=500,includeComments=true,references=[]}:{terms?:string[];keyword?:string;limit?:number;includeComments?:boolean;references?:SqlTable[]}={}):Promise<SqlTableList>{
    requireSqlDatabase(e.config);
    const client=await connect(e);
    const searchTerms=keyword?[keyword]:terms;
    const parameters=[e.config.database,...searchTerms,...references.flatMap(({schemaName,name})=>[schemaName,name])];
    let rows:SqlTable[];
    if(e.config.kind==='mysql'){
        const name=keyword?"CONCAT(TABLE_SCHEMA, '.', TABLE_NAME)":'TABLE_NAME';
        const match=searchTerms.map(()=>`LOCATE(?, LOWER(CONCAT_WS(' ', ${name}, TABLE_COMMENT))) > 0`).join(' OR ');
        const comment=includeComments?',TABLE_COMMENT AS comment':'';
        const refFilter=references.length?` AND (TABLE_SCHEMA,TABLE_NAME) IN (${references.map(()=>'(?,?)').join(',')})`:'';
        [rows]=await client.query(`SELECT TABLE_SCHEMA AS schemaName,TABLE_NAME AS name${comment} FROM information_schema.TABLES WHERE TABLE_SCHEMA=?${match?' AND ('+match+')':''}${refFilter} ORDER BY TABLE_NAME LIMIT ${limit+1}`,parameters);
    }else{
        const name=keyword?"concat(t.table_schema, '.', t.table_name)":'t.table_name';
        const match=searchTerms.map((_,index)=>`strpos(lower(concat_ws(' ', ${name}, obj_description(c.oid, 'pg_class'))), $${index+2}) > 0`).join(' OR ');
        const comment=includeComments?", obj_description(c.oid, 'pg_class') AS comment":'';
        const refFilter=references.length?` AND (t.table_schema,t.table_name) IN (${references.map((_,index)=>`($${searchTerms.length+2*index+2},$${searchTerms.length+2*index+3})`).join(',')})`:'';
        ({rows}=await client.query(`SELECT t.table_schema AS "schemaName", t.table_name AS name${comment}
            FROM information_schema.tables t
            JOIN pg_namespace n ON n.nspname=t.table_schema
            JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=t.table_name
            WHERE t.table_catalog=$1 AND t.table_schema NOT IN ('pg_catalog','information_schema')${match?' AND ('+match+')':''}${refFilter}
            ORDER BY t.table_schema,t.table_name LIMIT ${limit+1}`,parameters));
    }
    return {objects:rows.slice(0,limit),truncated:rows.length>limit};
}
const tableKey=({schemaName,name}:SqlTable)=>JSON.stringify([schemaName,name]);
const catalogKey=(e:Entry)=>createHash('sha256').update(JSON.stringify([passwordTarget(e.config),e.config.database])).digest('hex');
async function loadSqlCatalog(e:Entry){
    const directory=await listSqlTables(e,{limit:SQL_CATALOG_SCAN_LIMIT});
    if(directory.truncated)return null;
    const entries=new Map(directory.objects.map(table=>[tableKey(table),{...table,fields:[] as string[]}]));
    if(!entries.size)return [];
    const client=await connect(e);
    const mysql=e.config.kind==='mysql';
    const fieldLimit=16;
    const query=`SELECT table_schema AS "schemaName", table_name AS "name", column_name AS "column"
        FROM information_schema.columns
        WHERE ${mysql?'table_schema=?':"table_catalog=$1 AND table_schema NOT IN ('pg_catalog','information_schema')"}
          AND ordinal_position<=${fieldLimit}
        ORDER BY table_schema,table_name,ordinal_position LIMIT ${SQL_CATALOG_SCAN_LIMIT*fieldLimit+1}`;
    const result=await client.query(query,[e.config.database]);
    const fields:(SqlTable & {column:string})[]=mysql?result[0]:result.rows;
    if(fields.length>SQL_CATALOG_SCAN_LIMIT*fieldLimit)return null;
    for(const field of fields){
        if(typeof field.column==='string')entries.get(tableKey(field))?.fields.push(field.column);
    }
    if(e.cancelled||e.epoch!==epoch)throw Error('操作已停止');
    return [...entries.values()];
}
async function cachedSqlMatches(e:Entry,query:{keyword:string}|{terms:string[]}){
    const matches=await findCatalogTables(catalogKey(e),query,()=>loadSqlCatalog(e));
    if(!matches?.length||matches.length>500)return undefined;
    // Cache hits carry names only. Recheck metadata visibility under the active login.
    const live=await listSqlTables(e,{references:matches,...('keyword' in query?query:{})});
    const visible=new Map(live.objects.map(table=>[tableKey(table),table]));
    if('keyword' in query){
        const requested=new Set(matches.map(tableKey));
        return {...live,objects:live.objects.filter(table=>requested.has(tableKey(table)))};
    }
    return {objects:matches.flatMap(table=>visible.get(tableKey(table))??[]),truncated:false};
}
async function searchSqlTables(e:Entry,keyword:string){
    const cached=await cachedSqlMatches(e,{keyword});
    return cached?.objects.length?cached:listSqlTables(e,{keyword});
}
async function listEsIndices(e:Entry){
    return await esRequest(e,'/_cat/indices?format=json&h=index,docs.count,health') as
        {index:string;'docs.count':string;health:string}[];
}
function esIndexName(value:unknown){
    const name=text(value,300);
    if(!name||['.','..','_all'].includes(name)||/[\\/*?"<>|,#:\s]/u.test(name))throw Error('请选择一个具体索引');
    return name;
}
async function resolveEsIndex(e:Entry,instruction:string){
    const names=new Set((instruction.match(/\x60[^\x60\r\n]+\x60|"[^"\r\n]+"|“[^”\r\n]+”|[\w.+*?\-]+/g)??[])
        .map(value=>value.replace(/^[\x60"“]|[\x60"”]$/g,'')));
    const matches=[...new Set((await listEsIndices(e)).map(row=>row.index).filter(name=>names.has(name)))];
    if(!matches.length)throw Error('当前连接未找到指定索引，请填写完整索引名或在左侧勾选');
    if(matches.length>1)throw Error('需求中匹配到多个索引，请指定一个索引');
    return [{name:esIndexName(matches[0])}];
}
export async function dataObjects(request:any){return operation(request.id,async e=>{
    const kind=e.config.kind;
    if(kind==='mysql'||kind==='postgres'){
        if(request.refresh===true)await invalidateCatalog(catalogKey(e));
        const keyword=text(request.query).toLowerCase();
        return keyword?searchSqlTables(e,keyword):listSqlTables(e);
    }
    const c=await connect(e);
    if(kind==='es'){const rows=await listEsIndices(e);return {objects:rows.slice(0,500).map(r=>({name:r.index,comment:r['docs.count']+' 文档 · '+r.health})),truncated:rows.length>500}}
    const cursor=text(request.cursor||'0',30);if(!/^\d+$/.test(cursor))throw Error('游标无效');const [next,keys]=await c.scan(cursor,'MATCH',text(request.pattern||'*',500),'COUNT',100);return {objects:keys.slice(0,500).map((name:string)=>({name})),cursor:next,truncated:keys.length>500};
})}
async function readStructure(e:Entry,selected:any[]){
    requireSqlDatabase(e.config);
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
        }else if(e.config.kind==='es')tables.push({name,mapping:await esRequest(e,'/'+encodeURIComponent(esIndexName(name))+'/_mapping')});
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
    requireSqlDatabase(e.config);
    const start=Date.now(),kind=e.config.kind,client=await connect(e);
    if(request.schemaHash){const current=await readStructure(e,request.selected);if(current.hash!==request.schemaHash)throw Error('结构已变化，请重新生成查询')}
    if(kind==='es'){
        const index=esIndexName(request.index);
        if(request.schemaHash&&index!==request.selected[0]?.name)throw Error('查询的索引已变更，请重新生成');
        const body=JSON.parse(String(request.query));if(!body||Array.isArray(body)||typeof body!=='object')throw Error('DSL必须为对象');if(body.scroll||body.pit)throw Error('首版不支持scroll或PIT');
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
const SQL_CATALOG_CONTEXT_LIMIT=24000;
function compactSqlCatalog({objects,truncated}:SqlTableList):SqlTable[]{
    if(truncated)return [];
    const rows=objects.map(({schemaName,name,comment})=>({schemaName,name,comment:comment?.slice(0,160)}));
    return JSON.stringify(rows).length<=SQL_CATALOG_CONTEXT_LIMIT?rows:[];
}
async function readSqlColumnExamples(e:Entry,tables:SqlTable[],fieldsPerTable=8){
    if(!tables.length)return [];
    const client=await connect(e);
    const mysql=e.config.kind==='mysql';
    const refs=tables.map((_,i)=>mysql?'(?,?)':`($${2*i+2},$${2*i+3})`).join(',');
    const databaseColumn=mysql?'table_schema':'table_catalog';
    const query=`SELECT table_schema AS "schemaName", table_name AS "name", column_name AS "column"
        FROM information_schema.columns WHERE ${databaseColumn}=${mysql?'?':'$1'}
        AND (table_schema, table_name) IN (${refs}) AND ordinal_position<=${Math.max(24,fieldsPerTable)}
        ORDER BY table_schema,table_name,ordinal_position`;
    const result=await client.query(query,[e.config.database,...tables.flatMap(({schemaName,name})=>[schemaName,name])]);
    const rows:{schemaName:string;name:string;column:string}[]=mysql?result[0]:result.rows;
    const columns=new Map<string,string[]>();
    const counts=new Map<string,number>();
    for(const {schemaName,name,column} of rows){
        const key=JSON.stringify([schemaName,name]);
        const fields=columns.get(key)??[];
        fields.push(column);
        columns.set(key,fields);
        counts.set(column,(counts.get(column)??0)+1);
    }
    return tables.flatMap(({schemaName,name})=>{
        const fields=columns.get(JSON.stringify([schemaName,name]));
        if(!fields?.length)return [];
        const sample=fields.sort((a,b)=>(counts.get(a)??0)-(counts.get(b)??0)).slice(0,fieldsPerTable);
        return [{table:`${schemaName}.${name}`,columns:sample}];
    });
}
async function summarizeSqlCatalog(e:Entry){
    const {objects,truncated}=await listSqlTables(e,{limit:SQL_CATALOG_SCAN_LIMIT,includeComments:false});
    const groups=new Map<string,{schemaName:string;prefix:string;names:string[]}>();
    const wordCounts=new Map<string,number>();
    for(const {schemaName,name} of objects){
        const prefix=name.split('_').filter(part=>part&&!/^\d+$/.test(part)).slice(0,2).join('_');
        const key=JSON.stringify([schemaName,prefix]);
        const group=groups.get(key)??{schemaName,prefix,names:[]};
        group.names.push(name);
        groups.set(key,group);
        const words=new Set(name.toLowerCase().split(/[^\p{L}\p{N}]+/u));
        for(const word of words){
            if(word.length>=3&&/^\p{L}/u.test(word))wordCounts.set(word,(wordCounts.get(word)??0)+1);
        }
    }
    const namingWords=[...wordCounts].sort((a,b)=>b[1]-a[1]).slice(0,200).map(([word])=>word);
    const tableGroups=[...groups.values()].sort((a,b)=>b.names.length-a.names.length).slice(0,80).map(({schemaName,prefix,names})=>({
        schemaName,prefix,tableCount:names.length,
        sampleTables:names.sort((a,b)=>a.length-b.length||a.localeCompare(b)).slice(0,5),
    }));
    const representatives=tableGroups.flatMap(({schemaName,sampleTables})=>sampleTables.slice(0,3).map(name=>({schemaName,name}))).slice(0,90);
    const columnExamples=await readSqlColumnExamples(e,representatives);
    return {database:e.config.database,tablesRead:objects.length,truncated,namingWords,tableGroups,columnExamples};
}
async function searchExpandedSqlCatalog(e:Entry,terms:string[]){
    let catalog=new Map<string,SqlTable>();
    const representatives=new Map<string,SqlTable>();
    for(const term of terms){
        const matches=compactSqlCatalog(await searchSqlTables(e,term));
        if(!matches.length)continue;
        const merged=new Map(catalog);
        for(const row of matches)merged.set(JSON.stringify([row.schemaName,row.name]),row);
        if(JSON.stringify([...merged.values()]).length>SQL_CATALOG_CONTEXT_LIMIT)continue;
        catalog=merged;
        const exact=matches.filter(row=>row.name.toLowerCase()===term||`${row.schemaName}.${row.name}`.toLowerCase()===term);
        const main=exact.length?exact.slice(0,2):matches.sort((a,b)=>a.name.length-b.name.length).slice(0,1);
        for(const row of main)representatives.set(JSON.stringify([row.schemaName,row.name]),row);
    }
    const evidence=await readSqlColumnExamples(e,[...representatives.values()],32);
    return {catalog:[...catalog.values()],evidence};
}
export async function readDataGenerationContext(
    request:any,
    chooseTables:(catalog:SqlTable[],evidence:Awaited<ReturnType<typeof readSqlColumnExamples>>)=>Promise<SqlTable[]>,
    expandTerms?:(directory:Awaited<ReturnType<typeof summarizeSqlCatalog>>)=>Promise<unknown>,
){
    const connection=await entry(request.id);
    requireSqlDatabase(connection.config);
    const checkConnection=(e:Entry)=>{if(e!==connection)throw Error('连接配置已变化，请重新生成')};
    let selected=request.selected;
    const missingSelection=selected===undefined||(Array.isArray(selected)&&selected.length===0);
    const autoIndex=connection.config.kind==='es'&&missingSelection;
    if(missingSelection&&!autoIndex){
        if(!['mysql','postgres'].includes(connection.config.kind))throw Error('请先选择索引或 Key');
        let evidence:Awaited<ReturnType<typeof readSqlColumnExamples>>=[];
        let catalog=await operation(request.id,async e=>{
            checkConnection(e);
            const initial=await listSqlTables(e);
            if(!initial.objects.length)throw Error('当前库没有可见的表，请核对数据库和账号权限');
            const complete=compactSqlCatalog(initial);
            if(complete.length)return complete;
            const generic=new Set(['查询','统计','生成','脚本','最近','每天','表','select','from','sql','query']);
            const words=new Intl.Segmenter('zh',{granularity:'word'}).segment(String(request.catalogInstruction??request.instruction).toLowerCase());
            const terms=[...new Set([...words].filter(word=>word.isWordLike&&word.segment.length>=2&&!generic.has(word.segment)).map(word=>word.segment))].slice(0,12);
            if(!terms.length)return [];
            const literal=await listSqlTables(e,{terms});
            if(literal.objects.length)return compactSqlCatalog(literal);
            const cached=await cachedSqlMatches(e,{terms});
            return cached?compactSqlCatalog(cached):[];
        });
        if(!catalog.length&&expandTerms){
            const directory=await operation(request.id,async e=>{
                checkConnection(e);
                return summarizeSqlCatalog(e);
            });
            const expanded=await expandTerms(directory);
            const terms=Array.isArray(expanded)?[...new Set(expanded.slice(0,12).filter((term):term is string=>typeof term==='string')
                .map(term=>term.trim().toLowerCase()).filter(term=>/^[\p{L}\p{N}_][\p{L}\p{N}_. -]{1,63}$/u.test(term)))].slice(0,6):[];
            if(terms.length){
                const expandedCatalog=await operation(request.id,async e=>{
                    checkConnection(e);
                    return searchExpandedSqlCatalog(e,terms);
                });
                catalog=expandedCatalog.catalog;
                evidence=expandedCatalog.evidence;
            }
        }
        if(!catalog.length)throw Error('未能根据需求找到匹配的表，请补充业务对象或在需求中写明表名');
        selected=await chooseTables(catalog,evidence);
    }
    return operation(request.id,async e=>{
        checkConnection(e);
        if(request.mode==='script'&&!['mysql','postgres'].includes(e.config.kind))throw Error('变更脚本生成仅用于 SQL 数据库');
        const targets=autoIndex?await resolveEsIndex(e,String(request.instruction??'')):selected;
        const structure=await readStructure(e,targets);
        const resolved=structure.tables.map(({name,schemaName})=>({name,...(schemaName?{schemaName}:{})}));
        return {context:{kind:e.config.kind,database:e.config.database,...structure},selected:resolved};
    });
}
