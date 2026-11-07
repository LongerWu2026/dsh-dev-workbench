/** Requires DATA_TEST_EMBEDDED_MODULE pointing to a temporary embedded-postgres installation. */
import assert from 'node:assert/strict'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createServer} from 'node:net'
import {build} from 'esbuild'
const modulePath=process.env.DATA_TEST_EMBEDDED_MODULE;if(!modulePath)throw Error('请指定临时安装的embedded-postgres模块路径')
const {default:EmbeddedPostgres}=await import(pathToFileURL(modulePath).href),home=mkdtempSync(join(tmpdir(),'wb-real-pg-'));process.env.DSH_HOME=home
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r))
const database=new EmbeddedPostgres({databaseDir:join(home,'pg'),user:'fixture',password:'fixture-password',port,persistent:true,createPostgresUser:false,postgresFlags:['-h','127.0.0.1','-k',home],onLog:()=>{},onError:()=>{}})
let admin,api;try{
 await database.initialise();await database.start();admin=database.getPgClient();await admin.connect();
 await admin.query('CREATE TABLE orders(id bigint PRIMARY KEY, amount numeric(20,4), customer_name text)');await admin.query("COMMENT ON COLUMN orders.customer_name IS '客户名称'");await admin.query("INSERT INTO orders VALUES(9007199254740993,123.4500,'测试客户')");
 await admin.query("CREATE FUNCTION write_order() RETURNS integer LANGUAGE plpgsql AS $$ BEGIN INSERT INTO orders VALUES (2,2,'bad'); RETURN 1; END $$");
 const target=resolve('.tmp/data-validation/real-pg.mjs');await build({stdin:{contents:"export * from './src/host/integrations/data-tools.ts'",resolveDir:resolve('.'),loader:'ts'},outfile:target,bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent'});api=await import(pathToFileURL(target));
 const saved=await api.saveDataConnection({kind:'postgres',name:'临时PG',host:'127.0.0.1',port,database:'postgres',username:'fixture',password:'fixture-password'}),id=saved.config.id;
 await api.testDataConnection(id);assert.ok((await api.dataObjects({id})).objects.some(o=>o.name==='orders'));
 const selected=[{name:'orders',schemaName:'public'}],structure=await api.dataStructure({id,selected});assert.ok(structure.tables[0].columns.some(c=>c.comment==='客户名称'));assert.ok(structure.tables[0].constraints.some(c=>c.definition.includes('PRIMARY KEY')));
 const r=await api.executeDataQuery({id,query:'SELECT * FROM orders',schemaHash:structure.hash,selected});assert.equal(r.rows[0].id,'9007199254740993');assert.equal(r.rows[0].amount,'123.4500');assert.equal(r.rows[0].customer_name,'测试客户');
 const zero=await api.executeDataQuery({id,query:'SELECT * FROM orders WHERE false'});assert.equal(zero.rows.length,0);assert.ok(zero.columns.includes('id'));
 const many=await api.executeDataQuery({id,query:'SELECT * FROM generate_series(1,300) AS n'});assert.equal(many.rows.length,200);assert.equal(many.truncated,true);
 await admin.query('CREATE TABLE pagination_fixture(value integer PRIMARY KEY)');await admin.query('INSERT INTO pagination_fixture SELECT generate_series(1,325)');
 const pageQuery='SELECT value FROM pagination_fixture ORDER BY value';
 const later=await api.executeDataQuery({id,query:pageQuery,pageSize:50,offset:200});
 assert.equal(later.rows[0].value,201);assert.equal(later.rows.at(-1).value,250);assert.equal(later.rows.length,50);
 assert.equal(later.offset,200);assert.equal(later.hasMore,true);assert.equal(later.nextOffset,250);
 console.log('✓ real PostgreSQL public query returns rows 201–250 of the original result');
 const all=[];let offset=0;
 do{
  const page=await api.executeDataQuery({id,query:pageQuery,pageSize:100,offset});all.push(...page.rows.map(row=>row.value));
  assert.equal(page.offset,offset);assert.equal(page.pageSize,100);assert.ok(Number.isFinite(Date.parse(page.queriedAt)));
  if(!page.hasMore){assert.equal(page.nextOffset,null);break}offset=page.nextOffset;
 }while(offset<400);
 assert.deepEqual(all,Array.from({length:325},(_,i)=>i+1));
 console.log('✓ all 325 real rows are delivered once across independent cursor pages');
 const cases=[
  ['SELECT value FROM pagination_fixture ORDER BY value LIMIT 200',150,151,200,50],
  ['SELECT value FROM pagination_fixture ORDER BY value LIMIT 60 OFFSET 20',50,71,80,10],
  ['WITH picked AS (SELECT value FROM pagination_fixture WHERE value > 20) SELECT value FROM picked ORDER BY value DESC LIMIT 65 OFFSET 5',50,270,256,15],
  ['SELECT value FROM pagination_fixture WHERE value <= 100 UNION ALL SELECT value FROM pagination_fixture WHERE value > 300 ORDER BY value DESC LIMIT 80 OFFSET 3',50,72,43,30],
  ['SELECT value FROM pagination_fixture WHERE value <= 100 UNION SELECT value FROM pagination_fixture WHERE value > 300 ORDER BY value DESC LIMIT 80 OFFSET 3',50,72,43,30],
  ['SELECT DISTINCT value FROM pagination_fixture ORDER BY value DESC LIMIT 61 OFFSET 4',50,271,261,11],
 ];
 for(const [query,offset,first,last,count] of cases){
  const page=await api.executeDataQuery({id,query:query+';',pageSize:50,offset});
  assert.equal(page.rows[0].value,first,query);assert.equal(page.rows.at(-1).value,last,query);assert.equal(page.rows.length,count,query);
  assert.equal(page.hasMore,false,query);assert.equal(page.nextOffset,null,query);
  const end=await api.executeDataQuery({id,query,pageSize:50,offset:1000});assert.deepEqual(end.rows,[],query);assert.deepEqual(end.columns,['value'],query);assert.equal(end.hasMore,false);
 }
 const aggregate=await api.executeDataQuery({id,query:'SELECT value % 2 AS category, COUNT(*) AS n FROM pagination_fixture GROUP BY value % 2 ORDER BY n DESC',pageSize:50});
 assert.deepEqual(aggregate.rows,[{category:1,n:'163'},{category:0,n:'162'}]);assert.equal(aggregate.hasMore,false);
 console.log('✓ real CTE, UNION/UNION ALL, DISTINCT, aggregates and original LIMIT/OFFSET retain their result semantics');
 for(const count of [0,1,50]){
  const page=await api.executeDataQuery({id,query:pageQuery+' LIMIT '+count,pageSize:50});
  assert.equal(page.rows.length,count);assert.deepEqual(page.columns,['value']);assert.equal(page.hasMore,false);assert.equal(page.nextOffset,null);
 }
 const beyond=await api.executeDataQuery({id,query:pageQuery,pageSize:50,offset:Number.MAX_SAFE_INTEGER});
 assert.deepEqual(beyond.rows,[]);assert.deepEqual(beyond.columns,['value']);assert.equal(beyond.nextOffset,null);
 const cell=await api.executeDataQuery({id,query:"SELECT repeat('x',20000) AS value",pageSize:50});
 assert.match(cell.rows[0].value,/单元格已截断/);assert.deepEqual(cell.truncation,{rowLimit:false,byteLimit:false,cellLimit:true});assert.equal(cell.hasMore,false);
 const byteQuery="SELECT value, repeat('a',12000) AS a, repeat('b',12000) AS b FROM pagination_fixture WHERE value <= 50 ORDER BY value";
 const clipped=await api.executeDataQuery({id,query:byteQuery,pageSize:50});
 assert.equal(clipped.rows.length,43);assert.equal(clipped.nextOffset,43);assert.equal(clipped.hasMore,true);assert.deepEqual(clipped.truncation,{rowLimit:false,byteLimit:true,cellLimit:false});
 const rest=await api.executeDataQuery({id,query:byteQuery,pageSize:50,offset:clipped.nextOffset});
 assert.equal(rest.rows.length,7);assert.equal(rest.rows[0].value,44);assert.equal(rest.rows.at(-1).value,50);assert.equal(rest.hasMore,false);
 console.log('✓ real empty/exact/short pages, cell-only clipping and byte continuation report independent facts');
 for(const pageSize of [0,51,'50',null])await assert.rejects(api.executeDataQuery({id,query:pageQuery,pageSize}),/每页行数/);
 for(const offset of [-1,0.5,'0',null,Number.MAX_SAFE_INTEGER+1])await assert.rejects(api.executeDataQuery({id,query:pageQuery,pageSize:50,offset}),/偏移.*安全整数/);
 await assert.rejects(api.executeDataQuery({id,query:'TABLE pagination_fixture',pageSize:50}),/解析|仅允许/);
 console.log('✓ real database entry rejects invalid pagination and unsupported syntax explicitly');
 await assert.rejects(api.executeDataQuery({id,query:'SELECT write_order()'}),/read.only|只读/i);assert.equal((await admin.query('SELECT count(*) FROM orders')).rows[0].count,'1');
 await admin.query('ALTER TABLE orders ADD COLUMN code text');await assert.rejects(api.executeDataQuery({id,query:'SELECT * FROM orders',schemaHash:structure.hash,selected}),/结构已变化/);
 await api.disconnectData(id);await assert.rejects(api.testDataConnection(id),/解锁/);
 console.log('data-postgres-real: real PostgreSQL connection, schema/comments/constraints, precision, empty columns, row limit, read-only enforcement, schema-change fence and disconnect passed');
}finally{api?.disposeDataTools();await admin?.end().catch(()=>{});await database.stop()}
