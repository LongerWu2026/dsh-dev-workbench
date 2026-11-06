import * as React from 'react'
import {fileAsBase64} from '../core/download.js'
import {Btn,WB} from '../core/runtime.js'
interface Preview {incomingTotal:number;countsByColumn:Record<string,number>;conflictsByColumn:Record<string,number>;warnings?:string[];mappedProjects:Array<{id:string;name:string;from:string;to:string}>}
export function MigrationImportPanel():React.ReactElement {
 const [zip,setZip]=React.useState<File|null>(null)
 const [validated,setValidated]=React.useState(false)
 const [json,setJson]=React.useState('');const [mode,setMode]=React.useState<'merge'|'replace'>('merge');const [paths,setPaths]=React.useState<Record<string,string>>({});const [preview,setPreview]=React.useState<Preview|null>(null);const [error,setError]=React.useState('');const [busy,setBusy]=React.useState(false)
 async function send(dryRun:boolean){
  return zip
   ? WB.actions.importMigrationArchive(await fileAsBase64(zip),mode,dryRun,paths)
   : WB.actions.importMigration(JSON.parse(json),mode,dryRun,paths)
 }
 async function chooseFile(file:File){
  setZip(null);setJson('');setPreview(null);setPaths({});setError('');setValidated(false)
  const isZip=/\.zip$/i.test(file.name)
  if(file.size>(isZip?96:10)*1024*1024){setError(isZip?'ZIP 超过 96 MB':'JSON 超过 10 MB');return}
  if(isZip){setZip(file);return}
  setBusy(true)
  try{setJson(await file.text())}catch{setError('读取文件失败')}finally{setBusy(false)}
 }
 async function inspect():Promise<void>{setValidated(false);setBusy(true);setError('');try{setPreview(await send(true));setValidated(true)}catch(e){setError(e instanceof Error?e.message:String(e));setPreview(null)}finally{setBusy(false)}}
 async function apply():Promise<void>{if(!preview||!validated)return;if(mode==='replace'&&!window.confirm('替换当前业务数据？提交前会先备份，原生会话和凭据不变。'))return;setBusy(true);setError('');try{const result=await send(false);await WB.actions.reload();WB.toast('导入完成：'+result.applied+' 条','ok');setPreview(null)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 return <section className="wb-stack wb-migration-import" aria-label="迁移导入"><label className="wb-label">迁移包 JSON<textarea className="wb-textarea" rows={4} value={json} placeholder="在这里粘贴导出的迁移包 JSON" disabled={busy} onChange={e=>{setZip(null);setJson(e.target.value);setPreview(null);setPaths({});setValidated(false)}}/></label>
 <label className="wb-label wb-migration-file">或选择迁移文件<input type="file" accept=".zip,application/zip,application/json,.json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void chooseFile(file)}}/></label>
 {zip&&<span className="wb-tiny">已选择 {zip.name}</span>}
 <div className="wb-migration-controls"><label className="wb-label">导入方式 <select className="wb-select" value={mode} onChange={e=>{setMode(e.target.value as 'merge'|'replace');setPreview(null)}}><option value="merge">合并：同 ID 保留当前数据</option><option value="replace">替换包内业务集合</option></select></label><div className="wb-settings-actions"><Btn size="sm" disabled={busy||!zip&&!json.trim()} onClick={inspect}>{busy?'处理中…':'预检迁移包'}</Btn><Btn size="sm" kind="primary" disabled={busy||!preview||!validated} onClick={apply}>执行导入</Btn></div></div>
 {error&&<p role="alert">{error}</p>}
 {preview&&<div className="wb-stack wb-migration-preview"><strong>{validated?'预检通过':'目录已修改，请重新预检'} · {preview.incomingTotal} 条 · 尚未写入</strong><div>{Object.entries(preview.countsByColumn).map(([key,count])=><span key={key} style={{display:'inline-block',marginRight:12}}>{key}：{count}（同 ID {preview.conflictsByColumn[key]||0}）</span>)}</div>{preview.warnings?.map(w=><p key={w}>{w}</p>)}{preview.mappedProjects.filter(p=>p.from).map(project=><label className="wb-label" key={project.id}>{project.name} · {project.from}<input className="wb-input" aria-label={'目标目录 '+project.name} disabled={busy} value={paths[project.from]??project.to} onChange={e=>{setPaths({...paths,[project.from]:e.target.value});setValidated(false)}}/></label>)}</div>}
 <p className="wb-tiny wb-muted">修改目录映射后重新预检。ZIP 可恢复随包保存的附件。</p></section>
}
