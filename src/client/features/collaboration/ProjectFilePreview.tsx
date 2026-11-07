import * as React from 'react'
import {WB,Btn,Spinner,useStore} from '../../core/runtime.js'
import {ContextFormPane} from '../../components/ContextFormPane.js'
import {projectDiffText,projectReviewPrompt} from '../../../shared/project-review.js'

let returnFocus:HTMLElement|null=null
export function projectFilePreviewActive(state:any):boolean {
    const preview=state.projectFilePreview
    return !!preview&&state.page==='collab'&&state.collabProjectId===preview.projectId
        &&state.data?.projects?.some((project:any)=>project.id===preview.projectId&&project.repoPath===preview.repoPath)
        &&state.taskForm===preview.taskForm&&state.assistantOpen===preview.assistantOpen
        &&state.assistantOpenSeq===preview.assistantOpenSeq
}
export function closeProjectFile(restoreFocus=true){
    if(WB.store.get().projectFilePreview)WB.store.set({projectFilePreview:null})
    if(restoreFocus&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true})
    returnFocus=null
}
/** A workbench-owned preview never selects a native conversation or changes the main panel. */
export async function openProjectFile(projectId:string,path:string,view:'file'|'diff'='file',changeStatus?:string,line?:number){
    const state=WB.store.get(),project=state.data?.projects?.find((row:any)=>row.id===projectId)
    if(state.page!=='collab'||state.collabProjectId!==projectId||!project?.repoPath)return
    if(!(document.activeElement as HTMLElement|null)?.closest('.wb-project-file-preview'))returnFocus=document.activeElement as HTMLElement|null
    const token={},preview={token,projectId,path,view,changeStatus,targetLine:Number.isSafeInteger(line)&&Number(line)>0?line:undefined,repoPath:project.repoPath,status:'loading',taskForm:state.taskForm,assistantOpen:state.assistantOpen,assistantOpenSeq:state.assistantOpenSeq}
    const current=()=>WB.store.get().projectFilePreview?.token===token&&projectFilePreviewActive(WB.store.get())
    const rpc=(action:string)=>WB.rpc('workbench/projectFiles',{request:{projectId,path,action,...(action==='diff'&&changeStatus?{changeStatus}:{})}})
    WB.store.set({projectFilePreview:preview})
    try{
        if(view==='diff'){
            const result=await rpc('diff')
            if(!current())return
            if(!Array.isArray(result?.sections))throw Error('当前宿主尚未加载改动审阅接口，请重新加载插件')
            WB.store.set({projectFilePreview:{...result,...preview,changeStatus:result.status,status:'ready'}})
            return
        }
        const resolved=await rpc('resolve')
        if(!current())return
        if(resolved.kind==='directory'){closeProjectFile(false);return {directory:path}}
        WB.store.set({projectFilePreview:{...preview,absolutePath:resolved.absolutePath,bytes:resolved.bytes}})
        const result=await rpc('read')
        if(!current())return
        if(typeof result?.text!=='string')throw Error('当前宿主尚未加载文件预览接口，请重新加载插件')
        WB.store.set({projectFilePreview:{...preview,...result,status:'ready'}})
    }catch(error:any){if(current())WB.store.set({projectFilePreview:{...preview,status:'error',error:error.message||String(error)}})}
}

export function ProjectFilePreviewHost(){
    const state=useStore(),preview=state.projectFilePreview,active=projectFilePreviewActive(state)
    const root=React.useRef<HTMLDivElement>(null),[compact,setCompact]=React.useState(false)
    const [savingToken,setSavingToken]=React.useState<object|null>(null),saving=React.useRef(new Set<object>())
    React.useEffect(()=>{
        if(preview&&!active&&WB.store.get().projectFilePreview?.token===preview.token)closeProjectFile(false)
    },[preview,active])
    React.useEffect(()=>()=>{closeProjectFile(false)},[])
    React.useLayoutEffect(()=>{
        if(!active||!root.current)return
        const node=root.current,parent=node.parentElement
        node.querySelector<HTMLButtonElement>('.wb-context-header button')?.focus({preventScroll:true})
        const measure=()=>setCompact((parent?.getBoundingClientRect().width||window.innerWidth)<=760)
        measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure)
        if(parent)observer?.observe(parent)
        window.addEventListener('resize',measure)
        return()=>{observer?.disconnect();window.removeEventListener('resize',measure)}
    },[active,preview?.token])
    React.useLayoutEffect(()=>{
        if(!active||preview?.status!=='ready'||!preview.targetLine)return
        const body=root.current?.querySelector<HTMLElement>('.wb-context-body'),line=root.current?.querySelector<HTMLElement>('[data-project-target-line]')
        if(body&&line)body.scrollTop+=line.getBoundingClientRect().top-body.getBoundingClientRect().top-body.clientHeight/2
    },[active,preview?.token,preview?.status])
    if(!active)return null
    const diff=preview.view==='diff'
    const reviewLabels:any={pending:'待审阅',reviewed:'已审阅',stale:'内容已变化，需重新审阅',unavailable:'审阅记录暂不可用'}
    async function mark(){
        const current=preview,token=current.token;if(saving.current.has(token))return
        saving.current.add(token);setSavingToken(token)
        try{
            const review=await WB.rpc('workbench/projectFiles',{request:{projectId:current.projectId,path:current.path,view:current.view||'file',changeStatus:current.changeStatus,action:current.review?.status==='reviewed'?'reviewUnmark':'reviewMark',fingerprint:current.fingerprint}})
            WB.store.set((state:any)=>({projectReviewVersions:{...state.projectReviewVersions,[current.projectId]:(state.projectReviewVersions?.[current.projectId]||0)+1},...(state.projectFilePreview?.token===token?{projectFilePreview:{...state.projectFilePreview,review}}:{})}))
        }catch(error:any){if(WB.store.get().projectFilePreview?.token===token)WB.toast(error.message||String(error),'err')}
        finally{saving.current.delete(token);setSavingToken(previous=>previous===token?null:previous)}
    }
    async function copyDiff(){try{await WB.util.copy(projectDiffText(preview));WB.toast('已复制当前文件差异','ok')}catch(error:any){WB.toast(error.message,'err')}}
    function explain(){
        const text=projectReviewPrompt(preview)
        WB.assistant.openHub('system','analysis')
        WB.store.set({assistantDraftRequest:{id:'project-review-'+Date.now(),conversationId:'system:analysis',text}})
    }
    function keyboard(event:React.KeyboardEvent){
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeProjectFile();return}
        if(!compact||event.key!=='Tab')return
        const nodes=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]')||[])
        const first=nodes[0],last=nodes.at(-1)
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    }
    return <>
        {compact&&<button type="button" className="wb-project-file-backdrop" tabIndex={-1} aria-label="关闭文件侧栏" onClick={()=>closeProjectFile()}/>}
        <div ref={root} className="wb-project-file-preview" role={compact?'dialog':undefined} aria-label={compact?'文件侧栏':undefined} aria-modal={compact?true:undefined} onKeyDown={keyboard}>
            <ContextFormPane open title={diff?'改动审阅':'文件预览'} ariaLabel="项目文件预览" sub={preview.path} closeLabel="关闭文件预览" onClose={()=>closeProjectFile()} footer={<>
                <span className="wb-tiny wb-muted">只读预览{preview.bytes!==undefined?' · '+WB.fmt.bytes(preview.bytes):''}</span>
                {preview.status==='ready'&&preview.fingerprint&&<Btn size="sm" icon="check" disabled={savingToken===preview.token} onClick={()=>void mark()}>{savingToken===preview.token?'保存标记中…':preview.review?.status==='reviewed'?'取消已审阅':'标记已审阅'}</Btn>}
                {diff&&preview.status==='ready'&&<><Btn size="sm" icon="copy" onClick={()=>void copyDiff()}>复制差异</Btn><Btn size="sm" icon="sparkles" disabled={!preview.sections?.some((section:any)=>section.text)} onClick={explain}>交给 AI 解释</Btn></>}
                <Btn size="sm" icon="refresh" disabled={preview.status==='loading'} onClick={()=>void openProjectFile(preview.projectId,preview.path,preview.view,preview.changeStatus,preview.targetLine)}>重新读取</Btn>
            </>}>
                {preview.status==='ready'&&preview.review&&<p className="wb-project-review-state" role="status">{reviewLabels[preview.review.status]||preview.review.status}{preview.review.reviewedAt?' · '+WB.fmt.datetime(preview.review.reviewedAt):''}{preview.review.reason?' · '+preview.review.reason:''}</p>}
                {preview.status==='loading'?<p role="status" className="wb-row"><Spinner/>{diff?'正在读取差异…':'正在读取文件…'}</p>:preview.status==='error'?<p role="alert">{preview.error}</p>:diff?<div className="wb-project-diff" aria-label="文件差异">
                    <p className="wb-tiny wb-muted">AI 解释会先填入助手草稿，确认发送后才调用模型。</p>
                    {(preview.sections||[]).map((section:any)=><section key={section.id} aria-label={section.label+'差异'}><h3>{section.label}</h3>{section.unavailable?<p role="status">{section.unavailable}</p>:section.text?<pre className="wb-project-file-content" tabIndex={0}>{section.text.split('\n').map((line:string,index:number)=><span key={index} className={section.id!=='untracked'&&line.startsWith('+')&&!line.startsWith('+++')?'is-added':section.id!=='untracked'&&line.startsWith('-')&&!line.startsWith('---')?'is-removed':undefined}>{line+'\n'}</span>)}</pre>:<p className="wb-tiny wb-muted">此部分没有差异。</p>}</section>)}
                </div>:<ProjectText text={preview.text||''} line={preview.targetLine}/>}
            </ContextFormPane>
        </div>
    </>
}

function ProjectText({text,line}:{text:string;line?:number}){
    const lines=line?text.split('\n'):[],target=line&&line<=lines.length?line:undefined
    return <>{line&&<p className="wb-tiny wb-muted">{target?'定位到第 '+target+' 行':'搜索行号已超出当前文件范围，请重新搜索。'}</p>}<pre className="wb-project-file-content" tabIndex={0} aria-label="文件内容">{target?<>{target>1?lines.slice(0,target-1).join('\n')+'\n':''}<mark data-project-target-line>{lines[target-1]||' '}</mark>{target<lines.length?'\n'+lines.slice(target).join('\n'):''}</>:text||'（空文件）'}</pre></>
}

export const PROJECT_FILE_PREVIEW_CSS=`
.wb-workarea.is-file-preview-open{position:relative;isolation:isolate}
.wb-workarea.is-file-preview-open>.wb-assistant,.wb-workarea.is-file-preview-open>.wb-context-pane{display:none}
.wb-project-file-preview{display:flex;flex:0 0 480px;width:480px;min-width:300px;max-width:55%;min-height:0;overflow:hidden}
.wb-project-file-preview>.wb-context-pane{flex:1;width:100%;min-width:0;max-width:100%;height:100%;box-sizing:border-box}
.wb-project-file-preview .wb-context-title>p{margin:4px 0 0;overflow-wrap:anywhere}
.wb-project-file-preview .wb-context-footer>span{margin-right:auto}
.wb-project-file-content{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:4;font:12px/1.7 ui-monospace,SFMono-Regular,monospace}
.wb-project-file-content mark{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 25%,transparent);color:inherit}.wb-project-review-state{font-size:12px;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}
.wb-project-diff>section+section{margin-top:18px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px}
.wb-project-diff h3{font-size:12px;margin:0 0 8px}.wb-project-diff .is-added{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}.wb-project-diff .is-removed{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d44) 12%,transparent)}
.wb-project-file-backdrop{position:absolute;inset:0;z-index:19;border:0;background:#0004;cursor:pointer}
@container workbench (max-width:760px){.wb-project-file-preview{position:absolute;inset:0 0 0 auto;z-index:20;flex:none;width:min(100%,520px);min-width:0;max-width:100%;box-shadow:-8px 0 24px #0002}}
`
