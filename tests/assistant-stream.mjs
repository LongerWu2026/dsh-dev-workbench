/** Real hub + native follow contract, disposable state, no provider or external account. */
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
const home=mkdtempSync(join(tmpdir(),'assistant-stream-'));process.env.DSH_HOME=home
const contexts=[];let checks=0
try{
 await build({stdin:{contents:`export * from './src/host/assistant/hub-stream.ts';export {assistantHub} from './src/host/assistant/hub.ts';export * from './src/host/assistant/hub-store.ts';export {mutateWorkbenchState} from './src/host/storage/state-store.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(join(home,'host.mjs')),check=(name,fn)=>{fn();checks++;console.log('✓ '+name)},settle=()=>new Promise(resolve=>setImmediate(resolve))
 const fold=new h.VisibleAssistantStream()
 fold.push({type:'block-start',index:0,blockType:'reasoning'});fold.push({type:'reasoning-delta',index:0,text:'PRIVATE_REASONING'});fold.push({type:'text-delta',index:0,text:'MALFORMED_REASONING'})
 fold.push({type:'tool-call-delta',index:1,argumentsDelta:'PRIVATE_ARGUMENTS'});fold.push({type:'block-start',index:2,blockType:'text'});fold.push({type:'text-delta',index:2,text:'开始'});fold.push({type:'text-delta',index:2,text:'生成'})
 check('只拼接可见文字，不暴露推理或工具参数',()=>{assert.equal(fold.text(),'开始生成');assert.ok(!fold.text().includes('PRIVATE'))})
 fold.push({type:'block-end',index:2,block:{type:'text',text:'权威正文'}});fold.push({type:'text-delta',index:2,text:'迟到重复'})
 check('block-end替换增量，已关闭块不重复拼接',()=>assert.equal(fold.text(),'权威正文'))
 const large=new h.VisibleAssistantStream();large.push({type:'text-delta',index:0,text:'长'.repeat(100000)});check('预览有长度上限，不截断原生历史',()=>assert.equal(large.text().length,24000))
 const hidden=new h.VisibleAssistantStream();hidden.push({type:'text-delta',index:0,text:'<think>不能展示的内部过程'});check('不完整的思考标签内容也不作为回复展示',()=>assert.equal(hidden.text(),''))
 const events=[],native={id:'original',get seq(){return events.length},snapshotEvents:(from=0)=>events.filter(event=>event.seq>from)},append=(type,data)=>events.push({type,data,seq:events.length+1,time:Date.now()})
 append('turn/start',{turn:1});append('user/message',{source:{kind:'user',rpcId:'native-request'},content:[{type:'text',text:'继续当前问题'}]});append('step/start',{turn:1,step:1})
 let push,wakes=[],queue=[],followCalls=0,aborts=0,prompts=0
 const controller={prompt(){prompts++},follow(request,signal){followCalls++;assert.deepEqual(request.address,{kind:'session',sessionId:'original'});assert.equal(request.assistantStream,true);signal.addEventListener('abort',()=>{aborts++;while(wakes.length)wakes.shift()({done:true})},{once:true});return {[Symbol.asyncIterator](){return this},next(){return queue.length?Promise.resolve({value:queue.shift(),done:false}):new Promise(resolve=>wakes.push(resolve))},return(){return Promise.resolve({done:true})}}}}
 push=value=>{const wake=wakes.shift();if(wake)wake({value,done:false});else queue.push(value)}
 const ctx={get:key=>key==='sessionController'?controller:key==='sessions'?{get:id=>id===native.id?native:null,list:()=>[native]}:undefined};contexts.push(ctx)
 await h.mutateWorkbenchState(s=>s);h.rememberHubSession('chat:original','original','当前问题')
 const detail=()=>h.assistantHub(ctx,{action:'detail',conversationId:'chat:original'}),delta=()=>h.assistantHub(ctx,{action:'delta',conversationId:'chat:original',sessionId:'original',fromSeq:native.seq})
 await detail();await settle();push({type:'snapshot',assistantStream:{revision:3,activeAttempt:{attemptId:'attempt',startedAfterSeq:3,turn:1,step:1,nextIndex:2,stream:[{type:'chunk',chunk:{type:'block-start',index:0,blockType:'text'}},{type:'text-chunks',index:0,texts:['这是','开头']}]}}});await settle()
 let result=await detail(),turn=result.turns[0]
 check('打开正在生成的原会话，从baseline恢复已生成前缀，尚无完整assistant消息',()=>{assert.equal(turn.streamingText,'这是开头');assert.equal(turn.replyStreaming,true);assert.equal(turn.sessionId,'original');assert.ok(!events.some(event=>event.type==='assistant/message'));assert.equal(prompts,0)})
 h.watchHubStream(ctx,'original');h.watchHubStream(ctx,'original');check('反复读取共用一个原生订阅，不重复订阅',()=>assert.equal(followCalls,1))
 push({type:'assistant-stream',frame:{type:'chunk',attemptId:'attempt',revision:4,index:2,time:Date.now(),chunk:{type:'text-delta',index:0,text:'，继续输出'}}});await settle();result=await detail()
 check('同一消息卡片在完成前持续增长',()=>{assert.equal(result.turns.length,1);assert.equal(result.turns[0].id,turn.id);assert.equal(result.turns[0].streamingText,'这是开头，继续输出')})
 check('增量读取不把临时文字写入轮次结果文件',()=>{const path=join(home,'storages/dev-workbench/assistant-turns.json');try{assert.ok(!readFileSync(path,'utf8').includes('这是开头'))}catch(error){if(error.code!=='ENOENT')throw error}})
 push({type:'assistant-stream',frame:{type:'chunk',attemptId:'attempt',revision:4,index:2,chunk:{type:'text-delta',index:0,text:'，继续输出'}}});await settle();check('重复帧不产生重复文字',()=>assert.equal(h.streamingHubTurns(ctx,native,[turn])[0].streamingText,'这是开头，继续输出'))
 const {streamingText:preview,...plain}=turn,foreign=[{...plain,sessionId:'another'}, {...plain,nativeTurn:2}, {...plain,userSeq:200}]
 check('会话ID、轮次和原生用户边界不符时不附加内容',()=>assert.ok(h.streamingHubTurns(ctx,native,foreign).every(row=>row.streamingText===undefined)))
 append('assistant/message',{turn:1,step:1,message:{content:[{type:'text',text:'最终完整答复'}]}});push({type:'assistant-stream',frame:{type:'end',attemptId:'attempt',revision:5,index:3,outcome:{kind:'committed',eventType:'assistant/message',seq:native.seq}}});append('step/end',{turn:1,step:1});append('turn/end',{turn:1,reason:{kind:'completed'}});await settle();result=await detail()
 check('最终消息提交后撤下流式预览，只留下同一轮最终答复',()=>{assert.equal(result.turns.length,1);assert.equal(result.turns[0].reply,'最终完整答复');assert.equal(result.turns[0].streamingText,undefined);assert.equal(result.turns[0].status,'completed')})
 append('turn/start',{turn:2});append('user/message',{source:{kind:'user',rpcId:'second-request'},content:[{type:'text',text:'第二个问题'}]});append('step/start',{turn:2,step:1})
 push({type:'assistant-stream',frame:{type:'start',attemptId:'retry',revision:6,startedAfterSeq:native.seq,turn:2,step:1}});push({type:'assistant-stream',frame:{type:'chunk',attemptId:'retry',revision:7,index:0,chunk:{type:'text-delta',index:0,text:'旧尝试'}}});await settle()
 push({type:'assistant-stream',frame:{type:'start',attemptId:'new-attempt',revision:8,startedAfterSeq:native.seq,turn:2,step:1}});push({type:'assistant-stream',frame:{type:'chunk',attemptId:'new-attempt',revision:9,index:0,chunk:{type:'text-delta',index:0,text:'重新生成的内容'}}});await settle();result=await detail()
 check('模型重试从新尝试替换预览，不拼接上次残留',()=>assert.equal(result.turns.at(-1).streamingText,'重新生成的内容'))
 push({type:'assistant-stream',frame:{type:'end',attemptId:'new-attempt',revision:10,index:1,outcome:{kind:'abandoned'}}});append('turn/end',{turn:2,reason:{kind:'aborted'}});await settle();result=await detail()
 check('中断保留已接收前缀，明确标为未完成而非最终结果',()=>{assert.equal(result.turns.at(-1).streamingText,'重新生成的内容');assert.equal(result.turns.at(-1).replyStreaming,false);assert.equal(result.turns.at(-1).status,'interrupted')})
 const row={sessionId:'old',nativeTurn:5,userSeq:2,status:'recognizing'},old={id:'old',snapshotEvents:()=>[{type:'turn/start',seq:1,data:{turn:5}},{type:'user/message',seq:2,data:{}},{type:'assistant/chunk',seq:3,data:{turn:5,step:1,chunk:{type:'text-delta',index:0,text:'旧版即时内容'}}}]}
 check('旧版assistant/chunk事件也能实时显示',()=>assert.equal(h.streamingHubTurns({},old,[row])[0].streamingText,'旧版即时内容'))
 const interrupted={id:'old',snapshotEvents:()=>[{type:'turn/start',seq:1,data:{turn:5}},{type:'user/message',seq:2,data:{}},{type:'assistant/message',seq:3,data:{turn:5,step:1,interrupted:true,message:{content:[{type:'reasoning',text:'PRIVATE'},{type:'text',text:'持久保存的中断前缀'}]}}},{type:'turn/end',seq:4,data:{turn:5,reason:{kind:'aborted'}}}]}
 check('取消时提交的interrupted原文在重新打开后仍可查看，保持未完成标记',()=>{const view=h.streamingHubTurns({},interrupted,[{...row,status:'interrupted'}])[0];assert.equal(view.streamingText,'持久保存的中断前缀');assert.equal(view.replyStreaming,false)})
 const failedAttempt={id:'old',snapshotEvents:()=>[{type:'turn/start',seq:1,data:{turn:5}},{type:'user/message',seq:2,data:{}},{type:'assistant/attempt',seq:3,data:{turn:5,step:1,stream:[{type:'text-chunks',index:0,texts:['失败前已经接收']}]}},{type:'turn/end',seq:4,data:{turn:5,reason:{kind:'error'}}}]}
 check('失败attempt的原生已存片段可以恢复，但不能标记为完成结果',()=>{const view=h.streamingHubTurns({},failedAttempt,[{...row,status:'failed'}])[0];assert.equal(view.streamingText,'失败前已经接收');assert.equal(view.replyStreaming,false)})
 const steered={...old,snapshotEvents:()=>[...old.snapshotEvents(),{type:'user/message',seq:4,data:{source:{kind:'user'}}},{type:'assistant/chunk',seq:5,data:{turn:5,step:2,chunk:{type:'text-delta',index:0,text:'新问题的前缀'}}}]}
 check('同一原生轮次中插入新问题后，旧消息不会收到新问题的片段',()=>{const views=h.streamingHubTurns({},steered,[{...row,status:'interrupted'},{...row,userSeq:4}]);assert.equal(views[0].streamingText,undefined);assert.equal(views[1].streamingText,'新问题的前缀')})
 h.disposeHubStreams(ctx);check('释放仅取消只读订阅，不取消或重发模型轮次',()=>{assert.equal(aborts,1);assert.equal(prompts,0)})
 console.log('assistant-stream: '+checks+' checks passed; no provider calls or real state changes')
}finally{if(typeof contexts[0]?.dispose==='function')contexts[0].dispose();rmSync(home,{recursive:true,force:true})}
