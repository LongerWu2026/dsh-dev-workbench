import * as React from 'react'
import {WB,Btn,Input,Panel,Spinner} from '../../core/runtime.js'
import {openProjectFile} from './ProjectFilePreview.js'

export function ProjectSearch({projectId,repoPath}:{projectId:string;repoPath:string}){
    const key=projectId+':'+repoPath,cached=WB.store.get().projectSearchViews?.[key]
    const [query,setQuery]=React.useState(cached?.query||''),[caseSensitive,setCaseSensitive]=React.useState(cached?.caseSensitive||false)
    const [result,setResult]=React.useState<any>(cached?.result||null),[history,setHistory]=React.useState<string[]>([]),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('')
    const generation=React.useRef(0),dirty=React.useRef(false),searching=React.useRef(false)
    const rpc=(request:any)=>WB.rpc('workbench/projectFiles',{request:{projectId,...request}})
    React.useEffect(()=>{
        let live=true
        rpc({action:'workspace'}).then((value:any)=>{if(!live)return;setHistory(value?.search?.history||[]);if(!cached&&!dirty.current){setQuery(value?.search?.query||'');setCaseSensitive(value?.search?.caseSensitive===true)}}).catch((failure:any)=>{if(live)setError('搜索记录读取失败：'+failure.message)})
        return()=>{live=false;generation.current++}
    },[])
    function remember(nextQuery:string,nextCase:boolean,nextResult:any=result){WB.store.set((state:any)=>({projectSearchViews:{...state.projectSearchViews,[key]:{query:nextQuery,caseSensitive:nextCase,result:nextResult}}}))}
    async function search(event?:React.FormEvent){
        event?.preventDefault();if(!query.trim()||searching.current)return
        const version=++generation.current,text=query,sensitive=caseSensitive
        searching.current=true;setBusy(true);setError('')
        try{
            const value=await rpc({action:'search',query:text,caseSensitive:sensitive})
            if(version!==generation.current)return
            if(!Array.isArray(value?.hits))throw Error('当前宿主尚未加载项目搜索接口，请重新加载插件')
            setResult(value);remember(text,sensitive,value);setHistory(previous=>[text,...previous.filter(row=>row!==text)].slice(0,10))
        }catch(failure:any){if(version===generation.current)setError(failure.message||String(failure))}
        finally{searching.current=false;if(version===generation.current)setBusy(false)}
    }
    return <Panel title="项目全文搜索" icon="search" sub="搜索当前项目的文本文件，按文件与行号定位。">
        <form className="wb-collab-search-form" onSubmit={event=>void search(event)}>
            <Input aria-label="项目全文搜索词" placeholder="函数名、配置项或报错关键字" value={query} maxLength={200} onChange={(event:any)=>{dirty.current=true;setQuery(event.target.value);remember(event.target.value,caseSensitive)}}/>
            <Btn size="sm" kind="primary" disabled={busy||!query.trim()} onClick={()=>void search()}>{busy?'搜索中…':'搜索项目'}</Btn>
            <label className="wb-tiny"><input type="checkbox" checked={caseSensitive} onChange={event=>{dirty.current=true;setCaseSensitive(event.target.checked);remember(query,event.target.checked)}}/> 区分大小写</label>
        </form>
        {history.length>0&&<div className="wb-collab-search-history" aria-label="本项目最近搜索">{history.slice(0,5).map(text=><button type="button" key={text} title={text} onClick={()=>{dirty.current=true;setQuery(text);remember(text,caseSensitive)}}>{text}</button>)}</div>}
        {error&&<p role="alert" className="wb-tiny">{error}</p>}
        {busy&&<p role="status" className="wb-row wb-tiny"><Spinner/>正在搜索当前项目…</p>}
        {result&&<>
            <p className="wb-tiny wb-muted">搜索快照：“{result.query}” · {result.hits.length} 处命中 · 已扫描 {result.scanned||0} 个文件{result.skipped?' · 跳过 '+result.skipped+' 项':''}。再次搜索可获取最新内容。</p>
            {result.limited&&<p role="status" className="wb-tiny">{result.note||'结果达到上限，请缩小关键词范围。'}</p>}
            {!result.hits.length?<p className="wb-tiny wb-muted">未找到匹配内容。</p>:<ul className="wb-collab-search-results" aria-label="项目全文搜索结果">{result.hits.map((hit:any,index:number)=><li key={hit.path+':'+hit.line+':'+index}><button type="button" aria-label={'打开搜索结果 · '+hit.path+':'+hit.line} onClick={()=>void openProjectFile(projectId,hit.path,'file',undefined,hit.line)}><strong>{hit.path}:{hit.line}</strong><code>{hit.snippet}</code></button></li>)}</ul>}
        </>}
        <p className="wb-tiny wb-muted">跳过依赖、构建目录、二进制及超过 1 MB 的文件。</p>
    </Panel>
}
