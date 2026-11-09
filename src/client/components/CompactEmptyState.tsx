import * as React from 'react'
import {Btn} from '../core/runtime.js'
export function CompactEmptyState({empty,onCreate,onBrowse}:{empty:boolean;onCreate:()=>void;onBrowse:()=>void}):React.ReactElement {
 const hint=empty?'同步消息并开启 AI 后，可从待回复页确认识别出的事项。':'其他事项可在任务中心继续查看。';
 return <div className="wb-brief-task-empty">
  <span className="wb-muted">{empty?'还没有待办':'今天没有必须处理的待办'}</span>
  <Btn size="sm" kind="subtle" title={hint} onClick={empty?onCreate:onBrowse}>{empty?'新建第一条待办':'查看全部待办'}</Btn>
 </div>
}
