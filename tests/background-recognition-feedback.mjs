/** Pure background-history display; no business writes, external calls or real models. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-background-feedback-'));process.env.DSH_HOME=home
try{
 await build({stdin:{contents:`export * from './src/host/assistant/hub-background.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'fixture.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(join(home,'fixture.mjs'));let checks=0
 const check=(label,fn)=>{fn();checks++;console.log('✓ '+label)}
 const packet={protocol:'awb-message-batch-v2',batchId:'batch-fixture',messages:Array.from({length:50},(_,i)=>({sourceId:'source-'+(i+1),text:'原消息 '+(i+1)}))}
 const submitted={role:'user',text:'工作台消息批处理协议\n'+JSON.stringify(packet)}
 const outcome=(index)=>({noise:false,summary:'实际摘要 '+(index+1),items:index%3===0?[{title:'处理事项 '+(index+1),needsAction:true,needsReply:false}]:index%3===1?[{title:'回复事项 '+(index+1),needsAction:false,needsReply:true}]:[]})
 const output={batchId:packet.batchId,results:packet.messages.map((row,i)=>({sourceId:row.sourceId,analysis:outcome(i)}))}
 const entry=(value)=>({role:'assistant',text:typeof value==='string'?value:JSON.stringify(value)})
 const details=(value=output,input=submitted)=>h.backgroundRecognitionDetails('analysis',entry(value),input)
 check('输入批次完整展示50条来源和原消息，不再仅显示8条',()=>{const display=h.backgroundDisplayText('analysis',submitted);assert.match(display,/\[source-50\] 原消息 50/);assert.equal(h.backgroundSubmittedPacket(submitted).messages.length,50)})
 check('每条实际AI结果都有来源、摘要和指令建议',()=>{const result=details();assert.equal(result.items.length,50);assert.equal(result.items[49].sourceId,'source-50');assert.equal(result.items[0].instructions[0],'需待办：处理事项 1');assert.equal(result.items[1].instructions[0],'需待回复：回复事项 2');assert.match(result.items[2].instructions[0],/无需处理/);assert.ok(result.items.every(row=>row.status==='recognized'));assert.match(result.note,/AI 返回.*是否已登记.*业务处理结果/)})
 check('可读全文保留第50项，不藏进原始JSON',()=>{const display=h.backgroundDisplayText('analysis',entry(output),submitted);assert.match(display,/\[source-50\] 实际摘要 50/);assert.ok(!display.includes('更多结果可展开原始内容'))})
 const mixed=structuredClone(output);mixed.results[0].analysis={noise:true,summary:'问候',items:[]};mixed.results[1].analysis={noise:false,summary:'知会',items:[]}
 check('noise及空items明确反馈无需处理，同时不假造已登记',()=>{const result=details(mixed);assert.match(result.items[0].instructions[0],/无需处理/);assert.match(result.items[1].instructions[0],/未识别出待办或待回复/);assert.ok(!h.backgroundDisplayText('analysis',entry(mixed),submitted).includes('已登记成功'))})
 const missing=structuredClone(output);missing.results.splice(17,1)
 check('缺失sourceId只对原消息明确未返回结果',()=>{const result=details(missing);assert.equal(result.items.length,50);assert.equal(result.items[17].sourceId,'source-18');assert.equal(result.items[17].status,'invalid');assert.match(result.items[17].reason,/未返回本条/);assert.equal(result.items[16].status,'recognized')})
 const duplicate=structuredClone(output);duplicate.results.push(duplicate.results[0])
 check('重复sourceId不能当作本条或整批有效',()=>{const result=details(duplicate);assert.equal(result.items[0].status,'invalid');assert.match(result.items[0].reason,/重复/);assert.match(result.note,/不能视为整批有效/)})
 const wrong=structuredClone(output);wrong.results[0].sourceId='not-submitted'
 check('错误来源编号不冒充提交消息，原消息标无效并说明错误ID',()=>{const result=details(wrong);assert.equal(result.items[0].status,'invalid');assert.match(result.note,/不属于本批/);assert.equal(result.items.length,50)})
 check('批次ID不匹配时每条都标未返回有效结果',()=>{const result=details({...output,batchId:'different'});assert.ok(result.items.every(row=>row.status==='invalid'&&/batchId/.test(row.reason)))})
 const malformed=structuredClone(output);malformed.results[1].analysis={noise:false,items:[{title:'缺少指令布尔字段'}]}
 check('单条结构无效不能伪造需待办或需回复指令',()=>{const row=details(malformed).items[1];assert.equal(row.status,'invalid');assert.deepEqual(row.instructions,['未返回有效结果'])})
 check('空输出和无效JSON为每条原消息提供明确失败反馈',()=>{for(const value of ['', '```json\n{bad\n```']){const result=details(value);assert.equal(result.items.length,50);assert.ok(result.items.every(row=>row.status==='invalid'));assert.match(result.items[0].reason,/未返回|不是有效/);assert.match(h.backgroundDisplayText('analysis',entry(value),submitted),/未返回有效结果/)}})
 check('单条旧格式可与单条提交来源准确关联，多条不能猜测归属',()=>{const single={...packet,messages:[packet.messages[0]]};assert.equal(details(outcome(0),single).items[0].sourceId,'source-1');assert.equal(details(outcome(0),single).items[0].status,'recognized');assert.ok(details(outcome(0)).items.every(row=>row.status==='invalid'))})
 check('缺少提交批次时只展示模型实际返回，不宣称全量处理',()=>{const result=details(output,null);assert.equal(result.items.length,50);assert.match(result.note,/未找到对应提交批次/);assert.equal(result.items[0].sourceId,'source-1')})
 check('超过批上限明确告知只展示50条',()=>{const large={...packet,messages:[...packet.messages,{sourceId:'source-51',text:'额外消息'}]};const result=details(output,large);assert.equal(result.items.length,50);assert.match(result.note,/仅展示前 50 条/);assert.match(h.backgroundDisplayText('analysis',{role:'user',text:JSON.stringify(large)}),/仅展示前 50 条/)})
 check('整批资讯总结作为一个真实回复展示，不拆成四段或补造无效字段',()=>{const result=h.backgroundRecognitionDetails('summary',entry({overview:'本批主要介绍模型与智能体工程的进展。'}));assert.equal(result.items.length,1);assert.equal(result.items[0].label,'本批资讯总结');assert.equal(result.items[0].summary,'本批主要介绍模型与智能体工程的进展。');assert.equal(result.items[0].status,'recognized')})
 const summary={change:'真实变化',usage:'真实场景',risk:'原文未说明',practice:'真实实践'}
 check('资讯完整展示真实四段摘要及保存界限',()=>{const result=h.backgroundRecognitionDetails('summary',entry(summary));assert.equal(result.items.length,4);assert.deepEqual(result.items.map(row=>row.summary),Object.values(summary));assert.match(h.backgroundDisplayText('summary',entry(summary)),/技术变化.*真实变化/);assert.match(result.note,/是否已保存/)})
 check('资讯缺段或字段类型错误明确说明，不填造内容',()=>{const result=h.backgroundRecognitionDetails('summary',entry({...summary,risk:null,practice:''}));assert.equal(result.items[2].status,'invalid');assert.equal(result.items[2].summary,'');assert.equal(result.items[3].status,'invalid');assert.match(h.backgroundDisplayText('summary',entry('not json')),/不是有效的 JSON 对象/)})

 const events=[],reads=[];let restores=0;const session={id:'background-session',get seq(){return events.length},snapshotEvents(from=0){reads.push(from);return events.filter(row=>row.seq>from)}},ctx={},restore=async()=>{restores++;await Promise.resolve();return session},append=(type,data)=>events.push({seq:events.length+1,time:Date.now(),type,data})
 append('turn/start',{turn:1});append('user/message',{content:[{type:'text',text:submitted.text}]})
 const initial=await Promise.all([h.readBackgroundSnapshot(ctx,session.id,restore),h.readBackgroundSnapshot(ctx,session.id,restore)])
 check('并发冷读取仍复用一次恢复，不把运行中无结果当失败',()=>{assert.equal(restores,1);assert.equal(reads.length,1);assert.equal(initial[0].entries.filter(row=>row.role==='assistant').length,0);assert.equal(initial[0].turnActive,true)})
 append('turn/end',{turn:1,reason:{kind:'completed'}});const blank=await h.readBackgroundSnapshot(ctx,session.id,restore)
 check('终态没有assistant时按原生seq补空结果反馈',()=>{const row=blank.entries.find(row=>row.role==='assistant');assert.equal(row.seq,3);assert.equal(row.emptyOutput,true);assert.equal(blank.turnActive,false);assert.match(h.backgroundDisplayText('analysis',row,submitted),/未返回可展示内容/);assert.equal(reads.at(-1),2)})
 const readsBefore=reads.length,again=await h.readBackgroundSnapshot(ctx,session.id,restore)
 check('重复轮询不重复补终态，不重新读取全日志',()=>{assert.equal(again.entries.length,blank.entries.length);assert.equal(reads.length,readsBefore)})
 append('turn/start',{turn:2});append('assistant/message',{turn:2,message:{content:[{type:'reasoning',text:'SECRET_REASONING'}]}});const stillRunning=await h.readBackgroundSnapshot(ctx,session.id,restore)
 check('运行中的空assistant不能提前标成失败',()=>{assert.equal(stillRunning.entries.filter(row=>row.role==='assistant').length,1);assert.equal(stillRunning.turnActive,true)})
 append('turn/end',{turn:2,reason:{kind:'completed'}});const explicit=await h.readBackgroundSnapshot(ctx,session.id,restore)
 check('原生显式空assistant可见，reasoning不展示且终止不再补重复行',()=>{assert.equal(explicit.entries.filter(row=>row.role==='assistant').length,2);assert.equal(explicit.entries.at(-1).seq,5);assert.ok(!JSON.stringify(explicit.entries).includes('SECRET_REASONING'))})
 append('turn/start',{turn:3});append('turn/end',{turn:3,reason:{kind:'error',error:{message:'真实模型失败'}}});const failed=await h.readBackgroundSnapshot(ctx,session.id,restore)
 check('原生错误沿用error行，不被空结果覆盖',()=>{assert.equal(failed.entries.at(-1).role,'error');assert.match(failed.entries.at(-1).text,/真实模型失败/);assert.equal(failed.entries.filter(row=>row.role==='assistant').length,2)})
 append('turn/start',{turn:4});await h.readBackgroundSnapshot(ctx,session.id,restore);append('turn/end',{turn:4,reason:{kind:'interrupted'}});const interrupted=await h.readBackgroundSnapshot(ctx,session.id,restore)
 check('跨轮询仍保留openTurn状态，中断明确展示未完成',()=>{const row=interrupted.entries.at(-1);assert.equal(row.seq,10);assert.match(h.backgroundDisplayText('summary',row),/已中断或停止/);assert.equal(interrupted.turnActive,false)})
 console.log('background-recognition-feedback: '+checks+' scenarios passed')
}finally{rmSync(home,{recursive:true,force:true})}
