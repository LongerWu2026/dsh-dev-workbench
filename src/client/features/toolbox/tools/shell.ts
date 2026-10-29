import { Badge, Chip, Empty, Input, h } from '../../../core/runtime.js'
import { toolCopyButton } from '../shared-controls.js'

/* ------------------------------------------------- Shell / Docker 命令速查 */
const shellCheatsheet: any = [
    { group: 'Docker', cmd: 'docker ps -a', desc: '列出全部容器（含已退出）' },
    { group: 'Docker', cmd: 'docker logs -f --tail 200 <容器>', desc: '跟踪最近 200 行日志' },
    { group: 'Docker', cmd: 'docker exec -it <容器> sh', desc: '进入容器交互 shell' },
    { group: 'Docker', cmd: 'docker stats --no-stream', desc: '一次性查看容器 CPU/内存' },
    { group: 'Docker', cmd: 'docker system df', desc: '查看镜像/容器/卷占用空间' },
    { group: 'Docker', cmd: 'docker inspect <容器> --format "{{.State.Status}}"', desc: '只看容器状态' },
    { group: 'Compose', cmd: 'docker compose ps', desc: '查看 compose 服务状态' },
    { group: 'Compose', cmd: 'docker compose logs -f --tail 100 <服务>', desc: '跟踪某个服务日志' },
    { group: 'Compose', cmd: 'docker compose config', desc: '校验并展开 compose 配置' },
    { group: 'Compose', cmd: 'docker compose up -d --build <服务>', desc: '重建并后台启动某服务' },
    { group: 'Linux', cmd: 'ps aux | sort -nrk 3 | head -10', desc: 'CPU 占用 Top 10' },
    { group: 'Linux', cmd: 'lsof -i -P -n -sTCP:LISTEN', desc: '列出本机监听端口' },
    { group: 'Linux', cmd: 'du -sh * | sort -hr | head -10', desc: '当前目录各子项体积 Top 10' },
    { group: 'Linux', cmd: 'df -h', desc: '磁盘使用率' },
    { group: 'Linux', cmd: 'netstat -an | grep ESTABLISHED | wc -l', desc: '统计已建立连接数' },
    { group: '日志', cmd: 'grep -n "ERROR" app.log | tail -50', desc: '定位最近错误行' },
    { group: '日志', cmd: 'tail -f app.log | grep -v "health"', desc: '跟踪日志并过滤健康检查' },
    { group: '日志', cmd: 'awk \'{print $1}\' access.log | sort | uniq -c | sort -nr | head', desc: '统计访问来源 Top' },
    { group: '诊断', cmd: 'curl -o /dev/null -s -w "%{http_code} %{time_total}s\\n" <URL>', desc: '只看状态码与耗时' },
    { group: '诊断', cmd: 'dig +short <域名>', desc: '快速解析域名' },
    { group: '诊断', cmd: 'traceroute -n <目标>', desc: '查看网络路径' },
    { group: '诊断', cmd: 'kill -TERM <PID>', desc: '优雅停止进程（先 TERM 再 KILL）' },
];

function toolShellPane(props?: any): any {
    const value = props.value || {};
    const query = String(value.query || '').trim().toLowerCase();
    const groups: any = ['全部', 'Docker', 'Compose', 'Linux', '日志', '诊断'];
    const active = value.group && value.group !== '全部' ? value.group : '全部';
    const rows = shellCheatsheet.filter(function (row?: any): any {
        if (active !== '全部' && row.group !== active)
            return false;
        if (!query)
            return true;
        return row.cmd.toLowerCase().indexOf(query) >= 0 || row.desc.indexOf(query) >= 0;
    });
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-row wb-row--wrap', style: { gap: 6 } }, groups.map(function (group?: any): any {
        return h(Chip, {
            key: group,
            active: active === group,
            onClick: function (): any {
                props.patch({ group: group });
            },
            children: group,
        });
    }), h('div', { className: 'wb-spacer' }), h(Input, {
        value: value.query || '',
        placeholder: '按命令或说明过滤',
        style: { maxWidth: 260 },
        onChange: function (event?: any): any {
            props.patch({ query: event.target.value });
        },
    })), rows.length === 0
        ? h(Empty, { icon: 'search', title: '没有匹配的命令', hint: '换个关键词，或切到「全部」。' })
        : h('table', { className: 'wb-table' }, h('thead', null, h('tr', null, h('th', null, '分类'), h('th', null, '命令'), h('th', null, '说明'), h('th', null, ''))), h('tbody', null, rows.map(function (row?: any, index?: any): any {
            return h('tr', { key: row.cmd + index }, h('td', null, h(Badge, { tone: 'idle' }, row.group)), h('td', { className: 'wb-mono', style: { overflowWrap: 'anywhere' } }, row.cmd), h('td', { className: 'wb-muted' }, row.desc), h('td', null, h(toolCopyButton, { text: row.cmd, label: '复制', title: '复制命令' })));
        }))), h('p', { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.7 } }, '离线速查表：不会执行任何命令。带 <占位> 的请替换为实际容器名/PID/URL。'));
}
export { shellCheatsheet, toolShellPane }
