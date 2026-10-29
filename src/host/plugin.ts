import {activateDeveloperServices} from './application/developer-service.js'
import { knowledgeToolGuard } from './knowledge/guards.js'
import { registerWorkbenchToolNames, setShared_workbenchCtx, workbenchApi, workbenchCtx } from './application/workbench-service.js'
import { WORKBENCH_REMOTE } from './api/remote.js'
import { workbenchToolDefinitions } from './api/tools.js'
import { startAutomation } from './automation/scheduler.js'
import { claimWorkbenchOwnership, loadWorkbenchState } from './storage/state-store.js'
import { workbenchStatePath } from './platform/runtime.js'
import { ensureArray } from './domain/model.js'
import { isWorkbenchBackgroundSession } from './assistant/sessions.js'
/* ============================================================================
 * dev-workbench host — plugin entry
 *
 * Two registrations, both owned by this plugin fiber:
 *   1. `workbench` service (ctx.provide) + its typert Remote descriptors, so
 *      the Client half can read and mutate state over the shared /api channel;
 *   2. the `workbench_*` Agent tools, so the model can read and write the same
 *      objects the pages show.
 *
 * A profile without `typert` or `tools` still loads the plugin: the service is
 * mounted, the missing capability is simply absent. That keeps state readable
 * (and recoverable) even when a profile composes fewer subsystems.
 * ========================================================================== */
export function apply(ctx?: any, config?: any): any {
    const releaseOwnership=claimWorkbenchOwnership();
    const disposeDeveloper=activateDeveloperServices();
    setShared_workbenchCtx(ctx);
    const settings = config && typeof config === 'object' ? config : {};
    ctx.provide('workbench', workbenchApi);
    ctx.inject(['typert'], function (host?: any): any {
        return host.typert.register(WORKBENCH_REMOTE);
    });
    ctx.inject(['tools'], function (host?: any): any {
        ctx.effect(function (): any {
            const guard = typeof host.tools.guard === 'function' ? host.tools.guard((execution: any) => {
                const id = execution.agent && execution.agent.session && execution.agent.session.id
                if(id&&knowledgeToolGuard(id))return knowledgeToolGuard(id);
                if (id && isWorkbenchBackgroundSession(loadWorkbenchState(),id,execution.agent.session)) return '后台识别/摘要会话只允许输出结构化结果，由 Host 校验后提交，禁止执行工具'
                return undefined
            }) : null
            const definitions = workbenchToolDefinitions();
            const disposers = definitions.map(function (definition?: any): any {
                return host.tools.register(definition);
            });
            registerWorkbenchToolNames(definitions.map(function (definition?: any): any {
                return definition.name;
            }));
            return function (): any {
                registerWorkbenchToolNames([]);
                if (typeof guard === 'function') guard();
                disposers.forEach(function (dispose?: any): any {
                    try {
                        dispose();
                    }
                    catch (e) {
                        /* already withdrawn by the owning context */
                    }
                });
            };
        });
    });
    // 后台自动化（TODO 07）：定时检查是否到期，到期跑确定性采集
    ctx.effect(function (): any {
        return startAutomation(ctx);
    });
    ctx.effect(function (): any {
        const state = loadWorkbenchState();
        if (ctx.logger && typeof ctx.logger.info === 'function') {
            ctx.logger.info('[dev-workbench] ready: ' +
                workbenchStatePath() +
                ' · ' +
                ensureArray(state.tasks).length +
                ' task(s)' +
                (settings.verbose === true ? ' · verbose' : ''));
        }
        return function (): any {
            disposeDeveloper();
            workbenchApi.disposeWebAI();
            if(releaseOwnership()) setShared_workbenchCtx(null);
        };
    });
}
