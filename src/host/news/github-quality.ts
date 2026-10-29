import { runReadOnlyCommand } from '../platform/command-runner.js';
import { cwdForHostCommands } from '../integrations/environment.js';
import { hostNowIso } from '../platform/runtime.js';
export function githubRepoName(url: string): string | null { try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return u.hostname === 'github.com' && parts.length === 2 && parts.every(p => /^[a-zA-Z0-9_.-]+$/.test(p)) ? parts.join('/') : null;
}
catch {
    return null;
} }
export async function githubQuality(ctx: any, item: any): Promise<any> {
    const repo = githubRepoName(item.url);
    if (!repo)
        return null;
    const lastAttempt = item.github?.attemptedAt || item.github?.checkedAt;
    if (lastAttempt && Date.now() - Date.parse(lastAttempt) < 6 * 3600000)
        return item.github;
    const result = await runReadOnlyCommand(ctx, ['gh', 'repo', 'view', repo, '--json', 'nameWithOwner,stargazerCount,forkCount,pushedAt,createdAt,isArchived,licenseInfo,latestRelease,url'], cwdForHostCommands());
    if (result.status !== 'ok')
        return { ...item.github, status: 'unavailable', note: 'GitHub 元数据暂不可用，未验证热度', attemptedAt: hostNowIso() };
    try {
        const data = JSON.parse(result.stdout);
        if (data.nameWithOwner?.toLowerCase() !== repo.toLowerCase() || !Number.isFinite(data.stargazerCount))
            throw Error();
        const previous = item.github?.status === 'verified' ? item.github : null;
        const at = hostNowIso();
        const samples = [...(previous?.samples || [])];
        if (!samples.length || Date.now() - Date.parse(samples.at(-1).at) > 6 * 3600000)
            samples.push({ at, stars: data.stargazerCount });
        const baseline = samples.find((row: any) => Date.parse(row.at) >= Date.now() - 8 * 86400000 && Date.parse(row.at) <= Date.now() - 86400000);
        return { status: 'verified', checkedAt: at, stars: data.stargazerCount, forks: data.forkCount, pushedAt: data.pushedAt, createdAt: data.createdAt, archived: data.isArchived === true, license: data.licenseInfo?.spdxId || data.licenseInfo?.name || null, release: data.latestRelease?.tagName || data.latestRelease?.name || null, releaseAt: data.latestRelease?.publishedAt || null, starGrowth: baseline ? data.stargazerCount - baseline.stars : null, growthSince: baseline?.at || null, samples: samples.slice(-32) };
    }
    catch {
        return { ...item.github, status: 'unavailable', note: 'GitHub 元数据格式无效，未验证热度', attemptedAt: hostNowIso() };
    }
}
