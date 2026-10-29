import { Badge, Chip, Empty, Input, h } from '../../../core/runtime.js'

/* ------------------------------------------------------------ HTTP 状态码 */
const httpStatusTable: any = [
    { code: 100, group: '1xx', title: 'Continue', meaning: '服务器已收到请求头，等待请求体', cause: '大请求体的两阶段提交', fix: '客户端继续发送 body' },
    { code: 101, group: '1xx', title: 'Switching Protocols', meaning: '协议切换', cause: 'WebSocket / h2c 升级', fix: '客户端按 Upgrade 响应切换协议' },
    { code: 200, group: '2xx', title: 'OK', meaning: '请求成功', cause: '正常响应', fix: '—' },
    { code: 201, group: '2xx', title: 'Created', meaning: '资源创建成功', cause: 'POST 创建资源', fix: '检查 Location 头' },
    { code: 204, group: '2xx', title: 'No Content', meaning: '成功但无响应体', cause: '删除 / 更新无需回包', fix: '不要尝试解析 body' },
    { code: 206, group: '2xx', title: 'Partial Content', meaning: '部分内容', cause: 'Range 断点续传', fix: '检查 Content-Range' },
    { code: 301, group: '3xx', title: 'Moved Permanently', meaning: '永久重定向', cause: '域名或路径永久变更', fix: '更新客户端地址；注意 POST 会变 GET' },
    { code: 302, group: '3xx', title: 'Found', meaning: '临时重定向', cause: '登录跳转、灰度跳转', fix: '确认跳转目标是否正常' },
    { code: 304, group: '3xx', title: 'Not Modified', meaning: '缓存仍有效', cause: '命中 If-None-Match / If-Modified-Since', fix: '使用本地缓存，属正常' },
    { code: 307, group: '3xx', title: 'Temporary Redirect', meaning: '临时重定向且保持方法', cause: '需要保持 POST 的重定向', fix: '跟随 Location，方法不变' },
    { code: 308, group: '3xx', title: 'Permanent Redirect', meaning: '永久重定向且保持方法', cause: '接口永久迁移', fix: '更新调用地址' },
    { code: 400, group: '4xx', title: 'Bad Request', meaning: '请求语法或参数不合法', cause: 'JSON 解析失败、缺必填参数、类型不符', fix: '校验请求体与 Content-Type' },
    { code: 401, group: '4xx', title: 'Unauthorized', meaning: '未认证或凭据无效', cause: 'Token 过期、未带 Authorization', fix: '重新登录或刷新 Token' },
    { code: 403, group: '4xx', title: 'Forbidden', meaning: '已认证但无权限', cause: '角色/ACL 不足、IP 白名单', fix: '检查授权范围而非重新登录' },
    { code: 404, group: '4xx', title: 'Not Found', meaning: '资源不存在', cause: '路径拼错、资源已删、网关路由缺失', fix: '核对路径与资源 ID' },
    { code: 405, group: '4xx', title: 'Method Not Allowed', meaning: '方法不允许', cause: '用 GET 调了只支持 POST 的接口', fix: '查看 Allow 响应头' },
    { code: 406, group: '4xx', title: 'Not Acceptable', meaning: '无法满足 Accept', cause: '只支持 application/json 却要 XML', fix: '调整 Accept 头' },
    { code: 408, group: '4xx', title: 'Request Timeout', meaning: '请求超时', cause: '客户端发送过慢、连接被中断', fix: '排查网络与超时配置' },
    { code: 409, group: '4xx', title: 'Conflict', meaning: '资源状态冲突', cause: '并发写、唯一键冲突、版本号不匹配', fix: '加乐观锁或重试' },
    { code: 410, group: '4xx', title: 'Gone', meaning: '资源已永久移除', cause: '接口下线', fix: '改用新接口' },
    { code: 413, group: '4xx', title: 'Payload Too Large', meaning: '请求体过大', cause: '上传文件超限、网关 body 限制', fix: '调大 limit 或分片上传' },
    { code: 414, group: '4xx', title: 'URI Too Long', meaning: 'URI 过长', cause: 'GET 参数过多', fix: '改 POST 或缩短参数' },
    { code: 415, group: '4xx', title: 'Unsupported Media Type', meaning: '媒体类型不支持', cause: '漏了 Content-Type: application/json', fix: '补上正确的 Content-Type' },
    { code: 418, group: '4xx', title: "I'm a teapot", meaning: '彩蛋状态码', cause: '约定俗成的玩笑', fix: '—' },
    { code: 422, group: '4xx', title: 'Unprocessable Entity', meaning: '语义校验失败', cause: '字段格式对但业务规则不通过', fix: '读响应里的字段级错误' },
    { code: 429, group: '4xx', title: 'Too Many Requests', meaning: '触发限流', cause: 'QPS 超限、配额用尽', fix: '退避重试；看 Retry-After' },
    { code: 500, group: '5xx', title: 'Internal Server Error', meaning: '服务端未捕获异常', cause: '代码抛错、依赖超时未兜底', fix: '查服务端日志与堆栈' },
    { code: 501, group: '5xx', title: 'Not Implemented', meaning: '未实现', cause: '方法不支持', fix: '换方法或升级服务' },
    { code: 502, group: '5xx', title: 'Bad Gateway', meaning: '网关收到上游非法响应', cause: '上游崩溃、上游返回非 HTTP、端口不通', fix: '查上游服务健康与网关日志' },
    { code: 503, group: '5xx', title: 'Service Unavailable', meaning: '服务暂不可用', cause: '实例全部下线、过载保护、发布中', fix: '检查实例与容量' },
    { code: 504, group: '5xx', title: 'Gateway Timeout', meaning: '网关等待上游超时', cause: '上游慢查询、连接池耗尽', fix: '排查上游耗时与超时配置' },
    { code: 505, group: '5xx', title: 'HTTP Version Not Supported', meaning: 'HTTP 版本不支持', cause: '客户端用了过新/过旧协议', fix: '调整协议版本' },
    { code: 507, group: '5xx', title: 'Insufficient Storage', meaning: '存储空间不足', cause: '磁盘写满、配额耗尽', fix: '清理磁盘或扩容' },
    { code: 508, group: '5xx', title: 'Loop Detected', meaning: '检测到循环', cause: '重定向或代理配置成环', fix: '检查重写规则' },
];

function toolStatusPane(props?: any): any {
    const value = props.value || {};
    const group = value.group || 'all';
    const query = String(value.query || '').trim();
    const groups: any = ['all', '2xx', '3xx', '4xx', '5xx'];
    const rows = httpStatusTable.filter(function (row?: any): any {
        if (group !== 'all' && row.group !== group)
            return false;
        if (!query)
            return true;
        return (String(row.code).indexOf(query) >= 0 ||
            row.title.toLowerCase().indexOf(query.toLowerCase()) >= 0 ||
            row.meaning.indexOf(query) >= 0);
    });
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-row wb-row--wrap', style: { gap: 6 } }, groups.map(function (item?: any): any {
        return h(Chip, {
            key: item,
            active: group === item,
            onClick: function (): any {
                props.patch({ group: item });
            },
            children: item === 'all' ? '全部' : item,
        });
    }), h('div', { className: 'wb-spacer' }), h(Input, {
        value: value.query || '',
        placeholder: '按状态码 / 名称 / 含义过滤',
        style: { maxWidth: 240 },
        onChange: function (event?: any): any {
            props.patch({ query: event.target.value });
        },
    })), rows.length === 0
        ? h(Empty, { icon: 'info', title: '没有匹配的状态码', hint: '试试输入 404 或 4xx。' })
        : h('table', { className: 'wb-table' }, h('thead', null, h('tr', null, h('th', null, '码'), h('th', null, '名称'), h('th', null, '含义'), h('th', null, '常见成因'), h('th', null, '排查方向'))), h('tbody', null, rows.map(function (row?: any): any {
            return h('tr', { key: row.code }, h('td', null, h(Badge, { tone: row.group === '2xx' ? 'ok' : row.group === '3xx' ? 'idle' : row.group === '4xx' ? 'warn' : 'err' }, String(row.code))), h('td', { className: 'wb-mono', style: { whiteSpace: 'nowrap' } }, row.title), h('td', null, row.meaning), h('td', { className: 'wb-muted' }, row.cause), h('td', { className: 'wb-muted' }, row.fix));
        }))), h('p', { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.7 } }, '内置 ' + httpStatusTable.length + ' 个常见状态码；这里是离线速查表，不发起任何请求。'));
}
export { httpStatusTable, toolStatusPane }
