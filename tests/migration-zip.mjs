import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {build} from 'esbuild'

const home = mkdtempSync(join(tmpdir(), 'workbench-migration-zip-'))
process.env.DSH_HOME = home
const host = join(home, 'test-host.mjs')
try {
    await build({
        stdin: {contents: `
            export * from './src/host/storage/migration.ts'
            export * from './src/host/storage/state-store.ts'
            export * from './src/host/storage/conversation-attachments.ts'
            export * from './src/host/storage/zip.ts'
            export {createConversationReader} from './src/host/integrations/conversation-reader.ts'
        `, resolveDir: resolve('.'), loader: 'ts'},
        outfile: host, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    })
    const h = await import(host)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
    const file = Buffer.from('编号,内容\n1,附件还原')
    const binary = Buffer.from([0x50,0x4b,0x03,0x04])
    const pdf = Buffer.from('%PDF-1.4\n%%EOF')
    const group = 'group', account = 'account'
    const save = async (key, owner, name, mediaType, bytes) => {
        const ref = h.describeAttachment(bytes, name, mediaType)
        h.writeAttachment(ref, bytes)
        await h.mutateWorkbenchState(state => { state.conversationAttachments[key] = ref })
    }
    await h.mutateWorkbenchState(state => {
        state.messageInbox = {accountId: account, at: new Date().toISOString(),
            conversations: [{groupId: group, latestMsgId: 'archive', unreadCount: 4}]}
    })
    const ctx = {}
    const request = {accountId: account, groupId: group}
    const probe = async () => ({state: 'ok', accountId: account})
    const messages = [
        {msgType:'richText', msgId:'image', content:'图片', param:{desc:[{type:'image',data:'png-id'}]}},
        {msgType:'file', msgId:'file', content:'[文件]', param:{file_id:'file-id',file_name:'原件.csv'}},
        {msgType:'file', msgId:'pdf', content:'[文件]', param:{file_id:'pdf-id',file_name:'手册.pdf'}},
        {msgType:'file', msgId:'archive', content:'[文件]', param:{file_id:'archive-id',file_name:'压缩包.zip'}},
    ]
    const originals={'file-id':file,'pdf-id':pdf,'archive-id':binary}
    let downloads = 0, imageDownloads = 0, failSave = false
    const reader = h.createConversationReader({
        state:h.loadWorkbenchState, probe,
        run: async (_ctx,args) => ({status:'ok',json:{data:{list:args[0]==='im'?messages:[]}}}),
        downloadImage: async () => (imageDownloads++, {mediaType:'image/png',data:png.toString('base64')}),
        attachments: {read:h.readAttachment,download:async (_ctx,id)=>{downloads++;return originals[id]},save:async (...args)=>{if(failSave)throw Error('disk full');await save(...args)}},
    })
    const page = await reader(ctx, request)
    assert.equal(page.messages.find(row=>row.id==='file').fileName, '原件.csv')
    const scoped = {...request,viewId:page.viewId}
    const fileRequest = {...scoped,messageId:'file',file:true}
    const imageRequest = {...scoped,messageId:'image',imageIndex:0}
    const opened=await Promise.all([1,2].map(()=>reader.conversationAttachment(ctx,{...fileRequest,open:true})))
    for(const item of opened)assert.deepEqual(item,{name:'原件.csv',bytes:file.length,saved:true,preview:{kind:'text',text:file.toString(),truncated:false}})
    assert.equal(downloads,1)
    const binaryRequest={...fileRequest,messageId:'archive'}
    const pdfRequest={...fileRequest,messageId:'pdf'}
    failSave = true
    assert.equal((await reader.conversationAttachment(ctx,{...binaryRequest,open:true})).saved,false)
    failSave = false
    assert.deepEqual(await reader.conversationAttachment(ctx,{...binaryRequest,open:true}),{name:'压缩包.zip',bytes:binary.length,saved:true,preview:null})
    assert.equal((await reader.conversationAttachment(ctx,{...binaryRequest,download:true})).data,binary.toString('base64'))
    assert.deepEqual((await reader.conversationAttachment(ctx,{...pdfRequest,open:true})).preview,{kind:'pdf',mediaType:'application/pdf',data:pdf.toString('base64')})
    assert.equal(downloads,4)
    const native=await reader.conversationAttachment(ctx,{...pdfRequest,native:true})
    assert.deepEqual(readFileSync(native.path),pdf)
    assert.equal(native.path.endsWith('/手册.pdf'),true)
    assert.equal(native.data,undefined)
    writeFileSync(native.path,'native viewer edit')
    assert.equal((await reader.conversationAttachment(ctx,{...pdfRequest,download:true})).data,pdf.toString('base64'))
    assert.deepEqual(readFileSync((await reader.conversationAttachment(ctx,{...pdfRequest,native:true})).path),pdf)
    assert.equal((await reader.conversationAttachment(ctx,{...binaryRequest,native:true})).path,undefined)
    assert.equal(downloads,4)
    assert.equal(imageDownloads,0)
    failSave = true
    assert.equal((await reader.previewImage(ctx,imageRequest)).saveFailed,true)
    failSave = false
    const previews = await Promise.all([reader.previewImage(ctx,imageRequest),reader.previewImage(ctx,imageRequest)])
    assert.ok(previews.every(image=>image.saved&&image.data===png.toString('base64')))
    assert.equal(imageDownloads,2)
    assert.equal((await reader.previewImage(ctx,imageRequest)).saved,true)
    assert.equal(imageDownloads,2)
    await reader.conversationAttachment(ctx,fileRequest)
    assert.equal(downloads,4)
    await assert.rejects(reader.conversationAttachment(ctx,{...fileRequest,accountId:'other'}),/账号已变化/)

    const legacy = h.buildMigrationPackage(false)
    assert.equal((await h.applyMigration({payload:legacy,dryRun:true})).status,'preview')
    const {data: archive} = h.buildMigrationArchive()
    const zip = Buffer.from(archive,'base64')
    const entries = h.readZip(zip)
    const manifest = JSON.parse(entries.get('migration.json'))
    const refs = Object.values(manifest.data.conversationAttachments)
    assert.equal(refs.length,4)
    assert.equal(entries.size,5)
    const zipFile = join(home,'migration.zip')
    writeFileSync(zipFile,zip)
    if (existsSync('/usr/bin/unzip')) execFileSync('/usr/bin/unzip',['-t',zipFile])
    const damaged = Buffer.from(zip)
    damaged[44] ^= 1
    await assert.rejects(h.applyMigration({archive:damaged.toString('base64'),dryRun:true}),/ZIP/)
    const fileRef = refs.find(ref=>ref.name==='原件.csv')
    const imageRef = refs.find(ref=>ref.mediaType==='image/png')
    const directory = join(home,'storages','dev-workbench','attachments')
    writeFileSync(join(directory,imageRef.hash),Buffer.from('corrupted'))
    assert.equal((await reader.previewImage(ctx,imageRequest)).saved,true)
    assert.equal(imageDownloads,3)
    assert.deepEqual(h.readAttachment(imageRef),png)
    entries.delete('attachments/'+fileRef.hash)
    const missing = h.createZip(entries).toString('base64')
    await assert.rejects(h.applyMigration({archive:missing,dryRun:true}),/附件原件缺失/)
    await assert.rejects(h.applyMigration({payload:manifest,dryRun:true}),/ZIP/)
    assert.throws(()=>h.createZip(new Map([['../escape',file]])),/ZIP/)

    rmSync(directory,{recursive:true})
    await h.mutateWorkbenchState(state => { state.conversationAttachments = {} })
    assert.equal((await h.applyMigration({archive,dryRun:true,mode:'merge'})).status,'preview')
    assert.equal(existsSync(directory),false)
    assert.equal((await h.applyMigration({archive,mode:'merge'})).status,'ok')
    assert.deepEqual(h.readAttachment(fileRef),file)
    assert.deepEqual(h.readAttachment(imageRef),png)
    assert.equal((await reader.conversationAttachment(ctx,{...fileRequest,download:true})).data,file.toString('base64'))
    assert.equal((await reader.conversationAttachment(ctx,{...binaryRequest,download:true})).data,binary.toString('base64'))
    assert.equal((await reader.conversationAttachment(ctx,{...pdfRequest,open:true})).preview.data,pdf.toString('base64'))
    assert.equal(downloads,4)
    assert.equal((await reader.previewImage(ctx,imageRequest)).data,png.toString('base64'))
    assert.equal(imageDownloads,3)
    console.log('✓ 图片和普通附件自动保存、PDF/文本预览、原件下载、ZIP 恢复及旧 JSON 兼容')
} finally {
    rmSync(home,{recursive:true,force:true})
}
