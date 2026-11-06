import {lstat, mkdtemp, readFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {MAX_ATTACHMENT_BYTES} from '../storage/conversation-attachments.js'

const MAX_PREVIEW_BYTES = 5 * 1024 * 1024
const FILE_ID = /^[a-z\d][\w.-]{0,127}$/i

function imageFileId(value: unknown): string | undefined {
    if (typeof value !== 'string') return
    if (FILE_ID.test(value)) return value
    try {
        const url = new URL(value)
        if (url.protocol !== 'https:' || !/(^|\.)(yunzhijia|kdweibo)\.(com|cn)$/.test(url.hostname)) return
        const id = url.pathname.startsWith('/docrest/') && url.searchParams.get('fileId')
            || url.pathname.match(/\/(?:filesvr|downloadfile)\/([^/]+)/)?.[1]
        if (id && FILE_ID.test(id)) return id
    } catch { /* No usable file ID. */ }
}

export function conversationImageIds(message: any): string[] {
    const param = message.param
    const parts: {type?: unknown; data?: unknown; localPath?: unknown}[] = Array.isArray(param?.desc) ? param.desc : []
    const ids = parts.filter(part => part?.type === 'image')
        .map(part => imageFileId(part.data) || imageFileId(part.localPath))
    if (message.msgType === 'file' && (/\[(?:图片|image)\]/i.test(message.content || '') || /^(png|jpe?g|gif|webp)$/i.test(param?.ext || ''))) {
        ids.push(imageFileId(param?.file_id))
    }
    return [...new Set(ids.filter((id): id is string => !!id))].slice(0, 20)
}

export function conversationFile(message: any): {id: string; name: string} | undefined {
    if (message.msgType !== 'file') return
    const param = message.param
    const id = imageFileId(param?.file_id)
    if (!id) return
    const name = param?.file_name || param?.fileName || param?.name || message.content?.match?.(/^\[(?:文件|file)\]\s*(.+)$/i)?.[1]
    return {id, name: typeof name === 'string' ? name : '云之家附件'}
}

export function imageMediaType(bytes: Buffer) {
    if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png'
    if (bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) return 'image/jpeg'
    if (/^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6))) return 'image/gif'
    if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
    throw Error('此文件不是可预览的图片，请在云之家查看')
}

type Downloader = (path: string) => Promise<{status: string; note?: string}>

export async function readConversationImage(download: Downloader) {
    const bytes = await readConversationFile(download, MAX_PREVIEW_BYTES)
    return {mediaType: imageMediaType(bytes), data: bytes.toString('base64')}
}

export async function readConversationFile(download: Downloader, maxBytes = MAX_ATTACHMENT_BYTES) {
    const directory = await mkdtemp(join(tmpdir(), 'workbench-conversation-image-'))
    try {
        const path = join(directory, 'preview')
        const result = await download(path)
        if (result.status !== 'ok') {
            if (/\b2002\b|无权限/.test(result.note || '')) throw Error('当前账号无权查看此图片')
            if (/\b2001\b|已过期/.test(result.note || '')) throw Error('图片不存在或已过期')
            if (result.status === 'rate_limited') throw Error('云之家请求过于频繁，请稍后重试')
            throw Error('云之家图片下载失败，请重试或在云之家查看')
        }
        const file = await lstat(path).catch(() => null)
        if (!file?.isFile() || !file.size) throw Error('云之家未返回有效的图片文件')
        if (file.size > maxBytes) throw Error(maxBytes === MAX_PREVIEW_BYTES
            ? '图片超过 5 MB，请在云之家查看原图' : '附件超过 20 MB，请在云之家下载')
        return await readFile(path)
    } finally {
        await rm(directory, {recursive: true, force: true})
    }
}
