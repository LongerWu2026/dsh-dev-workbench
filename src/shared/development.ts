export const DEVELOPMENT_ISSUE_TYPES=[{id:'requirement',label:'需求'},{id:'user_story',label:'用户故事'},{id:'bug',label:'缺陷'}] as const
/** Linky business state and local execution state are intentionally independent. */
export const DEVELOPMENT_STAGES = [
    {id:'analysis',label:'需求分析'}, {id:'implementation',label:'开发修复'},
    {id:'test',label:'测试验证'}, {id:'review',label:'自动审查'},
    {id:'human',label:'人工审查'}, {id:'delivery',label:'结果回写'},
] as const
export type DevelopmentStage = typeof DEVELOPMENT_STAGES[number]['id']
export interface DevelopmentConfig {
    cliPath:string; profile:string; workspaceId:string; defaultWorkspaceId?:string; worktreeRoot:string;
    harnessCommand:string[]; model:string; adapterRoots:string[];
    checks:Record<string,string[][]>;
    adapterPermissionMode:'read-only'|'workspace-write';
    agentId:string;
}
export interface DevelopmentIssue {id:string;code:string;title:string;type:string;status:string;workspaceId:string;description:string}
export interface DevelopmentStep {stage:DevelopmentStage;status:'running'|'completed'|'failed'|'waiting';at:string;sessionId?:string;output?:string;exitCode?:number|null}
export interface DevelopmentTask {
    id:string;issue:DevelopmentIssue;profile:string;projectId:string;cwd:string;branch:string;workspaceMode?:'directory'|'worktree';
    sessionId:string;reviewSessionId?:string;status:string;stage:DevelopmentStage;
    createdAt:string;updatedAt:string;pauseReason?:string;steps:DevelopmentStep[];
    diff?:string;diffHash?:string;approvedHash?:string;reviewNote?:string;commentId?:string;
    agentName?:string;agentContext?:string;contextNote?:string;
    guidance?:string;
}
export function issueFromLinky(row:any,workspaceId:string):DevelopmentIssue {
    const display=(value:any)=>typeof value==='string'?value:String(value?.name||value?.label||value?.value||'')
    const description=typeof row?.description==='string'?row.description:row?.description?.full||row?.description?.text||row?.description?.excerpt||''
    return {id:String(row?.id||row?.issue_id||''),code:String(row?.code||row?.number||row?.gf_number||row?.id||''),
        title:String(row?.title||row?.name||''),type:display(row?.type||row?.issue_type),status:display(row?.status_label||row?.status),
        workspaceId:String(row?.workspace_id||row?.workspace?.id||workspaceId),description:String(description).slice(0,60000)}
}
export function checkedArgv(value:unknown):string[] {
    if(!Array.isArray(value)||!value.length||value.length>80||value.some(item=>typeof item!=='string'||!item||item.includes('\0')||item.length>4096))throw new Error('命令必须是非空的 JSON 参数数组')
    return value.slice()
}
