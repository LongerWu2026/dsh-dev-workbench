import * as React from 'react'
import {Btn,Spinner,WB} from '../core/runtime.js'
import {downloadBytes} from '../core/download.js'

const imageHint=/\[(?:图片|image)\]/i
const hostUnavailable='图片接口尚未加载，请完全退出并重新打开 Harness。'

function imageError(error:unknown,fallback:string,onUnavailable?:()=>void){
 const message=error instanceof Error?error.message:String(error||'')
 if(/HTTP 404\b/.test(message)){
  onUnavailable?.()
  return hostUnavailable
 }
 return message||fallback
}
export type ImageData={data:string;mediaType:string;name:string}

function SourceImage({sourceId,index,inline,accountId,onUnavailable,entryId,onPreview,onCount,single=false}:{
 sourceId:string;index:number;inline:boolean;accountId:string;onUnavailable?:()=>void;
 entryId?:string;onPreview?:(image:ImageData)=>void;onCount?:(count:number)=>void;single?:boolean
}){
 const [image,setImage]=React.useState<ImageData|null>(null),[error,setError]=React.useState('')
 const [busy,setBusy]=React.useState(false),[downloadOnly,setDownloadOnly]=React.useState(false)
 const [attempt,setAttempt]=React.useState(0)
 const [loading,setLoading]=React.useState(inline)
 const name=single?'查看图片':'查看图片 '+(index+1)
 React.useEffect(()=>{
  if(!inline)return
  let active=true
  setError('');setLoading(true)
  WB.actions.sourceImages({sourceId,index,mode:'inline'}).then((value:ImageData)=>{
   if(!active)return
   if(!/^image\/(png|jpeg|gif|webp)$/.test(value?.mediaType)||!value.data)throw Error('未收到可显示的图片')
   setImage(value)
  }).catch((failure:unknown)=>{if(active)setError(imageError(failure,'图片读取失败',onUnavailable))})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[sourceId,index,inline,attempt,onUnavailable])
 async function open(){
  setBusy(true);setError('')
  const target=entryId===undefined?{sourceId,index}:{sourceId,index,entryId}
  const isCurrentAccount=()=>WB.store.get().data?.messageInbox?.accountId===accountId
  try{
   if(downloadOnly){
    const value=image||await WB.actions.sourceImages({...target,mode:'download'})
    if(isCurrentAccount())downloadBytes(value.name,value.data,value.mediaType)
    return
   }
   const {path,count}=await WB.actions.sourceImages({...target,mode:'open'})
   if(!isCurrentAccount())return
   if(Number.isInteger(count)&&count>0)onCount?.(count)
   let opened=false
   try{opened=await WB.openHarnessFile?.(path)===true}catch{/* Fall back to the original image. */}
   if(opened||!isCurrentAccount())return
   if(onPreview){
    const value:ImageData=await WB.actions.sourceImages({...target,mode:'inline'})
    if(!/^image\/(png|jpeg|gif|webp)$/.test(value?.mediaType)||!value.data)throw Error('未收到可显示的图片')
    if(isCurrentAccount())onPreview(value)
   }else setDownloadOnly(true)
  }catch(failure){setError(imageError(failure,'图片读取失败，请重试',onUnavailable))}
  finally{setBusy(false)}
 }
 const Wrapper=inline?'span':'div'
 return <Wrapper className={inline?undefined:"wb-stack"} style={inline?{display:'inline-block',verticalAlign:'middle',margin:'2px 4px',maxWidth:'100%',whiteSpace:'normal'}:undefined}>
  {loading&&!image&&<span role="status" className="wb-row wb-tiny wb-muted"><Spinner size={12}/>正在加载图片…</span>}
  {image&&<button type="button" aria-label={downloadOnly?'下载图片 '+(index+1):name} disabled={busy}
   onClick={()=>void open()} style={{display:'block',alignSelf:'flex-start',maxWidth:'100%',padding:0,border:0,borderRadius:6,background:'transparent',cursor:'pointer'}}>
   <img src={`data:${image.mediaType};base64,${image.data}`} alt={`原消息图片 ${index+1}`}
    style={{display:'block',maxWidth:'min(144px, 100%)',maxHeight:88,objectFit:'contain',borderRadius:6}}
    onError={()=>{setImage(null);setError('图片无法显示，请重试预览。')}}/>
  </button>}
  {error&&<span role="status" className="wb-tiny wb-muted">{error}</span>}
  {!image&&!loading&&<span className="wb-row wb-row--wrap">
   {inline&&error&&<Btn size="sm" onClick={()=>setAttempt(value=>value+1)}>重试预览</Btn>}
   <Btn size="sm" disabled={busy} onClick={()=>void open()}>{downloadOnly?'下载图片 '+(index+1):name}</Btn>
  </span>}
 </Wrapper>
}

export function LinkedMessageImages({source,accountId,allowLookup=false,entryId,onPreview}:{
 source:any;accountId?:string;allowLookup?:boolean;entryId?:string;onPreview?:(image:ImageData)=>void
}){
 const ids=source?.locator?.imageIds,known=Array.isArray(ids)?ids.length:undefined
 const sourceId=source?.id,eligible=source?.provider==='yunzhijia'&&!!accountId&&source.locator?.accountId===accountId
 const hasHint=imageHint.test(source?.excerpt||'')
 const [found,setFound]=React.useState<number|null>(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false)
 const [attempt,setAttempt]=React.useState(0)
 const lookup=eligible&&known===undefined&&(allowLookup||hasHint)
 const count=known??found??(entryId!==undefined&&hasHint?1:null)
 React.useEffect(()=>{setFound(null);setError('');setBusy(false);setAttempt(0)},[sourceId,accountId])
 React.useEffect(()=>{
  if(!lookup||!attempt)return
  let active=true
  setBusy(true);setError('')
  WB.actions.sourceImages({sourceId,mode:'list'}).then((result:{count:number})=>{
   if(active)setFound(result.count)
  }).catch((failure:unknown)=>{if(active)setError(imageError(failure,'无法读取原消息图片'))})
   .finally(()=>{if(active)setBusy(false)})
  return()=>{active=false}
 },[lookup,attempt,sourceId,accountId])
 if(!eligible||(!lookup&&!count)||known===0)return null
 return <div className="wb-stack" aria-label="原消息图片" style={{gap:8}}>
  {count===null||count===undefined?<div className="wb-stack" style={{gap:4}}>
   {busy?<span role="status" className="wb-row wb-tiny wb-muted"><Spinner size={12}/>正在加载原消息图片…</span>:
    <div><Btn size="sm" onClick={()=>setAttempt(value=>value+1)}>{error?'重试加载图片':hasHint?'查看原消息图片':'检查原消息图片'}</Btn></div>}
   {error&&<span role="status" className="wb-tiny wb-muted">{error}</span>}
  </div>:count===0?<span className="wb-tiny wb-muted">原消息中没有可查看的图片</span>:
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,max-content))',gap:8}}>
    {Array.from({length:count},(_,index)=><SourceImage key={sourceId+':'+index} sourceId={sourceId} index={index} inline={false} accountId={accountId} entryId={entryId} onPreview={onPreview} onCount={entryId!==undefined?setFound:undefined} single={entryId!==undefined&&count===1}/>)}
   </div>}
 </div>
}

type Discovery={count:number}|{error:string}

function taskImageSources(task:any,data:any,accountId?:string){
 if(!accountId)return []
 const orderedIds=new Set([task.sourceRefId,...(task.sourceRefs||[]).map((ref:any)=>ref.sourceId)])
 const sources=new Map<string,any>((data.sources||[]).filter((source:any)=>orderedIds.has(source.id)).map((source:any)=>[source.id,source]))
 const byMessage=new Map<string,any>()
 for(const id of orderedIds){
  const source=sources.get(id)
  if(source?.provider!=='yunzhijia'||source.locator?.accountId!==accountId)continue
  const {groupId,msgId,imageIds}=source.locator
  const key=groupId&&msgId?JSON.stringify([groupId,msgId]):source.id
  const previous=byMessage.get(key)
  if(!previous||(imageIds?.length||0)>(previous.locator.imageIds?.length||0))byMessage.set(key,source)
 }
 return [...byMessage.values()]
}

/** Keep the editable description plain; weave the saved images into its read view. */
export function TaskDescription({task,data,text,hidden=false}:{task:any;data:any;text?:string;hidden?:boolean}){
 const description=text??task.description??''
 const accountId=data?.messageInbox?.accountId
 const sources=taskImageSources(task,data,accountId)
 const hinted=(source:any)=>imageHint.test(source.excerpt||'')||source.id===task.sourceRefId&&imageHint.test(description)
 const lookupKey=JSON.stringify(sources.filter(source=>!Array.isArray(source.locator.imageIds)&&hinted(source)).map(source=>source.id))
 const [discoveries,setDiscoveries]=React.useState<Record<string,Discovery>>({})
 const [unavailable,setUnavailable]=React.useState(false),[attempt,setAttempt]=React.useState(0)
 const onUnavailable=React.useCallback(()=>setUnavailable(true),[])
 React.useEffect(()=>{
  if(unavailable)return
  let active=true
  const sourceIds:string[]=JSON.parse(lookupKey)
  for(const sourceId of sourceIds){
   WB.actions.sourceImages({sourceId,mode:'list'}).then((result:{count:number})=>{
    if(active)setDiscoveries(current=>({...current,[sourceId]:{count:result.count}}))
   }).catch((failure:unknown)=>{
    if(!active)return
    const error=imageError(failure,'无法读取原消息图片',onUnavailable)
    setDiscoveries(current=>({...current,[sourceId]:{error}}))
   })
  }
  return()=>{active=false}
 },[lookupKey,accountId,attempt,unavailable,onUnavailable])
 function retry(){
  setUnavailable(false);setDiscoveries({});setAttempt(value=>value+1)
 }
 const images:React.ReactNode[]=unavailable?[]:sources.flatMap(source=>{
  const ids=source.locator.imageIds
  const lookup=discoveries[source.id]
  const count=Array.isArray(ids)?ids.length:lookup&&'count' in lookup?lookup.count:undefined
  if(count!==undefined)return Array.from({length:count},(_,index)=>
   <SourceImage key={source.id+':'+index} sourceId={source.id} index={index} inline accountId={accountId} onUnavailable={onUnavailable}/>)
  if(!hinted(source))return []
  const key=source.id+':pending'
  const expected=Math.min(20,(source.excerpt||'').match(/\[(?:图片|image)\]/gi)?.length||1)
  const status=lookup&&'error' in lookup?
   <span key={key} role="status" className="wb-tiny wb-muted">{lookup.error} <Btn size="sm" onClick={retry}>重试加载图片</Btn></span>:
   <span key={key} role="status" className="wb-tiny wb-muted">正在加载图片…</span>
  return [status,...Array<null>(expected-1).fill(null)]
 })
 const content:React.ReactNode[]=[]
 let index=0
 for(const [part,textPart] of description.split(/(\[(?:图片|image)\])/gi).entries()){
  content.push(part%2?images[index++]:textPart)
 }
 content.push(...images.slice(index))
 return <div className="wb-task-description-content" hidden={hidden} style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.65}}>
  {description||images.length?content:'暂无描述'}
  {unavailable&&<div role="status" className="wb-tiny wb-muted">{hostUnavailable} <Btn size="sm" onClick={retry}>重试加载图片</Btn></div>}
 </div>
}
