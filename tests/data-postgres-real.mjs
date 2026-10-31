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
 await assert.rejects(api.executeDataQuery({id,query:'SELECT write_order()'}),/read.only|只读/i);assert.equal((await admin.query('SELECT count(*) FROM orders')).rows[0].count,'1');
 await admin.query('ALTER TABLE orders ADD COLUMN code text');await assert.rejects(api.executeDataQuery({id,query:'SELECT * FROM orders',schemaHash:structure.hash,selected}),/结构已变化/);
 await api.disconnectData(id);await assert.rejects(api.testDataConnection(id),/解锁/);
 console.log('data-postgres-real: real PostgreSQL connection, schema/comments/constraints, precision, empty columns, row limit, read-only enforcement, schema-change fence and disconnect passed');
}finally{api?.disposeDataTools();await admin?.end().catch(()=>{});await database.stop()}
