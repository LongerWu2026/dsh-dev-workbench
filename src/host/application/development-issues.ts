import {createHash} from 'node:crypto'
import {existsSync,readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {linkyIssue,linkyRead} from '../integrations/linky.js'
import {developmentDir,readDevelopmentTask,saveDevelopmentTask,writeDevelopmentFile} from '../storage/development-store.js'
import {workbenchGenerationGuard} from '../storage/state-store.js'
import type {DevelopmentTask,DevelopmentIssue} from '../../shared/development.js'

type Patch={title?:string;description?:string;status?:string}
export type DevelopmentIssueUpdateResult={before:DevelopmentIssue;after:DevelopmentIssue;task:DevelopmentTask;changed:boolean;recovered:boolean}
type WriteRecord={state:'pending'|'completed';issueId:string;workspaceId:string;profile:string;expected:Partial<DevelopmentIssue>;at:string;confirmedAt?:string}
const flights=new Set<string>()
const identity=(task:DevelopmentTask)=>JSON.stringify([task.profile,task.issue.workspaceId,task.issue.id])
const recordPath=(task:DevelopmentTask)=>join(developmentDir(),'issue-writes',createHash('sha256').update(identity(task)).digest('hex')+'.json')
function current(id:string){const task=readDevelopmentTask(id);if(!task.issue?.id||!task.issue.workspaceId||!task.profile)throw Error('研发事项缺少已绑定的 Linky 身份、工作空间或工作项');return task}
function checkedPatch(value:any):Patch{
 if(!value||typeof value!=='object'||Array.isArray(value)||!Object.keys(value).length||Object.keys(value).some(key=>!['title','description','status'].includes(key)))throw Error('只能修改 Linky 工作项的标题、描述和业务状态')
 const patch:Patch=Object.fromEntries(Object.entries(value).filter(([,entry])=>entry!==undefined));if(!Object.keys(patch).length)throw Error('请提供需要修改的字段')
 if(patch.title!==undefined&&(typeof patch.title!=='string'||!patch.title.trim()||patch.title.length>200))throw Error('标题须为 1–200 字符')
 if(patch.description!==undefined&&(typeof patch.description!=='string'||patch.description.length>60000))throw Error('描述须为不超过 60000 字符的文本，可用空字符串清除')
 if(patch.status!==undefined&&(typeof patch.status!=='string'||!patch.status.trim()||patch.status.length>120))throw Error('请指定 Linky 的真实状态名称或状态键')
 if(patch.status!==undefined&&Object.keys(patch).length!==1)throw Error('状态流转与内容修改请分两次提交，避免部分字段成功后重复流转')
 if(patch.title!==undefined)patch.title=patch.title.trim()
 if(patch.status!==undefined)patch.status=patch.status.trim()
 return patch
}
function matches(issue:DevelopmentIssue,expected:Partial<DevelopmentIssue>){return Object.entries(expected).every(([key,value])=>(issue as any)[key]===value)}
function checkedIssue(task:DevelopmentTask,issue:DevelopmentIssue){if(issue.id!==task.issue.id||issue.workspaceId!==task.issue.workspaceId)throw Error('Linky 回读工作项与当前会话绑定不一致');return issue}
async function readIssue(task:DevelopmentTask){return checkedIssue(task,await linkyIssue(task.issue.id,task.issue.workspaceId,task.profile))}
function cacheIssue(task:DevelopmentTask,issue:DevelopmentIssue,guard:()=>void){
 guard();const latest=current(task.id)
 if(identity(latest)!==identity(task))throw Error('研发事项绑定已变化，请在当前事项重新查询')
 if(['running','preparing'].includes(latest.status))throw Error('研发执行仍在运行，待暂停后再同步工作项')
 if(JSON.stringify(latest.issue)===JSON.stringify(issue))return latest
 latest.issue=issue;return saveDevelopmentTask(latest)
}
function pending(task:DevelopmentTask):WriteRecord|undefined{
 const path=recordPath(task);if(!existsSync(path))return
 const value=JSON.parse(readFileSync(path,'utf8')) as WriteRecord
 if(value.profile!==task.profile||value.issueId!==task.issue.id||value.workspaceId!==task.issue.workspaceId)throw Error('工作项修改记录与当前绑定不一致')
 return value.state==='pending'?value:undefined
}
function complete(task:DevelopmentTask,record:WriteRecord){writeDevelopmentFile(recordPath(task),{...record,state:'completed',confirmedAt:new Date().toISOString()})}
function reconcile(task:DevelopmentTask,issue:DevelopmentIssue,guard:()=>void){
 const record=pending(task);if(!record)return false
 if(!matches(issue,record.expected))throw Error('上次 Linky 修改结果仍待核实，当前回读与目标不一致；未重复提交，请核对 Linky 操作历史')
 cacheIssue(task,issue,guard);complete(task,record);return true
}
function fieldInput(value:any,fields:any[]){
 if(value===undefined)return undefined
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>30||JSON.stringify(value).length>16000)throw Error('流转字段必须是不超过 30 项的 JSON 对象')
 const result:any=Object.create(null)
 for(const [key,entry] of Object.entries(value)){
  const field=fields.find(item=>item.column_key===key||item.name===key)
  if(!field||field.supported===false)throw Error('流转不支持字段「'+key+'」，请先查询可用流转')
  if(!(entry===null||['string','number','boolean'].includes(typeof entry)||Array.isArray(entry)&&entry.every(item=>['string','number','boolean'].includes(typeof item))))throw Error('流转字段值只能为文本、数字、布尔、数组或 null')
  if(Object.hasOwn(result,field.column_key))throw Error('同一流转字段不能重复指定')
  result[field.column_key]=entry
 }
 return result
}
async function transitions(task:DevelopmentTask){
 const plan=await linkyRead(['issue','move',task.issue.id],task.issue.workspaceId,task.profile)
 if(plan?.issue?.id!==task.issue.id||plan.issue.workspace_id!==task.issue.workspaceId||!Array.isArray(plan.targets)||typeof plan.current?.key!=='string')throw Error('Linky 可用流转结构不兼容或对象不匹配')
 return plan
}
/** Reads the bound work item; exposes platform decisions instead of inventing status mappings. */
export async function developmentIssueDetail(id:string){
 const task=current(id),guard=workbenchGenerationGuard(),issue=await readIssue(task),plan=await transitions(task)
 guard();let reconciliation='none'
 const record=pending(task);if(record){if(matches(issue,record.expected)){reconcile(task,issue,guard);reconciliation='confirmed'}else reconciliation='pending'}
 if(!['running','preparing'].includes(current(id).status))cacheIssue(task,issue,guard)
 return {issue,execution:{status:task.status,stage:task.stage,pauseReason:task.pauseReason||''},current:plan.current,targets:plan.targets,reconciliation}
}
export type DevelopmentIssueDetailResult=Awaited<ReturnType<typeof developmentIssueDetail>>

/** Never rewrites execution steps, test evidence, approvals or repository files. */
export async function updateDevelopmentIssue(id:string,input:any,options:{fields?:any;comment?:string;assertIdle?:()=>void}={}):Promise<DevelopmentIssueUpdateResult>{
 const patch=checkedPatch(input),task=current(id),key=identity(task),guard=workbenchGenerationGuard()
 const assertIdle=()=>{guard();options.assertIdle?.();const latest=current(id);if(identity(latest)!==key)throw Error('研发事项绑定已变化');if(['running','preparing'].includes(latest.status))throw Error('请先暂停研发执行，再修改 Linky 工作项')}
 assertIdle();if(flights.has(key))throw Error('此工作项正在修改或回读，请等待结果后再操作')
 if(options.comment!==undefined&&(typeof options.comment!=='string'||options.comment.length>16000))throw Error('流转评论须为不超过 16000 字符的文本')
 if(patch.status===undefined&&(options.fields!==undefined||options.comment!==undefined))throw Error('流转字段和评论仅用于状态修改')
 flights.add(key);let temporary:string|undefined
 try{
  const before=await readIssue(task);assertIdle()
  const recovered=reconcile(task,before,guard)
  let expected:Partial<DevelopmentIssue>={},args:string[]=[]
  if(patch.status!==undefined){
   const plan=await transitions(task),targets=plan.targets.filter((item:any)=>item.key===patch.status||item.name===patch.status)
   if(patch.status===plan.current.key||patch.status===plan.current.name)return {before,after:before,task:cacheIssue(task,before,guard),changed:false,recovered}
   if(targets.length!==1)throw Error('无法唯一确定状态「'+patch.status+'」。请先查询可用流转，指定真实状态名称或键：'+plan.targets.filter((t:any)=>t.allowed).map((t:any)=>t.name).join('、'))
   const target=targets[0];if(target.allowed!==true)throw Error('Linky 不允许流转到「'+target.name+'」：'+String(target.reason||'请检查权限、前置条件和流程要求'))
   const fields=fieldInput(options.fields,target.form?.fields||[])
   const empty=(value:any)=>value==null||typeof value==='string'&&!value.trim()||Array.isArray(value)&&!value.length
   const missing=(target.form?.fields||[]).filter((field:any)=>field.required&&empty(Object.hasOwn(fields||{},field.column_key)?fields[field.column_key]:field.default))
   if(missing.length)throw Error('请补充流转必填字段：'+missing.map((field:any)=>field.name||field.column_key).join('、'))
   if(target.form?.comment_mode==='required'&&!String(options.comment??target.form.comment_value??'').trim())throw Error('此状态流转需要填写评论，请明确提供评论内容')
   args=['issue','move',task.issue.id,target.key]
   if(options.comment!==undefined)args.push('--comment',options.comment)
   if(fields){temporary=mkdtempSync(join(tmpdir(),'harness-linky-fields-'));const file=join(temporary,'fields.json');writeFileSync(file,JSON.stringify(fields),{mode:0o600});args.push('--fields-file',file)}
   expected={statusKey:target.key}
  }else{
   expected={...patch};args=['issue','update',task.issue.id]
   if(patch.title!==undefined)args.push('--title',patch.title)
   if(patch.description!==undefined)args.push('--description',patch.description)
   if(matches(before,expected))return {before,after:before,task:cacheIssue(task,before,guard),changed:false,recovered}
  }
  assertIdle()
  const record:WriteRecord={state:'pending',issueId:task.issue.id,workspaceId:task.issue.workspaceId,profile:task.profile,expected,at:new Date().toISOString()}
  writeDevelopmentFile(recordPath(task),record)
  let writeError=false;try{await linkyRead(args,task.issue.workspaceId,task.profile)}catch{writeError=true}
  let after:DevelopmentIssue
  try{after=await readIssue(task)}catch{throw Error('Linky 修改已提交但回读失败，结果待核实；未标记成功，请先查询工作项，勿重复提交')}
  if(!matches(after,expected))throw Error(writeError?'Linky 未确认修改，当前回读与目标不一致；请核对权限、流转必填字段和操作历史，未自动重试':'Linky 返回成功但回读与目标不一致，结果待核实，未标记成功')
  assertIdle();const saved=cacheIssue(task,after,guard);complete(task,record)
  return {before,after,task:saved,changed:true,recovered:writeError}
 }finally{if(temporary)rmSync(temporary,{recursive:true,force:true});flights.delete(key)}
}
