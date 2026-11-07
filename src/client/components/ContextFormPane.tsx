import * as React from 'react'
import {Icon} from './primitives.js'
interface Props {open:boolean;title:string;ariaLabel?:string;sub?:string;closeLabel?:string;onClose:()=>void;footer?:React.ReactNode;children?:React.ReactNode}
export function ContextFormPane({open,title,ariaLabel,sub,closeLabel='关闭编辑',onClose,footer,children}:Props):React.ReactElement|null {
 if(!open)return null
 return <aside className="wb-context-pane" aria-label={ariaLabel||title} onKeyDown={e=>{if(e.key==='Escape')onClose()}}><header className="wb-context-header"><div className="wb-context-title"><strong>{title}</strong>{sub&&<p className="wb-tiny wb-muted">{sub}</p>}</div><button type="button" className="wb-iconbtn" aria-label={closeLabel} title={closeLabel} onClick={onClose}><Icon name="close" size={15}/></button></header><div className="wb-context-body">{children}</div><footer className="wb-context-footer">{footer}</footer></aside>
}
