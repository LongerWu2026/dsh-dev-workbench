/** Public executeDataQuery over real mysql2 transport. This is a protocol fixture, not a MySQL SQL engine. */
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import mysql from 'mysql2'

process.env.DSH_HOME=mkdtempSync(join(tmpdir(),'wb-query-page-'))
const target=resolve('.tmp/data-validation/query-pagination.mjs')
await build({stdin:{contents:"export * from './src/host/integrations/data-tools.ts'",resolveDir:resolve('.'),loader:'ts'},outfile:target,bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent'})
const api=await import(pathToFileURL(target).href+'?'+Date.now())
const sockets=new Set(),statements=[],heldQueries=new Map()
const query='SELECT value FROM pagination_fixture ORDER BY value'
const records=Array.from({length:325},(_,i)=>({value:String(i+1)}))
const results=new Map([[query,{rows:records,columns:['value']}]])
const byteQuery='SELECT value, a, b FROM byte_fixture ORDER BY value'
results.set(byteQuery,{rows:Array.from({length:50},(_,i)=>({value:String(i+1),a:'a'.repeat(12000),b:'b'.repeat(12000)})),columns:['value','a','b']})
const fixture=mysql.createServer(connection=>{
 sockets.add(connection)
 connection.on('end',()=>sockets.delete(connection))
 connection.on('error',error=>{if(!['PROTOCOL_CONNECTION_LOST','ECONNRESET','EPIPE'].includes(error.code))console.error('MySQL fixture:',error.message)})
 connection.serverHandshake({protocolVersion:10,serverVersion:'8.0.0-fixture',connectionId:1,statusFlags:2,characterSet:33,capabilityFlags:0x0008a20d,authCallback:(_auth,done)=>{done(null);connection._resetSequenceId()}})
 connection.on('packet',()=>connection._resetSequenceId())
 // mysql2's protocol server routes COM_QUERY SET through stmt_prepare.
 connection.on('stmt_prepare',sql=>{statements.push(sql);connection.writeOk()})
 connection.on('query',sql=>{
  statements.push(sql)
  if(process.env.DATA_QUERY_TRACE)console.log('fixture SQL:',sql)
  if(/^(START|ROLLBACK|SET SESSION)\b/.test(sql)){connection.writeOk();return}
  const hold=heldQueries.get(sql);if(hold){hold();return}
  const result=results.get(sql)
  if(!result){connection.writeError({code:1064,message:'Fixture refuses rewritten or unknown SQL: '+sql});return}
  const columns=result.columns.map(name=>({name,columnType:253,characterSet:33}))
  connection.writeColumns(columns.map(c=>({catalog:'def',schema:'fixture',table:'',orgTable:'',orgName:c.name,columnLength:1024,flags:0,decimals:0,...c})))
  for(const row of result.rows)connection.writeTextRow(columns.map(c=>row[c.name]))
  connection.writeEof()
 })
})
await new Promise(r=>fixture.listen(0,'127.0.0.1',r))
let passed=0
const check=async(name,fn)=>{await fn();passed++;console.log('✓ '+name)}
try{
 const {config:{id}}=await api.saveDataConnection({kind:'mysql',host:'127.0.0.1',port:fixture._server.address().port,database:'fixture',name:'Pagination fixture'})
 await check('explicit page size returns only requested rows through the public query entry',async()=>{
  const first=await api.executeDataQuery({id,query,pageSize:50,offset:0})
  assert.equal(first.rows.length,50)
  assert.equal(first.rows[0].value,'1')
  assert.equal(first.rows.at(-1).value,'50')
  assert.equal(first.pageSize,50)
  assert.equal(first.offset,0)
  assert.equal(first.hasMore,true)
  assert.equal(first.nextOffset,50)
  assert.ok(Number.isFinite(Date.parse(first.queriedAt)))
 })
 await check('subsequent pages reach row 201 and beyond without repeats or omissions',async()=>{
  const values=[];let offset=0
  do{
   const page=await api.executeDataQuery({id,query,pageSize:100,offset})
   assert.equal(page.offset,offset)
   values.push(...page.rows.map(row=>row.value))
   if(!page.hasMore){assert.equal(page.nextOffset,null);break}
   assert.equal(page.nextOffset,offset+page.rows.length)
   offset=page.nextOffset
  }while(offset<400)
  assert.equal(values.length,325)
  assert.equal(values[200],'201')
  assert.equal(values.at(-1),'325')
  assert.deepEqual(values,records.map(row=>row.value))
 })
 await check('byte clipping advances by delivered original rows, independently of the row probe',async()=>{
  const first=await api.executeDataQuery({id,query:byteQuery,pageSize:50,offset:0})
  assert.equal(first.rows.length,43)
  assert.equal(first.nextOffset,43)
  assert.equal(first.hasMore,true)
  assert.deepEqual(first.truncation,{rowLimit:false,byteLimit:true,cellLimit:false})
  const rest=await api.executeDataQuery({id,query:byteQuery,pageSize:50,offset:first.nextOffset})
  assert.equal(rest.rows.length,7)
  assert.equal(rest.rows[0].value,'44')
  assert.equal(rest.rows.at(-1).value,'50')
  assert.equal(rest.hasMore,false)
  assert.equal(rest.nextOffset,null)
  assert.deepEqual(rest.truncation,{rowLimit:false,byteLimit:false,cellLimit:false})
 })
 await check('a single oversized row fails explicitly instead of creating a non-advancing page',async()=>{
  const wideQuery='SELECT * FROM wide_fixture'
  const wide=Object.fromEntries(Array.from({length:100},(_,i)=>['c'+i,'x'.repeat(12000)]))
  results.set(wideQuery,{rows:[wide],columns:Object.keys(wide)})
  await assert.rejects(api.executeDataQuery({id,query:wideQuery,pageSize:50,offset:0}),/单行.*1MB/)
 })
 await check('omitted pagination keeps the old 200-row cap and exposes independent row-probe facts',async()=>{
  const legacy=await api.executeDataQuery({id,query})
  assert.equal(legacy.rows.length,200)
  assert.equal(legacy.pageSize,200)
  assert.equal(legacy.offset,0)
  assert.equal(legacy.nextOffset,200)
  assert.equal(legacy.truncated,true)
  assert.deepEqual(legacy.truncation,{rowLimit:true,byteLimit:false,cellLimit:false})
  const last=await api.executeDataQuery({id,query,offset:300})
  assert.equal(last.pageSize,200)
  assert.equal(last.rows.length,25)
  assert.equal(last.hasMore,false)
 })
 await check('original LIMIT/OFFSET, CTE, UNION and DISTINCT queries are sent unchanged and paged within their results',async()=>{
  const cases=[
   ['SELECT value FROM pagination_fixture ORDER BY value LIMIT 200',records.slice(0,200),'151','200',false],
   ['SELECT value FROM pagination_fixture ORDER BY value LIMIT 60 OFFSET 20',records.slice(20,80),'71','80',false],
   ['SELECT value FROM pagination_fixture ORDER BY value LIMIT 20, 60',records.slice(20,80),'71','80',false],
   ['WITH picked AS (SELECT value FROM pagination_fixture WHERE value > 20) SELECT value FROM picked ORDER BY value DESC LIMIT 65 OFFSET 5',Array.from({length:65},(_,i)=>({value:String(320-i)})),'270','256',false],
   ['SELECT value FROM pagination_fixture WHERE value <= 100 UNION ALL SELECT value FROM pagination_fixture WHERE value > 300 ORDER BY value DESC LIMIT 80 OFFSET 3',[...Array.from({length:22},(_,i)=>({value:String(322-i)})),...Array.from({length:58},(_,i)=>({value:String(100-i)}))],'72','43',false],
   ['SELECT DISTINCT value FROM pagination_fixture ORDER BY value DESC LIMIT 61 OFFSET 4',Array.from({length:61},(_,i)=>({value:String(321-i)})),'271','261',false],
  ]
  for(const [sql,rows,first,last,hasMore] of cases){
   results.set(sql,{rows,columns:['value']})
   const offset=rows.length===200?150:50
   const page=await api.executeDataQuery({id,query:sql+';',pageSize:50,offset})
   assert.equal(page.rows[0].value,first,sql)
   assert.equal(page.rows.at(-1).value,last,sql)
   assert.equal(page.hasMore,hasMore,sql)
   assert.equal(page.nextOffset,null,sql)
   assert.ok(statements.includes(sql),'transport must execute original SQL, not a wrapper or LIMIT rewrite')
   const end=await api.executeDataQuery({id,query:sql,pageSize:50,offset:rows.length})
   assert.deepEqual(end.rows,[])
   assert.deepEqual(end.columns,['value'])
   assert.equal(end.hasMore,false)
  }
 })
 await check('short, exact-sized, empty and cell-clipped pages never fabricate a next page',async()=>{
  for(const count of [0,1,50]){
   const sql=`SELECT value FROM pagination_fixture ORDER BY value LIMIT ${count}`
   results.set(sql,{rows:records.slice(0,count),columns:['value']})
   const page=await api.executeDataQuery({id,query:sql,pageSize:50})
   assert.equal(page.rows.length,count)
   assert.deepEqual(page.columns,['value'])
   assert.equal(page.hasMore,false)
   assert.equal(page.nextOffset,null)
   assert.equal(page.truncated,false)
  }
  const sql='SELECT value FROM cell_fixture'
  results.set(sql,{rows:[{value:'x'.repeat(20000)}],columns:['value']})
  const page=await api.executeDataQuery({id,query:sql,pageSize:50})
  assert.match(page.rows[0].value,/单元格已截断/)
  assert.equal(page.hasMore,false)
  assert.equal(page.nextOffset,null)
  assert.equal(page.truncated,true)
  assert.deepEqual(page.truncation,{rowLimit:false,byteLimit:false,cellLimit:true})
 })
 await check('invalid page sizes/offsets and unsafe SQL fail without issuing a database query',async()=>{
  const before=statements.length
  for(const pageSize of [0,49,51,201,'50',null,Infinity])await assert.rejects(api.executeDataQuery({id,query,pageSize}),/每页行数/)
  for(const offset of [-1,0.5,Number.MAX_SAFE_INTEGER+1,'50',null,NaN])await assert.rejects(api.executeDataQuery({id,query,pageSize:50,offset}),/偏移.*安全整数/)
  for(const sql of ['DELETE FROM pagination_fixture','SELECT 1; SELECT 2','SELECT * FROM pagination_fixture FOR UPDATE','SELECT SLEEP(3)','SELECT * FROM ???'])await assert.rejects(api.executeDataQuery({id,query:sql,pageSize:50}))
  assert.equal(statements.length,before)
  const empty=await api.executeDataQuery({id,query,pageSize:50,offset:Number.MAX_SAFE_INTEGER})
  assert.deepEqual(empty.rows,[])
  assert.equal(empty.offset,Number.MAX_SAFE_INTEGER)
  assert.equal(empty.nextOffset,null)
 })
 await check('server errors are returned once without an automatic query retry',async()=>{
  const sql='SELECT value FROM failed_fixture'
  await assert.rejects(api.executeDataQuery({id,query:sql,pageSize:50}),/Fixture refuses/)
  assert.equal(statements.filter(statement=>statement===sql).length,1)
  assert.ok(statements.includes('SET SESSION MAX_EXECUTION_TIME=30000'))
  assert.ok(statements.includes('START TRANSACTION READ ONLY'))
  assert.ok(statements.includes('ROLLBACK'),'naturally completed streams explicitly roll back')
 })
 if(process.env.DATA_TEST_QUERY_TIMEOUT==='1')await check('an actual 30-second stalled SQL stream times out once and invalidates its socket',async()=>{
  const sql='SELECT value FROM timeout_fixture'
  heldQueries.set(sql,()=>{})
  await assert.rejects(api.executeDataQuery({id,query:sql,pageSize:50}),/查询超时.*未自动重试/)
  assert.equal(statements.filter(statement=>statement===sql).length,1)
  assert.equal(api.dataConnections().find(connection=>connection.id===id).connected,false)
  heldQueries.delete(sql)
 })
 await check('a running stream remains serial per connection and disconnect rejects without retrying',async()=>{
  const sql='SELECT value FROM held_fixture'
  const entered=new Promise(resolve=>heldQueries.set(sql,resolve))
  const stopped=assert.rejects(api.executeDataQuery({id,query:sql,pageSize:50}),/操作已停止/)
  await entered
  await assert.rejects(api.executeDataQuery({id,query,pageSize:50}),/已有操作/)
  await api.disconnectData(id)
  await stopped
  assert.equal(statements.filter(statement=>statement===sql).length,1)
  await assert.rejects(api.executeDataQuery({id,query,pageSize:50}),/解锁/)
  heldQueries.delete(sql)
 })
 await check('four running streams retain the existing global concurrency fence',async()=>{
  const ids=[]
  for(let i=0;i<5;i++)ids.push((await api.saveDataConnection({kind:'mysql',host:'127.0.0.1',port:fixture._server.address().port,database:'fixture',name:'Concurrent '+i})).config.id)
  const sql='SELECT value FROM concurrent_fixture';let started=0
  const entered=new Promise(resolve=>heldQueries.set(sql,()=>{if(++started===4)resolve()}))
  const stopped=ids.slice(0,4).map(id=>assert.rejects(api.executeDataQuery({id,query:sql,pageSize:50}),/操作已停止/))
  await entered
  await assert.rejects(api.executeDataQuery({id:ids[4],query,pageSize:50}),/同时最多.*4/)
  await Promise.all(ids.map(id=>api.disconnectData(id)))
  await Promise.all(stopped)
  assert.equal(statements.filter(statement=>statement===sql).length,4)
  heldQueries.delete(sql)
 })
 console.log(`data-query-pagination: ${passed} public mysql2 protocol scenarios passed (not a MySQL engine)`)
}finally{
 api.disposeDataTools()
 for(const socket of sockets)socket.close()
 await new Promise(r=>fixture.close(r))
}
