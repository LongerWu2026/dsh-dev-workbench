/** Explicit Yunzhijia search dispatch; synthetic enterprise data, no network. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'wb-enterprise-search-'));process.env.DSH_HOME=home
await build({stdin:{contents:`export {runUnifiedSearch} from './src/host/search/unified-search.ts';export {enterpriseSearchRange,enterpriseDefaultRange} from './src/shared/enterprise-search.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),platform:'node',format:'esm',bundle:true,logLevel:'silent'})
const h=await import(join(home,'host.mjs')),calls=[],allCalls=[],services=[];let fail='',empty=false,checks=0
const subprocess={resolveExecutable:async()=>'/fixture/yzj-cli',spawn(spec){const args=spec.argv.slice(1);calls.push(args);allCalls.push(args);let data={list:[]}
 if(args[0]==='whoami')data={openId:'self',orgId:'company',name:'合成用户'}
 else if(args[0]==='contact')data={list:empty?[]:[{oId:'actual-contact-id',name:'Alex Example',department:'研发',fulldepartment:'研发/平台',jobTitle:'工程师'}]}
 else if(args[0]==='doc')data={list:[{id:'doc-1',fileName:'架构设计',openWebUrl:'https://example.invalid/doc',kbName:'合成知识库'}]}
 else if(args[1]==='message')data={list:[{group:{groupName:'项目群',groupId:'group-1'},messages:[{message:{msgId:'message-1',content:'代码评审',sendTime:'2026-11-04T09:00:00+08:00'}}]}]}
 else if(args[1]==='group')data={list:[{groupId:'actual-group-id',groupName:'平台研发群'}]}
 else if(args[1]==='event')data={list:[{id:'event-1',title:'项目评审',startTime:'2026-11-04T10:00:00+08:00'}]}
 else if(args[1]==='room')data={list:[{roomId:'room-1',roomName:'B10',limitCount:12}]}
 else if(args[0]==='attendance')data={list:[{id:'attendance-1',clockInTime:Date.parse('2026-11-04T09:00:00+08:00'),clockInStatus:'正式卡'}]}
 const failed=args.join(' ').startsWith(fail)&&!!fail,text=JSON.stringify(failed?{success:false,error:{code:43001,message:'synthetic denied'}}:{success:true,data})
 return {done:Promise.resolve({exitCode:failed?1:0}),collected:{stdout:{readFrom:()=>({text})},stderr:{readFrom:()=>({text:''})}}}
}}
const ctx={get:name=>{services.push(name);assert.equal(name,'subprocess','enterprise scope must not access web/files/GitHub');return subprocess}}
const search=async(type,query='Alex Example',extra={})=>{calls.length=0;services.length=0;return h.runUnifiedSearch(ctx,{scope:'enterprise',enterpriseType:type,query,includeWeb:true,...extra})}
const check=(label,fn)=>{fn();checks++;console.log('✓ '+label)}
try{
 const contact=await search('contacts')
 check('显式联系人支持英文长姓名，使用真实 oId，并只调用本人身份与通讯录',()=>{assert.deepEqual(calls.map(args=>args.slice(0,3)),[['whoami'],['contact','user','search']]);assert.equal(calls[1].at(-1),'Alex Example');assert.equal(contact.groups[0].items[0].extra.openId,'actual-contact-id');assert.equal(contact.groups[0].items[0].extra.department,'研发/平台');assert.equal(contact.groups[0].items[0].extra.accountId,'company:self')})
 for(const [type,command] of [['messages','im message search'],['documents','doc search'],['groups','im group search']]){const result=await search(type,'架构');check(type+' 只调用所选产品，不混查其他来源',()=>{assert.equal(result.total,1);assert.deepEqual(calls.slice(1).map(args=>args.slice(0,command.split(' ').length).join(' ')),[command]);assert.equal(result.groups[0].items[0].extra.provider,'yunzhijia')})}
 const all=await search('all','架构');check('全部云之家包含联系人消息文档群聊，无互联网、GitHub或磁盘检索',()=>{assert.equal(all.total,4);assert.deepEqual(all.groups.map(group=>group.id),['enterprise','contacts','groups']);assert.equal(calls.filter(args=>args[0]==='whoami').length,1);assert.ok(services.every(name=>name==='subprocess'))})
 fail='doc search';const partial=await search('all');check('文档失败保留其他来源结果，部分返回与失败原因明确',()=>{assert.equal(partial.groups[0].status,'partial');assert.match(partial.groups[0].note,/文档一路失败/);assert.equal(partial.total,3);assert.equal(partial.groups.find(group=>group.id==='contacts').status,'ok')});fail=''
 empty=true;const none=await search('contacts');check('联系人无匹配保留明确空结果，不假报不可用',()=>{assert.equal(none.total,0);assert.equal(none.groups[0].status,'empty')});empty=false
 for(const [type,query,start,end] of [['events','项目','2026-11-04','2026-11-05'],['rooms','B10','2026-11-04T14:00','2026-11-04T15:00'],['attendance','','2026-11-04','2026-11-04']]){const result=await search(type,query,{start,end});check(type+' 带实际北京时间范围、空关键词可查询，且不混查消息',()=>{assert.equal(result.total,1);assert.equal(calls.length,2);const args=calls[1];assert.equal(args[args.indexOf('--start')+1],start+(type==='rooms'?':00+08:00':''));assert.equal(args[args.indexOf('--end')+1],end+(type==='rooms'?':00+08:00':''));assert.ok(!args.includes('search'))})}
 fail='whoami';const denied=await search('contacts');check('未登录或身份查询失败明确不可用，不继续读企业数据',()=>{assert.equal(calls.length,1);assert.equal(denied.groups[0].status,'unavailable')});fail=''
 for(const input of [{enterpriseType:'unknown'},{enterpriseType:'contacts',query:''},{enterpriseType:'events',start:'2026-02-30',end:'2026-03-01'},{enterpriseType:'rooms',start:'2026-11-04T15:00',end:'2026-11-04T14:00'}]){calls.length=0;await assert.rejects(h.runUnifiedSearch(ctx,{scope:'enterprise',query:'关键词',...input}));assert.equal(calls.length,0)}
 check('无效类型、空姓名、不存在日期和倒置时间在任何外部调用前拒绝',()=>{})
 check('默认日期与会议室时段按北京时间换算，跨日正确且会议室时间大于零',()=>{const now=Date.parse('2026-11-04T23:50:00Z');assert.equal(h.enterpriseDefaultRange('attendance',now).start,'2026-11-05');const range=h.enterpriseSearchRange('rooms');assert.ok(Date.parse(range.end)>Date.parse(range.start))})
 check('所有命令均为只读',()=>assert.ok(allCalls.length>0&&allCalls.every(args=>!args.some(arg=>['send','update','create','delete'].includes(arg)))))
 console.log('enterprise-search: '+checks+' checks passed')
}finally{rmSync(home,{recursive:true,force:true})}
