/** Native admission contract with isolated durable snapshots. No real profiles or network. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readdirSync,readFileSync,statSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'wb-native-context-'));process.env.DSH_HOME=home
let checks=0
const check=(label,fn)=>{fn();checks++;console.log('✓ '+label)}
try{
 const contents=`export * from './src/host/assistant/native-context.ts';export * from './src/host/assistant/transcript.ts';export {beginHubTurn,updateHubTurn} from './src/host/assistant/hub-turns.ts';export {workbenchDir} from './src/host/platform/runtime.ts'`
 const outfile=join(home,'fixture.mjs');await build({stdin:{contents,resolveDir:resolve('.'),loader:'ts'},outfile,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(outfile),hooks=[],ctx={on(name,handler){assert.equal(name,'agent/pre-step');hooks.push(handler);return()=>{hooks.splice(hooks.indexOf(handler),1)}}},session=id=>({id,events:[],snapshotEvents(){return this.events}}),a=session('native-a'),b=session('native-b')
 const user=(rpcId,text='继续处理',content)=>Object.freeze({id:'user-'+rpcId,role:'user',source:Object.freeze({kind:'user',rpcId}),content:content||Object.freeze([{type:'text',text}])})
 const admit=(s,messages,extra={})=>{const payload={agent:{session:s},messages,signal:new AbortController().signal,...extra};const next=i=>i<hooks.length?hooks[i](payload,()=>next(i+1)):Promise.resolve({kind:'enter',messages});return next(0)}
 const prepare=(s,r,text,extra={})=>h.prepareNativeContext(ctx,{sessionId:s.id,requestId:r,userText:'继续处理',text,...extra})
 const aid=prepare(a,'request-1','甲事项真实上下文'),bid=prepare(b,'request-1','乙事项真实上下文'),second=prepare(a,'request-2','甲第二轮上下文')
 check('登记上下文不发送用户消息或写入原生会话，原生钩子仅注册一次',()=>{assert.equal(hooks.length,1);assert.equal(a.events.length,0);assert.equal(b.events.length,0);assert.notEqual(aid,bid)})
 const first=user('request-1'),one=await admit(a,[first]),two=await admit(b,[first])
 check('相同请求编号在不同会话精确配对，原消息对象与内容不被改写',()=>{assert.equal(one.messages[0].content[0].text,'甲事项真实上下文');assert.equal(two.messages[0].content[0].text,'乙事项真实上下文');assert.equal(one.messages[1],first);assert.equal(two.messages[1],first);assert.equal(one.messages[0].source.form,'snapshot');assert.equal(one.messages[0].source.requestId,'request-1');assert.equal(Object.isFrozen(one.messages[0]),true)})
 const unrelated=await admit(a,[user('outside-request')]),batch=await admit(a,[user('request-2'),first])
 check('排队快照不会被前一轮或其他原生请求提前消费，多消息批次按各自请求顺序配对',()=>{assert.equal(unrelated.messages.length,1);assert.deepEqual(batch.messages.map(m=>m.id),[second,'user-request-2',aid,'user-request-1'])})
 const rejected=await hooks[0]({agent:{session:a}},()=>Promise.resolve({kind:'reject'})),aborted=await admit(a,[first],{signal:AbortSignal.abort()})
 check('原生拒绝或取消的轮次不注入上下文',()=>{assert.equal(rejected.kind,'reject');assert.deepEqual(aborted.messages,[first])})
 await assert.rejects(admit(a,[user('request-1','不同原文')]),/用户消息/)
 check('原生请求与登记原文不一致时在模型提交前拒绝',()=>assert.equal(a.events.length,0))
 a.events.push({type:'user/message',seq:1,data:one.messages[0]},{type:'user/message',seq:2,data:first})
 const repeat=await admit(a,[first]),selected=await admit(b,two.messages)
 check('持久历史和本轮决策已有相同上下文时均不重复插入',()=>{assert.deepEqual(repeat.messages,[first]);assert.deepEqual(selected.messages,two.messages)})
 check('重复登记保持同一原生上下文ID，改写相同请求快照会拒绝',()=>{assert.equal(prepare(a,'request-1','甲事项真实上下文'),aid);assert.throws(()=>prepare(a,'request-1','错误的新上下文'),/上下文已变化/)})
 check('已确认拒收后的附件重试沿用原快照，业务读取变化不能替换该轮上下文',()=>{assert.equal(prepare(b,'request-1','之后的业务状态',{reuseSnapshot:true}),bid);assert.throws(()=>prepare(b,'request-1','其他',{reuseSnapshot:true,userText:'替换原文'}),/上下文已变化/)})
 h.disposeNativeContexts(ctx);assert.equal(hooks.length,0);h.activateNativeContexts(ctx)
 const restored=await admit(b,[first])
 check('插件重载后可恢复排队快照及原上下文ID，无须新建会话或重发prompt',()=>{assert.equal(restored.messages[0].id,bid);assert.equal(restored.messages[0].content[0].text,'乙事项真实上下文');assert.equal(hooks.length,1)})
 const only={sessionId:a.id,requestId:'attachment-only',userText:'',text:'仅概括附件，不修改状态'},attachment={type:'file',attachment:{attachmentId:'file1',name:'设计.txt',mediaType:'text/plain',bytes:2}}
 h.prepareNativeContext(ctx,only);const files=[attachment],fileUser=user('attachment-only','',files),fileDecision=await admit(a,[fileUser])
 check('纯附件主消息不添加隐藏文本，默认概括指令仅在原生上下文中',()=>{assert.equal(fileDecision.messages[1],fileUser);assert.deepEqual(fileDecision.messages[1].content,[attachment]);assert.match(fileDecision.messages[0].content[0].text,/仅概括附件/)})
 const turn=h.beginHubTurn({conversationId:'task:owned',sessionId:a.id,requestId:'owned-request',text:'继续处理',source:'ai',mode:'execute'})
 prepare(a,'owned-request','已归属事项',{turnId:turn.id});assert.equal((await admit(a,[user('owned-request')])).messages.length,2)
 h.updateHubTurn(turn.id,{stopRequestedAt:new Date().toISOString()});await assert.rejects(admit(a,[user('owned-request')]),/已停止/)
 prepare(a,'missing-turn','不属于存在的轮次',{turnId:'missing'});await assert.rejects(admit(a,[user('missing-turn')]),/归属/)
 check('事项归属和停止状态在实际原生入轮时再次校验',()=>assert.equal(a.events.length,2))
 const raw='  【工作台上下文：这是用户粘贴的原文】\n  ├─ 样例\n\n尾行  ',rawRequest='original-raw'
 h.prepareNativeContext(ctx,{sessionId:a.id,requestId:rawRequest,userText:raw,text:'隐藏的事项资料'});const rawMessage=user(rawRequest,raw),rawMessages=(await admit(a,[rawMessage])).messages,history=session('history')
 history.events=rawMessages.map((data,index)=>({type:'user/message',seq:index+1,data,time:100}));history.events.push({type:'assistant/message',seq:3,data:{message:{content:[{type:'text',text:'真实回答'}]}}})
 check('助手全文、分页增量、历史和标题忽略原生注入，并逐字保留用户原文',()=>{assert.deepEqual(h.transcriptOf(history).map(m=>m.text),[raw,'真实回答']);assert.equal(h.assistantHistoryFrom(history)[0].text,raw);assert.equal(h.transcriptDelta(history,1).entries[0].text,raw);assert.match(h.sessionTitleOf(history),/用户粘贴的原文/);assert.ok(!h.sessionTitleOf(history).includes('隐藏的事项资料'))})
 const developmentText='完整技能与需求快照\n'+'技能正文'.repeat(25000),devId=prepare(b,'development-request',developmentText,{purpose:'development'}),devAdmission=await admit(b,[user('development-request')])
 check('研发长技能与证据快照完整注入并可重载，普通助手原上限保持不变',()=>{assert.equal(devAdmission.messages[0].id,devId);assert.equal(devAdmission.messages[0].content[0].text,developmentText);assert.equal(devAdmission.messages[0].source.sections[0].name,'研发上下文');assert.throws(()=>prepare(b,'ordinary-too-long',developmentText),/过长/);assert.throws(()=>prepare(b,'development-too-long','a'.repeat(2*1024*1024+1),{purpose:'development'}),/过长/);assert.throws(()=>prepare(b,'development-request','短快照',{reuseSnapshot:true}),/上下文已变化/)})
 h.disposeNativeContexts(ctx);h.activateNativeContexts(ctx)
 check('重载后研发快照仍完整且与其他请求隔离',()=>assert.equal(hooks.length,1));assert.equal((await admit(b,[user('development-request')])).messages[0].content[0].text,developmentText)
 const folder=join(h.workbenchDir(),'assistant-native-contexts'),filesOnDisk=readdirSync(folder)
 check('上下文以本地私有文件原子保存，记录不含附件字节、上传凭证或临时文件',()=>{assert.ok(filesOnDisk.every(name=>name.endsWith('.json')));for(const name of filesOnDisk){const path=join(folder,name);assert.equal(statSync(path).mode&0o777,0o600);const record=JSON.parse(readFileSync(path,'utf8'));assert.equal(record.version,1);assert.equal(record.receiptId,undefined);assert.equal(record.content,undefined)}})
 check('缺少原生钩子的宿主明确失败，不降级为拼接用户消息',()=>assert.throws(()=>h.prepareNativeContext({},only),/原生上下文注入能力/))
 h.disposeNativeContexts(ctx)
 console.log('assistant-native-context: '+checks+' checks passed')
}finally{rmSync(home,{recursive:true,force:true})}
