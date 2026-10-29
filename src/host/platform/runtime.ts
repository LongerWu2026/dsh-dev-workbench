
/* ============================================================================
 * dev-workbench host — utilities
 *
 * Small, dependency-free helpers shared by the host half. The plugin keeps its
 * state in one JSON document under $DSH_HOME/storages/dev-workbench/ —
 * the design report's SQLite target is deliberately deferred: one process owns
 * the file, every write is atomic (tmp + rename), and the document carries a
 * schema version so a future migration can replay it into SQLite unchanged.
 * ========================================================================== */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform, arch } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
const HOST_STATE_VERSION = 2;
const PLUGIN_NAME = 'dsh-dev-workbench';
function hostNowIso(): any {
    return new Date().toISOString();
}
// 休眠会让已有定时器在唤醒时集中到期。用心跳间隔识别运行暂停，
// 不将这种中断计入业务失败次数；同时适用于进程被挂起后恢复。
let runtimeHeartbeat = Date.now();
let runtimeGeneration = 0;
export function runtimeCheckpoint(now = Date.now()): number {
    if (now - runtimeHeartbeat > 30000) runtimeGeneration += 1;
    runtimeHeartbeat = now;
    return runtimeGeneration;
}
export function startRuntimeHeartbeat(): () => void {
    runtimeHeartbeat = Date.now();
    const timer = setInterval(()=>runtimeCheckpoint(),1000);
    timer.unref?.();
    return ()=>clearInterval(timer);
}
export class RuntimeInterruptedError extends Error {
    readonly code = 'WORKBENCH_RUNTIME_RESUMED';
    constructor(){super('运行曾暂停，已恢复待处理；稍后自动重试，不计入失败次数')}
}
export function isRuntimeInterrupted(error: unknown): boolean {
    return !!error && typeof error==='object' && 'code' in error && error.code==='WORKBENCH_RUNTIME_RESUMED';
}
function dshHomeDir(): any {
    const configured = process.env.DSH_HOME;
    if (typeof configured === 'string' && configured.length > 0)
        return configured;
    return join(homedir(), '.dsh');
}
function workbenchDir(): any {
    return join(dshHomeDir(), 'storages', 'dev-workbench');
}
function workbenchStatePath(): any {
    return join(workbenchDir(), 'state.json');
}
function readJsonFile(path?: any): any {
    if (!existsSync(path))
        return null;
    try {
        const text = readFileSync(path, 'utf8');
        if (!text.trim())
            return null;
        return JSON.parse(text);
    }
    catch (e) {
        return { __corrupt: String((e && e.message) || e) };
    }
}
function writeJsonAtomic(path?: any, value?: any): any {
    const dir = join(path, '..');
    mkdirSync(dir, { recursive: true });
    const temp = path + '.' + process.pid + '.tmp';
    writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
    renameSync(temp, path);
}
function fileSizeOf(path?: any): any {
    try {
        return statSync(path).size;
    }
    catch (e) {
        return 0;
    }
}
function hashText(text?: any): any {
    return createHash('sha1').update(String(text)).digest('hex').slice(0, 16);
}
function newId(prefix?: any): any {
    return prefix + '-' + randomUUID();
}
function asString(value?: any, max?: any): any {
    if (typeof value !== 'string')
        return '';
    const trimmed = value.trim();
    return max && trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}
function asIso(value?: any): any {
    if (value === null || value === undefined || value === '')
        return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;
    return date.toISOString();
}
function asTags(value?: any, max?: any): any {
    if (!Array.isArray(value))
        return [];
    const seen = new Set();
    const out: any = [];
    value.forEach(function (item?: any): any {
        const tag = asString(item, 32);
        if (!tag)
            return;
        const key = tag.toLowerCase();
        if (seen.has(key))
            return;
        seen.add(key);
        if (out.length < (max || 12))
            out.push(tag);
    });
    return out;
}
function asUrl(value?: any): any {
    const raw = asString(value, 2048);
    if (!raw)
        return null;
    if (!/^https?:\/\//i.test(raw))
        return null;
    return raw;
}
function asEvidence(value?: any): any {
    if (!Array.isArray(value))
        return [];
    return value
        .slice(0, 20)
        .map(function (item?: any): any {
        if (!item || typeof item !== 'object')
            return null;
        const label = asString(item.label, 160);
        if (!label)
            return null;
        return { label: label, url: asUrl(item.url) };
    })
        .filter(Boolean);
}
function asSteps(value?: any): any {
    if (!Array.isArray(value))
        return [];
    return value
        .slice(0, 40)
        .map(function (item?: any): any {
        if (!item || typeof item !== 'object')
            return null;
        const text = asString(item.text, 400);
        if (!text)
            return null;
        return { at: asIso(item.at) || hostNowIso(), text: text };
    })
        .filter(Boolean);
}
const HOST_META: any = { platform: platform(), arch: arch(), nodeVersion: process.version };

export { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync, join, homedir, platform, arch, createHash, randomUUID, HOST_STATE_VERSION, PLUGIN_NAME, hostNowIso, dshHomeDir, workbenchDir, workbenchStatePath, readJsonFile, writeJsonAtomic, fileSizeOf, hashText, newId, asString, asIso, asTags, asUrl, asEvidence, asSteps, HOST_META }

