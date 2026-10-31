import {normalizeMessageInbox} from '../../shared/message-intake.js'
import { analysisBatchInFlight } from '../analysis/message-analysis.js'
import {normalizeWebAI,WEB_AI_ACTIVE,webAIProvider} from '../../shared/web-ai.js'
import { radarSummaryInFlight } from '../news/summarizer.js'
import { HOST_STATE_VERSION, createHash, hostNowIso } from '../platform/runtime.js'
import { createBackup, loadWorkbenchState, mutateWorkbenchState } from './state-store.js'
import { auditEntry, ensureArray, normalizeAnalysisQueue, normalizeCandidate, normalizeKnowledge, normalizeProject, normalizeReplies, normalizeRun, normalizeSettings, normalizeTask, normalizeState } from '../domain/model.js'
/* Versioned portable business data. Precheck is pure; commit is queued and backed up. */
const MIGRATION_FORMAT = 'dsh-dev-workbench-migration';
const MIGRATION_FORMAT_VERSION = 2;
const MIGRATION_COLUMNS: any = ['projects', 'tasks', 'sources', 'runs', 'knowledge', 'radar', 'candidates', 'replies', 'analysisQueue', 'operations', 'jobs', 'retrievalTraces', 'changeHistory', 'qualityReviews'];
const PLUGIN_EXPORT_VERSION = '0.2.1';
function migrationStableStringify(value?: any): any {
    return JSON.stringify(value, function (key?: any, inner?: any): any {
        if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
            return Object.keys(inner).sort().reduce(function (out?: any, name?: any): any { out[name] = inner[name]; return out; }, {});
        }
        return inner;
    });
}
function migrationChecksum(data?: any): any { return createHash('sha256').update(migrationStableStringify(data)).digest('hex'); }
function buildMigrationPackage(includeSettings?: any): any {
    const state = loadWorkbenchState();
    const data: any = {};
    const counts: any = {};
    for (const column of MIGRATION_COLUMNS) {
        data[column] = JSON.parse(JSON.stringify(ensureArray(state[column])));
        counts[column] = data[column].length;
    }
    data.busyReplyDeliveries=JSON.parse(JSON.stringify(state.busyReplyDeliveries||{}));
    data.replyDrafts = JSON.parse(JSON.stringify(state.replyDrafts || {}));
    data.webAI = normalizeWebAI(state.webAI,true);
    data.messageInbox=normalizeMessageInbox(state.messageInbox);
    data.reminderSnoozes = JSON.parse(JSON.stringify(state.reminderSnoozes || {}));
    data.syncCursors = JSON.parse(JSON.stringify(state.syncCursors || {}));
    if (includeSettings) {
        data.settings = Object.assign({}, state.settings);
        for (const key of ['assistantSessionId', 'analysisSessionId', 'summarySessionId'])
            delete data.settings[key];
    }
    return { format: MIGRATION_FORMAT, version: MIGRATION_FORMAT_VERSION, schemaVersion: HOST_STATE_VERSION,
        pluginVersion: PLUGIN_EXPORT_VERSION, exportedAt: hostNowIso(), counts, data, checksum: migrationChecksum(data) };
}
function migrationPrecheck(payload?: any, request?: any, currentState?: any): any {
    const issues: any = [];
    const warnings: any = [];
    const counts: any = {};
    const conflicts: any = {};
    const data = payload && payload.data;
    if (!payload || payload.format !== MIGRATION_FORMAT)
        issues.push('格式不识别');
    if (!payload || ![1, 2].includes(Number(payload.version)))
        issues.push('迁移包版本不支持');
    if (!payload || (!Number.isInteger(Number(payload.schemaVersion)) || Number(payload.schemaVersion) < 1 || Number(payload.schemaVersion) > HOST_STATE_VERSION))
        issues.push('schema 版本不兼容');
    if (!data || typeof data !== 'object' || Array.isArray(data))
        issues.push('缺少 data 数据块');
    else {
        if (migrationChecksum(data) !== payload.checksum)
            issues.push('校验失败：内容与 checksum 不一致');
        if(data.webAI!==undefined){
            if(!data.webAI||!Array.isArray(data.webAI.topics)||!Array.isArray(data.webAI.rounds))issues.push('网页 AI 对比数据格式无效');
            else{
                const topicIds=new Set<string>(),roundIds=new Set<string>();
                for(const t of data.webAI.topics){if(typeof t?.id!=='string'||!t.id||topicIds.has(t.id))issues.push('网页 AI 主题ID缺失或重复');topicIds.add(t?.id)}
                for(const r of data.webAI.rounds){if(typeof r?.id!=='string'||!r.id||roundIds.has(r.id)||!topicIds.has(r.topicId))issues.push('网页 AI 轮次ID或主题引用无效');roundIds.add(r?.id);const providers=new Set<string>();for(const a of Array.isArray(r?.answers)?r.answers:[]){try{webAIProvider(a.providerId);if(providers.has(a.providerId))issues.push('网页 AI 回答厂商重复');providers.add(a.providerId)}catch{issues.push('网页 AI 回答厂商无效')}}}
                const existing=normalizeWebAI(currentState.webAI),topics=request?.mode==='merge'?new Set([...existing.topics.map(t=>t.id),...topicIds]).size:topicIds.size,rounds=request?.mode==='merge'?new Set([...existing.rounds.map(r=>r.id),...roundIds]).size:roundIds.size;
                if(topics>100||rounds>300)issues.push('网页 AI 合并后超过100个主题或300轮，请分批整理，不能截断已有记录');
            }
        }
        for (const column of MIGRATION_COLUMNS) {
            const rows = data[column];
            if (rows === undefined && (Number(payload.version) === 1 || ['changeHistory','qualityReviews','retrievalTraces'].includes(column))) {
                warnings.push(column + ' 未包含，保留当前集合');
                continue;
            }
            if (!Array.isArray(rows)) {
                issues.push(column + ' 必须是数组');
                continue;
            }
            counts[column] = rows.length;
            const ids = new Set();
            const currentIds = new Set(ensureArray(currentState[column]).map(function (row?: any): any { return column === 'operations' ? row.key : row.id; }));
            conflicts[column] = 0;
            for (const row of rows) {
                const id = row && (column === 'operations' ? row.key : row.id);
                if (typeof id !== 'string' || !id)
                    issues.push(column + ' 记录缺少稳定 ID');
                else if (ids.has(id))
                    issues.push(column + ' 存在重复 ID：' + id);
                ids.add(id);
                if (currentIds.has(id))
                    conflicts[column] += 1;
            }
            if (payload.counts && payload.counts[column] !== undefined && Number(payload.counts[column]) !== rows.length)
                issues.push(column + ' 数量不匹配');
        }
    }
    const mapPaths = request && request.mapPaths || {};
    const mappedProjects = ensureArray(data && data.projects).map(function (p?: any): any {
        return { id: p.id, name: p.name, from: p.repoPath || '', to: mapPaths[p.repoPath] || p.repoPath || '', mapped: Boolean(mapPaths[p.repoPath]) };
    });
    if (!issues.length) {
        const composed = composeMigration(currentState, data, request || {});
        const ids = function (key?: any): any { return new Set(ensureArray(composed[key]).map(function (row?: any): any { return row.id; })); };
        const tasks = ids('tasks');
        const sources = ids('sources');
        const runs = ids('runs');
        const projects = ids('projects');
        for (const task of ensureArray(composed.tasks)) {
            if (task.projectId && !projects.has(task.projectId))
                issues.push('任务项目引用不存在：' + task.id);
            if (task.sourceRefId && !sources.has(task.sourceRefId))
                issues.push('任务来源引用不存在：' + task.id);
            for (const ref of ensureArray(task.sourceRefs))
                if (ref.sourceId && !sources.has(ref.sourceId))
                    issues.push('任务来源引用不存在：' + task.id);
            for (const id of ensureArray(task.runIds))
                if (!runs.has(id))
                    issues.push('任务执行引用不存在：' + task.id);
        }
        for (const reply of ensureArray(composed.replies)) {
            if (reply.sourceId && !sources.has(reply.sourceId))
                issues.push('回复来源引用不存在：' + reply.id);
            for (const id of ensureArray(reply.taskIds))
                if (!tasks.has(id))
                    issues.push('回复任务引用不存在：' + reply.id);
        }
        for (const run of ensureArray(composed.runs))
            if (run.taskId && !tasks.has(run.taskId))
                issues.push('执行任务引用不存在：' + run.id);
        for (const entry of ensureArray(composed.analysisQueue))
            if (entry.sourceId && !sources.has(entry.sourceId))
                issues.push('分析来源引用不存在：' + entry.id);
    }
    return { issues: [...new Set(issues)].slice(0, 50), warnings, countsByColumn: counts, conflictsByColumn: conflicts, mappedProjects,
        incomingTotal: Object.values(counts).reduce(function (sum?: any, value?: any): any { return sum + value; }, 0) };
}
function migrationNormalizeRow(column?: any, row?: any): any {
    if (column === 'projects')
        return normalizeProject(row, row);
    if (column === 'tasks')
        return normalizeTask(row, row);
    if (column === 'runs')
        return normalizeRun(row, row);
    if (column === 'knowledge')
        return normalizeKnowledge(row, row);
    if (column === 'candidates')
        return normalizeCandidate(row, row);
    if (column === 'replies')
        return normalizeReplies([row])[0];
    if (column === 'jobs') return Object.assign({},row,{status:row.status === 'running' ? 'queued' : row.status})
    if (column === 'analysisQueue')
        return normalizeAnalysisQueue([Object.assign({}, row, { status: row.status === 'running' ? 'pending' : row.status, leaseUntil: null })])[0];
    return JSON.parse(JSON.stringify(row));
}
function composeMigration(state?: any, data?: any, request?: any): any {
    const next = JSON.parse(JSON.stringify(state));
    for (const column of MIGRATION_COLUMNS) {
        if (!Array.isArray(data[column]))
            continue;
        const incoming = data[column].map(function (row?: any): any { return migrationNormalizeRow(column, row); });
        const existingIds = new Set(ensureArray(state[column]).map(function (row?: any): any { return column === 'operations' ? row.key : row.id; }));
        next[column] = request.mode === 'merge'
            ? ensureArray(next[column]).concat(incoming.filter(function (row?: any): any { return !existingIds.has(column === 'operations' ? row.key : row.id); }))
            : incoming;
    }
    next.projects = ensureArray(next.projects).map(function (row?: any): any {
        return Object.assign({}, row, { repoPath: request.mapPaths && request.mapPaths[row.repoPath] || row.repoPath });
    });
    if (data.syncCursors && typeof data.syncCursors === 'object') {
        next.syncCursors = request.mode === 'merge' ? Object.assign({}, data.syncCursors, next.syncCursors) : JSON.parse(JSON.stringify(data.syncCursors));
    }
    for(const key of ['replyDrafts','reminderSnoozes','busyReplyDeliveries'])if(data[key]&&typeof data[key]==='object')next[key]=request.mode==='merge'?{...data[key],...next[key]}:data[key];
    if(data.messageInbox!==undefined){const incoming=normalizeMessageInbox(data.messageInbox),current=normalizeMessageInbox(next.messageInbox);next.messageInbox=request.mode==='merge'&&current&&(!incoming||Date.parse(current.at)>=Date.parse(incoming.at))?current:incoming;}
    if(data.webAI){const incoming=normalizeWebAI(data.webAI,true),current=normalizeWebAI(next.webAI,true);next.webAI=request.mode==='merge'?normalizeWebAI({chatgptEnabled:current.chatgptEnabled,topics:[...current.topics,...incoming.topics.filter(t=>!current.topics.some(c=>c.id===t.id))],rounds:[...current.rounds,...incoming.rounds.filter(r=>!current.rounds.some(c=>c.id===r.id))]},true):incoming;}
    if (request.includeSettings && data.settings) {
        const settings = Object.assign({}, data.settings);delete settings.busyReply;
        for (const key of ['assistantSessionId', 'analysisSessionId', 'summarySessionId'])
            delete settings[key];
        next.settings = normalizeSettings(Object.assign({}, next.settings, settings));
    }
    return normalizeState(next).state;
}
async function applyMigration(request?: any): Promise<any> {
    const payload = request && request.payload;
    const preview = migrationPrecheck(payload, request, loadWorkbenchState());
    if (preview.issues.length)
        throw new Error('迁移包预检不通过：' + preview.issues.join('；'));
    if (request.dryRun === true)
        return Object.assign({ status: 'preview', dryRun: true, counts: preview.countsByColumn, conflicts: preview.conflictsByColumn }, preview);
    const state = await mutateWorkbenchState(function (current?: any): any {
        if(analysisBatchInFlight || radarSummaryInFlight || ensureArray(current.jobs).some((row:any)=>row.status==='running')||current.webAI?.rounds.some((r:any)=>r.answers.some((a:any)=>WEB_AI_ACTIVE.has(a.status)))) throw new Error('后台任务或网页对比正在运行，请等待结束或取消后再导入；预检仍可使用');
        const fresh = migrationPrecheck(payload, request, current);
        if (fresh.issues.length)
            throw new Error('提交前校验失败：' + fresh.issues.join('；'));
        if (!createBackup('pre-import'))
            throw new Error('导入前备份失败，原数据未改动');
        const next = composeMigration(current, payload.data, request);
        auditEntry(next, 'migration.applied', '导入 ' + (request.mode || 'replace') + '：' + fresh.incomingTotal + ' 条');
        return next;
    });
    return { status: 'ok', mode: request.mode === 'merge' ? 'merge' : 'replace', applied: preview.incomingTotal,
        counts: preview.countsByColumn, conflicts: preview.conflictsByColumn, mappedProjects: preview.mappedProjects, revision: state.revision };
}

export { MIGRATION_FORMAT, MIGRATION_FORMAT_VERSION, MIGRATION_COLUMNS, PLUGIN_EXPORT_VERSION, migrationStableStringify, migrationChecksum, buildMigrationPackage, migrationPrecheck, migrationNormalizeRow, composeMigration, applyMigration }
