import * as React from 'react'
import {Badge, Panel, WB} from '../../core/runtime.js'

export function GithubPanel({snapshot}:{snapshot:any}) {
    const state=snapshot?.status
    return <Panel title="PR 与 CI" icon="git" sub={snapshot?.at?'更新于 '+WB.fmt.relative(snapshot.at):undefined} badge={snapshot?<Badge tone={state==='ok'?'ok':state==='partial'?'warn':state==='unavailable'?'idle':'err'}>{({ok:'已读取',partial:'部分失败',unavailable:'不可用',error:'读取失败'} as any)[state]||'读取失败'}</Badge>:null}>
        {!snapshot?<span className="wb-tiny wb-muted">读取中…</span>:state==='unavailable'?<p className="wb-tiny" role="alert">{snapshot.note}</p>:<div className="wb-stack">
            {(['prs','runs'] as const).map(key=>{
                const group=snapshot[key],label=key==='prs'?'PR':'CI',failed=group?.status?group.status!=='ok':state!=='ok',items=group?.items||[]
                return <section key={key} aria-label={label+'读取结果'}><strong className="wb-label">{label}{!failed?'（'+items.length+'）':''}</strong>
                    {failed?<p role="alert" className="wb-tiny" style={{overflowWrap:'anywhere'}}>{group?.note||snapshot.note||label+'读取失败，请重新探测。'}</p>:!items.length?<p className="wb-tiny wb-muted">{key==='prs'?'当前仓库没有打开的 PR。':'没有 CI 运行记录。'}</p>:items.slice(0,6).map((item:any)=>{
                        const title=key==='prs'?item.title:item.workflow||'CI',badge=key==='prs'?'#'+item.number:item.conclusion||item.status
                        return <div className="wb-item" key={item.number||item.id}><Badge tone={key==='prs'?'idle':item.conclusion==='success'?'ok':item.conclusion==='failure'?'err':'warn'}>{badge}</Badge><div className="wb-item-main"><div className="wb-item-title">{item.url?<a className="wb-link" href={item.url} target="_blank" rel="noreferrer">{title}</a>:title}{item.draft&&<Badge tone="idle">草稿</Badge>}</div><div className="wb-item-sub">{[item.author||item.branch,(item.updatedAt||item.createdAt)?WB.fmt.relative(item.updatedAt||item.createdAt):''].filter(Boolean).join(' · ')}</div></div></div>
                    })}
                </section>
            })}
        </div>}
    </Panel>
}
