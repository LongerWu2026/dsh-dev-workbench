import { appendChangeHistory } from './change-history.js'
import { skipHistoricalMessages } from '../domain/message-policy.js'
import { asIso, statSync } from '../platform/runtime.js'
import { HOST_STATE_VERSION, asString, existsSync, fileSizeOf, hostNowIso, join, mkdirSync, readFileSync, readJsonFile, readdirSync, renameSync, workbenchDir, workbenchStatePath, writeFileSync, writeJsonAtomic } from '../platform/runtime.js'
import { OPERATION_LIMIT, auditEntry, ensureArray, normalizeState } from '../domain/model.js'
/* ============================================================================
 * dev-workbench host — persistence
 *
 * One in-memory authoritative document, flushed atomically on every mutation.
 * Reads are lazy (first use wins), so a profile that never opens the workbench
 * never touches the disk.
 * ========================================================================== */
// Cordis hot reload can leave an awaited callback from the previous module alive.
// Share the queue across module generations and fence every old reader/writer.
type StoreRuntime = { owner: symbol | null; activation?:symbol; cache: any; queue: Promise<any>; highWater: number };
const runtimes: Map<string, StoreRuntime> = (globalThis as any)[Symbol.for('dev-workbench.store.v1')] ||= new Map();
const owner = Symbol('workbench-generation');
function storeRuntime(): StoreRuntime {
    const path = workbenchStatePath();
    if (!runtimes.has(path)) runtimes.set(path, {owner, cache:null, queue:Promise.resolve(), highWater:0});
    const runtime = runtimes.get(path)!;
    if (runtime.owner !== owner) {
        const error = new Error('工作台实例已替换，旧批次停止提交');
        Object.assign(error,{code:'WORKBENCH_INSTANCE_REPLACED'});
        throw error;
    }
    return runtime;
}
function claimWorkbenchOwnership(): () => boolean {
    const path = workbenchStatePath();
    const runtime = runtimes.get(path) || {owner:null,cache:null,queue:Promise.resolve(),highWater:0};
    runtime.owner=owner;
    const activation=Symbol('workbench-activation');
    runtime.activation=activation;
    runtime.cache=null;
    runtimes.set(path,runtime);
    return () => {if(runtime.owner!==owner||runtime.activation!==activation)return false;runtime.owner=null;return true};
}
export function workbenchGenerationGuard():()=>void {
    const runtime=storeRuntime(),activation=runtime.activation;
    return ()=>{storeRuntime();if(runtime.activation!==activation){const error=new Error('工作台实例已替换，旧批次停止提交');Object.assign(error,{code:'WORKBENCH_INSTANCE_REPLACED'});throw error}};
}
let workbenchLoadNote: any = null;
function loadWorkbenchState(): any {
    const runtime = storeRuntime();
    if (runtime.cache)
        return runtime.cache;
    const path = workbenchStatePath();
    const raw = readJsonFile(path);
    // state.json is atomically replaced, so its birth time is not the install time.
    // For legacy profiles, the persistent data directory records first activation.
    let installedAt = asIso(raw?.installedAt);
    if (!installedAt) {
        try {
            const time = statSync(workbenchDir()).birthtimeMs;
            if (time > 0 && time <= Date.now()) installedAt = new Date(time).toISOString();
        } catch {}
        installedAt ||= hostNowIso();
    }
    const result = normalizeState(raw ? {...raw, installedAt} : raw);
    result.state.installedAt = installedAt;
    if (result.corrupt) {
        // 损坏保护（TODO 11）：先把原文件原样改名留存，**绝不**用空状态直接覆盖它。
        // 内存里从空状态起步；只有在用户后续真正写入时才落新文件，原损坏文件仍可人工恢复。
        let preserved: any = null;
        try {
            preserved = path + '.corrupt-' + hostNowIso().replace(/[:.]/g, '-') + '.json';
            renameSync(path, preserved);
        }
        catch (e) {
            preserved = null;
        }
        workbenchLoadNote =
            'state.json 无法解析，已从空状态启动' + (preserved ? '；原文件已保留为 ' + preserved : '') + '：' + result.corrupt;
        runtime.cache = result.state;
        return runtime.cache;
    }
    if (!raw) {
        workbenchLoadNote = '首次运行，已创建空状态：' + path;
    }
    else if (result.migrated) {
        workbenchLoadNote = '已将 state.json 迁移到 schema v' + HOST_STATE_VERSION;
    }
    // 本文件由单个Host持有；新进程没有仍存活的旧批次，不必等待旧租约到期。
    const skipped = skipHistoricalMessages(result.state);
    if (skipped) auditEntry(result.state,'analysis.skipped','按安装日期跳过历史识别条目 '+skipped+' 条');
    let recovered = false;
    for (const entry of result.state.analysisQueue) if (entry.status === 'running') {
        Object.assign(entry,{status:'pending',leaseUntil:null});
        recovered = true;
    }
    if (recovered) auditEntry(result.state,'analysis.recovered','启动时恢复中断的识别条目');
    runtime.highWater=Math.max(runtime.highWater,Number(result.state.revision)||0);
    runtime.cache = result.state;
    if (!raw || !asIso(raw.installedAt) || result.migrated || recovered || skipped)
        saveWorkbenchState(runtime.cache);
    return runtime.cache;
}
/* ---------------------------------------------------------------------------
 * 备份与恢复（TODO 11）：每天首次写入前留一份快照，保留最近 5 份；
 * 支持手动备份/列出/恢复。恢复后清空内存缓存，下一次读取重新从文件加载。
 * ------------------------------------------------------------------------- */
const BACKUP_KEEP = 5;
function backupDir(): any {
    return join(workbenchDir(), 'backups');
}
function listBackups(): any {
    const dir = backupDir();
    try {
        return readdirSync(dir)
            .filter(function (name?: any): any {
            return name.endsWith('.json');
        })
            .sort()
            .reverse()
            .map(function (name?: any): any {
            return { id: name, path: join(dir, name), bytes: fileSizeOf(join(dir, name)) };
        });
    }
    catch (e) {
        return [];
    }
}
function createBackup(reason?: any): any {
    const source = workbenchStatePath();
    if (!existsSync(source))
        return null;
    const stamp = hostNowIso().replace(/[:.]/g, '-');
    const target = join(backupDir(), 'state-' + stamp + (reason ? '-' + reason : '') + '.json');
    try {
        mkdirSync(backupDir(), { recursive: true });
        writeFileSync(target, readFileSync(source), 'utf8');
    }
    catch (e) {
        return null;
    }
    // 只保留最近 N 份
    const all = listBackups();
    all.slice(BACKUP_KEEP).forEach(function (item?: any): any {
        try {
            renameSync(item.path, item.path + '.trash');
        }
        catch (e) {
            /* 尽力而为 */
        }
    });
    listBackups().forEach(function (item?: any): any {
        if (item.id.endsWith('.trash'))
            return;
    });
    return target;
}
/** 恢复某份备份：先备份当前文件，再用备份覆盖，最后清空缓存。 */
function restoreBackup(id?: any): any {
    const safeId = asString(id, 120);
    const candidate = listBackups().find(function (item?: any): any {
        return item.id === safeId;
    });
    if (!candidate)
        throw new Error('找不到该备份：' + safeId);
    const parsed = normalizeState(JSON.parse(readFileSync(candidate.path, 'utf8')));
    if (parsed.corrupt)
        throw new Error('备份已损坏，无法恢复');
    return mutateWorkbenchState(function (state?: any): any {
        if (!createBackup('pre-restore'))
            throw new Error('恢复前备份失败，原数据未改动');
        parsed.state.revision = state.revision;
        workbenchLoadNote = '已从备份恢复：' + safeId;
        return parsed.state;
    });
}
let lastAutoBackupDay: any = null;
function saveWorkbenchState(state?: any, options?: any): any {
    const runtime = storeRuntime();
    const opts = options || {};
    if (!opts.skipBackup && existsSync(workbenchStatePath())) {
        const today = hostNowIso().slice(0, 10);
        if (lastAutoBackupDay !== today) {
            if (createBackup('auto-' + today))
                lastAutoBackupDay = today;
        }
    }
    state.version = HOST_STATE_VERSION;
    state.updatedAt = hostNowIso();
    // 业务修订号（与 schema version 区分）：单调递增，Client 用它判断快照新旧，
    // 避免旧快照覆盖新数据（AI-COMMAND-EXECUTION §4）。schema 版本不能当并发号用。
    state.revision = Math.max(Number(state.revision)||0,runtime.highWater) + 1;
    writeJsonAtomic(workbenchStatePath(), state);
    runtime.highWater=state.revision;
    runtime.cache = state;
    return state;
}
function mutateWorkbenchState(mutator?: any): any {
    const runtime = storeRuntime();
    const assertCurrent=workbenchGenerationGuard();
    const commit = runtime.queue.then(async function (): Promise<any> {
        assertCurrent();
        const previous = loadWorkbenchState();
        const state = JSON.parse(JSON.stringify(previous));
        const replacement = await mutator(state);
        assertCurrent();
        const next = replacement && typeof replacement === 'object' && replacement.version ? replacement : state;
        // Local activation date survives settings changes, restores and portable imports.
        next.installedAt = previous.installedAt;
        skipHistoricalMessages(next);
        // Publish only after persistence succeeds. A rejected mutation never contaminates readers.
        appendChangeHistory(previous,next);
        return saveWorkbenchState(next);
    });
    runtime.queue = commit.then(function (): any { }, function (): any { });
    return commit;
}
/** 查幂等键对应的历史操作（工具重试时直接返回原结果）。 */
function findOperation(state?: any, key?: any): any {
    if (!key)
        return null;
    return ensureArray(state.operations).find(function (operation?: any): any {
        return operation.key === key;
    }) || null;
}
/** 记一条操作账本（cap 200，按时间淘汰）。 */
function recordOperation(state?: any, entry?: any): any {
    state.operations = ensureArray(state.operations)
        .concat([
        {
            key: asString(entry.key, 160),
            tool: asString(entry.tool, 60),
            at: hostNowIso(),
            entityIds: ensureArray(entry.entityIds).slice(0, 10),
            status: asString(entry.status, 20) || 'succeeded',
        },
    ])
        .slice();
    return state;
}
function workbenchAudit(event?: any, summary?: any): any {
    return mutateWorkbenchState(function (state?: any): any {
        auditEntry(state, event, summary);
        return state;
    });
}
function workbenchCounts(state?: any): any {
    return {
        tasks: ensureArray(state.tasks).length,
        runs: ensureArray(state.runs).length,
        knowledge: ensureArray(state.knowledge).length,
        radar: ensureArray(state.radar).length,
        sources: ensureArray(state.sources).length,
        knowledgeSnippets: ensureArray(state.knowledge).filter(function (item?: any): any {
            return item.kind === 'snippet';
        }).length,
    };
}

export { claimWorkbenchOwnership, workbenchLoadNote, loadWorkbenchState, BACKUP_KEEP, backupDir, listBackups, createBackup, restoreBackup, lastAutoBackupDay, saveWorkbenchState, mutateWorkbenchState, findOperation, recordOperation, workbenchAudit, workbenchCounts }

