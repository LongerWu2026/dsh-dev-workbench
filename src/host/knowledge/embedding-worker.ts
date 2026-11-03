/** One short-lived CPU/WASM worker. No socket or browser is opened. */
import {parentPort,workerData} from 'node:worker_threads'
import {readFile} from 'node:fs/promises'
import {resolve,sep} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'

const root=resolve(workerData.root),port=parentPort!
let pipeline:any
async function initialize(){
 // Use the official self-contained browser build so native ONNX/Sharp packages
 // are unnecessary. Environment adaptation is confined to this isolated worker.
 const nodeProcess=globalThis.process
 Object.assign(globalThis,{self:globalThis,location:{href:pathToFileURL(resolve(root,'runtime/transformers.min.js')).href}})
 let lib:any
 try{(globalThis as any).process=undefined;lib=await import(pathToFileURL(resolve(root,'runtime/transformers.min.js')).href)}finally{globalThis.process=nodeProcess}
 lib.env.allowRemoteModels=false;lib.env.allowLocalModels=true;lib.env.useBrowserCache=false;lib.env.useFSCache=false
 lib.env.localModelPath='http://workbench-model.local/'
 Object.assign(lib.env.backends.onnx.wasm,{numThreads:1,proxy:false,wasmPaths:pathToFileURL(resolve(root,'runtime')+sep).href})
 // The library's URL abstraction is resolved to local verified files. It cannot
 // download arbitrary model/runtime files or transmit document text.
 globalThis.fetch=async(input:any)=>{
  const url=String(input),local=url.startsWith('http://workbench-model.local/')?resolve(root,'models',decodeURIComponent(new URL(url).pathname).slice(1)):url.startsWith('file:')?fileURLToPath(url):''
  if(!local||!resolve(local).startsWith(root+sep))throw Error('本地向量运行时拒绝外部请求')
  try{return new Response(new Uint8Array(await readFile(local)))}catch{return new Response('',{status:404})}
 }
 pipeline=await lib.pipeline('feature-extraction','bge-small-zh',{device:'wasm',dtype:'q8'})
}
const ready=initialize()
port.on('message',async message=>{
 try{
  await ready
  if(!Array.isArray(message.texts)||message.texts.length>8||message.texts.some((text:any)=>typeof text!=='string'||text.length>8000))throw Error('向量输入超过批次限制')
  const texts=message.texts.map((text:string)=>message.query?'为这个句子生成表示以用于检索相关文章：'+text:text)
  const output=await pipeline(texts,{pooling:'cls',normalize:true,truncation:true,max_length:512})
  port.postMessage({id:message.id,vectors:output.tolist(),rss:process.memoryUsage().rss})
 }catch(error:any){port.postMessage({id:message.id,error:String(error.message||error).slice(0,300)})}
})
ready.catch(error=>port.postMessage({fatal:String(error.message||error).slice(0,300)}))
