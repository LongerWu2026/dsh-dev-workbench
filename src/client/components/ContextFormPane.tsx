import * as React from 'react'
interface Props {open:boolean;title:string;sub?:string;onClose:()=>void;footer?:React.ReactNode;children?:React.ReactNode}
export function ContextFormPane({open,title,sub,onClose,footer,children}:Props):React.ReactElement|null {
 if(!open)return null
 return <aside className="wb-context-pane" aria-label={title} onKeyDown={e=>{if(e.key==='Escape')onClose()}}><header className="wb-context-header"><div><strong>{title}</strong>{sub&&<p className="wb-tiny wb-muted">{sub}</p>}</div><button type="button" className="wb-chip" aria-label="关闭编辑" onClick={onClose}>关闭</button></header><div className="wb-context-body">{children}</div><footer className="wb-context-footer">{footer}</footer></aside>
}
