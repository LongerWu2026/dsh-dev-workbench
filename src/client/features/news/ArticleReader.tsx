import * as React from 'react'
import {WB,Btn,Modal,Spinner} from '../../core/runtime.js'
import {NoteMarkdown,KnowledgeCaptureButton} from '../../components/KnowledgeCapture.js'

export function ArticleReader({item,onClose}:{item:any;onClose:()=>void}){
 const [article,setArticle]=React.useState<any>(null),[busy,setBusy]=React.useState(true),[error,setError]=React.useState(''),[tab,setTab]=React.useState('original'),[retry,setRetry]=React.useState(0)
 const summary=Object.entries(item.summary||{}).map(([key,value])=>value?'**'+(({change:'技术变化',usage:'应用场景',risk:'采用风险',practice:'推荐实践'} as any)[key]||key)+'**\n\n'+value:'').filter(Boolean).join('\n\n')||item.excerpt||''
 React.useEffect(()=>{let active=true;setBusy(true);setError('');WB.actions.radarArticle({id:item.id,reload:retry>0}).then((result:any)=>{if(active)setArticle(result)}).catch((e:any)=>{if(active)setError(e.message||'原文暂不可用')}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[item.id,retry])
 return <Modal open title={item.title} width={860} onClose={onClose} footer={<><Btn onClick={onClose}>关闭</Btn><KnowledgeCaptureButton request={{kind:'radar',id:item.id,linkOnly:!article}} label={article?'收藏原文':'仅收藏链接'}/></>}>
  <div className="wb-row wb-row--wrap" style={{gap:8,marginBottom:10}}><Btn size="sm" onClick={()=>setTab('original')}>原文</Btn><Btn size="sm" onClick={()=>setTab('summary')}>摘要</Btn>{article&&<Btn size="sm" onClick={()=>WB.util.copy(article.body).then(()=>WB.toast('已复制原文','ok')).catch(()=>WB.toast('复制失败','warn'))}>复制原文</Btn>}<a className="wb-link wb-tiny" href={item.url} target="_blank" rel="noreferrer">打开官网</a><Btn size="sm" disabled={busy} onClick={()=>setRetry(n=>n+1)}>重新读取</Btn></div>
  {tab==='summary'?<NoteMarkdown text={summary||'暂无摘要'}/>:<>{busy&&<p role="status"><Spinner size={14}/>正在读取原文…</p>}{!article&&summary&&<section aria-label="资讯摘要预览"><p className="wb-tiny wb-muted">以下为已有摘要，原文读取完成后自动显示。</p><NoteMarkdown text={summary}/></section>}{error&&<p role="alert">原文暂不可用：{error} {article?'已保留上次快照。':'可仅收藏链接。'}</p>}{article&&<><p className="wb-tiny wb-muted">{article.cached?'本地快照':'原文已保存快照'} · {WB.fmt.datetime(article.fetchedAt)}{article.author?' · '+article.author:''}</p><NoteMarkdown text={article.body}/></>}</>}
 </Modal>
}
