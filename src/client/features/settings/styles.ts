export const SETTINGS_CSS=`
.wb-settings-page{min-width:0;container:settings / inline-size}
.wb-settings-flow{columns:390px;column-gap:16px;overflow-wrap:anywhere}
.wb-settings-flow>.wb-card{break-inside:avoid;margin:0 0 16px}
.wb-settings-flow>.wb-card>.wb-card-head{padding:18px 18px 12px;align-items:flex-start}.wb-settings-flow>.wb-card>.wb-card-body{padding:4px 18px 18px}
.wb-settings-flow .wb-card-sub,.wb-settings-flow .wb-item-sub{line-height:1.65}
.wb-settings-connector-list{max-height:var(--wb-connector-preview-height, none);overflow:auto;scrollbar-width:thin;outline-offset:-2px}
.wb-settings-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px}.wb-settings-controls>.wb-item{min-width:0;gap:12px}.wb-settings-controls>.wb-item>.wb-item-main{min-width:0}
.wb-settings-data-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.3fr);grid-template-areas:'sidebar import' 'maintenance maintenance';gap:14px;align-items:start}
.wb-settings-data-sidebar{grid-area:sidebar;display:flex;flex-direction:column;gap:14px;min-width:0}
.wb-settings-data-card{min-width:0;padding:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base)}
.wb-settings-data-card.is-export{grid-area:export}.wb-settings-data-card.is-backup{grid-area:backup}.wb-settings-data-card.is-import{grid-area:import}.wb-settings-data-card.is-maintenance{grid-area:maintenance}
.wb-settings-data-card>header{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px}.wb-settings-data-card>header>div{min-width:0}
.wb-settings-data-icon{display:flex;align-items:center;justify-content:center;flex:none;width:32px;height:32px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.wb-settings-data-card h4{margin:0;font-size:13px;font-weight:600;line-height:1.6}.wb-settings-data-card p{margin:3px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.65;overflow-wrap:anywhere}
.wb-settings-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.wb-settings-maintenance-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px;padding-block:10px}
.wb-settings-maintenance-row:first-child{padding-block-start:0}
.wb-settings-maintenance-row:last-child{padding-block-end:0}
.wb-settings-maintenance-row+.wb-settings-maintenance-row{border-top:1px solid var(--dsw-alias-border-l1)}
.wb-settings-maintenance-row>div{flex:1 1 220px;min-width:0}
.wb-settings-maintenance-row h5{margin:0;font-size:12px;font-weight:600;line-height:1.6}
.wb-settings-maintenance-row>.wb-btn{flex:none;min-width:96px;margin-inline-start:auto}
.wb-settings-backups{list-style:none;margin:12px 0 0;padding:0;max-height:220px;overflow:auto}.wb-settings-backups li{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--dsw-alias-border-l1)}.wb-settings-backups li>div{flex:1;min-width:0}.wb-settings-backups span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.wb-settings-backups small{font-size:10px;color:var(--dsw-alias-label-secondary)}
.wb-migration-import{gap:12px}.wb-migration-import .wb-label{display:flex;flex-direction:column;gap:6px;min-width:0}.wb-migration-import :is(textarea,input,select){width:100%;min-width:0;max-width:100%;box-sizing:border-box}.wb-migration-import textarea{resize:vertical;min-height:100px}
.wb-migration-file input{display:block;padding:7px;border:1px dashed var(--dsw-alias-border-l1);border-radius:8px;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;background:var(--dsw-alias-bg-layer-1)}
.wb-migration-file input::file-selector-button{border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:5px 8px;margin-right:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}
.wb-migration-controls{display:flex;align-items:flex-end;flex-wrap:wrap;gap:10px}.wb-migration-controls>.wb-label{flex:1 1 200px}.wb-migration-import>.wb-tiny{margin:0}.wb-migration-preview{padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);overflow-wrap:anywhere}
.wb-settings-data-tools{display:grid;gap:8px;margin-top:14px}
.wb-settings-data-tools>details{padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base)}
.wb-settings-data-tools summary{cursor:pointer;font-size:12px;font-weight:600}.wb-settings-data-tools .wb-card{margin-top:10px}
.wb-settings-version{text-align:right;font-size:11px;color:var(--dsw-alias-label-secondary)}
@container settings (min-width:796px){.wb-settings-flow>:is(.wb-settings-wide,.wb-settings-data){column-span:all;margin-top:16px}}
@container settings (max-width:780px){.wb-settings-controls{grid-template-columns:minmax(0,1fr)}}
@container settings (max-width:700px){.wb-settings-data-grid{grid-template-columns:minmax(0,1fr);grid-template-areas:'sidebar' 'import' 'maintenance'}}
@container settings (max-width:480px){.wb-settings-flow>.wb-card>.wb-card-head{padding:14px 14px 10px}.wb-settings-flow>.wb-card>.wb-card-body{padding:2px 14px 14px}.wb-settings-data-card{padding:14px}.wb-settings-controls>.wb-item{flex-wrap:wrap}.wb-settings-controls>.wb-item>.wb-item-main{flex:1 1 180px}}
`
