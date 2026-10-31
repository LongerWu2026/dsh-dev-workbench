import { asIso, asUrl, existsSync, homedir, hostNowIso, join } from '../platform/runtime.js'
import { runReadOnlyCommand } from '../platform/command-runner.js'
import { loadWorkbenchState } from '../storage/state-store.js'
import { ensureArray } from '../domain/model.js'
import { cwdForHostCommands } from './environment.js'
/* ============================================================================
 * dev-workbench host — GitHub 只读快照（设计报告 §3.5 PR / Review / CI）
 *
 * 通过已认证的 `gh` CLI 读取 PR 与 CI 运行状态。命令全部走 28-exec.js 的
 * **多段前缀白名单**（只允许 gh pr list/view/status、gh run list/view、
 * gh repo view、gh search repos），因此 pr merge / pr close / run rerun
 * 这类写操作在 spawn 之前就被拒绝。
 *
 * 没有 github 远端或未认证时如实报告状态，不伪造数据。
 * ========================================================================== */
const GITHUB_TTL_MS = 60 * 1000;
let githubCache: any = { at: 0, value: null };
async function resolveGhPath(ctx?: any): Promise<any> {
    const subprocess = ctx && ctx.get ? ctx.get('subprocess') : null;
    if (subprocess && typeof subprocess.resolveExecutable === 'function') {
        try {
            const resolved = await subprocess.resolveExecutable('gh', undefined, AbortSignal.timeout(2500));
            if (typeof resolved === 'string' && resolved.length > 0)
                return resolved;
        }
        catch (e) {
            /* fall through */
        }
    }
    for (const candidate of ['/opt/homebrew/bin/gh', '/usr/local/bin/gh', join(homedir(), 'bin', 'gh')]) {
        if (existsSync(candidate))
            return candidate;
    }
    return null;
}
function parseGhJson(result?: any): any {
    if (result.status !== 'ok')
        return null;
    try {
        return JSON.parse(result.stdout);
    }
    catch (e) {
        return null;
    }
}
function githubFailure(result: any): any {
    const detail = String(result.stderr || result.reason || '读取失败');
    const kind = /auth login|not logged|authentication|HTTP 401|bad credentials/i.test(detail) ? 'auth'
        : /not a git repository|no git remotes|not (?:a|on|in)\b.*github|none of the git remotes/i.test(detail) ? 'repository'
        : result.status === 'unavailable' || /ENOENT|not found/i.test(detail) ? 'unavailable' : 'error';
    const note = kind === 'auth' ? 'GitHub 未登录或登录已失效，请执行 gh auth login 后重试。'
        : kind === 'repository' ? '当前项目不是可读取的 GitHub 仓库。'
        : kind === 'unavailable' ? 'gh CLI 不可用，请检查安装和运行环境。' : detail.slice(0, 500);
    return {status: kind === 'unavailable' ? 'unavailable' : 'error', kind, note, items: []};
}
async function readPullRequests(ctx?: any, dir?: any, executable='gh'): Promise<any> {
    const result = await runReadOnlyCommand(ctx, [executable, 'pr', 'list', '--json', 'number,title,state,isDraft,author,updatedAt,url', '--limit', '10'], dir);
    if (result.status !== 'ok') {
        return githubFailure(result);
    }
    const list = parseGhJson(result);
    if (!Array.isArray(list)) {
        return { status: 'error', note: 'gh 返回不是 JSON 数组（可能未认证或目录不是 GitHub 仓库）', items: [] };
    }
    return {
        status: 'ok',
        note: null,
        items: list.map(function (pr?: any): any {
            return {
                number: pr.number,
                title: pr.title,
                state: pr.state,
                draft: pr.isDraft === true,
                author: pr.author && pr.author.login ? pr.author.login : null,
                updatedAt: asIso(pr.updatedAt),
                url: asUrl(pr.url),
            };
        }),
    };
}
async function readCiRuns(ctx?: any, dir?: any, executable='gh'): Promise<any> {
    const result = await runReadOnlyCommand(ctx, [executable, 'run', 'list', '--json', 'databaseId,status,conclusion,workflowName,headBranch,createdAt,url', '--limit', '10'], dir);
    if (result.status !== 'ok') {
        return githubFailure(result);
    }
    const list = parseGhJson(result);
    if (!Array.isArray(list)) {
        return { status: 'error', note: 'gh 返回不是 JSON 数组（可能未认证或没有 Actions）', items: [] };
    }
    return {
        status: 'ok',
        note: null,
        items: list.map(function (run?: any): any {
            return {
                id: run.databaseId,
                workflow: run.workflowName,
                branch: run.headBranch,
                status: run.status,
                conclusion: run.conclusion,
                createdAt: asIso(run.createdAt),
                url: asUrl(run.url),
            };
        }),
    };
}
/** 选择探测目录：优先项目里的 git 仓库，其次 Host 工作目录。 */
function githubTargetDir(ctx?: any, projectId?: string): any {
    const state = loadWorkbenchState();
    if (projectId) {
        const selected = ensureArray(state.projects).find((row:any)=>row.id===projectId);
        if (!selected?.repoPath) throw new Error('请选择已配置目录的项目');
        return selected.repoPath;
    }
    const project = ensureArray(state.projects).find(function (row?: any): any {
        return row.repoPath && existsSync(join(row.repoPath, '.git'));
    });
    if (project)
        return project.repoPath;
    const cwd = cwdForHostCommands(ctx);
    if (cwd && existsSync(join(cwd, '.git')))
        return cwd;
    return cwd;
}
async function buildGithubSnapshot(ctx?: any, request?: any): Promise<any> {
    const dir = githubTargetDir(ctx, request?.projectId);
    const key = (request?.projectId || 'default') + ':' + dir;
    if (!request?.force && githubCache.key === key && githubCache.value && Date.now() - githubCache.at < GITHUB_TTL_MS)
        return githubCache.value;
    const ghPath = await resolveGhPath(ctx);
    if (!ghPath) {
        const value: any = {
            at: hostNowIso(),
            projectId: request?.projectId || null,
            dir: dir,
            status: 'unavailable',
            note: '未找到 gh CLI：安装 GitHub CLI 并 `gh auth login` 后才能读取 PR 与 CI。',
            prs: { status: 'unavailable', items: [], note: null },
            runs: { status: 'unavailable', items: [], note: null },
        };
        githubCache = { key, at: Date.now(), value: value };
        return value;
    }
    const [prs, runs] = await Promise.all([readPullRequests(ctx, dir, ghPath), readCiRuns(ctx, dir, ghPath)]);
    const status = prs.status === 'ok' && runs.status === 'ok' ? 'ok' : prs.status === 'ok' || runs.status === 'ok' ? 'partial' : 'error';
    const value: any = {
        at: hostNowIso(),
        projectId: request?.projectId || null,
        dir: dir,
        status,
        note: status === 'ok' ? '只读：gh pr list / gh run list。' : [prs.status !== 'ok' ? 'PR：' + prs.note : '', runs.status !== 'ok' ? 'CI：' + runs.note : ''].filter(Boolean).join('；'),
        prs: prs,
        runs: runs,
    };
    githubCache = { key, at: Date.now(), value: value };
    return value;
}

export { GITHUB_TTL_MS, githubCache, resolveGhPath, parseGhJson, readPullRequests, readCiRuns, githubTargetDir, buildGithubSnapshot }
