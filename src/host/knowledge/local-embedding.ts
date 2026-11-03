import {Worker} from 'node:worker_threads'
import {readFile,writeFile,mkdir,rename,stat} from 'node:fs/promises'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash,randomUUID} from 'node:crypto'
import {workbenchDir} from '../platform/runtime.js'
import {EMBEDDING_MANIFEST as manifest} from './embedding-manifest.js'

const base=()=>join(workbenchDir(),'knowledge-engine'),root=()=>join(base(),manifest.id)
const configPath=()=>join(base(),'config.json')
const hash=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex')
let config:any,worker:Worker|null=null,idle:any,flight:Promise<void>|null=null,download:AbortController|null=null,sequence=0,disposed=false
let activity:any={phase:'idle',downloaded:0,totalBytes:manifest.files.reduce((n,file)=>n+file.bytes,0),note:''}
const requests=new Map<number,{resolve:(value:number[][])=>void;reject:(error:Error)=>void;timer:any}>()
let queue=Promise.resolve(),verified=false,computed=0,reused=0,lastRss=0
async function readJson(path:string,fallback:any){try{return JSON.parse(await readFile(path,'utf8'))}catch{return fallback}}
async function atomic(path:string,value:any){await mkdir(join(path,'..'),{recursive:true});const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,value instanceof Uint8Array?value:JSON.stringify(value),{mode:0o600});await rename(temp,path)}
export async function localEmbeddingEnabled(){config??=await readJson(configPath(),{enabled:false});return config.enabled===true}
async function validAsset(file:typeof manifest.files[number]){try{const bytes=await readFile(join(root(),file.path));return bytes.length===file.bytes&&hash(bytes)===file.sha256}catch{return false}}
async function ensureAssets(){
 if(verified)return
 for(const file of manifest.files)if(!await validAsset(file))throw Error('本地语义检索尚未准备完成，请在知识空间下载模型')
 verified=true
}
export function stopLocalEmbedding(){
 if(idle)clearTimeout(idle);idle=null;verified=false
 const previous=worker;worker=null;void previous?.terminate()
 for(const pending of requests.values()){clearTimeout(pending.timer);pending.reject(Error('本地向量任务已停止，已保留索引'))}requests.clear()
}
export function activateLocalEmbedding(){disposed=false;return ()=>{disposed=true;download?.abort();stopLocalEmbedding()}}
function scheduleIdle(){if(idle)clearTimeout(idle);idle=setTimeout(()=>{if(!requests.size)stopLocalEmbedding()},15000);idle.unref?.()}
async function getWorker(){
 if(disposed)throw Error('插件已停止')
 await ensureAssets()
 if(!worker){
  const current=new Worker(new URL('./bin/knowledge-embedding-worker.mjs',import.meta.url),{workerData:{root:root()},execArgv:[],resourceLimits:{maxOldGenerationSizeMb:256}});worker=current;current.unref()
  current.on('message',message=>{
   if(message.fatal){activity.note=message.fatal;if(worker===current)stopLocalEmbedding();return}
   const pending=requests.get(message.id);if(!pending)return;requests.delete(message.id);clearTimeout(pending.timer);lastRss=message.rss||lastRss
   if(message.error)pending.reject(Error(message.error));else pending.resolve(message.vectors)
   scheduleIdle()
  })
  const failed=(error:Error)=>{if(worker!==current)return;worker=null;for(const pending of requests.values()){clearTimeout(pending.timer);pending.reject(error)}requests.clear()}
  current.on('error',failed);current.on('exit',code=>{if(code)failed(Error('本地向量运行时退出：'+code))})
 }
 return worker
}
export function validEmbedding(vector:any){return Array.isArray(vector)&&vector.length===manifest.dimensions&&vector.every((v:any)=>typeof v==='number'&&Number.isFinite(v))&&vector.some((v:number)=>v!==0)}
async function infer(texts:string[],query=false):Promise<number[][]>{
 if(!await localEmbeddingEnabled())throw Error('本地语义检索未启用')
 const current=await getWorker();if(idle)clearTimeout(idle)
 const id=++sequence
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{requests.delete(id);reject(Error('本地向量计算超时'));if(worker===current)stopLocalEmbedding()},90000);requests.set(id,{resolve:rows=>{if(!Array.isArray(rows)||rows.length!==texts.length||rows.some(row=>!validEmbedding(row)))reject(Error('本地向量结果无效'));else resolve(rows)},reject,timer});current!.postMessage({id,texts,query})})
}
/** Serial batches prevent several readers from loading multiple WASM models. */
export async function localEmbeddingVectors(items:{id:string;text:string}[],query=false,options:{maxMissing?:number}={}):Promise<number[][]>{
 let result:number[][]=[]
 const operation=queue.then(async()=>{
  if(!await localEmbeddingEnabled()||disposed)throw Error('本地语义检索未启用')
  if(query){result=await infer(items.map(item=>item.text),true);return}
  const paths=items.map(item=>join(root(),'vectors',hash(manifest.id+'|'+item.id+'|'+item.text)+'.f32'))
  result=[]
  for(let start=0;start<paths.length;start+=32){const batch=await Promise.all(paths.slice(start,start+32).map(async path=>{try{const bytes=await readFile(path);if(bytes.length!==manifest.dimensions*4)return null;return Array.from({length:manifest.dimensions},(_,index)=>bytes.readFloatLE(index*4))}catch{return null}}));result.push(...batch as any)}
  const missing=items.map((_,index)=>index).filter(index=>!validEmbedding(result[index]));reused+=items.length-missing.length
  if(options.maxMissing!==undefined&&missing.length>options.maxMissing)throw Error('部分知识尚未完成索引，正在后台更新；本次先使用关键词检索')
  for(let start=0;start<missing.length;start+=2){
   const indexes=missing.slice(start,start+2),vectors=await infer(indexes.map(index=>items[index].text))
   for(let j=0;j<indexes.length;j++){const index=indexes[j];result[index]=vectors[j];const bytes=Buffer.alloc(manifest.dimensions*4);vectors[j].forEach((value,index)=>bytes.writeFloatLE(value,index*4));await atomic(paths[index],bytes);computed++}
   await new Promise(resolve=>setTimeout(resolve,0))
  }
 });queue=operation.catch(()=>{});await operation;return result
}
export async function localEmbeddingStatus(){
 const installed=(await Promise.all(manifest.files.map(async file=>{try{return (await stat(join(root(),file.path))).size===file.bytes}catch{return false}}))).every(Boolean)
 return {enabled:await localEmbeddingEnabled(),installed,model:'BGE 中文小模型 · INT8',modelId:manifest.id,workerActive:!!worker,computed,reused,lastRss,...activity}
}
export async function configureLocalEmbedding(enabled:boolean){
 if(enabled&&flight&&download?.signal.aborted)await flight
 config={enabled:enabled===true};await atomic(configPath(),config)
 if(!enabled){download?.abort();stopLocalEmbedding()}
 return localEmbeddingStatus()
}
export function prepareLocalEmbedding(){
 if(flight)return
 download=new AbortController();const signal=download.signal
 flight=(async()=>{
  activity={...activity,phase:'downloading',downloaded:0,note:''};verified=false
  for(const file of manifest.files){
   if(signal.aborted||disposed)throw Error('模型准备已暂停')
   if(!await validAsset(file)){
    const response=await fetch(file.url,{signal:AbortSignal.any([signal,AbortSignal.timeout(180000)])})
    if(!response.ok||!response.body)throw Error('模型下载失败：HTTP '+response.status)
    const reader=response.body.getReader(),parts:Uint8Array[]=[];let bytes=0
    while(true){const item=await reader.read();if(item.done)break;bytes+=item.value.length;if(bytes>file.bytes){await reader.cancel();throw Error('下载文件大小不匹配')}parts.push(item.value);activity.downloaded+=item.value.length}
    const buffer=Buffer.concat(parts);if(buffer.length!==file.bytes||hash(buffer)!==file.sha256)throw Error('下载文件完整性校验失败')
    const path=join(root(),file.path);await mkdir(join(path,'..'),{recursive:true});const temp=path+'.part';await writeFile(temp,buffer,{mode:0o600});await rename(temp,path)
   }else activity.downloaded+=file.bytes
  }
  verified=true;activity.phase='ready';activity.note='模型已准备，可离线使用'
 })().catch(error=>{activity.phase=signal.aborted?'idle':'error';activity.note=String(error.message||error).slice(0,200)}).finally(()=>{flight=null;download=null})
}
