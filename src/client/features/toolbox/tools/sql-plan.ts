import { Badge, Field, T, Textarea, h } from '../../../core/runtime.js'
import { toolMonoStyle, toolOutputBlock } from '../shared-controls.js'

/* ---------------------------------------------------- SQL 执行计划解读 */
const sqlPlanRules: any = [
    { re: /Seq Scan|全表扫描|table scan/i, level: 'warn', tip: '全表扫描：确认过滤字段是否命中索引；小表可忽略。' },
    { re: /type:\s*ALL/i, level: 'warn', tip: 'type=ALL：MySQL 全表扫描，优先补索引。' },
    { re: /Using filesort|filesort/i, level: 'warn', tip: 'filesort：排序无法用索引，考虑给 ORDER BY 字段加索引。' },
    { re: /Using temporary|temporary table/i, level: 'warn', tip: '临时表：常见于 GROUP BY / DISTINCT / UNION，评估能否用索引消除。' },
    { re: /Nested Loop|嵌套循环/i, level: 'info', tip: '嵌套循环：小驱动表时正常；大表连接关注外层行数。' },
    { re: /Hash Join/i, level: 'info', tip: '哈希连接：大表等值连接常见且通常可接受。' },
    { re: /Sort\s+\(cost|Sort Method/i, level: 'info', tip: '显式排序：注意 work_mem / sort_buffer 是否触发磁盘排序。' },
    { re: /rows=\d{5,}|cost=[\d.]+\.\.[\d.]+e\+?0?[5-9]/i, level: 'warn', tip: '预估行数/代价很大：检查统计信息是否过期（ANALYZE）。' },
    { re: /rows=\d+\s+width=\d+/i, level: 'info', tip: '扫描行数：对比实际返回行数，差异大说明选择性差。' },
    { re: /index scan|Index Scan|Using index/i, level: 'ok', tip: '命中索引：留意是否回表（Using index condition 表示仍需回表）。' },
    { re: /Using index condition|Using where/i, level: 'info', tip: 'Using where 说明过滤在服务层完成；尽量让条件走索引。' },
    { re: /Bitmap Heap Scan/i, level: 'info', tip: '位图堆扫描：多条件组合时常见，回表次数需关注。' },
    { re: /SubPlan|Subquery|DEPENDENT SUBQUERY/i, level: 'warn', tip: '相关子查询：可能被逐行执行，考虑改写为 JOIN。' },
    { re: /Buffers:\s*shared hit=\d+\s+read=\d{4,}/i, level: 'warn', tip: '物理读很高：数据可能不在缓存，关注冷启动与索引覆盖。' },
];

function toolSqlExplainPane(props?: any): any {
    const value = props.value || {};
    const plan = String(value.input || '');
    const hits = plan
        ? sqlPlanRules.filter(function (rule?: any): any {
            return rule.re.test(plan);
        })
        : [];
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-split' }, h(Field, { label: '粘贴 EXPLAIN / 执行计划文本' }, h(Textarea, {
        value: value.input || '',
        style: toolMonoStyle(240),
        placeholder: 'EXPLAIN SELECT ... 的输出，或 PostgreSQL 的 EXPLAIN (ANALYZE, BUFFERS) 结果',
        onChange: function (event?: any): any {
            props.patch({ input: event.target.value });
        },
    })), h(Field, { label: '解读（按关键字匹配，不执行 SQL）' }, hits.length === 0
        ? h(toolOutputBlock, {
            text: '',
            placeholder: plan ? '没有识别到常见的性能信号（可能计划很健康，或格式不常见）' : '粘贴执行计划后这里给出提示',
        })
        : h('div', { className: 'wb-stack', style: { gap: 8 } }, hits.map(function (rule?: any, index?: any): any {
            const tone = rule.level === 'warn' ? 'warn' : rule.level === 'ok' ? 'ok' : 'idle';
            return h('div', {
                key: 'p' + index,
                style: {
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '8px 10px',
                    border: '1px solid ' + T.border1,
                    borderRadius: 10,
                    background: T.layer1,
                },
            }, h(Badge, { tone: tone }, rule.level === 'warn' ? '注意' : rule.level === 'ok' ? '良好' : '参考'), h('span', { style: { fontSize: 12, lineHeight: 1.65, color: T.text } }, rule.tip));
        })))), h('p', { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.7 } }, '这是**关键字规则**解读，不是数据库优化器：插件不连接任何数据库、不执行 SQL。' +
        '真正调优请结合表结构、数据分布与实际耗时。'));
}
export { sqlPlanRules, toolSqlExplainPane }
