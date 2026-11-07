import * as React from 'react'
import {WB,Btn,Icon,PageHead} from '../../core/runtime.js'
import {KnowledgeScopeFields} from '../../components/KnowledgeScopeFields.js'
import {KnowledgeEngineNotice} from './KnowledgeEnginePanel.js'
import {KnowledgeSpaceManager} from './KnowledgeSpaceManager.js'
import {KnowledgeImportDialog} from './KnowledgeImportDialog.js'
import {RetrievalPanel} from './RetrievalPanel.js'

export function KnowledgeToolbar({data,scope,onScope,onCreate,onImported}:any){
 const [tool,setTool]=React.useState(''),menu=React.useRef<HTMLDetailsElement>(null)
 React.useEffect(()=>{
  const close=(event:Event)=>{if(menu.current&&!menu.current.contains(event.target as Node))menu.current.open=false}
  document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)
 },[])
 function open(name:string){if(menu.current){menu.current.open=false;menu.current.querySelector('summary')?.focus()}setTool(name)}
 return <>
  <style>{knowledgeCSS}</style>
  <PageHead title="知识空间" controls={<div className="wb-knowledge-scope"><KnowledgeScopeFields data={data} scope={scope} onChange={onScope} prefix="检索知识"/></div>}
   primaryAction={<div className="wb-knowledge-actions">
    <Btn size="sm" icon="messages" onClick={()=>{WB.store.set({assistantHubKnowledgeScope:scope});WB.assistant.openHub('system','knowledge')}}>知识库对话</Btn>
    <Btn size="sm" icon="upload" onClick={()=>open('import')}>导入资料</Btn>
    <Btn size="sm" kind="primary" icon="plus" onClick={onCreate}>新建条目</Btn>
    <details ref={menu} className="wb-knowledge-more" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus()}}}>
     <summary className="wb-iconbtn" aria-label="知识更多操作" title="更多操作"><Icon name="more" size={16}/></summary>
     <div className="wb-knowledge-menu"><Btn size="sm" icon="folder" onClick={()=>open('spaces')}>管理知识空间</Btn><Btn size="sm" icon="search" onClick={()=>open('retrieval')}>检索验证</Btn></div>
    </details>
   </div>}/>
  <KnowledgeEngineNotice data={data}/>
  {tool==='retrieval'&&<RetrievalPanel scope={scope} onClose={()=>setTool('')}/>}
  {tool==='spaces'&&<KnowledgeSpaceManager data={data} scope={scope} onClose={()=>setTool('')}/>}
  {tool==='import'&&<KnowledgeImportDialog data={data} scope={scope} onImported={onImported} onClose={()=>setTool('')}/>}
 </>
}

const knowledgeCSS=`
.wb-knowledge-scope{display:flex;align-items:center;gap:8px;min-width:0;max-width:100%}
.wb-knowledge-scope .wb-field{min-width:0;max-width:180px;margin:0}
.wb-knowledge-scope .wb-field>.wb-label{display:none}
.wb-knowledge-scope .wb-select{min-width:0;max-width:100%;height:28px}
.wb-knowledge-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0;max-width:100%}
.wb-knowledge-more{position:relative;flex:none}
.wb-knowledge-more>summary{list-style:none;width:28px;height:28px}
.wb-knowledge-more>summary::-webkit-details-marker{display:none}
.wb-knowledge-menu{position:absolute;z-index:44;right:0;top:calc(100% + 6px);display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:6px;min-width:150px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--wb-dialog-bg);box-shadow:var(--wb-dialog-shadow)}
.wb-knowledge-menu>.wb-btn{justify-content:flex-start}
.wb-knowledge-model-notice{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:12px;margin-bottom:12px;color:var(--dsw-alias-state-warn-primary)}
.wb-knowledge-model-notice>span{flex:1;min-width:160px;overflow-wrap:anywhere}
.wb-knowledge-filters{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 12px;margin-bottom:12px}
.wb-knowledge-filters .wb-tabs{margin:0;gap:4px}
.wb-knowledge-search{display:flex;align-items:center;min-width:0;max-width:100%;gap:4px}
@container content (max-width:640px){.wb-knowledge-scope .wb-field{max-width:calc((100cqw - 48px) / 2)}.wb-knowledge-filters .wb-knowledge-search{flex:1 1 220px}.wb-knowledge-search>.wb-input{width:100%!important}}
`
