import * as React from 'react'
import {Btn} from '../core/runtime.js'
export function CompactEmptyState({empty,onCreate,onBrowse}:{empty:boolean;onCreate:()=>void;onBrowse:()=>void}):React.ReactElement {
 return <div className="wb-stack" style={{padding:'16px',gap:8}}><strong>{empty?'还没有待办':'今天没有必须处理的待办'}</strong><p className="wb-tiny wb-muted" style={{margin:0}}>{empty?'同步消息并开启 AI 后，可从待回复页确认识别出的事项。':'其他事项可在任务中心继续查看。'}</p><div><Btn size="sm" kind="primary" onClick={empty?onCreate:onBrowse}>{empty?'新建第一条待办':'查看全部待办'}</Btn></div></div>
}
