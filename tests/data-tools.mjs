process.on('uncaughtException',err=>{console.error(err);process.exit(1)})
/** Isolated protocol tests. No existing database or user credentials are accessed. */
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtempSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,join} from 'node:path'
import {createServer as httpServer} from 'node:http'
import {createServer as tcpServer} from 'node:net'
import {execFile,execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {promisify} from 'node:util'
import mysql from 'mysql2'
const home=mkdtempSync(join(tmpdir(),'wb-data-'));process.env.DSH_HOME=home
const target=resolve('.tmp/data-validation/data-test.mjs');await build({stdin:{contents:`export * from './src/host/integrations/data-tools.ts';export {dataService} from './src/host/application/data-service.ts';export {setShared_workbenchCtx} from './src/host/application/service-context.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:target,bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent'})
const api=await import(target+'?'+Date.now());let passed=0
const check=(name,fn)=>{fn();passed++;console.log('✓ '+name)}
for(const sql of ['SELECT 1','WITH x AS (SELECT 1 AS a) SELECT * FROM x'])await api.checkReadQuery(sql,'postgres')
for(const sql of ['DELETE FROM orders','SELECT 1; SELECT 2','WITH x AS (DELETE FROM orders RETURNING *) SELECT * FROM x','SELECT * INTO backup FROM orders','SELECT pg_sleep(3)','SELECT * FROM orders FOR UPDATE'])await assert.rejects(api.checkReadQuery(sql,'postgres'))
check('AST允许单条查询，拒绝多语句、数据修改CTE、SELECT INTO、锁定及阻塞函数',()=>{})
const requests=[];let mappingType='keyword',slow=false
const es=httpServer((req,res)=>{requests.push({url:req.url,method:req.method,auth:req.headers.authorization});res.setHeader('content-type','application/json');if(req.url==='/'){res.end('{"version":{"number":"8.0"}}');return}if(req.url.startsWith('/_cat')){res.end('[{"index":"orders","docs.count":"2","health":"green"}]');return}if(req.url.endsWith('/_mapping')){res.end(JSON.stringify({orders:{mappings:{properties:{code:{type:mappingType}}}}}));return}let body='';req.on('data',b=>body+=b);req.on('end',()=>{requests.at(-1).body=JSON.parse(body);if(!slow)res.end('{"hits":{"total":{"value":1},"hits":[{"_source":{"code":"测试"}}]}}')})})
await new Promise(r=>es.listen(0,'127.0.0.1',r));
const base={name:'Fixture ES',kind:'es',host:'127.0.0.1',port:9200,url:'http://127.0.0.1:'+es.address().port,username:'fixture',password:'fixture-secret',database:''};const saved=await api.saveDataConnection(base),id=saved.config.id
await api.testDataConnection(id);const objects=await api.dataObjects({id});assert.equal(objects.objects[0].name,'orders')
const selected=[{name:'orders'}],structure=await api.dataStructure({id,selected});const result=await api.executeDataQuery({id,index:'orders',query:'{"query":{"match_all":{}},"size":10000}',schemaHash:structure.hash,selected});
check('ES真实HTTP连接、Mapping读取和搜索；服务端限制结果数量',()=>{assert.equal(result.result.hits.hits[0]._source.code,'测试');assert.equal(requests.at(-1).body.size,200);assert.equal(requests.at(-1).method,'POST')})
mappingType='text';await assert.rejects(api.executeDataQuery({id,index:'orders',query:'{}',schemaHash:structure.hash,selected}),/结构已变化/)
check('生成后Mapping变化会阻止旧结构查询',()=>{})
check('保存文件和返回值不包含密码',()=>{assert.ok(!JSON.stringify(saved).includes('fixture-secret'));assert.ok(!readFileSync(join(home,'storages/dev-workbench/data-connections.json'),'utf8').includes('fixture-secret'));assert.ok(requests.every(r=>r.auth))})
const configFile=join(home,'storages/dev-workbench/data-connections.json');
const priorConfig=readFileSync(configFile,'utf8');
await api.dataService.dataTest({draft:{...base,username:'draft',password:'draft-password'}});
check('未保存配置可测试当前密码，结果不改写配置或复用旧连接',()=>{
 assert.equal(requests.at(-1).auth,'Basic '+Buffer.from('draft:draft-password').toString('base64'));
 assert.equal(readFileSync(configFile,'utf8'),priorConfig);
 assert.equal(api.dataConnections().length,1);
});
await api.dataService.dataTest({draft:{...base,id,password:undefined}});
assert.equal(requests.at(-1).auth,'Basic '+Buffer.from('fixture:fixture-secret').toString('base64'));
await api.dataService.dataTest({draft:{...base,id,username:'changed',password:undefined}});
check('相同连接可沿用内存密码，改用户时不转发原密码',()=>{
 assert.equal(requests.at(-1).auth,'Basic '+Buffer.from('changed:').toString('base64'));
 assert.equal(readFileSync(configFile,'utf8'),priorConfig);
});
// Minimal real RESP transport for verifying ioredis connection and issued commands.
const commands=[],sockets=new Set();const resp=v=>Array.isArray(v)?'*'+v.length+'\r\n'+v.map(resp).join(''):v===null?'$-1\r\n':typeof v==='number'?':'+v+'\r\n':'$'+Buffer.byteLength(String(v))+'\r\n'+v+'\r\n'
const redis=tcpServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buffer=Buffer.alloc(0);socket.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);while(buffer.length){let pos=buffer.indexOf('\r\n');if(pos<0)return;const count=Number(buffer.subarray(1,pos));let at=pos+2,args=[],complete=true;for(let i=0;i<count;i++){pos=buffer.indexOf('\r\n',at);if(pos<0){complete=false;break}const len=Number(buffer.subarray(at+1,pos));at=pos+2;if(buffer.length<at+len+2){complete=false;break}args.push(buffer.subarray(at,at+len).toString());at+=len+2}if(!complete)return;buffer=buffer.subarray(at);commands.push(args);const cmd=args[0]?.toLowerCase();if(cmd==='info')socket.write(resp('redis_version:7.2.0\r\n'));else if(cmd==='ping')socket.write('+PONG\r\n');else if(cmd==='scan')socket.write(resp(['0',['fixture:key']]));else if(cmd==='type')socket.write(args[1]==='missing'?'+none\r\n':'+string\r\n');else if(cmd==='ttl')socket.write(':60\r\n');else if(cmd==='strlen')socket.write(':5\r\n');else if(cmd==='getrange')socket.write(resp('hello'));else socket.write('+OK\r\n')}})})
await new Promise(r=>redis.listen(0,'127.0.0.1',r));const rsave=await api.saveDataConnection({kind:'redis',host:'127.0.0.1',port:redis.address().port,database:'0',name:'Fixture Redis'}),rid=rsave.config.id
await api.testDataConnection(rid);assert.equal((await api.dataObjects({id:rid})).objects[0].name,'fixture:key');const rstruct=await api.dataStructure({id:rid,selected:[{name:'fixture:key'}]});assert.equal(rstruct.tables[0].ttl,60);assert.equal((await api.executeDataQuery({id:rid,query:'["GET","fixture:key"]'})).result,'hello');assert.equal((await api.executeDataQuery({id:rid,query:'["GET","missing"]'})).result,null);await assert.rejects(api.executeDataQuery({id:rid,query:'["SET","fixture:key","bad"]'}),/只读/)
check('ioredis经真实TCP完成连接、SCAN、类型/TTL、读取；写命令被阻止',()=>assert.ok(!commands.some(c=>c[0].toLowerCase()==='set')))
// Real mysql2 client against isolated protocol server (not a MySQL engine).
const mysqlSockets=new Set(),sqls=[];let largeCatalog=false;const orderCatalog=[{schemaName:'fixture',name:'orders',comment:'订单主表'},{schemaName:'fixture',name:'order_items',comment:'订单明细表'}];const ms=mysql.createServer(connection=>{mysqlSockets.add(connection);connection.writeTextResult=(rows,columns)=>{connection.writeColumns(columns.map(c=>({catalog:'def',schema:'fixture',table:'',orgTable:'',orgName:c.name,columnLength:1024,flags:0,decimals:0,...c})));for(const row of rows)connection.writeTextRow(columns.map(c=>row[c.name]));connection.writeEof()};connection.on('error',err=>{if(err.code!=='PROTOCOL_CONNECTION_LOST')console.error('MySQL fixture:',err.message)});connection.serverHandshake({protocolVersion:10,serverVersion:'8.0.0-fixture',connectionId:1,statusFlags:2,characterSet:33,capabilityFlags:0x0008a20d,authCallback:(_auth,cb)=>{cb(null);connection._resetSequenceId()}});connection.on('packet',()=>connection._resetSequenceId());connection.on('stmt_prepare',sql=>{sqls.push(sql);connection.writeOk()});connection.on('query',sql=>{sqls.push(sql);if(/^START|^ROLLBACK/.test(sql))connection.writeOk();else if(sql.includes('information_schema.TABLES'))connection.writeTextResult(largeCatalog&&!sql.includes('LOCATE(')?Array.from({length:501},(_,i)=>({schemaName:'fixture',name:'archive_'+i,comment:'归档'})):orderCatalog,[{name:'schemaName',columnType:253,characterSet:33},{name:'name',columnType:253,characterSet:33},{name:'comment',columnType:253,characterSet:33}]);else if(sql.startsWith('SHOW CREATE TABLE'))connection.writeTextResult([{'Create Table':sql.endsWith('`order_items`')?'CREATE TABLE order_items(order_id BIGINT, amount DECIMAL(12,2))':'CREATE TABLE orders(id BIGINT PRIMARY KEY)'}],[{name:'Create Table',columnType:253,characterSet:33}]);else connection.writeTextResult([{value:'9007199254740993'}],[{name:'value',columnType:253,characterSet:33}])});connection.on('end',()=>mysqlSockets.delete(connection))})
await new Promise(r=>ms.listen(0,'127.0.0.1',r));const msave=await api.saveDataConnection({kind:'mysql',host:'127.0.0.1',port:ms._server.address().port,database:'fixture',name:'Fixture MySQL'}),mid=msave.config.id
await api.testDataConnection(mid);assert.equal((await api.dataObjects({id:mid})).objects[0].name,'orders');await api.dataStructure({id:mid,selected:[{schemaName:'fixture',name:'orders'}]});const mresult=await api.executeDataQuery({id:mid,query:'SELECT 1 AS value'});assert.equal(mresult.rows[0].value,'9007199254740993');check('mysql2真实协议握手、元数据与只读事务；精确值保持字符串',()=>{assert.ok(sqls.includes('START TRANSACTION READ ONLY'));assert.ok(sqls.includes('SELECT 1 AS value'));assert.ok(sqls.includes('ROLLBACK'))})
// Model fixtures prove prompt transport and no automatic query execution, not model quality.
let nextSession=0,promptText='',choice={tableIds:[1,2],clarification:''},generationError;
const prompts=[],promptSessions=[],sessions=new Map();
const modelController={
 create:async()=>{
  const events=[];
  const session={id:'fixture-ai-'+(++nextSession),seq:0,events,snapshotEvents:(from=0)=>events.filter(event=>event.seq>from)};
  sessions.set(session.id,session);
  return {session};
 },
 prompt:async request=>{
  promptText=request.content[0].text;
  prompts.push(promptText);
  promptSessions.push(request.sessionId);
  const selecting=promptText.includes('表目录（按数组顺序从 1 编号）');
  if(!selecting&&generationError)throw generationError;
  const session=sessions.get(request.sessionId);
  const output=selecting?choice:{query:'SELECT id FROM orders',explanation:'fixture result',rollback:''};
  session.events.push(
   {seq:++session.seq,type:'turn/start',data:{}},
   {seq:++session.seq,type:'assistant/message',data:{message:{role:'assistant',content:[{type:'text',text:JSON.stringify(output)}]}}},
   {seq:++session.seq,type:'turn/end',data:{}},
  );
 },
};
const modelContext={get(key){if(key==='sessions')return {get:id=>sessions.get(id)};if(key==='sessionController')return modelController}};
api.setShared_workbenchCtx(modelContext)
try{const generated=await api.dataService.dataGenerate({id:mid,selected:[{schemaName:'fixture',name:'orders'}],instruction:'查询订单'});check('生成器使用即时结构和需求；只回填脚本，不执行查询',()=>{assert.match(promptText,/CREATE TABLE orders/);assert.equal(generated.query,'SELECT id FROM orders');assert.ok(!sqls.some(s=>s.includes('SELECT id FROM orders')))})}catch(err){console.error('AI fixture transport:',err.message);throw err}
const memory=await api.dataService.dataWorkspaceLoad({id:mid});
const persistedTurn=await api.dataService.dataGenerate({id:mid,selected:[{schemaName:'fixture',name:'orders'}],instruction:'保存这次查询',conversation:true,history:[],workspace:{key:memory.key,turnId:'fixture-completed-turn'}});
assert.equal(persistedTurn.workspace.workspace.aiTurns[0].instruction,'保存这次查询');
const beforeReplay=prompts.length;
const replayed=await api.dataService.dataGenerate({id:mid,selected:[{schemaName:'fixture',name:'orders'}],instruction:'保存这次查询',conversation:true,history:[],workspace:{key:memory.key,turnId:'fixture-completed-turn'}});
assert.equal(prompts.length,beforeReplay,'重复提交已完成编号不重新调用模型');
assert.equal(replayed.workspace.workspace.aiTurns.length,1);
assert.equal((await api.dataService.dataWorkspaceLoad({id:mid})).workspace.aiTurns[0].draft.query,'SELECT id FROM orders');
check('AI完成回复按目标原子持久化，重复请求不新增历史',()=>{});
const beforeAuto=prompts.length, beforeMetadata=sqls.length, beforeAutoSessions=nextSession;
largeCatalog=true;
const inferred=await api.dataService.dataGenerate({id:mid,selected:[],instruction:'统计订单金额'});
check('大库中按需检索表目录，在同一会话带入所选表名和实时结构生成 SQL',()=>{
 assert.equal(prompts.length-beforeAuto,2);
 assert.equal(nextSession-beforeAutoSessions,1);
 assert.equal(promptSessions[beforeAuto],promptSessions[beforeAuto+1]);
 assert.match(prompts[beforeAuto],/订单明细表/);
 assert.doesNotMatch(prompts[beforeAuto],/archive_\d|CREATE TABLE/);
 assert.ok(sqls.slice(beforeMetadata).some(sql=>sql.includes('LOCATE(')&&sql.includes('订单')));
 assert.deepEqual(inferred.selected,[{name:'orders',schemaName:'fixture'},{name:'order_items',schemaName:'fixture'}]);
 const selectedLine=promptText.split('\n').find(line=>line.startsWith('本次使用的表或对象：'));
 assert.equal(selectedLine,'本次使用的表或对象：'+JSON.stringify(inferred.selected));
 assert.match(promptText,/CREATE TABLE orders/);assert.match(promptText,/CREATE TABLE order_items/);
 assert.equal(inferred.query,'SELECT id FROM orders');
 assert.ok(!sqls.slice(beforeMetadata).some(sql=>sql.includes('SELECT id FROM orders')));
});
largeCatalog=false;
const beforeMissingSession=nextSession,beforeMissingPrompts=promptSessions.length;
generationError=Error('SessionPersistenceNotFound: resume failed');
await assert.rejects(api.dataService.dataGenerate({id:mid,selected:[],instruction:'查询订单'}),/SessionPersistenceNotFound/);
generationError=undefined;
check('生成阶段无法恢复原会话时，保留原错误且不另开会话',()=>{
 assert.equal(nextSession-beforeMissingSession,1);
 const stages=promptSessions.slice(beforeMissingPrompts);
 assert.equal(stages.length,2);
 assert.equal(stages[0],stages[1]);
});
const metadataBeforeClarify=sqls.length, promptsBeforeClarify=prompts.length;
choice={tableIds:[],clarification:'请说明查询订单主表还是明细表'};
await assert.rejects(api.dataService.dataGenerate({id:mid,instruction:'看一下数据'}),/请说明查询订单主表还是明细表/);
choice={tableIds:[99]};
await assert.rejects(api.dataService.dataGenerate({id:mid,selected:[],instruction:'看一下数据'}),/未能确定所需的表/);
check('选表歧义和目录外序号只给提示，不读取猜测的结构或生成脚本',()=>{
 assert.equal(prompts.length-promptsBeforeClarify,2);
 assert.ok(!sqls.slice(metadataBeforeClarify).some(sql=>sql.startsWith('SHOW CREATE TABLE')));
});
choice={tableIds:[],clarification:'请说明需要哪个时间范围'};
const reply=await api.dataService.dataGenerate({id:mid,conversation:true,instruction:'统计订单',history:[]});
assert.deepEqual(reply,{clarification:'请说明需要哪个时间范围'});
choice={tableIds:[1]};
const continuationStart=prompts.length;
await api.dataService.dataGenerate({id:mid,conversation:true,instruction:'最近七天',history:[
 {instruction:'最早的内容'},
 {instruction:'第二轮'},{instruction:'第三轮'},{instruction:'第四轮'},
 {instruction:'统计订单',query:'SELECT id FROM orders',explanation:reply.clarification,password:'不得传给模型'},
]});
check('对话澄清可直接追问，选表和生成只携带受限前文',()=>{
 for(const prompt of prompts.slice(continuationStart)){
  assert.match(prompt,/统计订单/);assert.match(prompt,/最近七天/);
  assert.match(prompt,/SELECT id FROM orders/);
  assert.doesNotMatch(prompt,/最早的内容|不得传给模型/);
 }
});
await assert.rejects(api.dataService.dataGenerate({id,selected:[],instruction:'搜索订单'}),/请选择索引或 Key|请先选择索引或 Key/);
// Validate bundled production grammars through the public service, not only source imports.
const {apply}=await import(process.env.DATA_TEST_PACKAGED_ENTRY||'../index.js?data-production');const services={},disposers=[];apply({provide:(name,value)=>services[name]=value,inject:()=>{},effect:fn=>{const dispose=fn();if(typeof dispose==='function')disposers.push(dispose);return dispose},get:modelContext.get,logger:{info:()=>{}}},{});
const installed=services.workbench,packaged=await installed.dataSave({kind:'mysql',host:'127.0.0.1',port:ms._server.address().port,database:'fixture',name:'Packaged fixture'});const packagedResult=await installed.dataQuery({id:packaged.config.id,query:'SELECT 1 AS value'});assert.equal(packagedResult.rows[0].value,'9007199254740993');
choice={tableIds:[1]};
const advertised=await installed.dataConnections();
const packagedGenerated=await installed.dataGenerate({id:packaged.config.id,selected:[],instruction:'查询订单'});
check('正式 Host 公开入口声明并执行自动选表',()=>{
 assert.equal(advertised.capabilities.autoTableSelection,true);
 assert.deepEqual(packagedGenerated.selected,[{name:'orders',schemaName:'fixture'}]);
 assert.equal(packagedGenerated.query,'SELECT id FROM orders');
});
await installed.dataDisconnect({id:packaged.config.id});for(const dispose of disposers.reverse())dispose();check('生产构建包含必要SQL语法，不依赖完整解析库的运行时入口',()=>{});
slow=true;const pending=api.executeDataQuery({id,index:'orders',query:'{}'});const rejection=assert.rejects(pending);await new Promise(r=>setTimeout(r,30));await api.disconnectData(id);await rejection;check('停止中断HTTP请求，断开后的连接必须重新解锁',()=>assert.ok(!api.dataConnections().find(c=>c.id===id).unlocked))
if(process.platform==='darwin'&&process.env.DATA_TEST_KEYCHAIN==='1'){
 const account=createHash('sha256').update(join(home,'storages','dev-workbench')).digest('hex');
 const password='keychain-fixture-\"-\\-密码';
 try{
  const remembered=await api.saveDataConnection({...base,password,rememberPassword:true});
  const rememberedId=remembered.config.id;
  const stored=JSON.parse(readFileSync(configFile,'utf8')).find(row=>row.id===rememberedId);
  assert.ok(stored.passwordSeal.ciphertext);
  assert.ok(!readFileSync(configFile,'utf8').includes(password));
  assert.ok(!JSON.stringify(api.dataConnections()).includes('passwordSeal'));
  await promisify(execFile)(process.execPath,['--input-type=module','-e',`
    const api=await import(process.argv[1]);
    const id=process.argv[2];
    if(!api.dataConnections().find(row=>row.id===id)?.unlocked)process.exit(2);
    await api.testDataConnection(id);
    api.disposeDataTools();`,target,rememberedId],{timeout:20000});
  check('独立新进程用钥匙串恢复加密密码，真实 HTTP 连接通过',()=>{
   assert.equal(requests.at(-1).auth,'Basic '+Buffer.from('fixture:'+password).toString('base64'));
  });
  await api.saveDataConnection({...remembered.config,rememberPassword:false});
  await api.disconnectData(rememberedId);
  await assert.rejects(api.testDataConnection(rememberedId),/尚未解锁/);
  check('取消记住并保存会移除密码密文',()=>assert.ok(!JSON.parse(readFileSync(configFile,'utf8')).find(row=>row.id===rememberedId).passwordSeal));
 }finally{
  try{execFileSync('/usr/bin/security',['delete-generic-password','-s','AIWorkBench.database-passwords.v1','-a',account],{stdio:'ignore',timeout:10000})}catch{}
 }
}
await api.disconnectData(mid);await api.disconnectData(rid);api.disposeDataTools();for(const s of sockets)s.destroy();for(const s of mysqlSockets)s.close();await Promise.all([new Promise(r=>es.close(r)),new Promise(r=>redis.close(r)),new Promise(r=>ms.close(r))]);console.log(`data-tools: ${passed} scenarios passed`)
