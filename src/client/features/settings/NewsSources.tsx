import * as React from 'react'
import {Badge, Btn, Chip, Field, IconBtn, Input, Modal, Panel, WB} from '../../core/runtime.js'
import {OFFICIAL_NEWS_FEEDS, OFFICIAL_NEWS_SITES} from '../../../shared/news-brief.js'

interface Feed {id:string; label:string; url:string; topics?:string[]}

export function NewsSources({feeds,onAdd}:{feeds:Feed[];onAdd:(event:React.MouseEvent<HTMLButtonElement>)=>void}) {
    const rows = [
        ...OFFICIAL_NEWS_FEEDS.map(feed=>({...feed,address:feed.url,kind:'内置 RSS',custom:false})),
        ...OFFICIAL_NEWS_SITES.map(site=>({id:site.domain,label:site.label,address:site.domain,kind:'内置官网检索',custom:false,topics:[]})),
        ...feeds.map(feed=>({...feed,address:feed.url,kind:'自定义 RSS',custom:true})),
    ]
    return <Panel title="资讯源" sub="使用内置来源和自定义订阅采集资讯" icon="radar"
        actions={<Btn size="sm" icon="plus" onClick={onAdd} aria-label="添加资讯源">添加</Btn>}>
        <div className="wb-list" role="list" aria-label="资讯源列表">
            {rows.map(row=><div className="wb-item" key={row.id} role="listitem">
                <div className="wb-item-main">
                    <div className="wb-item-title wb-row wb-row--wrap">{row.label}<Badge>{row.kind}</Badge></div>
                    <div className="wb-item-sub wb-mono">{row.address}</div>
                    {row.custom&&!!row.topics?.length&&<div className="wb-item-sub">
                        {row.topics.map(topic=><Chip key={topic}>{topic}</Chip>)}
                    </div>}
                </div>
                {row.custom&&<IconBtn name="trash" label={'移除资讯源 '+row.label}
                    onClick={()=>void WB.actions.deleteFeed(row.id).catch(()=>{})}/>}
            </div>)}
        </div>
    </Panel>
}

export function NewsFeedDialog({feeds,onClose}:{feeds:Feed[];onClose:()=>void}) {
    const [label,setLabel]=React.useState('')
    const [address,setAddress]=React.useState('')
    const [topics,setTopics]=React.useState('')
    const [saving,setSaving]=React.useState(false)
    const [error,setError]=React.useState('')
    const formId=React.useId()

    async function submit(event:React.FormEvent) {
        event.preventDefault()
        if(saving) return
        setError('')
        const url=address.trim()
        try {
            const parsed=new URL(url)
            if(!/^https?:\/\//i.test(url)||parsed.username||parsed.password) throw new Error()
        } catch {
            setError('请输入有效且不含账号密码的 HTTP 或 HTTPS 地址。')
            return
        }
        if([...OFFICIAL_NEWS_FEEDS,...feeds].some(feed=>feed.url===url)) {
            setError('这个资讯源已在列表中。')
            return
        }
        if(feeds.length>=12) {
            setError('最多可添加 12 个自定义资讯源，请先移除一项。')
            return
        }
        setSaving(true)
        try {
            await WB.actions.addFeed({label,url,topics:topics.split(/[,，\s]+/).filter(Boolean)})
            onClose()
        } catch (failure) {
            setError(failure instanceof Error?failure.message:'资讯源保存失败，请重试。')
        } finally {
            setSaving(false)
        }
    }

    return <Modal open title="添加资讯源" width={480} onClose={()=>{if(!saving)onClose()}}
        footer={<><Btn disabled={saving} onClick={onClose}>取消</Btn>
            <button className="wb-btn wb-btn--primary" type="submit" form={formId} disabled={saving||!address.trim()}>{saving?'保存中…':'保存'}</button></>}>
        <form id={formId} className="wb-stack" onSubmit={submit}>
            <Field label="RSS / Atom 地址"><Input autoFocus required maxLength={2048} disabled={saving} value={address}
                placeholder="https://example.com/feed.xml" onChange={(event:React.ChangeEvent<HTMLInputElement>)=>setAddress(event.target.value)}/></Field>
            <Field label="名称（选填）"><Input maxLength={80} disabled={saving} value={label}
                onChange={(event:React.ChangeEvent<HTMLInputElement>)=>setLabel(event.target.value)}/></Field>
            <Field label="主题（选填）"><Input disabled={saving} value={topics} placeholder="逗号分隔，例如 AI，开源"
                onChange={(event:React.ChangeEvent<HTMLInputElement>)=>setTopics(event.target.value)}/></Field>
            {error&&<p className="wb-tiny" role="alert">{error}</p>}
        </form>
    </Modal>
}
