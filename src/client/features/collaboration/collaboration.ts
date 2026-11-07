import {ProjectFiles,COLLAB_CSS} from './ProjectFiles.js'
import {ProjectSearch} from './ProjectSearch.js'
import {ProjectReviews} from './ProjectReviews.js'
import { Badge, Btn, Chip, Empty, Icon, IconBtn, PageHead, Panel, Spinner, WB, h, useStore } from '../../core/runtime.js'
import * as React from 'react'
/* ============================================================================
 * dev-workbench — 研发协作 (collab)
 *
 * Project files, change review and handoff are scoped to the selected project.
 * Only Git repository metadata is loaded here; machine diagnostics belong to
 * dedicated troubleshooting tools.
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
            : null, h('span', { className: 'wb-tiny wb-muted' }, changes ? '在上方「项目文件 → 未提交改动」中查看和打开文件。' : '工作区没有未提交改动。')));
}
function CollabPage(): any {
    const state = useStore();
    const projects = (state.data && state.data.projects) || [];
    const configured = projects.filter((project:any)=>project.repoPath);
    const [selection,setSelection] = React.useState<string>(()=>WB.store.get().collabProjectId||'');
    const projectId = configured.find((project:any)=>project.id===selection)?.id || configured[0]?.id || '';
    const selected = configured.find((project:any)=>project.id===projectId);
    const [env, setEnv] = React.useState<any>(null);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string|null>(null);
    const [refreshVersion,setRefreshVersion] = React.useState(0);
    const generation = React.useRef(0);
    async function load(force=false): Promise<void> {
        const version=++generation.current;
        setBusy(true);setError(null);
        const request={...(projectId?{projectId}:{}),force,scope:'repository'};
        try{const value=await WB.actions.environment(request);if(version===generation.current)setEnv(value)}
        catch(failure:any){if(version===generation.current){setEnv(null);setError(String(failure?.message||failure))}}
        if(version===generation.current)setBusy(false);
    }
    React.useEffect(()=>{
        setEnv(null);
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
    const repo = repos[0];
    return h('div', {className:'wb-collab'}, h('style',null,COLLAB_CSS), h(PageHead, {
        icon: 'git',
        title: WB.t('nav.collab', '研发协作'),
        primaryAction: h(Btn, {
            icon: 'refresh',
            size: 'sm',
            kind: 'primary',
            disabled: busy,
            onClick: ()=>{setRefreshVersion(value=>value+1);void load(true);},
            children: busy ? '刷新中…' : '刷新项目',
        }),
        controls: h('label',{className:'wb-page-project'},'当前项目',h('select',{className:'wb-select','aria-label':'当前项目',value:projectId,disabled:!configured.length,onChange:(event:any)=>setSelection(event.target.value)},configured.length?configured.map((project:any)=>h('option',{key:project.id,value:project.id},project.name)):h('option',{value:''},'Host 工作目录'))),
        actions:h(Btn,{size:'sm',icon:'plus',onClick:addRepoDir},'添加仓库目录'),
    }), h('div',{className:'wb-collab-summary'},selected?h('span',{className:'wb-mono'},selected.repoPath):h('span',null,'添加项目目录后即可浏览文件与改动。'),repo?.status==='ok'?h(React.Fragment,null,h(Chip,{icon:'git'},repo.branch||'(detached)'),h(Badge,{tone:repo.changed?'warn':'ok'},repo.changed?repo.changed+' 处改动':'工作区干净')):h(Badge,{tone:'idle'},busy?'仓库读取中…':repo?.reason||'仓库状态未读取')),
    selected?h(ProjectFiles,{key:projectId+':'+selected.repoPath,projectId,refreshVersion}):h(Empty,{icon:'folder',title:'选择项目，直接查看文件',hint:'关联已有目录后可浏览文件、查看未提交改动并在侧栏打开。',action:h(Btn,{size:'sm',icon:'folder',onClick:addRepoDir},'选择仓库目录')}),
    selected?h('div',{className:'wb-collab-tools',key:'tools:'+projectId+':'+selected.repoPath},h(ProjectSearch,{projectId,repoPath:selected.repoPath}),h(ProjectReviews,{projectId,refreshVersion})):null,
    busy && !env
        ? h('div', { className: 'wb-row', style: { padding: '30px 0', justifyContent: 'center', gap: 8 } }, h(Spinner, { size: 17 }), h('span', { className: 'wb-tiny wb-muted' }, '正在读取仓库状态…'))
        : null, error
        ? h(Panel, { title: '仓库状态读取失败', icon: 'alert' }, h('div', { role: 'alert', className: 'wb-code' }, error), h('p', { className: 'wb-hint', style: { marginTop: 8 } }, '请检查项目目录与 Git 是否可用，再刷新项目。'))
        : null, env
        ? h('div', { className: 'wb-stack', style: { gap: 14 } }, h(Panel, {
            title: 'Git 仓库',
            icon: 'git',
            sub: selected ? '当前项目的分支与改动' : 'Host 当前工作目录',
            actions: env.at ? h('span', { className: 'wb-tiny wb-muted' }, '更新于 ' + WB.fmt.relative(env.at)) : null,
        }, repos.length === 0
            ? h(Empty, {
                icon: 'git',
                title: '没有可探测的仓库目录',
                hint: '为项目配置 repoPath 后这里会出现分支与改动；当前只探测 Host 的默认工作目录。',
                action: h(Btn, { size: 'sm', icon: 'folder', children: '选择仓库目录', onClick: addRepoDir }),
            })
            : h('div', { className: 'wb-stack', style: { gap: 10 } }, repos.map(function (repo?: any, index?: any): any {
                return collabRepoCard(repo, index, projects);
            }))))
        : null);
}
WB.pages.collab = CollabPage;

export { collabGitTone, collabNormalizePath, collabRepoCard, CollabPage }
