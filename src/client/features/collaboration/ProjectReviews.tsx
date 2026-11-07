import * as React from 'react'
import {WB,Btn,Badge,Panel,Select,Spinner,useStore} from '../../core/runtime.js'
import {openProjectFile} from './ProjectFilePreview.js'

export function ProjectReviews({projectId,refreshVersion=0}:{projectId:string;refreshVersion?:number}){
    const state=useStore(),[snapshot,setSnapshot]=React.useState<any>(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('')
    const [filter,setFilter]=React.useState('all'),[offset,setOffset]=React.useState(0),[version,setVersion]=React.useState(0),generation=React.useRef(0)
    React.useEffect(()=>{
        const current=++generation.current;setBusy(true);setError('')
        WB.rpc('workbench/projectFiles',{request:{projectId,action:'reviews',filter,offset}}).then((value:any)=>{if(current!==generation.current)return;if(!Array.isArray(value?.entries))throw Error('当前宿主尚未加载审阅进度接口，请重新加载插件');setSnapshot(value)})
            .catch((failure:any)=>{if(current===generation.current)setError(failure.message||String(failure))}).finally(()=>{if(current===generation.current)setBusy(false)})
        return()=>{generation.current++}
    },[projectId,filter,offset,version,refreshVersion,state.projectReviewVersions?.[projectId]])
    const summary=snapshot?.summary||{},labels:any={pending:'待审阅',reviewed:'已审阅',stale:'需重新审阅',inactive:'已无待审改动',unverified:'暂未核对'}
    return <Panel title="审阅进度" icon="checkCircle" sub="记录保存在本机，按项目与目录分开；内容变化后需重新审阅。" actions={<Btn size="sm" disabled={busy} icon="refresh" onClick={()=>setVersion(value=>value+1)}>刷新进度</Btn>}>
        <div className="wb-collab-review-summary"><Badge tone="ok">已阅 {summary.reviewed||0}</Badge><Badge tone="idle">待阅 {summary.pending||0}</Badge><Badge tone="warn">需重审 {summary.stale||0}</Badge></div>
        <Select aria-label="筛选审阅进度" value={filter} options={[{value:'all',label:'全部'},{value:'pending',label:'待审阅'},{value:'stale',label:'需重新审阅'},{value:'reviewed',label:'已审阅'}]} onChange={(event:any)=>{setFilter(event.target.value);setOffset(0)}}/>
        {busy&&<p role="status" className="wb-row wb-tiny"><Spinner/>正在核对审阅记录…</p>}
        {error&&<p role="alert" className="wb-tiny">{error}</p>}
        {snapshot?.changeError&&<p className="wb-tiny wb-muted">改动列表暂不可用：{snapshot.changeError}；文件阅读记录仍可核对。</p>}
        {summary.unverified>0&&<p role="status" className="wb-tiny">{summary.unverified} 条记录暂未核对，请刷新后继续确认。</p>}
        {!busy&&snapshot&&!snapshot.entries?.length&&<p className="wb-tiny wb-muted">{filter==='all'?'还没有审阅记录或待审阅改动。':'没有符合筛选的记录。'}</p>}
        <ul className="wb-collab-review-list" aria-label="本项目审阅记录">{(snapshot?.entries||[]).map((row:any)=><li key={row.view+':'+row.path+':'+row.changeStatus}>
            <button type="button" aria-label={'继续审阅 · '+row.path+' · '+row.view} disabled={row.status==='inactive'} onClick={()=>void openProjectFile(projectId,row.path,row.view,row.changeStatus)}><strong>{row.path}</strong><span>{row.view==='diff'?'改动审阅':'文件阅读'} · {labels[row.status]||row.status}</span>{row.reason&&<small>{row.reason}</small>}{row.reviewedAt&&<small>标记于 {WB.fmt.datetime(row.reviewedAt)}</small>}</button>
        </li>)}</ul>
        {snapshot&&<div className="wb-collab-file-pager"><span className="wb-tiny wb-muted">共 {snapshot.total||0} 项</span>{(offset>0||snapshot.hasMore)&&<><Btn size="sm" disabled={!offset||busy} onClick={()=>setOffset(Math.max(0,offset-20))}>上一页记录</Btn><Btn size="sm" disabled={!snapshot.hasMore||busy} onClick={()=>setOffset(offset+20)}>下一页记录</Btn></>}</div>}
    </Panel>
}
