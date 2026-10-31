import * as React from 'react'
import {Badge, Btn, WB} from '../../core/runtime.js'

export function YunzhijiaConnection({initial}: {initial?: any}) {
    const [connector, setConnector] = React.useState(initial)
    const [operation, setOperation] = React.useState<any>(null)
    const [pending, setPending] = React.useState(false)
    const [checking, setChecking] = React.useState(false)
    const live = React.useRef(false)
    const inFlight = React.useRef(false)
    const refresh = React.useCallback(async (force = true, operationOnly = false) => {
        if (inFlight.current) return
        inFlight.current = true
        if (!operationOnly) setChecking(true)
        try {
            const result = await WB.rpc('workbench/yunzhijiaStatus', {request:{force,operationOnly}})
            if (live.current && result?.connector) {
                setConnector(result.connector)
                setOperation(result.operation)
                if (operationOnly && result.operation?.status === 'failed') WB.toast(result.operation.note || '操作失败，请重试', 'err')
            }
        } catch { if (live.current) { setOperation(null); WB.toast('检测失败，请重新加载工作台后重试', 'err') } }
        finally { inFlight.current = false; if (live.current) setChecking(false) }
    }, [])
    React.useEffect(()=>{
        live.current = true
        return ()=>{live.current = false}
    }, [])
    React.useEffect(()=>{setConnector(initial)}, [initial])
    // Only an explicitly started operation needs progress reads. These reads
    // never probe the connection; the Host verifies once when the action ends.
    React.useEffect(()=>{
        if (operation?.status !== 'running') return
        const timer = setInterval(()=>void refresh(false, true), 3000)
        return ()=>clearInterval(timer)
    }, [operation?.status, refresh])
    const busy = pending || operation?.status === 'running'
    const start = async (kind: 'install'|'login') => {
        if (busy) return
        setPending(true)
        try {
            const result = await WB.rpc('workbench/yunzhijiaSetup', {request:{kind}})
            if (live.current) setOperation(result)
        } catch { if(live.current) WB.toast('操作启动失败，请重新检测后重试', 'err') }
        finally { if(live.current) setPending(false) }
    }
    const meta = WB.connectorState(connector?.authState || 'unconfigured')
    const installed = typeof connector?.installed === 'boolean' ? connector.installed : ['ok','unauthorized'].includes(connector?.authState)
    return <section className="wb-item" style={{alignItems:'flex-start',flexWrap:'wrap'}} aria-label="云之家连接">
        <div className="wb-item-main" style={{flex:'1 1 140px'}}>
            <div className="wb-item-title">云之家<Badge tone={meta.tone}>{meta.label}</Badge></div>
            <div className="wb-item-sub">同步云之家消息与文档，安装时获取最新版 CLI。</div>
        </div>
        <div className="wb-row wb-row--wrap" style={{flex:'0 1 auto'}}>
            <Btn size="sm" disabled={busy} onClick={()=>start('install')}>{busy && operation?.kind === 'install' ? '安装中…' : installed ? '重新安装' : '安装'}</Btn>
            {installed && connector?.authState !== 'ok' && <Btn size="sm" disabled={busy} onClick={()=>start('login')}>{busy && operation?.kind === 'login' ? '等待登录…' : '登录授权'}</Btn>}
            <Btn size="sm" disabled={busy || checking} onClick={()=>refresh()}>{checking ? '检测中…' : '重新检测'}</Btn>
        </div>
    </section>
}
