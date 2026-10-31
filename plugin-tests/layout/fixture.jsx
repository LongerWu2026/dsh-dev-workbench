// Isolated browser fixture: the shipped client, synthetic business data, no host connection.
import React from 'react'
import {createRoot} from 'react-dom/client'
window.fixtureReact=React
window.__ModuleLoader__={load(entry){window.fixtureFactory=entry.factory}}
window.mountWorkbench=()=>{
 const {WB}=window.fixtureFactory(id=>{if(id==='react')return React;throw Error(id)})
 const data={version:2,revision:1,updatedAt:new Date().toISOString(),settings:{topics:['Agent','LLM'],feeds:[],automation:{enabled:false},aiExtract:{enabled:false},assistantWidth:384},projects:[{id:'developer-project',name:'合成开发项目',repoPath:'/synthetic/developer-project'}],tasks:[{id:'task',title:'窄窗口验收：交付包含详细说明的开发功能',description:'用于布局检查的合成事项',status:'ready',priority:'high',tags:['回归验证'],dueAt:'2026-10-20T10:00:00Z'}],sources:[],runs:[],knowledge:[{id:'synthetic-knowledge',title:'合成知识验收规范',body:'发布前完成灰度验收。',reviewState:'confirmed',kind:'note',tags:[]}],radar:[],connectors:[],candidates:[],analysisQueue:[],replies:[{id:'reply',contact:'合成同事',snippet:'请核对界面中的长文本是否完整且可以操作。',stage:'待回复',taskIds:['task']}],jobs:[],audit:[]}
 let App
 const call=async(_channel,endpoint,payload)=>{
  let value=data;const args=payload.args||{}
  if(endpoint==='workbench/development'){
   const dev=window.fixtureDevelopment||{config:{cliPath:'/synthetic/linky',profile:'synthetic',workspaceId:'synthetic-workspace',worktreeRoot:'/synthetic/workspaces',harnessCommand:['dsh','--profile','acp'],adapterRoots:[],checks:{}},tasks:[],nativeRuns:[],adapter:{installed:true,path:'/synthetic/bin/harness-linky',configPath:'/synthetic/config.json'}}
   const action=args.request?.action
   if(action==='detail')value={task:dev.tasks.find(t=>t.id===args.request.id),messages:[]}
   else if(action==='detect')value=window.fixtureDevelopmentConnection||{status:'ready',user:{name:'合成开发者'},workspaces:[{id:'synthetic-workspace',name:'合成 ERP 项目组'}]}
   else if(action==='configure'){dev.config={...dev.config,...args.request.config};value=dev.config}
   else if(action==='workItems')value={items:window.fixtureWorkItems||[{id:'fixture-issue',code:'BUG-2026-046131',title:'合成 ERP 缺陷工作项',type:'bug',workspaceId:'synthetic-workspace',status:'处理中'}],hasMore:false,statuses:[],cursors:{bug:null,requirement:null}}
   else if(action==='issue')value={id:'fixture-issue',code:'BUG-2026-046131',title:'合成 ERP 缺陷工作项',description:'合成验收需求'}
   else if(action==='agents')value={items:[{id:'erp',name:'ERP 开发工程师'}]}
   else if(action==='projectSetup')value={commands:[['pnpm','test'],['pnpm','check']],source:'detected'}
   else value=dev
  }
  const retrieval={id:'synthetic-retrieval',status:'ok',query:'接口发布验收',scope:{},strategy:'local-bm25-chinese',elapsedMs:1,hits:[{id:'synthetic-knowledge@v1:1',documentId:'synthetic-knowledge',title:'合成知识验收规范',text:'发布前完成灰度验收。',version:'v1',lineStart:1,lineEnd:1}]};
  if(endpoint==='workbench/knowledgeRetrieve')value=retrieval
  if(endpoint==='workbench/knowledgeRead')value={hits:retrieval.hits}
  if(endpoint==='workbench/knowledgeTraces')value={items:[]}
  if(endpoint==='workbench/projectRuntime')value={cwd:'/synthetic/developer-project',commands:[{id:'dev',name:'pnpm run dev',argv:['pnpm','run','dev']}],runs:[{id:'synthetic-run',name:'合成服务运行',argv:['pnpm','run','dev'],status:'failed',exitCode:1,startedAt:new Date().toISOString(),stdout:'synthetic-output-'.repeat(100),stderr:'synthetic-error-'.repeat(50)}]}
  if(endpoint==='workbench/webAIState')value={state:{topics:[{id:'web-topic',title:'网页对比合成主题',createdAt:new Date().toISOString(),conversations:{}}],rounds:[],chatgptEnabled:false},capabilities:{chromeAvailable:false,storageScope:'synthetic',historyProtocol:1}}
  if(endpoint==='workbench/assistantSend')value={status:'ok',sessionId:'synthetic-session',fromSeq:0,retrieval}
  if(endpoint==='workbench/assistantDelta')value={status:'ok',entries:[{role:'assistant',text:'发布前完成灰度验收 [知识:synthetic-knowledge@v1:1]'}],nextSeq:3,turnEnded:true}
  if(endpoint==='workbench/revision')value={revision:1}
  if(endpoint==='workbench/analysisStatus')value={entries:[],pending:0,done:0,failed:0,jobs:(WB.store.get().data.jobs||[]).filter(job=>job.kind==='analysis')}
  if(endpoint==='workbench/analysisStart'){
   if(window.fixtureExtractionStartError)throw Error(window.fixtureExtractionStartError)
   const job=window.fixtureExtractionJob||{id:'synthetic-extraction',kind:'analysis',status:'running'}
   const current=WB.store.get().data;WB.store.set({data:{...current,revision:current.revision+1,jobs:[job]}});value={jobId:job.id,status:job.status}
  }
  if(endpoint==='workbench/operationsStatus')value={queue:{pending:0},policy:{},qualityReviews:[],reminders:[],storageBytes:1024}
  if(endpoint==='workbench/diagnostics')value={platform:'isolated browser',counts:{},tools:[],dataPath:'/synthetic/state.json'}
  if(endpoint==='workbench/backups')value={backups:[]}
  if(endpoint==='workbench/automationStatus')value={enabled:false}
  if(endpoint==='workbench/assistantSessions')value={sessions:[{id:'synthetic-session',title:'合成验证会话'}],assistantSessionId:'synthetic-session'}
  if(endpoint==='workbench/assistantTranscript')value={messages:[],sessionId:args.request?.sessionId}
  if(endpoint==='workbench/backgroundHistory')value={supported:true,total:0,eligible:0,items:[]}
  if(endpoint==='workbench/dataPage')value={total:0,items:[]}
  if(endpoint==='workbench/prepareTaskReply'){const snapshot=WB.store.get().data,task=snapshot.tasks.find(row=>row.id===args.taskId),reply=snapshot.replies.find(row=>row.sourceId===task?.sourceRefId);value={replyId:reply?.id,snapshot}}
  return {ok:true,value}
 }
 WB.store.set({data,status:'ready',page:'dashboard'})
 WB.apply({effect:fn=>fn(),get:()=>undefined,connection:{rpc:{call}},slots:{inject(_name,fn){fn();return()=>{}},register(d,c){if(d.name==='main')App=c;return()=>{}}},locale:{register:()=>()=>{},bind:()=>()=>''}})
 window.WB=WB;window.fixtureRoot=createRoot(document.getElementById('app'));window.fixtureRoot.render(<App/>);
}
