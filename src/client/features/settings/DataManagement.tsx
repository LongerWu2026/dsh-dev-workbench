import * as React from 'react'
import {Btn,Icon,Panel,WB} from '../../core/runtime.js'
import {MigrationImportPanel} from '../../components/MigrationImportPanel.js'

interface Backup {id:string;bytes:number}
function DataCard({title,hint,icon,className='',children}:{title:string;hint:string;icon:string;className?:string;children:React.ReactNode}){
 return <section className={'wb-settings-data-card '+className} aria-label={title+'卡片'}><header><span className="wb-settings-data-icon"><Icon name={icon} size={16}/></span><div><h4>{title}</h4><p>{hint}</p></div></header>{children}</section>
}

export function DataManagement({onExportJson,onReset}:{onExportJson:()=>void;onReset:()=>void}){
 const [backups,setBackups]=React.useState<Backup[]>([]),[busy,setBusy]=React.useState(false)
 React.useEffect(()=>{let alive=true;WB.actions.backups().then((result:any)=>{if(alive)setBackups(result.backups||[])}).catch(()=>{});return()=>{alive=false}},[])
 async function backup(){setBusy(true);try{const result=await WB.actions.backup();setBackups(result.backups||[]);WB.toast('已创建备份','ok')}catch(e){WB.toast(String((e as Error).message||e),'err')}finally{setBusy(false)}}
 async function exportMigration(){try{const pack=await WB.actions.exportMigration();await WB.util.copy(JSON.stringify(pack,null,2));WB.toast('迁移包已复制（含校验），粘贴到目标端即可导入','ok')}catch(e){WB.toast('导出失败：'+String((e as Error).message||e),'err')}}
 async function restore(id:string){if(!window.confirm('用这份备份覆盖当前数据？当前文件会先自动备份。'))return;try{await WB.actions.restoreBackup(id);WB.toast('已从备份恢复','ok');await WB.actions.reload()}catch(e){WB.toast('恢复失败：'+String((e as Error).message||e),'err')}}
 return <Panel className="wb-settings-data" title="数据管理" sub="导出、备份与迁移，统一管理本地工作台数据" icon="database">
  <div className="wb-settings-data-grid">
   <div className="wb-settings-data-sidebar">
   <DataCard title="导出数据" hint="保存快照，或复制迁移包到另一台设备。" icon="download" className="is-export"><div className="wb-settings-actions"><Btn size="sm" onClick={onExportJson}>导出 JSON</Btn><Btn size="sm" onClick={()=>void exportMigration()}>导出迁移包</Btn></div></DataCard>
   <DataCard title="备份与恢复" hint="每天首次写入自动备份，保留最近 5 份。" icon="save" className="is-backup"><div className="wb-settings-actions"><Btn size="sm" disabled={busy} onClick={()=>void backup()}>{busy?'备份中…':'立即备份'}</Btn><span className="wb-tiny wb-muted">{backups.length?backups.length+' 份可用备份':'暂无可用备份'}</span></div>{backups.length>0&&<ul className="wb-settings-backups">{backups.slice(0,5).map(item=><li key={item.id}><div><span className="wb-mono" title={item.id}>{item.id}</span><small>{WB.fmt.bytes(item.bytes)}</small></div><Btn size="sm" onClick={()=>void restore(item.id)}>恢复</Btn></li>)}</ul>}</DataCard>
   </div>
   <DataCard title="迁移导入" hint="粘贴 JSON 或选择文件，先预检再导入。" icon="upload" className="is-import"><MigrationImportPanel/></DataCard>
   <DataCard title="示例与重置" hint="体验示例布局，或按需清理工作台记录。" icon="settings" className="is-maintenance"><div className="wb-settings-maintenance"><div><p>添加标注为示例的待办与资讯。</p><Btn size="sm" onClick={()=>{void WB.actions.seedDemo().catch(()=>{})}}>载入示例数据</Btn></div><div><p>清空待办、执行记录、知识与资讯，保留设置。</p><Btn size="sm" kind="danger" onClick={onReset}>重置数据</Btn></div></div></DataCard>
  </div>
 </Panel>
}
