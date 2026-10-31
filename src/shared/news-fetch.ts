export function radarFetchOutcome(report: any): { status: 'ok' | 'empty' | 'partial' | 'error'; text: string; tone: 'ok' | 'info' | 'warn' | 'err' } {
    if (!report) return { status: 'error', text: '未收到资讯抓取结果，请重试', tone: 'err' };
    const feeds: any[] = Array.isArray(report.perFeed) ? report.perFeed : [];
    const succeeded = feeds.filter(row => ['ok', 'empty'].includes(row.status)).length;
    const failed = feeds.length - succeeded;
    const added = Math.max(0, Number(report.added) || 0);
    if (!succeeded && !added) return { status: 'error', text: '资讯获取失败：' + (feeds.find(row => row.note)?.note || report.note || '没有可用的资讯来源'), tone: 'err' };
    if (failed) return { status: 'partial', text: '获取资讯新增 ' + added + ' 条，' + failed + ' 个来源失败', tone: 'warn' };
    if (!added) return { status: 'empty', text: '抓取完成，暂无新增资讯', tone: 'info' };
    return { status: 'ok', text: '抓取完成，新增 ' + added + ' 条资讯', tone: 'ok' };
}

export function newsSearchError(error: any): string {
    if (['WEB_PROVIDER_UNAVAILABLE', 'WEB_PROVIDER_CONFIGURED_MISSING', 'WEB_PROVIDER_CONFIGURED_UNAVAILABLE'].includes(error?.code))
        return '宿主未配置可用的联网搜索服务。请在宿主设置中配置并授权搜索服务，或在工作台设置中添加 RSS 资讯源。';
    if (error?.code === 'WEB_PROVIDER_AMBIGUOUS') return '宿主有多个可用搜索服务，请在宿主设置中指定使用哪一个。';
    return String(error?.message || error || '联网搜索失败').slice(0, 160);
}
