import { asString, existsSync, join, readFileSync, readdirSync, statSync } from '../platform/runtime.js'
import { loadWorkbenchState } from '../storage/state-store.js'
import { ensureArray } from '../domain/model.js'
import { cwdForHostCommands } from '../integrations/environment.js'
/* ============================================================================
 * dev-workbench host — 本地项目搜索（设计报告 §3.3「本地项目」Provider）
 *
 * 在 Host 侧只读遍历工作目录 / 项目仓库，按**文件名**与**文本内容**匹配，
 * 返回相对路径 + 命中行片段。约束：
 *   - 只在配置的根目录内（Host 工作目录 + 项目 repoPath），绝不越界；
 *   - 跳过依赖/构建/版本库目录（node_modules、.git、dist 等）；
 *   - 遍历量、读取量、返回量都有上限，避免大仓卡死；
 *   - 只读文本白名单扩展名，二进制不读；命中行做长度截断。
 * ========================================================================== */
const FILE_SEARCH_MAX_ENTRIES = 4000;
const FILE_SEARCH_MAX_CONTENT_READS = 300;
const FILE_SEARCH_MAX_RESULTS = 12;
const FILE_SEARCH_MAX_DEPTH = 7;
const FILE_SEARCH_MAX_BYTES = 256 * 1024;
const FILE_SEARCH_SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    'dist',
    'build',
    'out',
    'target',
    'vendor',
    'coverage',
    '.next',
    '.nuxt',
    '.venv',
    'venv',
    '__pycache__',
    '.idea',
    '.vscode',
    'Pods',
]);
const FILE_SEARCH_TEXT_EXT = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx',
    '.yml', '.yaml', '.toml', '.ini', '.conf', '.env', '.txt', '.csv',
    '.py', '.java', '.kt', '.kts', '.go', '.rs', '.rb', '.php', '.cs',
    '.sql', '.sh', '.bash', '.zsh', '.css', '.scss', '.less', '.html', '.htm',
    '.vue', '.svelte', '.xml', '.gradle',
]);
let fileIndexCache = new Map();
function fileSearchRoots(ctx?: any): any {
    const roots: any = [];
    const push = function (dir?: any, label?: any): any {
        if (!dir || typeof dir !== 'string')
            return;
        if (!existsSync(dir))
            return;
        if (roots.some(function (root?: any): any { return root.dir === dir; }))
            return;
        roots.push({ dir: dir, label: label });
    };
    const state = loadWorkbenchState();
    ensureArray(state.projects).forEach(function (project?: any): any {
        if (project.repoPath)
            push(project.repoPath, project.name || project.repoPath);
    });
    push(cwdForHostCommands(ctx), '当前工作目录');
    return roots.slice(0, 3);
}
function fileExtOf(name?: any): any {
    const index = name.lastIndexOf('.');
    return index < 0 ? '' : name.slice(index).toLowerCase();
}
/** 浅层遍历得到候选文件（带 mtime 缓存，60s 内复用）。 */
function indexRoot(root?: any): any {
    const cached = fileIndexCache.get(root.dir);
    if (cached && Date.now() - cached.at < 60 * 1000)
        return cached.files;
    const files: any = [];
    const queue: any = [{ dir: root.dir, depth: 0 }];
    let visited = 0;
    while (queue.length > 0 && visited < FILE_SEARCH_MAX_ENTRIES) {
        const current = queue.shift();
        let entries;
        try {
            entries = readdirSync(current.dir, { withFileTypes: true });
        }
        catch (e) {
            continue;
        }
        for (const entry of entries) {
            if (visited >= FILE_SEARCH_MAX_ENTRIES)
                break;
            const name = String(entry.name);
            if (name.startsWith('.') && name !== '.env')
                continue;
            const full = join(current.dir, name);
            if (entry.isDirectory()) {
                if (FILE_SEARCH_SKIP_DIRS.has(name))
                    continue;
                if (current.depth + 1 > FILE_SEARCH_MAX_DEPTH)
                    continue;
                queue.push({ dir: full, depth: current.depth + 1 });
                continue;
            }
            if (!entry.isFile())
                continue;
            visited += 1;
            files.push({ path: full, name: name, rel: full.slice(root.dir.length + 1) });
        }
    }
    fileIndexCache.set(root.dir, { at: Date.now(), files: files });
    return files;
}
function readTextSnippet(path?: any, needle?: any): any {
    let stat;
    try {
        stat = statSync(path);
    }
    catch (e) {
        return null;
    }
    if (!stat.isFile() || stat.size > FILE_SEARCH_MAX_BYTES)
        return null;
    let text;
    try {
        text = readFileSync(path, 'utf8');
    }
    catch (e) {
        return null;
    }
    const lower = text.toLowerCase();
    const index = lower.indexOf(needle);
    if (index < 0)
        return null;
    const lineStart = text.lastIndexOf('\n', index) + 1;
    const lineEnd = text.indexOf('\n', index);
    const line = text.slice(lineStart, lineEnd < 0 ? Math.min(text.length, lineStart + 240) : lineEnd).trim();
    const lineNo = text.slice(0, index).split('\n').length;
    return { snippet: line.slice(0, 240), line: lineNo, mtime: stat.mtime.toISOString() };
}
async function searchLocalFiles(ctx?: any, query?: any): Promise<any> {
    const needleRaw = asString(query, 120);
    const needle = needleRaw.toLowerCase();
    if (!needle)
        return { id: 'files', label: '本地项目', status: 'empty', items: [], note: null };
    const roots = fileSearchRoots(ctx);
    if (roots.length === 0) {
        return { id: 'files', label: '本地项目', status: 'unavailable', items: [], note: '没有可搜索的工作目录：在「连接与设置 → 项目」添加仓库目录。' };
    }
    const hits: any = [];
    let contentReads = 0;
    for (const root of roots) {
        const files = indexRoot(root);
        for (const file of files) {
            if (hits.length >= FILE_SEARCH_MAX_RESULTS)
                break;
            const nameHit = file.name.toLowerCase().indexOf(needle) >= 0;
            const isText = FILE_SEARCH_TEXT_EXT.has(fileExtOf(file.name));
            let contentHit: any = null;
            if (!nameHit && isText && contentReads < FILE_SEARCH_MAX_CONTENT_READS) {
                contentReads += 1;
                contentHit = readTextSnippet(file.path, needle);
            }
            if (!nameHit && !contentHit)
                continue;
            hits.push({
                id: 'file-' + file.path,
                title: file.rel,
                snippet: contentHit ? '第 ' + contentHit.line + ' 行：' + contentHit.snippet : '文件名匹配 · ' + root.label,
                url: null,
                kind: 'file',
                extra: {
                    at: contentHit ? contentHit.mtime : null,
                    project: root.label,
                    path: file.path,
                },
            });
        }
    }
    return {
        id: 'files',
        label: '本地项目',
        status: hits.length ? 'ok' : 'empty',
        items: hits,
        note: '只读遍历 ' +
            roots.length +
            ' 个根目录（跳过 node_modules/.git 等），命中文件与文本片段；不读取二进制、不越界。',
    };
}

export { FILE_SEARCH_MAX_ENTRIES, FILE_SEARCH_MAX_CONTENT_READS, FILE_SEARCH_MAX_RESULTS, FILE_SEARCH_MAX_DEPTH, FILE_SEARCH_MAX_BYTES, FILE_SEARCH_SKIP_DIRS, FILE_SEARCH_TEXT_EXT, fileIndexCache, fileSearchRoots, fileExtOf, indexRoot, readTextSnippet, searchLocalFiles }
