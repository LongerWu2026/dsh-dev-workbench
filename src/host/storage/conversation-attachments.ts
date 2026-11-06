import {createHash, randomUUID} from 'node:crypto'
import {mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs'
import {extname, join, resolve} from 'node:path'
import {workbenchDir} from '../platform/runtime.js'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
const HASH = /^[a-f0-9]{64}$/
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')

export type AttachmentRef = {hash: string; name: string; mediaType: string; bytes: number}
export type AttachmentIndex = Record<string, AttachmentRef>
export const attachmentKey = (account: string, group: string, message: string, file: string) =>
    digest(JSON.stringify([account, group, message, file]))

export function attachmentName(name: unknown): string {
    return typeof name === 'string' && name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim().slice(0, 200) || '云之家附件'
}

export function normalizeAttachments(raw: unknown): AttachmentIndex {
    const result: AttachmentIndex = {}
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [key, ref] of Object.entries(raw)) {
            if (HASH.test(key) && ref && typeof ref.hash === 'string' && HASH.test(ref.hash)
                && Number.isInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= MAX_ATTACHMENT_BYTES) {
                result[key] = {hash: ref.hash, bytes: ref.bytes, name: attachmentName(ref.name),
                    mediaType: /^image\/(png|jpeg|gif|webp)$/.test(ref.mediaType) ? ref.mediaType : 'application/octet-stream'}
            }
        }
    }
    return result
}

export function checkAttachment(ref: AttachmentRef, bytes?: Buffer): Buffer {
    if (!bytes || bytes.length !== ref.bytes || digest(bytes) !== ref.hash) throw Error('附件原件缺失或校验失败')
    return bytes
}

export function readAttachment(ref: AttachmentRef): Buffer {
    if (!HASH.test(ref.hash)) throw Error('附件标识无效')
    let bytes: Buffer
    try { bytes = readFileSync(join(workbenchDir(), 'attachments', ref.hash)) }
    catch { throw Error('本地附件原件缺失') }
    return checkAttachment(ref, bytes)
}

export function writeAttachment(ref: AttachmentRef, bytes: Buffer) {
    checkAttachment(ref, bytes)
    try { readAttachment(ref); return } catch { /* Restore a missing or damaged copy. */ }
    const directory = join(workbenchDir(), 'attachments')
    mkdirSync(directory, {recursive: true, mode: 0o700})
    const path = join(directory, ref.hash)
    writeAttachmentFile(path, bytes)
}

function writeAttachmentFile(path: string, bytes: Buffer) {
    const temporary = join(resolve(path, '..'), '.' + randomUUID() + '.tmp')
    try {
        writeFileSync(temporary, bytes, {mode: 0o600})
        renameSync(temporary, path)
    } finally { rmSync(temporary, {force: true}) }
}

/** A named copy for the native viewer. Edits in the viewer cannot alter the archived original. */
export function attachmentViewPath(name: string, bytes: Buffer): string {
    const safeName = attachmentName(name).replace(/^\.+|[. ]+$/g, '') || '云之家附件'
    const extension = extname(safeName)
    const filename = Array.from(safeName.slice(0, safeName.length-extension.length)).slice(0, 50).join('')
        + Array.from(extension).slice(0, 12).join('')
    const hash = digest(bytes)
    const directory = resolve(workbenchDir(), 'attachment-views', hash)
    const path = join(directory, filename)
    try { if (digest(readFileSync(path)) === hash) return path }
    catch { /* Write a missing or damaged viewer copy. */ }
    mkdirSync(directory, {recursive: true, mode: 0o700})
    writeAttachmentFile(path, bytes)
    return path
}

export function describeAttachment(bytes: Buffer, name: string, mediaType: string): AttachmentRef {
    return {hash: digest(bytes), name: attachmentName(name), mediaType, bytes: bytes.length}
}
