import { dshHomeDir, hostNowIso } from '../platform/runtime.js'
import { runReadOnlyCommand } from '../platform/command-runner.js'
import { loadWorkbenchState } from '../storage/state-store.js'
import { ensureArray } from '../domain/model.js'
/* ============================================================================
 * dev-workbench host — read-only engineering environment
 *
 * Design report §3.5 asks for Git branches, pending review, CI state, Docker
 * containers and port usage, "默认只读". This module delivers the part that can
 * be observed truthfully from one machine without credentials:
 *
 *   - git branch / dirty counts / last commit, per configured project and for
 *     the Host's default working directory;
 *   - docker container names, images and status.
 *
 * Everything goes through the read-only allowlist in 28-exec.js. Nothing here
 * writes, stages, pushes, or starts a container. A missing binary, a missing
 * project path and a non-repository directory are all reported as states, not
 * thrown errors, so the panel degrades instead of breaking.
 * ========================================================================== */
const ENVIRONMENT_TTL_MS = 45 * 1000;
let environmentCache: any = { at: 0, value: null };
function cwdForHostCommands(ctx?: any): any {
    const workingDirectory = ctx && ctx.get ? ctx.get('workingDirectory') : null;
    if (workingDirectory && typeof workingDirectory.defaultDirectory === 'string' && workingDirectory.defaultDirectory) {
        return workingDirectory.defaultDirectory;
    }
    return dshHomeDir();
}
async function readGitRepository(ctx?: any, dir?: any, label?: any): Promise<any> {
    if (!dir) {
        return { label: label, dir: dir || null, status: 'unavailable', reason: '未配置仓库目录' };
    }
    const status = await runReadOnlyCommand(ctx, ['git', 'status', '--porcelain=v1', '-b'], dir);
    if (status.status !== 'ok') {
        const reason = status.status === 'unavailable'
            ? status.reason
            : /not a git repository/i.test(status.stderr || '')
                ? '该目录不是 Git 仓库'
                : status.reason || 'git status 失败';
        return { label: label, dir: dir, status: status.status === 'unavailable' ? 'unavailable' : 'error', reason: reason };
    }
    const lines = String(status.stdout || '')
        .split('\n')
        .filter(function (line?: any): any {
        return line.trim().length > 0;
    });
    const header = lines.length > 0 ? lines[0] : '';
    const branchMatch = /^##\s*([^\s.]+)/.exec(header);
    const changes = lines.slice(1);
    const uptodateMatch = /\[(ahead|behind|gone)/.exec(header);
    const log = await runReadOnlyCommand(ctx, ['git', 'log', '-1', '--pretty=%h\x1f%s\x1f%ar'], dir);
    let lastCommit: any = null;
    if (log.status === 'ok' && log.stdout.trim()) {
        const parts = log.stdout.trim().split('\x1f');
        lastCommit = { hash: parts[0] || '', subject: parts[1] || '', when: parts[2] || '' };
    }
    return {
        label: label,
        dir: dir,
        status: 'ok',
        branch: branchMatch ? branchMatch[1] : '(detached)',
        track: uptodateMatch ? uptodateMatch[1] : 'in-sync',
        changed: changes.length,
        staged: changes.filter(function (line?: any): any {
            return /^[MADRC]/.test(line);
        }).length,
        unstaged: changes.filter(function (line?: any): any {
            return /^.[MADRC]/.test(line);
        }).length,
        untracked: changes.filter(function (line?: any): any {
            return /^\?\?/.test(line);
        }).length,
        files: changes.slice(0, 12),
        lastCommit: lastCommit,
    };
}
async function readDockerState(ctx?: any): Promise<any> {
    const docker = await runReadOnlyCommand(ctx, ['docker', 'ps', '--format', '{{.Names}}\t{{.Image}}\t{{.Status}}'], cwdForHostCommands(ctx));
    if (docker.status !== 'ok') {
        const reason = docker.status === 'unavailable'
            ? docker.reason
            : /Cannot connect to the Docker daemon|Is the docker daemon running/i.test(docker.stderr || '')
                ? 'Docker 守护进程未运行'
                : docker.reason || 'docker ps 失败';
        return {
            status: docker.status === 'unavailable' ? 'unavailable' : 'error',
            reason: reason,
            containers: [],
        };
    }
    const containers = String(docker.stdout || '')
        .split('\n')
        .map(function (line?: any): any {
        return line.split('\t');
    })
        .filter(function (parts?: any): any {
        return parts.length >= 3 && parts[0];
    })
        .slice(0, 20)
        .map(function (parts?: any): any {
        return { name: parts[0], image: parts[1], state: parts[2] };
    });
    return { status: 'ok', reason: null, containers: containers };
}
function invalidateEnvironmentCache(): any {
    environmentCache = { at: 0, value: null };
}
/** Listening TCP ports from `lsof -i -P -n -sTCP:LISTEN` (read-only). */
async function readListeningPorts(ctx?: any): Promise<any> {
    const result = await runReadOnlyCommand(ctx, ['lsof', '-i', '-P', '-n', '-sTCP:LISTEN'], cwdForHostCommands(ctx));
    if (result.status !== 'ok') {
        return {
            status: result.status === 'unavailable' ? 'unavailable' : 'error',
            reason: result.reason || 'lsof 执行失败',
            ports: [],
        };
    }
    const seen = new Set();
    const ports: any = [];
    for (const line of String(result.stdout || '').split('\n')) {
        if (!line || /^COMMAND\b/.test(line))
            continue;
        const columns = line.trim().split(/\s+/);
        if (columns.length < 9)
            continue;
        const name = columns[8];
        const match = /^(.*):(\d+)$/.exec(name);
        if (!match)
            continue;
        const entry: any = {
            command: columns[0].slice(0, 24),
            pid: columns[1],
            address: match[1],
            port: Number(match[2]),
        };
        const key = entry.command + '|' + entry.address + '|' + entry.port;
        if (seen.has(key))
            continue;
        seen.add(key);
        if (ports.length < 30)
            ports.push(entry);
    }
    ports.sort(function (a?: any, b?: any): any {
        return a.port - b.port || String(a.command).localeCompare(String(b.command));
    });
    return { status: 'ok', reason: null, ports: ports };
}
/** 进程 CPU/内存 Top（ps aux，只读）。 */
async function readTopProcesses(ctx?: any): Promise<any> {
    const result = await runReadOnlyCommand(ctx, ['ps', 'aux'], cwdForHostCommands(ctx));
    if (result.status !== 'ok') {
        return { status: result.status === 'unavailable' ? 'unavailable' : 'error', reason: result.reason || 'ps 失败', items: [] };
    }
    const rows: any = [];
    for (const line of String(result.stdout || '').split('\n')) {
        if (!line || /^USER\b/.test(line))
            continue;
        const columns = line.trim().split(/\s+/);
        if (columns.length < 11)
            continue;
        const cpu = Number(columns[2]);
        const mem = Number(columns[3]);
        if (!Number.isFinite(cpu) || !Number.isFinite(mem))
            continue;
        const command = columns.slice(10).join(' ').slice(0, 90);
        rows.push({ user: columns[0].slice(0, 24), pid: columns[1], cpu: cpu, mem: mem, command: command });
    }
    rows.sort(function (a?: any, b?: any): any {
        return b.cpu - a.cpu || b.mem - a.mem;
    });
    return { status: 'ok', reason: null, items: rows.slice(0, 12) };
}
async function buildEnvironment(ctx?: any): Promise<any> {
    if (environmentCache.value && Date.now() - environmentCache.at < ENVIRONMENT_TTL_MS) {
        return environmentCache.value;
    }
    const state = loadWorkbenchState();
    const targets: any = [];
    const seen = new Set();
    const defaultDir = cwdForHostCommands(ctx);
    if (defaultDir) {
        targets.push({ dir: defaultDir, label: '当前工作目录' });
        seen.add(defaultDir);
    }
    ensureArray(state.projects)
        .slice(0, 6)
        .forEach(function (project?: any): any {
        if (!project.repoPath || seen.has(project.repoPath))
            return;
        seen.add(project.repoPath);
        targets.push({ dir: project.repoPath, label: project.name || project.repoPath });
    });
    const repositories: any = [];
    for (const target of targets) {
        repositories.push(await readGitRepository(ctx, target.dir, target.label));
    }
    const value: any = {
        at: hostNowIso(),
        cwd: defaultDir,
        git: repositories,
        docker: await readDockerState(ctx),
        ports: await readListeningPorts(ctx),
        processes: await readTopProcesses(ctx),
        note: '全部为只读探测：git status/log、docker ps、lsof -i、ps aux，不写仓库、不启动容器、不结束进程。',
    };
    environmentCache = { at: Date.now(), value: value };
    return value;
}

export { ENVIRONMENT_TTL_MS, environmentCache, cwdForHostCommands, readGitRepository, readDockerState, invalidateEnvironmentCache, readListeningPorts, readTopProcesses, buildEnvironment }
