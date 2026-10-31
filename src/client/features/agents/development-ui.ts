import {WB} from '../../core/runtime.js'
export const statusLabels:Record<string,string>={preparing:'准备中',ready:'待启动',running:'执行中',paused:'已暂停',waiting_review:'待人工审查',approved:'待回写',rejected:'已退回',delivered:'已回写',completed:'已结束',failed:'失败',interrupted:'已中断'}
export const tone=(status:string)=>status==='running'?'accent':['failed','rejected'].includes(status)?'err':['delivered','completed'].includes(status)?'ok':'warn'
export async function developmentCall(request:any){
    try{return await WB.rpc('workbench/development',{request})}
    catch(error:any){
        const message=String(error.message||error),missingRoute=/transport failure for \/api\/workbench\/development:\s*HTTP 404\b/i.test(message)
        if(missingRoute||(['detect','projectSetup','workItems','pinWorkspace'].includes(request.action)&&message==='任务标识无效'))throw new Error('当前宿主尚未加载研发接口'+(missingRoute?'（HTTP 404）':'的最新能力')+'。请在“插件”中关闭再启用“智能工作台”，然后重新连接；若仍失败，请完整退出并重新打开 Harness。仅刷新页面无法更新宿主接口。')
        throw error
    }
}
export const commandText=(argv:string[])=>argv.map(s=>/^[\w./:@=-]+$/.test(s)?s:JSON.stringify(s)).join(' ')
/** An argv editor, never a shell: quoted arguments are supported, operators are rejected. */
export function commandArgs(line:string):string[]{
    const result:string[]=[];let word='',quote='',started=false,escape=false
    for(const char of line.trim()){
        if(escape){word+=char;escape=false;continue}
        if(char==='\\'&&quote!=="'"){escape=true;started=true;continue}
        if(quote){if(char===quote)quote='';else word+=char;continue}
        if(char==='"'||char==="'"){quote=char;started=true;continue}
        if(/\s/.test(char)){if(started){result.push(word);word='';started=false}continue}
        if(/[|;&<>`]/.test(char))throw new Error('每行填写一个命令，不支持管道或 shell 运算符')
        word+=char;started=true
    }
    if(quote||escape)throw new Error('命令引号或转义未闭合')
    if(started)result.push(word)
    if(!result.length||result.some(s=>!s))throw new Error('请填写有效的测试命令')
    return result
}
export const developmentCSS=`
.wb-dev { --dev-border:var(--dsw-alias-border-l1); }
.wb-dev-header { display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px;flex-wrap:wrap; }
.wb-dev-header h1 { font-size:25px;letter-spacing:-.6px;margin:0 0 6px;font-weight:650; }
.wb-dev-header p,.wb-dev p { margin:0;line-height:1.7; }
.wb-dev-actions { display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
.wb-dev-overview { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;border:1px solid var(--dev-border);border-radius:12px;overflow:hidden;margin-bottom:20px;background:var(--dev-border); }
.wb-dev-stat { border:0;background:var(--dsw-alias-bg-layer-1);color:inherit;text-align:left;padding:16px 20px;font:inherit;cursor:pointer; }
.wb-dev-stat[aria-pressed=true] { background:var(--wb-selected-bg); }
.wb-dev-stat strong { display:block;font-size:25px;font-weight:600;margin-top:5px; }
.wb-dev-stat span { font-size:12px;color:var(--dsw-alias-label-secondary); }
.wb-dev-toolbar { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px; }
.wb-dev-toolbar>.wb-input { max-width:300px; }
.wb-dev-layout { display:grid;grid-template-columns:minmax(250px,.85fr) minmax(0,1.65fr);gap:20px;align-items:start; }
.wb-dev-list { display:flex;flex-direction:column;gap:8px;min-width:0; }
.wb-dev-task { width:100%;text-align:left;border:1px solid var(--dev-border);background:var(--dsw-alias-bg-layer-1);border-radius:10px;color:inherit;padding:16px;font:inherit;cursor:pointer; }
.wb-dev-task:hover { background:var(--dsw-alias-bg-layer-2); }
.wb-dev-task[aria-pressed=true] { border-color:var(--wb-accent);box-shadow:inset 3px 0 var(--wb-accent);background:var(--wb-selected-bg); }
.wb-dev-task h3 { font-size:14px;font-weight:550;line-height:1.6;margin:8px 0;overflow-wrap:anywhere; }
.wb-dev-meta { font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.6;overflow-wrap:anywhere; }
.wb-dev-card { border:1px solid var(--dev-border);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:22px;min-width:0; }
.wb-dev-card h2 { font-size:18px;line-height:1.5;margin:8px 0 16px;overflow-wrap:anywhere; }
.wb-dev-empty { padding:44px 24px;text-align:center;border:1px dashed var(--dev-border);border-radius:12px; }
.wb-dev-empty h2 { font-size:19px;margin:16px 0 8px; }
.wb-dev-empty .wb-dev-actions { justify-content:center;margin-top:20px; }
.wb-dev-empty ol { list-style:none;padding:0;display:flex;justify-content:center;gap:24px;margin:26px 0;color:var(--dsw-alias-label-secondary);font-size:12px;flex-wrap:wrap; }
.wb-dev-banner { display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;border:1px solid var(--dev-border);border-radius:10px;background:var(--dsw-alias-bg-layer-1);margin-bottom:18px;flex-wrap:wrap; }
.wb-dev-banner[data-kind=error] { border-color:var(--wb-danger); }
.wb-dev-banner strong { display:block;margin-bottom:4px; }
.wb-dev-banner p { font-size:12px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere; }
.wb-dev-timeline { display:grid;grid-template-columns:repeat(6,minmax(0,1fr));list-style:none;padding:0;margin:12px 0 22px;gap:4px; }
.wb-dev-timeline li { border-top:3px solid var(--dev-border);padding-top:8px;font-size:11px;color:var(--dsw-alias-label-secondary); }
.wb-dev-timeline li[data-state=done] { border-color:var(--wb-accent); }
.wb-dev-timeline li[data-state=current] { border-color:var(--wb-accent);color:var(--dsw-alias-label-primary);font-weight:650; }
.wb-dev-next { padding:16px;border-radius:9px;background:var(--wb-selected-bg);margin-bottom:16px; }
.wb-dev-next .wb-dev-actions { margin-top:12px; }
.wb-dev-detail-tabs { margin:20px 0 16px; }
.wb-dev-evidence { border-bottom:1px solid var(--dev-border);padding:12px 0; }
.wb-dev-evidence summary { cursor:pointer;font-size:13px;font-weight:550; }
.wb-dev pre { font-size:12px;line-height:1.7;background:var(--dsw-alias-bg-layer-2);padding:12px;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:380px;overflow:auto; }
.wb-dev .wb-modal { width:min(760px,calc(100vw - 32px)); }
.wb-dev-form { display:flex;flex-direction:column;gap:18px;padding-top:12px; }
.wb-dev-form .wb-field { margin:0; }
.wb-dev-form-grid { display:grid;grid-template-columns:1fr 1fr;gap:16px; }
.wb-dev-step-label { font-size:12px;color:var(--dsw-alias-label-secondary);margin-bottom:8px; }
.wb-dev-issue-list { max-height:280px;overflow:auto;display:flex;flex-direction:column;gap:6px; }
.wb-dev-issue { display:block;width:100%;padding:12px;text-align:left;font:inherit;color:inherit;background:transparent;border:1px solid var(--dev-border);border-radius:8px;cursor:pointer; }
.wb-dev-issue[aria-pressed=true] { border-color:var(--wb-accent);background:var(--wb-selected-bg); }
.wb-dev-issue strong { display:block;font-size:13px;line-height:1.5;margin-top:6px; }
.wb-dev-advanced { padding:14px 0;border-top:1px solid var(--dev-border); }
.wb-dev-advanced>summary { cursor:pointer;font-size:13px; }
.wb-dev button:focus-visible { outline:2px solid var(--wb-accent);outline-offset:2px; }
@container content (max-width:900px) { .wb-dev-layout { grid-template-columns:1fr; }.wb-dev-list { max-height:340px;overflow:auto; } }
@container content (max-width:540px) { .wb-dev-overview { grid-template-columns:repeat(2,minmax(0,1fr)); }.wb-dev-stat { padding:12px; }.wb-dev-card { padding:16px; }.wb-dev-timeline { grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 6px; }.wb-dev-form-grid { grid-template-columns:1fr; } }
`;
export const workItemsCSS=`
.wb-dev-records>summary{cursor:pointer;padding:14px 0;font-size:13px;color:var(--dsw-alias-label-secondary)}
.wb-workitems-layout{display:grid;grid-template-columns:clamp(240px,28%,310px) minmax(0,1fr);gap:16px;align-items:start}
.wb-workitems-list{display:flex;flex-direction:column;gap:6px;max-height:min(520px,60vh);overflow:auto;min-width:0;padding:2px}
.wb-workitems-list .wb-dev-task{flex:none;padding:10px 12px;border-radius:8px}
.wb-workitems-list .wb-dev-task .wb-dev-actions{gap:6px}
.wb-workitems-list .wb-dev-task h3{font-size:13px;line-height:1.5;margin:6px 0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.wb-workitems-list .wb-dev-task .wb-dev-meta{font-size:11px;line-height:1.5}
.wb-workitem-description{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8;font-size:13px;max-height:380px;overflow:auto}
.wb-space-list{display:flex;flex-direction:column;gap:8px;max-height:360px;overflow:auto;margin-top:12px}
@container content (max-width:740px){.wb-workitems-layout{grid-template-columns:1fr}.wb-workitems-list{max-height:min(280px,40vh)}}
`;
