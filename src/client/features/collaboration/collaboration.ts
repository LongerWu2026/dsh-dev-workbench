import {ProjectLauncher} from './ProjectLauncher.js'
import {GithubPanel} from './GithubPanel.js'
import { Badge, Btn, Chip, Divider, Empty, Icon, IconBtn, PageHead, Panel, Spinner, Stat, T, WB, h, useStore } from '../../core/runtime.js'
import * as React from 'react'
/* ============================================================================
 * dev-workbench — 研发协作 (collab)
 *
 * Design report §3.5 / §5.1: Git branches, commits, CI status, dev environment
 * state, and Docker containers, "默认只读". What this page shows is measured on
 * the Host through the read-only allowlist (git status/log, docker ps) — a
 * missing binary, a non-repository directory and a stopped daemon each get their
 * own explanation instead of an empty table.
 *
 * Project launches are explicit actions; repository and machine probes remain
 * read-only. The selected project scopes the launcher, Git and PR/CI together.
 * ========================================================================== */
function collabGitTone(repo?: any): any {
    if (repo.status === 'ok')
        return repo.changed > 0 ? 'warn' : 'ok';
    if (repo.status === 'unavailable')
        return 'idle';
    return 'err';
}
/** 末尾斜杠/重复斜杠归一化后再比较路径。 */
function collabNormalizePath(value?: any): any {
    return String(value || '').replace(/\/{2,}/g, '/').replace(/\/+$/, '');
}
function collabRepoCard(repo?: any, index?: any, projects?: any): any {
    const projectList = Array.isArray(projects) ? projects : [];
    const repoDir = collabNormalizePath(repo.dir);
    const matchedProject = projectList.find(function (row?: any): any {
        return collabNormalizePath(row.repoPath) === repoDir && repoDir;
    }) ||
        projectList.find(function (row?: any): any {
            return row.name && row.name === repo.label;
        }) || null;
    const tone = collabGitTone(repo);
    const changes = repo.changed || 0;
    return h(Panel, {
        key: (repo.dir || 'repo') + index,
        icon: 'git',
        title: repo.label || '仓库',
        sub: repo.dir || '',
        badge: h(Badge, { tone: tone }, repo.status === 'ok' ? (changes > 0 ? changes + ' 处改动' : '干净') : repo.status === 'unavailable' ? '不可用' : '异常'),
        actions: h('div', { className: 'wb-row', style: { gap: 6 } }, repo.status === 'ok' ? h(Chip, { icon: 'git', children: repo.branch || '(detached)' }) : null,
        // 只有来自「项目」的仓库才可移除；Host 工作目录不是项目记录，不显示删除按钮
        matchedProject
            ? h(IconBtn, {
                name: 'trash',
                label: '从工作台移除这个仓库目录',
                onClick: function (): any {
                    if (!window.confirm('从工作台移除仓库「' + (repo.label || repo.dir) + '」？只解绑项目记录，不会删除磁盘上的目录。'))
                        return;
                    WB.actions.deleteProject(matchedProject.id).catch(function (): any { });
                },
            })
            : h('span', {
                className: 'wb-tiny wb-muted',
                title: '该条目来自 Host 工作目录，不是项目记录；到「连接与设置 → 项目」添加/删除项目',
            }, '工作目录')),
    }, repo.status !== 'ok'
        ? h(Empty, {
            icon: 'alert',
            title: repo.status === 'unavailable' ? '这一路没有可用工具' : '读取失败',
            hint: repo.reason || '没有拿到仓库状态。',
        })
        : h('div', { className: 'wb-stack', style: { gap: 8 } }, h('div', { className: 'wb-row wb-row--wrap', style: { gap: 6 } }, h(Badge, { tone: repo.staged > 0 ? 'warn' : 'idle' }, '已暂存 ' + repo.staged), h(Badge, { tone: repo.unstaged > 0 ? 'warn' : 'idle' }, '未暂存 ' + repo.unstaged), h(Badge, { tone: repo.untracked > 0 ? 'warn' : 'idle' }, '未跟踪 ' + repo.untracked), repo.track && repo.track !== 'in-sync' ? h(Badge, { tone: 'idle' }, repo.track) : null), repo.lastCommit
            ? h('div', { className: 'wb-item', style: { borderBottom: 0, paddingLeft: 0, paddingRight: 0 } }, h(Icon, { name: 'clock', size: 13 }), h('div', { className: 'wb-item-main' }, h('div', { className: 'wb-item-title' }, repo.lastCommit.subject || '(无提交信息)'), h('div', { className: 'wb-item-sub' }, h('span', { className: 'wb-mono' }, repo.lastCommit.hash), h('span', null, repo.lastCommit.when))))
            : null, repo.files && repo.files.length
            ? h('div', { className: 'wb-stack', style: { gap: 2 } }, h('div', { className: 'wb-label' }, '改动文件（最多 12 条）'), repo.files.map(function (line?: any, lineIndex?: any): any {
                return h('div', { key: lineIndex, className: 'wb-mono wb-ellipsis', style: { color: T.text2 } }, line);
            }))
            : h('span', { className: 'wb-tiny wb-muted' }, '工作区没有未提交改动。'), changes > 12 ? h('span', { className: 'wb-tiny wb-muted' }, '还有 ' + (changes - 12) + ' 条改动未显示。') : null));
}
function CollabPage(): any {
    const state = useStore();
    const projects = (state.data && state.data.projects) || [];
    const configured = projects.filter((project:any)=>project.repoPath);
    const [selection,setSelection] = React.useState<string>(()=>WB.store.get().collabProjectId||'');
    const projectId = configured.find((project:any)=>project.id===selection)?.id || configured[0]?.id || '';
    const selected = configured.find((project:any)=>project.id===projectId);
    const [env, setEnv] = React.useState<any>(null);
    const [github, setGithub] = React.useState<any>(null);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string|null>(null);
    const [refreshVersion,setRefreshVersion] = React.useState(0);
    const generation = React.useRef(0);
    async function load(force=false): Promise<void> {
        const version=++generation.current;
        setBusy(true);setError(null);
        const request={...(projectId?{projectId}:{}),force};
        await Promise.all([
            Promise.resolve().then(()=>WB.actions.environment(request)).then(value=>{if(version===generation.current)setEnv(value);},failure=>{if(version===generation.current){setEnv(null);setError(String(failure?.message||failure));}}),
            Promise.resolve().then(()=>WB.actions.github(request)).then(value=>{if(version===generation.current)setGithub(value);},failure=>{if(version===generation.current)setGithub({status:'error',note:String(failure?.message||failure)});}),
        ]);
        if(version===generation.current)setBusy(false);
    }
    React.useEffect(()=>{
        setEnv(null);setGithub(null);
        WB.store.set({collabProjectId:projectId});
        void load();
        return()=>{generation.current++;};
    },[projectId,selected?.repoPath]);
    function addRepoDir(): any {
        WB.pickDirectory().then(function (dir?: any): any {
            if (!dir) {
                WB.toast('没有选择目录（或当前环境不提供目录选择器）', 'info');
                return;
            }
            const parts = String(dir).split(/[\\/]/).filter(Boolean);
            const name = parts.length > 0 ? parts[parts.length - 1] : '项目';
            WB.actions
                .saveProject({ name: name, repoPath: dir })
                .then(function (): any {
                const added=WB.store.get().data?.projects?.find((project:any)=>project.repoPath===dir);
                if(added&&added.id!==projectId)setSelection(added.id);else void load(true);
            })
                .catch(function (): any {
                /* settle() already toasted */
            });
        });
    }
    const repos = (env && env.git) || [];
    const docker = (env && env.docker) || null;
    const dirty = repos.filter(function (repo?: any): any {
        return repo.status === 'ok' && repo.changed > 0;
    }).length;
    const gitKnown = repos.length > 0 && repos.every((repo:any)=>repo.status==='ok');
    const running = docker && docker.status === 'ok' ? docker.containers.length : 0;
    return h('div', null, h(PageHead, {
        icon: 'git',
        title: WB.t('nav.collab', '研发协作'),
        sub: '项目启动、开发软件联动与运行日志；仓库、容器和端口保留只读探测。',
        actions: h(Btn, {
            icon: 'refresh',
            size: 'sm',
            kind: 'primary',
            disabled: busy,
            onClick: ()=>{setRefreshVersion(value=>value+1);void load(true);},
            children: busy ? '探测中…' : '重新探测',
        }),
    }), h('div',{className:'wb-stack',style:{gap:6,marginBottom:14}},
        h('label',{className:'wb-label'},'当前项目 ',h('select',{className:'wb-select','aria-label':'当前项目',value:projectId,disabled:!configured.length,onChange:(event:any)=>setSelection(event.target.value)},configured.length?configured.map((project:any)=>h('option',{key:project.id,value:project.id},project.name)):h('option',{value:''},'Host 工作目录'))),
        selected?h('span',{className:'wb-tiny wb-mono wb-muted',style:{overflowWrap:'anywhere'}},selected.repoPath):null), h('div', { className: 'wb-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 14 } }, h(Stat, { label: '仓库', value: env ? repos.filter(function (r?: any): any { return r.status === 'ok'; }).length : '—', sub: '已探测 ' + repos.length + ' 个目录', icon: 'git' }), h(Stat, { label: '有未提交改动', value: gitKnown || dirty ? dirty : '—', tone: dirty ? 'warn' : gitKnown ? 'ok' : 'idle', sub: !env ? '尚未读取' : !gitKnown ? '仓库状态未完整读取' : dirty ? '先看一眼再动手' : '工作区干净', icon: 'edit' }), h(Stat, { label: '本机运行容器', value: docker && docker.status === 'ok' ? running : '—', sub: docker && docker.status === 'ok' ? '来自 docker ps' : (docker && docker.reason) || '未探测', icon: 'docker' }), h(Stat, { label: '项目', value: projects.length, sub: projects.length ? '来自 Host 数据' : '还没有配置项目', icon: 'folder' })), h(ProjectLauncher,{key:projectId+':'+(selected?.repoPath||''),projectId,refreshVersion}), h(GithubPanel,{snapshot:github}), busy && !env
        ? h('div', { className: 'wb-row', style: { padding: '30px 0', justifyContent: 'center', gap: 8 } }, h(Spinner, { size: 17 }), h('span', { className: 'wb-tiny wb-muted' }, '正在读取 git / docker 状态…'))
        : null, error
        ? h(Panel, { title: '探测失败', icon: 'alert' }, h('div', { role: 'alert', className: 'wb-code' }, error), h('p', { className: 'wb-hint', style: { marginTop: 8 } }, '请检查所选项目目录和本机工具，再重新探测。'))
        : null, env
        ? h('div', { className: 'wb-stack', style: { gap: 14 } }, h(Panel, {
            title: 'Git 仓库',
            icon: 'git',
            sub: selected ? '当前项目的分支与改动' : 'Host 当前工作目录',
            actions: h('div', { className: 'wb-row', style: { gap: 8 } }, env.at ? h('span', { className: 'wb-tiny wb-muted' }, '更新于 ' + WB.fmt.relative(env.at)) : null, h(Btn, {
                size: 'sm',
                icon: 'plus',
                onClick: addRepoDir,
                children: '添加仓库目录',
            })),
        }, repos.length === 0
            ? h(Empty, {
                icon: 'git',
                title: '没有可探测的仓库目录',
                hint: '为项目配置 repoPath 后这里会出现分支与改动；当前只探测 Host 的默认工作目录。',
                action: h(Btn, { size: 'sm', icon: 'folder', children: '选择仓库目录', onClick: addRepoDir }),
            })
            : h('div', { className: 'wb-stack', style: { gap: 10 } }, repos.map(function (repo?: any, index?: any): any {
                return collabRepoCard(repo, index, projects);
            }))), h('details', {className:'wb-collab-diagnostics'}, h('summary',{className:'wb-label',style:{cursor:'pointer',padding:'10px 0'}},'环境诊断（本机）'), h('div',{className:'wb-stack',style:{gap:14,paddingTop:8}}, h(Panel, {
            title: '端口占用',
            icon: 'plug',
            sub: 'lsof -i 的只读快照：本机正在监听的 TCP 端口',
            badge: env.ports
                ? h(Badge, { tone: env.ports.status === 'ok' ? (env.ports.ports.length ? 'warn' : 'idle') : env.ports.status === 'unavailable' ? 'idle' : 'err' }, env.ports.status === 'ok' ? env.ports.ports.length + ' 个' : env.ports.status === 'unavailable' ? '不可用' : '失败')
                : null,
        }, !env.ports
            ? h('span', { className: 'wb-tiny wb-muted' }, '未探测')
            : env.ports.status !== 'ok'
                ? h(Empty, {
                    icon: 'plug',
                    title: env.ports.status === 'unavailable' ? 'lsof 不可用' : '读取失败',
                    hint: env.ports.reason || '没有拿到端口列表。',
                })
                : env.ports.ports.length === 0
                    ? h(Empty, { icon: 'plug', title: '没有监听中的端口', hint: 'lsof 返回了空列表。' })
                    : h('table', { className: 'wb-table' }, h('thead', null, h('tr', null, h('th', null, '进程'), h('th', null, 'PID'), h('th', null, '地址'), h('th', null, '端口'))), h('tbody', null, env.ports.ports.map(function (row?: any): any {
                        return h('tr', { key: row.command + ':' + row.address + ':' + row.port }, h('td', { className: 'wb-mono' }, row.command), h('td', { className: 'wb-mono' }, row.pid), h('td', { className: 'wb-mono' }, row.address), h('td', null, h(Badge, { tone: row.port < 1024 ? 'warn' : 'idle' }, String(row.port))));
                    })))), h(Panel, {
            title: 'Docker 容器',
            icon: 'docker',
            sub: 'docker ps 的只读快照，不含 compose 与镜像',
            badge: docker ? h(Badge, { tone: docker.status === 'ok' ? 'ok' : docker.status === 'unavailable' ? 'idle' : 'err' }, docker.status === 'ok' ? running + ' 个' : docker.status === 'unavailable' ? '不可用' : '异常') : null,
        }, !docker
            ? h('span', { className: 'wb-tiny wb-muted' }, '未探测')
            : docker.status !== 'ok'
                ? h(Empty, {
                    icon: 'docker',
                    title: docker.status === 'unavailable' ? 'Docker 不可用' : '读取失败',
                    hint: docker.reason || '没有拿到容器列表。',
                })
                : docker.containers.length === 0
                    ? h(Empty, { icon: 'docker', title: '没有运行中的容器', hint: 'docker ps 返回了空列表。' })
                    : h('table', { className: 'wb-table' }, h('thead', null, h('tr', null, h('th', null, '名称'), h('th', null, '镜像'), h('th', null, '状态'))), h('tbody', null, docker.containers.map(function (container?: any): any {
                        return h('tr', { key: container.name }, h('td', { className: 'wb-mono' }, container.name), h('td', { className: 'wb-mono wb-ellipsis', style: { maxWidth: 220 } }, container.image), h('td', null, h(Badge, { tone: /Up/i.test(container.state) ? 'ok' : 'idle' }, container.state)));
                    })))), h(Panel, {
            title: '进程 CPU / 内存',
            icon: 'zap',
            sub: 'ps aux 的只读 Top 12（按 CPU 排序）',
            badge: env.processes
                ? h(Badge, { tone: env.processes.status === 'ok' ? 'idle' : 'err' }, env.processes.status === 'ok' ? env.processes.items.length + ' 个' : '不可用')
                : null,
        }, !env.processes
            ? h('span', { className: 'wb-tiny wb-muted' }, '未探测')
            : env.processes.status !== 'ok'
                ? h(Empty, { icon: 'zap', title: '读取失败', hint: env.processes.reason || 'ps 不可用。' })
                : h('table', { className: 'wb-table' }, h('thead', null, h('tr', null, h('th', null, 'PID'), h('th', null, 'CPU'), h('th', null, 'MEM'), h('th', null, '命令'))), h('tbody', null, env.processes.items.map(function (row?: any): any {
                    return h('tr', { key: row.pid + row.command }, h('td', { className: 'wb-mono' }, row.pid), h('td', null, h(Badge, { tone: row.cpu >= 50 ? 'warn' : 'idle' }, row.cpu.toFixed(1) + '%')), h('td', null, h(Badge, { tone: 'idle' }, row.mem.toFixed(1) + '%')), h('td', { className: 'wb-mono wb-ellipsis', style: { maxWidth: 260 } }, row.command));
                })))))), h(Panel, { title: '运行范围', icon: 'info' }, h('p', {className:'wb-tiny wb-muted'}, '项目启动只执行已配置目录中的启动项，日志在本次宿主运行期间保留；停用插件会停止由本插件启动的进程。Git、PR/CI、容器与端口仍为只读探测。')))
        : null);
}
WB.pages.collab = CollabPage;

export { collabGitTone, collabNormalizePath, collabRepoCard, CollabPage }
