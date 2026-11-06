import * as React from 'react'
import {Btn,Icon,Modal,Panel,WB} from '../../core/runtime.js'
import {downloadBytes} from '../../core/download.js'
import {MigrationImportPanel} from '../../components/MigrationImportPanel.js'
import {ArchiveBrowser} from '../operations/ArchiveBrowser.js'
import {BackgroundHistoryPanel} from '../operations/BackgroundHistoryPanel.js'

interface Backup {id:string;bytes:number}
function DataCard({title,hint,icon,className='',children}:{title:string;hint:string;icon:string;className?:string;children:React.ReactNode}){
 return <section className={'wb-settings-data-card '+className} aria-label={title+'卡片'}><header><span className="wb-settings-data-icon"><Icon name={icon} size={16}/></span><div><h4>{title}</h4><p>{hint}</p></div></header>{children}</section>
}

export function DataManagement({onExportJson,onReset}:{onExportJson:()=>void;onReset:()=>void}){
 const [backups,setBackups]=React.useState<Backup[]>([]),[busy,setBusy]=React.useState(false)
 const [exportingZip,setExportingZip]=React.useState(false)
 const [confirmDemoOpen,setConfirmDemoOpen]=React.useState(false)
 const [demoBusy,setDemoBusy]=React.useState(false)
 React.useEffect(()=>{let alive=true;WB.actions.backups().then((result:any)=>{if(alive)setBackups(result.backups||[])}).catch(()=>{});return()=>{alive=false}},[])
 async function backup(){setBusy(true);try{const result=await WB.actions.backup();setBackups(result.backups||[]);WB.toast('已创建备份','ok')}catch(e){WB.toast(String((e as Error).message||e),'err')}finally{setBusy(false)}}
 async function exportMigration(){try{const pack=await WB.actions.exportMigration();await WB.util.copy(JSON.stringify(pack,null,2));WB.toast('迁移包已复制（含校验），粘贴到目标端即可导入','ok')}catch(e){WB.toast('导出失败：'+String((e as Error).message||e),'err')}}
 async function exportZip(){
  setExportingZip(true)
  try{
   const {data}=await WB.actions.exportMigrationArchive()
   downloadBytes('workbench-migration-'+new Date().toISOString().slice(0,10)+'.zip',data,'application/zip')
   WB.toast('已导出 ZIP 迁移包','ok')
  }catch(e){WB.toast('导出失败：'+String((e as Error).message||e),'err')}
  finally{setExportingZip(false)}
 }
 async function restore(id:string){if(!window.confirm('用这份备份覆盖当前数据？当前文件会先自动备份。'))return;try{await WB.actions.restoreBackup(id);WB.toast('已从备份恢复','ok');await WB.actions.reload()}catch(e){WB.toast('恢复失败：'+String((e as Error).message||e),'err')}}
 async function loadDemo(){
  if(demoBusy)return
  setDemoBusy(true)
  setConfirmDemoOpen(false)
  try{await WB.actions.seedDemo()}catch{/* The action reports the error. */}finally{setDemoBusy(false)}
 }
 return <Panel className="wb-settings-data" title="数据管理" sub="导出、备份与迁移，统一管理本地工作台数据" icon="database">
  <div className="wb-settings-data-grid">
   <div className="wb-settings-data-sidebar">
   <DataCard title="导出数据" hint="ZIP 迁移包含已保存的附件。" icon="download" className="is-export"><div className="wb-settings-actions"><Btn size="sm" onClick={onExportJson}>导出 JSON</Btn><Btn size="sm" onClick={()=>void exportMigration()}>复制迁移 JSON</Btn><Btn size="sm" kind="primary" disabled={exportingZip} onClick={()=>void exportZip()}>{exportingZip?'导出中…':'导出迁移 ZIP'}</Btn></div></DataCard>
   <DataCard title="备份与恢复" hint="每天首次写入自动备份，保留最近 5 份。" icon="save" className="is-backup"><div className="wb-settings-actions"><Btn size="sm" disabled={busy} onClick={()=>void backup()}>{busy?'备份中…':'立即备份'}</Btn><span className="wb-tiny wb-muted">{backups.length?backups.length+' 份可用备份':'暂无可用备份'}</span></div>{backups.length>0&&<ul className="wb-settings-backups">{backups.slice(0,5).map(item=><li key={item.id}><div><span className="wb-mono" title={item.id}>{item.id}</span><small>{WB.fmt.bytes(item.bytes)}</small></div><Btn size="sm" onClick={()=>void restore(item.id)}>恢复</Btn></li>)}</ul>}</DataCard>
   </div>
   <DataCard title="迁移导入" hint="选择 ZIP 或 JSON 迁移文件，先预检再导入。" icon="upload" className="is-import"><MigrationImportPanel/></DataCard>
   <DataCard title="示例与重置" hint="体验示例布局，或按需清理工作台记录。" icon="settings" className="is-maintenance">
    <div className="wb-settings-maintenance">
     <div className="wb-settings-maintenance-row">
      <div>
       <h5>示例数据</h5>
       <p>写入示例待办、资讯等，并清空当前执行记录。</p>
      </div>
      <Btn size="sm" disabled={demoBusy} onClick={()=>setConfirmDemoOpen(true)}>{demoBusy?'正在载入…':'载入示例数据'}</Btn>
     </div>
     <div className="wb-settings-maintenance-row">
      <div>
       <h5>清空工作台记录</h5>
       <p>清空待办、执行记录、知识与资讯，保留设置。</p>
      </div>
      <Btn size="sm" kind="danger" onClick={onReset}>重置数据</Btn>
     </div>
    </div>
   </DataCard>
  </div>
  <div className="wb-settings-data-tools">
   <details><summary>管理记录归档</summary><ArchiveBrowser/></details>
   <BackgroundHistoryPanel/>
  </div>
  <Modal open={confirmDemoOpen} title="载入示例数据" onClose={()=>setConfirmDemoOpen(false)} footer={<>
   <Btn onClick={()=>setConfirmDemoOpen(false)}>取消</Btn>
   <Btn kind="danger" disabled={demoBusy} onClick={()=>void loadDemo()}>确认载入</Btn>
  </>}>
   <div className="wb-stack">
    <strong>此操作会清空当前工作台的所有执行记录，包括真实记录。</strong>
    <span>将写入示例待办、资讯、项目、知识书签、RSS 订阅和一条示例执行记录。</span>
   </div>
  </Modal>
 </Panel>
}
