import * as React from 'react'
import {WB,Btn,Icon,IconBtn,Input,Panel,Segmented,Spinner,useStore} from '../../core/runtime.js'
import {openProjectFile,closeProjectFile,projectFilePreviewActive} from './ProjectFilePreview.js'
import {projectHandoff} from '../../../shared/project-review.js'

type Entry={name:string;path:string;kind:string;status?:string;previousPath?:string;deleted?:boolean}
export function ProjectFiles({projectId,refreshVersion=0}:{projectId:string;refreshVersion?:number}){
    const remembered=WB.store.get().collabFileViews?.[projectId]||{}
    const [mode,setMode]=React.useState(remembered.mode||'list'),[directory,setDirectory]=React.useState(remembered.directory||'')
    const [query,setQuery]=React.useState(remembered.query||''),[filter,setFilter]=React.useState(query),[offset,setOffset]=React.useState(0)
    const [snapshot,setSnapshot]=React.useState<any>(null),[loading,setLoading]=React.useState(false),[error,setError]=React.useState(''),[version,setVersion]=React.useState(0)
    const [copying,setCopying]=React.useState(false)
    const state=useStore(),preview=projectFilePreviewActive(state)?state.projectFilePreview:null
    const opening=preview?.status==='loading'?preview.path:''
    const listVersion=React.useRef(0)
    const rpc=(request:any)=>WB.rpc('workbench/projectFiles',{request:{projectId,...request}})
    React.useEffect(()=>{const timer=setTimeout(()=>{setFilter(query);setOffset(0)},180);return()=>clearTimeout(timer)},[query])
    React.useEffect(()=>{WB.store.set((state:any)=>({collabFileViews:{...state.collabFileViews,[projectId]:{mode,directory,query}}}))},[projectId,mode,directory,query])
    React.useEffect(()=>{
        const current=++listVersion.current
        setSnapshot(null);setError('');setLoading(true)
        Promise.resolve().then(()=>rpc({action:mode,path:mode==='list'?directory:'',query:filter,offset})).then(value=>{
            if(current!==listVersion.current)return
            if(!Array.isArray(value?.entries))throw Error('当前宿主尚未加载项目文件接口，请重新加载插件')
            setSnapshot(value)
        }).catch(failure=>{if(current===listVersion.current)setError(failure.message||String(failure))}).finally(()=>{if(current===listVersion.current)setLoading(false)})
        return()=>{listVersion.current++}
    },[projectId,mode,directory,filter,offset,refreshVersion,version])
    function navigate(path:string){closeProjectFile(false);setDirectory(path);setOffset(0);setQuery('');setFilter('')}
    async function open(entry:Entry){
        if(entry.deleted)return
        const result=await openProjectFile(projectId,entry.path)
        if(result?.directory!==undefined)navigate(result.directory)
    }
    async function copyHandoff(){
        if(copying)return
        setCopying(true)
        try{
            const result=await rpc({action:'handoff'})
            if(WB.store.get().page!=='collab'||WB.store.get().collabProjectId!==projectId)return
            if(!Array.isArray(result?.entries))throw Error('当前宿主尚未加载交接摘要接口，请重新加载插件')
            await WB.util.copy(projectHandoff(result));WB.toast('已复制交接摘要，请补充改动目的与实际验证结果','ok')
        }catch(failure:any){WB.toast(failure.message||String(failure),'err')}
        finally{setCopying(false)}
    }
    const entries:Entry[]=snapshot?.entries||[]
    const crumbs=directory.split('/').filter(Boolean)
    return <div className="wb-collab-files">
        <Panel title="项目文件" icon="folder" sub="浏览文件、审阅未提交差异，整理研发交接。" actions={<><Btn size="sm" icon="copy" disabled={copying} onClick={()=>void copyHandoff()}>{copying?'整理中…':'复制交接摘要'}</Btn><Btn size="sm" icon="refresh" disabled={loading} onClick={()=>setVersion(value=>value+1)}>刷新文件</Btn></>}>
            <div className="wb-collab-file-layout">
                <section className="wb-collab-file-browser" aria-label="项目文件列表">
                    <div className="wb-collab-file-tools"><Segmented value={mode} onChange={(value:string)=>{closeProjectFile(false);setMode(value);setOffset(0);setQuery('');setFilter('')}} items={[{value:'list',label:'全部文件'},{value:'changes',label:'未提交改动'}]}/><Input aria-label="筛选项目文件" placeholder={mode==='changes'?'按文件路径筛选':'筛选当前目录'} value={query} onChange={(event:any)=>setQuery(event.target.value)}/></div>
                    {mode==='list'&&<nav className="wb-collab-breadcrumb" aria-label="项目目录"><button type="button" onClick={()=>navigate('')}>项目根目录</button>{crumbs.map((part:string,index:number)=><React.Fragment key={index}><span>/</span><button type="button" onClick={()=>navigate(crumbs.slice(0,index+1).join('/'))}>{part}</button></React.Fragment>)}{directory&&<Btn size="sm" onClick={()=>navigate(crumbs.slice(0,-1).join('/'))}>上一级</Btn>}</nav>}
                    {loading&&<p className="wb-collab-file-status" role="status"><Spinner/>正在读取{mode==='changes'?'改动':'目录'}…</p>}
                    {error&&<div role="alert" className="wb-collab-file-status"><p>{error}</p><Btn size="sm" onClick={()=>setVersion(value=>value+1)}>重试读取文件</Btn></div>}
                    {!loading&&!error&&!entries.length&&<p className="wb-collab-file-status wb-muted">{filter?'没有匹配的文件':mode==='changes'?'工作区没有未提交改动':'当前目录为空'}</p>}
                    <ul className="wb-collab-file-list">{entries.map(entry=><li key={(entry.status||'')+':'+entry.path} data-selected={preview?.path===entry.path&&(!entry.status||preview.changeStatus===entry.status)}>
                        <button type="button" className="wb-collab-file-open" disabled={entry.deleted||entry.kind==='other'} title={entry.deleted?'文件已删除，无法打开当前内容':entry.path} aria-label={(entry.kind==='directory'?'打开目录 · ':'打开文件 · ')+entry.path} onClick={()=>entry.kind==='directory'?navigate(entry.path):void open(entry)}>
                            <Icon name={entry.kind==='directory'?'folder':entry.kind==='link'?'link':'book'} size={15}/><span>{mode==='changes'?entry.path:entry.name}{entry.previousPath&&<small>原路径：{entry.previousPath}</small>}</span>{entry.status&&<span className="wb-collab-file-badge">{entry.deleted?'已删除':entry.status==='??'?'新增':entry.status.trim()}</span>}{opening===entry.path&&<Spinner/>}
                        </button>
                        {mode==='changes'&&<Btn size="sm" icon="git" aria-label={'审阅改动 · '+entry.path} onClick={()=>void openProjectFile(projectId,entry.path,'diff',entry.status)}>审阅</Btn>}
                        {entry.kind==='file'&&!entry.deleted&&<IconBtn name="eye" label={'就地预览 · '+entry.path} onClick={()=>void open(entry)}/>}
                    </li>)}</ul>
                    {snapshot&&<div className="wb-collab-file-pager"><span className="wb-tiny wb-muted">共 {snapshot.total} 项{snapshot.total>0?' · '+(offset+1)+'–'+Math.min(offset+100,snapshot.total):''}</span>{(offset>0||snapshot.hasMore)&&<><Btn size="sm" disabled={!offset||loading} onClick={()=>setOffset(Math.max(0,offset-100))}>上一页</Btn><Btn size="sm" disabled={!snapshot.hasMore||loading} onClick={()=>setOffset(offset+100)}>下一页</Btn></>}</div>}
                </section>
            </div>
        </Panel>
    </div>
}

export const COLLAB_CSS=`
.wb-collab{container-type:inline-size;container-name:collab;--wb-collab-panel-max-height:clamp(260px,65vh,560px)}
.wb-collab .wb-card{max-height:var(--wb-collab-panel-max-height);min-height:0;box-sizing:border-box}
.wb-collab .wb-card>.wb-card-head{flex-shrink:0}
.wb-collab .wb-card>.wb-card-body{min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-gutter:stable}
.wb-collab-tools{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start;margin-bottom:14px}
.wb-collab-search-form{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.wb-collab-search-form>.wb-input{flex:1 1 180px;min-width:0}.wb-collab-search-form>label{flex-basis:100%}
.wb-collab-search-history,.wb-collab-review-summary{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
.wb-collab-search-history>button{max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid var(--dsw-alias-border-l1);border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer}
.wb-collab-search-results,.wb-collab-review-list{list-style:none;margin:8px 0;padding:0}
.wb-collab-search-results>li,.wb-collab-review-list>li{border-top:1px solid var(--dsw-alias-border-l1)}
.wb-collab-search-results button,.wb-collab-review-list button{display:flex;flex-direction:column;gap:4px;text-align:left;width:100%;border:0;background:transparent;color:var(--dsw-alias-label-primary);padding:9px 2px;font:inherit;font-size:12px;cursor:pointer;overflow-wrap:anywhere}
.wb-collab-search-results code{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}.wb-collab-review-list span,.wb-collab-review-list small{color:var(--dsw-alias-label-secondary)}
.wb-collab-search-results button:focus-visible,.wb-collab-review-list button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
@container collab (max-width:760px){.wb-collab-tools{grid-template-columns:minmax(0,1fr)}}
.wb-collab-summary{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:0 0 14px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.wb-collab-summary>.wb-mono{flex:1 1 240px;min-width:0;overflow-wrap:anywhere}
.wb-collab-files,.wb-collab-file-browser{min-width:0}
.wb-collab-files{margin-bottom:14px}
.wb-collab-file-layout{display:flex;min-height:160px}
.wb-collab-file-browser{flex:1}
.wb-collab-file-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding-bottom:10px}
.wb-collab-file-tools>.wb-input{flex:1 1 160px;min-width:0;width:160px}
.wb-collab-breadcrumb{display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:0 0 8px;font-size:12px}
.wb-collab-breadcrumb>button:not(.wb-btn){font:inherit;border:0;background:transparent;color:var(--dsw-alias-brand-primary);cursor:pointer;overflow-wrap:anywhere;max-width:100%;padding:4px}
.wb-collab-file-list{list-style:none;padding:0;margin:0}
.wb-collab-file-list>li{display:flex;align-items:center;border-top:1px solid var(--dsw-alias-border-l1);min-width:0}
.wb-collab-file-list>li:hover,.wb-collab-file-list>li[data-selected=true]{background:var(--dsw-alias-bg-layer-2)}
.wb-collab-file-open{display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:9px 4px;border:0;background:transparent;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer}
.wb-collab-file-open:disabled{cursor:default;opacity:.6}
.wb-collab-file-open>span:first-of-type{flex:1;min-width:0;overflow-wrap:anywhere}
.wb-collab-file-open small{display:block;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.wb-collab-file-badge{flex:none;font-size:10px;color:var(--dsw-alias-label-secondary);padding:2px 5px;border:1px solid var(--dsw-alias-border-l1);border-radius:4px}
.wb-collab-file-status{padding:12px 4px;font-size:12px;overflow-wrap:anywhere;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wb-collab-file-pager{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding-top:10px}
.wb-collab-file-pager>span{margin-right:auto}
.wb-collab-file-list button:focus-visible,.wb-collab-breadcrumb button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
`
