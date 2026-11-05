import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,renameSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'
const home=mkdtempSync(join(tmpdir(),'workbench-capture-'));process.env.DSH_HOME=home
await build({stdin:{contents:`export {apply} from './src/host/plugin.ts';export * from './src/host/storage/state-store.ts';export * from './src/host/assistant/hub-turns.ts';export * from './src/host/assistant/hub-store.ts';export * from './src/host/knowledge/content-store.ts';export * from './src/host/knowledge/retrieval.ts';export * from './src/host/storage/migration.ts';export {articleMarkdown} from './src/host/news/article.ts';export * from './src/host/news/article-transport.ts';export {createConversationReader} from './src/host/integrations/conversation-reader.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const h=await import(join(home,'host.mjs')),dispose=[],sessions=new Map();let api,checks=0,fetches=0,failFetch=false
const html=`<html><head><title>原文快照验收</title></head><body><nav>不保存的导航</nav><article><h1>原文快照验收</h1><p>${'用于离线知识检索的完整正文。'.repeat(2200)}</p><h2>结尾证据</h2><p>穹顶缓存方案采用银杏协议进行分段同步。</p><pre><code>const result = 42;</code></pre><table><tr><th>字段</th><th>值</th></tr><tr><td>端口</td><td>18496</td></tr></table><p><a href="/docs">文档</a><a href="javascript:alert(1)">危险链接</a></p><script>evil()</script></article></body></html>`
const ctx={provide:(name,value)=>{if(name==='workbench')api=value},inject(){},effect(fn){const d=fn();if(typeof d==='function')dispose.push(d)},get(name){if(name==='sessions')return {get:id=>sessions.get(id)};if(name==='web')return {fetch:async()=>{fetches++;if(failFetch)throw Error('合成网页失效');return {statusCode:200,body:{content:html}}}}},logger:{info(){}}}
const check=(name,fn)=>{fn();checks++;console.log('✓ '+name)}
try{
 h.apply(ctx,{})
 const readme=await h.articleMarkdown('<html><body><a href="#main">Skip to content</a><article class="markdown-body"><h1>项目 README</h1><p>'+('项目功能与使用说明。'.repeat(20))+'</p></article></body></html>','https://github.com/example/project')
 check('GitHub阅读正文优先README，不收藏网站导航',()=>{assert.match(readme.body,/项目 README/);assert.doesNotMatch(readme.body,/Skip to content/)})
 check('公开网页直读拒绝回环、内网及映射地址',()=>{for(const address of ['127.0.0.1','10.0.0.2','169.254.169.254','172.16.0.1','192.168.1.1','::1','::ffff:127.0.0.1','fc00::1'])assert.equal(h.publicArticleAddress(address),false);assert.equal(h.publicArticleAddress('8.8.8.8'),true)})
 await h.mutateWorkbenchState(state=>({...state,settings:{...state.settings,automation:{enabled:false},aiExtract:{enabled:false}},knowledge:[],radar:[{id:'article',title:'原文快照验收',url:'https://example.invalid/article?utm_source=demo',source:'合成官网'}],knowledgeSpaces:[{id:'company',name:'公司'},{id:'client',name:'客户'}],projects:[{id:'A',name:'A',knowledgeSpaceId:'company'},{id:'B',name:'B',knowledgeSpaceId:'company'},{id:'C',name:'C',knowledgeSpaceId:'client'}]}))
 let turn=h.beginHubTurn({conversationId:'chat:capture',text:'如何发布穹顶缓存方案？',source:'ai',mode:'execute',sessionId:'session',knowledgeScope:{spaceId:'company',projectId:'A'}})
 h.updateHubTurn(turn.id,{status:'completed',reply:'发布之前验证银杏协议，再执行灰度验收。',replySource:'assistant'})
 const draft=await api.knowledgeCapture({action:'prepare',kind:'assistant',turnId:turn.id,conversationId:turn.conversationId})
 check('AI笔记仅包含问题与定稿回答并继承项目隔离',()=>{assert.match(draft.body,/## 问题/);assert.match(draft.body,/灰度验收/);assert.equal(draft.scope.spaceId,'company');assert.equal(draft.scope.projectId,'A');assert.equal(draft.scopeLocked,true)})
 await assert.rejects(api.knowledgeCapture({action:'save',draftId:draft.draftId,title:draft.title,body:draft.body,scope:{spaceId:'client',projectId:'C'}}),/不能将/);checks++
 let saved=await api.knowledgeCapture({action:'save',draftId:draft.draftId,title:draft.title,body:draft.body})
 check('仅保存笔记默认不进入模型检索',()=>{assert.equal(saved.snapshot.knowledge.at(-1).reviewState,'candidate');assert.equal(h.retrieveKnowledge(saved.snapshot,'银杏协议',{scope:draft.scope}).hits.length,0)})
 const both=await Promise.all([true,true].map(useForAnswers=>api.knowledgeCapture({action:'save',draftId:draft.draftId,title:'改标题不重复',body:draft.body,useForAnswers})))
 check('重复及并发保存按来源内容去重，显式用于回答会更新候选状态',()=>{assert.ok(both.every(row=>row.duplicate));assert.equal(h.loadWorkbenchState().knowledge.length,1);assert.equal(h.loadWorkbenchState().knowledge[0].reviewState,'confirmed');assert.equal(h.retrieveKnowledge(h.loadWorkbenchState(),'银杏协议',{scope:draft.scope}).hits.length,1)})
 for(const scope of [{spaceId:'company',projectId:'B'},{spaceId:'client',projectId:'C'},{spaceId:'personal',projectId:null}]){await assert.rejects(api.knowledgeCapture({action:'read',id:saved.itemId,scope}),/不属于/);checks++}
 h.updateHubTurn(turn.id,{status:'recognizing'});await assert.rejects(api.knowledgeCapture({action:'prepare',kind:'assistant',turnId:turn.id,conversationId:turn.conversationId}),/最终回答/);checks++
 const nativeEvents=[{seq:1,type:'turn/start'},{seq:2,type:'user/message',data:{content:[{type:'text',text:'测试'}]}},{seq:3,type:'assistant/message',data:{message:{id:'thinking',channel:'analysis',content:[{type:'text',text:'内部过程'}]}}},{seq:4,type:'assistant/message',data:{message:{id:'draft',content:[{type:'text',text:'中间答复'}]}}},{seq:5,type:'assistant/message',data:{message:{id:'final',content:[{type:'text',text:'最终可保存的完整结果'}]}}},{seq:6,type:'turn/end',data:{reason:{kind:'completed'}}}]
 sessions.set('native',{id:'native',snapshotEvents:()=>nativeEvents})
 for(const messageId of ['thinking','draft','missing']){await assert.rejects(api.knowledgeCapture({action:'prepare',kind:'native',sessionId:'native',messageId}));checks++}
 const native=await api.knowledgeCapture({action:'prepare',kind:'native',sessionId:'native',messageId:'final'})
 check('原生回复必须精确命中最后定稿，不回退到其他消息',()=>assert.equal(native.body,'最终可保存的完整结果'))
 const [article1,article2]=await Promise.all([api.radarArticle({id:'article'}),api.radarArticle({id:'article'})])
 check('网页读取合并并发请求，正文保留标题表格代码和结尾',()=>{assert.equal(fetches,1);assert.equal(article1.body,article2.body);assert.ok(article1.body.length>20000);assert.match(article1.body,/银杏协议/);assert.match(article1.body,/```/);assert.match(article1.body,/18496/);assert.match(article1.body,/https:\/\/example.invalid\/docs/);assert.doesNotMatch(article1.body,/javascript:|evil\(\)|不保存的导航/)})
 failFetch=true;const cached=await api.radarArticle({id:'article'});await assert.rejects(api.radarArticle({id:'article',reload:true}),/原文读取失败/)
 check('缓存离线可读，失败重读不会覆盖已有原文',()=>{assert.equal(cached.cached,true);assert.equal(cached.body,article1.body)})
 const articleDraft=await api.knowledgeCapture({action:'prepare',kind:'radar',id:'article',scope:{spaceId:'company',projectId:'A'}})
 saved=await api.knowledgeCapture({action:'save',draftId:articleDraft.draftId,title:articleDraft.title,body:articleDraft.body,useForAnswers:true})
 const doc=saved.snapshot.knowledge.find(row=>row.id===saved.itemId),scope={spaceId:'company',projectId:'A'}
 check('长正文以本地快照保存，业务快照仅保留预览和内容指纹',()=>{assert.ok(doc.contentRef);assert.equal(doc.body.length,20000);assert.equal(h.readKnowledgeContent(doc.contentRef),article1.body);assert.equal(doc.capture.originalRef.hash,doc.contentRef.hash)})
 const read=await api.knowledgeCapture({action:'read',id:doc.id,scope}),retrieved=await api.knowledgeRetrieve({query:'穹顶缓存银杏协议',scope,limit:8})
 const searched=await api.knowledgeCapture({action:'search',query:'穹顶缓存',scope});check('笔记列表全文搜索覆盖快照尾部且保持项目隔离',()=>assert.ok(searched.ids.includes(doc.id)))
 check('全文读取和RAG检索覆盖两万字以后的内容',()=>{assert.equal(read.item.body,article1.body);assert.ok(retrieved.hits.some(hit=>hit.documentId===doc.id&&hit.text.includes('银杏协议')))})
 const firstHash=doc.contentRef.hash;await api.updateKnowledge(doc.id,{body:'改为星河协议，原快照保留来源证据。'})
 const updated=h.loadWorkbenchState().knowledge.find(row=>row.id===doc.id)
 check('编辑正文切换到新内容，旧来源快照继续保留',()=>{assert.equal(updated.contentRef,null);assert.equal(updated.capture.originalRef.hash,firstHash);assert.equal(h.knowledgeBody(updated),'改为星河协议，原快照保留来源证据。')})
 const pack=await api.exportMigration(),serialized=JSON.stringify(pack)
 check('便携导出含校验后的正文快照，不含本地绝对路径',()=>{assert.ok(pack.data.knowledgeContents[firstHash]);assert.ok(!serialized.includes(home))})
 const bad=structuredClone(pack);bad.data.knowledgeContents[firstHash]='篡改';bad.checksum=h.migrationChecksum(bad.data)
 await assert.rejects(api.importMigration({payload:bad,dryRun:true,mode:'merge'}),/校验失败/);checks++
 const preview=await api.importMigration({payload:pack,dryRun:true,mode:'merge'})
 check('有效快照迁移包可预检，预检不会改正文文件',()=>{assert.equal(preview.status,'preview');assert.match(readFileSync(h.contentPath(firstHash),'utf8'),/银杏协议/)})
 renameSync(h.contentPath(firstHash),h.contentPath(firstHash)+'.fixture-backup')
 const imported=await api.importMigration({payload:pack,mode:'merge'})
 check('实际导入从便携包恢复缺失的正文文件',()=>{assert.equal(imported.status,'ok');assert.match(h.readKnowledgeContent({hash:firstHash,chars:article1.body.length}),/银杏协议/)})
 const link=await api.knowledgeCapture({action:'prepare',kind:'radar',id:'article',linkOnly:true,scope:{spaceId:'personal',projectId:null}}),linkSaved=await api.knowledgeCapture({action:'save',draftId:link.draftId,title:link.title,useForAnswers:true})
 check('仅链接收藏不冒充原文，也不进入回答检索',()=>assert.equal(linkSaved.snapshot.knowledge.find(row=>row.id===linkSaved.itemId).reviewState,'candidate'))
 // Exercise selection against the same explicit reader authority, without a live IM send/read receipt.
 const state={messageInbox:{accountId:'me',conversations:[{groupId:'group',name:'合成群',latestMsgId:'m2',unreadCount:2}]},sources:[]},reader=h.createConversationReader({state:()=>state,probe:async()=>({state:'ok',accountId:'me',openId:'me'}),run:async(_ctx,args)=>({status:'ok',json:{data:{list:args[0]==='contact'?[]:[{msgId:'m1',content:'消息一',sendTime:1,fromOpenId:'other'},{msgId:'m2',content:'消息二',sendTime:2,fromOpenId:'me'}]}}})}),readerCtx={},view=await reader(readerCtx,{accountId:'me',groupId:'group'})
 const selected=await reader.selectedMessages(readerCtx,{accountId:'me',groupId:'group',viewId:view.viewId,messageIds:['m2','m1']})
 check('消息选择只能读取本次已加载消息，并按发送时间合并',()=>assert.deepEqual(selected.messages.map(row=>row.id),['m1','m2']))
 for(const messageIds of [['m1','m1'],['unknown'],[]]){await assert.rejects(reader.selectedMessages(readerCtx,{accountId:'me',groupId:'group',viewId:view.viewId,messageIds}));checks++}
 state.messageInbox.accountId='changed';await assert.rejects(reader.selectedMessages(readerCtx,{accountId:'me',groupId:'group',viewId:view.viewId,messageIds:['m1']}),/账号已变化/);checks++
 console.log('knowledge-capture: '+checks+' checks passed')
}finally{dispose.reverse().forEach(fn=>fn());rmSync(home,{recursive:true,force:true})}
