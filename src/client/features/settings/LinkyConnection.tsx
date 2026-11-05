import * as React from 'react'
import {Badge,Btn,WB} from '../../core/runtime.js'
import {LINKY_INSTALL_URL} from '../../../shared/development.js'
import {developmentCall} from '../agents/development-ui.js'

export function LinkyConnection(){
    const [installed,setInstalled]=React.useState<boolean|null>(null)
    const [checking,setChecking]=React.useState(true)
    const [error,setError]=React.useState('')
    const refreshRef=React.useRef<()=>void>(()=>{})

    React.useEffect(()=>{
        let active=true, pending=false
        async function refresh(){
            if(pending||document.visibilityState==='hidden')return
            pending=true
            setChecking(true)
            try{
                const result=await developmentCall({action:'detectInstallation'})
                if(typeof result?.installed!=='boolean')throw new Error('无法读取 Linky 安装状态')
                if(active){setInstalled(result.installed);setError('')}
            }catch(failure){
                if(active){setInstalled(null);setError(failure instanceof Error?failure.message:'无法读取 Linky 安装状态')}
            }finally{
                pending=false
                if(active)setChecking(false)
            }
        }
        refreshRef.current=refresh
        void refresh()
        window.addEventListener('focus',refresh)
        document.addEventListener('visibilitychange',refresh)
        return ()=>{
            active=false
            window.removeEventListener('focus',refresh)
            document.removeEventListener('visibilitychange',refresh)
        }
    },[])

    return <section className="wb-item" style={{flexWrap:'wrap'}} aria-label="Linky 连接">
        <div className="wb-item-main" style={{flex:'1 1 140px'}}>
            <div className="wb-item-title">Linky {installed===true?<Badge tone="ok">{WB.connectorState('ok').label}</Badge>:
                <Badge tone={error?'err':'idle'}>{checking?'检测中…':error?'检测失败':'未安装'}</Badge>}</div>
            <div className="wb-item-sub" title={error||undefined}>{error?'无法检测本机安装，请重新检测。':'研发任务的需求与缺陷来源，连接状态基于本机安装。'}</div>
        </div>
        <div className="wb-row wb-row--wrap" style={{flex:'0 1 auto'}}>
            {installed===false&&<a className="wb-btn wb-btn--sm" style={{textDecoration:'none'}} href={LINKY_INSTALL_URL} target="_blank" rel="noreferrer">官网下载</a>}
            <Btn size="sm" disabled={checking} onClick={()=>refreshRef.current()}>重新检测</Btn>
        </div>
    </section>
}
