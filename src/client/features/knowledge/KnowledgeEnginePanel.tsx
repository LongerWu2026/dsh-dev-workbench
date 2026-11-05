import * as React from 'react'
import {WB,Panel,Btn,Input,Field,Select,Modal,Badge} from '../../core/runtime.js'
import {knowledgeSpaceOptions} from '../../../shared/knowledge.js'

export function KnowledgeEnginePanel({data,scope,connector=false}:any){
 const [status,setStatus]=React.useState<any>(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[manage,setManage]=React.useState(false),[name,setName]=React.useState(''),[project,setProject]=React.useState(''),[space,setSpace]=React.useState(scope?.spaceId||'personal')
 const [modelOpen,setModelOpen]=React.useState(false),[statusError,setStatusError]=React.useState(''),[refreshKey,setRefreshKey]=React.useState(0)
 const active=React.useRef(true),version=React.useRef(0)
 React.useEffect(()=>{
  active.current=true;let timer:ReturnType<typeof setTimeout>|undefined;const generation=++version.current
  async function poll(){
   try{
    const value=await WB.actions.knowledgeEngine({})
    if(!active.current||generation!==version.current)return
    if(typeof value?.enabled!=='boolean'||typeof value?.installed!=='boolean')throw new Error('无法读取知识库模型状态')
    setStatus(value);setStatusError('')
    if(value.phase==='downloading'||!connector&&value.index?.phase==='indexing')timer=setTimeout(poll,1500)
   }catch(failure){
    if(active.current&&generation===version.current)setStatusError(failure instanceof Error?failure.message:'无法读取知识库模型状态')
   }
  }
  void poll();return()=>{active.current=false;clearTimeout(timer)}
 },[busy,refreshKey,data?.revision,scope?.spaceId,scope?.projectId,connector])
 async function action(action:string){if(busy)return;setBusy(true);setError('');try{const result=await WB.actions.knowledgeEngine(action==='index'?{action,scope}:{action});if(active.current)setStatus(result)}catch(error:any){if(active.current)setError(error.message)}finally{if(active.current)setBusy(false)}}
 async function save(request:any){setBusy(true);setError('');try{await WB.actions.knowledgeSpace(request);await WB.actions.reload();setName('');setManage(false)}catch(error:any){setError(error.message)}finally{if(active.current)setBusy(false)}}
 const downloading=status?.phase==='downloading'
 const indexing=!connector&&status?.index?.phase==='indexing'
 const progress=downloading?Math.min(100,Math.round(100*(status.downloaded||0)/(status.totalBytes||1))):
  indexing?Math.round(100*(status.index.processed||0)/Math.max(1,status.index.total)):null
 const modelSummary=!status?(statusError?'状态暂不可用':'正在读取模型状态…'):
  !status.enabled?'关键词检索已可用，语义增强按需启用':
  downloading?'正在准备模型':status.installed?'本地模型已就绪':'模型尚未准备'
 const modelMessage=error||statusError||(status?.phase==='error'?status.note:connector?'':status?.index?.note)
 const controls=<>
   <div className="wb-row wb-row--wrap" style={{gap:8}}>
    <span className="wb-tiny">{modelSummary}</span><span className="wb-spacer"/>
    {statusError&&<Btn size="sm" onClick={()=>setRefreshKey(value=>value+1)}>重新读取状态</Btn>}
    {status?.enabled&&<>
     {!connector&&<Btn size="sm" disabled={busy||!status.installed||indexing} onClick={()=>action('index')}>
      {indexing?'正在建立索引':'更新当前范围索引'}
     </Btn>}
     {(status.phase==='error'||!status.installed&&!downloading)&&<Btn size="sm" disabled={busy} onClick={()=>action('prepare')}>
      {connector&&status.phase==='error'?'重试下载':'准备模型'}
     </Btn>}
     <Btn size="sm" disabled={busy} onClick={()=>action('disable')}>停用语义增强</Btn>
    </>}
    {status&&!status.enabled&&<Btn size="sm" disabled={busy} onClick={()=>action('enable')}>
     {status.installed?'启用本地语义检索':'下载并启用（约 47 MB）'}
    </Btn>}
   </div>
   {progress!==null&&<div className="wb-stack" style={{gap:4,marginTop:8}}>
    <progress aria-label={downloading?'模型下载进度':'知识索引进度'} value={progress} max={100} style={{width:'100%'}}/>
    <span className="wb-tiny wb-muted">{downloading?'模型下载 '+progress+'%':`索引 ${status.index.processed} / ${status.index.total}`}</span>
   </div>}
   <p className="wb-tiny wb-muted" style={{marginBottom:0}}>本机计算，资料正文不上传到向量服务；首次使用加载，空闲释放。回答使用云端模型时，命中片段会随问题发送。</p>
   {modelMessage&&<p role={error||statusError||status?.phase==='error'?'alert':undefined} className="wb-tiny">{modelMessage}</p>}
 </>
 if(connector){
  const failed=!!statusError||status?.phase==='error'
  const label=failed?'状态异常':downloading?`下载中 ${progress}%`:!status?'读取中…':status.installed?(status.enabled?'已启用':'已下载'):'未下载'
  return <section className="wb-item" style={{flexWrap:'wrap'}} aria-label="知识库模型">
   <div className="wb-item-main" style={{flex:'1 1 140px'}}>
    <div className="wb-item-title">知识库模型 <Badge tone={failed?'err':status?.installed&&status?.enabled?'ok':'idle'}>{label}</Badge></div>
    <div className="wb-item-sub">{status?.model||'本地语义检索'}</div>
   </div>
   <Btn size="sm" aria-label="配置知识库模型" onClick={()=>setModelOpen(true)}>配置</Btn>
   <Modal open={modelOpen} title="知识库模型配置" sub={status?.model} width={520} onClose={()=>setModelOpen(false)} footer={<Btn onClick={()=>setModelOpen(false)}>关闭</Btn>}>
    {controls}
   </Modal>
  </section>
 }
 return <>
  <Panel title="本地语义检索" style={{marginBottom:14}} actions={<Btn size="sm" onClick={()=>{setManage(true);setError('')}}>管理知识空间</Btn>}>
   {controls}
  </Panel>
  <Modal open={manage} title="管理知识空间" width={480} onClose={()=>setManage(false)} footer={<Btn disabled={busy} onClick={()=>setManage(false)}>关闭</Btn>}>
   <div className="wb-stack" style={{gap:12}}><Field label="新空间名称"><Input aria-label="新知识空间名称" value={name} onChange={(event:any)=>setName(event.target.value)} placeholder="例如：公司资料、客户项目"/></Field><Btn disabled={busy||!name.trim()} onClick={()=>save({action:'create',name})}>创建知识空间</Btn>
   <Field label="项目归属"><Select aria-label="归属项目" value={project} onChange={(event:any)=>setProject(event.target.value)} options={[{value:'',label:'选择项目'},...(data?.projects||[]).map((row:any)=>({value:row.id,label:row.name}))]}/></Field><Field label="归属空间"><Select aria-label="项目归属空间" value={space} onChange={(event:any)=>setSpace(event.target.value)} options={knowledgeSpaceOptions(data)}/></Field><p className="wb-tiny wb-muted">设置后，该项目已有知识随项目归属进入目标空间，原文和来源账号保留。</p><Btn disabled={busy||!project} onClick={()=>save({action:'assignProject',projectId:project,spaceId:space})}>保存项目归属</Btn>{error&&<p role="alert">{error}</p>}</div>
  </Modal>
 </>
}
