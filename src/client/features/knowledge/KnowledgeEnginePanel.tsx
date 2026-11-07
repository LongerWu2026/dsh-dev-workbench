import * as React from 'react'
import {WB,Btn,Modal,Badge} from '../../core/runtime.js'
import {KnowledgeScopeFields} from '../../components/KnowledgeScopeFields.js'
import {knowledgeSpaceOptions} from '../../../shared/knowledge.js'

function useKnowledgeEngineStatus(revision?:number,refreshKey=0){
 const [status,setStatus]=React.useState<any>(null),[error,setError]=React.useState('')
 React.useEffect(()=>{
  let active=true,timer:ReturnType<typeof setTimeout>|undefined
  async function poll(){
   try{
    const value=await WB.actions.knowledgeEngine({})
    if(!active)return
    if(typeof value?.enabled!=='boolean'||typeof value?.installed!=='boolean')throw new Error('无法读取知识库模型状态')
    setStatus(value);setError('')
    if(value.phase==='downloading'||value.index?.phase==='indexing')timer=setTimeout(poll,1500)
   }catch(failure:any){if(active)setError(failure.message||'无法读取知识库模型状态')}
  }
  void poll();return()=>{active=false;clearTimeout(timer)}
 },[revision,refreshKey])
 return {status,setStatus,error}
}

export function openKnowledgeModelConfiguration(){WB.store.set({knowledgeModelConfigure:true});WB.go('settings')}

export function KnowledgeEngineNotice({data}:any){
 const {status,error}=useKnowledgeEngineStatus(data?.revision)
 const message=error||(status?.phase==='error'?status.note||'本地模型暂不可用':status?.index?.phase==='error'?status.index.note||'知识索引更新失败':'')
 return message?<div role="status" className="wb-knowledge-model-notice"><span>{message}</span><Btn size="sm" onClick={openKnowledgeModelConfiguration}>前往配置</Btn></div>:null
}

export function KnowledgeEnginePanel({data}:any){
 const store=WB.useStore(),snapshot=data||store.data
 const [modelOpen,setModelOpen]=React.useState(!!store.knowledgeModelConfigure),[refreshKey,setRefreshKey]=React.useState(0),[actionError,setActionError]=React.useState(''),[busy,setBusy]=React.useState(false)
 const [scope,setScope]=React.useState<any>({spaceId:'personal',projectId:null})
 const {status,setStatus,error:statusError}=useKnowledgeEngineStatus(snapshot?.revision,refreshKey)
 const lock=React.useRef(false),active=React.useRef(true)
 React.useEffect(()=>{active.current=true;return()=>{active.current=false}},[])
 React.useEffect(()=>{if(store.knowledgeModelConfigure){setModelOpen(true);WB.store.set({knowledgeModelConfigure:false})}},[store.knowledgeModelConfigure])
 async function action(action:string){
  if(lock.current)return;lock.current=true;setBusy(true);setActionError('')
  try{const result=await WB.actions.knowledgeEngine(action==='index'?{action,scope}:{action});if(active.current)setStatus(result)}
  catch(failure:any){if(active.current)setActionError(failure.message)}
  finally{lock.current=false;if(active.current){setBusy(false);setRefreshKey(value=>value+1)}}
 }
 const downloading=status?.phase==='downloading',indexing=status?.index?.phase==='indexing'
 const progress=downloading?Math.min(100,Math.round(100*(status.downloaded||0)/(status.totalBytes||1))):indexing?Math.round(100*(status.index.processed||0)/Math.max(1,status.index.total)):null
 const modelSummary=!status?(statusError?'状态暂不可用':'正在读取模型状态…'):!status.enabled?'关键词检索已可用，语义增强按需启用':downloading?'正在准备模型':status.installed?'本地模型已就绪':'模型尚未准备'
 const failed=!!statusError||status?.phase==='error'
 const label=failed?'状态异常':downloading?`下载中 ${progress}%`:!status?'读取中…':status.installed?(status.enabled?'已启用':'已下载'):'未下载'
 const message=actionError||statusError||(status?.phase==='error'?status.note:'')
 const indexedScope=status?.index?.scope
 const indexedSpace=indexedScope&&knowledgeSpaceOptions(snapshot).find((option:any)=>option.value===indexedScope.spaceId)?.label
 const indexedProject=indexedScope?.projectId&&(snapshot?.projects||[]).find((project:any)=>project.id===indexedScope.projectId)?.name
 return <section className="wb-item" style={{flexWrap:'wrap'}} aria-label="知识库模型">
  <div className="wb-item-main" style={{flex:'1 1 140px'}}><div className="wb-item-title">知识库模型 <Badge tone={failed?'err':status?.installed&&status?.enabled?'ok':'idle'}>{label}</Badge></div><div className="wb-item-sub">{status?.model||'本地语义检索'}</div></div>
  <Btn size="sm" aria-label="配置知识库模型" onClick={()=>setModelOpen(true)}>配置</Btn>
  <Modal open={modelOpen} title="知识库模型配置" sub={status?.model} width={560} onClose={()=>setModelOpen(false)} footer={<Btn onClick={()=>setModelOpen(false)}>关闭</Btn>}>
   <div className="wb-stack" style={{gap:12}}>
    <div className="wb-row wb-row--wrap" style={{gap:8}}><span className="wb-tiny">{modelSummary}</span><span className="wb-spacer"/>
     {statusError&&<Btn size="sm" onClick={()=>setRefreshKey(value=>value+1)}>重新读取状态</Btn>}
     {status?.enabled&&<>{(status.phase==='error'||!status.installed&&!downloading)&&<Btn size="sm" disabled={busy} onClick={()=>action('prepare')}>{status.phase==='error'?'重试下载':'准备模型'}</Btn>}<Btn size="sm" disabled={busy} onClick={()=>action('disable')}>停用语义增强</Btn></>}
     {status&&!status.enabled&&<Btn size="sm" disabled={busy} onClick={()=>action('enable')}>{status.installed?'启用本地语义检索':'下载并启用（约 47 MB）'}</Btn>}
    </div>
    {downloading&&<><progress aria-label="模型下载进度" value={progress||0} max={100} style={{width:'100%'}}/><span className="wb-tiny wb-muted">模型下载 {progress}%</span></>}
    <p className="wb-tiny wb-muted" style={{margin:0}}>本机计算，资料正文不上传到向量服务；首次使用加载，空闲释放。回答使用云端模型时，命中片段会随问题发送。</p>
    {message&&<p role="alert" className="wb-tiny">{message}</p>}
    <section aria-label="知识索引维护" style={{borderTop:'1px solid '+WB.T.border1,paddingTop:12}}>
     <strong className="wb-tiny">索引维护</strong>
     <div className="wb-row wb-row--wrap" style={{gap:8,margin:'10px 0'}}><KnowledgeScopeFields data={snapshot} scope={scope} onChange={setScope} prefix="索引知识" disabled={busy||indexing}/></div>
     <Btn size="sm" disabled={busy||!status?.enabled||!status?.installed||indexing} onClick={()=>action('index')}>{indexing?'正在建立索引':'更新当前范围索引'}</Btn>
     {indexing&&<div className="wb-stack" style={{gap:4,marginTop:8}}><progress aria-label="知识索引进度" value={progress||0} max={100} style={{width:'100%'}}/><span className="wb-tiny wb-muted">索引 {status.index.processed} / {status.index.total}</span></div>}
     {indexedScope&&<p className="wb-tiny wb-muted">索引范围：{indexedSpace||indexedScope.spaceId} · {indexedProject||indexedScope.projectId||'空间通用资料'}</p>}
     {status?.index?.note&&<p role={status.index.phase==='error'?'alert':'status'} className="wb-tiny">{status.index.note}</p>}
    </section>
   </div>
  </Modal>
 </section>
}
