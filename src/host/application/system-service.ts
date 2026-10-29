import {MESSAGE_SYNC_SCHEDULE,messageSyncDue} from '../../shared/message-schedule.js'
import {hasActiveProjectRuns} from '../integrations/project-runtime.js'
import { workbenchContext, workbenchCtxToolNames, workbenchServiceState } from './service-context.js'
import { BACKUP_KEEP, createBackup, listBackups, loadWorkbenchState, mutateWorkbenchState, restoreBackup, workbenchCounts, workbenchLoadNote } from '../storage/state-store.js'
import { auditEntry, ensureArray, normalizeProject, normalizeSettings, seedDemoData } from '../domain/model.js'
import { HOST_META, arch, asString, fileSizeOf, hostNowIso, platform, workbenchStatePath } from '../platform/runtime.js'
import { buildEnvironment, invalidateEnvironmentCache } from '../integrations/environment.js'
import { runUnifiedSearch } from '../search/unified-search.js'
import { buildGithubSnapshot } from '../integrations/github.js'
import { applyMigration, buildMigrationPackage } from '../storage/migration.js'
import { automationDue, runAutomationTick } from '../automation/scheduler.js'

/** system-service: shared Remote and Agent business use cases. */
export const systemService = {

    async snapshot(): Promise<any> {
        return JSON.parse(JSON.stringify(await workbenchServiceState()));
    },

    async saveSettings(patch?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            const next = Object.assign({}, state.settings, patch || {});
            if (patch && patch.aiExtract)
                next.aiExtract = Object.assign({}, state.settings.aiExtract, patch.aiExtract);
            if (patch && patch.automation)
                next.automation = Object.assign({}, state.settings.automation, patch.automation);
            state.settings = normalizeSettings(next);
            auditEntry(state, 'settings.updated', '更新设置：' + Object.keys(patch || {}).join(', '));
            return state;
        });
    },

    async reset(scope?: any): Promise<any> {
        const target = scope === 'tasks' || scope === 'runs' ? scope : 'all';
        return mutateWorkbenchState(function (state?: any): any {
            if (target === 'tasks') {
                const removed = ensureArray(state.tasks).length;
                state.tasks = [];
                state.runs = [];
                auditEntry(state, 'state.reset', '清空 ' + removed + ' 条待办与全部执行记录');
                return state;
            }
            if (target === 'runs') {
                state.runs = [];
                auditEntry(state, 'state.reset', '清空执行记录');
                return state;
            }
            state.tasks = [];
            state.runs = [];
            state.knowledge = [];
            state.radar = [];
            state.sources = [];
            state.replies = [];
            state.analysisQueue = [];
            state.jobs = [];
            state.syncCursors = {};
            state.candidates = [];
            state.operations = [];
            state.audit = [];
            auditEntry(state, 'state.reset', '清空业务数据，保留设置');
            return state;
        });
    },

    async seedDemo(): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            state.tasks = ensureArray(state.tasks).filter(function (task?: any): any {
                return task.demo !== true;
            });
            state.radar = ensureArray(state.radar).filter(function (item?: any): any {
                return item.demo !== true;
            });
            state.sources = ensureArray(state.sources).filter(function (item?: any): any {
                return asString(item.externalId, 40) !== 'demo-msg-1';
            });
            state.runs = [];
            seedDemoData(state);
            auditEntry(state, 'state.seeded', '载入示例数据');
            return state;
        });
    },

    async saveProject(input?: any): Promise<any> {
        const payload = input && typeof input === 'object' ? input : {};
        const repoPath = asString(payload.repoPath, 500);
        if (!repoPath)
            throw new Error('仓库目录不能为空');
        return mutateWorkbenchState(function (state?: any): any {
            const list = ensureArray(state.projects);
            const existing = payload.id
                ? list.find(function (project?: any): any {
                    return project.id === payload.id;
                })
                : list.find(function (project?: any): any {
                    return project.repoPath === repoPath;
                });
            const project = normalizeProject(payload, existing || null);
            project.repoPath = repoPath;
            state.projects = existing
                ? list.map(function (item?: any): any {
                    return item.id === project.id ? project : item;
                })
                : list.concat([project]);
            invalidateEnvironmentCache();
            auditEntry(state, existing ? 'project.updated' : 'project.created', project.name + ' · ' + project.repoPath);
            return state;
        });
    },

    async deleteProject(id?: any): Promise<any> {
        return mutateWorkbenchState(function (state?: any): any {
            if(hasActiveProjectRuns(id))throw new Error('请先停止该项目的运行，再移除项目')
            const target = ensureArray(state.projects).find(function (project?: any): any {
                return project.id === id;
            });
            state.projects = ensureArray(state.projects).filter(function (project?: any): any {
                return project.id !== id;
            });
            state.tasks = ensureArray(state.tasks).map(function (task?: any): any {
                return task.projectId === id ? Object.assign({}, task, { projectId: null }) : task;
            });
            if (state.settings.defaultProjectId === id)
                state.settings.defaultProjectId = null;
            invalidateEnvironmentCache();
            auditEntry(state, 'project.deleted', target ? target.name : String(id));
            return state;
        });
    },

    async search(request?: any): Promise<any> {
        return runUnifiedSearch(workbenchContext(), request || {});
    },

    async environment(): Promise<any> {
        return buildEnvironment(workbenchContext());
    },

    /** GitHub 只读快照（PR / CI），走 gh CLI 白名单命令。 */
    async github(): Promise<any> {
        return buildGithubSnapshot(workbenchContext());
    },

    /** TODO 21：导出迁移包（一致性快照 + 校验；凭据/原生会话不入包）。 */
    async exportMigration(): Promise<any> {
        return buildMigrationPackage(false);
    },

    /** TODO 21：导入迁移包（dryRun 预检可先跑；提交自动先备份）。 */
    async importMigration(request?: any): Promise<any> {
        return applyMigration(request || {});
    },

    /** 立即跑一次后台自动化（TODO 07）；返回本次结果。 */
    async automationRun(): Promise<any> {
        return runAutomationTick(workbenchContext());
    },

    /** 自动化状态：是否开启、间隔、上次结果、是否到期。 */
    async automationStatus(): Promise<any> {
        const state = loadWorkbenchState();
        const config = (state.settings && state.settings.automation) || {};
        return {
            enabled: config.enabled === true,
            intervalMinutes: Number(config.intervalMinutes) || 60,
            messageSchedule:{...MESSAGE_SYNC_SCHEDULE,lastAttemptAt:state.lastMessageSyncAttemptAt||null,due:messageSyncDue(state)},
            radar: config.radar !== false,
            mentions: config.mentions !== false,
            lastAutomation: state.lastAutomation || null,
            due: automationDue(state, Date.now())||messageSyncDue(state),
            note: '插件侧定时器：仅在 DSH 进程运行期间生效，退出/休眠时暂停，恢复后按到期补跑一次。',
        };
    },

    /** 手动备份 + 列出 + 恢复（TODO 11）。 */
    async backup(): Promise<any> {
        const path = createBackup('manual');
        if(!path) throw new Error('备份失败，未创建备份文件');
        return {
            created: path,
            backups: listBackups().slice(0, BACKUP_KEEP),
        };
    },

    async backups(): Promise<any> {
        return { backups: listBackups().slice(0, BACKUP_KEEP) };
    },

    async restoreBackup(id?: any): Promise<any> {
        const state = restoreBackup(id);
        return state;
    },

    /** 轻量版本探测：Client 轮询这个端点，只有 revision 变新才重取整份快照。 */
    async revision(): Promise<any> {
        const state = loadWorkbenchState();
        return { revision: Number(state.revision) || 0, updatedAt: state.updatedAt };
    },

    async diagnostics(): Promise<any> {
        const state = loadWorkbenchState();
        const path = workbenchStatePath();
        const toolNames = ensureArray(workbenchCtxToolNames());
        return {
            platform: HOST_META.platform,
            arch: HOST_META.arch,
            nodeVersion: HOST_META.nodeVersion,
            statePath: path,
            dataPath: path,
            dataBytes: fileSizeOf(path),
            counts: workbenchCounts(state),
            hostTime: hostNowIso(),
            loadNote: workbenchLoadNote,
            toolNames: toolNames,
        };
    }
};
