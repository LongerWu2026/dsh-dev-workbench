

/* ============================================================================
 * dev-workbench page: Developer toolbox
 *
 * Offline tools use browser-side computation; explicit HTTP/MCP debugging uses the Host.
 * No automatic network
 * round-trip. Each tool keeps its own input/output/error state so switching
 * tools never discards what was typed. Registers `WB.pages.toolbox`.
 * ========================================================================== */
/* ---------------------------------------------------------------- tool catalog */
const toolDefs: any = [
    {id:'http-debug',name:'接口调试',desc:'HTTP 请求、响应与耗时',icon:'plug',network:true},
    {id:'mcp-debug',name:'MCP 调试',desc:'连接、发现工具与参数调用',icon:'agent',network:true},
    { id: 'json', name: 'JSON', desc: '格式化 / 压缩 / 校验', icon: 'layers' },
    { id: 'timestamp', name: '时间戳', desc: 'Unix 秒毫秒 ↔ 本地时间', icon: 'clock' },
    { id: 'base64', name: 'Base64', desc: 'UTF-8 安全编码解码', icon: 'lock' },
    { id: 'url', name: 'URL', desc: '编解码与 query 拆解', icon: 'link' },
    { id: 'uuid', name: 'UUID', desc: '批量生成 v4', icon: 'zap' },
    { id: 'jwt', name: 'JWT', desc: '解析 header / payload', icon: 'eye' },
    { id: 'regex', name: '正则', desc: '匹配与捕获组', icon: 'filter' },
    { id: 'diff', name: '文本 Diff', desc: '逐行 LCS 对比', icon: 'git' },
    { id: 'cron', name: 'Cron', desc: '5 段表达式逐段解释', icon: 'calendar' },
    { id: 'sql', name: 'SQL', desc: '关键字大写与缩进', icon: 'database' },
    { id: 'yaml', name: 'YAML', desc: 'YAML ↔ JSON', icon: 'layers' },
    { id: 'csv', name: 'CSV', desc: 'CSV ↔ JSON，含引号转义', icon: 'database' },
    { id: 'markdown', name: 'Markdown', desc: '基础语法实时预览', icon: 'book' },
    { id: 'status', name: 'HTTP 状态码', desc: '按码查含义与排查方向', icon: 'info' },
    { id: 'shell', name: 'Shell / Docker', desc: '命令行速查（离线）', icon: 'command' },
    { id: 'sqlexplain', name: 'SQL 计划解读', desc: '按关键字给调优提示', icon: 'database' },
];

/* Initial input is example-shaped only; it is never presented as page data. */
function toolInitialState(): any {
    return {
        selected: 'json',
        'http-debug': {url:'',method:'GET',headers:'{}',body:'',timeoutMs:30000},
        'mcp-debug': {url:'',version:'2025-11-25',headers:'{}',arguments:'{}',timeoutMs:30000},
        json: {
            input: '{\n  "name": "dev-workbench",\n  "local": true,\n  "tags": ["offline", "browser"]\n}',
            output: '',
            error: '',
        },
        timestamp: { input: String(Date.now()), output: '', error: '' },
        base64: { mode: 'encode', input: '智能工作台 · local only', output: '', error: '' },
        url: {
            mode: 'encode',
            input: 'https://example.com/search?q=开发 工具&page=2',
            output: '',
            error: '',
            rows: [],
        },
        uuid: { count: '5', upper: false, output: '', error: '' },
        jwt: {
            input: '',
            headerText: '',
            payloadText: '',
            claims: [],
            signatureLength: 0,
            error: '',
            ran: false,
        },
        regex: {
            pattern: '(\\w+)@(\\w+\\.\\w+)',
            flags: 'gi',
            text: '联系 dev@example.com 或 ops@example.org',
            matches: [],
            error: '',
            ran: false,
        },
        diff: {
            left: 'alpha\nbeta\ngamma\ndelta',
            right: 'alpha\nbeta changed\ngamma\ndelta\nepsilon',
            rows: [],
            stats: null,
            error: '',
            ran: false,
        },
        cron: { expr: '*/15 9-18 * * 1-5', rows: [], times: [], error: '', ran: false },
        yaml: {
            input: 'name: dev-workbench\ntags:\n  - offline\n  - browser\nlocal: true',
            output: '',
            error: '',
        },
        csv: {
            input: 'name,qps\n网关,2000\n报表,800',
            output: '',
            error: '',
            note: '',
            header: true,
        },
        markdown: {
            input: '# 标题\n\n**加粗**、*斜体* 与 `行内代码`\n\n- 列表项一\n- 列表项二\n\n> 引用\n\n```js\nconst a = 1\n```',
            output: '',
            error: '',
        },
        status: {
            group: 'all',
            query: '',
        },
        shell: {
            group: '全部',
            query: '',
        },
        sqlexplain: {
            input: 'EXPLAIN SELECT * FROM orders WHERE user_id = 1 ORDER BY created_at DESC;\n->  Seq Scan on orders  (cost=0.00..1834.00 rows=1 width=64)\n   Filter: (user_id = 1)\n   Sort  (cost=1834.01..1834.02 rows=1 width=64)\n   Sort Method: quicksort  Memory: 25kB',
            output: '',
            error: '',
        },
        sql: {
            input: 'select id, name, count(*) as total from users left join orders on orders.user_id = users.id where users.active = 1 and orders.total > 100 group by id, name order by total desc limit 20',
            output: '',
            error: '',
        },
    };
}
export { toolDefs, toolInitialState }
