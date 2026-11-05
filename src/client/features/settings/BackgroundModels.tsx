import * as React from 'react'
import {Btn,Panel,Spinner,WB,useStore} from '../../core/runtime.js'
import {backgroundModelKey,normalizeBackgroundModels,type BackgroundModelPurpose} from '../../../shared/background-models.js'

export function BackgroundModels(){
 const {data}=useStore(),models=normalizeBackgroundModels(data?.settings?.backgroundModels)
 const [catalog,setCatalog]=React.useState<any>(null),[loading,setLoading]=React.useState(false),[error,setError]=React.useState(''),[saving,setSaving]=React.useState('')
 const alive=React.useRef(true),version=React.useRef(0)
 async function refresh(){const current=++version.current;setLoading(true);setError('');try{const value=await WB.actions.backgroundModelCatalog();if(alive.current&&current===version.current)setCatalog(value)}catch(failure:any){if(alive.current&&current===version.current)setError(failure.message||'模型列表读取失败')}finally{if(alive.current&&current===version.current)setLoading(false)}}
 React.useEffect(()=>{alive.current=true;void refresh();return()=>{alive.current=false;version.current++}},[])
 async function save(purpose:BackgroundModelPurpose,value:string){
  if(saving)return
  const choices=(catalog?.groups||[]).flatMap((group:any)=>group.models.map((model:any)=>({provider:group.id,model:model.id}))),route=value?choices.find((route:any)=>backgroundModelKey(route)===value):null
  if(value&&!route){setError('所选模型已变化，请刷新列表');return}
  setSaving(purpose);setError('')
  try{await WB.actions.backgroundModelConfigure(purpose,route)}catch(failure:any){if(alive.current)setError(failure.message||'模型设置保存失败')}finally{if(alive.current)setSaving('')}
 }
 return <Panel title="后台任务模型" icon="sparkles" sub="消息识别与资讯摘要分别设置，历史会话下一轮生效。">
  <div className="wb-row wb-row--wrap" style={{justifyContent:'space-between',gap:8,marginBottom:12}}><span className="wb-tiny wb-muted">保留历史与已完成进度；不改变 Harness 默认模型。</span><Btn size="sm" disabled={loading||!!saving} onClick={()=>refresh()}>{loading?<><Spinner size={12}/>读取模型…</>:'刷新模型列表'}</Btn></div>
  <div className="wb-stack" style={{gap:12}}>{([['analysis','消息识别'],['summary','资讯摘要']] as const).map(([purpose,title])=>{
   const value=backgroundModelKey(models[purpose]),exists=!value||(catalog?.groups||[]).some((group:any)=>group.models.some((model:any)=>value===backgroundModelKey({provider:group.id,model:model.id})))
   return <label key={purpose} className="wb-stack" style={{gap:6,minWidth:0}}><span style={{fontWeight:500,fontSize:12}}>{title}{saving===purpose&&<span role="status" style={{marginLeft:8}}>保存中…</span>}</span><select className="wb-input" aria-label={title+'模型'} value={value} disabled={loading||!!saving||!catalog?.available} onChange={event=>save(purpose,event.target.value)} style={{width:'100%',minWidth:0}}>
    <option value="">沿用会话模型（新会话使用宿主默认）</option>
    {!exists&&<option value={value}>已配置：{models[purpose]?.provider} / {models[purpose]?.model}（当前不可用）</option>}
    {(catalog?.groups||[]).map((group:any)=><optgroup key={group.id} label={group.name}>{group.models.map((model:any)=><option key={model.id} value={backgroundModelKey({provider:group.id,model:model.id})}>{model.name}</option>)}</optgroup>)}
   </select></label>
  })}</div>
  {catalog&&!catalog.available&&<p className="wb-tiny wb-muted" role="status">{catalog.note||'当前宿主不支持独立后台模型，请更新或重连宿主。'}</p>}
  {!!catalog?.failedProviders?.length&&<p className="wb-tiny wb-muted">部分服务商暂不可用，已保留其他可用模型与原配置。</p>}
  {error&&<p role="alert" style={{fontSize:12,overflowWrap:'anywhere'}}>{error}</p>}
 </Panel>
}
