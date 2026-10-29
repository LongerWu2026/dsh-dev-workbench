import { isIgnoredNews, isUnreadableNewsError } from '../../shared/news.js'
import { ensureBackgroundSession, hostService } from '../assistant/sessions.js'
import { loadWorkbenchState, mutateWorkbenchState } from '../storage/state-store.js'
import { auditEntry, ensureArray, normalizeRadarItem } from '../domain/model.js'
import { waitStructuredReply, modelGate, resetModelHealth, recordModelFailure, isModelServiceFailure } from '../analysis/message-analysis.js'
import { hostNowIso, runtimeCheckpoint, isRuntimeInterrupted } from '../platform/runtime.js'
/* ============================================================================
 * dev-workbench host — 资讯四段摘要批处理（TODO 20）
 *
 * 流程与 15 的分析批处理一致（复用 19 的执行纪律）：
 *   挑四段为空的资讯 → web.fetch 读原文（每条独立容错）→ 严格 JSON 提示 →
 *   原生会话 → 解析/校验 → writeRadarSummary（不改动来源/发布时间）→
 *   lastRadarSummarize 如实记录 done/failed。
 *
 * 纪律：
 *   - 单条失败不影响其余批次（partial 如实）；
 *   - 长原文保留开头和结尾，避免遗漏末尾的可用时间、地区和限制；
 *   - 每条独立 muted failure 保留原因。
 * ========================================================================== */
const SUMMARY_TURN_TIMEOUT_MS = 120000;
function availabilityExcerpts(text: string): string[] {
    const matches = [...text.matchAll(/planned to be available|available within|availability|public preview|limited preview|early access|计划.{0,20}(?:可用|提供)|仅.{0,20}(?:地区|开放|提供)/ig)];
    return matches.slice(-6).map(match => text.slice(Math.max(0, match.index! - 150), match.index! + 500));
}
function radarNeedsSummary(item?: any): any {
    if(isIgnoredNews(item))return false;
    const summary = item.summary || {};
    return ['change', 'usage', 'risk', 'practice'].some(function (key?: any): any { return !summary[key]; });
}
/** 读取原文文本：剥掉标签，压空白；失败/长度不足都如实报告。 */
function stripHtmlToText(html?: any): any {
    const raw = String(html || '');
    const main = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(raw) || /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(raw);
    const clean = (input: string) => input
        .replace(/<(?:nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/(?:nav|header|footer|aside)>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
    const selected = clean(main ? main[1] : raw);
    const notes = main ? availabilityExcerpts(clean(raw)).filter(note => !selected.includes(note)) : [];
    return selected + (notes.length ? '\n页面可用性注释：\n' + notes.join('\n') : '');
}
function summaryPrompt(item?: any, articleText?: any): any {
    const lines: any = [];
    lines.push('请阅读下面这篇资讯原文，输出一个 JSON 对象，不要输出其它文字。');
    lines.push('');
    lines.push('标题：' + (item.title || ''));
    lines.push('发布时间：' + (item.publishedAt ? item.publishedAt : '原文未注明'));
    lines.push('');
    lines.push('原文（节选）：');
    const text = String(articleText || '');
    lines.push(text.length <= 12000 ? text : text.slice(0, 9000) + '\n[中间内容省略]\n' + text.slice(-3000));
    if (text.length > 12000) lines.push('原文可用性段落：\n' + availabilityExcerpts(text).join('\n'));
    lines.push('');
    lines.push('输出 JSON：');
    lines.push('{');
    lines.push('  "change": "技术变化：这次变化的关键事实",');
    lines.push('  "usage": "应用场景：适合用在哪里",');
    lines.push('  "risk": "采用风险：可能踩的坑",');
    lines.push('  "practice": "推荐实践：怎么落地"');
    lines.push('}');
    lines.push('规则：结论必须来自原文；原文没讲就不写，宁缺毋滥。');
    lines.push('区分公告、预览、已可用和计划可用。原文明确的发布时间、可用时间、地区、权限、费用等采用限制必须保留；这些属于 risk，不得把末尾注释中的限制省略后宣称已全面可用。');
    return lines.join('\n');
}
/**
 * 批量生成四段摘要。单条失败聚合到 partial；最多处理 limit 条。
 */
let radarSummaryInFlight: any = null;
function runRadarSummarizeBatch(ctx?: any, request?: any): any {
    if (radarSummaryInFlight)
        return radarSummaryInFlight;
    radarSummaryInFlight = executeRadarSummary(ctx, request).finally(function (): any { radarSummaryInFlight = null; });
    return radarSummaryInFlight;
}
async function executeRadarSummary(ctx?: any, request?: any): Promise<any> {
    if(request?.retryModel===true)await resetModelHealth('summary');
    const gate=modelGate(loadWorkbenchState(),'summary');if(gate)return {...gate,done:0,failed:0};
    const controller = hostService(ctx, 'sessionController');
    if (!controller || typeof controller.prompt !== 'function') {
        return { status: 'unavailable', note: '宿主没有 sessionController 服务，无法生成摘要。' };
    }
    const settings = loadWorkbenchState().settings;
    if (!settings.aiExtract || settings.aiExtract.enabled !== true) {
        return { status: 'disabled', note: 'AI 识别未开启（设置 → 自动化 → AI 识别）。' };
    }
    const web = ctx && ctx.get ? ctx.get('web') : null;
    if (!web || typeof web.fetch !== 'function') {
        return { status: 'unavailable', note: '当前 profile 没有 web 抓取服务，无法读取原文。' };
    }
    const input = request && typeof request === 'object' ? request : {};
    const limit = Math.max(1, Math.min(10, Number(input.limit) || 3));
    const state0 = loadWorkbenchState();
    const onlyIds = ensureArray(input.onlyIds).map(function (id?: any): any { return String(id); });
    const all = ensureArray(state0.radar).filter(function (item?: any): any {
        return item.url && radarNeedsSummary(item) && (Number(item.summaryAttempts) < 3 || input.retryFailed === true) && (!item.summaryRetryAt || input.retryFailed === true || new Date(item.summaryRetryAt).getTime() <= Date.now());
    });
    const candidates = (onlyIds.length > 0
        ? all.filter(function (item?: any): any { return onlyIds.indexOf(item.id) >= 0; })
        : all).slice(0, limit);
    if (candidates.length === 0) {
        return { status: 'ok', done: 0, failed: 0, note: '没有待摘要的资讯（都有四段摘要或没有 url）。' };
    }
    let resolved:any;
    try{resolved=await ensureBackgroundSession(ctx,'summary')}
    catch(error){if(error?.code==='WORKBENCH_BACKGROUND_BUSY')return {status:'busy',done:0,failed:0,note:error.message};if(isModelServiceFailure(error))return {...await recordModelFailure('summary',error),done:0,failed:0};throw error}
    if (!resolved)
        return { status: 'unavailable', note: '当前宿主没有可用的 sessions / sessionController 服务。' };
    let done = 0;
    let failed = 0;
    const perItem: any = [];
    let interrupted=false;
    let deferred:any=null;
    for (const item of candidates) {
        const generation=runtimeCheckpoint();
        let phase='fetch',sourceError=false;
        try {
            const fetched = await web.fetch({ url: item.url }, AbortSignal.timeout(15000));
            if (fetched && Number(fetched.statusCode) >= 400){sourceError=true;throw new Error('原文读取失败：HTTP ' + fetched.statusCode);}
            const bodyText = fetched && fetched.body && typeof fetched.body.content === 'string'
                ? stripHtmlToText(fetched.body.content)
                : '';
            if (bodyText.length < 40) {
                sourceError=true;throw new Error('原文内容不足（可能被反爬或需要登录）');
            }
            phase='model';
            const parsed = await waitStructuredReply(ctx, controller, resolved, summaryPrompt(item, bodyText), SUMMARY_TURN_TIMEOUT_MS, 'summary');
            await resetModelHealth('summary');
            for (const key of ['change', 'usage', 'risk', 'practice']) {
                if (parsed[key] !== undefined && typeof parsed[key] !== 'string')
                    throw new Error('摘要字段必须是文本');
                if (!parsed[key])
                    parsed[key] = '原文未说明';
            }
            const wrote = await mutateWorkbenchState(function (current?: any): any {
                const target = ensureArray(current.radar).find(function (row?: any): any {
                    return row.id === item.id;
                });
                if (!target)
                    throw new Error('资讯已被删除：' + item.id);
                const index = current.radar.indexOf(target);
                const next = normalizeRadarItem({ summary: Object.assign({}, parsed, Object.fromEntries(Object.entries(target.summary || {}).filter(function (pair?: any): any { return !!pair[1]; }))), summaryStatus: 'done', availability:'active', sourceFailures:0, summaryError: null, summaryRetryAt: null }, target);
                next.id = target.id;
                next.createdAt = target.createdAt;
                next.updatedAt = hostNowIso();
                current.radar = current.radar.slice();
                current.radar[index] = next;
                auditEntry(current, 'radar.summarized', target.title);
                return current;
            });
            done += 1;
            perItem.push({ id: item.id, ok: true, sourceChars:bodyText.length, sourceTruncated:fetched.truncated === true });
            void wrote;
        }
        catch (error) {
            if (isRuntimeInterrupted(error) || runtimeCheckpoint()!==generation) {
                interrupted=true;
                await mutateWorkbenchState((current:any)=>{const target=current.radar.find((row:any)=>row.id===item.id);if(target)Object.assign(target,{summaryStatus:'pending',summaryError:'运行恢复后等待重试，不计入失败次数',summaryRetryAt:new Date(Date.now()+30000).toISOString()});return current});
                break;
            }
            if(phase==='model' && isModelServiceFailure(error) || phase==='fetch' && !sourceError && isModelServiceFailure(error) && !isUnreadableNewsError(error)){deferred=await recordModelFailure('summary',error);break;}
            failed += 1;
            await mutateWorkbenchState(function (current?: any): any {
                const target = current.radar.find(function (row?: any): any { return row.id === item.id; });
                if (target) {
                    if(phase==='fetch'){target.sourceFailures=(target.sourceFailures||0)+1;if(/HTTP (404|410)/.test(String(error)) || target.sourceFailures>=2 || target.summaryAttempts>=1 && isUnreadableNewsError(error))target.availability='ignored';}
                    target.summaryStatus = target.availability==='ignored'?'ignored':'failed';
                    target.summaryAttempts = (Number(target.summaryAttempts) || 0) + 1;
                    target.summaryError = String(error.message || error).slice(0, 200);
                    target.summaryRetryAt = target.availability==='ignored'?null:new Date(Date.now() + Math.pow(2, target.summaryAttempts) * 60000).toISOString();
                }
                return current;
            });
            perItem.push({ id: item.id, ok: false, note: String((error && error.message) || error).slice(0, 160) });
        }
    }
    await mutateWorkbenchState(function (current?: any): any {
        current.lastRadarSummarize = {
            at: hostNowIso(),
            done: done,
            failed: failed,
            interrupted,
            note: deferred?.note || (interrupted ? '运行恢复后等待重试，不计入失败次数' : failed > 0 ? perItem.filter(function (row?: any): any { return !row.ok; }).map(function (row?: any): any { return row.note; }).slice(0, 3).join('；') : null),
        };
        auditEntry(current, 'radar.summarize', '摘要生成：成功 ' + done + ' / 失败 ' + failed);
        return current;
    });
    return deferred ? {...deferred,done,failed} : {
        status: interrupted ? 'interrupted' : failed > 0 ? 'partial' : 'ok',
        done: done,
        failed: failed,
        note: failed > 0 ? '失败条目见 lastRadarSummarize' : null,
    };
}

export { SUMMARY_TURN_TIMEOUT_MS, radarNeedsSummary, stripHtmlToText, summaryPrompt, radarSummaryInFlight, runRadarSummarizeBatch, executeRadarSummary }
