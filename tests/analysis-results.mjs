/** Synthetic extraction relationships and native-session fixtures only. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'

const home=mkdtempSync(join(tmpdir(),'workbench-analysis-results-'));process.env.DSH_HOME=home
try{
 await build({stdin:{contents:`export {listAnalysisResults,analysisResultTarget} from './src/host/assistant/analysis-results.ts';export {assistantHub as hub} from './src/host/assistant/hub.ts';export {setShared_workbenchCtx} from './src/host/application/service-context.ts';export {loadWorkbenchState as state,mutateWorkbenchState as mutate} from './src/host/storage/state-store.ts';export {hubIndex} from './src/host/assistant/hub-store.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'fixture.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(join(home,'fixture.mjs'));let checks=0,created=0
 const check=(title,fn)=>{fn();checks++;console.log('✓ '+title)},at=n=>new Date(Date.now()+n*1000).toISOString()
 const fullDescription='当前完整待办正文：'+'需要保留的实际内容。'.repeat(420)+'完整正文末尾标记',now=at(0)
 const source=(id,excerpt)=>({id,title:id,excerpt,provider:'manual',fetchedAt:now,locator:{sentAt:now}})
 const task=(id,title,extra={})=>({id,title,description:'实际待办正文 '+id,status:'ready',priority:'normal',createdAt:now,updatedAt:now,sourceRefs:[],...extra})
 const reply=(id,sourceId,extra={})=>({id,sourceId,snippet:'实际待回复内容 '+id,contact:'测试联系人',groupName:'测试讨论组',stage:'待回复',createdAt:now,updatedAt:now,taskIds:[],...extra})
 const entry=(id,sourceId,runId,n,extra={})=>({id,sourceId,analysisJobId:runId,status:'done',analyzedAt:at(n),analysis:{noise:false,summary:'识别结果 '+id,items:[]},taskIds:[],...extra})
 const fixture={sources:[source('s-one','原始来源甲'),source('s-two','来源搜索词：供应链确认'),source('s-three','由提取队列关联的来源'),source('s-review','尚待用户确认的建议'),source('s-many','批量待回复来源'),source('s-unprocessed','尚未识别的来源')],
  tasks:[task('t-direct','查询专用需求',{sourceRefId:'s-one',description:fullDescription,assignee:'实际负责人',dueAt:at(86400)}),task('t-refs','多来源待办',{sourceRefs:[{sourceId:'s-two'}]}),task('t-queue','队列关联待办'),task('t-manual','手动无关待办'),task('t-unprocessed','未识别来源的手动待办',{sourceRefId:'s-unprocessed'}),task('t-archived','已归档待办',{sourceRefId:'s-one',archivedAt:now}),task('t-detached','来源已移除待办',{sourceRefId:'s-removed'})],
  replies:[reply('r-one','s-one'),reply('r-two','s-two',{contact:'张测试',snippet:'需要确认交付时间'}),reply('r-unprocessed','s-unprocessed'),reply('r-archived','s-two',{archivedAt:now}),...Array.from({length:125},(_,i)=>reply('r-bulk-'+String(i).padStart(3,'0'),'s-many'))],
  analysisQueue:[entry('e-one','s-one','run-a',1),entry('e-two','s-two','run-b',2),entry('e-three','s-three','run-a',3,{taskIds:['t-queue']}),entry('e-review','s-review','run-b',4,{status:'awaiting_human',analysis:{noise:false,summary:'待确认',items:[{id:'suggested-only',title:'未登记建议',needsAction:true}]}}),entry('e-many','s-many','run-b',5),entry('e-detached','s-removed','run-a',6,{taskIds:['t-detached']})]}

 const all=h.listAnalysisResults(fixture,{limit:50})
 check('实际提取结果按原始来源、sourceRefs或队列taskIds关联，不包含手工无关项',()=>{assert.deepEqual(h.listAnalysisResults(fixture,{kind:'task'}).items.map(row=>row.id).sort(),['t-direct','t-queue','t-refs']);assert.equal(all.counts.tasks,3);assert.equal(all.counts.replies,127);assert.equal(all.total,130)})
 check('结果保留来源、识别条目和运行编号，可定位实际记录',()=>{const row=h.listAnalysisResults(fixture,{query:'查询专用需求'}).items[0];assert.equal(row.sourceId,'s-one');assert.equal(row.sourceText,'原始来源甲');assert.equal(row.analysisEntryId,'e-one');assert.equal(row.runId,'run-a');assert.equal(row.conversationId,'task:t-direct')})
 check('没有关联提取结果的手动待办和待回复不能作为修改目标',()=>{assert.throws(()=>h.analysisResultTarget(fixture,'task','t-manual'),/不属于实际消息提取结果/);assert.throws(()=>h.analysisResultTarget(fixture,'task','t-unprocessed'),/不属于实际消息提取结果/);assert.throws(()=>h.analysisResultTarget(fixture,'reply','r-unprocessed'),/不属于实际消息提取结果/)})
 check('已归档结果、缺失结果及来源被移除的结果拒绝修改',()=>{assert.throws(()=>h.analysisResultTarget(fixture,'task','t-archived'),/已归档/);assert.throws(()=>h.analysisResultTarget(fixture,'reply','r-archived'),/已归档/);assert.throws(()=>h.analysisResultTarget(fixture,'task','not-found'),/已不存在/);assert.throws(()=>h.analysisResultTarget(fixture,'task','t-detached'),/不属于实际消息提取结果/)})
 check('awaiting_human只计待确认建议，未登记建议不能冒充可修改实体',()=>{assert.equal(all.counts.pendingReview,1);assert.ok(!all.items.some(row=>row.id==='suggested-only'));assert.throws(()=>h.analysisResultTarget(fixture,'task','suggested-only'),/已不存在/);assert.throws(()=>h.analysisResultTarget(fixture,'analysis','e-review'),/明确选择/)})
 const pages=[];for(let offset=0;offset<all.total;offset+=7)pages.push(h.listAnalysisResults(fixture,{offset,limit:7}));const ids=pages.flatMap(page=>page.items.map(row=>row.kind+':'+row.id))
 check('混合待办和待回复稳定分页，125条回复不会挤掉较早待办',()=>{assert.equal(ids.length,130);assert.equal(new Set(ids).size,130);assert.ok(ids.includes('task:t-direct'));assert.ok(ids.includes('task:t-queue'));assert.equal(pages[0].hasMore,true);assert.equal(pages.at(-1).hasMore,false);assert.equal(h.listAnalysisResults(fixture,{kind:'task',limit:50}).total,3)})
 check('搜索支持标题、来源和联系人，并与类型筛选兼容',()=>{assert.deepEqual(h.listAnalysisResults(fixture,{query:'张测试'}).items.map(row=>row.id),['r-two']);assert.deepEqual(h.listAnalysisResults(fixture,{query:'供应链确认'}).items.map(row=>row.id).sort(),['r-two','t-refs']);assert.deepEqual(h.listAnalysisResults(fixture,{kind:'task',query:'供应链确认'}).items.map(row=>row.id),['t-refs']);assert.equal(h.listAnalysisResults(fixture,{query:'不存在的检索词'}).total,0)})
 const runA=h.listAnalysisResults(fixture,{runId:'run-a',limit:50}),runB=h.listAnalysisResults(fixture,{runId:'run-b',kind:'task',limit:50})
 check('按runId筛选只返回本轮关联实体与待确认数量',()=>{assert.deepEqual(runA.items.map(row=>row.id).sort(),['r-one','t-direct','t-queue']);assert.equal(runA.counts.pendingReview,0);assert.deepEqual(runB.items.map(row=>row.id),['t-refs']);assert.equal(runB.counts.pendingReview,1);assert.equal(h.listAnalysisResults(fixture,{runId:'run-missing'}).total,0)})
 const moved=structuredClone(fixture);moved.sources=moved.sources.filter(row=>row.id!=='s-one')
 check('源记录随后移除时列表与修改资格同步失效',()=>{assert.ok(!h.listAnalysisResults(moved,{kind:'task',limit:50}).items.some(row=>row.id==='t-direct'));assert.throws(()=>h.analysisResultTarget(moved,'reply','r-one'),/不属于实际消息提取结果/)})

 const sessions=new Map(),prompts=[]
 function native(id){const events=[],row={id,get seq(){return events.length},header:{createdAt:Date.now()},snapshotEvents:(from=0)=>events.filter(event=>event.seq>from),append(type,data){events.push({seq:events.length+1,time:Date.now(),type,data})}};sessions.set(id,row);return row}
 const controller={create(){return {session:native('session-extraction-'+(++created))}},async rename(){},async prompt(request){prompts.push(request);const session=sessions.get(request.sessionId);session.append('user/message',{content:request.content});session.append('assistant/message',{message:{content:[{type:'text',text:'仅测试模型回包'}]}});session.append('turn/end',{reason:{kind:'completed'}})}}
 const ctx={get:key=>({sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]},sessionController:controller})[key]};h.setShared_workbenchCtx(ctx)
 await h.mutate(state=>{Object.assign(state,structuredClone(fixture));return state})
 const detail=await h.hub(ctx,{action:'detail',conversationId:'system:analysis',extractionLimit:7})
 check('真实assistantHub detail返回分页extraction，查看本身不新建会话或调用模型',()=>{assert.equal(detail.status,'ok');assert.equal(detail.extraction.total,130);assert.equal(detail.extraction.items.length,7);assert.equal(detail.extraction.counts.tasks,3);assert.equal(detail.extraction.counts.pendingReview,1);assert.equal(created,0);assert.equal(prompts.length,0)})
 const filtered=await h.hub(ctx,{action:'detail',conversationId:'system:analysis',extractionKind:'task',extractionQuery:'供应链确认',extractionOffset:0,extractionLimit:2})
 check('Hub正确转发结果搜索和类型分页参数',()=>{assert.equal(filtered.extraction.total,1);assert.equal(filtered.extraction.items[0].id,'t-refs');assert.equal(filtered.extraction.limit,2)})
 const runDetail=await h.hub(ctx,{action:'detail',conversationId:'system:analysis',extractionRunId:'run-a',extractionLimit:50})
 check('Hub按轮筛选extraction仅展示该runId关联结果',()=>{assert.equal(runDetail.extraction.total,3);assert.deepEqual(runDetail.extraction.items.map(row=>row.id).sort(),['r-one','t-direct','t-queue']);assert.equal(runDetail.extraction.counts.pendingReview,0)})
 const taskIdsBefore=h.state().tasks.map(row=>row.id),pendingMutation=await h.hub(ctx,{action:'operate',conversationId:'system:analysis',operation:'analysis.updateResult',kind:'task',id:'suggested-only',patch:{title:'不能更新未登记建议'}})
 check('真实Hub操作不能把待确认建议当作已登记待办修改或自动创建',()=>{assert.equal(pendingMutation.status,'error');assert.deepEqual(h.state().tasks.map(row=>row.id),taskIdsBefore);assert.equal(h.state().analysisQueue.find(row=>row.id==='e-review').status,'awaiting_human');assert.equal(created,0);assert.equal(prompts.length,0)})
 for(const ref of [{kind:'task',id:'t-manual'},{kind:'task',id:'t-archived'},{kind:'task',id:'t-detached'},{kind:'task',id:'suggested-only'},{kind:'reply',id:'r-unprocessed'}]){
  const denied=await h.hub(ctx,{action:'send',conversationId:'system:analysis',text:'请解释我选择的这个结果',refs:[ref]});assert.equal(denied.status,'error');assert.equal(created,0);assert.equal(prompts.length,0)
 }
 check('无关、归档、来源失效和未登记refs在原生创建与prompt之前拒绝',()=>{assert.equal(created,0);assert.equal(prompts.length,0);assert.equal(h.hubIndex().conversations.find(row=>row.id==='system:analysis')?.threads.length,0)})
 await h.mutate(state=>{state.tasks.find(row=>row.id==='t-direct').status='running';state.tasks.find(row=>row.id==='t-direct').assignee='最新实际负责人';state.replies.find(row=>row.id==='r-two').snippet='页面已修改的最新回复摘要';return state})
 const sent=await h.hub(ctx,{action:'send',conversationId:'system:analysis',text:'结合所选待办和待回复解释如何继续处理',refs:[{kind:'task',id:'t-direct',title:'伪造浏览器标题',body:'伪造旧上下文内容'},{kind:'reply',id:'r-two',body:'已过期的回复内容'}]})
 const actualPrompt=prompts.at(-1)?.content.map(block=>block.text||'').join('\n')||'',contextLine=actualPrompt.split('\n')[1],context=JSON.parse(contextLine)
 check('明确refs使用当前完整业务记录，忽略浏览器旧标题和正文',()=>{assert.equal(sent.status,'ok');assert.equal(created,1);assert.equal(context.selectedExtractionResults.length,2);const selected=context.selectedExtractionResults.find(row=>row.kind==='task');assert.equal(selected.id,'t-direct');assert.equal(selected.record.description,fullDescription);assert.equal(selected.record.status,'running');assert.equal(selected.record.assignee,'最新实际负责人');assert.equal(context.selectedExtractionResults.find(row=>row.kind==='reply').record.snippet,'页面已修改的最新回复摘要');assert.ok(actualPrompt.includes('完整正文末尾标记'));assert.ok(!actualPrompt.includes('伪造浏览器标题'));assert.ok(!actualPrompt.includes('伪造旧上下文内容'));assert.ok(!actualPrompt.includes('已过期的回复内容'))})
 check('结果修改提示使用真实查询和updateResult合同，不把再识别当成修改',()=>{assert.match(actualPrompt,/analysis\.results/);assert.match(actualPrompt,/analysis\.updateResult/);assert.match(actualPrompt,/未登记建议不能冒充已保存结果/)})
 const beforeInvalid={created,prompts:prompts.length},invalidExisting=await h.hub(ctx,{action:'send',conversationId:'system:analysis',sessionId:sent.sessionId,text:'继续处理这条',refs:[{kind:'task',id:'t-manual'}]})
 check('已有互动会话也拒绝无关refs，不追加模型轮次或换会话',()=>{assert.equal(invalidExisting.status,'error');assert.equal(created,beforeInvalid.created);assert.equal(prompts.length,beforeInvalid.prompts)})
 console.log('analysis-results: '+checks+' scenarios passed')
}finally{rmSync(home,{recursive:true,force:true})}
