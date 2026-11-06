import assert from 'node:assert/strict'
import {mkdtempSync, readFileSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {build} from 'esbuild'

const home=mkdtempSync(join(tmpdir(),'wb-linked-images-'))
process.env.DSH_HOME=home
try{
 const out=join(home,'host.mjs')
 await build({stdin:{resolveDir:resolve('.'),loader:'ts',contents:`
 export * from './src/host/integrations/linked-message-images.ts'
 export * from './src/host/storage/state-store.ts'
 export * from './src/host/storage/migration.ts'
 export * from './src/host/storage/zip.ts'
 `},outfile:out,bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(out),account='org:me'
 const source=(id,ids,excerpt='任务')=>({id,provider:'yunzhijia',title:id,excerpt,locator:{accountId:account,groupId:'group',msgId:id,imageIds:ids}})
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII='
 await h.mutateWorkbenchState(state=>{
  state.messageInbox={accountId:account}
  state.sources=[source('task',['task-image']),source('reply',['reply-image']),source('noise',['nope']),source('pending',['pending-image']),source('old',undefined,'[图片]'),source('review',undefined,'[图片]')]
  state.analysisQueue=[{id:'review-entry',sourceId:'review',accountId:account,groupId:'group',msgId:'review',status:'awaiting_human',reviewKind:'recognition'}]
  state.tasks=[{id:'task-row',sourceRefId:'task',sourceRefs:[],status:'ready'},{id:'old-row',sourceRefId:'old',sourceRefs:[],status:'completed'}]
  state.replies=[{id:'reply-row',sourceId:'reply',stage:'待回复',triage:'reply'},{id:'pending-row',sourceId:'pending',stage:'待回复',triage:'pending'}]
 })
 const downloads=[],requests=[]
 let login=account
 const image={mediaType:'image/png',data:png}
 const reader=h.createLinkedMessageImages({
  probe:async()=>({state:'ok',accountId:login}),
  run:async (_ctx,args)=>{
   requests.push(args)
   const anchor=args[args.indexOf('--msg-id')+1]
   const rows=anchor==='review'?[{msgId:'review',msgType:'file',content:'[图片]',param:{file_id:'review-image'}}]:anchor==='old'?[{msgId:'neighbor',msgType:'file',content:'[图片]',param:{file_id:'wrong-image'}}]:
    [{msgId:'old',msgType:'richText',param:{desc:[{type:'image',data:'old-image'}]}}]
   return {status:'ok',json:{data:{list:rows}}}
  },
  download:async (_ctx,id)=>{downloads.push(id);return image},
 })
 await reader.sync({})
 assert.deepEqual(downloads,['reply-image','task-image'])
 assert.equal(requests.length,0)
 const task=await reader.read({},{sourceId:'task',mode:'inline',index:0})
 assert.equal(task.data,png)
 const reply=await reader.read({},{sourceId:'reply',mode:'open',index:0})
 assert.deepEqual(readFileSync(reply.path),Buffer.from(png,'base64'))
 assert.equal(downloads.length,2)
 await assert.rejects(reader.read({},{sourceId:'noise',mode:'inline',index:0}),/无法查看/)
 await assert.rejects(reader.read({},{sourceId:'reply',mode:'open',index:4}),/没有这张图片/)
 assert.deepEqual(await reader.read({},{sourceId:'old',mode:'list'}),{count:1})
 assert.equal(downloads.at(-1),'old-image')
 assert.equal(requests.length,2)
 assert.deepEqual(h.loadWorkbenchState().sources.find(row=>row.id==='old').locator.imageIds,['old-image'])
 const queueImage={entryId:'review-entry',sourceId:'review',index:0,mode:'open'}
 await assert.rejects(reader.read({},{...queueImage,entryId:undefined}),/无法查看/)
 await assert.rejects(reader.read({},{...queueImage,sourceId:'noise'}),/不匹配/)
 assert.equal(requests.length,2)
 const review=await reader.read({},queueImage)
 assert.equal(review.count,1)
 assert.deepEqual(readFileSync(review.path),Buffer.from(png,'base64'))
 assert.equal(downloads.at(-1),'review-image')
 assert.equal((await reader.read({},{...queueImage,mode:'inline'})).data,png)
 assert.equal(downloads.filter(id=>id==='review-image').length,1)
 const archive=h.buildMigrationArchive().data
 const manifest=JSON.parse(h.readZip(Buffer.from(archive,'base64')).get('migration.json'))
 assert.equal(Object.keys(manifest.data.conversationAttachments).length,4)
 login='other'
 await assert.rejects(reader.read({},{sourceId:'pending',mode:'open',index:0}),/账号/)
 assert.ok(!downloads.includes('pending-image'))
 console.log('✓ 已识别待办及待回复自动存图、原生文件路径、识别队列按需原图、旧记录精确回查及 ZIP 打包')
}finally{rmSync(home,{recursive:true,force:true})}
