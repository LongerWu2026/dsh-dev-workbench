import {crc32, deflateRawSync, inflateRawSync} from 'node:zlib'

export const MAX_ZIP_BYTES = 96 * 1024 * 1024
export const MAX_CONTENT_BYTES = 256 * 1024 * 1024
export const MAX_ENTRIES = 4096
const LOCAL = 0x04034b50
const CENTRAL = 0x02014b50
const END = 0x06054b50
const ENTRY_NAME = /^(?:migration\.json|attachments\/[a-f0-9]{64})$/

function zipError(): never { throw Error('ZIP 迁移包损坏或格式不支持') }

export function createZip(entries: Map<string, Buffer>): Buffer {
    if (entries.size > MAX_ENTRIES) throw Error('迁移包内的文件过多')
    const files: Buffer[] = [], directory: Buffer[] = []
    let offset = 0, directorySize = 0, total = 0
    for (const [name, bytes] of entries) {
        if (!ENTRY_NAME.test(name)) zipError()
        total += bytes.length
        if (total > MAX_CONTENT_BYTES) throw Error('迁移数据超过 256 MB')
        const filename = Buffer.from(name)
        const compressed = deflateRawSync(bytes)
        const data = compressed.length < bytes.length ? compressed : bytes
        const local = Buffer.alloc(30)
        local.writeUInt32LE(LOCAL)
        local.writeUInt16LE(20, 4)
        local.writeUInt16LE(data === compressed ? 8 : 0, 8)
        local.writeUInt16LE(33, 12) // 1980-01-01 in DOS date format
        local.writeUInt32LE(crc32(bytes), 14)
        local.writeUInt32LE(data.length, 18)
        local.writeUInt32LE(bytes.length, 22)
        local.writeUInt16LE(filename.length, 26)
        const central = Buffer.alloc(46)
        central.writeUInt32LE(CENTRAL)
        central.writeUInt16LE(20, 4)
        local.copy(central, 6, 4, 28)
        central.writeUInt32LE(offset, 42)
        files.push(local, filename, data)
        directory.push(central, filename)
        offset += local.length + filename.length + data.length
        directorySize += central.length + filename.length
        if (offset + directorySize + 22 > MAX_ZIP_BYTES) throw Error('ZIP 迁移包超过 96 MB')
    }
    const end = Buffer.alloc(22)
    end.writeUInt32LE(END)
    end.writeUInt16LE(entries.size, 8)
    end.writeUInt16LE(entries.size, 10)
    end.writeUInt32LE(directorySize, 12)
    end.writeUInt32LE(offset, 16)
    return Buffer.concat([...files, ...directory, end])
}

export function readZip(zip: Buffer): Map<string, Buffer> {
    const end = zip.length - 22
    if (end < 0 || zip.length > MAX_ZIP_BYTES || zip.readUInt32LE(end) !== END
        || zip.readUInt32LE(end + 4) !== 0 || zip.readUInt16LE(end + 20) !== 0) zipError()
    const count = zip.readUInt16LE(end + 10)
    const directory = zip.readUInt32LE(end + 16)
    if (!count || count > MAX_ENTRIES || count !== zip.readUInt16LE(end + 8)
        || directory + zip.readUInt32LE(end + 12) !== end) zipError()
    const entries = new Map<string, Buffer>()
    let cursor = directory, offset = 0, total = 0
    for (let i = 0; i < count; i++) {
        if (cursor + 46 > end || zip.readUInt32LE(cursor) !== CENTRAL
            || zip.readUInt16LE(cursor + 8) !== 0 || zip.readUInt32LE(cursor + 30) !== 0
            || zip.readUInt16LE(cursor + 34) !== 0 || zip.readUInt32LE(cursor + 42) !== offset) zipError()
        const method = zip.readUInt16LE(cursor + 10)
        const size = zip.readUInt32LE(cursor + 24)
        const length = zip.readUInt32LE(cursor + 20)
        const nameLength = zip.readUInt16LE(cursor + 28)
        const next = cursor + 46 + nameLength
        const start = offset + 30 + nameLength
        total += size
        if (next > end || start + length > directory || total > MAX_CONTENT_BYTES
            || zip.readUInt32LE(offset) !== LOCAL
            || !zip.subarray(offset + 4, offset + 28).equals(zip.subarray(cursor + 6, cursor + 30))
            || zip.readUInt16LE(offset + 28) !== 0
            || !zip.subarray(offset + 30, start).equals(zip.subarray(cursor + 46, next))) zipError()
        const name = zip.toString('utf8', cursor + 46, next)
        if (!ENTRY_NAME.test(name) || entries.has(name)) zipError()
        const data = zip.subarray(start, start + length)
        let bytes: Buffer
        if (method === 0) bytes = data
        else if (method === 8) {
            try { bytes = inflateRawSync(data, {maxOutputLength: Math.max(size, 1)}) }
            catch { zipError() }
        } else zipError()
        if (bytes.length !== size || crc32(bytes) !== zip.readUInt32LE(cursor + 16)) zipError()
        entries.set(name, bytes)
        cursor = next
        offset = start + length
    }
    if (cursor !== end || offset !== directory) zipError()
    return entries
}
