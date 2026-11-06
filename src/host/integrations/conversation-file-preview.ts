import {imageMediaType} from './conversation-images.js'

const TEXT_EXTENSIONS = /\.(?:txt|log|md|csv|tsv|json|jsonl|ya?ml|ini|conf)$/i
const MAX_TEXT_PREVIEW_BYTES = 256 * 1024

export function conversationFilePreview(name: string, bytes: Buffer) {
    let imageType: string | undefined
    try { imageType = imageMediaType(bytes) } catch { /* Check other supported formats. */ }
    if (imageType) return {kind: 'image', mediaType: imageType, data: bytes.toString('base64')}
    if (bytes.toString('ascii', 0, 5) === '%PDF-') {
        return {kind: 'pdf', mediaType: 'application/pdf', data: bytes.toString('base64')}
    }
    if (!TEXT_EXTENSIONS.test(name)) return null
    const truncated = bytes.length > MAX_TEXT_PREVIEW_BYTES
    let text: string
    try {
        text = new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(0, MAX_TEXT_PREVIEW_BYTES), {stream: truncated})
    } catch { return null }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) return null
    return {kind: 'text', text, truncated}
}
